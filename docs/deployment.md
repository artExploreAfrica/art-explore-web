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
3. Apply the schema. The initial migration is committed under
   [`prisma/migrations/`](../prisma/migrations), so this just runs it:
   ```bash
   # Production: apply committed migrations without prompting
   npx prisma migrate deploy

   # Local dev: apply committed migrations (and pick up future schema changes)
   npx prisma migrate dev
   ```
4. Seed the default Super Admin (and galleries if `prisma/data/galleries.json` is present):
   ```bash
   npm run seed
   ```

The Prisma client is a singleton ([`src/config/db.ts`](../src/config/db.ts)); do not instantiate `PrismaClient` elsewhere.

---

## 3. AWS S3 (gallery images)

1. **Create a bucket** in your chosen region (e.g. `art-explore-db-images`, `eu-north-1`).
2. **IAM user/policy** with least-privilege access to that bucket:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::art-explore-db-images",
        "arn:aws:s3:::art-explore-db-images/*"
      ]
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

Used for refresh-token storage, short-lived response caching, password-reset
tokens, and auth endpoint rate-limit state.

1. Create a Redis database at [upstash.com](https://upstash.com).
2. Copy the **REST** URL and token (not the `redis://` URL).
3. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

| Key pattern | Purpose | TTL |
|---|---|---|
| `refresh:{userId}` | Hashed refresh token | 7 days |
| `cache:institutions:*` | Public list/map cache | 60s |
| `reset:{sha256}` | Password-reset token | 1 hour |
| rate-limit keys | Auth endpoint rate limiting | per limiter |

Caches are invalidated automatically on any admin write that can change a public
payload (institutions, tags, sub-categories, exhibitions).

---

## 5. Build & Run in Production

CI (GitHub Actions) runs typecheck, lint, and tests only. **Production deploy is
manual** — there is no automated SSH/pm2 pipeline yet.

```bash
# On the server (after git pull)
npm ci
npm run build          # compiles to dist/
npm run prisma:deploy  # apply committed migrations
npm run seed           # first deploy only (idempotent)
npm start              # or: pm2 restart art-explore-api
```

Set `NODE_ENV=production` so stack traces are never returned in error responses.
`ALLOWED_ORIGINS` is **required** in production (boot fails if empty).

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
Set `ALLOWED_ORIGINS` to a comma-separated list of frontend domains. In
`NODE_ENV=production` an empty allowlist crashes boot. Auth endpoints
(`/api/v1/auth/*`) are rate limited to 20 requests per IP per 15 minutes.
The limiter is backed by Upstash Redis so limit state survives restarts.

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
