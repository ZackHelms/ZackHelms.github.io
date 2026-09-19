#!/usr/bin/env node
/**
 * drive-music-mixer.cjs — data gate for games/music-mixer/index.html.
 *
 * Music Mixer is six songs of hand-written step notation: 15 tracks x a
 * handful of pattern strings x an arrangement row per section, about 400
 * strings in total. A mistyped string does not throw — it silently drops a
 * note, shifts a whole pattern by a step, or leaves a pad that lights up and
 * plays nothing. None of that is visible in a diff and only some of it is
 * audible, so it gets checked here instead.
 *
 * Usage:
 *   node .claude/tests/drive-music-mixer.cjs              # gate, GREEN/RED
 *   node .claude/tests/drive-music-mixer.cjs --report     # + per-song tables
 *
 * Final line: MUSIC-MIXER: GREEN | RED   (exit 0 / 1)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PAGE = path.join(process.cwd(), 'games', 'music-mixer', 'index.html');
const REPORT = process.argv.includes('--report');
const src = fs.readFileSync(PAGE, 'utf8');

const problems = [];
const fail = (m) => problems.push(m);

/* ---------------------------------------------------- pull the data tables */
function bracketed(text, decl, open, close) {
  const at = text.indexOf(decl);
  if (at < 0) throw new Error('cannot find ' + decl);
  const start = text.indexOf(open, at);
  let depth = 0, i = start;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === open) depth++;
    else if (c === close) { depth--; if (!depth) break; }
  }
  return text.slice(start, i + 1);
}
const songsSrc = bracketed(src, 'const SONGS =', '[', ']');
/* Pattern strings must be literals. A computed one (a .replace() to dodge a
   miscount, say) would eval into a pass here and be unreadable in the file. */
if (/'\s*\.\s*(replace|repeat|padEnd|concat|slice)/.test(songsSrc))
  fail('SONGS contains a computed pattern string — write the literal');
const SONGS = eval(songsSrc);                                            // eslint-disable-line no-eval
const VOICE_DEFS = bracketed(src, 'const VOICE_DEFS =', '{', '}');
const PERC_BASE = eval('(' + bracketed(src, 'const PERC_BASE =', '{', '}') + ')'); // eslint-disable-line no-eval
const HUES = eval(bracketed(src, 'const HUES =', '[', ']'));             // eslint-disable-line no-eval

const voiceNames = new Set();
for (const m of VOICE_DEFS.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):\s*\(\)\s*=>/gm)) voiceNames.add(m[1]);
/* noi() voices scale their own filter frequency by the track's `tune`, so they
   legitimately have no PERC_BASE entry; mem()/fm() voices need one. */
const noiseVoices = new Set();
for (const m of VOICE_DEFS.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):\s*\(\)\s*=>\s*noi\(/gm)) noiseVoices.add(m[1]);
const sustainVoices = new Set();
for (const m of VOICE_DEFS.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):\s*\(\)\s*=>[^\n]*sus:\s*true/gm)) sustainVoices.add(m[1]);

const PADS = 15, GROUPS = 3, PER = 5;
const P_CHARS = new Set(['X', 'x', 'o', 'r']);
const DEG = (c) => (c >= '1' && c <= '9') ? c.charCodeAt(0) - 49
  : (c >= 'a' && c <= 'f') ? c.charCodeAt(0) - 97 + 9 : -1;

/* ------------------------------------------------------------- top level */
if (SONGS.length !== 6) fail('expected 6 songs, found ' + SONGS.length);
if (HUES.length !== PADS) fail('HUES has ' + HUES.length + ' entries, expected ' + PADS);
for (let i = 1; i < HUES.length; i++) {
  if (HUES[i] <= HUES[i - 1])
    fail('HUES must climb red->magenta without repeating: index ' + i + ' (' + HUES[i] + ') <= ' + HUES[i - 1]);
}
if (HUES[0] !== 0) fail('HUES[0] must be 0 (red at the bottom-left pad), got ' + HUES[0]);
if (HUES[PADS - 1] < 290 || HUES[PADS - 1] > 330)
  fail('HUES[14] should be magenta (~315), got ' + HUES[PADS - 1]);

const ids = new Set();
const rows = [];

