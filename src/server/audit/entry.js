// Builds immutable audit-log entries (finding S-08). Pure: the caller writes the result with the Admin SDK and a server
// timestamp. Values are redacted and bounded; changes are recorded as field names + hashes, never as copies of the data.
import { createHash, createHmac } from 'node:crypto';

export const ACTOR_TYPES = ['user', 'staff', 'system', 'webhook'];
const ACTION_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const SENSITIVE_KEY = /(pass(word)?|secret|token|api[-_]?key|authorization|cookie|otp|private|credential|signature|card|cvv|mfa|recovery)/i;
const MAX_META_BYTES = 4096;

export function redact(value, depth = 0) {
  if (value === null || typeof value !== 'object') return typeof value === 'string' && value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (depth >= 6) return '[depth-limit]';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
  return out;
}

export function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}

const sha = (v) => createHash('sha256').update(stableStringify(v)).digest('hex');

export function diffSummary(before, after) {
  const b = before || {}, a = after || {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
  return { changed: keys.filter((k) => stableStringify(b[k]) !== stableStringify(a[k])), beforeHash: sha(b), afterHash: sha(a) };
}

export function ipInfo(ip, pepper) {
  if (!ip) return {};
  const ipHash = createHmac('sha256', pepper || '').update(String(ip)).digest('hex').slice(0, 32);
  let ipPrefix = null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) ipPrefix = `${ip.split('.').slice(0, 3).join('.')}.0/24`;
  else if (ip.includes(':')) ipPrefix = `${ip.split(':').slice(0, 3).join(':')}::/48`;
  return { ipHash, ipPrefix };
}

export function buildAuditEntry({ actor, action, target, meta, before, after, ip, userAgent, requestId, pepper, now = Date.now() }) {
  if (!actor || !ACTOR_TYPES.includes(actor.type)) throw new Error('Invalid actor type');
  if ((actor.type === 'user' || actor.type === 'staff') && !actor.uid) throw new Error('Actor uid is required');
  if (!ACTION_RE.test(String(action))) throw new Error(`Invalid action name: ${action}`);
  if (!target?.type) throw new Error('Target type is required');
  const entry = {
    schemaVersion: 1,
    atMs: now,
    actor: { type: actor.type, uid: actor.uid ?? null, role: actor.role ?? null, actingAs: actor.actingAs ?? null },
    action,
    target: { type: target.type, id: target.id ?? null, institutionId: target.institutionId ?? null },
    ...ipInfo(ip, pepper),
    ua: userAgent ? String(userAgent).slice(0, 200) : null,
    requestId: requestId ?? null,
  };
  if (before !== undefined || after !== undefined) entry.change = diffSummary(before, after);
  if (meta !== undefined) {
    const m = redact(meta);
    if (Buffer.byteLength(JSON.stringify(m)) <= MAX_META_BYTES) entry.meta = m;
    else entry.metaTruncated = true;
  }
  return entry;
}
