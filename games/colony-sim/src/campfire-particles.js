/*
 * VENDORED from zmhstudio plugins/zmh-vfx/lib/campfire-particles.mjs at commit c5a193a
 * (zmh-vfx library asset campfire.particles.embers). Do not edit here: change it upstream,
 * then copy it again and put the new commit in this line. Only the flame comes from it;
 * the hearth and the firelight are Colony Sim's own (render.js), which are the numbers
 * campfire-boxes.mjs was ported from.
 */
/*
 * zmh-vfx / campfire, "particles" technique.
 *
 * A fire made of soft additive sprites. 120 flame particles rise from a disc
 * around the fire's axis, narrow, shrink and cool from white-yellow through
 * orange and red to nothing; an optional 24 embers are small sparks that drift
 * up, sway and twinkle. The module returns plain particles
 * { x, y, z, size, r, g, b, a, kind } (size is the quad's HALF-extent in
 * metres) and Colony Sim-style 8-float instances, plus reference WebGL2
 * billboard shaders. Draw them in a blended pass (SRC_ALPHA, ONE, depthMask
 * false) after the opaque scene. The module ships the flame only: the hearth
 * and the firelight come from campfire-boxes.mjs.
 *
 * Bundler rules (shared technique contract, see the zmh-vfx skill):
 *   - no module-loading statements at all
 *   - declarations that leave the module are single-name const / function only
 *     (no braced lists, no default form)
 *   - EVERY top-level name, helpers included, contains campfireParticles or
 *     CAMPFIRE_PARTICLES, because a flat bundle puts every top-level name in
 *     one scope.
 *   - the text never contains a closing script tag
 *
 * Frame: particles are in the FIRE-LOCAL frame, origin at the fire's ground
 * centre, +y up.
 *
 * Determinism: only IEEE arithmetic and Math.floor/round/sqrt/sin/cos/imul.
 * No clock, no randomness. Every periodic motion is a phase in cycles: the
 * fractional part of t * rate is taken FIRST, then i / count is added (never
 * t * rate + i / count directly, which is not bitwise at the loop seam). In
 * preview mode the rate is quantised and the per-cycle random key is wrapped,
 * so frame N is bitwise frame 0.
 */

// ---------------------------------------------------------------------------
// helpers (not exported; copied from campfire-voxel.mjs under this prefix)
// ---------------------------------------------------------------------------

function campfireParticlesDeepFreeze(v) {
  if (v !== null && typeof v === 'object') {
    Object.freeze(v);
    for (const k of Object.keys(v)) campfireParticlesDeepFreeze(v[k]);
  }
  return v;
}

