import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

const TICKER_ITEMS = [
  { title: "Studio", place: "Yaba" },
  { title: "Exhibition", place: "Ikoyi" },
  { title: "Art Fair", place: "Lekki" },
  { title: "Gallery", place: "Victoria Island" },
  { title: "Museum", place: "Lagos Island" },
  { title: "Workshop", place: "Surulere" },
];

const TICKER_DOUBLED = [...TICKER_ITEMS, ...TICKER_ITEMS];

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
        <div className="ht__ticker-track">
          {TICKER_DOUBLED.map(({ title, place }, i) => (
            <div key={i} className="ht__ticker-item">
              <strong>{title}</strong>
              <span className="ht__ticker-dot" aria-hidden="true" />
              {place}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
