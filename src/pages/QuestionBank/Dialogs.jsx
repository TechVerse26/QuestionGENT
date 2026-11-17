import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/common/Modal.jsx';
import Button from '../../components/common/Button.jsx';
import { Input, Select, Textarea } from '../../components/common/Field.jsx';
import { Badge, Spinner } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { parseBulkMcq, parsedToMcq } from '../../utils/bulkParse.js';
import { groupDuplicates, previewText } from '../../utils/question.js';
import { DIFFICULTIES } from '../../constants/questionTypes.js';
import { createQuestionsBulk, listHistory, restoreFromHistory, setArchived, bulkUpdateMeta } from '../../services/questionService.js';
import { checkLimit, invalidateUsage } from '../../services/planService.js';
import { millis } from '../../services/db.js';

const SAMPLE = `1. What is the capital of Bangladesh?
A. Chattogram
B. Dhaka
C. Khulna
D. Rajshahi
Answer: B
Explanation: Dhaka is the capital.

২. বাংলাদেশের জাতীয় ফুল কোনটি?
ক. গোলাপ
খ. শাপলা
গ. জবা
ঘ. বেলি
উত্তর: খ`;

export function BulkMcqDialog({ open, onClose, onImported }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user, institution, institutionId, can } = useCurrent();
  const [text, setText] = useState('');
  const [meta, setMeta] = useState({ className: '', subject: '', chapter: '', topic: '', marks: 1 });
  const [busy, setBusy] = useState(false);
  const converted = useMemo(() => parseBulkMcq(text).map((p) => parsedToMcq(p, { lang })), [text, lang]);
  const ok = converted.filter((c) => c.question);
  const bad = converted.filter((c) => c.error).length;
  const noAnswer = ok.filter((c) => c.warning).length;
  const set = (k) => (e) => setMeta((m) => ({ ...m, [k]: e.target.value }));

  const run = async () => {
    setBusy(true);
    try {
      const msg = await checkLimit(institution, 'questions', ok.length);
      if (msg) throw new Error(msg);
      const list = ok.map((c) => ({ question: { ...c.question, ...meta, marks: Number(meta.marks) || 1, tags: [] }, key: can('answerKeys.edit') ? c.key : null }));
      await createQuestionsBulk(institutionId, user.uid, list);
      invalidateUsage(institutionId);
      toast.success(t('{n} question(s) added', { n: list.length }));
      setText('');
      onImported();
      onClose();
    } catch (e) { toast.error(t(e.message)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('Bulk add MCQs')}
      footer={(<><Button onClick={onClose}>{t('Cancel')}</Button><Button variant="primary" disabled={!ok.length} loading={busy} onClick={run}>{t('Add {n} question(s)', { n: ok.length })}</Button></>)}>
      <p className="mb-2 text-sm text-muted">{t('Paste questions in this format. Options use A-D or ক-ঘ; the answer line is optional but recommended.')}</p>
      <pre className="mb-3 max-h-32 overflow-auto rounded border border-line bg-surface2 p-2 text-xs">{SAMPLE}</pre>
      <Textarea rows={10} className="font-mono" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Paste here')} />
      <div className="mt-2 flex flex-wrap gap-2 text-sm"><Badge tone="brand">{t('{n} ready', { n: ok.length })}</Badge>{bad > 0 && <Badge tone="danger">{t('{n} could not be read', { n: bad })}</Badge>}{noAnswer > 0 && <Badge tone="warn">{t('{n} without an answer', { n: noAnswer })}</Badge>}</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        <Input placeholder={t('Class')} value={meta.className} onChange={set('className')} />
        <Input placeholder={t('Subject')} value={meta.subject} onChange={set('subject')} />
        <Input placeholder={t('Chapter')} value={meta.chapter} onChange={set('chapter')} />
        <Input placeholder={t('Topic')} value={meta.topic} onChange={set('topic')} />
        <Input type="number" min={0} step={0.5} value={meta.marks} onChange={set('marks')} aria-label={t('Marks')} />
      </div>
    </Modal>
  );
}

