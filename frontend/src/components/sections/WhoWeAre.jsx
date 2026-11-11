import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useGalleries } from "../../hooks/useGalleries";
import "./WhoWeAre.scss";

/**
 * "Who are we?" — the short about section under the hero, with the
 * directory broken down by kind of space.
 *
 * The five numbers are counted from the same published list the directory
 * and the map read (useGalleries), so they cannot disagree with them and
 * follow the database on their own: nothing here is typed in by hand.
 */

// In the order briefed. `type` is the InstitutionType the count is taken from.
const KINDS = [
  {
    type: "ART_GALLERY",
    title: "Art Galleries",
    text: "Commercial rooms showing work for sale. Walk in, look, leave. No ticket.",
  },
  {
    type: "HUB_INSTITUTION",
    title: "Art Hubs/Institutions",
    text: "Mixed programmes — talks, screenings, residencies. Check what is on before you go.",
  },
  {
    type: "MUSEUM",
    title: "Museums",
    text: "Permanent collections and the national archive. Fixed hours, usually a fee.",
  },
  {
    type: "NOMADIC_SPACE",
    title: "Nomadic Spaces",
    text: "No fixed address. They appear for a show, then move on.",
  },
  {
    type: "ART_FESTIVAL",
    title: "Art Festivals",
    text: "Fairs, biennials and city-wide weekends. Dates change, so check before you go.",
  },
];

const pad = (n) => String(n).padStart(2, "0");

const Arrow = () => (
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

export default function WhoWeAre() {
  const { galleries, loading, error } = useGalleries();

  const counts = useMemo(() => {
    const byType = {};
    for (const g of galleries) byType[g.type] = (byType[g.type] ?? 0) + 1;
    return byType;
  }, [galleries]);

  return (
    <section className="ww" id="who-we-are" aria-labelledby="ww-title">
      <div className="ww__intro">
        <h2 className="ww__title" id="ww-title">
          Who are we?
        </h2>
        <p className="ww__text">
          Art Explore is a platform that connects consumers with the arts and cultural spaces of
          Lagos, Nigeria, and then Africa.
        </p>
        <p className="ww__text">We are starting with Lagos and travelling through Africa.</p>
      </div>

      <ul className="ww__cards" aria-live="polite">
        {KINDS.map((k, i) => (
          <li key={k.type}>
            <Link to="/galleries" className="ww__card">
              <span className="ww__index" aria-hidden="true">
                {pad(i + 1)}
              </span>
              {loading ? (
                <span className="ww__num ww__num--loading" aria-label="Loading count" />
              ) : error ? (
                <span className="ww__num" aria-label="Count unavailable">
                  —
                </span>
              ) : (
                <span className="ww__num">{(counts[k.type] ?? 0).toLocaleString()}</span>
              )}
              <span className="ww__name">{k.title}</span>
              <span className="ww__blurb">{k.text}</span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Every published space, whatever its type, so this stays the true total
          even if a type that has no card of its own is added. */}
      <p className="ww__total" aria-live="polite">
        Total ={" "}
        {loading ? (
          <span className="ww__total-num ww__total-num--loading" aria-label="Loading count" />
        ) : error ? (
          <strong className="ww__total-num" aria-label="Count unavailable">
            —
          </strong>
        ) : (
          <strong className="ww__total-num">{galleries.length.toLocaleString()}</strong>
        )}{" "}
        {galleries.length === 1 && !loading && !error ? "space" : "spaces"}
      </p>

      <div className="ww__more">
        <Link className="ww__btn" to={{ pathname: "/about", hash: "#vision" }}>
          See our vision <Arrow />
        </Link>
      </div>
    </section>
  );
}
