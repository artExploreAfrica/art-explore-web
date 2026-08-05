# Art Explore — Backend

Backend API for **Art Explore**, a gallery discovery and mapping platform for Lagos. It surfaces art institutions (galleries, studios, cultural spaces) for a public frontend and provides a Super-Admin system for content management, audit logging, and dashboard metrics.

> Backend only. See [`Guide.md`](./Guide.md) for the full scope and [`docs/schema.md`](./docs/schema.md) for the data model.

---

## Tech Stack

Node.js 20 · Express · TypeScript (strict) · PostgreSQL (Prisma) · Upstash Redis · JWT auth · AWS S3 · Swagger · Zod.

## Project Structure

```
prisma/        Prisma schema + seed
src/
  config/      env validation, Prisma/Redis/S3 singletons
  routes/      Express routers (auth, institutions, admin)
  controllers/ thin request handlers
  services/    business logic (+ audit logging)
  middleware/  authenticate, roleGuard, validate, errorHandler, upload, requestLogger
  utils/       response, asyncHandler, jwtHelper, auditLogger, s3Uploader, cache
  validators/  Zod request schemas
  types/       shared TypeScript types
swagger/       OpenAPI config
docs/          schema.md, deployment.md
```

Architecture is strictly layered: **Route → Controller → Service → Prisma**. Prisma is never called from routes or controllers. Every admin write action logs to `AuditLog` from the service layer.

---

## Getting Started

### 1. Prerequisites
- Node.js 20 LTS
- A PostgreSQL database
- An Upstash Redis instance (REST URL + token)
- An AWS S3 bucket + IAM credentials

### 2. Install
```bash
npm install
```

### 3. Configure environment
Copy the example and fill in real values:
```bash
cp .env.example .env
```
All variables are validated at startup ([`src/config/env.ts`](./src/config/env.ts)) — a missing/invalid value crashes the app with a clear message.

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default 4000) |
| `NODE_ENV` | `development` / `production` / `test` |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist; empty = allow any origin |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT signing secrets (≥16 chars) |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Token lifetimes (default 15m / 7d) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 IAM credentials |
| `AWS_REGION` / `AWS_S3_BUCKET_NAME` | S3 bucket location |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash REST credentials |
| `RESEND_API_KEY` | Optional — mailer no-ops until set (password reset, submission, welcome emails) |
| `EMAIL_FROM` / `FRONTEND_URL` | Resend sender + public app URL for email links |
| `SEED_SUPER_ADMIN_*` | Default Super Admin for the seed script |

### 4. Database
```bash
npm run prisma:generate     # generate the Prisma client
npm run prisma:migrate       # apply the committed migrations
npm run seed                 # create the Super Admin (+ galleries if present)
```

### 5. Run
```bash
npm run dev      # ts-node-dev with reload
# or
npm run build && npm start
```

- API base: `http://localhost:4000/api/v1`
- Health: `http://localhost:4000/health`
- Swagger UI: `http://localhost:4000/api-docs`
- OpenAPI JSON: `http://localhost:4000/api-docs.json`

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start in watch mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm test` | Run the test suite (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` | Prettier |
| `npm run prisma:migrate` | Create & apply migrations |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run seed` | Run the seed script |

---

## API Overview

Base URL: `http://localhost:4000/api/v1`. All responses follow `{ success, message, data, pagination? }`.
Protected routes require `Authorization: Bearer <accessToken>`. The full, always-current reference
(request/response schemas, status codes) is the **Swagger UI at `/api-docs`**; this table is a map of the surface.

`Auth` column: **Public** = no token · **User** = any authenticated account · **USER** = public submitter role only ·
**Admin** = `ADMIN` or `SUPER_ADMIN` · **Super** = `SUPER_ADMIN` only.

