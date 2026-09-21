import * as THREE from '../js/vendor/three.module.js';
import { GLTFExporter } from '../js/vendor/GLTFExporter.mjs';
import fs from 'node:fs';
import path from 'node:path';

globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
        blob.arrayBuffer().then((buffer) => {
            this.result = buffer;
            if (this.onloadend) this.onloadend();
        }).catch((error) => {
            if (this.onerror) this.onerror(error);
        });
    }
};

const isMobile = process.argv.includes('--mobile');
const quality = isMobile ? {
    name: 'mobile',
    outerPetals: 18,
    innerPetals: 12,
    petalWidthSegments: 7,
    petalLengthSegments: 14,
    leafWidthSegments: 6,
    leafLengthSegments: 8,
    stemSegments: 10,
    calyxWidthSegments: 18,
    calyxHeightSegments: 10,
    centerSegments: 32,
    seedSegments: 5,
    seedRings: 4,
    seedCount: 72
} : {
    name: 'desktop',
    outerPetals: 32,
    innerPetals: 22,
    petalWidthSegments: 14,
    petalLengthSegments: 28,
    leafWidthSegments: 10,
    leafLengthSegments: 16,
    stemSegments: 20,
    calyxWidthSegments: 32,
    calyxHeightSegments: 18,
    centerSegments: 64,
    seedSegments: 7,
    seedRings: 5,
    seedCount: 220
};

const output = path.resolve(isMobile ? 'assets/models/sunflower-mobile.glb' : 'assets/models/sunflower.glb');
fs.mkdirSync(path.dirname(output), { recursive: true });

const scene = new THREE.Scene();
scene.userData = {
    asset: 'sunflower',
    purpose: 'photorealistic PBR hero flower for Flores para ti',
    generator: 'procedural-threejs-highpoly-surface',
    quality: quality.name
};

const petalMaterials = [
    new THREE.MeshPhysicalMaterial({
        color: 0xffc928,
        roughness: 0.62,
        clearcoat: 0.12,
        clearcoatRoughness: 0.68,
        side: THREE.DoubleSide
    }),
    new THREE.MeshPhysicalMaterial({
        color: 0xffd94a,
        roughness: 0.68,
        clearcoat: 0.08,
        clearcoatRoughness: 0.74,
        side: THREE.DoubleSide
    }),
    new THREE.MeshPhysicalMaterial({
        color: 0xf5ad18,
        roughness: 0.66,
        clearcoat: 0.1,
        clearcoatRoughness: 0.7,
        side: THREE.DoubleSide
    })
];

const leafMaterials = [
    new THREE.MeshPhysicalMaterial({ color: 0x607c42, roughness: 0.86, clearcoat: 0.04, side: THREE.DoubleSide }),
    new THREE.MeshPhysicalMaterial({ color: 0x789352, roughness: 0.9, clearcoat: 0.03, side: THREE.DoubleSide })
];

const makeSurfaceGeometry = (length, width, widthSegments, lengthSegments, profile) => {
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let row = 0; row <= lengthSegments; row += 1) {
        const v = row / lengthSegments;
        for (let column = 0; column <= widthSegments; column += 1) {
            const u = column / widthSegments * 2 - 1;
            const point = profile(u, v, length, width);
            positions.push(point.x, point.y, point.z);
            uvs.push(column / widthSegments, 1 - v);
        }
    }

    for (let row = 0; row < lengthSegments; row += 1) {
        for (let column = 0; column < widthSegments; column += 1) {
            const topLeft = row * (widthSegments + 1) + column;
            const topRight = topLeft + 1;
            const bottomLeft = topLeft + widthSegments + 1;
            const bottomRight = bottomLeft + 1;
            indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
};

const petalShape = (length, width, variation = {}) => makeSurfaceGeometry(
    length,
    width,
    quality.petalWidthSegments,
    quality.petalLengthSegments,
    (u, v, petalLength, petalWidth) => {
        const taper = 0.12 + 0.88 * Math.pow(Math.sin(Math.PI * v), 0.52);
        const widthWave = 1 + (variation.widthWave || 0) * Math.sin(v * Math.PI * 3 + (variation.phase || 0));
        const edgeCurl = (0.018 + (variation.curl || 0)) * (1 - u * u) * Math.sin(Math.PI * v);
        const tipLift = (0.026 + (variation.tipLift || 0)) * Math.pow(v, 2.6);
        const asymmetry = (0.006 + (variation.asymmetry || 0)) * u * Math.sin(Math.PI * v + (variation.phase || 0));
        const lateralBend = (variation.lateralBend || 0) * Math.sin(Math.PI * v);
        return new THREE.Vector3(
            u * petalWidth * taper * widthWave + lateralBend * v,
            v * petalLength * (1 + (variation.lengthWave || 0) * Math.sin(Math.PI * v)),
            edgeCurl + tipLift + asymmetry
        );
    }
);

const leafShape = (length, width, variation = {}) => makeSurfaceGeometry(
    length,
    width,
    quality.leafWidthSegments,
    quality.leafLengthSegments,
    (u, v, leafLength, leafWidth) => {
        const edgeWave = 1 + (variation.edgeWave || 0) * Math.sin(v * Math.PI * 5 + (variation.phase || 0) + u * 1.5);
        const taper = Math.pow(Math.sin(Math.PI * v), 0.62) * (1 - v * 0.12) * edgeWave;
        const ridge = (0.032 + (variation.ridge || 0)) * (1 - Math.abs(u)) * Math.sin(Math.PI * v);
        const tipLift = (0.014 + (variation.tipLift || 0)) * Math.pow(v, 2.2);
        return new THREE.Vector3(
            u * leafWidth * taper + (variation.lateralBend || 0) * Math.sin(Math.PI * v),
            v * leafLength,
            ridge + tipLift
        );
    }
);

const stemHeight = 1.05;
const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.038, stemHeight, quality.stemSegments),
    new THREE.MeshPhysicalMaterial({ color: 0x607d43, roughness: 0.86, clearcoat: 0.04 })
);
stem.name = 'Stem';
stem.position.y = stemHeight / 2;
scene.add(stem);

