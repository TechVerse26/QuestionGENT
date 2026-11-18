// CSRF guard for cookie-authenticated mutating requests (session cookies are SameSite=Lax; this is defence in depth).
// A request passes only if it comes from one of our own origins AND carries our custom header, which a cross-site form cannot set.
export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export const CSRF_HEADER = 'x-em-csrf';

const getHeader = (headers, name) => {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  const k = Object.keys(headers).find((x) => x.toLowerCase() === name);
  return k ? headers[k] : null;
};

const originOf = (v) => { try { const u = new URL(v); return `${u.protocol}//${u.host}`; } catch { return null; } };

export function checkCsrf({ method, headers, allowedOrigins = [], requireHeader = true }) {
  if (!MUTATING_METHODS.has(String(method).toUpperCase())) return { ok: true };
  const origin = getHeader(headers, 'origin');
  const referer = getHeader(headers, 'referer');
  const claimed = origin && origin !== 'null' ? origin : origin === 'null' ? null : referer ? originOf(referer) : null;
  if (!claimed) return { ok: false, reason: 'MISSING_ORIGIN' };
  const normalized = originOf(claimed);
  if (!normalized || !allowedOrigins.map(originOf).includes(normalized)) return { ok: false, reason: 'ORIGIN_NOT_ALLOWED' };
  if (requireHeader && getHeader(headers, CSRF_HEADER) !== '1') return { ok: false, reason: 'MISSING_CSRF_HEADER' };
  return { ok: true };
}
