// The material library. Every surface is a SOLID texture -- a pure function of
// a point in the part's own local space -- so nothing here needs a UV layout,
// an unwrap, or an image file. `bump` is a height field; the renderer takes
// its gradient and perturbs the shading normal, which is the normal map.
import { hex } from './render.mjs';
import { fbm, ridged, vnoise, worley, hash3, smoothstep, clamp01 } from './noise.mjs';

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// DETAIL HAS A FLOOR AND A CEILING, AND BOTH ARE SET BY THE GAME'S SCALE.
// A sprite is drawn at roughly 7 device pixels per world unit, so a surface
// feature smaller than ~0.25 units cannot resolve -- it averages down into
// sandpaper and eats the lighting -- while one larger than ~0.8 units reads as
// a dent in the model instead of a texture. Every frequency below is chosen to
// land a feature between those bounds: freq ~= 1 / feature-size-in-world-units.
// This file has been wrong in both directions; the numbers are not arbitrary.
export const MATS = {};
const def = (name, m) => { MATS[name] = m; return name; };

// --- timber ---------------------------------------------------------------
// Growth rings from a distorted cylindrical distance about the timber's long
// axis, plus splits and a few knots.
//
// THE LONG AXIS IS LOCAL +Z. Every piece of timber in this tree is either a
// box authored as (width, depth, height) or a tube, and Model.tube builds its
// cylinder along +Z before transforming -- so rings are taken about Z and the
// grain runs along it. Ringing about X instead wraps concentric arcs around a
// fence plank and turns sawn board into tree bark.
function woodField(x, y, z, s) {
  const wob = fbm(x * 1.4, y * 1.4, z * 0.35, 3, s) - 0.5;
  const r = Math.hypot(x + wob * 1.1, y + wob * 0.9) * 2.6 + z * 0.18;
  const ring = (r - Math.floor(r));
  const grain = fbm(x * 1.6, y * 1.6, z * 4.0, 3, s + 11);
  return clamp01(ring * 0.66 + grain * 0.34);
}
function woodKnot(x, y, z, s) {
  const c = worley(x * 0.8, y * 0.8, z * 0.42, s + 91);
  return smoothstep(0.34, 0.05, c.f1) * (c.id > 0.62 ? 1 : 0);
}
const woodMat = (name, lo, hi, seed, rough = 0.72) => def(name, {
  base: hex(hi), rough, metal: 0, cavity: 0.85, bumpScale: 0.11, bumpEps: 0.03,
  tex(x, y, z, out) {
    const f = woodField(x, y, z, seed);
    const k = woodKnot(x, y, z, seed);
    const c = mix(hex(lo), hex(hi), f);
    const d = mix(c, hex(lo), k * 0.85);
    out[0] = d[0]; out[1] = d[1]; out[2] = d[2];
  },
  bump: (x, y, z) => woodField(x, y, z, seed) * 0.45 + woodKnot(x, y, z, seed) * 0.8
        + Math.max(0, ridged(x * 3.0, y * 3.0, z * 0.9, 3, seed + 5) - 0.70) * 2.8,
  roughFn: (x, y, z) => 0.62 + woodField(x, y, z, seed) * 0.24,
});

export const WOOD_PLANK  = woodMat('woodPlank',  '#6b4526', '#a87845', 1301);
export const WOOD_GREY   = woodMat('woodGrey',   '#5d5142', '#94836c', 1447, 0.82);
export const WOOD_DARK   = woodMat('woodDark',   '#40291a', '#6a4526', 1583);
export const WOOD_HAFT   = woodMat('woodHaft',   '#4a3018', '#7d5a30', 1697, 0.55);

