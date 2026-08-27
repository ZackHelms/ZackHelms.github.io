// A stylised heroic humanoid, posed by forward kinematics in the sagittal
// plane. The three units share this rig and differ only in proportions,
// materials and the gear they hang off the returned joint points.
//
// PROPORTIONS ARE HEROIC, NOT ANATOMICAL (~4.5 heads, wide shoulders, big
// hands). At the size a phone actually draws these -- roughly 60 px across --
// a correctly-proportioned figure reads as a smudge; exaggerated mass is what
// keeps a knight distinguishable from a rogue at arm's length.
import { box, sphere, cyl, lathe, prism, torus, xf, matMul, matRY, matRZ, matT } from './geom.mjs';

export function proportions(H, opt = {}) {
  // `opt` carries MULTIPLIERS of H, so it is spread first and then consumed --
  // spreading it last silently replaced every computed dimension with its own
  // raw multiplier, which builds a knight a sixth of a world unit wide.
  return {
    ...opt,
    H,
    headR:     H * (opt.headR     || 0.108),
    shoulderZ: H * (opt.shoulderZ || 0.780),
    chestZ:    H * (opt.chestZ    || 0.660),
    hipZ:      H * (opt.hipZ      || 0.480),
    shoulderY: H * (opt.shoulderY || 0.150),
    hipY:      H * (opt.hipY      || 0.082),
    upperArm:  H * (opt.upperArm  || 0.200),
    foreArm:   H * (opt.foreArm   || 0.195),
    thigh:     H * (opt.thigh     || 0.245),
    shin:      H * (opt.shin      || 0.235),
    limbR:     H * (opt.limbR     || 0.046),
    torsoR:    H * (opt.torsoR    || 0.135),
    handR:     H * (opt.handR     || 0.052),
  };
}

// Swing a two-link chain from `root`, first link at angle a0 from straight
// down, second bent by a1. Angles are in the X-Z plane: positive pitches the
// limb FORWARD (+X). `side` only carries the chain's Y offset.
// `pitch` swings the limb forward (+X) from hanging straight down; `roll`
// tilts that whole swing plane sideways, which is what splays a shield arm
// away from the ribs. Rolling the plane rather than yawing the direction
// matters: at a small pitch a yaw rotates almost nothing.
function dir(pitch, roll) {
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  return [sp, cp * Math.sin(roll), -cp * Math.cos(roll)];
}
function chain(root, len0, len1, a0, a1, roll = 0) {
  const d0 = dir(a0, roll);
  const mid = [root[0] + d0[0] * len0, root[1] + d0[1] * len0, root[2] + d0[2] * len0];
  const d1 = dir(a0 + a1, roll);
  const end = [mid[0] + d1[0] * len1, mid[1] + d1[1] * len1, mid[2] + d1[2] * len1];
  return { mid, end, d0, d1 };
}

// pose: { walk (cycle phase 0..1), lean, armL/armR: {a0,a1,yaw} overrides,
//         crouch, twist }
export function skeleton(P, pose = {}) {
  const ph = (pose.walk || 0) * Math.PI * 2;
  const stride = pose.stride === undefined ? 0.62 : pose.stride;
  const crouch = pose.crouch || 0;
  const lean = pose.lean || 0;
  const bob = Math.abs(Math.cos(ph)) * P.H * 0.018 * (stride > 0 ? 1 : 0);
  const hipZ = P.hipZ - crouch * P.H * 0.09 - bob;
  const shZ = P.shoulderZ - crouch * P.H * 0.10 - bob;
  const twist = pose.twist || 0;

  const hipC = [lean * P.H * 0.06, 0, hipZ];
  const shC = [lean * P.H * 0.16, 0, shZ];
  const hipL = [hipC[0], -P.hipY, hipC[2]], hipR = [hipC[0], P.hipY, hipC[2]];
  const shL = [shC[0] + Math.sin(-twist) * P.shoulderY, -P.shoulderY * Math.cos(twist), shC[2]];
  const shR = [shC[0] + Math.sin(twist) * P.shoulderY, P.shoulderY * Math.cos(twist), shC[2]];

  // legs: a straight-legged forward swing, a bent-knee recovery behind
  const swL = Math.sin(ph) * stride, swR = Math.sin(ph + Math.PI) * stride;
  const kneeBend = s => Math.max(0, -s) * 1.35 + 0.10;
  const legL = chain(hipL, P.thigh, P.shin, swL * 0.85 - crouch * 0.55, kneeBend(swL) + crouch * 1.1);
  const legR = chain(hipR, P.thigh, P.shin, swR * 0.85 - crouch * 0.55, kneeBend(swR) + crouch * 1.1);

  // arms counter-swing unless the character file overrides one
  const dfl = { a0: -swL * 0.60, a1: 0.38, roll: -0.24 };
  const dfr = { a0: -swR * 0.60, a1: 0.38, roll: 0.24 };
  const aL = { ...dfl, ...(pose.armL || {}) };
  const aR = { ...dfr, ...(pose.armR || {}) };
  const armL = chain(shL, P.upperArm, P.foreArm, aL.a0, aL.a1, aL.roll);
  const armR = chain(shR, P.upperArm, P.foreArm, aR.a0, aR.a1, aR.roll);

  const headZ = shZ + P.headR * 1.42;
  const S = {
    hipC, shC, hipL, hipR, shL, shR,
    kneeL: legL.mid, footL: legL.end, kneeR: legR.mid, footR: legR.end,
    elbowL: armL.mid, handL: armL.end, elbowR: armR.mid, handR: armR.end,
    armLDir: aL, armRDir: aR, foreL: armL.d1, foreR: armR.d1,
    head: [shC[0] + lean * P.H * 0.03, 0, headZ], headZ,
  };
  // PLANT THE FIGURE. Every frame is lifted so its lowest foot sits exactly on
  // z = 0, which is the sprite's pivot. Without this a walk cycle makes the
  // character sink and rise through the dirt instead of striding over it.
  const drop = -Math.min(S.footL[2], S.footR[2]);
  if (drop) for (const k of ['hipC','shC','hipL','hipR','shL','shR','kneeL','footL','kneeR','footR','elbowL','handL','elbowR','handR','head'])
    S[k] = [S[k][0], S[k][1], S[k][2] + drop];
  S.headZ += drop;
  return S;
}

