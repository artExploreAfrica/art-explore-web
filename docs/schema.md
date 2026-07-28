# Art Explore — Data Model

**Stack:** PostgreSQL via Prisma ORM. Source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma).

This document describes every model, field, and relationship in plain language. It mirrors the diagram in [`ArtExplore_DB_Diagram_v2.md`](../ArtExplore_DB_Diagram_v2.md), with two retained extensions not in v2: the `SUPER_ADMIN`/`ADMIN`/`USER` roles and the `SubCategory` model.

---

## Models

### User
Accounts for both staff (`SUPER_ADMIN`/`ADMIN`) and the public (`USER`). Admins are
created by a Super Admin; `USER` accounts self-register via `POST /api/v1/auth/signup`.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `fullName` | String | Display name |
| `email` | String | **Unique** — login identifier |
| `password` | String | bcrypt hash (cost 10) — never returned by the API |
| `role` | `Role` | `SUPER_ADMIN`, `ADMIN`, or `USER` (default `ADMIN`; signup forces `USER`) |
| `isActive` | Boolean | Default `true`; deactivation sets `false` |
| `auditLogs` | `AuditLog[]` | Reverse relation — actions this user performed |
| `submittedInstitutions` | `Institution[]` | Reverse relation (`SubmittedBy`) — institutions this user submitted |
| `reviewedInstitutions` | `Institution[]` | Reverse relation (`ReviewedBy`) — submissions this admin reviewed |
| `createdAt` | DateTime | Set on insert |
| `updatedAt` | DateTime | Auto-updated |

### SubCategory
Admin-managed sub-classification nested under an `InstitutionType` (e.g. `GALLERY` →
"Contemporary").

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `name` | String | Sub-category name |
| `type` | `InstitutionType` | The parent type this sub-category belongs to |
| `description` | String? | Optional |
| `institutions` | `Institution[]` | Reverse relation |
| `createdAt` / `updatedAt` | DateTime | Timestamps |

**Unique** on `(type, name)`; indexed on `type`.

### Tag
Admin-curated tag, many-to-many with `Institution` (implicit join `_InstitutionToTag`).
Replaces the former freeform `Institution.tags` string array. A controlled
vocabulary: `name` is a machine slug, `label` the display text, and `category`
groups tags (v2). The v2 diagram's explicit `InstitutionTag` junction carries no
extra columns, so Prisma's implicit M2M join is the equivalent representation.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `name` | String | **Unique** — machine slug, e.g. `WOMEN_OWNED` |
| `label` | String | Display label, e.g. `Women Owned` (defaults to `name` on create) |
| `category` | `TagCategory` | `OWNERSHIP` / `STYLE` / `CURATION` / `FORMAT` |
| `institutions` | `Institution[]` | Many-to-many relation |
| `createdAt` / `updatedAt` | DateTime | Timestamps |

### Institution
A discoverable art venue (gallery, studio, or cultural space).

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `name` | String | Venue name |
| `description` | String? | Optional long text |
| `type` | `InstitutionType` | `ART_GALLERY` / `MUSEUM` / `INSTITUTE` / `FOUNDATION` / `STUDIO` / `CULTURAL_SPACE` |
| `address` | String | Street address |
| `area` | `Area` | `ISLAND` / `MAINLAND` / `OTHER` |
| `lat` | Float | Latitude (map pin) |
| `lng` | Float | Longitude (map pin) |
| `images` | String[] | Array of S3 object URLs |
| `website` | String? | Optional |
| `phone` | String? | Optional |
| `email` | String? | Optional |
| `openingHours` | Json? | e.g. `{ "mon": "9am-5pm", ... }` |
| `subCategoryId` | String? (FK → SubCategory.id) | Optional sub-category |
| `subCategory` | `SubCategory?` | Relation |
| `tags` | `Tag[]` | Many-to-many — admin-curated tags (was a `String[]`) |
| `exhibitions` | `Exhibition[]` | Reverse relation — exhibitions hosted here |
| `hasExhibition` | Boolean | Default `false`; recomputed on every exhibition write (true when the institution has ≥1 approved exhibition) |
| `approvalStatus` | `ApprovalStatus` | Default `APPROVED`; USER submissions start `PENDING` |
| `submittedById` | String? (FK → User.id) | The USER who submitted it (null for admin-created) |
| `reviewedById` | String? (FK → User.id) | The admin who approved/rejected it |
| `reviewNote` | String? | Reviewer note (set on reject) |
| `reviewedAt` | DateTime? | When it was reviewed |
| `isPublished` | Boolean | Default `false`; controls public visibility (publish/unpublish) |
| `deletedAt` | DateTime? | Soft-delete marker. `null` = live; a timestamp = removed and excluded from all reads |
| `createdAt` | DateTime | Set on insert |
| `updatedAt` | DateTime | Auto-updated |

Indexed on `area`, `type`, `isPublished`, `deletedAt`, `subCategoryId`, `hasExhibition`, `approvalStatus`, and `submittedById`.

> **Delete vs. unpublish:** `isPublished` and `deletedAt` are independent. Unpublishing hides a venue from the public list but keeps it editable; deleting (sets `deletedAt`) removes it from every query and blocks further edits/publish.
>
> **Visibility:** public reads require `isPublished = true` **and** `approvalStatus = APPROVED` (and `deletedAt = null`). Approving a submission does not publish it — an admin publishes separately.

