#!/usr/bin/env node
/**
 * drive-interlock-render.cjs — the lighting and material contract the CD set
 * on 2026-09-20.
 *
 *   NODE_PATH=<dir-with-playwright-core>/node_modules \
 *     node .claude/tests/drive-interlock-render.cjs
 *
 * The brief was specific and every clause is a row here:
 *   - the ONLY light sources are the sun and the moon;
 *   - plus a low ambient that comes from the sky (blue and clouds) by day;
 *   - and a very low one at night, like moonlight on terrain;
 *   - shadows, for real;
 *   - and refraction through the glass materials that shows the OTHER pieces'
 *     edges, not just the background.
 *
 * Why this is worth a file rather than a screenshot: every one of those is a
 * property nobody notices regressing. A fill light added back to "brighten
 * things up" looks fine in a still. A material change that pushes the glass
 * opaque still looks like glass. Shadows silently switching off look like a
 * lighting tweak. All three are cheap to assert and impossible to eyeball.
 *
 * Absolute performance is NOT asserted here: this container renders WebGL on
 * SwiftShader, so every frame time it reports is software rasterization and
 * means nothing about a phone. See .claude/interlock.md for the measured
 * relative shares.
 */
'use strict';
const path = require('path');
const zlib = require('zlib');
const { chromium } = require('playwright-core');

const PAGE = 'file://' + path.resolve(__dirname, '..', '..', 'games', 'interlock', 'index.html');
const W = 400, H = 560;

let bad = 0;
const fail = (m) => { bad++; console.log('  FAIL ' + m); };
const ok = (c, m) => { if (c) console.log('  ok   ' + m); else fail(m); };

/* --- a minimal PNG reader, so pixel rows need no dependency ------------- */
function decodePNG(buf) {
  let pos = 8, w = 0, h = 0, ct = 6, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), typ = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (typ === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    if (typ === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride), i = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[i++]; const line = Buffer.from(raw.subarray(i, i + stride)); i += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    line.copy(out, y * stride); prev = line;
  }
  return { w, h, bpp, px: out };
}
const lum = (im, x, y) => {
  const i = (y * im.w + x) * im.bpp;
  return 0.2126 * im.px[i] + 0.7152 * im.px[i + 1] + 0.0722 * im.px[i + 2];
};
const meanLum = (im) => {
  let s = 0, n = 0;
  for (let y = 0; y < im.h; y += 2) for (let x = 0; x < im.w; x += 2) { s += lum(im, x, y); n++; }
  return s / n;
};
/* Sobel-ish detail density in a window, which is how "can you see the other
 * pieces through it" becomes a number: interior edges are high-frequency
 * content strictly inside the board's silhouette. */
function detail(im, x0, y0, x1, y1, thresh) {
  let n = 0, tot = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const gx = Math.abs(lum(im, x + 1, y) - lum(im, x - 1, y));
    const gy = Math.abs(lum(im, x, y + 1) - lum(im, x, y - 1));
    tot++; if (gx + gy > thresh) n++;
  }
  return n / tot;
}
function diffFraction(a, b, thresh) {
  let n = 0, tot = 0;
  for (let y = 0; y < a.h; y += 2) for (let x = 0; x < a.w; x += 2) {
    const i = (y * a.w + x) * a.bpp;
    const d = Math.abs(a.px[i] - b.px[i]) + Math.abs(a.px[i + 1] - b.px[i + 1]) + Math.abs(a.px[i + 2] - b.px[i + 2]);
    tot++; if (d > thresh) n++;
  }
  return n / tot;
}

/* Wait in RENDERED FRAMES, never milliseconds.
 *
 * This container rasterizes WebGL in software and a frame here can cost 300-700
 * ms under load, so a fixed 900 ms pause after winding the clock was one or two
 * frames. That is fragile on its own and worth fixing — but a word of warning
 * about how this helper came to exist, because the reasoning behind it was
 * wrong and the wrong reasoning is the more useful lesson.
 *
 * The night row started failing (103 mean luminance against 129 at noon) and
 * it was diagnosed as a timing flake, because it had passed earlier and was now
 * failing inside two unrelated negative tests. It was not a flake. A previous
 * negative test had left a line in world.js that overwrote the night sky with
 * daytime blue on every frame, and the sweep for leftover sabotage checked
 * three of the four markers and missed that one. The gate was right the whole
 * time; the tree was dirty.
 *
 * Two things follow, and both are worth more than the helper. When a gate that
 * has teeth suddenly disagrees with you, the tree is the first suspect, not the
 * gate — measure the property directly before theorising about the harness
 * (here: screenshot the night frame and look at it, which took one command and
 * settled it). And a sabotage sweep must enumerate EVERY break that was
 * applied, not the ones that come to mind. */
