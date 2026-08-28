#!/usr/bin/env node
// Pre-render every Neon Clash sprite into ../sprites/atlas.png + atlas.json.
//
//   node build.mjs            # full atlas
//   node build.mjs --quick    # 4 yaws instead of 12, for a fast look
//
// DETERMINISTIC: same source in, same bytes out. Nothing here reads the clock
// or Math.random, so a rebuild with no source change leaves the working tree
// clean -- which is what makes "did the art actually change?" answerable by
// `git status`. Do not add a timestamp to the manifest; the game already
// carries a build badge for that, and a stamp here dirties atlas.json and the
// inlined copy in index.html on every single run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSprite, renderTexture, RIG, LEAN } from './lib/render.mjs';
import { MATS, fireMaterial, emberMaterial } from './lib/materials.mjs';
import { encodePNG } from './lib/png.mjs';
import { knight } from './models/knight.mjs';
import { archer } from './models/archer.mjs';
import { rogue } from './models/rogue.mjs';
import { bunker, base, gun } from './models/fort.mjs';
import { fireball, FIRE_FRAMES } from './models/props.mjs';
import { DIRT_TILE, GRASS_TILE, GROUND_SPAN, fenceSection, FENCE_LEN } from './models/ground.mjs';
import * as C from './config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'sprites');
const quick = process.argv.includes('--quick');
const YAWS = quick ? 4 : C.YAWS;
const SS = quick ? 2 : C.SS;
const PPU = C.PPU;

// --- crop ------------------------------------------------------------------
// Every sprite is rendered into a generous canvas and then trimmed to its own
// alpha bounds. Nothing is sized by hand, nothing silently clips, and the
// atlas pays only for pixels that carry something.
function crop(px, w, h, pivotX, pivotY) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (px[(y * w + x) * 4 + 3] > 2) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  if (x1 < 0) return { w: 1, h: 1, ox: 0, oy: 0, data: new Uint8ClampedArray(4) };
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const data = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++)
    data.set(px.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + cw) * 4), y * cw * 4);
  const touched = x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1;
  return { w: cw, h: ch, ox: pivotX - x0, oy: pivotY - y0, data, touched };
}

let clipped = 0;
function shot(model, { tile, tileH, ppu = PPU, pivotY, yaw = 0, shadow = 2.2, ss = SS }) {
  const W = tile, H = tileH || tile;
  const pX = W / 2, pY = H * pivotY;
  const px = renderSprite(model, { w: W, h: H, ss, ppu, pivotX: pX, pivotY: pY, mats, groundShadow: shadow, yaw });
  const c = crop(px, W, H, pX, pY);
  if (c.touched) clipped++;
  return c;
}

const mats = { ...MATS };
for (let f = 0; f < FIRE_FRAMES; f++) { mats['fire' + f] = fireMaterial(f / FIRE_FRAMES); mats['ember' + f] = emberMaterial(f / FIRE_FRAMES); }
mats.fire = mats.fire0; mats.ember = mats.ember0;

// --- the sprite list -------------------------------------------------------
const groups = {};
const sprites = [];
const t0 = Date.now();

