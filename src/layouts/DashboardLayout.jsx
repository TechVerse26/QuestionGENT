import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Library, Sparkles, ArrowUpDown, LayoutTemplate, Palette, KeyRound, GraduationCap, Users, Activity, CreditCard, Bell, Settings, Menu, X, Moon, Sun, LogOut } from 'lucide-react';
import Logo from '../components/common/Logo.jsx';
import InstallButton from '../components/common/InstallButton.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useCurrent } from '../hooks/useCurrent.js';
import { useAuthStore } from '../store/authStore.js';
import { useUi } from '../store/uiStore.js';
import { logout } from '../services/authService.js';
import { watchUnread } from '../services/notificationService.js';
import { ROLE_LABELS } from '../constants/roles.js';
import { allowedTypes } from '../constants/notify.js';

const NAV = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { group: 'Create' },
  { to: '/app/papers', label: 'Question papers', icon: FileText, perm: 'papers.view' },
  { to: '/app/question-bank', label: 'Question bank', icon: Library, perm: 'questions.view' },
  { to: '/app/ai', label: 'AI generator', icon: Sparkles, perm: 'ai.use' },
  { to: '/app/import-export', label: 'Import & export', icon: ArrowUpDown, perm: 'papers.view' },
  { group: 'Layout' },
  { to: '/app/templates', label: 'Templates', icon: LayoutTemplate, perm: 'papers.view' },
  { to: '/app/design-studio', label: 'Design studio', icon: Palette, perm: 'templates.manage' },
  { to: '/app/answer-keys', label: 'Answer keys', icon: KeyRound, perm: 'answerKeys.view' },
  { group: 'Institution' },
  { to: '/app/academics', label: 'Classes, subjects & exams', icon: GraduationCap, perm: 'questions.view' },
  { to: '/app/team', label: 'Team', icon: Users },
  { to: '/app/analytics', label: 'Analytics', icon: Activity, perm: 'analytics.view' },
  { to: '/app/subscription', label: 'Subscription', icon: CreditCard, perm: 'billing.manage' },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout() {
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();
  const builder = useMatch('/app/papers/:paperId');
  const { user, institution, institutionId, role, can } = useCurrent();
  const { memberships, institutions, setCurrent, profile } = useAuthStore();
  const { theme, toggleTheme, sidebar, setSidebar } = useUi();
  const [unread, setUnread] = useState(0);

  useEffect(() => (user ? watchUnread(user.uid, setUnread, allowedTypes(profile && profile.prefs)) : undefined), [user, profile]);
  useEffect(() => { setSidebar(false); }, [loc.pathname, setSidebar]);

  const onLogout = async () => { await logout(); nav('/login'); };
  const items = NAV.filter((n) => !n.perm || can(n.perm));

  const side = (
    <div className="flex h-full flex-col bg-side text-side-ink">
      <div className="flex h-14 shrink-0 items-center justify-between px-4"><Logo light /><button type="button" className="lg:hidden" onClick={() => setSidebar(false)} aria-label="Close menu"><X className="h-5 w-5" /></button></div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {items.map((n, i) => (n.group ? (
          <p key={`g${i}`} className="px-3 pb-1 pt-4 text-xs font-semibold opacity-60">{t(n.group)}</p>
        ) : (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `mb-0.5 flex items-center gap-3 rounded px-3 py-2 text-sm ${isActive ? 'bg-brand text-brand-ink' : 'hover:bg-white/10'}`}>
            <n.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t(n.label)}</span>
            {n.to === '/app/notifications' && unread > 0 && <span className="rounded-sm bg-danger px-1.5 text-xs text-white">{unread}</span>}
          </NavLink>
        )))}
      </nav>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-60 shrink-0 lg:block">{side}</aside>
      {sidebar && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setSidebar(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{side}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
          <button type="button" className="btn btn-ghost btn-sm btn-icon lg:hidden" onClick={() => setSidebar(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            {memberships.length > 1 ? (
              <select className="input h-8 max-w-[240px]" value={institutionId || ''} onChange={(e) => setCurrent(e.target.value)} aria-label={t('Institution')}>
                {memberships.map((m) => <option key={m.institutionId} value={m.institutionId}>{institutions[m.institutionId] ? institutions[m.institutionId].name : m.institutionId}</option>)}
              </select>
            ) : (
              <p className="truncate text-sm font-semibold">{institution ? institution.name : ''}</p>
            )}
            {role && <p className="truncate text-xs text-muted">{ROLE_LABELS[role] ? ROLE_LABELS[role][lang] : role}</p>}
          </div>
          <InstallButton />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}>{lang === 'bn' ? 'English' : 'বাংলা'}</button>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={toggleTheme} aria-label={t('Toggle theme')}>{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          <NavLink to="/app/notifications" className="btn btn-ghost btn-sm btn-icon relative" aria-label={t('Notifications')}>
            <Bell className="h-4 w-4" />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-sm bg-danger px-1 text-[10px] leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
          </NavLink>
          <span className="hidden h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand sm:flex" title={user ? user.email : ''}>{(user && (user.displayName || user.email) || '?').slice(0, 1).toUpperCase()}</span>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onLogout} aria-label={t('Sign out')} title={t('Sign out')}><LogOut className="h-4 w-4" /></button>
        </header>
        <main className={builder ? 'min-h-0 flex-1 overflow-hidden' : 'min-h-0 flex-1 overflow-y-auto'}>
          {builder ? <Outlet /> : <div className="mx-auto w-full max-w-7xl p-4 sm:p-6"><Outlet /></div>}
        </main>
      </div>
    </div>
  );
}
