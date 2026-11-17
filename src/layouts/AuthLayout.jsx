import { Link } from 'react-router-dom';
import Logo from '../components/common/Logo.jsx';
import { useI18n } from '../i18n/index.jsx';

export default function AuthLayout({ title, subtitle, children, footer }) {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="hidden flex-col justify-between bg-side p-10 text-side-ink lg:flex">
        <Link to="/"><Logo light /></Link>
        <div>
          <h2 className="mb-3 max-w-md text-3xl font-bold leading-tight text-white">{t('Build the whole exam paper in one place.')}</h2>
          <p className="max-w-md text-[15px] leading-relaxed">{t('MCQ, creative, short and broad questions in a single paper, with a print-ready Bengali layout and a question bank behind it.')}</p>
        </div>
        <p className="text-sm opacity-70">© EXAM MASTER</p>
      </aside>
      <main className="flex flex-col justify-center p-6 sm:p-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between lg:hidden"><Link to="/"><Logo /></Link></div>
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
            </div>
            <button type="button" className="btn btn-sm" onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}>{lang === 'bn' ? 'English' : 'বাংলা'}</button>
          </div>
          {children}
          {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
