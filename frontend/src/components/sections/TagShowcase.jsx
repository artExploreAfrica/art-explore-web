import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGalleries } from "../../hooks/useGalleries";
import { apiGet } from "../../lib/api";
import "./TagShowcase.scss";

/**
 * "Find your kind of space" — the home page's way in, by tag.
 *
 * It replaces the old "Popular galleries" section, which was organised by
 * type (gallery, museum, hub…). Those types still have their own tabs on the
 * directory; here the tags the team chose are the doorways:
 * Women Owned, Affordable Art, Children Focused, Workshops & Classes,
 * Recently established, Classics, Yoruba History.
 *
 * Each card is a swipeable photo. Its cover is a photo of one of the spaces
 * that carries the tag (COVER_PREFERENCE below says which, with a fallback to
 * the first tagged space that has a photo), and it opens the directory
 * filtered by that tag. A tag nobody carries yet gets no card, so the section
 * fills out as spaces are tagged in the admin and never shows an empty one.
 */

const TAGS = [
  { name: "WOMEN_OWNED", label: "Women Owned", blurb: "Galleries and hubs founded and run by women." },
  { name: "AFFORDABLE_ART", label: "Affordable Art", blurb: "Art within reach, from miniatures to paper works." },
  { name: "CHILDREN_FOCUSED", label: "Children Focused", blurb: "Where young people make, show and learn." },
  { name: "WORKSHOPS_CLASSES", label: "Workshops & Classes", blurb: "Hands-on: pottery, painting, perfume-making and more." },
  { name: "RECENTLY_ESTABLISHED", label: "Recently established", blurb: "New rooms that opened in the last few years." },
  { name: "CLASSICS", label: "Classics", blurb: "Long-standing galleries and heritage museums." },
  { name: "YORUBA_HISTORY", label: "Yoruba History", blurb: "Where Yoruba art, history and heritage live on." },
];

// Fallback covers, used until an admin picks one on the Tags page (stored as
// Tag.coverInstitutionId and read below). In order of preference; only used if
// that space carries the tag.
const COVER_PREFERENCE = {
  WOMEN_OWNED: ["Nike Art Gallery"],
  AFFORDABLE_ART: ["Ogirikan Art Gallery"],
  CHILDREN_FOCUSED: ["TCA Gallery"],
  WORKSHOPS_CLASSES: ["Olori Art Foundation"],
  RECENTLY_ESTABLISHED: ["Windsor Gallery"],
  CLASSICS: ["Treasure House Fine Arts"],
};

/**
 * The admin's choice wins — but only while it still qualifies: `spaces` is
 * already limited to published spaces carrying the tag, so a cover whose space
 * was unpublished, deleted, untagged or stripped of photos simply isn't found
 * here and the card falls back instead of breaking.
 */
function pickCover(spaces, chosenId, preferred = []) {
  const withPhoto = spaces.filter((g) => g.image);
  const chosen = chosenId && withPhoto.find((g) => g.id === chosenId);
  if (chosen) return chosen;
  for (const name of preferred) {
    const hit = withPhoto.find((g) => g.name === name);
    if (hit) return hit;
  }
  // Fall back to any space — Photo already renders initials when there's no image.
  return withPhoto[0] ?? spaces[0] ?? null;
}

const initials = (name) =>
  name
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const Chevron = ({ dir }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d={dir === "left" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function Photo({ space }) {
  const [failed, setFailed] = useState(false);
  if (!space.image || failed) {
    return (
      <span className="ts__ph" aria-hidden="true">
        {initials(space.name)}
      </span>
    );
  }
  return (
    <img
      className="ts__img"
      src={space.image}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

// Placeholder cards with the loaded cards' footprint, so nothing jumps.
function Skeleton() {
  return (
    <section className="ts" id="popular" aria-busy="true" aria-label="Browse spaces by tag">
      <p className="ts__sr">Loading galleries…</p>
      <header className="ts__head" aria-hidden="true">
        <h2 className="ts__title">Find your kind of space.</h2>
        <span className="ts__sk ts__sk--lede" />
      </header>
      <div className="ts__track" aria-hidden="true">
        {TAGS.slice(0, 4).map((t) => (
          <span key={t.name} className="ts__sk ts__sk--card" />
        ))}
      </div>
    </section>
  );
}

/**
 * Tag name → the cover space an admin chose (Tag.coverInstitutionId). Loaded
 * alongside the spaces so a card never shows one photo and then swaps to
 * another; if the request fails, the cards just use the automatic covers.
 */
function useTagCovers() {
  const [covers, setCovers] = useState({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    apiGet("/tags", { limit: 100 })
      .then((res) => {
        if (!live) return;
        const map = {};
        for (const t of res?.data ?? []) if (t.coverInstitutionId) map[t.name] = t.coverInstitutionId;
        setCovers(map);
      })
      .catch(() => {})
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);
  return { covers, loading };
}

export default function TagShowcase() {
  const { galleries, loading: galleriesLoading, error } = useGalleries();
  const { covers, loading: coversLoading } = useTagCovers();
  const loading = galleriesLoading || coversLoading;
  const trackRef = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const cards = useMemo(
    () =>
      TAGS.map((t) => {
        const spaces = galleries.filter((g) => g.tags?.some((x) => x.name === t.name));
        const cover = pickCover(spaces, covers[t.name], COVER_PREFERENCE[t.name]);
        return { ...t, count: spaces.length, cover };
      }).filter((c) => c.cover),
    [galleries, covers],
  );

  // Arrows disable at either end of the strip.
  const updateEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdge({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges, cards.length]);

  const scrollByCard = (dir) => {
    const el = trackRef.current;
    const card = el?.querySelector(".ts__card");
    if (!el || !card) return;
    const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || 0);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * step, behavior: reduced ? "auto" : "smooth" });
  };

  if (loading) return <Skeleton />;
  if (error) {
    return (
      <section className="ts" id="popular">
        <p className="ts__state">Couldn’t load galleries — {error}</p>
      </section>
    );
  }
  if (cards.length === 0) return null;

  return (
    <section className="ts" id="popular" aria-label="Browse spaces by tag">
      <header className="ts__head">
        <div>
          <h2 className="ts__title">Find your kind of space.</h2>
          <p className="ts__lede">Pick a way into Lagos art and see the spaces that fit.</p>
        </div>
        <div className="ts__arrows">
          <button type="button" className="ts__arrow" onClick={() => scrollByCard(-1)} disabled={edge.start} aria-label="Previous">
            <Chevron dir="left" />
          </button>
          <button type="button" className="ts__arrow" onClick={() => scrollByCard(1)} disabled={edge.end} aria-label="Next">
            <Chevron dir="right" />
          </button>
        </div>
      </header>

      <div className="ts__track" ref={trackRef} onScroll={updateEdges}>
        {cards.map((c) => (
          <Link key={c.name} className="ts__card" to={`/galleries?tag=${c.name}`}>
            <Photo space={c.cover} />
            <span className="ts__body">
              <span className="ts__count">
                {c.count} {c.count === 1 ? "space" : "spaces"}
              </span>
              <span className="ts__name">{c.label}</span>
              <span className="ts__blurb">{c.blurb}</span>
              <span className="ts__credit">Photo: {c.cover.name}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
