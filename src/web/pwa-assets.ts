export const pwaManifest = JSON.stringify({
  name: "Quran Memo",
  short_name: "Quran Memo",
  description: "Focused Quran listening, repetition, and memorization practice.",
  start_url: "./",
  scope: "./",
  display: "standalone",
  background_color: "#0b1210",
  theme_color: "#0d1713",
  orientation: "any",
  icons: [{ src: "./icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
}, null, 2);

export const pwaIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0d1713"/>
  <rect x="52" y="52" width="408" height="408" rx="96" fill="#d8b872"/>
  <text x="256" y="348" text-anchor="middle" font-family="serif" font-size="270" font-weight="700" fill="#132019">ق</text>
</svg>`;

export const serviceWorkerSource = `
const VERSION = "quran-memo-pwa-v2";
const SHELL = ["./", "./styles.css", "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => Promise.all(
    SHELL.map((path) => cache.add(path).catch(() => undefined))
  )).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("quran-memo-pwa-") && key !== VERSION).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const dynamic = url.pathname.startsWith("/api/");
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (dynamic) {
      try {
        const response = await fetch(request);
        if (response.ok && !request.headers.has("range")) await cache.put(request, response.clone());
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
      }
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
`;
