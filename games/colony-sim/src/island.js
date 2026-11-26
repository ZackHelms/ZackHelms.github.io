// island.js — the island, generated from a seed. A heightfield + a land-cover grid
// baked once; everything (rendering, walking, jobs) samples these same arrays so
// they can never disagree (the Wayfinder rule).
import { makeRng } from './rng.js';

export const CELL = 2, IW = 500, IH = 350;           // 1000 m x 700 m
export const COVER = { SEA: 0, SAND: 1, ROCKY: 2, GRASS: 3, FOREST: 4, CLIFF: 5, POND: 6, RIVER: 7 };
const CAMP_Y = 2.8;

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

function makeNoise(rng) {
  const P = new Uint16Array(512), V = new Float32Array(256);
  for (let i = 0; i < 256; i++) { P[i] = i; V[i] = rng.next(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); const t = P[i]; P[i] = P[j]; P[j] = t; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const v = (x, z) => V[P[(P[x & 255] + z) & 511] & 255];
  const n2 = (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
    const u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz);
    return lerp(lerp(v(xi, zi), v(xi + 1, zi), u), lerp(v(xi, zi + 1), v(xi + 1, zi + 1), u), w);
  };
  return (x, z, oct = 4) => {
    let s = 0, a = 1, f = 1, n = 0;
    for (let o = 0; o < oct; o++) { s += a * n2(x * f + o * 17.3, z * f - o * 9.1); n += a; a *= 0.5; f *= 2; }
    return s / n;
  };
}

