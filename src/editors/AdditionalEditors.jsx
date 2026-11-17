import { Plus, Trash2 } from 'lucide-react';
import { RichField, KeySection, useQ } from './common.jsx';
import Button from '../components/common/Button.jsx';
import { Input, Select, Textarea } from '../components/common/Field.jsx';
import { useI18n } from '../i18n/index.jsx';
import { newId } from '../utils/id.js';
import { formatLabel, NUMBER_STYLES } from '../utils/numbering.js';

export function OrderingEditor({ q, update, canKey }) {
  const { t } = useI18n();
  const { setBody, setItem, addItem, delItem } = useQ(update);
  const b = q.body;
  return (
    <div className="space-y-4">
      <RichField label={t('Instruction')} value={b.stem} onChange={(stem) => setBody({ stem })} minHeight={60} compact />
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="label mb-0">{t('Items in the correct order')}</span>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b.shuffleOnPrint !== false} onChange={(e) => setBody({ shuffleOnPrint: e.target.checked })} />{t('Show shuffled on the paper')}</label>
          <Select className="ml-auto h-8 w-auto text-xs" value={b.itemStyle || 'bnLetter'} onChange={(e) => setBody({ itemStyle: e.target.value })} aria-label={t('Label style')}>
            {NUMBER_STYLES.map((s) => <option key={s} value={s}>{formatLabel(1, s, '({n})')}</option>)}
          </Select>
        </div>
        {(b.items || []).map((it, i) => (
          <div key={it.id} className="mb-1 flex items-center gap-2">
            <span className="w-6 text-sm text-muted">{i + 1}.</span>
            <Input value={it.content} onChange={(e) => setItem('items', it.id, { content: e.target.value })} />
            <Button size="icon" variant="ghost" onClick={() => delItem('items', it.id)} aria-label={t('Remove')}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button size="sm" icon={Plus} onClick={() => addItem('items', { id: newId(6), content: '' })}>{t('Add item')}</Button>
      </div>
      {canKey && <p className="hint">{t('The order you enter here is the answer key.')}</p>}
    </div>
  );
}

export function NumericEditor({ q, update, canKey }) {
  const { t } = useI18n();
  const { setBody, setKey } = useQ(update);
  const key = q.key || {};
  return (
    <div className="space-y-4">
      <RichField label={t('Question')} value={q.body.stem} onChange={(stem) => setBody({ stem })} />
      <KeySection canKey={canKey}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label">{t('Correct value')}</label><Input value={key.value || ''} onChange={(e) => setKey({ value: e.target.value })} /></div>
          <div><label className="label">{t('Tolerance (±)')}</label><Input value={key.tolerance || ''} onChange={(e) => setKey({ tolerance: e.target.value })} /></div>
          <div><label className="label">{t('Unit')}</label><Input value={key.unit || ''} onChange={(e) => setKey({ unit: e.target.value })} /></div>
        </div>
        <RichField label={t('Worked solution')} value={key.solution} onChange={(solution) => setKey({ solution })} minHeight={60} compact />
      </KeySection>
    </div>
  );
}

export function ProgrammingEditor({ q, update, canKey }) {
  const { t } = useI18n();
  const { setBody, setKey } = useQ(update);
  const b = q.body;
  const key = q.key || {};
  return (
    <div className="space-y-4">
      <RichField label={t('Problem statement')} value={b.stem} onChange={(stem) => setBody({ stem })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">{t('Language')}</label><Input value={b.language || ''} onChange={(e) => setBody({ language: e.target.value })} placeholder="Python, C, JavaScript..." /></div>
        <div><label className="label">{t('Constraints')}</label><Input value={b.constraints || ''} onChange={(e) => setBody({ constraints: e.target.value })} /></div>
        <div><label className="label">{t('Sample input')}</label><Textarea className="font-mono" rows={3} value={b.sampleInput || ''} onChange={(e) => setBody({ sampleInput: e.target.value })} /></div>
        <div><label className="label">{t('Sample output')}</label><Textarea className="font-mono" rows={3} value={b.sampleOutput || ''} onChange={(e) => setBody({ sampleOutput: e.target.value })} /></div>
      </div>
      <KeySection canKey={canKey}>
        <div><label className="label">{t('Reference solution')}</label><Textarea className="font-mono" rows={6} value={key.solutionCode || ''} onChange={(e) => setKey({ solutionCode: e.target.value })} /></div>
        <RichField label={t('Explanation')} value={key.explanation} onChange={(explanation) => setKey({ explanation })} minHeight={50} compact />
      </KeySection>
    </div>
  );
}