### Auth — `/auth`
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/signup` | Public | Self-register a `USER` account |
| POST | `/auth/login` | Public | Email + password → `{ user, accessToken, refreshToken }` |
| POST | `/auth/refresh` | Public¹ | Exchange a refresh token for a new token pair |
| POST | `/auth/logout` | Public¹ | Revoke a refresh token |
| POST | `/auth/forgot-password` | Public | Email a password-reset link (always returns 200) |
| POST | `/auth/reset-password` | Public | Set a new password using a reset token |
| GET | `/auth/me` | User | Current authenticated profile |
| POST | `/auth/change-password` | User | Change own password (revokes other sessions) |
| POST | `/auth/register` | Super | Legacy alias — prefer `POST /admin/users` to create staff |

¹ No access token, but a valid `refreshToken` is required in the body.

### Public discovery
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/institutions` | Public | Paginated list; filters `area`, `type`, `subCategoryId`, `tag`, `search` |
| GET | `/institutions/map` | Public | Lightweight map pins (`id, name, lat, lng, type`) |
| GET | `/institutions/:id` | Public | Single published venue |
| GET | `/institutions/:id/exhibitions` | Public | Approved exhibitions for a venue |
| GET | `/subcategories` | Public | Sub-categories (filter `type`) |
| GET | `/tags` | Public | Tags (filters `search`, `category`) |

### Submissions — `/submissions`
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/submissions` | USER | Submit a venue for review (created `PENDING`) |
| GET | `/submissions/mine` | USER | List own submissions (any status) |
| POST | `/submissions/exhibitions` | USER | Submit an exhibition for a published venue (created `PENDING`, inactive) |
| GET | `/submissions/exhibitions/mine` | USER | List own exhibition submissions (any status) |

### Admin — `/admin`
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/admin/dashboard` | Admin | Aggregate counts (`admins` = staff; also `publicUsers`) |
| GET | `/admin/institutions` | Admin | Full catalogue (drafts / unpublished / pending) |
| GET | `/admin/institutions/:id` | Admin | Single venue (admin view) |
| POST | `/admin/institutions` | Admin | Create a venue |
| PUT | `/admin/institutions/:id` | Admin | Update a venue |
| DELETE | `/admin/institutions/:id` | Admin | Soft-delete a venue |
| POST | `/admin/institutions/:id/publish` | Admin | Toggle publish status |
| POST | `/admin/institutions/:id/images` | Admin | Upload an image (multipart, field `image`) |
| DELETE | `/admin/institutions/:id/images` | Admin | Remove an image (`{ url }`) |
| POST | `/admin/institutions/:id/exhibitions` | Admin | Create an exhibition |
| PUT | `/admin/institutions/:id/exhibitions/:exhibitionId` | Admin | Update an exhibition |
| DELETE | `/admin/institutions/:id/exhibitions/:exhibitionId` | Admin | Delete an exhibition |
| POST | `/admin/institutions/:id/exhibitions/:exhibitionId/image` | Admin | Upload exhibition image (multipart, field `image`) |
| POST | `/admin/institutions/:id/exhibitions/:exhibitionId/activate` | Admin | Set `{ isActive }` |
| DELETE | `/admin/institutions/:id/exhibitions/:exhibitionId/images` | Admin | Remove exhibition image (`{ url }`) |
| GET | `/admin/submissions` | Admin | Review queue (user submissions only; filter `status`) |
| POST | `/admin/institutions/:id/approve` | Admin | Approve a submission (does **not** publish; emails submitter) |
| POST | `/admin/institutions/:id/reject` | Admin | Reject with required `reviewNote` (emails submitter) |
| GET | `/admin/submissions/exhibitions` | Admin | Exhibition review queue (user submissions only; filter `status`) |
| POST | `/admin/exhibitions/:id/approve` | Admin | Approve an exhibition (does **not** activate; emails submitter) |
| POST | `/admin/exhibitions/:id/reject` | Admin | Reject with required `reviewNote` (emails submitter) |
| GET / POST | `/admin/subcategories` | Admin | List / create sub-categories |
| PUT / DELETE | `/admin/subcategories/:id` | Admin | Update / delete a sub-category |
| GET / POST | `/admin/tags` | Admin | List / create tags |
| PUT / DELETE | `/admin/tags/:id` | Admin | Update / delete a tag |
| GET | `/admin/users` | Super | List users — staff by default, `?role=USER` for public accounts |
| POST | `/admin/users` | Super | Create a staff user (sends welcome email when Resend is configured) |
| PATCH | `/admin/users/:id/deactivate` | Super | Deactivate a staff user |
| PATCH | `/admin/users/:id/activate` | Super | Reactivate a staff user |
| GET | `/admin/audit-logs` | Super | Paginated audit trail (filters `actorId`, `action`, `targetModel`, `from`, `to`) |

