// Arena surfaces: a tileable dirt bed and a tileable grass verge, plus the
// weathered plank fence that rings the board.
//
// TILEABILITY COMES FROM WRAPPING THE NOISE LATTICE, not from mirroring, so
// the repeat has no visible axis of symmetry. Sampling at (x/SPAN)*PER makes
// x = 0 and x = SPAN land on the same lattice point; the seam is exact.
import { Model, box, cyl, lathe, prism, sphere, xf } from '../lib/geom.mjs';
import { hex } from '../lib/render.mjs';
import { fbm2Tile, worley2Tile, smoothstep, clamp01 } from '../lib/noise.mjs';

export const GROUND_SPAN = 24;          // world units across one ground tile
const PER = 8;                          // lattice cells across that span
const u = x => x / GROUND_SPAN * PER;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// The arena faces straight up, so it takes the key light square on and
// renders far brighter than an authored swatch suggests. These are picked
// dark on purpose -- the first pass looked like a beach.
const DIRT_DK = hex('#3a2717'), DIRT = hex('#5c4024'), DIRT_LT = hex('#75552f');
const DUST = hex('#8d7047'), PEBBLE = hex('#6b6459');

export const DIRT_TILE = {
  base: DIRT, rough: 0.94, metal: 0, cavity: 0.9, bumpScale: 0.55, bumpEps: 0.05,
  tex(x, y, z, out) {
    const broad = fbm2Tile(u(x), u(y), PER, 4, 811);
    const dust = clamp01((fbm2Tile(u(x) * 0.5, u(y) * 0.5, PER * 0.5, 3, 823) - 0.52) * 3.2);
    const c = worley2Tile(u(x) * 3, u(y) * 3, PER * 3, 829);
    const stone = smoothstep(0.26, 0.08, c.f1) * (c.id > 0.84 ? 1 : 0);
    let col = mix(DIRT_DK, DIRT_LT, clamp01(0.20 + broad * 1.10));
    col = mix(col, DUST, dust * 0.45);
    col = mix(col, PEBBLE, stone * 0.80);
    out[0] = col[0]; out[1] = col[1]; out[2] = col[2];
  },
  bump(x, y) {
    const c = worley2Tile(u(x) * 3, u(y) * 3, PER * 3, 829);
    const stone = smoothstep(0.26, 0.08, c.f1) * (c.id > 0.84 ? 1 : 0);
    return fbm2Tile(u(x) * 2, u(y) * 2, PER * 2, 4, 811) * 0.55 + stone * 0.55
         + fbm2Tile(u(x) * 6, u(y) * 6, PER * 6, 2, 837) * 0.18;
  },
  roughFn: () => 0.94,
};

const GRASS_DK = hex('#223a15'), GRASS = hex('#33531f'), GRASS_LT = hex('#4a6e2a');
export const GRASS_TILE = {
  base: GRASS, rough: 0.90, metal: 0, cavity: 1.0, bumpScale: 0.70, bumpEps: 0.03,
  tex(x, y, z, out) {
    const clump = worley2Tile(u(x) * 4, u(y) * 4, PER * 4, 907);
    const broad = fbm2Tile(u(x), u(y), PER, 4, 911);
    const dry = clamp01((fbm2Tile(u(x) * 0.7, u(y) * 0.7, PER * 0.7, 3, 919) - 0.58) * 3.0);
    let col = mix(GRASS_DK, GRASS_LT, clamp01(0.18 + broad * 0.9 + clump.id * 0.45));
    col = mix(col, hex('#57562b'), dry * 0.5);
    out[0] = col[0]; out[1] = col[1]; out[2] = col[2];
  },
  bump(x, y) {
    const clump = worley2Tile(u(x) * 4, u(y) * 4, PER * 4, 907);
    return (1 - clump.f1) * 0.7 + fbm2Tile(u(x) * 9, u(y) * 9, PER * 9, 2, 923) * 0.5;
  },
  roughFn: () => 0.90,
};

// --- the fence ------------------------------------------------------------
// One SECTION, tiled along each board edge and turned 90 degrees for the sides
// -- the same trick the section itself uses internally, one plank at a time.
// Planks lean, split and go missing on a fixed schedule rather than a random
// one so the run is identical every render.
export const FENCE_LEN = 14;            // world units covered by one section
export const FENCE_H = 6.4;

export function fenceSection() {
  const m = new Model();
  const N = 9;
  const LEAN = [0.06, -0.03, 0.11, 0, -0.09, 0.04, -0.05, 0.13, -0.02];
  const HGT = [1.00, 0.93, 1.06, 0.88, 1.00, 0.97, 1.10, 0.84, 0.99];
  const GONE = [false, false, false, true, false, false, false, false, false];
  for (let k = 0; k < N; k++) {
    if (GONE[k]) continue;
    const y = (k / (N - 1) - 0.5) * FENCE_LEN;
    const h = FENCE_H * HGT[k];
    m.add(k % 3 === 1 ? 'woodGrey' : 'woodPlank',
          box(0.42, 1.28, h),
          xf({ t: [0, y, h / 2], rx: LEAN[k], ry: LEAN[k] * 0.4 }));
    // a rough sawn top, cut on the same schedule
    m.add(k % 3 === 1 ? 'woodGrey' : 'woodPlank', box(0.44, 1.30, 0.30),
          xf({ t: [0, y, h], rx: LEAN[k] + (k % 2 ? 0.20 : -0.16) }));
  }
  for (const z of [FENCE_H * 0.30, FENCE_H * 0.74])
    m.add('woodDark', box(0.30, FENCE_LEN + 0.6, 0.52), xf({ t: [-0.30, 0, z], rx: 0.02 }));
  for (const y of [-FENCE_LEN / 2, FENCE_LEN / 2])
    m.tube('woodDark', [-0.30, y, 0], [-0.30, y, FENCE_H * 1.05], 0.46, 0.40, 10);
  return m.finalize();
}
