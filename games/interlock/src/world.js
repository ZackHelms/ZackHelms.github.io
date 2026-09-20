import * as T from './vendor/three.module.min.js';

/* ===========================================================================
 * world.js — sky, terrain, water and the light rig.
 *
 * LIGHTING MODEL (CD, 2026-09-20). The only light sources are:
 *   1. the sun, a directional light, shadow-casting while it is up;
 *   2. the moon, a directional light opposite it, very dim, shadow-casting
 *      while the sun is down;
 *   3. the sky itself, as image-based ambient — a PMREM of the same sky shader
 *      the player is looking at, so the ambient really is the blue and the
 *      clouds overhead, and at night really is just the moon's glow on a dark
 *      sky.
 * There is no fill light, no rim light and no studio environment. Those three
 * (a HemisphereLight at intensity 2, a second DirectionalLight at 2, and a
 * PMREM of three white quads) are what this file replaced: they lit the cube
 * from directions with nothing in them, which is why it never read as being
 * outdoors.
 *
 * The consequence to keep in mind when touching anything here: ambient is now
 * a CONSEQUENCE of the sky, not a number. Brightening the night means changing
 * the night sky or the exposure curve, never adding a light.
 * ========================================================================= */

/* --- deterministic value noise, for terrain and nothing else -------------
 * Seeded so a background looks the same every time it is chosen in a session
 * and across reloads; the sky's noise lives in the shader instead. */
function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function noiseField(seed) {
  const N = 256, g = new Float32Array(N * N), rnd = mulberry(seed);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const at = (x, y) => g[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return function value(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return (a + (b - a) * xf) + ((c + (d - c) * xf) - (a + (b - a) * xf)) * yf;
  };
}

function fbm(value, x, y, octaves, ridged) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    let v = value(x * freq, y * freq);
    if (ridged) { v = 1 - Math.abs(v * 2 - 1); v *= v; }
    sum += v * amp; norm += amp; amp *= 0.5; freq *= 2.03;
  }
  return sum / norm;
}

/* --- the sky ------------------------------------------------------------
 * One shader draws the gradient, the sun and its glow, the moon, two drifting
 * cloud decks and the stars. Everything the eye reads as "sky" is in here on
 * purpose: the same material is put on a small sphere and run through PMREM
 * for the ambient, so the light in the scene and the picture behind it can
 * never disagree. It is also written as OPAQUE (depthWrite off, drawn first),
 * which matters beyond tidiness — three's transmission pass renders only the
 * opaque list into the refraction target, so an sky built out of transparent
 * sprites would vanish when seen through a glass piece. */
const SKY_VERT = `
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const SKY_FRAG = `
precision highp float;
varying vec3 vDir;
uniform vec3  uSunDir, uMoonDir, uZenith, uHorizon, uGround, uSunCol, uMoonCol;
uniform float uDay, uTime, uHaze, uCloud, uStars;

