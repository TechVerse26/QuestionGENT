import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/common/Modal.jsx';
import Button from '../../components/common/Button.jsx';
import { Input, Select } from '../../components/common/Field.jsx';
import { Badge, Spinner } from '../../components/common/Misc.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent, useDebounced, useAcademicLists } from '../../hooks/useCurrent.js';
import { useBank } from '../../store/bankStore.js';
import { namesOf } from '../../store/academicStore.js';
import { QUESTION_TYPES, DIFFICULTIES } from '../../constants/questionTypes.js';
import { previewText } from '../../utils/question.js';
import { questionMarks } from '../../utils/marks.js';

// Pick one or more questions from the bank; the parent turns them into paper items.
export default function BankPicker({ open, onClose, onPick, allowedTypes = [] }) {
  const { t, lang } = useI18n();
  const { institutionId } = useCurrent();
  const lists = useAcademicLists();
  const { items, loading, error } = useBank();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  const q = useDebounced(search.trim().toLowerCase(), 200);

  useEffect(() => { if (open) { useBank.getState().load(institutionId); setSel([]); } }, [open, institutionId]);

  const rows = useMemo(() => items.filter((x) => x.status !== 'archived'
    && (!allowedTypes.length || allowedTypes.includes(x.type))
    && (!type || x.type === type) && (!subject || x.subject === subject) && (!difficulty || x.difficulty === difficulty)
    && (!q || (x.searchText || '').includes(q))).slice(0, 100), [items, allowedTypes, type, subject, difficulty, q]);

  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const add = async () => {
    setBusy(true);
    try { await onPick(items.filter((x) => sel.includes(x.id))); onClose(); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="xl" title={t('Add from question bank')}
      footer={(<><span className="mr-auto text-sm text-muted">{t('{n} selected', { n: sel.length })}</span><Button onClick={onClose}>{t('Cancel')}</Button><Button variant="primary" disabled={!sel.length} loading={busy} onClick={add}>{t('Add to section')}</Button></>)}>
      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <Input placeholder={t('Search questions')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label={t('Type')}>
          <option value="">{t('All types')}</option>
          {QUESTION_TYPES.filter((x) => !allowedTypes.length || allowedTypes.includes(x.id)).map((x) => <option key={x.id} value={x.id}>{lang === 'bn' ? x.bn : x.en}</option>)}
        </Select>
        <Select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={t('Subject')}>
          <option value="">{t('All subjects')}</option>
          {[...new Set([...namesOf(lists, 'subjects'), ...items.map((x) => x.subject).filter(Boolean)])].sort().map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label={t('Difficulty')}>
          <option value="">{t('Any difficulty')}</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{t(d)}</option>)}
        </Select>
      </div>
      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <p className="err">{t(error)}</p>}
      {!loading && !rows.length && <p className="py-8 text-center text-sm text-muted">{t('No questions match.')}</p>}
      <div className="max-h-[55vh] overflow-y-auto rounded border border-line">
        {rows.map((x) => (
          <label key={x.id} className="flex cursor-pointer items-start gap-3 border-b border-line px-3 py-2 last:border-b-0 hover:bg-surface2">
            <input type="checkbox" className="mt-1" checked={sel.includes(x.id)} onChange={() => toggle(x.id)} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm">{previewText(x, 200) || '—'}</p>
              <p className="mt-1 flex flex-wrap gap-1 text-xs text-muted"><Badge>{QUESTION_TYPES.find((tp) => tp.id === x.type)?.[lang] || x.type}</Badge>{x.subject && <Badge>{x.subject}</Badge>}{x.chapter && <Badge>{x.chapter}</Badge>}<Badge>{t(x.difficulty || 'medium')}</Badge></p>
            </div>
            <span className="shrink-0 text-sm font-semibold">{questionMarks(x)}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
