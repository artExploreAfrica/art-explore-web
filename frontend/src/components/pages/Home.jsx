import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../layout/Navbar.jsx';
import Herosection3 from '../layout/HeroTypographic.jsx';
import TagShowcase from '../sections/TagShowcase.jsx';
import MapTeaser from '../Map/LagosMap.jsx';
import PartnerBand from '../sections/PartnerBand.jsx';
import ContactSection from '../sections/ContactSection.jsx';
import Footer from '../layout/Footer.jsx';
import '../../App.jsx';

/**
 * Home — read top to bottom as a guide to the city:
 *   Hero        — what this is
 *   The range   — spaces to explore, by tag (Women Owned, Classics…)
 *   Map         — a teaser; "Explore our map" opens the full map on /map
 *   Partner     — partner, learn more, or add a space
 *   Contact     — "Contact us": a message to the team (admin › Enquiries)
 *
 * The full searchable directory lives on its own route, /galleries,
 * reached from the "Spaces" nav link.
 */
function App() {
  const { hash } = useLocation();

  // Footer links such as /#contact arrive here from other routes; scroll to
  // the section once it has mounted. The sections above it are still
  // loading (photos, tag cards), which pushes the target down after the
  // first scroll — so aim again a few times while the page settles, and
  // stop as soon as the visitor scrolls or taps themselves.
  useEffect(() => {
    if (!hash) return;
    const go = () => document.getElementById(hash.slice(1))?.scrollIntoView();
    go();
    const timers = [250, 700, 1400, 2500].map((ms) => setTimeout(go, ms));
    const stop = () => timers.forEach(clearTimeout);
    const opts = { once: true, passive: true };
    window.addEventListener('wheel', stop, opts);
    window.addEventListener('touchstart', stop, opts);
    window.addEventListener('keydown', stop, opts);
    return () => {
      stop();
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('keydown', stop);
    };
  }, [hash]);

  return (
    <div className="app">
      <Navbar />
      <Herosection3 />
      <TagShowcase />
      <MapTeaser />
      <PartnerBand />
      <ContactSection />

      <Footer />
    </div>
  );
}

export default App;
