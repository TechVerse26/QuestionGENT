import { Plus, Trash2 } from 'lucide-react';
import { RichField, KeySection, RubricEditor, useQ } from '../common.jsx';
import RichTextEditor from '../../components/editor/RichTextEditor.jsx';
import Button from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { newId } from '../../utils/id.js';
import { emptyDoc } from '../../utils/richtext.js';
import { BN_LETTERS } from '../../utils/numbering.js';

// Shared by short, broad, mathematical, grammar and translation questions:
// a stem, optional labelled parts, and an answer with a marking rubric.
export function WrittenEditor({ q, update, canKey, stemLabel, stemHeight = 90, answerLabel, children }) {
  const { t } = useI18n();
  const { setBody, setKey, setItem, addItem, delItem } = useQ(update);
  const b = q.body;
  const parts = b.parts || [];
  const key = q.key || {};

  return (
    <div className="space-y-4">
      <RichField label={stemLabel || t('Question')} value={b.stem} onChange={(stem) => setBody({ stem })} minHeight={stemHeight} placeholder={t('Type the question here')} />
      {children}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="label mb-0">{t('Sub-parts (optional)')}</span>
          <Button size="sm" icon={Plus} className="ml-auto" onClick={() => addItem('parts', { id: newId(6), label: BN_LETTERS[parts.length] || String(parts.length + 1), content: emptyDoc(), marks: 1 })}>{t('Add part')}</Button>
        </div>
        {parts.length > 0 && <p className="hint mb-2">{t('With sub-parts, the question marks are the sum of the part marks.')}</p>}
        <div className="space-y-2">
          {parts.map((p) => (
            <div key={p.id} className="flex items-start gap-2">
              <Input className="w-16" value={p.label} onChange={(e) => setItem('parts', p.id, { label: e.target.value })} aria-label={t('Label')} />
              <div className="min-w-0 flex-1"><RichTextEditor key={p.id} value={p.content} onChange={(content) => setItem('parts', p.id, { content })} compact minHeight={40} /></div>
              <Input className="w-20" type="number" min={0} step={0.5} value={p.marks} onChange={(e) => setItem('parts', p.id, { marks: Number(e.target.value) })} aria-label={t('Marks')} />
              <Button size="icon" variant="ghost" onClick={() => delItem('parts', p.id)} aria-label={t('Remove')}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>
      <KeySection canKey={canKey}>
        <RichField label={answerLabel || t('Model answer')} value={key.answer} onChange={(answer) => setKey({ answer })} minHeight={80} />
        <RubricEditor value={key.rubric || []} onChange={(rubric) => setKey({ rubric })} />
      </KeySection>
    </div>
  );
}

export default function ShortQuestionEditor(props) {
  return <WrittenEditor {...props} />;
}
