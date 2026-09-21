import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const textureNames = ['petal', 'leaf', 'center'];
const textureDir = path.resolve('assets/textures');

function readChunks(buffer) {
    const chunks = [];
    let offset = 8;
    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        chunks.push({ type, data: buffer.subarray(dataStart, dataEnd) });
        offset = dataEnd + 4;
        if (type === 'IEND') break;
    }
    return chunks;
}

function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

function decodePng(filePath) {
    const buffer = fs.readFileSync(filePath);
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (!buffer.subarray(0, 8).equals(signature)) throw new Error(`${filePath} no es un PNG válido.`);

    const chunks = readChunks(buffer);
    const ihdr = chunks.find((chunk) => chunk.type === 'IHDR')?.data;
    if (!ihdr) throw new Error(`${filePath} no tiene IHDR.`);

    const width = ihdr.readUInt32BE(0);
    const height = ihdr.readUInt32BE(4);
    const bitDepth = ihdr[8];
    const colorType = ihdr[9];
    const interlace = ihdr[12];
    if (bitDepth !== 8 || interlace !== 0) {
        throw new Error(`${filePath}: solo se admiten PNG 8-bit sin interlace.`);
    }

    const channelsByColorType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
    const channels = channelsByColorType[colorType];
    if (!channels) throw new Error(`${filePath}: color type ${colorType} no soportado.`);

    const paletteChunk = chunks.find((chunk) => chunk.type === 'PLTE')?.data;
    const transparency = chunks.find((chunk) => chunk.type === 'tRNS')?.data;
    const palette = colorType === 3
        ? Array.from({ length: paletteChunk?.length / 3 || 0 }, (_, index) => ({
            r: paletteChunk[index * 3],
            g: paletteChunk[index * 3 + 1],
            b: paletteChunk[index * 3 + 2],
            a: transparency?.[index] ?? 255
        }))
        : null;
    if (colorType === 3 && !palette?.length) throw new Error(`${filePath}: PNG indexado sin paleta.`);

    const rowBytes = width * channels;
    const raw = zlib.inflateSync(Buffer.concat(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data)));
    const rows = Buffer.alloc(height * rowBytes);
    let rawOffset = 0;
    for (let y = 0; y < height; y += 1) {
        const filter = raw[rawOffset++];
        const rowStart = y * rowBytes;
        const previousStart = (y - 1) * rowBytes;
        for (let x = 0; x < rowBytes; x += 1) {
            const current = raw[rawOffset++];
            const left = x >= channels ? rows[rowStart + x - channels] : 0;
            const above = y > 0 ? rows[previousStart + x] : 0;
            const upperLeft = y > 0 && x >= channels ? rows[previousStart + x - channels] : 0;
            let value = current;
            if (filter === 1) value = current + left;
            else if (filter === 2) value = current + above;
            else if (filter === 3) value = current + Math.floor((left + above) / 2);
            else if (filter === 4) value = current + paeth(left, above, upperLeft);
            else if (filter !== 0) throw new Error(`${filePath}: filtro PNG ${filter} no soportado.`);
            rows[rowStart + x] = value & 0xff;
        }
    }

    const gray = Buffer.alloc(width * height);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const sourceOffset = y * rowBytes + x * channels;
            if (colorType === 3) gray[y * width + x] = palette[rows[sourceOffset]]?.r ?? 0;
            else gray[y * width + x] = rows[sourceOffset];
        }
    }
    return { width, height, gray };
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
});

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const value of buffer) crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const typeBuffer = Buffer.from(type, 'ascii');
    const payload = Buffer.concat([typeBuffer, data]);
    const output = Buffer.alloc(12 + data.length);
    output.writeUInt32BE(data.length, 0);
    payload.copy(output, 4);
    output.writeUInt32BE(crc32(payload), 8 + data.length);
    return output;
}

function encodeRgbaPng(width, height, rgba) {
    const raw = Buffer.alloc(height * (width * 4 + 1));
    for (let y = 0; y < height; y += 1) {
        const rowStart = y * (width * 4 + 1);
        raw[rowStart] = 0;
        rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    return Buffer.concat([
        signature,
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        pngChunk('IEND', Buffer.alloc(0))
    ]);
}

for (const name of textureNames) {
    const roughness = decodePng(path.join(textureDir, `${name}-roughness.png`));
    const ao = decodePng(path.join(textureDir, `${name}-ao.png`));
    if (roughness.width !== ao.width || roughness.height !== ao.height) {
        throw new Error(`${name}: roughness y AO deben tener la misma resolución.`);
    }

    const rgba = Buffer.alloc(roughness.width * roughness.height * 4);
    for (let index = 0; index < roughness.gray.length; index += 1) {
        rgba[index * 4] = ao.gray[index];
        rgba[index * 4 + 1] = roughness.gray[index];
        rgba[index * 4 + 2] = 0;
        rgba[index * 4 + 3] = 255;
    }

    const outputPath = path.join(textureDir, `${name}-orm.png`);
    fs.writeFileSync(outputPath, encodeRgbaPng(roughness.width, roughness.height, rgba));
    console.log(`Generated ${outputPath} (${roughness.width}x${roughness.height})`);
}
