'use strict';
const { validateScore } = require('./compiler.js');
const fs = require('fs');

// ---- pitch helpers ----
const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};
const PC = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToName(m) { const o = Math.floor(m / 12) - 1; return NAMES[((m % 12) + 12) % 12] + o; }
function deg(rootLetter, scaleName, baseOct, degree) {
  const arr = SCALES[scaleName];
  const len = arr.length;
  const oct = baseOct + Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  const midi = (oct + 1) * 12 + PC[rootLetter] + arr[idx];
  return midiToName(midi);
}
function chordTok(rootLetter, scaleName, baseOct, degree, chordDegrees) {
  return chordDegrees.map(cd => deg(rootLetter, scaleName, baseOct, degree + cd)).join('+');
}

// ---- pattern builders (array-based so lengths are always exact) ----
function drumPat(steps, hits) {
  const a = new Array(steps).fill('.');
  for (const k in hits) a[Number(k)] = hits[k];
  return a.join('');
}
function melPat(steps, tokens) {
  const a = new Array(steps).fill('.');
  for (const k in tokens) a[Number(k)] = tokens[k];
  return a.join(' ');
}
function sustainPat(steps, tok) {
  const a = new Array(steps).fill('-');
  a[0] = tok;
  return a.join(' ');
}
function seqFill(bars, main, fillEvery, fillName) {
  const s = new Array(bars).fill(main);
  if (fillEvery) for (let i = fillEvery - 1; i < bars; i += fillEvery) s[i] = fillName;
  return s;
}

const tracks = [];

// =====================================================================
// 1. MENU — dark ambient, drumless
// =====================================================================
{
  const bars = 8, beatsPerBar = 4, spb4 = 4, root = 'A', sc = 'minor';
  const droneSteps = beatsPerBar; // spb 1
  const dronePat = sustainPat(droneSteps, deg(root, sc, 1, 0));
  const subPat = melPat(16, { 0: deg(root, sc, 0, 0), 8: deg(root, sc, 0, 0) });
  const bellPat = melPat(16, { 2: deg(root, sc, 4, 4), 9: deg(root, sc, 4, 2) });
  const bellRest = melPat(16, {});
  tracks.push({
    id: 'menu-signal-drift', name: 'SIGNAL DRIFT', context: 'menu', bpm: 68, bars,
    score: {
      bars, beatsPerBar, stepsPerBeat: spb4, bpm: 68,
      tracks: [
        { inst: 'drone', gain: 0.4, stepsPerBeat: 1, patterns: { d: dronePat }, sequence: seqFill(bars, 'd') },
        { inst: 'sub-sine', gain: 0.3, patterns: { p: subPat }, sequence: seqFill(bars, 'p') },
        { inst: 'bell', gain: 0.28, patterns: { b: bellPat, r: bellRest }, sequence: [ 'r','b','r','r','r','b','r','r' ] },
      ],
    },
  });
}

