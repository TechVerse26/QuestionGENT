import { Plus, Trash2 } from 'lucide-react';
import { RichField, KeySection, NumberField, useQ } from '../common.jsx';
import Button from '../../components/common/Button.jsx';
import { Input, Select } from '../../components/common/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { newId } from '../../utils/id.js';
import { formatLabel, NUMBER_STYLES } from '../../utils/numbering.js';

function Column({ title, list, style, onStyle, onAdd, onSet, onDel }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="label mb-0">{title}</span>
        <Select className="ml-auto h-8 w-auto text-xs" value={style} onChange={(e) => onStyle(e.target.value)} aria-label={t('Label style')}>
          {NUMBER_STYLES.map((s) => <option key={s} value={s}>{formatLabel(1, s, '{n}')}, {formatLabel(2, s, '{n}')}</option>)}
        </Select>
      </div>
      {list.map((it, i) => (
        <div key={it.id} className="mb-1 flex items-center gap-2">
          <span className="w-8 shrink-0 text-sm font-semibold">{formatLabel(i + 1, style, '{n}.')}</span>
          <Input value={it.content} onChange={(e) => onSet(it.id, { content: e.target.value })} />
          <Button size="icon" variant="ghost" onClick={() => onDel(it.id)} aria-label={t('Remove')}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button size="sm" icon={Plus} onClick={onAdd}>{t('Add item')}</Button>
    </div>
  );
}

export default function MatchingEditor({ q, update, canKey }) {
  const { t } = useI18n();
  const { setBody, setItem, addItem, delItem, setKeyIn } = useQ(update);
  const b = q.body;
  const pairs = (q.key && q.key.pairs) || {};
  const ls = b.leftStyle || 'decimal';
  const rs = b.rightStyle || 'bnLetter';
  return (
    <div className="space-y-4">
      <RichField label={t('Instruction (optional)')} value={b.stem} onChange={(stem) => setBody({ stem })} minHeight={50} compact />
      <div className="grid gap-4 md:grid-cols-2">
        <Column title={t('Left column')} list={b.left || []} style={ls} onStyle={(leftStyle) => setBody({ leftStyle })} onAdd={() => addItem('left', { id: newId(6), content: '' })} onSet={(id, p) => setItem('left', id, p)} onDel={(id) => delItem('left', id)} />
        <Column title={t('Right column')} list={b.right || []} style={rs} onStyle={(rightStyle) => setBody({ rightStyle })} onAdd={() => addItem('right', { id: newId(6), content: '' })} onSet={(id, p) => setItem('right', id, p)} onDel={(id) => delItem('right', id)} />
      </div>
      <NumberField className="max-w-[10rem]" label={t('Marks per pair')} value={b.marksPerPair ?? 1} onChange={(marksPerPair) => setBody({ marksPerPair })} />
      <KeySection canKey={canKey} title={t('Correct pairs')}>
        {(b.left || []).map((l, i) => (
          <div key={l.id} className="flex items-center gap-2">
            <span className="w-8 text-sm font-semibold">{formatLabel(i + 1, ls, '{n}.')}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{l.content}</span>
            <Select className="w-40" value={pairs[l.id] || ''} onChange={(e) => setKeyIn('pairs', l.id, e.target.value)}>
              <option value="">—</option>
              {(b.right || []).map((r, k) => <option key={r.id} value={r.id}>{formatLabel(k + 1, rs, '{n}')} {r.content}</option>)}
            </Select>
          </div>
        ))}
      </KeySection>
    </div>
  );
}
