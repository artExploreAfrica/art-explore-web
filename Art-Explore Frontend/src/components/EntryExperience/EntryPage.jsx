import './EntryPage.css';

/**
 * EntryPage
 * "A Note Before You Enter" splash screen.
 *
 * Props:
 *  - onEnter: () => void   called when the visitor clicks ENTER
 *  - isLoading: boolean    true while reel images are preloading,
 *                          shows a quiet "Entering…" state on the button
 */
export default function EntryPage({ onEnter, isLoading }) {
  return (
    <div className="entry-page">
      <div className="entry-page__glow" aria-hidden="true" />

      <div className="entry-page__content">
        <span className="entry-page__eyebrow">A NOTE BEFORE YOU ENTER</span>

        <h1 className="entry-page__heading">
          Lagos holds its art
          <br />
          close to the street.
        </h1>

        <p className="entry-page__body">
          Across Victoria Island, Lekki, Ikoyi and beyond, independent galleries and studio spaces
          hold work you won't find listed anywhere else. ArtExplore maps that world, gallery by
          gallery — so you can walk in already knowing where to go.
        </p>

        <button
          type="button"
          className="entry-page__enter"
          onClick={onEnter}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          <span className="entry-page__enter-ring" aria-hidden="true" />
          {isLoading ? 'Entering…' : 'ENTER'}
        </button>

        <span className="entry-page__caption">Lagos's galleries, mapped.</span>
      </div>
    </div>
  );
}
