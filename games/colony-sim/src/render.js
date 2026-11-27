// render.js — hand-written WebGL2, deliberately blocky for this draft (CD: "rudimentary,
// like Minecraft for now"). Terrain is flat-shaded 2 m cells over the same heightfield the
// settlers walk on; everything else is instanced boxes, and settlers are instanced capsules
// over their rigs (the Combat Simulator approach). It only reads the simulation.
// The sky is zmh-sky's (src/sky.js, generated): its sun, moon and ambient light the scene.
// This file is the only place a calendar date exists; the sim stays date-free.
import { COVER, heightAt } from './island.js';
import { BUILDINGS } from './data.js';
import { ZMH_SKY, SKY_DATA, ZMH_SKY_WEBGL } from './sky.js';
import { DAY } from './sim.js';

// Plan colonysimc's calls (the CD's to overrule):
const SKY_OBSERVER = { latDeg: -15, lonEastDeg: -150, heightM: 0 };     // a South Pacific island at 15°S, 150°W
const SKY_START = { y: 2027, m: 7, d: 5 };                                // game day 1: two days after a new moon
const SKY_FRAME = { east: [1, 0, 0], up: [0, 1, 0], north: [0, 0, -1] }; // the island's own compass: +x east, +y up, -z north
// Tuned against screenshots: the July sun at 15°S stands 52° up in the north at noon and the
// land rises northward, away from it, so the sun and ambient gains are what keep midday as
// bright as the old overhead sun.
const SUN_GAIN = 1.8;                                                     // sunlight on the scene, x the kit's sun colour
const AMB_GAIN = 1.4;                                                     // sky ambient, x the kit's ambient
const NIGHT_FLOOR = [0.035, 0.042, 0.075];                                // a moonless night still shows the settlers (a watched sim)

