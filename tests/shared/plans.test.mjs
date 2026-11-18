import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLANS as LEGACY_PLANS, PLAN_ORDER as LEGACY_ORDER } from '../../src/constants/plans.js';
import {
  TIER_IDS, PLAN_SEED, PLAN_SEED_LIST, legacyPlanView, LIMIT_DEFS, monthKey, emptyUsage, counterValue, applyUsage,
  effectiveStatus, resolveEntitlements, checkLimit,
} from '../../src/shared/plans/index.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const objectLiteral = (src, name) => { const m = src.match(new RegExp(`const ${name} = (\\{[^}]*\\})`)); assert.ok(m, `${name} not found`); return Function(`return (${m[1]})`)(); };

test('seed plans reproduce today\'s five tiers exactly (limits, prices, order)', () => {
  assert.deepEqual(TIER_IDS, LEGACY_ORDER);
  assert.deepEqual(PLAN_SEED_LIST.map((p) => p.id), LEGACY_ORDER);
  for (const id of LEGACY_ORDER) {
    const view = legacyPlanView(PLAN_SEED[id]);
    assert.deepEqual(view, LEGACY_PLANS[id], `plan ${id} differs from src/constants/plans.js`);
  }
  PLAN_SEED_LIST.forEach((p, i) => assert.equal(p.rank, i));
});

test('the three copies of plan data (client constants, payment function, AI function) agree with the seed (no drift)', () => {
  const prices = objectLiteral(read('../../functions/src/payments/sslcommerz.js'), 'PRICES');
  const credits = objectLiteral(read('../../functions/src/ai/generateQuestions.js'), 'AI_CREDITS');
  for (const [id, price] of Object.entries(prices)) assert.equal(PLAN_SEED[id].pricing.monthly, price, `price of ${id}`);
  assert.equal(PLAN_SEED.enterprise.pricing.monthly, null, 'enterprise is not purchasable online');
  for (const [id, c] of Object.entries(credits)) assert.equal(PLAN_SEED[id].limits.aiCredits, c, `aiCredits of ${id}`);
});

test('month key rolls over at Dhaka midnight by default', () => {
  assert.equal(monthKey(Date.parse('2026-11-30T17:59:59Z')), '2026-11'); // 23:59:59 in Dhaka
  assert.equal(monthKey(Date.parse('2026-11-30T18:00:00Z')), '2026-12'); // 00:00 Dec 1 in Dhaka
  assert.equal(monthKey(Date.parse('2026-11-30T18:30:00Z'), 0), '2026-11'); // same instant in UTC
  assert.equal(monthKey(Date.parse('2026-12-31T20:00:00Z')), '2027-01');
});

test('applyUsage is immutable, clamps at zero and keeps months separate', () => {
  const a = emptyUsage();
  const b = applyUsage(a, 'questions', 5);
  assert.deepEqual(a, emptyUsage(), 'input must not be mutated');
  assert.equal(counterValue(b, 'questions'), 5);
  assert.equal(counterValue(applyUsage(b, 'questions', -50), 'questions'), 0);
  const nov = Date.parse('2026-11-10T00:00:00Z'), dec = Date.parse('2026-12-10T00:00:00Z');
  let u = applyUsage(emptyUsage(), 'exportsPerMonth', 3, nov);
  assert.equal(counterValue(u, 'exportsPerMonth', nov), 3);
  assert.equal(counterValue(u, 'exportsPerMonth', dec), 0, 'new month starts at zero');
  u = applyUsage(u, 'exportsPerMonth', 1, dec);
  assert.equal(counterValue(u, 'exportsPerMonth', nov), 3, 'old month preserved');
  assert.throws(() => applyUsage(emptyUsage(), 'nope', 1), /Unknown limit key/);
  assert.equal(counterValue(u, 'nope'), 0);
});

test('effectiveStatus: active, trial, grace, past due, expired, canceled', () => {
  const now = Date.parse('2026-11-17T00:00:00Z');
  const day = 86400000;
  assert.equal(effectiveStatus(null, now).status, 'none');
  assert.equal(effectiveStatus({ status: 'active', period: { end: now + day } }, now).status, 'active');
  assert.equal(effectiveStatus({ status: 'active' }, now).status, 'active', 'no end date = manual/enterprise');
  assert.equal(effectiveStatus({ status: 'trialing', period: { end: now + day } }, now).status, 'trialing');
  assert.equal(effectiveStatus({ status: 'active', period: { end: now - day } }, now).status, 'expired');
  assert.equal(effectiveStatus({ status: 'active', period: { end: now - day }, graceEndsAt: now + day }, now).status, 'grace');
  assert.equal(effectiveStatus({ status: 'active', period: { end: now - 2 * day }, graceEndsAt: now - day }, now).status, 'expired');
  assert.equal(effectiveStatus({ status: 'past_due', graceEndsAt: now + day }, now).status, 'grace');
  assert.equal(effectiveStatus({ status: 'past_due' }, now).status, 'expired');
  assert.equal(effectiveStatus({ status: 'canceled', period: { end: now + day } }, now).status, 'expired');
  assert.equal(effectiveStatus({ status: 'whatever' }, now).status, 'expired');
  assert.equal(effectiveStatus({ status: 'active', period: { end: new Date(now + day).toISOString() } }, now).status, 'active', 'ISO strings accepted');
  assert.equal(effectiveStatus({ status: 'active', period: { end: { toMillis: () => now - 1 } } }, now).status, 'expired', 'Firestore Timestamps accepted');
});

