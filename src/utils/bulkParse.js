import { BN_LETTERS } from './numbering.js';
import { docFromText } from './richtext.js';
import { newId } from './id.js';

const Q_RE = /^\s*(?:Q\.?\s*)?([0-9০-৯]{1,3})\s*[.)\u0964:-]\s*(.*)$/i;
const OPT_RE = /^\s*\(?([A-Za-z]|[ক-ন])[.)\u0964:]\s*(.*)$/;
const ANS_RE = /^\s*(?:ans(?:wer)?|correct(?:\s+answer)?|উত্তর|সঠিক\s+উত্তর)\s*[:：.–-]?\s*(.+)$/i;
const EXP_RE = /^\s*(?:explanation|ব্যাখ্যা)\s*[:：]\s*(.*)$/i;
const FIRST = ['A', 'a', 'ক'];

export function labelIndex(label) {
  const l = String(label).trim();
  const bn = BN_LETTERS.indexOf(l);
  if (bn >= 0) return bn;
  const c = l.toUpperCase().charCodeAt(0) - 65;
  return c >= 0 && c < 26 ? c : -1;
}

export function parseLabels(s) {
  return String(s || '').split(/[\s,;/&]+/).map((x) => x.replace(/[().\u0964:]/g, '').trim()).filter((x) => /^([A-Za-z]|[ক-ন])$/.test(x));
}

// Parses pasted/imported MCQ text:  "1. Question / A. opt / B. opt ... / Answer: B / Explanation: ..."
export function parseBulkMcq(text) {
  const out = [];
  let cur = null;
  let lastOpt = null;
  let inExp = false;
  const flush = () => { if (cur && (cur.stem || cur.options.length)) out.push(cur); cur = null; lastOpt = null; inExp = false; };
  const start = (stem) => { flush(); cur = { stem: stem.trim(), options: [], answers: [], explanation: '' }; };
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if (cur && (m = line.match(ANS_RE))) { cur.answers = parseLabels(m[1]); lastOpt = null; inExp = false; continue; }
    if (cur && (m = line.match(EXP_RE))) { cur.explanation = m[1]; inExp = true; lastOpt = null; continue; }
    if (cur && (m = line.match(OPT_RE)) && (cur.options.length > 0 || FIRST.includes(m[1]))) {
      lastOpt = { label: m[1], text: m[2].trim() };
      cur.options.push(lastOpt);
      inExp = false;
      continue;
    }
    const complete = cur && cur.options.length >= 2 && (cur.answers.length > 0 || inExp);
    if ((m = line.match(Q_RE)) && (!cur || cur.options.length >= 2 || cur.answers.length)) { start(m[2]); continue; }
    if (!cur || complete) { start(line); continue; }
    if (inExp) cur.explanation += `\n${line}`;
    else if (lastOpt) lastOpt.text += ` ${line}`;
    else cur.stem += `\n${line}`;
  }
  flush();
  return out;
}

export function parsedToMcq(p, { lang = 'bn' } = {}) {
  if (!p.stem || !p.stem.trim()) return { error: 'Missing question text' };
  if (p.options.length < 2) return { error: 'Fewer than two options found' };
  const options = p.options.map((o) => ({ id: newId(8), content: docFromText(o.text) }));
  const correct = [];
  for (const a of p.answers) {
    let i = p.options.findIndex((o) => o.label.toLowerCase() === a.toLowerCase());
    if (i < 0) i = labelIndex(a);
    if (i >= 0 && i < options.length && !correct.includes(options[i].id)) correct.push(options[i].id);
  }
  return {
    question: { type: 'mcq', marks: 1, difficulty: 'medium', body: { stem: docFromText(p.stem), options, multi: correct.length > 1, optionStyle: lang === 'bn' ? 'bnLetter' : 'ALPHA', optionPattern: '{n}.', negative: 0 } },
    key: { correct, explanation: p.explanation ? docFromText(p.explanation) : null },
    warning: correct.length ? null : 'No correct answer found',
  };
}
