import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { KTX2Loader } from './vendor/KTX2Loader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

(() => {
    'use strict';

    const stage = document.getElementById('interactiveStage');
    const canvas = document.getElementById('threeCanvas');
    const bloomButton = document.querySelector('[data-action="bloom"]');
    const bloomStatus = document.getElementById('bloomStatus');
    const toolsToggle = document.querySelector('[data-action="toggle-tools"]');
    const focusResetButton = document.querySelector('[data-action="reset-focus"]');
    const sceneLoader = document.getElementById('sceneLoader');
    const sceneLoaderStatus = document.getElementById('sceneLoaderStatus');
    const sceneLoaderProgress = document.getElementById('sceneLoaderProgress');
    const performanceHud = document.getElementById('performanceHud');
    document.body.classList.add('scene-intro');
    window.setTimeout(() => document.body.classList.remove('scene-intro'), 1850);
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileQuery = window.matchMedia('(max-width: 768px)');
    const isLowPowerDevice = Boolean(
        (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
        (navigator.deviceMemory && navigator.deviceMemory <= 4)
    );
    const QUALITY_PROFILES = {
        high: {
            flowerCount: 7,
            backgroundFlowerCount: 18,
            particleCount: 68,
            maxPixelRatio: 1.65,
            anisotropy: 8,
            shadows: true,
            shadowMapSize: 1024,
            targetFps: 60,
            antialias: true,
            useMobileTextures: false,
            workerLimit: 2
        },
        balanced: {
            flowerCount: 4,
            backgroundFlowerCount: 12,
            particleCount: 40,
            maxPixelRatio: 1.15,
            anisotropy: 4,
            shadows: false,
            shadowMapSize: 512,
            targetFps: 45,
            antialias: false,
            useMobileTextures: true,
            workerLimit: 1
        },
        mobile: {
            flowerCount: 3,
            backgroundFlowerCount: 6,
            particleCount: 24,
            maxPixelRatio: 1,
            anisotropy: 2,
            shadows: false,
            shadowMapSize: 512,
            targetFps: 30,
            antialias: false,
            useMobileTextures: true,
            workerLimit: 1
        }
    };

    const getQualityProfileName = () => {
        if (mobileQuery.matches) return 'mobile';
        if (isLowPowerDevice || window.innerWidth < 1600) return 'balanced';
        return 'high';
    };
    const getQualityProfile = () => QUALITY_PROFILES[getQualityProfileName()];
    const compactExperience = () => getQualityProfileName() !== 'high';

    if (!stage || !canvas) return;

    const reducedMotion = () => motionQuery.matches;
    let modelReady = false;
    let pbrTextureRequests = 0;
    let pbrTexturesReady = 0;
    let loaderHidden = false;

    function setSceneLoaderProgress(progress, message) {
        if (!sceneLoader) return;
        if (sceneLoaderStatus && message) sceneLoaderStatus.textContent = message;
        if (sceneLoaderProgress) sceneLoaderProgress.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    }

    function hideSceneLoader(message = 'El jardín está listo.') {
        if (!sceneLoader || loaderHidden) return;
        loaderHidden = true;
        setSceneLoaderProgress(100, message);
        sceneLoader.classList.add('is-hidden');
        window.setTimeout(() => { sceneLoader.hidden = true; }, 620);
    }

    function updateSceneLoader() {
        const textureRatio = pbrTextureRequests ? pbrTexturesReady / pbrTextureRequests : 0;
        const progress = modelReady ? 70 + textureRatio * 30 : 18 + textureRatio * 42;
        setSceneLoaderProgress(progress, modelReady ? 'Afinando materiales y luz…' : 'Cargando el jardín 3D…');
        if (modelReady && pbrTexturesReady >= pbrTextureRequests) hideSceneLoader('El jardín está listo.');
    }

    function markPbrTextureReady(record) {
        if (record.ready) return;
        record.ready = true;
        pbrTexturesReady += 1;
        updateSceneLoader();
    }

    function useFallback() {
        stage.classList.add('is-fallback');
        document.body.classList.remove('realistic-flowers');
        hideSceneLoader('Modo compatible activado.');
    }

    let renderer;

    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: getQualityProfile().antialias,
            powerPreference: 'high-performance'
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
        renderer.shadowMap.enabled = getQualityProfile().shadows;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch (error) {
        console.warn('WebGL no disponible; se usa el fallback CSS.', error);
        useFallback();
        return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 2.4;
    let viewportAspect = 1;
    const cameraFocus = { x: 0, y: 0, zoom: 1 };
    const cameraFocusTarget = { x: 0, y: 0, zoom: 1 };
    const focusWorldPosition = new THREE.Vector3();
    const focusLightHome = new THREE.Vector3(0, 0.2, 1.2);
    let lastAppliedCameraZoom = 0;
    let lastAppliedViewportAspect = 0;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const environmentScene = new RoomEnvironment(renderer);
    scene.environment = pmremGenerator.fromScene(environmentScene).texture;
    environmentScene.dispose();

    scene.add(new THREE.HemisphereLight(0xffedb0, 0x151006, 1.7));

    const keyLight = new THREE.DirectionalLight(0xffe7a8, 2.8);
    keyLight.position.set(-1.8, 2.8, 3.5);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xffb52e, 1.25, 4.6);
    rimLight.position.set(1.5, 0.5, 2.2);
    scene.add(rimLight);

    const focusLight = new THREE.PointLight(0xffd36a, 0, 2.6, 1.8);
    focusLight.position.set(0, 0.2, 1.2);
    scene.add(focusLight);

    function applyQualityLighting() {
        const profile = getQualityProfile();
        renderer.shadowMap.enabled = profile.shadows;
        keyLight.castShadow = profile.shadows;
        keyLight.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
        keyLight.shadow.camera.near = 0.1;
        keyLight.shadow.camera.far = 8;
        keyLight.shadow.bias = -0.0002;
    }

    applyQualityLighting();

    function applyCameraFraming() {
        const zoom = Math.max(cameraFocus.zoom, 1);
        if (Math.abs(zoom - lastAppliedCameraZoom) < 0.0001 && Math.abs(viewportAspect - lastAppliedViewportAspect) < 0.0001) return;
        camera.left = -viewportAspect / zoom;
        camera.right = viewportAspect / zoom;
        camera.top = 1 / zoom;
        camera.bottom = -1 / zoom;
        camera.updateProjectionMatrix();
        lastAppliedCameraZoom = zoom;
        lastAppliedViewportAspect = viewportAspect;
    }

    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const raycaster = new THREE.Raycaster();
    const raycastPointer = new THREE.Vector2();
    const clock = new THREE.Clock();
    let animationFrame = 0;
    let isVisible = !document.hidden;
    let bloomTarget = 0;
    let sceneReveal = reducedMotion() ? 1 : 0;
    let interactionAudioContext = null;
    let lastRenderAt = 0;
    let adaptiveRenderScale = 1;
    let focusedFlower = null;
    let focusMix = 0;
    let focusResetTimer = 0;
    const perfDebug = new URLSearchParams(window.location.search).has('perf');
    const performanceState = {
        frames: 0,
        sampleStartedAt: performance.now(),
        fps: 0,
        minFps: Infinity,
        maxFps: 0,
        samples: 0
    };
    if (perfDebug && performanceHud) performanceHud.hidden = false;

    const garden = new THREE.Group();
    garden.position.set(0, -0.96, 0);
    garden.scale.setScalar(0.96);
    scene.add(garden);

    const glbGarden = new THREE.Group();
    glbGarden.position.copy(garden.position);
    glbGarden.scale.copy(garden.scale);
    glbGarden.visible = false;
    scene.add(glbGarden);

    // Las flores cercanas conservan el GLB completo; el fondo usa instancing
    // para multiplicar el jardín sin multiplicar llamadas de dibujo.
    const instancedGarden = new THREE.Group();
    instancedGarden.position.copy(garden.position);
    instancedGarden.scale.copy(garden.scale);
    instancedGarden.visible = false;
    scene.add(instancedGarden);

    function createContactShadowTexture() {
        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = 256;
        shadowCanvas.height = 128;
        const context = shadowCanvas.getContext('2d');
        const gradient = context.createRadialGradient(128, 64, 8, 128, 64, 124);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
        gradient.addColorStop(0.56, 'rgba(0, 0, 0, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 256, 128);
        const texture = new THREE.CanvasTexture(shadowCanvas);
        texture.needsUpdate = true;
        return texture;
    }

    const contactShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.8, 0.86),
        new THREE.MeshBasicMaterial({
            map: createContactShadowTexture(),
            color: 0x050301,
            transparent: true,
            opacity: 0.26,
            depthWrite: false,
            depthTest: false
        })
    );
    contactShadow.position.set(0, -0.93, -0.16);
    contactShadow.renderOrder = -1;
    scene.add(contactShadow);

    function updateContactShadowQuality() {
        const profileName = getQualityProfileName();
        contactShadow.material.opacity = profileName === 'high' ? 0.3 : profileName === 'balanced' ? 0.22 : 0.13;
        const scale = profileName === 'mobile' ? 0.74 : 1;
        contactShadow.scale.set(scale, scale, 1);
    }

    updateContactShadowQuality();
    const glbFlowers = [];
    const backgroundInstancedMeshes = [];
    const backgroundWindMaterials = [];
    const gltfLoader = new GLTFLoader();
    const ktx2Loader = new KTX2Loader();
    let loadedModelPath = '';
    let pendingModelPath = '';
    let backgroundModelPath = '';
    let pendingBackgroundModelPath = '';
    let backgroundFlowerCount = 0;
    let backgroundBudgetScale = 1;
    const textureLoader = new THREE.TextureLoader();
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    let ktx2Enabled = false;

    try {
        if (typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined') {
            ktx2Loader
                .setTranscoderPath('./js/vendor/basis/')
                .setWorkerLimit(getQualityProfile().workerLimit)
                .detectSupport(renderer);
            ktx2Enabled = true;
        }
    } catch (error) {
        console.warn('KTX2 no disponible; se usarán las texturas PNG/JPEG.', error);
    }

    function configurePbrTexture(texture, colorSpace, path) {
        texture.colorSpace = colorSpace;
        texture.flipY = false;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = Math.min(maxAnisotropy, getQualityProfile().anisotropy);
        texture.name = path;
        texture.needsUpdate = true;
        return texture;
    }

    function loadPbrTexture(fallbackPath, colorSpace = THREE.NoColorSpace, ktx2Path = '', mobileKtx2Path = '') {
        const selectedKtx2Path = getQualityProfile().useMobileTextures && mobileKtx2Path
            ? mobileKtx2Path
            : ktx2Path;
        const record = {
            texture: null,
            fallbackPath,
            ktx2Path: selectedKtx2Path,
            source: 'pending',
            ready: false
        };
        pbrTextureRequests += 1;

        const useFallback = () => {
            textureLoader.load(
                fallbackPath,
                (texture) => {
                    record.texture = configurePbrTexture(texture, colorSpace, fallbackPath);
                    record.source = 'fallback';
                    markPbrTextureReady(record);
                    refreshPbrMaterials();
                },
                undefined,
                () => {
                    record.source = 'unavailable';
                    markPbrTextureReady(record);
                    console.warn('No se pudo cargar la textura PBR:', fallbackPath);
                }
            );
        };

        if (!ktx2Enabled || !selectedKtx2Path) {
            useFallback();
            return record;
        }

        ktx2Loader.load(
            selectedKtx2Path,
            (texture) => {
                record.texture = configurePbrTexture(texture, colorSpace, selectedKtx2Path);
                record.source = 'ktx2';
                markPbrTextureReady(record);
                refreshPbrMaterials();
            },
            undefined,
            (error) => {
                console.warn(`No se pudo cargar ${selectedKtx2Path}; se usa ${fallbackPath}.`, error);
                useFallback();
            }
        );

        return record;
    }

    const pbrTextureSets = {
        petal: {
            map: loadPbrTexture('assets/textures/petal-basecolor.jpg', THREE.SRGBColorSpace, 'assets/textures/petal-basecolor.ktx2', 'assets/textures/petal-basecolor-mobile.ktx2'),
            normalMap: loadPbrTexture('assets/textures/petal-normal.png', THREE.NoColorSpace, 'assets/textures/petal-normal.ktx2', 'assets/textures/petal-normal-mobile.ktx2'),
            ormMap: loadPbrTexture('assets/textures/petal-orm.png', THREE.NoColorSpace, 'assets/textures/petal-orm.ktx2', 'assets/textures/petal-orm-mobile.ktx2')
        },
        leaf: {
            map: loadPbrTexture('assets/textures/leaf-basecolor.jpg', THREE.SRGBColorSpace, 'assets/textures/leaf-basecolor.ktx2', 'assets/textures/leaf-basecolor-mobile.ktx2'),
            normalMap: loadPbrTexture('assets/textures/leaf-normal.png', THREE.NoColorSpace, 'assets/textures/leaf-normal.ktx2', 'assets/textures/leaf-normal-mobile.ktx2'),
            ormMap: loadPbrTexture('assets/textures/leaf-orm.png', THREE.NoColorSpace, 'assets/textures/leaf-orm.ktx2', 'assets/textures/leaf-orm-mobile.ktx2')
        },
        center: {
            map: loadPbrTexture('assets/textures/center-basecolor.jpg', THREE.SRGBColorSpace, 'assets/textures/center-basecolor.ktx2', 'assets/textures/center-basecolor-mobile.ktx2'),
            normalMap: loadPbrTexture('assets/textures/center-normal.png', THREE.NoColorSpace, 'assets/textures/center-normal.ktx2', 'assets/textures/center-normal-mobile.ktx2'),
            ormMap: loadPbrTexture('assets/textures/center-orm.png', THREE.NoColorSpace, 'assets/textures/center-orm.ktx2', 'assets/textures/center-orm-mobile.ktx2')
        }
    };

    setSceneLoaderProgress(24, 'Cargando materiales PBR…');

    const petalGeometryCache = new Map();
    const leafGeometryCache = new Map();
    const petalMaterials = [
        new THREE.MeshPhysicalMaterial({ color: 0xffc928, roughness: 0.62, clearcoat: 0.12, clearcoatRoughness: 0.68, side: THREE.DoubleSide }),
        new THREE.MeshPhysicalMaterial({ color: 0xffd94a, roughness: 0.68, clearcoat: 0.08, clearcoatRoughness: 0.74, side: THREE.DoubleSide }),
        new THREE.MeshPhysicalMaterial({ color: 0xf5ad18, roughness: 0.66, clearcoat: 0.1, clearcoatRoughness: 0.7, side: THREE.DoubleSide })
    ];
    const leafMaterials = [
        new THREE.MeshPhysicalMaterial({ color: 0x607c42, roughness: 0.86, clearcoat: 0.04, side: THREE.DoubleSide }),
        new THREE.MeshPhysicalMaterial({ color: 0x789352, roughness: 0.9, clearcoat: 0.03, side: THREE.DoubleSide })
    ];

    function makePetalGeometry(length, width) {
        const key = length + ':' + width;
        if (petalGeometryCache.has(key)) return petalGeometryCache.get(key);

        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.bezierCurveTo(-width * 0.9, length * 0.18, -width, length * 0.7, 0, length);
        shape.bezierCurveTo(width, length * 0.7, width * 0.9, length * 0.18, 0, 0);

        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: 0.018,
            bevelEnabled: true,
            bevelSegments: 1,
            bevelSize: 0.008,
            bevelThickness: 0.006
        });
        geometry.computeVertexNormals();
        petalGeometryCache.set(key, geometry);
        return geometry;
    }

    function makeLeafGeometry(length, width) {
        const key = length + ':' + width;
        if (leafGeometryCache.has(key)) return leafGeometryCache.get(key);

        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.bezierCurveTo(width * 0.95, length * 0.18, width, length * 0.64, 0, length);
        shape.bezierCurveTo(-width, length * 0.64, -width * 0.95, length * 0.18, 0, 0);

        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: 0.012,
            bevelEnabled: true,
            bevelSegments: 1,
            bevelSize: 0.006,
            bevelThickness: 0.004
        });
        geometry.computeVertexNormals();
        leafGeometryCache.set(key, geometry);
        return geometry;
    }

    function makeLeaf(length, width, material, rotation) {
        const leaf = new THREE.Group();
        leaf.add(new THREE.Mesh(makeLeafGeometry(length, width), material));
        const veinGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.02, 0.025),
            new THREE.Vector3(0, length * 0.92, 0.025)
        ]);
        leaf.add(new THREE.Line(
            veinGeometry,
            new THREE.LineBasicMaterial({ color: 0x9aab69, transparent: true, opacity: 0.55 })
        ));
        leaf.rotation.z = rotation;
        return leaf;
    }

    function addCenter(head, size) {
        const back = new THREE.Mesh(
            new THREE.SphereGeometry(size * 1.02, 20, 12),
            new THREE.MeshStandardMaterial({ color: 0x54220d, roughness: 0.98 })
        );
        back.scale.z = 0.38;
        back.position.z = -0.025;
        head.add(back);

        const disk = new THREE.Mesh(
            new THREE.CylinderGeometry(size * 0.92, size * 0.92, 0.052, 40),
            new THREE.MeshStandardMaterial({ color: 0x6d2b0d, roughness: 0.94 })
        );
        disk.rotation.x = Math.PI / 2;
        disk.position.z = 0.02;
        head.add(disk);

        const seedGeometry = new THREE.SphereGeometry(0.012, 5, 4);
        const seedMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
        const seeds = new THREE.InstancedMesh(seedGeometry, seedMaterial, 104);
        const matrix = new THREE.Matrix4();
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const colors = [0x301209, 0x47200d, 0x7e421b, 0x9a5824];

        for (let index = 0; index < 104; index += 1) {
            const ratio = Math.sqrt((index + 0.5) / 104);
            const radius = size * 0.86 * ratio;
            const angle = index * goldenAngle;
            const seedScale = 0.7 + (1 - ratio) * 0.45;
            matrix.compose(
                new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.084),
                new THREE.Quaternion(),
                new THREE.Vector3(seedScale, seedScale * 1.35, seedScale)
            );
            seeds.setMatrixAt(index, matrix);
            seeds.setColorAt(index, new THREE.Color(colors[index % colors.length]));
        }

        seeds.instanceMatrix.needsUpdate = true;
        if (seeds.instanceColor) seeds.instanceColor.needsUpdate = true;
        head.add(seeds);
    }

    function playInteractionTone(kind = 'touch') {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            interactionAudioContext ||= new AudioContext();
            const context = interactionAudioContext;
            if (context.state === 'suspended') context.resume().catch(() => {});
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const baseFrequency = kind === 'bloom' ? 392 : kind === 'dedication' ? 523.25 : 330;
            oscillator.type = kind === 'bloom' ? 'sine' : 'triangle';
            oscillator.frequency.setValueAtTime(baseFrequency, context.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(baseFrequency * 1.18, context.currentTime + 0.16);
            gain.gain.setValueAtTime(0.0001, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(kind === 'dedication' ? 0.055 : 0.035, context.currentTime + 0.018);
            gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
            oscillator.connect(gain).connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.21);
        } catch (error) {
            // El sonido ornamental nunca debe bloquear la experiencia principal.
        }
    }

    function flowerNoise(index, channel) {
        const value = Math.sin((index + 1) * 12.9898 + channel * 78.233) * 43758.5453;
        return value - Math.floor(value);
    }

    function createFlowerVariation(index) {
        return {
            x: (flowerNoise(index, 1) - 0.5) * 0.052,
            y: (flowerNoise(index, 2) - 0.5) * 0.024,
            z: (flowerNoise(index, 3) - 0.5) * 0.08,
            scale: 0.94 + flowerNoise(index, 4) * 0.12,
            rotationX: (flowerNoise(index, 5) - 0.5) * 0.06,
            rotationY: (flowerNoise(index, 6) - 0.5) * 0.1,
            rotationZ: (flowerNoise(index, 7) - 0.5) * 0.06,
            swayAmplitude: 0.014 + flowerNoise(index, 8) * 0.009,
            headPitch: (flowerNoise(index, 9) - 0.5) * 0.075,
            headYaw: (flowerNoise(index, 10) - 0.5) * 0.12,
            headRoll: (flowerNoise(index, 11) - 0.5) * 0.065
        };
    }

    function createSunflower(index) {
        const group = new THREE.Group();
        const localScale = 0.94 + (index % 3) * 0.04;
        const stemHeight = 1.05 * localScale;
        const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.021 * localScale, 0.038 * localScale, stemHeight, 10),
            new THREE.MeshPhysicalMaterial({ color: index % 2 ? 0x58763e : 0x6c8848, roughness: 0.86, clearcoat: 0.04 })
        );
        stem.position.y = stemHeight / 2;
        group.add(stem);

        [
            { y: stemHeight * 0.31, side: -1, length: 0.4, width: 0.13, rotation: -0.92 },
            { y: stemHeight * 0.52, side: 1, length: 0.46, width: 0.15, rotation: 0.88 },
            { y: stemHeight * 0.68, side: -1, length: 0.29, width: 0.1, rotation: -0.96 }
        ].forEach((spec, leafIndex) => {
            const leaf = makeLeaf(
                spec.length * localScale,
                spec.width * localScale,
                leafMaterials[(index + leafIndex) % leafMaterials.length],
                spec.rotation
            );
            leaf.position.set(spec.side * 0.018, spec.y, 0.018);
            leaf.rotation.y = spec.side * 0.16;
            leaf.scale.x = spec.side;
            group.add(leaf);
        });

        const head = new THREE.Group();
        head.position.set(0, stemHeight + 0.08, 0.035);
        head.rotation.z = (index % 2 ? -1 : 1) * (0.025 + (index % 3) * 0.018);
        head.rotation.x = -0.04 + (index % 2) * 0.045;
        group.add(head);

        const calyx = new THREE.Mesh(
            new THREE.SphereGeometry(0.23 * localScale, 18, 10),
            new THREE.MeshPhysicalMaterial({ color: 0x6d7b35, roughness: 0.88, side: THREE.DoubleSide })
        );
        calyx.scale.z = 0.22;
        calyx.position.z = -0.06;
        head.add(calyx);

        const outerPetal = makePetalGeometry(0.31 * localScale, 0.105 * localScale);
        const innerPetal = makePetalGeometry(0.235 * localScale, 0.09 * localScale);

        for (let petalIndex = 0; petalIndex < 22; petalIndex += 1) {
            const angle = (petalIndex / 22) * Math.PI * 2;
            const petal = new THREE.Mesh(outerPetal, petalMaterials[(petalIndex + index) % petalMaterials.length]);
            petal.rotation.z = angle;
            petal.rotation.x = 0.04 + Math.sin(angle * 3) * 0.055;
            petal.rotation.y = Math.cos(angle * 2) * 0.06;
            petal.position.z = 0.01 + (petalIndex % 2) * 0.004;
            petal.scale.set(0.92 + (petalIndex % 3) * 0.055, 0.98 + (petalIndex % 2) * 0.06, 1);
            head.add(petal);
        }

        for (let petalIndex = 0; petalIndex < 16; petalIndex += 1) {
            const angle = (petalIndex / 16) * Math.PI * 2 + 0.12;
            const petal = new THREE.Mesh(innerPetal, petalMaterials[(petalIndex + index + 1) % petalMaterials.length]);
            petal.rotation.z = angle;
            petal.rotation.x = 0.13 + Math.sin(angle * 2) * 0.04;
            petal.rotation.y = Math.cos(angle * 3) * 0.05;
            petal.position.z = 0.035;
            petal.scale.set(0.86 + (petalIndex % 2) * 0.05, 0.92 + (petalIndex % 3) * 0.04, 1);
            head.add(petal);
        }

        addCenter(head, 0.175 * localScale);
        const variation = createFlowerVariation(index);
        group.userData = {
            head,
            headBaseRotation: { x: head.rotation.x, y: head.rotation.y, z: head.rotation.z },
            variation,
            windPhase: index * 0.92 + flowerNoise(index, 12) * 0.8,
            layoutRotation: 0,
            baseScale: 1,
            interactionPulse: 0
        };
        return group;
    }

    const flowers = Array.from({ length: getQualityProfile().flowerCount }, (_, index) => {
        const flower = createSunflower(index);
        garden.add(flower);
        return flower;
    });

    function getPbrTextureSet(object) {
        let current = object;
        while (current) {
            const name = current.name.toLowerCase();
            if (name.includes('petal')) return pbrTextureSets.petal;
            if (name.includes('seed') || name.includes('center')) return pbrTextureSets.center;
            if (name.includes('leaf') || name.includes('stem') || name.includes('calyx')) return pbrTextureSets.leaf;
            current = current.parent;
        }
        return null;
    }

    function applyFlowerShadowBudget(flower, index) {
        const profile = getQualityProfile();
        const heroIndex = Math.floor(profile.flowerCount / 2);
        flower.traverse((object) => {
            if (!object.isMesh) return;
            object.castShadow = profile.shadows && index === heroIndex;
            object.receiveShadow = profile.shadows;
        });
    }

    function prepareModelMaterials(model) {
        model.traverse((object) => {
            if (!object.isMesh) return;
            object.castShadow = false;
            object.receiveShadow = getQualityProfile().shadows;
            const textureSet = getPbrTextureSet(object);
            if (textureSet) {
                if (object.geometry?.attributes?.uv && !object.geometry.attributes.uv1) {
                    object.geometry.setAttribute('uv1', object.geometry.attributes.uv);
                }
            }
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => {
                if (!material) return;
                material.envMapIntensity = 1.15;
                if (textureSet) {
                    material.map = textureSet.map.texture;
                    material.normalMap = textureSet.normalMap.texture;
                    if (material.normalScale) material.normalScale.set(0.62, 0.62);
                    // ORM lineal: Three.js lee AO desde R y roughness desde G.
                    // Un único recurso sustituye las dos descargas separadas sin perder detalle PBR.
                    material.roughnessMap = textureSet.ormMap.texture;
                    material.aoMap = textureSet.ormMap.texture;
                    material.aoMapIntensity = 0.72;
                    if (textureSet === pbrTextureSets.petal && 'transmission' in material) {
                        material.sheen = compactExperience() ? 0 : 0.12;
                        material.sheenRoughness = 0.62;
                        material.sheenColor.set(0xffd35a);
                        material.transmission = compactExperience() ? 0 : 0.045;
                        material.thickness = 0.012;
                        material.ior = 1.38;
                    }
                    if (compactExperience() && 'clearcoat' in material) material.clearcoat = 0;
                }
                if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
                if (material.emissiveMap) material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
                if (material.normalMap && material.normalScale) material.normalScale.set(0.62, 0.62);
                material.needsUpdate = true;
            });
        });
    }

    function refreshPbrMaterials() {
        prepareModelMaterials(garden);
        prepareModelMaterials(glbGarden);
        prepareModelMaterials(instancedGarden);
        glbFlowers.forEach(applyFlowerShadowBudget);
    }

    function cloneWindMaterial(material) {
        const clone = material.clone();
        clone.userData = { ...clone.userData, backgroundWind: true };
        clone.onBeforeCompile = (shader) => {
            shader.uniforms.uWindTime = { value: 0 };
            shader.uniforms.uWindStrength = { value: 0.012 };
            shader.vertexShader = `
                attribute float aWindPhase;
                uniform float uWindTime;
                uniform float uWindStrength;
                ${shader.vertexShader}
            `;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                float windWave = sin(uWindTime * 0.82 + aWindPhase + position.y * 3.2 + position.x * 2.4);
                float windWeight = 0.32 + 0.68 * clamp(abs(position.y) * 2.0, 0.0, 1.0);
                transformed.x += windWave * uWindStrength * windWeight;
                transformed.z += windWave * uWindStrength * 0.35 * windWeight;`
            );
            clone.userData.windShader = shader;
        };
        clone.customProgramCacheKey = () => 'sunflower-background-wind-v1';
        clone.needsUpdate = true;
        return clone;
    }

    function cloneWindMaterials(material) {
        return Array.isArray(material)
            ? material.map(cloneWindMaterial)
            : cloneWindMaterial(material);
    }

    function clearInstancedBackground() {
        instancedGarden.clear();
        backgroundInstancedMeshes.length = 0;
        backgroundWindMaterials.length = 0;
        backgroundFlowerCount = 0;
        instancedGarden.visible = false;
    }

    function getBackgroundInstanceCount() {
        return Math.max(0, Math.ceil(backgroundFlowerCount * backgroundBudgetScale));
    }

    function layoutBackgroundInstances() {
        if (!backgroundInstancedMeshes.length) return;

        const activeCount = getBackgroundInstanceCount();
        const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(activeCount, 1) * 1.6)));
        const rowCount = Math.ceil(Math.max(activeCount, 1) / columns);
        const matrix = new THREE.Matrix4();
        const instanceMatrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const localScale = new THREE.Vector3();
        const position = new THREE.Vector3();
        const rotation = new THREE.Euler();

        backgroundInstancedMeshes.forEach(({ mesh, localMatrix }) => {
            mesh.count = activeCount;
            for (let index = 0; index < activeCount; index += 1) {
                const row = Math.floor(index / columns);
                const column = index % columns;
                const normalizedColumn = columns === 1 ? 0.5 : column / (columns - 1);
                const normalizedRow = rowCount === 1 ? 0.5 : row / (rowCount - 1);
                position.set(
                    (normalizedColumn - 0.5) * 2.95 + (flowerNoise(index, 31) - 0.5) * 0.18,
                    -0.04 + normalizedRow * 0.34 + (flowerNoise(index, 32) - 0.5) * 0.08,
                    -0.5 - normalizedRow * 0.1 - flowerNoise(index, 33) * 0.08
                );
                localScale.setScalar(0.3 + flowerNoise(index, 34) * 0.14 - normalizedRow * 0.025);
                rotation.set(
                    (flowerNoise(index, 35) - 0.5) * 0.08,
                    (flowerNoise(index, 36) - 0.5) * 0.12,
                    (flowerNoise(index, 37) - 0.5) * 0.12
                );
                quaternion.setFromEuler(rotation);
                matrix.compose(position, quaternion, localScale);
                instanceMatrix.multiplyMatrices(matrix, localMatrix);
                mesh.setMatrixAt(index, instanceMatrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
        });
    }

    function createInstancedBackground(sourceScene) {
        clearInstancedBackground();
        const count = getQualityProfile().backgroundFlowerCount;
        if (!sourceScene || !count) return;

        sourceScene.updateMatrixWorld(true);
        const phases = new Float32Array(count);
        for (let index = 0; index < count; index += 1) {
            phases[index] = index * 0.92 + flowerNoise(index, 38) * 0.8;
        }

        sourceScene.traverse((object) => {
            if (!object.isMesh || !object.geometry || !object.material) return;
            const geometry = object.geometry.clone();
            geometry.setAttribute('aWindPhase', new THREE.InstancedBufferAttribute(phases, 1));
            const mesh = new THREE.InstancedMesh(geometry, cloneWindMaterials(object.material), count);
            mesh.name = `Background_${object.name || 'FlowerPart'}`;
            mesh.frustumCulled = false;
            mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
            instancedGarden.add(mesh);
            backgroundInstancedMeshes.push({ mesh, localMatrix: object.matrixWorld.clone() });

            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((material) => backgroundWindMaterials.push(material));
        });

        backgroundFlowerCount = count;
        backgroundBudgetScale = 1;
        prepareModelMaterials(instancedGarden);
        layoutBackgroundInstances();
        instancedGarden.visible = backgroundInstancedMeshes.length > 0;
        if (perfDebug) console.info(`[FloresPerf] background-ready flowers=${count} meshes=${backgroundInstancedMeshes.length}`);
    }

    function updateBackgroundWind(elapsed) {
        backgroundWindMaterials.forEach((material) => {
            const shader = material.userData.windShader;
            if (!shader) return;
            shader.uniforms.uWindTime.value = elapsed;
            shader.uniforms.uWindStrength.value = reducedMotion() ? 0 : 0.012;
        });
    }

    function getModelPath() {
        if (mobileQuery.matches) return 'assets/models/sunflower-mobile.glb';
        if (isLowPowerDevice || window.innerWidth < 1600) return 'assets/models/sunflower-optimized.glb';
        return 'assets/models/sunflower.glb';
    }

    function getBackgroundModelPath() {
        return getQualityProfileName() === 'high'
            ? 'assets/models/sunflower-optimized.glb'
            : 'assets/models/sunflower-mobile.glb';
    }

    function loadBackgroundModel(modelPath = getBackgroundModelPath(), sourceScene = null) {
        if (modelPath === backgroundModelPath || modelPath === pendingBackgroundModelPath) return;
        pendingBackgroundModelPath = modelPath;

        const buildBackground = (sceneSource) => {
            if (modelPath !== getBackgroundModelPath()) return;
            prepareModelMaterials(sceneSource);
            createInstancedBackground(sceneSource);
            backgroundModelPath = modelPath;
            pendingBackgroundModelPath = '';
        };

        if (modelPath === loadedModelPath && sourceScene) {
            buildBackground(sourceScene);
            return;
        }

        gltfLoader.load(
            modelPath,
            (gltf) => buildBackground(gltf.scene),
            undefined,
            (error) => {
                pendingBackgroundModelPath = '';
                clearInstancedBackground();
                console.warn('No se pudo cargar el LOD instanciado del fondo.', error);
            }
        );
    }

    function loadSunflowerModel(modelPath = getModelPath()) {
        if (modelPath === loadedModelPath || modelPath === pendingModelPath) return;
        pendingModelPath = modelPath;
        gltfLoader.load(
            modelPath,
            (gltf) => {
                prepareModelMaterials(gltf.scene);

                const flowerCount = getQualityProfile().flowerCount;
                for (let index = 0; index < flowerCount; index += 1) {
                    const instance = gltf.scene.clone(true);
                    let head = null;
                    instance.traverse((object) => {
                        if (object.name === 'SunflowerHead') head = object;
                    });
                    const variation = createFlowerVariation(index);
                    instance.userData = {
                        head,
                        headBaseRotation: head ? { x: head.rotation.x, y: head.rotation.y, z: head.rotation.z } : { x: 0, y: 0, z: 0 },
                        variation,
                        windPhase: index * 0.92 + flowerNoise(index, 12) * 0.8,
                        layoutRotation: 0,
                        baseScale: 1,
                        interactionPulse: 0
                    };
                    applyFlowerShadowBudget(instance, index);
                    glbGarden.add(instance);
                    glbFlowers.push(instance);
                }

                garden.visible = false;
                glbGarden.visible = true;
                sceneReveal = reducedMotion() ? 1 : 0;
                modelReady = true;
                updateSceneLoader();
                loadedModelPath = modelPath;
                pendingModelPath = '';
                layoutGarden();
                loadBackgroundModel(getBackgroundModelPath(), gltf.scene);
                if (reducedMotion()) renderer.render(scene, camera);
            },
            undefined,
            (error) => {
                pendingModelPath = '';
                modelReady = true;
                updateSceneLoader();
                hideSceneLoader('Modo compatible activado.');
                console.warn('No se pudo cargar el GLB; se mantiene el fallback procedural.', error);
            }
        );
    }

    const desktopLayout = [
        { x: -1.28, y: 0.04, z: -0.22, scale: 0.66 },
        { x: -0.87, y: -0.01, z: -0.04, scale: 0.82 },
        { x: -0.43, y: 0.02, z: -0.18, scale: 0.63 },
        { x: 0, y: 0.04, z: 0.1, scale: 1.02 },
        { x: 0.46, y: 0.01, z: -0.1, scale: 0.7 },
        { x: 0.86, y: -0.02, z: -0.02, scale: 0.84 },
        { x: 1.28, y: 0.04, z: -0.2, scale: 0.64 }
    ];
    const mobileLayout = [
        { x: -0.34, y: 0.01, z: -0.13, scale: 0.72 },
        { x: -0.12, y: 0.03, z: -0.01, scale: 0.88 },
        { x: 0.14, y: 0.04, z: 0.08, scale: 1.0 },
        { x: 0.38, y: 0.01, z: -0.12, scale: 0.76 }
    ];

    function layoutGarden() {
        const layout = mobileQuery.matches ? mobileLayout : desktopLayout;
        const visibleFlowerCount = getQualityProfile().flowerCount;
        const activeFlowers = glbFlowers.length ? glbFlowers : flowers;
        activeFlowers.forEach((flower, index) => {
            const item = index < visibleFlowerCount ? layout[index] : null;
            flower.visible = Boolean(item);
            if (!item) return;
            const variation = flower.userData.variation || createFlowerVariation(index);
            flower.userData.variation = variation;
            flower.position.set(item.x + variation.x, item.y + variation.y, item.z + variation.z);
            flower.userData.baseScale = item.scale * variation.scale;
            flower.scale.setScalar(flower.userData.baseScale);
            flower.userData.interactionPulse = 0;
            flower.rotation.x = variation.rotationX;
            flower.rotation.y = variation.rotationY;
            flower.userData.layoutRotation = (index % 2 ? -1 : 1) * (0.012 + index * 0.002) + variation.rotationZ;
            if (flower.userData.head) {
                const base = flower.userData.headBaseRotation || { x: 0, y: 0, z: 0 };
                flower.userData.head.rotation.x = base.x + variation.headPitch;
                flower.userData.head.rotation.y = base.y + variation.headYaw;
                flower.userData.head.rotation.z = base.z + variation.headRoll;
            }
        });
    }

    const particleCount = getQualityProfile().particleCount;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocity = new Float32Array(particleCount * 2);
    const particleSeed = new Float32Array(particleCount);

    function randomParticle(index) {
        const aspect = Math.max(window.innerWidth / window.innerHeight, 0.6);
        const offset = index * 3;
        particlePositions[offset] = (Math.random() * 2 - 1) * aspect * 1.15;
        particlePositions[offset + 1] = Math.random() * 2 - 1;
        particlePositions[offset + 2] = 0.45;
        particleVelocity[index * 2] = (Math.random() - 0.5) * 0.002;
        particleVelocity[index * 2 + 1] = 0.001 + Math.random() * 0.0024;
        particleSeed[index] = Math.random() * Math.PI * 2;
    }

    for (let index = 0; index < particleCount; index += 1) randomParticle(index);

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
        particleGeometry,
        new THREE.PointsMaterial({
            color: 0xffdf7b,
            size: compactExperience() ? 0.028 : 0.022,
            transparent: true,
            opacity: 0.58,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    scene.add(particles);

    function getRenderPixelRatio() {
        const profile = getQualityProfile();
        return Math.min(window.devicePixelRatio || 1, profile.maxPixelRatio) * adaptiveRenderScale;
    }

    function samplePerformance(now) {
        performanceState.frames += 1;
        const elapsed = now - performanceState.sampleStartedAt;
        if (elapsed < 1200) return;

        performanceState.fps = performanceState.frames * 1000 / elapsed;
        const profile = getQualityProfile();
        if (performanceState.fps < profile.targetFps - 8) {
            adaptiveRenderScale = Math.max(0.72, adaptiveRenderScale - 0.08);
            backgroundBudgetScale = Math.max(0.5, backgroundBudgetScale - 0.2);
        } else if (performanceState.fps > profile.targetFps + 8) {
            adaptiveRenderScale = Math.min(1, adaptiveRenderScale + 0.04);
            backgroundBudgetScale = Math.min(1, backgroundBudgetScale + 0.1);
        }

        renderer.setPixelRatio(getRenderPixelRatio());
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        layoutBackgroundInstances();
        performanceState.minFps = Math.min(performanceState.minFps, performanceState.fps);
        performanceState.maxFps = Math.max(performanceState.maxFps, performanceState.fps);
        performanceState.samples += 1;
        const telemetry = {
            profile: getQualityProfileName(),
            fps: Math.round(performanceState.fps),
            minFps: Math.round(performanceState.minFps),
            drawCalls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            pixelRatio: Number(getRenderPixelRatio().toFixed(2)),
            adaptiveRenderScale: Number(adaptiveRenderScale.toFixed(2)),
            backgroundFlowers: getBackgroundInstanceCount(),
            pbrTextures: `${pbrTexturesReady}/${pbrTextureRequests}`
        };
        if (performanceHud) {
            performanceHud.hidden = false;
            const modelLabel = loadedModelPath ? loadedModelPath.split('/').pop() : 'cargando';
            performanceHud.textContent = `Perfil ${telemetry.profile} · ${telemetry.fps} FPS (mín. ${telemetry.minFps}) · ${telemetry.drawCalls} llamadas · ${Math.round(telemetry.triangles / 1000)}k tri · BG ${telemetry.backgroundFlowers} · DPR ${telemetry.pixelRatio} · LOD ${modelLabel}`;
        }
        if (perfDebug) console.info('[FloresPerf]', telemetry);
        performanceState.frames = 0;
        performanceState.sampleStartedAt = now;
    }

    function resize() {
        const width = Math.max(window.innerWidth, 1);
        const height = Math.max(window.innerHeight, 1);
        viewportAspect = width / height;
        applyCameraFraming();
        applyQualityLighting();
        glbFlowers.forEach(applyFlowerShadowBudget);
        renderer.setPixelRatio(getRenderPixelRatio());
        renderer.setSize(width, height, false);
        updateContactShadowQuality();
        layoutGarden();
        layoutBackgroundInstances();
    }

    function updateParticles(delta, elapsed) {
        const positions = particleGeometry.getAttribute('position').array;
        const aspect = Math.max(window.innerWidth / window.innerHeight, 0.6);

        for (let index = 0; index < particleCount; index += 1) {
            const offset = index * 3;
            const velocityOffset = index * 2;
            positions[offset] += particleVelocity[velocityOffset] + Math.sin(elapsed + particleSeed[index]) * 0.00024;
            positions[offset + 1] += particleVelocity[velocityOffset + 1] * (delta * 60);

            if (positions[offset + 1] > 1.15 || positions[offset] > aspect * 1.3 || positions[offset] < -aspect * 1.3) {
                randomParticle(index);
                positions[offset] = particlePositions[offset];
                positions[offset + 1] = -1.15;
            }
        }

        particleGeometry.getAttribute('position').needsUpdate = true;
        particles.position.x += (pointer.x * 0.045 - particles.position.x) * 0.04;
        particles.position.y += (pointer.y * 0.028 - particles.position.y) * 0.04;
    }

    function updateGarden(elapsed) {
        const wind = reducedMotion() ? 0 : Math.sin(elapsed * 0.7) * 0.008;
        sceneReveal += (1 - sceneReveal) * (reducedMotion() ? 1 : 0.045);
        const revealScale = 0.88 + sceneReveal * 0.12;
        const targetScale = (0.96 + bloomTarget * 0.045) * revealScale;

        [garden, glbGarden, instancedGarden].forEach((root) => {
            root.scale.x += (targetScale - root.scale.x) * 0.045;
            root.scale.y += (targetScale - root.scale.y) * 0.045;
            root.position.x += (pointer.x * 0.045 - root.position.x) * 0.035;
            root.rotation.z += ((pointer.x * 0.008 + wind * 0.35) - root.rotation.z) * 0.035;
        });

        updateBackgroundWind(elapsed);

        contactShadow.position.x += (pointer.x * 0.045 - contactShadow.position.x) * 0.035;

        const activeFlowers = glbFlowers.length ? glbFlowers : flowers;
        activeFlowers.forEach((flower) => {
            if (!flower.visible) return;
            const variation = flower.userData.variation || {};
            const swayAmplitude = variation.swayAmplitude || 0.018;
            const sway = reducedMotion() ? 0 : Math.sin(elapsed * 0.9 + flower.userData.windPhase) * swayAmplitude;
            const pulse = reducedMotion() ? 0 : (flower.userData.interactionPulse || 0);
            flower.userData.interactionPulse = pulse * 0.87;
            const baseScale = flower.userData.baseScale || 1;
            const isFocused = focusedFlower === flower;
            const focusScale = isFocused ? 1 + focusMix * 0.085 : 1 - focusMix * 0.035;
            const pulseScale = baseScale * focusScale * (1 + pulse * 0.085);
            flower.scale.x += (pulseScale - flower.scale.x) * 0.14;
            flower.scale.y += (pulseScale - flower.scale.y) * 0.14;
            flower.scale.z += (pulseScale - flower.scale.z) * 0.14;
            flower.rotation.z += ((flower.userData.layoutRotation + sway) - flower.rotation.z) * 0.06;
            if (flower.userData.head) {
                const base = flower.userData.headBaseRotation || { x: 0, y: 0, z: 0 };
                const headTargetX = base.x + (variation.headPitch || 0);
                const headTargetY = base.y + (variation.headYaw || 0) + (reducedMotion() ? 0 : pointer.x * 0.035);
                const headTargetZ = base.z + (variation.headRoll || 0) + sway * 0.34;
                flower.userData.head.rotation.x += (headTargetX - flower.userData.head.rotation.x) * 0.04;
                flower.userData.head.rotation.y += (headTargetY - flower.userData.head.rotation.y) * 0.04;
                flower.userData.head.rotation.z += (headTargetZ - flower.userData.head.rotation.z) * 0.05;
            }
        });
    }

    function updateCameraFocus() {
        const activeFocus = focusedFlower?.visible ? focusedFlower : null;
        focusMix += ((activeFocus ? 1 : 0) - focusMix) * (reducedMotion() ? 1 : 0.075);

        if (activeFocus) {
            const focalNode = activeFocus.userData.head || activeFocus;
            focalNode.getWorldPosition(focusWorldPosition);
            cameraFocusTarget.x = THREE.MathUtils.clamp(focusWorldPosition.x, -viewportAspect * 0.42, viewportAspect * 0.42);
            cameraFocusTarget.y = THREE.MathUtils.clamp(focusWorldPosition.y, -0.34, 0.58);
            cameraFocusTarget.zoom = mobileQuery.matches ? 1.1 : 1.17;
            focusLight.position.set(focusWorldPosition.x, focusWorldPosition.y + 0.08, 1.05);
        } else {
            cameraFocusTarget.x = 0;
            cameraFocusTarget.y = 0;
            cameraFocusTarget.zoom = 1;
            focusLight.position.lerp(focusLightHome, 0.08);
        }

        cameraFocus.x += (cameraFocusTarget.x - cameraFocus.x) * (reducedMotion() ? 1 : 0.08);
        cameraFocus.y += (cameraFocusTarget.y - cameraFocus.y) * (reducedMotion() ? 1 : 0.08);
        cameraFocus.zoom += (cameraFocusTarget.zoom - cameraFocus.zoom) * (reducedMotion() ? 1 : 0.08);
        focusLight.intensity = focusMix * (compactExperience() ? 0.72 : 1.05);
        applyCameraFraming();
    }

    function animate() {
        if (!isVisible) return;
        animationFrame = window.requestAnimationFrame(animate);
        const now = performance.now();
        const targetInterval = 1000 / getQualityProfile().targetFps;
        if (now - lastRenderAt < targetInterval) return;
        lastRenderAt = now;
        const delta = Math.min(clock.getDelta(), 0.05);
        const elapsed = clock.elapsedTime;

        pointer.x += (pointer.targetX - pointer.x) * 0.06;
        pointer.y += (pointer.targetY - pointer.y) * 0.06;

        updateParticles(delta, elapsed);
        updateGarden(elapsed);
        updateCameraFocus();
        camera.position.x += (cameraFocus.x + pointer.x * 0.035 - camera.position.x) * 0.045;
        camera.position.y += (cameraFocus.y + pointer.y * 0.022 - camera.position.y) * 0.045;
        renderer.render(scene, camera);
        samplePerformance(now);
    }

    function triggerBloom() {
        if (bloomTarget > 0.9) {
            document.querySelector('[data-action="customize"]')?.click();
            return;
        }

        bloomTarget = 1;
        playInteractionTone('bloom');
        stage.classList.add('bloom-active');
        bloomButton?.classList.add('is-bloomed');
        if (bloomButton) bloomButton.innerHTML = 'Personalizá tu dedicatoria <span aria-hidden="true">✍️</span>';
        if (bloomStatus) bloomStatus.textContent = 'El jardín despertó. Tocá nuevamente para escribir tu mensaje.';
    }

    function resetFlowerFocus() {
        focusedFlower = null;
        stage.classList.remove('flower-focus');
        document.body.classList.remove('flower-focused');
        if (focusResetTimer) window.clearTimeout(focusResetTimer);
        focusResetTimer = 0;
        if (focusResetButton) focusResetButton.hidden = true;
        if (bloomStatus && bloomTarget <= 0.9) bloomStatus.textContent = 'El jardín volvió a abrirse. Elegí otra flor cuando quieras.';
    }

    function findInteractiveFlower(object) {
        const root = glbFlowers.length ? glbGarden : garden;
        let current = object;
        while (current && current.parent && current.parent !== root) current = current.parent;
        return current?.parent === root ? current : null;
    }

    function triggerFlowerInteraction(flower, index) {
        if (!flower) return;
        if (focusedFlower === flower) {
            resetFlowerFocus();
        } else {
            focusedFlower = flower;
            stage.classList.add('flower-focus');
            document.body.classList.add('flower-focused');
            if (focusResetButton) focusResetButton.hidden = false;
            if (focusResetTimer) window.clearTimeout(focusResetTimer);
            focusResetTimer = window.setTimeout(() => {
                if (focusedFlower === flower) resetFlowerFocus();
            }, 5600);
        }
        flower.userData.interactionPulse = 1;
        bloomTarget = Math.min(1, Math.max(bloomTarget, 0.18));
        stage.classList.add('flower-touched');
        window.setTimeout(() => stage.classList.remove('flower-touched'), 520);
        playInteractionTone('touch');
        navigator.vibrate?.(18);
        if (bloomStatus) {
            bloomStatus.textContent = bloomTarget > 0.9
                ? 'El jardín responde a tu toque. Ya podés escribir tu mensaje.'
                : focusedFlower === flower
                    ? `El girasol ${index + 1} es el protagonista. Tocá otra vez para volver al jardín.`
                    : `Tocaste el girasol ${index + 1}. Hay algo especial por florecer.`;
        }
    }

    function handleScenePointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        const target = event.target;
        if (target instanceof Element && target.closest('button, dialog, input, textarea, a, [data-action]')) return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        raycastPointer.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(raycastPointer, camera);
        const activeFlowers = (glbFlowers.length ? glbFlowers : flowers).filter((flower) => flower.visible);
        const hit = raycaster.intersectObjects(activeFlowers, true)[0];
        const flower = hit ? findInteractiveFlower(hit.object) : null;
        if (flower) triggerFlowerInteraction(flower, activeFlowers.indexOf(flower));
    }

    function toggleTools() {
        const isOpen = document.body.classList.toggle('tools-open');
        toolsToggle?.setAttribute('aria-expanded', String(isOpen));
        if (toolsToggle) toolsToggle.textContent = isOpen ? 'Ocultar detalles' : 'Ver detalles';
    }

    function handlePointerMove(event) {
        pointer.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
        pointer.targetY = -(event.clientY / window.innerHeight - 0.5) * 2;
    }

    function handleVisibility() {
        isVisible = !document.hidden;
        if (!isVisible && animationFrame) {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = 0;
            lastRenderAt = 0;
        } else if (isVisible && !reducedMotion()) {
            clock.start();
            animate();
        }
    }

    function handleMotionPreference() {
        if (reducedMotion()) {
            if (animationFrame) window.cancelAnimationFrame(animationFrame);
            animationFrame = 0;
            renderer.render(scene, camera);
        } else if (isVisible && !animationFrame) {
            clock.start();
            animate();
        }
    }

    layoutGarden();
    resize();
    loadSunflowerModel();
    window.setTimeout(() => hideSceneLoader('El jardín está listo.'), 4200);

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handleScenePointerDown, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    bloomButton?.addEventListener('click', triggerBloom);
    toolsToggle?.addEventListener('click', toggleTools);
    focusResetButton?.addEventListener('click', resetFlowerFocus);
    window.addEventListener('dedication:applied', () => {
        document.body.classList.add('dedication-ready');
        playInteractionTone('dedication');
        if (bloomStatus) bloomStatus.textContent = 'Tu dedicatoria floreció. Compartila cuando quieras.';
    });

    if (typeof motionQuery.addEventListener === 'function') {
        motionQuery.addEventListener('change', handleMotionPreference);
    } else {
        motionQuery.addListener(handleMotionPreference);
    }

    if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', () => {
            const nextModelPath = getModelPath();
            if (nextModelPath !== loadedModelPath) {
                glbGarden.clear();
                glbFlowers.length = 0;
                glbGarden.visible = false;
                garden.visible = true;
                backgroundModelPath = '';
                pendingBackgroundModelPath = '';
                clearInstancedBackground();
                loadSunflowerModel(nextModelPath);
            }
            resize();
        });
    }

    if (reducedMotion()) {
        renderer.render(scene, camera);
    } else {
        clock.start();
        animate();
    }
})();
