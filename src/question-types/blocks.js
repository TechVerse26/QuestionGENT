// Pure question -> printable "blocks" conversion shared by the live preview, print route and DOCX export.
import { STIMULUS_TYPES } from '../constants/questionTypes.js';
import { docToText, isEmptyDoc, prefixDoc, docFromText } from '../utils/richtext.js';
import { formatLabel } from '../utils/numbering.js';
import { questionMarks, num } from '../utils/marks.js';
import { mulberry32, seedFrom, shuffled } from '../utils/shuffle.js';
import { LABELS } from '../preview/labels.js';

const labelsFor = (ctx) => LABELS[ctx.lang === 'en' ? 'en' : 'bn'];
const optLabel = (b, i) => formatLabel(i + 1, b.optionStyle || 'bnLetter', b.optionPattern || '{n}.');
const hasTable = (doc) => JSON.stringify(doc || {}).includes('"type":"table"');

export function autoCols(items) {
  if (!items.length) return 1;
  if (items.some((i) => hasTable(i.doc))) return 1;
  const max = Math.max(...items.map((i) => docToText(i.doc).length));
  const cols = max <= 18 ? 4 : max <= 40 ? 2 : 1;
  return Math.min(cols, items.length);
}

function optionsBlock(b, ctx) {
  const items = (b.options || []).map((o, i) => ({ label: optLabel(b, i), doc: o.content }));
  const cols = ctx.optionsCols && ctx.optionsCols !== 'auto' ? Number(ctx.optionsCols) : autoCols(items);
  return { k: 'options', items, cols: Math.max(1, Math.min(4, cols || 1)) };
}

function subsBlock(list, pattern = '{n}.') {
  return {
    k: 'subs',
    items: (list || []).map((s, i) => ({ label: pattern.replace('{n}', s.label || formatLabel(i + 1, 'bnLetter', '{n}')), doc: s.content, marks: num(s.marks) > 0 ? num(s.marks) : null })),
  };
}

function orderedItems(q) {
  const b = q.body || {};
  const items = b.items || [];
  const shown = b.shuffleOnPrint === false ? items : shuffled(items, mulberry32(seedFrom(String(q.id || 'x'))));
  const labels = {};
  shown.forEach((it, i) => { labels[it.id] = formatLabel(i + 1, b.itemStyle || 'bnLetter', '({n})'); });
  return { shown, labels };
}

export function toBlocks(q, ctx) {
  const b = q.body || {};
  const L = labelsFor(ctx);
  const marks = questionMarks(q);
  const stem = (doc, m = marks) => ({ k: 'stem', no: ctx.no, doc, marks: m > 0 ? m : null });
  const en = ctx.lang === 'en';

  if (STIMULUS_TYPES.includes(q.type)) return [{ k: 'stem', no: ctx.no, doc: b.stimulus, marks: null }, subsBlock(b.subs, b.subPattern)];

  switch (q.type) {
    case 'mcq': return [stem(b.stem), optionsBlock(b, ctx)];
    case 'assertion': return [stem(prefixDoc(en ? 'Assertion (A):' : 'দাবি (A):', b.assertion)), { k: 'doc', doc: prefixDoc(en ? 'Reason (R):' : 'কারণ (R):', b.reason) }, optionsBlock(b, ctx)];
    case 'fill': return [stem(b.text)];
    case 'tf': return [stem(b.statement)];
    case 'numeric': return [stem(b.stem)];
    case 'matching': {
      const ls = b.leftStyle || 'decimal';
      const rs = b.rightStyle || 'bnLetter';
      return [
        stem(b.stem && !isEmptyDoc(b.stem) ? b.stem : docFromText(en ? 'Match the left column with the right column.' : 'বাম পাশের সাথে ডান পাশ মেলাও।')),
        { k: 'columns', left: (b.left || []).map((x, i) => ({ label: formatLabel(i + 1, ls, '{n}.'), text: x.content })), right: (b.right || []).map((x, i) => ({ label: formatLabel(i + 1, rs, '{n}.'), text: x.content })) },
      ];
    }
    case 'practical': {
      const out = [stem(b.stem)];
      const mats = String(b.materials || '').split('\n').map((s) => s.trim()).filter(Boolean);
      if (mats.length) out.push({ k: 'kv', label: L.materials, text: mats.join(', ') });
      const steps = (b.steps || []).filter((s) => s.content && s.content.trim());
      if (steps.length) out.push({ k: 'list', ordered: true, items: steps.map((s, i) => ({ label: `${i + 1}.`, text: s.content })) });
      return out;
    }
    case 'ordering': {
      const { shown, labels } = orderedItems(q);
      return [stem(b.stem), { k: 'list', ordered: true, items: shown.map((it) => ({ label: labels[it.id], text: it.content })) }];
    }
    case 'programming': {
      const out = [stem(b.stem)];
      if (b.constraints) out.push({ k: 'kv', label: L.constraints, text: b.constraints });
      if (b.sampleInput) out.push({ k: 'code', caption: L.sampleIn, text: b.sampleInput });
      if (b.sampleOutput) out.push({ k: 'code', caption: L.sampleOut, text: b.sampleOutput });
      return out;
    }
    case 'custom': {
      const out = [];
      (b.def?.fields || []).forEach((f, i) => {
        const v = b.values ? b.values[f.id] : null;
        const d = typeof v === 'string' ? docFromText(v) : v;
        if (i === 0) out.push(stem(d));
        else if (d && !isEmptyDoc(d)) out.push({ k: 'doc', doc: prefixDoc(`${f.label}:`, d) });
      });
      return out.length ? out : [stem(null)];
    }
    default: {
      const parts = b.parts || [];
      const out = [stem(b.stem, parts.length ? 0 : marks)];
      if (parts.length) out.push(subsBlock(parts, b.subPattern));
      return out;
    }
  }
}

