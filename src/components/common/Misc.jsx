import { LoaderCircle, Inbox, ShieldAlert } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import Button from './Button.jsx';

export const Spinner = ({ className = '' }) => <LoaderCircle className={`h-5 w-5 animate-spin text-muted ${className}`} />;
export const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded bg-line/60 ${className}`} />;
export const Splash = () => <div className="flex min-h-screen items-center justify-center"><Spinner className="h-7 w-7" /></div>;

const TONES = { brand: 'badge-brand', warn: 'badge-warn', danger: 'badge-danger', info: 'badge-info', '': '' };
export const Badge = ({ tone = '', children, className = '' }) => <span className={`badge ${TONES[tone] || ''} ${className}`}>{children}</span>;

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <Icon className="h-9 w-9 text-muted" strokeWidth={1.5} />
      <h3 className="text-base">{title}</h3>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap border-b border-line" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.id} type="button" role="tab" aria-selected={value === tab.id} onClick={() => onChange(tab.id)} className={value === tab.id ? 'tab tab-on' : 'tab'}>{tab.label}</button>
      ))}
    </div>
  );
}

export function Pagination({ page, pages, onChange }) {
  const { t } = useI18n();
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 text-sm">
      <span className="text-muted">{t('Page {n} of {m}', { n: page, m: pages })}</span>
      <div className="flex gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>{t('Previous')}</Button>
        <Button size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>{t('Next')}</Button>
      </div>
    </div>
  );
}

export function NoAccess() {
  const { t } = useI18n();
  return <EmptyState icon={ShieldAlert} title={t('You do not have access to this page')} text={t('Ask an institution admin to change your role if you need it.')} />;
}
