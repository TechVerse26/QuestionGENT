import { Link } from 'react-router-dom';
import Logo from '../components/common/Logo.jsx';
import InstallButton from '../components/common/InstallButton.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useAuthStore } from '../store/authStore.js';

export default function MainLayout({ children }) {
  const { t, lang, setLang } = useI18n();
  const user = useAuthStore((s) => s.user);
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/"><Logo /></Link>
          <nav className="flex items-center gap-2">
            <InstallButton />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}>{lang === 'bn' ? 'English' : 'বাংলা'}</button>
            {user ? (
              <Link className="btn btn-primary btn-sm" to="/app/dashboard">{t('Open dashboard')}</Link>
            ) : (
              <>
                <Link className="btn btn-sm" to="/login">{t('Sign in')}</Link>
                <Link className="btn btn-primary btn-sm" to="/register">{t('Create account')}</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-line py-6 text-center text-sm text-muted">© EXAM MASTER</footer>
    </div>
  );
}