float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1,0)), c = hash21(i + vec2(0,1)), d = hash21(i + vec2(1,1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm2(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ s += vnoise(p) * a; p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

// A cloud deck read as a flat layer at height h: project the view ray onto it,
// so clouds compress towards the horizon the way real ones do. Two decks at
// different heights drifting at different speeds give parallax without a
// single transparent sprite.
float deck(vec3 dir, float h, float scale, float speed, float cover){
  if (dir.y <= 0.012) return 0.0;
  vec2 uv = dir.xz / dir.y * h * scale + vec2(uTime * speed, uTime * speed * 0.37);
  float n = fbm2(uv);
  float f = smoothstep(cover, cover + 0.30, n);
  return f * smoothstep(0.012, 0.16, dir.y);          // fade into the haze
}

void main(){
  vec3 dir = normalize(vDir);
  float h  = dir.y;
  float mu = dot(dir, uSunDir);

  // --- gradient. Horizon stays hazy and pale, zenith deepens.
  float t   = pow(clamp(h, 0.0, 1.0), 0.45);
  vec3  col = mix(uHorizon, uZenith, t);
  col = mix(uGround, col, smoothstep(-0.10, 0.02, h));  // below the horizon

  // --- stars, before the sun and clouds so both can wash them out
  if (uStars > 0.001) {
    vec2 cell = floor(dir.xz / max(abs(dir.y), 0.28) * 34.0 + 31.7);
    float r = hash21(cell);
    if (r > 0.9835) {
      vec2 c  = (dir.xz / max(abs(dir.y), 0.28) * 34.0 + 31.7) - cell - 0.5;
      float d = length(c);
      float tw = 0.65 + 0.35 * sin(uTime * (1.4 + r * 9.0) + r * 60.0);
      float mag = (1.0 - smoothstep(0.0, 0.16, d)) * (0.35 + hash21(cell + 3.3));
      vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.88, 0.74), hash21(cell + 9.1));
      col += tint * mag * tw * uStars * smoothstep(0.0, 0.18, h);
    }
  }

  // --- the moon: a crisp disc with faint maria. The halo is deliberately
  //     tight (2200, not 700) — a moon is a hard-edged disc, and a soft glow
  //     around it reads as a lens artifact rather than as moonlight.
#ifndef PROBE
  float mm = dot(dir, uMoonDir);
  col += uMoonCol * pow(max(mm, 0.0), 2200.0) * 0.30;
  if (mm > 0.99965) {
    vec2 mp = (dir.xz - uMoonDir.xz) * 420.0;
    float maria = fbm2(mp * 1.7 + 4.0);
    col = mix(col, uMoonCol * (1.32 - maria * 0.42), smoothstep(0.99965, 0.99975, mm));
  }
#endif

  // --- the sun: disc, tight glow, then a wide mie haze that also warms the
  //     whole sky on its side. This is what makes dawn and dusk read.
  // The WIDE mie haze stays in the probe: that really is sky luminance on the
  // sun's side and it is what warms the ambient at dawn and dusk. The tight
  // glow and the disc are the sun itself, and the sun is a light.
  col += uSunCol * pow(max(mu, 0.0), 9.0) * 0.22 * (0.35 + uDay * 0.9);
  col += uSunCol * pow(max(mu, 0.0), 2.4) * uHaze * (1.0 - smoothstep(0.0, 0.55, h)) * 0.55;
#ifndef PROBE
  col += uSunCol * pow(max(mu, 0.0), 220.0) * 1.1 * (0.35 + uDay * 0.9);
  col = mix(col, uSunCol * 2.4, smoothstep(0.99975, 0.99985, mu));   // the disc
#endif

  // --- clouds. Lit from the sun side, shadowed underneath; they go grey and
  //     then almost black as the sun sets, never disappearing into the sky.
  // scale is in noise-cells across the deck; at 0.08 the whole sky sampled a
  // single cell and the clouds came out as one flat wash (2026-09-20)
  float lo = deck(dir, 1.0, 3.10, 0.0042, 0.48);
  float hi = deck(dir, 2.2, 1.55, 0.0019, 0.56);
  float c  = clamp(lo * 0.85 + hi * 0.55, 0.0, 1.0) * uCloud;
  if (c > 0.001) {
    float lit  = 0.35 + 0.65 * pow(max(mu, 0.0), 1.6);
    vec3 shade = mix(vec3(0.16, 0.19, 0.26), vec3(0.62, 0.66, 0.74), uDay);
    vec3 bright= mix(uMoonCol * 0.45, mix(vec3(1.0), uSunCol, 0.45) * 1.06, uDay);
    col = mix(col, mix(shade, bright, lit), c * (0.55 + 0.45 * uDay));
  }

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function skyMaterial(uniforms, probe) {
  return new T.ShaderMaterial({
    uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    defines: probe ? { PROBE: 1 } : {},
    side: T.BackSide, depthWrite: false, depthTest: true, toneMapped: true, fog: false,
  });
}

/* --- a seamless ripple normal map for water, baked once ------------------ */
function rippleNormals() {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d'), img = ctx.createImageData(N, N), v = noiseField(7717);
  const hAt = (x, y) => fbm(v, x / N * 6, y / N * 6, 4, false);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = hAt(x + 1, y) - hAt(x - 1, y), dy = hAt(x, y + 1) - hAt(x, y - 1);
    const n = [-dx * 5, -dy * 5, 1], l = Math.hypot(n[0], n[1], n[2]), i = (y * N + x) * 4;
    img.data[i] = (n[0] / l * 0.5 + 0.5) * 255;
    img.data[i + 1] = (n[1] / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (n[2] / l * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  return tex;
}

/* A soft round dot, so a Points sprite is a flake and not a quad. */
let DOT = null;
function softDot() {
  if (DOT) return DOT;
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), rad = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  rad.addColorStop(0, 'rgba(255,255,255,1)');
  rad.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  rad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rad; g.fillRect(0, 0, N, N);
  DOT = new T.CanvasTexture(c);
  return DOT;
}

/* --- per-background terrain shaping -------------------------------------
 * Height is (base + amplitude * fbm) * falloff, and the falloff is the part
 * that matters: it holds the ground flat and low directly under the puzzle and
 * only lets the landscape rise further out, so no ridge can ever grow through
 * the board the player is trying to read. */
const GROUND_Y = -7.2;
const PRESETS = {
  meadow:    { amp: 19, rim: 30, ridged: false, oct: 5, scale: 0.030, water: null,
               low: 0x3f6b2f, high: 0x6e8f45, rock: 0x6b6152, peak: 0x86a05a, seed: 41 },
  mountains: { amp: 62, rim: 86, ridged: true,  oct: 6, scale: 0.016, water: null,
               low: 0x5d7551, high: 0x6c7563, rock: 0x7b7e84, peak: 0xf4f8fb, seed: 7 },
  beach:     { amp: 11, rim: 20, ridged: false, oct: 4, scale: 0.026, water: 0x1d7e9e,
               low: 0xcdb287, high: 0xe0cca4, rock: 0x9c8d74, peak: 0x8fa762, seed: 23 },
  arctic:    { amp: 30, rim: 52, ridged: true,  oct: 5, scale: 0.019, water: 0x5f8ba0,
               low: 0xc3d7e4, high: 0xe6f1f8, rock: 0x767f88, peak: 0xffffff, seed: 90 },
};

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.root = new T.Group();
    scene.add(this.root);
    this.moving = [];
    this.kind = 'none';

    /* Shadow budget: one 2048 map is crisp over the ~28-unit box the puzzle
     * lives in (73 texels a unit), but two of them on a phone is 32 MB of
     * depth texture for a picture nobody is looking at, so halve it there. */
    const big = Math.min(innerWidth, innerHeight) > 520 && devicePixelRatio <= 2;
    this.bigDevice = big;
    const SM = big ? 2048 : 1024;

    const shadowed = (light) => {
      light.castShadow = true;
      light.shadow.mapSize.set(SM, SM);
      const c = light.shadow.camera;
      c.left = c.bottom = -14; c.right = c.top = 14; c.near = 1; c.far = 140;
      c.updateProjectionMatrix();
      light.shadow.bias = -0.0004;        // against acne on the flat cube faces
      light.shadow.normalBias = 0.022;    // against peter-panning on thin pieces
      light.shadow.radius = 3;            // PCFSoft blur, in texels
      return light;
    };

    this.sun = shadowed(new T.DirectionalLight(0xfff0d8, 3));
    this.moon = shadowed(new T.DirectionalLight(0xb9ccf2, 0.16));
    scene.add(this.sun, this.sun.target, this.moon, this.moon.target);

    /* The sky, and the ambient that comes out of it. One uniforms object is
     * shared by the dome the player sees and the sphere PMREM reads, so the
     * two cannot drift apart. */
    this.sky = {
      uSunDir:  { value: new T.Vector3(0, 1, 0) },
      uMoonDir: { value: new T.Vector3(0, -1, 0) },
      uZenith:  { value: new T.Color(0x2f6ec4) },
      uHorizon: { value: new T.Color(0xbfd8ea) },
      uGround:  { value: new T.Color(0x53585c) },
      uSunCol:  { value: new T.Color(0xfff1d6) },
      uMoonCol: { value: new T.Color(0xd8e4ff) },
      uDay:     { value: 1 },
      uTime:    { value: 0 },
      uHaze:    { value: 0.5 },
      uCloud:   { value: 1 },
      uStars:   { value: 0 },
    };
    this.dome = new T.Mesh(new T.SphereGeometry(1, 48, 32), skyMaterial(this.sky));
    this.dome.scale.setScalar(900);
    this.dome.renderOrder = 1000;
    this.dome.frustumCulled = false;
    scene.add(this.dome);
    this.dome.visible = false;

    // the miniature the ambient is cooked from
    this.probe = new T.Scene();
    this.probe.add(new T.Mesh(new T.SphereGeometry(1, 24, 16), skyMaterial(this.sky, true)));
    this.pmrem = new T.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    this.envTarget = null;
    this.envAlt = 99;                    // forces a bake on the first tick

    this.ripple = null;
  }

  /* One bake of the sky into an environment map. Called from tick() only when
   * the sun has actually moved, because fromScene() allocates a render target
   * each time and the old one has to go back. */
  bakeEnv() {
    const next = this.pmrem.fromScene(this.probe, 0.0, 0.1, 100);
    if (this.envTarget) this.envTarget.dispose();
    this.envTarget = next;
    this.scene.environment = next.texture;
  }

  mesh(geo, mat, x, y, z) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    this.root.add(m);
    return m;
  }

  /* Every preset field is read into vertex positions, and a missing one
   * multiplies to NaN — which does not throw, it just produces a geometry with
   * no bounding sphere and an empty screen (2026-09-20: `beach` lost its `rim`
   * to a bad search-and-replace and only a console warning said so). Check the
   * table rather than trusting it. */
  static checkPresets() {
    const need = ['amp', 'rim', 'oct', 'scale', 'seed', 'low', 'high', 'rock', 'peak'];
    for (const [k, P] of Object.entries(PRESETS)) {
      for (const f of need) {
        if (!Number.isFinite(P[f])) throw new Error('world preset ' + k + '.' + f + ' is not a number');
      }
      if (P.water !== null && !Number.isFinite(P.water)) throw new Error('world preset ' + k + '.water is invalid');
    }
    return Object.keys(PRESETS);
  }

  set(kind) {
    this.kind = kind;
    // the water's normal map is a per-background CLONE, so disposing the
    // material is not enough to release it
    this.root.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) { o.material.normalMap?.dispose(); o.material.map?.dispose(); o.material.dispose(); }
    });
    this.root.clear();
    this.moving = [];
    this.envAlt = 99;                    // the sky changed; re-bake the ambient

    if (kind === 'none') {
      // The void. Still sun-plus-ambient, but the sky behind it is black and
      // the cycle is pinned to daylight, because a background the player chose
      // to be empty must not also become unreadable for twelve minutes.
      this.scene.background = new T.Color(0);
      this.scene.fog = null;
      this.dome.visible = false;
      this.sky.uZenith.value.setHex(0x6b7a9c);
      this.sky.uHorizon.value.setHex(0x49536a);
      this.sky.uGround.value.setHex(0x262b36);
      this.sky.uCloud.value = 0;
      this.sky.uStars.value = 0;
      this.sky.uHaze.value = 0;
      return;
    }

    const P = PRESETS[kind];
    World.checkPresets();
    this.scene.background = null;        // the dome is the background now
    this.dome.visible = true;
    this.sky.uCloud.value = kind === 'arctic' ? 0.85 : 1;
    this.sky.uHaze.value = kind === 'beach' ? 0.75 : kind === 'arctic' ? 0.35 : 0.5;
    this.scene.fog = new T.FogExp2(0x9ec4da, kind === 'mountains' ? 0.0030 : 0.0040);

    this.buildTerrain(P);
    if (P.water) this.buildWater(P);
    if (kind === 'meadow') this.buildGrass();
    if (kind === 'arctic') this.buildSnowfall();
  }

  /* --- terrain ----------------------------------------------------------
   * A displaced heightfield with baked vertex colours, replacing the flat
   * plane plus twenty-two random cones this used to be. Colour comes from
   * height AND slope, which is what stops it reading as a painted gradient:
   * steep faces go to rock at any altitude, flats take snow or grass. */
  buildTerrain(P) {
    const N = this.bigDevice ? 168 : 96, SIZE = 720, v = noiseField(P.seed), v2 = noiseField(P.seed + 811);
    const geo = new T.PlaneGeometry(SIZE, SIZE, N, N);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, n = pos.count;
    const col = new Float32Array(n * 3);
    const c = new T.Color(), lo = new T.Color(P.low), hi = new T.Color(P.high),
          rk = new T.Color(P.rock), pk = new T.Color(P.peak);

    const heightAt = (x, z) => {
      const r = Math.hypot(x, z);
      // flat and low under the board, rising only once well clear of it
      const keep = T.MathUtils.smoothstep(r, 16, 104);
      let e = fbm(v, x * P.scale, z * P.scale, P.oct, P.ridged);
      if (P.ridged) e = Math.pow(e, 1.35);
      const detail = fbm(v2, x * P.scale * 5.5, z * P.scale * 5.5, 3, false) - 0.5;
      // The rim. Without it the far edge of the ground plane IS the skyline,
      // which reads as a ruler-straight horizon however much relief is nearer
      // in (2026-09-20). Lifting the distance into hills hides the edge and
      // gives the valley a rim to sit in.
      const rim = T.MathUtils.smoothstep(r, 150, 360) * P.rim
        * (0.45 + 1.05 * fbm(v, x * P.scale * 0.55 + 40, z * P.scale * 0.55 + 40, 4, P.ridged));
      return GROUND_Y + (e * P.amp + detail * P.amp * 0.08) * keep + rim;
    };
    this.heightAt = heightAt;                    // grass and snow settle on it

    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
    }
    geo.computeVertexNormals();
    const nor = geo.attributes.normal;
    for (let i = 0; i < n; i++) {
      const y = pos.getY(i), slope = 1 - nor.getY(i);
      const alt = T.MathUtils.clamp((y - GROUND_Y) / Math.max(1, P.amp + P.rim * 0.75), 0, 1);
      c.copy(lo).lerp(hi, T.MathUtils.smoothstep(alt, 0.05, 0.55));
      c.lerp(pk, T.MathUtils.smoothstep(alt, 0.62, 0.92));
      c.lerp(rk, T.MathUtils.smoothstep(slope, 0.22, 0.62));   // steep goes rocky
      // Two scales of mottle. The broad one is what stops a flat valley floor
      // reading as a painted plane; the fine one keeps it from banding.
      const m = (0.82 + 0.36 * fbm(v2, x * 0.010, z * 0.010, 3, false))
              * (0.95 + 0.10 * v2(x * 0.09, z * 0.09));
      col[i * 3] = c.r * m; col[i * 3 + 1] = c.g * m; col[i * 3 + 2] = c.b * m;
    }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));

    const m = this.mesh(geo, new T.MeshStandardMaterial({
      vertexColors: true, roughness: 0.96, metalness: 0,
      envMapIntensity: 0.65,          // ground takes less sky than the board does
    }), 0, 0, 0);
    m.receiveShadow = true;
    m.castShadow = false;             // one tight shadow camera; see constructor
  }

  /* --- water ------------------------------------------------------------
   * A scrolling normal map over a near-mirror surface. The colour is almost
   * all reflected sky, which is the point: it changes with the hour for free,
   * and at night it is the moon's path on dark water. */
  buildWater(P) {
    if (!this.ripple) this.ripple = rippleNormals();
    const tex = this.ripple.clone();
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(15, 15);
    const mat = new T.MeshStandardMaterial({
      color: P.water, roughness: 0.075, metalness: 0.06,
      normalMap: tex, envMapIntensity: 1.5,
    });
    mat.normalScale.set(0.30, 0.30);
    const sea = this.mesh(new T.PlaneGeometry(900, 900), mat, 0, GROUND_Y + 1.15, 0);
    sea.rotation.x = -Math.PI / 2;
    sea.receiveShadow = false;
    this.moving.push({ type: 'sea', tex });
  }

  buildGrass() {
    const rnd = mulberry(5150), COUNT = this.bigDevice ? 2600 : 1500;
    const blade = new T.ConeGeometry(0.13, 0.5, 3);
    blade.translate(0, 0.25, 0);
    const mesh = new T.InstancedMesh(blade, new T.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.9, envMapIntensity: 0.6,
    }), COUNT);
    const d = new T.Object3D(), c = new T.Color();
    for (let i = 0; i < COUNT; i++) {
      // a ring around the board, never under it
      // sqrt keeps the ring evenly dense instead of bunching at the inside
      const a = rnd() * Math.PI * 2, r = 14 + Math.sqrt(rnd()) * 84;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      d.position.set(x, (this.heightAt ? this.heightAt(x, z) : GROUND_Y) - 0.08, z);
      d.rotation.set((rnd() - 0.5) * 0.25, rnd() * 6.3, (rnd() - 0.5) * 0.25);
      d.scale.set(0.8 + rnd() * 0.6, 0.8 + rnd() * 1.3, 0.8 + rnd() * 0.6);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      c.setHSL(0.23 + rnd() * 0.07, 0.45 + rnd() * 0.22, 0.17 + rnd() * 0.14);
      mesh.setColorAt(i, c);
    }
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false;
    this.root.add(mesh);
    this.moving.push({ type: 'grass', mesh });
  }

  buildSnowfall() {
    const rnd = mulberry(311), COUNT = this.bigDevice ? 1100 : 650, p = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      // a ring, never the column the board occupies: a near flake is drawn
      // large by size attenuation and reads as a white square stuck to a piece
      const a = rnd() * Math.PI * 2, r = 34 + rnd() * 72;
      p[i * 3] = Math.cos(a) * r;
      p[i * 3 + 1] = rnd() * 60 + GROUND_Y;
      p[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(p, 3));
    const flakes = new T.Points(g, new T.PointsMaterial({
      color: 0xf2fbff, size: 0.22, map: softDot(), transparent: true, opacity: 0.75,
      depthWrite: false, sizeAttenuation: true,
    }));
    flakes.frustumCulled = false;
    this.root.add(flakes);
    this.moving.push({ type: 'snow', mesh: flakes });
  }

  /* --- per-frame --------------------------------------------------------
   * Returns the day factor, 0 at night and 1 at noon, which game.js uses for
   * exposure and audio. */
  tick(t) {
    const phase = t / 1440 * Math.PI * 2 + 0.65;
    const alt = Math.sin(phase);
    const day = T.MathUtils.smoothstep(alt, -0.2, 0.5);
    const S = this.sky;

    const sunDir = new T.Vector3(Math.cos(phase) * 0.80, alt, -0.24).normalize();
    const moonDir = sunDir.clone().negate();
    S.uSunDir.value.copy(sunDir);
    S.uMoonDir.value.copy(moonDir);
    S.uTime.value = t;
    S.uDay.value = day;

    /* The sun's own colour reddens as it sets — this is the only place the
     * warm dusk comes from, since there is no longer a tinted fill light to
     * fake it with. */
    const low = 1 - T.MathUtils.smoothstep(alt, -0.05, 0.42);
    S.uSunCol.value.setHSL(0.115 - low * 0.085, 0.35 + low * 0.55, 0.72 - low * 0.10);
    this.sun.color.copy(S.uSunCol.value);
    this.sun.intensity = 3.4 * T.MathUtils.smoothstep(alt, -0.09, 0.22);
    this.sun.position.copy(sunDir).multiplyScalar(70);
    this.moon.position.copy(moonDir).multiplyScalar(70);
    this.moon.intensity = 0.17 * T.MathUtils.smoothstep(-alt, -0.05, 0.30);

    // exactly one shadow map is rendered per frame
    const sunUp = this.sun.intensity > 0.05;
    this.sun.castShadow = sunUp;
    this.moon.castShadow = !sunUp && this.moon.intensity > 0.01;

    if (this.kind === 'none') {
      // pinned daylight from a fixed angle, black sky, low neutral ambient
      this.sun.color.setHex(0xfff2de);
      this.sun.intensity = 3.1;
      this.sun.position.set(-26, 46, 34);
      this.sun.castShadow = true;
      this.moon.intensity = 0; this.moon.castShadow = false;
      if (this.envAlt !== 0) { this.bakeEnv(); this.envAlt = 0; }
      this.scene.environmentIntensity = 1.5;
      return 1;
    }

    /* Sky colours. Zenith deepens as the sun climbs; the horizon keeps a pale
     * haze so the terrain has something to fade into. */
    const night = 1 - day;
    S.uZenith.value.setHex(this.kind === 'arctic' ? 0x3a78bd : 0x2a68c6)
      .lerp(new T.Color(0x05070f), night * 0.97);
    S.uHorizon.value.setHex(this.kind === 'beach' ? 0xd2e2ec : 0xbcd6e8)
      .lerp(new T.Color(0x0b1020), night * 0.94);
    // the warm band, strongest when the sun is right on the horizon
    const dusk = Math.max(0, 1 - Math.abs(alt - 0.02) / 0.26);
    if (dusk > 0) {
      S.uHorizon.value.lerp(new T.Color(0xe08a52), dusk * 0.62);
      S.uZenith.value.lerp(new T.Color(0x4a4a86), dusk * 0.22);
    }
    S.uGround.value.copy(S.uHorizon.value).multiplyScalar(0.45);
    S.uStars.value = Math.pow(night, 1.6);
    S.uMoonCol.value.setHex(0xdce8ff).multiplyScalar(0.55 + 0.45 * night);

    this.scene.fog.color.copy(S.uHorizon.value);
    this.scene.environmentIntensity = 0.82;

    /* Re-bake the ambient only when the sun has actually moved. Over one
     * 24-minute cycle this runs a couple of hundred times, not 86 000. */
    if (Math.abs(alt - this.envAlt) > 0.018) { this.bakeEnv(); this.envAlt = alt; }

    for (const o of this.moving) {
      if (o.type === 'sea') { o.tex.offset.x = t * 0.0065; o.tex.offset.y = t * 0.0031; }
      if (o.type === 'grass') o.mesh.rotation.z = Math.sin(t * 0.7) * 0.006;
      if (o.type === 'snow') {
        const a = o.mesh.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) {
          let y = a.getY(i) - 0.035;
          if (y < GROUND_Y - 2) y = GROUND_Y + 60;
          a.setY(i, y);
          a.setX(i, a.getX(i) + Math.sin(t * 0.6 + i) * 0.004);
        }
        a.needsUpdate = true;
      }
    }
    return day;
  }
}
