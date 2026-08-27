// Deterministic 3D solid-texture basis. Everything here is a pure function of
// its coordinates and an integer seed -- no state, no Math.random -- which is
// what makes a re-render byte-identical to the one before it.

const F3 = 1 / 3, G3 = 1 / 6;

export function hash3(x, y, z, s) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (z | 0) * 2147483647 + (s | 0) * 1274126177;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

// Value noise. Cheaper than gradient noise and, once it is stacked into an
// fBm, indistinguishable at the scales a 128 px sprite resolves.
export function vnoise(x, y, z, s) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz, s);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), fx), x10 = lerp(c(0, 1, 0), c(1, 1, 0), fx);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), fx), x11 = lerp(c(0, 1, 1), c(1, 1, 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

export function fbm(x, y, z, oct, s, lac = 2.0, gain = 0.5) {
  let a = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * vnoise(x * f, y * f, z * f, s + i * 7717);
    norm += a; a *= gain; f *= lac;
  }
  return sum / norm;
}

// Ridged fBm -- the sharp creases that read as rock, bark and scorched crust.
export function ridged(x, y, z, oct, s) {
  let a = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    const v = 1 - Math.abs(vnoise(x * f, y * f, z * f, s + i * 3931) * 2 - 1);
    sum += a * v * v; norm += a; a *= 0.5; f *= 2.0;
  }
  return sum / norm;
}

// Worley / cellular. Returns { f1, f2, id } -- f2-f1 gives the cracks between
// cells (cobble, hide scales, chainmail rings), id gives per-cell variation.
export function worley(x, y, z, s) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let f1 = 1e9, f2 = 1e9, id = 0;
  for (let dz = -1; dz <= 1; dz++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx, cy = iy + dy, cz = iz + dz;
        const px = cx + hash3(cx, cy, cz, s);
        const py = cy + hash3(cx, cy, cz, s + 1);
        const pz = cz + hash3(cx, cy, cz, s + 2);
        const d = (px - x) * (px - x) + (py - y) * (py - y) + (pz - z) * (pz - z);
        if (d < f1) { f2 = f1; f1 = d; id = hash3(cx, cy, cz, s + 3); }
        else if (d < f2) f2 = d;
      }
  return { f1: Math.sqrt(f1), f2: Math.sqrt(f2), id };
}

// --- tileable 2D variants, for the ground textures the arena repeats -------
// Tiling comes from wrapping the integer lattice, not from mirroring, so the
// seam is genuinely invisible rather than merely symmetric.
export function vnoise2Tile(x, y, per, s) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = fade(x - ix), fy = fade(y - iy);
  const w = n => ((n % per) + per) % per;
  const c = (dx, dy) => hash3(w(ix + dx), w(iy + dy), 0, s);
  return lerp(lerp(c(0, 0), c(1, 0), fx), lerp(c(0, 1), c(1, 1), fx), fy);
}

export function fbm2Tile(x, y, per, oct, s) {
  let a = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * vnoise2Tile(x * f, y * f, per * f, s + i * 6151);
    norm += a; a *= 0.5; f *= 2;
  }
  return sum / norm;
}

export function worley2Tile(x, y, per, s) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const w = n => ((n % per) + per) % per;
  let f1 = 1e9, f2 = 1e9, id = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx, cy = iy + dy, wx = w(cx), wy = w(cy);
      const px = cx + hash3(wx, wy, 0, s), py = cy + hash3(wx, wy, 0, s + 1);
      const d = (px - x) * (px - x) + (py - y) * (py - y);
      if (d < f1) { f2 = f1; f1 = d; id = hash3(wx, wy, 0, s + 2); }
      else if (d < f2) f2 = d;
    }
  return { f1: Math.sqrt(f1), f2: Math.sqrt(f2), id };
}

export const smoothstep = (a, b, t) => {
  const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
export const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