// --- metals ---------------------------------------------------------------
// Forge-hammered steel: shallow planishing dimples plus fine directional
// abrasion, and rust pooled into the low spots.
const hammer = (x, y, z, s) => worley(x * 2.5, y * 2.5, z * 2.5, s).f1;
export const STEEL = def('steel', {
  base: hex('#8e9aa8'), rough: 0.38, metal: 0.42, cavity: 0.5, bumpScale: 0.055, bumpEps: 0.025,
  bump: (x, y, z) => hammer(x, y, z, 2111) * 0.5 + fbm(x * 6.0, y * 6.0, z * 6.0, 2, 2113) * 0.14,
  roughFn: (x, y, z) => 0.32 + fbm(x * 5.0, y * 1.6, z * 5.0, 2, 2117) * 0.22,
});
export const IRON = def('iron', {
  base: hex('#6d757f'), rough: 0.50, metal: 0.34, cavity: 0.7, bumpScale: 0.09, bumpEps: 0.03,
  tex(x, y, z, out) {
    const rust = clamp01((fbm(x * 1.9, y * 1.9, z * 1.9, 4, 2213) - 0.46) * 3.4);
    const c = mix(hex('#6d757f'), hex('#7a4526'), rust);
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  },
  bump: (x, y, z) => hammer(x, y, z, 2219) * 0.7 + fbm(x * 5.0, y * 5.0, z * 5.0, 3, 2221) * 0.30,
  roughFn: (x, y, z) => 0.36 + clamp01((fbm(x * 1.9, y * 1.9, z * 1.9, 4, 2213) - 0.46) * 3.4) * 0.45,
});
export const BRASS = def('brass', {
  base: hex('#c79a3e'), rough: 0.30, metal: 0.52, cavity: 0.5, bumpScale: 0.05, bumpEps: 0.025,
  bump: (x, y, z) => hammer(x, y, z, 2311) * 0.40,
  roughFn: (x, y, z) => 0.19 + fbm(x * 18, y * 18, z * 18, 2, 2317) * 0.2,
});
export const GOLD_TRIM = def('goldTrim', {
  base: hex('#e0b048'), rough: 0.26, metal: 0.52,
  bumpScale: 0.03, bump: (x, y, z) => fbm(x * 6.0, y * 6.0, z * 6.0, 2, 2411) * 0.3,
});
// Riveted plate: the rivet heads are a cellular field pushed proud of the skin.
export const PLATE = def('plate', {
  base: hex('#8a97a5'), rough: 0.42, metal: 0.40, cavity: 0.45, bumpScale: 0.030, bumpEps: 0.03,
  bump: (x, y, z) => {
    const c = worley(x * 2.0, y * 2.0, z * 2.0, 2511);
    return smoothstep(0.22, 0.06, c.f1) * 0.8 + hammer(x, y, z, 2513) * 0.30;
  },
  roughFn: (x, y, z) => 0.36 + fbm(x * 4.0, y * 1.4, z * 4.0, 2, 2517) * 0.20,
});
// Chainmail: interlocked rings read as a tight cellular crater field.
export const MAIL = def('mail', {
  base: hex('#79828d'), rough: 0.56, metal: 0.32, cavity: 1.0, bumpScale: 0.055, bumpEps: 0.03,
  bump: (x, y, z) => {
    const c = worley(x * 2.8, y * 2.8, z * 2.8, 2611);
    return smoothstep(0.04, 0.34, c.f1) * 1.0;
  },
  roughFn: () => 0.52,
});

// --- cloth, leather, skin -------------------------------------------------
const weave = (x, y, z, f) =>
  (Math.sin(x * f) * Math.sin(y * f) * 0.5 + 0.5) * 0.6 +
  (Math.sin((x + y) * f * 0.7 + z * f) * 0.5 + 0.5) * 0.4;
