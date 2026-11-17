import { useMemo, useState } from 'react';
import { Field, Input, Textarea } from '../../components/common/Field.jsx';
import Button from '../../components/common/Button.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useAcademicLists } from '../../hooks/useCurrent.js';
import { namesOf } from '../../store/academicStore.js';
import { useBuilder } from '../../store/builderStore.js';
import { uploadImage, uploadsEnabled } from '../../services/uploadService.js';
import { paperSummary } from '../../utils/marks.js';
import { ISSUE_TEXT } from '../../constants/issues.js';

export function InfoPanel() {
  const { t } = useI18n();
  const toast = useToast();
  const info = useBuilder((s) => s.paper.info) || {};
  const lists = useAcademicLists();
  const [busy, setBusy] = useState(false);
  const { setInfo } = useBuilder.getState();

  const text = (k, label, props = {}) => (
    <Field label={label}><Input value={info[k] || ''} onChange={(e) => setInfo({ [k]: e.target.value })} {...props} /></Field>
  );
  const listed = (k, label, coll) => (
    <Field label={label}>
      <Input list={`inf-${k}`} value={info[k] || ''} onChange={(e) => setInfo({ [k]: e.target.value })} />
      <datalist id={`inf-${k}`}>{namesOf(lists, coll).map((n) => <option key={n} value={n} />)}</datalist>
    </Field>
  );
  const onLogo = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setBusy(true);
    try { setInfo({ logoUrl: await uploadImage(f) }); } catch (err) { toast.error(t(err.message)); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">{text('examName', t('Examination name'), { placeholder: t('e.g. Annual Examination 2026') })}</div>
      {text('institutionName', t('Institution name'))}
      {text('address', t('Address line'))}
      <div className="sm:col-span-2">
        <Field label={t('Logo (image address)')}><Input value={info.logoUrl || ''} placeholder="https://" onChange={(e) => setInfo({ logoUrl: e.target.value })} /></Field>
        {uploadsEnabled && <div className="mt-1 flex items-center gap-2 text-sm"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogo} disabled={busy} />{busy && t('Uploading...')}</div>}
      </div>
      {listed('className', t('Class'), 'classes')}
      {listed('group', t('Group'), 'groups')}
      {text('section', t('Section'))}
      {listed('department', t('Department'), 'departments')}
      {listed('subject', t('Subject'), 'subjects')}
      {text('subjectCode', t('Subject code'))}
      {text('year', t('Academic year'))}
      {text('date', t('Examination date'))}
      {text('duration', t('Duration'), { placeholder: t('e.g. 2 hours 30 minutes') })}
      {text('fullMarks', t('Full marks'), { inputMode: 'numeric' })}
      {text('passMarks', t('Pass marks'), { inputMode: 'numeric' })}
      <div className="sm:col-span-2"><Field label={t('General instructions')}><Textarea rows={3} value={info.instructions || ''} onChange={(e) => setInfo({ instructions: e.target.value })} /></Field></div>
    </div>
  );
}

export function ChecksPanel({ canKeys, onEditItem }) {
  const { t } = useI18n();
  const paper = useBuilder((s) => s.paper);
  const items = useBuilder((s) => s.items);
  const keys = useBuilder((s) => s.keys);
  const sum = useMemo(() => paperSummary(paper, items, canKeys ? keys : undefined), [paper, items, keys, canKeys]);
  const mismatch = sum.issues.find((i) => i.code === 'total_mismatch');
  const full = Number(paper.info && paper.info.fullMarks);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="panel p-2"><p className="text-xl font-bold">{sum.total}</p><p className="text-xs text-muted">{t('Total marks')}</p></div>
        <div className="panel p-2"><p className="text-xl font-bold">{sum.questionCount}</p><p className="text-xs text-muted">{t('Questions')}</p></div>
        <div className="panel p-2"><p className={`text-xl font-bold ${full && full !== sum.total ? 'text-danger' : ''}`}>{full || '—'}</p><p className="text-xs text-muted">{t('Declared full marks')}</p></div>
      </div>
      {mismatch && <Button size="sm" onClick={() => useBuilder.getState().setInfo({ fullMarks: String(sum.total) })}>{t('Set full marks to {n}', { n: sum.total })}</Button>}
      <table className="tbl panel">
        <thead><tr><th>{t('Section')}</th><th>{t('Questions')}</th><th>{t('To answer')}</th><th>{t('Marks')}</th></tr></thead>
        <tbody>
          {paper.sections.map((s, i) => (
            <tr key={s.id}><td>{s.title || `${t('Section')} ${i + 1}`}</td><td>{sum.sections[i].count}</td><td>{sum.sections[i].answerCount}</td><td>{sum.sections[i].marks}</td></tr>
          ))}
        </tbody>
      </table>
      <div>
        <h3 className="mb-2 text-sm">{sum.issues.length ? t('{n} issue(s) to review', { n: sum.issues.length }) : t('No problems found.')}</h3>
        <ul className="space-y-1">
          {sum.issues.map((is, i) => (
            <li key={i} className={`flex items-start justify-between gap-2 rounded border px-2 py-1.5 text-sm ${is.level === 'error' ? 'border-danger/40 bg-danger-soft' : 'border-warn/40 bg-warn-soft'}`}>
              <span>{t(ISSUE_TEXT[is.code] || is.code, is.params)}</span>
              {is.itemId && <button type="button" className="shrink-0 text-xs font-semibold underline" onClick={() => onEditItem(is.itemId)}>{t('Open')}</button>}
            </li>
          ))}
        </ul>
        {!canKeys && <p className="hint">{t('Answer checks are skipped because answer keys are not available for your role.')}</p>}
      </div>
    </div>
  );
}
