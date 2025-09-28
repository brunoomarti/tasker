const STATIC_CACHE = "tasker-static-v3";
const VITE_CACHE = "tasker-vite-dev-v1";
const RUNTIME_CACHE = "tasker-runtime-v1";

const SHELL = [
    "/",
    "/index.html",
    "/manifest.json",
    "/icons/icon-192x192.png",
    "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(SHELL)));
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys.map((k) => {
                    if (
                        ![STATIC_CACHE, VITE_CACHE, RUNTIME_CACHE].includes(k)
                    ) {
                        return caches.delete(k);
                    }
                }),
            );
            await self.clients.claim();
        })(),
    );
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);
    const { origin, pathname } = url;

    if (event.request.mode === "navigate") {
        event.respondWith(networkFirst(event, STATIC_CACHE, "/index.html"));
        return;
    }

    if (
        origin === self.location.origin &&
        (pathname.startsWith("/@vite") ||
            pathname.startsWith("/src/") ||
            pathname.includes("react-refresh"))
    ) {
        event.respondWith(networkFirst(event, VITE_CACHE));
        return;
    }

    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url.href)) {
        event.respondWith(cacheFirst(event, "tasker-fonts"));
        return;
    }

    if (
        origin === self.location.origin &&
        /\.(js|css|svg|png|jpg|jpeg|webp|ico)$/.test(pathname)
    ) {
        event.respondWith(staleWhileRevalidate(event, RUNTIME_CACHE));
        return;
    }

    event.respondWith(cacheFirst(event, RUNTIME_CACHE, { fallback503: true }));
});

function cachePutLater(event, cacheName, request, response) {
    const clone = response.clone();
    event.waitUntil(caches.open(cacheName).then((c) => c.put(request, clone)));
}

async function networkFirst(event, cacheName, shellFallback) {
    try {
        const net = await fetch(event.request);
        if (net && net.ok) cachePutLater(event, cacheName, event.request, net);
        return net;
    } catch (err) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (shellFallback) {
            const shell = await caches.match(shellFallback);
            if (shell) return shell;
        }
        return new Response("", { status: 503, statusText: "Offline" });
    }
}

async function cacheFirst(event, cacheName, opts = {}) {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
        const net = await fetch(event.request);
        if (net && net.ok) cachePutLater(event, cacheName, event.request, net);
        return net;
    } catch (e) {
        if (opts.fallback503)
            return new Response("", { status: 503, statusText: "Offline" });
        return new Response("", { status: 504, statusText: "Gateway Timeout" });
    }
}

async function staleWhileRevalidate(event, cacheName) {
    const cached = await caches.match(event.request);
    const fetchPromise = fetch(event.request)
        .then((net) => {
            if (net && net.ok)
                cachePutLater(event, cacheName, event.request, net);
            return net;
        })
        .catch(() => null);

    if (cached) return cached;
    const net = await fetchPromise;
    if (net) return net;
    return new Response("", { status: 503, statusText: "Offline" });
}