// =====================================================================
// CALM / PATROL — 4 tracks
// =====================================================================
function calmTrack(idBase, name, bpm, root, sc, opts) {
  const bars = 8, beatsPerBar = 4, spb4 = 4;
  const trs = [];
  if (opts.kick) {
    trs.push({ inst: 'kick', gain: 0.14, patterns: { k: drumPat(16, { 0: 'X', 8: 'x' }) }, sequence: seqFill(bars, 'k') });
    trs.push({ inst: 'hat-closed', gain: 0.08, patterns: { h: drumPat(16, { 2: 'x', 6: 'x', 10: 'x', 14: 'x' }) }, sequence: seqFill(bars, 'h') });
  }
  if (opts.lurchKick) {
    trs.push({ inst: 'kick', gain: 0.2, patterns: { k: drumPat(16, { 0: 'X', 10: 'x' }) }, sequence: seqFill(bars, 'k') });
    trs.push({ inst: 'snare', gain: 0.12, patterns: { s: drumPat(16, { 8: 'X' }) }, sequence: seqFill(bars, 's') });
  }
  if (opts.breath) {
    trs.push({ inst: 'breath-noise-wash', gain: 0.16, patterns: { w: drumPat(4, { 0: 'x' }), r: drumPat(4, {}) }, stepsPerBeat: 1, sequence: [ 'w','r','w','r','w','r','w','r' ] });
  }
  // sub bass — one held root per bar, alternating i / VI / VII / i (natural minor style)
  const bassDegrees = [0, 5, 6, 0, 0, 5, 6, 0];
  const bassPatterns = {};
  const bassSeq = bassDegrees.map((d, i) => { const nm = 'b' + d; bassPatterns[nm] = sustainPat(16, deg(root, sc, 1, d)); return nm; });
  trs.push({ inst: 'sub-bass', gain: 0.3, patterns: bassPatterns, sequence: bassSeq });
  // pad chords (triads), stepsPerBeat 1 so a whole bar is 4 tokens
  const padPatterns = {};
  const padSeq = bassDegrees.map((d, i) => { const nm = 'c' + d; padPatterns[nm] = sustainPat(beatsPerBar, chordTok(root, sc, 2, d, [0, 2, 4])); return nm; });
  trs.push({ inst: opts.padInst || 'pad', gain: 0.22, stepsPerBeat: 1, patterns: padPatterns, sequence: padSeq });
  // sparse melodic motif (thread-one-motif): rising 4-note figure, only some bars
  const motif = [0, 2, 4, 2];
  const motifPat = melPat(16, { 1: deg(root, sc, 4, motif[0]), 5: deg(root, sc, 4, motif[1]), 9: deg(root, sc, 4, motif[2]), 12: deg(root, sc, 4, motif[3]) });
  const restPat = melPat(16, {});
  trs.push({ inst: opts.leadInst || 'soft-pluck', gain: 0.24, patterns: { m: motifPat, r: restPat }, sequence: [ 'r', 'm', 'r', 'r', 'r', 'm', 'r', 'r' ] });
  if (opts.subSine) trs.push({ inst: 'sub-sine', gain: 0.18, patterns: { p: sustainPat(16, deg(root, sc, 0, 0)) }, sequence: seqFill(bars, 'p') });

  return { id: idBase, name, context: 'calm', bpm, bars, score: { bars, beatsPerBar, stepsPerBeat: spb4, bpm, tracks: trs } };
}
tracks.push(calmTrack('calm-quiet-vector', 'QUIET VECTOR', 86, 'D', 'minor', { kick: true }));
tracks.push(calmTrack('calm-dead-reckoning', 'DEAD RECKONING', 90, 'E', 'minor', { breath: true, subSine: true, padInst: 'warm-pad' }));
tracks.push(calmTrack('calm-low-orbit', 'LOW ORBIT', 92, 'C', 'minor', { lurchKick: true }));
tracks.push(calmTrack('calm-static-horizon', 'STATIC HORIZON', 82, 'G', 'minor', { padInst: 'warm-pad', leadInst: 'soft-pluck', subSine: true }));

