const CACHE_VERSION = "juanpager-shell-v2";
const scopeUrl = new URL(self.registration.scope);
const shell = [
  scopeUrl.pathname,
  `${scopeUrl.pathname}index.html`,
  `${scopeUrl.pathname}builder.html`,
  `${scopeUrl.pathname}manifest.webmanifest`,
  `${scopeUrl.pathname}config.js`,
  `${scopeUrl.pathname}juan-icon.svg`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(shell)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function cacheable(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return ["document", "script", "style", "image", "font", "manifest"].includes(request.destination);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!cacheable(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(scopeUrl.pathname))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      return cached || fresh;
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const candidate = event.notification.data?.launchUrl;
  if (typeof candidate !== "string") return;

  let launchUrl;
  try {
    launchUrl = new URL(candidate);
  } catch {
    return;
  }
  if (launchUrl.origin !== scopeUrl.origin || !launchUrl.pathname.startsWith(scopeUrl.pathname)) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === launchUrl.origin) {
          await client.navigate(launchUrl.toString());
          return client.focus();
        }
      }
      return self.clients.openWindow(launchUrl.toString());
    }),
  );
});
