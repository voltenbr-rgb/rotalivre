/* RotaLivre — Service Worker (cache apenas de ativos estáticos; API sempre online) */
const CACHE = "rotalivre-static-v3";
const STATIC_DESTINATIONS = ["style", "script", "font", "image"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return; // tempo real: nunca cachear API

  if (STATIC_DESTINATIONS.includes(request.destination) || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
            return response;
          }),
      ),
    );
  }
});