// =====================================================================
// COMBAT — 10 tracks (2 per stage)
// =====================================================================
function technoDrums(bars, kickHits, hatOpen, clap) {
  return [
    { inst: 'kick', gain: 0.34, patterns: { k: drumPat(16, kickHits) }, sequence: seqFill(bars, 'k') },
    { inst: 'hat-open', gain: 0.16, patterns: { h: drumPat(16, hatOpen) }, sequence: seqFill(bars, 'h') },
    { inst: 'clap', gain: 0.22, patterns: { c: drumPat(16, clap) }, sequence: seqFill(bars, 'c') },
  ];
}
function acidBassPattern(root, sc, baseOct, seedDegrees) {
  const tokens = {};
  seedDegrees.forEach((d, i) => { tokens[i * 2] = deg(root, sc, baseOct, d); });
  return melPat(16, tokens);
}
function stabPattern(root, sc, baseOct, hitsIdx) {
  const tokens = {};
  hitsIdx.forEach((idx, i) => { tokens[idx] = chordTok(root, sc, baseOct, i % 2 === 0 ? 0 : 4, [0, 2, 4]); });
  return melPat(16, tokens);
}
function combatTechno(idBase, name, bpm, root, sc, variant) {
  const bars = 8, beatsPerBar = 4, spb4 = 4;
  const kickHits = variant === 0 ? { 0: 'X', 4: 'x', 8: 'x', 12: 'x' } : { 0: 'X', 4: 'x', 8: 'x', 12: 'x', 14: 'x' };
  const trs = technoDrums(bars, kickHits, { 2: 'x', 6: 'x', 10: 'x', 14: 'x' }, { 4: 'x', 12: 'x' });
  const bassDeg = [0, 0, 3, 2, 0, 0, 5, 4];
  trs.push({ inst: 'acid-bass', gain: 0.3, patterns: { a: acidBassPattern(root, sc, 1, bassDeg) }, sequence: seqFill(bars, 'a') });
  trs.push({ inst: 'stab', gain: 0.24, patterns: { s: stabPattern(root, sc, 3, [0, 6, 10]) }, sequence: seqFill(bars, 's') });
  if (variant === 1) trs.push({ inst: 'bell', gain: 0.16, patterns: { b: melPat(16, { 3: deg(root, sc, 5, 4) }) }, sequence: seqFill(bars, 'b') });
  else trs.push({ inst: 'lead', gain: 0.18, patterns: { l: melPat(16, { 9: deg(root, sc, 4, 2), 13: deg(root, sc, 4, 4) }) }, sequence: seqFill(bars, 'l') });
  return { id: idBase, name, context: 'combat', bpm, bars, score: { bars, beatsPerBar, stepsPerBeat: spb4, bpm, tracks: trs } };
}
function combatGlitchHop(idBase, name, bpm, root, sc, kickHits, swing) {
  const bars = 8, beatsPerBar = 4, spb4 = 4;
  const trs = [];
  trs.push({ inst: 'kick', gain: 0.32, patterns: { k: drumPat(16, kickHits) }, sequence: seqFill(bars, 'k') });
  trs.push({ inst: 'snare', gain: 0.26, patterns: { s: drumPat(16, { 6: 'x', 8: 'X' }) }, sequence: seqFill(bars, 's') });
  const burstA = drumPat(32, { 16: 'x', 18: 'x', 20: 'x', 22: 'x' });
  const burstB = drumPat(32, { 8: 'x', 10: 'x', 24: 'x', 26: 'x', 28: 'x' });
  trs.push({ inst: 'glitch-tick', gain: 0.2, stepsPerBeat: 8, patterns: { a: burstA, b: burstB, r: drumPat(32, {}) }, sequence: [ 'r', 'a', 'r', 'b', 'r', 'a', 'r', 'b' ] });
  trs.push({ inst: 'wobble-bass', gain: 0.32, patterns: { w: sustainPat(16, deg(root, sc, 1, 0)) }, sequence: seqFill(bars, 'w') });
  trs.push({ inst: 'lead', gain: 0.2, patterns: { l: melPat(16, { 5: deg(root, sc, 4, 2), 11: deg(root, sc, 4, 4) }), r: melPat(16, {}) }, sequence: [ 'r', 'l', 'r', 'l', 'r', 'l', 'r', 'l' ] });
  return { id: idBase, name, context: 'combat', bpm, bars, score: { bars, beatsPerBar, stepsPerBeat: spb4, bpm, swing, tracks: trs } };
}
function combatHardTechno(idBase, name, bpm, root, sc) {
  const bars = 8, beatsPerBar = 4, spb4 = 4;
  const trs = [];
  const kickPat = drumPat(16, { 0: 'X', 4: 'X', 8: 'X', 12: 'X' });
  const kickFillPat = drumPat(16, { 0: 'X', 4: 'X', 8: 'X', 10: 'x', 12: 'X', 14: 'x' });
  trs.push({ inst: 'kick', gain: 0.36, patterns: { k: kickPat, f: kickFillPat }, sequence: seqFill(bars, 'k', 4, 'f') });
  const ride = new Array(16).fill(0).map((_, i) => i % 2 === 0 ? 'x' : 'X').join('');
  trs.push({ inst: 'hat-closed', gain: 0.14, patterns: { r: ride }, sequence: seqFill(bars, 'r') });
  trs.push({ inst: 'tom', gain: 0.22, patterns: { t: drumPat(16, { 8: 'x', 10: 'x', 12: 'x', 13: 'x', 14: 'X', 15: 'X' }), s: drumPat(16, {}) }, sequence: seqFill(bars, 's', 4, 't') });
  trs.push({ inst: 'crash', gain: 0.18, patterns: { c: drumPat(16, { 0: 'X' }), s: drumPat(16, {}) }, sequence: [ 'c', 's', 's', 's', 'c', 's', 's', 's' ] });
  trs.push({ inst: 'acid-bass', gain: 0.3, patterns: { a: acidBassPattern(root, sc, 1, [0, 0, 3, 0, 5, 0, 4, 0]) }, sequence: seqFill(bars, 'a') });
  trs.push({ inst: 'stab', gain: 0.26, patterns: { s: stabPattern(root, sc, 3, [2, 6, 10, 14]) }, sequence: seqFill(bars, 's') });
  return { id: idBase, name, context: 'combat', bpm, bars, score: { bars, beatsPerBar, stepsPerBeat: spb4, bpm, tracks: trs } };
}