for (const S of SONGS) {
  const tag = S.id || '?';
  if (ids.has(S.id)) fail(tag + ': duplicate song id');
  ids.add(S.id);
  for (const k of ['id', 'name', 'style', 'sig', 'bpm', 'pulses', 'steps', 'rootHz', 'cents', 'tracks', 'arr'])
    if (S[k] === undefined) fail(tag + ': missing field ' + k);
  if (!Array.isArray(S.tracks) || S.tracks.length !== PADS)
    { fail(tag + ': needs exactly ' + PADS + ' tracks, has ' + (S.tracks || []).length); continue; }
  if (typeof S.mix !== 'number' || S.mix < 0.4 || S.mix > 2.5)
    fail(tag + ': mix trim must be 0.4..2.5, got ' + S.mix);
  if (typeof S.swing !== 'number' || S.swing < 0 || S.swing > 0.35)
    fail(tag + ': swing must be 0..0.35, got ' + S.swing);
  if (S.steps % S.pulses !== 0)
    fail(tag + ': steps (' + S.steps + ') must divide evenly into pulses (' + S.pulses + ')');
  if (!/^\d+\/\d+$/.test(S.sig)) fail(tag + ': sig "' + S.sig + '" is not n/m');

  const barSec = S.pulses * 60 / S.bpm;
  const bars = S.arr.reduce((a, s) => a + s.b, 0);
  const dur = bars * barSec;
  /* Was 285-315s, "about five minutes" each. Widened to 120-315s (CD,
     2026-09-19) once a recorded take could become a song: a performance the CD
     plays is a couple of minutes of material, and padding one out to five
     minutes to satisfy a gate is the gate writing the music. */
  if (dur < 120 || dur > 315)
    fail(tag + ': duration ' + dur.toFixed(1) + 's is outside 120-315s (' + bars + ' bars x ' + barSec.toFixed(3) + 's)');

  /* --- tracks ---------------------------------------------------------- */
  const labels = new Set();
  S.tracks.forEach((tr, i) => {
    const w = tag + ' pad' + i + ' ' + (tr.lab || '?') + ': ';
    if (!tr.lab) fail(w + 'no label');
    if (tr.lab && tr.lab.length > 10) fail(w + 'label longer than 10 chars');
    if (labels.has(tr.lab)) fail(w + 'duplicate label');
    labels.add(tr.lab);
    if (!voiceNames.has(tr.v)) fail(w + 'unknown voice "' + tr.v + '"');
    if (tr.k !== 'm' && tr.k !== 'p') fail(w + 'kind must be m or p, got ' + tr.k);
    if (tr.k === 'p' && !(tr.v in PERC_BASE) && !noiseVoices.has(tr.v))
      fail(w + 'pitched percussive voice "' + tr.v + '" has no PERC_BASE entry');
    if (tr.k === 'p' && tr.ch) fail(w + 'percussive track cannot carry a chord');
    if (tr.pan != null && Math.abs(tr.pan) > 0.5) fail(w + 'pan ' + tr.pan + ' beyond +/-0.5');
    if (tr.push != null && Math.abs(tr.push) > 25) fail(w + 'push ' + tr.push + 'ms beyond +/-25');
    const keys = Object.keys(tr.pats || {});
    if (!keys.length) fail(w + 'no patterns');
    for (const key of keys) {
      if (key.length !== 1) fail(w + 'pattern key "' + key + '" must be a single char');
      const pat = tr.pats[key];
      if (typeof pat !== 'string' || !pat.length) { fail(w + 'pattern ' + key + ' is empty'); continue; }
      if (pat.length % S.steps !== 0)
        fail(w + 'pattern ' + key + ' is ' + pat.length + ' steps, not a multiple of ' + S.steps);
      let notes = 0;
      for (let q = 0; q < pat.length; q++) {
        const c = pat[q];
        if (c === '.') continue;
        if (c === '-') {
          if (q === 0) fail(w + 'pattern ' + key + ' opens with a tie');
          continue;
        }
        notes++;
        if (tr.k === 'p') {
          if (!P_CHARS.has(c)) fail(w + 'pattern ' + key + ' step ' + q + ': "' + c + '" is not X/x/o/r');
        } else {
          if (DEG(c) < 0) fail(w + 'pattern ' + key + ' step ' + q + ': "' + c + '" is not a degree (1-9,a-f)');
        }
      }
      if (!notes) fail(w + 'pattern ' + key + ' has no notes at all');
    }
    /* a sustaining voice with no tie anywhere is a voice doing no work */
    if (sustainVoices.has(tr.v) && tr.k === 'm') {
      const anyTie = keys.some((k) => tr.pats[k].includes('-'));
      if (!anyTie && !/gong/i.test(tr.v)) fail(w + 'sustaining voice but no tied notes');
    }
  });

  /* --- pitch range: catch an octave typo before it is a subsonic lead -- */
  const degHz = (tr, deg) => {
    const n = S.cents.length;
    const oct = Math.floor(deg / n);
    const c = S.cents[deg - oct * n] + 1200 * oct + 1200 * (tr.oct || 0);
    return S.rootHz * Math.pow(2, c / 1200);
  };
  const maxCr = Math.max(...S.arr.map((s) => Math.max(...s.k)));
  S.tracks.forEach((tr, i) => {
    if (tr.k !== 'm') return;
    let lo = Infinity, hi = 0;
    for (const key of Object.keys(tr.pats)) {
      for (const c of tr.pats[key]) {
        const d = DEG(c);
        if (d < 0) continue;
        for (const off of (tr.ch || [0])) {
          for (const cr of [0, tr.harm ? maxCr : 0]) {
            const f = degHz(tr, d + off + cr);
            lo = Math.min(lo, f); hi = Math.max(hi, f);
          }
        }
      }
    }
    const w = tag + ' pad' + i + ' ' + tr.lab + ': ';
    if (lo < 24) fail(w + 'lowest note ' + lo.toFixed(1) + ' Hz is below hearing');
    if (hi > 15000) fail(w + 'highest note ' + hi.toFixed(0) + ' Hz is above the top of the mix');
    if (REPORT) rows.push([tag, i, tr.lab, tr.k, tr.v, lo.toFixed(0) + '-' + hi.toFixed(0) + 'Hz']);
  });

  /* --- arrangement ----------------------------------------------------- */
  const restBars = new Array(PADS).fill(0);
  const longestRest = new Array(PADS).fill(0);
  const runRest = new Array(PADS).fill(0);
  const names = new Set();
  S.arr.forEach((sec, si) => {
    const w = tag + ' section ' + si + ' "' + (sec.n || '?') + '": ';
    if (!sec.n) fail(w + 'no name');
    if (names.has(sec.n)) fail(w + 'duplicate section name');
    names.add(sec.n);
    if (!(sec.b > 0)) fail(w + 'bar count must be positive');
    if (!Array.isArray(sec.k) || !sec.k.length) fail(w + 'no chord-root array');
    for (const cr of sec.k || []) {
      if (!Number.isInteger(cr) || cr < 0 || cr >= S.cents.length)
        fail(w + 'chord root ' + cr + ' outside 0..' + (S.cents.length - 1));
    }
    if (typeof sec.p !== 'string' || sec.p.length !== PADS)
      { fail(w + 'p must be exactly ' + PADS + ' chars, got ' + (sec.p || '').length); return; }
    for (let i = 0; i < PADS; i++) {
      const key = sec.p[i];
      if (key === '.') {
        restBars[i] += sec.b;
        runRest[i] += sec.b;
        longestRest[i] = Math.max(longestRest[i], runRest[i]);
        continue;
      }
      runRest[i] = 0;
      if (!(key in (S.tracks[i].pats || {})))
        fail(w + 'pad' + i + ' ' + S.tracks[i].lab + ' refers to pattern "' + key + '" which it does not have');
    }
  });
  /* Every pad must be worth holding. A pad that rests through half the song
     reads as broken, which is the whole reason the resting state is shown. */
  for (let i = 0; i < PADS; i++) {
    const frac = restBars[i] / bars;
    if (frac > 0.45)
      fail(tag + ' pad' + i + ' ' + S.tracks[i].lab + ' rests for ' +
           (frac * 100).toFixed(0) + '% of the song (max 45%)');
    if (longestRest[i] > 28)
      fail(tag + ' pad' + i + ' ' + S.tracks[i].lab + ' rests for ' + longestRest[i] +
           ' bars straight (max 28)');
  }

  /* --- simulate every step of the whole song --------------------------- */
  const barMap = [];
  let b0 = 0;
  S.arr.forEach((sec, si) => { for (let k = 0; k < sec.b; k++) barMap[b0 + k] = { s: si, b: b0 }; b0 += sec.b; });
  const perTrack = new Array(PADS).fill(0);
  let peak = 0, sounding = 0, totalSteps = bars * S.steps;
  for (let a = 0; a < totalSteps; a++) {
    const bar = (a / S.steps) | 0, st = a % S.steps;
    const info = barMap[bar];
    const sec = S.arr[info.s];
    let voices = 0;
    for (let i = 0; i < PADS; i++) {
      const key = sec.p[i];
      if (key === '.') continue;
      const pat = S.tracks[i].pats[key];
      if (!pat) continue;                       // already reported above
      const c = pat[a % pat.length];
      if (c === '.' || c === '-') continue;
      perTrack[i]++;
      voices += (S.tracks[i].ch || [0]).length;
    }
    if (voices) sounding++;
    peak = Math.max(peak, voices);
    if (st === 0 && !info) fail(tag + ': bar ' + bar + ' has no section');
  }
  /* the full mix must actually be a full mix */
  const density = sounding / totalSteps;
  if (density < 0.6) fail(tag + ': only ' + (density * 100).toFixed(0) +
    '% of steps sound with every pad held (min 60%) — the "hold everything" state is too thin');
  if (peak > 26) fail(tag + ': ' + peak + ' simultaneous voices on one step (max 26)');
  for (let i = 0; i < PADS; i++) {
    const perBar = perTrack[i] / bars;
    if (perBar < 0.22)
      fail(tag + ' pad' + i + ' ' + S.tracks[i].lab + ' averages ' + perBar.toFixed(2) +
           ' notes/bar (min 0.22) — nothing to hear when held');
  }

  if (REPORT) {
    console.log('');
    console.log('== ' + S.name + ' (' + S.style + ')  ' + S.bpm + ' BPM ' + S.sig +
      '  ' + bars + ' bars  ' + Math.floor(dur / 60) + ':' + String(Math.round(dur % 60)).padStart(2, '0') +
      '  peak ' + peak + ' voices  ' + (density * 100).toFixed(0) + '% of steps sounding');
    for (let g = GROUPS - 1; g >= 0; g--) {
      const gname = g === 2 ? 'PERCUSSION' : g === 1 ? 'HARMONY/MELODY' : 'LOW END';
      const cells = [];
      for (let k = 0; k < PER; k++) {
        const i = g * PER + k;
        cells.push(S.tracks[i].lab.padEnd(10) + (perTrack[i] / bars).toFixed(1).padStart(5) + '/bar' +
          ' rest ' + String(Math.round(restBars[i] / bars * 100)).padStart(2) + '%');
      }
      console.log('  [' + gname + ']');
      cells.forEach((c, k) => console.log('    ' + k + ' ' + c));
    }
  }
}

