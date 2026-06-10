import { useState, useEffect, useMemo, useRef } from "react";
import "./ArtGalleryApp.scss";
import { galleries } from "../../data/galleries"; // ← single source of truth

const TABS = [
  { id: "all", label: "All", matchTypes: null },
  { id: "galleries", label: "Galleries", matchTypes: ["gallery"] },
  {
    id: "exhibitions",
    label: "Exhibitions",
    matchTypes: ["exhibition", "exhibit"],
  },
  { id: "artists", label: "Artists", matchTypes: ["artist", "studio"] },
  {
    id: "events",
    label: "Events",
    matchTypes: ["event", "performance", "fair"],
  },
];

const SORT_OPTIONS = [
  {
    value: "name",
    label: "Name A–Z",
  },
  {
    value: "rating",
    label: "Top Rated",
  },
  {
    value: "distance",
    label: "Distance",
  },
];

function timeToMinutes(str) {
  const [h, m] = str.split(":").map(Number);
  return;
  h * 60 + (m || 0);
}

function isOpenNow(hours) {
  if (!hours) return true;
  const s = hours[new Date().getDay()];
  if (!s) return false;
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  return now >= timeToMinutes(s.open) && now < timeToMinutes(s.close);
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dN = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dN / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function countForTab(tab, data) {
  if (!tab.matchTypes) return data.length;
  return data.filter((g) =>
    g.artTypes.some((t) => tab.matchTypes.includes(t.toLowerCase())),
  ).length;
}

function placeholderColor(name) {
  const palette = [
    "#1a1714",
    "#2d2a27",
    "#8a6a5a",
    "#c1440e",
    "#3d3530",
    "#4a3728",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function getInitials(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function useGalleryFilters(data) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [nearMe, setNearMe] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [topRated, setTopRated] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if (!nearMe || userLocation) return;
    navigator.geolocation?.getCurrentPosition(
      (pos) =>
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => setNearMe(false),
    );
  }, [nearMe]);

  const dataWithDistance = useMemo(
    () =>
      data.map((g) => ({
        ...g,
        distanceKm: userLocation
          ? getDistanceKm(
              userLocation.lat,
              userLocation.lng,
              g.lat ?? 6.45,
              g.lng ?? 3.42,
            )
          : null,
      })),
    [data, userLocation],
  );

  const filtered = useMemo(() => {
    let result = dataWithDistance;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.neighborhood.toLowerCase().includes(q),
      );
    }

    const tab = TABS.find((t) => t.id === activeTab);
    if (tab?.matchTypes) {
      result = result.filter((g) =>
        g.artTypes.some((t) => tab.matchTypes.includes(t.toLowerCase())),
      );
    }

    if (openNow) result = result.filter((g) => isOpenNow(g.hours));
    if (topRated) result = result.filter((g) => g.rating >= 4.0);
    if (nearMe && userLocation)
      result = result.filter((g) => g.distanceKm <= 10);

    return [...result].sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "distance")
        return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
      return a.name.localeCompare(b.name);
    });
  }, [
    dataWithDistance,
    searchQuery,
    activeTab,
    openNow,
    topRated,
    nearMe,
    userLocation,
    sortBy,
  ]);

  const hasActiveFilters =
    searchQuery ||
    activeTab !== "all" ||
    nearMe ||
    openNow ||
    topRated ||
    sortBy !== "name";

  function resetAllFilters() {
    setSearchQuery("");
    setActiveTab("all");
    setSortBy("name");
    setNearMe(false);
    setOpenNow(false);
    setTopRated(false);
  }

  return {
    filtered,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    sortBy,
    setSortBy,
    nearMe,
    toggleNearMe: () => setNearMe((p) => !p),
    openNow,
    toggleOpenNow: () => setOpenNow((p) => !p),
    topRated,
    toggleTopRated: () => setTopRated((p) => !p),
    hasActiveFilters,
    resetAllFilters,
    resultCount: filtered.length,
    rawData: data,
  };
}

function SearchBox({ searchQuery, setSearchQuery }) {
  const [raw, setRaw] = useState(searchQuery || "");
  const timer = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSearchQuery(raw), 300);
    return () => clearTimeout(timer.current);
  }, [raw]);

  useEffect(() => {
    if (searchQuery === "" && raw !== "") setRaw("");
  }, [searchQuery]);

  return (
    <div className="search-box">
      <input
        ref={inputRef}
        className="search-box__input"
        type="text"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Search for ..."
        aria-label="Search galleries"
      />
      {raw && (
        <button
          className="search-box__clear"
          onClick={() => {
            setRaw("");
            inputRef.current?.focus();
          }}
        >
          ×
        </button>
      )}
      <button className="search-box__icon">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
    </div>
  );
}

