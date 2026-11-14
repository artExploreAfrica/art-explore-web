import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../layout/Navbar.jsx';
import Herosection3 from '../layout/HeroTypographic.jsx';
import WhoWeAre from '../sections/WhoWeAre.jsx';
import TagShowcase from '../sections/TagShowcase.jsx';
import Mapheader from '../Map/LagosMap.jsx';
import MapView from '../Map/MapView.jsx';
import PartnerBand from '../sections/PartnerBand.jsx';
import Footer from '../layout/Footer.jsx';
import '../../App.jsx';

/**
 * Home — read top to bottom as a guide to the city:
 *   Hero        — what this is
 *   Who we are  — who is behind it, and the directory by kind of space
 *   The range   — spaces to explore, by tag (Women Owned, Classics…)
 *   Map         — see it laid out
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
      <WhoWeAre />
      <TagShowcase />
      <Mapheader />
      <MapView />
      <PartnerBand />

      <Footer />
    </div>
  );
}

export default App;
