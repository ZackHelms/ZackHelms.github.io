// Software renderer: oblique-projection z-buffer rasteriser with a deferred
// shading pass, a directional shadow map, tangent-free procedural normal
// mapping, and a supersampled downsample.
//
// THE PROJECTION IS A SHEAR, NOT A CAMERA. Pixel = (x, y - LEAN*z), so the
// ground plane stays exactly 1:1 with the game's world coordinates -- a
// sprite's footprint lines up with the collision circle, the range rings and
// the health bar without a single fudge factor -- while height still leans
// toward the top of the screen the way a raised 3/4 camera would show it.
//
//   view ray  v  = (0, LEAN, 1)  (toward the camera: above and screen-south)
//   depth        = LEAN*y + z    (larger is nearer)

export const LEAN = 0.80;
const VC = (() => { const L = Math.hypot(0, LEAN, 1); return [0, LEAN / L, 1 / L]; })();

export const srgb2lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
export function hex(h) {                // '#rrggbb' -> linear rgb triple
  const n = parseInt(h.slice(1), 16);
  return [srgb2lin(((n >> 16) & 255) / 255), srgb2lin(((n >> 8) & 255) / 255), srgb2lin((n & 255) / 255)];
}

// --- lighting rig, shared by every sprite in the sheet ---------------------
// One rig for the whole atlas is what makes a tank and an archer look like
// they are standing in the same arena. Directions point FROM the surface
// TOWARD the light.
const norm3 = v => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
export const RIG = {
  key:  { dir: norm3([-0.45, 0.42, 0.79]), col: [1.00, 0.96, 0.88], power: 3.20, shadow: true },
  fill: { dir: norm3([ 0.72, 0.30, 0.34]), col: [0.55, 0.64, 0.80], power: 0.80, shadow: false },
  rim:  { dir: norm3([ 0.12, -0.86, 0.50]), col: [0.92, 0.86, 1.00], power: 1.30, shadow: false },
  skyCol: [0.52, 0.64, 0.86],           // hemisphere ambient, from above
  gndCol: [0.34, 0.29, 0.23],           // bounce off the dirt arena, from below
  ambient: 0.68,
  envSpec: 0.40,                        // strength of the reflected environment
  sunSpec: 3.0,                         // the sun's own disc, seen in a reflection
  exposure: 0.98,
  shadowDark: 0.42,                     // how black the contact shadow gets
};

// --- the environment ------------------------------------------------------
// THREE LIGHTS ARE NOT ENOUGH FOR METAL. A directional light contributes a
// narrow GGX lobe and nothing else, so every sideways-facing steel face fell
// back to a constant fresnel term and read as flat blue-grey paint. What metal
// actually shows is its surroundings, so here is an analytic one: a sky/dirt
// gradient with a brightened horizon and the key light's own disc in it,
// blurred by roughness. Sampling it along the reflection vector is the single
// change that makes armour read as armour.
function envRGB(rx, ry, rz, rough, rig, out) {
  const up = rz * 0.5 + 0.5;
  const horizon = 1 - Math.abs(rz);
  const hb = horizon * horizon * 0.35;
  out[0] = rig.skyCol[0] * up + rig.gndCol[0] * (1 - up) + hb * 0.32;
  out[1] = rig.skyCol[1] * up + rig.gndCol[1] * (1 - up) + hb * 0.31;
  out[2] = rig.skyCol[2] * up + rig.gndCol[2] * (1 - up) + hb * 0.28;
  const K = rig.key.dir;
  const d = rx * K[0] + ry * K[1] + rz * K[2];
  if (d > 0) {
    const g = 1 - rough;
    const sharp = 2 + 260 * g * g;
    const sp = Math.pow(d, sharp) * rig.sunSpec;
    out[0] += sp * rig.key.col[0]; out[1] += sp * rig.key.col[1]; out[2] += sp * rig.key.col[2];
  }
}

// ACES filmic approximation -- the highlight rolloff is what stops steel and
// fire clipping to flat white the moment the key light hits them square on.
function tonemap(x) {
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  const v = (x * (a * x + b)) / (x * (c * x + d) + e);
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
const lin2srgbByte = v => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
};