/* percussion lives in group 2 by contract, not by accident */
for (const S of SONGS) {
  if (!S.tracks || S.tracks.length !== PADS) continue;
  for (let i = 10; i < 15; i++) {
    const tr = S.tracks[i];
    const perc = tr.k === 'p' || /gong|tabla|kendang|kempul|kenong|kecer/i.test(tr.v + tr.lab);
    if (!perc) fail(S.id + ' pad' + i + ' ' + tr.lab + ' is in the percussion column but is not a percussion voice');
  }
  for (let i = 0; i < 10; i++) {
    if (S.tracks[i].k === 'p')
      fail(S.id + ' pad' + i + ' ' + S.tracks[i].lab + ' is a drum outside the percussion column');
  }
}

/* ============================================ the recording kit and scales */
/* The kit is hand-authored data exactly like the songs are, and it fails the
   same silent way: a mode whose intervals do not ascend, a pad naming a voice
   that no longer exists, or a drum outside the percussion column produces a
   grid that looks right and plays wrong. */
const MODES = eval('(' + bracketed(src, 'const MODES =', '{', '}') + ')');   // eslint-disable-line no-eval
const PERC_KIT = eval(bracketed(src, 'const PERC_KIT =', '[', ']'));         // eslint-disable-line no-eval
const PITCH_KIT = eval(bracketed(src, 'const PITCH_KIT =', '[', ']'));       // eslint-disable-line no-eval
const DEFAULT_PERC = eval(bracketed(src, 'const DEFAULT_PERC =', '[', ']')); // eslint-disable-line no-eval

