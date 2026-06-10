import "./HeroCinematic.scss";

const STATS = [
  { number: "15", label: "Galleries" },
  { number: "2",  label: "Districts" },
  { number: "6",  label: "Art Forms" },
  { number: "∞",  label: "Stories"   },
];

const ArrowIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <path
      d="M2.5 6.5h8M7 3l3.5 3.5L7 10"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function HeroCinematic() {
  return (
    <section className="hero-cinematic" aria-label="Lagos Art — Hero">

      {/* ── Background ── */}
      <div className="hero-cinematic__bg" aria-hidden="true">
        <img
          src="https://b2128690.smushcdn.com/2128690/wp-content/uploads/2022/10/best-art-galleries-lagos-pyramid-1920x1280.jpg?lossy=2&strip=1&webp=1"
          alt=""
        />
      </div>
      <div className="hero-cinematic__overlay" aria-hidden="true" />
      <div className="hero-cinematic__grain"   aria-hidden="true" />

      {/* ── Main content ── */}
      <div className="hero-cinematic__content">
        <p className="hero-cinematic__label">Lagos Art District — Est. 1970</p>

        <h1 className="hero-cinematic__headline">
          <span className="hero-cinematic__line">
            <span>Where Lagos</span>
          </span>
          <span className="hero-cinematic__line">
            <span>comes to <em>feel</em></span>
          </span>
          <span className="hero-cinematic__line">
            <span>something.</span>
          </span>
        </h1>
      </div>

      {/* ── Bottom row ── */}
      <div className="hero-cinematic__bottom">
        <p className="hero-cinematic__body">
          Navigate the city's most vital galleries, studios and cultural
          spaces — from Victoria Island's landmark institutions to the
          grassroots creative hubs reshaping the mainland.
        </p>

        <div className="hero-cinematic__actions">
          <button className="hero-cinematic__btn-primary">Open the Map</button>
          <button className="hero-cinematic__btn-ghost">
            Browse all 15 galleries
            <ArrowIcon />
          </button>
        </div>
      </div>


    </section>
  );
}
