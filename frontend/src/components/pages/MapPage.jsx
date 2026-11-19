import Navbar from '../layout/Navbar.jsx';
import Footer from '../layout/Footer.jsx';
import MapView from '../Map/MapView.jsx';
import './MapPage.scss';

/**
 * /map — the map on a page of its own, laid out like a pro map app.
 *
 * It used to sit in the middle of the home page, full-screen tall on phones,
 * so a visitor scrolling past it ended up dragging the map instead of the
 * page. Here the map IS the page: the screen is the navbar plus the map,
 * edge to edge, and the page never scrolls — a swipe only ever moves the map.
 *
 * The footer (About · Map · Spaces · Contact us, icons, ©) sits on the map's
 * bottom edge as a thin translucent strip, the way Google and Apple Maps show
 * theirs; the map's own zoom buttons and credits are lifted above it.
 */
export default function MapPage() {
  return (
    <div className="map-page">
      <Navbar />
      <main className="map-page__main">
        <h1 className="map-page__sr">Map of art spaces in Lagos</h1>
        <MapView />
        <Footer variant="map" />
      </main>
    </div>
  );
}