// --- GGX ------------------------------------------------------------------
function ggx(nl, nv, nh, vh, rough, F0, out) {
  const a = rough * rough, a2 = a * a;
  const dd = nh * nh * (a2 - 1) + 1;
  const D = a2 / (Math.PI * dd * dd + 1e-9);
  const k = (rough + 1) * (rough + 1) / 8;
  const G = (nl / (nl * (1 - k) + k)) * (nv / (nv * (1 - k) + k));
  const f = Math.pow(1 - vh, 5);
  const spec = D * G / (4 * nl * nv + 1e-6);
  out[0] = spec * (F0[0] + (1 - F0[0]) * f);
  out[1] = spec * (F0[1] + (1 - F0[1]) * f);
  out[2] = spec * (F0[2] + (1 - F0[2]) * f);
}

// --- rotate a model about Z (the yaw sweep) -------------------------------
function yawModel(model, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const n = model.p.length;
  const p = new Float64Array(n), nr = new Float64Array(n);
  for (let k = 0; k < n; k += 3) {
    p[k] = model.p[k] * c - model.p[k + 1] * s;
    p[k + 1] = model.p[k] * s + model.p[k + 1] * c;
    p[k + 2] = model.p[k + 2];
    nr[k] = model.n[k] * c - model.n[k + 1] * s;
    nr[k + 1] = model.n[k] * s + model.n[k + 1] * c;
    nr[k + 2] = model.n[k + 2];
  }
  const parts = model.parts.map(pt => {
    const M = pt.N3, o = new Float64Array(9);
    for (let col = 0; col < 3; col++) {
      o[col] = M[col] * c - M[3 + col] * s;
      o[3 + col] = M[col] * s + M[3 + col] * c;
      o[6 + col] = M[6 + col];
    }
    return { mat: pt.mat, N3: o };
  });
  return { p, n: nr, tp: model.tp, i: model.i, triPart: model.triPart, parts };
}

// --- shadow map -----------------------------------------------------------
function buildShadow(m, lightDir, res) {
  // orthonormal basis with lightDir as the depth axis
  const L = lightDir;
  let up = Math.abs(L[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
  let X = norm3([up[1] * L[2] - up[2] * L[1], up[2] * L[0] - up[0] * L[2], up[0] * L[1] - up[1] * L[0]]);
  let Y = [L[1] * X[2] - L[2] * X[1], L[2] * X[0] - L[0] * X[2], L[0] * X[1] - L[1] * X[0]];
  let minU = 1e9, maxU = -1e9, minV = 1e9, maxV = -1e9;
  const nv = m.p.length / 3;
  const U = new Float64Array(nv), V = new Float64Array(nv), D = new Float64Array(nv);
  for (let k = 0; k < nv; k++) {
    const x = m.p[k * 3], y = m.p[k * 3 + 1], z = m.p[k * 3 + 2];
    const u = x * X[0] + y * X[1] + z * X[2];
    const v = x * Y[0] + y * Y[1] + z * Y[2];
    U[k] = u; V[k] = v; D[k] = x * L[0] + y * L[1] + z * L[2];
    if (u < minU) minU = u; if (u > maxU) maxU = u;
    if (v < minV) minV = v; if (v > maxV) maxV = v;
  }
  // the ground plane under the model must be inside the map or its own shadow
  // falls off the edge; pad generously, it costs nothing but texels
  const pad = 2.5;
  minU -= pad; maxU += pad; minV -= pad; maxV += pad;
  const spanU = Math.max(1e-6, maxU - minU), spanV = Math.max(1e-6, maxV - minV);
  const sc = res / Math.max(spanU, spanV);
  const buf = new Float32Array(res * res).fill(-1e30);
  const idx = m.i;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ax = (U[a] - minU) * sc, ay = (V[a] - minV) * sc;
    const bx = (U[b] - minU) * sc, by = (V[b] - minV) * sc;
    const cx = (U[c] - minU) * sc, cy = (V[c] - minV) * sc;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-12) continue;
    const inv = 1 / area;
    let x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    let x1 = Math.min(res - 1, Math.ceil(Math.max(ax, bx, cx)));
    let y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    let y1 = Math.min(res - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        let w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * inv;
        let w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * inv;
        let w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const d = w0 * D[a] + w1 * D[b] + w2 * D[c];
        const o = y * res + x;
        if (d > buf[o]) buf[o] = d;
      }
  }
  return { buf, res, X, Y, L, minU, minV, sc };
}

