import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./ArtGalleryApp.scss";
import { useGalleries } from "../../hooks/useGalleries"; // ← live data from the API
import { getInitials, placeholderColor } from "../../lib/placeholder";
import { formatInstitutionType, INSTITUTION_TYPES } from "../../admin/institutionShared";

// "All" plus one tab per InstitutionType, labelled as everywhere else, then a
// "Tags" header tab. Its sub-tags (Women Owned, Classics, ...) open underneath it.
const TAGS_TAB = "tags";
const TABS = [
  { id: "all", label: "All", type: null },
  ...INSTITUTION_TYPES.map((type) => ({ id: type, label: formatInstitutionType(type), type })),
  { id: TAGS_TAB, label: "Tags", type: null },
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
  // The Tags tab counts the spaces that carry at least one real tag.
  if (tab.id === TAGS_TAB) return data.filter((g) => g.tags?.length > 0).length;
  if (!tab.type) return data.length;
  return data.filter((g) => g.type === tab.type).length;
}

// The tags actually in use, A to Z, each with how many spaces carry it.
function tagOptionsOf(data) {
  const byName = new Map();
  for (const g of data) {
    for (const t of g.tags ?? []) {
      const entry = byName.get(t.name) ?? { name: t.name, label: t.label, count: 0 };
      entry.count += 1;
      byName.set(t.name, entry);
    }
  }
  return [...byName.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function useGalleryFilters(data, { tagName = null, initialTab = "all" } = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(initialTab);
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
    if (tab?.type) result = result.filter((g) => g.type === tab.type);
    // Tags tab: every space with a real tag, or just the picked sub-tag.
    if (activeTab === TAGS_TAB) {
      result = result.filter((g) =>
        tagName ? g.tags?.some((t) => t.name === tagName) : g.tags?.length > 0,
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
    tagName,
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

function CategoryTabs({ activeTab, setActiveTab, rawData, tagOptions, activeTag, setActiveTag }) {
  const tagsOpen = activeTab === TAGS_TAB;
  return (
    <>
      <div className="tabs" role="tablist">
        {/* A type (or Tags) with no spaces yet gets no tab, unless it is the one selected. */}
        {TABS.filter(
          (tab) => tab.id === "all" || tab.id === activeTab || countForTab(tab, rawData) > 0,
        ).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeTab}
            {...(tab.id === TAGS_TAB ? { "aria-expanded": tagsOpen, "aria-controls": "sub-tags" } : {})}
            className={`tabs__tab ${tab.id === activeTab ? "tabs__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label} ({countForTab(tab, rawData)})
            {tab.id === TAGS_TAB && (
              <span className="tabs__caret" aria-hidden="true">
                ▾
              </span>
            )}
          </button>
        ))}
      </div>
      {tagsOpen && (
        <div className="subtabs" id="sub-tags" role="group" aria-label="Filter by tag">
          {tagOptions.map((tag) => (
            <button
              key={tag.name}
              type="button"
              className={`chip ${tag.name === activeTag ? "chip--on" : ""}`}
              aria-pressed={tag.name === activeTag}
              onClick={() => setActiveTag(tag.name === activeTag ? null : tag.name)}
            >
              {tag.label} ({tag.count})
            </button>
          ))}
        </div>
      )}
    </>
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
  // Real tags only, A to Z. A space with none shows no tag chip at all, so the
  // ones that carry a researched tag stand out.
  const tags = [...(gallery.tags ?? [])].sort((a, b) => a.label.localeCompare(b.label));
  return (
    <Link to={`/galleries/${gallery.id}`} className="gallery-card">
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
        {(tags.length > 0 || gallery.hasExhibition) && (
          <div className="card__tags">
            {tags.map((t) => (
              <span key={t.name} className="card__tag">
                {t.label}
              </span>
            ))}
            {gallery.hasExhibition && <span className="card__tag">Exhibition</span>}
          </div>
        )}
        {gallery.rating != null && (
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
        )}
      </div>
    </Link>
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
  const { galleries, loading, error, reload } = useGalleries();

  // /galleries?tag=WOMEN_OWNED — arrived from a homepage tag card, or picked from the
  // sub-tags under the "Tags" tab. The URL keeps the pick, so the link can be shared.
  const [params, setParams] = useSearchParams();
  const tagName = params.get("tag");
  const F = useGalleryFilters(galleries, {
    tagName,
    initialTab: tagName ? TAGS_TAB : "all",
  });
  const { setActiveTab } = F;
  useEffect(() => {
    if (tagName) setActiveTab(TAGS_TAB);
  }, [tagName, setActiveTab]);

  const setTag = (name) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (name) next.set("tag", name);
        else next.delete("tag");
        return next;
      },
      { replace: true },
    );
  // Any tab other than Tags drops the tag pick.
  const chooseTab = (id) => {
    setActiveTab(id);
    if (id !== TAGS_TAB) setTag(null);
  };
  const resetAll = () => {
    F.resetAllFilters();
    setTag(null);
  };

  const tagOptions = useMemo(() => {
    const options = tagOptionsOf(galleries);
    // A tag nobody carries yet (a shared link to it) still shows, so it can be switched off.
    if (tagName && !options.some((o) => o.name === tagName)) {
      options.push({ name: tagName, label: tagName.toLowerCase().replace(/_/g, " "), count: 0 });
    }
    return options;
  }, [galleries, tagName]);
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
        setActiveTab={chooseTab}
        rawData={F.rawData}
        tagOptions={tagOptions}
        activeTag={tagName}
        setActiveTag={setTag}
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
        resetAllFilters={resetAll}
        resultCount={F.resultCount}
      />
      {loading ? (
        <div className="empty">
          <p className="empty__heading">Loading galleries…</p>
        </div>
      ) : error ? (
        <div className="empty">
          <p className="empty__heading">Couldn't load galleries</p>
          <p className="empty__sub">{error}</p>
          <button className="empty__retry" onClick={reload}>
            Try again
          </button>
        </div>
      ) : (
        <ResultsGrid galleries={F.filtered} searchQuery={F.searchQuery} />
      )}
    </div>
  );
}