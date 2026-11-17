const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function newId(len = 20) {
  const c = typeof crypto !== 'undefined' ? crypto : null;
  if (c && c.getRandomValues) {
    const a = new Uint8Array(len);
    c.getRandomValues(a);
    return Array.from(a, (b) => CHARS[b % 36]).join('');
  }
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * 36)]).join('');
}
