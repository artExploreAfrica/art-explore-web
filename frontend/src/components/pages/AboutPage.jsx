import { Link } from "react-router-dom";
import Navbar from "../layout/Navbar";
import Footer from "../layout/Footer";
import { useGalleries } from "../../hooks/useGalleries";
import "./AboutPage.scss";

const VISION = [
  "Show the diversity of the arts and cultural spaces in Lagos",
  "Connect consumers with the artists, the experts and the creators",
  "Connect the whole art ecosystem, so people know what is going on and where the spaces are",
  "Spotlight the recently established, the woman-owned, and the latest exhibitions and residencies",
  "Give attention to the spaces beyond the big ones, which are usually the only ones highlighted",
  "Show the nuances and the niches",
];

// No public Exhibitions page exists yet, so that card points at the
// Contribute section for now.
const FEATURES = [
  { title: "All the spaces", text: "Every art and cultural space, in one centralised place", to: "/galleries" },
  { title: "Live map view", text: "See where each space is on the map", to: { pathname: "/", hash: "#map" } },
  { title: "By type", text: "Museums, art hubs, institutions and galleries", to: "/galleries" },
  { title: "Exhibitions", text: "A list of exhibitions, highlighting those that are live", to: { pathname: "/", hash: "#contribute" } },
  { title: "Talk to an Expert", text: "Looking to learn in the art space? Art Explore can connect you, to experts or partnerships", to: { pathname: "/", hash: "#contribute" }, dark: true },
  { title: "Open source", text: "Fill in a form to submit a cultural space or a live exhibition to the database", to: { pathname: "/", hash: "#contribute" }, dark: true },
];

const IMPACT = [
  { title: "Expand the network", text: "On Instagram and LinkedIn, and on other social media platforms you recommend" },
  { title: "Celebrate", text: "The history and creativity of these spaces, the niches as well as the milestones" },
  { title: "Stay ahead of the curve", text: "Immerse yourself in the Lagos art scene" },
];

const pad =(n) => String(n).padStart(2, "0");

export default function AboutPage() {
  const { galleries, loading } = useGalleries();

  return (
    <div className="app">
      <Navbar />
      <main className="ab">
        <section className="ab-hero" aria-labelledby="ab-hero-title">
          <img
            className="ab-hero__img"
            src="/images/about/about-hero.webp"
            alt=""
            width="2500"
            height="1667"
            fetchPriority="high"
          />
          <div className="ab-hero__content">
            <p className="ab-hero__eyebrow">We&rsquo;re hiring · Contract · Lagos</p>
            <h2 id="ab-hero-title" className="ab-hero__title">Content Creator</h2>
            <p className="ab-hero__accent">Discover the art and cultural spaces in Lagos</p>
          </div>
        </section>

        <section className="ab-band ab-about" aria-labelledby="ab-about-title">
          <div className="ab-about__text">
            <header className="ab-band__head">
              <h1 id="ab-about-title" className="ab-band__title">About Art Explore</h1>
              <span className="ab-band__label">01</span>
            </header>
            <div className="ab-about__body">
              <p>
                Art Explore is a platform that connects consumers with the arts and
                cultural spaces of Lagos, Nigeria, and then Africa.
              </p>
              <p className="ab-about__accent">
                We are starting with Lagos, scaling to Nigeria, then Africa.
              </p>
            </div>
          </div>

          <figure className="ab-about__photo">
            <img
              src="/images/about/about-mural.webp"
              alt="A building covered in colourful murals in Lagos"
              width="766"
              height="1020"
              loading="lazy"
            />
            <figcaption className="ab-about__stat" aria-live="polite">
              {loading ? (
                <span className="ab-about__count ab-about__count--loading" aria-label="Loading count" />
              ) : (
                <span className="ab-about__count">{galleries.length}</span>
              )}
              <span>art and cultural spaces in the database, and counting</span>
            </figcaption>
          </figure>
        </section>

        <section className="ab-band ab-vision" aria-labelledby="ab-vision-title">
          <div className="ab-vision__photo">
            <img
              src="/images/about/about-windows.jpg"
              alt=""
              width="678"
              height="452"
              loading="lazy"
            />
          </div>
          <div className="ab-vision__content">
            <header className="ab-band__head">
              <h2 id="ab-vision-title" className="ab-band__title">Our Vision</h2>
              <span className="ab-band__label">02</span>
            </header>
            <ol className="ab-vision__grid">
              {VISION.map((item, i) => (
                <li key={item} className="ab-vision__item">
                  <span className="ab-vision__num" aria-hidden="true">{pad(i + 1)}</span>
                  <p>{item}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="ab-band ab-site" aria-labelledby="ab-site-title">
          <header className="ab-band__head">
            <h2 id="ab-site-title" className="ab-band__title">The Website</h2>
            <span className="ab-band__label">artexplore.africa</span>
          </header>
          <ul className="ab-site__grid">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <Link
                  to={f.to}
                  className={`ab-site__card${f.dark ? " ab-site__card--dark" : ""}`}
                >
                  <h3 className="ab-site__card-title">{f.title}</h3>
                  <p className="ab-site__card-text">{f.text}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="ab-band ab-impact" aria-labelledby="ab-impact-title">
          <div className="ab-impact__content">
            <header className="ab-band__head">
              <h2 id="ab-impact-title" className="ab-band__title">Where You Will Make Impact</h2>
              <span className="ab-band__label">03</span>
            </header>
            <p className="ab-impact__accent">
              Drive visibility to our website and engagement with the art and cultural
              spaces of Lagos.
            </p>
            <ul className="ab-impact__list">
              {IMPACT.map((item) => (
                <li key={item.title} className="ab-impact__item">
                  <h3 className="ab-impact__item-title">{item.title}</h3>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="ab-impact__photo">
            <img
              src="/images/about/about-impact.jpg"
              alt="A stone monument beside a reflecting pool, framed by trees"
              width="1650"
              height="2200"
              loading="lazy"
            />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
