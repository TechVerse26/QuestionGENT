import test from 'node:test';
import assert from 'node:assert/strict';
import {
  base32Encode, base32Decode, generateSecret, hotp, totp, stepFor, verifyTotp, otpauthUri, generateRecoveryCodes, matchRecoveryCode, fingerprint,
} from '../../src/server/security/totp.js';
import { seal, open, needsRotation, mask, VaultError } from '../../src/server/security/vault.js';
import { buildCsp, securityHeaders, generateNonce } from '../../src/server/security/headers.js';
import { checkCsrf, CSRF_HEADER } from '../../src/server/security/csrf.js';

// ------------------------------------------------------------------ TOTP / HOTP
const SHA1_KEY = Buffer.from('12345678901234567890');
const SHA256_KEY = Buffer.from('12345678901234567890123456789012');
const SHA512_KEY = Buffer.from('1234567890123456789012345678901234567890123456789012345678901234');

test('HOTP matches the RFC 4226 test vectors', () => {
  const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
  expected.forEach((code, counter) => assert.equal(hotp(SHA1_KEY, counter), code, `counter ${counter}`));
});

test('TOTP matches the RFC 6238 test vectors (SHA-1, SHA-256, SHA-512; 8 digits)', () => {
  const sha1 = { 59: '94287082', 1111111109: '07081804', 1111111111: '14050471', 1234567890: '89005924', 2000000000: '69279037', 20000000000: '65353130' };
  for (const [t, code] of Object.entries(sha1)) assert.equal(totp(SHA1_KEY, { now: Number(t) * 1000, digits: 8 }), code, `sha1 @${t}`);
  assert.equal(totp(SHA256_KEY, { now: 59000, digits: 8, algorithm: 'sha256' }), '46119246');
  assert.equal(totp(SHA256_KEY, { now: 1111111109000, digits: 8, algorithm: 'sha256' }), '68084774');
  assert.equal(totp(SHA512_KEY, { now: 59000, digits: 8, algorithm: 'sha512' }), '90693936');
  assert.equal(totp(SHA512_KEY, { now: 1111111109000, digits: 8, algorithm: 'sha512' }), '25091201');
});

