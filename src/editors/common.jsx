import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import RichTextEditor from '../components/editor/RichTextEditor.jsx';
import Button from '../components/common/Button.jsx';
import { Input } from '../components/common/Field.jsx';
import { useI18n } from '../i18n/index.jsx';
import { newId } from '../utils/id.js';

// Functional-update helpers so editors never write stale state
export function useQ(update) {
  return useMemo(() => ({
    setBody: (patch) => update((q) => ({ ...q, body: { ...q.body, ...patch } })),
    setKey: (patch) => update((q) => ({ ...q, key: { ...(q.key || {}), ...patch } })),
    setField: (patch) => update((q) => ({ ...q, ...patch })),
    setItem: (list, id, patch) => update((q) => ({ ...q, body: { ...q.body, [list]: (q.body[list] || []).map((x) => (x.id === id ? { ...x, ...patch } : x)) } })),
    addItem: (list, item) => update((q) => ({ ...q, body: { ...q.body, [list]: [...(q.body[list] || []), item] } })),
    delItem: (list, id) => update((q) => ({ ...q, body: { ...q.body, [list]: (q.body[list] || []).filter((x) => x.id !== id) } })),
    setKeyIn: (field, id, value) => update((q) => ({ ...q, key: { ...(q.key || {}), [field]: { ...((q.key && q.key[field]) || {}), [id]: value } } })),
  }), [update]);
}

export function RichField({ label, value, onChange, placeholder, minHeight = 90, compact = false, toolbarExtra }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <RichTextEditor value={value} onChange={onChange} placeholder={placeholder} minHeight={minHeight} compact={compact} toolbarExtra={toolbarExtra} />
    </div>
  );
}

export function KeySection({ canKey, title, children }) {
  const { t } = useI18n();
  if (!canKey) return null;
  return (
    <fieldset className="mt-5 rounded border border-dashed border-brand/60 p-3">
      <legend className="px-1 text-sm font-semibold text-brand">{title || t('Answer key')}</legend>
      <div className="space-y-3">{children}</div>
    </fieldset>
  );
}

export function NumberField({ label, value, onChange, min = 0, step = 0.5, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <Input type="number" min={min} step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
    </div>
  );
}

export function RubricEditor({ value = [], onChange }) {
  const { t } = useI18n();
  const set = (id, patch) => onChange(value.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="label mb-0">{t('Marking rubric')}</span>
        <Button size="sm" icon={Plus} onClick={() => onChange([...value, { id: newId(6), criterion: '', marks: 1 }])}>{t('Add criterion')}</Button>
      </div>
      {value.map((r) => (
        <div key={r.id} className="mb-1 flex gap-2">
          <Input value={r.criterion} placeholder={t('Criterion')} onChange={(e) => set(r.id, { criterion: e.target.value })} />
          <Input className="w-20" type="number" min={0} step={0.5} value={r.marks} onChange={(e) => set(r.id, { marks: Number(e.target.value) })} aria-label={t('Marks')} />
          <Button size="icon" variant="ghost" onClick={() => onChange(value.filter((x) => x.id !== r.id))} aria-label={t('Remove')}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
    </div>
  );
}
