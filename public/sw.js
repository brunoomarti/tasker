self.addEventListener("install", () => {
    console.log("Service Worker installing.");
    self.skipWaiting();
});

self.addEventListener("activate", () => {
    console.log("Service Worker activating.");
});

self.addEventListener("online", () => {
    self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({type: 'online'}));
    });
});

self.addEventListener("sync", (event) => {
    if (event.tag === 'sync-tasks') {
        self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({type: 'online'}));
        });
    }
});