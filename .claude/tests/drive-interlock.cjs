#!/usr/bin/env node
/**
 * drive-interlock.cjs — solvability gate for Interlock's puzzle generator.
 *
 *   node .claude/tests/drive-interlock.cjs [--runs N]
 *
 * Pure node, no Chromium, ~2 s. Why this one earns a file: Interlock has no
 * authored levels. Every board a player ever sees is generated at load, so the
 * generator IS the content, and its failure mode is silent — a piece whose exit
 * path is blocked in all six directions does not throw, it just sits there
 * jiggling, and the player reads it as "I am bad at this" rather than "this
 * puzzle has no solution". The three properties below are the whole contract:
 *
 *   1. exact piece count           — the player was promised n pieces
 *   2. an exact partition of the cube — every cell covered once, no overlaps,
 *                                     no holes, every piece itself connected
 *   3. a full removal sequence     — repeatedly find SOME piece whose straight
 *                                     exit path is clear against the pieces
 *                                     still present, remove it, repeat until
 *                                     the board is empty
 *
 * (3) is the real check and it is re-derived here rather than trusted: it runs
 * the same canSlide() the game runs, against the same shrinking board, so a
 * generator that peels along an axis it then blocks cannot pass.
 *
 * The game's src/puzzle.js is an ES module; it is read and evaluated here
 * rather than imported so this file can stay .cjs like its neighbours.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'games', 'interlock', 'src', 'puzzle.js');
const BUILT = path.join(ROOT, 'games', 'interlock', 'index.html');

let bad = 0;
const fail = (m) => { bad++; console.log('  FAIL ' + m); };
const ok = (c, m) => { if (c) console.log('  ok   ' + m); else fail(m); };

/* ---- load the generator out of the source module ---- */
if (!fs.existsSync(SRC)) { console.log('INTERLOCK: RED'); console.error('missing ' + SRC); process.exit(1); }
const mod = {};
vm.runInNewContext(fs.readFileSync(SRC, 'utf8').replace(/\bexport\s+/g, '') +
  ';mod.directions=directions;mod.canSlide=canSlide;mod.generatePuzzle=generatePuzzle;', { mod, Math });
const { directions, canSlide, generatePuzzle } = mod;

/* ---- a seeded RNG, so a red run is reproducible ---- */
function rng(seed) { let x = seed >>> 0; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

const argRuns = process.argv.indexOf('--runs');
const RUNS = argRuns > 0 ? +process.argv[argRuns + 1] : 12;   // per size, 5..20

const key = (p) => p.join(',');
function pieceConnected(cells) {
  const set = new Set(cells.map(key));
  const todo = [cells[0]], seen = new Set([key(cells[0])]);
  while (todo.length) {
    const c = todo.pop();
    for (const d of directions) {
      const k = key(c.map((v, i) => v + d[i]));
      if (set.has(k) && !seen.has(k)) { seen.add(k); todo.push(c.map((v, i) => v + d[i])); }
    }
  }
  return seen.size === cells.length;
}

/* ---- fixtures: boards whose answer is known by hand ----
 * Written after two rows of this gate were caught green-and-worthless
 * (2026-09-19). The solvability loop below proves a board CAN be taken apart,
 * which a canSlide() that always says yes satisfies trivially — so the
 * collision test needs a case it must answer NO to, and the stuck detector
 * needs a board it must refuse. A 3-cube with one cell at its centre is both:
 * the core is walled in on all six sides, and the shell is walled in by the
 * core, so nothing moves and the correct verdict is "no solution". */
console.log('-- fixtures --');
{
  const core = { id: 0, cells: [[1, 1, 1]], dir: [0, 1, 0], removed: false };
  const shell = { id: 1, cells: [], dir: [0, 1, 0], removed: false };
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++)
    if (x !== 1 || y !== 1 || z !== 1) shell.cells.push([x, y, z]);
  const board = [core, shell];
  ok(directions.every((d) => !canSlide(core, d, board)), 'a walled-in core slides in none of the six directions');
  ok(directions.every((d) => !canSlide(shell, d, board)), 'the shell around it is blocked by the core too');
  ok(!board.some((p) => directions.some((d) => canSlide(p, d, board))), 'so the solver calls this board stuck');

  // and the same core with the shell gone must be free, or the check above
  // would also pass on a canSlide() that always says no
  const alone = [{ ...core }];
  ok(directions.every((d) => canSlide(alone[0], d, alone)), 'an unobstructed piece slides in all six directions');
}

