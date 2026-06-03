# Art Explore — Data Model

**Stack:** PostgreSQL via Prisma ORM. Source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma).

This document describes every model, field, and relationship in plain language. It mirrors the diagram in [`ArtExplore_DB_Diagram.md`](../ArtExplore_DB_Diagram.md).

---

## Models

### User
Admin accounts (there is **no** public user registration).

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `fullName` | String | Admin's display name |
| `email` | String | **Unique** — login identifier |
| `password` | String | bcrypt hash (cost 10) — never returned by the API |
| `role` | `Role` | `SUPER_ADMIN` or `ADMIN` (default `ADMIN`) |
| `isActive` | Boolean | Default `true`; deactivation sets `false` |
| `auditLogs` | `AuditLog[]` | Reverse relation — actions this user performed |
| `createdAt` | DateTime | Set on insert |
| `updatedAt` | DateTime | Auto-updated |

### Institution
A discoverable art venue (gallery, studio, or cultural space).

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `name` | String | Venue name |
| `description` | String? | Optional long text |
| `type` | `InstitutionType` | `GALLERY` / `STUDIO` / `CULTURAL_SPACE` |
| `address` | String | Street address |
| `area` | `Area` | `ISLAND` / `MAINLAND` / `OTHER` |
| `lat` | Float | Latitude (map pin) |
| `lng` | Float | Longitude (map pin) |
| `images` | String[] | Array of S3 object URLs |
| `website` | String? | Optional |
| `phone` | String? | Optional |
| `email` | String? | Optional |
| `openingHours` | Json? | e.g. `{ "mon": "9am-5pm", ... }` |
| `tags` | String[] | Freeform tags for search/filter |
| `isPublished` | Boolean | Default `false`; soft-delete sets `false` |
| `createdAt` | DateTime | Set on insert |
| `updatedAt` | DateTime | Auto-updated |

Indexed on `area`, `type`, and `isPublished` to keep the public list/filter queries fast.

### AuditLog
An immutable trail of every admin write action.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `actorId` | String (FK → User.id) | Who performed the action |
| `actor` | `User` | Relation to the acting admin |
| `action` | `AuditAction` | See enum below |
| `targetModel` | `TargetModel` | `INSTITUTION` or `USER` |
| `targetId` | String | ID of the affected record (generic, **not** a hard FK) |
| `metadata` | Json? | Optional extra context (e.g. changed fields) |
| `timestamp` | DateTime | Set on insert |

Indexed on `actorId`, `(targetModel, targetId)`, and `timestamp`.

---

## Relationships

| Relationship | Type | Description |
|---|---|---|
| User → AuditLog | One-to-Many | Every action is traced to its actor via `actorId` |
| Institution → AuditLog | Logical (via `targetId`) | When `targetModel = INSTITUTION`, `targetId` references an Institution |
| User → AuditLog | Logical (via `targetId`) | When `targetModel = USER`, `targetId` references a User (e.g. deactivation) |

> `AuditLog.targetId` is a generic string reference, not a foreign key. A single
> AuditLog table can therefore track actions against both Institutions and Users,
> disambiguated by the `targetModel` enum.

---

## Enums

**Role** — `SUPER_ADMIN` (manage admins + all content), `ADMIN` (manage institution content only).

**InstitutionType** — `GALLERY`, `STUDIO`, `CULTURAL_SPACE`.

**Area** — `ISLAND` (Lagos Island), `MAINLAND` (Lagos Mainland), `OTHER`.

**AuditAction** — `CREATE`, `UPDATE`, `DELETE` (soft delete → `isPublished:false`), `PUBLISH`, `UNPUBLISH`, `DEACTIVATE`, `IMAGE_UPLOAD`.

**TargetModel** — `INSTITUTION`, `USER`.

---

## Redis (outside the relational schema)

Upstash Redis is used for two purposes only:

| Key pattern | Value | TTL | Purpose |
|---|---|---|---|
| `refresh:{userId}` | Hashed refresh token | 7 days | Refresh-token store — deleted on logout |
| `cache:institutions:{queryHash}` | JSON string | 60s | Cache for `GET /api/institutions` |
| `cache:institutions:map` | JSON string | 60s | Cache for `GET /api/institutions/map` |

Caches are invalidated on any admin write to institutions.
