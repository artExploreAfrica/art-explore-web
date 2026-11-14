import { Link } from "react-router-dom";
import "./PartnerBand.scss";

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL;
const contactHref = CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}` : "/about";

const Arrow = () => (
  <svg
    className="pb__arrow-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M2 8h12M10 4l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function PartnerBand() {
  return (
    <section className="pb" id="contribute" aria-labelledby="pb-title">
      <h2 className="pb__title" id="pb-title">
        Help us map <em>Lagos art.</em>
      </h2>
      <p className="pb__lede">
        Partner with us, learn more, or add a space to the guide.
      </p>

      <div className="pb__panel">
        <h3 className="pb__subhead">What brings you here?</h3>

        {/* A — Full-width dark band → /partner */}
        <Link to="/partner" className="pb__band">
          <span className="pb__band-letter" aria-hidden="true">A</span>
          <div className="pb__band-body">
            <span className="pb__band-title">Partner with Art Explore</span>
            <span className="pb__band-text">
              Advertise, get featured, or connect with galleries and tour guides.
            </span>
          </div>
          <span className="pb__band-go" aria-hidden="true">
            <Arrow />
          </span>
        </Link>

        {/* B + C — Two cards */}
        <div className="pb__cards">
          <Link to="/about" className="pb__card">
            <span className="pb__card-letter" aria-hidden="true">B</span>
            <span className="pb__card-title">Learn more</span>
            <span className="pb__card-text">
              See how the guide comes together.
            </span>
            <span className="pb__card-go" aria-hidden="true">
              <Arrow />
            </span>
          </Link>

          <Link to="/about#contribute" className="pb__card">
            <span className="pb__card-letter" aria-hidden="true">C</span>
            <span className="pb__card-title">Add a cultural space</span>
            <span className="pb__card-text">
              Put your space on the map.
            </span>
            <span className="pb__card-go" aria-hidden="true">
              <Arrow />
            </span>
          </Link>
        </div>

        <p className="pb__footer">
          Press, a correction, or a question?{" "}
          <a href={contactHref} className="pb__footer-link">
            Contact the team
          </a>
        </p>
      </div>
    </section>
  );
}
