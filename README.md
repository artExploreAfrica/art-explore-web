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

**Auth** — `POST /api/v1/auth/{register,login,refresh,logout,change-password}`, `GET /api/v1/auth/me`
**Public** — `GET /api/v1/institutions`, `GET /api/v1/institutions/map`, `GET /api/v1/institutions/:id`
**Admin (Institutions)** — `POST /api/v1/admin/institutions`, `PUT|DELETE /:id`, `POST /:id/publish`, `POST /:id/images`
**Admin (Users, Super Admin)** — `GET|POST /api/v1/admin/users`, `PATCH /api/v1/admin/users/:id/deactivate`
**Admin (Audit & Dashboard)** — `GET /api/v1/admin/audit-logs`, `GET /api/v1/admin/dashboard`

All responses follow `{ success, message, data, pagination? }`. Protected routes require `Authorization: Bearer <accessToken>`. A Postman collection is in [`docs/ArtExplore.postman_collection.json`](./docs/ArtExplore.postman_collection.json).

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
