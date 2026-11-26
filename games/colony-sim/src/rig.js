// rig.js — the settlers' bodies. The skeleton, two-bone IK and buildPose() are copied from
// Animation Rigs (games/animation-rigs, the A002 form: soft IK and sagittal poles); feet are
// planted on the island's heightfield. Pure presentation: it reads a settler and never writes one.
import { heightAt } from './island.js';

const V = (x, y, z) => ({ x, y, z });
const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z), sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a, k) => V(a.x * k, a.y * k, a.z * k), madd = (a, b, k) => V(a.x + b.x * k, a.y + b.y * k, a.z + b.z * k);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const vlen = (a) => Math.hypot(a.x, a.y, a.z), norm = (a) => { const l = vlen(a) || 1; return V(a.x / l, a.y / l, a.z / l); };
const lerp = (a, b, t) => a + (b - a) * t, lerpV = (a, b, t) => V(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const frac = (x) => x - Math.floor(x);
const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const UP = V(0, 1, 0);

// Two-bone IK (Animation Rigs): returns [middle joint, end joint]; the end is pulled back
// onto the reachable shell when the target is out of range, so bone lengths stay exact.
export function ik2(root, target, a, b, pole, soft) {
  const d = sub(target, root); let dist = vlen(d);
  const dir = dist > 1e-6 ? mul(d, 1 / dist) : V(0, -1, 0);
  if (soft) { const ds = a + b - soft; if (dist > ds) dist = ds + soft * (1 - Math.exp(-(dist - ds) / soft)); }
  dist = clamp(dist, Math.abs(a - b) + 1e-3, a + b - 1e-4);
  const ca = (a * a + dist * dist - b * b) / (2 * a * dist);
  const along = a * ca, h = Math.sqrt(Math.max(0, a * a - along * along));
  let pd = sub(pole, mul(dir, dot(pole, dir)));
  if (vlen(pd) < 1e-5) pd = Math.abs(dir.y) < 0.9 ? cross(dir, UP) : V(1, 0, 0);
  pd = norm(pd);
  return [add(madd(root, dir, along), mul(pd, h)), madd(root, dir, dist)];
}

// Builds the 21 joints (+ a nose point) from a parameter block P (Animation Rigs' buildPose).
export function buildPose(s, P) {
  const f = P.f, u = P.u, r = norm(cross(f, u));
  const lean = P.lean || 0, cl = lean * 1.25 + (P.chestLean || 0);
  let sd = norm(add(mul(u, Math.cos(lean)), mul(f, Math.sin(lean))));
  let cd = norm(add(mul(u, Math.cos(cl)), mul(f, Math.sin(cl))));
  if (P.sideLean) { sd = norm(madd(sd, r, Math.sin(P.sideLean))); cd = norm(madd(cd, r, Math.sin(P.sideLean * 1.4))); }
  const pel = P.pelvis;
  const spine = madd(pel, sd, 0.2 * s), chest = madd(spine, cd, 0.26 * s), neck = madd(chest, cd, 0.1 * s);
  const fp = norm(cross(cd, r));
  const hp = P.headPitch || 0;
  const hd = norm(add(mul(cd, Math.cos(hp)), mul(fp, Math.sin(hp))));
  const head = madd(neck, hd, 0.13 * s);
  const hy = P.headYaw || 0, nf = norm(cross(hd, r));
  const nose = madd(head, norm(add(mul(nf, Math.cos(hy)), mul(r, Math.sin(hy)))), 0.17 * s);
  const tw = P.twist || 0;
  const rs = add(mul(r, Math.cos(tw)), mul(fp, Math.sin(tw)));
  const shY = -0.035 * s + (P.breath || 0);
  const shL = madd(madd(chest, rs, -0.18 * s), cd, shY), shR = madd(madd(chest, rs, 0.18 * s), cd, shY);
  const fpp = norm(cross(sd, r)); let rp = add(mul(r, Math.cos(-tw * 0.5)), mul(fpp, Math.sin(-tw * 0.5)));
  if (P.roll) rp = norm(add(mul(rp, Math.cos(P.roll)), mul(u, -Math.sin(P.roll))));
  const hipL = madd(madd(pel, rp, -0.1 * s), sd, -0.04 * s), hipR = madd(madd(pel, rp, 0.1 * s), sd, -0.04 * s);
  const kp = P.kneePole || f;
  const sk = P.softIK ? 0.025 * s : 0;
  const sag = (a, b, sg, out) => madd(norm(cross(r, norm(sub(b, a)))), r, sg * out);
  const [knL, anL] = ik2(hipL, P.ankL, 0.45 * s, 0.44 * s, P.sagPoles ? sag(hipL, P.ankL, -1, 0.12) : madd(kp, r, -0.12), sk);
  const [knR, anR] = ik2(hipR, P.ankR, 0.45 * s, 0.44 * s, P.sagPoles ? sag(hipR, P.ankR, 1, 0.12) : madd(kp, r, 0.12), sk);
  const defToe = norm(add(mul(f, 0.9), mul(u, -0.45)));
  const toeL = madd(anL, P.toeL ? norm(sub(P.toeL, anL)) : defToe, 0.15 * s);
  const toeR = madd(anR, P.toeR ? norm(sub(P.toeR, anR)) : defToe, 0.15 * s);
  const ep = P.elbowPole || add(mul(f, -1), mul(u, -0.3));
  const arm = (sh, sg, A, grip, w) => {
    A = A || { sw: 0, reach: 0.52 * s, out: 0.06 * s };
    const rest = madd(add(sh, mul(add(mul(u, -Math.cos(A.sw)), mul(f, Math.sin(A.sw))), A.reach)), r, sg * A.out);
    const tgt = grip ? lerpV(rest, grip, w == null ? 1 : w) : rest;
    const pole = P.sagPoles ? madd(mul(norm(cross(r, norm(sub(tgt, sh)))), -1), r, sg * 0.5) : madd(ep, r, sg * 0.5);
    const [el, wr] = ik2(sh, tgt, 0.29 * s, 0.26 * s, pole, P.softIK ? 0.035 * s : 0);
    return [el, wr, madd(wr, norm(sub(wr, el)), 0.08 * s)];
  };
  const [elL, wrL, haL] = arm(shL, -1, P.armL, P.gripL, P.wL);
  const [elR, wrR, haR] = arm(shR, 1, P.armR, P.gripR, P.wR);
  return [pel, spine, chest, neck, head, shL, elL, wrL, haL, shR, elR, wrR, haR, hipL, knL, anL, toeL, hipR, knR, anR, toeR, nose];
}

/* ------------------------------ the rig ------------------------------ */
const CROUCH = { pick: 0.36, forage: 0.4, trap: 0.42, drop: 0.3, squat: 0.5, cook: 0.42 };
const SIT = new Set(['eat', 'sit']);
const LIE = new Set(['sleep', 'collapsed']);

export function makeRig(st, isl) {
  const s = st.look.height || 1;
  const rig = { s, x: st.x, z: st.z, yaw: st.yaw, py: null, phase: 0, steps: 0, feet: [null, null], J: null, act: null, snap: null, blendT: 1, t: 0, runAmt: 0, seed: (st.look.shirt || '').length };
  plantFeet(rig, isl);
  rig.J = pose(rig, st, isl, 0);
  return rig;
}
function restFoot(rig, i) {
  const fw = V(Math.cos(rig.yaw), 0, Math.sin(rig.yaw)), rt = V(-Math.sin(rig.yaw), 0, Math.cos(rig.yaw)), sg = i ? 1 : -1;
  return V(rig.x + rt.x * sg * 0.11 * rig.s, 0, rig.z + rt.z * sg * 0.11 * rig.s);
}
function plantFeet(rig, isl) {
  for (let i = 0; i < 2; i++) { const p = restFoot(rig, i); p.y = heightAt(isl, p.x, p.z); rig.feet[i] = { plant: p, sw: false, t: 0, from: null }; }
}

export function updateRig(rig, st, dt, isl) {
  dt = clamp(dt || 0, 0, 0.1);
  rig.t += dt;
  const jump = Math.hypot(st.x - rig.x, st.z - rig.z);
  rig.x = st.x; rig.z = st.z;
  // turn toward the settler's heading at a human rate (a teleport resets everything)
  if (jump > 6) { rig.yaw = st.yaw; plantFeet(rig, isl); rig.py = null; }
  else { const dy = wrapA(st.yaw - rig.yaw), mx = 7 * dt; rig.yaw += clamp(dy, -mx, mx); }
  const act = moving(st) ? (st.speed > 2.6 ? 'run' : 'walk') : (st.act === 'walk' || st.act === 'run' ? 'idle' : st.act || 'idle');
  const group = LIE.has(act) ? 'lie' : SIT.has(act) ? 'sit' : act;
  if (rig.act !== null && group !== rig.group) { rig.snap = rig.J.map((p) => V(p.x, p.y, p.z)); rig.blendT = 0; }
  rig.act = act; rig.group = group;
  const J = pose(rig, st, isl, dt);
  if (rig.blendT < 1 && rig.snap) { rig.blendT = Math.min(1, rig.blendT + dt / 0.35); const k = smooth(rig.blendT); rig.J = J.map((p, i) => lerpV(rig.snap[i], p, k)); }
  else rig.J = J;
}
const moving = (st) => st.speed > 0.15;

function pose(rig, st, isl, dt) {
  const s = rig.s, yaw = rig.yaw, t = rig.t;
  const fw = V(Math.cos(yaw), 0, Math.sin(yaw)), rt = V(-Math.sin(yaw), 0, Math.cos(yaw));
  const g0 = heightAt(isl, rig.x, rig.z);
  const act = rig.act;
  const P = { f: fw, u: UP, softIK: true, sagPoles: true, breath: Math.sin(t * 1.6) * 0.004 * s };
  const standY = g0 + 0.93 * s;

  if (LIE.has(act)) {
    // lying on the back, head toward the heading
    const pel = V(rig.x, g0 + 0.13 * s, rig.z);
    P.u = fw; P.f = UP; P.pelvis = pel; P.lean = 0; P.breath = Math.sin(t * (act === 'sleep' ? 1.1 : 2.2)) * 0.006 * s;
    for (let i = 0; i < 2; i++) {
      const sg = i ? 1 : -1, a = madd(madd(pel, fw, -0.84 * s), rt, sg * 0.13 * s);
      a.y = heightAt(isl, a.x, a.z) + 0.08 * s;
      P[i ? 'ankR' : 'ankL'] = a; P[i ? 'toeR' : 'toeL'] = madd(a, UP, 0.2);
      rig.feet[i].plant = V(a.x, a.y - 0.08 * s, a.z); rig.feet[i].sw = false;
    }
    P.armL = { sw: 0.05, reach: 0.52 * s, out: 0.1 * s }; P.armR = { sw: 0.05, reach: 0.52 * s, out: 0.1 * s };
    P.headPitch = act === 'collapsed' ? 0.5 : 0.1; P.headYaw = act === 'collapsed' ? 0.6 : 0;
    rig.py = pel.y;
    return buildPose(s, P);
  }

  if (act === 'walk' || act === 'run') { loco(rig, st, isl, dt, P, fw, rt); }
  else {
    // standing still: settle any foot that is out of place, one at a time
    settle(rig, isl, dt, fw, rt);
    for (let i = 0; i < 2; i++) { const f = rig.feet[i]; P[i ? 'ankR' : 'ankL'] = f.ank || V(f.plant.x, f.plant.y + 0.08 * s, f.plant.z); P[i ? 'toeR' : 'toeL'] = madd(V(f.plant.x, f.plant.y + 0.015, f.plant.z), fw, 0.13 * s); }
    let py = standY - 0.01 * s + Math.sin(t * 1.6) * 0.004 * s;
    if (CROUCH[act]) py -= CROUCH[act] * s;
    if (SIT.has(act)) py = g0 + 0.47 * s;
    rig.py = rig.py == null ? py : lerp(rig.py, py, 1 - Math.exp(-dt / 0.12));
    P.pelvis = V(rig.x, rig.py, rig.z);
    P.armL = { sw: 0.06, reach: 0.52 * s, out: 0.07 * s }; P.armR = { sw: 0.06, reach: 0.52 * s, out: 0.07 * s };
    workPose(rig, st, isl, P, fw, rt, g0);
  }
  return buildPose(s, P);
}

function workPose(rig, st, isl, P, fw, rt, g0) {
  const s = rig.s, t = rig.t, act = rig.act, pel = P.pelvis;
  const sh = madd(pel, UP, 0.5 * s);
  const front = (d, h, side = 0) => V(rig.x + fw.x * d * s + rt.x * side * s, g0 + h * s, rig.z + fw.z * d * s + rt.z * side * s);
  switch (act) {
    case 'chop': case 'mine': {
      const ph = frac(t / 1.35 + rig.seed * 0.07);
      const up = ph < 0.6 ? smooth(ph / 0.6) : ph < 0.72 ? 1 - smooth((ph - 0.6) / 0.12) : 0;
      const hi = V(rig.x + rt.x * 0.12 * s - fw.x * 0.05 * s, g0 + 1.75 * s, rig.z + rt.z * 0.12 * s - fw.z * 0.05 * s);
      const lo = front(act === 'chop' ? 0.62 : 0.55, act === 'chop' ? 0.85 : 0.35, 0.05);
      const g = lerpV(lo, hi, up);
      P.gripR = g; P.gripL = madd(g, norm(sub(lo, hi)), -0.14 * s); P.wL = 1; P.wR = 1;
      P.lean = lerp(act === 'chop' ? 0.25 : 0.5, -0.05, up); P.twist = lerp(0.1, -0.25, up);
      if (act === 'mine') P.pelvis = V(pel.x, pel.y - 0.1 * s * (1 - up), pel.z);
      break;
    }
    case 'build': {
      const ph = frac(t / 0.75), k = ph < 0.55 ? smooth(ph / 0.55) : 1 - smooth((ph - 0.55) / 0.2);
      P.gripR = front(0.42, 1.0 + 0.28 * k, 0.1); P.gripL = front(0.42, 0.95, -0.12); P.wL = 1; P.wR = 1; P.lean = 0.2;
      break;
    }
    case 'maintain': {
      const k = Math.sin(t * 4);
      P.gripR = front(0.4 + 0.08 * k, 0.98, 0.08); P.gripL = front(0.38, 0.97, -0.1); P.wL = 1; P.wR = 1; P.lean = 0.25; P.headPitch = 0.4;
      break;
    }
    case 'pick': case 'forage': case 'trap': case 'drop': case 'cook': {
      const k = Math.sin(t * (act === 'cook' ? 2.4 : 3.4));
      P.gripR = front(0.5 + 0.05 * k, act === 'cook' ? 0.42 : 0.12 + 0.06 * Math.max(0, k), 0.12); P.gripL = front(0.48, act === 'cook' ? 0.4 : 0.14, -0.14);
      P.wL = 0.9; P.wR = 1; P.lean = 0.55; P.kneePole = norm(add(fw, mul(UP, 0.3))); P.headPitch = 0.3;
      break;
    }
    case 'squat': P.lean = 0.3; P.kneePole = fw; P.armL = { sw: 0.4, reach: 0.5 * s, out: 0.1 * s }; P.armR = { sw: 0.4, reach: 0.5 * s, out: 0.1 * s }; break;
    case 'eat': case 'sit': {
      for (let i = 0; i < 2; i++) { const a = front(0.42, 0.08, i ? 0.13 : -0.13); a.y = heightAt(isl, a.x, a.z) + 0.08 * s; P[i ? 'ankR' : 'ankL'] = a; P[i ? 'toeR' : 'toeL'] = madd(a, fw, 0.2); }
      P.kneePole = norm(add(fw, UP)); P.lean = 0.08;
      const knees = front(0.38, 0.55);
      if (act === 'eat') { const k = 0.5 + 0.5 * Math.sin(t * 1.4); P.gripR = lerpV(knees, madd(madd(sh, fw, 0.16 * s), UP, 0.18 * s), smooth(k)); P.gripL = front(0.3, 0.62, -0.08); P.wL = 1; P.wR = 1; }
      else { P.gripR = front(0.36, 0.6, 0.12); P.gripL = front(0.36, 0.6, -0.12); P.wL = 1; P.wR = 1; }
      break;
    }
    case 'talk': {
      const k = Math.sin(t * 2.1);
      P.gripR = front(0.32, 1.05 + 0.08 * k, 0.22); P.wR = 0.7 + 0.3 * Math.sin(t * 0.7); P.headYaw = 0.15 * Math.sin(t * 0.5);
      break;
    }
    case 'bathe': {
      P.pelvis = V(pel.x, pel.y - 0.12 * s, pel.z);
      const k = Math.sin(t * 3);
      P.gripR = madd(madd(sh, fw, 0.12 * s), rt, (-0.12 + 0.06 * k) * s); P.gripL = madd(madd(sh, fw, 0.1 * s), rt, (0.14 - 0.05 * k) * s); P.wL = 1; P.wR = 1;
      break;
    }
    case 'fish': {
      const ph = frac(t / 4), k = ph > 0.8 ? smooth((ph - 0.8) / 0.1) * (1 - smooth((ph - 0.9) / 0.1)) : 0;
      P.gripR = lerpV(front(0.15, 1.75, 0.18), front(0.7, 1.0, 0.1), k); P.gripL = front(0.4, 1.2, -0.05); P.wL = 0.8; P.wR = 1; P.lean = 0.15 + 0.3 * k; P.headPitch = 0.35;
      break;
    }
    case 'look': {
      P.gripR = madd(madd(sh, UP, 0.24 * s), fw, 0.2 * s); P.wR = 1; P.headYaw = 0.6 * Math.sin(t * 0.6); P.headPitch = -0.1;
      break;
    }
    default: {
      const k = Math.sin(t * 0.35 + rig.seed);
      P.sideLean = 0.02 * k;
    }
  }
  if (st.carry) carryArms(rig, P, fw, rt);
}
function carryArms(rig, P, fw, rt) {
  const s = rig.s, c = madd(madd(P.pelvis, UP, 0.28 * s), fw, 0.3 * s);
  P.gripL = madd(c, rt, -0.16 * s); P.gripR = madd(c, rt, 0.16 * s); P.wL = 1; P.wR = 1;
}

function settle(rig, isl, dt, fw, rt) {
  const s = rig.s;
  let swinging = rig.feet.findIndex((f) => f.sw);
  if (swinging < 0) {
    for (let i = 0; i < 2; i++) {
      const r = restFoot(rig, i), f = rig.feet[i];
      if (Math.hypot(f.plant.x - r.x, f.plant.z - r.z) > 0.16 * s) { f.sw = true; f.t = 0; f.from = f.plant; swinging = i; break; }
    }
  }
  for (let i = 0; i < 2; i++) {
    const f = rig.feet[i];
    f.plant.y = heightAt(isl, f.plant.x, f.plant.z);
    if (!f.sw) { f.ank = V(f.plant.x, f.plant.y + 0.08 * s, f.plant.z); continue; }
    f.t += dt * 2.6;
    const r = restFoot(rig, i); r.y = heightAt(isl, r.x, r.z);
    const e = smooth(f.t);
    f.ank = V(lerp(f.from.x, r.x, e), lerp(f.from.y, r.y, e) + 0.08 * s + Math.sin(Math.PI * clamp(f.t, 0, 1)) * 0.07 * s, lerp(f.from.z, r.z, e));
    if (f.t >= 1) { f.sw = false; f.plant = r; f.ank = V(r.x, r.y + 0.08 * s, r.z); rig.steps++; }
  }
}

function loco(rig, st, isl, dt, P, fw, rt) {
  const s = rig.s, spd = st.speed, t = rig.t;
  rig.runAmt = lerp(rig.runAmt, spd > 2.6 ? 1 : 0, 1 - Math.exp(-dt / 0.3));
  const ra = rig.runAmt;
  const stride = lerp(1.45, 2.6, ra) * s;               // metres per full cycle (two steps)
  const skate = spd > 6;                                  // fast-forward: no planting, just a cycle
  const cad = skate ? 1.6 : clamp(spd / stride, 0.55, 1.7);
  const sf = lerp(0.4, 0.62, ra);
  const cycT = 1 / cad;
  const ph0 = rig.phase; rig.phase = frac(rig.phase + cad * dt);
  let ground = 0, nG = 0, maxPel = 1e9;
  for (let i = 0; i < 2; i++) {
    const f = rig.feet[i], sg = i ? 1 : -1, lp0 = frac(ph0 + i * 0.5), lp = frac(rig.phase + i * 0.5);
    const side = V(rt.x * sg * 0.1 * s, 0, rt.z * sg * 0.1 * s);
    if (skate) {
      const k = Math.sin(lp * Math.PI * 2);
      const a = V(rig.x + fw.x * k * 0.35 * s + side.x, 0, rig.z + fw.z * k * 0.35 * s + side.z);
      a.y = heightAt(isl, a.x, a.z) + 0.08 * s + Math.max(0, -Math.cos(lp * Math.PI * 2)) * 0.12 * s;
      f.plant = V(a.x, a.y - 0.08 * s, a.z); f.sw = false; f.ank = a;
      P[i ? 'ankR' : 'ankL'] = a; continue;
    }
    if (!f.sw && lp < lp0 && lp0 > 0.6) { f.sw = true; f.t = 0; f.from = V(f.plant.x, f.plant.y, f.plant.z); rig.steps++; }
    if (f.sw) {
      f.t = clamp(lp / sf, 0, 1);
      const lead = spd * cycT * (sf * (1 - f.t) + (1 - sf) / 2);
      const tx = rig.x + fw.x * lead + side.x, tz = rig.z + fw.z * lead + side.z;
      if (!f.to || f.t < 0.85) f.to = V(tx, heightAt(isl, tx, tz), tz);
      const e = smooth(f.t);
      const a = V(lerp(f.from.x, f.to.x, e), lerp(f.from.y, f.to.y, e) + 0.08 * s + Math.sin(Math.PI * f.t) * lerp(0.11, 0.2, ra) * s, lerp(f.from.z, f.to.z, e));
      P[i ? 'ankR' : 'ankL'] = a;
      P[i ? 'toeR' : 'toeL'] = madd(a, norm(add(fw, mul(UP, lerp(-0.6, 0.35, f.t)))), 0.15 * s);
      f.ank = a;
      if (lp >= sf || f.t >= 1) { f.sw = false; f.plant = V(f.to.x, heightAt(isl, f.to.x, f.to.z), f.to.z); f.to = null; }
    }
    if (!f.sw) {
      f.plant.y = heightAt(isl, f.plant.x, f.plant.z);
      const sp = clamp((lp - sf) / (1 - sf), 0, 1), heel = smooth((sp - 0.62) / 0.38) * 0.09 * s;
      const a = V(f.plant.x + fw.x * heel * 0.4, f.plant.y + 0.08 * s + heel, f.plant.z + fw.z * heel * 0.4);
      P[i ? 'ankR' : 'ankL'] = a; f.ank = a;
      P[i ? 'toeR' : 'toeL'] = V(f.plant.x + fw.x * 0.13 * s, f.plant.y + 0.015, f.plant.z + fw.z * 0.13 * s);
      ground += f.plant.y; nG++;
      const hip = V(rig.x + side.x, 0, rig.z + side.z), hz = Math.hypot(a.x - hip.x, a.z - hip.z), L = 0.89 * s * 0.985;
      maxPel = Math.min(maxPel, a.y + Math.sqrt(Math.max(0, L * L - hz * hz)) + 0.04 * s);
    }
  }
  const g0 = heightAt(isl, rig.x, rig.z);
  const bob = (ra > 0.5 ? -1 : 1) * Math.cos(rig.phase * Math.PI * 4) * lerp(0.018, 0.03, ra) * s;
  let py = (nG ? Math.min(g0, ground / nG + 0.05) : g0) + lerp(0.92, 0.88, ra) * s + bob;
  if (!skate) py = Math.min(py, maxPel);
  rig.py = rig.py == null ? py : lerp(rig.py, py, 1 - Math.exp(-dt / 0.06));
  if (!skate) rig.py = Math.min(rig.py, maxPel);
  P.pelvis = V(rig.x, rig.py, rig.z);
  const slope = (heightAt(isl, rig.x + fw.x, rig.z + fw.z) - heightAt(isl, rig.x - fw.x, rig.z - fw.z)) / 2;
  P.lean = lerp(0.04, 0.16, ra) + clamp(slope, -0.3, 0.5) * 0.5;
  const swing = Math.sin(rig.phase * Math.PI * 2) * lerp(0.35, 0.8, ra);
  P.armL = { sw: swing, reach: lerp(0.52, 0.42, ra) * s, out: 0.07 * s }; P.armR = { sw: -swing, reach: lerp(0.52, 0.42, ra) * s, out: 0.07 * s };
  if (ra > 0.3) { P.elbowPole = add(mul(fw, -1), mul(UP, -0.6)); }
  P.twist = Math.sin(rig.phase * Math.PI * 2) * 0.12;
  if (st.carry) carryArms(rig, P, fw, rt);
}

/* ------------------------------ flesh ------------------------------ */
// Capsules: [ax,ay,az, bx,by,bz, r0,r1, colour] with colour 0 skin, 1 shirt, 2 pants,
// 3 boots, 4 hair, 5 hat, 6 wood, 7 metal.
export function rigCapsules(rig, st) {
  const J = rig.J, s = rig.s, w = (st && st.look && st.look.width) || 1, look = st && st.look;
  const out = [];
  const cap = (a, b, r0, r1, c) => out.push(a.x, a.y, a.z, b.x, b.y, b.z, r0, r1 == null ? r0 : r1, c);
  const [pel, spine, chest, neck, head, shL, elL, wrL, haL, shR, elR, wrR, haR, hipL, knL, anL, toeL, hipR, knR, anR, toeR, nose] = J;
  cap(hipL, hipR, 0.115 * s * w, null, 2);
  cap(pel, spine, 0.125 * s * w, 0.13 * s * w, 1);
  cap(spine, chest, 0.135 * s * w, 0.125 * s * w, 1);
  cap(shL, shR, 0.075 * s * w, null, 1);
  cap(chest, neck, 0.05 * s, 0.045 * s, 0);
  cap(shL, elL, 0.055 * s * w, 0.047 * s * w, 1); cap(shR, elR, 0.055 * s * w, 0.047 * s * w, 1);
  cap(elL, wrL, 0.042 * s, 0.034 * s, 0); cap(elR, wrR, 0.042 * s, 0.034 * s, 0);
  cap(wrL, haL, 0.036 * s, 0.03 * s, 0); cap(wrR, haR, 0.036 * s, 0.03 * s, 0);
  cap(hipL, knL, 0.08 * s * w, 0.06 * s * w, 2); cap(hipR, knR, 0.08 * s * w, 0.06 * s * w, 2);
  cap(knL, anL, 0.058 * s, 0.045 * s, 2); cap(knR, anR, 0.058 * s, 0.045 * s, 2);
  cap(anL, toeL, 0.048 * s, 0.042 * s, 3); cap(anR, toeR, 0.048 * s, 0.042 * s, 3);
  // head, nose, hair, hat
  const hu = norm(sub(head, neck)), hf = norm(sub(nose, head));
  cap(madd(head, hu, -0.02 * s), madd(head, hu, 0.02 * s), 0.105 * s, null, 0);
  cap(madd(head, hf, 0.095 * s), madd(madd(head, hf, 0.115 * s), hu, -0.02 * s), 0.02 * s, 0.018 * s, 0);
  const style = look ? look.hairStyle : 'short';
  if (style !== 'bald') cap(madd(madd(head, hu, 0.035 * s), hf, -0.015 * s), madd(madd(head, hu, -0.01 * s), hf, -0.045 * s), 0.108 * s, 0.1 * s, 4);
  if (style === 'long') cap(madd(head, hf, -0.06 * s), madd(madd(neck, hf, -0.07 * s), hu, -0.12 * s), 0.08 * s, 0.06 * s, 4);
  if (style === 'pony') cap(madd(madd(head, hf, -0.1 * s), hu, 0.02 * s), madd(madd(head, hf, -0.16 * s), hu, -0.2 * s), 0.03 * s, 0.022 * s, 4);
  if (style === 'bun') cap(madd(madd(head, hf, -0.08 * s), hu, 0.09 * s), madd(madd(head, hf, -0.1 * s), hu, 0.1 * s), 0.05 * s, null, 4);
  if (look && look.beard) cap(madd(madd(head, hf, 0.07 * s), hu, -0.07 * s), madd(madd(head, hf, 0.02 * s), hu, -0.1 * s), 0.05 * s, 0.045 * s, 4);
  if (look && look.hat) { cap(madd(head, hu, 0.07 * s), madd(head, hu, 0.13 * s), 0.11 * s, 0.1 * s, 5); cap(madd(madd(head, hu, 0.07 * s), hf, -0.12 * s), madd(madd(head, hu, 0.07 * s), hf, 0.16 * s), 0.035 * s, null, 5); }
  // the tool in hand
  const act = rig.act;
  const tool = act === 'chop' ? 'axe' : act === 'mine' ? 'pick' : act === 'build' ? 'hammer' : act === 'fish' ? 'spear' : null;
  if (tool) {
    const two = act === 'chop' || act === 'mine';
    let dir = two ? sub(haR, haL) : norm(sub(haR, wrR));
    if (vlen(dir) < 1e-3) dir = sub(haR, wrR);
    dir = norm(dir);
    const len = tool === 'spear' ? 1.6 : tool === 'hammer' ? 0.35 : 0.8;
    const butt = madd(two ? haL : haR, dir, two ? -0.12 : -0.08), tip = madd(two ? haL : haR, dir, len * s);
    cap(butt, tip, 0.018 * s, null, 6);
    const side = norm(cross(dir, UP));
    if (tool === 'axe') cap(madd(tip, side, -0.02), madd(madd(tip, side, 0.12 * s), dir, -0.04), 0.035 * s, 0.025 * s, 7);
    else if (tool === 'pick') cap(madd(madd(tip, side, -0.16 * s), dir, -0.03), madd(madd(tip, side, 0.16 * s), dir, -0.03), 0.02 * s, 0.012 * s, 7);
    else if (tool === 'hammer') cap(madd(tip, side, -0.05 * s), madd(tip, side, 0.05 * s), 0.03 * s, null, 7);
    else cap(tip, madd(tip, dir, 0.12 * s), 0.02 * s, 0.004, 7);
  }
  return out;
}
export const hand = (rig, right) => rig.J[right ? 12 : 8];
export const headOf = (rig) => rig.J[4];
