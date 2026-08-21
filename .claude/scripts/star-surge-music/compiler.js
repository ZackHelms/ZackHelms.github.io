'use strict';
// webaudio-score/v1 compiler — pure function score -> flat time-sorted note events.
// Shared source: this exact function body is embedded verbatim into
// games/star-surge/index.html. Keep the two in sync by copying, not by hand-editing twice.

const PERC_IDS = new Set([
  'kick', 'subkick', 'snare', 'clap', 'hat-closed', 'hat-open', 'tom', 'crash',
  'glitch-tick', 'breath-noise-wash',
]);

const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteToMidi(name) {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name);
  if (!m) throw new Error('bad note name: ' + name);
  let semi = NOTE_BASE[m[1].toUpperCase()];
  if (m[2] === '#') semi += 1; else if (m[2] === 'b') semi -= 1;
  const oct = parseInt(m[3], 10);
  if (oct < 0 || oct > 8) throw new Error('note octave out of C0..C8: ' + name);
  return (oct + 1) * 12 + semi;
}
function noteToFreq(name) { return 440 * Math.pow(2, (noteToMidi(name) - 69) / 12); }

function tokenizePattern(pat, isDrum) {
  if (isDrum) return pat.replace(/\s+/g, '').split('');
  return pat.trim().split(/\s+/).filter(Boolean);
}

function compileScore(score) {
  const { bars, beatsPerBar, stepsPerBeat: defaultSpb, bpm, swing = 0, tracks } = score;
  if (!bars || !beatsPerBar || !defaultSpb || !bpm) throw new Error('score missing bars/beatsPerBar/stepsPerBeat/bpm');
  const events = [];
  for (const tr of tracks) {
    const isDrum = PERC_IDS.has(tr.inst);
    const spb = tr.stepsPerBeat || defaultSpb;
    const stepsPerBar = beatsPerBar * spb;
    const totalSteps = stepsPerBar * bars;
    const stepDurBeats = 1 / spb;
    if (tr.sequence.length !== bars) throw new Error(`track ${tr.inst}: sequence length ${tr.sequence.length} != bars ${bars}`);
    const flat = [];
    for (const name of tr.sequence) {
      if (name === '.') { for (let i = 0; i < stepsPerBar; i++) flat.push('.'); continue; }
      const pat = tr.patterns[name];
      if (!pat) throw new Error(`track ${tr.inst}: missing pattern "${name}"`);
      const toks = tokenizePattern(pat, isDrum);
      if (toks.length !== stepsPerBar) throw new Error(`track ${tr.inst}: pattern "${name}" has ${toks.length} steps, expected ${stepsPerBar}`);
      flat.push(...toks);
    }
    if (isDrum) {
      for (let i = 0; i < totalSteps; i++) {
        const tok = flat[i];
        if (tok === '.') continue;
        const vel = tok === 'X' ? 1.0 : tok === 'x' ? 0.72 : null;
        if (vel == null) throw new Error(`track ${tr.inst}: bad drum token "${tok}" at step ${i}`);
        let timeBeats = i * stepDurBeats;
        if (swing && (i % spb) % 2 === 1) timeBeats += swing * stepDurBeats;
        events.push({ timeBeats, durationBeats: stepDurBeats, frequencyHz: 0, velocity: vel, instrument: tr.inst, gain: tr.gain });
      }
    } else {
      let cur = null;
      const closeCur = (endIdx) => {
        if (!cur) return;
        const durSteps = endIdx - cur.startIdx;
        if (durSteps <= 0) { cur = null; return; }
        let timeBeats = cur.startIdx * stepDurBeats;
        if (swing && (cur.startIdx % spb) % 2 === 1) timeBeats += swing * stepDurBeats;
        const durationBeats = durSteps * stepDurBeats;
        for (const f of cur.freqs) events.push({ timeBeats, durationBeats, frequencyHz: f, velocity: cur.vel, instrument: tr.inst, gain: tr.gain });
        cur = null;
      };
      for (let i = 0; i < totalSteps; i++) {
        const tok = flat[i];
        if (tok === '.') { closeCur(i); continue; }
        if (tok === '-') { continue; }
        closeCur(i);
        const freqs = tok.split('+').map(noteToFreq);
        cur = { startIdx: i, freqs, vel: 0.85 };
      }
      closeCur(totalSteps);
    }
  }
  events.sort((a, b) => a.timeBeats - b.timeBeats);
  const loopBeats = beatsPerBar * bars;
  const secondsPerBeat = 60 / bpm;
  return { events, loopBeats, secondsPerBeat, loopSeconds: loopBeats * secondsPerBeat };
}

function validateScore(score) {
  // compileScore already throws on every structural problem (bad note names,
  // octave range, pattern/sequence length mismatch, unknown pattern refs,
  // bad drum tokens) — calling it IS the validation pass.
  const compiled = compileScore(score);
  if (!compiled.events.length) throw new Error('score compiled to zero events');
  for (const e of compiled.events) {
    if (!isFinite(e.timeBeats) || !isFinite(e.durationBeats) || e.durationBeats <= 0) {
      throw new Error('bad event timing: ' + JSON.stringify(e));
    }
    if (e.frequencyHz !== 0 && !isFinite(e.frequencyHz)) throw new Error('bad event frequency: ' + JSON.stringify(e));
  }
  return compiled;
}

if (typeof module !== 'undefined') {
  module.exports = { PERC_IDS, noteToMidi, noteToFreq, compileScore, validateScore, tokenizePattern };
}
