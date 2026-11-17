import { Plus, Trash2 } from 'lucide-react';
import { RichField, KeySection, RubricEditor, useQ } from '../common.jsx';
import RichTextEditor from '../../components/editor/RichTextEditor.jsx';
import Button from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Field.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { newId } from '../../utils/id.js';
import { emptyDoc } from '../../utils/richtext.js';
import { BN_LETTERS } from '../../utils/numbering.js';
import { questionMarks } from '../../utils/marks.js';

const STIM_LABEL = { cq: 'Stimulus (উদ্দীপক)', comprehension: 'Passage', case_study: 'Case', diagram: 'Diagram / figure and description', map: 'Map and description' };

// Stimulus + labelled sub-questions: CQ, comprehension, case study, diagram-based and map-based questions
export default function CQEditor({ q, update, canKey }) {
  const { t } = useI18n();
  const { setBody, setKey, setItem, addItem, delItem, setKeyIn } = useQ(update);
  const b = q.body;
  const subs = b.subs || [];
  const key = q.key || {};

  const addSub = () => addItem('subs', { id: newId(6), label: BN_LETTERS[subs.length] || String(subs.length + 1), content: emptyDoc(), marks: 1 });
  const defaults = () => setBody({ subs: ['ক', 'খ', 'গ', 'ঘ'].map((label, i) => ({ id: newId(6), label, content: emptyDoc(), marks: [1, 2, 3, 4][i] })) });

  return (
    <div className="space-y-4">
      <RichField label={t(STIM_LABEL[q.type] || 'Stimulus')} value={b.stimulus} onChange={(stimulus) => setBody({ stimulus })} minHeight={120} placeholder={t('Text, image, diagram or table')} />

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="label mb-0">{t('Sub-questions')}</span>
          <span className="badge badge-brand">{t('Total marks: {n}', { n: questionMarks(q) })}</span>
          <div className="ml-auto flex gap-2">
            {!subs.length && <Button size="sm" onClick={defaults}>{t('Use ক খ গ ঘ (1, 2, 3, 4)')}</Button>}
            <Button size="sm" icon={Plus} onClick={addSub}>{t('Add sub-question')}</Button>
          </div>
        </div>
        <div className="space-y-3">
          {subs.map((s) => (
            <div key={s.id} className="rounded border border-line p-2">
              <div className="mb-2 flex items-center gap-2">
                <Input className="w-20" value={s.label} onChange={(e) => setItem('subs', s.id, { label: e.target.value })} aria-label={t('Label')} />
                <Input className="w-24" type="number" min={0} step={0.5} value={s.marks} onChange={(e) => setItem('subs', s.id, { marks: Number(e.target.value) })} aria-label={t('Marks')} />
                <span className="text-xs text-muted">{t('marks')}</span>
                <Button size="icon" variant="ghost" className="ml-auto" onClick={() => delItem('subs', s.id)} aria-label={t('Remove')}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <RichTextEditor key={s.id} value={s.content} onChange={(content) => setItem('subs', s.id, { content })} compact minHeight={48} />
            </div>
          ))}
        </div>
      </div>

      <KeySection canKey={canKey} title={t('Answer guidelines')}>
        {subs.map((s) => (
          <RichField key={s.id} label={`${s.label}  (${s.marks})`} value={key.answers && key.answers[s.id]} onChange={(doc) => setKeyIn('answers', s.id, doc)} minHeight={48} compact />
        ))}
        <RichField label={t('General guideline')} value={key.guideline} onChange={(guideline) => setKey({ guideline })} minHeight={48} compact />
        <RubricEditor value={key.rubric || []} onChange={(rubric) => setKey({ rubric })} />
      </KeySection>
    </div>
  );
}