const modeNames = Object.keys(MODES);
if (modeNames.length < 7) fail('MODES has only ' + modeNames.length + ' entries');
for (const m of modeNames) {
  const [lab, sc] = MODES[m];
  if (!lab || !/^[A-Z ]+$/.test(lab)) fail('MODES.' + m + ' label is not a plain caps name: ' + lab);
  if (!Array.isArray(sc) || sc.length < 5)
    fail('MODES.' + m + ' needs at least 5 degrees, has ' + (sc || []).length);
  if (sc[0] !== 0) fail('MODES.' + m + ' must start on the tonic (0), starts ' + sc[0]);
  for (let i = 1; i < sc.length; i++) {
    if (sc[i] <= sc[i - 1]) fail('MODES.' + m + ' intervals must ascend: ' + sc.join(','));
    if (sc[i] > 11) fail('MODES.' + m + ' degree ' + i + ' is ' + sc[i] + ', past the octave');
  }
}

const kitLab = new Map();
for (const [v, l] of PERC_KIT.concat(PITCH_KIT)) {
  if (!voiceNames.has(v)) fail('kit names voice "' + v + '", which VOICE_DEFS does not define');
  if (kitLab.has(v)) fail('voice "' + v + '" is listed in the picker twice');
  kitLab.set(v, l);
}
/* a pitched pad is played by scale degree, so a voice with no usable pitch
   range has no business in that list — the split has to match the songs' */
