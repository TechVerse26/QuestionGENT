import { newId } from '../utils/id.js';

const PREFIX = 'em-print-';
// '/' normally, '/REPO/' on a GitHub Pages project site (set by Vite's `base`)
const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';

// A print payload only has to live until the new tab has read it. It contains the paper AND its answer keys, so it is
// short-lived (10 minutes) and deleted the moment it is read (finding S-07).
const MAX_AGE_MS = 10 * 60 * 1000;
// Payloads already read in THIS tab: lets React re-render / StrictMode read again after the one-shot delete.
const handedOver = new Map();

function prune() {
  try {
    const cutoff = Date.now() - MAX_AGE_MS;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      try { if (!((JSON.parse(localStorage.getItem(k)) || {}).t >= cutoff)) localStorage.removeItem(k); } catch (e) { localStorage.removeItem(k); }
    }
  } catch (e) { /* storage unavailable */ }
}

// Opens the print route in a new tab. The browser's print engine produces the PDF (real text, embedded Bengali fonts, KaTeX math).
export function openPrint({ paper, items, keys = {}, mode = 'paper', auto = true }) {
  prune();
  const k = `${PREFIX}${newId(10)}`;
  localStorage.setItem(k, JSON.stringify({ paper, items, keys, mode, t: Date.now() }));
  const w = window.open(`${BASE}print?k=${k}${auto ? '' : '&auto=0'}`, '_blank');
  if (!w) {
    try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
    throw new Error('The browser blocked the print window. Allow pop-ups for this site and try again.');
  }
}

// One-shot: the stored copy is deleted as soon as it is read. Reloading the print tab therefore shows the "expired" state
// and the user prints again from the builder - the price of not leaving answer keys in the browser.
export function readPrintPayload(k) {
  if (!k || !k.startsWith(PREFIX)) return null;
  if (handedOver.has(k)) return handedOver.get(k);
  let data = null;
  try {
    const raw = localStorage.getItem(k);
    localStorage.removeItem(k);
    data = raw ? JSON.parse(raw) : null;
    if (data && !(data.t >= Date.now() - MAX_AGE_MS)) data = null;
  } catch (e) { data = null; }
  handedOver.set(k, data);
  return data;
}
