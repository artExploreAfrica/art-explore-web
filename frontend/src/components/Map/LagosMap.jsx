import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useGalleries } from "../../hooks/useGalleries";
import { placeOf } from "../../lib/adapters";
import "./LagosMap.scss";

/**
 * The map's place on the home page — 04 in the sequence.
 *
 * The interactive map lives on its own page (/map). On phones it used to fill
 * the screen mid-page, so visitors scrolling past got stuck dragging the map
 * instead of the page. What's left here is a teaser and the way in.
 *
 * The teaser is one framed composition: photos of real spaces laid like
 * prints on a table — white borders, slight tilts, each overlapping the next —
 * with the space's name and a small pin on each print's border — laid over
 * a faint map of Lagos. The map's pins are every space's real location, so
 * the Island and Lekki clusters show where they really are; the pins of the
 * photographed spaces are stronger, and on desktop a dashed line runs from
 * each print to its pin. It's pictures only — no map library, nothing to
 * swipe — and the whole frame is one link to /map, with the "Explore our
 * map" button underneath.
 *
 * The photos are a random pick of published spaces that have one, chosen
 * afresh on every visit so the home page shows off more of the catalogue.
 * The spaces come from useGalleries, which the home page has already loaded
 * for the hero and the tag cards, so this costs no extra request.
 */

// 4 photos; phones show the first 3 (the CSS hides the 4th).
const PHOTO_COUNT = 4;

// Small, seeded shuffle: the pick is random per visit but stable across
// re-renders (Math.random in render would reshuffle on every update).
function seededShuffle(list, seed) {
  let s = Math.floor(seed * 2 ** 32) || 1;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const initials = (name) =>
  name
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const PinIcon = ({ size = 12 }) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 10 13" aria-hidden="true">
    <path d="M5 13C2 9 0 6.8 0 4.8a5 5 0 0 1 10 0C10 6.8 8 9 5 13z" fill="currentColor" />
    <circle cx="5" cy="4.8" r="1.7" fill="var(--cream)" />
  </svg>
);

function PhotoTile({ space, slot }) {
  const [state, setState] = useState("loading"); // loading | ready | failed
  const place = placeOf(space);
  return (
    <figure className={`map-stack__print map-stack__print--p${slot}`}>
      <span className={`map-stack__photo${state === "loading" ? " is-loading" : ""}`}>
        {state === "failed" ? (
          <span className="map-stack__ph">{initials(space.name)}</span>
        ) : (
          // Some originals are large and slow on mobile data: the print
          // shimmers until the photo arrives, then it fades in.
          <img
            src={space.image}
            alt=""
            loading="lazy"
            decoding="async"
            className={state === "ready" ? "is-ready" : undefined}
            onLoad={() => setState("ready")}
            onError={() => setState("failed")}
          />
        )}
      </span>
      <figcaption className="map-stack__caption">
        <PinIcon size={9} />
        <span className="map-stack__name">{space.name}</span>
        {/* "Other" just means the area is unknown — say nothing instead. */}
        {place && place !== "Other" && <span className="map-stack__place">{place}</span>}
      </figcaption>
    </figure>
  );
}

// The part of Lagos the frame shows. Nearly every space falls inside; the
// few that don't (Badagry, far Ikorodu) just aren't drawn.
const BOUNDS = { west: 3.26, east: 3.66, north: 6.64, south: 6.4 };