for (const [v] of PERC_KIT) {
  if (!noiseVoices.has(v) && !(v in PERC_BASE))
    fail('percussion voice "' + v + '" has no PERC_BASE entry and is not a noi() voice');
}
for (const [v] of PITCH_KIT) {
  if (noiseVoices.has(v)) fail('pitched voice "' + v + '" is a noise voice and cannot hold a pitch');
}
if (PITCH_KIT.length < 20) fail('only ' + PITCH_KIT.length + ' pitched voices offered');
if (PERC_KIT.length < 15) fail('only ' + PERC_KIT.length + ' percussion voices offered');

/* the default kit: ten degrees up the left two columns, drums on the right */
if (DEFAULT_PERC.length !== PER) fail('DEFAULT_PERC has ' + DEFAULT_PERC.length + ' voices, expected ' + PER);
for (const v of DEFAULT_PERC) {
  if (!voiceNames.has(v)) fail('DEFAULT_PERC names unknown voice "' + v + '"');
  if (!PERC_KIT.some(([n]) => n === v))
    fail('DEFAULT_PERC voice "' + v + '" is not offered in the percussion list');
}
/* Every default drum comes from PULSE, the synthwave song, by CD spec. */
const pulse = SONGS.find((s) => s.id === 'pulse');
if (pulse) {
  const pulsePerc = pulse.tracks.slice(10).map((t) => t.v);
  for (const v of DEFAULT_PERC) {
    if (!pulsePerc.includes(v))
      fail('default kit drum "' + v + '" is not one of PULSE\'s five percussion voices (' + pulsePerc.join(',') + ')');
  }
}

/* The scale walk itself: C major from C4 must give C4..E5 with the eighth pad
   exactly an octave over the first, which is the shape the CD specified. */
function degMidi(root, sc, oct, deg) {
  const n = sc.length, o = Math.floor(deg / n);
  return 12 * (oct + 1) + root + sc[deg - o * n] + 12 * o;
}
const major = MODES.major[1];
const wantMidi = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76];   /* C4 D E F G A B C5 D E */
for (let d = 0; d < 10; d++) {
  const got = degMidi(0, major, 4, d);
  if (got !== wantMidi[d])
    fail('default pad ' + d + ' should be MIDI ' + wantMidi[d] + ' in C major, got ' + got);
}
if (degMidi(0, major, 4, 7) - degMidi(0, major, 4, 0) !== 12)
  fail('the eighth note of the default kit is not an octave above the first');

