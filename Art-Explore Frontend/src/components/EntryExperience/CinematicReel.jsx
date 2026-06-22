import { useEffect, useRef, useState } from 'react';
import './CinematicReel.css';

// Swap these for images you've sourced and licensed yourself — see the
// note at the bottom of this file before shipping.
const SLIDES = [
  {
    src: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=1400&q=80',
    text: 'WELCOME',
  },
  {
    src: 'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?w=1400&q=80',
    text: 'LAGOS AWAITS',
  },
  {
    src: 'https://images.unsplash.com/photo-1536924940841-227dfb32e5d5?w=1400&q=80',
    text: 'THE GALLERIES',
  },
  {
    src: 'https://images.unsplash.com/photo-1544717297-faec6c2dd1f4?w=1400&q=80',
    text: 'Step inside.',
  },
];

const SLIDE_DURATION_MS = 1500;

/**
 * CinematicReel
 * Crossfades through SLIDES, one text overlay per image, then calls
 * onFinish. A SKIP control and a 4-segment progress bar are included
 * since this is a real fixed sequence, not decorative.
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
    if (activeIndex >= SLIDES.length) {
      onFinish();
      return;
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
      {SLIDES.map((slide, index) => (
        <div
          key={slide.src}
          className={`cinematic-reel__slide ${
            index === activeIndex ? 'is-active' : ''
          }`}
        >
          {failedSlides[index] ? (
            <div className="cinematic-reel__fallback" />
          ) : (
            <img
              src={slide.src}
              alt=""
              className="cinematic-reel__image"
              onError={() => handleImageError(index)}
              draggable={false}
            />
          )}
          <div className="cinematic-reel__scrim" />
          <p
            className={`cinematic-reel__text ${
              index === activeIndex ? 'is-active' : ''
            }`}
          >
            {slide.text}
          </p>
        </div>
      ))}

      <div className="cinematic-reel__progress" aria-hidden="true">
        {SLIDES.map((slide, index) => (
          <span
            key={slide.src}
            className={`cinematic-reel__progress-seg ${
              index <= activeIndex ? 'is-filled' : ''
            } ${index === activeIndex && !prefersReducedMotion ? 'is-active' : ''}`}
          />
        ))}
      </div>

      <button
        type="button"
        className="cinematic-reel__skip"
        onClick={handleSkip}
      >
        SKIP
      </button>
    </div>
  );
}

/*
  Note on images:
  The 4 Unsplash URLs above are generic "art gallery / exhibition" stock
  photography. They'll work as placeholders, but they read as Western
  museum interiors rather than anything specific to Lagos. Before this
  ships, swap them for images that actually feel like the platform —
  either real (licensed) photos of the galleries you're listing, or
  Unsplash searches for warmer/more specific terms (e.g. "gallery warm
  light", "sculpture closeup", "African textile") rather than literal
  "art gallery", which skews generic.
*/
