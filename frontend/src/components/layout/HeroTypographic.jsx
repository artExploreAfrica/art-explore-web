import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./HeroTypographic.scss";

// ─────────────────────────────────────────────────────────────
// HERO — full-screen looping slider.
//
// Each slide carries its own photograph AND its own copy. The next
// slide pushes in from the right while the current one is pushed out
// to the left (no crossfade); after the last slide it carries on to
// the first. The nav sits on top of it (see Navbar: transparent over
// the hero on desktop).
//
// Timing is driven by the progress bar's CSS animation: when the
// current bar finishes filling, the slider advances. Pausing the bar
// (hover, reduced motion) therefore pauses the slider too.
// ─────────────────────────────────────────────────────────────

const SLIDE_S = 6;   // seconds a slide stays on screen
const PUSH_S = 0.9;  // seconds the push transition takes
const SWIPE_PX = 50;

// Headline: three lines. `accent` is set in Instrument Serif Italic at
// the end of the third line.
const SLIDES = [
  {
    id: "discover",
    eyebrow: "01 — Lagos Art District",
    lines: ["Discover", "Art & Cultural", "Spaces"],
    accent: "in Lagos",
    desc: "From the landmark institutions of Victoria Island to the raw creative energy of Yaba — every gallery, studio and exhibition space, mapped and ready to explore.",
    cta: [
      { label: "Open Map", to: "/map", solid: true },
      { label: "Browse Spaces", to: "/galleries", solid: false, arrow: true },
    ],
    bg: "/images/hero/quintessence.jpg",
    bgPos: "50% 40%",
  },
  {
    id: "wunika",
    eyebrow: "02 — Featured Space",
    lines: ["Featured Space", "Wunika", ""],
    accent: "in Lagos",
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
    lines: ["Go Check Out", "The Biennial", ""],
    accent: "at Eko Atlantic",
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
    // lines, desc and cta are filled in from the tag picked for this visit
    bg: "/images/hero/ko-art-space.webp",
    bgPos: "50% 45%",
  },
];

const TAGS = [
  { label: "Women-Owned",          query: "WOMEN_OWNED" },
  { label: "Recently Established", query: "RECENTLY_ESTABLISHED" },
  { label: "Classics",             query: "CLASSICS" },
  { label: "Affordable Art",       query: "AFFORDABLE_ART" },
  { label: "Children Focused",     query: "CHILDREN_FOCUSED" },
  { label: "Workshops & Classes",  query: "WORKSHOPS_CLASSES" },
];

// One tag per page load. Works through all six in a random order before
// any repeats, and never shows the same tag twice in a row.
const TAG_BAG_KEY = "ae-hero-tag-bag";
const TAG_LAST_KEY = "ae-hero-tag-last";

function pickTag() {
  const all = TAGS.map((_, i) => i);
  try {
    const last = Number(localStorage.getItem(TAG_LAST_KEY));
    let bag = JSON.parse(localStorage.getItem(TAG_BAG_KEY) || "[]")
      .filter((i) => Number.isInteger(i) && i >= 0 && i < TAGS.length);
    if (!bag.length) bag = all.filter((i) => i !== last);
    const pick = bag[Math.floor(Math.random() * bag.length)];
    localStorage.setItem(TAG_BAG_KEY, JSON.stringify(bag.filter((i) => i !== pick)));
    localStorage.setItem(TAG_LAST_KEY, String(pick));
    return pick;
  } catch {
    return Math.floor(Math.random() * TAGS.length);
  }
}

function buildSlides(tag) {
  return SLIDES.map((s) =>
    s.id !== "tags"
      ? s
      : {
          ...s,
          lines: ["Check Out", tag.label, "Spaces"],
          accent: "in Lagos",
          desc: "Filter by what matters to you — Women-Owned, Affordable Art, Classics and more. Find the space that fits.",
          cta: [
            { label: `Explore ${tag.label}`, to: `/galleries?tag=${tag.query}`, solid: true },
            { label: "All Spaces", to: "/galleries", solid: false, arrow: true },
          ],
        }
  );
}

// ── Headline fitting ──────────────────────────────────────────
// Lines never wrap on desktop: if the longest line is wider than the
// space, the whole headline shrinks evenly (--fit < 1). On phones the
// CSS floors the size at 42px and lets a long line wrap instead.
function fitHeadlines(root) {
  root.querySelectorAll(".ht__headline").forEach((h) => {
    h.style.setProperty("--fit", "1");
    h.classList.add("ht__headline--measuring");
    const avail = h.clientWidth;
    const widest = Math.max(...[...h.querySelectorAll(".ht__line-text")].map((el) => el.offsetWidth));
    h.classList.remove("ht__headline--measuring");
    // 2% headroom so sub-pixel rounding can't tip a line into wrapping.
    const fit = widest > avail * 0.98 && widest > 0 ? (avail * 0.98) / widest : 1;
    h.style.setProperty("--fit", fit.toFixed(4));
  });
}

