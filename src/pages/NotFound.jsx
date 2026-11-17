import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-6xl font-bold text-brand">404</p>
      <p className="text-lg">{t('This page does not exist.')}</p>
      <Link className="btn btn-primary" to="/">{t('Go to the home page')}</Link>
    </div>
  );
}