[
    { y: stemHeight * 0.31, side: -1, length: 0.4, width: 0.13, rotation: -0.92, material: leafMaterials[0] },
    { y: stemHeight * 0.52, side: 1, length: 0.46, width: 0.15, rotation: 0.88, material: leafMaterials[1] },
    { y: stemHeight * 0.68, side: -1, length: 0.29, width: 0.1, rotation: -0.96, material: leafMaterials[0] }
].forEach((spec, leafIndex) => {
    const leaf = new THREE.Group();
    leaf.name = 'Leaf_' + Math.round(spec.y * 100);
    leaf.add(new THREE.Mesh(
        leafShape(spec.length, spec.width, {
            phase: leafIndex * 1.7,
            edgeWave: 0.035 + leafIndex * 0.006,
            ridge: 0.004 + leafIndex * 0.002,
            tipLift: leafIndex * 0.002,
            lateralBend: (leafIndex % 2 ? 1 : -1) * 0.012
        }),
        spec.material
    ));
    const vein = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.02, 0.025),
        new THREE.Vector3(0, spec.length * 0.92, 0.025)
    ]);
    leaf.add(new THREE.Line(
        vein,
        new THREE.LineBasicMaterial({ color: 0x9aab69, transparent: true, opacity: 0.55 })
    ));
    const sideVeinPoints = [];
    for (let veinIndex = 1; veinIndex <= 4; veinIndex += 1) {
        const ratio = veinIndex / 5;
        const y = spec.length * ratio;
        const span = spec.width * (0.9 - ratio * 0.58);
        sideVeinPoints.push(
            new THREE.Vector3(0, y, 0.027),
            new THREE.Vector3(span, y + spec.length * 0.075, 0.029),
            new THREE.Vector3(0, y, 0.027),
            new THREE.Vector3(-span, y + spec.length * 0.075, 0.029)
        );
    }
    leaf.add(new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(sideVeinPoints),
        new THREE.LineBasicMaterial({ color: 0x9aab69, transparent: true, opacity: 0.3 })
    ));
    leaf.position.set(spec.side * 0.018, spec.y, 0.018);
    leaf.rotation.z = spec.rotation;
    leaf.rotation.y = spec.side * 0.16;
    leaf.scale.x = spec.side;
    scene.add(leaf);
});

const head = new THREE.Group();
head.name = 'SunflowerHead';
head.position.set(0, stemHeight + 0.08, 0.035);
head.rotation.x = 0.01;
scene.add(head);

const calyx = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, quality.calyxWidthSegments, quality.calyxHeightSegments),
    new THREE.MeshPhysicalMaterial({ color: 0x6d7b35, roughness: 0.88, side: THREE.DoubleSide })
);
calyx.name = 'Calyx';
calyx.scale.z = 0.22;
calyx.position.z = -0.06;
head.add(calyx);

