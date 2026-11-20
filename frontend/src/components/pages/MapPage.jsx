import Navbar from '../layout/Navbar.jsx';
import MapView from '../Map/MapView.jsx';
import './MapPage.scss';

/**
 * /map — the map on a page of its own.
 *
 * It used to sit in the middle of the home page, full-screen tall on phones,
 * so a visitor scrolling past it ended up dragging the map instead of the
 * page. Here the map IS the page: the screen is the navbar plus the map, the
 * page itself never scrolls, and one-finger dragging moves the map as people
 * expect. The phone's back button returns them to wherever they came from.
 *
 * No footer: on a full-screen map there's nothing to scroll down to.
 */
export default function MapPage() {
  return (
    <div className="map-page">
      <Navbar />
      <main className="map-page__main">
        <h1 className="map-page__sr">Map of art spaces in Lagos</h1>
        <MapView />
      </main>
    </div>
  );
}
