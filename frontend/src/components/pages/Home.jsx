// src/App.jsx
import { useState, useEffect } from 'react'
import Navbar from '../layout/Navbar.jsx';
import Herosection3 from '../layout/HeroTypographic.jsx';
import ArtGalleryApp from '../gallery/ArtGalleryApp.jsx';
import Mapheader from '../Map/LagosMap.jsx';
import MapView from '../Map/MapView.jsx';
import '../../App.jsx';

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