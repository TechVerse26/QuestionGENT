import { useState } from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Copy, Trash2, Pencil, Library, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import { Input, Select, Textarea } from '../../components/common/Field.jsx';
import { Badge } from '../../components/common/Misc.jsx';
import { useConfirm } from '../../components/common/Confirm.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useBuilder } from '../../store/builderStore.js';
import { QUESTION_TYPES, typeLabel } from '../../constants/questionTypes.js';
import { previewText } from '../../utils/question.js';
import { questionMarks, sectionSummary } from '../../utils/marks.js';
import { NUMBER_STYLES, NUMBER_PATTERNS, formatLabel } from '../../utils/numbering.js';

function useSortables() {
  return useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
}

function QuestionRow({ id, index, section, sections, onEdit }) {
  const { t, lang } = useI18n();
  const confirm = useConfirm();
  const q = useBuilder((s) => s.items[id]);
  const { setItemFlag, duplicateItem, removeItem, moveItemTo } = useBuilder.getState();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  if (!q) return null;
  const choice = section.answerRule && section.answerRule.mode === 'choice';
  const others = sections.filter((s) => s.id !== section.id);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} className="flex items-start gap-2 border-b border-line bg-surface px-2 py-2 last:border-b-0">
      <button type="button" className="mt-0.5 cursor-grab touch-none text-muted" aria-label={t('Drag to reorder')} {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>
      <span className="mt-0.5 w-6 shrink-0 text-sm font-semibold text-muted">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <button type="button" className="line-clamp-2 w-full text-left text-sm hover:text-brand" onClick={() => onEdit(id)}>{previewText(q, 140) || t('(empty question)')}</button>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge>{typeLabel(q.type, lang)}</Badge>
          <Badge tone="brand">{questionMarks(q)} {t('marks')}</Badge>
          {choice && (
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!q.optional} onChange={(e) => setItemFlag(id, { optional: e.target.checked })} />{t('Optional')}</label>
          )}
          {others.length > 0 && (
            <Select className="h-7 w-28 text-xs" value="" onChange={(e) => { if (e.target.value) moveItemTo(id, e.target.value); }} aria-label={t('Move to section')}>
              <option value="">{t('Move to...')}</option>
              {others.map((s) => <option key={s.id} value={s.id}>{s.title || t('Untitled section')}</option>)}
            </Select>
          )}
        </div>
      </div>
      <div className="flex shrink-0">
        <Button size="icon" variant="ghost" onClick={() => onEdit(id)} aria-label={t('Edit')}><Pencil className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={() => duplicateItem(id)} aria-label={t('Duplicate')}><Copy className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={async () => { if (await confirm({ title: t('Delete question'), message: t('Remove this question from the paper?'), danger: true, confirmLabel: t('Delete') })) removeItem(id); }} aria-label={t('Delete')}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function SectionSettings({ s }) {
  const { t, lang } = useI18n();
  const { updateSection } = useBuilder.getState();
  const rule = s.answerRule || { mode: 'all', count: 0 };
  const nm = s.numbering || {};
  const setNm = (p) => updateSection(s.id, { numbering: { ...nm, ...p } });
  const toggleType = (id) => updateSection(s.id, { allowedTypes: s.allowedTypes.includes(id) ? s.allowedTypes.filter((x) => x !== id) : [...s.allowedTypes, id] });
  return (
    <div className="space-y-3 border-b border-line bg-surface2 p-3">
      <div><label className="label">{t('Description')}</label><Textarea rows={2} value={s.description || ''} onChange={(e) => updateSection(s.id, { description: e.target.value })} /></div>
      <div><label className="label">{t('Instructions')}</label><Textarea rows={2} value={s.instructions || ''} onChange={(e) => updateSection(s.id, { instructions: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('Answering rule')}</label>
          <Select value={rule.mode} onChange={(e) => updateSection(s.id, { answerRule: { ...rule, mode: e.target.value } })}>
            <option value="all">{t('Answer all questions')}</option>
            <option value="choice">{t('Answer a fixed number')}</option>
          </Select>
        </div>
        {rule.mode === 'choice' && (
          <div><label className="label">{t('Questions to answer')}</label><Input type="number" min={1} value={rule.count || ''} onChange={(e) => updateSection(s.id, { answerRule: { ...rule, count: Number(e.target.value) } })} /></div>
        )}
      </div>
      {rule.mode === 'choice' && <p className="hint">{t('Mark compulsory questions by leaving "Optional" unticked; tick Optional on the rest.')}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><label className="label">{t('Numbering')}</label><Select value={nm.style || 'decimal'} onChange={(e) => setNm({ style: e.target.value })}>{NUMBER_STYLES.map((x) => <option key={x} value={x}>{formatLabel(1, x, '{n}')}, {formatLabel(2, x, '{n}')}</option>)}</Select></div>
        <div><label className="label">{t('Format')}</label><Select value={nm.pattern || '{n}.'} onChange={(e) => setNm({ pattern: e.target.value })}>{NUMBER_PATTERNS.map((x) => <option key={x} value={x}>{x.replace('{n}', '1')}</option>)}</Select></div>
        <div><label className="label">{t('Start at')}</label><Input type="number" min={1} value={nm.start || 1} onChange={(e) => setNm({ start: Number(e.target.value) || 1 })} /></div>
        <div><label className="label">{t('Option columns')}</label><Select value={s.optionsCols || 'auto'} onChange={(e) => updateSection(s.id, { optionsCols: e.target.value })}><option value="auto">{t('Auto')}</option><option value="1">1</option><option value="2">2</option><option value="4">4</option></Select></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!nm.continue} onChange={(e) => setNm({ continue: e.target.checked })} />{t('Continue numbering from the previous section')}</label>
      <div>
        <label className="label">{t('Allowed question types (none selected = any)')}</label>
        <div className="grid max-h-40 grid-cols-1 gap-x-3 overflow-y-auto sm:grid-cols-2">
          {QUESTION_TYPES.map((x) => <label key={x.id} className="flex items-center gap-2 py-0.5 text-sm"><input type="checkbox" checked={s.allowedTypes.includes(x.id)} onChange={() => toggleType(x.id)} />{lang === 'bn' ? x.bn : x.en}</label>)}
        </div>
      </div>
    </div>
  );
}

function AddMenu({ section, customTypes, onAdd }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const types = QUESTION_TYPES.filter((x) => x.id !== 'custom' && (!section.allowedTypes.length || section.allowedTypes.includes(x.id)));
  const customs = !section.allowedTypes.length || section.allowedTypes.includes('custom') ? customTypes : [];
  const pick = (type, def) => { setOpen(false); onAdd(section.id, type, def); };
  return (
    <div className="relative">
      <Button size="sm" variant="primary" icon={Plus} onClick={() => setOpen((v) => !v)}>{t('Add question')}</Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded border border-line bg-surface py-1">
            {types.map((x) => <button key={x.id} type="button" className="block w-full px-3 py-1.5 text-left text-sm hover:bg-surface2" onClick={() => pick(x.id)}>{lang === 'bn' ? x.bn : x.en}</button>)}
            {customs.map((c) => <button key={c.id} type="button" className="block w-full px-3 py-1.5 text-left text-sm hover:bg-surface2" onClick={() => pick('custom', { id: c.id, name: c.name, fields: c.fields })}>{c.name}</button>)}
          </div>
        </>
      )}
    </div>
  );
}

