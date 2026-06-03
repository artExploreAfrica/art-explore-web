# Art Explore — Backend Developer Cursor Guide
**Role:** Senior Backend Engineer | **Developer:** Shinaayomi Olanrewaju (Tee Shine)
**Client:** Art Explore Inc. | **Contract Value:** ₦200,000 | **Timeline:** 3 weeks from signing

---

## 1. Project Overview

Art Explore is a gallery discovery and mapping platform for Lagos (with future expansion to other African cities). The platform surfaces art institutions — galleries, studios, and cultural spaces — making them searchable, filterable by location, and manageable via a Super Admin dashboard.

Your job is the **backend only**: data layer, API, admin system, and documentation. Nothing else.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (v20 LTS) |
| Framework | Express.js |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL (via Prisma ORM) |
| Cache / Session Store | Upstash Redis |
| Auth | JWT (access + refresh token pattern) |
| File Storage | AWS S3 (gallery images only) |
| API Docs | Swagger (OpenAPI 3.0 via `swagger-jsdoc` + `swagger-ui-express`) |
| Validation | Zod (stay consistent — do not mix with Joi) |
| Environment | dotenv |
| Dev Tooling | ts-node-dev, ESLint, Prettier |

**Do not introduce any additional databases, ORMs, or storage providers. PostgreSQL + Prisma is the data layer. Upstash Redis is for caching and session/token storage only. Period.**

---

## 3. What You Are Building (Scope)

### 3.1 Database Schema

Design and implement Prisma schema for:

- **Institution** — name, description, type (GALLERY / STUDIO / CULTURAL_SPACE), address, area (ISLAND / MAINLAND / OTHER), lat, lng, images (S3 URL array), website, phone, email, openingHours (JSON), tags (string array), isPublished, createdAt, updatedAt
- **User** — fullName, email, password (hashed), role (SUPER_ADMIN | ADMIN), isActive, createdAt, updatedAt
- **AuditLog** — actorId (FK → User), action, targetModel, targetId, metadata (JSON), timestamp

All enums defined in `prisma/schema.prisma`. Deliver schema as:
1. `prisma/schema.prisma` model definitions in the codebase
2. A separate `docs/schema.md` documenting all fields, types, and relationships in plain language

### 3.2 Core REST API

Build and document all endpoints the frontend needs:

**Auth**
- `POST /api/auth/register` — admin registration (super admin only trigger)
- `POST /api/auth/login` — returns access + refresh tokens
- `POST /api/auth/refresh` — refresh access token
- `POST /api/auth/logout` — invalidate refresh token (deletes token from Upstash Redis)

**Galleries / Institutions**
- `GET /api/institutions` — paginated list, supports filtering by area (ISLAND/MAINLAND), type, and text search
- `GET /api/institutions/:id` — single institution detail
- `GET /api/institutions/map` — returns lightweight list (name, lat, lng, type, id) for map rendering

**Admin — Institution Management**
- `POST /api/admin/institutions` — create new institution
- `PUT /api/admin/institutions/:id` — update institution
- `DELETE /api/admin/institutions/:id` — soft delete (sets isPublished: false)
- `POST /api/admin/institutions/:id/publish` — toggle publish status
- `POST /api/admin/institutions/:id/images` — upload image to AWS S3, attach URL to institution

**Admin — User Management (Super Admin only)**
- `GET /api/admin/users` — list all admin users
- `POST /api/admin/users` — create admin user
- `PATCH /api/admin/users/:id/deactivate` — deactivate admin user

**Admin — Audit Logs**
- `GET /api/admin/audit-logs` — paginated audit trail

All endpoints must:
- Return consistent JSON responses: `{ success: boolean, data: any, message: string, pagination?: object }`
- Use proper HTTP status codes
- Be fully documented in Swagger

### 3.3 Super Admin System