A Postman collection is in [`docs/ArtExplore.postman_collection.json`](./docs/ArtExplore.postman_collection.json).

---

## Frontend Integration Guide

This is everything a frontend needs to consume the API. Examples use `fetch`; adapt freely to Axios/React Query.

### 1. Response envelope

Every response — success or error — is JSON with the same outer shape.

```jsonc
// Success
{ "success": true, "message": "Success", "data": { /* ... */ }, "pagination": { /* list endpoints only */ } }

// Error
{ "success": false, "message": "Validation failed", "errors": [ { "field": "email", "message": "Invalid email" } ] }
```

- Read your result from `data`. Never assume the top-level object *is* the data.
- `pagination` is `{ page, limit, total, totalPages }` and only present on paginated list endpoints.
- `errors` is optional. For validation failures (`400`) it's an array of `{ field, message }` you can map onto form fields. For other errors it may be absent or carry a small detail object — always fall back to `message`.

### 2. Authentication flow

Tokens come from `POST /auth/login` (or `/auth/signup` then `/auth/login`):

```ts
const res = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const { data } = await res.json();      // { user, accessToken, refreshToken }
```

- **Access token** — short-lived (~15 min). Send it as `Authorization: Bearer <accessToken>` on every protected request.
- **Refresh token** — long-lived (7 days). Store it and use it to get a new pair when the access token expires; **never** put it in an `Authorization` header — it goes in the request body.
- Store tokens where your app's threat model allows (in-memory + httpOnly cookie via your own BFF is safest; `localStorage` is the common pragmatic choice). The API itself is stateless and doesn't set cookies.

**Refreshing.** When a protected call returns `401`, call refresh once, retry the original request, and if refresh also fails, log the user out:

