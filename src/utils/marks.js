import { docToText, isEmptyDoc } from './richtext.js';
import { primaryDoc } from './question.js';
import { STIMULUS_TYPES } from '../constants/questionTypes.js';

export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const round = (n) => Math.round(n * 100) / 100;
export const countBlanks = (doc) => (docToText(doc).match(/_{3,}/g) || []).length;

export function isMarksComputed(q) {
  const b = (q && q.body) || {};
  return STIMULUS_TYPES.includes(q.type) || q.type === 'fill' || q.type === 'matching' || (Array.isArray(b.parts) && b.parts.length > 0);
}

export function questionMarks(q) {
  if (!q) return 0;
  const b = q.body || {};
  if (STIMULUS_TYPES.includes(q.type)) return round((b.subs || []).reduce((a, s) => a + num(s.marks), 0));
  if (q.type === 'fill') return round(countBlanks(b.text) * num(b.marksPerBlank ?? 1));
  if (q.type === 'matching') return round((b.left || []).length * num(b.marksPerPair ?? 1));
  if (Array.isArray(b.parts) && b.parts.length) return round(b.parts.reduce((a, p) => a + num(p.marks), 0));
  return round(num(q.marks));
}

// key === undefined means "answer keys not loaded" and skips answer checks
export function validateQuestion(q, key, section) {
  const out = [];
  const b = q.body || {};
  const push = (level, code) => out.push({ level, code });
  const isStim = STIMULUS_TYPES.includes(q.type);
  const pd = primaryDoc(q);
  if (!isStim && q.type !== 'matching' && q.type !== 'ordering' && isEmptyDoc(pd)) push('error', 'empty_question');
  if (isStim) {
    const subs = b.subs || [];
    if (!subs.length) push('error', 'cq_no_subs');
    else if (subs.some((s) => isEmptyDoc(s.content))) push('error', 'empty_sub');
    if (subs.length && !subs.every((s) => num(s.marks) > 0)) push('warn', 'sub_no_marks');
  }
  if (questionMarks(q) <= 0) push('error', 'zero_marks');
  if (section && section.allowedTypes && section.allowedTypes.length && !section.allowedTypes.includes(q.type)) push('warn', 'type_not_allowed');
  if (q.type === 'mcq' || q.type === 'assertion') {
    const opts = b.options || [];
    if (opts.length < 2 || opts.some((o) => isEmptyDoc(o.content))) push('error', 'mcq_options');
    if (key !== undefined && !((key && key.correct) || []).length) push('warn', 'mcq_no_answer');
  }
  if (q.type === 'tf' && key !== undefined && typeof (key && key.answer) !== 'boolean') push('warn', 'tf_no_answer');
  if (q.type === 'fill' && countBlanks(b.text) === 0) push('error', 'fill_no_blank');
  if (q.type === 'matching' && ((b.left || []).length < 2 || (b.right || []).length < 2)) push('error', 'matching_incomplete');
  return out;
}

export function sectionSummary(section, itemsById) {
  const qs = (section.itemIds || []).map((id) => itemsById[id]).filter(Boolean);
  const total = round(qs.map(questionMarks).reduce((a, b) => a + b, 0));
  const rule = section.answerRule || { mode: 'all' };
  const issues = [];
  if (!qs.length) issues.push({ level: 'warn', code: 'empty_section' });
  if (rule.mode !== 'choice') return { count: qs.length, answerCount: qs.length, marks: total, available: total, issues };
  const mandatory = qs.filter((q) => !q.optional);
  const optional = qs.filter((q) => q.optional);
  const n = Math.max(0, Math.floor(num(rule.count)));
  if (n > qs.length) issues.push({ level: 'error', code: 'choice_exceeds' });
  if (n < mandatory.length) issues.push({ level: 'error', code: 'choice_below_mandatory' });
  const optMarks = optional.map(questionMarks).sort((a, b) => b - a);
  if (new Set(optMarks).size > 1) issues.push({ level: 'warn', code: 'unequal_optional' });
  const need = Math.max(0, Math.min(optional.length, n - mandatory.length));
  const counted = round(mandatory.map(questionMarks).reduce((a, b) => a + b, 0) + optMarks.slice(0, need).reduce((a, b) => a + b, 0));
  return { count: qs.length, answerCount: mandatory.length + need, marks: counted, available: total, issues };
}

export function paperSummary(paper, itemsById, keysById) {
  const secs = paper.sections || [];
  const sections = secs.map((s) => ({ id: s.id, ...sectionSummary(s, itemsById) }));
  const total = round(sections.reduce((a, s) => a + s.marks, 0));
  const questionCount = sections.reduce((a, s) => a + s.count, 0);
  const issues = [];
  if (!secs.length) issues.push({ level: 'error', code: 'no_sections' });
  secs.forEach((s, i) => {
    sections[i].issues.forEach((x) => issues.push({ ...x, sectionId: s.id }));
    (s.itemIds || []).forEach((id) => {
      const q = itemsById[id];
      if (!q) return;
      const key = keysById ? keysById[id] : undefined;
      validateQuestion(q, keysById ? key || null : undefined, s).forEach((x) => issues.push({ ...x, sectionId: s.id, itemId: id }));
    });
  });
  const info = paper.info || {};
  const full = num(info.fullMarks);
  if (full && Math.abs(full - total) > 0.001) issues.push({ level: 'error', code: 'total_mismatch', params: { total, full } });
  if (num(info.passMarks) > (full || total) && num(info.passMarks) > 0) issues.push({ level: 'error', code: 'pass_exceeds' });
  if (!info.examName && !paper.title) issues.push({ level: 'warn', code: 'missing_title' });
  return { sections, total, questionCount, issues, errors: issues.filter((i) => i.level === 'error').length, warnings: issues.filter((i) => i.level === 'warn').length };
}
