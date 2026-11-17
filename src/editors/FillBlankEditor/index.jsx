import { RichField, KeySection, NumberField, useQ } from '../common.jsx';
import { Input } from '../../components/common/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { countBlanks, questionMarks } from '../../utils/marks.js';

export default function FillBlankEditor({ q, update, canKey }) {
  const { t } = useI18n();
  const { setBody, setKey } = useQ(update);
  const b = q.body;
  const blanks = countBlanks(b.text);
  const answers = (q.key && q.key.answers) || [];
  const setAnswer = (i, v) => { const a = Array.from({ length: blanks }, (_, k) => answers[k] || ''); a[i] = v; setKey({ answers: a }); };

  const extra = (editor) => (
    <button type="button" className="btn btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().insertContent('_____ ').run()}>{t('Insert blank')}</button>
  );

  return (
    <div className="space-y-4">
      <RichField label={t('Sentence with blanks')} value={b.text} onChange={(text) => setBody({ text })} toolbarExtra={extra} placeholder={t('Use the "Insert blank" button where the answer goes')} />
      <div className="flex flex-wrap items-end gap-4">
        <NumberField className="w-40" label={t('Marks per blank')} value={b.marksPerBlank ?? 1} onChange={(marksPerBlank) => setBody({ marksPerBlank })} />
        <p className="pb-2 text-sm text-muted">{t('{n} blank(s), total marks {m}', { n: blanks, m: questionMarks(q) })}</p>
      </div>
      <KeySection canKey={canKey} title={t('Answers')}>
        {blanks === 0 && <p className="text-sm text-muted">{t('Add at least one blank to enter answers.')}</p>}
        {Array.from({ length: blanks }, (_, i) => (
          <div key={i} className="flex items-center gap-2"><span className="w-8 text-sm text-muted">{i + 1}.</span><Input value={answers[i] || ''} onChange={(e) => setAnswer(i, e.target.value)} /></div>
        ))}
      </KeySection>
    </div>
  );
}
