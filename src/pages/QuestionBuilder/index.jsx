import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, History, Layers, Eye, Pencil } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import { Input, Select, Textarea } from '../../components/common/Field.jsx';
import { Badge, Spinner, Tabs, EmptyState } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import DesignControls from '../../components/design/DesignControls.jsx';
import PaperViewer from '../../preview/PaperViewer.jsx';
import StructurePanel from './StructurePanel.jsx';
import { InfoPanel, ChecksPanel } from './InfoPanel.jsx';
import QuestionEditorModal from './QuestionEditorModal.jsx';
import BankPicker from './BankPicker.jsx';
import VersionsDialog from './VersionsDialog.jsx';
import SetsDialog from './SetsDialog.jsx';
import ExportMenu from './ExportMenu.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent, useDebounced } from '../../hooks/useCurrent.js';
import { useBuilder } from '../../store/builderStore.js';
import { useBank } from '../../store/bankStore.js';
import { loadPaper, savePaper, setPaperStatus, saveVersion } from '../../services/paperService.js';
import { createQuestion, getBankKeys } from '../../services/questionService.js';
import { listTemplates, listCustomTypes } from '../../services/templateService.js';
import { listMembers } from '../../services/institutionService.js';
import { notify } from '../../services/notificationService.js';
import { logActivity } from '../../services/activityService.js';
import { checkLimit } from '../../services/planService.js';
import { BUILTIN_TEMPLATES, resolveDesign } from '../../constants/templates.js';
import { ADVANCED_TEMPLATES, limitOf } from '../../constants/plans.js';
import { paperSummary, questionMarks } from '../../utils/marks.js';
import { newId } from '../../utils/id.js';

const TONE = { draft: '', review: 'warn', approved: 'info', published: 'brand' };
const LABEL = { draft: 'Draft', review: 'In review', approved: 'Approved', published: 'Published' };
const REVIEWERS = ['institution_admin', 'examination_controller', 'paper_reviewer', 'department_head'];

function transitionsFor(status, c) {
  const out = [];
  if (status === 'draft' && c.canEdit) out.push({ to: 'review', label: 'Submit for review', primary: true });
  if (status === 'review') {
    if (c.canReview) { out.push({ to: 'approved', label: 'Approve', primary: true }); out.push({ to: 'draft', label: 'Request changes', note: true }); }
    else if (c.canEdit || c.own) out.push({ to: 'draft', label: 'Withdraw to draft' });
  }
  if (status === 'approved') {
    if (c.canPublish) out.push({ to: 'published', label: 'Publish', primary: true });
    if (c.canReview) out.push({ to: 'draft', label: 'Back to draft', note: true });
  }
  if (status === 'published' && c.canPublish) out.push({ to: 'approved', label: 'Unpublish' });
  return out;
}

