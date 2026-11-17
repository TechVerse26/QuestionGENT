export const isPlain = (v) => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

export function deepMerge(base, over) {
  if (!isPlain(base) || !isPlain(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
  return out;
}

export function setIn(obj, path, value) {
  const [h, ...rest] = Array.isArray(path) ? path : path.split('.');
  if (!rest.length) return { ...obj, [h]: value };
  return { ...obj, [h]: setIn((obj && obj[h]) || {}, rest, value) };
}

export function getIn(obj, path, fallback) {
  const parts = Array.isArray(path) ? path : path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return fallback;
    cur = cur[p];
  }
  return cur === undefined ? fallback : cur;
}

export const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

export function stripUndefined(v) {
  if (Array.isArray(v)) return v.map(stripUndefined);
  if (isPlain(v)) {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = stripUndefined(x);
    return o;
  }
  return v;
}