tracks.push(combatTechno('combat-s1a-ignition-line', 'IGNITION LINE', 124, 'A', 'minor', 0));
tracks.push(combatTechno('combat-s1b-first-contact', 'FIRST CONTACT', 126, 'E', 'minor', 1));
tracks.push(combatTechno('combat-s2a-chrome-salvo', 'CHROME SALVO', 128, 'D', 'minor', 0));
tracks.push(combatGlitchHop('combat-s2b-vector-storm', 'VECTOR STORM', 104, 'F#', 'phrygian', { 0: 'X', 6: 'x', 9: 'x' }, 0.22));
tracks.push(combatTechno('combat-s3a-red-shift', 'RED SHIFT PROTOCOL', 130, 'C', 'minor', 1));
tracks.push(combatGlitchHop('combat-s3b-fracture-field', 'FRACTURE FIELD', 108, 'B', 'minor', { 0: 'X', 2: 'x', 9: 'x', 12: 'x' }, 0.26));
tracks.push(combatHardTechno('combat-s4a-siege-pattern', 'SIEGE PATTERN', 150, 'A', 'minor'));
tracks.push(combatGlitchHop('combat-s4b-null-gravity', 'NULL GRAVITY BREACH', 110, 'D', 'phrygian', { 0: 'X', 3: 'x', 6: 'x', 9: 'x', 12: 'x' }, 0.28));
tracks.push(combatHardTechno('combat-s5a-terminal-velocity', 'TERMINAL VELOCITY', 156, 'E', 'minor'));
tracks.push(combatHardTechno('combat-s5b-last-bastion', 'LAST BASTION', 152, 'F#', 'phrygian'));

