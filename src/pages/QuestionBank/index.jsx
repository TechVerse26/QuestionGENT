import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Star, Pencil, History, Copy, Archive, ArchiveRestore, Trash2, ListPlus, SearchCheck, Download } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import { Input, Select } from '../../components/common/Field.jsx';
import { Badge, EmptyState, PageHeader, Pagination, Skeleton, Tabs } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useConfirm } from '../../components/common/Confirm.jsx';
import QuestionEditorModal from '../QuestionBuilder/QuestionEditorModal.jsx';
import { BulkMcqDialog, HistoryDialog, DuplicatesDialog, BulkMetaDialog } from './Dialogs.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent, useDebounced, useAcademicLists } from '../../hooks/useCurrent.js';
import { useBank } from '../../store/bankStore.js';
import { namesOf } from '../../store/academicStore.js';
import { QUESTION_TYPES, DIFFICULTIES, typeLabel } from '../../constants/questionTypes.js';
import { previewText } from '../../utils/question.js';
import { questionMarks } from '../../utils/marks.js';
import { downloadBankJson } from '../../export/jsonExport.js';
import { createQuestion, updateQuestion, getBankKeys, setArchived, toggleFavorite, deleteQuestions, findDuplicateIds } from '../../services/questionService.js';
import { listCustomTypes } from '../../services/templateService.js';
import { checkLimit, invalidateUsage } from '../../services/planService.js';
import { logActivity } from '../../services/activityService.js';
import { millis } from '../../services/db.js';

const PAGE = 20;
const DIFF_RANK = { easy: 0, medium: 1, hard: 2 };

