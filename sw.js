const CACHE_NAME = 'flores-para-ti-v20';
const SHELL_ASSETS = [
    '/',
    '/css/style.css',
    '/css/interactive.css',
    '/css/design-refresh.css',
    '/css/experience-polish.css',
    '/js/vendor/three.module.js',
    '/js/vendor/GLTFLoader.js',
    '/js/vendor/KTX2Loader.js',
    '/js/vendor/ktx-parse.module.js',
    '/js/vendor/zstddec.module.js',
    '/js/vendor/basis/basis_transcoder.js',
    '/js/vendor/basis/basis_transcoder.wasm',
    '/js/utils/WorkerPool.js',
    '/js/vendor/RoomEnvironment.js',
    '/js/utils/TextureUtils.js',
    '/js/utils/BufferGeometryUtils.js',
    '/js/interactive-scene.js',
    '/js/mov.js',
    '/img/flower-mark.svg',
    '/img/sunflowers-realistic.webp',
    '/assets/models/sunflower.glb',
    '/assets/models/sunflower-mobile.glb',
    '/assets/textures/petal-basecolor.jpg',
    '/assets/textures/petal-basecolor.ktx2',
    '/assets/textures/petal-basecolor-mobile.ktx2',
    '/assets/textures/petal-normal.png',
    '/assets/textures/petal-normal.ktx2',
    '/assets/textures/petal-normal-mobile.ktx2',
    '/assets/textures/petal-roughness.png',
    '/assets/textures/petal-roughness.ktx2',
    '/assets/textures/petal-roughness-mobile.ktx2',
    '/assets/textures/petal-ao.png',
    '/assets/textures/petal-ao.ktx2',
    '/assets/textures/petal-ao-mobile.ktx2',
    '/assets/textures/leaf-basecolor.jpg',
    '/assets/textures/leaf-basecolor.ktx2',
    '/assets/textures/leaf-basecolor-mobile.ktx2',
    '/assets/textures/leaf-normal.png',
    '/assets/textures/leaf-normal.ktx2',
    '/assets/textures/leaf-normal-mobile.ktx2',
    '/assets/textures/leaf-roughness.png',
    '/assets/textures/leaf-roughness.ktx2',
    '/assets/textures/leaf-roughness-mobile.ktx2',
    '/assets/textures/leaf-ao.png',
    '/assets/textures/leaf-ao.ktx2',
    '/assets/textures/leaf-ao-mobile.ktx2',
    '/assets/textures/center-basecolor.jpg',
    '/assets/textures/center-basecolor.ktx2',
    '/assets/textures/center-basecolor-mobile.ktx2',
    '/assets/textures/center-normal.png',
    '/assets/textures/center-normal.ktx2',
    '/assets/textures/center-normal-mobile.ktx2',
    '/assets/textures/center-roughness.png',
    '/assets/textures/center-roughness.ktx2',
    '/assets/textures/center-roughness-mobile.ktx2',
    '/assets/textures/center-ao.png',
    '/assets/textures/center-ao.ktx2',
    '/assets/textures/center-ao-mobile.ktx2',
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
    if (!isSameOrigin || !cacheableDestination) return;

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