const frames = (page, n = 4) => page.evaluate((k) => new Promise((res) => {
  let i = 0;
  const step = () => (++i >= k ? res(i) : requestAnimationFrame(step));
  requestAnimationFrame(step);
}), n).catch(() => null);

async function until(page, fn, label, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn)) return true;
    await frames(page, 1);
  }
  fail('timed out after ' + ms + 'ms waiting for ' + label);
  return false;
}

// wind the clock, then wait for the rig to actually reflect it
async function setClock(page, sec, want) {
  await page.evaluate((x) => window.interlock.clock(x), sec);
  await until(page, want, 'the rig to reach t=' + sec);
  await frames(page, 6);
}

async function open(browser, material, background, t) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.addInitScript(([m, b]) => {
    localStorage.setItem('interlock-settings', JSON.stringify({
      material: m, background: b, master: 0, effects: 0, ambient: 0, muted: true, min: 10, max: 10,
    }));
  }, [material, background]);
  await page.goto(PAGE, { waitUntil: 'load' });
  await until(page, () => !!(window.interlock && window.interlock.state.pieces.length), 'the board to exist');
  await frames(page, 5);
  if (t !== undefined) await setClock(page, t, () => window.interlock.rig().lights[0].intensity > 0.5);
  return { ctx, page, errs };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'],
  });

  /* ===== 1. the light rig ============================================== */
  console.log('-- only the sun and the moon --');
  {
    const { ctx, page, errs } = await open(browser, 'pine', 'meadow', 240);
    const rig = await page.evaluate(() => window.interlock.rig());
    const types = rig.lights.map((l) => l.type);
    ok(rig.lights.length === 2, 'exactly two lights in the scene (got ' + rig.lights.length + ': ' + types.join(', ') + ')');
    ok(types.every((t) => t === 'DirectionalLight'), 'both are DirectionalLights');
    // the three that used to be here, by name, so a revert is named in the failure
    for (const banned of ['HemisphereLight', 'AmbientLight', 'PointLight', 'SpotLight', 'RectAreaLight']) {
      ok(!types.includes(banned), 'no ' + banned + ' (ambient must come from the sky, not a light)');
    }
    ok(rig.environment === true, 'scene.environment is set — the sky IS the ambient');
    ok(rig.environmentIntensity > 0.3 && rig.environmentIntensity < 1.6,
       'sky ambient is low but not off (environmentIntensity ' + rig.environmentIntensity + ')');
    ok(rig.shadowMapEnabled === true, 'shadow mapping is enabled');
    ok(rig.receivers === 10, 'all ten pieces receive shadows (got ' + rig.receivers + ')');
    ok(rig.casters === 10, 'and all ten opaque pieces cast them (got ' + rig.casters + ')');
    ok(errs.length === 0, 'no console errors (' + errs.slice(0, 2).join(' | ') + ')');
    await ctx.close();
  }

  /* ===== 2. one caster at a time, and it changes hands at night ======== */
  console.log('-- the sun casts by day, the moon by night, never both --');
  {
    const { ctx, page } = await open(browser, 'pine', 'meadow', 240);
    const day = await page.evaluate(() => window.interlock.rig());
    ok(day.lights.filter((l) => l.castShadow).length === 1, 'exactly one shadow-casting light by day');
    ok(day.lights[0].castShadow && day.lights[0].intensity > 1, 'and it is the sun (intensity ' + day.lights[0].intensity + ')');
    ok(day.lights[1].intensity === 0, 'the moon contributes nothing at midday (got ' + day.lights[1].intensity + ')');

    await setClock(page, 960, () => window.interlock.rig().lights[0].intensity === 0);
    const night = await page.evaluate(() => window.interlock.rig());
    ok(night.lights.filter((l) => l.castShadow).length === 1, 'still exactly one shadow-casting light at night');
    ok(night.lights[0].intensity === 0, 'the sun is off at night (got ' + night.lights[0].intensity + ')');
    ok(night.lights[1].intensity > 0 && night.lights[1].intensity < 0.4,
       'the moon is on, and very dim (got ' + night.lights[1].intensity + ')');
    ok(night.lights[1].castShadow === true, 'and it is the one casting');
    await ctx.close();
  }

  /* ===== 3. night really is night ===================================== */
  console.log('-- night is dark, and still readable --');
  {
    const { ctx, page } = await open(browser, 'pine', 'meadow', 240);
    const noon = decodePNG(await page.screenshot());
    await setClock(page, 960, () => window.interlock.rig().lights[0].intensity === 0);
    const night = decodePNG(await page.screenshot());
    const ln = meanLum(noon), lt = meanLum(night);
    ok(ln > 90, 'midday is bright (mean luminance ' + ln.toFixed(1) + ')');
    ok(lt < ln * 0.55, 'night is far darker (' + lt.toFixed(1) + ' vs ' + ln.toFixed(1) + ')');
    // the point of the moon term: not a black screen
    ok(lt > 8, 'but not black — the moon still lights it (' + lt.toFixed(1) + ')');
    await ctx.close();
  }

  /* ===== 4. shadows change pixels ===================================== */
  console.log('-- shadows are doing something --');
  {
    // Same page, same board, toggled at runtime. An earlier version compared
    // two page loads with shadows compiled in and out, read 20%, and was
    // measuring two DIFFERENT random boards (2026-09-20) — the classic green
    // for the wrong reason.
    //
    // The area is genuinely small (0.35-0.44% of the frame over five runs) and
    // that is correct: the pieces are flush faces of one solid, so the only
    // places anything can cast are the recesses. Both floors sit ~2x under the
    // observed minimum, and the second row demands real DARKENING rather than
    // mere change, so a shader that only dithered would not pass.
    const { ctx, page } = await open(browser, 'pine', 'meadow', 240);
    const on = decodePNG(await page.screenshot());
    await page.evaluate(() => window.interlock.shadows(false));
    await frames(page, 6);
    const off = decodePNG(await page.screenshot());
    const f = diffFraction(on, off, 10);
    ok(f > 0.0020, (100 * f).toFixed(2) + '% of the frame changes when shadow mapping is turned off');
    let dark = 0;
    for (let y = 0; y < on.h; y++) for (let x = 0; x < on.w; x++) {
      if (lum(off, x, y) - lum(on, x, y) > 12) dark++;
    }
    ok(dark > 180, dark + ' pixels are meaningfully DARKER with shadows on (a shadow, not a wobble)');
    await page.evaluate(() => window.interlock.shadows(true));
    await ctx.close();
  }

  /* ===== 5. you can see the OTHER PIECES through the glass ============ */
  console.log('-- glass shows the other pieces, not just the background --');
  {
    // The edge lines have to be OPAQUE. three renders only the opaque list
    // into the transmission target, so a transparent line is invisible through
    // glass — the exact defect this brief was about.
    const { ctx, page } = await open(browser, 'honey', 'meadow', 240);
    const e = await page.evaluate(() => window.interlock.edges());
    ok(e && e.transparent === false,
       'edge lines are opaque, so they reach the transmission pass (transparent=' + (e && e.transparent) + ')');
    await ctx.close();
  }
  {
    // All three glasses, because they differ in ior, roughness and absorption
    // and a change to one is usually a change to the shared formula. Ratio
    // floors sit under the observed minimum (1.67x, honey) with margin; a
    // cross-MATERIAL comparison was tried first and could not discriminate at
    // all, because opaque pine's wood grain scored higher than two of the
    // three glasses on interior detail (2026-09-20).
    const x0 = Math.round(W * 0.32), x1 = Math.round(W * 0.68);
    const y0 = Math.round(H * 0.38), y1 = Math.round(H * 0.62);
    for (const material of ['ice', 'honey', 'jello']) {
      const { ctx, page } = await open(browser, material, 'meadow', 240);
      const clear = decodePNG(await page.screenshot());
      await page.evaluate(() => window.interlock.transmission(false));
      await frames(page, 6);
      const opaque = decodePNG(await page.screenshot());
      const dOn = detail(clear, x0, y0, x1, y1, 18), dOff = detail(opaque, x0, y0, x1, y1, 18);
      const f = diffFraction(clear, opaque, 18);
      ok(dOn > dOff * 1.35, material + ': interior detail collapses when transmission is off (' +
         (100 * dOn).toFixed(1) + '% -> ' + (100 * dOff).toFixed(1) + '%, ratio ' + (dOn / dOff).toFixed(2) + 'x)');
      ok(f > 0.20, material + ': and ' + (100 * f).toFixed(1) + '% of the frame changes with it');
      await ctx.close();
    }
  }

  /* ===== 6. the sky drives the ambient ================================ */
  console.log('-- the ambient follows the sky --');
  {
    const { ctx, page } = await open(browser, 'metal', 'meadow', 240);
    const a = decodePNG(await page.screenshot());
    // same board, same clock, different sky: a polished-metal board reflects
    // the environment, so its pixels must move when the sky does
    await setClock(page, 960, () => window.interlock.rig().lights[0].intensity === 0);
    const b = decodePNG(await page.screenshot());
    const f = diffFraction(a, b, 24);
    ok(f > 0.25, 'the board itself changes with the hour (' + (100 * f).toFixed(1) + '% of pixels)');
    await ctx.close();
  }

  await browser.close();
  console.log('INTERLOCK-RENDER: ' + (bad ? 'RED' : 'GREEN'));
  process.exit(bad ? 1 : 0);
})();
