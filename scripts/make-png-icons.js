import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makePng(width, height, r = 37, g = 99, b = 235) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrBuf = Buffer.alloc(13);
  ihdrBuf.writeUInt32BE(width, 0);
  ihdrBuf.writeUInt32BE(height, 4);
  ihdrBuf[8] = 8; // bit depth
  ihdrBuf[9] = 6; // RGBA
  ihdrBuf[10] = 0;
  ihdrBuf[11] = 0;
  ihdrBuf[12] = 0;

  const ihdrChunk = createChunk('IHDR', ihdrBuf);

  // IDAT raw scanlines
  const lineSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * lineSize);
  for (let y = 0; y < height; y++) {
    const offset = y * lineSize;
    rawData[offset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const p = offset + 1 + x * 4;
      rawData[p] = r;     // R
      rawData[p + 1] = g; // G
      rawData[p + 2] = b; // B
      rawData[p + 3] = 255; // A
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const checkBuf = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(checkBuf), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), makePng(192, 192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), makePng(512, 512));
console.log('Successfully generated valid 192x192 and 512x512 PNG icons!');
