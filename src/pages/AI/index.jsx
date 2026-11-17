import { useState } from 'react';
import { Sparkles, Pencil } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import { Field, Input, Select, Textarea } from '../../components/common/Field.jsx';
import { Badge, PageHeader } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import QuestionEditorModal from '../QuestionBuilder/QuestionEditorModal.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent, useAcademicLists } from '../../hooks/useCurrent.js';
import { useBank } from '../../store/bankStore.js';
import { namesOf } from '../../store/academicStore.js';
import { generateQuestionsAI, aiToQuestions, aiMode } from '../../services/aiService.js';
import { getAiKey } from '../../services/aiKey.js';
import KeyPanel from './KeyPanel.jsx';
import { createQuestionsBulk } from '../../services/questionService.js';
import { checkLimit, invalidateUsage } from '../../services/planService.js';
import { previewText } from '../../utils/question.js';
import { questionMarks } from '../../utils/marks.js';
import { typeLabel, DIFFICULTIES } from '../../constants/questionTypes.js';
import { readAsText } from '../../utils/download.js';

const AI_TYPES = ['mcq', 'cq', 'short', 'broad', 'math', 'tf'];

export default function AIGenerator() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user, institution, institutionId, can } = useCurrent();
  const lists = useAcademicLists();
  const [f, setF] = useState({ className: '', subject: '', chapter: '', topic: '', type: 'mcq', language: lang, difficulty: 'medium', count: 5, marks: 1, objectives: '', material: '' });
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const [sel, setSel] = useState([]);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  // Default mode: free Gemini with the user's own key, called from the browser (no Cloud Functions, no billing).
  const direct = aiMode() === 'direct';
  const uid = user ? user.uid : '';
  const [hasKey, setHasKey] = useState(() => !direct || !!getAiKey(uid));
  const [keyOpen, setKeyOpen] = useState(() => direct && !getAiKey(uid));
  const [usedModel, setUsedModel] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const generate = async () => {
    if (!f.subject.trim()) { toast.error(t('Enter a subject.')); return; }
    if (direct && !hasKey) { setKeyOpen(true); toast.info(t('Add your free Gemini key first.')); return; }
    setBusy(true);
    try {
      const { questions: items, model } = await generateQuestionsAI({ institutionId, ...f, count: Number(f.count), marks: Number(f.marks) }, { uid });
      setUsedModel(model || '');
      const qs = aiToQuestions(items, { lang: f.language, defaults: { className: f.className, subject: f.subject, chapter: f.chapter, topic: f.topic, difficulty: f.difficulty } }).map((x, i) => ({ ...x, uid: `${Date.now()}-${i}` }));
      setResults(qs);
      setSel(qs.map((x) => x.uid));
      if (!qs.length) toast.info(t('The AI returned no usable questions. Try again or adjust the request.'));
    } catch (e) {
      if (e && e.code === 'no-key') setHasKey(false);
      if (e && ['no-key', 'bad-key', 'leaked', 'forbidden'].includes(e.code)) setKeyOpen(true);
      const unavailable = ['functions/not-found', 'functions/unavailable', 'functions/internal'].includes(e.code);
      const detail = e && e.code === 'unknown' && e.detail ? ` (${String(e.detail).slice(0, 140)})` : '';
      toast.error(unavailable ? t('AI generation is not set up for this project. Creating questions manually still works.') : `${t(e.message, e.params)}${detail}`);
    } finally { setBusy(false); }
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 200 * 1024) { toast.error(t('Use a text file smaller than 200 KB, or paste the text.')); return; }
    const text = await readAsText(file);
    setF((x) => ({ ...x, material: text.slice(0, 12000) }));
  };

  const saveSelected = async () => {
    setSaving(true);
    try {
      const chosen = results.filter((x) => sel.includes(x.uid));
      const msg = await checkLimit(institution, 'questions', chosen.length);
      if (msg) throw new Error(msg);
      await createQuestionsBulk(institutionId, user.uid, chosen.map((x) => ({ question: x.question, key: can('answerKeys.edit') ? x.key : null })));
      invalidateUsage(institutionId);
      useBank.getState().invalidate();
      setResults((r) => r.filter((x) => !sel.includes(x.uid)));
      setSel([]);
      toast.success(t('{n} question(s) saved to the bank', { n: chosen.length }));
    } catch (e) { toast.error(t(e.message)); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title={t('AI question generator')} subtitle={t('Drafts only. Review and edit every question and answer before saving.')} />
      {direct && <KeyPanel uid={uid} open={keyOpen} onOpenChange={setKeyOpen} onKeyChange={setHasKey} />}
      <div className="panel mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('Class')}><Input list="ai-class" value={f.className} onChange={set('className')} /></Field>
          <Field label={t('Subject')}><Input list="ai-subject" value={f.subject} onChange={set('subject')} /></Field>
          <Field label={t('Chapter')}><Input value={f.chapter} onChange={set('chapter')} /></Field>
          <Field label={t('Topic')}><Input value={f.topic} onChange={set('topic')} /></Field>
          <Field label={t('Question type')}><Select value={f.type} onChange={set('type')}>{AI_TYPES.map((x) => <option key={x} value={x}>{typeLabel(x, lang)}</option>)}</Select></Field>
          <Field label={t('Language')}><Select value={f.language} onChange={set('language')}><option value="bn">বাংলা</option><option value="en">English</option></Select></Field>
          <Field label={t('Difficulty')}><Select value={f.difficulty} onChange={set('difficulty')}>{DIFFICULTIES.map((d) => <option key={d} value={d}>{t(d)}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-2"><Field label={t('Number')}><Input type="number" min={1} max={20} value={f.count} onChange={set('count')} /></Field><Field label={t('Marks each')}><Input type="number" min={1} step={0.5} value={f.marks} onChange={set('marks')} /></Field></div>
        </div>
        <datalist id="ai-class">{namesOf(lists, 'classes').map((n) => <option key={n} value={n} />)}</datalist>
        <datalist id="ai-subject">{namesOf(lists, 'subjects').map((n) => <option key={n} value={n} />)}</datalist>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Field label={t('Learning objectives (optional)')}><Textarea rows={3} value={f.objectives} onChange={set('objectives')} /></Field>
          <Field label={t('Study material (optional, pasted text)')}>
            <Textarea rows={3} value={f.material} onChange={set('material')} placeholder={t('Questions will be based on this text')} />
          </Field>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted">{t('Load a .txt file')}: <input type="file" accept=".txt,text/plain" onChange={onFile} className="text-sm" /></label>
          <Button variant="primary" icon={Sparkles} loading={busy} onClick={generate} className="ml-auto">{t('Generate')}</Button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="panel">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <strong className="text-sm">{t('{n} generated', { n: results.length })}</strong><Badge tone="warn">{t('Not reviewed')}</Badge>{usedModel && <span className="text-xs text-muted">{usedModel}</span>}
            <Button size="sm" variant="primary" className="ml-auto" disabled={!sel.length} loading={saving} onClick={saveSelected}>{t('Save {n} to question bank', { n: sel.length })}</Button>
          </div>
          {results.map((x) => (
            <div key={x.uid} className="flex items-start gap-3 border-b border-line px-3 py-2 last:border-b-0">
              <input type="checkbox" className="mt-1" checked={sel.includes(x.uid)} onChange={() => setSel((s) => (s.includes(x.uid) ? s.filter((i) => i !== x.uid) : [...s, x.uid]))} />
              <div className="min-w-0 flex-1"><p className="text-sm">{previewText(x.question, 260)}</p><p className="mt-1 text-xs text-muted">{typeLabel(x.question.type, lang)} / {questionMarks(x.question)} {t('marks')}</p></div>
              <Button size="icon" variant="ghost" onClick={() => setEdit({ ...x, initial: { ...x.question, id: x.uid, key: x.key } })} aria-label={t('Edit')}><Pencil className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
      <QuestionEditorModal open={!!edit} onClose={() => setEdit(null)} initial={edit ? edit.initial : null} mode="bank" canKey={can('answerKeys.edit')}
        onSave={async (q) => { const { key, id, ...question } = q; setResults((r) => r.map((x) => (x.uid === edit.uid ? { ...x, question, key } : x))); return true; }} />
    </div>
  );
}
