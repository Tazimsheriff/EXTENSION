// Pure Node.js PNG generator without external dependencies using zlib
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size, bgGradientStart, bgGradientEnd) {
  const width = size;
  const height = size;
  
  // Create RGBA buffer with filter byte 0 at start of each scanline
  const scanlineWidth = width * 4 + 1;
  const rawData = Buffer.alloc(height * scanlineWidth);

  const radius = size * 0.22;
  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < height; y++) {
    const lineOffset = y * scanlineWidth;
    rawData[lineOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = lineOffset + 1 + x * 4;

      // Rounded rectangle check
      const dx = Math.max(Math.abs(x - cx) - (cx - radius), 0);
      const dy = Math.max(Math.abs(y - cy) - (cy - radius), 0);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Linear gradient from top-left (bgGradientStart) to bottom-right (bgGradientEnd)
        const factor = (x + y) / (width + height);
        const r = Math.round(bgGradientStart[0] + factor * (bgGradientEnd[0] - bgGradientStart[0]));
        const g = Math.round(bgGradientStart[1] + factor * (bgGradientEnd[1] - bgGradientStart[1]));
        const b = Math.round(bgGradientStart[2] + factor * (bgGradientEnd[2] - bgGradientStart[2]));

        // Lightning bolt / 'H' shape drawing
        // Normalized coordinates in [0, 1]
        const nx = x / width;
        const ny = y / height;

        // Draw lightning bolt
        let isBolt = false;
        // Simple stylized bolt polygon check:
        // Top triangle: (0.55, 0.2) to (0.35, 0.52) to (0.55, 0.52)
        // Bottom triangle: (0.45, 0.48) to (0.65, 0.48) to (0.45, 0.8)
        if (
          (nx >= 0.32 && nx <= 0.44 && ny >= 0.25 && ny <= 0.75) || // Left bar of H
          (nx >= 0.56 && nx <= 0.68 && ny >= 0.25 && ny <= 0.75) || // Right bar of H
          (nx >= 0.42 && nx <= 0.58 && ny >= 0.44 && ny <= 0.56)    // Crossbar of H
        ) {
          isBolt = true;
        }

        if (isBolt) {
          rawData[pixelOffset] = 255;     // R
          rawData[pixelOffset + 1] = 255; // G
          rawData[pixelOffset + 2] = 255; // B
          rawData[pixelOffset + 3] = 255; // A
        } else {
          rawData[pixelOffset] = r;
          rawData[pixelOffset + 1] = g;
          rawData[pixelOffset + 2] = b;
          // Anti-aliasing border
          const alpha = dist > radius - 1 ? Math.max(0, Math.min(255, Math.round((radius - dist) * 255))) : 255;
          rawData[pixelOffset + 3] = alpha;
        }
      } else {
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
      }
    }
  }

  // Compress
  const compressed = zlib.deflateSync(rawData);

  // PNG structure
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type);
    const body = Buffer.concat([typeBuf, data]);

    const crcBuf = Buffer.alloc(4);
    const crc = crc32(body);
    crcBuf.writeUInt32BE(crc, 0);

    return Buffer.concat([len, body, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Electric Indigo / Violet Gradient
const startColor = [99, 102, 241];  // #6366f1 Indigo 500
const endColor = [168, 85, 247];   // #a855f7 Purple 500

[16, 32, 48, 128].forEach(size => {
  const png = createPNG(size, startColor, endColor);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png (${size}x${size})`);
});