// =====================================================================
// BOSS — 5 tracks, escalating
// =====================================================================
function bossDubstep(idBase, name, bpm, root, sc, kickHits) {
  const bars = 8, beatsPerBar = 4, spb4 = 4;
  const trs = [];
  trs.push({ inst: 'kick', gain: 0.4, patterns: { k: drumPat(16, kickHits) }, sequence: seqFill(bars, 'k') });
  trs.push({ inst: 'snare', gain: 0.3, patterns: { s: drumPat(16, { 8: 'X' }) }, sequence: seqFill(bars, 's') });
  trs.push({ inst: 'hat-closed', gain: 0.1, patterns: { h: drumPat(16, { 4: 'x', 12: 'x' }) }, sequence: seqFill(bars, 'h') });
  trs.push({ inst: 'wobble-bass', gain: 0.4, patterns: { w: sustainPat(16, deg(root, sc, 1, 0)) }, sequence: seqFill(bars, 'w') });
  trs.push({ inst: 'crash', gain: 0.22, patterns: { c: drumPat(16, { 0: 'X' }), s: drumPat(16, {}) }, sequence: seqFill(bars, 's', 4, 'c') });
  return { id: idBase, name, context: 'boss', bpm, bars, score: { bars, beatsPerBar, stepsPerBeat: spb4, bpm, tracks: trs } };
}
tracks.push({ ...bossDubstep('boss-1-iron-sentinel', 'IRON SENTINEL', 140, 'D', 'minor', { 0: 'X' }), score: (() => {
  const t = bossDubstep('x', 'x', 140, 'D', 'minor', { 0: 'X' }).score;
  t.tracks.push({ inst: 'stab', gain: 0.24, patterns: { s: stabPattern('D', 'minor', 3, [0, 8]) }, sequence: seqFill(8, 's') });
  return t;
})() });
tracks.push({ ...bossDubstep('boss-2-hollow-warden', 'HOLLOW WARDEN', 138, 'A', 'phrygian', { 0: 'X', 14: 'x' }), score: (() => {
  const t = bossDubstep('x', 'x', 138, 'A', 'phrygian', { 0: 'X', 14: 'x' }).score;
  t.tracks.push({ inst: 'bell', gain: 0.2, patterns: { b: melPat(16, { 6: deg('A', 'phrygian', 5, 1) }) }, sequence: seqFill(8, 'b') });
  return t;
})() });
{
  const bars = 8, beatsPerBar = 4, spb4 = 4, root = 'C', sc = 'phrygian';
  const trs = [];
  trs.push({ inst: 'kick', gain: 0.4, patterns: { k: drumPat(16, { 0: 'X', 4: 'X', 8: 'X', 12: 'X' }) }, sequence: seqFill(bars, 'k') });
  trs.push({ inst: 'hat-closed', gain: 0.16, patterns: { r: new Array(16).fill(0).map((_, i) => i % 2 === 0 ? 'x' : 'X').join('') }, sequence: seqFill(bars, 'r') });
  trs.push({ inst: 'tom', gain: 0.26, patterns: { t: drumPat(16, { 8: 'x', 10: 'x', 12: 'x', 13: 'x', 14: 'X', 15: 'X' }), s: drumPat(16, {}) }, sequence: seqFill(bars, 's', 2, 't') });
  trs.push({ inst: 'acid-bass', gain: 0.34, patterns: { a: acidBassPattern(root, sc, 1, [0, 0, 3, 0, 5, 0, 1, 0]) }, sequence: seqFill(bars, 'a') });
  trs.push({ inst: 'stab', gain: 0.28, patterns: { s: stabPattern(root, sc, 3, [2, 6, 10, 14]) }, sequence: seqFill(bars, 's') });
  trs.push({ inst: 'crash', gain: 0.22, patterns: { c: drumPat(16, { 0: 'X' }), s: drumPat(16, {}) }, sequence: seqFill(bars, 's', 4, 'c') });
  tracks.push({ id: 'boss-3-crimson-bulwark', name: 'CRIMSON BULWARK', context: 'boss', bpm: 154, bars, score: { bars, beatsPerBar, stepsPerBeat: spb4, bpm: 154, tracks: trs } });
}
{
  const t = bossDubstep('boss-4-the-unmaking', 'THE UNMAKING', 142, 'F', 'phrygian', { 0: 'X', 10: 'x' }).score;
  t.tracks.push({ inst: 'lead', gain: 0.2, patterns: { l: melPat(16, { 9: deg('F', 'phrygian', 4, 2), 13: deg('F', 'phrygian', 4, 4) }) }, sequence: seqFill(8, 'l') });
  t.tracks.push({ inst: 'bell', gain: 0.2, patterns: { b: melPat(16, { 3: deg('F', 'phrygian', 5, 1) }) }, sequence: seqFill(8, 'b') });
  tracks.push({ id: 'boss-4-the-unmaking', name: 'THE UNMAKING', context: 'boss', bpm: 142, bars: 8, score: t });
}
{
  const bars = 8, beatsPerBar = 4, spb4 = 4, root = 'E', sc = 'phrygian';
  const trs = [];
  trs.push({ inst: 'kick', gain: 0.42, patterns: { k: drumPat(16, { 0: 'X', 4: 'X', 8: 'X', 12: 'X' }), f: drumPat(16, { 0: 'X', 4: 'X', 8: 'X', 10: 'x', 12: 'X', 14: 'x' }) }, sequence: seqFill(bars, 'k', 4, 'f') });
  trs.push({ inst: 'hat-closed', gain: 0.16, patterns: { r: new Array(16).fill(0).map((_, i) => i % 2 === 0 ? 'x' : 'X').join('') }, sequence: seqFill(bars, 'r') });
  trs.push({ inst: 'tom', gain: 0.26, patterns: { t: drumPat(16, { 8: 'x', 10: 'x', 12: 'x', 13: 'x', 14: 'X', 15: 'X' }), s: drumPat(16, {}) }, sequence: seqFill(bars, 's', 2, 't') });
  trs.push({ inst: 'glitch-tick', gain: 0.18, stepsPerBeat: 8, patterns: { g: drumPat(32, { 24: 'x', 26: 'x', 28: 'x', 30: 'x' }), r: drumPat(32, {}) }, sequence: seqFill(bars, 'r', 2, 'g') });
  const octPump = new Array(16).fill('.');
  for (let k = 0; k < 8; k++) { octPump[k * 2] = deg(root, sc, k % 2 === 0 ? 1 : 2, 0); octPump[k * 2 + 1] = '-'; }
  trs.push({ inst: 'acid-bass', gain: 0.34, patterns: { a: octPump.join(' ') }, sequence: seqFill(bars, 'a') });
  trs.push({ inst: 'stab', gain: 0.3, patterns: { s: stabPattern(root, sc, 3, [2, 6, 10, 14]) }, sequence: seqFill(bars, 's') });
  trs.push({ inst: 'crash', gain: 0.24, patterns: { c: drumPat(16, { 0: 'X' }), s: drumPat(16, {}) }, sequence: seqFill(bars, 's', 4, 'c') });
  tracks.push({ id: 'boss-5-apex-annihilator', name: 'APEX ANNIHILATOR', context: 'boss', bpm: 160, bars, score: { bars, beatsPerBar, stepsPerBeat: spb4, bpm: 160, tracks: trs } });
}

// =====================================================================
// validate + emit
// =====================================================================
console.log('total tracks:', tracks.length);
let ok = true;
for (const t of tracks) {
  try {
    const compiled = validateScore(t.score);
    console.log(`OK  ${t.id.padEnd(30)} events=${compiled.events.length} loopSec=${compiled.loopSeconds.toFixed(2)}`);
  } catch (e) {
    ok = false;
    console.log(`FAIL ${t.id}: ${e.message}`);
  }
}
if (!ok) process.exit(1);

fs.writeFileSync(__dirname + '/tracks.json', JSON.stringify(tracks.map(t => ({ id: t.id, name: t.name, context: t.context, ...t.score })), null, 0));
console.log('wrote tracks.json');
