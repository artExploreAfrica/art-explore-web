import { useEffect, useRef, useState } from 'react';
import { ENTRY_OVERLAY } from './entrycopy';
import './CinematicReel.css';

// Swap these for real photos of your galleries. These Unsplash
// placeholders are generic stock and should not ship as final — see
// the note at the bottom of this file.
const IMAGES = [
  'https://d1rgjmn2wmqeif.cloudfront.net/extra/b/HomePageModule-40923-95830.jpg',
  'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/09/2d/c9/c2/the-national-museum.jpg?w=1200&h=-1&s=1',
  'https://africanartists.org/wp-content/uploads/Installations-Coffi-28-scaled.jpg',
  'https://sumellist.com/wp-content/uploads/2023/02/Rele_New_Gallery_Day_1-112.jpg',
  'https://www.artmajeur.com/medias/standard/s/i/signature-beyond-art-gallery/article/1150264_untitled-12.jpg',
  'https://africanartists.org/wp-content/uploads/Installations-Coffi-28-scaled.jpg',
];

const SLIDE_DURATION_MS = 800; // time each image is fully visible
const CROSSFADE_MS = 450; // overlap between images, also used for the
// final fade-to-black after the last image

/**
 * CinematicReel
 * Crossfades through IMAGES behind one fixed text composition. After
 * the last image, it fades to black (text stays exactly where it is)
 * and only then calls onFinish — so whatever renders next can pick up
 * on an already-black screen with no visible seam.
 *
 * Props:
 *  - onFinish: () => void
 */
export default function CinematicReel({ onFinish }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedSlides, setFailedSlides] = useState({});
  const timeoutRef = useRef(null);
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (activeIndex >= IMAGES.length) {
      // Hold on black (all slides faded out, text stays put) just long
      // enough for the fade-out transition to actually finish before
      // handing off, so there's no hard cut.
      timeoutRef.current = setTimeout(() => {
        onFinish();
      }, CROSSFADE_MS);
      return () => clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setActiveIndex((i) => i + 1);
    }, SLIDE_DURATION_MS);

    return () => clearTimeout(timeoutRef.current);
  }, [activeIndex, onFinish]);

  const handleSkip = () => {
    clearTimeout(timeoutRef.current);
    onFinish();
  };

  const handleImageError = (index) => {
    setFailedSlides((prev) => ({ ...prev, [index]: true }));
  };

  return (
    <div className="cinematic-reel">
      {IMAGES.map((src, index) => (
        <div
          key={src}
          className={`cinematic-reel__slide ${index === activeIndex ? 'is-active' : ''}`}
          style={{ transitionDuration: `${CROSSFADE_MS}ms` }}
        >
          {failedSlides[index] ? (
            <div className="cinematic-reel__fallback" />
          ) : (
            <img
              src={src}
              alt=""
              className="cinematic-reel__image"
              onError={() => handleImageError(index)}
              draggable={false}
            />
          )}
          <div className="cinematic-reel__scrim" />
        </div>
      ))}

      <div className="cinematic-reel__overlay">
        <span className="cinematic-reel__eyebrow">{ENTRY_OVERLAY.eyebrow}</span>
        <h2 className="cinematic-reel__title">{ENTRY_OVERLAY.title}</h2>
        <span className="cinematic-reel__subtitle">{ENTRY_OVERLAY.subtitle}</span>
      </div>

      <div className="cinematic-reel__progress" aria-hidden="true">
        {IMAGES.map((src, index) => (
          <span
            key={src}
            className={`cinematic-reel__progress-seg ${
              index <= activeIndex ? 'is-filled' : ''
            } ${index === activeIndex && !prefersReducedMotion ? 'is-active' : ''}`}
            style={{ animationDuration: `${SLIDE_DURATION_MS}ms` }}
          />
        ))}
      </div>

      <button type="button" className="cinematic-reel__skip" onClick={handleSkip}>
        SKIP
      </button>
    </div>
  );
}

/*
  Note on images:
  The 4 Unsplash URLs above are generic "art gallery / exhibition" stock
  photography — placeholders only. Replace IMAGES with real photography
  before this ships: actual shots of the galleries/spaces you're
  listing, or artwork close-ups supplied by your designer.
*/
