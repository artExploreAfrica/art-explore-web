import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useGalleries } from "../../hooks/useGalleries";
import "./PopularGalleries.scss";

/**
 * "Popular galleries" — a showcase of the *range* of spaces, not a
 * list of five venues.
 *
 * The earlier version was a slider of six hand-picked rooms, which
 * told a visitor nothing about what else is out there. This one is
 * organised by kind of space: pick Galleries, Museums, Hubs … and the
 * panel below shows that kind's best-known venues — one large feature
 * and up to three companions. The tab row itself carries the range
 * (each kind and how many of it exist), and the cards carry the
 * neighbourhood, so the Island/Mainland spread is visible too.
 *
 * Everything is read from the live institution list. A kind only gets
 * a tab if it has at least one venue with a photo, so it fills out on
 * its own as the data grows and never shows an empty panel.
 */

const KINDS = [
  { key: "ART_GALLERY", label: "Galleries", blurb: "Commercial rooms. Walk in, look, leave." },
  { key: "HUB_INSTITUTION", label: "Hubs & cultural spaces", blurb: "Talks, screenings and residencies under one roof." },
  { key: "MUSEUM", label: "Museums", blurb: "Permanent collections and the national archive." },
  { key: "FOUNDATION", label: "Foundations", blurb: "Programme-led, often by appointment." },
  { key: "INSTITUTE", label: "Institutes", blurb: "Teaching and research spaces that also exhibit." },
  { key: "STUDIO", label: "Studios", blurb: "Where the work is made." },
  { key: "CULTURAL_SPACE", label: "Cultural spaces", blurb: "Music, performance and craft alongside art." },
  { key: "NOMADIC_SPACE", label: "Nomadic spaces", blurb: "No fixed address; they appear for a show." },
  { key: "ART_FESTIVAL", label: "Festivals", blurb: "Dated, city-wide and temporary." },
];

// Running order inside a kind: the best-known names first. This only
// ranks venues that exist in the data; it never adds one.
const PREFERRED = [
  "Nike Art Gallery",
  "Guest Artists Space Foundation (GAS)",
  "Rele Gallery",
  "African Artists Foundation",
  "National Museum Lagos",
  "Signature Beyond",
  "Terra Kulture",
  "Kalakuta Museum",
];

const PER_KIND = 4; // 1 feature + 3 companions

const Arrow = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M2 7h10M8 3l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const initials = (name) =>
  name
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

// Rated venues first (rating is null until a review is approved),
// then the editorial list, then anything with a description, then
// the rest in a stable order.
function rank(a, b) {
  const score = (g) => {
    const pref = PREFERRED.indexOf(g.name);
    return (
      (g.rating ? 1000 + g.rating * 10 : 0) +
      (pref === -1 ? 0 : 500 - pref) +
      (g.description ? 5 : 0)
    );
  };
  return score(b) - score(a) || a.name.localeCompare(b.name);
}

function Photo({ venue }) {
  const [failed, setFailed] = useState(false);
  if (!venue.image || failed) {
    return (
      <span className="pg__ph" aria-hidden="true">
        {initials(venue.name)}
      </span>
    );
  }
  return (
    <img
      className="pg__img"
      src={venue.image}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function Place({ venue }) {
  return <>{venue.subArea || venue.neighborhood || venue.region}</>;
}

export default function PopularGalleries() {
  const { galleries, loading, error } = useGalleries();
  const [activeKey, setActiveKey] = useState(null);

  const kinds = useMemo(() => {
    return KINDS.map((k) => {
      const all = galleries.filter((g) => g.type === k.key);
      return {
        ...k,
        total: all.length,
        picks: all.filter((g) => g.image).sort(rank).slice(0, PER_KIND),
      };
    }).filter((k) => k.picks.length > 0);
  }, [galleries]);

  const total = galleries.length;

  if (loading) {
    return (
      <section className="pg" id="popular">
        <p className="pg__state">Gathering galleries…</p>
      </section>
    );
  }
  if (error) {
    return (
      <section className="pg" id="popular">
        <p className="pg__state">Couldn’t load galleries — {error}</p>
      </section>
    );
  }
  if (kinds.length === 0) return null;

  // Falls back to the first kind until the visitor picks one, and
  // if the picked kind disappears on a reload.
  const active = kinds.find((k) => k.key === activeKey) ?? kinds[0];
  const [feature, ...rest] = active.picks;

  return (
    <section className="pg" id="popular" aria-label="Popular galleries by kind of space">
      <header className="pg__head">
        <h2 className="pg__title">Popular galleries, and everything around them.</h2>
        <p className="pg__lede">
          {total} spaces across {kinds.length} kinds. Pick one to see the rooms
          people go to first.
        </p>
      </header>

      {/* Kind picker. Each tab states the kind and how many of it exist,
          which is the range at a glance. */}
      <div className="pg__tabs" role="tablist" aria-label="Kind of space">
        {kinds.map((k) => (
          <button
            key={k.key}
            id={`pg-tab-${k.key}`}
            type="button"
            role="tab"
            aria-selected={k.key === active.key}
            aria-controls="pg-panel"
            className={`pg__tab${k.key === active.key ? " pg__tab--on" : ""}`}
            onClick={() => setActiveKey(k.key)}
          >
            <span className="pg__tab-label">{k.label}</span>
            <span className="pg__tab-count">{k.total}</span>
          </button>
        ))}
      </div>

      <div
        className="pg__panel"
        id="pg-panel"
        role="tabpanel"
        aria-labelledby={`pg-tab-${active.key}`}
        // Re-keyed so the cards re-animate when the kind changes.
        key={active.key}
      >
        <p className="pg__blurb">{active.blurb}</p>

        <div className={`pg__grid${rest.length === 0 ? " pg__grid--solo" : ""}`}>
          <Link className="pg__feature" to="/galleries">
            <Photo venue={feature} />
            <span className="pg__feature-body">
              <span className="pg__kicker">
                {active.label} · <Place venue={feature} />
              </span>
              <span className="pg__name">{feature.name}</span>
              {feature.description && (
                <span className="pg__desc">{feature.description}</span>
              )}
              <span className="pg__more">
                See it in the directory <Arrow />
              </span>
            </span>
          </Link>

          {rest.map((v) => (
            <Link className="pg__mini" to="/galleries" key={v.id}>
              <span className="pg__mini-thumb">
                <Photo venue={v} />
              </span>
              <span className="pg__mini-body">
                <span className="pg__kicker">
                  <Place venue={v} />
                </span>
                <span className="pg__mini-name">{v.name}</span>
              </span>
              <span className="pg__mini-go" aria-hidden="true">
                <Arrow />
              </span>
            </Link>
          ))}
        </div>

        <Link className="pg__all" to="/galleries">
          Browse all {active.total} {active.label.toLowerCase()} <Arrow />
        </Link>
      </div>
    </section>
  );
}