- Role-based middleware: `isSuperAdmin`, `isAdmin`
- Super admin can manage other admin accounts
- Admin can manage institution content
- All write actions (create, update, delete, publish) write to AuditLog automatically
- Dashboard endpoint: `GET /api/admin/dashboard` — returns counts: total institutions, published, drafts, admins

### 3.4 Upstash Redis Usage

Redis is used for two purposes only:

1. **Refresh token storage** — store hashed refresh tokens keyed by `refresh:{userId}`, TTL 7 days. On logout, delete the key.
2. **Response caching** — cache `GET /api/institutions` and `GET /api/institutions/map` responses with a short TTL (e.g. 60s). Invalidate on any admin write to institutions.

Do not use Redis for sessions, pub/sub, queues, or any other purpose in this project.

```typescript
// utils/redisClient.ts
import { Redis } from '@upstash/redis';
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

### 3.5 Documentation & Handoff

- Swagger UI available at `/api-docs` in dev mode
- Export Swagger JSON at `/api-docs.json`
- `README.md` at project root covering: setup, env vars, running locally, deployment notes
- `docs/schema.md` — data model documentation
- `docs/deployment.md` — environment setup, AWS S3 config, PostgreSQL setup, Upstash Redis setup
- Handoff session with frontend dev and PM (your responsibility to schedule after delivery)

---

## 4. What You Are NOT Building (Hard Scope Boundaries)

**Do not build any of the following. If the client asks, flag it as out of scope and get written approval + additional payment first.**

| Out of Scope | Reason |
|---|---|
| Frontend / UI of any kind | Separate frontend developer handles this |
| Payment / ticketing system | Not in MVP |
| Event management features | Not in MVP |
| User-facing registration (public) | Admin-only system; no public sign-up |
| Recommendation engine / ML | Not in MVP |
| Real-time features (WebSockets) | Not in MVP |
| Email notification system | Not in MVP |
| Analytics dashboard beyond audit logs | Not in MVP |
| Any city outside Lagos | Expansion is Phase 2 |
| Mobile-specific APIs | Frontend handles mobile; same API |
| Social features (likes, comments, follows) | Not in MVP |
| Multi-tenancy | Single-tenant system |
| Custom CMS | Admin endpoints serve this purpose |

**If a new feature request comes in during the project, your response is:**
> "That's outside the agreed scope in Section 3 of our contract. Happy to scope it as a separate engagement after delivery."

---

## 5. Project Structure

```
art-explore-backend/
├── prisma/
│   ├── schema.prisma         # Prisma data model
│   └── migrations/           # Auto-generated migration files
├── src/
│   ├── config/               # DB client (Prisma), S3 client, Redis client, env validation
│   ├── routes/               # Express routers (auth, institutions, admin)
│   ├── controllers/          # Route handlers (thin, delegate to services)
│   ├── services/             # Business logic (institutionService, authService, etc.)
│   ├── middleware/            # auth, roleGuard, errorHandler, requestLogger
│   ├── utils/                # response helper, s3Uploader, jwtHelper, auditLogger, redisClient
│   ├── validators/           # Zod schemas for request validation
│   ├── types/                # TypeScript interfaces and types
│   └── app.ts                # Express app setup
├── docs/
│   ├── schema.md
│   └── deployment.md
├── swagger/
│   └── swagger.config.ts
├── .env.example
├── .gitignore
├── tsconfig.json
├── package.json
└── README.md
```

---

## 6. Architecture & Coding Standards

### 6.1 Layered Architecture — Enforce This Always

```
Route → Controller → Service → Prisma Client
```

- **Routes**: define path + middleware, call controller
- **Controllers**: parse request, call service, return response — no business logic here
- **Services**: all business logic lives here; use `prisma` from `src/config/db.ts`
- **Prisma Client**: instantiate once as a singleton in `src/config/db.ts`, import everywhere

```typescript
// src/config/db.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export default prisma;
```

### 6.2 Response Format — Always Consistent

```typescript
// utils/response.ts
export const successResponse = (res, data, message = 'Success', statusCode = 200, pagination?) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(pagination && { pagination }),
  });
};

