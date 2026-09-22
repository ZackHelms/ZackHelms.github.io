// Regenerates the downloadable candidates.json / candidates.csv from data.js
// and checks the data. Run from the repo root or from this directory:
//   node 2026election/build.mjs
// Exits non-zero if a check fails.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
const ctx = { window: {} };
vm.runInNewContext(src, ctx);
const E = ctx.window.ELECTION;

const errors = [];
const fail = (m) => errors.push(m);

// ---- checks -------------------------------------------------------------
if (/[^\x00-\x7e]/.test(src)) fail('data.js contains non-ASCII characters');

const colors = Object.keys(E.ratings);
const levels = new Set(E.levels.map((l) => l.id));
const keys = new Set(Object.keys(E.districtKeys));
const parties = new Set(['DEM', 'REP', 'LIB', 'GRE', '']);
const ids = new Set();
const urlOk = (u) => /^https:\/\/[^\s]+$/.test(u);

for (const c of E.contests) {
  if (ids.has(c.id)) fail(`duplicate contest id ${c.id}`);
  ids.add(c.id);
  if (!levels.has(c.level)) fail(`${c.id}: unknown level ${c.level}`);
  for (const k of Object.keys(c.when || {})) if (!keys.has(k)) fail(`${c.id}: unknown district key ${k}`);
  if (!c.cands.length) fail(`${c.id}: no candidates`);
  for (const k of c.cands) {
    const who = `${c.id} / ${k.n}`;
    if (!parties.has(k.p)) fail(`${who}: bad party ${k.p}`);
    if (c.partisan && !k.p) fail(`${who}: partisan contest but no party`);
    if (!colors.includes(k.ai?.c)) fail(`${who}: bad color ${k.ai?.c}`);
    if (!['high', 'med', 'low'].includes(k.ai?.conf)) fail(`${who}: bad confidence`);
    if (!['stated', 'inferred', 'none', 'na'].includes(k.ai?.basis)) fail(`${who}: bad basis`);
    if (!k.ai.why) fail(`${who}: missing why`);
    if (k.ai.c !== 'gray' && !(k.src || []).length) fail(`${who}: colored rating without sources`);
    for (const [, u] of [...(k.src || []), ...(k.links || [])]) if (!urlOk(u)) fail(`${who}: bad url ${u}`);
  }
}

// Every district value used by a combo should either match a contest or be a
// known "no race this year" district, so a typo cannot silently drop a race.
const noRace = { comm: ['4'], sup: ['10A'], boe: ['7'] };
const allCombos = [...E.combos27513.map((x) => x[1]), ...E.precincts.flatMap((p) => p.combos.map((x) => x[1]))];
for (const combo of allCombos) {
  for (const [k, v] of Object.entries(combo)) {
    const hit = E.contests.some((c) => c.when && c.when[k] === v);
    if (!hit && !(noRace[k] || []).includes(v)) fail(`district ${k}=${v} matches no contest`);
  }
}

// ---- summary --------------------------------------------------------------
const applies = (c, combo) => !c.when || Object.entries(c.when).every(([k, v]) => combo[k] === v);
const total27513 = E.combos27513.reduce((a, [n]) => a + n, 0);
const sizes = E.combos27513.map(([n, combo]) => {
  const cs = E.contests.filter((c) => applies(c, combo));
  return { n, contests: cs.length, seats: cs.reduce((a, c) => a + c.voteFor, 0) };
});
const minC = Math.min(...sizes.map((s) => s.contests));
const maxC = Math.max(...sizes.filter((s) => s.n > 10).map((s) => s.contests));
const nCands = E.contests.reduce((a, c) => a + c.cands.length, 0);
const contested = E.contests.filter((c) => c.cands.length > c.voteFor).length;
const byColor = {};
for (const c of E.contests) for (const k of c.cands) byColor[k.ai.c] = (byColor[k.ai.c] || 0) + 1;

// ---- outputs --------------------------------------------------------------
const party = { DEM: 'Democratic', REP: 'Republican', LIB: 'Libertarian', GRE: 'Green', '': 'Nonpartisan' };
const rows = [];
for (const c of E.contests) {
  const share = E.combos27513.filter(([, combo]) => applies(c, combo)).reduce((a, [n]) => a + n, 0) / total27513;
  for (const k of c.cands) {
    rows.push({
      level: E.levels.find((l) => l.id === c.level).name,
      position_type: c.type,
      contest: c.title,
      vote_for: c.voteFor,
      share_of_27513_voters: Math.round(share * 1000) / 10 + '%',
      candidate: k.n,
      party: party[k.p] + (k.pn ? ` (${k.pn})` : ''),
      incumbent: k.inc ? 'yes' : 'no',
      home: k.home,
      ai_color: k.ai.c,
      ai_label: E.ratings[k.ai.c].label,
      ai_confidence: k.ai.conf,
      ai_basis: k.ai.basis,
      ai_why: k.ai.why,
      ai_quote: k.ai.q || '',
      bio: k.bio,
      record: k.rec || '',
      links: (k.links || []).map(([t, u, f]) => `${t}${f === 'u' ? ' (unverified)' : ''}: ${u}`).join(' | '),
      sources: (k.src || []).map(([t, u]) => `${t}: ${u}`).join(' | ')
    });
  }
}
const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const header = Object.keys(rows[0]);
const csv = [header.join(','), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(','))].join('\n') + '\n';

if (errors.length) {
  console.error('FAILED checks:\n  ' + errors.join('\n  '));
  process.exit(1);
}
fs.writeFileSync(path.join(dir, 'candidates.csv'), csv);
fs.writeFileSync(path.join(dir, 'candidates.json'), JSON.stringify(E, null, 1) + '\n');

console.log(`ok: ${E.contests.length} contests (${contested} contested), ${nCands} candidates`);
console.log(`ballot size for one 27513 voter: ${minC}-${maxC} contests (+${E.referenda.length} amendments); ${total27513} voters`);
console.log('colors:', JSON.stringify(byColor));
console.log('wrote candidates.csv, candidates.json');
