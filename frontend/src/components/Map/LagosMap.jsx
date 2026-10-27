import "./LagosMap.scss";

/**
 * Map section header — 04 in the homepage sequence.
 *
 * Addresses the visitor at the moment they actually need the map:
 * they know they want to go, they just don't know where to point
 * the car. Copy is written to that, not to the technology.
 */
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
          co-ordinates. Filter by side of the lagoon, tap a pin for the address,
          then let your phone do the rest.
        </p>
      </div>
    </section>
  );
}
