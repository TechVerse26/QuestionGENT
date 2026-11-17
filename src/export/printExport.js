import { newId } from '../utils/id.js';

const PREFIX = 'em-print-';
// '/' normally, '/REPO/' on a GitHub Pages project site (set by Vite's `base`)
const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';

function prune() {
  try {
    const cutoff = Date.now() - 6 * 3600 * 1000;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      try { if ((JSON.parse(localStorage.getItem(k)) || {}).t < cutoff) localStorage.removeItem(k); } catch (e) { localStorage.removeItem(k); }
    }
  } catch (e) { /* storage unavailable */ }
}

// Opens the print route in a new tab. The browser's print engine produces the PDF (real text, embedded Bengali fonts, KaTeX math).
export function openPrint({ paper, items, keys = {}, mode = 'paper', auto = true }) {
  prune();
  const k = `${PREFIX}${newId(10)}`;
  localStorage.setItem(k, JSON.stringify({ paper, items, keys, mode, t: Date.now() }));
  const w = window.open(`${BASE}print?k=${k}${auto ? '' : '&auto=0'}`, '_blank');
  if (!w) throw new Error('The browser blocked the print window. Allow pop-ups for this site and try again.');
}

export function readPrintPayload(k) {
  if (!k || !k.startsWith(PREFIX)) return null;
  try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; }
}
