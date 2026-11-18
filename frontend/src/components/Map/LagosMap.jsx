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
 * The teaser is a collage: photos of real spaces, each with a small pin and
 * its name ("these are on the map"), around a small map tile. It's pictures
 * only — no map library, nothing to swipe — and the whole collage is one link
 * to /map, with the "Explore our map" button underneath.
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
    <figure
      className={`map-collage__tile map-collage__tile--photo map-collage__tile--p${slot}${
        state === "loading" ? " is-loading" : ""
      }`}
    >
      {state === "failed" ? (
        <span className="map-collage__ph">{initials(space.name)}</span>
      ) : (
        // Some originals are large and slow on mobile data: the tile shimmers
        // until the photo arrives, then it fades in.
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
      <figcaption className="map-collage__label">
        <PinIcon />
        <span className="map-collage__name">{space.name}</span>
        {/* "Other" just means the area is unknown — say nothing instead. */}
        {place && place !== "Other" && <span className="map-collage__place">{place}</span>}
      </figcaption>
    </figure>
  );
}

// A few small pins on a quiet map: the map as one tile among the photos.
const MAP_PINS = [
  [30, 34],
  [52, 50],
  [70, 40],
  [44, 70],
];

function MapTile() {
  return (
    <div className="map-collage__tile map-collage__tile--map" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <path className="map-collage__water" d="M0 82 C 22 74, 44 90, 64 80 S 90 72, 100 78 V100 H0z" />
        <path className="map-collage__water" d="M34 56 C 48 48, 60 60, 74 54 S 92 56, 100 52 V62 C 88 66, 74 60, 62 66 S 42 62, 34 56z" />
        <g className="map-collage__roads">
          <path d="M0 26 L100 40" />
          <path d="M28 0 L44 100" />
          <path d="M76 0 L66 100" />
        </g>
        <g className="map-collage__pins">
          {MAP_PINS.map(([x, y]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <path d="M0 0c-2-2.6-3.1-4.3-3.1-5.8a3.1 3.1 0 0 1 6.2 0c0 1.5-1.1 3.2-3.1 5.8z" />
              <circle cy="-5.8" r="1.1" fill="var(--cream)" />
            </g>
          ))}
        </g>
      </svg>
      <span className="map-collage__maptag">
        <PinIcon size={11} /> On the map
      </span>
    </div>
  );
}

export default function MapSection() {
  const { galleries, loading } = useGalleries();
  const [seed] = useState(() => Math.random());

  const photos = useMemo(() => {
    const withPhoto = galleries.filter((g) => typeof g.image === "string" && g.image.startsWith("http"));
    return seededShuffle(withPhoto, seed).slice(0, PHOTO_COUNT);
  }, [galleries, seed]);

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

      <Link to="/map" className="map-collage" aria-label="Explore our map">
        {Array.from({ length: PHOTO_COUNT }, (_, i) =>
          photos[i] ? (
            <PhotoTile key={photos[i].id} space={photos[i]} slot={i + 1} />
          ) : (
            // Placeholders while the spaces load (or if too few have photos).
            <span
              key={`ph-${i}`}
              className={`map-collage__tile map-collage__tile--p${i + 1} map-collage__tile--empty${loading ? " is-loading" : ""}`}
              aria-hidden="true"
            />
          ),
        )}
        <MapTile />
      </Link>

      <div className="map-section__cta">
        <Link to="/map" className="map-section__btn">
          Explore our map <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
