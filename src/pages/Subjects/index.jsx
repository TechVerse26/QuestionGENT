import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import { Field, Input, Select } from '../../components/common/Field.jsx';
import { EmptyState, PageHeader, Spinner, Tabs } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useConfirm } from '../../components/common/Confirm.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { useAcademic } from '../../store/academicStore.js';
import { listAcademic, saveAcademic, removeAcademic } from '../../services/academicService.js';

// [key, label, options?]
const TABS = [
  { id: 'classes', label: 'Classes', fields: [['name', 'Name']] },
  { id: 'groups', label: 'Groups', fields: [['name', 'Name']] },
  { id: 'departments', label: 'Departments', fields: [['name', 'Name']] },
  { id: 'subjects', label: 'Subjects', fields: [['name', 'Name'], ['code', 'Subject code']] },
  { id: 'chapters', label: 'Chapters', fields: [['name', 'Name'], ['parent', 'Subject']] },
  { id: 'topics', label: 'Topics', fields: [['name', 'Name'], ['parent', 'Chapter']] },
  { id: 'branches', label: 'Branches', fields: [['name', 'Name'], ['address', 'Address']] },
  { id: 'sessions', label: 'Academic sessions', fields: [['name', 'Name (e.g. 2026)']] },
  { id: 'examinations', label: 'Examinations', fields: [['name', 'Name'], ['category', 'Category (e.g. Half-yearly)'], ['session', 'Session'], ['className', 'Class'], ['subject', 'Subject'], ['date', 'Date'], ['status', 'Status', ['planned', 'running', 'done']]] },
];

function AcademicTable({ cfg, canWrite }) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, institutionId } = useCurrent();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => listAcademic(cfg.id, institutionId).then((l) => setRows(l.sort((a, b) => String(a.name).localeCompare(String(b.name))))).catch((e) => { toast.error(t(e.message)); setRows([]); });
  useEffect(() => { setRows(null); load(); }, [cfg.id, institutionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const refreshLists = () => useAcademic.getState().load(institutionId, true);

  const save = async () => {
    if (!String(form.data.name || '').trim()) { toast.error(t('Enter a name.')); return; }
    setBusy(true);
    try { await saveAcademic(cfg.id, institutionId, user.uid, form.data, form.id); setForm(null); await load(); refreshLists(); } catch (e) { toast.error(t(e.message)); } finally { setBusy(false); }
  };
  const del = async (r) => {
    if (!(await confirm({ title: t('Delete'), message: t('Delete "{name}"?', { name: r.name }), danger: true, confirmLabel: t('Delete') }))) return;
    try { await removeAcademic(cfg.id, r.id); await load(); refreshLists(); } catch (e) { toast.error(t(e.message)); }
  };

  return (
    <div className="pt-4">
      {canWrite && <div className="mb-3"><Button variant="primary" icon={Plus} onClick={() => setForm({ id: null, data: {} })}>{t('Add')}</Button></div>}
      <div className="panel overflow-x-auto">
        {rows === null ? <div className="p-6"><Spinner /></div> : !rows.length ? <EmptyState title={t('Nothing here yet')} /> : (
          <table className="tbl min-w-[520px]">
            <thead><tr>{cfg.fields.map(([k, l]) => <th key={k}>{t(l)}</th>)}<th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>{cfg.fields.map(([k]) => <td key={k}>{r[k] || '—'}</td>)}
                <td><div className="flex justify-end">{canWrite && <><Button size="icon" variant="ghost" onClick={() => setForm({ id: r.id, data: Object.fromEntries(cfg.fields.map(([k]) => [k, r[k] || ''])) })} aria-label={t('Edit')}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => del(r)} aria-label={t('Delete')}><Trash2 className="h-4 w-4" /></Button></>}</div></td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <Modal open={!!form} onClose={() => setForm(null)} size="sm" title={form && form.id ? t('Edit') : t('Add')}
        footer={(<><Button onClick={() => setForm(null)}>{t('Cancel')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('Save')}</Button></>)}>
        {form && <div className="space-y-3">{cfg.fields.map(([k, l, opts]) => (
          <Field key={k} label={t(l)}>
            {opts ? <Select value={form.data[k] || opts[0]} onChange={(e) => setForm({ ...form, data: { ...form.data, [k]: e.target.value } })}>{opts.map((o) => <option key={o} value={o}>{t(o)}</option>)}</Select>
              : <Input value={form.data[k] || ''} onChange={(e) => setForm({ ...form, data: { ...form.data, [k]: e.target.value } })} />}
          </Field>
        ))}</div>}
      </Modal>
    </div>
  );
}

export default function Subjects() {
  const { t } = useI18n();
  const { can } = useCurrent();
  const [tab, setTab] = useState('classes');
  const cfg = TABS.find((x) => x.id === tab);
  return (
    <div>
      <PageHeader title={t('Classes, subjects and examinations')} subtitle={t('These lists feed the pickers in questions and papers.')} />
      <Tabs tabs={TABS.map((x) => ({ id: x.id, label: t(x.label) }))} value={tab} onChange={setTab} />
      <AcademicTable key={tab} cfg={cfg} canWrite={can('academics.manage')} />
    </div>
  );
}
