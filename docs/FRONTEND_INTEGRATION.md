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
| GET | `/subcategories`, `/tags` | filter options | none |
| POST | `/auth/signup` `/auth/login` | create / log in a USER | none |
| POST | `/auth/logout` `/auth/refresh` | session management | token |
| GET | `/auth/me` | current user | token |

**`/institutions` query params:** `page`, `limit` (max 100), `area`
(`ISLAND|MAINLAND|OTHER`), `type` (see enum below), `tag`, `subCategoryId`,
`search` (free text over name/description/tags).

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
| `rating` | — | **GAP — no backend field. See note B.** |
| `hours` | `openingHours` | **GAP — shapes differ. See note C.** |
| `description`, `website`, `phone`, `email`, `tags`, `openingHours` | passed through | available for a detail page later |

### Backend `type` enum
`ART_GALLERY · MUSEUM · INSTITUTE · FOUNDATION · STUDIO · CULTURAL_SPACE`

The current type→category mapping (edit in `adapters.js` → `TYPE_TO_ARTTYPE`):
`ART_GALLERY/MUSEUM/INSTITUTE/FOUNDATION → "gallery"`, `STUDIO → "studio"`,
`CULTURAL_SPACE → "events"`.

---

## 5. The three known gaps (decide these, don't guess)

These are **not bugs in the code** — they're places where the backend and the old
mock data genuinely disagree. The adapter fills them with safe defaults so nothing
crashes, but you should make a real decision on each.

### A. `artTypes` — tabs are multi-value, backend `type` is single
The UI tabs (Galleries / Exhibitions / Artists / Events) filter on an **array** of
keywords. A backend institution has **one** `type` enum. Right now we map
`type` → one keyword and append `"exhibition"` when `hasExhibition` is true.
If you want richer tab behavior (e.g. an institution showing under both "Artists"
and "Events"), drive it from `tags[]` — extend `adaptInstitution()` to push tag
names into `artTypes`.

### B. `rating` — backend has no rating field
The old mock had `rating: 4.8`. The backend does **not** store ratings. The adapter
sets `rating: null`. Consequences in the UI:
- The **"Top Rated"** filter and the **"Top Rated" sort option** won't do anything useful.

**Recommended:** hide those two controls for now (in `ArtGalleryApp.jsx`, the
`topRated` toggle in `FilterRow` and the `rating` entry in `SORT_OPTIONS`). If
ratings are wanted later, that's a **backend change** (add a `rating` column +
expose it) — flag it to the backend owner; don't fake it on the frontend.

### C. `hours` / "Open Now" — incompatible formats + a pre-existing bug
- Backend `openingHours` looks like `{"mon":"10am-6pm","tue":"10am-6pm",...}`
  (human strings, keyed by day name).
- The old UI expected a 7-element array of `{open:"09:00", close:"17:00"}` and ran
  `isOpenNow()` on it.
- **Separately**, `data/galleries.js`'s `timeToMinutes()` has a stray `return;`
  before its expression, so it always returns `undefined` — meaning "Open Now" was
  **already broken** before any of this.

The adapter sets `hours: null` (which makes `isOpenNow` harmless). **Recommended:**
hide the "Open Now" toggle for now. To make it real later, pick ONE hours format
and convert in the adapter — but first the backend's `openingHours` should be
normalized to something parseable (e.g. 24h `HH:MM`).

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
2. Decide the **three gaps** in §5 (hide rating/open-now controls is the quick win).
3. Once both consumers use the API, delete `src/data/galleries.js`.

---

## 8. Quick troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Could not reach the API…" in the UI | Backend not running, or `VITE_API_URL` wrong. Start `npm run dev` at the root. |
| Empty list, no error | DB not seeded, or all institutions are unpublished. Run `npm run seed`; only `isPublished + APPROVED` rows are returned. |
| CORS error in console | You set `ALLOWED_ORIGINS` in the backend `.env` but didn't include the frontend origin. Either clear it (dev) or add `http://localhost:5173`. |
| Changed `.env` but nothing happened | Vite only reads `.env` at startup — restart `npm run dev`. |
