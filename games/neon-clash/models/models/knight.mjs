// TANK -- "a large human with a shield and sword". A heavy footman in riveted
// plate: heater shield locked on the left arm, arming sword in the right.
//
// EVERYTHING HERE IS BUILT FOR ~60 PIXELS. That is how wide this model is on a
// phone, so the figure is a handful of large forms -- helm, breastplate,
// pauldrons, shield, sword, two legs -- and nothing else. Detail below about a
// third of a world unit is texture's job, not geometry's; every fiddly little
// primitive tried here read as noise and was cut.
import { Model, box, sphere, cyl, lathe, prism, torus, xf } from '../lib/geom.mjs';
import { proportions, skeleton, body } from '../lib/humanoid.mjs';

export const HEIGHT = 14.5;
// The chest was 4.65 units wide against 4.86 tall -- square, which is why it
// read as a barrel however it was lit. A torso wants roughly 2:1.
const P = proportions(HEIGHT, {
  headR: 0.066, shoulderY: 0.140, hipY: 0.074, torsoR: 0.098,
  hipZ: 0.452, shoulderZ: 0.790,
  limbR: 0.050, handR: 0.048, upperArm: 0.200, foreArm: 0.194,
});
// The armour supplies the torso and the helm supplies the head, so the base
// body cedes both rather than hiding two extra volumes underneath.
const M = { leg: 'plate', boot: 'leather', torso: null, arm: 'plate', hand: 'mail', skin: null };

const norm = v => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

// A heater shield, authored in (up, right) and stood upright so its face looks
// forward. Board, iron rim, boss: three forms, all of them readable.
function shield(m, at, tilt) {
  const W = 2.6, T = 3.2;
  const poly = [
    [T, -W], [T, W], [T * 0.28, W * 1.00], [-T * 0.44, W * 0.70],
    [-T * 1.04, 0], [-T * 0.44, -W * 0.70], [T * 0.28, -W * 1.00],
  ];
  const base = { t: at, ry: -Math.PI / 2, rx: tilt };
  m.add('woodPlank', prism(poly, 0.42), xf(base));
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length];
    m.tube('iron', [at[0] - 0.06, at[1] + a[1], at[2] + a[0]],
                   [at[0] - 0.06, at[1] + b[1], at[2] + b[0]], 0.28, 0.28, 8);
  }
  m.add('iron', lathe([[0, 0], [0.66, 0.12], [0.74, 0.46], [0.42, 0.78], [0, 0.88]], 18),
        xf({ t: [at[0] - 0.24, at[1], at[2] + 0.10], ry: -Math.PI / 2 }));
}