export function genIsland(seed) {
  const rng = makeRng(seed), R = rng.stream('island');
  const fbm = makeNoise(rng.stream('noise'));
  const W = IW, H = IH, N = W * H;
  const h = new Float32Array(N), cover = new Uint8Array(N);
  const cx0 = 500, cz0 = 350, rx = 440, rz = 300;
  const cellX = (i) => (i % W + 0.5) * CELL, cellZ = (i) => (Math.floor(i / W) + 0.5) * CELL;
  const mask = (x, z) => {
    const dx = (x - cx0) / rx, dz = (z - cz0) / rz;
    return 1 - Math.hypot(dx, dz) - 0.16 * (fbm(x / 170, z / 170) - 0.5) * 2;
  };

  // landing on the south shore (z+), camp 48 m inland
  const la = Math.PI / 2 + R.range(-0.3, 0.3);
  const dir = { x: Math.cos(la), z: Math.sin(la) };
  let sr = 0; while (mask(cx0 + dir.x * sr, cz0 + dir.z * sr) > 0 && sr < 600) sr += 1;
  const shore = { x: cx0 + dir.x * sr, z: cz0 + dir.z * sr };
  const landing = { x: shore.x - dir.x * 6, z: shore.z - dir.z * 6 };
  const camp = { x: shore.x - dir.x * 48, z: shore.z - dir.z * 48, r: 32 };
  const north = { x: -dir.x, z: -dir.z }, northA = Math.atan2(north.z, north.x);

  // the scarp: a cliff band ~430 m inland, on the far side of the island from camp, with two ramps
  const R0 = 418 + R.range(-8, 8), HS = 20 + R.range(0, 4);
  const ramp = [R.range(0.45, 0.6), -R.range(0.45, 0.6)];
  let pondA = R.range(-0.25, 0.25);
  const scarpAt = (x, z) => {
    const d = Math.hypot(x - camp.x, z - camp.z), a = wrapA(Math.atan2(z - camp.z, x - camp.x) - northA);
    const t = sstep(1.15, 0.85, Math.abs(a));
    let g = 1; for (const q of ramp) g *= sstep(0.04, 0.11, Math.abs(a - q));
    const r0 = R0 + 18 * (fbm(a * 2.2 + 40, 3.3, 2) - 0.5), w = lerp(80, 5, g);   // a ramp is the same rise over 80 m
    return HS * t * sstep(r0 - w / 2, r0 + w / 2, d);
  };

  for (let i = 0; i < N; i++) {
    const x = cellX(i), z = cellZ(i), m = mask(x, z);
    if (m < 0) { h[i] = -1.2 - 24 * Math.min(1, -m * 5); continue; }
    const back = Math.max(0, ((x - camp.x) * north.x + (z - camp.z) * north.z) / 600);
    const nf = 0.45 + 0.9 * Math.min(1, back);
    let y = 1.0 + 34 * Math.pow(sstep(0, 0.7, m), 1.3) * (0.5 + 0.7 * fbm(x / 260, z / 260)) * nf;
    y += 5 * (fbm(x / 55, z / 55, 3) - 0.5) * sstep(0, 0.15, m);
    y += scarpAt(x, z) * sstep(0, 0.04, m);
    h[i] = Math.max(y, 0.6);
  }
  // flatten the camp
  for (let i = 0; i < N; i++) {
    const d = Math.hypot(cellX(i) - camp.x, cellZ(i) - camp.z);
    const w = 1 - sstep(34, 62, d);
    if (w > 0) h[i] = lerp(h[i], CAMP_Y + 0.08 * (fbm(cellX(i) / 9, cellZ(i) / 9, 2) - 0.5), w);
  }
  const idx = (x, z) => Math.min(H - 1, Math.max(0, Math.floor(z / CELL))) * W + Math.min(W - 1, Math.max(0, Math.floor(x / CELL)));

  // pond at the foot of the scarp, the falls above it
  const pdir = { x: Math.cos(northA + pondA), z: Math.sin(northA + pondA) };
  let pd = R0 - 30; while (pd < R0 + 40 && scarpAt(camp.x + pdir.x * pd, camp.z + pdir.z * pd) < 0.5) pd += 0.5;
  const footD = pd - 16;
  const pond = { x: camp.x + pdir.x * footD, z: camp.z + pdir.z * footD, r: 13 };
  const ph = h[idx(pond.x, pond.z)] - 0.6;
  for (let i = 0; i < N; i++) {
    const d = Math.hypot(cellX(i) - pond.x, cellZ(i) - pond.z);
    if (d < pond.r) { h[i] = ph - 1.6; cover[i] = 255; }
    else if (d < pond.r + 8) h[i] = lerp(ph + 0.2, h[i], sstep(pond.r, pond.r + 8, d));
  }
  const topP = { x: camp.x + pdir.x * (pd + 9), z: camp.z + pdir.z * (pd + 9) };
  const falls = { top: { x: topP.x, z: topP.z, y: h[idx(topP.x, topP.z)] }, bottom: { x: camp.x + pdir.x * (footD + pond.r - 2), z: camp.z + pdir.z * (footD + pond.r - 2), y: ph } };
  // the stream that feeds the falls, cut into the plateau
  for (let s = 9; s < 60; s += 1) {
    const x = camp.x + pdir.x * (pd + s), z = camp.z + pdir.z * (pd + s), i = idx(x, z);
    if (h[i] > 0) cover[i] = 254;
  }

  // the river from the pond to the sea, bending away from camp
  const side = pondA >= 0 ? 1 : -1;
  const rA = Math.atan2(camp.z - pond.z, camp.x - pond.x) + side * 0.95;
  const river = [];
  let rx_ = pond.x + Math.cos(rA) * pond.r, rz_ = pond.z + Math.sin(rA) * pond.r;
  for (let s = 0; s < 900; s += 2) {
    const a = rA + 0.35 * Math.sin(s / 37) + 0.25 * (fbm(s / 60, 7.7, 2) - 0.5);
    rx_ += Math.cos(a) * 2; rz_ += Math.sin(a) * 2;
    if (rx_ < 2 || rz_ < 2 || rx_ > W * CELL - 2 || rz_ > H * CELL - 2) break;
    river.push({ x: rx_, z: rz_ });
    if (h[idx(rx_, rz_)] < -0.5) break;
  }
  let prevY = ph;
  for (const p of river) {
    const i0 = idx(p.x, p.z), y = Math.max(h[i0] - 0.6, -0.4); prevY = y;   // the bed follows the ground: no canyon walls
    for (let dz = -3; dz <= 3; dz += CELL) for (let dx = -3; dx <= 3; dx += CELL) {
      if (dx * dx + dz * dz > 9) continue;
      const i = idx(p.x + dx, p.z + dz);
      if (cover[i] === 255) continue;
      if (h[i] > -0.3) { h[i] = Math.min(h[i], y); cover[i] = 253; }
    }
  }

  // distance to the sea, in cells (8-neighbour BFS)
  const seaD = new Uint16Array(N).fill(65535), q = new Int32Array(N);
  let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) if (h[i] < 0 && cover[i] === 0) { seaD[i] = 0; q[qt++] = i; }
  while (qh < qt) {
    const i = q[qh++], cx = i % W, cz = (i - cx) / W, nd = seaD[i] + 1;
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      const x = cx + ox, z = cz + oz; if (x < 0 || z < 0 || x >= W || z >= H) continue;
      const j = z * W + x; if (seaD[j] > nd) { seaD[j] = nd; q[qt++] = j; }
    }
  }

  // land cover
  const slopeCell = (i) => {
    const cx = i % W, cz = (i - cx) / W; let m = 0;
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cx + ox, z = cz + oz; if (x < 0 || z < 0 || x >= W || z >= H) continue;
      m = Math.max(m, Math.abs(h[z * W + x] - h[i]) / CELL);
    }
    return m;
  };
  for (let i = 0; i < N; i++) {
    const x = cellX(i), z = cellZ(i), dc = Math.hypot(x - camp.x, z - camp.z), sd = seaD[i] * CELL;
    if (cover[i] === 255) { cover[i] = COVER.POND; continue; }
    if (cover[i] === 254 || cover[i] === 253) { cover[i] = COVER.RIVER; continue; }
    if (h[i] < 0) { cover[i] = COVER.SEA; continue; }
    if (dc < 36) { cover[i] = COVER.GRASS; continue; }
    if (slopeCell(i) > 1.1) { cover[i] = COVER.CLIFF; continue; }
    const dl = Math.hypot(x - landing.x, z - landing.z);
    if (sd < 16 && fbm(x / 40, z / 40, 3) > 0.6 && dl > 110) { cover[i] = COVER.ROCKY; continue; }
    if (sd < 22 && h[i] < 4.5) { cover[i] = COVER.SAND; continue; }
    if (scarpAt(x, z) > HS * 0.15 && scarpAt(x, z) < HS * 0.9 && fbm(x / 12, z / 12, 2) > 0.45) { cover[i] = COVER.ROCKY; continue; }
    if (fbm(x / 140 + 50, z / 140, 4) > 0.45 + 0.1 * sstep(160, 40, dc)) { cover[i] = COVER.FOREST; continue; }
    cover[i] = COVER.GRASS;
  }
  // scree: rocky ground at the scarp's foot
  for (let i = 0; i < N; i++) {
    if (cover[i] !== COVER.GRASS && cover[i] !== COVER.FOREST) continue;
    const x = cellX(i), z = cellZ(i);
    if (scarpAt(x, z) < 0.3 && scarpAt(x + north.x * 8, z + north.z * 8) > HS * 0.5 && fbm(x / 9, z / 9, 2) > 0.5) cover[i] = COVER.ROCKY;
  }

  const isl = { seed, CELL, W, H, h, cover, seaD, landing, camp, pond, falls, river, trees: [], rocks: [], bushes: [] };
  const O = rng.stream('objects');
  const free = (x, z, r) => Math.hypot(x - camp.x, z - camp.z) > r && Math.hypot(x - pond.x, z - pond.z) > pond.r + 6;
  const okLand = (x, z) => { const k = isl.cover[idx(x, z)]; return k === COVER.GRASS || k === COVER.FOREST || k === COVER.SAND; };
  const addTree = (x, z) => {
    const k = cover[idx(x, z)], y = h[idx(x, z)];
    const kind = k === COVER.SAND ? 'palm' : (y > 26 || fbm(x / 90, z / 90 + 9, 2) > 0.62) ? 'pine' : 'oak';
    isl.trees.push({ id: isl.trees.length, x, z, h: kind === 'palm' ? O.range(6, 9) : O.range(7, 13), kind, wood: 3 });
  };
  for (let z = 3; z < H * CELL; z += 5) for (let x = 3; x < W * CELL; x += 5) {
    const px = x + O.range(-2, 2), pz = z + O.range(-2, 2), k = cover[idx(px, pz)];
    const p = k === COVER.FOREST ? 0.55 : k === COVER.GRASS ? 0.04 : (k === COVER.SAND && seaD[idx(px, pz)] > 3) ? 0.035 : 0;
    if (p && O.chance(p) && free(px, pz, 22) && slopeAt(isl, px, pz) < 0.7) addTree(px, pz);
  }
  // the grove behind camp
  for (let z = -62; z <= 62; z += 6) for (let x = -62; x <= 62; x += 6) {
    const px = camp.x + x + O.range(-2.5, 2.5), pz = camp.z + z + O.range(-2.5, 2.5), d = Math.hypot(px - camp.x, pz - camp.z);
    const back = ((px - camp.x) * north.x + (pz - camp.z) * north.z) / Math.max(d, 1);
    if (d >= 25 && d <= 60 && back > -0.25 && okLand(px, pz) && O.chance(0.6)) addTree(px, pz);
  }
  // loose rocks: clusters near camp, scattered on rocky ground
  for (let c = 0; c < 4; c++) {
    const a = northA + O.range(-1.6, 1.6), d = O.range(28, 52), ccx = camp.x + Math.cos(a) * d, ccz = camp.z + Math.sin(a) * d;
    for (let k = 0; k < 9; k++) {
      const px = ccx + O.range(-6, 6), pz = ccz + O.range(-6, 6);
      if (h[idx(px, pz)] > 0.5 && free(px, pz, 21)) isl.rocks.push({ id: isl.rocks.length, x: px, z: pz, s: O.range(0.25, 0.5), n: 2 });
    }
  }
  for (let i = 0; i < N; i += 1) if (cover[i] === COVER.ROCKY && O.chance(0.05)) isl.rocks.push({ id: isl.rocks.length, x: cellX(i) + O.range(-0.8, 0.8), z: cellZ(i) + O.range(-0.8, 0.8), s: O.range(0.3, 0.8), n: 3 });
  // berry bushes: forest edges, thicker 40-150 m out
  for (let z = 4; z < H * CELL; z += 7) for (let x = 4; x < W * CELL; x += 7) {
    const px = x + O.range(-3, 3), pz = z + O.range(-3, 3), k = cover[idx(px, pz)], d = Math.hypot(px - camp.x, pz - camp.z);
    if (!(k === COVER.GRASS || k === COVER.FOREST) || !free(px, pz, 30)) continue;
    const p = (k === COVER.FOREST ? 0.05 : 0.02) + (d > 40 && d < 150 ? 0.06 : 0);
    if (O.chance(p)) isl.bushes.push({ id: isl.bushes.length, x: px, z: pz, berries: 6 });
  }
  return isl;
}

