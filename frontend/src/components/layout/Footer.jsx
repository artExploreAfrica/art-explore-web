import { Link } from "react-router-dom";
import { FiInstagram, FiMail } from "react-icons/fi";
import "./Footer.scss";

/**
 * Site footer, shared by every public page.
 *
 * Links only to places that exist on the site. Section links
 * (/#map, /#contribute) land on the home page and scroll there —
 * Home handles the hash once it mounts.
 */

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { label: "About", to: "/about" },
      { label: "The map", to: { pathname: "/", hash: "#map" } },
      { label: "All galleries", to: "/galleries" },
      { label: "Add a gallery", to: { pathname: "/", hash: "#contribute" } },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Log in", to: "/login" },
      { label: "Create an account", to: "/signup" },
    ],
  },
];

// Site-level contact details come from the environment rather than being
// hard-coded; each icon renders only when its value is set.
//   VITE_INSTAGRAM_URL  e.g. https://www.instagram.com/<handle>
//   VITE_CONTACT_EMAIL  e.g. an address for visitors to write to
const INSTAGRAM_URL = import.meta.env.VITE_INSTAGRAM_URL;
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL;

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <p className="site-footer__mark">
            Art<span>Explore</span>
          </p>
          <p className="site-footer__line">
            Galleries, museums and cultural spaces across Lagos — mapped.
          </p>
          {(INSTAGRAM_URL || CONTACT_EMAIL) && (
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
                  <a
                    className="site-footer__social-link"
                    href={`mailto:${CONTACT_EMAIL}`}
                    aria-label="Email Art Explore"
                  >
                    <FiMail aria-hidden="true" />
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>

        <nav className="site-footer__nav" aria-label="Footer">
          {COLUMNS.map((col) => (
            <div className="site-footer__col" key={col.title}>
              <p className="site-footer__heading">{col.title}</p>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link className="site-footer__link" to={l.to}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="site-footer__bottom">
        <p className="site-footer__legal">
          &copy; {year} Art Explore. All rights reserved.
        </p>
        <button
          type="button"
          className="site-footer__top-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          Back to top <span aria-hidden="true">↑</span>
        </button>
      </div>
    </footer>
  );
}
