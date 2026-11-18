import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore, createRateLimiter, rateLimitKey, LIMIT_PRESETS } from '../../src/server/ratelimit/limiter.js';
import { buildAuditEntry, redact, diffSummary, ipInfo, stableStringify } from '../../src/server/audit/entry.js';

// ------------------------------------------------------------------ rate limiter
test('rate limiter: allows up to the limit, then blocks with a retry hint, then recovers', () => {
  let t = 1_000_000;
  const rl = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => t });
  const r = [rl.check('u1'), rl.check('u1'), rl.check('u1')];
  assert.deepEqual(r.map((x) => x.allowed), [true, true, true]);
  assert.deepEqual(r.map((x) => x.remaining), [2, 1, 0]);
  const blocked = rl.check('u1');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfterSec, 60);
  t += 25_000;
  assert.equal(rl.check('u1').retryAfterSec, 35);
  t += 35_000; // window over
  assert.equal(rl.check('u1').allowed, true);
});

test('rate limiter: keys are independent; invalid configuration is refused; key helper is safe', () => {
  const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 5 });
  assert.equal(rl.check('a').allowed, true);
  assert.equal(rl.check('b').allowed, true);
  assert.equal(rl.check('a').allowed, false);
  assert.throws(() => createRateLimiter({ limit: 0, windowMs: 1000 }), /positive/);
  assert.throws(() => createRateLimiter({ limit: 5, windowMs: 0 }), /positive/);
  assert.equal(rateLimitKey('login', '203.0.113.7', 'a b:c'), 'login:203.0.113.7:a_b_c');
  assert.equal(rateLimitKey('x', undefined), 'x:-');
  assert.ok(LIMIT_PRESETS.mfa.limit <= 5, 'MFA attempts stay tightly limited');
});

test('memory store: bounded size (expired keys evicted first, then the oldest)', () => {
  let t = 0;
  const store = new MemoryStore({ maxKeys: 3 });
  store.hit('a', 100, t); store.hit('b', 100, t); store.hit('c', 100, t);
  t = 200; // a, b, c expired
  store.hit('d', 100, t);
  assert.ok(store.map.size <= 3);
  assert.equal(store.map.has('a'), false);
  const small = new MemoryStore({ maxKeys: 2 });
  small.hit('x', 1e9, 0); small.hit('y', 1e9, 0); small.hit('z', 1e9, 0);
  assert.equal(small.map.size, 2, 'never grows past maxKeys');
});

// ------------------------------------------------------------------ audit entries
const baseActor = { type: 'staff', uid: 'staff1', role: 'finance_admin' };

test('audit entry: complete, bounded and free of raw secrets', () => {
  const e = buildAuditEntry({
    actor: baseActor, action: 'payment.refund', target: { type: 'payment', id: 'pay_1', institutionId: 'inst_1' },
    meta: { reason: 'duplicate', amount: 500, apiKey: 'AIzaSy-SECRET', nested: { password: 'hunter2', note: 'ok' }, list: [{ token: 't' }] },
    before: { status: 'paid', amount: 500 }, after: { status: 'refunded', amount: 500 },
    ip: '203.0.113.77', userAgent: 'Mozilla/5.0 '.repeat(40), requestId: 'req_9', pepper: 'pepper'.repeat(6), now: 1700000000000,
  });
  assert.equal(e.schemaVersion, 1);
  assert.equal(e.atMs, 1700000000000);
  assert.deepEqual(e.actor, { type: 'staff', uid: 'staff1', role: 'finance_admin', actingAs: null });
  assert.deepEqual(e.target, { type: 'payment', id: 'pay_1', institutionId: 'inst_1' });
  assert.equal(e.ipPrefix, '203.0.113.0/24');
  assert.equal(e.ipHash.length, 32);
  assert.ok(!JSON.stringify(e).includes('203.0.113.77'), 'raw IP is never stored');
  assert.ok(e.ua.length <= 200);
  assert.deepEqual(e.change.changed, ['status']);
  assert.equal(e.meta.apiKey, '[redacted]');
  assert.equal(e.meta.nested.password, '[redacted]');
  assert.equal(e.meta.nested.note, 'ok');
  assert.equal(e.meta.list[0].token, '[redacted]');
  const json = JSON.stringify(e);
  for (const leak of ['AIzaSy-SECRET', 'hunter2']) assert.ok(!json.includes(leak), `leaked ${leak}`);
});

