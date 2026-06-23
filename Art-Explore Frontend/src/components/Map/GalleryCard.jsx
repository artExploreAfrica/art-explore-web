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
//                     Shows full detail: address, stats, tags, button.
//
//  Swipe down from EXPANDED → PEEK
//  Swipe down from PEEK     → closes (calls onClose)
//  Tap backdrop             → closes
// ─────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from 'react';
import styles from './GalleryCard.module.scss';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600&q=70';

const SWIPE_THRESHOLD = 40; // px — minimum drag to trigger state change

const isOpenNow = (hours) => {
  if (!hours?.length) return false;
  const today = hours[new Date().getDay()];
  if (!today) return false;
  const [oh, om] = today.open.split(':').map(Number);
  const [ch, cm] = today.close.split(':').map(Number);
  const cur = new Date().getHours() * 60 + new Date().getMinutes();
  return cur >= oh * 60 + om && cur <= ch * 60 + cm;
};

const GalleryCard = ({ gallery, onClose }) => {
  const open        = isOpenNow(gallery.hours);
  const todayHours  = gallery.hours?.[new Date().getDay()];

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
            <span className={`${styles.openBadge} ${open ? styles.openBadgeOpen : styles.openBadgeClosed}`}>
              {open ? '● Open now' : '● Closed'}
            </span>
            <span className={`${styles.regionBadge} ${gallery.region === 'Island' ? styles.regionIsland : styles.regionMainland}`}>
              {gallery.region}
            </span>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className={styles.body}>

          {/* Badges — always visible on mobile */}
          <div className={styles.mobileBadges}>
            <span className={`${styles.openBadge} ${open ? styles.openBadgeOpen : styles.openBadgeClosed}`}>
              {open ? '● Open now' : '● Closed'}
            </span>
            <span className={`${styles.regionBadge} ${gallery.region === 'Island' ? styles.regionIsland : styles.regionMainland}`}>
              {gallery.region}
            </span>
          </div>

          {/* Name + neighbourhood — always visible */}
          <h3 className={styles.name}>{gallery.name}</h3>
          <p className={styles.neighbourhood}>{gallery.neighborhood}</p>

          {/* ── Expanded-only content ──────────────────────── */}
          <div className={`${styles.expandedContent} ${isExpanded ? styles.expandedContentVisible : ''}`}>
            <p className={styles.address}>{gallery.address}</p>

            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statValue}>★ {gallery.rating}</span>
                <span className={styles.statLabel}>Rating</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statValue}>
                  {todayHours ? `${todayHours.open}–${todayHours.close}` : '—'}
                </span>
                <span className={styles.statLabel}>Today</span>
              </div>
            </div>

            <div className={styles.tags}>
              {(gallery.artTypes || []).map((type) => (
                <span key={type} className={styles.tag}>{type}</span>
              ))}
            </div>

            <a
              className={styles.directionsBtn}
              href={`https://www.google.com/maps/search/?api=1&query=${gallery.lat},${gallery.lng}`}
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
