import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes.jsx';
import SetupScreen from './pages/SetupScreen.jsx';
import { isFirebaseConfigured } from './firebase/config.js';
import { useAuthStore } from './store/authStore.js';

// Vite's BASE_URL is '/' normally and '/REPO/' on a GitHub Pages project site; the router wants it without the trailing slash.
const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';

export default function App() {
  useEffect(() => { useAuthStore.getState().init(); }, []);
  if (!isFirebaseConfigured) return <SetupScreen />;
  return (
    <BrowserRouter basename={basename}>
      <AppRoutes />
    </BrowserRouter>
  );
}