export const errorResponse = (res, message = 'Error', statusCode = 400, errors?) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};
```

Never return raw Prisma results directly — always pass through `successResponse()`.

### 6.3 Error Handling

- Centralized error middleware in `middleware/errorHandler.ts`
- All async controllers wrapped with an `asyncHandler` utility (no try/catch repetition)
- Never expose stack traces in production responses
- Handle Prisma-specific errors (`PrismaClientKnownRequestError`) in the error handler

```typescript
// utils/asyncHandler.ts
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

### 6.4 Auth Pattern

- Access token: JWT, 15min expiry
- Refresh token: JWT, 7 days, stored **hashed** in Upstash Redis (key: `refresh:{userId}`)
- On logout: delete the Redis key to invalidate the token
- Middleware `authenticate.ts` verifies access token on protected routes
- `roleGuard('SUPER_ADMIN')` or `roleGuard('ADMIN')` chained after authenticate

### 6.5 Audit Logging

Every admin write action must log automatically. Build a utility that writes to the `AuditLog` table via Prisma:

```typescript
// utils/auditLogger.ts
import prisma from '../config/db';

export const auditLog = async (
  actorId: string,
  action: AuditAction,
  targetModel: TargetModel,
  targetId: string,
  metadata?: Record<string, unknown>
) => {
  await prisma.auditLog.create({
    data: { actorId, action, targetModel, targetId, metadata },
  });
};
```

Call this inside the service layer, not controllers.

### 6.6 TypeScript Rules

- `strict: true` in tsconfig — no exceptions
- No `any` types — use `unknown` and narrow properly
- Use Prisma-generated types (`Prisma.InstitutionCreateInput`, etc.) for service inputs
- Define additional interfaces in `src/types/` for request bodies and service return types
- Use Prisma enums for roles, institution types, and action types

### 6.7 Environment Variables

Required in `.env`:

```
PORT=
NODE_ENV=
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET_NAME=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Validate all env vars at startup using `zod` — if any are missing, crash with a clear error message.

---

## 7. Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  SUPER_ADMIN
  ADMIN
}

enum InstitutionType {
  GALLERY
  STUDIO
  CULTURAL_SPACE
}

enum Area {
  ISLAND
  MAINLAND
  OTHER
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  PUBLISH
  UNPUBLISH
  DEACTIVATE
  IMAGE_UPLOAD
}

enum TargetModel {
  INSTITUTION
  USER
}

model User {
  id         String     @id @default(cuid())
  fullName   String
  email      String     @unique
  password   String
  role       Role       @default(ADMIN)
  isActive   Boolean    @default(true)
  auditLogs  AuditLog[]
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
}

model Institution {
  id           String          @id @default(cuid())
  name         String
  description  String?
  type         InstitutionType
  address      String
  area         Area
  lat          Float
  lng          Float
  images       String[]
  website      String?
  phone        String?
  email        String?
  openingHours Json?
  tags         String[]
  isPublished  Boolean         @default(false)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
}

model AuditLog {
  id          String      @id @default(cuid())
  actorId     String
  actor       User        @relation(fields: [actorId], references: [id])
  action      AuditAction
  targetModel TargetModel
  targetId    String
  metadata    Json?
  timestamp   DateTime    @default(now())
}
```

---

## 8. Swagger Documentation Rules

- Every route must have a Swagger JSDoc comment block — no exceptions
- Document: summary, tags, parameters, request body schema, all possible responses (200, 400, 401, 403, 404, 500)
- Use `$ref` components for reusable schemas (Institution, User, ErrorResponse, SuccessResponse)
- Swagger UI at `/api-docs`, JSON at `/api-docs.json`
- All protected routes show the `BearerAuth` security requirement in Swagger

---

## 9. Data Seeding

Write a seed script at `prisma/seed.ts` that:
- Creates the default Super Admin user from env vars
- Imports the ~90 galleries from the client's Google Sheet (coordinate with PM for CSV export)
- Is idempotent (use `upsert` — safe to run multiple times without creating duplicates)

