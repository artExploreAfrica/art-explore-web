# Art Explore — Deployment Guide

This document covers provisioning the three external services (PostgreSQL, AWS S3, Upstash Redis) and deploying the API to production.

---

## 1. Environment Variables

The app validates every variable at startup via Zod ([`src/config/env.ts`](../src/config/env.ts)). A missing or malformed value crashes the process with a clear message — there is no silent fallback. Provide all keys from [`.env.example`](../.env.example).

Generate strong JWT secrets, e.g.:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Use **different** values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

---

## 2. PostgreSQL

Any PostgreSQL 14+ instance works (Neon, Supabase, RDS, Railway, or self-hosted).

1. Create a database, e.g. `art_explore`.
2. Set `DATABASE_URL`:
   ```
   postgresql://USER:PASSWORD@HOST:5432/art_explore?schema=public
   ```
   For managed providers that require TLS, append `&sslmode=require`.
3. Apply the schema:
   ```bash
   # Production: apply already-generated migrations without prompting
   npx prisma migrate deploy

   # First-time local dev: create the initial migration
   npx prisma migrate dev --name init
   ```
4. Seed the default Super Admin (and galleries if `prisma/data/galleries.json` is present):
   ```bash
   npm run seed
   ```

The Prisma client is a singleton ([`src/config/db.ts`](../src/config/db.ts)); do not instantiate `PrismaClient` elsewhere.

---

## 3. AWS S3 (gallery images)

1. **Create a bucket** in your chosen region (e.g. `art-explore-images`, `eu-west-1`).
2. **IAM user/policy** with least-privilege access to that bucket:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject"],
         "Resource": "arn:aws:s3:::art-explore-images/*"
       }
     ]
   }
   ```
3. **Public read** for uploaded images: either enable a bucket policy that allows
   `s3:GetObject` on `*`, or front the bucket with CloudFront. Uploaded objects are
   returned as `https://<bucket>.s3.<region>.amazonaws.com/<key>`
   ([`src/utils/s3Uploader.ts`](../src/utils/s3Uploader.ts)).
4. Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET_NAME`.

Images are stored under `institutions/{institutionId}/{uuid}.{ext}`. Uploads are
in-memory (multer) with a 5 MB limit and restricted to JPEG/PNG/WEBP/GIF.

---

## 4. Upstash Redis

Used **only** for refresh-token storage and short-lived response caching.

1. Create a Redis database at [upstash.com](https://upstash.com).
2. Copy the **REST** URL and token (not the `redis://` URL).
3. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Keys used:
| Key | TTL | Purpose |
|---|---|---|
| `refresh:{userId}` | 7 days | Hashed refresh token; deleted on logout/deactivation |
| `cache:institutions:list:{hash}` | 60s | `GET /api/institutions` cache |
| `cache:institutions:map` | 60s | `GET /api/institutions/map` cache |

Caches are invalidated automatically on any admin write to institutions.

---

## 5. Build & Run in Production

```bash
npm ci
npm run build          # compiles to dist/
npx prisma migrate deploy
npm run seed           # first deploy only (idempotent)
npm start              # runs dist/server.js
```

Set `NODE_ENV=production` so stack traces are never returned in error responses.

### Process management
Run under a process manager (PM2, systemd) or a container. The server handles
`SIGINT`/`SIGTERM` for graceful shutdown (closes HTTP + Prisma).

### Health check
`GET /health` returns `{ success, data: { status: "ok", uptime } }` — wire this to
your platform's health probe.

### Reverse proxy
Terminate TLS at a proxy (Nginx, ALB, Cloudflare) and forward to the app port.
The app sets `trust proxy = 1` so per-IP rate limiting sees the real client
address — ensure exactly one proxy hop forwards `X-Forwarded-For`.

### CORS & rate limiting
Set `ALLOWED_ORIGINS` to a comma-separated list of frontend domains before
go-live; while it is empty the API reflects any origin (development default).
The auth endpoints (`/api/auth/*`) are rate limited to 20 requests per IP per
15 minutes to blunt credential brute-forcing. The limiter uses an in-memory
store — adequate for a single instance; front it with a shared store if you run
multiple instances.

---

## 6. Pre-launch Checklist

- [ ] All env vars set; app boots without env errors
- [ ] `npx prisma migrate deploy` applied cleanly
- [ ] Super Admin seeded; password rotated from the seed default
- [ ] S3 upload verified end-to-end (image URL resolves publicly)
- [ ] Redis reachable; login creates `refresh:{userId}`, logout deletes it
- [ ] `NODE_ENV=production`
- [ ] `ALLOWED_ORIGINS` set to the frontend domain(s)
- [ ] Swagger reachable (or intentionally disabled) at `/api-docs`