/** lat/lng → % of the frame (left, top). null when outside BOUNDS. */
function project(g) {
  const lat = Number(g.lat);
  const lng = Number(g.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const x = ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100;
  const y = ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * 100;
  return x >= 1 && x <= 99 && y >= 1 && y <= 97 ? { x, y } : null;
}

// Where each print's dashed line starts: its bottom-centre, in % of the
// frame. Must match the desktop print positions in LagosMap.scss.
const PRINT_ANCHORS = [
  [18.5, 70],
  [39.5, 74],
  [61, 61],
  [82.5, 50],
];

/** Lagos, loosely: the lagoon and the Atlantic, stretched to the frame. */
function MapBackground() {
  return (
    <svg className="map-stack__bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path
        className="map-stack__water"
        d="M44 28 C 56 18, 76 20, 100 24 V 66 C 88 62, 76 68, 64 70 C 56 72, 50 68, 47 60 C 43 50, 41 38, 44 28 Z"
      />
      <path className="map-stack__water" d="M40 70 C 44 72, 50 74, 56 76 L 54 80 C 48 79, 42 77, 38 75 Z" />
      <path className="map-stack__water" d="M0 95 C 25 91, 50 94, 75 91 S 95 89, 100 90 V 100 H 0 Z" />
      <path className="map-stack__road" d="M0 18 L100 30 M0 52 L100 46 M24 0 L36 100 M68 0 L62 100" />
    </svg>
  );
}

export default function MapSection() {
  const { galleries, loading } = useGalleries();
  const [seed] = useState(() => Math.random());

  const photos = useMemo(() => {
    const withPhoto = galleries.filter((g) => typeof g.image === "string" && g.image.startsWith("http"));
    return seededShuffle(withPhoto, seed).slice(0, PHOTO_COUNT);
  }, [galleries, seed]);

  // Every space with a location inside the frame, as a faint pin.
  const pins = useMemo(
    () =>
      galleries
        .map((g) => ({ id: g.id, at: project(g) }))
        .filter((p) => p.at),
    [galleries],
  );

  // The photographed spaces: a stronger pin, and a line from their print.
  const featured = photos
    .map((g, i) => ({ id: g.id, at: project(g), from: PRINT_ANCHORS[i], slot: i + 1 }))
    .filter((f) => f.at);
  const featuredIds = new Set(featured.map((f) => f.id));

  return (
    <section className="map-section" id="map">
      <div className="map-section__head">
        <p className="map-section__eyebrow">
          <span className="map-section__eyebrow-rule" aria-hidden="true" />
          04 — The map
        </p>

        <h2 className="map-section__title">
          Looking for
          <br />
          <em>directions?</em>
        </h2>

        <p className="map-section__lede">
          Every gallery, museum and cultural space in Lagos, pinned with real
          co-ordinates. Search for a space, tap a pin for the address, then let
          your phone do the rest.
        </p>
      </div>

      <Link to="/map" className="map-stack" aria-label="Explore our map">
        <MapBackground />

        {/* Every space, faint, where it really is. */}
        {pins
          .filter((p) => !featuredIds.has(p.id))
          .map((p) => (
            <span
              key={p.id}
              className="map-stack__dot"
              style={{ left: `${p.at.x}%`, top: `${p.at.y}%` }}
              aria-hidden="true"
            />
          ))}

        {/* Desktop: a dashed line from each print to its space's pin. */}
        <svg className="map-stack__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {featured.map((f) => (
            <line
              key={f.id}
              className={`map-stack__line map-stack__line--p${f.slot}`}
              x1={f.from[0]}
              y1={f.from[1]}
              x2={f.at.x}
              y2={f.at.y}
            />
          ))}
        </svg>

        {Array.from({ length: PHOTO_COUNT }, (_, i) =>
          photos[i] ? (
            <PhotoTile key={photos[i].id} space={photos[i]} slot={i + 1} />
          ) : (
            // Blank prints while the spaces load (or if too few have photos).
            <span
              key={`ph-${i}`}
              className={`map-stack__print map-stack__print--p${i + 1}`}
              aria-hidden="true"
            >
              <span className={`map-stack__photo${loading ? " is-loading" : ""}`} />
            </span>
          ),
        )}
        {/* The photographed spaces' pins: stronger, under the prints (see the SCSS). */}
        {featured.map((f) => (
          <span
            key={f.id}
            className={`map-stack__pin map-stack__pin--p${f.slot}`}
            style={{ left: `${f.at.x}%`, top: `${f.at.y}%` }}
            aria-hidden="true"
          >
            <PinIcon size={12} />
          </span>
        ))}

        <span className="map-stack__count">
          <PinIcon size={9} />
          {loading || galleries.length === 0 ? "On the map" : `${galleries.length} spaces on the map`}
        </span>
      </Link>

      <div className="map-section__cta">
        <Link to="/map" className="map-section__btn">
          Explore our map <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