Run with: `npx prisma db seed`

---

## 10. Delivery Checklist

Before declaring a phase complete, verify:

**Database Schema**
- [ ] `prisma/schema.prisma` complete with all models, enums, and relations
- [ ] Migrations generated and applied (`npx prisma migrate dev`)
- [ ] `docs/schema.md` written and accurate
- [ ] Seed script working

**Core API**
- [ ] All endpoints in Section 3.2 implemented
- [ ] All endpoints return consistent response format
- [ ] Pagination working on list endpoints
- [ ] Auth flow (login, refresh, logout) tested end-to-end
- [ ] Refresh tokens stored/invalidated correctly in Upstash Redis
- [ ] AWS S3 image upload working

**Super Admin System**
- [ ] Role-based access enforced on all admin routes
- [ ] Audit logging writing on every write action
- [ ] Dashboard counts endpoint working

**Documentation**
- [ ] Swagger UI accessible and all routes documented
- [ ] README complete (setup, env, run, deploy)
- [ ] `docs/deployment.md` complete (PostgreSQL, AWS S3, Upstash Redis)
- [ ] Postman collection exported (optional but professional)

**Code Quality**
- [ ] No TypeScript errors (`tsc --noEmit` passes)
- [ ] No `any` types
- [ ] ESLint passes with zero warnings
- [ ] `.env.example` updated with all required keys
- [ ] No secrets or credentials committed to repo

---

## 11. Cursor Behaviour Rules

When using Cursor AI assistance on this project, enforce the following:

1. **Never generate frontend code.** This is a backend-only project. If Cursor suggests React, HTML, or CSS, reject it.

2. **Always stay in the stack.** PostgreSQL + Prisma + Express + Node.js + TypeScript. If Cursor suggests Mongoose, MongoDB, Sequelize, or TypeORM, reject it.

3. **Always use the layered architecture.** Route → Controller → Service → Prisma Client. Never put Prisma queries in controllers or routes.

4. **Always generate Swagger docs alongside routes.** Every new route = new Swagger comment block. No exceptions.

5. **Never skip validation.** Every request body must be validated with Zod before hitting the controller.

6. **Never generate features outside Section 3.** If Cursor suggests emails, payments, notifications, recommendations, or social features, reject it.

7. **Always use the consistent response format.** `successResponse()` and `errorResponse()` utilities — never `res.json()` with raw data.

8. **Never hardcode credentials.** All secrets via environment variables only.

9. **Always audit log write actions.** Any service method that creates, updates, or deletes data must call `auditLog()`.

10. **Use Prisma-generated types.** Never manually define types that Prisma already generates (e.g. `Prisma.InstitutionCreateInput`).

11. **Redis for tokens and cache only.** Do not let Cursor use Redis for anything else.

12. **Prefer explicit over clever.** This codebase will be handed off. Write code a mid-level engineer can read without explanation.

---

## 12. Timeline

| Phase | Deliverable | Deadline |
|---|---|---|
| Phase 1 | Prisma schema, migrations, seed script, project structure | Days 1–3 |
| Phase 2 | Auth system (JWT + Upstash Redis), core institution API, AWS S3 upload | Days 4–10 |
| Phase 3 | Super Admin system, audit logs, dashboard | Days 11–16 |
| Phase 4 | Swagger docs, README, deployment notes, handoff | Days 17–21 |

Delays caused by missing credentials, late feedback, or unapproved change requests from the client side do not count against your timeline (per Section 7 of the contract).

---

## 13. Communication Protocol

- Day-to-day approvals: Project Manager (Art Explore)
- Final approval: Founder + Project Manager (both must confirm in writing)
- Do not proceed to the next phase until the current phase is approved in writing
- Log all scope change requests — respond in writing, do not verbally agree to extras
- If a request is unclear, ask for written clarification before building

---

*Art Explore Backend — Internal Developer Reference | Confidential*