test('audit entry: validation', () => {
  const ok = { actor: baseActor, action: 'user.suspend', target: { type: 'user', id: 'u1' } };
  assert.doesNotThrow(() => buildAuditEntry(ok));
  for (const action of ['suspend', 'User.Suspend', 'user..x', 'user.', '.x', 'user suspend', '', undefined, 'user.sus-pend']) assert.throws(() => buildAuditEntry({ ...ok, action }), /Invalid action/, String(action));
  assert.throws(() => buildAuditEntry({ ...ok, actor: { type: 'robot', uid: 'x' } }), /actor type/);
  assert.throws(() => buildAuditEntry({ ...ok, actor: { type: 'staff' } }), /uid/);
  assert.throws(() => buildAuditEntry({ ...ok, actor: undefined }), /actor type/);
  assert.throws(() => buildAuditEntry({ ...ok, target: {} }), /Target type/);
  assert.doesNotThrow(() => buildAuditEntry({ ...ok, actor: { type: 'system' } }), 'system actors need no uid');
  assert.doesNotThrow(() => buildAuditEntry({ ...ok, actor: { type: 'webhook' } }));
  const imp = buildAuditEntry({ ...ok, actor: { type: 'staff', uid: 's', role: 'super_admin', actingAs: 'user9' } });
  assert.equal(imp.actor.actingAs, 'user9', 'impersonation is always visible in the log');
});

test('audit entry: oversized metadata is dropped, not truncated into something misleading', () => {
  const e = buildAuditEntry({ actor: baseActor, action: 'system.setting_change', target: { type: 'setting' }, meta: { blob: Array.from({ length: 50 }, () => 'x'.repeat(500)) } });
  assert.equal(e.metaTruncated, true);
  assert.equal(e.meta, undefined);
  const noMeta = buildAuditEntry({ actor: baseActor, action: 'system.ping', target: { type: 'setting' } });
  assert.equal('meta' in noMeta, false);
  assert.equal('change' in noMeta, false);
});

test('redact / stableStringify / diffSummary / ipInfo helpers', () => {
  assert.equal(redact('x'.repeat(600)).length, 501);
  assert.equal(redact(Array.from({ length: 80 }, (_, i) => i)).length, 50);
  assert.equal(redact({ a: { b: { c: { d: { e: { f: { g: 1 } } } } } } }).a.b.c.d.e.f, '[depth-limit]');
  assert.equal(redact({ Authorization: 'Bearer x', cookie: 'c', card_number: '4111', cvv: '1', otp: '1', recoveryCodes: [] }).Authorization, '[redacted]');
  assert.equal(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
  assert.equal(stableStringify({ a: 1, b: 2 }), stableStringify({ b: 2, a: 1 }));
  const d = diffSummary({ plan: 'free', n: 1 }, { plan: 'pro', n: 1, extra: true });
  assert.deepEqual(d.changed, ['extra', 'plan']);
  assert.notEqual(d.beforeHash, d.afterHash);
  assert.equal(diffSummary(undefined, undefined).changed.length, 0);
  assert.deepEqual(ipInfo('', 'p'), {});
  assert.equal(ipInfo('2001:db8:abcd:12::1', 'p').ipPrefix, '2001:db8:abcd::/48');
  assert.notEqual(ipInfo('1.2.3.4', 'p1').ipHash, ipInfo('1.2.3.4', 'p2').ipHash, 'hash depends on the pepper');
  assert.equal(ipInfo('1.2.3.4', 'p1').ipHash, ipInfo('1.2.3.4', 'p1').ipHash, 'stable for correlation');
});
