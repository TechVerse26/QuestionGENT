// Security headers + Content-Security-Policy builder (finding S-13). Pure functions so they are unit-tested; the Next.js
// middleware/proxy simply calls securityHeaders({ nonce }). Start with reportOnly:true, read the reports, then enforce.
import { randomBytes } from 'node:crypto';

export const generateNonce = () => randomBytes(16).toString('base64');

const FIREBASE_CONNECT = [
  'https://firestore.googleapis.com', 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com',
  'https://www.googleapis.com', 'https://firebaseinstallations.googleapis.com',
];

export function buildCsp({
  nonce, isDev = false, connectSrc = [], imgHosts = ['https:'], frameSrc = [], reportUri = null, legacyDirectAi = false, cloudinary = true,
} = {}) {
  if (!nonce || !/^[A-Za-z0-9+/=_-]{16,}$/.test(nonce)) throw new Error('A random nonce of at least 16 base64 characters is required');
  const connect = ["'self'", ...FIREBASE_CONNECT, ...(cloudinary ? ['https://api.cloudinary.com'] : []), ...(legacyDirectAi ? ['https://generativelanguage.googleapis.com'] : []), ...connectSrc];
  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", 'https://apis.google.com', ...(isDev ? ["'unsafe-eval'"] : [])]; // host list is only a fallback for browsers without strict-dynamic
  const d = {
    'default-src': ["'self'"],
    'script-src': script,
    'style-src': ["'self'", "'unsafe-inline'"], // React inline style attributes; scripts stay strict
    'img-src': ["'self'", 'data:', 'blob:', ...imgHosts],
    'font-src': ["'self'", 'data:'],
    'connect-src': connect,
    'frame-src': ['https://*.firebaseapp.com', 'https://accounts.google.com', ...frameSrc],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'media-src': ["'self'", 'blob:', 'https:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  const parts = Object.entries(d).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (!isDev) parts.push('upgrade-insecure-requests');
  if (reportUri) parts.push(`report-uri ${reportUri}`);
  return parts.join('; ');
}

export function securityHeaders({ nonce, isDev = false, reportOnly = false, ...cspOptions } = {}) {
  const csp = buildCsp({ nonce, isDev, ...cspOptions });
  const h = [
    [reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy', csp],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()'],
    ['Cross-Origin-Opener-Policy', 'same-origin-allow-popups'], // Google sign-in popup needs this exact value
    ['X-Frame-Options', 'DENY'],
  ];
  if (!isDev) h.push(['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload']);
  return h;
}
