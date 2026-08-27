// Minimal PNG writer. Node's zlib is the only thing this pipeline needs to
// emit a real, alpha-correct 8-bit RGBA image, so there is no image library
// anywhere in the tree -- the renderer owns its own encoder.
import zlib from 'node:zlib';

function crc32(buf) {
  let c, table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

// Per-scanline adaptive filtering (the same heuristic libpng uses: pick the
// filter whose residuals have the smallest absolute sum). Worth the few lines
// -- on a sprite atlas it is the difference between a 3 MB file and a 1 MB one.
function filterRows(rgba, w, h) {
  const stride = w * 4;
  const out = Buffer.alloc((stride + 1) * h);
  const cand = [Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride),
                Buffer.alloc(stride), Buffer.alloc(stride)];
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const row = rgba.subarray(y * stride, y * stride + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? row[x - 4] : 0, b = prev[x], c = x >= 4 ? prev[x - 4] : 0;
      cand[0][x] = row[x];
      cand[1][x] = (row[x] - a) & 0xff;
      cand[2][x] = (row[x] - b) & 0xff;
      cand[3][x] = (row[x] - ((a + b) >> 1)) & 0xff;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      cand[4][x] = (row[x] - pr) & 0xff;
    }
    let best = 0, bestScore = Infinity;
    for (let f = 0; f < 5; f++) {
      let s = 0;
      for (let x = 0; x < stride; x++) { const v = cand[f][x]; s += v < 128 ? v : 256 - v; }
      if (s < bestScore) { bestScore = s; best = f; }
    }
    out[y * (stride + 1)] = best;
    cand[best].copy(out, y * (stride + 1) + 1);
    prev = row;
  }
  return out;
}

export function encodePNG(rgba, w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = filterRows(rgba, w, h);
  const idat = zlib.deflateSync(raw, { level: 9, memLevel: 9, windowBits: 15 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