// Build the body itself. Gear is the caller's job -- it gets `S` back.
export function body(m, P, S, M) {
  const limb = P.limbR;
  // legs
  for (const [hip, knee, foot] of [[S.hipL, S.kneeL, S.footL], [S.hipR, S.kneeR, S.footR]]) {
    m.tube(M.leg, hip, knee, limb * 1.16, limb * 0.94, 12);
    m.tube(M.leg, knee, foot, limb * 0.94, limb * 0.74, 12);
    m.ball(M.leg, knee, limb * 0.92);
    // boot: extruded straight up from a foot outline in the ground plane, so
    // the toe points along +X with no transform to get wrong
    const bh = limb * 1.25;
    m.add(M.boot, prism([[-limb * 1.15, -limb * 0.86], [limb * 2.30, -limb * 0.70],
                         [limb * 2.30, limb * 0.70], [-limb * 1.15, limb * 0.86]], bh),
          xf({ t: [foot[0], foot[1], foot[2] + bh * 0.5] }));
  }
  // pelvis + torso: a lathe swept between hip and shoulder gives a chest that
  // tapers instead of a box that reads as a crate.
  // A character whose armour supplies its own torso or head passes null for
  // that slot -- layering a breastplate over a body torso over a chest
  // ellipsoid is what turns a figure into a heap of overlapping blobs.
  const th = S.shC[2] - S.hipC[2];
  if (M.torso !== null) {
  const prof = [
    [P.torsoR * 0.80, 0],
    [P.torsoR * 0.86, th * 0.16],
    [P.torsoR * 0.74, th * 0.42],
    [P.torsoR * 0.98, th * 0.74],
    [P.torsoR * 0.94, th * 0.96],
    [0, th * 1.02],
  ];
  const tilt = Math.atan2(S.shC[0] - S.hipC[0], th);
  m.add(M.torso, lathe(prof, 22),
        xf({ t: S.hipC, ry: tilt, s: [1, 1.06, 1] }));
  m.add(M.torso, sphere(P.torsoR * 0.74, 20, 12),
        xf({ t: [S.hipC[0], 0, S.hipC[2] + th * 0.06], s: [0.88, 1.12, 0.46] }));
  }
  // arms
  for (const [sh, el, hd] of [[S.shL, S.elbowL, S.handL], [S.shR, S.elbowR, S.handR]]) {
    m.tube(M.arm, sh, el, limb * 1.02, limb * 0.86, 12);
    m.tube(M.arm, el, hd, limb * 0.86, limb * 0.70, 12);
    m.ball(M.arm, el, limb * 0.82);
    m.ball(M.hand, hd, P.handR, [1.15, 0.80, 0.95]);
  }
  head(m, P, S, M);
  return S;
}

export function head(m, P, S, M) {
  if (M.skin === null) return;
  m.tube(M.skin, [S.shC[0], 0, S.shC[2] - P.headR * 0.1], S.head, P.headR * 0.44, P.headR * 0.40, 10);
  m.add(M.skin, sphere(P.headR, 22, 14), xf({ t: S.head, s: [1.02, 0.92, 1.06] }));
  // brow ridge and jaw, so the head is not a bare ball at 60 px
  m.add(M.skin, sphere(P.headR * 0.55, 14, 10),
        xf({ t: [S.head[0] + P.headR * 0.55, 0, S.head[2] - P.headR * 0.42], s: [1.0, 0.9, 0.7] }));
}

export { chain };
