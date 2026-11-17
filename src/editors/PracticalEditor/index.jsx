import { Plus, Trash2 } from 'lucide-react';
import { RichField, KeySection, RubricEditor, useQ } from '../common.jsx';
import Button from '../../components/common/Button.jsx';
import { Input, Textarea } from '../../components/common/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { newId } from '../../utils/id.js';

export default function PracticalEditor({ q, update, canKey }) {
  const { t } = useI18n();
  const { setBody, setKey, setItem, addItem, delItem } = useQ(update);
  const b = q.body;
  return (
    <div className="space-y-4">
      <RichField label={t('Practical instructions')} value={b.stem} onChange={(stem) => setBody({ stem })} minHeight={100} placeholder={t('Add diagrams and labelling tasks with the image button')} />
      <div>
        <label className="label">{t('Materials (one per line)')}</label>
        <Textarea rows={3} value={b.materials || ''} onChange={(e) => setBody({ materials: e.target.value })} />
      </div>
      <div>
        <div className="mb-2 flex items-center"><span className="label mb-0">{t('Steps')}</span><Button size="sm" icon={Plus} className="ml-auto" onClick={() => addItem('steps', { id: newId(6), content: '' })}>{t('Add step')}</Button></div>
        {(b.steps || []).map((s, i) => (
          <div key={s.id} className="mb-1 flex items-center gap-2">
            <span className="w-6 text-sm text-muted">{i + 1}.</span>
            <Input value={s.content} onChange={(e) => setItem('steps', s.id, { content: e.target.value })} />
            <Button size="icon" variant="ghost" onClick={() => delItem('steps', s.id)} aria-label={t('Remove')}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      <KeySection canKey={canKey} title={t('Marking scheme')}>
        <RichField label={t('Expected result / observations')} value={q.key && q.key.answer} onChange={(answer) => setKey({ answer })} minHeight={70} />
        <RubricEditor value={(q.key && q.key.rubric) || []} onChange={(rubric) => setKey({ rubric })} />
      </KeySection>
    </div>
  );
}