const clothMat = (name, lo, hi, seed) => def(name, {
  base: hex(hi), rough: 0.86, metal: 0, cavity: 0.7, bumpScale: 0.075, bumpEps: 0.02,
  tex(x, y, z, out) {
    const f = fbm(x * 1.9, y * 1.9, z * 1.9, 4, seed);
    const c = mix(hex(lo), hex(hi), clamp01(0.30 + f * 0.85));
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  },
  bump: (x, y, z) => weave(x, y, z, 21) * 0.30 + fbm(x * 2.2, y * 2.2, z * 2.2, 3, seed + 7) * 1.4,
  roughFn: () => 0.88,
});
export const CLOAK    = clothMat('cloak',    '#4a0f1c', '#7e1c2c', 3101);  // the rogue's dark red
export const CLOTH_TAN = clothMat('clothTan', '#8a7146', '#b39a6a', 3203);
export const TABARD   = clothMat('tabard',   '#2a3550', '#41547e', 3307);
export const LEATHER = def('leather', {
  base: hex('#6a4426'), rough: 0.62, metal: 0, cavity: 0.9, bumpScale: 0.10, bumpEps: 0.018,
  tex(x, y, z, out) {
    const c = worley(x * 3.3, y * 3.3, z * 3.3, 3401);
    const t = clamp01(0.45 + c.id * 0.5);
    const col = mix(hex('#4d2f18'), hex('#7d5330'), t);
    out[0] = col[0]; out[1] = col[1]; out[2] = col[2];
  },
  bump: (x, y, z) => {
    const c = worley(x * 3.3, y * 3.3, z * 3.3, 3401);
    return smoothstep(0.0, 0.16, c.f2 - c.f1) * 0.8 + fbm(x * 5.5, y * 5.5, z * 5.5, 2, 3403) * 0.25;
  },
  roughFn: () => 0.6,
});
export const LEATHER_DK = def('leatherDk', {
  base: hex('#33210f'), rough: 0.58, metal: 0, cavity: 0.9, bumpScale: 0.09, bumpEps: 0.018,
  bump: (x, y, z) => {
    const c = worley(x * 3.6, y * 3.6, z * 3.6, 3501);
    return smoothstep(0.0, 0.15, c.f2 - c.f1) * 0.8;
  },
});
export const SKIN = def('skin', {
  base: hex('#d9a179'), rough: 0.60, metal: 0, cavity: 0.4, bumpScale: 0.03, bumpEps: 0.02,
  tex(x, y, z, out) {
    const f = fbm(x * 2.4, y * 2.4, z * 2.4, 3, 3601);
    const c = mix(hex('#c4885e'), hex('#e8b389'), clamp01(0.35 + f * 0.9));
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  },
  bump: (x, y, z) => fbm(x * 6.0, y * 6.0, z * 6.0, 2, 3603) * 0.4,
  roughFn: () => 0.58,
});
export const HAT_GREEN = clothMat('hatGreen', '#1e5424', '#3d8c3c', 3701);
export const FEATHER = def('feather', {
  base: hex('#c9d8b0'), rough: 0.70, metal: 0, cavity: 0.8, bumpScale: 0.07, bumpEps: 0.012,
  bump: (x, y, z) => (Math.sin(y * 26) * 0.5 + 0.5) * 0.5 + fbm(x * 4.0, y * 4.0, z * 4.0, 2, 3703) * 0.4,
});

// A base at zero hit points is drawn in the same geometry, greyed: a dedicated
// material rather than a runtime tint, so the dead state keeps its lighting.
export const STONE_DEAD = def('stoneDead', {
  base: hex('#5f5d5a'), rough: 0.88, metal: 0, cavity: 1.0, bumpScale: 0.08, bumpEps: 0.02,
  tex(x, y, z, out) {
    const c = worley(x * 1.6, y * 1.6, z * 1.6, 4101);
    const t = clamp01(0.35 + c.id * 0.5);
    out[0] = 0.055 + t * 0.075; out[1] = 0.053 + t * 0.072; out[2] = 0.050 + t * 0.068;
  },
  bump: (x, y, z) => {
    const c = worley(x * 1.6, y * 1.6, z * 1.6, 4101);
    return smoothstep(0.0, 0.14, c.f2 - c.f1) * 1.2 + fbm(x * 4.0, y * 4.0, z * 4.0, 4, 4105) * 0.5;
  },
});

// A hole, not a surface. Used for helmet visors and bunker firing slits: at
// sprite scale a dark slot reads as depth far better than modelled geometry.
export const VISOR = def('visor', {
  base: hex('#0d0f12'), rough: 0.95, metal: 0, cavity: 0,
});

