// main.js — boot, the frame loop, camera input, follow, save/load.
import { createSim, step, applyInput, snapshot, restore, TICK, clockOf } from './sim.js';
import { heightAt, COVER } from './island.js';
import { makeRig, updateRig, rigCapsules } from './rig.js';
import { makeRenderer } from './render.js';
import { makeUI, SPEEDS } from './ui.js';
import { makeAudio } from './audio.js';

const SAVE = 'colonySim.v1';
const canvas = document.getElementById('view');
const G = { sim: null, R: null, rigs: [], views: [], prev: [], colors: [], speedIdx: 1, selected: null, following: false, acc: 0, overlay: false, lastSave: 0, loadedAt: 0, shownP1: false, nightSkip: false };
const audio = makeAudio();

function viewOf(s, i, a, mult) {
  const p = G.prev[i] || s, x = p.x + (s.x - p.x) * a, z = p.z + (s.z - p.z) * a;
  return { x, z, yaw: s.yaw, speed: s.speed * 48 * mult, act: s.act, look: s.look, carry: s.carry, face: s.face };
}
function boot(sim) {
  G.sim = sim; G.loadedAt = sim.t; G.shownP1 = !!sim.phase1;
  if (!G.R) {
    try { G.R = makeRenderer(canvas, sim.isl); } catch (e) { console.error(e); G.R = null; }
    if (!G.R) { document.getElementById('overlay-card').innerHTML = '<h1>Colony Sim</h1><p>This page needs WebGL2, which this browser does not offer.</p>'; document.getElementById('overlay').classList.remove('hidden'); return false; }
  } else G.R = makeRenderer(canvas, sim.isl);
  G.prev = sim.settlers.map((s) => ({ x: s.x, z: s.z }));
  G.views = sim.settlers.map((s, i) => viewOf(s, i, 1, 1));
  G.rigs = sim.settlers.map((s, i) => makeRig(G.views[i], sim.isl));
  G.colors = sim.settlers.map((s) => G.R.colorsFor(s.look));
  G.R.cam.tx = sim.isl.camp.x; G.R.cam.tz = sim.isl.camp.z; G.R.cam.ty = heightAt(sim.isl, sim.isl.camp.x, sim.isl.camp.z);
  G.R.cam.dist = 70; G.R.cam.pitch = 0.6;
  G.acc = 0; G.selected = null; G.following = false;
  return true;
}
function save() {
  try { localStorage.setItem(SAVE, JSON.stringify({ v: 1, snap: snapshot(G.sim) })); } catch (e) { /* storage full: keep playing */ }
}
function load() {
  const raw = localStorage.getItem(SAVE); if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || o.v !== 1 || !o.snap || typeof o.snap.seed !== 'number') throw new Error('unknown save');
    return restore(o.snap);
  } catch (e) { localStorage.setItem('colonySim.bad', raw); localStorage.removeItem(SAVE); return null; }
}

const api = {
  sim: () => G.sim, selected: () => G.selected, speedIdx: () => G.speedIdx, nightSkip: () => G.nightSkip, loadedAt: () => G.loadedAt,
  setSpeed(i) { G.speedIdx = i; audio.init(); },
  follow(id) {
    G.selected = id; G.following = id != null;
    if (id != null) { const r = G.rigs[id], p = r.J[0]; G.R.flyTo(p.x, p.y, p.z, Math.min(G.R.cam.dist, 9)); }
  },
  input(rec) { const out = applyInput(G.sim, rec); ui.parts = {}; return out; },
  overlayOpen(v) { G.overlay = v; },
  newGame(seed) { localStorage.removeItem(SAVE); boot(createSim(seed)); ui.refreshAll(); save(); },
};
let ui = null;

