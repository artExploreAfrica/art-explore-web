import { ENTRY_OVERLAY } from './entrycopy';
import './LoadingScreen.css';

/**
 * LoadingScreen
 * The "hold" screen after the reel: same text composition, same black
 * background — nothing moves or changes from where CinematicReel left
 * off. A single soft pulse near the subtitle is the only sign that
 * something is happening, so the screen reads as a calm pause rather
 * than a stalled page.
 */
export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-screen__overlay">
        <span className="loading-screen__eyebrow">{ENTRY_OVERLAY.eyebrow}</span>
        <h2 className="loading-screen__title">{ENTRY_OVERLAY.title}</h2>
        <span className="loading-screen__subtitle">{ENTRY_OVERLAY.subtitle}</span>
        <span className="loading-screen__pulse" aria-hidden="true" />
      </div>
    </div>
  );
}