export function heightAt(isl, x, z) {
  const fx = x / isl.CELL - 0.5, fz = z / isl.CELL - 0.5;
  const x0 = Math.max(0, Math.min(isl.W - 2, Math.floor(fx))), z0 = Math.max(0, Math.min(isl.H - 2, Math.floor(fz)));
  const tx = Math.min(1, Math.max(0, fx - x0)), tz = Math.min(1, Math.max(0, fz - z0)), W = isl.W, h = isl.h;
  const a = h[z0 * W + x0], b = h[z0 * W + x0 + 1], c = h[(z0 + 1) * W + x0], d = h[(z0 + 1) * W + x0 + 1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}
export function coverAt(isl, x, z) {
  const cx = Math.floor(x / isl.CELL), cz = Math.floor(z / isl.CELL);
  if (cx < 0 || cz < 0 || cx >= isl.W || cz >= isl.H) return COVER.SEA;
  return isl.cover[cz * isl.W + cx];
}
export function slopeAt(isl, x, z) {
  const e = 1;
  return Math.hypot(heightAt(isl, x + e, z) - heightAt(isl, x - e, z), heightAt(isl, x, z + e) - heightAt(isl, x, z - e)) / (2 * e);
}
// Seconds-per-metre multiplier for walking; Infinity where nobody can walk.
export function walkCost(isl, x, z) {
  const k = coverAt(isl, x, z);
  if (k === COVER.SEA || k === COVER.CLIFF || k === COVER.POND) return Infinity;
  if (slopeAt(isl, x, z) > 0.9) return Infinity;
  if (k === COVER.ROCKY) return 1 / 0.35;
  if (k === COVER.RIVER) return 1 / 0.4;
  if (k === COVER.FOREST) return 1 / 0.8;
  return 1;
}
