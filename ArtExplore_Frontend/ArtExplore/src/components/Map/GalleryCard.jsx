// ─────────────────────────────────────────────────────────────
//  GalleryCard.jsx — Slide-in detail panel for a gallery
//  Desktop: absolute floating card (bottom-left of map wrapper)
//  Mobile:  fixed bottom sheet that slides up from screen edge
// ─────────────────────────────────────────────────────────────

import styles from './GalleryCard.module.scss';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const isOpenNow = (hours) => {
  if (!hours || !hours.length) return false;
  const today = hours[new Date().getDay()];
  if (!today) return false;
  const now = new Date();
  const [oh, om] = today.open.split(':').map(Number);
  const [ch, cm] = today.close.split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= oh * 60 + om && cur <= ch * 60 + cm;
};

const GalleryCard = ({ gallery, onClose }) => {
  const open = isOpenNow(gallery.hours);
  const todayHours = gallery.hours?.[new Date().getDay()];

  return (
    // Overlay backdrop on mobile — tap outside the sheet to dismiss
    <div className={styles.backdrop} onClick={onClose} aria-label="Close gallery detail">
      <div
        className={styles.card}
        // Stop click bubbling so tapping inside the card doesn't close it
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={gallery.name}
      >
        {/* ── Drag handle (mobile visual affordance) ────── */}
        <div className={styles.dragHandle} aria-hidden="true" />

        {/* ── Close button ─────────────────────────────── */}
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          ✕
        </button>

        {/* ── Hero image ───────────────────────────────── */}
        <div className={styles.imageWrap}>
          <img
            src={gallery.image}
            alt={gallery.name}
            className={styles.image}
            onError={(e) => {
              e.target.src =
                'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600&q=70';
            }}
          />
          <div className={styles.imageOverlay}>
            <span
              className={`${styles.openBadge} ${open ? styles.openBadgeOpen : styles.openBadgeClosed}`}
            >
              {open ? '● Open now' : '● Closed'}
            </span>
            <span
              className={`${styles.regionBadge} ${
                gallery.region === 'Island' ? styles.regionIsland : styles.regionMainland
              }`}
            >
              {gallery.region}
            </span>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────── */}
        <div className={styles.body}>
          <h3 className={styles.name}>{gallery.name}</h3>
          <p className={styles.neighbourhood}>{gallery.neighborhood}</p>
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
              <span key={type} className={styles.tag}>
                {type}
              </span>
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
      </div>
    </div>
  );
};

export default GalleryCard;