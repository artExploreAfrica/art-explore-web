import './HeroEditorial.scss';

// ─────────────────────────────────────────────────────────────
//  DATA — update content here without touching layout
// ─────────────────────────────────────────────────────────────

const STATS = [
  { number: '15+', label: 'Galleries' },
  { number: '2', label: 'Districts' },
  { number: '6', label: 'Art Forms' },
];

// moving ticker elements
const TICKER_ITEMS = [
  { title: 'Gallery', place: 'Victoria Island' },
  { title: 'Museum', place: 'Lagos Island' },
  { title: 'Studio', place: 'Yaba' },
  { title: 'Exhibition', place: 'Ikoyi' },
  { title: 'Art Fair', place: 'Lekki' },
];

const TICKER_DOUBLED = [...TICKER_ITEMS, ...TICKER_ITEMS];

// ─────────────────────────────────────────────────────────────
//  ICONS
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
//  DOM TREE (read as a size map)
//
//  .he                           100vw × (100dvh − navbar)
//  └── .he__grid                 100% × 100%  [grid: 50% | 50%]
//      │
//      ├── .he__left             50vw × 100%  [flex column]
//      │   ├── .he__content      50vw × (100% − 64px ticker)  [flex col, space-between]
//      │   │   ├── .he__eyebrow-wrap
//      │   │   ├── .he__headline-wrap
//      │   │   ├── .he__body-wrap
//      │   │   ├── .he__cta-wrap
//      │   │   └── .he__stats-wrap   ← pinned to bottom of content via margin-top:auto
//      │   └── .he__ticker       50vw × 64px  [fixed, never grows]
//      │
//      └── .he__right            50vw × 100%  [position:relative]
//          ├── .he__image        100% × 100%  [absolute, object-fit:cover]
//          ├── .he__overlay      100% × 100%  [absolute, z:2, decorative]
//          ├── .he__img-tag                   [absolute, top-left]
//          └── .he__img-caption              [absolute, bottom-left]
//
//  Mobile ≤ 760px:
//    grid collapses to 1 column
//    .he__right → row 1  (image on top, 56vw tall)
//    .he__left  → row 2  (all text below)
// ─────────────────────────────────────────────────────────────

export default function HeroEditorial() {
  return (
    // ROOT — full viewport section
    <section className="he" aria-label="Lagos Art — Hero">
      {/* GRID — strict 50 / 50 split, no sidebar */}
      <div className="he__grid">
        {/* ── LEFT 50% ─────────────────────────────────────────
            Outer shell: no padding (ticker must reach edges).
            Inner content: padding lives here, space-between
            pushes stats to the bottom of the content zone.
        */}
        <div className="he__left">
          <div className="he__content">
            {/* Top group — kept together so space-between pushes
                the whole block up and stats sink to the bottom  */}
            <div className="he__top-group">
              <div className="he__eyebrow-wrap">
                <p className="he__eyebrow">Lagos Art District</p>
              </div>

              <div className="he__headline-wrap">
                <h1 className="he__headline">
                  Discover the
                  <br />
                  <em>galleries</em>
                  <br />
                  of Lagos Island
                </h1>
              </div>

              <div className="he__body-wrap">
                <p className="he__body-text">
                  An editorial guide to Lagos's most vital art spaces — from the landmark galleries
                  of Victoria Island to the emerging studios reshaping Yaba and beyond.
                </p>
              </div>

              <div className="he__cta-wrap">
                <button className="he__btn-primary">Explore the Map</button>
                <button className="he__btn-ghost">
                  View all galleries <ArrowIcon />
                </button>
              </div>
            </div>
            {/* /he__top-group */}

            {/* Stats — floated to bottom of content by space-between */}
            <div className="he__stats-wrap">
              <div className="he__stats-rule" aria-hidden="true" />
              <div className="he__stats">
                {STATS.map(({ number, label }) => (
                  <div key={label} className="he__stat">
                    <span className="he__stat-number">{number}</span>
                    <span className="he__stat-label">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* /he__content */}

          {/* TICKER — outside content, no padding, edge-to-edge */}
          <div className="he__ticker" aria-hidden="true">
            <div className="he__ticker-track">
              {TICKER_DOUBLED.map(({ title, place }, i) => (
                <div key={i} className="he__ticker-item">
                  <strong>{title}</strong>
                  <span className="he__ticker-sep" aria-hidden="true" />
                  {place}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* /he__left */}

        {/* ── RIGHT 50% ────────────────────────────────────────
            Image fills every pixel. Overlays use absolute.
        */}
        <div className="he__right">
          <img
            src="https://b2128690.smushcdn.com/2128690/wp-content/uploads/2022/10/best-art-galleries-lagos-pyramid-1920x1280.jpg?lossy=2&strip=1&webp=1"
            alt="Lagos gallery interior"
            className="he__image"
            onError={(e) => {
              e.currentTarget.style.opacity = '0';
            }}
          />

          <div className="he__overlay" aria-hidden="true" />
          <span className="he__img-tag">Current Exhibition</span>
          <span className="he__img-caption">Victoria Island, Lagos</span>
        </div>
        {/* /he__right */}
      </div>
      {/* /he__grid */}
    </section>
  );
}