function shadowFactor(sm, x, y, z, bias) {
  const u = (x * sm.X[0] + y * sm.X[1] + z * sm.X[2] - sm.minU) * sm.sc;
  const v = (x * sm.Y[0] + y * sm.Y[1] + z * sm.Y[2] - sm.minV) * sm.sc;
  const d = x * sm.L[0] + y * sm.L[1] + z * sm.L[2];
  let lit = 0, n = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const ix = (u + dx) | 0, iy = (v + dy) | 0;
      n++;
      if (ix < 0 || iy < 0 || ix >= sm.res || iy >= sm.res) { lit++; continue; }
      if (d + bias >= sm.buf[iy * sm.res + ix]) lit++;
    }
  return lit / n;
}

// --- flat texture render --------------------------------------------------
// Ground tiles are not models: they are one flat plane, shaded per texel from
// a material's own height field. Same rig as the sprites, so the dirt and the
// boots standing on it agree about where the sun is.
export function renderTexture(mat, size, span, rigIn) {
  const rig = rigIn || RIG;
  const out = new Uint8ClampedArray(size * size * 4);
  const lights = [rig.key, rig.fill, rig.rim];
  const spec = [0, 0, 0], alb = [0, 0, 0], env = [0, 0, 0];
  const e = mat.bumpEps || 0.02, bs = mat.bumpScale === undefined ? 1 : mat.bumpScale;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const x = (i + 0.5) / size * span, y = (j + 0.5) / size * span;
      const h0 = mat.bump ? mat.bump(x, y, 0) : 0;
      let nx = 0, ny = 0, nz = 1;
      if (mat.bump) {
        nx = -(mat.bump(x + e, y, 0) - h0) / e * bs;
        ny = -(mat.bump(x, y + e, 0) - h0) / e * bs;
        const L = Math.hypot(nx, ny, 1); nx /= L; ny /= L; nz = 1 / L;
      }
      if (mat.tex) mat.tex(x, y, 0, alb);
      else { alb[0] = mat.base[0]; alb[1] = mat.base[1]; alb[2] = mat.base[2]; }
      const rough = Math.max(0.05, mat.roughFn ? mat.roughFn(x, y, 0) : mat.rough);
      const metal = mat.metal || 0;
      const dr = alb[0] * (1 - metal), dg = alb[1] * (1 - metal), db = alb[2] * (1 - metal);
      const F0r = 0.04 * (1 - metal) + alb[0] * metal;
      const F0g = 0.04 * (1 - metal) + alb[1] * metal;
      const F0b = 0.04 * (1 - metal) + alb[2] * metal;
      const F0 = [F0r, F0g, F0b];
      const NV = Math.max(1e-4, nx * VC[0] + ny * VC[1] + nz * VC[2]);
      const cav = 1 - Math.max(0, Math.min(0.55, h0 * (mat.cavity || 0)));
      let R = 0, G = 0, B = 0;
      for (let li = 0; li < 3; li++) {
        const Lg = lights[li], L = Lg.dir;
        const nl = nx * L[0] + ny * L[1] + nz * L[2];
        if (nl <= 0) continue;
        let hx = L[0] + VC[0], hy = L[1] + VC[1], hz = L[2] + VC[2];
        const hl = Math.hypot(hx, hy, hz) || 1; hx /= hl; hy /= hl; hz /= hl;
        const nh = Math.max(0, nx * hx + ny * hy + nz * hz);
        const vh = Math.max(0, VC[0] * hx + VC[1] * hy + VC[2] * hz);
        ggx(nl, NV, nh, vh, rough, F0, spec);
        const en = Lg.power * nl;
        R += en * (dr / Math.PI + spec[0]) * Lg.col[0];
        G += en * (dg / Math.PI + spec[1]) * Lg.col[1];
        B += en * (db / Math.PI + spec[2]) * Lg.col[2];
      }
      const up = nz * 0.5 + 0.5, amb = rig.ambient * cav;
      R += amb * dr * (rig.skyCol[0] * up + rig.gndCol[0] * (1 - up));
      G += amb * dg * (rig.skyCol[1] * up + rig.gndCol[1] * (1 - up));
      B += amb * db * (rig.skyCol[2] * up + rig.gndCol[2] * (1 - up));
      let rfx = 2 * NV * nx - VC[0], rfy = 2 * NV * ny - VC[1], rfz = 2 * NV * nz - VC[2];
      rfx += (nx - rfx) * rough; rfy += (ny - rfy) * rough; rfz += (nz - rfz) * rough;
      const rl = Math.hypot(rfx, rfy, rfz) || 1;
      envRGB(rfx / rl, rfy / rl, rfz / rl, rough, rig, env);
      const fres = Math.pow(1 - NV, 5), cap = 1 - rough, kE = rig.envSpec * cav;
      R += (F0r + (Math.max(cap, F0r) - F0r) * fres) * env[0] * kE;
      G += (F0g + (Math.max(cap, F0g) - F0g) * fres) * env[1] * kE;
      B += (F0b + (Math.max(cap, F0b) - F0b) * fres) * env[2] * kE;
      const o = (j * size + i) * 4;
      out[o] = lin2srgbByte(tonemap(R * rig.exposure));
      out[o + 1] = lin2srgbByte(tonemap(G * rig.exposure));
      out[o + 2] = lin2srgbByte(tonemap(B * rig.exposure));
      out[o + 3] = 255;
    }
  return out;
}

