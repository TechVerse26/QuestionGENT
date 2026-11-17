import { Plus, Trash2 } from 'lucide-react';
import { RichField, KeySection, NumberField, useQ } from '../common.jsx';
import RichTextEditor from '../../components/editor/RichTextEditor.jsx';
import Button from '../../components/common/Button.jsx';
import { Select } from '../../components/common/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { newId } from '../../utils/id.js';
import { emptyDoc } from '../../utils/richtext.js';
import { formatLabel, NUMBER_STYLES } from '../../utils/numbering.js';

// Also used for "assertion and reason" questions (q.type === 'assertion')
export default function MCQEditor({ q, update, canKey }) {
  const { t } = useI18n();
  const { setBody, setKey, addItem, delItem, setItem } = useQ(update);
  const b = q.body;
  const isAssertion = q.type === 'assertion';
  const correct = (q.key && q.key.correct) || [];

  const toggle = (id) => {
    if (b.multi) setKey({ correct: correct.includes(id) ? correct.filter((x) => x !== id) : [...correct, id] });
    else setKey({ correct: [id] });
  };

  return (
    <div className="space-y-4">
      {isAssertion ? (
        <>
          <RichField label={t('Assertion (A)')} value={b.assertion} onChange={(assertion) => setBody({ assertion })} minHeight={60} />
          <RichField label={t('Reason (R)')} value={b.reason} onChange={(reason) => setBody({ reason })} minHeight={60} />
        </>
      ) : (
        <RichField label={t('Question')} value={b.stem} onChange={(stem) => setBody({ stem })} placeholder={t('Type the question here')} />
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-end gap-3">
          <span className="label mb-0">{t('Options')}</span>
          {!isAssertion && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!b.multi} onChange={(e) => { setBody({ multi: e.target.checked }); if (!e.target.checked) setKey({ correct: correct.slice(0, 1) }); }} />{t('Multiple correct answers')}</label>}
          {!isAssertion && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b.shuffle !== false} onChange={(e) => setBody({ shuffle: e.target.checked })} />{t('Allow shuffling in sets')}</label>}
          <div className="ml-auto flex items-center gap-2">
            <Select className="h-8 w-auto text-xs" value={b.optionStyle || 'bnLetter'} onChange={(e) => setBody({ optionStyle: e.target.value })} aria-label={t('Option labels')}>
              {NUMBER_STYLES.map((s) => <option key={s} value={s}>{formatLabel(1, s, '{n}')}, {formatLabel(2, s, '{n}')}, {formatLabel(3, s, '{n}')}</option>)}
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          {(b.options || []).map((o, i) => (
            <div key={o.id} className="flex items-start gap-2">
              {canKey && (
                <input className="mt-3" type={b.multi ? 'checkbox' : 'radio'} name={`correct-${q.id}`} checked={correct.includes(o.id)} onChange={() => toggle(o.id)} aria-label={t('Correct answer')} title={t('Correct answer')} />
              )}
              <span className="mt-2 w-8 shrink-0 text-sm font-semibold">{formatLabel(i + 1, b.optionStyle || 'bnLetter', b.optionPattern || '{n}.')}</span>
              <div className="min-w-0 flex-1"><RichTextEditor key={o.id} value={o.content} onChange={(content) => setItem('options', o.id, { content })} compact minHeight={36} /></div>
              {!isAssertion && <label className="mt-2 flex items-center gap-1 text-xs text-muted" title={t('Keep this option in place when shuffling')}><input type="checkbox" checked={!!o.fixed} onChange={(e) => setItem('options', o.id, { fixed: e.target.checked })} />{t('Fixed')}</label>}
              {!isAssertion && <Button size="icon" variant="ghost" disabled={(b.options || []).length <= 2} onClick={() => { delItem('options', o.id); if (correct.includes(o.id)) setKey({ correct: correct.filter((x) => x !== o.id) }); }} aria-label={t('Remove option')}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
        </div>
        {!isAssertion && <Button size="sm" icon={Plus} className="mt-2" onClick={() => addItem('options', { id: newId(6), content: emptyDoc() })}>{t('Add option')}</Button>}
        {!canKey && <p className="hint">{t('You can edit the options, but not the correct answer, with your role.')}</p>}
      </div>

      <NumberField className="max-w-[10rem]" label={t('Negative marking (per wrong answer)')} value={b.negative ?? 0} onChange={(negative) => setBody({ negative })} />

      <KeySection canKey={canKey}>
        <RichField label={t('Explanation')} value={q.key && q.key.explanation} onChange={(explanation) => setKey({ explanation })} minHeight={60} />
      </KeySection>
    </div>
  );
}
