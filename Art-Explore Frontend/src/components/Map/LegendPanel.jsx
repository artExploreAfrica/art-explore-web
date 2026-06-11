// ─────────────────────────────────────────────────────────────
//  LegendPanel.jsx — Toggleable map legend + gallery list
//  Now accepts galleryOpen prop to hide itself on mobile when
//  the GalleryCard bottom sheet is active.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import styles from './LegendPanel.module.scss';

const LAYER_CONFIG = [
  { key: 'galleries',      label: 'Galleries',       icon: '📍', description: 'Art galleries & exhibition spaces', color: '#1a6bbd' },
  { key: 'neighbourhoods', label: 'Neighbourhoods',   icon: '🗺',  description: 'Ikoyi, VI, Lekki, Yaba, Ikeja…',   color: '#6366f1' },
  { key: 'landmarks',      label: 'Landmarks',        icon: '🏛',  description: 'Ports, museums, markets, parks',   color: '#f59e0b' },
  { key: 'greenZones',     label: 'Green Zones',      icon: '🌿', description: 'Tree-planting & drainage corridors', color: '#16a34a' },
  { key: 'regionOverlays', label: 'Region Zones',     icon: '◩',  description: 'Island / Mainland boundary shading', color: '#94a3b8' },
];

const NEIGHBOURHOOD_HUBS = [
  { name: 'Victoria Island', lng: 3.43,  lat: 6.431,  region: 'Island'   },
  { name: 'Ikoyi',           lng: 3.439, lat: 6.455,  region: 'Island'   },
  { name: 'Lekki Phase I',   lng: 3.462, lat: 6.449,  region: 'Island'   },
  { name: 'Lagos Island',    lng: 3.395, lat: 6.4555, region: 'Island'   },
  { name: 'Yaba',            lng: 3.372, lat: 6.501,  region: 'Mainland' },
  { name: 'Ikeja',           lng: 3.356, lat: 6.578,  region: 'Mainland' },
  { name: 'Surulere',        lng: 3.358, lat: 6.508,  region: 'Mainland' },
  { name: 'Apapa',           lng: 3.365, lat: 6.457,  region: 'Mainland' },
];

const LegendPanel = ({
  activeLayers,
  onToggle,
  galleries,
  onGalleryClick,
  onNeighbourhoodClick,
  activeRegion,
  galleryOpen,  // NEW: true when GalleryCard is visible on mobile
}) => {
  // On mobile, default to collapsed so it doesn't clutter the map.
  // On desktop, start expanded as before.
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('layers');

  useEffect(() => {
    if (window.innerWidth <= 768) {
      setCollapsed(true);
    }
  }, []);

  const visibleGalleries = galleries.filter(
    (g) => activeRegion === 'All' || g.region === activeRegion,
  );

  return (
    <div
      className={[
        styles.panel,
        collapsed ? styles.panelCollapsed : '',
        // On mobile: fade out + disable when GalleryCard bottom sheet is open
        galleryOpen ? styles.panelHidden : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.headerIcon}>🗺</span>
          {!collapsed && <span>Map Guide</span>}
        </div>
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand legend' : 'Collapse legend'}
        >
          {collapsed ? '◀' : '▶'}
        </button>
      </div>

      {/* ── Tabs + content ─────────────────────────────────── */}
      {!collapsed && (
        <>
          <div className={styles.tabs}>
            {['layers', 'galleries', 'areas'].map((tab) => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'layers'    && 'Layers'}
                {tab === 'galleries' && `Galleries (${visibleGalleries.length})`}
                {tab === 'areas'     && 'Areas'}
              </button>
            ))}
          </div>

          {/* Layers tab */}
          {activeTab === 'layers' && (
            <div className={styles.layersList}>
              {LAYER_CONFIG.map(({ key, label, icon, description, color }) => (
                <label key={key} className={styles.layerRow}>
                  <span className={styles.layerLeft}>
                    <span className={styles.layerDot} style={{ background: color }} />
                    <span className={styles.layerIcon}>{icon}</span>
                    <span className={styles.layerMeta}>
                      <span className={styles.layerLabel}>{label}</span>
                      <span className={styles.layerDesc}>{description}</span>
                    </span>
                  </span>
                  <div
                    className={`${styles.toggle} ${activeLayers[key] ? styles.toggleOn : ''}`}
                    onClick={() => onToggle(key)}
                    role="switch"
                    aria-checked={activeLayers[key]}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onToggle(key)}
                  />
                </label>
              ))}
              <div className={styles.zoomGuide}>
                <p className={styles.zoomGuideTitle}>Detail by zoom level</p>
                <div className={styles.zoomRow}><span className={styles.zoomLevel}>10</span><span>Region zones, ports, airport</span></div>
                <div className={styles.zoomRow}><span className={styles.zoomLevel}>12</span><span>Neighbourhood labels, landmark icons</span></div>
                <div className={styles.zoomRow}><span className={styles.zoomLevel}>14</span><span>Street detail, landmark descriptions</span></div>
              </div>
            </div>
          )}

          {/* Galleries tab */}
          {activeTab === 'galleries' && (
            <div className={styles.galleryList}>
              {visibleGalleries.length === 0 ? (
                <p className={styles.empty}>No galleries in this region.</p>
              ) : (
                visibleGalleries.map((g) => (
                  <button key={g.id} className={styles.galleryItem} onClick={() => onGalleryClick(g)}>
                    <img
                      src={g.image}
                      alt={g.name}
                      className={styles.galleryThumb}
                      onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=200&q=60'; }}
                    />
                    <div className={styles.galleryMeta}>
                      <span className={styles.galleryName}>{g.name}</span>
                      <span className={styles.galleryNeighbourhood}>{g.neighborhood}</span>
                      <span className={`${styles.galleryRegion} ${styles[`galleryRegion${g.region}`]}`}>{g.region}</span>
                    </div>
                    <span className={styles.galleryRating}>★ {g.rating}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Areas tab */}
          {activeTab === 'areas' && (
            <div className={styles.areasList}>
              <p className={styles.areasHint}>Click to fly to area</p>
              {['Island', 'Mainland'].map((region) => (
                <div key={region} className={styles.areasGroup}>
                  <div className={`${styles.areasGroupLabel} ${styles[`areasGroupLabel${region}`]}`}>{region}</div>
                  {NEIGHBOURHOOD_HUBS.filter((n) => n.region === region).map((n) => (
                    <button key={n.name} className={styles.areaBtn} onClick={() => onNeighbourhoodClick(n.lng, n.lat)}>
                      <span className={styles.areaBtnIcon}>◎</span>
                      {n.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LegendPanel;
