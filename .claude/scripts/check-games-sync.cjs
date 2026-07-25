#!/usr/bin/env node
/**
 * check-games-sync.cjs — three-way consistency gate for the games catalog.
 *
 * Every new game has to land in three places that drift independently:
 *   1. games/index.html   — the hub card (icon, name, href)
 *   2. games/index.html   — the GAMES[] facet dataset (feeds the 📊 dashboard)
 *   3. .claude/games-index.md — the catalog row + facet columns
 * Plus the game directory itself and its .claude/<slug>.md context file.
 *
 * Batches kept re-writing a throwaway Playwright script that checked (1)↔(2)
 * only; nothing ever checked (3), which is the file every future session is
 * told to read FIRST when picking a new game. This does all of it with plain
 * node — no Chromium, no deps — so it can run on any change.
 *
 * Usage:  node .claude/scripts/check-games-sync.cjs
 *         (run from the repo root)
 *
 * Output: KEY=value lines, then GAMES-SYNC: GREEN | RED  (exit 0 / 1)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const HUB = path.join(ROOT, 'games', 'index.html');
const INDEX = path.join(ROOT, '.claude', 'games-index.md');
const problems = [];
const fail = (m) => problems.push(m);

for (const f of [HUB, INDEX]) {
  if (!fs.existsSync(f)) {
    console.log('GAMES-SYNC: RED');
    console.error('missing required file: ' + f);
    process.exit(1);
  }
}
const hub = fs.readFileSync(HUB, 'utf8');
const idx = fs.readFileSync(INDEX, 'utf8');

/* ---------- 1. hub cards ---------- */
const cards = [];
const cardRe = /<a class="game-card" href="([^"]+)">\s*<div class="game-icon">([^<]+)<\/div>[\s\S]*?<div class="game-name">([^<]+)<\/div>/g;
let m;
while ((m = cardRe.exec(hub))) cards.push({ href: m[1], icon: m[2].trim(), name: m[3].trim() });

/* ---------- 2. GAMES[] dataset ---------- */
const ds = [];
const dsRe = /\{\s*n:\s*'([^']+)',\s*i:\s*'([^']+)',\s*h:\s*'([^']+)',([\s\S]*?)\},?\n/g;
while ((m = dsRe.exec(hub))) {
  const rest = m[4];
  const arr = (key) => {
    const mm = new RegExp(key + ":\\s*\\[([^\\]]*)\\]").exec(rest);
    return mm ? mm[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : [];
  };
  ds.push({
    name: m[1].trim(), icon: m[2].trim(), href: m[3].trim(),
    genre: arr('genre'), input: arr('input'), session: arr('session'),
    mech: arr('mech'), players: arr('players'),
  });
}

/* ---------- 3. games-index.md catalog rows ---------- */
const rows = [];
for (const line of idx.split('\n')) {
  if (!line.startsWith('|')) continue;
  const c = line.split('|').map(s => s.trim());
  // | Game | Path | Genre | Input | Session | Mechanics | Players | Context |
  if (c.length < 9) continue;
  if (/^-+$/.test(c[2]) || c[1] === 'Game') continue;      // header / separator
  const list = (s) => s.split(',').map(x => x.trim()).filter(Boolean);
  rows.push({
    name: c[1], href: c[2].replace(/`/g, ''),
    genre: list(c[3]), input: list(c[4]), session: list(c[5]),
    mech: list(c[6]), players: list(c[7]), context: c[8].replace(/`/g, ''),
  });
}

console.log('CARDS=' + cards.length);
console.log('DATASET=' + ds.length);
console.log('INDEX_ROWS=' + rows.length);

/* ---------- cards <-> dataset ---------- */
const byHref = (list) => { const o = {}; for (const x of list) o[x.href] = x; return o; };
const C = byHref(cards), D = byHref(ds), R = byHref(rows);

for (const c of cards) if (!D[c.href]) fail('hub card has no GAMES[] entry: ' + c.href);
for (const d of ds) if (!C[d.href]) fail('GAMES[] entry has no hub card: ' + d.href);
for (const c of cards) {
  const d = D[c.href]; if (!d) continue;
  if (d.icon !== c.icon) fail('icon mismatch for ' + c.href + ': card ' + c.icon + ' vs dataset ' + d.icon);
  if (d.name.toUpperCase() !== c.name.toUpperCase()) fail('name mismatch for ' + c.href + ': card "' + c.name + '" vs dataset "' + d.name + '"');
}
const seenIcon = {};
for (const c of cards) {
  if (seenIcon[c.icon]) fail('duplicate hub icon ' + c.icon + ' (' + seenIcon[c.icon] + ' and ' + c.href + ')');
  seenIcon[c.icon] = c.href;
}

/* ---------- dataset <-> games-index rows ---------- */
for (const d of ds) if (!R[d.href]) fail('GAMES[] entry missing a games-index.md row: ' + d.href);
for (const r of rows) if (!D[r.href]) fail('games-index.md row has no GAMES[] entry: ' + r.href);

const same = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
for (const d of ds) {
  const r = R[d.href]; if (!r) continue;
  for (const axis of ['genre', 'input', 'session', 'mech', 'players']) {
    if (!same(d[axis], r[axis]))
      fail('facet mismatch (' + axis + ') for ' + d.href + ': dataset [' + d[axis] + '] vs index [' + r[axis] + ']');
  }
  if (r.name.toUpperCase() !== d.name.toUpperCase())
    fail('name mismatch for ' + d.href + ': index "' + r.name + '" vs dataset "' + d.name + '"');
}

/* ---------- rows <-> disk ---------- */
for (const r of rows) {
  const p = path.join(ROOT, 'games', r.href);
  const ok = r.href.endsWith('.html') ? fs.existsSync(p)
    : fs.existsSync(path.join(p, 'index.html'));
  if (!ok) fail('games-index.md row points at a missing game: ' + r.href);
  if (r.context && r.context.startsWith('.claude/') && !fs.existsSync(path.join(ROOT, r.context)))
    fail('context file listed but missing: ' + r.context + ' (' + r.href + ')');
}

/* ---------- the count line ---------- */
const cm = /^(\d+)\s+games\s+\((\d+)\s+in-repo\s+\+\s+(\d+)\s+external/m.exec(idx);
if (!cm) fail('games-index.md is missing its "N games (M in-repo + K external builds)" count line');
else {
  const [tot, inrepo, ext] = [+cm[1], +cm[2], +cm[3]];
  console.log('COUNT_LINE=' + tot + '/' + inrepo + '+' + ext);
  if (tot !== rows.length) fail('count line says ' + tot + ' games but the table has ' + rows.length + ' rows');
  if (inrepo + ext !== tot) fail('count line does not add up: ' + inrepo + ' + ' + ext + ' != ' + tot);
}

/* ---------- dashboard facets ---------- */
// every facet value in the dataset should be reachable by the dashboard's AXES
const axesRe = /\{\s*key:\s*'(\w+)'/g;
const axes = [];
while ((m = axesRe.exec(hub))) axes.push(m[1]);
for (const axis of ['genre', 'input', 'session', 'mech', 'players'])
  if (!axes.includes(axis)) fail('coverage dashboard AXES is missing the "' + axis + '" axis');

console.log('PROBLEMS=' + problems.length);
for (const p of problems) console.log('  - ' + p);
console.log('GAMES-SYNC: ' + (problems.length ? 'RED' : 'GREEN'));
process.exit(problems.length ? 1 : 0);
