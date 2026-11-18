// AES-256-GCM sealing for small secrets stored in Firestore (TOTP secrets, "bring your own key" AI keys).
// - The master secret lives only in a server environment variable, never in the repo or the database.
// - Every token is bound to a context (AAD), e.g. `byok:gemini:<uid>`, so a stolen token cannot be replayed for another user.
// - Key rotation: tokens carry a key id; keep old keys in the ring until everything is re-sealed.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

export class VaultError extends Error {}
const FAIL = 'Cannot open sealed value'; // one generic message: no oracle for attackers

export const MIN_SECRET_LENGTH = 32;

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(s, 'base64url');

function deriveKey(secret, kid) {
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) throw new VaultError(`Vault secret for "${kid}" must be at least ${MIN_SECRET_LENGTH} characters`);
  return Buffer.from(hkdfSync('sha256', Buffer.from(secret), Buffer.alloc(0), Buffer.from(`em-vault-v1:${kid}`), 32));
}

// keyring: { activeKid: 'k2', keys: { k1: '<secret>', k2: '<secret>' } }
export function seal(plaintext, { keyring, aad = '' }) {
  const kid = keyring?.activeKid;
  const key = deriveKey(keyring?.keys?.[kid], kid);
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(Buffer.from(String(aad)));
  const ct = Buffer.concat([c.update(String(plaintext), 'utf8'), c.final()]);
  return ['v1', kid, b64u(iv), b64u(c.getAuthTag()), b64u(ct)].join('.');
}

export function open(token, { keyring, aad = '' }) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 5) throw new Error('format'); // exactly v1.kid.iv.tag.ct - extra segments are never ignored
    const [v, kid, iv, tag, ct] = parts;
    if (v !== 'v1' || !kid || !iv || !tag) throw new Error('format');
    const key = deriveKey(keyring.keys[kid], kid);
    const d = createDecipheriv('aes-256-gcm', key, fromB64u(iv));
    d.setAAD(Buffer.from(String(aad)));
    d.setAuthTag(fromB64u(tag));
    return Buffer.concat([d.update(fromB64u(ct)), d.final()]).toString('utf8');
  } catch {
    throw new VaultError(FAIL);
  }
}

// True when the token was sealed with a key that is no longer the active one (re-seal it on next use).
export const needsRotation = (token, keyring) => String(token).split('.')[1] !== keyring?.activeKid;

// What the UI may show after saving a secret: never the secret itself.
export const mask = (secret) => (secret && secret.length > 8 ? `••••${secret.slice(-4)}` : '••••');
