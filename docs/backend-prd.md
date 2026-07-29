# Art Explore — Backend PRD

**Source:** Extracted from [`architecture.md`](../architecture.md) (infrastructure, caching,
upload, deployment, NFRs) and reconciled with the current backend implementation
(`src/`, `prisma/schema.prisma`). Where the architecture doc and the built system
disagree, this PRD follows the built system and flags the gap in §10.

---

## 1. Purpose

Art Explore is a gallery-discovery and mapping platform for the Lagos / West African
art scene. The backend is a REST API that serves a public web/mobile client (discover
and map art venues and their exhibitions) and an admin control panel (curate venues,
review public submissions, manage taxonomy).

## 2. Goals & Non-Goals

**Goals**
- Serve a fast, cacheable public catalogue of art venues ("institutions") and their
  exhibitions, including a lightweight map view.
- Let the public submit venues for admin review; let admins approve, publish, and curate.
- Keep media (venue/exhibition images) off the application server and in object storage.
- Run cheaply (~$35–45/month at Lagos small scale) on a single managed server, and
  scale to thousands of users without re-architecting.

**Non-Goals (this phase)**
- Artwork-level catalogue, reviews/ratings, and ticketing (listed illustratively in
  `architecture.md` but not built — see §9).
- Auto-scaling / multi-region. Option B (containers/serverless) is a later migration.

## 3. Technical Stack

| Concern | Choice | Source |
|---|---|---|
| API server | Node.js + Express (REST, versioned under `/api/v1`) | impl |
| ORM | Prisma | architecture.md §"What Prisma Does" |
| Primary DB | PostgreSQL (AWS RDS, managed) | architecture.md |
| Cache / ephemeral store | Upstash Redis (serverless) | architecture.md |
| Media storage | AWS S3 | architecture.md |
| CDN / TLS | AWS CloudFront in front of S3 + EC2 | architecture.md |
| Host | EC2 (t3.small), process-managed by pm2 | architecture.md |
| Auth | JWT (access + refresh), bcrypt password hashing | impl |

## 4. System Architecture (Option A — recommended start)

Monolithic Express API on EC2, fronted by CloudFront. CloudFront routes `/api/*` to
EC2 and everything else to an S3 static bucket (React build). The API reads/writes RDS
Postgres via Prisma, uses Upstash Redis as a read-through cache and rate limiter, and
stores uploaded images in a separate S3 media bucket served via CloudFront.

Request flow: client → CloudFront → (cache check in Redis) → Prisma → RDS → cache fill
→ response. (architecture.md, "How It Works Step-by-Step")

## 5. Functional Requirements

### 5.1 Authentication & Accounts
- Email + password login issuing a JWT access/refresh pair; refresh tokens stored
  hashed in Redis (`refresh:{userId}`, 7-day TTL) and deleted on logout.
- Public self-registration (`POST /auth/signup`) creates a `USER` account; role is
  forced server-side and cannot be set by the client.
- Password change for the authenticated user; account deactivation by admins.
- Roles: `SUPER_ADMIN`, `ADMIN` (internal staff), `USER` (public submitter).

### 5.2 Institutions (Galleries / Venues)
- Public, paginated list with filters (area, type, sub-category, tag) and text search;
  single-venue detail; lightweight map-pin endpoint (`id, name, lat, lng, type`).
- Public reads require `isPublished = true` AND `approvalStatus = APPROVED` AND not
  soft-deleted.
- Admin CRUD: create, update, soft-delete (`deletedAt`), publish/unpublish (independent
  of approval), attach images.
- Types: `ART_GALLERY`, `MUSEUM`, `INSTITUTE`, `FOUNDATION`, `STUDIO`, `CULTURAL_SPACE`.
  Area: `ISLAND`, `MAINLAND`, `OTHER`. Lat/lng for the map.

### 5.3 Exhibitions
- One institution → many exhibitions (`name`, `images[]`, start/end date, start/end
  time, optional link + description).
- Carries its own approval workflow (`PENDING`/`APPROVED`/`REJECTED`) and an `isActive`
  flag; admin-created exhibitions are set `APPROVED` + active directly.
- `Institution.hasExhibition` is recomputed on every write (true when ≥1 approved
  exhibition exists).
- Public read returns approved exhibitions for a published, approved venue.

### 5.4 Taxonomy — Tags & Sub-Categories
- **Tags**: admin-curated controlled vocabulary; `name` (slug, unique), `label`
  (display), `category` (`OWNERSHIP`/`STYLE`/`CURATION`/`FORMAT`). Many-to-many with
  institutions. Seeded with a predefined set; admins can extend.
