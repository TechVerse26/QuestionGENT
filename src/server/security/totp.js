// RFC 4226 (HOTP) / RFC 6238 (TOTP) with no dependencies. Used for admin MFA because Firebase's own TOTP MFA needs the
// Identity Platform upgrade (billing). Secrets must be stored ENCRYPTED (see vault.js) and never sent back to the browser
// after enrolment. Verification is constant-time and replay-protected.
import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  if (!/^[A-Z2-7]*$/.test(clean)) throw new Error('Invalid base32 secret');
  let bits = 0, value = 0; const out = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export const generateSecret = (bytes = 20) => base32Encode(randomBytes(bytes));

export function hotp(secret, counter, { digits = 6, algorithm = 'sha1' } = {}) {
  const key = Buffer.isBuffer(secret) ? secret : base32Decode(secret);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac(algorithm, key).update(msg).digest();
  const o = h[h.length - 1] & 0x0f;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const stepFor = (now = Date.now(), step = 30) => Math.floor(now / 1000 / step);

export const totp = (secret, { now = Date.now(), step = 30, digits = 6, algorithm = 'sha1' } = {}) => hotp(secret, stepFor(now, step), { digits, algorithm });

const safeEqual = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

// -> { ok: true, step } | { ok: false }. Pass the last accepted step to refuse replays of an already used code.
export function verifyTotp(secret, token, { now = Date.now(), step = 30, digits = 6, window = 1, algorithm = 'sha1', lastUsedStep = -1 } = {}) {
  const code = String(token ?? '').replace(/\s/g, '');
  if (code.length !== digits || !/^\d+$/.test(code)) return { ok: false };
  const current = stepFor(now, step);
  let matched = null;
  for (let d = -window; d <= window; d++) {
    const s = current + d;
    if (s < 0) continue;
    if (safeEqual(hotp(secret, s, { digits, algorithm }), code) && matched === null && s > lastUsedStep) matched = s; // no early exit: constant-ish time
  }
  return matched === null ? { ok: false } : { ok: true, step: matched };
}

export function otpauthUri({ issuer, account, secret, digits = 6, period = 30, algorithm = 'SHA1' }) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const q = new URLSearchParams({ secret, issuer, algorithm, digits: String(digits), period: String(period) });
  return `otpauth://totp/${label}?${q.toString()}`;
}

// ---- single-use recovery codes: only HASHES are stored ----
const hashCode = (code, pepper) => createHmac('sha256', pepper).update(String(code).toLowerCase().replace(/[^a-z0-9]/g, '')).digest('hex');

export function generateRecoveryCodes(pepper, count = 10) {
  const codes = Array.from({ length: count }, () => {
    const h = randomBytes(5).toString('hex'); // 10 hex chars
    return `${h.slice(0, 5)}-${h.slice(5)}`;
  });
  return { codes, hashes: codes.map((c) => hashCode(c, pepper)) };
}

// -> index of the matching hash (caller removes it so the code cannot be reused) or -1
export function matchRecoveryCode(code, hashes, pepper) {
  const h = hashCode(code, pepper);
  let idx = -1;
  hashes.forEach((x, i) => { if (x.length === h.length && timingSafeEqual(Buffer.from(x), Buffer.from(h)) && idx === -1) idx = i; });
  return idx;
}

export const fingerprint = (secret) => createHash('sha256').update(secret).digest('hex').slice(0, 8); // for logs, never the secret itself
