import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "../layout/Navbar";
import Footer from "../layout/Footer";
import Contribute from "../sections/Contribute";
import { useGalleries } from "../../hooks/useGalleries";
import "./AboutPage.scss";

const VISION = [
  "Show the diversity of the arts and cultural spaces in Lagos",
  "Connect consumers with the artists, the experts and the creators",
  "Connect the whole art ecosystem, so people know what is going on and where the spaces are",
  "Spotlight the recently established, the woman-owned, and the latest exhibitions and residencies",
  "Give attention to the spaces beyond the big ones, which are usually the only ones highlighted",
];

// Contact details come from the environment, as in the footer; each line
// renders only when its value is set.
const INSTAGRAM_URL = import.meta.env.VITE_INSTAGRAM_URL;
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL;

const PHOTO_COUNT = 4;

const pad = (n) => String(n).padStart(2, "0");

/** "https://www.instagram.com/handle/" -> "@handle" */
const instagramHandle = (url) => {
  const handle = url.replace(/\/+$/, "").split("/").pop();
  return handle ? `@${handle}` : url;
};

/**
 * Spaces to show beside the vision: only ones with a photo, one per type
 * first (gallery, hub, museum...) so the mix reflects the diversity the
 * vision talks about, then topped up in list order. Deterministic, so the
 * same photos show on every visit until the data changes.
 */
// Venue types whose photos are of the place itself. Nomadic spaces have no
// building, so their images tend to be posters or graphics.
const PHOTO_TYPES = new Set(["ART_GALLERY", "HUB_INSTITUTION", "MUSEUM"]);

function pickSpaces(galleries, count) {
  const withPhoto = galleries.filter((g) => g.image && PHOTO_TYPES.has(g.type));
  const picked = [];
  const seenTypes = new Set();
  for (const g of withPhoto) {
    if (picked.length === count) break;
    if (!seenTypes.has(g.type)) {
      seenTypes.add(g.type);
      picked.push(g);
    }
  }
  for (const g of withPhoto) {
    if (picked.length === count) break;
    if (!picked.includes(g)) picked.push(g);
  }
  return picked;
}

export default function AboutPage() {
  const { galleries, loading } = useGalleries();
  const { hash } = useLocation();
  const spaces = useMemo(() => pickSpaces(galleries, PHOTO_COUNT), [galleries]);

  // Links such as /about#vision arrive from other pages (the home page's "See
  // our vision" button); scroll to the section once the page has mounted.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  const hasContact = Boolean(INSTAGRAM_URL || CONTACT_EMAIL);

  return (
    <div className="app">
      <Navbar />
      <main className="ab">
        <section className="ab-vision" id="vision" aria-labelledby="ab-vision-title">
          <header className="ab-vision__head">
            <p className="ab-eyebrow">About Art Explore</p>
            <h1 id="ab-vision-title" className="ab-vision__title">Our Vision</h1>
          </header>

          <div className="ab-vision__body">
            <ol className="ab-vision__list">
              {VISION.map((item, i) => (
                <li key={item} className="ab-vision__item">
                  <span className="ab-vision__num" aria-hidden="true">{pad(i + 1)}</span>
                  <p className="ab-vision__text">{item}</p>
                </li>
              ))}
            </ol>

            <ul className="ab-vision__photos" aria-label="Spaces on Art Explore" aria-busy={loading}>
              {loading
                ? Array.from({ length: PHOTO_COUNT }, (_, i) => (
                    <li key={i} className="ab-photo ab-photo--loading" aria-hidden="true" />
                  ))
                : spaces.map((s) => (
                    <li key={s.id} className="ab-photo">
                      <Link to={`/galleries/${s.id}`} className="ab-photo__link">
                        <img
                          src={s.image}
                          alt=""
                          width="800"
                          height="1000"
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="ab-photo__caption">
                          <span className="ab-photo__name">{s.name}</span>
                          {s.typeLabel && <span className="ab-photo__meta">{s.typeLabel}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
            </ul>
          </div>
        </section>

        {hasContact && (
          <section className="ab-contact" aria-labelledby="ab-contact-title">
            <div className="ab-contact__intro">
              <p className="ab-eyebrow ab-eyebrow--on-dark">Contact</p>
              <h2 id="ab-contact-title" className="ab-contact__title">
                Contact <em>us</em>
              </h2>
              <p className="ab-contact__lede">
                Questions, partnerships or a space we should know about? Write to
                us or follow along.
              </p>
            </div>

            <dl className="ab-contact__list">
              {INSTAGRAM_URL && (
                <div className="ab-contact__row">
                  <dt>Instagram</dt>
                  <dd>
                    <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                      {instagramHandle(INSTAGRAM_URL)}
                    </a>
                  </dd>
                </div>
              )}
              {CONTACT_EMAIL && (
                <div className="ab-contact__row">
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}

        <Contribute />
      </main>
      <Footer />
    </div>
  );
}
