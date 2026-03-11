#!/usr/bin/env node
/**
 * Generates a minimal 16x16 and 32x32 placeholder ICO file at src/assets/icon.ico.
 * Run once before `npm run build` if you don't have a real icon.
 *
 * Usage: node scripts/create-placeholder-icon.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ── Minimal BMP builder ────────────────────────────────────────────────────

function buildBmpDib(size, colorR, colorG, colorB) {
    const pixelCount = size * size;
    // BITMAPINFOHEADER (40 bytes) + pixel data (4 bytes/pixel BGRA) + AND mask
    const headerSize  = 40;
    const pixelBytes  = pixelCount * 4;
    const maskRowSize = Math.ceil(size / 8) * (32 / 8); // padded to 4-byte boundary
    const maskBytes   = maskRowSize * size;
    const totalBytes  = headerSize + pixelBytes + maskBytes;

    const buf = Buffer.alloc(totalBytes, 0);

    // BITMAPINFOHEADER
    buf.writeUInt32LE(40, 0);                    // biSize
    buf.writeInt32LE(size, 4);                   // biWidth
    buf.writeInt32LE(size * 2, 8);               // biHeight (×2 for XOR+AND)
    buf.writeUInt16LE(1, 12);                    // biPlanes
    buf.writeUInt16LE(32, 14);                   // biBitCount
    buf.writeUInt32LE(0, 16);                    // biCompression (BI_RGB)
    buf.writeUInt32LE(pixelBytes + maskBytes, 20); // biSizeImage
    // All other fields remain 0 (width/height pixels-per-metre, clrUsed, clrImportant)

    // Pixel data (bottom-up, BGRA, fully opaque)
    for (let i = 0; i < pixelCount; i++) {
        const offset = headerSize + i * 4;
        buf[offset]     = colorB;
        buf[offset + 1] = colorG;
        buf[offset + 2] = colorR;
        buf[offset + 3] = 0xFF; // alpha
    }

    // AND mask — all zeros (fully opaque)
    // Already zeroed by Buffer.alloc

    return buf;
}

function buildIco(images) {
    // images: [{ size, data }]
    const count       = images.length;
    const headerBytes = 6;
    const dirBytes    = count * 16;
    let   dataOffset  = headerBytes + dirBytes;

    // Collect data offsets
    const entries = images.map(img => {
        const entry = { size: img.size, data: img.data, offset: dataOffset };
        dataOffset += img.data.length;
        return entry;
    });

    const totalSize = dataOffset;
    const buf       = Buffer.alloc(totalSize);

    // ICONDIR header
    buf.writeUInt16LE(0, 0);      // reserved
    buf.writeUInt16LE(1, 2);      // type = 1 (icon)
    buf.writeUInt16LE(count, 4);  // count

    // ICONDIRENTRY for each image
    entries.forEach((e, i) => {
        const base = 6 + i * 16;
        buf.writeUInt8(e.size === 256 ? 0 : e.size, base);      // width (0 = 256)
        buf.writeUInt8(e.size === 256 ? 0 : e.size, base + 1);  // height
        buf.writeUInt8(0, base + 2);                             // colorCount
        buf.writeUInt8(0, base + 3);                             // reserved
        buf.writeUInt16LE(1, base + 4);                          // planes
        buf.writeUInt16LE(32, base + 6);                         // bitCount
        buf.writeUInt32LE(e.data.length, base + 8);              // bytesInRes
        buf.writeUInt32LE(e.offset, base + 12);                  // imageOffset
    });

    // Image data
    entries.forEach(e => {
        e.data.copy(buf, e.offset);
    });

    return buf;
}

// ── Build icon ─────────────────────────────────────────────────────────────

// SkillForge purple: #7C3AED → R=124 G=58 B=237
const R = 0x7C, G = 0x3A, B = 0xED;

const images = [
    { size: 16, data: buildBmpDib(16, R, G, B) },
    { size: 32, data: buildBmpDib(32, R, G, B) },
    { size: 48, data: buildBmpDib(48, R, G, B) },
];

const ico      = buildIco(images);
const outPath  = path.resolve(__dirname, '../src/assets/icon.ico');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, ico);

console.log(`[icon] Wrote placeholder icon to ${outPath} (${ico.length} bytes)`);
console.log('[icon] Replace with a real 256×256 ICO before publishing.');
