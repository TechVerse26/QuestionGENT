// Install-to-home-screen support.
// Chrome, Edge and Samsung Internet fire `beforeinstallprompt`; we keep that event so the "Install app" button can open the
// browser's own install dialog. iPhone/iPad Safari has no such event, so the button shows the manual steps there.
let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

// True when the app is running as an installed app (home-screen icon / app window) instead of a browser tab.
export function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch (e) { return false; }
}

function isIos() {
  try {
    const ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  } catch (e) { return false; }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
}

// 'installed' (already running as an app) | 'prompt' (the browser can show its install dialog) | 'ios' (show the manual steps) | 'none'
export function installMode() {
  if (isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIos()) return 'ios';
  return 'none';
}

export function subscribeInstall(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const ev = deferred;
  deferred = null; // the browser allows one prompt per event; it fires a fresh event later if the user dismisses it
  notify();
  ev.prompt();
  try { return (await ev.userChoice).outcome; } catch (e) { return 'dismissed'; }
}