console.log('-- generator: ' + RUNS + ' puzzles at each size 5..20 --');
let boards = 0, worstSteps = Infinity, totalCells = 0;
const sizes = new Set();
for (let n = 5; n <= 20; n++) {
  for (let r = 0; r < RUNS; r++) {
    const seed = n * 1000 + r + 1;
    let pz;
    try { pz = generatePuzzle(n, rng(seed)); }
    catch (e) { fail('n=' + n + ' seed=' + seed + ' threw: ' + e.message); continue; }
    boards++;
    sizes.add(pz.size);
    const label = 'n=' + n + ' seed=' + seed;

    if (pz.pieces.length !== n) { fail(label + ': got ' + pz.pieces.length + ' pieces, promised ' + n); continue; }

    /* --- exact partition of the size^3 cube --- */
    const cells = new Map();
    let dup = null;
    for (const p of pz.pieces) for (const c of p.cells) {
      const k = key(c);
      if (cells.has(k)) dup = k;
      cells.set(k, p.id);
    }
    const want = pz.size ** 3;
    if (dup) { fail(label + ': cell ' + dup + ' belongs to two pieces'); continue; }
    if (cells.size !== want) { fail(label + ': covers ' + cells.size + ' of ' + want + ' cells'); continue; }
    let outside = null;
    for (const c of cells.keys()) {
      const v = c.split(',').map(Number);
      if (v.some((x) => x < 0 || x >= pz.size)) { outside = c; break; }
    }
    if (outside) { fail(label + ': cell ' + outside + ' is outside the ' + pz.size + '-cube'); continue; }
    const loose = pz.pieces.find((p) => !p.cells.length || !pieceConnected(p.cells));
    if (loose) { fail(label + ': piece ' + loose.id + ' is empty or not a connected polycube'); continue; }
    totalCells += cells.size;

    /* --- the whole board can actually be taken apart --- */
    const live = pz.pieces.map((p) => ({ ...p, removed: false }));
    let steps = 0, stuck = null;
    for (let left = n; left > 0; left--) {
      const free = live.find((p) => !p.removed && directions.some((d) => canSlide(p, d, live)));
      if (!free) { stuck = left; break; }
      free.removed = true;
      steps++;
    }
    if (stuck !== null) { fail(label + ': unsolvable — ' + stuck + ' pieces left with no clear exit'); continue; }
    if (steps !== n) { fail(label + ': removal sequence ran ' + steps + ' steps for ' + n + ' pieces'); continue; }
    worstSteps = Math.min(worstSteps, steps);
  }
}
ok(boards === 16 * RUNS, 'generated ' + boards + ' boards (expected ' + 16 * RUNS + ')');
ok(boards > 0 && worstSteps !== Infinity, 'every board was taken fully apart (shortest full sequence: ' + worstSteps + ')');
ok([...sizes].every((s) => s >= 4 && s <= 6), 'cube sizes stay in 4..6 (saw ' + [...sizes].sort().join(',') + ')');
ok(totalCells > 0, 'cells checked: ' + totalCells);

/* ---- the shipped page is the one built from src/ ---- */
console.log('-- built page --');
if (!fs.existsSync(BUILT)) fail('games/interlock/index.html is missing — run `node games/interlock/build.mjs`');
else {
  const html = fs.readFileSync(BUILT, 'utf8');
  ok(!/<script[^>]+\bsrc=/.test(html) && !/<link[^>]+stylesheet/.test(html),
     'index.html is self-contained (no external script/stylesheet refs)');
  // The page has to carry EVERY line of src/, not just the generator: pinning
  // one line let an edit to any other line ship unbuilt (caught by negative
  // test, 2026-09-19). Same stripping build.mjs does, then line containment —
  // these files are written in very long lines, so this is a tight check.
  const strip = (f) => fs.readFileSync(path.join(ROOT, 'games', 'interlock', 'src', f), 'utf8')
    .replace(/import\s+[^;\n]*?\s+from\s*(['\"])[^'\"]*\1\s*;?/g, '')
    .replace(/\bexport\s+(?=(?:const|let|var|function|class)\b)/g, '');
  let stale = null, lines = 0;
  for (const f of ['puzzle.js', 'world.js', 'audio.js', 'game.js']) {
    for (const line of strip(f).split('\n')) {
      const t = line.trim();
      if (!t) continue;
      lines++;
      if (!html.includes(t)) { stale = f + ': ' + t.slice(0, 60) + '...'; break; }
    }
    if (stale) break;
  }
  ok(!stale && lines > 20, 'all ' + lines + ' source lines are in the built page' +
     (stale ? ' — STALE at ' + stale + ' (run `node games/interlock/build.mjs`)' : ''));
  for (const id of ['back-btn', 'mute-btn', 'reload-btn', 'settingsButton'])
    ok(html.includes('id="' + id + '"'), 'chrome button #' + id + ' is on the page');
}

console.log('INTERLOCK: ' + (bad ? 'RED' : 'GREEN'));
process.exit(bad ? 1 : 0);
