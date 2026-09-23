const CACHE_NAME = 'flores-para-ti-v25';
const SHELL_ASSETS = [
    '/',
    '/css/style.css',
    '/css/interactive.css',
    '/css/design-refresh.css',
    '/css/experience-polish.css',
    '/css/flower-first.css',
    '/js/vendor/three.module.js',
    '/js/vendor/GLTFLoader.js',
    '/js/vendor/KTX2Loader.js',
    '/js/vendor/ktx-parse.module.js',
    '/js/vendor/zstddec.module.js',
    '/js/vendor/basis/basis_transcoder.js',
    '/js/vendor/basis/basis_transcoder.wasm',
    '/js/vendor/RoomEnvironment.js',
    '/js/interactive-scene.js',
    '/js/mov.js',
    '/img/flower-mark.svg',
    '/img/sunflowers-realistic.webp',
    '/manifest.json',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(SHELL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);
    const isSameOrigin = requestUrl.origin === self.location.origin;
    const cacheableDestination = ['document', 'script', 'style', 'image', 'manifest', 'video'].includes(event.request.destination);
    const cacheable3DAsset = /\.(glb|ktx2)$/i.test(requestUrl.pathname);
    if (!isSameOrigin || (!cacheableDestination && !cacheable3DAsset)) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => cachedResponse || fetch(event.request).then((response) => {
            if (response.ok) {
                const responseCopy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
            }
            return response;
        }).catch(() => caches.match('/')))
    );
});
