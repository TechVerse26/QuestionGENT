import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import { EmptyState, PageHeader, Spinner } from '../../components/common/Misc.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { listNotifications, markRead, markAllRead } from '../../services/notificationService.js';
import { allowedTypes } from '../../constants/notify.js';
import { millis } from '../../services/db.js';

export default function Notifications() {
  const { t } = useI18n();
  const nav = useNavigate();
  const { user, profile } = useCurrent();
  const [list, setList] = useState(null);
  const load = () => listNotifications(user.uid).then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, [user.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  const allowed = allowedTypes(profile && profile.prefs);
  const shown = (list || []).filter((n) => allowed.includes(n.type));

  const open = async (n) => {
    if (!n.read) { await markRead(n.id).catch(() => {}); setList((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x))); }
    if (n.link) nav(n.link);
  };

  return (
    <div>
      <PageHeader title={t('Notifications')} actions={<Button size="sm" onClick={async () => { await markAllRead(user.uid).catch(() => {}); load(); }}>{t('Mark all as read')}</Button>} />
      <div className="panel">
        {list === null ? <div className="p-6"><Spinner /></div> : !shown.length ? <EmptyState icon={Bell} title={t('No notifications')} text={t('Review requests, approvals and exports will show up here. You can choose which ones in Settings.')} /> : shown.map((n) => (
          <button key={n.id} type="button" onClick={() => open(n)} className="flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-surface2">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-line' : 'bg-brand'}`} />
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{t(n.title)}</span>{n.body && <span className="block truncate text-sm text-muted">{n.body}</span>}</span>
            <span className="shrink-0 text-xs text-muted">{new Date(millis(n.createdAt)).toLocaleString()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