// Arming sword. `d` is the blade direction out of the fist.
function sword(m, hand, d) {
  const dir = norm(d);
  const guard = add(hand, dir, 0.60);
  m.tube('steel', guard, add(hand, dir, 6.0), 0.42, 0.32, 8);
  m.tube('steel', add(hand, dir, 6.0), add(hand, dir, 8.6), 0.32, 0.05, 8);
  const up = Math.abs(dir[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const cross = norm([dir[1] * up[2] - dir[2] * up[1], dir[2] * up[0] - dir[0] * up[2],
                      dir[0] * up[1] - dir[1] * up[0]]);
  m.tube('steel', add(guard, cross, -1.45), add(guard, cross, 1.45), 0.22, 0.22, 8);
  m.tube('leather', add(hand, dir, -1.10), guard, 0.26, 0.28, 8);
  m.ball('brass', add(hand, dir, -1.34), 0.42, [1, 1, 0.66]);
}

// pose: { walk, attack } -- attack 0 is the guard stance, 1 the finished cut.
export function knight(pose = {}) {
  const atk = pose.attack || 0;
  const m = new Model();
  const S = skeleton(P, {
    walk: pose.walk || 0,
    stride: pose.stride === undefined ? 0.50 : pose.stride,
    lean: 0.12 + atk * 0.34,
    twist: -0.12 + atk * 0.38,
    armL: { a0: 0.70 - atk * 0.24, a1: 1.02, roll: -0.66 },
    armR: { a0: -0.62 + atk * 2.35, a1: 0.90 - atk * 0.70, roll: 0.42 - atk * 0.20 },
  });
  body(m, P, S, M);

  // --- breastplate: ONE lathe, wide enough to be the torso outright ---
  const th = S.shC[2] - S.hipC[2];
  const tilt = Math.atan2(S.shC[0] - S.hipC[0], th);
  const R = P.torsoR;
  m.add('plate', lathe([
    [R * 0.70, -0.30], [R * 0.76, th * 0.22], [R * 0.94, th * 0.56],
    [R * 1.14, th * 0.84], [R * 1.02, th * 1.02], [R * 0.36, th * 1.12],
  ], 24), xf({ t: S.hipC, ry: tilt, s: [0.92, 1.16, 1] }));

  // --- pauldrons: flat caps ON the shoulder, not spheres beside it ---
  const lr = P.limbR;
  for (const [sh, sgn] of [[S.shL, -1], [S.shR, 1]])
    m.add('plate', lathe([[lr * 0.85, 0], [lr * 1.80, 0.38], [lr * 1.66, 0.86], [0, 1.06]], 20),
          xf({ t: [sh[0], sh[1] + sgn * 0.30, sh[2] - 0.42], rx: sgn * 0.42, s: [1, 1, 0.86] }));

  // --- knee cops: the leg needs a joint, or it reads as a length of pipe ---
  for (const [knee, sgn] of [[S.kneeL, -1], [S.kneeR, 1]])
    m.add('plate', lathe([[0, 0], [lr * 1.30, 0.30], [lr * 1.16, 0.72], [0, 0.86]], 16),
          xf({ t: [knee[0] + lr * 0.55, knee[1], knee[2]], ry: Math.PI / 2, rz: sgn * 0.1 }));

  // --- belt and tassets ---
  m.add('leather', torus(R * 0.92, 0.22, 20, 8), xf({ t: [S.hipC[0], 0, S.hipC[2] + 0.20], s: [0.94, 1.18, 1] }));
  for (const sgn of [-1, 1])
    m.add('plate', prism([[-0.85, -1.10], [0.85, -1.20], [0.70, 1.10], [-0.70, 1.10]], 0.26),
          xf({ t: [S.hipC[0] + R * 0.46, sgn * P.hipY * 1.30, S.hipC[2] - 0.80], ry: -Math.PI / 2, rx: sgn * 0.22 }));

  // --- helm: one closed shell that actually encloses the head ---
  const hd = S.head, hr = P.headR;
  m.add('steel', lathe([
    [hr * 0.58, -hr * 1.44], [hr * 1.08, -hr * 1.06], [hr * 1.22, -hr * 0.24],
    [hr * 1.20, hr * 0.48], [hr * 0.94, hr * 1.06], [hr * 0.46, hr * 1.42], [0, hr * 1.52],
  ], 24), xf({ t: hd, s: [1.0, 0.98, 1.0] }));
  // the visor: a dark slot, which reads as a helmet at 8 px where a modelled
  // face reads as a smudge
  m.add('visor', box(hr * 0.70, hr * 1.62, hr * 0.52),
        xf({ t: [hd[0] + hr * 0.92, 0, hd[2] + hr * 0.06] }));
  m.add('steel', box(hr * 0.34, hr * 0.26, hr * 1.30),
        xf({ t: [hd[0] + hr * 1.16, 0, hd[2] + hr * 0.10] }));
  m.add('steel', torus(hr * 1.22, hr * 0.11, 24, 8), xf({ t: [hd[0], hd[1], hd[2] - hr * 0.30] }));
  m.add('brass', lathe([[hr * 0.20, 0], [hr * 0.30, hr * 0.55], [0, hr * 1.15]], 14),
        xf({ t: [hd[0] - hr * 0.06, 0, hd[2] + hr * 1.44] }));

  // --- gear ---
  const fore = mid(S.elbowL, S.handL);
  shield(m, [fore[0] + 2.05, fore[1] - 0.45, fore[2] - 0.25], -0.28);
  sword(m, S.handR, atk > 0.5 ? [0.94, 0.14, -0.34] : [0.52, 0.24, 0.82]);
  return m.finalize();
}