export function keyBlocks(q, key, ctx) {
  const b = q.body || {};
  const L = labelsFor(ctx);
  const marks = questionMarks(q);
  const head = (text) => ({ k: 'keyhead', no: ctx.no, marks: marks > 0 ? marks : null, text: text || '' });
  if (!key) return [head(''), { k: 'note', text: L.noKey }];
  const out = [];
  const doc = (d) => { if (d && !isEmptyDoc(d)) out.push({ k: 'doc', doc: d }); };

  if (STIMULUS_TYPES.includes(q.type)) {
    out.push(head(''));
    const items = subsBlock(b.subs, b.subPattern).items.map((it, i) => ({ ...it, doc: key.answers ? key.answers[b.subs[i].id] : null })).filter((it) => it.doc && !isEmptyDoc(it.doc));
    if (items.length) out.push({ k: 'subs', items });
    doc(key.guideline);
  } else {
    switch (q.type) {
      case 'mcq':
      case 'assertion': {
        const correct = key.correct || [];
        const labels = (b.options || []).map((o, i) => ({ id: o.id, label: optLabel(b, i).replace(/[.()]/g, '') })).filter((x) => correct.includes(x.id)).map((x) => x.label);
        out.push(head(labels.join(', ')));
        doc(key.explanation);
        break;
      }
      case 'tf': out.push(head(typeof key.answer === 'boolean' ? (key.answer ? L.yes : L.no) : '')); doc(key.explanation); break;
      case 'fill': out.push(head((key.answers || []).filter(Boolean).join(', '))); break;
      case 'numeric':
        out.push(head([key.value, key.unit].filter(Boolean).join(' ')));
        if (key.tolerance) out.push({ k: 'kv', label: '±', text: key.tolerance });
        doc(key.solution);
        break;
      case 'matching': {
        out.push(head(''));
        const rIdx = Object.fromEntries((b.right || []).map((r, i) => [r.id, i]));
        const items = (b.left || []).map((l, i) => {
          const ri = key.pairs ? rIdx[key.pairs[l.id]] : undefined;
          return { label: formatLabel(i + 1, b.leftStyle || 'decimal', '{n}.'), text: ri === undefined ? '—' : formatLabel(ri + 1, b.rightStyle || 'bnLetter', '{n}') };
        });
        out.push({ k: 'list', ordered: false, items });
        break;
      }
      case 'ordering': {
        const { labels } = orderedItems(q);
        out.push(head((b.items || []).map((it) => labels[it.id]).join(' → ')));
        break;
      }
      case 'programming':
        out.push(head(''));
        if (key.solutionCode) out.push({ k: 'code', text: key.solutionCode });
        doc(key.explanation);
        break;
      default: out.push(head('')); doc(key.answer);
    }
  }
  const rubric = (key.rubric || []).filter((r) => r.criterion || r.marks);
  if (rubric.length) out.push({ k: 'rubric', items: rubric });
  return out;
}
