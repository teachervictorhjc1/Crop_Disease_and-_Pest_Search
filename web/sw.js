// Service Worker：離線快取
// 更新 App 檔案後請把 VERSION 加 1，讓使用者取得新版。
const VERSION = 'v3';
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const PHOTOS = 'photos-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/data.js',
  './js/illus.js',
  './js/photo.js',
  './js/config.js',
  './data/meta.json',
  './data/crops.json',
  './data/issues.json',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, RUNTIME, PHOTOS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** 先回快取、背景更新（stale-while-revalidate） */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
  const network = fetch(request)
    .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
    .catch(() => null);
  return cached || (await network) || (await caches.match('./index.html'));
}

/** 網路優先、失敗時用快取（資料庫 API） */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('離線且無快取');
  }
}

/** 快取優先（照片），並限制數量 */
async function cacheFirstLimited(request, cacheName, max = 150) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') {
    await cache.put(request, res.clone());
    const keys = await cache.keys();
    if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL));
  } else if (url.hostname.endsWith('.supabase.co')) {
    event.respondWith(networkFirst(request, RUNTIME));
  } else if (url.hostname === 'upload.wikimedia.org') {
    event.respondWith(cacheFirstLimited(request, PHOTOS));
  } else if (url.hostname === 'commons.wikimedia.org') {
    event.respondWith(networkFirst(request, RUNTIME));
  }
});
