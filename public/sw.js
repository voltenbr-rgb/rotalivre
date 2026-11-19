/* RotaLivre — Service Worker (cache apenas de ativos estáticos; API sempre online) */
const CACHE = "rotalivre-static-v6";
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

/* ---------- Notificações push (corridas novas, testes) ---------- */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "RotaLivre", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "RotaLivre";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.tag || "rotalivre",
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" },
  };
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Com o app aberto na tela, não precisa notificar (o feed já mostra)
      const visible = list.some((c) => c.visibilityState === "visible" && c.focused);
      if (visible && data.tag === "corrida") return;
      return self.registration.showNotification(title, options);
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url).catch(() => null);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
