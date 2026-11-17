/* EXAM MASTER service worker.
 *
 * It makes the app installable and lets it open without a network (cached app shell + build files).
 * Pages are fetched network-first, so a new deploy shows up as soon as the device is online.
 * It never touches Firebase, Google API, Cloudinary or any other cross-origin data request:
 * login and data always come from the network (Firestore keeps its own offline cache).
 *
 * The deploy workflow replaces BUILD_ID on every deploy, so each deploy ships a changed sw.js and
 * browsers update the worker (and drop the old shell cache) by themselves.
 */
const BUILD_ID = '__BUILD_ID__';
const SHELL_CACHE = `em-shell-${BUILD_ID}`;
const ASSET_CACHE = 'em-assets'; // build files have hashed names, so they stay valid across deploys
const FONT_CACHE = 'em-fonts';
const MAX_ASSETS = 160; // the oldest files are dropped beyond this
const NETWORK_TIMEOUT_MS = 4000; // slower than this: open the cached shell instead of waiting
const ROOT = self.registration.scope; // https://USER.github.io/REPO/ (always ends with "/")

const isRoot = (href) => { const u = new URL(href); return u.origin + u.pathname === ROOT; };
const storable = (res) => res.ok || res.type === 'opaque';

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
  });
}

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const res = await fetch(new Request(ROOT, { cache: 'reload' }));
    if (!res.ok) throw new Error(`shell ${res.status}`);
    const html = await res.clone().text();
    await (await caches.open(SHELL_CACHE)).put(ROOT, res);
    // Also keep the scripts and styles the shell names, so it opens offline right after an update.
    const assets = await caches.open(ASSET_CACHE);
    const urls = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
      .map((m) => new URL(m[1], ROOT).href)
      .filter((href) => href.startsWith(ROOT));
    await Promise.all(urls.map(async (href) => {
      try {
        if (await assets.match(href)) return;
        const r = await fetch(href);
        if (r.ok) await assets.put(href, r);
      } catch (e) { /* it is cached when first used instead */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('em-shell-') && name !== SHELL_CACHE) await caches.delete(name);
    }
    await trim(ASSET_CACHE, MAX_ASSETS);
    await self.clients.claim();
  })());
});

// Network first: always the newest page when online; the cached shell when offline or very slow.
// Any path under the site is the same single-page app, so the shell can stand in for every route.
async function openPage(event) {
  try {
    const res = await withTimeout(fetch(event.request), NETWORK_TIMEOUT_MS);
    if (res.ok && isRoot(event.request.url)) {
      const copy = res.clone();
      event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.put(ROOT, copy)).catch(() => {}));
    }
    return res;
  } catch (e) {
    const shell = (await (await caches.open(SHELL_CACHE)).match(ROOT)) || (await caches.match(ROOT));
    if (shell) return shell;
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><p style="font:16px system-ui,sans-serif;padding:24px">You are offline. Connect to the internet and open the app again.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

async function cacheFirst(event, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const res = await fetch(event.request);
  if (storable(res)) event.waitUntil(cache.put(event.request, res.clone()).catch(() => {}));
  return res;
}

async function staleWhileRevalidate(event, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(event.request);
  const refresh = fetch(event.request).then((res) => {
    if (storable(res)) event.waitUntil(cache.put(event.request, res.clone()).catch(() => {}));
    return res;
  });
  if (hit) { event.waitUntil(refresh.catch(() => {})); return hit; }
  return refresh;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const ours = url.origin === self.location.origin && url.href.startsWith(ROOT);

  if (req.mode === 'navigate') {
    if (ours) event.respondWith(openPage(event));
  } else if (ours) {
    // /assets/ holds the hashed build output (never changes under the same name); the rest is icons, manifest, favicon
    event.respondWith(url.href.startsWith(`${ROOT}assets/`) ? cacheFirst(event, ASSET_CACHE) : staleWhileRevalidate(event, ASSET_CACHE));
  } else if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(event, FONT_CACHE));
  } else if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(event, FONT_CACHE));
  }
  // Everything else (Firebase, Google APIs, Cloudinary, CDN scripts) goes to the network untouched.
});
