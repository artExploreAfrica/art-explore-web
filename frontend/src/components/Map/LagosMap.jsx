import { Link } from "react-router-dom";
import "./LagosMap.scss";

/**
 * The map's place on the home page — 04 in the sequence.
 *
 * The interactive map now lives on its own page (/map). On phones it used to
 * fill the screen mid-page, so visitors scrolling past got stuck dragging the
 * map instead of the page. What's left here is a light teaser: the pitch, a
 * drawing of pins (no map library, nothing to swipe) and the way in.
 * The whole drawing is a link too, since it's the obvious thing to tap.
 */

// Pins scattered roughly like Lagos spaces: mainland top-left, island right.
const PINS = [
  [18, 30], [27, 44], [34, 26], [41, 52], [24, 62],
  [55, 58], [62, 48], [70, 62], [78, 54], [86, 60], [66, 70],
];

const Pin = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M0 0c-2.6-3.4-4-5.6-4-7.6a4 4 0 0 1 8 0c0 2-1.4 4.2-4 7.6z" />
    <circle cy="-7.6" r="1.4" fill="var(--cream)" />
  </g>
);

export default function MapSection() {
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

      <Link to="/map" className="map-section__preview" aria-label="Explore our map">
        <svg viewBox="0 0 100 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {/* Lagoon and coastline, loosely */}
          <path className="map-section__water" d="M0 74 C 20 66, 40 80, 60 72 S 90 64, 100 70 V80 H0z" />
          <path className="map-section__water" d="M44 40 C 52 34, 60 42, 70 38 S 86 40, 100 36 V46 C 86 50, 72 44, 60 50 S 48 46, 44 40z" />
          <g className="map-section__roads">
            <path d="M0 20 L100 34" />
            <path d="M30 0 L46 80" />
            <path d="M0 54 L100 46" />
            <path d="M72 0 L64 80" />
          </g>
          <g className="map-section__pins">
            {PINS.map(([x, y]) => <Pin key={`${x}-${y}`} x={x} y={y} />)}
          </g>
        </svg>
      </Link>

      <div className="map-section__cta">
        <Link to="/map" className="map-section__btn">
          Explore our map <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
