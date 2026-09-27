const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function clamp(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function createPNG(size) {
  const scanlineWidth = size * 4 + 1;
  const raw = Buffer.alloc(size * scanlineWidth);
  const radius = size * 0.22;
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;

  for (let y = 0; y < size; y++) {
    raw[y * scanlineWidth] = 0;
    for (let x = 0; x < size; x++) {
      const dx = Math.max(Math.abs(x - cx) - (cx - radius), 0);
      const dy = Math.max(Math.abs(y - cy) - (cy - radius), 0);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const o = y * scanlineWidth + 1 + x * 4;
      if (dist > radius) continue;

      const nx = x / (size - 1 || 1);
      const ny = y / (size - 1 || 1);
      const band = Math.abs((nx * 0.35 + ny * 0.85) - 0.62);
      let metal = mix([255, 255, 255], [120, 132, 144], Math.min(1, band * 3.2));
      metal = mix(metal, [236, 242, 247], Math.pow(1 - ny, 2) * 0.65);
      if (nx > 0.72 && ny < 0.28) metal = mix(metal, [155, 231, 255], 0.55);
      if (nx < 0.22 && ny > 0.7) metal = mix(metal, [255, 150, 130], 0.35);

      const px = (x - cx) / (size * 0.5);
      const py = (y - cy) / (size * 0.5);
      const eye = Math.pow(px / 0.62, 2) + Math.pow(py / 0.34, 2) <= 1;
      const pupil = Math.pow(px / 0.16, 2) + Math.pow(py / 0.28, 2) <= 1;
      const shine = Math.pow((px + 0.05) / 0.06, 2) + Math.pow((py + 0.08) / 0.07, 2) <= 1;

      let rgb = metal;
      if (eye) rgb = [8, 8, 10];
      if (pupil) {
        const t = (py + 0.3);
        rgb = mix([255, 214, 196], [255, 50, 28], Math.max(0, Math.min(1, t)));
        if (py > 0.08) rgb = mix(rgb, [110, 16, 10], (py - 0.08) * 2);
      }
      if (pupil && shine) rgb = [255, 255, 255];

      const alpha = dist > radius - 1.2 ? clamp((radius - dist) * 220) : 255;
      raw[o] = clamp(rgb[0]);
      raw[o + 1] = clamp(rgb[1]);
      raw[o + 2] = clamp(rgb[2]);
      raw[o + 3] = alpha;
    }
  }

  const compressed = zlib.deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

const iconsDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });
[16, 32, 48, 128].forEach((size) => {
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), createPNG(size));
  console.log('icon' + size + '.png');
});