// A group carries TWO resolutions and they are not the same number:
//   ppu   -- atlas pixels per DRAWN world unit. The game divides by this, and
//            it is the same for every group, because every group is drawn into
//            the same board at the same scale.
//   bake  -- atlas pixels per MODEL world unit, i.e. what it was rendered at.
//            Groups drawn larger than life are baked larger by the same factor
//            so they land 1:1. Only the builder cares.
function group(name, meta, make) {
  const first = sprites.length;
  make();
  groups[name] = { ...meta, ppu: PPU, first, count: sprites.length - first };
  process.stdout.write(`  ${name}: ${sprites.length - first} sprites (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
}

console.log('rendering');
// Units are drawn 1.5x larger than life (see ART_SCALE in config.mjs) and are
// therefore BAKED 1.5x larger, at 1:1 with the pixels they land on. Buildings
// are modelled at their real footprint and bake at plain PPU.
const ART_PPU = PPU * C.ART_SCALE;
for (const [name, fn] of [['tank', knight], ['archer', archer], ['fighter', rogue]])
  group(name, { yaws: YAWS, frames: C.FRAMES, bake: ART_PPU, art: C.ART_SCALE }, () => {
    // index = frame * yaws + yaw, so the game can pick a facing without a table
    const poses = [{ walk: 0.25 }, { walk: 0.75 }, { attack: 1, walk: 0.2, stride: 0.25 }];
    for (const pose of poses) {
      const model = fn(pose);
      for (let k = 0; k < YAWS; k++)
        sprites.push(shot(model, { tile: Math.round(C.RENDER_CANVAS * C.ART_SCALE), ppu: ART_PPU,
                                   pivotY: C.UNIT_PIVOT_Y, yaw: k / YAWS * Math.PI * 2 }));
    }
  });

group('bunker', { yaws: 4, frames: 1 }, () => {
  const model = bunker();
  for (let k = 0; k < 4; k++) sprites.push(shot(model, { tile: 320, pivotY: 0.76, yaw: k / 4 * Math.PI * 2, shadow: 2.8 }));
});
group('gun', { yaws: YAWS, frames: 1 }, () => {
  const model = gun();
  for (let k = 0; k < YAWS; k++) sprites.push(shot(model, { tile: 240, pivotY: 0.62, yaw: k / YAWS * Math.PI * 2, shadow: 1.8 }));
});
// side 0 sits at the bottom of the board and faces -y; side 1 faces +y
// `deck` is the z of the gun platform: the game lifts the separately-drawn
// gun sprite by it so the barrel sits on the emplacement instead of the dirt.
group('base', { yaws: 2, frames: 2, deck: 7.7 }, () => {
  for (const dead of [false, true]) {
    const model = base(dead);
    for (const yaw of [-Math.PI / 2, Math.PI / 2])
      sprites.push(shot(model, { tile: 420, tileH: 340, pivotY: 0.66, yaw, shadow: 3.2, ss: Math.min(SS, 2) }));
  }
});
group('fireball', { yaws: 1, frames: FIRE_FRAMES }, () => {
  for (let f = 0; f < FIRE_FRAMES; f++) {
    const m = fireball(f);
    for (const p of m.parts) p.mat = p.mat === 'fire' ? 'fire' + f : p.mat === 'ember' ? 'ember' + f : p.mat;
    sprites.push(shot(m, { tile: 190, pivotY: 0.5, shadow: 0 }));
  }
});
group('fence', { yaws: 2, frames: 1, len: FENCE_LEN }, () => {
  const model = fenceSection();
  for (const yaw of [0, Math.PI / 2])
    sprites.push(shot(model, { tile: 340, pivotY: 0.72, yaw, shadow: 1.6, ss: Math.min(SS, 2) }));
});

console.log('  ground tiles');
const ground = {};
for (const [name, mt] of [['dirt', DIRT_TILE], ['grass', GRASS_TILE]]) {
  const px = renderTexture(mt, C.GROUND_TILE, GROUND_SPAN);
  sprites.push({ w: C.GROUND_TILE, h: C.GROUND_TILE, ox: 0, oy: 0, data: px });
  ground[name] = { first: sprites.length - 1, span: GROUND_SPAN };
}

// --- shelf pack ------------------------------------------------------------
sprites.forEach((s, i) => { s.i = i; });
const order = [...sprites].sort((a, b) => b.h - a.h);
const PAD = 1;
const AW = 2048;
let cx = PAD, cy = PAD, rowH = 0;
for (const s of order) {
  if (cx + s.w + PAD > AW) { cx = PAD; cy += rowH + PAD; rowH = 0; }
  s.x = cx; s.y = cy; cx += s.w + PAD; rowH = Math.max(rowH, s.h);
}
const AH = cy + rowH + PAD;
const atlas = new Uint8ClampedArray(AW * AH * 4);
for (const s of sprites)
  for (let y = 0; y < s.h; y++)
    atlas.set(s.data.subarray(y * s.w * 4, (y + 1) * s.w * 4), ((s.y + y) * AW + s.x) * 4);

fs.mkdirSync(OUT, { recursive: true });
const png = encodePNG(atlas, AW, AH);
fs.writeFileSync(path.join(OUT, 'atlas.png'), png);

const rect = s => [s.x, s.y, s.w, s.h, Math.round(s.ox * 100) / 100, Math.round(s.oy * 100) / 100];
const manifest = {
  version: C.ATLAS_VERSION,
  note: 'GENERATED by games/neon-clash/models/build.mjs -- do not edit by hand. Re-render: cd games/neon-clash/models && node build.mjs',
  image: 'atlas.png',
  size: [AW, AH],
  ppu: Math.round(PPU * 1e4) / 1e4,
  lean: LEAN,
  rects: sprites.map(rect),
  groups, ground,
};
fs.writeFileSync(path.join(OUT, 'atlas.json'), JSON.stringify(manifest));

// The game carries the manifest INLINE -- a fetch would put the whole skin
// behind a CORS check that file:// fails, so the page could never be debugged
// off disk. Written here between markers so it can never drift from the atlas
// it describes; the .json beside the image stays as the readable record.
const GAME = path.join(HERE, '..', 'index.html');
const BEGIN = '/* ATLAS-MANIFEST-BEGIN */', END = '/* ATLAS-MANIFEST-END */';
let html = fs.readFileSync(GAME, 'utf8');
const i = html.indexOf(BEGIN), j = html.indexOf(END);
if (i < 0 || j < 0) {
  console.error('WARNING: manifest markers not found in index.html -- game NOT updated');
} else {
  html = html.slice(0, i) + BEGIN + '\nconst ATLAS_MANIFEST = ' + JSON.stringify(manifest) + ';\n' + html.slice(j);
  fs.writeFileSync(GAME, html);
  console.log('inlined manifest into games/neon-clash/index.html');
}

console.log(`\natlas ${AW}x${AH}  ${(png.length / 1024).toFixed(0)} KB  ${sprites.length} sprites  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(clipped ? `WARNING: ${clipped} sprites touched their render canvas edge (may be cut off)` : 'no sprite touched its canvas edge');