export function HistoryDialog({ item, onClose, onRestored }) {
  const { t } = useI18n();
  const toast = useToast();
  const { user, institutionId } = useCurrent();
  const [list, setList] = useState(null);

  useEffect(() => {
    if (!item) return;
    setList(null);
    listHistory(institutionId, item.id).then(setList).catch((e) => { toast.error(t(e.message)); setList([]); });
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps

  const restore = async (h) => {
    try { await restoreFromHistory(institutionId, user.uid, item, h); toast.success(t('Version restored')); onRestored(); onClose(); } catch (e) { toast.error(t(e.message)); }
  };
  const textOf = (h) => { try { return previewText({ type: h.type, body: JSON.parse(h.data) }, 110); } catch (e) { return ''; } };

  return (
    <Modal open={!!item} onClose={onClose} title={t('Question history')} size="md">
      {list === null && <div className="flex justify-center py-6"><Spinner /></div>}
      {list && !list.length && <p className="py-6 text-center text-sm text-muted">{t('This question has not been edited yet.')}</p>}
      {list && list.map((h) => (
        <div key={h.id} className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-b-0">
          <div className="min-w-0"><p className="text-xs text-muted">{new Date(millis(h.createdAt)).toLocaleString()} / {h.marks} {t('marks')}</p><p className="line-clamp-2 text-sm">{textOf(h) || '—'}</p></div>
          <Button size="sm" onClick={() => restore(h)}>{t('Restore')}</Button>
        </div>
      ))}
    </Modal>
  );
}

export function DuplicatesDialog({ open, onClose, items, onDone }) {
  const { t } = useI18n();
  const toast = useToast();
  const groups = useMemo(() => (open ? groupDuplicates(items.filter((x) => x.status !== 'archived')) : []), [open, items]);
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setSel(groups.flatMap((g) => g.slice(1).map((x) => x.id))); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const run = async () => {
    setBusy(true);
    try { await setArchived(sel, true); toast.success(t('{n} question(s) archived', { n: sel.length })); onDone(); onClose(); } catch (e) { toast.error(t(e.message)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('Possible duplicates')}
      footer={(<><Button onClick={onClose}>{t('Close')}</Button><Button variant="primary" disabled={!sel.length} loading={busy} onClick={run}>{t('Archive {n} selected', { n: sel.length })}</Button></>)}>
      {!groups.length && <p className="py-6 text-center text-sm text-muted">{t('No duplicates found.')}</p>}
      {groups.map((g, i) => (
        <div key={i} className="mb-3 rounded border border-line">
          {g.map((x) => (
            <label key={x.id} className="flex cursor-pointer items-start gap-3 border-b border-line px-3 py-2 last:border-b-0">
              <input type="checkbox" className="mt-1" checked={sel.includes(x.id)} onChange={() => toggle(x.id)} />
              <span className="min-w-0 flex-1 text-sm">{previewText(x, 160)}<span className="ml-2 text-xs text-muted">{new Date(millis(x.createdAt)).toLocaleDateString()}</span></span>
            </label>
          ))}
        </div>
      ))}
      <p className="hint">{t('Ticked questions will be archived (not deleted). The first of each group is kept by default.')}</p>
    </Modal>
  );
}

export function BulkMetaDialog({ open, onClose, ids, onDone }) {
  const { t } = useI18n();
  const toast = useToast();
  const [v, setV] = useState({ className: '', group: '', department: '', subject: '', chapter: '', topic: '', difficulty: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const run = async () => {
    const patch = Object.fromEntries(Object.entries(v).filter(([, val]) => val !== ''));
    if (!Object.keys(patch).length) { toast.error(t('Fill in at least one field.')); return; }
    setBusy(true);
    try { await bulkUpdateMeta(ids, patch); toast.success(t('{n} question(s) updated', { n: ids.length })); onDone(); onClose(); } catch (e) { toast.error(t(e.message)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} size="md" title={t('Edit {n} questions', { n: ids.length })}
      footer={(<><Button onClick={onClose}>{t('Cancel')}</Button><Button variant="primary" loading={busy} onClick={run}>{t('Apply')}</Button></>)}>
      <p className="mb-3 text-sm text-muted">{t('Only the fields you fill in are changed.')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[['className', 'Class'], ['group', 'Group'], ['department', 'Department'], ['subject', 'Subject'], ['chapter', 'Chapter'], ['topic', 'Topic']].map(([k, l]) => (
          <div key={k}><label className="label">{t(l)}</label><Input value={v[k]} onChange={set(k)} /></div>
        ))}
        <div><label className="label">{t('Difficulty')}</label><Select value={v.difficulty} onChange={set('difficulty')}><option value="">—</option>{DIFFICULTIES.map((d) => <option key={d} value={d}>{t(d)}</option>)}</Select></div>
      </div>
    </Modal>
  );
}
