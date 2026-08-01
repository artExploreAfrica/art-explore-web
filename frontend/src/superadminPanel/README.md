# Art Explore — Super Admin Panel (standalone)

A fully working, self-contained React app for the Art Explore admin side. Runs entirely on its own for now — merge it into the main frontend project once you're ready.

## Run it

```
npm install
npm run dev
```

Then open http://localhost:5173 — it redirects straight to /admin, which bounces you to the login page if you're not signed in.

Your backend needs to be running locally at http://localhost:4555 (npm run dev in the art-explore-backend project) for login and data to work. If your backend runs somewhere else, copy `.env.example` to `.env` and change `VITE_API_URL`.

## What actually works right now

Every page does real create/edit/delete/publish/approve actions against your live backend, not just read-only lists:

- **Login** — same shared login endpoint as the public site. Role (`ADMIN` / `SUPER_ADMIN`) determines what you can see.
- **Dashboard** — real stats (total / published / draft galleries).
- **Institutions** — create, edit, publish/unpublish, delete a gallery. Upload a gallery photo. Expand a row ("Manage") to add/delete exhibitions under that gallery.
- **Submissions** — Approve or Reject each pending submission, with a required reason on reject.
- **Tags** — create, edit, delete.
- **Subcategories** — create, edit, delete.
- **Users** (Super Admin only) — create a new admin account, deactivate an existing one.
- **Audit log** (Super Admin only) — read-only by design, nothing to act on here.

## Known limitation carried over from testing

Both image-upload actions (gallery photo, exhibition photo) will likely fail with `"the specified bucket does not exist"`. This was already confirmed during backend endpoint testing — it's a cloud storage configuration problem on the backend, not a bug in this frontend code. Everything else works independently of it.

## Verified

This project was `npm install`'d and built for real before being handed over:
- `npm run build` (`tsc -b && vite build`) passes with zero TypeScript errors, strict mode on.
- `npm run dev` boots and serves successfully.

## Merging into the main frontend project later

1. Copy `src/admin/` (and `src/App.tsx` if useful as a reference) into the main project's `src/`.
2. Confirm the main project has `react-router-dom` installed — add it if not (`npm install react-router-dom`).
3. Mount `<AuthProvider>` near the root, and either mount `<AdminRoutes />` directly or fold its routes into the main router.
4. Point `VITE_API_URL` (or however the main project names its API base URL) at the real backend URL.
5. Delete this project's scaffolding (`package.json`, `vite.config.ts`, etc.) — you only need the `src/admin/` folder once it's merged in.