function campfireParticlesIsPlain(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function campfireParticlesClone(v) {
  if (Array.isArray(v)) return v.map(campfireParticlesClone);
  if (campfireParticlesIsPlain(v)) {
    const out = {};
    for (const k of Object.keys(v)) out[k] = campfireParticlesClone(v[k]);
    return out;
  }
  return v;
}

// Deep partial merge: objects merge key by key, arrays and scalars replace.
// An unknown key throws, so a typo in a host's override cannot pass silently.
function campfireParticlesMerge(base, over, path) {
  const out = campfireParticlesClone(base);
  if (over === undefined || over === null) return out;
  if (!campfireParticlesIsPlain(over)) throw new TypeError('campfireParticles params: ' + path + ' must be an object');
  for (const k of Object.keys(over)) {
    if (!Object.prototype.hasOwnProperty.call(base, k)) {
      throw new TypeError('campfireParticles params: unknown key ' + path + '.' + k);
    }
    if (over[k] === undefined) continue;
    if (campfireParticlesIsPlain(base[k])) out[k] = campfireParticlesMerge(base[k], over[k], path + '.' + k);
    else out[k] = campfireParticlesClone(over[k]);
  }
  return out;
}

const campfireParticlesResolved = new WeakSet();

function campfireParticlesLerp(a, b, t) {
  return a + (b - a) * t;
}

function campfireParticlesMod(a, p) {
  return ((a % p) + p) % p;
}

// GLSL smoothstep: clamped, k * k * (3 - 2k).
function campfireParticlesSmoothstep(a, b, x) {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

// ---------------------------------------------------------------------------
// parameters
// ---------------------------------------------------------------------------

export const CAMPFIRE_PARTICLES_DEFAULTS = campfireParticlesDeepFreeze({
  flames: {
    count: 120, rate: 0.625, spawnRadius: 0.22, spawnY: 0.12, rise: [0.55, 0.85], accel: 0.15,
    pull: 0.6, sway: { amp: 0.05, cycles: 1.5 }, size: [0.22, 0.06], alpha: 0.55, fadeIn: 0.08, seed: 3,
  },
  embers: {
    count: 24, rate: 0.5, spawnRadius: 0.15, spawnY: 0.25, rise: [0.5, 0.9], drift: 0.25,
    sway: { amp: 0.08, cycles: 2 }, size: 0.025, twinkle: { amp: 0.4, cycles: 6 },
    color: [[1.0, 0.6, 0.15], [0.8, 0.2, 0.03]], alpha: 0.9, seed: 5,
  },
});
campfireParticlesResolved.add(CAMPFIRE_PARTICLES_DEFAULTS);

// Merge a deep-partial override over the defaults; returns a new frozen object.
export function campfireParticlesParams(partial) {
  const merged = campfireParticlesDeepFreeze(campfireParticlesMerge(CAMPFIRE_PARTICLES_DEFAULTS, partial, 'params'));
  campfireParticlesResolved.add(merged);
  return merged;
}

function campfireParticlesResolve(params) {
  if (params === undefined || params === null) return CAMPFIRE_PARTICLES_DEFAULTS;
  if (campfireParticlesResolved.has(params)) return params;
  return campfireParticlesParams(params);
}

// ---------------------------------------------------------------------------
// loop quantisation (preview only)
// ---------------------------------------------------------------------------

// rate in cycles per second -> the nearest rate that repeats exactly every T
// seconds: max(1, round(rate * T)) / T. Hosts never use this; the GIF tool does.
export function campfireParticlesLoopRate(rate, T) {
  return Math.max(1, Math.round(rate * T)) / T;
}

// ---------------------------------------------------------------------------
// noise kernel (uint32 hash)
// ---------------------------------------------------------------------------

// lowbias32 (C. Wellons): uint32 in, uint32 out.
export function campfireParticlesHash32(x) {
  x = x >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

// Integer lattice point -> [0, 1).
export function campfireParticlesHash3(ix, iy, iz, seed) {
  return (
    campfireParticlesHash32(
      (ix | 0) ^ campfireParticlesHash32((iy | 0) ^ campfireParticlesHash32((iz | 0) ^ campfireParticlesHash32(seed | 0))),
    ) / 4294967296
  );
}

// ---------------------------------------------------------------------------
// colour ramp (shared technique contract item 6)
// ---------------------------------------------------------------------------

// Piecewise linear in heat h (clamped to [0, 1]), display-space colours.
export function campfireParticlesRamp(h) {
  const stops = [
    [0, 0, 0],
    [0.55, 0.06, 0.0],
    [1.0, 0.36, 0.04],
    [1.0, 0.72, 0.25],
    [1.0, 0.95, 0.78],
  ];
  const x = Math.min(1, Math.max(0, h)) * 4;
  const i = Math.min(3, Math.floor(x));
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [
    campfireParticlesLerp(a[0], b[0], f),
    campfireParticlesLerp(a[1], b[1], f),
    campfireParticlesLerp(a[2], b[2], f),
  ];
}

// ---------------------------------------------------------------------------
// particles
// ---------------------------------------------------------------------------

// Sprite falloff on the squared distance from the quad centre (quad coords
// scaled to the unit disc): the JS twin of the reference fragment shader.
export function campfireParticlesFalloff(d2) {
  if (d2 >= 1) return 0;
  const f = 1 - d2;
  return f * f;
}

// Slot i of kind P at time t: the phase pieces and the six per-particle randoms.
function campfireParticlesSlot(P, i, t, loopPeriod) {
  const T = loopPeriod === undefined || loopPeriod === null ? undefined : loopPeriod;
  const rate = T ? campfireParticlesLoopRate(P.rate, T) : P.rate;
  const tr = t * rate;
  const whole = Math.floor(tr);
  const ph = tr - whole; // exactly 0 at t = 0 and t = T
  const u = ph + i / P.count;
  const wrap = u >= 1 ? 1 : 0;
  const age01 = u - wrap;
  const age = age01 / rate;
  const cycle = whole + wrap;
  const key = T ? campfireParticlesMod(cycle, Math.round(rate * T)) : cycle;
  const r = [0, 1, 2, 3, 4, 5].map((k) => campfireParticlesHash3(i, key, k, P.seed));
  return { age01, age, r };
}

// The particles at time t, flames i = 0..count-1 then (opts.embers, default
// true) embers i = 0..count-1. opts = { embers, params, loopPeriod }.
export function campfireParticles(t, opts = {}) {
  const PP = campfireParticlesResolve(opts.params);
  const withEmbers = opts.embers === undefined ? true : !!opts.embers;
  const T = opts.loopPeriod;
  const TAU = 2 * Math.PI;
  const out = [];

  const F = PP.flames;
  for (let i = 0; i < F.count; i++) {
    const { age01, age, r } = campfireParticlesSlot(F, i, t, T);
    const a = TAU * r[0];
    const rho = F.spawnRadius * Math.sqrt(r[1]);
    const v = campfireParticlesLerp(F.rise[0], F.rise[1], r[2]);
    const pk = 1 - F.pull * age01;
    const sw = TAU * (F.sway.cycles * age01 + r[3]);
    const rgb = campfireParticlesRamp(1 - age01);
    out.push({
      x: rho * Math.cos(a) * pk + F.sway.amp * Math.sin(sw),
      y: F.spawnY + v * age + 0.5 * F.accel * age * age,
      z: rho * Math.sin(a) * pk + F.sway.amp * Math.cos(sw),
      size: campfireParticlesLerp(F.size[0], F.size[1], age01),
      r: rgb[0], g: rgb[1], b: rgb[2],
      a: F.alpha * campfireParticlesSmoothstep(0, F.fadeIn, age01) * (1 - age01),
      kind: 'flame',
    });
  }

  if (withEmbers) {
    const E = PP.embers;
    for (let i = 0; i < E.count; i++) {
      const { age01, age, r } = campfireParticlesSlot(E, i, t, T);
      const a = TAU * r[0];
      const rho = E.spawnRadius * Math.sqrt(r[1]);
      const v = campfireParticlesLerp(E.rise[0], E.rise[1], r[2]);
      const da = TAU * r[4];
      const dm = E.drift * r[5];
      const sw = TAU * (E.sway.cycles * age01 + r[3]);
      const tw = 1 - E.twinkle.amp + E.twinkle.amp * (0.5 + 0.5 * Math.sin(TAU * (E.twinkle.cycles * age01 + r[3])));
      out.push({
        x: rho * Math.cos(a) + dm * Math.cos(da) * age + E.sway.amp * Math.sin(sw),
        y: E.spawnY + v * age,
        z: rho * Math.sin(a) + dm * Math.sin(da) * age + E.sway.amp * Math.cos(sw),
        size: E.size,
        r: campfireParticlesLerp(E.color[0][0], E.color[1][0], age01),
        g: campfireParticlesLerp(E.color[0][1], E.color[1][1], age01),
        b: campfireParticlesLerp(E.color[0][2], E.color[1][2], age01),
        a: E.alpha * Math.pow(1 - age01, 1.5) * tw,
        kind: 'ember',
      });
    }
  }
  return out;
}

// 8 floats per particle: x, y, z, size, r, g, b, a. Appends to out.
export function campfireParticlesInstances(list, out = []) {
  for (const p of list) out.push(p.x, p.y, p.z, p.size, p.r, p.g, p.b, p.a);
  return out;
}

// ---------------------------------------------------------------------------
// reference WebGL2 billboard shaders
// ---------------------------------------------------------------------------

// Two triangles of the corner quad (aQ, location 0), corners in [-1, 1].
export const CAMPFIRE_PARTICLES_QUAD = Object.freeze([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);

// Instanced billboards: location 0 vec2 aQ (corner), 1 vec4 iP (x, y, z, size),
// 2 vec4 iC (r, g, b, a). Uniforms uVP, uCamRight, uCamUp. Display-space output
// (no encode); draw with blendFunc(SRC_ALPHA, ONE), depthMask(false).
export const CAMPFIRE_PARTICLES_SHADERS = Object.freeze({
  vertex: `#version 300 es
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 iP;
layout(location=2) in vec4 iC;
uniform mat4 uVP;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
out vec2 vQ;
out vec4 vC;
void main() {
  vec3 W = iP.xyz + (uCamRight * aQ.x + uCamUp * aQ.y) * iP.w;
  vQ = aQ;
  vC = iC;
  gl_Position = uVP * vec4(W, 1.0);
}
`,
  fragment: `#version 300 es
precision highp float;
in vec2 vQ;
in vec4 vC;
out vec4 o;
void main() {
  float d2 = dot(vQ, vQ);
  if (d2 >= 1.0) discard;
  float f = (1.0 - d2) * (1.0 - d2);
  o = vec4(vC.rgb, vC.a * f);
}
`,
});

// The shader pair for a params set. The sprite shape is fixed; params is
// accepted for symmetry with the other techniques.
export function campfireParticlesShaders(params) {
  campfireParticlesResolve(params);
  return CAMPFIRE_PARTICLES_SHADERS;
}
