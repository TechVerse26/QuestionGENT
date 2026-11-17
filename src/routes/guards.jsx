import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useCurrent } from '../hooks/useCurrent.js';
import { NoAccess, Splash } from '../components/common/Misc.jsx';

export function RequireAuth() {
  const { user, ready } = useAuthStore();
  const loc = useLocation();
  if (!ready) return <Splash />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  const passwordUser = user.providerData.some((p) => p.providerId === 'password');
  if (passwordUser && !user.emailVerified) return <Navigate to="/verify-email" replace />;
  return <Outlet />;
}

export function RequireInstitution() {
  const memberships = useAuthStore((s) => s.memberships);
  if (!memberships.length) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export function Can({ perm, children }) {
  const { can } = useCurrent();
  return can(perm) ? children : <NoAccess />;
}