export default function PaperBuilder() {
  const { paperId } = useParams();
  const { t } = useI18n();
  const toast = useToast();
  const { user, institution, institutionId, can } = useCurrent();
  const paper = useBuilder((s) => s.paper);
  const items = useBuilder((s) => s.items);
  const keys = useBuilder((s) => s.keys);
  const dirty = useBuilder((s) => s.dirty);
  const saving = useBuilder((s) => s.saving);
  const savedAt = useBuilder((s) => s.savedAt);
  const rev = useBuilder((s) => s.rev);
  const canKeys = can('answerKeys.view');
  const canEditKeys = can('answerKeys.edit');

  const [state, setState] = useState({ loading: true, error: '' });
  const [tab, setTab] = useState('structure');
  const [pane, setPane] = useState('edit');
  const [previewMode, setPreviewMode] = useState('paper');
  const [editor, setEditor] = useState(null);
  const [bankFor, setBankFor] = useState(null);
  const [versions, setVersions] = useState(false);
  const [sets, setSets] = useState(false);
  const [statusDlg, setStatusDlg] = useState(null);
  const [note, setNote] = useState('');
  const [busyStatus, setBusyStatus] = useState(false);
  const [customTypes, setCustomTypes] = useState([]);
  const [templates, setTemplates] = useState([]);

  const own = !!paper && paper.createdBy === user.uid;
  const canEdit = !!paper && paper.status === 'draft' && (can('papers.edit_all') || (can('papers.create') && own));
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;

  const persist = useCallback(async () => {
    const s = useBuilder.getState();
    const rev0 = s.rev;
    const dirtyIds = [...s.dirtyIds];
    const removed = [...s.removed];
    await savePaper({ paper: s.paper, items: s.items, keys: s.keys, dirtyIds, removed, uid: user.uid, canKeys: canEditKeys });
    useBuilder.getState().markSaved(dirtyIds, rev0, removed);
  }, [user.uid, canEditKeys]);

  const save = useCallback(async (silent = true) => {
    const s = useBuilder.getState();
    if (!s.paper || s.saving || (silent && !s.dirty)) return;
    s.setSaving(true);
    try {
      await persist();
      if (!silent) toast.success(t('Saved'));
    } catch (e) {
      useBuilder.getState().setSaving(false);
      toast.error(t(e.message));
    }
  }, [persist, toast, t]);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: '' });
    (async () => {
      try {
        const r = await loadPaper(paperId, institutionId, canKeys);
        if (alive) { useBuilder.getState().load(r.paper, r.items, r.keys); setState({ loading: false, error: '' }); }
      } catch (e) {
        if (alive) setState({ loading: false, error: e.message });
      }
    })();
    listCustomTypes(institutionId).then((l) => { if (alive) setCustomTypes(l); }).catch(() => {});
    listTemplates(institutionId).then((l) => { if (alive) setTemplates(l); }).catch(() => {});
    return () => {
      alive = false;
      const s = useBuilder.getState();
      if (s.dirty && s.paper && s.paper.id === paperId && canEditRef.current) {
        savePaper({ paper: s.paper, items: s.items, keys: s.keys, dirtyIds: s.dirtyIds, removed: s.removed, uid: user.uid, canKeys: canEditKeys }).catch(() => {});
      }
      s.reset();
    };
  }, [paperId, institutionId, canKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirty || !canEdit) return undefined;
    const id = setTimeout(() => save(true), 4000);
    return () => clearTimeout(id);
  }, [rev, dirty, canEdit, save]);

  useEffect(() => {
    const h = (e) => { if (useBuilder.getState().dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const viewData = useMemo(() => ({ paper, items, keys }), [paper, items, keys]);
  const shown = useDebounced(viewData, 250);
  const summary = useMemo(() => (paper ? paperSummary(paper, items, canKeys ? keys : undefined) : null), [paper, items, keys, canKeys]);

  if (state.loading) return <div className="flex h-full items-center justify-center"><Spinner className="h-7 w-7" /></div>;
  if (state.error || !paper) {
    return <div className="p-6"><EmptyState title={t('This paper could not be opened')} text={t(state.error || 'Not found')} action={<Link className="btn btn-primary" to="/app/papers">{t('Back to papers')}</Link>} /></div>;
  }

  const info = paper.info || {};
  const onAdd = (sectionId, type, customDef) => setEditor({ mode: 'new', sectionId, type, customDef });
  const onEdit = (id) => setEditor({ mode: 'edit', id });
  const initial = editor && editor.mode === 'edit' && items[editor.id] ? { ...items[editor.id], key: keys[editor.id] } : null;
  const defaults = { className: info.className || '', subject: info.subject || '', group: info.group || '', department: info.department || '' };

  const onSaveQuestion = async (q, { alsoBank }) => {
    const { key, ...question } = q;
    const st = useBuilder.getState();
    if (editor.mode === 'edit') { st.updateItem({ ...st.items[editor.id], ...question, id: editor.id }, canEditKeys ? key || null : undefined); return; }
    let bankId;
    if (alsoBank) {
      const msg = await checkLimit(institution, 'questions');
      if (msg) throw new Error(msg);
      bankId = await createQuestion(institutionId, user.uid, question, canEditKeys ? key : null);
      useBank.getState().invalidate();
    }
    st.addItem(editor.sectionId, bankId ? { ...question, bankId } : question, canEditKeys ? key : undefined);
  };

  const onPickBank = async (questions) => {
    const bankKeys = canKeys ? await getBankKeys(questions.map((x) => x.id)) : {};
    const st = useBuilder.getState();
    questions.forEach((x) => {
      const { id, institutionId: _i, createdAt, updatedAt, createdBy, status, favoritedBy, searchText, fingerprint, version, ...rest } = x;
      st.addItem(bankFor, { ...rest, id: newId(12), bankId: id, optional: false }, bankKeys[id]);
    });
    toast.success(t('{n} question(s) added', { n: questions.length }));
  };

  const applyTemplate = (id) => {
    const tpl = [...BUILTIN_TEMPLATES, ...templates].find((x) => x.id === id);
    if (!tpl) return;
    if (ADVANCED_TEMPLATES.includes(id) && !limitOf(institution.plan, 'advancedTemplates')) { toast.error(t('This template needs a paid plan.')); return; }
    useBuilder.getState().setDesign({ ...resolveDesign(tpl.design), templateId: id });
  };

  const changeStatus = async (to, text = '') => {
    const s = useBuilder.getState();
    if (to === 'review') {
      const sum = paperSummary(s.paper, s.items, canKeys ? s.keys : undefined);
      if (sum.errors) { toast.error(t('Fix the {n} error(s) in Checks before submitting.', { n: sum.errors })); setTab('checks'); return; }
    }
    setBusyStatus(true);
    try {
      if (canEdit && s.dirty) await persist();
      const st = useBuilder.getState();
      await setPaperStatus(st.paper.id, to, user.uid, text);
      if (['review', 'approved', 'published'].includes(to)) await saveVersion({ paper: st.paper, items: st.items, uid: user.uid, label: to }).catch(() => null);
      useBuilder.setState((x) => ({ paper: { ...x.paper, status: to, reviewNote: text } }));
      logActivity(institutionId, user.uid, `paper.${to}`, { paperId: st.paper.id });
      const title = st.paper.title || (st.paper.info && st.paper.info.examName) || '';
      const link = `/app/papers/${st.paper.id}`;
      if (to === 'review') {
        const members = await listMembers(institutionId).catch(() => []);
        members.filter((m) => REVIEWERS.includes(m.role) && m.uid !== user.uid).slice(0, 10).forEach((m) => notify({ institutionId, userId: m.uid, createdBy: user.uid, type: 'paper_review', title: 'A paper is waiting for review', body: title, link }));
      } else if (st.paper.createdBy !== user.uid) {
        notify({ institutionId, userId: st.paper.createdBy, createdBy: user.uid, type: `paper_${to}`, title: `Paper status: ${to}`, body: `${title}${text ? ` - ${text}` : ''}`, link });
      }
      toast.success(t('Status updated'));
    } catch (e) {
      toast.error(t(e.message));
    } finally {
      setBusyStatus(false);
      setStatusDlg(null);
      setNote('');
    }
  };

  const actions = transitionsFor(paper.status, { canEdit, own, canReview: can('papers.review'), canPublish: can('papers.publish') });
  const issueCount = summary.issues.length;
  const total = summary.total;
  const full = Number(info.fullMarks) || 0;
  const saveText = saving ? t('Saving...') : dirty ? t('Unsaved changes') : savedAt ? t('Saved') : '';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <Link to="/app/papers" className="btn btn-ghost btn-sm btn-icon" aria-label={t('Back to papers')}><ArrowLeft className="h-4 w-4" /></Link>
        <Input className="h-8 min-w-[10rem] flex-1 font-semibold sm:max-w-md" value={paper.title || ''} placeholder={t('Paper title')} disabled={!canEdit} onChange={(e) => useBuilder.getState().patchPaper({ title: e.target.value })} />
        <Badge tone={TONE[paper.status]}>{t(LABEL[paper.status] || paper.status)}</Badge>
        {paper.setLabel && <Badge tone="info">{t('Set')} {paper.setLabel}</Badge>}
        <Badge tone={full && full !== total ? 'danger' : 'brand'}>{full ? `${total} / ${full}` : total} {t('marks')}</Badge>
        <span className="text-xs text-muted">{saveText}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {actions.map((a) => <Button key={a.to + a.label} size="sm" variant={a.primary ? 'primary' : 'default'} loading={busyStatus} onClick={() => (a.note ? setStatusDlg(a) : changeStatus(a.to))}>{t(a.label)}</Button>)}
          <Button size="sm" icon={History} onClick={() => setVersions(true)}>{t('Versions')}</Button>
          {canEdit && <Button size="sm" icon={Layers} onClick={() => setSets(true)}>{t('Sets')}</Button>}
          {canEdit && <Button size="sm" icon={Save} variant="primary" loading={saving} onClick={() => save(false)}>{t('Save')}</Button>}
          {can('papers.export') && <ExportMenu canKeys={canKeys} />}
        </div>
      </div>

      {!canEdit && <div className="border-b border-line bg-warn-soft px-3 py-1.5 text-sm text-warn">{t('This paper is read-only for you (status: {s}).', { s: t(LABEL[paper.status] || paper.status) })}{paper.reviewNote ? ` ${t('Reviewer note')}: ${paper.reviewNote}` : ''}</div>}

      <div className="flex border-b border-line bg-surface lg:hidden">
        <button type="button" className={`flex flex-1 items-center justify-center gap-2 py-2 text-sm ${pane === 'edit' ? 'border-b-2 border-brand font-semibold' : 'text-muted'}`} onClick={() => setPane('edit')}><Pencil className="h-4 w-4" />{t('Edit')}</button>
        <button type="button" className={`flex flex-1 items-center justify-center gap-2 py-2 text-sm ${pane === 'preview' ? 'border-b-2 border-brand font-semibold' : 'text-muted'}`} onClick={() => setPane('preview')}><Eye className="h-4 w-4" />{t('Preview')}</button>
      </div>

      <div className="flex min-h-0 flex-1">
        <section className={`${pane === 'edit' ? 'flex' : 'hidden'} min-h-0 w-full flex-col border-r border-line bg-surface lg:flex lg:w-[46%] lg:max-w-[760px]`}>
          <div className="px-3 pt-2">
            <Tabs value={tab} onChange={setTab} tabs={[{ id: 'structure', label: t('Questions') }, { id: 'info', label: t('Paper details') }, { id: 'design', label: t('Design') }, { id: 'checks', label: `${t('Checks')}${issueCount ? ` (${issueCount})` : ''}` }]} />
          </div>
          <fieldset disabled={!canEdit} className="m-0 min-h-0 min-w-0 flex-1 overflow-y-auto border-0 p-3">
            {tab === 'structure' && <StructurePanel customTypes={customTypes} onAdd={onAdd} onEdit={onEdit} onBank={setBankFor} />}
            {tab === 'info' && <InfoPanel />}
            {tab === 'design' && <DesignControls value={paper.design} onChange={(d) => useBuilder.getState().setDesign(d)} templates={[...BUILTIN_TEMPLATES, ...templates]} onTemplate={applyTemplate} />}
            {tab === 'checks' && <ChecksPanel canKeys={canKeys} onEditItem={(id) => canEdit && onEdit(id)} />}
          </fieldset>
        </section>
        <section className={`${pane === 'preview' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 flex-col lg:flex`}>
          {canKeys && (
            <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-1.5 text-sm">
              <span className="text-muted">{t('Preview')}</span>
              <Select className="h-8 w-auto text-xs" value={previewMode} onChange={(e) => setPreviewMode(e.target.value)} aria-label={t('Preview')}>
                <option value="paper">{t('Question paper')}</option>
                <option value="key">{t('Answer key')}</option>
              </Select>
            </div>
          )}
          <PaperViewer className="min-h-0 flex-1" paper={shown.paper || paper} items={shown.items || items} keys={shown.keys || keys} mode={previewMode} />
        </section>
      </div>

      <QuestionEditorModal open={!!editor} onClose={() => setEditor(null)} initial={initial} type={editor ? editor.type : null} customDef={editor ? editor.customDef : null}
        mode="paper" canKey={canEditKeys} defaults={defaults} onSave={onSaveQuestion} />
      <BankPicker open={!!bankFor} onClose={() => setBankFor(null)} onPick={onPickBank} allowedTypes={(paper.sections.find((s) => s.id === bankFor) || {}).allowedTypes || []} />
      <VersionsDialog open={versions} onClose={() => setVersions(false)} canEdit={canEdit} />
      <SetsDialog open={sets} onClose={() => setSets(false)} canKeys={canKeys} canEditKeys={canEditKeys} />
      <Modal open={!!statusDlg} onClose={() => setStatusDlg(null)} size="sm" title={statusDlg ? t(statusDlg.label) : ''}
        footer={(<><Button onClick={() => setStatusDlg(null)}>{t('Cancel')}</Button><Button variant="primary" loading={busyStatus} onClick={() => changeStatus(statusDlg.to, note)}>{t('Confirm')}</Button></>)}>
        <label className="label">{t('Note for the author (optional)')}</label>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </div>
  );
}
