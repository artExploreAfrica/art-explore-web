import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/pages/Home';
import LoginPage from './components/pages/LoginPage';
import SignupPage from './components/pages/SignupPage';
import SubmitGalleryPage from './components/pages/SubmitGalleryPage';
import GalleriesPage from './components/pages/GalleriesPage';
import GalleryDetailPage from './components/pages/GalleryDetailPage';
import AboutPage from './components/pages/AboutPage';
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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/submit" element={<SubmitGalleryPage />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
      </Routes>
    </PublicAuthProvider>
  );
}

export default App;