function SectionCard({ section, index, sections, items, customTypes, onAdd, onEdit, onBank }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const sensors = useSortables();
  const { updateSection, duplicateSection, removeSection, reorderItems } = useBuilder.getState();
  const [open, setOpen] = useState(true);
  const [settings, setSettings] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const sum = sectionSummary(section, items);

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = section.itemIds.indexOf(active.id);
    const to = section.itemIds.indexOf(over.id);
    if (from >= 0 && to >= 0) reorderItems(section.id, arrayMove(section.itemIds, from, to));
  };

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} className="mb-3 rounded border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-2 py-2">
        <button type="button" className="cursor-grab touch-none text-muted" aria-label={t('Drag section')} {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>
        <button type="button" className="text-muted" onClick={() => setOpen((v) => !v)} aria-label={t('Collapse')}>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
        <Input className="h-8 min-w-0 flex-1 font-semibold" value={section.title} placeholder={t('Section title')} onChange={(e) => updateSection(section.id, { title: e.target.value })} />
        <span className="hidden shrink-0 text-xs text-muted sm:inline">{t('{n} questions', { n: sum.count })}</span>
        <Badge tone="brand">{sum.marks} {t('marks')}</Badge>
        <Button size="icon" variant="ghost" onClick={() => setSettings((v) => !v)} aria-label={t('Section settings')}><Settings2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={() => duplicateSection(section.id)} aria-label={t('Duplicate section')}><Copy className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={async () => { if (await confirm({ title: t('Delete section'), message: t('Delete this section and all its questions from the paper?'), danger: true, confirmLabel: t('Delete') })) removeSection(section.id); }} aria-label={t('Delete section')}><Trash2 className="h-4 w-4" /></Button>
      </div>
      {open && settings && <SectionSettings s={section} />}
      {open && (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={section.itemIds} strategy={verticalListSortingStrategy}>
              {section.itemIds.map((id, i) => <QuestionRow key={id} id={id} index={i} section={section} sections={sections} onEdit={onEdit} />)}
            </SortableContext>
          </DndContext>
          {!section.itemIds.length && <p className="px-3 py-4 text-center text-sm text-muted">{t('No questions yet.')}</p>}
          <div className="flex flex-wrap gap-2 border-t border-line p-2">
            <AddMenu section={section} customTypes={customTypes} onAdd={onAdd} />
            <Button size="sm" icon={Library} onClick={() => onBank(section.id)}>{t('From question bank')}</Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function StructurePanel({ customTypes, onAdd, onEdit, onBank }) {
  const { t } = useI18n();
  const sensors = useSortables();
  const sections = useBuilder((s) => s.paper.sections);
  const items = useBuilder((s) => s.items);
  const { addSection, moveSection } = useBuilder.getState();

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    if (from >= 0 && to >= 0) moveSection(from, to);
  };

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map((s, i) => <SectionCard key={s.id} section={s} index={i} sections={sections} items={items} customTypes={customTypes} onAdd={onAdd} onEdit={onEdit} onBank={onBank} />)}
        </SortableContext>
      </DndContext>
      <Button icon={Plus} onClick={() => addSection({ title: '' })}>{t('Add section')}</Button>
    </div>
  );
}