const VS_TERRAIN = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC;
uniform mat4 uVP; out vec3 vW, vN, vC;
void main(){ vW = aPos; vN = aN; vC = aC; gl_Position = uVP * vec4(aPos, 1.0); }`;
const LIGHT = `
uniform vec3 uSun, uSunCol, uMoon, uMoonCol, uAmbSky, uAmbGround, uFog, uEye, uFire; uniform float uFogD, uFireI, uTime;
vec3 light(vec3 W, vec3 N, vec3 alb){
  float d = max(dot(N, uSun), 0.0);
  vec3 amb = mix(uAmbGround, uAmbSky, N.y * 0.5 + 0.5);
  vec3 c = alb * (amb + uSunCol * d + uMoonCol * max(dot(N, uMoon), 0.0));
  vec3 fl = uFire - W; float fd = length(fl);
  float fi = uFireI * (0.85 + 0.15 * sin(uTime * 13.0) * sin(uTime * 7.3)) / (1.0 + fd * fd * 0.09);
  c += alb * vec3(1.0, 0.55, 0.22) * fi * max(dot(N, fl / max(fd, 0.01)), 0.0);
  float f = 1.0 - exp(-length(W - uEye) / uFogD);
  return mix(c, uFog, clamp(f, 0.0, 0.8));
}`;
const FS_TERRAIN = `#version 300 es
precision highp float;
in vec3 vW, vN, vC; out vec4 o;
${LIGHT}
void main(){ vec3 c = light(vW, normalize(vN), pow(vC, vec3(2.2))); o = vec4(pow(c, vec3(1.0/2.2)), 1.0); }`;
const VS_BOX = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aN;
layout(location=2) in vec4 iP; layout(location=3) in vec3 iS; layout(location=4) in vec4 iC;
uniform mat4 uVP; out vec3 vW, vN, vC; out float vE;
void main(){
  float cy = cos(iP.w), sy = sin(iP.w), cp = cos(iC.w), sp = sin(iC.w);
  vec3 p = aPos * iS; vec3 n = aN;
  p = vec3(p.x * cp - p.y * sp, p.x * sp + p.y * cp, p.z); n = vec3(n.x * cp - n.y * sp, n.x * sp + n.y * cp, n.z);
  p = vec3(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy); n = vec3(n.x * cy - n.z * sy, n.y, n.x * sy + n.z * cy);
  vW = p + iP.xyz; vN = n; vC = abs(iC.rgb); vE = iC.r < 0.0 ? 1.0 : 0.0;
  gl_Position = uVP * vec4(vW, 1.0);
}`;
const FS_BOX = `#version 300 es
precision highp float;
in vec3 vW, vN, vC; in float vE; out vec4 o;
${LIGHT}
void main(){ vec3 c = vE > 0.5 ? vC * (0.8 + 0.2 * sin(uTime * 17.0 + vW.y * 9.0)) : light(vW, normalize(vN), pow(vC, vec3(2.2))); o = vec4(pow(c, vec3(1.0/2.2)), 1.0); }`;
const VS_CAP = `#version 300 es
layout(location=0) in vec3 aDir; layout(location=1) in float aEnd;
layout(location=2) in vec3 iA; layout(location=3) in vec3 iB; layout(location=4) in vec2 iR; layout(location=5) in vec3 iC;
uniform mat4 uVP; out vec3 vW, vN, vC;
void main(){
  vec3 ax = iB - iA; float L = length(ax); ax = L > 1e-5 ? ax / L : vec3(0.0, 1.0, 0.0);
  vec3 t = abs(ax.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 u = normalize(cross(t, ax)), v = cross(ax, u);
  vec3 n = u * aDir.x + ax * aDir.y + v * aDir.z;
  vec3 w = mix(iA, iB, aEnd) + n * mix(iR.x, iR.y, aEnd);
  vW = w; vN = n; vC = iC; gl_Position = uVP * vec4(w, 1.0);
}`;
const FS_CAP = `#version 300 es
precision highp float;
in vec3 vW, vN, vC; out vec4 o;
${LIGHT}
void main(){ vec3 N = normalize(vN); vec3 c = light(vW, N, vC); c += vec3(0.12, 0.13, 0.16) * pow(1.0 - max(dot(N, normalize(uEye - vW)), 0.0), 3.0); o = vec4(pow(c, vec3(1.0/2.2)), 1.0); }`;
const VS_WATER = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in float aK;
uniform mat4 uVP; uniform float uTime; out vec3 vW; out float vK;
void main(){ vec3 p = aPos; if (aK < 0.5) p.y += 0.05 * sin(p.x * 0.11 + uTime * 0.9) * cos(p.z * 0.13 + uTime * 0.7); vW = p; vK = aK; gl_Position = uVP * vec4(p, 1.0); }`;
const FS_WATER = `#version 300 es
precision highp float;
in vec3 vW; in float vK; out vec4 o;
${LIGHT}
uniform sampler2D uDepth; uniform vec4 uMap;
void main(){
  vec2 uv = (vW.xz - uMap.xy) / uMap.zw; float ground = texture(uDepth, uv).r * 60.0 - 30.0;
  float depth = max(vW.y - ground, 0.0);
  vec3 deep = vec3(0.03, 0.18, 0.32), shallow = vec3(0.18, 0.55, 0.6);
  if (vK > 1.5) { // the falls
    float s = fract(vW.y * 0.6 + uTime * 2.6 + sin(vW.x * 3.0) * 0.3);
    vec3 c = mix(vec3(0.75, 0.88, 0.95), vec3(0.95), step(0.6, s));
    o = vec4(pow(light(vW, vec3(0.0, 0.3, 1.0), c), vec3(1.0/2.2)), 0.85); return;
  }
  vec3 V = normalize(uEye - vW);
  float fres = pow(1.0 - max(V.y, 0.0), 3.0);
  vec3 c = mix(shallow, deep, clamp(depth / 6.0, 0.0, 1.0));
  vec3 N = normalize(vec3(0.04 * sin(vW.x * 0.7 + uTime * 1.3), 1.0, 0.04 * cos(vW.z * 0.6 + uTime * 1.1)));
  float sp = pow(max(dot(reflect(-uSun, N), V), 0.0), 80.0);
  float mp = pow(max(dot(reflect(-uMoon, N), V), 0.0), 80.0);
  c = light(vW, N, c) + uSunCol * sp * 0.8 + uMoonCol * mp * 0.8 + uAmbSky * fres * 0.4;
  float foam = smoothstep(0.35, 0.0, depth) * (0.5 + 0.5 * sin(uTime * 2.0 + vW.x * 0.5 + vW.z * 0.3));
  c = mix(c, vec3(0.9), foam * 0.5);
  o = vec4(pow(c, vec3(1.0/2.2)), clamp(0.55 + depth * 0.15 + fres * 0.3, 0.0, 0.94));
}`;
/* The sea beyond the sea mesh, out to the horizon. zmh-sky shades every direction below the
   horizon black (it is ground to the kit), and the sea mesh ends a few km out, so without this
   a black band shows between the far water and the sky, wider the higher the camera. A
   full-screen triangle at the far plane (LEQUAL, after the sky, before the water) shades only
   background pixels whose ray points down: the ray meets y = 0, that point is lit and fogged as
   the water is, then blended into the sky's own horizon colour at that compass bearing
   (uRing, 16 bearings, east = +x, north = -z) as the distance grows past the mesh, so the sea
   meets the sky with no seam. */
const VS_FAR = `#version 300 es
uniform mat4 uInvVP; out vec3 vRay;
vec3 unp(vec3 p){ vec4 h = uInvVP * vec4(p, 1.0); return h.xyz / h.w; }
void main(){
  vec2 ndc = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
  gl_Position = vec4(ndc, 1.0, 1.0);
  vRay = unp(vec3(ndc, 1.0)) - unp(vec3(ndc, -1.0));
}`;
const FS_FAR = `#version 300 es
precision highp float;
in vec3 vRay; out vec4 o;
${LIGHT}
uniform vec3 uRing[16];
void main(){
  vec3 d = normalize(vRay);
  if (d.y > -1e-5) discard;
  float t = uEye.y / -d.y; vec3 W = vec3(uEye.x + d.x * t, 0.0, uEye.z + d.z * t);
  vec3 V = -d, N = normalize(vec3(0.04 * sin(W.x * 0.7 + uTime * 1.3), 1.0, 0.04 * cos(W.z * 0.6 + uTime * 1.1)));
  float fres = pow(1.0 - max(V.y, 0.0), 3.0);
  float sp = pow(max(dot(reflect(-uSun, N), V), 0.0), 80.0), mp = pow(max(dot(reflect(-uMoon, N), V), 0.0), 80.0);
  vec3 c = light(W, N, vec3(0.03, 0.18, 0.32)) + uSunCol * sp * 0.8 + uMoonCol * mp * 0.8 + uAmbSky * fres * 0.4;
  float a = atan(d.x, -d.z) / 6.2831853 * 16.0; a = a < 0.0 ? a + 16.0 : a;
  int i = int(floor(a)) & 15; vec3 hz = mix(uRing[i], uRing[(i + 1) & 15], fract(a));
  c = mix(c, hz, smoothstep(4500.0, 40000.0, t));
  o = vec4(pow(max(c, 0.0), vec3(1.0/2.2)), 1.0);
}`;
const VS_DISC = `#version 300 es
layout(location=0) in vec2 aP; layout(location=1) in vec4 iD; layout(location=2) in vec4 iC;
uniform mat4 uVP; out vec2 vP; out vec4 vC;
void main(){ vP = aP; vC = iC; vec3 w = vec3(iD.x + aP.x * iD.w, iD.y, iD.z + aP.y * iD.w); gl_Position = uVP * vec4(w, 1.0); }`;
const FS_DISC = `#version 300 es
precision highp float;
in vec2 vP; in vec4 vC; out vec4 o;
void main(){ float r = length(vP); if (r > 1.0) discard;
  float a = vC.a > 0.0 ? (1.0 - smoothstep(0.3, 1.0, r)) * vC.a : smoothstep(0.78, 0.86, r) * (1.0 - smoothstep(0.92, 1.0, r)) * -vC.a;
  o = vec4(vC.rgb, a); }`;

/* ------------------------------ math ------------------------------ */
function persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; }
function lookAt(e, c) {
  let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2]; let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
}
function mmul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function inv(m) {
  const a = m, o = new Array(16);
  const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
  const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
  o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
  o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
  o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d; o[14] = (a[13] * b01 - a[12] * b03 - a[15] * b00) * d; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
  return o;
}
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => Math.pow(v, 2.2)); };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const COVER_COL = { 0: [0.32, 0.30, 0.22], 1: [0.86, 0.79, 0.55], 2: [0.48, 0.46, 0.43], 3: [0.36, 0.58, 0.22], 4: [0.2, 0.38, 0.14], 5: [0.42, 0.38, 0.35], 6: [0.5, 0.45, 0.3], 7: [0.5, 0.45, 0.3] };

/* ------------------------------ the renderer ------------------------------ */
export function makeRenderer(canvas, isl) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) return null;
  const prog = (vs, fs) => {
    const p = gl.createProgram();
    for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const sh = gl.createShader(t); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(p, sh);
    }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); U[u.name] = gl.getUniformLocation(p, u.name); }
    return { p, U };
  };
  const P = { terrain: prog(VS_TERRAIN, FS_TERRAIN), box: prog(VS_BOX, FS_BOX), cap: prog(VS_CAP, FS_CAP), water: prog(VS_WATER, FS_WATER), disc: prog(VS_DISC, FS_DISC), far: prog(VS_FAR, FS_FAR) };
  const farVAO = gl.createVertexArray();   // the far sea's triangle comes from gl_VertexID alone
  // The sky: zmh-sky's pass, created once. A bad config (a mirrored frame) throws here.
  let skyDpr = Math.min(2, window.devicePixelRatio || 1);
  const sky = ZMH_SKY_WEBGL.createSky(gl, { data: SKY_DATA, observer: SKY_OBSERVER, frame: SKY_FRAME, dpr: skyDpr });

  /* terrain: one flat-shaded quad per 2 m cell, coloured by land cover */
  const W = isl.W, H = isl.H, C = isl.CELL;
  const cellY = (cx, cz) => isl.h[Math.min(H - 1, Math.max(0, cz)) * W + Math.min(W - 1, Math.max(0, cx))];
  const cornerY = (x, z) => (cellY(x - 1, z - 1) + cellY(x, z - 1) + cellY(x - 1, z) + cellY(x, z)) / 4;
  const pos = [], nor = [], col = [], idx = [];
  let vi = 0;
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const y00 = cornerY(cx, cz), y10 = cornerY(cx + 1, cz), y01 = cornerY(cx, cz + 1), y11 = cornerY(cx + 1, cz + 1);
    if (Math.max(y00, y10, y01, y11) < -4) continue;
    const k = isl.cover[cz * W + cx], h = isl.h[cz * W + cx];
    let c = COVER_COL[k];
    if (k === COVER.SEA || h < 0.4) c = mix3(COVER_COL[1], [0.4, 0.38, 0.3], Math.min(1, -h / 4));
    if (k === COVER.GRASS && h > 22) c = mix3(c, [0.42, 0.5, 0.28], Math.min(1, (h - 22) / 20));
    const j = 0.94 + 0.12 * (((cx * 73856093) ^ (cz * 19349663)) % 1000 / 1000);
    const x0 = cx * C, z0 = cz * C, x1 = x0 + C, z1 = z0 + C;
    const ux = C, uy = y10 - y00, vx = C, vy = y01 - y00;
    let nx = -uy * C, ny = C * C, nz = -vy * C; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    pos.push(x0, y00, z0, x1, y10, z0, x0, y01, z1, x1, y11, z1);
    for (let q = 0; q < 4; q++) { nor.push(nx * 127, ny * 127, nz * 127); col.push(Math.min(255, c[0] * j * 255), Math.min(255, c[1] * j * 255), Math.min(255, c[2] * j * 255)); }
    idx.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3); vi += 4;
  }
  const tVAO = gl.createVertexArray(); gl.bindVertexArray(tVAO);
  const buf = (data, loc, size, type, normd) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, normd, 0, 0); return b; };
  buf(new Float32Array(pos), 0, 3, gl.FLOAT, false); buf(new Int8Array(nor), 1, 3, gl.BYTE, true); buf(new Uint8Array(col), 2, 3, gl.UNSIGNED_BYTE, true);
  const tIdx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
  const tCount = idx.length;

  /* a depth map of the sea floor for water colour */
  const dpx = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) dpx[i] = Math.max(0, Math.min(255, (isl.h[i] + 30) / 60 * 255));
  const dTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, dTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, W, H, 0, gl.RED, gl.UNSIGNED_BYTE, dpx);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  /* water: the sea plane, the pond and river cells, the falls */
  const wp = [], wk = [];
  const quad = (x0, z0, x1, z1, y, k) => { wp.push(x0, y, z0, x1, y, z0, x0, y, z1, x1, y, z0, x1, y, z1, x0, y, z1); for (let i = 0; i < 6; i++) wk.push(k); };
  quad(-3000, -3000, 4000, 3700, 0, 0);
  const pondY = isl.falls.bottom.y + 0.1;
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const k = isl.cover[cz * W + cx]; if (k !== COVER.POND && k !== COVER.RIVER) continue;
    const y = k === COVER.POND ? pondY : Math.max(0.05, isl.h[cz * W + cx] + 0.45);
    quad(cx * C, cz * C, cx * C + C, cz * C + C, y, 1);
  }
  { // the falls: a curtain from the lip to the pond
    const t = isl.falls.top, b = isl.falls.bottom, dx = t.x - b.x, dz = t.z - b.z, L = Math.hypot(dx, dz) || 1, sx = -dz / L * 2.2, sz = dx / L * 2.2;
    const lip = { x: b.x + dx / L * 4, z: b.z + dz / L * 4 };
    const v = [[lip.x - sx, t.y + 0.4, lip.z - sz], [lip.x + sx, t.y + 0.4, lip.z + sz], [b.x - sx * 1.2, b.y, b.z - sz * 1.2], [b.x + sx * 1.2, b.y, b.z + sz * 1.2]];
    for (const q of [0, 2, 1, 1, 2, 3]) { wp.push(...v[q]); wk.push(2); }
  }
  const wVAO = gl.createVertexArray(); gl.bindVertexArray(wVAO);
  buf(new Float32Array(wp), 0, 3, gl.FLOAT, false); buf(new Float32Array(wk), 1, 1, gl.FLOAT, false);
  const wCount = wp.length / 3;

  /* instanced boxes */
  const cube = [];
  const F = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  for (const n of F) {
    const a = n[0] ? [0, 1, 0] : [1, 0, 0], b = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
    const c = (s, t) => [n[0] * 0.5 + a[0] * s + b[0] * t, n[1] * 0.5 + a[1] * s + b[1] * t + 0.5, n[2] * 0.5 + a[2] * s + b[2] * t];
    for (const [s, t] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) cube.push(...c(s, t), ...n);
  }
  const mkInst = (baseData, stride, layout, perVertex) => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(baseData), gl.STATIC_DRAW);
    let off = 0; for (const [loc, size] of perVertex) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, perVertex.reduce((a, b) => a + b[1], 0) * 4, off); off += size * 4; }
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    off = 0; for (const [loc, size] of layout) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, off); gl.vertexAttribDivisor(loc, 1); off += size * 4; }
    return { vao, ib, n: 0, verts: baseData.length / perVertex.reduce((a, b) => a + b[1], 0) };
  };
  const boxStatic = mkInst(cube, 11, [[2, 4], [3, 3], [4, 4]], [[0, 3], [1, 3]]);
  const boxDyn = mkInst(cube, 11, [[2, 4], [3, 3], [4, 4]], [[0, 3], [1, 3]]);
  // capsule mesh: a unit sphere split into two hemispheres
  const sph = []; const SEG = 12, RING = 8;
  const sv = (i, j) => { const th = i / SEG * Math.PI * 2, ph = j / RING * Math.PI; return [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]; };
  for (let j = 0; j < RING; j++) for (let i = 0; i < SEG; i++) {
    const q = [sv(i, j), sv(i + 1, j), sv(i, j + 1), sv(i + 1, j), sv(i + 1, j + 1), sv(i, j + 1)];
    const end = j < RING / 2 ? 1 : 0;
    for (const p of q) sph.push(p[0], p[1], p[2], end);
  }
  // the cylinder between the two hemispheres: equator at end 0 joined to equator at end 1
  for (let i = 0; i < SEG; i++) {
    const a0 = sv(i, RING / 2), a1 = sv(i + 1, RING / 2);
    for (const [p, e] of [[a0, 0], [a1, 0], [a0, 1], [a1, 0], [a1, 1], [a0, 1]]) sph.push(p[0], p[1], p[2], e);
  }
  const capI = mkInst(sph, 11, [[2, 3], [3, 3], [4, 2], [5, 3]], [[0, 3], [1, 1]]);
  const discI = mkInst([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1], 8, [[1, 4], [2, 4]], [[0, 2]]);

  /* static scenery: trees, rocks, bushes. Rebuilt when the world changes. */
  let staticSig = '';
  const S = [];
  const box = (arr, x, y, z, sx, sy, sz, yaw, c, pitch = 0) => arr.push(x, y, z, yaw || 0, sx, sy, sz, c[0], c[1], c[2], pitch);
  function buildStatic(sim) {
    S.length = 0;
    const W2 = sim ? sim.world : { felled: {}, rocks: {}, bushes: {} };
    for (const t of isl.trees) {
      const y = heightAt(isl, t.x, t.z), j = (t.id * 2654435761 % 1000) / 1000;
      if (W2.felled[t.id]) { box(S, t.x, y - 0.1, t.z, 0.45, 0.5, 0.45, j, [0.35, 0.24, 0.13]); continue; }
      if (t.kind === 'palm') {
        box(S, t.x, y, t.z, 0.28, t.h, 0.28, j, [0.42, 0.32, 0.2]);
        for (let k = 0; k < 4; k++) box(S, t.x + Math.cos(k * 1.57 + j) * 1.1, y + t.h - 0.2, t.z + Math.sin(k * 1.57 + j) * 1.1, 2.6, 0.18, 0.7, k * 1.57 + j, [0.25, 0.5, 0.16], -0.25);
      } else if (t.kind === 'pine') {
        box(S, t.x, y, t.z, 0.35, t.h * 0.4, 0.35, j, [0.36, 0.25, 0.15]);
        for (let k = 0; k < 3; k++) { const w = 3.2 - k * 0.9; box(S, t.x, y + t.h * 0.3 + k * t.h * 0.22, t.z, w, t.h * 0.26, w, j + k * 0.4, [0.1 + 0.02 * k, 0.28 + 0.04 * j, 0.14]); }
      } else {
        box(S, t.x, y, t.z, 0.45, t.h * 0.55, 0.45, j, [0.38, 0.27, 0.15]);
        box(S, t.x, y + t.h * 0.45, t.z, 3.6 + j, t.h * 0.45, 3.6 + j, j, [0.18 + 0.06 * j, 0.36 + 0.08 * j, 0.12]);
        box(S, t.x + 0.6, y + t.h * 0.75, t.z - 0.4, 2.4, t.h * 0.3, 2.4, j + 0.7, [0.22 + 0.05 * j, 0.42, 0.15]);
      }
    }
    for (const r of isl.rocks) {
      const left = W2.rocks[r.id] ?? r.n; if (left <= 0) continue;
      const y = heightAt(isl, r.x, r.z), sc = r.s * (0.6 + 0.4 * left / r.n);
      box(S, r.x, y - 0.1, r.z, sc * 1.6, sc * 1.1, sc * 1.3, r.id, [0.5, 0.49, 0.46]);
    }
    for (const b of isl.bushes) {
      const y = heightAt(isl, b.x, b.z), n = W2.bushes[b.id] ?? b.berries;
      box(S, b.x, y, b.z, 1.4, 0.9, 1.4, b.id, [0.16, 0.34, 0.12]);
      for (let k = 0; k < Math.min(6, n); k++) box(S, b.x + Math.cos(k * 2.1 + b.id) * 0.55, y + 0.5 + (k % 3) * 0.12, b.z + Math.sin(k * 2.1 + b.id) * 0.55, 0.16, 0.16, 0.16, 0, [0.7, 0.05, 0.12]);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, boxStatic.ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(S), gl.STATIC_DRAW);
    boxStatic.n = S.length / 11;
  }
  buildStatic(null);

  /* camera */
  const cam = { tx: isl.camp.x, ty: heightAt(isl, isl.camp.x, isl.camp.z), tz: isl.camp.z, yaw: Math.atan2(isl.camp.z - isl.landing.z, isl.camp.x - isl.landing.x) + Math.PI, pitch: 0.55, dist: 60, fly: null };
  let VP = null, invVP = null, eye = [0, 0, 0], vw = 1, vh = 1;

  /* Fog: the sky's colour at the horizon, from the kit's disc-free radiance (never sampled
     from the pass, which would put the sun and moon in the fog). The mean over 8 azimuths at
     2° altitude, exposed and mapped 1 - exp(-x) like the pass's zmhAtmosphere, plus the night
     airglow: the pass's own value before its gamma, so the fog meets the horizon. Recomputed
     only when the clock has moved more than a game minute. */
  let fogJd = NaN, fogCol = [0, 0, 0];
  const horRing = new Float32Array(48);
  function skyFog(light) {
    if (Math.abs(light.jdUT - fogJd) <= 1 / 1440) return fogCol;
    const d = light.sun.dir, sunEnu = [d[0], d[1], -d[2]];   // host -> ENU under SKY_FRAME
    const alt = 2 * Math.PI / 180, sum = [0, 0, 0];
    for (let k = 0; k < 8; k++) {
      const az = k / 8 * Math.PI * 2, L = ZMH_SKY.skyRadiance([Math.cos(alt) * Math.sin(az), Math.sin(alt), Math.cos(alt) * Math.cos(az)], sunEnu, { quality: 'low' });
      for (let c = 0; c < 3; c++) sum[c] += 1 - Math.exp(-L[c] * light.exposure);
    }
    const ns = ZMH_SKY_WEBGL.SKY_DEFAULTS.nightSky;
    fogJd = light.jdUT; fogCol = sum.map((v, c) => v / 8 + light.nightFade * ns[c]);
    // the horizon ring for the far sea: the same disc-free colour just above the horizon
    // (0.5°) at 16 bearings, bearing k at azimuth k/16 turn east of north
    const lo = 0.5 * Math.PI / 180;
    for (let k = 0; k < 16; k++) {
      const az = k / 16 * Math.PI * 2, L = ZMH_SKY.skyRadiance([Math.cos(lo) * Math.sin(az), Math.sin(lo), Math.cos(lo) * Math.cos(az)], sunEnu, { quality: 'low' });
      for (let c = 0; c < 3; c++) horRing[k * 3 + c] = 1 - Math.exp(-L[c] * light.exposure) + light.nightFade * ns[c];
    }
    return fogCol;
  }
  /* The framebuffer rows the sky can show in, as [y, height] for gl.scissor. A software GPU
     (SwiftShader, which the gates run on) shades a full-screen pass in full even where the
     depth test then rejects it, and the kit's atmosphere is costly per pixel: unscissored it
     nearly doubled the frame (210 -> 400 ms at noon) with no sky in view. Below an elevation
     of -dip the kit only draws black anyway (it is ground to the kit); whatever background is
     left down there is the far sea's (VS_FAR), drawn unscissored after this. The camera never rolls, so a band of rows is exact, and
     a below-horizon elevation is reached lowest on the screen's side edge (ndc x = 1). */
  const unproj = (nx, ny, z) => { const m = invVP, w = m[3] * nx + m[7] * ny + m[11] * z + m[15]; return [(m[0] * nx + m[4] * ny + m[8] * z + m[12]) / w, (m[1] * nx + m[5] * ny + m[9] * z + m[13]) / w, (m[2] * nx + m[6] * ny + m[10] * z + m[14]) / w]; };
  const rayElev = (ny) => { const a = unproj(1, ny, -1), b = unproj(1, ny, 1), d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; return d[1] / Math.hypot(d[0], d[1], d[2]); };
  function skyRows(ch) {
    const s = -Math.sin(Math.atan2(Math.max(0, eye[1]), 1500) + 0.01);
    if (rayElev(1) < s) return [0, 0];       // no sky in view: draw nothing, still check the frame
    if (rayElev(-1) >= s) return [0, ch];
    let lo = -1, hi = 1;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (rayElev(m) >= s) hi = m; else lo = m; }
    const y0 = Math.max(0, Math.floor((lo + 1) / 2 * ch) - 2);
    return [y0, ch - y0];
  }
  // Everything the lit programs need, from the kit's lighting for this frame.
  function sceneLight(light) {
    const ambSky = light.ambient.map((a, c) => Math.max(a * AMB_GAIN, NIGHT_FLOOR[c]));
    return {
      sun: light.sun.dir, sunCol: light.sun.color.map((v) => v * SUN_GAIN),
      moon: light.moon.dir, moonCol: light.moon.color,
      ambSky, ambGround: ambSky.map((v) => v * 0.5), fog: skyFog(light),
    };
  }

  function setCommon(pg, U, env, t, fire) {
    gl.uniformMatrix4fv(U.uVP, false, VP);
    if (U.uSun) gl.uniform3fv(U.uSun, env.sun);
    if (U.uSunCol) gl.uniform3fv(U.uSunCol, env.sunCol);
    if (U.uMoon) gl.uniform3fv(U.uMoon, env.moon);
    if (U.uMoonCol) gl.uniform3fv(U.uMoonCol, env.moonCol);
    if (U.uAmbSky) gl.uniform3fv(U.uAmbSky, env.ambSky);
    if (U.uAmbGround) gl.uniform3fv(U.uAmbGround, env.ambGround);
    if (U.uFog) gl.uniform3fv(U.uFog, env.fog);
    if (U.uFogD) gl.uniform1f(U.uFogD, 2200);
    if (U.uEye) gl.uniform3fv(U.uEye, eye);
    if (U.uTime) gl.uniform1f(U.uTime, t);
    if (U.uFire) gl.uniform3fv(U.uFire, fire.p);
    if (U.uFireI) gl.uniform1f(U.uFireI, fire.i);
  }

  const dyn = [], caps = [], discs = [];
  function frame(sim, rigs, capsOf, t, opts = {}) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (dpr !== skyDpr) { skyDpr = dpr; sky.setConfig({ dpr }); }
    const cw = Math.floor(canvas.clientWidth * dpr), ch = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    vw = canvas.clientWidth; vh = canvas.clientHeight;
    gl.viewport(0, 0, cw, ch);
    const sig = Object.keys(sim.world.felled).length + ':' + JSON.stringify(sim.world.rocks).length + ':' + Object.values(sim.world.bushes).reduce((a, b) => a + b, 0);
    if (sig !== staticSig) { staticSig = sig; buildStatic(sim); }
    // camera
    if (cam.fly) { const k = Math.min(1, cam.fly.k += 0.06); const e = k * k * (3 - 2 * k); for (const f of ['tx', 'ty', 'tz', 'dist']) cam[f] = cam.fly.from[f] + (cam.fly.to[f] - cam.fly.from[f]) * e; if (k >= 1) cam.fly = null; }
    const ground = heightAt(isl, cam.tx, cam.tz);
    const cp = Math.cos(cam.pitch), ex = cam.tx + Math.cos(cam.yaw) * cp * cam.dist, ez = cam.tz + Math.sin(cam.yaw) * cp * cam.dist;
    let ey = cam.ty + Math.sin(cam.pitch) * cam.dist; ey = Math.max(ey, heightAt(isl, ex, ez) + 1.2, 0.8);
    eye = [ex, ey, ez];
    VP = mmul(persp(0.9, vw / vh, 0.25, 4000), lookAt(eye, [cam.tx, cam.ty, cam.tz]));
    invVP = inv(VP);
    // the sky's clock: game day 1 is SKY_START, game noon is local mean solar noon
    const dayIndex = Math.floor(sim.t / DAY), hour = (sim.t % DAY) / 3600;
    const jdUT = ZMH_SKY.gameClockToJd(SKY_START, dayIndex, hour, SKY_OBSERVER.lonEastDeg);
    const light = sky.update(jdUT);   // this frame's sun lights the opaque pass below
    const env = sceneLight(light);
    const night = 1 - Math.max(0, Math.min(1, (Math.sin(light.sun.altDeg * Math.PI / 180) + 0.08) / 0.35));
    const fireSite = sim.sites.find((x) => x.type === 'campfire' && x.done);
    const fire = { p: fireSite ? [fireSite.x, heightAt(isl, fireSite.x, fireSite.z) + 0.8, fireSite.z] : [0, -999, 0], i: fireSite ? 0.3 + night * 2.2 : 0 };

    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // terrain
    gl.disable(gl.CULL_FACE);
    gl.useProgram(P.terrain.p); setCommon(P.terrain, P.terrain.U, env, t, fire);
    gl.bindVertexArray(tVAO); gl.drawElements(gl.TRIANGLES, tCount, gl.UNSIGNED_INT, 0);
    // scenery and buildings
    gl.useProgram(P.box.p); setCommon(P.box, P.box.U, env, t, fire);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(boxStatic.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, boxStatic.n);
    dyn.length = 0; buildDynamic(sim, rigs, t);
    gl.bindBuffer(gl.ARRAY_BUFFER, boxDyn.ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dyn), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(boxDyn.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, dyn.length / 11);
    // settlers
    caps.length = 0;
    for (let i = 0; i < rigs.length; i++) { const arr = capsOf(i); for (let k = 0; k < arr.length; k += 9) caps.push(arr[k], arr[k + 1], arr[k + 2], arr[k + 3], arr[k + 4], arr[k + 5], arr[k + 6], arr[k + 7], ...opts.colors[i][arr[k + 8]]); }
    gl.useProgram(P.cap.p); setCommon(P.cap, P.cap.U, env, t, fire);
    gl.bindBuffer(gl.ARRAY_BUFFER, capI.ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(caps), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(capI.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, capI.verts, caps.length / 11);
    // the sky, at the far plane behind the opaque pass and BEFORE the water: the water writes
    // no depth, so a sky drawn after it would paint over open sea. It leaves BLEND off,
    // DEPTH_TEST on, LESS, depthMask true, and no program, VAO or ARRAY_BUFFER bound.
    // Scissored to the rows where it can show (skyRows); always called, so the kit checks the
    // frame's handedness every frame even when no row of sky is in view.
    const rows = skyRows(ch);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(0, rows[0], cw, rows[1]);
    sky.draw({ viewProj: VP, jdUT });
    gl.disable(gl.SCISSOR_TEST);
    // the far sea: background pixels below the horizon (the kit leaves them black); see VS_FAR
    gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
    gl.useProgram(P.far.p); setCommon(P.far, P.far.U, env, t, fire);
    gl.uniformMatrix4fv(P.far.U.uInvVP, false, invVP); gl.uniform3fv(P.far.U['uRing[0]'], horRing);
    gl.bindVertexArray(farVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthFunc(gl.LESS); gl.depthMask(true);
    // water (blended)
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.useProgram(P.water.p); setCommon(P.water, P.water.U, env, t, fire);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dTex); gl.uniform1i(P.water.U.uDepth, 0); gl.uniform4f(P.water.U.uMap, 0, 0, W * C, H * C);
    gl.bindVertexArray(wVAO); gl.drawArrays(gl.TRIANGLES, 0, wCount);
    // shadows and the selection ring
    discs.length = 0;
    for (let i = 0; i < rigs.length; i++) { const r = rigs[i], p = r.J[0]; discs.push(p.x, heightAt(isl, p.x, p.z) + 0.04, p.z, 0.5, 0, 0, 0, 0.45 * (1 - night * 0.6)); if (opts.selected === i) discs.push(p.x, heightAt(isl, p.x, p.z) + 0.05, p.z, 0.85, 1, 0.82, 0.3, -0.95); }
    gl.useProgram(P.disc.p); gl.uniformMatrix4fv(P.disc.U.uVP, false, VP);
    gl.bindBuffer(gl.ARRAY_BUFFER, discI.ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(discs), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(discI.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, discs.length / 8);
    gl.depthMask(true); gl.disable(gl.BLEND);
    return { night, light };
  }

  /* buildings by stage, piles, carried loads, traps, the fire */
  const WOOD = [0.52, 0.36, 0.2], LOG = [0.44, 0.3, 0.17], STONE = [0.52, 0.51, 0.48], THATCH = [0.66, 0.58, 0.32], CLOTH = [0.55, 0.45, 0.35];
  function buildDynamic(sim, rigs, t) {
    const L = sim.lay, fwd = L.fwd, right = L.right;
    const local = (x, f, r, y, sx, sy, sz, c, pitch = 0, dyaw = 0) => {
      const px = x.x + fwd.x * f + right.x * r, pz = x.z + fwd.z * f + right.z * r;
      box(dyn, px, heightAt(isl, x.x, x.z) + y, pz, sx, sy, sz, (x.yaw == null ? L.yaw : x.yaw) + dyaw, c, pitch);
    };
    for (const x of sim.sites) {
      const B = BUILDINGS[x.type], k = x.done ? 1 : x.prog / x.hours, [w, d, hgt] = B.size;
      const fy = { ...x, yaw: Math.atan2(fwd.z, fwd.x) };
      // materials waiting at the site
      if (!x.done) {
        for (let i = 0; i < Math.min(8, x.have.wood - Math.floor(k * x.need.wood)); i++) local(fy, -d / 2 - 1.2, -1 + (i % 4) * 0.5, 0.05 + Math.floor(i / 4) * 0.25, 1.6, 0.22, 0.22, LOG, 0, Math.PI / 2);
        for (let i = 0; i < Math.min(6, x.have.stone - Math.floor(k * x.need.stone)); i++) local(fy, -d / 2 - 1.6, 1.2 + (i % 3) * 0.4, 0.0, 0.35, 0.28, 0.35, STONE);
        if (k <= 0) { local(fy, 0, -w / 2, 0, 0.08, 0.5, 0.08, [0.8, 0.7, 0.4]); local(fy, 0, w / 2, 0, 0.08, 0.5, 0.08, [0.8, 0.7, 0.4]); continue; }
      }
      if (x.type === 'campfire') {
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; local(fy, Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0, 0.32, 0.24 * Math.min(1, k * 2), 0.32, STONE); }
        if (k > 0.5) { local(fy, 0, 0, 0.05, 1.1, 0.16, 0.16, LOG, 0, 0.5); local(fy, 0, 0, 0.12, 1.1, 0.16, 0.16, LOG, 0, -0.6); }
        if (x.done) for (let i = 0; i < 3; i++) { const fl = 0.5 + 0.25 * Math.sin(t * (7 + i) + i * 2); box(dyn, x.x + Math.sin(t * 3 + i) * 0.1, heightAt(isl, x.x, x.z) + 0.15, x.z + Math.cos(t * 2 + i) * 0.1, 0.35 - i * 0.08, fl + i * 0.1, 0.35 - i * 0.08, t + i, [-1.0, 0.45 + i * 0.15, 0.08]); }
        continue;
      }
      if (x.type === 'bed') { local(fy, 0, 0, 0.0, d, 0.35 * Math.min(1, k * 2), w, WOOD); if (k > 0.6) local(fy, 0, 0, 0.35, d * 0.9, 0.12, w * 0.85, [0.5, 0.25, 0.22]); continue; }
      // floor
      local(fy, 0, 0, -0.05, d, 0.18 * Math.min(1, k * 4), w, WOOD);
      const posts = Math.min(1, Math.max(0, (k - 0.15) / 0.2)), walls = Math.min(1, Math.max(0, (k - 0.35) / 0.35)), roof = Math.min(1, Math.max(0, (k - 0.7) / 0.3));
      const ph = hgt * posts;
      if (posts > 0) for (const [pf, pr] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) local(fy, pf * (d / 2 - 0.15), pr * (w / 2 - 0.15), 0.1, 0.2, ph, 0.2, WOOD);
      const wallC = x.type === 'storage' || x.type === 'dryrack' || x.type === 'toolbench' ? null : WOOD;
      if (walls > 0 && wallC && x.type !== 'leanto') {
        const wh = (hgt - 0.3) * walls;
        local(fy, d / 2 - 0.1, 0, 0.1, 0.14, wh, w, LOG);                 // back wall
        local(fy, 0, -w / 2 + 0.1, 0.1, d, wh, 0.14, LOG); local(fy, 0, w / 2 - 0.1, 0.1, d, wh, 0.14, LOG);
        local(fy, -d / 2 + 0.1, -w / 3, 0.1, 0.14, wh, w / 3, LOG); local(fy, -d / 2 + 0.1, w / 3, 0.1, 0.14, wh, w / 3, LOG); // a door in the front
      }
      if (x.type === 'leanto' && roof > 0) local(fy, 0, 0, hgt * 0.55, d * 1.1, 0.12, w * 1.05, THATCH, 0.55 * roof);
      else if (roof > 0 && wallC) { local(fy, -d / 4, 0, hgt - 0.1, d * 0.62, 0.14, w * 1.1, THATCH, 0.5); local(fy, d / 4, 0, hgt - 0.1, d * 0.62, 0.14, w * 1.1, THATCH, -0.5); }
      if (x.type === 'toolbench' && walls > 0) { local(fy, 0, 0, 0.8, d, 0.12, w, WOOD); if (x.done) { local(fy, 0, -0.4, 0.92, 0.1, 0.06, 0.5, [0.6, 0.6, 0.62]); local(fy, 0.1, 0.3, 0.92, 0.3, 0.06, 0.08, [0.4, 0.3, 0.2]); } }
      if (x.type === 'dryrack' && walls > 0) { local(fy, 0, 0, hgt * 0.9, 0.1, 0.1, w, WOOD); }
      if (x.type === 'storage' && walls > 0) { local(fy, 0, 0, 0.1, d * 0.98, 0.5 * walls, 0.1, LOG); }
    }
    // the stockpile: logs and stone at the storage spot
    const pile = L.pile;
    for (let i = 0; i < Math.min(40, sim.stock.wood); i++) local({ x: pile.x, z: pile.z, yaw: Math.atan2(fwd.z, fwd.x) }, -0.6 + (i % 4) * 0.3, -1.2 + Math.floor(i / 4 % 5) * 0.32, 0.15 + Math.floor(i / 20) * 0.3, 2.2, 0.26, 0.26, LOG, 0, 0);
    for (let i = 0; i < Math.min(30, sim.stock.stone); i++) local({ x: pile.x, z: pile.z, yaw: Math.atan2(fwd.z, fwd.x) }, 1.2 + (i % 3) * 0.45, -1 + Math.floor(i / 3 % 5) * 0.45, 0.15 + Math.floor(i / 15) * 0.3, 0.38, 0.3, 0.38, STONE);
    // food: baskets by the food store
    const units = sim.food.reduce((a, b) => a + b.n, 0);
    for (let i = 0; i < Math.min(12, Math.ceil(units / 3)); i++) local({ x: L.food.x, z: L.food.z, yaw: Math.atan2(fwd.z, fwd.x) }, -2.2, -1.5 + i * 0.4, 0, 0.35, 0.3, 0.35, [0.62, 0.5, 0.3]);
    for (const p of sim.piles) for (let i = 0; i < Math.min(4, p.n); i++) box(dyn, p.x, heightAt(isl, p.x, p.z) + 0.1 + i * 0.24, p.z, p.item === 'wood' ? 1.8 : 0.4, 0.24, p.item === 'wood' ? 0.24 : 0.4, 0.4 * i, p.item === 'wood' ? LOG : STONE);
    for (const tr of sim.traps) { box(dyn, tr.x, heightAt(isl, tr.x, tr.z), tr.z, 0.06, 0.5, 0.06, 0, WOOD); if (tr.catch) box(dyn, tr.x + 0.25, heightAt(isl, tr.x, tr.z), tr.z, 0.4, 0.22, 0.22, 0, [0.6, 0.5, 0.4]); }
    // what each settler carries
    sim.settlers.forEach((s, i) => {
      if (!s.carry) return; const r = rigs[i]; if (!r) return;
      const a = r.J[8], b = r.J[12], m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }, yaw = Math.atan2(b.z - a.z, b.x - a.x) - Math.PI / 2;
      const it = s.carry.item, n = Math.min(4, s.carry.n);
      for (let k = 0; k < n; k++) {
        if (it === 'wood') box(dyn, m.x, m.y - 0.1 + k * 0.17, m.z, 0.4, 0.17, 1.4, yaw, LOG);
        else if (it === 'stone') box(dyn, m.x, m.y - 0.12 + k * 0.2, m.z, 0.28, 0.2, 0.28, yaw + k, STONE);
        else box(dyn, m.x, m.y - 0.15, m.z, 0.42, 0.3, 0.32, yaw, it === 'fish' ? [0.5, 0.6, 0.65] : it === 'meat' ? [0.55, 0.42, 0.32] : [0.62, 0.48, 0.28]);
        if (it !== 'wood' && it !== 'stone') break;
      }
    });
  }

  function project(x, y, z) {
    if (!VP) return null;
    const m = VP, cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0.01) return null;
    return { sx: (cx / cw * 0.5 + 0.5) * vw, sy: (1 - (cy / cw * 0.5 + 0.5)) * vh, depth: cw };
  }
  // Where a screen point meets the ground (a ray march over the heightfield).
  function pickGround(sx, sy) {
    if (!invVP) return null;
    const nx = sx / vw * 2 - 1, ny = 1 - sy / vh * 2;
    const un = (z) => { const m = invVP, x = m[0] * nx + m[4] * ny + m[8] * z + m[12], y = m[1] * nx + m[5] * ny + m[9] * z + m[13], zz = m[2] * nx + m[6] * ny + m[10] * z + m[14], w = m[3] * nx + m[7] * ny + m[11] * z + m[15]; return [x / w, y / w, zz / w]; };
    const a = un(-1), b = un(1), d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d);
    for (let s = 0; s < Math.min(L, 3000); s += 1) { const p = [a[0] + d[0] / L * s, a[1] + d[1] / L * s, a[2] + d[2] / L * s]; if (p[1] < Math.max(0, heightAt(isl, p[0], p[2]))) return { x: p[0], z: p[2] }; }
    return null;
  }
  return {
    gl, cam, frame, project, pickGround,
    orbit(dx, dy) { cam.yaw += dx * 0.006; cam.pitch = Math.max(0.08, Math.min(1.45, cam.pitch + dy * 0.005)); },
    pan(dx, dy) {
      // drag the ground: the point under the cursor follows it
      const k = cam.dist * 0.0016, fx = -Math.cos(cam.yaw), fz = -Math.sin(cam.yaw), rx = -fz, rz = fx;
      cam.tx += (-rx * dx + fx * dy) * k; cam.tz += (-rz * dx + fz * dy) * k;
      cam.tx = Math.max(-100, Math.min(1100, cam.tx)); cam.tz = Math.max(-100, Math.min(800, cam.tz));
      cam.ty = Math.max(0, heightAt(isl, cam.tx, cam.tz));
    },
    zoom(f) { cam.dist = Math.max(3, Math.min(900, cam.dist * f)); },
    flyTo(x, y, z, dist) { cam.fly = { k: 0, from: { tx: cam.tx, ty: cam.ty, tz: cam.tz, dist: cam.dist }, to: { tx: x, ty: y, tz: z, dist: dist == null ? cam.dist : dist } }; },
    colorsFor: (look) => [hex(look.skin), hex(look.shirt), hex(look.pants), hex(look.boots), hex(look.hair), hex(look.hat || look.hair), [0.4, 0.28, 0.15], [0.55, 0.56, 0.6]],
  };
}
