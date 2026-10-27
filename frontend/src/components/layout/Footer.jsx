import { Link } from "react-router-dom";
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