for (let index = 0; index < quality.outerPetals; index += 1) {
    const angle = (index / quality.outerPetals) * Math.PI * 2;
    const petal = new THREE.Mesh(
        petalShape(0.31, 0.105, {
            phase: index * 1.41,
            widthWave: 0.035 + (index % 4) * 0.008,
            curl: (index % 3) * 0.003,
            tipLift: (index % 5) * 0.002,
            asymmetry: (index % 2) * 0.002,
            lateralBend: ((index % 3) - 1) * 0.008,
            lengthWave: (index % 4) * 0.008
        }),
        petalMaterials[index % petalMaterials.length]
    );
    petal.name = 'OuterPetal_' + index;
    petal.rotation.z = angle;
    petal.rotation.x = 0.04 + Math.sin(angle * 3) * 0.055 + ((index % 3) - 1) * 0.012;
    petal.rotation.y = Math.cos(angle * 2) * 0.06 + ((index % 4) - 1.5) * 0.008;
    petal.position.z = 0.01 + (index % 2) * 0.004 + (index % 5) * 0.0012;
    petal.scale.set(0.96 + (index % 3) * 0.045, 0.98 + (index % 2) * 0.06, 1);
    head.add(petal);
}

for (let index = 0; index < quality.innerPetals; index += 1) {
    const angle = (index / quality.innerPetals) * Math.PI * 2 + 0.12;
    const petal = new THREE.Mesh(
        petalShape(0.235, 0.09, {
            phase: index * 1.87,
            widthWave: 0.028 + (index % 3) * 0.01,
            curl: 0.002 + (index % 2) * 0.004,
            tipLift: (index % 4) * 0.002,
            asymmetry: 0.001 + (index % 2) * 0.002,
            lateralBend: ((index % 3) - 1) * 0.006,
            lengthWave: (index % 3) * 0.01
        }),
        petalMaterials[(index + 1) % petalMaterials.length]
    );
    petal.name = 'InnerPetal_' + index;
    petal.rotation.z = angle;
    petal.rotation.x = 0.13 + Math.sin(angle * 2) * 0.04 + ((index % 3) - 1) * 0.01;
    petal.rotation.y = Math.cos(angle * 3) * 0.05 + ((index % 2) ? 0.01 : -0.006);
    petal.position.z = 0.035 + (index % 4) * 0.0015;
    petal.scale.set(0.86 + (index % 2) * 0.05, 0.92 + (index % 3) * 0.04, 1);
    head.add(petal);
}

const centerSize = 0.175;
const centerBack = new THREE.Mesh(
    new THREE.SphereGeometry(centerSize * 1.02, quality.centerSegments, Math.max(10, Math.round(quality.centerSegments * 0.6))),
    new THREE.MeshStandardMaterial({ color: 0x54220d, roughness: 0.98 })
);
centerBack.name = 'CenterBack';
centerBack.scale.z = 0.38;
centerBack.position.z = -0.025;
head.add(centerBack);

const centerDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(centerSize * 0.92, centerSize * 0.92, 0.052, quality.centerSegments),
    new THREE.MeshStandardMaterial({ color: 0x6d2b0d, roughness: 0.94 })
);
centerDisk.name = 'CenterDisk';
centerDisk.rotation.x = Math.PI / 2;
centerDisk.position.z = 0.02;
head.add(centerDisk);

const seedGeometry = new THREE.SphereGeometry(0.012, quality.seedSegments, quality.seedRings);
const seedMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
const seeds = new THREE.InstancedMesh(seedGeometry, seedMaterial, quality.seedCount);
seeds.name = 'SeedSpiral';
const seedMatrix = new THREE.Matrix4();
const goldenAngle = Math.PI * (3 - Math.sqrt(5));
const seedColors = [0x301209, 0x47200d, 0x7e421b, 0x9a5824];

for (let index = 0; index < quality.seedCount; index += 1) {
    const ratio = Math.sqrt((index + 0.5) / quality.seedCount);
    const radius = centerSize * 0.86 * ratio * (0.98 + (index % 5) * 0.008);
    const angle = index * goldenAngle + Math.sin(index * 2.31) * 0.018;
    const seedScale = 0.7 + (1 - ratio) * 0.45 + (index % 4) * 0.025;
    const seedRotation = angle + Math.PI * 0.5 + Math.sin(index * 1.73) * 0.16;
    seedMatrix.compose(
        new THREE.Vector3(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            0.084 + Math.sin(index * 1.37) * 0.004
        ),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, seedRotation)),
        new THREE.Vector3(seedScale, seedScale * 1.35, seedScale)
    );
    seeds.setMatrixAt(index, seedMatrix);
    seeds.setColorAt(index, new THREE.Color(seedColors[index % seedColors.length]));
}
seeds.instanceMatrix.needsUpdate = true;
if (seeds.instanceColor) seeds.instanceColor.needsUpdate = true;
head.add(seeds);

scene.updateMatrixWorld(true);

const exporter = new GLTFExporter();
const result = await exporter.parseAsync(scene, {
    binary: true,
    trs: false,
    onlyVisible: true,
    includeCustomExtensions: true
});

fs.writeFileSync(output, Buffer.from(result));
console.log('Generated', output, fs.statSync(output).size, 'bytes');
