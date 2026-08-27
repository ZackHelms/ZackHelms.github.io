// Winding + sanity guard for the primitive library. `node geom.test.mjs`.
import * as G from './lib/geom.mjs';

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fail++; };

// A primitive is well-formed when each triangle's geometric normal agrees with
// its own stored vertex normal. Degenerate triangles (sphere poles, lathe tips)
// are excluded rather than tolerated, so the threshold can stay at 100%.
function windingAgrees(prim) {
  let agree = 0, n = 0;
  for (let t = 0; t < prim.i.length; t += 3) {
    const a = prim.i[t], b = prim.i[t + 1], c = prim.i[t + 2];
    const ux = prim.p[b * 3] - prim.p[a * 3], uy = prim.p[b * 3 + 1] - prim.p[a * 3 + 1], uz = prim.p[b * 3 + 2] - prim.p[a * 3 + 2];
    const vx = prim.p[c * 3] - prim.p[a * 3], vy = prim.p[c * 3 + 1] - prim.p[a * 3 + 1], vz = prim.p[c * 3 + 2] - prim.p[a * 3 + 2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    if (Math.hypot(gx, gy, gz) < 1e-9) continue;          // degenerate
    n++;
    const nx = (prim.n[a * 3] + prim.n[b * 3] + prim.n[c * 3]) / 3;
    const ny = (prim.n[a * 3 + 1] + prim.n[b * 3 + 1] + prim.n[c * 3 + 1]) / 3;
    const nz = (prim.n[a * 3 + 2] + prim.n[b * 3 + 2] + prim.n[c * 3 + 2]) / 3;
    if (gx * nx + gy * ny + gz * nz > 0) agree++;
  }
  return { agree, n };
}

const cases = [
  ['box', G.box(2, 3, 4)],
  ['sphere', G.sphere(2, 20, 12)],
  ['cyl', G.cyl(2, 1.5, 3, 20)],
  ['cone', G.cyl(2, 0, 3, 20)],
  ['torus', G.torus(3, 0.6, 20, 10)],
  ['lathe', G.lathe([[2, 0], [1.7, 1], [0, 2]], 16)],
  ['lathe-open', G.lathe([[2, 0], [1.7, 1], [1.2, 2]], 16)],
  ['prism', G.prism([[-1, -1], [1, -1], [1, 1], [-1, 1]], 2)],
];
console.log('winding (every triangle must face outward)');
for (const [name, prim] of cases) {
  const { agree, n } = windingAgrees(prim);
  ok(agree === n, `${name}: ${agree}/${n} triangles wound outward`);
}

console.log('normals are unit length');
for (const [name, prim] of cases) {
  let bad = 0;
  for (let k = 0; k < prim.n.length; k += 3) {
    const L = Math.hypot(prim.n[k], prim.n[k + 1], prim.n[k + 2]);
    if (Math.abs(L - 1) > 1e-6) bad++;
  }
  ok(bad === 0, `${name}: ${bad} non-unit normals`);
}

console.log('indices are in range');
for (const [name, prim] of cases) {
  const nv = prim.p.length / 3;
  let bad = 0;
  for (const idx of prim.i) if (idx < 0 || idx >= nv) bad++;
  ok(bad === 0, `${name}: ${bad} out-of-range indices`);
}

console.log('Model.tube spans exactly from a to b');
const m = new G.Model();
m.tube('x', [1, 2, 3], [4, 6, 3], 0.5, 0.5, 8);
const f = m.finalize();
let dmin = 1e9, dmax = -1e9;
for (let k = 0; k < f.p.length; k += 3) {
  const t = ((f.p[k] - 1) * 3 + (f.p[k + 1] - 2) * 4) / 25;   // project onto a->b
  dmin = Math.min(dmin, t); dmax = Math.max(dmax, t);
}
ok(Math.abs(dmin) < 1e-9 && Math.abs(dmax - 1) < 1e-9, `tube endpoints ${dmin.toFixed(6)}..${dmax.toFixed(6)} (want 0..1)`);

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