- **Sub-Categories**: admin-managed sub-classification nested under an `InstitutionType`
  (e.g. `ART_GALLERY` → "Contemporary"); optional on an institution.

### 5.5 Public Submissions & Review
- A `USER` submits a venue (`POST /submissions`) → created `PENDING`, unpublished, with
  `submittedById`. Never visible publicly until approved AND published.
- Users can list their own submissions (any status).
- Admins have a review queue (filter by status); approve (sets `APPROVED`, records
  reviewer) or reject (sets `REJECTED` with a required `reviewNote`). Approval does NOT
  publish — admins publish separately.

### 5.6 Media Uploads
- Venue and exhibition images are stored in S3 (media bucket), served via CloudFront.
- Application server must not persist image bytes to local disk.
- Current implementation uploads through the API (multer) to S3; architecture.md
  specifies presigned-URL direct-to-S3 upload. **Decision needed — see §10.**

### 5.7 Admin Control Panel & Audit
- Admin dashboard aggregate counts (total/published venues, pending submissions, admins).
- User management (list, deactivate).
- Immutable audit log of every write action (`actorId`, `action`, `targetModel`,
  `targetId`, `metadata`, `timestamp`) spanning institutions, users, sub-categories,
  tags, and exhibitions.

## 6. Data Model (high level)

`User`, `Institution`, `Exhibition`, `Tag` (+ implicit `Institution`↔`Tag` join),
`SubCategory`, `AuditLog`. Full field-level reference: [`docs/schema.md`](./schema.md);
source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma).

## 7. Non-Functional Requirements

- **Performance / caching:** Public venue list and map responses cached in Redis (60s
  TTL: `cache:institutions:{queryHash}`, `cache:institutions:map`). Cache invalidated on
  any admin write that can change a public payload. Target: cached reads ≈ instant; cold
  reads hit Postgres once then warm the cache.
- **Rate limiting:** Enforced at the API on the auth endpoints, Redis-backed (Upstash)
  so limit state survives restarts and is shared across instances. Per architecture.md's
  "rate limiting" use of Redis.
- **Security:** bcrypt password hashing; JWT auth; role-based access control (RBAC) on
  admin routes; passwords never returned by the API; CORS and security headers (helmet).
- **Scalability:** Single EC2 must serve thousands of users; vertical scale first.
  Stateless API (session/refresh state lives in Redis) so the frontend can later be
  peeled off to its own S3 bucket (Option A → B migration).
- **Cost target:** ~$35–45/month at small Lagos scale (architecture.md cost table).
- **Availability:** Managed RDS handles backups; deploys cause a brief pm2 restart
  (acceptable at this phase).

## 8. Deployment & CI/CD

**Current:** GitHub Actions runs typecheck, lint, and tests only
(`.github/workflows/ci.yml`). Production deploy is **manual** (SSH → `git pull` →
`npm ci` → `npm run build` → `npm run prisma:deploy` → `pm2 restart`). See
[`docs/deployment.md`](./deployment.md).

**Aspirational (architecture.md):** Actions → build frontend → upload to S3 →
SSH EC2 → pm2 restart. Not automated in this repo yet.

## 9. Out of Scope / Future

- **Artworks** and **Reviews** tables (named in architecture.md, not modelled). Would be
  new domains if the product expands from venue-discovery to artwork catalogue + UGC.
- Contributor-submitted *exhibitions* and granular approval audit actions
  (`APPROVE_USER`, `APPROVE_EXHIBITION`, …) — enum values exist; flows not yet built.
- Option B (containerized/serverless), auto-scaling, multi-region.

## 10. Resolved decisions

1. **Upload mechanism:** Keep the current multer→S3 upload through the API. At
   single-EC2 Lagos scale the byte-proxying cost is negligible and the simpler client
   outweighs the presigned-URL NFR. Presigned direct-to-S3 remains a later option if
   upload volume grows.
2. **Entity naming:** Artworks and Reviews are confirmed **future scope** (§9). The
   system stays on "Institutions" (venues) and "Exhibitions" for this phase.
3. **Cache TTL:** 60s, as implemented. At this scale the extra DB load is trivial and
   fresher public data is preferred over the architecture narrative's 5-minute figure.
4. **Rate limiting:** Redis-backed (Upstash), auth endpoints only. Auth-only coverage
   keeps the "cached reads ≈ instant" performance target intact (no Redis round-trip on
   public reads) while satisfying the Redis-backed / stateless-API requirement.
