// nav.js — walking routes over the island: A* on a 4 m grid whose cost is the
// slowest ground in each cell, then string-pulled where the straight line is no slower.
import { walkCost } from './island.js';

export const NAV_CELL = 4;
export const WALK = 1 / 30;            // metres per game second (1.6 m/s real at 1x = 120 m per game hour)

export function makeNav(isl) {
  const NW = Math.floor(isl.W * isl.CELL / NAV_CELL), NH = Math.floor(isl.H * isl.CELL / NAV_CELL), N = NW * NH;
  const cost = new Float32Array(N);
  for (let cz = 0; cz < NH; cz++) for (let cx = 0; cx < NW; cx++) {
    let m = 0;
    for (const [ox, oz] of [[1, 1], [3, 1], [1, 3], [3, 3], [2, 2]]) m = Math.max(m, walkCost(isl, cx * NAV_CELL + ox, cz * NAV_CELL + oz));
    cost[cz * NW + cx] = m;
  }
  // connected regions (4-connectivity, matching A*'s no-corner-cutting rule)
  const comp = new Int32Array(N).fill(-1), stack = new Int32Array(N);
  let nc = 0;
  for (let i = 0; i < N; i++) {
    if (comp[i] >= 0 || !Number.isFinite(cost[i])) continue;
    let sp = 0; stack[sp++] = i; comp[i] = nc;
    while (sp) {
      const c = stack[--sp], cx = c % NW, cz = (c - cx) / NW;
      if (cx > 0 && comp[c - 1] < 0 && Number.isFinite(cost[c - 1])) { comp[c - 1] = nc; stack[sp++] = c - 1; }
      if (cx < NW - 1 && comp[c + 1] < 0 && Number.isFinite(cost[c + 1])) { comp[c + 1] = nc; stack[sp++] = c + 1; }
      if (cz > 0 && comp[c - NW] < 0 && Number.isFinite(cost[c - NW])) { comp[c - NW] = nc; stack[sp++] = c - NW; }
      if (cz < NH - 1 && comp[c + NW] < 0 && Number.isFinite(cost[c + NW])) { comp[c + NW] = nc; stack[sp++] = c + NW; }
    }
    nc++;
  }
  const size = new Int32Array(nc); for (let i = 0; i < N; i++) if (comp[i] >= 0) size[comp[i]]++;
  let main = 0; for (let k = 1; k < nc; k++) if (size[k] > size[main]) main = k;
  const nav = { isl, NW, NH, cost, comp, main, g: new Float32Array(N), from: new Int32Array(N), seen: new Uint32Array(N), shut: new Uint32Array(N), gen: 0, heap: new Int32Array(N * 8), hf: new Float32Array(N * 8) };
  nav.cellOf = (x, z) => {
    const cx = Math.floor(x / NAV_CELL), cz = Math.floor(z / NAV_CELL);
    return cx < 0 || cz < 0 || cx >= NW || cz >= NH ? -1 : cz * NW + cx;
  };
  nav.costAt = (x, z) => { const c = nav.cellOf(x, z); return c < 0 ? Infinity : cost[c]; };
  return nav;
}

const centre = (nav, c) => ({ x: (c % nav.NW + 0.5) * NAV_CELL, z: (Math.floor(c / nav.NW) + 0.5) * NAV_CELL });

// The nearest walkable point in region `comp` (default: the island's main region).
export function nearestPassable(nav, p, comp) {
  if (comp === undefined) comp = nav.main;
  const c0 = nav.cellOf(p.x, p.z);
  if (c0 >= 0 && nav.comp[c0] === comp) return { x: p.x, z: p.z };
  const cx = Math.floor(p.x / NAV_CELL), cz = Math.floor(p.z / NAV_CELL);
  for (let r = 1; r < 80; r++) {
    let best = null, bd = 1e9;
    for (let oz = -r; oz <= r; oz++) for (let ox = -r; ox <= r; ox++) {
      if (Math.max(Math.abs(ox), Math.abs(oz)) !== r) continue;
      const x = cx + ox, z = cz + oz; if (x < 0 || z < 0 || x >= nav.NW || z >= nav.NH) continue;
      const c = z * nav.NW + x; if (nav.comp[c] !== comp) continue;
      const q = centre(nav, c), d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < bd) { bd = d; best = q; }
    }
    if (best) return best;
  }
  return null;
}

