import { useCallback, useEffect, useState } from 'react';
import Modal from '../../components/common/Modal.jsx';
import Button from '../../components/common/Button.jsx';
import { Input, Select } from '../../components/common/Field.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useAcademicLists } from '../../hooks/useCurrent.js';
import { namesOf } from '../../store/academicStore.js';
import { editorFor, newQuestion } from '../../question-types/registry.js';
import { typeLabel, DIFFICULTIES } from '../../constants/questionTypes.js';
import { ISSUE_TEXT } from '../../constants/issues.js';
import { validateQuestion, isMarksComputed, questionMarks } from '../../utils/marks.js';
import { clone } from '../../utils/object.js';

const META = [['className', 'Class', 'classes'], ['group', 'Group', 'groups'], ['department', 'Department', 'departments'], ['subject', 'Subject', 'subjects'], ['chapter', 'Chapter', 'chapters'], ['topic', 'Topic', 'topics']];

// initial: existing question (with .key when loaded) or null; type: type id for a new question
export default function QuestionEditorModal({ open, onClose, initial, type, onSave, mode = 'bank', canKey, defaults, customDef }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const lists = useAcademicLists();
  const [q, setQ] = useState(null);
  const [alsoBank, setAlsoBank] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagText, setTagText] = useState('');

  useEffect(() => {
    if (!open) return;
    const base = initial ? clone(initial) : { ...newQuestion(type, { lang, customDef }), ...(defaults || {}) };
    setQ(base);
    setTagText((base.tags || []).join(', '));
    setAlsoBank(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((fn) => setQ((prev) => (prev ? fn(prev) : prev)), []);
  if (!open || !q) return null;

  const Editor = editorFor(q.type);
  const computed = isMarksComputed(q);

  const save = async () => {
    const errors = validateQuestion(q, canKey ? q.key || null : undefined).filter((i) => i.level === 'error');
    if (errors.length) { toast.error(t(ISSUE_TEXT[errors[0].code])); return; }
    setSaving(true);
    try {
      const ok = await onSave({ ...q, marks: questionMarks(q) }, { alsoBank });
      if (ok !== false) onClose();
    } catch (e) {
      toast.error(t(e.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" dismissible={false}
      title={`${initial ? t('Edit') : t('New')}: ${typeLabel(q.type, lang)}${q.type === 'custom' && q.body.def ? ` (${q.body.def.name})` : ''}`}
      footer={(
        <>
          {mode === 'paper' && !initial && <label className="mr-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={alsoBank} onChange={(e) => setAlsoBank(e.target.checked)} />{t('Also save to question bank')}</label>}
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button variant="primary" loading={saving} onClick={save}>{t('Save question')}</Button>
        </>
      )}
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-36">
          <label className="label">{t('Difficulty')}</label>
          <Select value={q.difficulty || 'medium'} onChange={(e) => update((x) => ({ ...x, difficulty: e.target.value }))}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{t(d)}</option>)}
          </Select>
        </div>
        <div className="w-32">
          <label className="label">{t('Marks')}</label>
          {computed ? <div className="flex h-9 items-center rounded border border-line bg-surface2 px-3 text-sm">{questionMarks(q)}</div>
            : <Input type="number" min={0} step={0.5} value={q.marks ?? ''} onChange={(e) => update((x) => ({ ...x, marks: e.target.value === '' ? '' : Number(e.target.value) }))} />}
        </div>
        {computed && <p className="pb-2 text-xs text-muted">{t('Calculated from the parts of this question.')}</p>}
      </div>

      <Editor key={q.id} q={q} update={update} canKey={canKey} />

      <details className="mt-5 rounded border border-line p-3">
        <summary className="cursor-pointer text-sm font-semibold">{t('Class, subject, chapter and tags')}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {META.map(([k, label, coll]) => (
            <div key={k}>
              <label className="label">{t(label)}</label>
              <Input list={`dl-${k}`} value={q[k] || ''} onChange={(e) => update((x) => ({ ...x, [k]: e.target.value }))} />
              <datalist id={`dl-${k}`}>{namesOf(lists, coll).map((n) => <option key={n} value={n} />)}</datalist>
            </div>
          ))}
          <div className="sm:col-span-3">
            <label className="label">{t('Tags (comma separated)')}</label>
            <Input value={tagText} onChange={(e) => { setTagText(e.target.value); update((x) => ({ ...x, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })); }} />
          </div>
        </div>
      </details>
    </Modal>
  );
}
