import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Copy, Trash2, FolderOpen } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import { Field, Input, Select } from '../../components/common/Field.jsx';
import { Badge, EmptyState, PageHeader, Skeleton } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useConfirm } from '../../components/common/Confirm.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { listPapers, createPaper, loadPaper, duplicatePaper, deletePaper } from '../../services/paperService.js';
import { listTemplates } from '../../services/templateService.js';
import { checkLimit, invalidateUsage } from '../../services/planService.js';
import { logActivity } from '../../services/activityService.js';
import { millis } from '../../services/db.js';
import { BUILTIN_TEMPLATES, resolveDesign } from '../../constants/templates.js';
import { ADVANCED_TEMPLATES, limitOf } from '../../constants/plans.js';
import { newSection, infoFromInstitution } from '../../utils/paper.js';

const TONE = { draft: '', review: 'warn', approved: 'info', published: 'brand' };

export default function PaperLibrary() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [sp, setSp] = useSearchParams();
  const { user, institution, institutionId, role, can } = useCurrent();
  const [papers, setPapers] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [dlg, setDlg] = useState(null);
  const [busy, setBusy] = useState(false);
  const canKeys = can('answerKeys.view');
  const canEditKeys = can('answerKeys.edit');

  const load = () => listPapers(institutionId, { uid: user.uid, role }).then(setPapers).catch((e) => { toast.error(t(e.message)); setPapers([]); });
  useEffect(() => { load(); listTemplates(institutionId).then(setTemplates).catch(() => {}); }, [institutionId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!can('papers.create')) return;
    if (sp.get('new') || sp.get('template')) {
      setDlg({ title: '', mode: sp.get('template') ? 'template' : 'blank', templateId: sp.get('template') || 'classic', copyId: '' });
      setSp({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (papers || []).filter((p) => (!status || p.status === status)
    && (!q || `${p.title} ${p.info && p.info.examName} ${p.info && p.info.subject} ${p.info && p.info.className}`.toLowerCase().includes(q.toLowerCase()))), [papers, q, status]);

  const allTemplates = [...BUILTIN_TEMPLATES, ...templates];

  const create = async () => {
    if (!dlg.title.trim()) { toast.error(t('Enter a title for the paper.')); return; }
    setBusy(true);
    try {
      const msg = await checkLimit(institution, 'papers');
      if (msg) throw new Error(msg);
      let id;
      if (dlg.mode === 'copy') {
        if (!dlg.copyId) throw new Error('Choose the paper to copy.');
        const full = await loadPaper(dlg.copyId, institutionId, canKeys);
        id = await duplicatePaper({ paper: full.paper, items: full.items, keys: full.keys, uid: user.uid, canKeys: canEditKeys, title: dlg.title.trim() });
      } else {
        const tpl = dlg.mode === 'template' ? allTemplates.find((x) => x.id === dlg.templateId) : null;
        if (tpl && ADVANCED_TEMPLATES.includes(tpl.id) && !limitOf(institution.plan, 'advancedTemplates')) throw new Error('This template needs a paid plan.');
        const design = { ...resolveDesign(tpl ? tpl.design : {}), templateId: tpl ? tpl.id : 'custom' };
        id = await createPaper({ institutionId, uid: user.uid, title: dlg.title.trim(), info: { ...infoFromInstitution(institution), examName: dlg.title.trim() }, design, sections: [newSection({ title: '' })] });
      }
      invalidateUsage(institutionId);
      logActivity(institutionId, user.uid, 'paper.create', { paperId: id });
      nav(`/app/papers/${id}`);
    } catch (e) { toast.error(t(e.message)); } finally { setBusy(false); }
  };

  const copy = async (p) => {
    try {
      const msg = await checkLimit(institution, 'papers');
      if (msg) throw new Error(msg);
      const full = await loadPaper(p.id, institutionId, canKeys);
      await duplicatePaper({ paper: full.paper, items: full.items, keys: full.keys, uid: user.uid, canKeys: canEditKeys });
      invalidateUsage(institutionId);
      toast.success(t('Paper duplicated'));
      load();
    } catch (e) { toast.error(t(e.message)); }
  };

  const remove = async (p) => {
    if (!(await confirm({ title: t('Delete paper'), message: t('Delete "{name}" and all of its questions? This cannot be undone.', { name: p.title || '' }), danger: true, confirmLabel: t('Delete') }))) return;
    try { await deletePaper(p, canEditKeys); invalidateUsage(institutionId); toast.success(t('Deleted')); load(); } catch (e) { toast.error(t(e.message)); }
  };

  const canDelete = (p) => can('institution.manage') || (p.createdBy === user.uid && p.status === 'draft' && can('papers.create'));

  return (
    <div>
      <PageHeader title={t('Question papers')} subtitle={papers ? t('{n} papers', { n: papers.length }) : ''}
        actions={can('papers.create') && <Button variant="primary" icon={Plus} onClick={() => setDlg({ title: '', mode: 'blank', templateId: 'classic', copyId: '' })}>{t('New paper')}</Button>} />
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <Input className="sm:col-span-2" placeholder={t('Search by title, subject or class')} value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('Status')}>
          <option value="">{t('All statuses')}</option>
          {['draft', 'review', 'approved', 'published'].map((s) => <option key={s} value={s}>{t(s)}</option>)}
        </Select>
      </div>
      <div className="panel overflow-x-auto">
        {papers === null ? <div className="space-y-3 p-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          : !rows.length ? <EmptyState icon={FolderOpen} title={t('No papers found')} text={can('papers.create') ? t('Create a paper from a blank page, a template or a copy of an earlier paper.') : ''} />
            : (
              <table className="tbl min-w-[680px]">
                <thead><tr><th>{t('Paper')}</th><th>{t('Class / subject')}</th><th>{t('Status')}</th><th>{t('Marks')}</th><th>{t('Updated')}</th><th /></tr></thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td><Link className="font-medium hover:text-brand" to={`/app/papers/${p.id}`}>{p.title || (p.info && p.info.examName) || t('Untitled paper')}</Link>{p.setLabel && <Badge tone="info" className="ml-2">{t('Set')} {p.setLabel}</Badge>}</td>
                      <td className="text-muted">{[p.info && p.info.className, p.info && p.info.subject].filter(Boolean).join(' / ') || '—'}</td>
                      <td><Badge tone={TONE[p.status]}>{t(p.status)}</Badge></td>
                      <td>{p.totals ? p.totals.marks : '—'}</td>
                      <td className="whitespace-nowrap text-muted">{new Date(millis(p.updatedAt)).toLocaleDateString(lang === 'bn' ? 'bn-BD' : undefined)}</td>
                      <td><div className="flex justify-end">
                        {can('papers.create') && <Button size="icon" variant="ghost" onClick={() => copy(p)} aria-label={t('Duplicate')}><Copy className="h-4 w-4" /></Button>}
                        {canDelete(p) && <Button size="icon" variant="ghost" onClick={() => remove(p)} aria-label={t('Delete')}><Trash2 className="h-4 w-4" /></Button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
      </div>

      <Modal open={!!dlg} onClose={() => setDlg(null)} title={t('New question paper')} size="sm"
        footer={(<><Button onClick={() => setDlg(null)}>{t('Cancel')}</Button><Button variant="primary" loading={busy} onClick={create}>{t('Create paper')}</Button></>)}>
        {dlg && (
          <div className="space-y-3">
            <Field label={t('Paper title')}><Input autoFocus value={dlg.title} onChange={(e) => setDlg({ ...dlg, title: e.target.value })} placeholder={t('e.g. Annual Examination 2026 - Science')} /></Field>
            <Field label={t('Start from')}>
              <Select value={dlg.mode} onChange={(e) => setDlg({ ...dlg, mode: e.target.value })}>
                <option value="blank">{t('A blank paper')}</option>
                <option value="template">{t('A template')}</option>
                <option value="copy">{t('A copy of an existing paper')}</option>
              </Select>
            </Field>
            {dlg.mode === 'template' && (
              <Field label={t('Template')}><Select value={dlg.templateId} onChange={(e) => setDlg({ ...dlg, templateId: e.target.value })}>{allTemplates.map((x) => <option key={x.id} value={x.id}>{x.name[lang] || x.name.en || x.name}</option>)}</Select></Field>
            )}
            {dlg.mode === 'copy' && (
              <Field label={t('Paper to copy')}><Select value={dlg.copyId} onChange={(e) => setDlg({ ...dlg, copyId: e.target.value })}><option value="">—</option>{(papers || []).map((p) => <option key={p.id} value={p.id}>{p.title || p.id}</option>)}</Select></Field>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
