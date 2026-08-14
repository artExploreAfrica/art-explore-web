# Frontend ↔ Backend Integration Guide

This is the single source of truth for wiring the **`frontend/`** React app to the
**Art Explore backend API**. If you're the frontend dev: read this top to bottom
once, then you shouldn't need to ask how any of it works.

---

## 1. The big picture (read this first)

- The backend is a **pure JSON API**. It has no HTML pages. Visiting `/` returns
  `{"success":false,"message":"Route not found: GET /"}` — that is normal, it just
  means the server is up.
- Every backend response uses **one envelope**:
  ```jsonc
  // success
  { "success": true,  "message": "...", "data": <the thing you want>, "pagination": { ... } }
  // error
  { "success": false, "message": "why it failed", "errors": [ ... ] }
  ```
- The frontend never touches `fetch` directly. It goes through three small files:

  | File | Job |
  |------|-----|
  | `src/lib/api.js` | one `apiGet()` that calls the API and unwraps the envelope |
  | `src/lib/adapters.js` | converts a backend `Institution` → the gallery shape the UI already uses |
  | `src/hooks/useGalleries.js` | a `useGalleries()` hook = the data source for components |

So a component just does `const { galleries, loading, error } = useGalleries()`
and gets data in **exactly the old mock shape**. No component logic had to change.

---

## 2. One-time setup

1. Start the **backend** (from the project root):
   ```bash
   npm run dev          # serves the API on http://localhost:4000 (override with PORT)
   ```
   Make sure the DB is seeded so there's data to show:
   ```bash
   npm run seed
   ```
2. Configure the **frontend** (from `frontend/`):
   ```bash
   cp .env.example .env   # then edit if your API isn't on :4000
   npm install
   npm run dev            # Vite dev server, usually http://localhost:5173
   ```
   `.env` only needs one line:
   ```
   VITE_API_URL=http://localhost:4000
   ```
   > CORS is already open on the backend when `ALLOWED_ORIGINS` is empty (dev/test),
   > so the browser can call `:4000` from `:5173` directly. No proxy needed.

That's it. Open the app — the **Search** section (`ArtGalleryApp`) is already
pulling live data from the API.

---

## 3. The API endpoints you'll use

Base path for everything: `http://localhost:4000/api/v1`

| Method | Path | What it returns | Auth |
|--------|------|-----------------|------|
| GET | `/institutions` | paginated list (full objects) | none (public) |
| GET | `/institutions/map` | lightweight pins `{id,name,lat,lng,type}` | none |
| GET | `/institutions/:id` | one institution | none |
| GET | `/institutions/:id/exhibitions` | that institution's exhibitions | none |
| GET | `/exhibitions` | what's on across **every** venue | none |
| GET | `/institutions/:id/reviews` | approved reviews for a venue | none |
| POST | `/institutions/:id/reviews` | leave a review (`{rating, comment?}`) | token (USER) |
| PUT/DELETE | `/reviews/:id` | edit / delete your own review | token (USER) |
| GET | `/subcategories`, `/tags` | filter options | none |
| POST | `/auth/signup` `/auth/login` | create / log in a USER | none |
| POST | `/auth/logout` `/auth/refresh` | session management | token |
| GET | `/auth/me` | current user | token |
| POST | `/submissions` | submit a venue for review | token (USER) |
| POST | `/submissions/:id/images` | upload an image to your submission | token (USER) |

**`/institutions` query params:** `page`, `limit` (max 100), `area`
(`ISLAND|MAINLAND|OTHER`), `type` (see enum below), `tag`, `subCategoryId`,
`search` (free text over name/description/tags), `minRating` (0–5),
`openNow` (`true|false`), `hasExhibition` (`true|false`),
`sort` (`newest|oldest|name|rating`).

**`/exhibitions` and `/institutions/:id/exhibitions` query params:**
`scope` (`live` — default, still running; `past`; `all`), plus `area`, `type`,
`institutionId`, `search` on the cross-venue endpoint.

