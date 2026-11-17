// Turns paper + items (+keys) into a plain, renderer-independent model.
// The React preview/print view and the DOCX exporter both consume this, so they stay in sync.
import { resolveDesign } from '../constants/templates.js';
import { LABELS } from './labels.js';
import { paperSummary, questionMarks } from '../utils/marks.js';
import { formatLabel, fmtDigits } from '../utils/numbering.js';
import { toBlocks, keyBlocks } from '../question-types/blocks.js';

export function buildPaperModel({ paper, items, keys = {}, mode = 'paper' }) {
  const design = resolveDesign(paper.design);
  const lang = design.language === 'en' ? 'en' : 'bn';
  const L = LABELS[lang];
  const D = (v) => fmtDigits(v, design.digits);
  const summary = paperSummary(paper, items);
  let last = 0;
  const sections = (paper.sections || []).map((s, si) => {
    const sum = summary.sections[si];
    const nm = s.numbering || {};
    const start = si > 0 && nm.continue ? last + 1 : Math.max(1, Number(nm.start) || 1);
    const baseStyle = nm.style || 'decimal';
    const style = baseStyle === 'decimal' && design.digits === 'bn' ? 'bn' : baseStyle;
    const qs = (s.itemIds || []).map((id) => items[id]).filter(Boolean).map((q, i) => {
      const no = formatLabel(start + i, style, nm.pattern || '{n}.');
      const ctx = { no, optionsCols: s.optionsCols || 'auto', lang, digits: design.digits };
      return { id: q.id, no, marks: questionMarks(q), blocks: mode === 'key' ? keyBlocks(q, keys[q.id], ctx) : toBlocks(q, ctx) };
    });
    last = start + qs.length - 1;
    const rule = s.answerRule || {};
    return {
      id: s.id, title: s.title || '', description: s.description || '', instructions: s.instructions || '',
      ruleText: rule.mode === 'choice' ? L.answerAny.replace('{n}', D(rule.count || 0)) : '',
      marksText: sum.marks > 0 ? `${L.marks}: ${D(sum.marks)}` : '',
      qs,
    };
  });
  return { design, lang, L, D, info: paper.info || {}, title: paper.title || '', setLabel: paper.setLabel || '', sections, totalMarks: summary.total, mode, summary };
}
