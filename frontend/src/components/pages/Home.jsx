import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../layout/Navbar.jsx';
import Herosection3 from '../layout/HeroTypographic.jsx';
import TagShowcase from '../sections/TagShowcase.jsx';
import MapTeaser from '../Map/LagosMap.jsx';
import PartnerBand from '../sections/PartnerBand.jsx';
import Footer from '../layout/Footer.jsx';
import '../../App.jsx';

/**
 * Home — read top to bottom as a guide to the city:
 *   Hero        — what this is
 *   The range   — spaces to explore, by tag (Women Owned, Classics…)
 *   Map         — a teaser; "Explore our map" opens the full map on /map
 *   Contribute  — suggest a space that's missing (inline form)
 *
 * The full searchable directory lives on its own route, /galleries,
 * reached from the "Spaces" nav link.
 */
function App() {
  const { hash } = useLocation();

  // Footer links such as /#map arrive here from other routes; scroll to
  // the section once it has mounted.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="app">
      <Navbar />
      <Herosection3 />
      <TagShowcase />
      <MapTeaser />
      <PartnerBand />

      <Footer />
    </div>
  );
}

export default App;
