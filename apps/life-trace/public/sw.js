const APP_VERSION = '__LIFE_TRACE_APP_VERSION__';
const BUILD_ID = '__LIFE_TRACE_BUILD_ID__';
const CACHE_NAME = `life-trace-shell-${APP_VERSION}-${BUILD_ID}`;
const APP_SHELL_URL = '/';
const SHELL_ASSETS = [
  APP_SHELL_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
const NETWORK_FIRST_PATHS = new Set([
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableResponse(response) {
  return response && response.status === 200 && response.type !== 'opaque';
}

async function cacheResponse(request, response) {
  if (!isCacheableResponse(response)) {
    return;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function getAppShellResponse() {
  try {
    const response = await fetch(APP_SHELL_URL);
    if (isCacheableResponse(response)) {
      await cacheResponse(APP_SHELL_URL, response);
      return response;
    }
  } catch {
    // Network failures fall through to the cached shell below.
  }

  return caches.match(APP_SHELL_URL);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (!response || !response.ok) {
            return (await getAppShellResponse()) || response;
          }

          await cacheResponse(APP_SHELL_URL, response);
          return response;
        })
        .catch(() => caches.match(APP_SHELL_URL)),
    );
    return;
  }

  if (NETWORK_FIRST_PATHS.has(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!isCacheableResponse(response)) {
            return response;
          }

          cacheResponse(event.request, response);
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (!isCacheableResponse(response)) {
            return response;
          }

          cacheResponse(event.request, response);
          return response;
        })
        .catch(() => caches.match(APP_SHELL_URL));
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  const fallback = {
    title: 'Life Trace 提醒',
    body: '你有一项生活计划需要处理。',
    url: '/plans',
    tag: 'life-trace-push',
  };
  let payload = fallback;
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = fallback;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || fallback.title, {
      body: payload.body || fallback.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag || fallback.tag,
      renotify: true,
      data: {
        url: payload.url || fallback.url,
        planId: payload.planId,
      },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => 'focus' in client);
      if (existingClient) {
        existingClient.focus();
        if ('navigate' in existingClient) {
          return existingClient.navigate(targetUrl);
        }
        return undefined;
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
