import { useState, useEffect } from "react";
import "./HeroTypographic.scss";

// ── SETUP NOTE ────────────────────────────────────────────────
// This component uses CSS custom property --navbar-h to subtract
// the navbar height from 100dvh so the ticker is always on-screen.
//
// Option A — set it globally in your index.css / App.scss:
//   :root { --navbar-h: 80px; }
//
// Option B — measure it dynamically in your Navbar component:
//   useEffect(() => {
//     const h = navRef.current?.offsetHeight ?? 80;
//     document.documentElement.style.setProperty('--navbar-h', `${h}px`);
//   }, []);
//
// The component falls back to 80px if the var is not set.
// ─────────────────────────────────────────────────────────────

// ── Data ──────────────────────────────────────────────────────
const STATS = [
  { number: "15+", label: "Galleries" },
  { number: "2",   label: "Districts" },
  { number: "6",   label: "Art Forms" },
];


const IMAGES = [
  {
    src: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgbAIluUeGJpVsBlajHVi4Q7zZwTaGO4QZLUZDkKOz91fkCLqculuZkZxsXWGK5lcO4CPa_sPJHS6PHXCxHEwuts9Zk1Tv6Kg8r989a00nNW0wH6R8JbbytNhDkqGljEHc5GzI6BQG9ex8j/s1600/Terra+kulture+lagos.JPG",
    alt: "terra kulture gallery",
  },
  {
    src: "https://sumellist.com/wp-content/uploads/2023/02/Rele_New_Gallery_Day_1-112.jpg",
    alt: "Rele gallery",
  },
  {
    src: "https://www.artmajeur.com/medias/standard/s/i/signature-beyond-art-gallery/article/1150264_untitled-12.jpg",
    alt: "signature beyound art",
  },
  {
    src: "https://africanartists.org/wp-content/uploads/Installations-Coffi-28-scaled.jpg",
    alt: "African Artists Foundation",
  },
  {
    src: "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/09/2d/c9/c2/the-national-museum.jpg?w=1200&h=-1&s=1",
    alt: "National Museum Lagos",
  },
  {
    src: "https://www.artmajeur.com/medias/standard/s/i/signature-beyond-art-gallery/article/1150264_untitled-12.jpg",
    alt: "signature beyound art",
  },

  {
    src: "https://d1rgjmn2wmqeif.cloudfront.net/extra/b/HomePageModule-40923-95830.jpg",
    alt: "Kalakuta Museum",
  },
];

const TICKER_ITEMS = [
  { title: "Studio",     place: "Yaba" },
  { title: "Exhibition", place: "Ikoyi" },
  { title: "Art Fair",   place: "Lekki" },
  { title: "Gallery",    place: "Victoria Island" },
  { title: "Museum",     place: "Lagos Island" },
  { title: "Workshop",   place: "Surulere" },
];

const TICKER_DOUBLED = [...TICKER_ITEMS, ...TICKER_ITEMS];

// ── Icons ─────────────────────────────────────────────────────
const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MapPinIcon = () => (
  <svg width="18" height="22" viewBox="0 0 18 22" fill="none" aria-hidden="true">
    <path d="M9 1C5.13 1 2 4.13 2 8c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
      fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="9" cy="8" r="2.5" fill="currentColor" />
  </svg>
);

// ── Component ─────────────────────────────────────────────────
export default function HeroTypographic() {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % IMAGES.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="ht" aria-label="Lagos Art — Hero">

      {/* ══════════════════════════════════════════════════════
          ZONE 1 — HERO BODY
          3-col grid: [sidebar] [left panel] [right panel]
          flex-grows to fill viewport minus ticker height
      ══════════════════════════════════════════════════════ */}
      <div className="ht__body">

       

        {/* ── Col B: Left Panel — all text blocks ── */}
        <div className="ht__left" aria-label="Hero content">

          {/* Eyebrow */}
          <div className="ht__eyebrow-wrap">
            <p className="ht__eyebrow">Lagos Art District</p>
          </div>

          {/* Headline */}
          <div className="ht__headline-wrap">
            <h1 className="ht__headline">
              Discover the
              <br />
              <em>galleries</em>
              <br />
              of Lagos island.
            </h1>
          </div>

          {/* Description */}
          <div className="ht__desc-wrap">
            <p className="ht__desc">
              From the landmark institutions of Victoria Island to the raw
              creative energy of Yaba — every gallery, studio and exhibition
              space, mapped and ready to explore.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="ht__cta-wrap">
            <button className="ht__btn-primary">Open Map</button>
            <button className="ht__btn-ghost">
              Browse Galleries <ArrowIcon />
            </button>
          </div>

          {/* Stats */}
          <div className="ht__stats-wrap">
            <div className="ht__stats-rule" aria-hidden="true" />
            <div className="ht__stats" role="list" aria-label="Gallery statistics">
              {STATS.map(({ number, label }) => (
                <div key={label} className="ht__stat" role="listitem">
                  <span className="ht__stat-number">{number}</span>
                  <span className="ht__stat-label">{label}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Col C: Right Panel — image carousel ── */}
        <div className="ht__right" aria-label="Gallery image carousel">

          

          {/* Carousel viewport — clips slides */}
          <div className="ht__carousel">

            {/* Slides — all stacked, active one visible */}
            <div className="ht__slides">
              {IMAGES.map((img, i) => (
                <img
                  key={i}
                  src={img.src}
                  alt={img.alt}
                  className={`ht__slide${i === activeIdx ? " ht__slide--active" : ""}`}
                  onError={(e) => {
                    // If this gallery CDN image 404s, fall back to the first (known-good) src
                    if (e.currentTarget.src !== IMAGES[0].src) {
                      e.currentTarget.src = IMAGES[0].src;
                    }
                  }}
                />
              ))}
            </div>



            {/* Progress dots */}
            <div className="ht__dots" aria-label="Go to slide">
              {IMAGES.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Slide ${i + 1}`}
                  className={`ht__dot-btn${i === activeIdx ? " ht__dot-btn--active" : ""}`}
                  onClick={() => setActiveIdx(i)}
                />
              ))}
            </div>

          </div>{/* /carousel */}
        </div>{/* /right */}

      </div>{/* /body */}

      {/* ══════════════════════════════════════════════════════
          ZONE 2 — TICKER
          Own parent container, direct flex child of .ht
          Always visible — fixed height, never grows/shrinks
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