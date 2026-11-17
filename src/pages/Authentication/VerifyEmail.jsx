import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout.jsx';
import Button from '../../components/common/Button.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { resendVerification, logout, friendlyAuthError } from '../../services/authService.js';

export default function VerifyEmail() {
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const { user, ready } = useAuthStore();
  const [busy, setBusy] = useState(false);
  if (ready && !user) return <Navigate to="/login" replace />;
  if (user && user.emailVerified) return <Navigate to="/app/dashboard" replace />;

  const check = async () => {
    setBusy(true);
    try {
      await useAuthStore.getState().refresh();
      const u = useAuthStore.getState().user;
      if (u && u.emailVerified) nav('/app/dashboard', { replace: true });
      else toast.info(t('Your email is not verified yet.'));
    } catch (e) { toast.error(friendlyAuthError(e)); } finally { setBusy(false); }
  };
  const resend = async () => {
    try { await resendVerification(); toast.success(t('Verification email sent.')); } catch (e) { toast.error(friendlyAuthError(e)); }
  };

  return (
    <AuthLayout title={t('Verify your email')} subtitle={t('We sent a verification link to {email}. Open it, then come back here.', { email: user ? user.email : '' })}>
      <div className="space-y-3">
        <Button variant="primary" className="w-full" loading={busy} onClick={check}>{t('I have verified my email')}</Button>
        <Button className="w-full" onClick={resend}>{t('Send the email again')}</Button>
        <Button variant="ghost" className="w-full" onClick={async () => { await logout(); nav('/login'); }}>{t('Sign out')}</Button>
      </div>
    </AuthLayout>
  );
}
