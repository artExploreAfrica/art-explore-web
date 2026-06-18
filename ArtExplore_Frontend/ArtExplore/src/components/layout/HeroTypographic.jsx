import { useState, useEffect } from "react";
import "./HeroTypographic.scss";

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
    alt: "signature beyond art",
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

      {/* ZONE 1 — HERO BODY */}
      <div className="ht__body">

        {/* Left Panel — all text blocks */}
        <div className="ht__left" aria-label="Hero content">

          <div className="ht__eyebrow-wrap">
            <p className="ht__eyebrow">Lagos Art District</p>
          </div>

          <div className="ht__headline-wrap">
            <h1 className="ht__headline">
              Discover the
              <br />
              <em>galleries</em>
              <br />
              of Lagos island.
            </h1>
          </div>

          <div className="ht__desc-wrap">
            <p className="ht__desc">
              From the landmark institutions of Victoria Island to the raw
              creative energy of Yaba — every gallery, studio and exhibition
              space, mapped and ready to explore.
            </p>
          </div>

          <div className="ht__cta-wrap">
            <button className="ht__btn-primary">Open Map</button>
            <button className="ht__btn-ghost">
              Browse Galleries <ArrowIcon />
            </button>
          </div>

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

        {/* Right Panel — image carousel */}
        <div className="ht__right" aria-label="Gallery image carousel">
          <div className="ht__carousel">
            <div className="ht__slides">
              {IMAGES.map((img, i) => (
                <img
                  key={i}
                  src={img.src}
                  alt={img.alt}
                  className={`ht__slide${i === activeIdx ? " ht__slide--active" : ""}`}
                  onError={(e) => {
                    if (e.currentTarget.src !== IMAGES[0].src) {
                      e.currentTarget.src = IMAGES[0].src;
                    }
                  }}
                />
              ))}
            </div>

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
          </div>
        </div>

      </div>

      {/* ZONE 2 — TICKER */}
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