Full interactive docs (try every endpoint in the browser):
**http://localhost:4000/api-docs**


---

## 4. The data shape mapping (most important section)

The backend `Institution` and the old UI `gallery` object do **not** have the same
fields. `src/lib/adapters.js` does the translation. Here's exactly what it does:

| UI field (what components read) | Comes from backend | Notes |
|---|---|---|
| `id` | `id` | was a number, now a **cuid string**. Only used as a React `key`, so fine. |
| `name` | `name` | direct |
| `address` | `address` | direct |
| `lat` / `lng` | `lat` / `lng` | direct |
| `region` | `area` | `ISLAND`→`"Island"`, `MAINLAND`→`"Mainland"`, `OTHER`→`"Other"` |
| `artTypes` | `type` (+ `hasExhibition`) | enum → one keyword; adds `"exhibition"` if `hasExhibition`. **See note A.** |
| `image` | `images[0]` | first image, or `null` → card shows the initials placeholder |
| `neighborhood` | derived from `address` | backend has no neighborhood field; we take the last address segment |
| `rating` | `rating` (+ `reviewCount`) | Mean of approved reviews, 1 decimal; `null` until a venue has one. **See note B.** |
| `hours` | `openingHours` | Now day-indexed and parseable. **See note C.** |
| `description`, `website`, `phone`, `email`, `tags`, `openingHours` | passed through | available for a detail page later |

### Backend `type` enum
`ART_GALLERY · MUSEUM · INSTITUTE · FOUNDATION · STUDIO · CULTURAL_SPACE`

The current type→category mapping (edit in `adapters.js` → `TYPE_TO_ARTTYPE`):
`ART_GALLERY/MUSEUM/INSTITUTE/FOUNDATION → "gallery"`, `STUDIO → "studio"`,
`CULTURAL_SPACE → "events"`.

---

## 5. Known gaps

Gaps **B** and **C** below are now **closed** — the backend grew the fields the UI
was already asking for, so the "hide the control" advice no longer applies. Gap A
is still a real product decision.

### A. `artTypes` — tabs are multi-value, backend `type` is single
The UI tabs (Galleries / Exhibitions / Artists / Events) filter on an **array** of
keywords. A backend institution has **one** `type` enum. Right now we map
`type` → one keyword and append `"exhibition"` when `hasExhibition` is true.
If you want richer tab behavior (e.g. an institution showing under both "Artists"
and "Events"), drive it from `tags[]` — extend `adaptInstitution()` to push tag
names into `artTypes`.

### B. `rating` — RESOLVED, backend now stores it
`Institution.rating` is the mean of **approved** reviews (one decimal), with
`reviewCount` alongside it. It is `null` until a venue has its first approved
review, so "unrated" stays distinguishable from a genuine 0 — treat `null` as
"no rating yet", not as zero, or unrated venues will sort below 1-star ones.

Keep the "Top Rated" controls. Prefer filtering and sorting **server-side** —
`?minRating=4` and `?sort=rating` are indexed and page correctly, whereas the
client-side `g.rating >= 4.0` only ever filters the current page.

Reviews are user-generated and moderated: `POST /institutions/:id/reviews`
creates one as `PENDING` (invisible and uncounted until an admin approves it),
one per account per venue — a second attempt returns **409**, so the UI should
offer "edit your review" rather than a second form. Editing returns it to
`PENDING`, so warn that an edit temporarily removes it from public view.

### C. `hours` / "Open Now" — RESOLVED, shape is now parseable
`openingHours` is keyed by **JavaScript day index** so it can be indexed straight
from `getDay()` — which is exactly what the existing `isOpenNow(hours)` expects:

```jsonc
{
  "0": null,                              // closed Sunday
  "1": { "open": "10:00", "close": "18:00" },
  "6": { "open": "11:00", "close": "16:00" }
}
```

