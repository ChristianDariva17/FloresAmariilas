const CACHE_NAME = 'flores-para-ti-v1';
const urlsToCache = [
    '/',
    '/style.css',
    '/sound/FloresAmarillas.mp3',
    '/img/flowers.png',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});