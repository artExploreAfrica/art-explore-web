import { Link } from "react-router-dom";
import { FiInstagram, FiMail } from "react-icons/fi";
import "./Footer.scss";

/**
 * Site footer, shared by every public page — one line, glanceable.
 *
 *   page (default): an ink bar in the navbar's style, in three zones —
 *                   logo far left · links + icons centred · © far right
 *                   (two short rows on phones).
 *   map:            what pro maps do — a thin translucent strip laid over the
 *                   bottom edge of the map, with the links, icons and ©.
 *                   Same zones: small logo far left, links + icons centred,
 *                   © far right.
 *
 * "Contact us" lands on the home page's contact section (/#contact); Home
 * scrolls to it once it mounts.
 */

const LINKS = [
  { label: "About", to: "/about" },
  { label: "Map", to: "/map" },
  { label: "Spaces", to: "/galleries" },
  { label: "Contact us", to: { pathname: "/", hash: "#contact" } },
];

// Site-level contact details come from the environment rather than being
// hard-coded; each icon renders only when its value is set.
//   VITE_INSTAGRAM_URL  e.g. https://www.instagram.com/<handle>
//   VITE_CONTACT_EMAIL  e.g. an address for visitors to write to
const INSTAGRAM_URL = import.meta.env.VITE_INSTAGRAM_URL;
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL;

function Social() {
  if (!INSTAGRAM_URL && !CONTACT_EMAIL) return null;
  return (
    <ul className="site-footer__social">
      {INSTAGRAM_URL && (
        <li>
          <a
            className="site-footer__social-link"
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Art Explore on Instagram"
          >
            <FiInstagram aria-hidden="true" />
          </a>
        </li>
      )}
      {CONTACT_EMAIL && (
        <li>
          <a className="site-footer__social-link" href={`mailto:${CONTACT_EMAIL}`} aria-label="Email Art Explore">
            <FiMail aria-hidden="true" />
          </a>
        </li>
      )}
    </ul>
  );
}

function Links() {
  return (
    <nav aria-label="Footer">
      <ul className="site-footer__links">
        {LINKS.map((l) => (
          <li key={l.label}>
            <Link className="site-footer__link" to={l.to}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Logo() {
  return (
    <Link to="/" className="site-footer__logo" aria-label="Art Explore — home">
      <img
        src="/brand/favicon-red.png"
        alt=""
        className="site-footer__logo-icon"
        aria-hidden="true"
        width="512"
        height="512"
      />
      <span className="site-footer__logo-text">Art Explore</span>
    </Link>
  );
}

export default function Footer({ variant = "page" }) {
  const year = new Date().getFullYear();

  if (variant === "map") {
    return (
      <footer className="site-footer site-footer--map">
        <Logo />
        <div className="site-footer__middle">
          <Links />
          <Social />
        </div>
        <p className="site-footer__legal">&copy; {year} Art Explore</p>
      </footer>
    );
  }

  return (
    <footer className="site-footer">
      <Logo />
      <div className="site-footer__middle">
        <Links />
        <Social />
      </div>
      <p className="site-footer__legal">
        &copy; {year}
        <span className="site-footer__legal-name"> Art Explore</span>
      </p>
    </footer>
  );
}