test('resolveEntitlements: no subscription = free; paid plan while active; expired falls back to free and soft-locks', () => {
  const now = Date.parse('2026-11-17T00:00:00Z'), day = 86400000;
  assert.equal(resolveEntitlements({ now }).planId, 'free');
  const pro = resolveEntitlements({ now, subscription: { planId: 'professional', status: 'active', period: { end: now + day } } });
  assert.equal(pro.planId, 'professional');
  assert.equal(pro.limits.papers, 300);
  assert.equal(pro.softLocked, false);
  assert.equal(pro.templateAccess.maxRank, 2);
  const expired = resolveEntitlements({ now, subscription: { planId: 'professional', status: 'active', period: { end: now - day } } });
  assert.equal(expired.planId, 'free');
  assert.equal(expired.subscribedPlanId, 'professional');
  assert.equal(expired.softLocked, true);
  assert.equal(expired.limits.papers, 5);
  assert.equal(resolveEntitlements({ now, subscription: { planId: 'ghost-plan', status: 'active' } }).planId, 'free', 'unknown plan never grants more than free');
});

test('resolveEntitlements: overrides apply to live subscriptions only', () => {
  const now = Date.parse('2026-11-17T00:00:00Z'), day = 86400000;
  const sub = { planId: 'institution', status: 'active', period: { end: now + day }, overrides: { limits: { users: 400 }, features: { whiteLabel: true } } };
  const live = resolveEntitlements({ now, subscription: sub });
  assert.equal(live.limits.users, 400);
  assert.equal(live.features.whiteLabel, true);
  assert.equal(live.limits.aiCredits, 1500, 'other limits untouched');
  const dead = resolveEntitlements({ now, subscription: { ...sub, period: { end: now - day } } });
  assert.equal(dead.limits.users, 3, 'expired subscription loses its overrides');
  assert.equal(dead.features.whiteLabel, false);
  assert.equal(PLAN_SEED.institution.limits.users, 150, 'seed is never mutated');
});

test('checkLimit: boundaries, unlimited, deltas, monthly windows, error codes', () => {
  const free = resolveEntitlements({});
  let usage = emptyUsage();
  for (let i = 0; i < 5; i++) { assert.equal(checkLimit(free, usage, 'papers').ok, true); usage = applyUsage(usage, 'papers', 1); }
  const denied = checkLimit(free, usage, 'papers');
  assert.deepEqual({ ok: denied.ok, code: denied.code, key: denied.key, limit: denied.limit, used: denied.used }, { ok: false, code: 'LIMIT_EXCEEDED', key: 'papers', limit: 5, used: 5 });
  assert.equal(denied.remaining, 0);
  // batch import of several items at once
  assert.equal(checkLimit(free, applyUsage(emptyUsage(), 'questions', 95), 'questions', 5).ok, true);
  assert.equal(checkLimit(free, applyUsage(emptyUsage(), 'questions', 95), 'questions', 6).ok, false);
  // releasing is always allowed, even when over the limit
  assert.equal(checkLimit(free, applyUsage(emptyUsage(), 'papers', 99), 'papers', -1).ok, true);
  assert.equal(checkLimit(free, usage, 'papers', 0).ok, true);
  // unlimited
  const ent = resolveEntitlements({ subscription: { planId: 'enterprise', status: 'active' } });
  assert.equal(checkLimit(ent, applyUsage(emptyUsage(), 'papers', 1e9), 'papers', 1e6).ok, true);
  // monthly window
  const nov = Date.parse('2026-11-05T00:00:00Z'), dec = Date.parse('2026-12-05T00:00:00Z');
  let ex = applyUsage(emptyUsage(), 'exportsPerMonth', 10, nov);
  assert.equal(checkLimit(free, ex, 'exportsPerMonth', 1, nov).ok, false, '10/10 in November');
  assert.equal(checkLimit(free, ex, 'exportsPerMonth', 1, dec).ok, true, 'December starts fresh');
  // unknown / unconfigured keys fail closed
  assert.equal(checkLimit(free, usage, 'bogus').code, 'UNKNOWN_LIMIT');
  const partial = { limits: { papers: 5 }, softLocked: false };
  assert.equal(checkLimit(partial, emptyUsage(), 'questions').code, 'LIMIT_NOT_CONFIGURED');
  assert.equal(checkLimit(null, emptyUsage(), 'papers').code, 'LIMIT_NOT_CONFIGURED');
});

test('checkLimit reports an expired subscription distinctly and never lets an over-limit tenant create', () => {
  const now = Date.parse('2026-11-17T00:00:00Z'), day = 86400000;
  const ent = resolveEntitlements({ now, subscription: { planId: 'professional', status: 'active', period: { end: now - day } } });
  const big = applyUsage(emptyUsage(), 'papers', 120); // created while on Professional
  const r = checkLimit(ent, big, 'papers', 1, now);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'SUBSCRIPTION_EXPIRED');
  assert.equal(checkLimit(ent, big, 'papers', -1, now).ok, true, 'deleting is still allowed');
});

test('every limit key in the seed has a usage definition (no limit without a counter)', () => {
  for (const p of PLAN_SEED_LIST) for (const k of Object.keys(p.limits)) assert.ok(LIMIT_DEFS[k], `${p.id}.${k} has no LIMIT_DEFS entry`);
});