const ArrowIcon = ({ flip = false }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
       style={flip ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Component ─────────────────────────────────────────────────
export default function HeroTypographic() {
  const [slides] = useState(() => buildSlides(TAGS[pickTag()]));
  const n = slides.length;

  // idx: slide on screen · prev: slide being pushed out · dir: 1 = next, -1 = back
  // run: bumps on every change (restarts the progress bar)
  const [nav, setNav] = useState({ idx: 0, prev: null, dir: 1, run: 0 });
  // Paused while a mouse is over the hero or keyboard focus is inside it.
  const [paused, setPaused] = useState({ hover: false, focus: false });
  const rootRef = useRef(null);
  const touchX = useRef(null);

  const go = useCallback((target, dir) => {
    const to = ((target % n) + n) % n;
    if (to === nav.idx) return;
    // Put the incoming slide just off-screen on the side it enters from
    // and flush layout, so the render below animates it from there.
    const incoming = rootRef.current?.querySelectorAll(".ht__slide")[to];
    if (incoming) {
      incoming.style.transition = "none";
      incoming.style.visibility = "visible";
      incoming.style.transform = `translateX(${dir * 100}%)`;
      void incoming.offsetWidth;
    }
    setNav((s) => ({ idx: to, prev: s.idx, dir, run: s.run + 1 }));
  }, [n, nav.idx]);

  const next = useCallback(() => go(nav.idx + 1, 1), [go, nav.idx]);
  const prev = useCallback(() => go(nav.idx - 1, -1), [go, nav.idx]);

  // Keep every headline on its lines as the window, fonts or layout change.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const fit = () => fitHeadlines(root);
    fit();
    // Re-measure once the condensed Archivo arrives (it changes every width).
    document.fonts?.ready.then(fit);
    document.fonts?.addEventListener("loadingdone", fit);
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    return () => {
      ro.disconnect();
      document.fonts?.removeEventListener("loadingdone", fit);
    };
  }, []);

  // Keyboard: arrow keys move the slider while focus is inside the hero.
  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
  };

  // Swipe on touch screens.
  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < SWIPE_PX) return;
    if (dx < 0) next(); else prev();
  };

  const slideStyle = (i) => {
    const { idx, prev: out, dir } = nav;
    const move = `transform ${PUSH_S}s cubic-bezier(0.77, 0, 0.18, 1)`;
    if (i === idx) return { transform: "translateX(0)", transition: move, zIndex: 2, visibility: "visible" };
    if (i === out) return { transform: `translateX(${-dir * 100}%)`, transition: move, zIndex: 1, visibility: "visible" };
    return { transform: "translateX(100%)", transition: "none", zIndex: 0, visibility: "hidden" };
  };

  return (
    <section
      ref={rootRef}
      className={`ht${paused.hover || paused.focus ? " ht--paused" : ""}`}
      id="home"
      aria-roledescription="carousel"
      aria-label="Discover art and cultural spaces in Lagos"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setPaused((p) => ({ ...p, hover: true })); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setPaused((p) => ({ ...p, hover: false })); }}
      onFocus={(e) => { if (e.target.matches(":focus-visible")) setPaused((p) => ({ ...p, focus: true })); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused((p) => ({ ...p, focus: false })); }}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {slides.map((s, i) => {
        const Heading = i === 0 ? "h1" : "h2";
        const onScreen = i === nav.idx;
        return (
          <article
            key={s.id}
            className="ht__slide"
            style={slideStyle(i)}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${n}`}
            aria-hidden={!onScreen}
            inert={!onScreen}
          >
            <img
              className="ht__img"
              src={s.bg}
              alt=""
              style={{ objectPosition: s.bgPos }}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              decoding="async"
            />
            <div className="ht__wash" aria-hidden="true" />

            <div className="ht__inner">
              <p className="ht__eyebrow">
                <span className="ht__eyebrow-rule" aria-hidden="true" />
                {s.eyebrow}
              </p>

              <Heading className="ht__headline">
                {s.lines.map((line, li) => {
                  const last = li === s.lines.length - 1;
                  return (
                    <span className="ht__line" key={li}>
                      <span className="ht__line-text">
                        {line}
                        {last && (
                          <>
                            {line ? " " : ""}
                            <span className="ht__accent">{s.accent}</span>
                          </>
                        )}
                      </span>
                    </span>
                  );
                })}
              </Heading>

              <div className="ht__meta">
                <p className="ht__desc">{s.desc}</p>
                <div className="ht__cta">
                  {s.cta.map((btn) => (
                    <Link key={btn.label} className={`ht__btn ht__btn--${btn.solid ? "solid" : "ghost"}`} to={btn.to}>
                      {btn.label} {btn.arrow && <ArrowIcon />}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </article>
        );
      })}

      {/* ── Controls: counter, progress, arrows (bottom-left) ── */}
      <div className="ht__controls">
        <p className="ht__count" aria-live="polite">
          {String(nav.idx + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
        </p>
        <div className="ht__bars" role="group" aria-label="Choose slide">
          {slides.map((s, i) => (
            <button
              key={s.id}
              className="ht__bar"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === nav.idx ? "true" : undefined}
              onClick={() => go(i, i > nav.idx ? 1 : -1)}
            >
              <span className="ht__bar-track">
                {i === nav.idx ? (
                  <span
                    key={nav.run}
                    className="ht__bar-fill ht__bar-fill--run"
                    style={{ animationDuration: `${SLIDE_S}s` }}
                    onAnimationEnd={next}
                  />
                ) : (
                  <span className="ht__bar-fill" style={{ transform: `scaleX(${i < nav.idx ? 1 : 0})` }} />
                )}
              </span>
            </button>
          ))}
        </div>
        <div className="ht__arrows">
          <button className="ht__arrow" aria-label="Previous slide" onClick={prev}><ArrowIcon flip /></button>
          <button className="ht__arrow" aria-label="Next slide" onClick={next}><ArrowIcon /></button>
        </div>
      </div>

      {/* ── Scroll cue (bottom-right) ── */}
      <p className="ht__scroll" aria-hidden="true">Scroll to explore ↓</p>
    </section>
  );
}