export default function QuestionBank() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [sp, setSp] = useSearchParams();
  const { user, institution, institutionId, can } = useCurrent();
  const lists = useAcademicLists();
  const { items, loading, error } = useBank();
  const canKeys = can('answerKeys.view');
  const canEditKeys = can('answerKeys.edit');
  const canCreate = can('questions.create');
  const [f, setF] = useState({ search: '', type: '', difficulty: '', className: '', subject: '', tab: 'active', sort: 'newest' });
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState([]);
  const [editor, setEditor] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [history, setHistory] = useState(null);
  const [picker, setPicker] = useState(false);
  const [customTypes, setCustomTypes] = useState([]);
  const search = useDebounced(f.search.trim().toLowerCase(), 200);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(1); };

  useEffect(() => { useBank.getState().load(institutionId); listCustomTypes(institutionId).then(setCustomTypes).catch(() => {}); }, [institutionId]);
  useEffect(() => { if (sp.get('new') && canCreate) { setPicker(true); sp.delete('new'); setSp(sp, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = () => useBank.getState().load(institutionId, true);
  const mine = (x) => can('questions.edit_all') || (canCreate && x.createdBy === user.uid);

  const rows = useMemo(() => {
    const out = items.filter((x) => {
      if (f.tab === 'archived' ? x.status !== 'archived' : x.status === 'archived') return false;
      if (f.tab === 'favorites' && !(x.favoritedBy || []).includes(user.uid)) return false;
      return (!f.type || x.type === f.type) && (!f.difficulty || x.difficulty === f.difficulty) && (!f.className || x.className === f.className)
        && (!f.subject || x.subject === f.subject) && (!search || (x.searchText || '').includes(search));
    });
    if (f.sort === 'oldest') out.sort((a, b) => millis(a.createdAt) - millis(b.createdAt));
    else if (f.sort === 'marks') out.sort((a, b) => questionMarks(b) - questionMarks(a));
    else if (f.sort === 'difficulty') out.sort((a, b) => (DIFF_RANK[b.difficulty] ?? 1) - (DIFF_RANK[a.difficulty] ?? 1));
    return out;
  }, [items, f, search, user.uid]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const visible = rows.slice((page - 1) * PAGE, page * PAGE);
  const allSel = visible.length > 0 && visible.every((x) => sel.includes(x.id));
  const toggleSel = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const openEdit = async (x) => {
    const key = canKeys ? (await getBankKeys([x.id]))[x.id] : undefined;
    setEditor({ initial: { ...x, key } });
  };

  const onSave = async (q) => {
    const { key, ...question } = q;
    if (editor.initial) {
      await updateQuestion(institutionId, user.uid, question, canEditKeys ? key || null : undefined, editor.initial);
    } else {
      const msg = await checkLimit(institution, 'questions');
      if (msg) throw new Error(msg);
      const dups = await findDuplicateIds(institutionId, question);
      if (dups.length && !(await confirm({ title: t('Similar question found'), message: t('A question with the same text already exists in the bank. Save this one anyway?'), confirmLabel: t('Save anyway') }))) return false;
      await createQuestion(institutionId, user.uid, question, canEditKeys ? key : null);
      invalidateUsage(institutionId);
    }
    toast.success(t('Question saved'));
    await reload();
    return true;
  };

  const duplicate = async (x) => {
    try {
      const msg = await checkLimit(institution, 'questions');
      if (msg) throw new Error(msg);
      const key = canKeys ? (await getBankKeys([x.id]))[x.id] : null;
      const { id, ...copy } = x;
      await createQuestion(institutionId, user.uid, copy, canEditKeys ? key : null);
      invalidateUsage(institutionId);
      toast.success(t('Question duplicated'));
      reload();
    } catch (e) { toast.error(t(e.message)); }
  };

  const fav = async (x) => {
    const on = !(x.favoritedBy || []).includes(user.uid);
    useBank.setState((s) => ({ items: s.items.map((i) => (i.id === x.id ? { ...i, favoritedBy: on ? [...(i.favoritedBy || []), user.uid] : (i.favoritedBy || []).filter((u) => u !== user.uid) } : i)) }));
    try { await toggleFavorite(x.id, user.uid, on); } catch (e) { toast.error(t(e.message)); reload(); }
  };

  const archive = async (ids, archived) => {
    try { await setArchived(ids, archived); setSel([]); toast.success(archived ? t('{n} question(s) archived', { n: ids.length }) : t('{n} question(s) restored', { n: ids.length })); reload(); } catch (e) { toast.error(t(e.message)); }
  };

  const remove = async (ids) => {
    if (!(await confirm({ title: t('Delete questions'), message: t('Permanently delete {n} question(s)? Papers that already use them keep their own copy.', { n: ids.length }), danger: true, confirmLabel: t('Delete') }))) return;
    try { await deleteQuestions(ids, canEditKeys); setSel([]); invalidateUsage(institutionId); logActivity(institutionId, user.uid, 'questions.delete', { n: ids.length }); toast.success(t('Deleted')); reload(); } catch (e) { toast.error(t(e.message)); }
  };

  const startNew = (type, customDef) => { setPicker(false); setEditor({ type, customDef }); };

  return (
    <div>
      <PageHeader title={t('Question bank')} subtitle={t('{n} questions', { n: items.filter((x) => x.status !== 'archived').length })}
        actions={(
          <>
            <Button icon={SearchCheck} onClick={() => setDialog('dups')}>{t('Find duplicates')}</Button>
            <Button icon={Download} onClick={() => downloadBankJson(rows.length ? rows : items)}>{t('Export JSON')}</Button>
            {canCreate && <Button icon={ListPlus} onClick={() => setDialog('bulk')}>{t('Bulk add MCQs')}</Button>}
            {canCreate && <Button variant="primary" icon={Plus} onClick={() => setPicker(true)}>{t('New question')}</Button>}
          </>
        )} />

      <Tabs value={f.tab} onChange={(tab) => { setF((x) => ({ ...x, tab })); setPage(1); setSel([]); }} tabs={[{ id: 'active', label: t('Active') }, { id: 'favorites', label: t('Favorites') }, { id: 'archived', label: t('Archived') }]} />
      <div className="my-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Input className="lg:col-span-2" placeholder={t('Search questions, chapters, tags')} value={f.search} onChange={set('search')} />
        <Select value={f.type} onChange={set('type')} aria-label={t('Type')}><option value="">{t('All types')}</option>{QUESTION_TYPES.map((x) => <option key={x.id} value={x.id}>{lang === 'bn' ? x.bn : x.en}</option>)}</Select>
        <Select value={f.className} onChange={set('className')} aria-label={t('Class')}><option value="">{t('All classes')}</option>{[...new Set([...namesOf(lists, 'classes'), ...items.map((x) => x.className).filter(Boolean)])].sort().map((n) => <option key={n} value={n}>{n}</option>)}</Select>
        <Select value={f.subject} onChange={set('subject')} aria-label={t('Subject')}><option value="">{t('All subjects')}</option>{[...new Set([...namesOf(lists, 'subjects'), ...items.map((x) => x.subject).filter(Boolean)])].sort().map((n) => <option key={n} value={n}>{n}</option>)}</Select>
        <Select value={f.sort} onChange={set('sort')} aria-label={t('Sort')}><option value="newest">{t('Newest first')}</option><option value="oldest">{t('Oldest first')}</option><option value="marks">{t('Highest marks')}</option><option value="difficulty">{t('Hardest first')}</option></Select>
      </div>

      {sel.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-brand/40 bg-brand-soft px-3 py-2 text-sm">
          <strong>{t('{n} selected', { n: sel.length })}</strong>
          {f.tab !== 'archived' ? <Button size="sm" icon={Archive} onClick={() => archive(sel, true)}>{t('Archive')}</Button> : <Button size="sm" icon={ArchiveRestore} onClick={() => archive(sel, false)}>{t('Restore')}</Button>}
          {canCreate && <Button size="sm" icon={Pencil} onClick={() => setDialog('meta')}>{t('Edit class / subject')}</Button>}
          {can('questions.delete') && <Button size="sm" variant="danger" icon={Trash2} onClick={() => remove(sel)}>{t('Delete')}</Button>}
          <Button size="sm" variant="ghost" onClick={() => setSel([])}>{t('Clear')}</Button>
        </div>
      )}

      <div className="panel overflow-x-auto">
        {loading && !items.length ? <div className="space-y-3 p-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          : error ? <p className="p-4 err">{t(error)}</p>
            : !rows.length ? <EmptyState title={t('No questions found')} text={t('Add a question, bulk-add MCQs, or import a file to fill your bank.')} />
              : (
                <table className="tbl min-w-[760px]">
                  <thead><tr>
                    <th className="w-8"><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? sel.filter((id) => !visible.some((x) => x.id === id)) : [...new Set([...sel, ...visible.map((x) => x.id)])])} aria-label={t('Select all')} /></th>
                    <th>{t('Question')}</th><th>{t('Type')}</th><th>{t('Subject / chapter')}</th><th>{t('Marks')}</th><th>{t('Difficulty')}</th><th className="w-40" />
                  </tr></thead>
                  <tbody>
                    {visible.map((x) => (
                      <tr key={x.id}>
                        <td><input type="checkbox" checked={sel.includes(x.id)} onChange={() => toggleSel(x.id)} aria-label={t('Select')} /></td>
                        <td className="max-w-md"><p className="line-clamp-2">{previewText(x, 180) || '—'}</p>{(x.tags || []).length > 0 && <p className="mt-1 flex flex-wrap gap-1">{x.tags.slice(0, 4).map((g) => <Badge key={g}>{g}</Badge>)}</p>}</td>
                        <td className="whitespace-nowrap">{typeLabel(x.type, lang)}</td>
                        <td className="text-muted">{[x.className, x.subject, x.chapter].filter(Boolean).join(' / ') || '—'}</td>
                        <td>{questionMarks(x)}</td>
                        <td><Badge tone={x.difficulty === 'hard' ? 'danger' : x.difficulty === 'easy' ? 'brand' : ''}>{t(x.difficulty || 'medium')}</Badge></td>
                        <td>
                          <div className="flex justify-end">
                            <Button size="icon" variant="ghost" onClick={() => fav(x)} aria-label={t('Favorite')}><Star className={`h-4 w-4 ${(x.favoritedBy || []).includes(user.uid) ? 'fill-current text-warn' : ''}`} /></Button>
                            {mine(x) && <Button size="icon" variant="ghost" onClick={() => openEdit(x)} aria-label={t('Edit')}><Pencil className="h-4 w-4" /></Button>}
                            <Button size="icon" variant="ghost" onClick={() => setHistory(x)} aria-label={t('History')}><History className="h-4 w-4" /></Button>
                            {canCreate && <Button size="icon" variant="ghost" onClick={() => duplicate(x)} aria-label={t('Duplicate')}><Copy className="h-4 w-4" /></Button>}
                            {mine(x) && <Button size="icon" variant="ghost" onClick={() => archive([x.id], x.status !== 'archived')} aria-label={x.status === 'archived' ? t('Restore') : t('Archive')}>{x.status === 'archived' ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</Button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
      </div>
      <Pagination page={page} pages={pages} onChange={setPage} />

      <Modal open={picker} onClose={() => setPicker(false)} title={t('Choose a question type')} size="md">
        <div className="grid gap-x-4 sm:grid-cols-2">
          {QUESTION_TYPES.filter((x) => x.id !== 'custom').map((x) => <button key={x.id} type="button" className="border-b border-line px-1 py-2 text-left text-sm hover:text-brand" onClick={() => startNew(x.id)}>{lang === 'bn' ? x.bn : x.en}</button>)}
          {customTypes.map((c) => <button key={c.id} type="button" className="border-b border-line px-1 py-2 text-left text-sm hover:text-brand" onClick={() => startNew('custom', { id: c.id, name: c.name, fields: c.fields })}>{c.name}</button>)}
        </div>
      </Modal>
      <QuestionEditorModal open={!!editor} onClose={() => setEditor(null)} initial={editor ? editor.initial : null} type={editor ? editor.type : null} customDef={editor ? editor.customDef : null} mode="bank" canKey={canEditKeys} onSave={onSave} />
      <BulkMcqDialog open={dialog === 'bulk'} onClose={() => setDialog(null)} onImported={reload} />
      <DuplicatesDialog open={dialog === 'dups'} onClose={() => setDialog(null)} items={items} onDone={reload} />
      <BulkMetaDialog open={dialog === 'meta'} onClose={() => setDialog(null)} ids={sel} onDone={() => { setSel([]); reload(); }} />
      <HistoryDialog item={history} onClose={() => setHistory(null)} onRestored={reload} />
    </div>
  );
}
