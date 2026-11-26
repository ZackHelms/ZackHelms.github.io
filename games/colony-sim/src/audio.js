// audio.js — synthesized only (house rule): surf, birds by day, crickets at night, and the
// thunk of an axe when the camera is close to someone chopping. Lazy context; mute persisted.
export function makeAudio() {
  const A = { ctx: null, muted: localStorage.getItem('colonySim.mute') === '1' };
  let master, surf, birds, crickets, noise;
  A.init = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = A.ctx = new AC();
    master = ctx.createGain(); master.gain.value = A.muted ? 0 : 0.6; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { b = 0.98 * b + 0.02 * (Math.random() * 2 - 1); d[i] = b * 6; }
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    surf = ctx.createGain(); surf.gain.value = 0; src.connect(lp); lp.connect(surf); surf.connect(master); src.start();
    birds = ctx.createGain(); birds.gain.value = 0; birds.connect(master);
    crickets = ctx.createGain(); crickets.gain.value = 0; crickets.connect(master);
  };
  A.setMuted = (m) => { A.muted = m; localStorage.setItem('colonySim.mute', m ? '1' : '0'); if (master) master.gain.value = m ? 0 : 0.6; };
  const chirp = (g, f0, f1, dur, vol) => {
    const ctx = A.ctx, o = ctx.createOscillator(), e = ctx.createGain(), t = ctx.currentTime;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(e); e.connect(g); o.start(t); o.stop(t + dur + 0.02);
  };
  A.thunk = (vol) => {
    if (!A.ctx || A.muted) return;
    const ctx = A.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), e = ctx.createGain(), t = ctx.currentTime;
    s.buffer = noise; f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 2;
    e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    s.connect(f); f.connect(e); e.connect(master); s.start(t, Math.random()); s.stop(t + 0.2);
  };
  A.tick = (night, shore, dt) => {
    if (!A.ctx || A.muted || !Number.isFinite(shore)) return;
    surf.gain.setTargetAtTime(0.05 + 0.12 * shore, A.ctx.currentTime, 0.5);
    if (!night && Math.random() < dt * 0.5) chirp(birds, 2400 + Math.random() * 1600, 3800 + Math.random() * 900, 0.09 + Math.random() * 0.08, 0.05);
    if (night && Math.random() < dt * 6) chirp(crickets, 4300, 4250, 0.04, 0.012);
    birds.gain.value = 1; crickets.gain.value = 1;
  };
  document.addEventListener('visibilitychange', () => { if (!A.ctx) return; if (document.hidden) A.ctx.suspend(); else A.ctx.resume(); });
  return A;
}
