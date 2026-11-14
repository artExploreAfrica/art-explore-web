import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useGalleries } from "../../hooks/useGalleries";
import { placeOf } from "../../lib/adapters";
import "./HeroTypographic.scss";

// ── Ticker helpers ─────────────────────────────────────────────
const TICKER_MAX = 24;
const TICKER_S_PER_ITEM = 5;
const NO_FIXED_PLACE = new Set(["NOMADIC_SPACE", "ART_FESTIVAL"]);

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

// ── Slide definitions ─────────────────────────────────────────
// accentLine: 0-based index of the line rendered in Instrument Serif Italic.
const SLIDES = [
  {
    id: "discover",
    eyebrow: "01 — Lagos Art District",
    lines: ["Discover", "Art & Cultural", "Spaces in Lagos"],
    accentLine: 2,
    desc: "From the landmark institutions of Victoria Island to the raw creative energy of Yaba — every gallery, studio and exhibition space, mapped and ready to explore.",
    cta: [
      { label: "Open Map", href: "#map", solid: true },
      { label: "Browse Spaces", to: "/galleries", solid: false, arrow: true },
    ],
    bg: "/images/hero/quintessence.jpg",
    bgPos: "50% 40%",
  },
  {
    id: "wunika",
    eyebrow: "02 — Featured Space",
    lines: ["Featured Space", "Wunika", "in Lagos"],
    accentLine: 2,
    desc: "Contemporary art, craft and culture — Wunika's creative studio is an unmissable destination at the heart of Lagos.",
    cta: [
      { label: "Visit Space", to: "/galleries", solid: true },
      { label: "All Spaces", to: "/galleries", solid: false, arrow: true },
    ],
    bg: "/images/hero/smo.jpg",
    bgPos: "50% 55%",
  },
  {
    id: "biennial",
    eyebrow: "03 — Now Showing",
    lines: ["Go Check Out", "The Biennial", "at Eko Atlantic"],
    accentLine: 2,
    desc: "The Lagos Biennial brings together artists from across Africa and the diaspora at a landmark pavilion on Eko Atlantic, Victoria Island.",
    cta: [
      { label: "Find Out More", to: "/galleries", solid: true },
      { label: "Browse Spaces", to: "/galleries", solid: false, arrow: true },
    ],
    bg: "/images/hero/tiwani.webp",
    bgPos: "50% 50%",
  },
  {
    id: "tags",
    eyebrow: "04 — Browse by Category",
    // lines and cta are built dynamically from TAG_CYCLE below
    bg: "/images/hero/ko-art-space.webp",
    bgPos: "50% 45%",
  },
];

const SLIDE_MS = 7000;

// ── Tag cycling (slide 4) ─────────────────────────────────────
const TAG_CYCLE = [
  { label: "Women-Owned",          query: "WOMEN_OWNED" },
  { label: "Recently Established", query: "RECENTLY_ESTABLISHED" },
  { label: "Classics",             query: "CLASSICS" },
  { label: "Affordable Art",       query: "AFFORDABLE_ART" },
  { label: "Children Focused",     query: "CHILDREN_FOCUSED" },
  { label: "Workshops & Classes",  query: "WORKSHOPS_CLASSES" },
];
const TAG_MS = 2600;

// ── Icons ─────────────────────────────────────────────────────
const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Component ─────────────────────────────────────────────────
export default function HeroTypographic() {
  const [slideIdx, setSlideIdx] = useState(0);
  const [tagIdx, setTagIdx] = useState(0);
  const { galleries, loading } = useGalleries();
  const ticker = useMemo(() => tickerItems(galleries), [galleries]);

  // Auto-advance content slides
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (!document.hidden) setSlideIdx((i) => (i + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => clearInterval(id);
  }, []);

  // Cycle tag labels continuously (regardless of which content slide is showing)
  useEffect(() => {
    const id = setInterval(() => setTagIdx((i) => (i + 1) % TAG_CYCLE.length), TAG_MS);
    return () => clearInterval(id);
  }, []);

  // Build the current slide's content, filling in dynamic parts for slide 4
  const tag = TAG_CYCLE[tagIdx];
  const slide = SLIDES[slideIdx];

  const lines = slideIdx === 3
    ? ["Check Out", tag.label, "Spaces in Lagos"]
    : slide.lines;

  const accentLine = slideIdx === 3 ? 1 : slide.accentLine;

  const desc = slideIdx === 3
    ? "Filter by what matters to you — Women-Owned, Affordable Art, Classics and more. Find the space that fits."
    : slide.desc;

  const cta = slideIdx === 3
    ? [
        { label: `Explore ${tag.label}`, to: `/galleries?tag=${tag.query}`, solid: true },
        { label: "All Spaces", to: "/galleries", solid: false, arrow: true },
      ]
    : slide.cta;

  return (
    <section className="ht" id="home" aria-label="Discover art and cultural spaces in Lagos">

      {/* ── Background photos (one per content slide) ── */}
      <div className="ht__slides" aria-hidden="true">
        {SLIDES.map((s, i) => (
          <img
            key={s.bg}
            className={`ht__slide${i === slideIdx ? " ht__slide--on" : ""}`}
            src={s.bg}
            alt=""
            style={{ objectPosition: s.bgPos }}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "auto"}
            decoding="async"
          />
        ))}
      </div>
      <div className="ht__wash" aria-hidden="true" />

      {/* ── Content (re-mounts on slide change to re-trigger animations) ── */}
      <div className="ht__inner" key={slideIdx}>
        <p className="ht__eyebrow">
          <span className="ht__eyebrow-rule" aria-hidden="true" />
          {slide.eyebrow}
        </p>

        <h1 className="ht__headline">
          {lines.map((line, i) => {
            // On the tags slide, give the cycling line its own key so only
            // it re-animates when the tag changes (not the whole slide).
            const lineKey = slideIdx === 3 && i === 1 ? `tag-${tagIdx}` : i;
            return (
              <span className="ht__line" key={lineKey}>
                <span
                  className={`ht__line-inner${i === accentLine ? " ht__line-inner--accent" : ""}`}
                  style={{ animationDelay: `${0.08 + i * 0.1}s` }}
                >
                  {line}
                </span>
              </span>
            );
          })}
        </h1>

        <div className="ht__meta">
          <p className="ht__desc">{desc}</p>
          <div className="ht__cta">
            {cta.map((btn) =>
              btn.href ? (
                <a key={btn.label} className={`ht__btn ht__btn--${btn.solid ? "solid" : "ghost"}`} href={btn.href}>
                  {btn.label}
                </a>
              ) : (
                <Link key={btn.label} className={`ht__btn ht__btn--${btn.solid ? "solid" : "ghost"}`} to={btn.to}>
                  {btn.label} {btn.arrow && <ArrowIcon />}
                </Link>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Slide dots ── */}
      <nav className="ht__dots" aria-label="Slide navigation">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            className={`ht__dot${i === slideIdx ? " ht__dot--on" : ""}`}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === slideIdx ? "true" : undefined}
            onClick={() => setSlideIdx(i)}
          />
        ))}
      </nav>

      {/* ── Ticker ── */}
      <div className="ht__ticker" aria-hidden="true">
        {loading ? (
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