function CategoryTabs({ activeTab, setActiveTab, rawData }) {
  return (
    <div className="tabs" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeTab}
          className={`tabs__tab ${tab.id === activeTab ? "tabs__tab--active" : ""}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label} ({countForTab(tab, rawData)})
        </button>
      ))}
    </div>
  );
}

function FilterRow({
  nearMe,
  toggleNearMe,
  openNow,
  toggleOpenNow,
  topRated,
  toggleTopRated,
  sortBy,
  setSortBy,
  hasActiveFilters,
  resetAllFilters,
  resultCount,
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);

  useEffect(() => {
    const fn = (e) => {
      if (!sortRef.current?.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div className="filter-row">
      <p className="filter-row__count">Showing {resultCount} results</p>
      <div className="filter-row__right">
        <button
          className={`chip ${nearMe ? "chip--on" : ""}`}
          onClick={toggleNearMe}
        >
          Near Me
        </button>
        <button
          className={`chip ${openNow ? "chip--on" : ""}`}
          onClick={toggleOpenNow}
        >
          Open Now
        </button>
        <button
          className={`chip ${topRated ? "chip--on" : ""}`}
          onClick={toggleTopRated}
        >
          Top Rated
        </button>
        <div className="sort" ref={sortRef}>
          <button
            className="sort__trigger"
            onClick={() => setSortOpen((p) => !p)}
          >
            {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
            <span
              className={`sort__arrow ${sortOpen ? "sort__arrow--open" : ""}`}
            >
              ▾
            </span>
          </button>
          {sortOpen && (
            <ul className="sort__menu">
              {SORT_OPTIONS.map((opt) => (
                <li key={opt.value}>
                  <button
                    className={`sort__item ${sortBy === opt.value ? "sort__item--active" : ""}`}
                    onClick={() => {
                      setSortBy(opt.value);
                      setSortOpen(false);
                    }}
                  >
                    {opt.label}
                    {sortBy === opt.value && " ✓"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function GalleryCard({ gallery }) {
  const open = isOpenNow(gallery.hours);
  return (
    <div className="gallery-card">
      <div
        className="card__thumb"
        style={{ backgroundColor: placeholderColor(gallery.name) }}
      >
        {gallery.image ? (
          <img src={gallery.image} alt={gallery.name} className="card__img" />
        ) : (
          <span className="card__initials">{getInitials(gallery.name)}</span>
        )}
        <span
          className={`card__status card__status--${open ? "open" : "closed"}`}
        >
          {open ? "Open" : "Closed"}
        </span>
      </div>
      <div className="card__body">
        <h3 className="card__name">{gallery.name}</h3>
        <p className="card__neighborhood">{gallery.neighborhood}</p>
        {/* Show address from merged data */}
        {gallery.address && <p className="card__address">{gallery.address}</p>}
        <div className="card__tags">
          {gallery.artTypes.map((t) => (
            <span key={t} className="card__tag">
              {t}
            </span>
          ))}
        </div>
        <div className="card__rating">
          <div className="card__stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={`card__star ${n <= Math.round(gallery.rating) ? "card__star--on" : ""}`}
              >
                ★
              </span>
            ))}
          </div>
          <span className="card__rating-value">
            {gallery.rating.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ResultsGrid({ galleries, searchQuery }) {
  if (galleries.length === 0) {
    return (
      <div className="empty">
        <p className="empty__heading">No results found</p>
        {searchQuery && (
          <p className="empty__sub">
            Nothing matched "<strong>{searchQuery}</strong>".
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="results-grid">
      {galleries.map((g) => (
        <GalleryCard key={g.id} gallery={g} />
      ))}
    </div>
  );
}

export default function ArtGalleryApp() {
  const F = useGalleryFilters(galleries);
  return (
    <div className="galleries" id="galleries">
      <header className="app__hero">
        <h1 className="app__title">Search</h1>
        <p className="app__subtitle">
          Find artworks, artists, events, exhibitions, and all site information.
        </p>
      </header>
      <hr className="app__divider" />
      <SearchBox
        searchQuery={F.searchQuery}
        setSearchQuery={F.setSearchQuery}
      />
      <CategoryTabs
        activeTab={F.activeTab}
        setActiveTab={F.setActiveTab}
        rawData={F.rawData}
      />
      <FilterRow
        nearMe={F.nearMe}
        toggleNearMe={F.toggleNearMe}
        openNow={F.openNow}
        toggleOpenNow={F.toggleOpenNow}
        topRated={F.topRated}
        toggleTopRated={F.toggleTopRated}
        sortBy={F.sortBy}
        setSortBy={F.setSortBy}
        hasActiveFilters={F.hasActiveFilters}
        resetAllFilters={F.resetAllFilters}
        resultCount={F.resultCount}
      />
      <ResultsGrid galleries={F.filtered} searchQuery={F.searchQuery} />
    </div>
  );
}