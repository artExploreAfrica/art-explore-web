import { useState, useCallback } from "react";
import "./Carousel.scss";

const items = [
  {
    id: 0,
    tag: "Exhibition Space",
    title: "Gallery",
    desc: "Where light meets canvas. The gallery presents rotating exhibitions from emerging voices and established masters of contemporary art.",
    image: "https://b2128690.smushcdn.com/2128690/wp-content/uploads/2022/10/best-art-galleries-lagos-pyramid-1920x1280.jpg?lossy=2&strip=1&webp=1",
    accent: "#c9a96e",
  },
  {
    id: 1,
    tag: "Cultural Space",
    title: "Museum",
    desc: "Wander through centuries of human history. Our museum houses artefacts, relics and wonders gathered across continents and time.",
    image: "https://tse1.mm.bing.net/th/id/OIP.bBYnRNqJAZblw4BUARbZ0QHaFj?pid=Api&h=220&P=0",
    accent: "#7eb8c9",
  },
  {
    id: 2,
    tag: "Creative Space",
    title: "Art",
    desc: "Art is the pulse of the collection. Discover paintings, installations and mixed-media works that provoke, delight and endure.",
    image: "https://tse4.mm.bing.net/th/id/OIP.sBnd05lcXSM_N1qLs14zUQHaEK?pid=Api&h=220&P=0",
    accent: "#c97e7e",
  },
  {
    id: 3,
    tag: "Workshop Space",
    title: "Studio",
    desc: "A living, working studio open to artists in residence. Witness creation in progress — raw, unfinished and utterly honest.",
    image: "https://tse4.mm.bing.net/th/id/OIP.9QiwdIv6GuA9hp_tBgfgiwHaE7?pid=Api&h=220&P=0",
    accent: "#9e9e7e",
  },
  {
    id: 4,
    tag: "Open Air Space",
    title: "Outdoor",
    desc: "Art without walls. Our outdoor space hosts sculpture, murals and site-specific installations under the open Lagos sky.",
    image: "https://images.unsplash.com/photo-1544531585-9847b68c8c86?w=800&q=80",
    accent: "#8ec9a0",
  },
];

// Distance from active: -2, -1, 0, 1, 2
// Cards stay in flex flow — only z-index and scale change. No translateX jumps.
function cardStyle(dist) {
  const abs = Math.abs(dist);
  return {
    // Negative margin pulls side cards beneath the active one
    // Left cards: push right edge under active. Right cards: push left edge under active.
    marginLeft:  dist === 0 ? 0 : dist < 0 ? 0 : -48,
    marginRight: dist === 0 ? 0 : dist > 0 ? 0 : -48,
    zIndex:      10 - abs,
    // Gentle scale — not too small, stays opaque
    transform:   `scale(${dist === 0 ? 1 : 1 - abs * 0.06})`,
    // No opacity reduction — cards stay fully visible, just behind
    opacity:     1,
    // Side cards slightly lower
    alignSelf:   dist === 0 ? "center" : "flex-end",
    marginBottom: dist === 0 ? 0 : `${abs * 10}px`,
  };
}

function Card({ item, dist, onActivate }) {
  const isActive = dist === 0;
  return (
    <article
      className={`card ${isActive ? "card--active" : ""}`}
      style={{ "--accent": item.accent, ...cardStyle(dist) }}
      tabIndex={0}
      aria-label={`${item.title}${isActive ? ", expanded" : ", hover to expand"}`}
      onMouseEnter={onActivate}
      onFocus={onActivate}
    >
      <div className="card__img-wrap">
        <img src={item.image} alt={item.title} loading="lazy" />
        {/* Overlay only on active for text legibility */}
        {isActive && <div className="card__overlay" />}
      </div>

      {/* Side card: simple bottom label */}
      {!isActive && (
        <div className="card__label">
          <p className="card__label-title">{item.title}</p>
          <p className="card__label-sub">{item.tag}</p>
        </div>
      )}

      {/* Active card: full detail */}
      {isActive && (
        <div className="card__detail">
          <span className="card__detail-tag">{item.tag}</span>
          <h3 className="card__detail-title">{item.title}</h3>
          <p className="card__detail-desc">{item.desc}</p>
          <button className="card__detail-btn" aria-label={`Explore ${item.title}`}>
            <span>Explore</span>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      <div className="card__glow" />
    </article>
  );
}

export default function Carousel() {
  const [activeId, setActiveId] = useState(2); // start on middle card

  const handleActivate = useCallback((id) => setActiveId(id), []);

  return (
    <section className="carousel" role="region" aria-label="Art spaces collection">
      <header className="carousel__header">
        <p className="carousel__eyebrow">Explore art galleries in Lagos</p>
        <h2 className="carousel__title">
          Journey through <em>the Collection</em>
        </h2>
        <p className="carousel__sub">Hover any card to explore each space</p>
      </header>

      <div className="carousel__stage" role="list">
        {items.map((item) => (
          <Card
            key={item.id}
            item={item}
            dist={item.id - activeId}
            onActivate={() => handleActivate(item.id)}
          />
        ))}
      </div>

      {/* Dot nav */}
      <div className="carousel__dots" role="tablist">
        {items.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={item.id === activeId}
            aria-label={item.title}
            className={`dot ${item.id === activeId ? "dot--active" : ""}`}
            style={{ "--accent": item.accent }}
            onClick={() => handleActivate(item.id)}
          />
        ))}
      </div>
    </section>
  );
}