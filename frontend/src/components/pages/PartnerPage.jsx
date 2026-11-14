import { Link } from "react-router-dom";
import Navbar from "../layout/Navbar";
import Footer from "../layout/Footer";
import "./PartnerPage.scss";

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL;
const contactHref = CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}` : "/about";

const WAYS = [
  {
    num: "01",
    title: "Advertise with us",
    body: "Put your brand in front of people looking for Lagos art. Print and digital placements are available this year, or next year.",
  },
  {
    num: "02",
    title: "Get featured in our features",
    body: "Be highlighted in our editorial features, so your story reaches people exploring the guide. We are also looking at larger map tags for paying partners.",
  },
  {
    num: "03",
    title: "Connect tour guides and visitors",
    body: "We connect art tour guides with visitors, and visitors with guides, in both directions.",
  },
  {
    num: "04",
    title: "Be introduced to galleries and spaces",
    body: "Some people want an intermediary. We connect you with the galleries, owners and teams listed on the guide, and help facilitate partnerships with them.",
  },
  {
    num: "05",
    title: "Connect companies with art spaces",
    body: "For companies that want art in their own spaces, or want art lovers and clients to visit their hotel, bank or restaurant, we connect them with art spaces and galleries.",
  },
];

export default function PartnerPage() {
  return (
    <div className="app">
      <Navbar />
      <main className="pt">

        {/* Hero */}
        <section className="pt-hero" aria-labelledby="pt-hero-title">
          <p className="pt-eyebrow">Partner with Art Explore</p>
          <h1 className="pt-hero__title" id="pt-hero-title">
            Reach the people who explore <em>Lagos art.</em>
          </h1>
          <p className="pt-hero__lede">
            Art Explore maps galleries, museums and cultural spaces across Lagos.
            Partners can reach the art lovers, visitors and tour guides who use
            the guide, and get connected to the people behind the spaces.
          </p>
        </section>

        {/* Five ways */}
        <section className="pt-ways" aria-labelledby="pt-ways-title">
          <h2 className="pt-ways__title" id="pt-ways-title">
            Five ways to partner
          </h2>
          <ol className="pt-ways__list" aria-label="Five ways to partner">
            {WAYS.map((w) => (
              <li key={w.num} className="pt-ways__item">
                <span className="pt-ways__num" aria-hidden="true">{w.num}</span>
                <div className="pt-ways__body">
                  <h3 className="pt-ways__item-title">{w.title}</h3>
                  <p className="pt-ways__item-text">{w.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Next step panel */}
        <section className="pt-next" aria-labelledby="pt-next-title">
          <p className="pt-next__eyebrow">Next step</p>
          <h2 className="pt-next__title" id="pt-next-title">
            Tell us what you are looking for.
          </h2>
          <p className="pt-next__sub">
            Press, partnerships, a correction, or a question.
          </p>
          <a href={contactHref} className="pt-next__btn">
            Contact the team
          </a>
        </section>

      </main>
      <Footer />
    </div>
  );
}
