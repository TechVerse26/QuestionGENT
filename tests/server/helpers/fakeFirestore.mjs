import { randomBytes } from 'node:crypto';
import { TimestampLike, GeoPointLike, RefLike, VectorLike } from '../../../src/server/backup/codec.js';

export class FakeSource {
  constructor(docsByUnit) { this.docsByUnit = docsByUnit; this.calls = []; }
  async *read(unit, opts) {
    this.calls.push({ unit: unit.id, type: unit.type, since: opts?.since ?? null });
    for (const d of this.docsByUnit[unit.id] || []) {
      if (opts?.since && d.data.updatedAtMs && d.data.updatedAtMs <= opts.since) continue;
      if (this.failAt && this.counter++ >= this.failAt) throw new Error('source exploded');
      yield d;
    }
  }
}

// Minimal in-memory Firestore stand-in with the sink interface used by restoreBackup.
export class FakeSink {
  constructor({ projectId = 'tvexam-test', isProduction = false } = {}) { this.projectId = projectId; this.isProduction = isProduction; this.docs = new Map(); this.writes = 0; }
  async exists(path) { return this.docs.has(path); }
  async set(path, data, { merge } = {}) { this.writes += 1; this.docs.set(path, merge && this.docs.has(path) ? { ...this.docs.get(path), ...data } : data); }
}

export function makeDataset({ questions = 120, withBlob = true } = {}) {
  const docs = { users: [], institutions: [], questionBank: [], history: [], questionPapers: [], items: [], memberships: [] };
  for (let i = 0; i < 6; i++) docs.users.push({ path: `users/u${i}`, data: { uid: `u${i}`, displayName: i % 2 ? 'রহিম উদ্দিন' : 'Karim', email: `u${i}@example.com`, prefs: { lang: 'bn', theme: 'dark' }, createdAt: new TimestampLike(1700000000 + i, 123000000) } });
  for (let i = 0; i < 3; i++) docs.institutions.push({ path: `institutions/i${i}`, data: { name: `School ${i}`, plan: 'free', aiUsed: i, createdBy: 'u0', location: new GeoPointLike(23.8 + i / 10, 90.4), owner: new RefLike('users/u0') } });
  for (let i = 0; i < 4; i++) docs.memberships.push({ path: `memberships/u${i}_i0`, data: { uid: `u${i}`, institutionId: 'i0', role: i ? 'teacher' : 'institution_admin' } });
  for (let q = 0; q < questions; q++) {
    docs.questionBank.push({
      path: `questionBank/q${q}`,
      data: {
        institutionId: 'i0', type: 'mcq', marks: 1 + (q % 5), difficulty: ['easy', 'medium', 'hard'][q % 3], tags: ['algebra', 'বীজগণিত'], favoritedBy: [], archived: false,
        data: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `প্রশ্ন ${q}: 2x + 3 = 7 হলে x = ?` }] }] }),
        searchText: `প্রশ্ন ${q} 2x`, fingerprint: `fp${q}`, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, q)), updatedAtMs: 1700000000000 + q * 1000, meta: {}, empty: [],
      },
    });
    if (q < 10) docs.history.push({ path: `questionBank/q${q}/history/h1`, data: { snapshot: '{"v":1}', by: 'u0', at: new TimestampLike(1700000000, 0) } });
  }
  docs.questionPapers.push({ path: 'questionPapers/p1', data: { institutionId: 'i0', status: 'draft', info: { title: 'Annual Exam' }, totals: { marks: 100 } } });
  docs.items.push({ path: 'questionPapers/p1/items/it1', data: { institutionId: 'i0', order: 1, data: '{}' } });
  // the awkward values
  docs.questionBank.push({ path: 'questionBank/weird', data: { nan: NaN, inf: Infinity, ninf: -Infinity, negZero: -0, big: 9007199254740991, neg: -42.5, __t: 'user-field-named-__t', nestedMarker: { __t: 'ts', s: 1 }, bytes: Buffer.from([0, 1, 2, 255]), vec: new VectorLike([0.5, -1]), nullField: null, undef: undefined, emptyStr: '', unicode: 'বাংলা ✓ 😀', arr: [1, [2, [3, { a: undefined }]]], bool: false } });
  if (withBlob) docs.questionBank.push({ path: 'questionBank/blob', data: { blob: randomBytes(1_500_000) } }); // incompressible: forces several encryption blocks
  return docs;
}
