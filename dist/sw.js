const CACHE_NAME = "tasker-cache-v2";
const URLS_TO_CACHE = [
    "/",
    "/index.html",
    "/manifest.json",
    "/icons/icon-192x192.png",
    "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((c) => c.addAll(URLS_TO_CACHE)),
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys.map((k) => k !== CACHE_NAME && caches.delete(k)),
                ),
            ),
    );
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);
    const { pathname, origin } = url;

    if (
        pathname.startsWith("/@vite") ||
        pathname.startsWith("/src/") ||
        pathname.includes("react-refresh")
    ) {
        return;
    }

    event.respondWith(
        (async () => {
            const cached = await caches.match(event.request);
            if (cached) return cached;

            try {
                const net = await fetch(event.request);

                const isStatic = /\.(js|css|svg|png|jpg|jpeg|webp|ico)$/.test(
                    pathname,
                );
                if (origin === self.location.origin && net.ok && isStatic) {
                    const clone = net.clone();
                    event.waitUntil(
                        caches
                            .open(CACHE_NAME)
                            .then((cache) => cache.put(event.request, clone)),
                    );
                }

                if (
                    /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(
                        url.href,
                    ) &&
                    net.ok
                ) {
                    const clone = net.clone();
                    event.waitUntil(
                        caches
                            .open("tasker-fonts")
                            .then((cache) => cache.put(event.request, clone)),
                    );
                }

                return net;
            } catch (e) {
                if (event.request.mode === "navigate") {
                    const shell = await caches.match("/index.html");
                    if (shell) return shell;
                }
                return new Response("", { status: 503, statusText: "Offline" });
            }
        })(),
    );
});
