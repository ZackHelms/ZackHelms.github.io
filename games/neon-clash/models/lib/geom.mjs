// Mesh construction: 4x4 transforms, tessellated primitives with analytic
// normals, and a Model that accumulates parts into one triangle soup.
//
// MODEL AXES (they line up with the game's own local frame, which is why a
// rendered sprite drops straight into drawUnitShape's rotated space):
//   +X  forward -- the direction a unit faces at rotation 0
//   +Y  the unit's right, which is screen-DOWN in the game's board space
//   +Z  up, out of the board
//
// Every vertex keeps a second position `tp` in its PART's local space. Solid
// textures are evaluated there, never in world space, so the grain of a plank
// does not swim across the model as the yaw sweep turns it.

// WINDING. Every triangle must be counter-clockwise seen from OUTSIDE, because
// the renderer culls on the geometric normal. The trap: sphere() walks its rows
// from the north pole DOWNWARD while cyl(), lathe() and torus() walk theirs
// UPWARD, so copying the sphere's index pattern into them silently inverts the
// surface. An inverted closed shape still draws a plausible silhouette -- you
// are just looking at the inside of its far wall -- which is why this survived
// a long way into the build looking merely "flat" and "cup-like". geom.test.mjs
// asserts every primitive's winding against its own vertex normals; run it
// after touching anything here.
export const v3 = (x, y, z) => [x, y, z];

export function matMul(a, b) {          // row-major 4x4, a then b applied as b*a
  const o = new Float64Array(16);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += b[r * 4 + k] * a[k * 4 + c];
      o[r * 4 + c] = s;
    }
  return o;
}
export const matId = () => new Float64Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
export const matT = (x, y, z) => new Float64Array([1,0,0,x, 0,1,0,y, 0,0,1,z, 0,0,0,1]);
export const matS = (x, y, z) => new Float64Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]);
export const matRX = a => { const c = Math.cos(a), s = Math.sin(a);
  return new Float64Array([1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1]); };
export const matRY = a => { const c = Math.cos(a), s = Math.sin(a);
  return new Float64Array([c,0,s,0, 0,1,0,0, -s,0,c,0, 0,0,0,1]); };
export const matRZ = a => { const c = Math.cos(a), s = Math.sin(a);
  return new Float64Array([c,-s,0,0, s,c,0,0, 0,0,1,0, 0,0,0,1]); };

// Compose in authoring order: scale, then rotate X/Y/Z, then translate.
export function xf({ t = [0,0,0], rx = 0, ry = 0, rz = 0, s = [1,1,1] } = {}) {
  const sc = Array.isArray(s) ? s : [s, s, s];
  let m = matS(sc[0], sc[1], sc[2]);
  if (rx) m = matMul(m, matRX(rx));
  if (ry) m = matMul(m, matRY(ry));
  if (rz) m = matMul(m, matRZ(rz));
  return matMul(m, matT(t[0], t[1], t[2]));
}

export function normalMat(m) {          // inverse-transpose of the upper 3x3
  const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6],
        g = m[8], h = m[9], i = m[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  let det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) det = 1e-12;
  const id = 1 / det;
  // inverse = adj/det; we want its transpose, i.e. the cofactor matrix / det
  return new Float64Array([
    A * id, B * id, C * id,
    (-(b * i - c * h)) * id, (a * i - c * g) * id, (-(a * h - b * g)) * id,
    (b * f - c * e) * id, (-(a * f - c * d)) * id, (a * e - b * d) * id,
  ]);
}

// ------------------------------------------------------------- primitives
// Each returns { p:[x,y,z...], n:[...], i:[...] } in its own local space.