// --- stone, earth, thatch -------------------------------------------------
export const STONE = def('stone', {
  base: hex('#767d85'), rough: 0.84, metal: 0, cavity: 1.0, bumpScale: 0.075, bumpEps: 0.025,
  tex(x, y, z, out) {
    const c = worley(x * 1.6, y * 1.6, z * 1.6, 4101);
    const t = clamp01(0.35 + c.id * 0.55 + (fbm(x * 4, y * 4, z * 4, 3, 4103) - 0.5) * 0.5);
    // grime settles in the joints: without it a big flat wall of lit stone
    // blows out to white and the fort reads as marble
    const grime = smoothstep(0.16, 0.0, c.f2 - c.f1);
    const col = mix(hex('#454c54'), hex('#7c838b'), t);
    const k = 1 - grime * 0.55;
    out[0] = col[0] * k; out[1] = col[1] * k; out[2] = col[2] * k;
  },
  bump: (x, y, z) => {
    const c = worley(x * 1.6, y * 1.6, z * 1.6, 4101);
    return smoothstep(0.0, 0.14, c.f2 - c.f1) * 1.2 + fbm(x * 4.0, y * 4.0, z * 4.0, 4, 4105) * 0.5;
  },
  roughFn: () => 0.82,
});
export const EARTH = def('earth', {
  base: hex('#a37747'), rough: 0.94, metal: 0, cavity: 1.0, bumpScale: 0.12, bumpEps: 0.03,
  tex(x, y, z, out) {
    const f = fbm(x * 2.2, y * 2.2, z * 2.2, 4, 4201);
    const col = mix(hex('#7d5730'), hex('#bd8f5c'), clamp01(0.3 + f * 0.9));
    out[0] = col[0]; out[1] = col[1]; out[2] = col[2];
  },
  bump: (x, y, z) => fbm(x * 2.6, y * 2.6, z * 2.6, 4, 4203) + ridged(x * 1.2, y * 1.2, z * 1.2, 3, 4205) * 0.5,
});
export const THATCH = def('thatch', {
  base: hex('#a98a4e'), rough: 0.92, metal: 0, cavity: 1.0, bumpScale: 0.13, bumpEps: 0.012,
  tex(x, y, z, out) {
    const f = fbm(x * 5.0, y * 1.2, z * 5.0, 3, 4301);
    const col = mix(hex('#6d5526'), hex('#c0a05e'), clamp01(f * 1.3));
    out[0] = col[0]; out[1] = col[1]; out[2] = col[2];
  },
  bump: (x, y, z) => fbm(x * 6.0, y * 1.4, z * 6.0, 3, 4303) * 1.2,
});
export const SANDBAG = def('sandbag', {
  base: hex('#9c8a63'), rough: 0.93, metal: 0, cavity: 0.9, bumpScale: 0.09, bumpEps: 0.02,
  bump: (x, y, z) => weave(x, y, z, 16) * 0.5 + fbm(x * 2.4, y * 2.4, z * 2.4, 3, 4401) * 0.9,
});

// --- fire -----------------------------------------------------------------
// A fireball has no diffuse read at all -- every photon it shows is its own.
// Brightness AND hue both come off one ridged turbulence field banded through
// the flame ramp, which is why the core goes white without the edges going
// grey. `emisRGB` is the renderer hook that lets a material colour its own
// emission per channel instead of scaling one fixed tint.
const FIRE_RAMP = ['#2a0702', '#8e2405', '#dc5016', '#ff9a22', '#ffd76a', '#fff6d8'].map(hex);
export function fireColour(t, out) {
  const u = clamp01(t) * (FIRE_RAMP.length - 1);
  const i = Math.min(FIRE_RAMP.length - 2, Math.floor(u));
  const f = u - i, a = FIRE_RAMP[i], b = FIRE_RAMP[i + 1];
  out[0] = a[0] + (b[0] - a[0]) * f;
  out[1] = a[1] + (b[1] - a[1]) * f;
  out[2] = a[2] + (b[2] - a[2]) * f;
  return out;
}
const fireTurb = (x, y, z, phase) =>
  ridged(x * 2.1 + phase * 3.1, y * 2.1, z * 2.1 - phase * 4.4, 4, 5101);

// `phase` walks the turbulence through the flame's own frame, so a 6-frame
// loop is one continuous churn rather than six unrelated fireballs.
export function fireMaterial(phase) {
  return {
    base: hex('#180402'), rough: 0.95, metal: 0, cavity: 0,
    bumpScale: 0.30, bumpEps: 0.02,
    bump: (x, y, z) => fireTurb(x, y, z, phase) * 1.4,
    emisRGB(x, y, z, out) {
      const r = Math.hypot(x, y, z);
      const core = clamp01(1.30 - r * 1.00);
      fireColour(clamp01(core * 0.78 + fireTurb(x, y, z, phase) * 0.62 - 0.18), out);
      out[0] *= 3.4; out[1] *= 3.4; out[2] *= 3.4;
    },
  };
}
// Charred smoke wads riding the shell -- opaque, barely lit, and the reason
// the ball reads as a volume instead of a glowing marble.
export function emberMaterial(phase) {
  return {
    base: hex('#241a16'), rough: 0.95, metal: 0, cavity: 1.0, bumpScale: 0.2, bumpEps: 0.02,
    tex(x, y, z, out) {
      const t = clamp01(fireTurb(x, y, z, phase) * 1.4 - 0.35);
      out[0] = 0.010 + t * 0.30; out[1] = 0.006 + t * 0.075; out[2] = 0.005 + t * 0.012;
    },
    bump: (x, y, z) => fbm(x * 5, y * 5, z * 5, 3, 5203) * 1.2,
  };
}