// Max cost along a straight segment (1 m samples); Infinity if it leaves the walkable ground.
function lineCost(nav, a, b) {
  const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L));
  let m = 0;
  for (let i = 0; i <= n; i++) { const c = nav.costAt(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n); if (c > m) m = c; if (m === Infinity) break; }
  return m;
}

export function findPath(nav, from, to) {
  const fc = nav.cellOf(from.x, from.z), home = fc >= 0 && nav.comp[fc] >= 0 ? nav.comp[fc] : nav.main;
  const s0 = nearestPassable(nav, from, home), t0 = nearestPassable(nav, to, home);
  if (!s0 || !t0) return null;
  const S = nav.cellOf(s0.x, s0.z), T = nav.cellOf(t0.x, t0.z), NW = nav.NW, cost = nav.cost;
  if (S === T) return [t0];
  const gen = ++nav.gen, g = nav.g, fr = nav.from, seen = nav.seen, shut = nav.shut, heap = nav.heap, hf = nav.hf;
  let hn = 0;
  const tx = T % NW, tz = (T - tx) / NW;
  const hfun = (c) => { const dx = Math.abs(c % NW - tx), dz = Math.abs(Math.floor(c / NW) - tz); return (Math.max(dx, dz) + 0.4142 * Math.min(dx, dz)) * NAV_CELL; };
  const push = (c, f) => { let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; heap[i] = heap[p]; hf[i] = hf[p]; i = p; } heap[i] = c; hf[i] = f; };
  const pop = () => {
    const top = heap[0], lc = heap[--hn], lf = hf[hn]; let i = 0;
    for (;;) { let l = 2 * i + 1; if (l >= hn) break; if (l + 1 < hn && hf[l + 1] < hf[l]) l++; if (hf[l] >= lf) break; heap[i] = heap[l]; hf[i] = hf[l]; i = l; }
    heap[i] = lc; hf[i] = lf; return top;
  };
  seen[S] = gen; g[S] = 0; fr[S] = -1; push(S, hfun(S));
  let found = false;
  while (hn > 0) {
    const c = pop();
    if (shut[c] === gen) continue;
    shut[c] = gen;
    if (c === T) { found = true; break; }
    const cx = c % NW, cz = (c - cx) / NW;
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oz) continue;
      const x = cx + ox, z = cz + oz; if (x < 0 || z < 0 || x >= NW || z >= nav.NH) continue;
      const n = z * NW + x, cn = cost[n]; if (!Number.isFinite(cn) || shut[n] === gen) continue;
      if (ox && oz && (!Number.isFinite(cost[cz * NW + x]) || !Number.isFinite(cost[z * NW + cx]))) continue;   // no corner cutting
      const ng = g[c] + (ox && oz ? 1.4142 : 1) * NAV_CELL * (cn + cost[c]) * 0.5;
      if (seen[n] !== gen || ng < g[n]) { seen[n] = gen; g[n] = ng; fr[n] = c; push(n, ng + hfun(n)); }
      if (hn >= heap.length - 8) return null;
    }
  }
  if (!found) return null;
  const cells = []; for (let c = T; c >= 0; c = fr[c]) cells.push(c);
  cells.reverse();
  const pts = cells.map((c) => centre(nav, c));
  pts[0] = s0; pts[pts.length - 1] = t0;
  // string-pull: skip ahead while the straight line is no slower than the slowest cell it replaces
  const out = []; let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    for (; j > i + 1; j--) {
      let mx = 0; for (let k = i; k <= j; k++) mx = Math.max(mx, nav.costAt(pts[k].x, pts[k].z));
      if (lineCost(nav, pts[i], pts[j]) <= mx) break;
    }
    out.push(pts[j]); i = j;
  }
  return out;
}

// Game seconds to walk a polyline at walking pace over its ground.
export function pathTime(nav, pts) {
  let t = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 2));
    for (let k = 0; k < n; k++) {
      const c = nav.costAt(a.x + (b.x - a.x) * (k + 0.5) / n, a.z + (b.z - a.z) * (k + 0.5) / n);
      t += (L / n) * (Number.isFinite(c) ? c : 3) / WALK;
    }
  }
  return t;
}
