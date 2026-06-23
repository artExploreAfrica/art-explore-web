# Art Explore — Architecture Strategy

---

## What Prisma and Upstash Redis Do (Novice Explanation)

### Prisma — Your Database Assistant

Imagine your database (PostgreSQL) is a giant filing cabinet full of drawers
(tables for Users, Galleries, Artworks, etc.). Normally, you'd have to write
raw SQL like `SELECT * FROM galleries WHERE city = 'Lagos'` — which is
fiddly and error-prone.

**Prisma is a translator.** You write TypeScript code like:

```ts
prisma.gallery.findMany({ where: { city: 'Lagos' } });
```

Prisma converts that into the right SQL, checks your types, and gives you
back properly shaped data. It also manages your database schema via a single
`schema.prisma` file and handles migrations (version-controlled changes to
your database structure). Think of it as the middleman that keeps your
database and your code in sync.

### Upstash Redis — Your Short-Term Memory

Every time someone loads the gallery list, your server hits the database.
If 500 people do this at once, that's 500 database hits — slow and expensive.

**Redis is a superfast scratchpad** stored in RAM (not on disk), so reads
are near-instant. Upstash is a serverless, pay-per-request version of Redis
— you don't run a server, you just use it.

The flow:

1. User requests gallery list
2. Server checks Redis — **is the answer already here?**
3. If yes → return it instantly (cache hit, ~1ms)
4. If no → query Postgres, store result in Redis for 5 minutes, return it
5. Next 499 users get the Redis answer — Postgres barely moves

Use it for: gallery listings, artwork feeds, rate limiting, session tokens.

---

## Two Options — Pick Your Comfort Level

---

## Option A — Simple Monolith on EC2 + CloudFront (Recommended to Start)

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS (Browser/Mobile)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS CloudFront (CDN)                          │
│  • Caches static assets (JS, CSS, images) at edge locations      │
│  • SSL termination (free HTTPS)                                  │
│  • Routes /api/* → EC2, everything else → S3 static bucket      │
└────────────┬────────────────────────────┬───────────────────────┘
             │ /api/* requests             │ Static files (HTML/JS/CSS)
             ▼                             ▼
┌────────────────────────┐    ┌──────────────────────────────────┐
│     EC2 Instance        │    │    S3 Bucket (Static Website)    │
│  (e.g. t3.small)        │    │   React build output lives here  │
│                         │    │   `vite build` → upload to S3    │
│  ┌─────────────────┐   │    └──────────────────────────────────┘
│  │  Node.js/Express│   │
│  │  API Server      │   │              ┌──────────────────────────┐
│  │  :3000           │◄──┼─────────────►│  S3 Bucket (Media/Images)│
│  │                  │   │   upload/    │  Artwork photos, avatars  │
│  │  • Auth routes   │   │   presigned  │  Accessed via CloudFront  │
│  │  • Gallery API   │   │   URLs       │  or direct S3 URLs        │
│  │  • Artwork API   │   │              └──────────────────────────┘
│  │  • Upload API    │   │
│  │  • Map/Location  │   │
│  └────────┬─────────┘   │
│           │              │
│    ┌──────┴───────┐      │
│    │    Prisma
     (managed database)    │  │
│    │  ORM Layer   │      │
│    └──────┬───────┘      │
└───────────┼──────────────┘
            │
            ▼
┌───────────────────────┐        ┌──────────────────────────┐
│  AWS RDS PostgreSQL   │        │   Upstash Redis           │
│  (managed database)   │        │   (serverless, pay/use)   │
│                       │        │                           │
│  • Users              │        │  • Gallery list cache     │
│  • Galleries          │        │  • Session tokens         │
│  • Artworks           │        │  • Rate limiting          │
│  • Events             │        │  • Search results cache   │
│  • Reviews            │        │                           │
└───────────────────────┘        └──────────────────────────┘
```

### How It Works Step-by-Step

1. User opens `artexploreafrica.com` in browser
2. CloudFront serves the React app (HTML/JS/CSS) from S3 — fast, cached globally
3. React app loads map, requests `/api/galleries` from CloudFront
4. CloudFront forwards `/api/*` to your EC2 Express server
5. Express checks Upstash Redis — if cached, returns instantly
6. If not cached, Prisma queries RDS Postgres, caches result in Redis
7. User uploads artwork photo → Express gets presigned S3 URL → browser uploads directly to S3 (EC2 never touches the file bytes)

### Cost Estimate (Lagos traffic, small scale)

| Service              | Monthly           |
| -------------------- | ----------------- |
| EC2 t3.small         | ~$15              |
| RDS db.t3.micro      | ~$15              |
| CloudFront           | ~$1–5             |
| S3 (images + static) | ~$2–5             |
| Upstash Redis        | Free tier / ~$0–5 |
| **Total**            | **~$35–45/month** |

### Pros

- ✅ Simple — one server to manage, one place to SSH into
- ✅ Easy to debug — everything is in one place
- ✅ CloudFront gives you global speed for free
- ✅ Scales fine to thousands of users

### Cons

- ❌ EC2 needs manual scaling if you get viral traffic
- ❌ Deployments require a brief restart

---

## My Recommendation: Start with Option A

You're building something real but still early. **Option A is the right call because:**

1. Your backend already has all the pieces (S3, Prisma, Redis) — you just need to add the React build step
2. CloudFront + S3 for static + EC2 for API gives you 90% of Option B's benefits at half the complexity
3. When you hit real traffic problems, migrating from Option A → B is straightforward — you just peel the frontend off into its own S3 bucket

**The monorepo structure in `art-explore-web` would look like:**

```
art-explore-web/
├── src/              ← Express API (already exists)
├── prisma/           ← Database schema (already exists)
├── client/           ← React frontend moved here (from ART-EXPLORE)
│   ├── src/
│   ├── index.html
│   └── vite.config.js
├── package.json
└── ...
```

In production, `npm run build` in `/client` outputs to `client/dist/` which gets uploaded to S3. EC2 only runs the API.

---

## Deployment Flow (Option A)

```
GitHub Push → GitHub Actions CI
     │
     ├── Run tests (vitest)
     ├── Build React: cd client && vite build
     ├── Upload client/dist/ → S3 (static bucket)
     └── SSH into EC2 → git pull → npm run build → pm2 restart
```

---

## Quick Reference: Which Service Does What

| Service            | Role                           | Why                                   |
| ------------------ | ------------------------------ | ------------------------------------- |
| **EC2**            | Runs your Express API          | Simple, cheap, full control           |
| **CloudFront**     | CDN in front of everything     | Speed + free HTTPS                    |
| **S3 (static)**    | Hosts React built files        | Dirt cheap, infinitely scalable       |
| **S3 (media)**     | Stores uploaded artwork images | You never want images on EC2 disk     |
| **RDS PostgreSQL** | Main database via Prisma       | Managed, backups handled for you      |
| **Upstash Redis**  | Cache + rate limiting          | Serverless, no extra server to manage |