/* ------------------------------------------- the key/mode sample piece ---- */
/* Written once in scale degrees and rendered through whatever key and mode is
   picked, so a bad event is bad in all 144 combinations at once. The failure
   worth catching is two events in one layer starting on the same step: that
   double-triggers one note at double velocity and reads as a random accent. */
const SAMPLE = eval('(' + bracketed(src, 'const SAMPLE =', '{', '}') + ')');  // eslint-disable-line no-eval
const KEY_NAMES = eval(bracketed(src, 'const KEY_NAMES =', '[', ']'));        // eslint-disable-line no-eval

if (KEY_NAMES.length !== 12) fail('KEY_NAMES has ' + KEY_NAMES.length + ' entries, expected 12');
if (SAMPLE.chords.length !== SAMPLE.bars)
  fail('SAMPLE has ' + SAMPLE.bars + ' bars but ' + SAMPLE.chords.length + ' chord roots');
if (SAMPLE.bpm < 50 || SAMPLE.bpm > 200) fail('SAMPLE bpm ' + SAMPLE.bpm + ' is out of range');
for (const r of SAMPLE.chords) {
  if (!Number.isInteger(r) || r < 0 || r > 13) fail('SAMPLE chord root ' + r + ' is out of range');
}
let sampleNotes = 0;
for (const layer of ['lh', 'rh', 'mel']) {
  const rows = SAMPLE[layer];
  if (!Array.isArray(rows) || rows.length !== SAMPLE.bars) {
    fail('SAMPLE.' + layer + ' has ' + (rows || []).length + ' bars, expected ' + SAMPLE.bars);
    continue;
  }
  rows.forEach((bar, b) => {
    if (!bar.length) fail('SAMPLE.' + layer + ' bar ' + b + ' is empty — a silent bar in all three layers is a hole');
    const seen = new Set();
    for (const e of bar) {
      const [st, degs, len, vel] = e;
      const at = 'SAMPLE.' + layer + ' bar ' + b + ' step ' + st;
      if (!Number.isInteger(st) || st < 0 || st >= SAMPLE.steps) fail(at + ': step out of the bar');
      if (seen.has(st)) fail(at + ': two events start on this step, which double-triggers the note');
      seen.add(st);
      if (!Array.isArray(degs) || !degs.length) fail(at + ': no degrees');
      for (const d of degs) {
        if (!Number.isInteger(d) || d < -7 || d > 14) fail(at + ': degree ' + d + ' is out of range');
      }
      if (!Number.isInteger(len) || len < 1 || len > SAMPLE.steps * 2) fail(at + ': length ' + len + ' is out of range');
      if (!(vel > 0) || vel > 1) fail(at + ': velocity ' + vel + ' is out of range');
      sampleNotes += degs.length;
    }
  });
}
/* it has to sound like music in EVERY mode, so the walk is checked against the
   shortest scale offered as well as the seven-note ones */
for (const m of Object.keys(MODES)) {
  const sc = MODES[m][1];
  for (let b = 0; b < SAMPLE.bars; b++) {
    for (const e of SAMPLE.rh[b]) {
      for (const d of e[1]) {
        const midi = degMidi(0, sc, 4, SAMPLE.chords[b] + d);
        if (midi < 24 || midi > 108) fail('SAMPLE chord in ' + m + ' bar ' + b + ' lands at MIDI ' + midi);
      }
    }
    for (const e of SAMPLE.mel[b]) {
      for (const d of e[1]) {
        const midi = degMidi(0, sc, 5, d);
        if (midi < 36 || midi > 110) fail('SAMPLE melody in ' + m + ' bar ' + b + ' lands at MIDI ' + midi);
      }
    }
  }
}

console.log('');
console.log('SONGS=' + SONGS.length);
console.log('VOICES=' + voiceNames.size);
console.log('KIT=' + PITCH_KIT.length + ' pitched + ' + PERC_KIT.length + ' percussion, '
  + Object.keys(MODES).length + ' modes');
console.log('SAMPLE=' + SAMPLE.bars + ' bars, ' + sampleNotes + ' notes, all '
  + (Object.keys(MODES).length * 12) + ' key/mode combinations in range');
console.log('PROBLEMS=' + problems.length);
for (const p of problems) console.log('  - ' + p);
console.log('MUSIC-MIXER: ' + (problems.length ? 'RED' : 'GREEN'));
process.exit(problems.length ? 1 : 0);
