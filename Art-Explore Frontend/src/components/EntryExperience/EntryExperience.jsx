import { useCallback, useEffect, useState } from 'react';
import EntryPage from './EntryPage';
import CinematicReel from './CinematicReel';
import LoadingScreen from './LoadingScreen';
import './tokens.css';
import './EntryExperience.css';

const REEL_IMAGE_SRCS = [
  'https://d1rgjmn2wmqeif.cloudfront.net/extra/b/HomePageModule-40923-95830.jpg',
  'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/09/2d/c9/c2/the-national-museum.jpg?w=1200&h=-1&s=1',
  'https://africanartists.org/wp-content/uploads/Installations-Coffi-28-scaled.jpg',
  'https://sumellist.com/wp-content/uploads/2023/02/Rele_New_Gallery_Day_1-112.jpg',
  'https://www.artmajeur.com/medias/standard/s/i/signature-beyond-art-gallery/article/1150264_untitled-12.jpg',
  'https://africanartists.org/wp-content/uploads/Installations-Coffi-28-scaled.jpg',
];

// How long the text holds on black after the reel, before fading into
// the platform — a deliberate calm pause, not a rushed handoff.
const MIN_LOADING_MS = 4000;
// Safety net: finish anyway after this long, even if isReady never
// becomes true (e.g. a bug elsewhere) — visitors should never get stuck.
const MAX_LOADING_MS = 9000;
// How long the final fade-to-platform transition takes (must match
// the CSS transition duration on .entry-experience in EntryExperience.css).
// Kept slow and smooth on purpose — this is the "not in a hurry" cut.
const EXIT_FADE_MS = 1400;

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
 *
 * IMPORTANT — mount this ALONGSIDE your main platform, not in place of
 * it, so the platform can load underneath while this covers the screen:
 *
 *   function App() {
 *     const [showIntro, setShowIntro] = useState(true);
 *     const [platformReady, setPlatformReady] = useState(false);
 *
 *     return (
 *       <>
 *         <MainPlatform onReady={() => setPlatformReady(true)} />
 *         {showIntro && (
 *           <EntryExperience
 *             isReady={platformReady}
 *             onComplete={() => setShowIntro(false)}
 *           />
 *         )}
 *       </>
 *     );
 *   }
 *
 * If your MainPlatform has no "ready" signal to give you yet, just
 * omit the isReady prop — it defaults to true and the black loading
 * screen will simply hold for MIN_LOADING_MS before fading out.
 *
 * Props:
 *  - onComplete: () => void   called once the whole experience is done
 *  - isReady: boolean         optional. Pass true once your real page
 *                             content has finished loading underneath.
 */
export default function EntryExperience({ onComplete, isReady = true }) {
  const alreadySeen =
    typeof window !== 'undefined' &&
    sessionStorage.getItem('artexplore_intro_seen') === 'true';

  const [phase, setPhase] = useState(alreadySeen ? 'done' : 'entry');
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  const handleEnter = useCallback(async () => {
    setIsLoadingImages(true);
    await preloadImages(REEL_IMAGE_SRCS);
    setIsLoadingImages(false);
    setPhase('reel');
  }, []);

  const finishExperience = useCallback(() => {
    sessionStorage.setItem('artexplore_intro_seen', 'true');
    setPhase('exiting');
    setTimeout(() => {
      setPhase('done');
      onComplete?.();
    }, EXIT_FADE_MS);
  }, [onComplete]);

  const handleReelFinish = useCallback(() => {
    setPhase('loading');
  }, []);

  // While in the loading bridge: start the minimum-dwell timer and the
  // safety-net timer.
  useEffect(() => {
    if (phase !== 'loading') return;
    setMinTimeElapsed(false);

    const minTimer = setTimeout(() => setMinTimeElapsed(true), MIN_LOADING_MS);
    const maxTimer = setTimeout(() => finishExperience(), MAX_LOADING_MS);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, [phase, finishExperience]);

  // Finish as soon as BOTH the minimum dwell time has passed AND the
  // real platform reports itself ready.
  useEffect(() => {
    if (phase === 'loading' && minTimeElapsed && isReady) {
      finishExperience();
    }
  }, [phase, minTimeElapsed, isReady, finishExperience]);

  if (phase === 'done') {
    return null;
  }

  return (
    <div
      className={`entry-experience ${phase === 'exiting' ? 'is-exiting' : ''}`}
    >
      {phase === 'entry' && (
        <EntryPage onEnter={handleEnter} isLoading={isLoadingImages} />
      )}
      {phase === 'reel' && <CinematicReel onFinish={handleReelFinish} />}
      {(phase === 'loading' || phase === 'exiting') && <LoadingScreen />}
    </div>
  );
}