test('base32 follows RFC 4648 and rejects garbage', () => {
  assert.equal(base32Encode(Buffer.from('foobar')), 'MZXW6YTBOI');
  assert.equal(base32Decode('MZXW6YTBOI======').toString(), 'foobar');
  assert.equal(base32Decode('mzxw 6ytb-oi').toString(), 'foobar', 'case, spaces and dashes are tolerated');
  assert.equal(base32Encode(SHA1_KEY), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.throws(() => base32Decode('MZXW1'), /Invalid base32/);
  const s = generateSecret();
  assert.equal(base32Decode(s).length, 20);
  assert.notEqual(generateSecret(), generateSecret());
});

test('verifyTotp: window, replay protection, formatting and brute-force shapes', () => {
  const secret = base32Encode(SHA1_KEY);
  const now = 1111111111000;
  const cur = stepFor(now);
  const code = totp(secret, { now });
  assert.deepEqual(verifyTotp(secret, code, { now }), { ok: true, step: cur });
  assert.deepEqual(verifyTotp(secret, ` ${code.slice(0, 3)} ${code.slice(3)} `, { now }), { ok: true, step: cur }, 'spaces tolerated');
  // clock drift of one step either way is accepted, two steps is not
  assert.equal(verifyTotp(secret, totp(secret, { now: now - 30000 }), { now }).ok, true);
  assert.equal(verifyTotp(secret, totp(secret, { now: now + 30000 }), { now }).ok, true);
  assert.equal(verifyTotp(secret, totp(secret, { now: now - 90000 }), { now }).ok, false);
  // replay: a code whose step was already used is refused
  assert.equal(verifyTotp(secret, code, { now, lastUsedStep: cur }).ok, false);
  assert.equal(verifyTotp(secret, code, { now, lastUsedStep: cur - 1 }).ok, true);
  // wrong shapes
  for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 5x', null, undefined, 123456.5]) assert.equal(verifyTotp(secret, bad, { now }).ok, false, `shape ${bad}`);
  assert.equal(verifyTotp(secret, '000000', { now }).ok, code === '000000');
});

test('otpauth URI and recovery codes', () => {
  const uri = otpauthUri({ issuer: 'EXAM MASTER', account: 'admin@example.com', secret: 'JBSWY3DPEHPK3PXP' });
  assert.match(uri, /^otpauth:\/\/totp\/EXAM%20MASTER:admin%40example\.com\?/);
  assert.match(uri, /secret=JBSWY3DPEHPK3PXP/);
  assert.match(uri, /digits=6/);
  assert.match(uri, /period=30/);
  const pepper = 'p'.repeat(40);
  const { codes, hashes } = generateRecoveryCodes(pepper, 10);
  assert.equal(codes.length, 10); assert.equal(new Set(codes).size, 10);
  for (const c of codes) assert.match(c, /^[0-9a-f]{5}-[0-9a-f]{5}$/);
  assert.equal(matchRecoveryCode(codes[3], hashes, pepper), 3);
  assert.equal(matchRecoveryCode(codes[3].toUpperCase().replace('-', ' '), hashes, pepper), 3, 'case and separators are normalised');
  assert.equal(matchRecoveryCode('00000-00000', hashes, pepper), -1);
  assert.equal(matchRecoveryCode(codes[3], hashes, 'q'.repeat(40)), -1, 'a different pepper never matches');
  assert.ok(hashes.every((h) => !codes.includes(h)), 'only hashes are stored');
  assert.equal(fingerprint('JBSWY3DPEHPK3PXP').length, 8);
});

// ------------------------------------------------------------------ vault
const ring = { activeKid: 'k1', keys: { k1: 'a'.repeat(40) } };

test('vault: round trip, random IV, context binding, tamper and wrong-key detection', () => {
  const t1 = seal('AIzaSy-example-key', { keyring: ring, aad: 'byok:gemini:uid1' });
  const t2 = seal('AIzaSy-example-key', { keyring: ring, aad: 'byok:gemini:uid1' });
  assert.notEqual(t1, t2, 'fresh IV every time');
  assert.ok(!t1.includes('AIzaSy'), 'plaintext must not appear in the token');
  assert.equal(open(t1, { keyring: ring, aad: 'byok:gemini:uid1' }), 'AIzaSy-example-key');
  assert.throws(() => open(t1, { keyring: ring, aad: 'byok:gemini:uid2' }), VaultError, 'bound to its context');
  const parts = t1.split('.');
  const flipped = [...parts]; flipped[4] = (flipped[4][0] === 'A' ? 'B' : 'A') + flipped[4].slice(1);
  assert.throws(() => open(flipped.join('.'), { keyring: ring, aad: 'byok:gemini:uid1' }), VaultError, 'ciphertext tamper');
  const tag = [...parts]; tag[3] = (tag[3][0] === 'A' ? 'B' : 'A') + tag[3].slice(1);
  assert.throws(() => open(tag.join('.'), { keyring: ring, aad: 'byok:gemini:uid1' }), VaultError, 'tag tamper');
  assert.throws(() => open(t1, { keyring: { activeKid: 'k1', keys: { k1: 'b'.repeat(40) } }, aad: 'byok:gemini:uid1' }), VaultError, 'wrong master secret');
});

test('vault: every failure looks the same, short secrets are refused, empty strings are fine', () => {
  const messages = new Set();
  for (const bad of ['', 'garbage', 'v1.k1.x.y.z', 'v2.k1.a.b.c', `${seal('x', { keyring: ring })}.extra`]) {
    try { open(bad, { keyring: ring }); assert.fail('should throw'); } catch (e) { assert.ok(e instanceof VaultError); messages.add(e.message); }
  }
  assert.equal(messages.size, 1, 'no oracle: one generic message');
  assert.throws(() => seal('x', { keyring: { activeKid: 'k1', keys: { k1: 'short' } } }), /at least 32/);
  assert.throws(() => seal('x', { keyring: { activeKid: 'nope', keys: { k1: 'a'.repeat(40) } } }), /at least 32/);
  assert.equal(open(seal('', { keyring: ring }), { keyring: ring }), '');
  assert.equal(open(seal('বাংলা ✓', { keyring: ring }), { keyring: ring }), 'বাংলা ✓', 'unicode');
});

test('vault: key rotation keeps old tokens readable until they are re-sealed', () => {
  const old = seal('secret-value', { keyring: ring, aad: 'x' });
  const rotated = { activeKid: 'k2', keys: { k1: 'a'.repeat(40), k2: 'c'.repeat(40) } };
  assert.equal(open(old, { keyring: rotated, aad: 'x' }), 'secret-value');
  assert.equal(needsRotation(old, rotated), true);
  const fresh = seal('secret-value', { keyring: rotated, aad: 'x' });
  assert.equal(needsRotation(fresh, rotated), false);
  assert.throws(() => open(old, { keyring: { activeKid: 'k2', keys: { k2: 'c'.repeat(40) } }, aad: 'x' }), VaultError, 'retired key');
  assert.equal(mask('AIzaSyABCDEFGH1234'), '••••1234');
  assert.equal(mask('abc'), '••••');
});

// ------------------------------------------------------------------ CSP / headers
const parseCsp = (s) => Object.fromEntries(s.split('; ').map((d) => { const [k, ...v] = d.split(' '); return [k, v]; }));
const NONCE = 'Zm9vYmFyYmF6cXV4MTIzNA==';

test('CSP: strict script policy with a nonce, no eval in production, locked-down framing and objects', () => {
  const csp = parseCsp(buildCsp({ nonce: NONCE }));
  assert.ok(csp['script-src'].includes(`'nonce-${NONCE}'`));
  assert.ok(csp['script-src'].includes("'strict-dynamic'"));
  assert.ok(!csp['script-src'].includes("'unsafe-eval'"), 'no eval in production');
  assert.ok(!csp['script-src'].includes("'unsafe-inline'"), 'scripts are never inline-allowed');
  assert.deepEqual(csp['object-src'], ["'none'"]);
  assert.deepEqual(csp['frame-ancestors'], ["'none'"]);
  assert.deepEqual(csp['base-uri'], ["'self'"]);
  assert.deepEqual(csp['form-action'], ["'self'"]);
  assert.deepEqual(csp['default-src'], ["'self'"]);
  assert.ok('upgrade-insecure-requests' in csp);
  assert.ok(csp['connect-src'].includes('https://firestore.googleapis.com'));
  assert.ok(csp['connect-src'].includes('https://api.cloudinary.com'));
  assert.ok(!csp['connect-src'].includes('https://generativelanguage.googleapis.com'), 'browser-side Gemini is not allowed by default');
});

test('CSP: dev mode allows eval only in development; options extend the right directives', () => {
  const dev = parseCsp(buildCsp({ nonce: NONCE, isDev: true }));
  assert.ok(dev['script-src'].includes("'unsafe-eval'"));
  assert.ok(!('upgrade-insecure-requests' in dev));
  const custom = parseCsp(buildCsp({ nonce: NONCE, connectSrc: ['https://api.example.com'], imgHosts: ['https://res.cloudinary.com'], legacyDirectAi: true, cloudinary: false, reportUri: '/api/csp-report' }));
  assert.ok(custom['connect-src'].includes('https://api.example.com'));
  assert.ok(custom['connect-src'].includes('https://generativelanguage.googleapis.com'));
  assert.ok(!custom['connect-src'].includes('https://api.cloudinary.com'));
  assert.ok(!custom['img-src'].includes('https:'), 'image hosts can be narrowed to an allow-list');
  assert.ok(custom['img-src'].includes('https://res.cloudinary.com'));
  assert.deepEqual(custom['report-uri'], ['/api/csp-report']);
});

test('CSP: a missing or weak nonce is refused; nonces are random', () => {
  for (const bad of [undefined, '', 'short', 'has spaces in it........', "x';script-src *;'"]) assert.throws(() => buildCsp({ nonce: bad }), /nonce/, String(bad));
  const a = generateNonce(), b = generateNonce();
  assert.notEqual(a, b);
  assert.ok(Buffer.from(a, 'base64').length >= 16);
});

test('security headers: report-only mode, HSTS only in production, popups still work for Google sign-in', () => {
  const prod = Object.fromEntries(securityHeaders({ nonce: NONCE }));
  assert.ok(prod['Content-Security-Policy']);
  assert.match(prod['Strict-Transport-Security'], /max-age=63072000/);
  assert.equal(prod['X-Content-Type-Options'], 'nosniff');
  assert.equal(prod['X-Frame-Options'], 'DENY');
  assert.equal(prod['Cross-Origin-Opener-Policy'], 'same-origin-allow-popups');
  assert.match(prod['Permissions-Policy'], /camera=\(\)/);
  assert.match(prod['Permissions-Policy'], /microphone=\(self\)/, 'voice messages need the microphone');
  const ro = Object.fromEntries(securityHeaders({ nonce: NONCE, reportOnly: true }));
  assert.ok(ro['Content-Security-Policy-Report-Only']);
  assert.ok(!ro['Content-Security-Policy']);
  const dev = Object.fromEntries(securityHeaders({ nonce: NONCE, isDev: true }));
  assert.ok(!dev['Strict-Transport-Security']);
});

// ------------------------------------------------------------------ CSRF
const ALLOWED = ['https://exam.example.com', 'http://localhost:3000'];

test('CSRF: only same-origin requests carrying our header may mutate', () => {
  const ok = { origin: 'https://exam.example.com', [CSRF_HEADER]: '1' };
  assert.equal(checkCsrf({ method: 'GET', headers: {}, allowedOrigins: ALLOWED }).ok, true, 'reads need no token');
  assert.equal(checkCsrf({ method: 'POST', headers: ok, allowedOrigins: ALLOWED }).ok, true);
  assert.equal(checkCsrf({ method: 'delete', headers: ok, allowedOrigins: ALLOWED }).ok, true, 'method is case-insensitive');
  assert.deepEqual(checkCsrf({ method: 'POST', headers: { [CSRF_HEADER]: '1' }, allowedOrigins: ALLOWED }), { ok: false, reason: 'MISSING_ORIGIN' });
  assert.deepEqual(checkCsrf({ method: 'POST', headers: { origin: 'null', [CSRF_HEADER]: '1' }, allowedOrigins: ALLOWED }), { ok: false, reason: 'MISSING_ORIGIN' });
  assert.deepEqual(checkCsrf({ method: 'POST', headers: { origin: 'https://evil.example', [CSRF_HEADER]: '1' }, allowedOrigins: ALLOWED }), { ok: false, reason: 'ORIGIN_NOT_ALLOWED' });
  assert.deepEqual(checkCsrf({ method: 'POST', headers: { origin: 'https://exam.example.com.evil.io', [CSRF_HEADER]: '1' }, allowedOrigins: ALLOWED }), { ok: false, reason: 'ORIGIN_NOT_ALLOWED' });
  assert.deepEqual(checkCsrf({ method: 'POST', headers: { origin: 'http://exam.example.com', [CSRF_HEADER]: '1' }, allowedOrigins: ALLOWED }), { ok: false, reason: 'ORIGIN_NOT_ALLOWED' }, 'scheme must match');
  assert.deepEqual(checkCsrf({ method: 'POST', headers: { origin: 'https://exam.example.com' }, allowedOrigins: ALLOWED }), { ok: false, reason: 'MISSING_CSRF_HEADER' });
  assert.deepEqual(checkCsrf({ method: 'PUT', headers: { origin: 'https://exam.example.com', [CSRF_HEADER]: '0' }, allowedOrigins: ALLOWED }), { ok: false, reason: 'MISSING_CSRF_HEADER' });
});

test('CSRF: referer fallback, Headers objects and case-insensitive plain objects', () => {
  assert.equal(checkCsrf({ method: 'POST', headers: { Referer: 'https://exam.example.com/app/papers?x=1', 'X-EM-CSRF': '1' }, allowedOrigins: ALLOWED }).ok, true);
  assert.equal(checkCsrf({ method: 'POST', headers: new Headers({ origin: 'http://localhost:3000', [CSRF_HEADER]: '1' }), allowedOrigins: ALLOWED }).ok, true);
  assert.equal(checkCsrf({ method: 'POST', headers: new Headers({ origin: 'http://localhost:3001', [CSRF_HEADER]: '1' }), allowedOrigins: ALLOWED }).ok, false, 'port must match');
  assert.equal(checkCsrf({ method: 'POST', headers: { referer: 'not a url', 'x-em-csrf': '1' }, allowedOrigins: ALLOWED }).ok, false);
  assert.equal(checkCsrf({ method: 'POST', headers: { origin: 'https://exam.example.com' }, allowedOrigins: ALLOWED, requireHeader: false }).ok, true);
  assert.equal(checkCsrf({ method: 'POST', headers: null, allowedOrigins: ALLOWED }).ok, false);
});