// --- contact shadow -------------------------------------------------------
// The KEY LIGHT's cast shadow stays on the model itself (that self-shadowing
// is most of the form), but it is useless on the ground: at 52 degrees of
// elevation a 16-unit knight throws a 13-unit shadow, which is longer than the
// whole tile. What a sprite actually needs is a contact pool. So the ground
// darkness is an ambient occlusion term instead: rasterise the model straight
// down, keep the LOWEST geometry over each ground cell, and darken by how
// close that geometry gets to the dirt. Boots go black underneath, a raised
// arm barely registers, and the pool never leaves the tile.
function contactShadow(m, W, H, ppu, px0, py0, fade) {
  const minz = new Float32Array(W * H).fill(1e30);
  const idx = m.i, p = m.p;
  const px = k => px0 + p[k * 3] * ppu, py = k => py0 + p[k * 3 + 1] * ppu;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ax = px(a), ay = py(a), bx = px(b), by = py(b), cx = px(c), cy = py(c);
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-12) continue;
    const inv = 1 / area;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const qx = x + 0.5, qy = y + 0.5;
        const w0 = ((bx - qx) * (cy - qy) - (by - qy) * (cx - qx)) * inv;
        if (w0 < 0) continue;
        const w1 = ((cx - qx) * (ay - qy) - (cy - qy) * (ax - qx)) * inv;
        if (w1 < 0) continue;
        const w2 = 1 - w0 - w1;
        if (w2 < 0) continue;
        const z = w0 * p[a * 3 + 2] + w1 * p[b * 3 + 2] + w2 * p[c * 3 + 2];
        const o = y * W + x;
        if (z < minz[o]) minz[o] = z;
      }
  }
  let f = new Float32Array(W * H);
  for (let o = 0; o < W * H; o++)
    f[o] = minz[o] > 1e29 ? 0 : Math.max(0, 1 - minz[o] / fade);
  // two separable box blurs -- a cheap gaussian, and the softness is what
  // stops the pool reading as a decal cut from the sprite's silhouette
  const rad = Math.max(1, Math.round(ppu * 0.55));
  for (let pass = 0; pass < 2; pass++) {
    const g = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0, n = 0;
        for (let d = -rad; d <= rad; d++) { const u = x + d; if (u < 0 || u >= W) continue; s += f[y * W + u]; n++; }
        g[y * W + x] = s / n;
      }
    const h2 = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0, n = 0;
        for (let d = -rad; d <= rad; d++) { const v = y + d; if (v < 0 || v >= H) continue; s += g[v * W + x]; n++; }
        h2[y * W + x] = s / n;
      }
    f = h2;
  }
  return f;
}

