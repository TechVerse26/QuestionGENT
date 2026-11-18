import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ---- minimal browser stand-ins for printExport.js (it only needs localStorage + window.open)
class FakeStorage {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
const install = (opener = () => ({})) => {
  const ls = new FakeStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });
  globalThis.window = { open: (...a) => { globalThis.window.lastOpen = a; return opener(...a); } };
  return ls;
};
let n = 0;
const freshModule = () => import(`../src/export/printExport.js?instance=${++n}`); // a new module instance = a freshly loaded tab

test('print payload (S-07): answer keys are deleted from localStorage the moment the print tab reads them', async () => {
  const ls = install();
  const m = await freshModule();
  m.openPrint({ paper: { title: 'Final' }, items: [{ id: 1 }], keys: { 1: 'SECRET ANSWER' } });
  const [url] = globalThis.window.lastOpen;
  const k = new URL(url, 'http://x').searchParams.get('k');
  assert.match(k, /^em-print-/);
  assert.ok(ls.getItem(k), 'stored for the new tab');
  const data = m.readPrintPayload(k);
  assert.equal(data.keys[1], 'SECRET ANSWER');
  assert.equal(ls.getItem(k), null, 'one-shot: removed from storage after the first read');
  assert.equal([...ls.m.values()].join('').includes('SECRET ANSWER'), false, 'no copy of the keys remains in storage');
  assert.equal(m.readPrintPayload(k), data, 'React re-renders / StrictMode still get the payload inside the same tab');
});

test('print payload: a reloaded tab, an expired payload and malformed ids all get null', async () => {
  const ls = install();
  const m = await freshModule();
  m.openPrint({ paper: {}, items: [], keys: {} });
  const k = new URL(globalThis.window.lastOpen[0], 'http://x').searchParams.get('k');
  m.readPrintPayload(k);
  const reloaded = await freshModule(); // module state is lost on reload
  assert.equal(reloaded.readPrintPayload(k), null, 'reloading the print tab shows the expired state instead of resurrecting the keys');

  ls.setItem('em-print-old', JSON.stringify({ paper: {}, t: Date.now() - 11 * 60 * 1000 }));
  assert.equal((await freshModule()).readPrintPayload('em-print-old'), null, 'older than 10 minutes');
  assert.equal(ls.getItem('em-print-old'), null, 'and it is deleted');
  ls.setItem('em-print-nots', JSON.stringify({ paper: {} }));
  assert.equal((await freshModule()).readPrintPayload('em-print-nots'), null, 'no timestamp = untrusted');
  ls.setItem('em-print-bad', '{not json');
  assert.equal((await freshModule()).readPrintPayload('em-print-bad'), null);
  const m2 = await freshModule();
  for (const bad of [null, undefined, '', 'em-institution', 'other-key', 'em-print']) assert.equal(m2.readPrintPayload(bad), null, String(bad));
  ls.setItem('em-institution', 'inst1');
  assert.equal(m2.readPrintPayload('em-institution'), null);
  assert.equal(ls.getItem('em-institution'), 'inst1', 'unrelated keys are never touched');
});

test('print payload: nothing is left behind when the pop-up is blocked, and stale payloads are pruned on the next print', async () => {
  const ls = install(() => null); // window.open returns null = blocked
  const m = await freshModule();
  assert.throws(() => m.openPrint({ paper: {}, items: [], keys: { 1: 'x' } }), /blocked the print window/);
  assert.equal([...ls.m.keys()].filter((k) => k.startsWith('em-print-')).length, 0, 'blocked pop-up leaves no payload');

  ls.setItem('em-print-stale', JSON.stringify({ t: Date.now() - 3600 * 1000 }));
  ls.setItem('em-print-fresh', JSON.stringify({ t: Date.now() }));
  ls.setItem('em-print-garbage', 'xx');
  ls.setItem('em-theme', 'dark');
  globalThis.window.open = () => ({});
  m.openPrint({ paper: {}, items: [], keys: {} });
  assert.equal(ls.getItem('em-print-stale'), null);
  assert.equal(ls.getItem('em-print-garbage'), null);
  assert.ok(ls.getItem('em-print-fresh'), 'a payload younger than 10 minutes survives');
  assert.equal(ls.getItem('em-theme'), 'dark');
});

test('PDF import (S-05): pdf.js runs with eval-based font handling disabled', () => {
  const src = readFileSync(new URL('../src/import/parsers.js', import.meta.url), 'utf8');
  assert.match(src, /getDocument\(\{[^}]*isEvalSupported: false[^}]*\}\)/);
});

test('Firebase config (S-22): no storage bucket is configured anywhere', () => {
  for (const f of ['../src/firebase/config.js', '../.env.example', '../.env.production']) {
    assert.equal(/storage_?bucket/i.test(readFileSync(new URL(f, import.meta.url), 'utf8')), false, f);
  }
});

// ---- free-plan quota message (Spark plan: Firestore stops at the daily limit)
import bn from '../src/i18n/bn.js';
import { QUOTA_MESSAGE, isQuotaMessage, isQuotaError } from '../src/utils/firebaseErrors.js';

test('free quota: Firestore "Quota exceeded" errors are recognised and have a Bengali translation', () => {
  for (const m of ['Quota exceeded.', 'quota exceeded', 'resource-exhausted', 'FirebaseError: Resource exhausted', '8 RESOURCE_EXHAUSTED: Quota exceeded']) assert.equal(isQuotaMessage(m), true, m);
  for (const m of ['permission-denied', 'Missing or insufficient permissions.', '', null, undefined, 'The quota page is empty']) assert.equal(isQuotaMessage(m), false, String(m));
  assert.equal(isQuotaError({ code: 'resource-exhausted' }), true);
  assert.equal(isQuotaError({ code: 'firestore/resource-exhausted' }), true);
  assert.equal(isQuotaError({ code: 'x', message: 'Quota exceeded.' }), true);
  assert.equal(isQuotaError({ code: 'permission-denied' }), false);
  assert.equal(isQuotaError(null), false);
  assert.ok(bn[QUOTA_MESSAGE] && bn[QUOTA_MESSAGE].includes('দৈনিক'), 'Bengali text exists for the quota message');
  const toast = readFileSync(new URL('../src/components/common/Toast.jsx', import.meta.url), 'utf8');
  assert.match(toast, /isQuotaMessage\(t\) \? tr\(QUOTA_MESSAGE\)/, 'the Toast shows the friendly message for quota errors');
});
