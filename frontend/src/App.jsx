import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/pages/Home';
import SubmitGalleryPage from './components/pages/SubmitGalleryPage';
import GalleriesPage from './components/pages/GalleriesPage';
import GalleryDetailPage from './components/pages/GalleryDetailPage';
import AboutPage from './components/pages/AboutPage';
import PartnerPage from './components/pages/PartnerPage';
import { AdminRoutes } from './admin/routes';
import { AuthProvider as PublicAuthProvider } from './lib/AuthContext';

const isAdminHost = window.location.hostname.startsWith('admin.');

function App() {
  if (isAdminHost) {
    return (
      <PublicAuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin/*" element={<AdminRoutes />} />
        </Routes>
      </PublicAuthProvider>
    );
  }

  return (
    <PublicAuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/galleries" element={<GalleriesPage />} />
        <Route path="/galleries/:id" element={<GalleryDetailPage />} />
        {/* Public sign-in is switched off for now (LoginPage and SignupPage are
            kept, unrouted). Old links and bookmarks land on the home page. */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/signup" element={<Navigate to="/" replace />} />
        <Route path="/partner" element={<PartnerPage />} />
        <Route path="/submit" element={<SubmitGalleryPage />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
      </Routes>
    </PublicAuthProvider>
  );
}

export default App;