```ts
async function authedFetch(path, options = {}, retry = true) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${getAccess()}` },
  });
  if (res.status === 401 && retry) {
    const r = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: getRefresh() }),
    });
    if (!r.ok) { logout(); return res; }
    const { data } = await r.json();     // { accessToken, refreshToken }
    saveTokens(data);
    return authedFetch(path, options, false); // retry once
  }
  return res;
}
```

**Logout** — `POST /auth/logout` with `{ refreshToken }`, then clear local tokens. This revokes the refresh token server-side.

**Password reset.** Two steps, both public:
1. `POST /auth/forgot-password` with `{ email }`. Always returns `200` with a generic message (it never reveals whether the email is registered). If the account exists, the API emails a link to `${FRONTEND_URL}/reset-password?token=<token>` — so your app needs a `/reset-password` page that reads `token` from the query string.
2. That page collects a new password and calls `POST /auth/reset-password` with `{ token, newPassword }`. On success the password is changed and all existing sessions are revoked (the user must log in again). An invalid/expired token returns `401`; the token is single-use and expires in 1 hour.

### 3. Roles & what each can do

| Role | Can |
|---|---|
| Public (no auth) | Browse published venues, map, detail, exhibitions, sub-categories, tags |
| `USER` | All public + submit venues (`/submissions`) and view own submissions |
| `ADMIN` | Manage venues, exhibitions, taxonomy; review submissions; dashboard |
| `SUPER_ADMIN` | Everything `ADMIN` can + manage admin users + audit logs |

`/auth/signup` always creates a `USER` (role is forced server-side — you cannot request `ADMIN`). Read `data.user.role` after login to drive UI gating. A `403` means "authenticated but not allowed"; a `401` means "not authenticated / token expired".

### 4. Public discovery

**Listing with filters & pagination** — all query params are optional:

```ts
const qs = new URLSearchParams({ page: '1', limit: '20', area: 'ISLAND', type: 'ART_GALLERY', search: 'lekki' });
const { data, pagination } = await (await fetch(`${BASE}/institutions?${qs}`)).json();
```

- `area`: `ISLAND` · `MAINLAND` · `OTHER`
- `type`: `ART_GALLERY` · `MUSEUM` · `INSTITUTE` · `FOUNDATION` · `STUDIO` · `CULTURAL_SPACE`
- `subCategoryId`: an id from `GET /subcategories`
- `tag`: a tag id **or** slug (`name`) from `GET /tags`
- `search`: free text over name, description, tags
- `limit` max is `100`.

**Map view** — `GET /institutions/map` returns just `{ id, name, lat, lng, type }` per pin (no pagination); ideal for plotting markers, then fetch `GET /institutions/:id` on click.

Only published + approved + non-deleted venues appear in any public endpoint.

### 5. USER submission flow

1. User signs up / logs in (`USER` role).
2. `POST /submissions` with the venue body (same shape as `InstitutionInput`) → created `PENDING`, not publicly visible.
3. `GET /submissions/mine` to show status. An admin later approves (then publishes) or rejects with a `reviewNote` the user can see on their submission.

### 6. Admin flows

All admin calls need a `Bearer` token for an `ADMIN`/`SUPER_ADMIN` account.

**Create / update a venue** — JSON body matching `InstitutionInput` (see the `InstitutionInput` schema in Swagger). `subCategoryId` and `tagIds: string[]` link existing taxonomy records — create those first via `/admin/subcategories` and `/admin/tags`.

**Publish** is independent of approval: approving a submission marks it `APPROVED` but you must `POST /:id/publish` separately to make it live.

**Image upload** uses `multipart/form-data`, not JSON — don't set `Content-Type` manually (the browser adds the boundary):

```ts
const fd = new FormData();
fd.append('image', fileInput.files[0]);          // field name MUST be "image"
await authedFetch(`/admin/institutions/${id}/images`, { method: 'POST', body: fd });
```

**Review queue** — `GET /admin/submissions?status=PENDING` (or `APPROVED`/`REJECTED`), then `POST /admin/institutions/:id/approve` or `POST /admin/institutions/:id/reject` with `{ reviewNote }`.

**Dashboard** — `GET /admin/dashboard` returns the counts for an overview screen. **Users** (`/admin/users`) and **audit logs** (`/admin/audit-logs`) are `SUPER_ADMIN`-only — gate those UI sections on `role === 'SUPER_ADMIN'`.

### 7. Error handling pattern

```ts
const res = await authedFetch(path, opts);
const body = await res.json();
if (!body.success) {
  if (res.status === 400 && Array.isArray(body.errors)) {
    // map body.errors -> form field errors: [{ field, message }]
  } else {
    showToast(body.message); // 401/403/404/409/500 — message is human-readable
  }
  return;
}
useData(body.data);
```

Common statuses: `400` validation, `401` unauthenticated/expired, `403` wrong role, `404` not found, `409` duplicate (e.g. email or tag name), `500` server error.

---

## Testing

```bash
npm test
```

The suite (Vitest + Supertest, in [`tests/`](./tests)) runs the real Express app
with the Prisma and Redis clients mocked, so it needs **no database, Redis, or AWS
credentials** and runs anywhere (including CI). It covers the auth flow
(validation, bad credentials, deactivated account, successful token issue with no
password leak, `/me`, change-password), the public institution endpoints
(pagination envelope, published-and-non-deleted filtering, 404s, map pins),
admin route auth + role-based access control (401 / 403 / 200), admin
institution writes (create/soft-delete/publish with audit-log assertions), and
audit-log filtering. For full end-to-end checks against live services, import
[`docs/ArtExplore.postman_collection.json`](./docs/ArtExplore.postman_collection.json).

---

## Deployment

See [`docs/deployment.md`](./docs/deployment.md) for PostgreSQL, AWS S3, and Upstash Redis setup and production notes.
