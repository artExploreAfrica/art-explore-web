import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useGalleries } from "../../hooks/useGalleries";
import { placeOf } from "../../lib/adapters";
import "./HeroTypographic.scss";

// ── SETUP NOTE ────────────────────────────────────────────────
// Reads the CSS custom property --navbar-h (published by Navbar)
// to size itself against the viewport. Falls back to 82px.
// ─────────────────────────────────────────────────────────────

// ── Data ──────────────────────────────────────────────────────
// Headline is split into lines so each can be mask-revealed
// independently on load. Keep lines short — they are set at a
// display scale and need to survive narrow viewports.
const HEADLINE = ["Discover", "Art Galleries", "in Lagos"];

// Background slides. These are real photographs of Lagos venues
// already in the repo (public/uploads/institutions), copied to
// public/images/hero. `place` names the venue in each photo.
const SLIDES = [
  { src: "/images/hero/quintessence.jpg", place: "Quintessence Gallery", pos: "50% 40%" },
  { src: "/images/hero/smo.jpg", place: "SMO Contemporary Art", pos: "50% 55%" },
  { src: "/images/hero/tiwani.webp", place: "Tiwani Contemporary", pos: "50% 50%" },
  { src: "/images/hero/ko-art-space.webp", place: "kó Art Space", pos: "50% 45%" },
  { src: "/images/hero/arthouse.jpg", place: "Arthouse Contemporary", pos: "50% 35%" },
];
const SLIDE_MS = 6000;

// Ticker: real venues from the live list, "Name · Neighbourhood".
const TICKER_MAX = 24;
const TICKER_S_PER_ITEM = 5; // keeps the scroll speed steady however many there are
// Venues without a fixed address have no neighbourhood to pair with.
const NO_FIXED_PLACE = new Set(["NOMADIC_SPACE", "ART_FESTIVAL"]);

/**
 * Venues for the ticker. Only ones with a specific neighbourhood (not just
 * "Island"/"Mainland"), best-documented first, then dealt out one
 * neighbourhood at a time so the strip moves around the city instead of
 * listing six Ikoyi galleries in a row.
 */
function tickerItems(galleries) {
  const byPlace = new Map();
  galleries
    .filter((g) => !NO_FIXED_PLACE.has(g.type))
    .map((g) => ({ g, place: placeOf(g) }))
    .filter(({ place }) => place && place !== "Island" && place !== "Mainland" && place !== "Other")
    .sort((a, b) => Number(!!b.g.image) - Number(!!a.g.image) || a.g.name.localeCompare(b.g.name))
    .forEach(({ g, place }) => {
      if (!byPlace.has(place)) byPlace.set(place, []);
      byPlace.get(place).push({ id: g.id, title: g.name, place });
    });

  const queues = [...byPlace.values()];
  const out = [];
  while (out.length < TICKER_MAX && queues.some((q) => q.length)) {
    for (const q of queues) if (q.length && out.length < TICKER_MAX) out.push(q.shift());
  }
  return out;
}

// ── Icons ─────────────────────────────────────────────────────
const ArrowIcon = () => (
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

// ── Component ─────────────────────────────────────────────────
export default function HeroTypographic() {
  const [slide, setSlide] = useState(0);
  const { galleries, loading } = useGalleries();
  const ticker = useMemo(() => tickerItems(galleries), [galleries]);

  // Autoplay. Never runs for visitors who ask for reduced motion, and
  // skips ticks while the tab is hidden so it is not cycling unseen.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      setSlide((i) => (i + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="ht" id="home" aria-label="Discover art galleries in Lagos">
      {/* BACKGROUND — image carousel under an Ink scrim.
          Decorative: the headline carries the meaning, so the
          images are aria-hidden with empty alt text. */}
      <div className="ht__slides" aria-hidden="true">
        {SLIDES.map((s, i) => (
          <img
            key={s.src}
            className={`ht__slide${i === slide ? " ht__slide--on" : ""}`}
            src={s.src}
            alt=""
            style={{ objectPosition: s.pos }}
            // The first frame blocks render so the hero is never
            // blank; the rest load as the visitor reads.
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "auto"}
            decoding="async"
          />
        ))}
      </div>
      <div className="ht__wash" aria-hidden="true" />

      {/* ══════════════════════════════════════════════════════
          ZONE 1 — MONUMENTAL TYPE
          Full-bleed. The headline is the layout; everything else
          is subordinate to it.
      ══════════════════════════════════════════════════════ */}
      <div className="ht__inner">
        <p className="ht__eyebrow">
          <span className="ht__eyebrow-rule" aria-hidden="true" />
          01 — Lagos Art District
        </p>

        <h1 className="ht__headline">
          {HEADLINE.map((line, i) => (
            // Each line gets a clipping mask so the text can slide
            // up from beneath its own baseline on load.
            <span className="ht__line" key={line}>
              <span className="ht__line-inner" style={{ animationDelay: `${0.1 + i * 0.12}s` }}>
                {line}
              </span>
            </span>
          ))}
        </h1>

        <div className="ht__meta">
          <p className="ht__desc">
            From the landmark institutions of Victoria Island to the raw creative energy of
            Yaba — every gallery, studio and exhibition space, mapped and ready to explore.
          </p>

          <div className="ht__cta">
            <a className="ht__btn ht__btn--solid" href="#map">
              Open Map
            </a>
            <Link className="ht__btn ht__btn--ghost" to="/galleries">
              Browse Galleries <ArrowIcon />
            </Link>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ZONE 2 — TICKER
          Fixed height, always on screen.
      ══════════════════════════════════════════════════════ */}
      <div className="ht__ticker" aria-hidden="true">
        {loading ? (
          // Still placeholders until the venues arrive; nothing scrolls yet.
          <div className="ht__ticker-track ht__ticker-track--loading">
            {[180, 120, 210, 150, 190, 130].map((w, i) => (
              <span key={i} className="ht__ticker-sk" style={{ width: w }} />
            ))}
          </div>
        ) : (
          ticker.length > 0 && (
            <div
              className="ht__ticker-track"
              style={{ "--ticker-duration": `${ticker.length * TICKER_S_PER_ITEM}s` }}
            >
              {/* Two copies: the track scrolls by half its width and loops. */}
              {[...ticker, ...ticker].map(({ id, title, place }, i) => (
                <div key={`${id}-${i}`} className="ht__ticker-item">
                  <strong>{title}</strong>
                  <span className="ht__ticker-dot" aria-hidden="true" />
                  {place}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </section>
  );
}
