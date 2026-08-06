import { Routes, Route } from 'react-router-dom';
import Home from './components/pages/Home';
import { AdminRoutes } from './admin/routes';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin/*" element={<AdminRoutes />} />
    </Routes>
  );
}

export default App;