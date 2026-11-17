const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const BN_LETTERS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', 'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন'];
export const NUMBER_STYLES = ['decimal', 'bn', 'alpha', 'ALPHA', 'roman', 'ROMAN', 'bnLetter'];
export const NUMBER_PATTERNS = ['{n}.', '({n})', '{n})', '{n}:', '{n}'];

export const toBnDigits = (v) => String(v).replace(/\d/g, (d) => BN_DIGITS[+d]);
export const fmtDigits = (v, mode) => (mode === 'bn' ? toBnDigits(v) : String(v));

export function alphaIndex(n, upper) {
  let s = '';
  let x = Math.max(1, Math.floor(n));
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(97 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return upper ? s.toUpperCase() : s;
}

export function romanIndex(n, upper) {
  const map = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let x = Math.max(1, Math.floor(n));
  let s = '';
  for (const [v, r] of map) while (x >= v) { s += r; x -= v; }
  return upper ? s.toUpperCase() : s;
}

export function formatIndex(n, style = 'decimal') {
  switch (style) {
    case 'bn': return toBnDigits(n);
    case 'alpha': return alphaIndex(n, false);
    case 'ALPHA': return alphaIndex(n, true);
    case 'roman': return romanIndex(n, false);
    case 'ROMAN': return romanIndex(n, true);
    case 'bnLetter': return BN_LETTERS[(n - 1) % BN_LETTERS.length];
    default: return String(n);
  }
}

export const formatLabel = (n, style = 'decimal', pattern = '{n}.') => pattern.replace('{n}', formatIndex(n, style));
