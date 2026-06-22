import { useCallback, useState } from 'react';
import EntryPage from './EntryPage';
import CinematicReel from './Cinematicreel';
import './tokens.css';
import './EntryExperience.css';

const REEL_IMAGE_SRCS = [
  'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=1400&q=80',
  'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?w=1400&q=80',
  'https://images.unsplash.com/photo-1536924940841-227dfb32e5d5?w=1400&q=80',
  'https://images.unsplash.com/photo-1544717297-faec6c2dd1f4?w=1400&q=80',
];

function preloadImages(srcs, timeoutMs = 4000) {
  const loaders = srcs.map(
    (src) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // fall through to the reel's own fallback
        img.src = src;
      })
  );
  const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([Promise.all(loaders), timeout]);
}

/**
 * EntryExperience
 * Drop this in place of (or in front of) your main app route.
 *
 * Usage:
 *   const [entered, setEntered] = useState(false);
 *   return entered
 *     ? <MainPlatform />
 *     : <EntryExperience onComplete={() => setEntered(true)} />;
 *
 * Visitors who have already been through the intro this session skip
 * straight to onComplete — see the sessionStorage check below.
 */
export default function EntryExperience({ onComplete }) {
  const alreadySeen =
    typeof window !== 'undefined' &&
    sessionStorage.getItem('artexplore_intro_seen') === 'true';

  const [phase, setPhase] = useState(alreadySeen ? 'done' : 'entry');
  const [isLoading, setIsLoading] = useState(false);

  const handleEnter = useCallback(async () => {
    setIsLoading(true);
    await preloadImages(REEL_IMAGE_SRCS);
    setIsLoading(false);
    setPhase('reel');
  }, []);

  const handleReelFinish = useCallback(() => {
    sessionStorage.setItem('artexplore_intro_seen', 'true');
    setPhase('exiting');
    // Let the fade-out finish before handing off to the main platform
    setTimeout(() => {
      setPhase('done');
      onComplete?.();
    }, 800);
  }, [onComplete]);

  if (phase === 'done') {
    return null; // parent renders the main platform instead
  }

  return (
    <div
      className={`entry-experience ${phase === 'exiting' ? 'is-exiting' : ''}`}
    >
      {phase === 'entry' && (
        <EntryPage onEnter={handleEnter} isLoading={isLoading} />
      )}
      {(phase === 'reel' || phase === 'exiting') && (
        <CinematicReel onFinish={handleReelFinish} />
      )}
    </div>
  );
}