/* ------------------------------ input ------------------------------ */
let drag = null;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => { audio.init(); drag = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey, moved: 0 }; canvas.classList.add('drag'); });
window.addEventListener('mousemove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.b === 2 || drag.shift) { G.R.pan(dx, dy); G.following = false; } else G.R.orbit(dx, dy);
});
window.addEventListener('mouseup', (e) => {
  canvas.classList.remove('drag');
  if (drag && drag.moved < 5 && drag.b === 0) clickAt(e.clientX, e.clientY);
  drag = null;
});
canvas.addEventListener('wheel', (e) => { e.preventDefault(); G.R.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
function clickAt(x, y) {
  const r = canvas.getBoundingClientRect(); x -= r.left; y -= r.top;
  let best = null, bd = 46;
  G.rigs.forEach((rig, i) => {
    for (const j of [0, 2, 4]) { const p = G.R.project(rig.J[j].x, rig.J[j].y, rig.J[j].z); if (!p) continue; const d = Math.hypot(p.sx - x, p.sy - y); if (d < bd) { bd = d; best = i; } }
  });
  if (best != null) api.follow(best); else { G.selected = null; G.following = false; }
}
// touch: one finger orbits, two pan and pinch (phones still work, PC is the target)
let touch = null;
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); audio.init(); touch = tsnap(e); touch.moved = 0; touch.t0 = performance.now(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault(); if (!touch) return; const n = tsnap(e);
  if (n.n === 1 && touch.n === 1) { G.R.orbit(n.x - touch.x, n.y - touch.y); touch.moved += Math.abs(n.x - touch.x) + Math.abs(n.y - touch.y); }
  if (n.n === 2 && touch.n === 2) { G.R.pan(n.x - touch.x, n.y - touch.y); G.R.zoom(touch.d / n.d); touch.moved += 99; G.following = false; }
  Object.assign(touch, n);
}, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); if (touch && touch.moved < 8 && e.touches.length === 0 && performance.now() - touch.t0 < 400) clickAt(touch.x, touch.y); touch = e.touches.length ? Object.assign(tsnap(e), { moved: 99 }) : null; }, { passive: false });
function tsnap(e) { const t = e.touches, n = t.length; if (!n) return { n: 0, x: 0, y: 0, d: 1 }; let x = 0, y = 0; for (const p of t) { x += p.clientX; y += p.clientY; } return { n, x: x / n, y: y / n, d: n > 1 ? Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1 : 1 }; }
const keys = new Set();
window.addEventListener('keydown', (e) => {
  const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA')) return;
  if (e.code === 'Space') { e.preventDefault(); G.speedIdx = G.speedIdx ? 0 : (G.lastSpeed || 1); if (G.speedIdx) G.lastSpeed = G.speedIdx; }
  if (/^Digit[1-6]$/.test(e.code)) G.speedIdx = +e.code.slice(5) - 1;
  keys.add(e.code); audio.init();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
document.getElementById('mute-btn').addEventListener('click', (e) => { audio.init(); audio.setMuted(!audio.muted); e.currentTarget.textContent = audio.muted ? '🔇' : '🔊'; });
document.getElementById('mute-btn').textContent = audio.muted ? '🔇' : '🔊';

/* ------------------------------ the loop ------------------------------ */
let last = null, uiT = 0, chopT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!G.sim || !G.R) return;
  const dt = last == null ? 0 : Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  const sim = G.sim;
  // keyboard camera
  const kp = 300 * dt;
  if (keys.has('KeyW') || keys.has('ArrowUp')) { G.R.pan(0, kp); G.following = false; }
  if (keys.has('KeyS') || keys.has('ArrowDown')) { G.R.pan(0, -kp); G.following = false; }
  if (keys.has('KeyA') || keys.has('ArrowLeft')) { G.R.pan(kp, 0); G.following = false; }
  if (keys.has('KeyD') || keys.has('ArrowRight')) { G.R.pan(-kp, 0); G.following = false; }
  if (keys.has('KeyQ')) G.R.orbit(-200 * dt, 0); if (keys.has('KeyE')) G.R.orbit(200 * dt, 0);
  // time
  let mult = SPEEDS[G.speedIdx];
  G.nightSkip = mult > 0 && mult < 16 && sim.settlers.every((s) => s.act === 'sleep' || s.act === 'collapsed');
  if (G.nightSkip) mult = 16;
  if (G.overlay && document.querySelector('#ov-go')) mult = 0;
  G.acc += dt * 48 * mult;
  let n = 0;
  while (G.acc >= TICK && n < 400) {
    if (G.acc < 2 * TICK) G.prev = sim.settlers.map((s) => ({ x: s.x, z: s.z }));
    step(sim); G.acc -= TICK; n++;
  }
  if (n >= 400) { G.acc = 0; G.prev = sim.settlers.map((s) => ({ x: s.x, z: s.z })); }
  const a = Math.min(1, G.acc / TICK);
  // bodies
  sim.settlers.forEach((s, i) => { G.views[i] = viewOf(s, i, a, Math.max(mult, 0.001)); updateRig(G.rigs[i], G.views[i], dt, sim.isl); });
  if (G.following && G.selected != null && !G.R.cam.fly) {
    const p = G.rigs[G.selected].J[0], k = 1 - Math.exp(-dt * 6);
    G.R.cam.tx += (p.x - G.R.cam.tx) * k; G.R.cam.ty += (p.y - G.R.cam.ty) * k; G.R.cam.tz += (p.z - G.R.cam.tz) * k;
  }
  const out = G.R.frame(sim, G.rigs, (i) => rigCapsules(G.rigs[i], G.views[i]), now / 1000, { colors: G.colors, selected: G.selected });
  // sound: the shore is loud when the camera is near the sea
  const c = G.R.cam, shore = Math.max(0, 1 - (sim.isl.seaD[Math.floor(c.tz / 2) * sim.isl.W + Math.floor(c.tx / 2)] * 2) / 120) * Math.max(0, 1 - c.dist / 400);
  audio.tick(out.night > 0.5, shore, dt);
  chopT += dt;
  if (chopT > 0.7 && mult > 0) { chopT = 0; for (const s of sim.settlers) if ((s.act === 'chop' || s.act === 'mine' || s.act === 'build') && Math.hypot(s.x - c.tx, s.z - c.tz) < 40 && c.dist < 80) audio.thunk(0.25 * (1 - c.dist / 80)); }
  // the panels
  uiT += dt;
  const proj = (sid) => { const h = G.rigs[sid].J[4]; return G.R.project(h.x, h.y + 0.35, h.z); };
  ui.update(proj, now / 1000, uiT > 0.25);
  if (uiT > 0.25) uiT = 0;
  if (sim.phase1 && !G.shownP1) { G.shownP1 = true; ui.showPhase1(sim); }
  if (sim.t - G.lastSave > 3600) { G.lastSave = sim.t; save(); }
}
window.addEventListener('beforeunload', () => { if (G.sim) save(); });

const loaded = load();
if (loaded) {
  boot(loaded); G.lastSave = loaded.t; ui = makeUI(api);
  ui.showLoad(clockOf(loaded).day, () => {}, () => api.newGame(Math.floor(Math.random() * 99999) + 1));
} else { boot(createSim(Math.floor(Math.random() * 99999) + 1)); ui = makeUI(api); }
window.__CS = { G, api, step, applyInput };
requestAnimationFrame(frame);
