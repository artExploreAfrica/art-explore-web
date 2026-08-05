# Backend Completion Gaps

**Date:** 23 Jul 2026 (updated after implementation)  
**Baseline:** Current codebase vs [`docs/backend-prd.md`](./backend-prd.md), [`README.md`](../README.md), [`docs/schema.md`](./schema.md), and [`Guide.md`](../Guide.md)

---

## Status

All Critical / Important / Nice-to-have items below have been **implemented**. Contributor
exhibitions and reviews have since been built too; artworks and user `isApproved` remain
out of scope. See **Audit round 3** near the bottom for the most recent pass.

### Auth hardening
- [x] `authenticate` re-loads the user from DB and rejects inactive accounts
- [x] Staff create/register validators allow only `ADMIN` | `SUPER_ADMIN`
- [x] Staff-only user list / dashboard `admins` count; `publicUsers` on dashboard
- [x] `PATCH /admin/users/:id/activate`

### Resend email
- [x] `RESEND_API_KEY` optional (mailer no-ops until set)
- [x] Submission approve/reject emails wired
- [x] Staff welcome email on `POST /admin/users`
- [x] HTML escaping in templates

### Critical / Important / Polish
- [x] **C1** Admin `GET /institutions` + `GET /institutions/:id`
- [x] **C2** Role-scoped dashboard / user metrics
- [x] **C3** Production requires `ALLOWED_ORIGINS`
- [x] **I1** Tag filter by id or slug
- [x] **I2** Exhibition `isActive` on public reads + activate endpoint
- [x] **I3** Review queue = user submissions only
- [x] **I4** Granular `APPROVE_INSTITUTION` / `REJECT_INSTITUTION` + Swagger enums
- [x] **I5** Expanded route tests (auth deactivate, admin list, tag slug, exhibitions, …)
- [x] **I6** Redis docs updated
- [x] **I7** Deploy documented as manual (CI = typecheck/lint/test)
- [x] **I8** Guide marked superseded by PRD/README
- [x] **N1** Tag `?category=` filter
- [x] **N2** Image DELETE (+ S3 best-effort delete)
- [x] **N3** User activate
- [x] **N4** `/admin/users` canonical; `/auth/register` legacy in docs
- [x] **N5** `prisma:deploy` + `test:coverage` scripts
- [x] **N6** FRONTEND_INTEGRATION ports aligned to `4000`
- [x] **N7** Public list Swagger documents `tag` / `subCategoryId`

---

## Still deferred (not bugs for this phase)

| Feature | Status |
|---|---|
| User / contributor account approval (`isApproved`) | Not modelled |
| Artwork catalogue | PRD §9 future — reviews are now built, artworks are not |
| Automated GH Actions → EC2 deploy | Manual deploy documented |
| Multi-device sessions | One `refresh:{userId}` key per account, so signing in on a second device ends the first session. Fine at this scale; would need per-session keys to change |

---

## Built since (05 Aug 2026)

### Contributor exhibitions (was PRD §9 future)
- [x] `POST /submissions/exhibitions` — USER submits, forced `PENDING` + inactive
- [x] `GET /submissions/exhibitions/mine`
- [x] `GET /admin/submissions/exhibitions` — review queue by status
- [x] `POST /admin/exhibitions/:id/approve` — emits `APPROVE_EXHIBITION`
- [x] `POST /admin/exhibitions/:id/reject` — emits `REJECT_EXHIBITION`, stores `reviewNote`
- [x] `Exhibition.reviewNote` added (`20260805120000_add_exhibition_review_note`)
- Approval does **not** activate — admin activates separately, matching "approved ≠ published"

### Public user management
- [x] `GET /admin/users?role=USER` — public accounts were countable on the dashboard
      but not listable, so a deactivated USER could never be found to reactivate

### `hasExhibition` staleness
- [x] Recompute now requires approved **and** active **and** `endDate >= today`
- [x] `npm run recompute:exhibitions` daily sweep (dates go stale with no write to
      trigger the per-write recompute)

---

---

## Audit round 3 (05 Aug 2026) — defects found and fixed

Three of these were confirmed by a failing test written against the old code
before the fix; the regressions live in `tests/regressions.test.ts`.

| # | Defect | Fix |
|---|---|---|
| 1 | `setActive` never called `recomputeHasExhibition`, so deactivating a venue's only live exhibition left `hasExhibition: true` until an unrelated write or the nightly sweep | Recompute on activate/deactivate like every other exhibition write |
| 2 | Multer rejections (non-image, >5 MB, wrong field) fell through to the unknown-error branch and returned **500** | `fileFilter` throws `AppError`; `errorHandler` maps `MulterError` → 400 / 413 |
| 3 | `institution.approve()` skipped cache invalidation while `reject()` did it, so an already-published venue could stay invisible for up to 60s after approval | Invalidate on approve too |
| 4 | `GET /institutions/:id/exhibitions` had no `endDate` filter, so it returned finished shows while `hasExhibition` said false | Defaults to `scope=live`; `past` / `all` added for archive views |
| 5 | `logout` deleted the session on any structurally valid refresh JWT, including one already rotated out | Presented token is bcrypt-compared against the stored hash first |
| 6 | Contributors could not upload images at all — venue submissions had no `images` field and exhibition submissions took arbitrary third-party URLs | Upload endpoints on both submission types; a client-sent `images` key is now an explicit 400 |
| 7 | No rate limit on `/submissions` — any USER could flood the review queue | `contributorWriteLimiter`, 30/account/hour, keyed by account not IP |

### Built in the same pass

- **Reviews** — `Review` model, one per account per venue, moderated like every
  other submission. `Institution.rating` / `reviewCount` are denormalised from
  approved rows so `minRating` and `sort=rating` use an index.
- **`openingHours` normalisation** — validated day-indexed `{ open, close }`
  shape plus a server-side `?openNow=true` filter resolved in SQL against JSONB
  (verified against Postgres for day shifts, closed days, overnight ranges that
  cross midnight, and venues with no hours recorded).
  The seed converts the sheet's hours on import, handling both the per-day JSON
  cells and the free text ones (`"Tue-Sat 11am-6pm"`,
  `"Mon-Sat 9am-5pm; Sun 12pm-5pm"`, `"8am-6pm daily"`): **58 of the 61 rows**
  that carry hours now convert and pass the API's own validator, up from 42
  before the free-text handling. The 3 left unset are genuinely indeterminate
  ("by appointment only", "24hr hotel") and are not guessed at.
- **Global `GET /exhibitions`** — the cross-venue "what's on" read.
- **Submission edit / withdraw** and **soft-delete restore**
  (`POST /admin/institutions/:id/restore`, `?deleted=true` to find them).

### Pre-existing, also fixed

`npm run lint` was already failing on `scripts/smoke-api.ts` (two `any`) and
`scripts/sync-s3-images-to-db.ts` (an unused counter), so CI was red before this
pass. Both are corrected — the counter is now reported in the summary.

---

## Resend setup (when ready)

1. Create a Resend account and verify `EMAIL_FROM`.
2. Set `RESEND_API_KEY` in `.env` (and production secrets).
3. Restart the API — password reset, submission approve/reject, and staff welcome emails will send automatically. No code change required.
