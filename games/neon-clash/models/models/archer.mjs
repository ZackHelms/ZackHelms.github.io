// ARCHER -- "green hat and bow with arrows". A light woodland skirmisher: a
// peaked green hat with a feather, green tunic over leather, a longbow held
// across the body and a quiver of arrows on the back.
//
// The bow is the whole identity here. It is the one shape nothing else in the
// deck has, so it is built big -- taller than the archer's own torso -- and
// carried out to the side where it cannot be swallowed by the silhouette.
import { Model, box, sphere, cyl, lathe, prism, torus, xf } from '../lib/geom.mjs';
import { proportions, skeleton, body } from '../lib/humanoid.mjs';

export const HEIGHT = 12.6;
const P = proportions(HEIGHT, {
  headR: 0.072, shoulderY: 0.118, hipY: 0.066, torsoR: 0.088,
  hipZ: 0.470, shoulderZ: 0.800,
  limbR: 0.038, handR: 0.040, upperArm: 0.205, foreArm: 0.200,
});
const M = { leg: 'clothTan', boot: 'leather', torso: 'hatGreen', arm: 'clothTan', hand: 'leather', skin: 'skin' };

const norm = v => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

// A recurve longbow, swept as an arc of tubes in the plane spanned by `up` and
// `out`, with the string closing the chord.
function bow(m, at, up, out, R, half, draw) {
  const pts = [];
  const N = 9;
  for (let k = 0; k <= N; k++) {
    const a = (k / N * 2 - 1) * half;
    const r = R * (1 - 0.14 * Math.cos(a * 1.6));
    pts.push([at[0] + up[0] * Math.sin(a) * r + out[0] * (Math.cos(a) - 1) * r,
              at[1] + up[1] * Math.sin(a) * r + out[1] * (Math.cos(a) - 1) * r,
              at[2] + up[2] * Math.sin(a) * r + out[2] * (Math.cos(a) - 1) * r]);
  }
  for (let k = 0; k < N; k++) {
    const t = Math.abs(k / N * 2 - 1);
    m.tube('woodHaft', pts[k], pts[k + 1], 0.24 - t * 0.10, 0.24 - Math.abs((k + 1) / N * 2 - 1) * 0.10, 8);
  }
  m.add('leather', cyl(0.30, 0.30, 1.0, 10), xf({ t: add(pts[Math.floor(N / 2)], up, -0.5), rx: Math.PI / 2 }));
  // string: two segments meeting at the nock, pulled back by `draw`
  const a0 = pts[0], a1 = pts[N];
  const nock = add([(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2, (a0[2] + a1[2]) / 2], out, -draw);
  m.tube('clothTan', a0, nock, 0.07, 0.07, 6);
  m.tube('clothTan', nock, a1, 0.07, 0.07, 6);
  return nock;
}

function arrow(m, from, dir, len) {
  const d = norm(dir);
  m.tube('woodHaft', from, add(from, d, len), 0.075, 0.075, 6);
  m.add('steel', cyl(0.20, 0, 0.55, 8),
        xf({ t: add(from, d, len), ry: Math.acos(Math.max(-1, Math.min(1, d[2]))), rz: Math.atan2(d[1], d[0]) }));
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * Math.PI * 2;
    m.add('feather', prism([[0, 0], [0.66, 0.16], [0.62, 0.30], [0, 0.22]], 0.04),
          xf({ t: add(from, d, 0.30), rz: a, ry: -Math.acos(Math.max(-1, Math.min(1, d[2]))) + Math.PI / 2 }));
  }
}

// pose: { walk, attack } -- attack 1 is the loose, with the string at full draw.
export function archer(pose = {}) {
  const atk = pose.attack || 0;
  const m = new Model();
  const S = skeleton(P, {
    walk: pose.walk || 0,
    stride: pose.stride === undefined ? 0.62 : pose.stride,
    lean: 0.06 + atk * 0.10,
    twist: 0.16 + atk * 0.22,
    // bow arm out and forward; string arm drawn back to the cheek on the loose
    armL: { a0: 1.42, a1: 0.10, roll: -0.30 },
    armR: { a0: 0.30 + atk * 0.62, a1: 1.35 - atk * 0.25, roll: 0.34 },
  });
  body(m, P, S, M);

  const hd = S.head, hr = P.headR;
  // --- the hat: a soft peaked cap with a rolled brim and a feather ---
  m.add('hatGreen', lathe([
    [hr * 1.10, -hr * 0.62], [hr * 1.44, -hr * 0.20], [hr * 1.30, hr * 0.46],
    [hr * 0.88, hr * 1.16], [hr * 0.44, hr * 1.86], [0, hr * 2.26],
  ], 20), xf({ t: [hd[0] - hr * 0.10, 0, hd[2]], ry: 0.16 }));
  m.add('hatGreen', torus(hr * 1.42, hr * 0.24, 20, 8), xf({ t: [hd[0] - hr * 0.10, 0, hd[2] - hr * 0.18] }));
  m.add('feather', prism([[0, 0], [2.10, 0.30], [2.30, 0.72], [0, 0.42]], 0.05),
        xf({ t: [hd[0] - hr * 1.00, 0, hd[2] + hr * 1.20], rz: 0.30, ry: -0.55 }));

  // --- tunic over the base torso, and a belt ---
  const th = S.shC[2] - S.hipC[2];
  m.add('hatGreen', lathe([
    [P.torsoR * 0.96, -th * 0.30], [P.torsoR * 1.06, th * 0.10],
    [P.torsoR * 0.90, th * 0.60], [P.torsoR * 0.96, th * 0.88], [P.torsoR * 0.30, th * 1.04],
  ], 20), xf({ t: S.hipC, s: [0.94, 1.10, 1] }));
  m.add('leather', torus(P.torsoR * 1.00, 0.16, 18, 8), xf({ t: [S.hipC[0], 0, S.hipC[2] + 0.10], s: [0.96, 1.12, 1] }));

  // --- quiver on the back, arrows showing ---
  const qz = S.shC[2] - 1.0, qx = S.shC[0] - P.torsoR * 1.05;
  m.add('leather', cyl(0.52, 0.44, 3.4, 14), xf({ t: [qx, P.shoulderY * 0.55, qz - 1.6], rx: -0.30, ry: 0.42 }));
  for (let k = 0; k < 4; k++) {
    const o = (k - 1.5) * 0.22;
    m.tube('woodHaft', [qx - 0.3 + o * 0.2, P.shoulderY * 0.55 + o, qz + 0.6],
                       [qx - 0.9 + o * 0.3, P.shoulderY * 0.55 + o * 1.3, qz + 2.1], 0.07, 0.07, 6);
    m.add('feather', prism([[0, 0], [0.50, 0.14], [0.46, 0.26], [0, 0.20]], 0.04),
          xf({ t: [qx - 0.9 + o * 0.3, P.shoulderY * 0.55 + o * 1.3, qz + 2.0], rz: k * 1.1, ry: -0.5 }));
  }

  // --- the bow, in the left fist, string toward the archer ---
  const grip = S.handL;
  const up = norm([0.16, 0, 1]), out = norm([0.56, -0.83, 0]);
  const nock = bow(m, grip, up, out, 4.2, 1.15, 0.35 + atk * 1.45);
  arrow(m, add(nock, out, -0.15), [0.94, -0.05, 0.34], 5.0 - atk * 1.2);
  return m.finalize();
}
