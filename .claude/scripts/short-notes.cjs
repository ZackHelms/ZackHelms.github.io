#!/usr/bin/env node
/**
 * short-notes.cjs — which music-mixer tracks play notes SHORTER than their
 * voice's own attack+decay.
 *
 * That ratio is the one that bit on 2026-09-19: a sustaining envelope handed a
 * note shorter than atk+dec used to schedule its decay ramp later on the
 * timeline than its own release, so the note went quiet on the beat and then
 * swelled back up (see .claude/notes/20260917-webaudio-song-engine.md §
 * Envelopes). sEnv() clamps the decay now, so this is no longer a defect
 * report — it is the maintenance question behind the runtime gate's SHAPES
 * list, which fires one note of each such voice and watches its envelope.
 *
 * Run it after adding a song or retuning a voice: any voice it names that is
 * not in SHAPES (drive-music-mixer-runtime.cjs section 12) is a voice whose
 * envelope nothing is watching.
 *
 * Usage: node .claude/scripts/short-notes.cjs [path/to/music-mixer/index.html]
 *
 * Prints one TRACK= line per affected track, then a SHORT-NOTES= summary.
 * Exits 0 always (it is a survey, not a gate) — 1 only if the file cannot be
 * parsed, which means the page moved or the voice table was restructured.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PAGE = process.argv[2] || path.join('games', 'music-mixer', 'index.html');
let src;
try { src = fs.readFileSync(PAGE, 'utf8'); }
catch (e) { console.error('cannot read ' + PAGE + ': ' + e.message); process.exit(1); }

/* --- the voices that sustain, and how long their attack+decay runs ------- */
/* fm() halves its decay on the way into sEnv (pdec * 0.5), sub() passes it
   straight through — so the two factories are not interchangeable here. */
const V = {};
const vre = /^\s{2}(\w+):\s*\(\)\s*=>\s*(sub|fm)\(\{([\s\S]*?)\}\),?\s*$/gm;
let m;
while ((m = vre.exec(src))) {
  const [, name, factory, body] = m;
  if (!/\bsus:\s*(true|[0-9.]+)/.test(body)) continue;
  const num = (k, dflt) => {
    const r = new RegExp('\\b' + k + ':\\s*([0-9.]+)').exec(body);
    return r ? +r[1] : dflt;
  };
  const dec = num('dec', 0.3) * (factory === 'fm' ? 0.5 : 1);
  const atk = num('atk', factory === 'fm' ? 0.004 : 0.008);
  V[name] = { factory, need: atk + dec };
}
if (!Object.keys(V).length) {
  console.error('parsed no sustaining voices — the VOICES table moved or changed shape');
  process.exit(1);
}

/* --- every song, every track, every pattern ------------------------------ */
const songs = [];
const sre = /\n\{\n\s*id: '(\w+)', name: '([^']+)'[\s\S]*?\n\},\n/g;
let sm;
while ((sm = sre.exec(src))) songs.push({ id: sm[1], name: sm[2], body: sm[0] });
if (!songs.length) { console.error('parsed no songs — SONGS[] moved or changed shape'); process.exit(1); }

const rows = [];
for (const song of songs) {
  const field = (k, d) => {
    const r = new RegExp('\\b' + k + ':\\s*([0-9.]+)').exec(song.body);
    return r ? +r[1] : d;
  };
  const stepSec = (field('pulses', 4) * 60 / field('bpm', 100)) / field('steps', 16);
  const tre = /\{ lab: '([^']+)',\s*v: '(\w+)'[\s\S]*?pats: \{([\s\S]*?)\} \}/g;
  let tm;
  while ((tm = tre.exec(song.body))) {
    const [, lab, voice, pats] = tm;
    if (!V[voice]) continue;
    let hits = 0, short = 0, minL = Infinity;
    for (const pm of pats.matchAll(/'([^']+)'/g)) {
      const pat = pm[1];
      for (let i = 0; i < pat.length; i++) {
        if (pat[i] === '.' || pat[i] === '-') continue;
        let L = 1;
        while (L < pat.length && pat[(i + L) % pat.length] === '-') L++;
        hits++;
        if (L * stepSec < V[voice].need) { short++; minL = Math.min(minL, L); }
      }
    }
    if (short) rows.push({ song: song.name, lab, voice, short, hits,
                           sec: minL * stepSec, need: V[voice].need });
  }
}

rows.sort((a, b) => (b.short / b.hits) - (a.short / a.hits));
for (const r of rows)
  console.log('TRACK=' + r.song + '/' + r.lab + ' voice=' + r.voice +
    ' short=' + r.short + '/' + r.hits +
    ' shortest=' + r.sec.toFixed(3) + 's needs=' + r.need.toFixed(3) + 's');
const voices = [...new Set(rows.map((r) => r.voice))].sort();
console.log('SHORT-NOTES=' + rows.length + ' tracks across ' + songs.length +
            ' songs, ' + voices.length + ' voices: ' + (voices.join(',') || '-'));
