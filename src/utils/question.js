import { docToText, docFromText } from './richtext.js';
import { STIMULUS_TYPES } from '../constants/questionTypes.js';

// The "main" rich-text document of a question (what a teacher would call the question itself)
export function primaryDoc(q) {
  const b = (q && q.body) || {};
  switch (q && q.type) {
    case 'mcq': return b.stem;
    case 'fill': return b.text;
    case 'tf': return b.statement;
    case 'assertion': return b.assertion;
    case 'custom': {
      const f = b.def && b.def.fields && b.def.fields[0];
      const v = f && b.values ? b.values[f.id] : null;
      return typeof v === 'string' ? docFromText(v) : v;
    }
    default: return q && STIMULUS_TYPES.includes(q.type) ? b.stimulus : b.stem;
  }
}

export function previewText(q, max = 160) {
  let t = docToText(primaryDoc(q));
  if (!t && q && STIMULUS_TYPES.includes(q.type)) t = ((q.body && q.body.subs) || []).map((s) => docToText(s.content)).filter(Boolean).join(' / ');
  if (!t && q && q.type === 'matching') t = ((q.body && q.body.left) || []).map((l) => l.content).join(', ');
  t = t.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

const SKIP = new Set(['id', 'optionStyle', 'optionPattern', 'subPattern', 'leftStyle', 'rightStyle', 'itemStyle', 'language', 'shuffle', 'fixed', 'kind']);
export function collectText(value, out = []) {
  if (value == null) return out;
  if (typeof value === 'string') { out.push(value); return out; }
  if (Array.isArray(value)) { value.forEach((v) => collectText(v, out)); return out; }
  if (typeof value === 'object') {
    if (value.type === 'doc') { out.push(docToText(value)); return out; }
    for (const [k, v] of Object.entries(value)) if (!SKIP.has(k)) collectText(v, out);
  }
  return out;
}

export const normalizeText = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, '');

export function searchTextOf(q) {
  const meta = [q.subject, q.chapter, q.topic, q.className, q.group, ...(q.tags || [])].filter(Boolean).join(' ');
  return `${collectText(q.body).join(' ')} ${meta}`.toLowerCase().replace(/\s+/g, ' ').slice(0, 4000);
}

export function hash53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function fingerprintOf(q) {
  const main = normalizeText(docToText(primaryDoc(q))) || normalizeText(collectText(q.body).join(' '));
  if (!main) return `${q.type}:${q.id || Math.random().toString(36).slice(2)}`;
  return `${q.type}:${hash53(main).toString(36)}`;
}

export function groupDuplicates(list) {
  const map = new Map();
  for (const q of list) {
    const fp = q.fingerprint || fingerprintOf(q);
    if (!map.has(fp)) map.set(fp, []);
    map.get(fp).push(q);
  }
  return [...map.values()].filter((g) => g.length > 1);
}
