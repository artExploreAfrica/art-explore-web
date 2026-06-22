import { useState } from 'react';
import Navbar from './components/layout/Navbar';
// import Herosection3 from './components/layout/HeroTypographic.jsx';
import EntryExperience from './components/EntryExperience/EntryExperience';
import ArtGalleryApp from './components/gallery/ArtGalleryApp.jsx';
import Mapheader from './components/Map/LagosMap.jsx';
import MapView from './components/Map/MapView';
import './App.scss';

function App() {

 const [entered, setEntered] = useState(false);

 if (!entered) {
   return <EntryExperience onComplete={() => setEntered(true)} />;
 }

  return (
    <div className="app">
      <Navbar />
      {/* <Herosection3 /> */}
      <Mapheader />
      <MapView />
      <ArtGalleryApp />
      <footer className="footer">
        <div className="container">
          <p>&copy; 2024 ArtLagos Directory. All rights reserved.</p>
          <small>Discover and explore the vibrant art scene of Lagos, Nigeria</small>
        </div>
      </footer>
    </div>
  );
}

export default App;
