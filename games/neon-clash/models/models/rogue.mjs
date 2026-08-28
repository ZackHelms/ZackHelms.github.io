// FIGHTER -- "a rogue in dark red with two daggers". Hooded, cloaked, fast:
// the hood's peak and the flared cloak give it a silhouette that cannot be
// confused with the knight's square pauldrons or the archer's bow.
//
// The dark red is CLOAK, deliberately far from the red team's #ff2244 -- the
// same decision the toon skin made, for the same reason. Team identity is the
// ground ring the game draws at runtime, never the cloth.
import { Model, box, sphere, cyl, lathe, prism, torus, xf } from '../lib/geom.mjs';
import { proportions, skeleton, body } from '../lib/humanoid.mjs';

export const HEIGHT = 12.2;
const P = proportions(HEIGHT, {
  headR: 0.074, shoulderY: 0.124, hipY: 0.068, torsoR: 0.090,
  hipZ: 0.470, shoulderZ: 0.795,
  limbR: 0.040, handR: 0.042, upperArm: 0.202, foreArm: 0.198,
});
const M = { leg: 'leatherDk', boot: 'leatherDk', torso: 'leatherDk', arm: 'cloak', hand: 'leatherDk', skin: null };

const norm = v => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

// A leaf-bladed dagger: short enough to read as a knife rather than a short
// sword, which is the only thing distinguishing this unit from the tank at a
// glance when both are mid-swing.
function dagger(m, hand, d) {
  const dir = norm(d);
  const guard = add(hand, dir, 0.34);
  m.tube('steel', guard, add(hand, dir, 1.5), 0.20, 0.24, 8);
  m.tube('steel', add(hand, dir, 1.5), add(hand, dir, 3.3), 0.24, 0.04, 8);
  const up = Math.abs(dir[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const cross = norm([dir[1] * up[2] - dir[2] * up[1], dir[2] * up[0] - dir[0] * up[2],
                      dir[0] * up[1] - dir[1] * up[0]]);
  m.tube('iron', add(guard, cross, -0.52), add(guard, cross, 0.52), 0.11, 0.11, 6);
  m.tube('leatherDk', add(hand, dir, -0.68), guard, 0.15, 0.16, 8);
}

// pose: { walk, attack } -- attack 1 drives both blades forward together.
export function rogue(pose = {}) {
  const atk = pose.attack || 0;
  const m = new Model();
  const S = skeleton(P, {
    walk: pose.walk || 0,
    stride: pose.stride === undefined ? 0.78 : pose.stride,
    lean: 0.26 + atk * 0.34,
    twist: atk * 0.26,
    crouch: 0.10,
    armL: { a0: 0.55 + atk * 1.05, a1: 1.05 - atk * 0.72, roll: -0.44 },
    armR: { a0: 0.42 + atk * 1.18, a1: 1.12 - atk * 0.80, roll: 0.44 },
  });
  body(m, P, S, M);

  const th = S.shC[2] - S.hipC[2];
  const tilt = Math.atan2(S.shC[0] - S.hipC[0], th);
  // --- the cloak: a flared shell from the shoulders to mid-thigh ---
  m.add('cloak', lathe([
    [P.torsoR * 0.34, th * 1.08], [P.torsoR * 1.02, th * 0.86], [P.torsoR * 1.06, th * 0.40],
    [P.torsoR * 1.28, -th * 0.20], [P.torsoR * 1.62, -th * 0.70],
  ], 22, false), xf({ t: S.hipC, ry: tilt, s: [0.88, 1.14, 1] }));
  m.add('cloak', lathe([
    [P.torsoR * 0.30, th * 1.06], [P.torsoR * 0.92, th * 0.84], [P.torsoR * 0.96, th * 0.42],
    [P.torsoR * 1.16, -th * 0.16], [P.torsoR * 1.20, -th * 0.62], [0, -th * 0.72],
  ], 22), xf({ t: S.hipC, ry: tilt, s: [0.86, 1.10, 1] }));
  m.add('leatherDk', torus(P.torsoR * 0.96, 0.17, 18, 8), xf({ t: [S.hipC[0], 0, S.hipC[2] + 0.15], s: [0.92, 1.14, 1] }));
  // crossed strap over the chest
  m.add('leatherDk', torus(P.torsoR * 1.00, 0.13, 18, 8),
        xf({ t: [S.hipC[0] + th * 0.62 * Math.sin(tilt), 0, S.hipC[2] + th * 0.62], rx: 0.6, s: [0.90, 1.10, 1] }));

  // --- the hood: a peaked cowl, and a face that is deliberately just dark ---
  const hd = S.head, hr = P.headR;
  m.add('cloak', lathe([
    [hr * 1.44, -hr * 1.15], [hr * 1.46, -hr * 0.30], [hr * 1.30, hr * 0.55],
    [hr * 0.86, hr * 1.30], [hr * 0.30, hr * 1.85], [0, hr * 1.95],
  ], 22, false), xf({ t: [hd[0] - hr * 0.34, 0, hd[2]], ry: -0.30 }));
  m.add('visor', sphere(hr * 1.05, 18, 12), xf({ t: [hd[0] + hr * 0.10, 0, hd[2] - hr * 0.10], s: [1, 0.92, 1] }));
  m.add('cloak', lathe([[hr * 1.46, 0], [hr * 1.30, hr * 0.55], [0, hr * 1.10]], 20, false),
        xf({ t: [hd[0] - hr * 0.34, 0, hd[2] - hr * 0.30], ry: -0.30 }));
  // the cowl's shoulders, so the hood does not float
  m.add('cloak', sphere(hr * 1.70, 20, 12),
        xf({ t: [S.shC[0] - hr * 0.30, 0, S.shC[2] + hr * 0.10], s: [1.0, 1.55, 0.62] }));

  const dl = atk > 0.5 ? [0.96, -0.18, 0.20] : [0.42, -0.30, -0.86];
  const dr = atk > 0.5 ? [0.94, 0.22, -0.28] : [0.38, 0.32, -0.88];
  dagger(m, S.handL, dl);
  dagger(m, S.handR, dr);
  return m.finalize();
}