Times are 24-hour `HH:mm`, zero-padded. A **missing** day means hours are
unknown; `null` means closed that day. A `close` earlier than `open`
(e.g. `"20:00"` → `"02:00"`) means the venue trades past midnight — the existing
client `isOpenNow` does **not** handle that wrap, so prefer the server filter.

> **Breaking change:** the old `{"mon":"9am-5pm"}` shape is now rejected with a
> **400** on write. Anything posting that format must be updated. The seed
> converts the client sheet's text automatically on import.

Use `GET /institutions?openNow=true` to filter server-side; it handles the
midnight wrap and pages correctly. Note it treats a venue with no hours recorded
as open (unknown, not closed) — matching the client's own `isOpenNow`.

Still worth fixing on the frontend: `data/galleries.js`'s `timeToMinutes()` has a
stray `return;` before its expression, so it always returns `undefined`. That bug
predates all of this and will break any **client-side** "Open Now" evaluation.

---

## 6. How to point a NEW component at the API

```jsx
import { useGalleries } from "../../hooks/useGalleries";

function MyComponent() {
  const { galleries, loading, error, reload } = useGalleries();

  if (loading) return <p>Loading…</p>;
  if (error)   return <button onClick={reload}>Retry — {error}</button>;

  return galleries.map((g) => <div key={g.id}>{g.name}</div>);
}
```

For a one-off call to any other endpoint, use the client directly:
```js
import { apiGet } from "../lib/api";
const { data } = await apiGet("/institutions/" + id);          // detail
const { data, pagination } = await apiGet("/institutions", {   // filtered list
  area: "ISLAND", search: "nike", limit: 20,
});
```

---

## 7. What's already done vs. what's left

**Done (wired and building):**
- `src/lib/api.js`, `src/lib/adapters.js`, `src/hooks/useGalleries.js`, `.env.example`
- `ArtGalleryApp.jsx` (the **Search** section) now reads from `useGalleries()` with
  loading / error / empty states. `npm run build` passes.

**Left for you:**
1. **`MapView.jsx`** still imports the static `data/galleries`. To switch it:
   replace `import { galleries } from '../../data/galleries'` with the hook, and
   render the map only once data has loaded. Because MapView builds GeoJSON
   imperatively, the cleanest move is to lift `useGalleries()` into `App.jsx` and
   pass `galleries` down as a prop to **both** `MapView` and `ArtGalleryApp` (so
   there's one fetch, not two). The adapted shape already includes everything
   `buildGalleriesGeoJSON` reads (`name`, `neighborhood`, `address`, `region`,
   `rating`, `image`, `artTypes`).
2. Decide gap **A** in §5 (`artTypes`). Gaps B and C are closed — instead of
   hiding the "Top Rated" and "Open Now" controls, point them at the server:
   `?minRating=`, `?sort=rating`, `?openNow=true`.
3. Update the adapter for the two fields that now exist: pass `rating` /
   `reviewCount` straight through, and stop forcing `hours: null` — the backend
   shape is now exactly what `isOpenNow` indexes into.
4. Fix the stray `return;` in `timeToMinutes()` (`data/galleries.js`) if you keep
   any client-side "Open Now" evaluation.
5. Once both consumers use the API, delete `src/data/galleries.js`.

---

## 8. Quick troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Could not reach the API…" in the UI | Backend not running, or `VITE_API_URL` wrong. Start `npm run dev` at the root. |
| Empty list, no error | DB not seeded, or all institutions are unpublished. Run `npm run seed`; only `isPublished + APPROVED` rows are returned. |
| CORS error in console | You set `ALLOWED_ORIGINS` in the backend `.env` but didn't include the frontend origin. Either clear it (dev) or add `http://localhost:5173`. |
| Changed `.env` but nothing happened | Vite only reads `.env` at startup — restart `npm run dev`. |