// --- the sprite render ----------------------------------------------------
// opts: { yaw, w, h, ss, ppu, pivotX, pivotY, mats, rig, groundShadow }
export function renderSprite(model, opts) {
  const { w, h, ss = 3, ppu, pivotX, pivotY, mats } = opts;
  const rig = opts.rig || RIG;
  const m = opts.yaw ? yawModel(model, opts.yaw) : model;
  const W = w * ss, H = h * ss, P = ppu * ss;
  const px0 = pivotX * ss, py0 = pivotY * ss;

  const nv = m.p.length / 3;
  const SX = new Float64Array(nv), SY = new Float64Array(nv), DZ = new Float64Array(nv);
  for (let k = 0; k < nv; k++) {
    const x = m.p[k * 3], y = m.p[k * 3 + 1], z = m.p[k * 3 + 2];
    SX[k] = px0 + x * P;
    SY[k] = py0 + (y - LEAN * z) * P;
    DZ[k] = LEAN * y + z;
  }

  const depth = new Float32Array(W * H).fill(-1e30);
  const tri = new Int32Array(W * H).fill(-1);
  const B0 = new Float32Array(W * H), B1 = new Float32Array(W * H);
  const idx = m.i;

  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const part = m.parts[m.triPart[t / 3]];
    const mat = mats[part.mat];
    // Cull with the true geometric normal rather than a screen-space winding
    // test: the shear makes 2D orientation an unreliable proxy.
    if (!mat.doubleSided) {
      const ux = m.p[b * 3] - m.p[a * 3], uy = m.p[b * 3 + 1] - m.p[a * 3 + 1], uz = m.p[b * 3 + 2] - m.p[a * 3 + 2];
      const vx = m.p[c * 3] - m.p[a * 3], vy = m.p[c * 3 + 1] - m.p[a * 3 + 1], vz = m.p[c * 3 + 2] - m.p[a * 3 + 2];
      const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      if (gx * VC[0] + gy * VC[1] + gz * VC[2] <= 0) continue;
    }
    const ax = SX[a], ay = SY[a], bx = SX[b], by = SY[b], cx = SX[c], cy = SY[c];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-12) continue;
    const inv = 1 / area;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) {
      const pyc = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const pxc = x + 0.5;
        const w0 = ((bx - pxc) * (cy - pyc) - (by - pyc) * (cx - pxc)) * inv;
        if (w0 < 0) continue;
        const w1 = ((cx - pxc) * (ay - pyc) - (cy - pyc) * (ax - pxc)) * inv;
        if (w1 < 0) continue;
        const w2 = 1 - w0 - w1;
        if (w2 < 0) continue;
        const d = w0 * DZ[a] + w1 * DZ[b] + w2 * DZ[c];
        const o = y * W + x;
        if (d <= depth[o]) continue;
        depth[o] = d; tri[o] = t; B0[o] = w0; B1[o] = w1;
      }
    }
  }

  const sm = buildShadow(m, rig.key.dir, opts.shadowRes || 512);
  const contact = opts.groundShadow
    ? contactShadow(m, W, H, P, px0, py0, opts.groundShadow) : null;
  const lights = [rig.key, rig.fill, rig.rim];
  const spec = [0, 0, 0], alb = [0, 0, 0], env = [0, 0, 0];
  const acc = new Float32Array(W * H * 4);

  for (let o = 0; o < W * H; o++) {
    const t = tri[o];
    if (t < 0) {
      // No geometry -- but the ground still catches the contact pool. Baking it
      // into the tile costs nothing at runtime and is most of what sells a
      // sprite as standing on the arena rather than floating over it.
      if (!contact) continue;
      const k = contact[o] * rig.shadowDark;
      if (k < 0.004) continue;
      acc[o * 4] = 0.020; acc[o * 4 + 1] = 0.014; acc[o * 4 + 2] = 0.010;
      acc[o * 4 + 3] = k > 1 ? 1 : k;
      continue;
    }
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const w0 = B0[o], w1 = B1[o], w2 = 1 - w0 - w1;
    const part = m.parts[m.triPart[t / 3]];
    const mat = mats[part.mat];
    const X = w0 * m.p[a * 3] + w1 * m.p[b * 3] + w2 * m.p[c * 3];
    const Y = w0 * m.p[a * 3 + 1] + w1 * m.p[b * 3 + 1] + w2 * m.p[c * 3 + 1];
    const Z = w0 * m.p[a * 3 + 2] + w1 * m.p[b * 3 + 2] + w2 * m.p[c * 3 + 2];
    let nx = w0 * m.n[a * 3] + w1 * m.n[b * 3] + w2 * m.n[c * 3];
    let ny = w0 * m.n[a * 3 + 1] + w1 * m.n[b * 3 + 1] + w2 * m.n[c * 3 + 1];
    let nz = w0 * m.n[a * 3 + 2] + w1 * m.n[b * 3 + 2] + w2 * m.n[c * 3 + 2];
    let nl0 = Math.hypot(nx, ny, nz) || 1; nx /= nl0; ny /= nl0; nz /= nl0;
    const tx = w0 * m.tp[a * 3] + w1 * m.tp[b * 3] + w2 * m.tp[c * 3];
    const ty = w0 * m.tp[a * 3 + 1] + w1 * m.tp[b * 3 + 1] + w2 * m.tp[c * 3 + 1];
    const tz = w0 * m.tp[a * 3 + 2] + w1 * m.tp[b * 3 + 2] + w2 * m.tp[c * 3 + 2];

    if (mat.doubleSided && (nx * VC[0] + ny * VC[1] + nz * VC[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }

    // --- procedural normal map, without a UV or a tangent in sight ---------
    // The height field is sampled in the PART's own space; its gradient is
    // carried into world space by the same normal matrix the vertices used.
    let cav = 1;
    if (mat.bump) {
      const e = mat.bumpEps || 0.035;
      const h0 = mat.bump(tx, ty, tz);
      const gx = (mat.bump(tx + e, ty, tz) - h0) / e;
      const gy = (mat.bump(tx, ty + e, tz) - h0) / e;
      const gz = (mat.bump(tx, ty, tz + e) - h0) / e;
      const M = part.N3;
      let wx = M[0] * gx + M[1] * gy + M[2] * gz;
      let wy = M[3] * gx + M[4] * gy + M[5] * gz;
      let wz = M[6] * gx + M[7] * gy + M[8] * gz;
      const dn = wx * nx + wy * ny + wz * nz;
      wx -= dn * nx; wy -= dn * ny; wz -= dn * nz;
      const s = (mat.bumpScale === undefined ? 1 : mat.bumpScale);
      nx -= wx * s; ny -= wy * s; nz -= wz * s;
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      cav = 1 - Math.max(0, Math.min(0.55, h0 * (mat.cavity || 0)));
    }

    if (mat.tex) mat.tex(tx, ty, tz, alb);
    else { alb[0] = mat.base[0]; alb[1] = mat.base[1]; alb[2] = mat.base[2]; }
    const rough = Math.max(0.045, mat.roughFn ? mat.roughFn(tx, ty, tz) : mat.rough);
    const metal = mat.metal || 0;
    const F0r = 0.04 * (1 - metal) + alb[0] * metal;
    const F0g = 0.04 * (1 - metal) + alb[1] * metal;
    const F0b = 0.04 * (1 - metal) + alb[2] * metal;
    const F0 = [F0r, F0g, F0b];
    const dr = alb[0] * (1 - metal), dg = alb[1] * (1 - metal), db = alb[2] * (1 - metal);

    const nv2 = nx * VC[0] + ny * VC[1] + nz * VC[2];
    const NV = Math.max(1e-4, nv2);
    let R = 0, G = 0, B = 0;

    for (let li = 0; li < 3; li++) {
      const Lg = lights[li], L = Lg.dir;
      const nl = nx * L[0] + ny * L[1] + nz * L[2];
      if (nl <= 0) continue;
      let sh = 1;
      if (Lg.shadow) sh = shadowFactor(sm, X + nx * 0.05, Y + ny * 0.05, Z + nz * 0.05, 0.10);
      if (sh <= 0.001) continue;
      let hx = L[0] + VC[0], hy = L[1] + VC[1], hz = L[2] + VC[2];
      const hl = Math.hypot(hx, hy, hz) || 1; hx /= hl; hy /= hl; hz /= hl;
      const nh = Math.max(0, nx * hx + ny * hy + nz * hz);
      const vh = Math.max(0, VC[0] * hx + VC[1] * hy + VC[2] * hz);
      ggx(nl, NV, nh, vh, rough, F0, spec);
      const e = Lg.power * nl * sh;
      R += e * (dr / Math.PI + spec[0]) * Lg.col[0];
      G += e * (dg / Math.PI + spec[1]) * Lg.col[1];
      B += e * (db / Math.PI + spec[2]) * Lg.col[2];
    }
    // hemisphere ambient: sky above, dirt bounce below, darkened in creases
    const up = nz * 0.5 + 0.5, amb = rig.ambient * cav;
    R += amb * dr * (rig.skyCol[0] * up + rig.gndCol[0] * (1 - up));
    G += amb * dg * (rig.skyCol[1] * up + rig.gndCol[1] * (1 - up));
    B += amb * db * (rig.skyCol[2] * up + rig.gndCol[2] * (1 - up));
    // reflected environment: the specular half of the ambient, sampled along
    // the mirror direction so a curved surface sweeps sky, horizon and sun
    // A rough surface's reflection lobe widens toward its own normal, and
    // sampling the mirror direction alone left every vertical face with one
    // view-fixed z -- so a whole cylinder side sampled a single env colour and
    // went flat. Blending the sample toward N by roughness both approximates
    // the widened lobe and restores the variation that reads as form.
    let rfx = 2 * NV * nx - VC[0], rfy = 2 * NV * ny - VC[1], rfz = 2 * NV * nz - VC[2];
    rfx += (nx - rfx) * rough; rfy += (ny - rfy) * rough; rfz += (nz - rfz) * rough;
    const rl = Math.hypot(rfx, rfy, rfz) || 1;
    envRGB(rfx / rl, rfy / rl, rfz / rl, rough, rig, env);
    // Roughness-attenuated fresnel. The textbook (1-NV)^5 drives F to 1 at
    // grazing angles, which is right for a mirror and badly wrong for scuffed
    // plate -- and under an oblique projection a huge share of every surface
    // sits near grazing, so unattenuated fresnel washed the whole figure in
    // reflected ground colour. Capping the rise at (1 - rough) is the standard
    // fix and it is what makes armour look like metal instead of wet clay.
    const fres = Math.pow(1 - NV, 5), cap = 1 - rough;
    const kE = rig.envSpec * cav;
    R += (F0r + (Math.max(cap, F0r) - F0r) * fres) * env[0] * kE;
    G += (F0g + (Math.max(cap, F0g) - F0g) * fres) * env[1] * kE;
    B += (F0b + (Math.max(cap, F0b) - F0b) * fres) * env[2] * kE;
    if (mat.emisRGB) { mat.emisRGB(tx, ty, tz, alb); R += alb[0]; G += alb[1]; B += alb[2]; }
    else if (mat.emis) {
      const k = mat.emisFn ? mat.emisFn(tx, ty, tz) : 1;
      R += mat.emis[0] * k; G += mat.emis[1] * k; B += mat.emis[2] * k;
    }
    acc[o * 4] = R * rig.exposure; acc[o * 4 + 1] = G * rig.exposure;
    acc[o * 4 + 2] = B * rig.exposure; acc[o * 4 + 3] = 1;
  }

  // --- resolve: box downsample with coverage-weighted colour ---------------
  const out = new Uint8ClampedArray(w * h * 4);
  const inv = 1 / (ss * ss);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        const row = (y * ss + sy) * W + x * ss;
        for (let sx = 0; sx < ss; sx++) {
          const o = (row + sx) * 4, al = acc[o + 3];
          r += acc[o] * al; g += acc[o + 1] * al; b += acc[o + 2] * al; a += al;
        }
      }
      const o = (y * w + x) * 4;
      if (a <= 1e-6) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; continue; }
      out[o] = lin2srgbByte(tonemap(r / a));
      out[o + 1] = lin2srgbByte(tonemap(g / a));
      out[o + 2] = lin2srgbByte(tonemap(b / a));
      out[o + 3] = Math.round(a * inv * 255);
    }
  return out;
}
