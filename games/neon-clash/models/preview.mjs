#!/usr/bin/env node
// Contact-sheet preview. This is the tuning loop: change a model, render a
// sheet, LOOK AT IT. Most of what went wrong building these was invisible to
// every assertion and obvious in one screenshot.
//
//   node preview.mjs units  out.png          # all three units, 4 yaws x 2 poses
//   node preview.mjs tank   out.png [big]    # one unit, 5 yaws x 3 frames
//   node preview.mjs fort   out.png          # bunker, base, gun
//   node preview.mjs props  out.png          # fireball frames + fence
//   node preview.mjs ground out.png          # the two tileable ground textures
//   node preview.mjs mats   out.png          # one ball per material
import fs from 'node:fs';
import { renderSprite, renderTexture, RIG } from './lib/render.mjs';
import { MATS, fireMaterial, emberMaterial } from './lib/materials.mjs';
import { encodePNG } from './lib/png.mjs';
import { Model, sphere, xf } from './lib/geom.mjs';
import { knight } from './models/knight.mjs';
import { archer } from './models/archer.mjs';
import { rogue } from './models/rogue.mjs';
import { bunker, base, gun } from './models/fort.mjs';
import { fireball, FIRE_FRAMES } from './models/props.mjs';
import { DIRT_TILE, GRASS_TILE, GROUND_SPAN, fenceSection } from './models/ground.mjs';
import * as C from './config.mjs';

export const mats = { ...MATS, fire: fireMaterial(0), ember: emberMaterial(0) };

// Compose tiles onto one sheet over a flat ground-ish backdrop, so alpha and
// silhouette are judged against something, not against black.
export function sheet(tiles, { w, h, cols, out, bg = [46, 52, 38] }) {
  const rows = Math.ceil(tiles.length / cols);
  const W = cols * w, H = rows * h;
  const img = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { img[i * 4] = bg[0]; img[i * 4 + 1] = bg[1]; img[i * 4 + 2] = bg[2]; img[i * 4 + 3] = 255; }
  tiles.forEach((px, k) => {
    const cx = (k % cols) * w, cy = ((k / cols) | 0) * h;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const s = (y * w + x) * 4, d = ((cy + y) * W + cx + x) * 4;
        const a = px[s + 3] / 255;
        if (a <= 0) continue;
        for (let c = 0; c < 3; c++) img[d + c] = px[s + c] * a + img[d + c] * (1 - a);
      }
  });
  fs.writeFileSync(out, encodePNG(img, W, H));
  console.log(`${out}  ${W}x${H}  ${tiles.length} tiles`);
}
export { renderSprite };

const UNITS = { tank: knight, archer, fighter: rogue };
const [what, out, big] = process.argv.slice(2);
if (!what || !out) { console.error('usage: preview.mjs <units|tank|archer|fighter|fort|props|ground|mats> <out.png> [big]'); process.exit(1); }

// Report anything that ran off its tile: a clipped sword is easy to miss.
function edgeReport(tiles, T) {
  const e = { L: 0, R: 0, T: 0, B: 0 };
  for (const px of tiles)
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        if (px[(y * T + x) * 4 + 3] <= 96) continue;
        if (x < 2) e.L++; if (x > T - 3) e.R++; if (y < 2) e.T++; if (y > T - 3) e.B++;
      }
  console.log('edge pixels L/R/T/B (want 0):', e.L, e.R, e.T, e.B);
}

if (what === 'ground') {
  const G = C.GROUND_TILE;
  sheet([renderTexture(DIRT_TILE, G, GROUND_SPAN), renderTexture(GRASS_TILE, G, GROUND_SPAN)],
        { w: G, h: G, cols: 2, out });
} else if (what === 'mats') {
  const names = Object.keys(MATS);
  const T = 110, ppu = T / 5.6;
  const tiles = names.map(n => {
    const m = new Model(); m.add(n, sphere(1.7, 30, 20), xf({ t: [0, 0, 1.85] }));
    return renderSprite(m.finalize(), { w: T, h: T, ss: 3, ppu, pivotX: T / 2, pivotY: T - 14, mats, groundShadow: 1.4 });
  });
  console.log(names.join(' '));
  sheet(tiles, { w: T, h: T, cols: 7, out });
} else if (what === 'fort') {
  const T = 224, ppu = T / 34;
  const o = { w: T, h: T, ss: 2, ppu, pivotX: T / 2, mats };
  const tiles = [];
  for (const yaw of [0, Math.PI / 4]) tiles.push(renderSprite(bunker(), { ...o, pivotY: T * 0.74, groundShadow: 2.6, yaw }));
  for (const yaw of [-Math.PI / 2, Math.PI / 2]) tiles.push(renderSprite(base(), { ...o, pivotY: T * 0.62, groundShadow: 3.0, yaw }));
  tiles.push(renderSprite(base(true), { ...o, pivotY: T * 0.62, groundShadow: 3.0, yaw: -Math.PI / 2 }));
  for (const yaw of [0, Math.PI / 2]) tiles.push(renderSprite(gun(), { ...o, pivotY: T * 0.62, groundShadow: 1.8, yaw }));
  sheet(tiles, { w: T, h: T, cols: 7, out });
} else if (what === 'props') {
  const T = 128, ppu = T / 9, tiles = [];
  for (let f = 0; f < FIRE_FRAMES; f++) {
    const m = fireball(f);
    for (const p of m.parts) p.mat = p.mat === 'fire' ? 'fire' : p.mat;
    tiles.push(renderSprite(m, { w: T, h: T, ss: 3, ppu, pivotX: T / 2, pivotY: T / 2, mats }));
  }
  sheet(tiles, { w: T, h: T, cols: 6, out });
  const FT = 240, fppu = FT / 17;
  sheet([0, Math.PI / 2].map(yaw => renderSprite(fenceSection(),
    { w: FT, h: FT, ss: 2, ppu: fppu, pivotX: FT / 2, pivotY: FT * 0.72, mats, groundShadow: 1.6, yaw })),
    { w: FT, h: FT, cols: 2, out: out.replace(/\.png$/, '-fence.png') });
} else {
  const one = UNITS[what];
  // Same canvas the atlas build uses, so "edge pixels" here means the same
  // thing it means there -- a smaller preview tile clips sprites the shipped
  // atlas does not, and then the report cries wolf every run.
  const T = C.RENDER_CANVAS, ppu = C.PPU;
  const o = { w: T, h: T, ss: C.SS, ppu, pivotX: T / 2, pivotY: T * C.UNIT_PIVOT_Y, mats, groundShadow: 2.2 };
  const yaws = one ? [Math.PI / 2, Math.PI * 0.75, Math.PI, -Math.PI / 2, 0]
                   : [Math.PI / 2, Math.PI * 0.75, Math.PI, -Math.PI / 2];
  const poses = one ? [{ walk: .25 }, { walk: .75 }, { attack: 1, walk: .2, stride: .25 }]
                    : [{ walk: .25 }, { attack: 1, walk: .2, stride: .25 }];
  const list = one ? [one] : Object.values(UNITS);
  const tiles = [];
  for (const fn of list) for (const pose of poses) for (const yaw of yaws)
    tiles.push(renderSprite(fn(pose), { ...o, yaw }));
  edgeReport(tiles, T);
  sheet(tiles, { w: T, h: T, cols: yaws.length * (one ? 1 : poses.length), out });
}
void big; void RIG;