export function box(w, h, d) {
  const x = w / 2, y = h / 2, z = d / 2, p = [], n = [], i = [];
  const face = (nx, ny, nz, a, b, c, e) => {
    const base = p.length / 3;
    for (const v of [a, b, c, e]) { p.push(v[0], v[1], v[2]); n.push(nx, ny, nz); }
    i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  face( 1, 0, 0, [x,-y,-z], [x, y,-z], [x, y, z], [x,-y, z]);
  face(-1, 0, 0, [-x, y,-z], [-x,-y,-z], [-x,-y, z], [-x, y, z]);
  face( 0, 1, 0, [ x, y,-z], [-x, y,-z], [-x, y, z], [ x, y, z]);
  face( 0,-1, 0, [-x,-y,-z], [ x,-y,-z], [ x,-y, z], [-x,-y, z]);
  face( 0, 0, 1, [-x,-y, z], [ x,-y, z], [ x, y, z], [-x, y, z]);
  face( 0, 0,-1, [-x, y,-z], [ x, y,-z], [ x,-y,-z], [-x,-y,-z]);
  return { p, n, i };
}

export function sphere(r, su = 20, sv = 12) {
  const p = [], n = [], i = [];
  for (let v = 0; v <= sv; v++) {
    const th = v / sv * Math.PI, st = Math.sin(th), ct = Math.cos(th);
    for (let u = 0; u <= su; u++) {
      const ph = u / su * Math.PI * 2, sp = Math.sin(ph), cp = Math.cos(ph);
      const nx = st * cp, ny = st * sp, nz = ct;
      p.push(nx * r, ny * r, nz * r); n.push(nx, ny, nz);
    }
  }
  for (let v = 0; v < sv; v++)
    for (let u = 0; u < su; u++) {
      const a = v * (su + 1) + u, b = a + su + 1;
      i.push(a, b, a + 1, a + 1, b, b + 1);
    }
  return { p, n, i };
}

// Truncated cone about +Z, spanning z = 0..h. Cones are r1 = 0.
export function cyl(r0, r1, h, seg = 24, capBot = true, capTop = true) {
  const p = [], n = [], i = [];
  const slope = (r0 - r1) / h, sl = 1 / Math.hypot(1, slope);
  for (let v = 0; v <= 1; v++) {
    const r = v ? r1 : r0, z = v ? h : 0;
    for (let u = 0; u <= seg; u++) {
      const a = u / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      p.push(c * r, s * r, z); n.push(c * sl, s * sl, slope * sl);
    }
  }
  for (let u = 0; u < seg; u++) {
    const a = u, b = a + seg + 1;
    i.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const cap = (z, r, nz) => {
    if (r <= 1e-6) return;
    const c0 = p.length / 3;
    p.push(0, 0, z); n.push(0, 0, nz);
    for (let u = 0; u <= seg; u++) {
      const a = u / seg * Math.PI * 2;
      p.push(Math.cos(a) * r, Math.sin(a) * r, z); n.push(0, 0, nz);
    }
    for (let u = 0; u < seg; u++)
      if (nz > 0) i.push(c0, c0 + 1 + u, c0 + 2 + u);
      else i.push(c0, c0 + 2 + u, c0 + 1 + u);
  };
  if (capBot) cap(0, r0, -1);
  if (capTop) cap(h, r1, 1);
  return { p, n, i };
}

export function torus(R, r, su = 24, sv = 12) {
  const p = [], n = [], i = [];
  for (let v = 0; v <= sv; v++) {
    const b = v / sv * Math.PI * 2, cb = Math.cos(b), sb = Math.sin(b);
    for (let u = 0; u <= su; u++) {
      const a = u / su * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const nx = cb * ca, ny = cb * sa, nz = sb;
      p.push((R + r * cb) * ca, (R + r * cb) * sa, r * sb); n.push(nx, ny, nz);
    }
  }
  for (let v = 0; v < sv; v++)
    for (let u = 0; u < su; u++) {
      const a = v * (su + 1) + u, b = a + su + 1;
      i.push(a, a + 1, b, a + 1, b + 1, b);
    }
  return { p, n, i };
}

// Surface of revolution about +Z from a [[radius, z], ...] profile. The
// workhorse for helmets, shield bosses, pots, cannon barrels and quivers.
//
// ENDS ARE CAPPED unless the profile already closes to r = 0. An open lathe is
// a shell, and under this renderer you look straight down into it -- a
// breastplate becomes a cup and a pauldron becomes a bowl. Capping by default
// is the difference between a figure and a pile of crockery.
export function lathe(profile, seg = 24, capEnds = true) {
  const p = [], n = [], i = [];
  const rows = profile.length;
  const rn = [];
  for (let k = 0; k < rows; k++) {
    const a = profile[Math.max(0, k - 1)], b = profile[Math.min(rows - 1, k + 1)];
    const dr = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dr, dz) || 1;
    rn.push([dz / L, -dr / L]);        // outward normal in (r, z)
  }
  for (let k = 0; k < rows; k++)
    for (let u = 0; u <= seg; u++) {
      const a = u / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      p.push(c * profile[k][0], s * profile[k][0], profile[k][1]);
      n.push(c * rn[k][0], s * rn[k][0], rn[k][1]);
    }
  for (let k = 0; k < rows - 1; k++)
    for (let u = 0; u < seg; u++) {
      const a = k * (seg + 1) + u, b = a + seg + 1;
      i.push(a, a + 1, b, a + 1, b + 1, b);
    }
  if (capEnds) {
    const cap = (r, z, nz) => {
      if (r <= 1e-6) return;
      const c0 = p.length / 3;
      p.push(0, 0, z); n.push(0, 0, nz);
      for (let u = 0; u <= seg; u++) {
        const a = u / seg * Math.PI * 2;
        p.push(Math.cos(a) * r, Math.sin(a) * r, z); n.push(0, 0, nz);
      }
      for (let u = 0; u < seg; u++)
        if (nz > 0) i.push(c0, c0 + 1 + u, c0 + 2 + u);
        else i.push(c0, c0 + 2 + u, c0 + 1 + u);
    };
    cap(profile[0][0], profile[0][1], -1);
    cap(profile[rows - 1][0], profile[rows - 1][1], 1);
  }
  return { p, n, i };
}

// Extrude a 2D polygon (CCW in XY) along Z, centred on z = 0. Convex only --
// the caps are a triangle fan, which is all the shapes here need.
export function prism(poly, h) {
  const p = [], n = [], i = [], z = h / 2, N = poly.length;
  for (let k = 0; k < N; k++) {
    const a = poly[k], b = poly[(k + 1) % N];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = dy / L, ny = -dx / L, base = p.length / 3;
    p.push(a[0], a[1], -z, b[0], b[1], -z, b[0], b[1], z, a[0], a[1], z);
    for (let q = 0; q < 4; q++) n.push(nx, ny, 0);
    i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  for (const dir of [1, -1]) {
    const base = p.length / 3;
    for (const a of poly) { p.push(a[0], a[1], dir * z); n.push(0, 0, dir); }
    for (let k = 1; k < N - 1; k++)
      if (dir > 0) i.push(base, base + k, base + k + 1);
      else i.push(base, base + k + 1, base + k);
  }
  return { p, n, i };
}

// ------------------------------------------------------------- model
export class Model {
  constructor() {
    this.p = []; this.n = []; this.tp = [];
    this.i = []; this.triPart = [];
    this.parts = [];                    // { mat, N3 }
  }
  add(mat, prim, transform) {
    const m = transform || matId();
    const N3 = normalMat(m);
    const part = this.parts.length;
    this.parts.push({ mat, N3 });
    const base = this.p.length / 3;
    const src = prim.p, sn = prim.n;
    for (let k = 0; k < src.length; k += 3) {
      const x = src[k], y = src[k + 1], z = src[k + 2];
      this.p.push(m[0] * x + m[1] * y + m[2] * z + m[3],
                  m[4] * x + m[5] * y + m[6] * z + m[7],
                  m[8] * x + m[9] * y + m[10] * z + m[11]);
      this.tp.push(x, y, z);
      const nx = sn[k], ny = sn[k + 1], nz = sn[k + 2];
      let ax = N3[0] * nx + N3[1] * ny + N3[2] * nz;
      let ay = N3[3] * nx + N3[4] * ny + N3[5] * nz;
      let az = N3[6] * nx + N3[7] * ny + N3[8] * nz;
      const L = Math.hypot(ax, ay, az) || 1;
      this.n.push(ax / L, ay / L, az / L);
    }
    for (let k = 0; k < prim.i.length; k += 3) {
      this.i.push(base + prim.i[k], base + prim.i[k + 1], base + prim.i[k + 2]);
      this.triPart.push(part);
    }
    return this;
  }
  // Segment helper: a tapered tube from a to b. Limbs, planks, sword blades,
  // bow limbs and cannon barrels are all this call.
  tube(mat, a, b, r0, r1 = r0, seg = 14, caps = true) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const L = Math.hypot(dx, dy, dz);
    if (L < 1e-9) return this;
    // rotate +Z onto (dx,dy,dz): yaw about Z then pitch about Y
    const yaw = Math.atan2(dy, dx), pitch = Math.acos(Math.max(-1, Math.min(1, dz / L)));
    const m = matMul(matMul(matRY(pitch), matRZ(yaw)), matT(a[0], a[1], a[2]));
    return this.add(mat, cyl(r0, r1, L, seg, caps, caps), m);
  }
  ball(mat, c, r, s = [1, 1, 1], rot = {}) {
    return this.add(mat, sphere(r, 20, 12), xf({ t: c, s, ...rot }));
  }
  finalize() {
    return {
      p: new Float64Array(this.p), n: new Float64Array(this.n), tp: new Float64Array(this.tp),
      i: new Uint32Array(this.i), triPart: new Uint32Array(this.triPart), parts: this.parts,
    };
  }
}
