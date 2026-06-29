// src/App.jsx
// import { useState, useEffect } from 'react'
import Navbar from './components/layout/Navbar';
// import Herosection1 from './components/layout/HeroCinematic.jsx'
// import Herosection2 from './components/layout/HeroEditorial.jsx'
import Herosection3 from './components/layout/HeroTypographic.jsx';
import ArtGalleryApp from './components/gallery/ArtGalleryApp.jsx';
import Mapheader from './components/Map/LagosMap.jsx';
import MapView from './components/Map/MapView';
import './App.scss';

function App() {
  return (
    <div className="app">
      <Navbar />
      <Herosection3 />
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
