# Backend Completion Gaps

**Date:** 23 Jul 2026 (updated after implementation)  
**Baseline:** Current codebase vs [`docs/backend-prd.md`](./backend-prd.md), [`README.md`](../README.md), [`docs/schema.md`](./schema.md), and [`Guide.md`](../Guide.md)

---

## Status

All Critical / Important / Nice-to-have items below have been **implemented**. Deferred PRD §9 futures (contributor exhibitions, artworks, user `isApproved`) remain out of scope.

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
| Artwork catalogue & reviews | PRD §9 future |
| Automated GH Actions → EC2 deploy | Manual deploy documented |
| Institution `rating` | No column; frontend "Top Rated" filter/sort inert |
| `openingHours` normalisation | Freeform JSON; frontend "Open Now" inert |
| Global `GET /exhibitions` ("what's on") | Only per-institution reads exist |
| Submission edit / withdraw | Submit and list-own only |
| Soft-delete restore | `DELETE` sets `deletedAt`; no way back via API |

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

## Resend setup (when ready)

1. Create a Resend account and verify `EMAIL_FROM`.
2. Set `RESEND_API_KEY` in `.env` (and production secrets).
3. Restart the API — password reset, submission approve/reject, and staff welcome emails will send automatically. No code change required.
