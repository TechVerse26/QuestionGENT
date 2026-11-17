import { useEffect, useState } from 'react';
import Modal from '../../components/common/Modal.jsx';
import Button from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Field.jsx';
import { Spinner } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useConfirm } from '../../components/common/Confirm.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { useBuilder } from '../../store/builderStore.js';
import { listVersions, saveVersion } from '../../services/paperService.js';
import { millis } from '../../services/db.js';

export default function VersionsDialog({ open, onClose, canEdit }) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, institutionId } = useCurrent();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setList(await listVersions(useBuilder.getState().paper.id, institutionId)); } catch (e) { toast.error(t(e.message)); } finally { setLoading(false); }
  };
  useEffect(() => { if (open) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true);
    try {
      const { paper, items } = useBuilder.getState();
      await saveVersion({ paper, items, uid: user.uid, label });
      setLabel('');
      toast.success(t('Version saved'));
      await load();
    } catch (e) { toast.error(t(e.message)); } finally { setBusy(false); }
  };

  const restore = async (v) => {
    if (!(await confirm({ title: t('Restore version'), message: t('Replace the current paper content with this version? Unsaved changes are lost.'), confirmLabel: t('Restore') }))) return;
    const snap = JSON.parse(v.snapshot);
    const s = useBuilder.getState();
    const keys = Object.fromEntries(Object.entries(s.keys).filter(([id]) => snap.items[id]));
    s.loadAllDirty({ ...s.paper, ...snap.paper }, snap.items, keys);
    toast.success(t('Version restored'));
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('Version history')} size="md">
      {canEdit && (
        <div className="mb-4 flex gap-2">
          <Input placeholder={t('Version note (optional)')} value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button variant="primary" loading={busy} onClick={save}>{t('Save version')}</Button>
        </div>
      )}
      {loading && <div className="flex justify-center py-6"><Spinner /></div>}
      {!loading && !list.length && <p className="py-6 text-center text-sm text-muted">{t('No saved versions yet. A version is saved automatically when the status changes.')}</p>}
      {list.map((v) => (
        <div key={v.id} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
          <div className="min-w-0">
            <p className="text-sm font-medium">{new Date(millis(v.createdAt)).toLocaleString()}</p>
            <p className="truncate text-xs text-muted">{v.label || '—'} / {t('{n} questions', { n: v.questionCount || 0 })}</p>
          </div>
          {canEdit && <Button size="sm" onClick={() => restore(v)}>{t('Restore')}</Button>}
        </div>
      ))}
      <p className="hint mt-3">{t('Versions contain the questions and layout, not the answer keys.')}</p>
    </Modal>
  );
}