### Exhibition
An exhibition hosted by an institution. One institution → many exhibitions.
Carries its own submission/approval workflow (v2), mirroring Institution.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `institutionId` | String (FK → Institution.id) | Parent institution (`onDelete: Cascade`) |
| `name` | String | Exhibition title |
| `images` | String[] | Array of S3 object URLs |
| `startDate` | DateTime | Start date |
| `endDate` | DateTime | End date |
| `startTime` | String | Daily start, e.g. `"10:00"` |
| `endTime` | String | Daily end, e.g. `"18:00"` |
| `link` | String? | Social-media / ticketing URL |
| `description` | String? | Curatorial note |
| `approvalStatus` | `ApprovalStatus` | Default `PENDING`; admin-created exhibitions are set `APPROVED` |
| `submittedById` | String? (FK → User.id) | Who submitted it |
| `approvedById` | String? (FK → User.id) | Admin who approved/rejected it |
| `approvedAt` | DateTime? | When it was approved |
| `isActive` | Boolean | Default `false`; admin-created exhibitions are set `true` |
| `createdAt` / `updatedAt` | DateTime | Timestamps |

Indexed on `institutionId`, `startDate`, `approvalStatus`, `submittedById`, and
`approvedById`. After any exhibition write the parent's `hasExhibition` is
recomputed (`true` when the institution has ≥1 approved exhibition).

### AuditLog
An immutable trail of every admin write action.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `actorId` | String (FK → User.id) | Who performed the action |
| `actor` | `User` | Relation to the acting admin |
| `action` | `AuditAction` | See enum below |
| `targetModel` | `TargetModel` | `INSTITUTION`, `USER`, `SUBCATEGORY`, `TAG`, or `EXHIBITION` |
| `targetId` | String | ID of the affected record (generic, **not** a hard FK) |
| `metadata` | Json? | Optional extra context (e.g. changed fields) |
| `timestamp` | DateTime | Set on insert |

Indexed on `actorId`, `(targetModel, targetId)`, and `timestamp`.

---

## Relationships

| Relationship | Type | Description |
|---|---|---|
| User → AuditLog | One-to-Many | Every action is traced to its actor via `actorId` |
| User → Institution (SubmittedBy) | One-to-Many | A USER's submitted institutions via `submittedById` |
| User → Institution (ReviewedBy) | One-to-Many | An admin's reviewed submissions via `reviewedById` |
| SubCategory → Institution | One-to-Many | Optional sub-classification via `subCategoryId` |
| Tag ↔ Institution | Many-to-Many | Implicit join `_InstitutionToTag` |
| Institution → Exhibition | One-to-Many | Exhibitions cascade-delete with their institution |
| Institution / User / … → AuditLog | Logical (via `targetId`) | `targetId` references the affected record, disambiguated by `targetModel` |

> `AuditLog.targetId` is a generic string reference, not a foreign key. A single
> AuditLog table can therefore track actions against both Institutions and Users,
> disambiguated by the `targetModel` enum.

---

## Enums

**Role** — `SUPER_ADMIN` (manage admins + all content), `ADMIN` (manage institution content only), `USER` (public account; submits institutions for review).

**InstitutionType** — `ART_GALLERY`, `MUSEUM`, `INSTITUTE`, `FOUNDATION`, `STUDIO`, `CULTURAL_SPACE`.

**Area** — `ISLAND` (Lagos Island), `MAINLAND` (Lagos Mainland), `OTHER`.

**ApprovalStatus** — `PENDING` (awaiting review), `APPROVED`, `REJECTED`. Shared by Institution and Exhibition.

**TagCategory** — `OWNERSHIP`, `STYLE`, `CURATION`, `FORMAT`.

**AuditAction** — `CREATE`, `UPDATE`, `DELETE` (soft delete → sets `deletedAt`), `PUBLISH`, `UNPUBLISH`, `DEACTIVATE`, `IMAGE_UPLOAD`, `SUBMIT`, `APPROVE`, `REJECT`, plus the v2 granular actions `APPROVE_USER`, `REJECT_USER`, `APPROVE_INSTITUTION`, `REJECT_INSTITUTION`, `EXHIBITION_CREATE`, `EXHIBITION_UPDATE`, `EXHIBITION_DELETE`, `APPROVE_EXHIBITION`, `REJECT_EXHIBITION`.

**TargetModel** — `INSTITUTION`, `USER`, `SUBCATEGORY`, `TAG`, `EXHIBITION`.

---

## Redis (outside the relational schema)

Upstash Redis is used for:

| Key pattern | Value | TTL | Purpose |
|---|---|---|---|
| `refresh:{userId}` | Hashed refresh token | 7 days | Refresh-token store — deleted on logout |
| `cache:institutions:{queryHash}` | JSON string | 60s | Cache for `GET /api/v1/institutions` |
| `cache:institutions:map` | JSON string | 60s | Cache for `GET /api/v1/institutions/map` |
| `reset:{sha256}` | userId | 1 hour | Password-reset token |
| rate-limit keys | counter | per limiter | Auth endpoint rate limiting |

Caches are invalidated on any admin write that can change a public payload —
institutions, tags, sub-categories, and exhibitions.
