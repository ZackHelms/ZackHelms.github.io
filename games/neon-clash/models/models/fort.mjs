// Buildings: the BUNKER (a timber blockhouse), the BASE (a stone-and-timber
// gatehouse) and the base's GUN, which is a separate yaw-swept sprite because
// the barrel tracks whatever it is shooting -- exactly as the neon and toon
// skins draw it. Baking the gun into the fortification would freeze the one
// part of the base that has to move.
import { Model, box, sphere, cyl, lathe, prism, torus, xf } from '../lib/geom.mjs';

// lathe with 4 segments is a square pyramid; 6 is a hex tower roof.
const roof = (r, h, seg) => lathe([[r, 0], [r * 0.86, h * 0.22], [0, h]], seg);

// --- BUNKER ---------------------------------------------------------------
// Collision radius 7.6, so the blockhouse is built to about 11 across: the
// sandbag skirt fills out to the circle the game actually tests against.
export function bunker() {
  const m = new Model();
  const S = 5.2, H = 6.4;
  // sandbag skirt
  for (let k = 0; k < 26; k++) {
    const a = k / 26 * Math.PI * 2, r = S * 1.42;
    m.add('sandbag', sphere(1.05, 14, 9),
          xf({ t: [Math.cos(a) * r, Math.sin(a) * r, 0.62], rz: a, s: [1.35, 0.85, 0.62] }));
    if (k % 2 === 0)
      m.add('sandbag', sphere(0.95, 14, 9),
            xf({ t: [Math.cos(a + 0.12) * r, Math.sin(a + 0.12) * r, 1.55], rz: a, s: [1.30, 0.82, 0.58] }));
  }
  // stacked wall logs, four sides
  for (let side = 0; side < 4; side++) {
    const a = side * Math.PI / 2;
    const nx = Math.cos(a), ny = Math.sin(a);
    for (let k = 0; k < 6; k++) {
      const z = 0.75 + k * 1.02;
      const jitter = ((k * 7 + side * 3) % 5 - 2) * 0.045;
      m.tube(k % 2 ? 'woodGrey' : 'woodPlank',
             [nx * S - ny * S, ny * S + nx * S, z + jitter],
             [nx * S + ny * S, ny * S - nx * S, z - jitter], 0.52, 0.52, 10);
    }
  }
  // corner posts
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]])
    m.tube('woodDark', [sx * S, sy * S, 0], [sx * S, sy * S, H + 0.5], 0.72, 0.62, 12);
  // firing slits: a dark slot on each face, which is what says "garrison"
  for (let side = 0; side < 4; side++) {
    const a = side * Math.PI / 2;
    m.add('visor', box(0.5, S * 1.25, 0.85),
          xf({ t: [Math.cos(a) * (S + 0.10), Math.sin(a) * (S + 0.10), 3.55], rz: a }));
  }
  // plank roof with an overhang, then a ridge cap
  m.add('woodPlank', roof(S * 1.30, 2.9, 4), xf({ t: [0, 0, H], rz: Math.PI / 4 }));
  m.add('woodDark', roof(S * 0.86, 1.6, 4), xf({ t: [0, 0, H + 2.1], rz: Math.PI / 4 }));
  m.add('iron', torus(S * 1.05, 0.16, 4, 8), xf({ t: [0, 0, H + 0.18], rz: Math.PI / 4 }));
  return m.finalize();
}

// --- BASE -----------------------------------------------------------------
// BASE_HW is 13 and the pedestal is 5 deep either side of the line, so the
// fortification is built to exactly that footprint: 26 across, 10 through.
// +X is "toward the field", the same convention every other model uses.
export function base(dead = false) {
  const m = new Model();
  const HW = 13, D = 4.6, H = 6.6;
  const stone = dead ? 'stoneDead' : 'stone';
  const timber = dead ? 'woodGrey' : 'woodPlank';
  // curtain wall
  m.add(stone, prism([[-D, -HW], [D * 0.86, -HW], [D * 0.86, HW], [-D, HW]], H),
        xf({ t: [0, 0, H / 2] }));
  m.add(stone, prism([[-D * 1.06, -HW * 1.02], [D * 0.94, -HW * 1.02],
                      [D * 0.94, HW * 1.02], [-D * 1.06, HW * 1.02]], 0.9),
        xf({ t: [0, 0, 0.45] }));
  // battlements along the field-facing edge, with a gap for the gun
  for (let k = -4; k <= 4; k++) {
    if (Math.abs(k) < 1) continue;
    m.add(stone, box(1.6, 2.1, 2.5), xf({ t: [D * 0.58, k * 2.9, H + 1.15] }));
  }
  // corner towers, each with a timber cap
  for (const sgn of [-1, 1]) {
    m.add(stone, cyl(2.6, 2.30, H + 2.6, 18), xf({ t: [-D * 0.1, sgn * (HW - 0.6), 0] }));
    m.add(timber, roof(3.3, 3.6, 8), xf({ t: [-D * 0.1, sgn * (HW - 0.6), H + 2.6] }));
    m.add('iron', torus(2.55, 0.16, 18, 8), xf({ t: [-D * 0.1, sgn * (HW - 0.6), H + 2.4] }));
  }
  // the gate: timber leaves, iron banding, and a dark arch behind them
  m.add('visor', box(1.2, 5.4, 4.8), xf({ t: [D * 0.70, 0, 2.4] }));
  for (const sgn of [-1, 1]) {
    m.add(timber, box(0.7, 2.5, 4.6), xf({ t: [D * 0.86, sgn * 1.35, 2.3] }));
    m.add('iron', box(0.85, 2.3, 0.34), xf({ t: [D * 0.90, sgn * 1.35, 3.2] }));
    m.add('iron', box(0.85, 2.3, 0.34), xf({ t: [D * 0.90, sgn * 1.35, 1.1] }));
  }
  // the gun deck the barrel sits on
  m.add(stone, cyl(3.4, 3.0, 1.1, 20), xf({ t: [-D * 0.25, 0, H] }));
  return m.finalize();
}

// --- BASE GUN -------------------------------------------------------------
// Hub 3, barrel 8.5 -- the same numbers BASE_GUN carries in the game, so the
// rendered barrel ends exactly where the muzzle flash is drawn.
export function gun() {
  const m = new Model();
  m.add('iron', lathe([[0, 0], [2.6, 0.2], [2.9, 1.1], [2.3, 2.0], [0, 2.3]], 20), xf({ t: [0, 0, 0] }));
  m.add('woodDark', box(4.2, 3.6, 1.5), xf({ t: [0.4, 0, 1.9] }));
  m.tube('woodPlank', [0.6, 0, 2.5], [8.5, 0, 2.5], 1.02, 0.74, 16);
  for (const x of [2.2, 4.4, 6.6])
    m.add('iron', torus(0.94 - (x - 2.2) * 0.03, 0.17, 16, 8), xf({ t: [x, 0, 2.5], ry: Math.PI / 2 }));
  m.add('brass', torus(0.80, 0.20, 16, 8), xf({ t: [8.4, 0, 2.5], ry: Math.PI / 2 }));
  for (const sgn of [-1, 1])
    m.add('iron', cyl(1.35, 1.35, 0.42, 16), xf({ t: [0.2, sgn * 2.0, 1.5], rx: Math.PI / 2 }));
  return m.finalize();
}
