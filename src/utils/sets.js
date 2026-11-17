import { clone } from './object.js';
import { mulberry32, seedFrom, shuffled } from './shuffle.js';
import { questionMarks } from './marks.js';
import { fingerprintOf } from './question.js';

export const setLabel = (i) => String.fromCharCode(65 + i);

// Shuffles options but keeps options flagged `fixed` (e.g. "All of the above") in place.
export function shuffleMovable(options, rng) {
  const idx = options.map((o, i) => (o.fixed ? -1 : i)).filter((i) => i >= 0);
  const vals = shuffled(idx.map((i) => options[i]), rng);
  const out = options.slice();
  idx.forEach((pos, k) => { out[pos] = vals[k]; });
  return out;
}

// base = { paper, items: {id: question}, keys: {id: key} }. Answers reference option ids, so shuffling never breaks keys.
export function generateSet(base, { label, seed = 'em', shuffleQuestions = true, shuffleOptions = true, replacements = {} } = {}) {
  const rng = mulberry32(seedFrom(`${seed}:${label}`));
  const paper = clone(base.paper);
  const items = clone(base.items);
  const keys = clone(base.keys || {});
  for (const [id, r] of Object.entries(replacements)) {
    if (!items[id]) continue;
    items[id] = { ...clone(r.question), id, optional: items[id].optional };
    if (r.key) keys[id] = clone(r.key); else delete keys[id];
  }
  if (shuffleQuestions) for (const s of paper.sections) s.itemIds = shuffled(s.itemIds, rng);
  if (shuffleOptions) {
    for (const q of Object.values(items)) {
      if (q.type === 'mcq' && q.body && q.body.shuffle !== false && Array.isArray(q.body.options)) q.body.options = shuffleMovable(q.body.options, rng);
    }
  }
  paper.setLabel = label;
  return { paper, items, keys };
}

// Picks a bank question with the same type, marks, difficulty (and subject/chapter when known)
export function findEquivalent(q, pool, usedFingerprints, rng = Math.random) {
  const m = questionMarks(q);
  const cands = pool.filter((p) => p.type === q.type && p.status !== 'archived' && questionMarks(p) === m
    && (p.difficulty || 'medium') === (q.difficulty || 'medium')
    && (!q.subject || p.subject === q.subject) && (!q.chapter || p.chapter === q.chapter)
    && !usedFingerprints.has(fingerprintOf(p)));
  return cands.length ? cands[Math.floor(rng() * cands.length)] : null;
}
