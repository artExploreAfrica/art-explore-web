// ─────────────────────────────────────────────────────────────
//  GalleryCard.jsx — Gallery detail panel
//  Desktop: absolute floating card anchored bottom-left of map
//  Mobile:  fixed bottom sheet with two states:
//
//  PEEK  (~20vh) — opens automatically when a pin is tapped.
//                  Shows badge + name + neighbourhood + chevron.
//                  Marker is fully visible above.
//
//  EXPANDED (~48vh) — user swipes up or taps chevron.
//                     Shows the space's context: about, address, hours,
//                     links, tags and directions.
//
//  Swipe down from EXPANDED → PEEK
//  Swipe down from PEEK     → closes (calls onClose)
//  Tap backdrop             → closes
// ─────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from 'react';
import styles from './GalleryCard.module.scss';
import { placeOf } from '../../lib/adapters';
import { formatInstitutionType, formatOpeningHours } from '../../admin/institutionShared';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600&q=70';

const SWIPE_THRESHOLD = 40; // px — minimum drag to trigger state change

// Sub-types that just restate the type ("Art Gallery · Art Gallery") aren't shown.
const subTypeLabel = (g) =>
  g.subType && g.subType !== g.type ? formatInstitutionType(g.subType) : null;

const withScheme = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

// Stored as "@handle", a bare handle, or occasionally a full URL.
const instagramUrl = (value) => {
  const v = value.trim().replace(/^@/, '');
  return /^https?:\/\//i.test(v) ? v : `https://www.instagram.com/${v.replace(/\/$/, '')}`;
};

const GalleryCard = ({ gallery, onClose }) => {
  const kicker = [gallery.typeLabel, subTypeLabel(gallery)].filter(Boolean).join(' · ');
  const hours = formatOpeningHours(gallery.openingHours);
  // The venue's own Google Maps link beats a raw coordinate search.
  const directions =
    gallery.mapUrl || `https://www.google.com/maps/search/?api=1&query=${gallery.lat},${gallery.lng}`;

  // Mobile sheet state: 'peek' | 'expanded'
  const [sheetState, setSheetState] = useState('peek');

  // Touch tracking refs — no re-render needed
  const touchStartY  = useRef(null);
  const touchStarted = useRef(false);

  // ── Touch handlers ──────────────────────────────────────────
  const handleTouchStart = useCallback((e) => {
    touchStartY.current  = e.touches[0].clientY;
    touchStarted.current = true;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (!touchStarted.current) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    touchStarted.current = false;

    if (Math.abs(delta) < SWIPE_THRESHOLD) return; // too small — ignore

    if (delta > 0) {
      // Swiped UP → expand
      setSheetState('expanded');
    } else {
      // Swiped DOWN
      if (sheetState === 'expanded') {
        setSheetState('peek');
      } else {
        onClose(); // already peeked, swipe down closes
      }
    }
  }, [sheetState, onClose]);

  const handleChevronClick = useCallback(() => {
    setSheetState((s) => (s === 'peek' ? 'expanded' : 'peek'));
  }, []);

  const isExpanded = sheetState === 'expanded';

  return (
    <>
      {/*
        .backdrop and .card are DOM SIBLINGS — never nested.
        Backdrop covers only the sheet zone so the map above stays tappable.
        Its height tracks the current sheet state.
      */}
      <div
        className={styles.backdrop}
        data-state={sheetState}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`${styles.card} ${styles[`card--${sheetState}`]}`}
        role="dialog"
        aria-modal="true"
        aria-label={gallery.name}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── Drag handle + chevron row ─────────────────────── */}
        <div className={styles.handleRow}>
          <div className={styles.dragHandle} aria-hidden="true" />
          <button
            className={styles.chevronBtn}
            onClick={handleChevronClick}
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            <span className={`${styles.chevron} ${isExpanded ? styles.chevronDown : styles.chevronUp}`}>
              ›
            </span>
          </button>
        </div>

        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          ✕
        </button>

        {/* ── Hero image — desktop only ─────────────────────── */}
        <div className={styles.imageWrap}>
          <img
            src={gallery.image}
            alt={gallery.name}
            className={styles.image}
            onError={(e) => { e.target.src = FALLBACK_IMAGE; }}
          />
          <div className={styles.imageOverlay}>
            <span className={`${styles.regionBadge} ${gallery.region === 'Island' ? styles.regionIsland : styles.regionMainland}`}>
              {gallery.region}
            </span>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className={styles.body}>

          {/* Badges — always visible on mobile */}
          <div className={styles.mobileBadges}>
            <span className={`${styles.regionBadge} ${gallery.region === 'Island' ? styles.regionIsland : styles.regionMainland}`}>
              {gallery.region}
            </span>
          </div>

          {/* Type, name + neighbourhood — always visible */}
          <p className={styles.kicker}>{kicker}</p>
          <h3 className={styles.name}>{gallery.name}</h3>
          <p className={styles.neighbourhood}>{placeOf(gallery)}</p>

          {/* ── Expanded-only content ──────────────────────── */}
          <div className={`${styles.expandedContent} ${isExpanded ? styles.expandedContentVisible : ''}`}>
            {gallery.description && <p className={styles.description}>{gallery.description}</p>}

            {gallery.address && <p className={styles.address}>{gallery.address}</p>}

            {hours.length > 0 && (
              <dl className={styles.hours}>
                {hours.map((row) => (
                  <div key={row.label} className={styles.hoursRow}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {(gallery.website || gallery.instagram || gallery.phone) && (
              <div className={styles.links}>
                {gallery.website && (
                  <a href={withScheme(gallery.website)} target="_blank" rel="noopener noreferrer">
                    Website ↗
                  </a>
                )}
                {gallery.instagram && (
                  <a href={instagramUrl(gallery.instagram)} target="_blank" rel="noopener noreferrer">
                    Instagram ↗
                  </a>
                )}
                {gallery.phone && <a href={`tel:${gallery.phone.replace(/[^\d+]/g, '')}`}>{gallery.phone}</a>}
              </div>
            )}

            {(gallery.hasExhibition || gallery.hasResidency) && (
              <div className={styles.tags}>
                {gallery.hasExhibition && <span className={styles.tag}>Exhibition on view</span>}
                {gallery.hasResidency && <span className={styles.tag}>Artist residency</span>}
              </div>
            )}

            <a
              className={styles.directionsBtn}
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Directions ↗
            </a>
          </div>

          {/* Peek hint — only shown in peek state */}
          {!isExpanded && (
            <p className={styles.peekHint} onClick={handleChevronClick}>
              Tap for details ↑
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default GalleryCard;
