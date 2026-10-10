#!/usr/bin/env node
/**
 * drive-cyoa2.cjs - generator, engine and flow gate for CYOA2 (games/cyoa2/), the
 * map-table sequel to CYOA.
 *
 *   NODE_PATH=/opt/node-tools/node_modules node .claude/tests/drive-cyoa2.cjs
 *
 * Why this earns a file: there are no authored maps, so the generators ARE the
 * content, and a bad board does not throw. A crate that walls a room in, a door
 * that opens onto a table, a flower pot floating over nothing, a town whose smithy
 * never got a lot, a save that quietly regenerates a place the player has already
 * seen - none of those shows in a screenshot of one seed. So the suite asserts the
 * contract directly, across many seeds:
 *
 *   A. chrome: CYOA's exceptions carried over (no top-left chrome, 2x reload
 *      top-right, EXIT on the title)
 *   B. the asset library is a table: every row well-formed, every row has a
 *      painter that draws ink at all four turns, every recipe names real assets
 *   C. the world bible is a pure function of the seed
 *   D. every charted board, over SEEDS worlds: whole (every free square walkable
 *      to), nothing overlapping, every door clear both sides, every small thing on
 *      a real surface slot, every person on a free square, lots match interiors
 *   E. the brief's own example: a 5 x 10 ft table and the flower pot on it are
 *      two objects
 *   F. charting order never changes a board (people and places made on the fly
 *      included), and the same seed gives the same world
 *   G. the engine: illegal intents are refused and change nothing; a walk follows
 *      a legal path, opens the doors it passes, and is journalled
 *   H. on-the-fly places are documented: a board is absent until someone goes
 *      there, is in the save afterwards, and is NOT regenerated on load
 *   I. a save round-trips exactly; a hostile file is refused or defanged, and its
 *      text is never markup
 *   J. the flow on a phone: new tale, opening, tap-to-walk, cards, the way out,
 *      autosave and Continue
 *   K. a tap lands on the square drawn there, at several viewports, and after a
 *      resize that happened while the board was hidden
 *   L. gestures: a pan or a pinch never walks; keys walk; a text field keeps its letters
 *   M. panels: chronicle, library, settings; night reading; no console error
 *
 * Step 2 (grid rules) added three sections. Its failures are quiet in a different
 * way: sight that leaks through one kind of corner, a follower left standing in a
 * doorway, a turn that spends no feet. None of them throws either.
 *
 *   N. sight and fog: the engine's line of sight against an INDEPENDENT judge (a
 *      line walked in fiftieths of a square, no shared code) - sound and complete;
 *      nothing in sight by halves; seen is kept, sight is not; a traveller keeps to
 *      known ground; what the table draws under fog, measured off its pixels; what
 *      a tap on the unseen means
 *   O. the party: six and no more; a newcomer stands a walk away, never through a
 *      wall; the rest trail the leader a legal step at a time, change places in a
 *      passage one square wide, close up when the leader stops; a tampered party
 *      in a file; the bar, the panel and the lead, by touch; the bar on four screens
 *   P. rounds: who rolls, in what order, on whose dice; whose turn it is and that
 *      nobody else may act; reach that is exactly what a move accepts; 30 ft and
 *      not a foot more; who may pass whom; a monster's turn moved by hand; a
 *      newcomer joining mid-fight; a round through a save; and the whole flow by
 *      touch, from "You are seen" to standing down
 *
 * Step 3 (the Game Master, sheets and blows) added four. What goes wrong here is
 * quiet in a third way: a rule that only matters on a natural 1, a tool that
 * refuses for the wrong reason, a telling that fails half way and leaves half of
 * itself behind, a key that ends up in a save.
 *
 *   Q. sheets, blows and dying, in the engine alone: sheets by calling; dice parsed
 *      strictly; many fights played out by the monsters' script against the suite's
 *      OWN traveller with every invariant checked after every deed; the same seed
 *      fights the same fight; reach, sight and cover on ground chosen for them; each
 *      trick in a fight arranged for it; then the rules a lucky run does not reach,
 *      with THE DICE MADE TO FALL as each row needs (the tale's dice are counted, so
 *      `force` sets the count to where a wanted number comes up next): natural 1 and
 *      20, bless, inspiration, sneak attack alone and with advantage, the undead,
 *      death saves die by die; old saves and hostile files
 *   R. the table by touch, no Game Master: the story panel on five screens; a fight
 *      in which the monsters play themselves and the travellers are played by taps
 *      (the ring, the blow, the card, DASH); wounds and marks off the painter's own
 *      pixels; sheets, rests, the journal; then by hand, the cross, defeat and
 *      rescue, the end of a tale
 *   S. the Game Master's 25 tools, called directly: closed schemas; one of each kind
 *      of bad call refused with the tale byte for byte the same; a tool that throws
 *      puts the tale back; each tool's happy path; a fight through the tools; harm,
 *      peace and truce in the middle of one; what the turn context carries and why;
 *      fog honesty in the board digest; the bible text byte-stable
 *   T. the Game Master at the table. First the REAL client against a stand-in for
 *      api.anthropic.com (request shapes, the cached prefix, a streamed tool call,
 *      markup that stays text, billing on the model that served, a field healed
 *      once, retries, refusals, silence after tools, broken tool JSON, a failure
 *      half way that puts the tale back, the busy lock and STOP, the key's hiding
 *      places, the ledger, a reload). Then a stand-in for the model itself
 *      (window.__CYOA2_MOCK__): beats, pieces moved by name, TALK, travel, the
 *      monsters' turn handed over on a pinned model, the script taking it back when
 *      the Game Master fails, and a tale opened from a file while another is told
 *
 * A to P run with the story folded and (P) the monsters moved by hand, through
 * open()'s settings argument: step 3 changed both defaults, and the older rows are
 * about geometry and movement that those defaults would move or play for them.
 *
 * CYOA2_ONLY=NOP (any letters; A stands for A to I) runs only those sections, for
 * negative tests aimed at one of them. CYOA2_PAGE=<path> points the suite at a COPY
 * of the page, which is how .claude/scripts/negtest-copies.py runs breaks several at
 * a time without touching the shipping file. Neither ever prints "CYOA2: GREEN".
 *
 * Sections K and L lift the fog through its own setting, on purpose: both ask
 * whether a tap walked, and under fog a tap on unseen ground walks nobody whatever
 * the code under test did. Each had a row go green over a deliberate break that way
 * (2026-10-10); the trace is in .claude/cyoa2.md.
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
/* CYOA2_PAGE=<path> points the suite at a copy of the page (to write rows while a negative-test batch is breaking the real one). Like a partial run, it never prints GREEN. */
const COPY = process.env.CYOA2_PAGE || '';
const PAGE = 'file://' + (COPY ? path.resolve(COPY) : path.join(ROOT, 'games', 'cyoa2', 'index.html'));
const SEEDS = 36;
/* CYOA2_ONLY=NOP runs only those sections (A stands for A to I, which share a page). It is for negative tests, where
   one break is aimed at one section; a partial run never prints the GREEN line a gate looks for.                       */
const ONLY = (process.env.CYOA2_ONLY || '').toUpperCase(), want = (k) => !ONLY || ONLY.includes(k);
let bad = 0, good = 0;
const fail = (m) => { bad++; console.log('  FAIL ' + m); };
const clipTo = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '...' : String(s));
const ok = (c, m) => { if (c) { good++; console.log('  ok   ' + m); } else fail(m); };

(async () => {
  let browser;
  try { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  catch (e) { try { browser = await chromium.launch(); } catch (e2) { console.log('CYOA2: RED'); console.error('no chromium: ' + e2.message); process.exit(1); } }
  const errors = [];
  const open = async (vp, opts, settings) => {
    const ctx = await browser.newContext(Object.assign({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, opts || {}));
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/i.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.addInitScript((extra) => { try { localStorage.setItem('cyoa2.settings.v1', JSON.stringify(Object.assign({ seed: 'drive-seed-1', musicVol: 0, sfxVol: 0, theme: 'light', storyOpen: false }, extra || {}))); } catch (e) { /* ignore */ } }, settings || null);
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof newGame === 'function' && typeof View === 'object');
    return { ctx, page };
  };
  const idle = (page) => page.waitForFunction(() => G.st && !G.st.walk && !View.walking && View.anim.t >= 1 && !document.getElementById('veil').classList.contains('on'), null, { timeout: 15000 });
  const begin = async (page) => {
    await page.evaluate(() => document.getElementById('btn-new').click());
    await page.waitForFunction(() => document.getElementById('dialog').classList.contains('open'), null, { timeout: 8000 });
    await page.evaluate(() => document.querySelector('#dlg-btns button').click());
    await idle(page);
  };

  if (want('A')) {
  /* ------------------------------------------------------------------ A */
  console.log('A. chrome');
  const A = await open({ width: 390, height: 844 });
  {
    const r = await A.page.evaluate(() => {
      const rb = document.getElementById('reload-btn').getBoundingClientRect(), bb = document.getElementById('build-badge').getBoundingClientRect();
      return { rw: rb.width, rh: rb.height, right: innerWidth - rb.right, below: rb.top >= bb.bottom - 1, back: !!document.getElementById('back-btn'), mute: !!document.getElementById('mute-btn'),
        exit: document.getElementById('btn-exit').getAttribute('href'), title: document.querySelector('.title').textContent, badge: document.getElementById('build-badge').textContent,
        cont: document.getElementById('btn-continue').hidden, csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]').content };
    });
    ok(r.rw === 76 && r.rh === 60 && r.right < 20 && r.below, 'reload button is 76x60, top-right, below the badge');
    ok(!r.back && !r.mute, 'no top-left back or mute chrome');
    ok(r.exit === '../index.html', 'EXIT on the title leads to the hub');
    ok(r.title === 'CYOA2', 'title reads CYOA2');
    ok(/^build \d{4}-\d\d-\d\d \d\d:\d\d UTC$/.test(r.badge), 'build badge carries a real timestamp: ' + r.badge);
    ok(r.cont === true, 'no Continue before there is a tale');
    ok(/connect-src https:\/\/api\.anthropic\.com;/.test(r.csp) && !/connect-src[^;]*(\*|http:|'self'|data:)/.test(r.csp) && (r.csp.match(/https?:\/\/[a-z0-9.-]+/g) || []).sort().join() === 'https://api.anthropic.com,https://fonts.googleapis.com,https://fonts.gstatic.com', 'the page may call one service and one only: the Game Master, at api.anthropic.com');
  }

  /* ------------------------------------------------------------------ B */
  console.log('B. the asset library');
  {
    const r = await A.page.evaluate(() => {
      const out = { n: 0, bad: [], blank: [], recipe: [], tops: [] };
      const ids = Object.keys(ASSETS);
      out.n = ids.length;
      for (const id of ids) {
        const a = ASSETS[id];
        if (a.id !== id || typeof a.n !== 'string' || !a.n || !Number.isInteger(a.w) || !Number.isInteger(a.h) || a.w < 1 || a.h < 1 || a.w > 4 || a.h > 4) out.bad.push(id + ' shape');
        if (!['b', 'r', 'f'].includes(a.mv)) out.bad.push(id + ' mv');
        if (!['o', 'd'].includes(a.lay) || !['', 's'].includes(a.sz) || !Number.isInteger(a.surf) || a.surf < 0 || a.surf > 2) out.bad.push(id + ' flags');
        if (a.sz === 's' && (a.w !== 1 || a.h !== 1 || a.surf)) out.bad.push(id + ' small thing must be 1x1 and hold nothing');
        if (a.lay === 'd' && a.mv !== 'f') out.bad.push(id + ' a decal cannot block');
        if (typeof a.d !== 'string' || a.d.length < 4 || typeof a.cat !== 'string' || !a.cat) out.bad.push(id + ' text');
        if (typeof ART[id] !== 'function') { out.bad.push(id + ' has no painter'); continue; }
        /* the painter draws ink, inside its box, at every turn */
        for (let rot = 0; rot < 4; rot++) {
          const cv = document.createElement('canvas'), px = 24, fw = rot & 1 ? a.h : a.w, fh = rot & 1 ? a.w : a.h; cv.width = (fw + 2) * px; cv.height = (fh + 2) * px;
          const g = cv.getContext('2d'); g.fillStyle = '#efe3c8'; g.fillRect(0, 0, cv.width, cv.height);
          g.setTransform(px, 0, 0, px, px, px); g.translate(fw / 2, fh / 2); g.rotate(rot * Math.PI / 2); g.translate(-a.w / 2, -a.h / 2);
          try { ART[id](Pen(g, RUB), a, { id: 'T1' }); } catch (e) { out.bad.push(id + ' painter threw: ' + e.message); break; }
          const d = g.getImageData(0, 0, cv.width, cv.height).data; let ink = 0;
          for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 239) + Math.abs(d[i + 1] - 227) + Math.abs(d[i + 2] - 200) > 40) ink++;
          if (ink < 12) out.blank.push(id + ' r' + rot);
        }
      }
      for (const id of Object.keys(ART)) if (!ASSETS[id]) out.bad.push('painter without a row: ' + id);
      for (const k of Object.keys(ROOMS)) for (const rule of ROOMS[k]) {
        if (typeof rule === 'function' || rule.who) continue;
        for (const a of [].concat(rule.a)) if (!ASSETS[a] || ASSETS[a].sz) out.recipe.push(k + ' places ' + a);
        if (rule.seats && !ASSETS[rule.seats[0]]) out.recipe.push(k + ' seats ' + rule.seats[0]);
        if (rule.tops && (!TOPS[rule.tops] || !ASSETS[[].concat(rule.a)[0]].surf)) out.recipe.push(k + ' tops ' + rule.tops);
        if (rule.at && !['wall', 'corner', 'mid', 'any'].includes(rule.at)) out.recipe.push(k + ' at ' + rule.at);
      }
      for (const k of Object.keys(TOPS)) for (const it of TOPS[k].items) if (!ASSETS[it[0]] || ASSETS[it[0]].sz !== 's' || !(it[1] > 0)) out.tops.push(k + ' ' + it[0]);
      return out;
    });
    ok(r.n >= 60, 'the library holds ' + r.n + ' assets');
    ok(r.bad.length === 0, 'every row is well-formed and has a painter' + (r.bad.length ? ': ' + r.bad.slice(0, 5).join('; ') : ''));
    ok(r.blank.length === 0, 'every painter leaves ink at all four turns' + (r.blank.length ? ': ' + r.blank.slice(0, 5).join(', ') : ''));
    ok(r.recipe.length === 0, 'every room recipe names real furniture and real tables of small things' + (r.recipe.length ? ': ' + r.recipe.slice(0, 5).join('; ') : ''));
    ok(r.tops.length === 0, 'every small-things table lists small things' + (r.tops.length ? ': ' + r.tops.slice(0, 5).join('; ') : ''));
  }

  /* ------------------------------------------------------------------ C */
  console.log('C. the world bible');
  {
    const r = await A.page.evaluate(() => {
      const a = JSON.stringify(generateWorld('bible-1')), b = JSON.stringify(generateWorld('bible-1')), c = JSON.stringify(generateWorld('bible-2')), w = JSON.parse(a);
      return { same: a === b, differ: a !== c, kinds: w.sites.map((s) => s.kind).join(','), npcs: w.npcs.length, threads: w.threads.length, mains: w.threads.filter((t) => t.main).length,
        holes: w.threads.some((t) => /[{}]/.test(t.t)) || /[{}]/.test(w.opening), names: new Set(w.npcs.map((n) => n.name)).size };
    });
    ok(r.same && r.differ, 'the bible is a pure function of the seed');
    ok(r.kinds === 'town,inn,cave,smithy,shop,chapel', 'it names the town, its inn, the cave and three trades: ' + r.kinds);
    ok(r.npcs === 7 && r.names === 7, 'seven people who matter, no two with one name');
    ok(r.threads === 3 && r.mains === 1 && !r.holes, 'one matter at hand and two whispers, every blank filled in');
  }

  /* ------------------------------------------------------------- D, E, F */
  console.log('D. every board, over ' + SEEDS + ' worlds');
  {
    const r = await A.page.evaluate((N) => {
      const F = [], S = { maps: 0, objs: 0, items: 0, tok: 0, houses: 0, potOnLong: 0, used: {}, order: 0, same: 0, gates: 0 };
      const f = (s) => { if (F.length < 30) F.push(s); };
      for (let k = 0; k < N; k++) {
        const seed = 'drive-' + k, st = newGame(seed);
        for (const id of Object.keys(st.sites)) if (!chart(st, id)) f(seed + ' cannot chart ' + id);
        for (const id of Object.keys(st.maps)) {
          const m = st.maps[id], W = m.w, tag = seed + ' ' + id + ' ' + m.kind + ': '; S.maps++;
          const a0 = m.exits[0].arrive, seen = floodReach(m, a0[0], a0[1]);
          if (!tileFree(m, a0[0], a0[1])) f(tag + 'the way in is blocked');
          for (const e of m.exits) { if (!exitGoals(m, e).some((p) => seen[p[1] * W + p[0]])) f(tag + 'a way out cannot be reached'); if (!st.sites[e.to]) f(tag + 'a way out leads nowhere'); }
          if (m.kind !== 'town') { let un = 0; for (let i = 0; i < W * m.h; i++) if (tileFree(m, i % W, (i - i % W) / W) && !seen[i]) un++; if (un) f(tag + un + ' free squares cannot be reached'); }
          const occ = new Map(), ids = new Set(), slots = new Set();
          for (const o of m.objs) {
            const a = ASSETS[o.a]; if (!a) { f(tag + 'unknown asset ' + o.a); continue; }
            if (ids.has(o.id)) f(tag + 'two things share an id'); ids.add(o.id); S.used[o.a] = 1;
            if (o.on) {
              S.items++; const par = m._.byId.get(o.on);
              if (!par || par.on) { f(tag + o.a + ' sits on nothing'); continue; }
              const fp = footprint(par), cap = fp.w * fp.h * ASSETS[par.a].surf;
              if (a.sz !== 's' || !ASSETS[par.a].surf || o.slot < 0 || o.slot >= cap || slots.has(o.on + ':' + o.slot)) f(tag + o.a + ' is not in a slot of its own on ' + par.a);
              slots.add(o.on + ':' + o.slot);
              if (o.a === 'flower_pot' && par.a === 'table_long' && fp.w * fp.h === 2) S.potOnLong++;
              continue;
            }
            S.objs++; const fp = footprint(o);
            for (let j = 0; j < fp.h; j++) for (let i = 0; i < fp.w; i++) {
              const x = fp.x + i, y = fp.y + j, key = (a.lay === 'd' ? 'd' : 'o') + (y * W + x);
              if (!inb(m, x, y) || !TWALK[m.t[y * W + x]]) f(tag + o.a + ' stands where nothing can'); if (occ.has(key)) f(tag + o.a + ' overlaps ' + occ.get(key)); occ.set(key, o.a);
              if (i + 1 < fp.w && eGet(m, x, y, 1)) f(tag + o.a + ' straddles a wall'); if (j + 1 < fp.h && eGet(m, x, y, 2)) f(tag + o.a + ' straddles a wall');
            }
          }
          for (const d of m.doors) { if (d.kind === 'gate') S.gates++; for (const p of doorSides(d)) if (!tileFree(m, p[0], p[1])) f(tag + 'a door opens onto something solid'); }
          const tk = new Set();
          for (const t of m.tokens) { S.tok++; if (!tileFree(m, t.x, t.y)) f(tag + 'someone stands inside a thing'); if (tk.has(t.x + ',' + t.y)) f(tag + 'two people on one square'); tk.add(t.x + ',' + t.y); if (!st.npcs[t.npc]) f(tag + 'a token with no person'); if (t.k !== 'captive' && !seen[t.y * W + t.x]) f(tag + 'someone nobody can reach'); }
          if (m.kind === 'town') {
            const kinds = m.lots.map((l) => l.kind); for (const q of ['inn', 'smithy', 'shop', 'chapel']) if (kinds.filter((x) => x === q).length !== 1) f(tag + 'wants exactly one ' + q);
            S.houses += kinds.filter((x) => x === 'house').length;
            for (const L of m.lots) { const im = st.maps[L.site]; if (!im) { f(tag + 'a lot with no building'); continue; } if (im.w !== L.w + 4 || im.h !== L.h + 4) f(tag + 'a building that does not fit its lot');
              const ex = m.exits.find((e) => e.to === L.site); if (!ex || !im.exits.some((e) => e.to === 'S0')) f(tag + 'a building you cannot get in and out of');
              for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) if (m.t[(L.y + j) * W + L.x + i] !== TR.ROOF) f(tag + 'a lot that is not all roof'); }
            for (const a of m.lots) for (const b of m.lots) if (a !== b && a.x < b.x + b.w + 1 && b.x < a.x + a.w + 1 && a.y < b.y + b.h + 1 && b.y < a.y + a.h + 1) f(tag + 'two buildings touch');
          }
          if (m.kind === 'cave') { const kinds = m.rooms.map((q) => q.kind); for (const q of ['cave_guard', 'cave_den', 'cave_chief', 'cell']) if (!kinds.includes(q)) f(tag + 'no ' + q); if (!m.tokens.some((t) => t.npc === 'N5') || !m.tokens.some((t) => t.npc === 'N6' && t.k === 'captive')) f(tag + 'the chief or the prisoner is missing'); if (!m.doors.some((d) => d.lock && d.kind === 'bars')) f(tag + 'the cell has no locked door'); }
          if (m.kind === 'inn') { if (!m.tokens.some((t) => t.npc === 'N0')) f(tag + 'no innkeeper'); if (!m.objs.some((o) => o.a === 'bar') || !m.objs.some((o) => o.a === 'hearth')) f(tag + 'no bar or no hearth'); if (m.rooms.filter((q) => q.kind === 'guest').length < 2) f(tag + 'fewer than two guest rooms'); }
          if (m.kind === 'smithy' && (!m.objs.some((o) => o.a === 'forge') || !m.objs.some((o) => o.a === 'anvil'))) f(tag + 'no forge or no anvil');
          if (m.kind === 'chapel' && !m.objs.some((o) => o.a === 'altar')) f(tag + 'no altar');
          if (m.kind === 'shop' && !m.objs.some((o) => o.a === 'counter')) f(tag + 'no counter');
        }
        /* F: the same seed again, charted backwards */
        const st2 = newGame(seed); for (const id of Object.keys(st2.sites).reverse()) chart(st2, id);
        const p1 = packState(st), p2 = packState(st2);
        if (Object.keys(p1.maps).every((id) => JSON.stringify(p1.maps[id]) === JSON.stringify(p2.maps[id])) && Object.keys(p1.npcs).every((id) => JSON.stringify(p1.npcs[id]) === JSON.stringify(p2.npcs[id])) && Object.keys(p1.npcs).length === Object.keys(p2.npcs).length) S.order++;
        const st3 = newGame(seed); for (const id of Object.keys(st3.sites)) chart(st3, id);
        if (JSON.stringify(packState(st3).maps) === JSON.stringify(p1.maps)) S.same++;
      }
      S.unused = Object.keys(ASSETS).filter((a) => !S.used[a]);
      return { F, S };
    }, SEEDS);
    ok(r.F.length === 0, r.S.maps + ' boards are whole, with nothing overlapping, floating or walled in' + (r.F.length ? ': ' + r.F.slice(0, 6).join(' | ') : ''));
    ok(r.S.maps >= SEEDS * 8, 'every world charts its town, inn, cave, three trades and its houses (' + r.S.maps + ' boards, ' + r.S.houses + ' houses)');
    ok(r.S.objs / r.S.maps > 20 && r.S.items / SEEDS > 15 && r.S.tok / SEEDS > 12, 'boards are furnished and peopled (' + (r.S.objs / r.S.maps).toFixed(1) + ' things a board, ' + (r.S.items / SEEDS).toFixed(1) + ' small things and ' + (r.S.tok / SEEDS).toFixed(1) + ' people a world)');
    ok(r.S.unused.length === 0, 'no asset in the library goes unused' + (r.S.unused.length ? ': ' + r.S.unused.join(', ') : ''));
    ok(r.S.gates >= SEEDS / 4, 'the passage to the chief is gated where it narrows (' + r.S.gates + ' of ' + SEEDS + ' caves)');
    console.log('E. the brief\'s example');
    ok(r.S.potOnLong >= 3, 'a 5 x 10 ft table carries a flower pot as a second object (' + r.S.potOnLong + ' times in ' + SEEDS + ' worlds)');
    console.log('F. order and repetition');
    ok(r.S.order === SEEDS, 'charting the sites in the opposite order changes no board and no person (' + r.S.order + '/' + SEEDS + ')');
    ok(r.S.same === SEEDS, 'the same seed gives the same boards (' + r.S.same + '/' + SEEDS + ')');
  }

  /* ------------------------------------------------------------------ G */
  console.log('G. the engine');
  {
    const r = await A.page.evaluate(() => {
      const out = {}, st = newGame('engine-1'), pc = st.party[0], inn = st.maps.S1, snap = () => JSON.stringify(packState(st)).replace(/"saved":\d+/, '');
      const refuse = (it) => { const a = snap(), res = intent(st, it), b = snap(); return { ok: res.ok, why: res.why, say: res.say, same: a === b && !st.walk }; };
      /* a square inside a blocking thing, a door far away, the locked cell, and no way out underfoot */
      const blk = inn.objs.find((o) => !o.on && ASSETS[o.a].mv === 'b');
      out.blocked = refuse({ t: 'move', who: 'P1', to: [blk.x, blk.y] });
      out.oob = refuse({ t: 'move', who: 'P1', to: [-3, 999] });
      const far = inn.doors.find((d) => !doorSides(d).some((p) => p[0] === pc.x && p[1] === pc.y));
      out.far = refuse({ t: 'door', who: 'P1', id: far.id });
      out.noexit = refuse({ t: 'travel', who: 'P1' });
      out.unknown = refuse({ t: 'fly', who: 'P1' });
      out.nobody = refuse({ t: 'move', who: 'P9', to: [pc.x, pc.y] });
      out.nostep = refuse({ t: 'step', who: 'P1' });
      /* a real walk: out of the guest room, through its closed door, into the common room */
      const com = inn.rooms.findIndex((q) => q.kind === 'common'); let tgt = null;
      for (let i = 0; i < inn.w * inn.h && !tgt; i++) { const x = i % inn.w, y = (i - x) / inn.w; if (inn.rg[i] === com + 1 && tileFree(inn, x, y) && !tokenAt(inn, x, y) && inn._.occ[i] < 0) tgt = [x, y]; }
      const closed0 = inn.doors.filter((d) => !d.open).length, log0 = st.log.length, start = [pc.x, pc.y];
      const mv = intent(st, { t: 'move', who: 'P1', to: tgt });
      out.moveOk = mv.ok && mv.path.length > 2 && mv.path[mv.path.length - 1][0] === tgt[0] && mv.path[mv.path.length - 1][1] === tgt[1];
      let legal = true, prev = start, steps = 0, opened = 0, res;
      do { res = intent(st, { t: 'step', who: 'P1' }); if (res.ok) { steps++; if (Math.max(Math.abs(res.at[0] - prev[0]), Math.abs(res.at[1] - prev[1])) !== 1 || !tileFree(inn, res.at[0], res.at[1])) legal = false; prev = res.at; if (res.door) opened++; } } while (res.ok && !res.done && steps < 200);
      out.walk = { legal, arrived: pc.x === tgt[0] && pc.y === tgt[1], steps, planned: mv.path.length, opened, nowOpen: closed0 - inn.doors.filter((d) => !d.open).length, ft: mv.ft };
      const added = st.log.slice(log0);
      out.journal = { move: added.filter((e) => e.t === 'move' && e.to[0] === tgt[0] && e.to[1] === tgt[1] && e.ft === mv.ft).length, doors: added.filter((e) => e.t === 'door' && e.open).length };
      /* a door toggles only from beside it */
      const d = inn.doors.find((q) => q.open); const side = doorSides(d).find((p) => tileFree(inn, p[0], p[1]) && !tokenAt(inn, p[0], p[1]));
      intent(st, { t: 'move', who: 'P1', to: side }); for (let k = 0; k < 200 && st.walk; k++) intent(st, { t: 'step', who: 'P1' });
      const t1 = intent(st, { t: 'door', who: 'P1', id: d.id });
      out.toggle = t1.ok && t1.open === false && d.open === false;
      /* the cell in the cave is locked */
      const cave = chart(st, 'S2'), cell = cave.doors.find((q) => q.lock), cs = doorSides(cell).find((p) => cave.rooms[cave.rg[p[1] * cave.w + p[0]] - 1].kind !== 'cell');
      intent(st, { t: 'jump', who: 'P1', site: 'S2' });
      /* the walk stops each time a bandit comes in sight for the first time: ask again until it gets there */
      for (let h = 0; h < 20 && !(pc.x === cs[0] && pc.y === cs[1]); h++) { intent(st, { t: 'move', who: 'P1', to: cs }); for (let k = 0; k < 400 && st.walk; k++) intent(st, { t: 'step', who: 'P1' }); }
      out.atCell = pc.x === cs[0] && pc.y === cs[1];
      out.locked = refuse({ t: 'door', who: 'P1', id: cell.id });
      /* the square behind the bars, with the prisoner lifted off it: free to stand on, and still not to be walked to */
      const captive = cave.tokens.find((t) => t.k === 'captive'), cx = captive.x, cy = captive.y;
      cave.tokens = cave.tokens.filter((t) => t !== captive); indexMap(cave);
      out.cellFree = tileFree(cave, cx, cy) && !tokenAt(cave, cx, cy);
      out.cellShut = refuse({ t: 'move', who: 'P1', to: [cx, cy] });
      return out;
    });
    for (const [k, why] of [['blocked', 'blocked'], ['oob', 'bad'], ['far', 'far'], ['noexit', 'noexit'], ['unknown', 'bad'], ['nobody', 'nobody'], ['nostep', 'bad']])
      ok(r[k].ok === false && r[k].why === why && r[k].same && r[k].say, 'refused, with a reason, and nothing changed: ' + k + ' (' + r[k].why + ')');
    ok(r.moveOk, 'a walk is answered with the path the engine chose, ending where asked');
    ok(r.walk.legal && r.walk.arrived && r.walk.steps === r.walk.planned, 'every step of it is one square onto a free square (' + r.walk.steps + ' steps, ' + r.walk.ft + ' ft)');
    ok(r.walk.opened >= 1 && r.walk.opened === r.walk.nowOpen, 'it opens the closed doors it passes (' + r.walk.opened + ')');
    ok(r.journal.move === 1 && r.journal.doors === r.walk.opened, 'the walk and each door are journalled');
    ok(r.toggle, 'a door closes when asked from beside it');
    ok(r.atCell && r.locked.ok === false && r.locked.why === 'locked' && r.locked.same, 'the cell door is locked, and says so');
    ok(r.cellFree && r.cellShut.ok === false && r.cellShut.why === 'noway' && r.cellShut.same, 'no path leads through the locked door, even to an empty cell');
  }

  /* ------------------------------------------------------------------ H */
  console.log('H. places made on the fly are documented');
  {
    const r = await A.page.evaluate(() => {
      const out = {}, st = newGame('lazy-1'), pc = st.party[0];
      out.atStart = Object.keys(st.maps).sort().join(',');
      const house = Object.keys(st.sites).find((id) => st.sites[id].kind === 'house');
      out.houseMade = !!st.sites[house].made && !st.maps[house];
      const town = st.maps.S0, ex = town.exits.find((e) => e.to === house);
      intent(st, { t: 'jump', who: 'P1', site: 'S0' });
      const n0 = Object.keys(st.npcs).length;
      intent(st, { t: 'move', who: 'P1', goals: ex.tiles, then: { t: 'travel' } });
      let res, g = 0; do { res = intent(st, { t: 'step', who: 'P1' }); } while (res.ok && !res.done && ++g < 400);
      out.next = res.next && res.next.t;
      const tr = intent(st, Object.assign({ who: 'P1' }, res.next));
      out.entered = tr.ok && st.here === house && !!st.maps[house];
      out.charted = st.log.some((e) => e.t === 'chart' && e.site === house);
      out.people = Object.keys(st.npcs).length - n0;
      const made = Object.keys(st.npcs).filter((k) => st.npcs[k].home === house);
      out.fam = made.length > 0 && made.every((k) => st.npcs[k].made && st.npcs[k].name.split(' ')[1] === st.sites[house].fam);
      /* save, then load with every generator broken: a charted board must come from the save */
      const door = st.maps[house].doors[0]; door.open = true; look(st);
      const file = JSON.parse(JSON.stringify(packState(st)));
      const keep = [genTown, genBuilding, genCave];
      let st2, threw = '';
      try { window.genTown = window.genBuilding = window.genCave = () => { throw new Error('generator called on load'); }; st2 = unpackState(file); intent(st2, { t: 'jump', who: 'P1', site: 'S1' }); intent(st2, { t: 'jump', who: 'P1', site: house }); }
      catch (e) { threw = e.message; }
      finally { window.genTown = keep[0]; window.genBuilding = keep[1]; window.genCave = keep[2]; }
      out.threw = threw;
      out.kept = !!st2 && JSON.stringify(packMap(st2.maps[house])) === JSON.stringify(packMap(st.maps[house])) && st2.maps[house].doors[0].open === true;
      out.stillLazy = !!st2 && !st2.maps.S2;
      out.sizes = { bytes: JSON.stringify(file).length, maps: Object.keys(file.maps).length };
      return out;
    });
    ok(r.atStart === 'S0,S1', 'a new tale charts only the town and the inn it starts in: ' + r.atStart);
    ok(r.houseMade, 'the town generator makes up its houses, and their boards do not exist yet');
    ok(r.next === 'travel' && r.entered && r.charted, 'walking in at the door charts the house and journals it');
    ok(r.people >= 1 && r.fam, 'the people found inside are made up there, share the house\'s name, and are recorded (' + r.people + ')');
    ok(!r.threw && r.kept, 'loading a save never calls a generator: a charted board comes back exactly, open door and all' + (r.threw ? ' (' + r.threw + ')' : ''));
    ok(r.stillLazy, 'a place nobody has been to is still uncharted after loading');
    ok(r.sizes.bytes < 400000, 'the save is small (' + r.sizes.bytes + ' bytes, ' + r.sizes.maps + ' boards)');
  }

  /* ------------------------------------------------------------------ I */
  console.log('I. saves');
  {
    const r = await A.page.evaluate(() => {
      const out = {}, st = newGame('save-1'); for (const id of Object.keys(st.sites)) chart(st, id);
      const a = JSON.stringify(packState(st)).replace(/"saved":\d+/, ''), st2 = unpackState(JSON.parse(JSON.stringify(packState(st)))), b = JSON.stringify(packState(st2)).replace(/"saved":\d+/, '');
      out.round = a === b; let i = 0; while (i < a.length && a[i] === b[i]) i++; out.at = out.round ? '' : a.slice(Math.max(0, i - 60), i + 60) + ' <> ' + b.slice(Math.max(0, i - 60), i + 60);
      const tryLoad = (v) => { try { unpackState(v); return 'loaded'; } catch (e) { return e.message; } };
      out.junk = [tryLoad(null), tryLoad(42), tryLoad({}), tryLoad({ format: 'cyoa-save' }), tryLoad({ format: 'cyoa2-save', v: 99 }), tryLoad({ format: 'cyoa2-save', v: 1, maps: {} })];
      /* a hostile file: markup for names, a prototype key, a thing out of bounds, a door with no hinge, the traveller inside a wall */
      const evil = JSON.parse(JSON.stringify(packState(st)));
      evil.sites.S1.name = '<img src=x onerror="window.__pwned=1">'; evil.bible.town = '<b>bold</b>'; evil.maps.S1.title = '<script>window.__pwned=2</' + 'script>';
      evil.npcs.N0.name = '<i>x</i>'; evil.sites['__proto__'] = { polluted: true };
      evil.maps.S1.objs.push({ id: 'OX', a: 'table_long', x: 999, y: -4, r: 7 }, { id: 'OY', a: 'nonsense', x: 1, y: 1, r: 0 }, { id: 'OZ', a: 'candle', x: 1, y: 1, r: 0, on: 'nobody', slot: 0 });
      evil.maps.S1.doors.push({ id: 'DX', k: 'n', x: 3, y: 3, open: true });
      evil.party[0].x = 0; evil.party[0].y = 0; evil.party[0].site = 'S1'; evil.log.push({ t: 'move', site: { deep: { deeper: { deepest: { more: { evenmore: { toomuch: { x: 1 } } } } } } } });
      let st3 = null; try { st3 = unpackState(evil); } catch (e) { out.evilErr = e.message; }
      if (st3) {
        const m = st3.maps.S1, pc = st3.party[0];
        out.evil = { noObj: !m.objs.some((o) => ['OX', 'OY', 'OZ'].includes(o.id)), noDoor: !m.doors.some((d) => d.id === 'DX'), stands: tileFree(m, pc.x, pc.y), proto: ({}).polluted === undefined && !Object.prototype.hasOwnProperty.call(st3.sites, '__proto__') };
        G.st = st3; UI.enterPlay(false);
      }
      return out;
    });
    ok(r.round, 'a save loads back byte for byte' + (r.at ? ': ' + r.at : ''));
    ok(r.junk.every((m) => m !== 'loaded' && /tale/.test(m)), 'a file that is not a tale is refused in plain words');
    ok(!r.evilErr && r.evil && r.evil.noObj && r.evil.noDoor && r.evil.stands && r.evil.proto, 'a tampered file loses its impossible parts and nothing else' + (r.evilErr ? ' (' + r.evilErr + ')' : ''));
    await idle(A.page);
    await A.page.evaluate(() => { UI.chron('places'); UI.openPanel('pan-chron'); });
    const dom = await A.page.evaluate(() => ({ pwned: window.__pwned || 0, imgs: document.querySelectorAll('img, #pan-chron b, #pan-chron i, .play-head b').length, head: document.getElementById('place-name').textContent, list: document.getElementById('chron-list').textContent }));
    ok(dom.pwned === 0 && dom.imgs === 0 && /<script>/.test(dom.head) && /<img src=x/.test(dom.list), 'text from a file is shown as text, never as markup');
    await A.page.evaluate(() => UI.closePanels());
  }
  await A.ctx.close();

  }
  if (want('J')) {
  /* ------------------------------------------------------------------ J */
  console.log('J. the flow on a phone');
  const J = await open({ width: 390, height: 844 });
  {
    const page = J.page;
    await page.evaluate(() => document.getElementById('btn-new').click());
    await page.waitForFunction(() => document.getElementById('dialog').classList.contains('open'), null, { timeout: 8000 });
    const dlg = await page.evaluate(() => ({ title: document.getElementById('dlg-title').textContent, town: G.st.bible.town, text: document.getElementById('dlg-body').textContent, seed: G.st.seed, inPlay: document.body.classList.contains('in-play') }));
    ok(dlg.seed === 'drive-seed-1' && dlg.inPlay, 'NEW begins a tale from the seed in Settings');
    ok(dlg.title === dlg.town && dlg.text.includes(dlg.town) && dlg.text.length > 80, 'the opening names the town and the matter at hand');
    await page.evaluate(() => document.querySelector('#dlg-btns button').click());
    await idle(page);
    const s0 = await page.evaluate(() => { const m = View.map, pc = G.st.party[0], r = m.rooms[m.rg[pc.y * m.w + pc.x] - 1]; return { site: G.st.here, room: r && r.kind, name: document.getElementById('place-name').textContent, title: m.title, w: View.cv.width, h: View.cv.height, vw: View.vw, dpr: View.dpr }; });
    ok(s0.site === 'S1' && s0.room === 'guest', 'the tale begins in a guest room of the inn');
    ok(s0.name === s0.title && s0.name.length > 3, 'the header names the place: ' + s0.name);
    ok(s0.w === Math.round(s0.vw * s0.dpr) && s0.w > 300, 'the canvas is sized from its own box');
    const ink = await page.evaluate(() => { const d = View.g.getImageData(0, 0, View.cv.width, View.cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] < 90 && d[i + 1] < 70) n++; return n; });
    ok(ink > 1500, 'the board is drawn in ink (' + ink + ' dark samples)');
    /* tap a free square a few steps off: the token walks there */
    const pick = async (kind) => page.evaluate((kind) => {
      const m = View.map, st = G.st, pc = st.party[0], out = [], E = eyes();
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        if (!E.vis[y * m.w + x]) continue;                 /* under fog a player can only tap what the party sees */
        const s = w2s(x + .5, y + .5); if (s[0] < 30 || s[1] < 30 || s[0] > View.vw - 30 || s[1] > View.vh - 110) continue;
        if (doorNear(m, x + .5, y + .5)) continue;
        const d = Math.max(Math.abs(x - pc.x), Math.abs(y - pc.y));
        if (kind === 'free' && tileFree(m, x, y) && m._.occ[y * m.w + x] < 0 && !tokenAt(m, x, y) && m.rg[y * m.w + x] === m.rg[pc.y * m.w + pc.x] && d >= 1) out.push({ x, y, sx: s[0], sy: s[1], d });
        if (kind === 'block') { const o = objAt(m, x, y); if (o && ASSETS[o.a].mv === 'b' && !tokenAt(m, x, y)) { const f = footprint(o); out.push({ x, y, sx: s[0], sy: s[1], d, name: ASSETS[o.a].n, ft: f.w * 5 + ' by ' + f.h * 5 + ' ft' }); } }
        if (kind === 'token' && tokenAt(m, x, y)) out.push({ x, y, sx: s[0], sy: s[1], d, name: st.npcs[tokenAt(m, x, y).npc].name });
        if (kind === 'out' && !m.rg[y * m.w + x] && tileFree(m, x, y)) out.push({ x, y, sx: s[0], sy: s[1], d });
      }
      out.sort((a, b) => b.d - a.d); return out[0] || null;
    }, kind);
    const box = await page.evaluate(() => { const r = View.cv.getBoundingClientRect(); return { l: r.left, t: r.top }; });
    const tap = async (p) => { await page.touchscreen.tap(box.l + p.sx, box.t + p.sy); };
    const free = await pick('free');
    if (!free) fail('no free square on screen to tap'); else {
      const before = await page.evaluate(() => [G.st.party[0].x, G.st.party[0].y]);
      await tap(free);
      const walking = await page.evaluate(() => !!G.st.walk || View.walking);
      await idle(page);
      const after = await page.evaluate(() => [G.st.party[0].x, G.st.party[0].y]);
      ok(walking && after[0] === free.x && after[1] === free.y && (before[0] !== after[0] || before[1] !== after[1]), 'a tap on a free square walks the token there (' + before + ' -> ' + after + ')');
    }
    const blk = await pick('block');
    if (!blk) fail('no furniture on screen to tap'); else {
      const before = await page.evaluate(() => [G.st.party[0].x, G.st.party[0].y]);
      await tap(blk); await page.waitForTimeout(120);
      const c = await page.evaluate(() => ({ shown: !document.getElementById('info').hidden, name: document.getElementById('info-name').textContent, text: document.getElementById('info-text').textContent, at: [G.st.party[0].x, G.st.party[0].y], walk: !!G.st.walk }));
      ok(c.shown && c.name === blk.name && c.text.includes(blk.ft), 'a tap on furniture names it and gives its size in feet: ' + c.name + ' - ' + blk.ft);
      ok(!c.walk && c.at[0] === before[0] && c.at[1] === before[1], 'and nobody walks into it');
      await page.evaluate(() => document.getElementById('info-x').click());
      ok(await page.evaluate(() => document.getElementById('info').hidden && !View.sel), 'the card closes');
    }
    /* out through the corridor to the common room, to meet someone */
    /* (the suite walks by the engine here, as a hand that knows the way; a player would tap door by door) */
    await page.evaluate(() => { window.__walk = (goals, then) => { const r = intent(G.st, { t: 'move', goals, then }); if (r.ok && r.path && r.path.length) { View.path = { pts: r.path, ft: r.ft, i: 0, preview: false }; View.walking = true; } return r; }; });
    await page.evaluate(() => { const m = View.map, t = m.tokens.find((q) => q.npc === 'N0'); const pc = G.st.party[0]; const f = freeNear(G.st, m, t.x - 2, t.y, pc.id); window.__walk([f]); });
    await idle(page);
    const tok = await pick('token');
    if (!tok) fail('nobody on screen to tap'); else {
      await tap(tok); await page.waitForTimeout(120);
      const c = await page.evaluate(() => ({ name: document.getElementById('info-name').textContent, text: document.getElementById('info-text').textContent, sel: !!(View.sel && View.sel.tok) }));
      ok(c.name === tok.name && c.text.length > 5 && c.sel, 'a tap on a person shows who they are: ' + c.name + ' - ' + c.text);
    }
    /* out of the building. The street door is shut and nothing beyond it has been seen: a tap on it walks there and opens it */
    await page.evaluate(() => { View.cam.z = View.zmin; camMoved(true); viewDraw(); });
    {
      const d = await page.evaluate(() => { const m = View.map, d = m.doors.find((q) => q.ext && !q.open), s = w2s(d.k === 'n' ? d.x + .5 : d.x, d.k === 'n' ? d.y : d.y + .5), out = doorSides(d).find((p) => !m.rg[p[1] * m.w + p[0]]); return { sx: s[0], sy: s[1], id: d.id, dark: !m.seen[out[1] * m.w + out[0]], ox: out[0], oy: out[1] }; });
      await tap(d); await idle(page); await page.waitForTimeout(150);
      const o = await page.evaluate((d) => { const m = View.map, q = m.doors.find((x) => x.id === d.id), pc = G.st.party[0]; return { open: q.open, beside: doorSides(q).some((p) => p[0] === pc.x && p[1] === pc.y), lit: !!m.seen[d.oy * m.w + d.ox] }; }, d);
      ok(d.dark && o.open && o.beside && o.lit, 'a tap on the shut street door walks to it and opens it, and the ground outside comes into sight');
    }
    /* then a tap on the ground outside walks to the nearest of it and leaves */
    const out = await pick('out');
    if (!out) fail('no outside square on screen'); else {
      await tap(out);
      await page.waitForFunction(() => G.st.here === 'S0', null, { timeout: 20000 }).catch(() => {});
      await idle(page);
      const t = await page.evaluate(() => { const m = View.map, pc = G.st.party[0], e = exitAt(m, pc.x, pc.y), b = document.getElementById('act'); return { here: G.st.here, map: m.id, name: document.getElementById('place-name').textContent, town: G.st.bible.town, onStep: !!e && e.to === 'S1', act: b.hidden ? '' : b.textContent, inn: G.st.sites.S1.name }; });
      ok(t.here === 'S0' && t.map === 'S0' && t.name === t.town, 'walking out the door leads into the town: ' + t.name);
      ok(t.onStep && t.act === 'Enter ' + t.inn, 'the doorstep offers the way back in: "' + t.act + '"');
      const inn0 = await page.evaluate(() => JSON.stringify(packMap(G.st.maps.S1)));
      await page.touchscreen.tap(...(await page.evaluate(() => { const r = document.getElementById('act').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })));
      await page.waitForFunction(() => G.st.here === 'S1', null, { timeout: 8000 }).catch(() => {});
      await idle(page);
      const back = await page.evaluate((inn0) => ({ here: G.st.here, same: JSON.stringify(packMap(G.st.maps.S1)) === inn0 }), inn0);
      ok(back.here === 'S1' && back.same, 'and the inn is the same inn, to the last tankard');
    }
    /* the roof of a building is its door: tap it from the street */
    await page.evaluate(() => { UI.follow(intent(G.st, { t: 'jump', who: 'P1', site: 'S0' })); });
    await idle(page);
    const roof = await page.evaluate(() => {
      const m = View.map; View.cam.z = View.zmin; View.cam.x = m.w / 2; View.cam.y = m.h / 2; camMoved(true); viewDraw();
      /* a building nobody has been in, whose roof and doorstep are both in what the party has seen from the inn's door */
      const L = m.lots.find((l) => !G.st.maps[l.site] && m.seen[l.y * m.w + l.x] && m.exits.find((e) => e.to === l.site).tiles.some((t) => m.seen[t[1] * m.w + t[0]]));
      if (!L) return null;
      const s = w2s(L.x + L.w / 2, L.y + 1.2); return { sx: s[0], sy: s[1], site: L.site, kind: L.kind, charted: !!G.st.maps[L.site] };
    });
    if (!roof) fail('no uncharted building in sight of the inn door'); else {
      await tap(roof);
      await page.waitForFunction((id) => G.st.here === id, roof.site, { timeout: 30000 }).catch(() => {});
      await idle(page);
      const ch = await page.evaluate((id) => ({ here: G.st.here, charted: !!G.st.maps[id], kind: View.map.kind }), roof.site);
      ok(!roof.charted && ch.here === roof.site && ch.charted && ch.kind === roof.kind, 'a tap on a roof walks to that door, goes in, and charts the place (' + roof.kind + ')');
    }
    /* autosave, reload, Continue */
    await page.evaluate(() => UI.saveNow()); await page.waitForTimeout(400);
    const pos = await page.evaluate(() => ({ here: G.st.here, x: G.st.party[0].x, y: G.st.party[0].y, maps: Object.keys(G.st.maps).sort().join(','), log: G.st.log.length }));
    await page.reload(); await page.waitForFunction(() => typeof UI === 'object');
    await page.waitForFunction(() => !document.getElementById('btn-continue').hidden, null, { timeout: 8000 }).catch(() => {});
    ok(await page.evaluate(() => !document.getElementById('btn-continue').hidden), 'after a reload the title offers Continue');
    await page.evaluate(() => document.getElementById('btn-continue').click());
    await page.waitForFunction(() => G.st && document.body.classList.contains('in-play'), null, { timeout: 8000 });
    await idle(page);
    const pos2 = await page.evaluate(() => ({ here: G.st.here, x: G.st.party[0].x, y: G.st.party[0].y, maps: Object.keys(G.st.maps).sort().join(','), log: G.st.log.length }));
    ok(JSON.stringify(pos) === JSON.stringify(pos2), 'Continue resumes on the same square of the same place, with the same boards charted (' + pos2.maps + ')');
  }
  await J.ctx.close();

  }
  if (want('K')) {
  /* ------------------------------------------------------------------ K */
  console.log('K. a tap lands on the square that is drawn there');
  {
    for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }, { width: 1024, height: 768 }, { width: 600, height: 1100 }]) {
      const K = await open(vp), page = K.page, tag = vp.width + 'x' + vp.height;
      await begin(page);
      /* resize while the board is hidden behind a panel, then come back. This section measures the mapping of a tap to
         a square, and aims at the corners of the view to do it, so the fog is lifted here by its own setting.        */
      await page.evaluate(() => { UI.settings(); UI.openPanel('pan-settings'); const c = document.getElementById('set-fog'); c.checked = false; c.dispatchEvent(new Event('change')); });
      await page.setViewportSize({ width: vp.width - 40, height: vp.height - 60 }); await page.waitForTimeout(150);
      await page.setViewportSize(vp); await page.waitForTimeout(150);
      await page.evaluate(() => UI.closePanels()); await page.waitForTimeout(600);
      const geo = await page.evaluate(() => { const r = View.cv.getBoundingClientRect(), b = document.getElementById('board').getBoundingClientRect(); return { cw: View.cv.width, ch: View.cv.height, rw: r.width, rh: r.height, dpr: View.dpr, vw: View.vw, vh: View.vh, bw: b.width, bh: b.height, inView: r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 }; });
      ok(geo.cw === Math.round(geo.rw * geo.dpr) && geo.ch === Math.round(geo.rh * geo.dpr) && geo.vw === geo.rw && geo.vh === geo.rh && Math.abs(geo.rw - geo.bw) < 1 && Math.abs(geo.rh - geo.bh) < 3 && geo.inView && geo.rh > 150, tag + ': the canvas, its backing store and the view agree on one box (' + Math.round(geo.rw) + 'x' + Math.round(geo.rh) + ')');
      /* Aim at the free square furthest from the middle of the screen, where any error in the mapping is largest; three
         turns. And aim NEAR ITS EDGE, not at its middle: at the far corner of it on the first and third turns (which a
         mapping that stretches would push into the next square out) and at the near corner on the second (which one that
         shrinks would pull into the next square in). A tap at the middle forgives half a square, and after step 2 put a
         bar over the board the furthest square was close enough that a 7% error went unseen (negative test, 2026-10-10). */
      let hits = 0, tries = 0;
      for (let turn = 0; turn < 3; turn++) {
        const t = await page.evaluate((out) => {
          const m = View.map, st = G.st, pc = st.party[0], seen = floodReach(m, pc.x, pc.y); let best = null;
          for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
            if (!seen[y * m.w + x] || !tileFree(m, x, y) || tokenAt(m, x, y) || m._.occ[y * m.w + x] >= 0 || !m.rg[y * m.w + x] || (x === pc.x && y === pc.y)) continue;
            const c = w2s(x + .5, y + .5), wx = x + .5 + .4 * out * Math.sign(c[0] - View.vw / 2 || 1), wy = y + .5 + .4 * out * Math.sign(c[1] - View.vh / 2 || 1);
            if (doorNear(m, wx, wy)) continue;
            const s = w2s(wx, wy); if (s[0] < 14 || s[1] < 14 || s[0] > View.vw - 14 || s[1] > View.vh - 14) continue;
            const d = Math.hypot(s[0] - View.vw / 2, s[1] - View.vh / 2); if (!best || d > best.d) best = { x, y, sx: s[0], sy: s[1], d };
          }
          const r = View.cv.getBoundingClientRect(); if (best) { best.cx = r.left + best.sx; best.cy = r.top + best.sy; } return best;
        }, turn === 1 ? -1 : 1);
        if (!t) break; tries++;
        await page.touchscreen.tap(t.cx, t.cy); await idle(page);
        const at = await page.evaluate(() => [G.st.party[0].x, G.st.party[0].y]);
        if (at[0] === t.x && at[1] === t.y) hits++;
        if (process.env.DBG) console.log(tag, 'target', t.x, t.y, 'at', at.join(), 'dy squares', await page.evaluate((t) => ((t.sy - View.vh / 2) / View.cam.z).toFixed(2) + ' z=' + View.cam.z.toFixed(1) + ' free=' + View.free + ' vh=' + View.vh, t));
        await page.evaluate(() => { UI.card(null); });
      }
      ok(tries === 3 && hits === 3, tag + ': three taps at the far corners of the view, each a tenth of a square inside its edge, walked to the square under the finger (' + hits + '/' + tries + ')');
      await K.ctx.close();
    }
  }

  }
  if (want('L')) {
  /* ------------------------------------------------------------------ L */
  console.log('L. gestures and keys');
  {
    const L = await open({ width: 390, height: 844 }), page = L.page;
    await begin(page);
    /* The fog is lifted for this section, by its own setting. Its gesture rows ask "did that count as a tap?", and under
       fog a stray tap on unseen ground walks nobody whatever the gesture code did: with the fog on, the row for the last
       finger of a pinch passed with its fix deliberately removed (negative test, 2026-10-10).                         */
    await page.evaluate(() => { UI.settings(); const c = document.getElementById('set-fog'); c.checked = false; c.dispatchEvent(new Event('change')); });
    const cdp = await L.ctx.newCDPSession(page);
    const box = await page.evaluate(() => { const r = View.cv.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, id) => ({ x: box.l + p[0], y: box.t + p[1], id })) });
    const state = () => page.evaluate(() => ({ x: G.st.party[0].x, y: G.st.party[0].y, cx: View.cam.x, cy: View.cam.y, z: View.cam.z, walk: !!G.st.walk || View.walking, re: !document.getElementById('recenter').hidden, ez: View.easing }));
    await page.evaluate(() => { View.cam.z = 44; View.cam.x = View.map.w / 2; View.cam.y = View.map.h / 2; camMoved(false); });
    const s0 = await state();
    /* a one-finger drag pans */
    await touch('touchStart', [[200, 300]]); for (let k = 1; k <= 6; k++) await touch('touchMove', [[200 - k * 12, 300 + k * 10]]); await touch('touchEnd', []);
    const s1 = await state();
    ok(!s1.walk && s1.x === s0.x && s1.y === s0.y && s1.cx > s0.cx + 1 && s1.cy < s0.cy - .8, 'a drag pans the map and nobody walks');
    ok(s1.re, 'once the table has been pushed about, the recentre button appears');
    /* a pinch zooms about the fingers; lifting one finger leaves a pan, never a tap */
    await touch('touchStart', [[150, 400]]); await touch('touchStart', [[150, 400], [250, 400]]);
    for (let k = 1; k <= 6; k++) await touch('touchMove', [[150 - k * 8, 400], [250 + k * 8, 400]]);
    const mid = await state();
    await touch('touchEnd', [[102, 400]]); await touch('touchMove', [[104, 402]]); await touch('touchEnd', []);
    const s2 = await state();
    ok(mid.z > s1.z * 1.5, 'a pinch zooms in (' + s1.z.toFixed(1) + ' -> ' + mid.z.toFixed(1) + ' px a square)');
    ok(!s2.walk && s2.x === s0.x && s2.y === s0.y, 'and the last finger off the glass does not count as a tap');
    await page.evaluate(() => document.getElementById('recenter').click()); await page.waitForTimeout(900);
    const s3 = await state();
    ok(!s3.re && Math.abs(s3.cx - (s3.x + .5)) < 3.5, 'recentre brings the traveller back into the middle and puts itself away');
    /* the board's edge can stop the camera short of the traveller: it must still come to rest, or the sharp repaint never happens */
    {
      const z0 = s3.z;
      await page.evaluate(() => { View.cam.z = View.zmin; camMoved(true); document.getElementById('recenter').click(); });
      const rest = await page.waitForFunction(() => !View.easing && !!View.sharp && View.sharpFor === View.moved, null, { timeout: 4000 }).then(() => true, () => false);
      const held = await page.evaluate(() => { const p = G.st.party[0]; return Math.abs(View.cam.x - (p.x + .5)) + Math.abs(View.cam.y - (p.y + .5)); });
      ok(held > .5 && rest, 'and the camera comes to rest even where the edge of the board holds it ' + held.toFixed(1) + ' squares short, so the sharp repaint follows');
      await page.evaluate((z) => { View.cam.z = z; View.free = false; View.userCam = false; View.easing = true; UI.chrome(); camMoved(false); }, z0); await page.waitForTimeout(900);
    }
    /* the mouse wheel zooms on a desktop */
    await page.mouse.move(box.l + 180, box.t + 300); await page.mouse.wheel(0, 300); await page.waitForTimeout(80);
    ok((await state()).z < s3.z, 'the wheel zooms out');
    /* keys walk one square; a text field keeps its letters */
    const step = await page.evaluate(() => { const m = View.map, pc = G.st.party[0]; for (const [k, d] of [['ArrowRight', [1, 0]], ['ArrowLeft', [-1, 0]], ['ArrowDown', [0, 1]], ['ArrowUp', [0, -1]]]) if (stepInfo(m, pc.x, pc.y, d[0], d[1], false) && !taken(G.st, m, pc.x + d[0], pc.y + d[1], pc.id)) return { k, to: [pc.x + d[0], pc.y + d[1]] }; return null; });
    if (!step) fail('no legal key step'); else { await page.keyboard.press(step.k); await idle(page); const s = await state(); ok(s.x === step.to[0] && s.y === step.to[1], 'an arrow key walks one square'); }
    const s4 = await state();
    await page.evaluate(() => { UI.settings(); UI.openPanel('pan-settings'); document.getElementById('set-seed').value = ''; document.getElementById('set-seed').focus(); });
    await page.keyboard.type('wasd-qezc-12');
    const typed = await page.evaluate(() => ({ v: document.getElementById('set-seed').value, saved: Settings.data.seed }));
    await page.keyboard.press('Escape'); await page.evaluate(() => { document.activeElement.blur(); UI.closePanels(); }); await page.waitForTimeout(300);
    const s5 = await state();
    ok(typed.v === 'wasd-qezc-12' && typed.saved === 'wasd-qezc-12' && s5.x === s4.x && s5.y === s4.y && !s5.walk, 'letters typed into the seed field stay in the field and move nobody');
    /* and the same with a field that is NOT behind a panel, so only the focus check stands between a letter and a step */
    await page.evaluate(() => { const i = document.createElement('input'); i.id = 'probe-in'; i.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99'; document.body.appendChild(i); i.focus(); });
    await page.keyboard.type('dsaw');
    await page.waitForTimeout(250);
    const probe = await page.evaluate(() => { const i = document.getElementById('probe-in'), v = i.value; i.remove(); return v; });
    const s6 = await state();
    ok(probe === 'dsaw' && s6.x === s5.x && s6.y === s5.y && !s6.walk, 'a focused text field on the board itself keeps every letter too');
    await L.ctx.close();
  }

  }
  if (want('M')) {
  /* ------------------------------------------------------------------ M */
  console.log('M. panels, the library, night reading');
  {
    const M = await open({ width: 390, height: 844 }), page = M.page;
    await begin(page);
    const menu = await page.evaluate(() => { document.getElementById('ribbon-btn').click(); const open = document.getElementById('menu').classList.contains('open'); document.querySelector('#menu [data-act="chron"]').click(); return { open, panel: document.getElementById('pan-chron').classList.contains('open'), closed: !document.getElementById('menu').classList.contains('open') }; });
    ok(menu.open && menu.panel && menu.closed, 'the ribbon opens the menu, and the menu opens the chronicle');
    const tabs = await page.evaluate(() => { const out = {}; for (const t of ['tale', 'places', 'people', 'journal']) { document.querySelector('#pan-chron .tab[data-tab="' + t + '"]').click(); out[t] = document.getElementById('chron-list').children.length; } out.sites = Object.keys(G.st.sites).length; out.npcs = Object.keys(G.st.npcs).length; out.go = document.querySelectorAll('#chron-list button').length; document.querySelector('#pan-chron .tab[data-tab="places"]').click(); out.go = document.querySelectorAll('#chron-list button').length; out.here = document.querySelectorAll('#chron-list .entry.here').length; return out; });
    ok(tabs.tale >= 5 && tabs.places === tabs.sites && tabs.people === tabs.npcs && tabs.journal >= 3, 'the chronicle lists the tale, every place (' + tabs.places + '), every person (' + tabs.people + ') and the journal');
    ok(tabs.here === 1 && tabs.go === tabs.sites - 1, 'every place but this one can be gone to');
    /* a hop to the cave by the chronicle charts it on the spot */
    await page.evaluate(() => { const rows = [...document.querySelectorAll('#chron-list .entry')]; rows.find((r) => r.querySelector('h3').textContent === G.st.sites.S2.name).querySelector('button').click(); });
    await page.waitForFunction(() => G.st.here === 'S2' && View.map && View.map.id === 'S2', null, { timeout: 8000 }).catch(() => {}); await idle(page);
    const cave = await page.evaluate(() => { viewDraw(); const d = View.g.getImageData(0, 0, View.cv.width, View.cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] < 90 && d[i + 1] < 70) n++; return { here: G.st.here, panel: !!document.querySelector('.panel.open'), ink: n, act: document.getElementById('act').hidden }; });
    ok(cave.here === 'S2' && !cave.panel && cave.ink > 2000, 'the chronicle sets the traveller down in the cave, charted and drawn (' + cave.ink + ' dark samples)');
    const lib = await page.evaluate(() => { UI.library(); UI.openPanel('pan-lib'); const cards = [...document.querySelectorAll('.lib-card')]; return { n: cards.length, assets: Object.keys(ASSETS).length, heads: document.querySelectorAll('.lib-h').length, sized: cards.filter((c) => /ft|surface/.test(c.textContent)).length, table: (cards.find((c) => c.querySelector('b').textContent === 'Long table') || {}).textContent || '' }; });
    ok(lib.n === lib.assets && lib.heads >= 6 && lib.sized === lib.n, 'the library shows every asset (' + lib.n + ') under its heading with its footprint');
    ok(/5 x 10 ft/.test(lib.table) && /blocks/.test(lib.table) && /holds 2/.test(lib.table), 'the long table reads 5 x 10 ft, blocks, holds 2');
    await page.evaluate(() => UI.closePanels()); await page.waitForTimeout(350);
    /* settings: the grid and the footprint overlay repaint the SAME board; night reading dims it */
    const paint = async () => page.evaluate(() => { View.sharp = null; View.sharpFor = View.moved; viewDraw(); const d = View.g.getImageData(0, 0, View.cv.width, View.cv.height).data; let sum = 0, red = 0; for (let i = 0; i < d.length; i += 16) { sum += d[i] + d[i + 1] + d[i + 2]; if (d[i] > d[i + 2] + 60 && d[i + 1] < 170) red++; } return { sum, red, key: View.base.key }; });
    await page.evaluate(() => { UI.follow(intent(G.st, { t: 'jump', who: 'P1', site: 'S1' })); }); await idle(page);
    const p0 = await paint();
    await page.evaluate(() => { UI.settings(); const c = document.getElementById('set-grid'); c.checked = false; c.dispatchEvent(new Event('change')); });
    const p1 = await paint();
    await page.evaluate(() => { const c = document.getElementById('set-grid'); c.checked = true; c.dispatchEvent(new Event('change')); const f = document.getElementById('set-foot'); f.checked = true; f.dispatchEvent(new Event('change')); });
    const p2 = await paint();
    await page.evaluate(() => { const f = document.getElementById('set-foot'); f.checked = false; f.dispatchEvent(new Event('change')); });
    const p3 = await paint();
    ok(p1.key !== p0.key && p1.sum > p0.sum, 'turning the grid off repaints the board without its lines');
    ok(p2.key !== p0.key && p2.red > p0.red * 1.5 + 50, 'the footprint overlay marks what blocks (' + p0.red + ' -> ' + p2.red + ' red samples)');
    ok(p3.key === p0.key && p3.sum === p0.sum, 'and both go back exactly as they were');
    await page.evaluate(() => { const s = document.getElementById('set-theme'); s.value = 'dark'; s.dispatchEvent(new Event('change')); });
    const p4 = await paint();
    const dark = await page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor, pos: [G.st.party[0].x, G.st.party[0].y] }));
    ok(dark.attr === 'dark' && dark.bg === 'rgb(27, 20, 13)' && p4.sum < p0.sum * .85 && p4.key === p0.key, 'night reading darkens the page and dims the map without repainting it');
    await page.evaluate(() => { const s = document.getElementById('set-theme'); s.value = 'light'; s.dispatchEvent(new Event('change')); });
    /* a file out and back in */
    const file = await page.evaluate(() => JSON.stringify(packState(G.st)));
    const there = await page.evaluate(() => ({ here: G.st.here, x: G.st.party[0].x, y: G.st.party[0].y, seed: G.st.seed }));
    await page.evaluate(() => UI.toTitle()); await page.waitForFunction(() => !document.body.classList.contains('in-play'), null, { timeout: 6000 });
    await page.waitForFunction(() => !document.getElementById('veil').classList.contains('on'));
    await page.setInputFiles('#file-in', { name: 'tale.json', mimeType: 'application/json', buffer: Buffer.from(file) });
    await page.waitForFunction(() => document.body.classList.contains('in-play'), null, { timeout: 8000 }).catch(() => {}); await idle(page);
    const back = await page.evaluate(() => ({ here: G.st.here, x: G.st.party[0].x, y: G.st.party[0].y, seed: G.st.seed }));
    ok(JSON.stringify(back) === JSON.stringify(there), 'a tale saved to a file loads back to the same square');
    await page.evaluate(() => UI.toTitle()); await page.waitForFunction(() => !document.body.classList.contains('in-play'));
    await page.setInputFiles('#file-in', { name: 'junk.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
    await page.waitForFunction(() => document.getElementById('toast').classList.contains('on'), null, { timeout: 4000 }).catch(() => {});
    const junk = await page.evaluate(() => ({ toast: document.getElementById('toast').textContent, inPlay: document.body.classList.contains('in-play') }));
    ok(/not a CYOA2 tale/.test(junk.toast) && !junk.inPlay, 'a file that is not a tale is refused on the title: "' + junk.toast + '"');
    await M.ctx.close();
  }
  }
  if (want('N')) {
  /* ------------------------------------------------------------------ N */
  console.log('N. sight and fog of war');
  {
    const N = await open({ width: 390, height: 844 }), page = N.page;
    const r = await page.evaluate(() => {
      const out = { shut: 0, leak: 0, grew: 0, kept: 0, views: 0, seen: 0, unsound: 0, plain: 0, missed: 0, bad: [], known: [], v1: null, things: 0, halves: 0, roofs: 0, lent: 0, partial: 0 };
      /* An independent judge of one sight line: walk it in fiftieths of a square and ask, at every change of square,
         whether that edge or that square stops the eye. It shares no code with the engine's ray march. A line that
         jumps two squares at once went through a corner and is not judged.                                        */
      const judge = (m, ox, oy) => (bx, by, tx, ty) => {
        const stopE = (x, y, d) => { const e = eGet(m, x, y, d); if (e === ED.WALL) return true; if (e !== ED.DOOR) return false; const dr = doorOn(m, x, y, d); return !(dr && (dr.open || dr.kind === 'bars')); };
        const solid = (x, y) => { const t = m.t[y * m.w + x]; if (t === TR.ROCK || t === TR.ROOF || t === TR.VOID) return true; const o = m.objs.find((q) => !q.on && ASSETS[q.a].lay !== 'd' && (() => { const f = footprint(q); return x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h; })()); return !!o && !!ASSETS[o.a].tall; };
        const ax = ox + .5, ay = oy + .5, n = Math.ceil(Math.hypot(bx - ax, by - ay) / .02); let cx = ox, cy = oy;
        for (let k = 1; k <= n; k++) {
          const nx = Math.floor(ax + (bx - ax) * k / n), ny = Math.floor(ay + (by - ay) * k / n);
          if (nx === cx && ny === cy) continue;
          if (nx !== cx && ny !== cy) return null;
          if (stopE(cx, cy, nx > cx ? 1 : nx < cx ? 3 : ny > cy ? 2 : 0)) return false;
          if (nx === tx && ny === ty) return true;
          if (!inb(m, nx, ny) || solid(nx, ny)) return false;
          cx = nx; cy = ny;
        }
        return cx === tx && cy === ty;
      };
      const Q = [.02, .1, .2, .3, .4, .5, .6, .7, .8, .9, .98], PLAIN = [[.5, .5], [.25, .25], [.75, .25], [.25, .75], [.75, .75]];
      for (let k = 0; k < 5; k++) {
        const st = newGame('sight-' + k), inn = st.maps.S1, pc = st.party[0], own = inn.rg[pc.y * inn.w + pc.x];
        /* 1. waking behind a shut door, the party has seen its own room and no other */
        const doorsShut = inn.doors.every((d) => !d.open || !doorSides(d).some((p) => inn.rg[p[1] * inn.w + p[0]] === own));
        let other = 0, n0 = 0;
        for (let i = 0; i < inn.seen.length; i++) if (inn.seen[i]) { n0++; if (inn.rg[i] && inn.rg[i] !== own && TWALK[inn.t[i]]) other++; }
        if (doorsShut) { out.shut++; out.leak += other; }
        /* 2. walking out: more is seen, nothing seen is forgotten, and some of it is now out of sight */
        const before = inn.seen.slice(), com = inn.rooms.findIndex((q) => q.kind === 'common'); let tgt = null;
        for (let i = inn.w * inn.h - 1; i >= 0 && !tgt; i--) { const x = i % inn.w, y = (i - x) / inn.w; if (inn.rg[i] === com + 1 && tileFree(inn, x, y) && !tokenAt(inn, x, y)) tgt = [x, y]; }
        intent(st, { t: 'move', to: tgt }); for (let g = 0; g < 300 && st.walk; g++) intent(st, { t: 'step' });
        let n1 = 0, lost = 0, dim = 0; const V = visOf(st).g;
        for (let i = 0; i < inn.seen.length; i++) { if (inn.seen[i]) n1++; if (before[i] && !inn.seen[i]) lost++; if (inn.seen[i] && !V[i]) dim++; }
        if (n1 > n0 && !lost) out.grew++; if (dim > 0) out.kept++;
        /* nothing is in sight by halves: a table, a hearth or a roof shows whole or not at all */
        const half = (m, g, f) => { let on = 0; for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) on += g[(f.y + j) * m.w + f.x + i] ? 1 : 0; return on > 0 && on < f.w * f.h; };
        for (const o of inn.objs) { if (o.on || ASSETS[o.a].mv !== 'b' || ASSETS[o.a].lay === 'd') continue; const f = footprint(o); if (f.w * f.h < 2) continue; out.things++; if (half(inn, V, f)) out.halves++; }
        /* ...and making things whole never adds a square someone could stand on: all of sight that a person could occupy comes from the lines alone */
        { const raw = new Uint8Array(inn.w * inn.h); for (const p of st.party) sightFrom(inn, p.x, p.y, sightOf(inn), raw); for (let i = 0; i < raw.length; i++) if (V[i] && !raw[i] && tileFree(inn, i % inn.w, (i - i % inn.w) / inn.w)) out.lent++; }
        /* the sharp case, looked for rather than hoped for: every place in the inn from which a rug or a bench is seen in part. Its unseen end must stay unseen */
        for (const o of inn.objs) {
          const A = ASSETS[o.a]; if (o.on || A.w * A.h < 2 || (A.mv === 'b' && A.lay !== 'd')) continue;
          const f = footprint(o), cells = []; for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) cells.push((f.y + j) * inn.w + f.x + i);
          for (let i = 0; i < inn.w * inn.h; i++) {
            const x = i % inn.w, y = (i - x) / inn.w; if (!tileFree(inn, x, y) || Math.abs(x - f.x) > 7 || Math.abs(y - f.y) > 7) continue;
            const raw = sightFrom(inn, x, y, sightOf(inn)), on = cells.filter((c) => raw[c]).length; if (!on || on === cells.length) continue;
            out.partial++; const g = sightFaces(inn, raw.slice()); for (const c of cells) if (g[c] && !raw[c]) out.lent++;
          }
        }
        const st9 = newGame('sight-' + k); intent(st9, { t: 'jump', site: 'S0' }); const town = st9.maps.S0, VT = visOf(st9).g;
        for (const L of town.lots) { if (VT[L.y * town.w + L.x]) out.roofs++; if (half(town, VT, L)) out.halves++; }
        /* 3. the engine's sight against the judge, from random squares, with about half the doors open */
        for (const id of ['S1', 'S2', 'S0']) {
          const m = chart(st, id), rr = rngFor('sight' + k, id, 0), rad = sightOf(m);
          for (const d of m.doors) if (!d.lock) d.open = rr() < .5;
          for (let v = 0; v < (id === 'S0' ? 1 : 2); v++) {
            let ox = 0, oy = 0, g = 0; do { ox = Math.floor(rr() * m.w); oy = Math.floor(rr() * m.h); } while (!tileFree(m, ox, oy) && ++g < 900);
            const vis = sightFrom(m, ox, oy, rad), line = judge(m, ox, oy); out.views++;
            for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
              if (tx === ox && ty === oy) continue;
              const i = ty * m.w + tx, d2 = (tx - ox) * (tx - ox) + (ty - oy) * (ty - oy);
              if (vis[i]) {            /* sound: every square the engine shows has SOME clear line to it */
                out.seen++; let any = false;
                for (let b = 0; b < 11 && !any; b++) for (let a = 0; a < 11; a++) if (line(tx + Q[a], ty + Q[b], tx, ty) === true) { any = true; break; }
                if (!any) { out.unsound++; if (out.bad.length < 6) out.bad.push('shown ' + id + ' ' + ox + ',' + oy + '>' + tx + ',' + ty); }
              }
              if (d2 <= (rad - 1) * (rad - 1) && PLAIN.every((p) => line(tx + p[0], ty + p[1], tx, ty) === true)) {   /* complete: a square plainly in view is shown */
                out.plain++; if (!vis[i]) { out.missed++; if (out.bad.length < 6) out.bad.push('missed ' + id + ' ' + ox + ',' + oy + '>' + tx + ',' + ty); }
              }
            }
          }
        }
      }
      /* 4. a traveller asked to keep to known ground does: an unseen square is refused, a seen one is reached over seen squares only */
      {
        const st = newGame('known-1'), m = st.maps.S1, pc = st.party[0], a = turnOf(st), snap = () => JSON.stringify(packState(st)).replace(/"saved":\d+/, '');
        let dark = null, far = null;
        for (let i = 0; i < m.w * m.h; i++) { const x = i % m.w, y = (i - x) / m.w; if (!tileFree(m, x, y) || tokenAt(m, x, y)) continue; if (!m.seen[i] && m.rg[i] && !dark) dark = [x, y]; if (m.seen[i] && (x !== pc.x || y !== pc.y)) far = [x, y]; }
        const s0 = snap(), no = intent(st, { t: 'move', to: dark, known: true }), same = snap() === s0 && !st.walk;
        const free = route(st, a, [dark], false), yes = route(st, a, [far], true);
        out.known = [no.ok === false && no.why === 'unseen' && !!no.say && same, free.ok === true, yes.ok === true && yes.path.every((p) => m.seen[p[1] * m.w + p[0]])];
        /* the sharp case: grass seen through the window. The only way to it runs through rooms nobody has seen, so a traveller keeping to known ground has no way at all */
        let through = null;
        for (let i = 0; i < m.w * m.h && !through; i++) { const x = i % m.w, y = (i - x) / m.w; if (!m.seen[i] || m.rg[i] || !tileFree(m, x, y)) continue; const g = route(st, a, [[x, y]], false); if (g.ok && g.path.some((p) => !m.seen[p[1] * m.w + p[0]])) through = route(st, a, [[x, y]], true); }
        out.known.push(!!through && through.ok === false && through.why === 'noway');
        /* 5. a save from before there was fog loads, and the party sees from where it stands */
        const old = JSON.parse(JSON.stringify(packState(st))); old.v = 1; delete old.lead; delete old.round; delete old.met; delete old.n.pc; delete old.n.roll; for (const id of Object.keys(old.maps)) delete old.maps[id].seen;
        let st2 = null; try { st2 = unpackState(old); } catch (e) { out.v1 = e.message; }
        if (st2) { let n = 0; for (const b of st2.maps.S1.seen) n += b; out.v1 = { v: st2.v, seen: n, lead: st2.lead, town: st2.maps.S0.seen.some((b) => b) }; }
      }
      return out;
    });
    ok(r.shut >= 3 && r.leak === 0, 'waking behind a shut door, the party has seen its own room and no square of any other (' + r.shut + ' worlds)');
    ok(r.grew === 5 && r.kept === 5, 'walking out, more is seen, nothing seen is forgotten, and what is left behind is remembered out of sight');
    ok(r.things > 25 && r.roofs >= 5 && r.halves === 0, 'nothing that fills its squares is in sight by halves: a hearth, a long table or a roof shows whole or not at all (' + r.things + ' things, ' + r.roofs + ' roofs in view)');
    ok(r.partial > 20 && r.lent === 0, 'and seeing a thing whole never puts a square someone could stand on in sight: a rug or a bench seen in part stays in part (' + r.partial + ' such views)');
    ok(r.views >= 20 && r.seen > 1200 && r.unsound === 0, 'sound: every square the engine shows has a clear line to it by an independent judge (' + r.seen + ' squares from ' + r.views + ' viewpoints)' + (r.unsound ? ' - ' + r.unsound + ' wrong: ' + r.bad.join(' | ') : ''));
    ok(r.plain > 400 && r.missed === 0, 'complete: every square plainly in view is shown (' + r.plain + ' squares)' + (r.missed ? ' - ' + r.missed + ' missed: ' + r.bad.join(' | ') : ''));
    ok(r.known[0], 'a move to ground nobody has seen is refused in words, and changes nothing');
    ok(r.known[1] && r.known[2], 'the engine itself knows the way there; a traveller keeping to known ground walks over seen squares only');
    ok(r.known[3], 'grass seen through a window, with unseen rooms between: for a traveller keeping to known ground there is no way there yet');
    ok(r.v1 && r.v1.v === 3 && r.v1.seen > 3 && r.v1.lead === 'P1' && !r.v1.town, 'a save from before the fog loads: the party sees from where it stands, and the rest waits to be seen' + (typeof r.v1 === 'string' ? ' (' + r.v1 + ')' : ''));

    /* on the table: what is drawn, and what a tap means */
    await begin(page);
    await page.evaluate(() => { View.cam.z = View.zmin; View.cam.x = View.map.w / 2; View.cam.y = View.map.h / 2; camMoved(true); });
    const fogSet = (on) => page.evaluate((on) => { UI.settings(); const c = document.getElementById('set-fog'); c.checked = on; c.dispatchEvent(new Event('change')); View.sharp = null; View.sharpFor = View.moved; viewDraw(); }, on);
    /* how far the middle of a square is from blank vellum, in the pixels on the canvas */
    const inkAt = (x, y) => page.evaluate(([x, y]) => {
      viewDraw();
      const s = w2s(x + .28, y + .28), e = w2s(x + .72, y + .72), d = View.dpr, x0 = Math.round(s[0] * d), y0 = Math.round(s[1] * d), w = Math.max(1, Math.round((e[0] - s[0]) * d)), h = Math.max(1, Math.round((e[1] - s[1]) * d));
      const px = View.g.getImageData(x0, y0, w, h).data; let sum = 0, marked = 0;
      for (let i = 0; i < px.length; i += 4) { const dd = Math.abs(px[i] - 239) + Math.abs(px[i + 1] - 227) + Math.abs(px[i + 2] - 200); sum += dd; if (dd > 24) marked++; }
      return { mean: sum / (px.length / 4), marked: marked / (px.length / 4) };
    }, [x, y]);
    const spots = await page.evaluate(() => {
      const m = View.map, E = eyes(), o = {};
      const hid = m.tokens.find((t) => !E.vis[t.y * m.w + t.x] && !m.seen[t.y * m.w + t.x]); o.tok = hid ? { x: hid.x, y: hid.y, name: G.st.npcs[hid.npc].name } : null;
      for (let i = 0; i < m.w * m.h && !o.dark; i++) { const x = i % m.w, y = (i - x) / m.w; if (!m.seen[i] && m.t[i] === TR.WOOD && m._.occ[i] < 0 && m._.dec[i] < 0 && !tokenAt(m, x, y)) o.dark = { x, y }; }
      const s = (p) => { const q = w2s(p.x + .5, p.y + .5), r = View.cv.getBoundingClientRect(); return [r.left + q[0], r.top + q[1]]; };
      if (o.tok) o.tok.tap = s(o.tok); if (o.dark) o.dark.tap = s(o.dark);
      return o;
    });
    if (!spots.tok || !spots.dark) fail('no hidden person or unseen floor to test the fog with'); else {
      const t1 = await inkAt(spots.tok.x, spots.tok.y), d1 = await inkAt(spots.dark.x, spots.dark.y);
      const at0 = await page.evaluate(() => [G.st.party[0].x, G.st.party[0].y]);
      await page.touchscreen.tap(...spots.dark.tap); await page.waitForTimeout(150);
      const tapDark = await page.evaluate(() => ({ walk: !!G.st.walk || View.walking, toast: document.getElementById('toast').classList.contains('on') ? document.getElementById('toast').textContent : '', at: [G.st.party[0].x, G.st.party[0].y], path: !!View.path }));
      await page.touchscreen.tap(...spots.tok.tap); await page.waitForTimeout(150);
      const tapTok = await page.evaluate(() => ({ card: !document.getElementById('info').hidden, walk: !!G.st.walk || View.walking }));
      await fogSet(false);
      const t0 = await inkAt(spots.tok.x, spots.tok.y), d0 = await inkAt(spots.dark.x, spots.dark.y);
      await page.evaluate(() => UI.closePanels()); await page.waitForTimeout(350);
      await page.touchscreen.tap(...spots.tok.tap); await page.waitForTimeout(150);
      const tapTok0 = await page.evaluate(() => ({ card: !document.getElementById('info').hidden, name: document.getElementById('info-name').textContent }));
      await page.evaluate(() => UI.card(null));
      await fogSet(true); await page.evaluate(() => UI.closePanels()); await page.waitForTimeout(350);
      ok(d1.marked === 0 && d1.mean < 3 && d0.marked > .5, 'floor nobody has seen is blank vellum under the fog, and floorboards without it (' + d1.mean.toFixed(1) + ' against ' + d0.mean.toFixed(1) + ' from vellum)');
      ok(t1.marked === 0 && t0.marked > .3, 'someone out of sight is not on the board; with the fog lifted there they stand (' + (t0.marked * 100).toFixed(0) + '% of the square inked)');
      ok(!tapDark.walk && !tapDark.path && tapDark.at[0] === at0[0] && tapDark.at[1] === at0[1] && /seen/.test(tapDark.toast), 'a tap on unseen ground walks nobody and says why: "' + tapDark.toast + '"');
      ok(!tapTok.card && !tapTok.walk && tapTok0.card && tapTok0.name === spots.tok.name, 'a tap where a hidden person stands shows no card; with the fog lifted it names them');
    }
    /* what was seen and left behind is drawn faded, not blank and not fresh */
    await page.evaluate(() => { const m = View.map, com = m.rooms.findIndex((q) => q.kind === 'common'); let tgt = null; for (let i = m.w * m.h - 1; i >= 0 && !tgt; i--) { const x = i % m.w, y = (i - x) / m.w; if (m.rg[i] === com + 1 && tileFree(m, x, y) && !tokenAt(m, x, y)) tgt = [x, y]; } const r = intent(G.st, { t: 'move', to: tgt }); View.path = { pts: r.path, ft: r.ft, i: 0, preview: false }; View.walking = true; });
    await idle(page);
    const dimSq = await page.evaluate(() => { const m = View.map, E = eyes(); for (let i = 0; i < m.w * m.h; i++) { const x = i % m.w, y = (i - x) / m.w; if (m.seen[i] && !E.vis[i] && m.t[i] === TR.WOOD && m._.occ[i] < 0 && m._.dec[i] < 0) return { x, y }; } return null; });
    if (!dimSq) fail('nothing remembered out of sight to look at'); else {
      const a = await inkAt(dimSq.x, dimSq.y); await fogSet(false); const b = await inkAt(dimSq.x, dimSq.y); await fogSet(true); await page.evaluate(() => UI.closePanels());
      ok(a.mean > b.mean * .25 && a.mean < b.mean * .75, 'ground seen and left behind is drawn faded: ' + a.mean.toFixed(1) + ' from vellum, against ' + b.mean.toFixed(1) + ' in plain sight');
    }
    await N.ctx.close();
  }

  }
  if (want('O')) {
  /* ------------------------------------------------------------------ O */
  console.log('O. the party');
  {
    const O = await open({ width: 390, height: 844 }), page = O.page;
    const r = await page.evaluate(() => {
      const out = {}, st = newGame('party-1'), inn = st.maps.S1, snap = () => JSON.stringify(packState(st)).replace(/"saved":\d+/, '');
      const refuse = (it) => { const a = snap(), res = intent(st, it), b = snap(); return { ok: res.ok, why: res.why, say: res.say, same: a === b && !st.walk }; };
      const apart = () => new Set(st.party.map((p) => p.site + ':' + p.x + ',' + p.y)).size === st.party.length;
      const L = st.party[0];
      /* five join: each stands on a free square of its own that can be WALKED to from the leader, never one through a wall */
      let near = true;
      for (let k = 0; k < 5; k++) { const res = intent(st, { t: 'party', op: 'add' }); const p = st.party[st.party.length - 1]; const way = res.ok && findPath(inn, L.x, L.y, new Set([p.y * inn.w + p.x]), (x, y) => !!tokenAt(inn, x, y)); if (!res.ok || !tileFree(inn, p.x, p.y) || !way || way.ft > 40) near = false; }
      out.six = st.party.length === 6 && apart() && near && new Set(st.party.map((p) => p.name)).size === 6 && new Set(st.party.map((p) => p.id)).size === 6 && st.party.every((p) => p.name.length > 1);
      out.seventh = refuse({ t: 'party', op: 'add' });
      out.notlead = refuse({ t: 'move', who: 'P2', to: [L.x, L.y] });
      out.noname = refuse({ t: 'party', op: 'name', id: 'P2', name: '   ' });
      const nm = intent(st, { t: 'party', op: 'name', id: 'P2', name: '  Ser   <b>Bold</b> of the Very Long Name Indeed  ' });
      out.named = nm.ok && pcOf(st, 'P2').name === nm.name && nm.name.length <= 24 && !/\s\s/.test(nm.name) && nm.name.startsWith('Ser <b>Bold</b>');
      /* asked to walk to the square a companion stands on, the leader is let: they change places */
      {
        const mate = st.party.find((p) => p !== L && stepInfo(inn, L.x, L.y, p.x - L.x, p.y - L.y, false) && Math.max(Math.abs(p.x - L.x), Math.abs(p.y - L.y)) === 1);
        if (mate) { const a0 = [L.x, L.y], b0 = [mate.x, mate.y], mv = intent(st, { t: 'move', to: b0 }); let q; do { q = intent(st, { t: 'step' }); } while (q.ok && !q.done); out.swap = mv.ok && L.x === b0[0] && L.y === b0[1] && mate.x === a0[0] && mate.y === a0[1] && apart(); }
      }
      /* the leader walks out to the common room; the rest trail: one legal step at most each, never two on a square */
      const com = inn.rooms.findIndex((q) => q.kind === 'common'); let tgt = null;
      for (let i = inn.w * inn.h - 1; i >= 0 && !tgt; i--) { const x = i % inn.w, y = (i - x) / inn.w; if (inn.rg[i] === com + 1 && tileFree(inn, x, y) && !tokenAt(inn, x, y)) tgt = [x, y]; }
      intent(st, { t: 'move', to: tgt });
      let legal = true, shared = false, moved = 0, steps = 0, res;
      do {
        const was = st.party.map((p) => [p.x, p.y]); res = intent(st, { t: 'step' }); steps++;
        st.party.forEach((p, k) => { const dx = p.x - was[k][0], dy = p.y - was[k][1]; if (!dx && !dy) return; if (k) moved++; if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1 || !stepInfo(inn, was[k][0], was[k][1], dx, dy, false)) legal = false; });
        if (!apart()) shared = true;
      } while (res.ok && !res.done && steps < 300);
      /* closed up: everyone has someone nearer the leader within two squares of them */
      const F = spread(inn, L.x, L.y, null, null), line = st.party.slice().sort((p, q) => F.dist[p.y * inn.w + p.x] - F.dist[q.y * inn.w + q.x]); let gap = 0;
      line.forEach((p, k) => { if (k) gap = Math.max(gap, Math.min(...line.slice(0, k).map((q) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y))))); });
      out.trail = { arrived: L.x === tgt[0] && L.y === tgt[1], legal, shared, moved, far: gap };
      /* the way out is taken together */
      intent(st, { t: 'move', goals: exitGoals(inn, inn.exits[0]), then: { t: 'travel' } }); do { res = intent(st, { t: 'step' }); } while (res.ok && !res.done);
      const tr = intent(st, res.next);
      out.travel = tr.ok && st.here === 'S0' && st.party.every((p) => p.site === 'S0' && tileFree(st.maps.S0, p.x, p.y)) && apart();
      /* a passage one square wide: the leader goes in past everyone and comes back out past everyone */
      intent(st, { t: 'jump', site: 'S2' });
      const cave = st.maps.S2, door = cave.exits[0].arrive, deep = [0, 0]; let bd = -1; const D = spread(cave, door[0], door[1], null, (x, y) => !!tokenAt(cave, x, y));
      for (let i = 0; i < cave.w * cave.h; i++) if (D.done[i] && D.dist[i] > bd && D.dist[i] < 14) { bd = D.dist[i]; deep[0] = i % cave.w; deep[1] = (i - deep[0]) / cave.w; }
      const walkTo = (to) => { for (let h = 0; h < 12 && !(L.x === to[0] && L.y === to[1]); h++) { if (!intent(st, { t: 'move', to }).ok) return false; let g = 0, q; do { q = intent(st, { t: 'step' }); if (!apart()) shared = true; } while (q.ok && !q.done && ++g < 300); } return L.x === to[0] && L.y === to[1]; };
      out.corridor = { inn: walkTo(deep), back: walkTo(door), shared, depth: bd };
      /* whoever arrives beside someone stands where they could WALK to, never on the nearest square through a wall: tried from every free square of an inn */
      {
        const st6 = newGame('party-3'), m6 = st6.maps.S1, P = st6.party[0]; let tried = 0, wrong = 0;
        for (let i = 0; i < m6.w * m6.h; i++) {
          const x = i % m6.w, y = (i - x) / m6.w; if (!m6.rg[i] || !tileFree(m6, x, y) || tokenAt(m6, x, y)) continue;
          P.x = x; P.y = y; const f = freeNear(st6, m6, x, y, 'P2'), D = spread(m6, x, y, null, (qx, qy) => !!tokenAt(m6, qx, qy), 8);
          let best = Infinity; for (let j = 0; j < D.done.length; j++) if (D.done[j] && j !== D.s && D.ft[j] < best) best = D.ft[j];
          tried++; if (best < Infinity && (!f || !D.done[f[1] * m6.w + f[0]] || D.ft[f[1] * m6.w + f[0]] > best + 5)) wrong++;
        }
        out.beside = { tried, wrong };
      }
      /* a straggler: left eight squares behind, they keep coming after the leader has stopped, until they have closed up */
      {
        const st7 = newGame('party-4'); intent(st7, { t: 'party', op: 'add' }); intent(st7, { t: 'jump', site: 'S0' });
        const m7 = st7.maps.S0, L7 = st7.party[0], S7 = st7.party[1], D = spread(m7, L7.x, L7.y, null, (qx, qy) => !!tokenAt(m7, qx, qy), 30); let spot = null, step = null;
        for (let j = 0; j < D.done.length && !spot; j++) if (D.done[j] && D.dist[j] > 7.5 && D.dist[j] < 9) spot = [j % m7.w, (j - j % m7.w) / m7.w];
        for (const q of STEPS) if (!step && stepInfo(m7, L7.x, L7.y, q[0], q[1], false) && !taken(st7, m7, L7.x + q[0], L7.y + q[1], '')) step = [L7.x + q[0], L7.y + q[1]];
        if (spot && step) {
          S7.x = spot[0]; S7.y = spot[1];
          const mv7 = intent(st7, { t: 'move', to: step }); let ticks = 0, q; do { q = intent(st7, { t: 'step' }); ticks++; } while (q.ok && !q.done && ticks < 40);
          const D2 = spread(m7, L7.x, L7.y, null, null, 30);
          out.straggler = { way: mv7.path.length, ticks, from: D.dist[spot[1] * m7.w + spot[0]], to: D2.dist[S7.y * m7.w + S7.x], lead: L7.x === step[0] && L7.y === step[1] };
        }
      }
      /* the leader steps down, the lead passes on; the last one cannot leave */
      const d1 = intent(st, { t: 'party', op: 'drop', id: st.lead });
      out.drop = d1.ok && st.party.length === 5 && st.lead === st.party[0].id && !pcOf(st, 'P1');
      while (st.party.length > 1) intent(st, { t: 'party', op: 'drop', id: st.party[1].id });
      out.last = refuse({ t: 'party', op: 'drop', id: st.party[0].id });
      out.log = { add: st.log.filter((e) => e.t === 'party' && e.op === 'add').length, drop: st.log.filter((e) => e.t === 'party' && e.op === 'drop').length };
      /* a file with too many travellers, two with one name tag, one of them in another town: six come back, each themselves, all on the leader's board */
      const st4 = newGame('party-2'); for (let k = 0; k < 3; k++) intent(st4, { t: 'party', op: 'add' });
      const file = JSON.parse(JSON.stringify(packState(st4)));
      file.party.push({ id: 'P2', name: 'Twin', site: 'S1', x: file.party[0].x, y: file.party[0].y }, { id: 'P9', name: 'Stray', site: 'S0', x: 3, y: 3 }, { id: 'nonsense', name: '', site: 'S1', x: -9, y: 999 }, { id: 'P10', name: 'Seventh', site: 'S1', x: 1, y: 1 }, { id: 'P11', name: 'Eighth', site: 'S1', x: 1, y: 1 });
      file.lead = 'P3';
      let st5 = null; try { st5 = unpackState(file); } catch (e) { out.loadErr = e.message; }
      if (st5) { const m = st5.maps.S1; out.load = { n: st5.party.length, ids: new Set(st5.party.map((p) => p.id)).size, here: st5.party.every((p) => p.site === 'S1' && tileFree(m, p.x, p.y)), apart: new Set(st5.party.map((p) => p.x + ',' + p.y)).size, lead: st5.lead, first: st5.party[0].id, named: st5.party.every((p) => p.name.length > 0) }; }
      return out;
    });
    ok(r.six, 'five more join: six names, six squares of their own, each a short walk from the leader');
    for (const [k, why] of [['seventh', 'full'], ['notlead', 'notlead'], ['noname', 'noname'], ['last', 'last']]) ok(r[k].ok === false && r[k].why === why && r[k].same && r[k].say, 'refused, with a reason, and nothing changed: ' + k + ' ("' + r[k].say + '")');
    ok(r.named, 'a name is trimmed, single-spaced and kept to 24 letters, markup and all, as text');
    ok(r.swap === true, 'the leader may walk to the square a companion stands on: the two change places');
    ok(r.trail.arrived && r.trail.legal && !r.trail.shared && r.trail.moved >= 10, 'the party trails its leader: every follower step is one legal square, and no two ever share one (' + r.trail.moved + ' follower steps)');
    ok(r.trail.far <= 2, 'and when the leader stops the rest have closed up behind (the widest gap in the line is ' + r.trail.far + ')');
    ok(r.beside.tried > 60 && r.beside.wrong === 0, 'a newcomer stands the shortest WALK from the leader, never through a wall (tried from ' + r.beside.tried + ' squares of an inn)' + (r.beside.wrong ? ': ' + r.beside.wrong + ' wrong' : ''));
    ok(r.straggler && r.straggler.lead && r.straggler.way === 1 && r.straggler.ticks >= 5 && r.straggler.to <= r.straggler.from - 5, 'a straggler keeps coming after the leader stops: a one-square walk lasts ' + (r.straggler && r.straggler.ticks) + ' ticks and closes ' + (r.straggler && (r.straggler.from - r.straggler.to).toFixed(0)) + ' squares');
    ok(r.travel, 'the way out is taken together: all six stand in the town, apart');
    ok(r.corridor.inn && r.corridor.back && !r.corridor.shared && r.corridor.depth >= 6, 'in a passage one square wide the leader walks in past the others and back out past them, changing places as they meet');
    ok(r.drop && r.log.add === 5 && r.log.drop === 5, 'when the leader leaves, the lead passes on; comings and goings are journalled');
    ok(!r.loadErr && r.load && r.load.n === 6 && r.load.ids === 6 && r.load.here && r.load.apart === 6 && r.load.lead === 'P3' && r.load.first === 'P1' && r.load.named, 'a tampered file: six travellers come back, each with an id of their own, all on the leader\'s board, in their saved order' + (r.loadErr ? ' (' + r.loadErr + ')' : ''));

    /* at the table */
    await begin(page);
    const tapEl = async (sel) => { const p = await page.evaluate((sel) => { const e = typeof sel === 'string' ? document.querySelector(sel) : null, r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel); await page.touchscreen.tap(p[0], p[1]); await page.waitForTimeout(120); };
    const bar0 = await page.evaluate(() => ({ chips: document.querySelectorAll('#chips .chip.pc').length, add: !!document.querySelector('#chips .chip.add'), init: !document.getElementById('btn-init').hidden, end: document.getElementById('btn-end').hidden }));
    ok(bar0.chips === 1 && bar0.add && bar0.init && bar0.end, 'over the board: a counter for the traveller, a place to add another, and the dice');
    await tapEl('#chips .chip.add');
    ok(await page.evaluate(() => document.getElementById('pan-party').classList.contains('open') && document.querySelectorAll('#party-list .entry').length === 1), 'the empty counter opens the party');
    await tapEl('#party-add'); await tapEl('#party-add');
    await page.evaluate(() => { const i = document.querySelectorAll('#party-list .pname')[1]; i.focus(); i.value = ''; });
    await page.keyboard.type('<img src=x onerror="window.__pwned=7">'); await page.keyboard.press('Tab'); await page.waitForTimeout(150);
    const pan = await page.evaluate(() => ({ rows: document.querySelectorAll('#party-list .entry').length, n: G.st.party.length, name: G.st.party[1].name, imgs: document.querySelectorAll('#pan-party img, #turnbar img').length, pwned: window.__pwned || 0, letter: document.querySelectorAll('#party-list .chip')[1].textContent, moved: [G.st.party[0].x, G.st.party[0].y] }));
    ok(pan.rows === 3 && pan.n === 3, 'ADD A TRAVELLER adds one each time');
    ok(pan.name === '<img src=x onerror="wind' && pan.imgs === 0 && pan.pwned === 0 && pan.letter === '<', 'a name typed in is kept as text (and its letters walk nobody): "' + pan.name + '"');
    await page.evaluate(() => { const b = [...document.querySelectorAll('#party-list .entry')][2].querySelectorAll('button')[0]; b.click(); });
    const led = await page.evaluate(() => ({ lead: G.st.lead, third: G.st.party[2].id, label: [...document.querySelectorAll('#party-list .entry')][2].querySelectorAll('button')[0].textContent, dis: [...document.querySelectorAll('#party-list .entry')][2].querySelectorAll('button')[0].disabled }));
    ok(led.lead === led.third && led.label === 'Leads' && led.dis, 'LEAD hands the lead to that traveller');
    await page.evaluate(() => UI.closePanels()); await page.waitForTimeout(350);
    /* on the board a tap on a companion gives them the lead; then a tap on the floor walks the leader and the others come too */
    const mate = await page.evaluate(() => { const p = G.st.party[0], s = w2s(p.x + .5, p.y + .5), r = View.cv.getBoundingClientRect(); return { id: p.id, name: p.name, tap: [r.left + s[0], r.top + s[1]] }; });
    await page.touchscreen.tap(...mate.tap); await page.waitForTimeout(200);
    const lead2 = await page.evaluate(() => ({ lead: G.st.lead, on: [...document.querySelectorAll('#chips .chip.pc')].findIndex((c) => c.classList.contains('on')), card: document.getElementById('info-name').textContent, text: document.getElementById('info-text').textContent, walk: !!G.st.walk }));
    ok(lead2.lead === mate.id && lead2.on === 0 && lead2.card === mate.name && /Leads the party/.test(lead2.text) && !lead2.walk, 'a tap on a companion gives them the lead, and the bar shows it');
    await page.evaluate(() => UI.card(null));
    const walk = await page.evaluate(() => {
      const m = View.map, st = G.st, L = leadOf(st), E = eyes(); let best = null;
      for (let i = 0; i < m.w * m.h; i++) { const x = i % m.w, y = (i - x) / m.w; if (!E.vis[i] || !m.rg[i] || !tileFree(m, x, y) || m._.occ[i] >= 0 || taken(st, m, x, y, '') || doorNear(m, x + .5, y + .5)) continue; const s = w2s(x + .5, y + .5); if (s[0] < 20 || s[1] < 20 || s[0] > View.vw - 20 || s[1] > View.vh - 20) continue; const d = Math.max(Math.abs(x - L.x), Math.abs(y - L.y)); if (!best || d > best.d) best = { x, y, d, s }; }
      const r = View.cv.getBoundingClientRect(); return best && { x: best.x, y: best.y, tap: [r.left + best.s[0], r.top + best.s[1]], was: st.party.map((p) => p.x + ',' + p.y) };
    });
    if (!walk) fail('nowhere in sight to walk to'); else {
      await page.touchscreen.tap(...walk.tap); await idle(page);
      const after = await page.evaluate(() => ({ L: [leadOf(G.st).x, leadOf(G.st).y], now: G.st.party.map((p) => p.x + ',' + p.y) }));
      ok(after.L[0] === walk.x && after.L[1] === walk.y && new Set(after.now).size === 3, 'a tap walks the one who leads, and the party keeps a square each (' + after.now.join(' ') + ')');
    }
    /* the bar fits every screen: its buttons on the glass, clear of the reload button and the ribbon */
    const bars = [];
    for (const vp of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(vp); await page.waitForTimeout(250);
      for (const rounds of [false, true]) {
        await page.evaluate((on) => { if (!!G.st.round !== on) UI.rounds(on); }, rounds); await page.waitForTimeout(60);
        const g = await page.evaluate(() => {
          const R = (id) => document.getElementById(id).getBoundingClientRect(), hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1, bad = [];
          const btns = ['btn-init', 'btn-end', 'btn-stand'].filter((id) => !document.getElementById(id).hidden), chips = R('chips'), board = R('board'), bar = R('turnbar');
          for (const id of btns) { const r = R(id); if (r.left < 0 || r.right > innerWidth + .5 || r.top < 0 || r.height < 38) bad.push(id + ' off the glass'); for (const o of ['reload-btn', 'ribbon-btn']) if (hit(r, R(o))) bad.push(id + ' under ' + o); }
          for (const o of ['reload-btn', 'ribbon-btn']) if (hit(chips, R(o))) bad.push('counters under ' + o);
          if (chips.width < 76) bad.push('counters squeezed to ' + Math.round(chips.width));
          if (bar.bottom > board.top + 3) bad.push('bar over the board');
          if (board.height < 180) bad.push('board only ' + Math.round(board.height) + ' tall');
          return bad;
        });
        for (const b of g) bars.push(vp.width + 'x' + vp.height + (rounds ? ' in rounds: ' : ': ') + b);
      }
    }
    ok(bars.length === 0, 'the bar fits at four screen sizes, exploring and in rounds' + (bars.length ? ': ' + bars.join(' | ') : ''));
    await O.ctx.close();
  }

  }
  if (want('P')) {
  /* ------------------------------------------------------------------ P */
  console.log('P. rounds');
  {
    const P = await open({ width: 390, height: 844 }, null, { monsters: 'hand' }), page = P.page;   /* these rows are about a monster moved by hand; the script that plays them by default has section R */
    const r = await page.evaluate(() => {
      const out = {};
      /* a party of four walks into the cave until a bandit sees it */
      const make = () => {
        const st = newGame('rounds-1'); for (let k = 0; k < 3; k++) intent(st, { t: 'party', op: 'add' });
        const hop = intent(st, { t: 'jump', site: 'S2' }), m = st.maps.S2, L = leadOf(st), spotted = hop.spotted.slice(); let halted = spotted.length > 0;
        for (let h = 0; h < 30 && !halted; h++) {
          const F = spread(m, L.x, L.y, null, null); let best = null, bd = Infinity;
          for (const t of m.tokens) if (t.k === 'foe') for (const s of STEPS) { const x = t.x + s[0], y = t.y + s[1]; if (inb(m, x, y) && F.dist[y * m.w + x] < bd && tileFree(m, x, y) && !tokenAt(m, x, y)) { bd = F.dist[y * m.w + x]; best = [x, y]; } }
          if (!intent(st, { t: 'move', to: best }).ok) break;
          let q; do { q = intent(st, { t: 'step' }); } while (q.ok && !q.done);
          if (q.halted) { halted = true; spotted.push(...q.spotted); out.haltWalk = !st.walk && q.done && !q.next; }
        }
        return { st, m, spotted, halted };
      };
      const A = make(), B = make(), st = A.st, m = A.m, snap = () => JSON.stringify(packState(st)).replace(/"saved":\d+/, '');
      const refuse = (it) => { const a = snap(), res = intent(st, it), b = snap(); return { ok: res.ok, why: res.why, say: res.say, same: a === b && !st.walk }; };
      const V = visOf(st).g, inSight = m.tokens.filter((t) => t.k === 'foe' && V[t.y * m.w + t.x]).map((t) => t.id).sort();
      out.spot = { halted: A.halted, n: A.spotted.length, met: (st.met.S2 || []).slice().sort().join() === inSight.join(), log: st.log.filter((e) => e.t === 'spot').reduce((n, e) => n + e.ids.length, 0), once: new Set(A.spotted).size === A.spotted.length };
      out.noround = refuse({ t: 'end' });
      /* initiative: everyone in the party and every bandit in sight, highest roll first; the dice are the tale's own */
      const s1 = intent(st, { t: 'rounds', op: 'start' }), s2 = intent(B.st, { t: 'rounds', op: 'start' }), R = st.round;
      out.start = { ok: s1.ok, pcs: R.order.filter((c) => c.k === 'pc').length, foes: R.order.filter((c) => c.k === 'foe').map((c) => c.id).sort().join() === inSight.join() && inSight.length > 0, sorted: R.order.every((c, k) => !k || R.order[k - 1].roll >= c.roll), dice: R.order.every((c) => c.roll >= 1 && c.roll <= 20 && Number.isInteger(c.roll)), same: JSON.stringify(s1.order) === JSON.stringify(s2.order), n: R.n, i: R.i, moved: R.moved, total: m.tokens.filter((t) => t.k === 'foe').length };
      out.again = refuse({ t: 'rounds', op: 'start' });
      /* walk the turns round until it is a traveller's turn */
      const until = (pc) => { for (let k = 0; k < 40 && turnOf(st).pc !== pc; k++) intent(st, { t: 'end' }); return turnOf(st); };
      let a = until(true);
      const other = st.party.find((p) => p.id !== a.id);
      out.notturn = refuse({ t: 'move', who: other.id, to: [other.x, other.y] });
      for (const [k, it] of [['travel', { t: 'travel' }], ['jump', { t: 'jump', site: 'S0' }], ['add', { t: 'party', op: 'add' }], ['drop', { t: 'party', op: 'drop', id: other.id }], ['lead', { t: 'lead', id: other.id }]]) out['in_' + k] = refuse(it);
      /* reach: exactly the squares a move accepts; every one within 30 ft; nobody's square among them */
      const check = (a, known) => {
        const rc = reachOf(st, a, known), o = { n: 0, agree: true, within: true, empty: true, far: null, ft: 0 };
        for (let i = 0; i < rc.length; i++) { const x = i % m.w, y = (i - x) / m.w, q = route(st, a, [[x, y]], known), here = x === a.o.x && y === a.o.y; if (!!rc[i] !== (q.ok && !here)) o.agree = false; if (rc[i]) { o.n++; if (q.ft > SPEED - st.round.moved) o.within = false; if (taken(st, m, x, y, a.id)) o.empty = false; if (q.ft >= o.ft) { o.ft = q.ft; o.far = [x, y]; } } }
        return o;
      };
      const c1 = check(a, true); out.reach1 = c1;
      /* friends may be passed and never stopped on: more is in reach than if every friend were a wall */
      const naive = spread(m, a.o.x, a.o.y, null, (x, y) => taken(st, m, x, y, a.id), 20); let nn = 0; for (let i = 0; i < naive.done.length; i++) if (naive.done[i] && i !== naive.s && naive.ft[i] <= SPEED && m.seen[i]) nn++;
      out.pass = { more: c1.n - nn, mates: st.party.filter((p) => p.id !== a.id).every((p) => !reachOf(st, a, true)[p.y * m.w + p.x]), stop: route(st, a, [[other.x, other.y]], true) };
      /* too far is refused in feet; then the furthest square is walked to and the turn's movement is spent */
      const F = spread(m, a.o.x, a.o.y, null, barrier(st, m, a, true)); let over = null;
      for (let i = 0; i < F.done.length && !over; i++) if (F.done[i] && F.ft[i] > SPEED && F.ft[i] < 70 && !taken(st, m, i % m.w, (i - i % m.w) / m.w, a.id)) over = [i % m.w, (i - i % m.w) / m.w];
      out.spent = over ? refuse({ t: 'move', to: over, known: true }) : null;
      const mv = intent(st, { t: 'move', to: c1.far, known: true }); let q, steps = 0, clash = false; do { q = intent(st, { t: 'step' }); steps++; } while (q.ok && !q.done && steps < 20);
      if (new Set(st.party.map((p) => p.x + ',' + p.y)).size !== st.party.length || st.party.some((p) => tokenAt(m, p.x, p.y))) clash = true;
      out.walk = { ok: mv.ok && q.ok && q.done, ft: mv.ft, moved: st.round.moved, at: a.o.x === c1.far[0] && a.o.y === c1.far[1], clash, others: st.log.filter((e) => e.t === 'move').slice(-1)[0].who === a.id };
      const c2 = check(a, true); out.reach2 = { n: c2.n, agree: c2.agree, within: c2.within, left: SPEED - st.round.moved };
      /* the turn passes on; after the last, a new round */
      const i0 = st.round.i, n0 = st.round.n, e1 = intent(st, { t: 'end' });
      out.end = { ok: e1.ok, next: st.round.i === (i0 + 1) % st.round.order.length, who: e1.who === st.round.order[st.round.i].id, moved: st.round.moved };
      for (let k = 0; k < st.round.order.length; k++) intent(st, { t: 'end' });
      out.wrap = { n: st.round.n === n0 + 1 || st.round.n === n0 + 2, log: st.log.filter((e) => e.t === 'round').length };
      /* a bandit's turn: the same intents move it, it has the same 30 ft, and it does not walk through the party */
      const f = until(false);
      if (!f || f.pc) out.foe = null; else {
        const cf = check(f, false), from = [f.o.x, f.o.y], pcs = JSON.stringify(st.party);
        const fm = intent(st, { t: 'move', to: cf.far }); do { q = intent(st, { t: 'step' }); } while (q.ok && !q.done);
        out.foe = { reach: cf.n > 0 && cf.agree && cf.within && cf.empty, ok: fm.ok, at: f.o.x === cf.far[0] && f.o.y === cf.far[1], index: tokenAt(m, f.o.x, f.o.y) === f.o && (from[0] === f.o.x && from[1] === f.o.y || !tokenAt(m, from[0], from[1])), party: JSON.stringify(st.party) === pcs,
          moved: st.round.moved === fm.ft, wall: st.party.every((p) => { const g = route(st, f, [[p.x, p.y]], false); return !g.ok; }), mine: refuse({ t: 'move', who: st.party[0].id, to: [st.party[0].x, st.party[0].y] }).why };
      }
      /* who stands in whose way: each side lets its own pass, and nobody passes the other side, or a bystander */
      {
        const pcA = { id: st.party[0].id, pc: true, o: st.party[0], m }, foes = m.tokens.filter((t) => t.k === 'foe'), by = m.tokens.find((t) => t.k !== 'foe'), fA = { id: foes[0].id, pc: false, o: foes[0], m };
        const bp = barrier(st, m, pcA, false), bf = barrier(st, m, fA, false), mate = st.party[1];
        out.sides = [bp(mate.x, mate.y) === false, bp(foes[0].x, foes[0].y) === true, bf(mate.x, mate.y) === true, foes.length < 2 || bf(foes[1].x, foes[1].y) === false, !by || (bp(by.x, by.y) === true && bf(by.x, by.y) === true), bf(foes[0].x, foes[0].y) === false];
      }
      /* a save keeps the round exactly */
      const file = JSON.parse(JSON.stringify(packState(st))), st2 = unpackState(file);
      out.save = JSON.stringify(st2.round) === JSON.stringify(st.round) && JSON.stringify(st2.met) === JSON.stringify(st.met) && st2.lead === st.lead && JSON.stringify(st2.party) === JSON.stringify(st.party);
      const evil = JSON.parse(JSON.stringify(file)); evil.round.order.push({ id: 'K999', k: 'foe', roll: 50 }, { id: 'P77', k: 'pc', roll: -4 }, null, { id: evil.round.order[0].id, k: evil.round.order[0].k, roll: 3 }); evil.round.i = 99; evil.round.moved = 1e9; evil.round.n = -5; evil.met.S2.push('K999', 42); evil.met.S77 = ['K1'];
      const st3 = unpackState(evil), m3 = st3.maps.S2;
      out.evil = st3.round && st3.round.order.length === st.round.order.length && st3.round.order.every((c) => c.roll >= 1 && c.roll <= 20 && (c.k === 'pc' ? pcOf(st3, c.id) : m3.tokens.some((t) => t.id === c.id))) && st3.round.i < st3.round.order.length && st3.round.moved <= SPEED && st3.round.n >= 1 && !st3.met.S77 && st3.met.S2.every((id) => m3.tokens.some((t) => t.id === id)) && !!turnOf(st3);
      /* someone the fight has not seen yet joins it when they come in sight, and the turn in hand is not lost */
      let joined = null, hidden = m.tokens.filter((t) => t.k === 'foe' && !st.round.order.some((c) => c.id === t.id));
      for (let turn = 0; turn < 80 && hidden.length && !joined; turn++) {
        const w = until(true), cur = w.id, D = spread(m, w.o.x, w.o.y, null, (x, y) => !!tokenAt(m, x, y)); let tgt = null, bd = Infinity;
        for (const t of hidden) for (const s of STEPS) { const x = t.x + s[0], y = t.y + s[1]; if (inb(m, x, y) && D.done[y * m.w + x] && D.dist[y * m.w + x] < bd) { bd = D.dist[y * m.w + x]; tgt = y * m.w + x; } }
        if (tgt === null) break;
        const way = []; for (let c = tgt; c !== D.s && c >= 0; c = D.prev[c]) way.push([c % m.w, (c - c % m.w) / m.w]); way.reverse();
        let goal = null; for (const p of way) { const g = route(st, w, [p], false); if (g.ok && g.path.length) goal = p; else if (!g.ok && g.why === 'spent') break; }
        if (goal && intent(st, { t: 'move', to: goal }).ok) { let z; do { z = intent(st, { t: 'step' }); if (z.ok && z.joined.length && !joined) joined = { ids: z.joined, cur: turnOf(st).id === cur, inOrder: z.joined.every((id) => st.round.order.some((c) => c.id === id)), sorted: st.round.order.every((c, k) => !k || st.round.order[k - 1].roll >= c.roll), halted: !!z.halted }; } while (z.ok && !z.done); }
        if (!joined) intent(st, { t: 'end' });
        hidden = m.tokens.filter((t) => t.k === 'foe' && !st.round.order.some((c) => c.id === t.id));
      }
      out.join = joined; out.hidden0 = out.start.total - inSight.length;
      /* and whatever the newcomer rolls, the turn in hand stays in hand: the last and lowest in the order is acting when a bandit in sight is (re)counted in */
      {
        const R9 = st.round, V9 = visOf(st).g, seenFoe = R9.order.find((c) => c.k === 'foe' && (() => { const t = m.tokens.find((q) => q.id === c.id); return V9[t.y * m.w + t.x]; })());
        if (seenFoe) { R9.order.splice(R9.order.indexOf(seenFoe), 1); R9.i = R9.order.length - 1; const cur = R9.order[R9.i], roll0 = cur.roll; cur.roll = 0; const j = look(st).joined; out.rejoin = j.length === 1 && j[0] === seenFoe.id && R9.order[R9.i] === cur && R9.order.indexOf(cur) === R9.order.length - 1 && R9.order.some((c) => c.id === seenFoe.id); cur.roll = roll0; }
      }
      const stop = intent(st, { t: 'rounds', op: 'stop' });
      out.stop = stop.ok && st.round === null && st.log.some((e) => e.t === 'rounds' && e.on === false);
      out.stop2 = refuse({ t: 'rounds', op: 'stop' });
      return out;
    });
    ok(r.spot.halted && r.haltWalk && r.spot.n >= 1 && r.spot.met && r.spot.log === r.spot.n && r.spot.once, 'a bandit in sight for the first time stops the walk where it stands, and is reported once (' + r.spot.n + ' met)');
    ok(r.start.ok && r.start.pcs === 4 && r.start.foes && r.start.sorted && r.start.dice && r.start.n === 1 && r.start.i === 0 && r.start.moved === 0, 'initiative: the whole party and every bandit in sight, highest roll first, on d20s');
    ok(r.start.same, 'the dice are the tale\'s own: the same tale played the same way rolls the same order');
    for (const [k, why] of [['noround', 'noround'], ['again', 'inround'], ['notturn', 'notturn'], ['in_travel', 'inround'], ['in_jump', 'inround'], ['in_add', 'inround'], ['in_drop', 'inround'], ['in_lead', 'inround'], ['stop2', 'noround']]) ok(r[k].ok === false && r[k].why === why && r[k].same && r[k].say, 'refused, with a reason, and nothing changed: ' + k + ' ("' + r[k].say + '")');
    ok(r.reach1.n >= 3 && r.reach1.agree && r.reach1.within && r.reach1.empty, 'what is shown as in reach is exactly what a move accepts: within 30 ft, and nobody\'s square (' + r.reach1.n + ' squares)');
    ok(r.pass.more > 0 && r.pass.mates && r.pass.stop.ok === false && r.pass.stop.why === 'blocked', 'friends may be walked past and never stopped on (' + r.pass.more + ' more squares in reach than if they were walls)');
    ok(r.spent && r.spent.ok === false && r.spent.why === 'spent' && r.spent.same && /\d+ ft/.test(r.spent.say), 'a square too far for this turn is refused in feet: "' + (r.spent && r.spent.say) + '"');
    ok(r.walk.ok && r.walk.at && r.walk.moved === r.walk.ft && r.walk.ft <= 30 && r.walk.ft >= 15 && !r.walk.clash && r.walk.others, 'a move in a round spends that many feet of the turn (' + r.walk.ft + ' of 30), and only the mover moves');
    ok(r.reach2.agree && r.reach2.within && (r.reach2.left === 0 ? r.reach2.n === 0 : true), 'and what is left of the turn reaches only so far (' + r.reach2.left + ' ft, ' + r.reach2.n + ' squares)');
    ok(r.end.ok && r.end.next && r.end.who && r.end.moved === 0 && r.wrap.n && r.wrap.log >= 1, 'END TURN passes to the next in order with a fresh 30 ft; after the last comes a new round, journalled');
    ok(r.foe && r.foe.reach && r.foe.ok && r.foe.at && r.foe.index && r.foe.party && r.foe.moved && r.foe.wall && r.foe.mine === 'notturn', 'on a bandit\'s turn the same intents move the bandit: 30 ft, not through the party, and nobody else may act');
    ok(r.sides.every(Boolean), 'each side lets its own walk past, and nobody walks through the other side or a bystander (' + r.sides.map((v) => (v ? 'y' : 'N')).join('') + ')');
    ok(r.save, 'a save keeps the round: order, whose turn, feet spent, who has been met');
    ok(r.evil, 'a tampered round loses its impossible parts and still has someone whose turn it is');
    ok(r.hidden0 > 0 && r.join && r.join.cur && r.join.inOrder && r.join.sorted && !r.join.halted, 'a bandit who comes in sight mid-fight rolls and joins the order, and the turn in hand stays in hand');
    ok(r.rejoin === true, 'whatever a newcomer rolls, whoever was acting is still acting once the order is sorted again');
    ok(r.stop, 'standing down ends the rounds, and says so in the journal');

    /* at the table, by touch */
    await begin(page);
    await page.evaluate(() => { document.getElementById('party-add').click(); document.getElementById('party-add').click(); UI.follow(intent(G.st, { t: 'jump', site: 'S2' })); });
    await page.waitForFunction(() => G.st.here === 'S2' && View.map && View.map.id === 'S2', null, { timeout: 8000 }); await idle(page);
    const dlgOpen = () => page.evaluate(() => document.getElementById('dialog').classList.contains('open'));
    let cheap = false;
    for (let h = 0; h < 30 && !(await dlgOpen()); h++) {
      await page.evaluate(() => { const st = G.st, m = View.map, L = leadOf(st), F = spread(m, L.x, L.y, null, null); let best = null, bd = Infinity; for (const t of m.tokens) if (t.k === 'foe') for (const s of STEPS) { const x = t.x + s[0], y = t.y + s[1]; if (inb(m, x, y) && F.dist[y * m.w + x] < bd && tileFree(m, x, y) && !tokenAt(m, x, y)) { bd = F.dist[y * m.w + x]; best = [x, y]; } } const r = intent(st, { t: 'move', to: best }); if (r.ok && r.path.length) { View.path = { pts: r.path, ft: r.ft, i: 0, preview: false }; View.walking = true; } });
      if (!cheap) cheap = await page.waitForFunction(() => View.walking && !View.free && View.g.imageSmoothingQuality === 'low', null, { timeout: 1500 }).then(() => true, () => false);
      await idle(page); await page.waitForTimeout(80);
    }
    /* (measured 2026-10-10, six walking through the town at 3x: the fine stretch held 83 ms a frame, the cheap one 16.7) */
    ok(cheap, 'while the table follows a walk, the map bitmap is stretched the cheap way; the sharp repaint comes when it rests');
    const dlg = await page.evaluate(() => ({ open: document.getElementById('dialog').classList.contains('open'), title: document.getElementById('dlg-title').textContent, text: document.getElementById('dlg-body').textContent, btns: [...document.querySelectorAll('#dlg-btns button')].map((b) => b.textContent), met: (G.st.met.S2 || []).length, name: (() => { const t = View.map.tokens.find((q) => q.id === G.st.met.S2[0]); return G.st.npcs[t.npc].name; })(), walk: !!G.st.walk || View.walking, round: !!G.st.round }));
    ok(dlg.open && dlg.title === 'You are seen' && dlg.text.includes(dlg.name) && dlg.btns.join('|') === 'Carry on|Roll initiative' && !dlg.walk && !dlg.round, 'when a bandit first sees the party the walk stops and the table offers the dice: "' + dlg.text + '"');
    const tapEl = async (sel) => { const p = await page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel); await page.touchscreen.tap(p[0], p[1]); await page.waitForTimeout(150); };
    await page.evaluate(() => [...document.querySelectorAll('#dlg-btns button')].find((b) => /initiative/i.test(b.textContent)).setAttribute('id', 'dlg-roll'));
    await tapEl('#dlg-roll');
    const bar = await page.evaluate(() => { const R = G.st.round; return { on: !!R, chips: document.querySelectorAll('#chips .chip').length, order: R ? R.order.length : 0, foes: document.querySelectorAll('#chips .chip.foe').length, cur: [...document.querySelectorAll('#chips .chip')].findIndex((c) => c.classList.contains('on')), i: R ? R.i : -1, badges: [...document.querySelectorAll('#chips .chip i')].map((b) => +b.textContent).join(), rolls: R ? R.order.map((c) => c.roll).join() : '', init: document.getElementById('btn-init').hidden, end: !document.getElementById('btn-end').hidden, stand: !document.getElementById('btn-stand').hidden, sub: document.getElementById('place-sub').textContent, add: !!document.querySelector('#chips .chip.add'), act: document.getElementById('act').hidden, dlg: document.getElementById('dialog').classList.contains('open') }; });
    ok(bar.on && !bar.dlg && bar.chips === bar.order && bar.foes >= 1 && bar.cur === bar.i && bar.badges === bar.rolls && bar.init && bar.end && bar.stand && !bar.add && bar.act, 'ROLL INITIATIVE: the bar becomes the order, each counter with its roll, the first one marked, and END TURN beside it');
    ok(/^30 ft left/.test(bar.sub) && /round 1$/.test(bar.sub), 'the header says whose turn it is and what is left of it: "' + bar.sub + '"');
    /* bring a traveller's turn round, then use it by touch */
    const settle = async () => { await page.waitForFunction(() => !View.easing && !View.walking && View.anim.t >= 1, null, { timeout: 8000 }); await page.waitForTimeout(60); };   /* the camera eases to whoever acts: wait for it before aiming a tap */
    for (let k = 0; k < 12 && !(await page.evaluate(() => actor().pc)); k++) await tapEl('#btn-end');
    await settle();
    const tint = await page.evaluate(() => {
      viewDraw();
      const m = View.map, rc = reach(), a = actor(), E = eyes(), rgb = (x, y) => { const s = w2s(x + .3, y + .3), e = w2s(x + .7, y + .7), d = View.dpr, px = View.g.getImageData(Math.round(s[0] * d), Math.round(s[1] * d), Math.max(1, Math.round((e[0] - s[0]) * d)), Math.max(1, Math.round((e[1] - s[1]) * d))).data; let r = 0, b = 0; for (let i = 0; i < px.length; i += 4) { r += px[i]; b += px[i + 2]; } return (r - b) / (px.length / 4); };
      const plain = (i) => m.t[i] === TR.CAVE && m._.occ[i] < 0 && m._.dec[i] < 0 && E.vis[i] && !taken(G.st, m, i % m.w, (i - i % m.w) / m.w, ''), on = (x, y) => { const s = w2s(x + .5, y + .5); return s[0] > 12 && s[1] > 12 && s[0] < View.vw - 12 && s[1] < View.vh - 12; };
      let inR = null, outR = null, far = null, n = 0;
      for (let i = 0; i < rc.length; i++) { const x = i % m.w, y = (i - x) / m.w; if (rc[i]) n++; if (!plain(i) || !on(x, y)) continue; if (rc[i] && !inR) inR = [x, y]; if (!rc[i] && !outR) outR = [x, y]; if (!rc[i] && m.seen[i] && tileFree(m, x, y)) far = [x, y]; }
      const r = View.cv.getBoundingClientRect(), tap = (p) => { const s = w2s(p[0] + .5, p[1] + .5); return [r.left + s[0], r.top + s[1]]; };
      return { n, inR, outR, a: inR && rgb(inR[0], inR[1]), b: outR && rgb(outR[0], outR[1]), tapIn: inR && tap(inR), far, tapFar: far && tap(far), who: a.id, at: [a.o.x, a.o.y] };
    });
    if (!tint.inR || !tint.outR || !tint.far) fail('no plain floor in and out of reach to compare'); else {
      ok(tint.n >= 3 && tint.a > tint.b + 8, 'the squares still in reach this turn are washed with gold (' + tint.a.toFixed(0) + ' against ' + tint.b.toFixed(0) + ' red over blue)');
      await page.touchscreen.tap(...tint.tapFar); await page.waitForTimeout(200);
      const farTap = await page.evaluate(() => ({ walk: !!G.st.walk || View.walking, toast: document.getElementById('toast').textContent, on: document.getElementById('toast').classList.contains('on'), at: [actor().o.x, actor().o.y], moved: G.st.round.moved }));
      ok(!farTap.walk && farTap.on && /ft/.test(farTap.toast) && farTap.at[0] === tint.at[0] && farTap.at[1] === tint.at[1] && farTap.moved === 0, 'a tap beyond reach walks nobody and says how far it is: "' + farTap.toast + '"');
      await page.touchscreen.tap(...tint.tapIn); await idle(page);
      const moved = await page.evaluate(() => ({ at: [actor().o.x, actor().o.y], who: actor().id, moved: G.st.round.moved, sub: document.getElementById('place-sub').textContent }));
      ok(moved.who === tint.who && moved.at[0] === tint.inR[0] && moved.at[1] === tint.inR[1] && moved.moved >= 5 && moved.sub.startsWith((30 - moved.moved) + ' ft left'), 'a tap within reach walks there and the header counts the feet down: "' + moved.sub + '"');
    }
    /* END TURN by touch and by the Enter key; then a bandit's turn, moved by the same hand */
    const t0 = await page.evaluate(() => G.st.round.i); await tapEl('#btn-end');
    const t1 = await page.evaluate(() => ({ i: G.st.round.i, cur: [...document.querySelectorAll('#chips .chip')].findIndex((c) => c.classList.contains('on')), n: G.st.round.order.length }));
    /* the tap left END TURN focused, and Enter on a focused button presses it whatever the page does: take the focus away, so only the game's own key can answer */
    await page.evaluate(() => { document.activeElement.blur(); });
    await page.keyboard.press('Enter'); await page.waitForTimeout(120);
    const t2 = await page.evaluate(() => G.st.round.i);
    ok(t1.i === (t0 + 1) % t1.n && t1.cur === t1.i && t2 === (t1.i + 1) % t1.n, 'END TURN, by touch or by Enter, passes the turn and moves the mark along the bar');
    const seenByParty = await page.evaluate(() => View.map.seen.join(''));       /* nobody of the party moves from here until the bandit's turn */
    for (let k = 0; k < 12 && (await page.evaluate(() => actor().pc)); k++) await tapEl('#btn-end');
    await settle();
    const foe = await page.evaluate(() => {
      viewDraw(); const m = View.map, a = actor(), rc = reach(); let far = null;
      for (let i = 0; i < rc.length; i++) { const x = i % m.w, y = (i - x) / m.w, s = w2s(x + .5, y + .5); if (rc[i] && s[0] > 12 && s[1] > 12 && s[0] < View.vw - 12 && s[1] < View.vh - 12 && !doorNear(m, x + .5, y + .5)) far = [x, y]; }
      const r = View.cv.getBoundingClientRect(), s = far && w2s(far[0] + .5, far[1] + .5);
      return { pc: a.pc, id: a.id, far, tap: far && [r.left + s[0], r.top + s[1]], chip: (document.querySelector('#chips .chip.on') || { className: '' }).className, party: JSON.stringify(G.st.party) };
    });
    if (foe.pc || !foe.far) fail('no bandit turn to play'); else {
      const eye = await page.evaluate((seen0) => {
        const m = View.map, a = actor(), own = sightFrom(m, a.o.x, a.o.y, sightOf(m)), P = visOf(G.st).g, E = eyes().vis; let extra = 0, shown = 0, n = 0;
        for (let i = 0; i < own.length; i++) { if (own[i]) { n++; if (E[i]) shown++; if (!P[i]) extra++; } }
        viewDraw();
        /* and the sharp case: set the bandit down, for a moment, on ground nobody of the party has seen. The table shows it round the bandit; the party's memory must not grow by it */
        const home = [a.o.x, a.o.y]; let far = null, dark = 0;
        for (let i = m.w * m.h - 1; i >= 0 && !far; i--) { const x = i % m.w, y = (i - x) / m.w; if (!m.seen[i] && tileFree(m, x, y) && !tokenAt(m, x, y)) far = [x, y]; }
        if (far) { moveToken(m, a.o, far[0], far[1]); const E2 = eyes().vis; viewDraw(); for (let i = 0; i < E2.length; i++) if (E2[i] && seen0[i] === '0') dark++; moveToken(m, a.o, home[0], home[1]); eyes(); viewDraw(); }
        return { n, shown, extra, dark, same: m.seen.join('') === seen0, party: P.every((v, i) => !v || E[i]) };
      }, seenByParty);
      ok(eye.n > 3 && eye.extra > 0 && eye.shown === eye.n && eye.party && eye.dark > 3 && eye.same, 'on a bandit\'s turn the table shows what the bandit sees as well; set down on unseen ground it shows ' + eye.dark + ' squares the party has never seen, and none of them is added to what the party has seen');
      await page.touchscreen.tap(...foe.tap); await idle(page);
      const fm = await page.evaluate(() => ({ at: [actor().o.x, actor().o.y], id: actor().id, party: JSON.stringify(G.st.party), moved: G.st.round.moved, tok: tokenAt(View.map, actor().o.x, actor().o.y) === actor().o }));
      ok(/foe/.test(foe.chip) && fm.id === foe.id && fm.at[0] === foe.far[0] && fm.at[1] === foe.far[1] && fm.party === foe.party && fm.moved >= 5 && fm.tok, 'on a bandit\'s turn a tap moves the bandit, and the party stays where it is');
    }
    await tapEl('#btn-stand');
    const off = await page.evaluate(() => ({ round: G.st.round, init: !document.getElementById('btn-init').hidden, end: document.getElementById('btn-end').hidden, add: !!document.querySelector('#chips .chip.add'), sub: document.getElementById('place-sub').textContent, mapSub: View.map.sub }));
    ok(off.round === null && off.init && off.end && off.add && off.sub.startsWith(off.mapSub), 'the cross stands everyone down: the dice are back on the bar and the header names the place again');
    await tapEl('#btn-init');
    ok(await page.evaluate(() => !!G.st.round && G.st.round.n === 1), 'and ROLL INITIATIVE on the bar starts them again at any time');
    /* a round in progress survives a reload */
    await page.evaluate(() => UI.saveNow()); await page.waitForTimeout(400);
    const keep = await page.evaluate(() => JSON.stringify({ round: G.st.round, party: G.st.party, lead: G.st.lead }));
    await page.reload(); await page.waitForFunction(() => typeof UI === 'object');
    await page.waitForFunction(() => !document.getElementById('btn-continue').hidden, null, { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => document.getElementById('btn-continue').click());
    await page.waitForFunction(() => G.st && document.body.classList.contains('in-play'), null, { timeout: 8000 }); await idle(page);
    const kept = await page.evaluate(() => ({ s: JSON.stringify({ round: G.st.round, party: G.st.party, lead: G.st.lead }), end: !document.getElementById('btn-end').hidden, chips: document.querySelectorAll('#chips .chip').length, n: G.st.round ? G.st.round.order.length : -1 }));
    ok(kept.s === keep && kept.end && kept.chips === kept.n, 'Continue comes back to the same round, the same turn, the same party');
    await P.ctx.close();
  }

  }
  if (want('Q')) {
  /* ------------------------------------------------------------------ Q */
  console.log('Q. sheets, blows and dying');
  {
    const Q = await open({ width: 390, height: 844 }), page = Q.page;
    const rows = await page.evaluate((SEEDS_Q) => {
      const rows = [], row = (c, m) => rows.push([!!c, m]);
      const snap = (st) => JSON.stringify(packState(st)).replace(/"saved":\d+/, '');
      const walk = (st, who) => { let g = 0, res; do { res = intent(st, { t: 'step', who }); } while (res.ok && !res.done && ++g < 800); return res; };
      /* a traveller's turn played by the rules a monster plays by: strike, shoot, close in. The suite's own, so the script under test has an opponent it did not write. */
      const pcPlan = (st) => {
        const R = st.round, a = turnOf(st), m = a.m, p = a.o, foes = m.tokens.filter((t) => t.k === 'foe' && R.order.some((c) => c.id === t.id));
        if (!foes.length) return { t: 'end' };
        if (p.hp <= p.hpMax / 2 && R.bonus > 0) { const sw = p.abilities.find((x) => (x.n === 'Second Wind' || x.n === 'Healing Word') && x.uses > 0); if (sw) return { t: 'ability', name: sw.n }; }
        if (R.act > 0) for (const w of weaponsOf(p).slice().sort((x, y) => x.rg - y.rg)) for (const t of foes.slice().sort((x, y) => cheb(x, p) - cheb(y, p))) if (!reachWhy(m, p, t, w.rg)) return { t: 'attack', target: t.id, attack: w.n };
        if (R.act > 0 && moveLeft(R) >= 5) { const way = approach(st, a, foes); if (way && way.to) return { t: 'move', to: way.to }; }
        return { t: 'end' };
      };
      const toFoe = (st, m) => { const foes = m.tokens.filter((t) => t.k === 'foe'); if (!foes.length) return false; const L = leadOf(st), tgt = foes.slice().sort((x, y) => cheb(x, L) - cheb(y, L))[0], goals = []; for (const s of STEPS) goals.push([tgt.x + s[0], tgt.y + s[1]]); if (!intent(st, { t: 'move', goals }).ok) return false; walk(st); return true; };
      const inSight = (st, m) => { const V = visOf(st).g; return m.tokens.filter((t) => t.k === 'foe' && V[t.y * m.w + t.x]); };

      /* 1. sheets */
      {
        const st = newGame('sheet-1'), pc = st.party[0];
        row(pc.cls === 'Fighter' && pc.hp === 12 && pc.hpMax === 12 && pc.ac === 16 && pc.level === 1 && pc.xp === 0 && pc.stock === true && pc.status === 'ok' && pc.abilities.map((a) => a.n + a.uses).join() === 'Second Wind1,Action Surge1' && pc.scores.str === 15 && pc.scores.int === 8,
          'the first traveller wakes with a sheet: a level 1 Fighter, 12 hit points, AC 16, the standard array by the calling\'s own priorities');
        row(st.gold === 15 && st.time.day === 1 && st.time.minute === 480 && st.quests.Q0.status === 'active' && st.quests.Q0.main && st.quests.Q0.goal === st.bible.threads.find((t) => t.main).t && st.turn === 0 && st.v === 3, 'and the tale with a purse, a clock at eight in the morning, and the matter at hand as its first quest');
        for (let j = 0; j < 5; j++) intent(st, { t: 'party', op: 'add' });
        row(st.party.map((p) => p.cls).join() === 'Fighter,Rogue,Cleric,Wizard,Ranger,Bard' && st.gold === 15 + 20 + 15 + 10 + 15 + 20, 'newcomers take the six callings in turn, and each brings their purse: ' + st.party.map((p) => p.cls).join() + ', ' + st.gold + ' gold');
        row(st.party.every((p) => p.hpMax === CLASSES[p.cls].hd + abMod(p.scores.con) && p.hp === p.hpMax && p.ac === CLASSES[p.cls].ac && weaponsOf(p).length === 2), 'every sheet follows its calling: hit die plus constitution, the calling\'s armour, two ways to strike');
        { const w = weaponsOf(st.party[0]); row(w[0].n === 'Longsword' && w[0].hit === 2 + 2 && w[0].d === '1d8+2' && w[0].rg === 1 && w[1].hit === abMod(st.party[0].scores.dex) + 2 && w[1].rg === 30, 'a weapon strikes with its ability and the proficiency bonus, and adds the ability to its damage: ' + w.map((q) => q.n + ' ' + signed(q.hit) + ' ' + q.d).join(', ')); }
        const a = snap(st), b = snap(unpackState(JSON.parse(JSON.stringify(packState(st)))));
        row(a === b, 'a save round-trips byte for byte with six sheets in it');
        /* a calling can be changed until it has been tested */
        const wz = st.party[3], c1 = intent(st, { t: 'party', op: 'class', id: wz.id, cls: 'Bard' });
        row(c1.ok && wz.cls === 'Bard' && wz.hpMax === 8 + abMod(wz.scores.con) && wz.abilities[0].n === 'Bardic Inspiration' && wz.stock === false && st.gold === 95 + 10, 'a calling may be changed while it is untested: the sheet is made again, and the purse is the new calling\'s');
        wz.xp = 40;
        row(intent(st, { t: 'party', op: 'class', id: wz.id, cls: 'Wizard' }).why === 'seasoned' && intent(st, { t: 'party', op: 'class', id: wz.id, cls: 'Paladin' }).why === 'noclass', 'but not once experience has been earned, and never to a calling that does not exist');
        /* experience and levels */
        const f = st.party[0], ups = []; grantXp(f, 300, ups);
        row(f.level === 2 && f.hpMax === 12 + 6 + 2 && f.hp === f.hpMax && ups.length === 1 && ups[0].hpGain === 8, 'at 300 experience a Fighter is level 2 with 8 more hit points, to have and to hold');
        grantXp(f, 600, ups);
        row(f.level === 3 && f.abilities[0].max === 2 && f.abilities[0].uses === 2 && profBonus(f.level) === 2, 'and at level 3 the limited abilities gain a use');
        grantXp(f, 999999, ups);
        row(f.level === 5 && profBonus(5) === 3, 'levels stop at five');
        /* refusals outside a fight change nothing */
        const before = snap(st); let allNo = true;
        for (const it of [{ t: 'attack', target: 'K0' }, { t: 'dash' }, { t: 'ability', name: 'Action Surge' }, { t: 'ability', name: 'nonsense' }, { t: 'ability', who: 'P9', name: 'Second Wind' }, { t: 'rest', kind: 'nap' }, { t: 'lead', id: 'P9' }, { t: 'ability', who: 'P2', name: 'Sneak Attack' }]) { const r = intent(st, it); if (r.ok || typeof r.say !== 'string' || r.say.length < 4) allNo = false; }
        row(allNo && snap(st) === before, 'outside a fight, a blow, a dash and a fighting trick are refused with a reason, and change nothing');
      }

      /* the dice */
      {
        const st = newGame('dice-1'), d = diceRng(st), plain = rollTerms(d, parseDice('2d6+3'), false), crit = rollTerms(d, parseDice('2d6+3'), true), neg = rollTerms(d, parseDice('1d4-1'), false);
        row(plain.rolls.length === 2 && crit.rolls.length === 4 && plain.total === plain.rolls[0] + plain.rolls[1] + 3 && crit.total === crit.rolls.reduce((a, b) => a + b, 0) + 3 && neg.total === neg.rolls[0] - 1 && st.n.roll === 1, 'dice: a critical doubles the dice and not the bonus, and one generator serves one deed');
        row(parseDice('9d9999') === null && parseDice('31d6') === null && parseDice('1d6+201') === null && parseDice('alert(1)') === null && parseDice('') === null && parseDice(' 1D8 + 2 ').length === 2, 'dice expressions are parsed strictly: only real dice, bounded counts, nothing else');
        const a = d20s(() => 7, 'normal'), seq = [3, 17], adv = d20s(() => seq.shift(), 'advantage'), seq2 = [3, 17], dis = d20s(() => seq2.shift(), 'disadvantage');
        row(a.kept === 7 && adv.kept === 17 && dis.kept === 3 && combineMode('', true, true) === 'normal' && combineMode('advantage', false, true) === 'normal' && combineMode('', true, false) === 'advantage', 'advantage keeps the higher of two, disadvantage the lower, and the two cancel');
      }

      /* 2. many fights, played out: the script against the suite's own traveller, every invariant after every deed */
      const T = { fights: 0, won: 0, lost: 0, over: 0, swings: 0, hits: 0, foeTurns: 0, foeDeeds: 0, dashes: 0, shots: 0, bad: {}, first: {} };
      const inv = (k, c, m) => { if (!c) { T.bad[k] = (T.bad[k] || 0) + 1; if (!T.first[k]) T.first[k] = m; } };
      let trip = true, restOK = true, rescue = { n: 0, ok: 0 }, victory = { n: 0, ok: 0 };
      for (let k = 0; k < SEEDS_Q; k++) {
        const seed = 'q-' + k, st = newGame(seed);
        for (let j = 0; j < 3; j++) intent(st, { t: 'party', op: 'add' });
        intent(st, { t: 'jump', site: 'S2' });
        const cave = st.maps.S2;
        for (let g = 0; g < 40 && !inSight(st, cave).length; g++) if (!toFoe(st, cave)) break;
        for (let fight = 0; fight < 12 && !st.over && st.here === 'S2'; fight++) {
          if (!inSight(st, cave).length) { if (!toFoe(st, cave) || !inSight(st, cave).length) break; }
          const s = intent(st, { t: 'rounds', op: 'start' }); if (!s.ok) break;
          T.fights++;
          inv('fresh', st.round.act === 1 && st.round.bonus === 1 && st.round.extra === 0 && st.round.had && st.round.order.filter((c) => c.k === 'foe').every((c) => !!st.npcs[cave.tokens.find((q) => q.id === c.id).npc].sheet), seed + ' a fresh round');
          let ended = null, guard = 0, lastKey = '', same = 0;
          while (st.round && !ended && guard++ < 3000) {
            const a = turnOf(st), R = st.round;
            inv('acts', !!a && (a.pc ? a.o.status === 'ok' : !sheetOf(st, a.o, false).asleep), seed + ' ' + (a ? a.id : 'nobody') + ' acts');
            if (!a) break;
            const it = a.pc ? pcPlan(st) : (foePlan(st) || { t: 'end' });
            if (!a.pc) { if (it.t === 'end') T.foeTurns++; else T.foeDeeds++; }
            const key = a.id + JSON.stringify(it) + R.n; same = key === lastKey ? same + 1 : 0; lastKey = key;
            if (same > 6) { inv('stall', false, seed + ' ' + key); intent(st, { t: 'end' }); continue; }
            const wasUp = it.t === 'attack' && !a.pc ? (pcOf(st, it.target) || {}).status === 'ok' : true;
            if (!a.pc && it.t === 'dash') T.dashes++;
            const res = intent(st, Object.assign({ who: a.id }, it));
            if (!res.ok) { inv(a.pc ? 'plan' : 'script', false, seed + ' ' + JSON.stringify(it) + ' ' + res.why); intent(st, { t: 'end' }); continue; }
            if (it.t === 'move') inv('walks', walk(st, a.id).ok, seed + ' a planned move walks');
            if (it.t === 'attack') {
              T.swings++; if (res.hit) T.hits++;
              inv('hitRule', res.natural === 1 ? !res.hit : res.natural === 20 ? res.hit && res.crit : res.hit === (res.total >= res.ac), seed + ' ' + res.say);
              inv('dmg', res.hit ? res.dmg >= 1 : res.dmg === 0, seed + ' ' + res.say);
              if (res.fell && a.pc) inv('fallen', !cave.tokens.some((t) => t.id === res.target) && !(st.round && st.round.order.some((c) => c.id === res.target)) && !(st.met.S2 || []).includes(res.target), seed + ' the fallen leave');
              if (!a.pc) { inv('mercy', wasUp, seed + ' ' + res.say); if (cheb(a.o, { x: res.at[0], y: res.at[1] }) > 1) T.shots++; }
            }
            ended = res.ended || null;
            const sq = new Set(); let clash = false;
            for (const p of st.party) { if (p.site !== st.here) continue; const q = p.x + ',' + p.y; if (sq.has(q)) clash = true; sq.add(q); inv('hp', p.hp >= 0 && p.hp <= p.hpMax && ((p.hp > 0) === (p.status === 'ok')), seed + ' ' + p.name + ' ' + p.hp + ' ' + p.status); }
            for (const t of st.maps[st.here].tokens) { const q = t.x + ',' + t.y; if (sq.has(q)) clash = true; sq.add(q); inv('index', tokenAt(st.maps[st.here], t.x, t.y) === t, seed + ' the board knows where ' + t.id + ' stands'); }
            inv('squares', !clash, seed + ' after ' + a.id + ' ' + JSON.stringify(it));
            if (st.round) inv('spend', st.round.act >= 0 && st.round.bonus >= 0 && moveLeft(st.round) >= 0, seed + ' overspent');
          }
          inv('ends', guard < 3000 && (!!ended || !st.round), seed + ' the fight ends');
          if (ended) {
            inv('outcome', ['victory', 'defeat'].includes(ended.outcome) && !st.round && endedSay(ended).length > 10, seed + ' ' + ended.outcome);
            if (ended.outcome === 'victory') { T.won++; victory.n++; if (ended.xp > 0 && ended.each === Math.floor(ended.xp / st.party.length) && st.party.every((p) => p.status === 'ok' || p.status === 'stable')) victory.ok++; }
            else { T.lost++; if (ended.over) T.over++; else { rescue.n++; if (ended.rescued && st.here === 'S1' && st.party.every((p) => p.hp === 1 && p.status === 'ok') && st.time.minute === 480) rescue.ok++; } }
          }
          if (!st.over && st.here === 'S2') { const r = intent(st, { t: 'rest', kind: 'short' }); if (r.ok === inSight(st, cave).length > 0) restOK = false; }
        }
        if (!st.over && snap(st) !== snap(unpackState(JSON.parse(JSON.stringify(packState(st)))))) trip = false;
      }
      const badKeys = Object.keys(T.bad);
      row(T.fights >= SEEDS_Q * 2 && T.swings > 200, 'fights were fought: ' + T.fights + ' over ' + SEEDS_Q + ' worlds, ' + T.swings + ' blows, ' + T.won + ' won and ' + T.lost + ' lost by a party of four played by the suite');
      for (const [k, m] of [['acts', 'whoever acts can act: nobody down, dead or asleep is ever handed a turn'], ['hitRule', 'a blow lands exactly when its total meets the armour class; a natural 1 never, a natural 20 always and as a critical'], ['dmg', 'a hit does at least 1, a miss does nothing'],
        ['fallen', 'a monster that falls leaves the board, the order and the list of those met'], ['squares', 'nobody ever shares a square when a deed is done'], ['index', 'the board\'s lookup knows where every monster stands, after monsters have passed through one another'],
        ['hp', 'hit points stay within bounds, and standing is exactly having some'], ['spend', 'no turn overspends its movement, its action or its bonus action'], ['script', 'the monsters\' script never asks for anything the engine refuses'], ['stall', 'no turn goes round in circles'],
        ['walks', 'a move the script planned can be walked'], ['ends', 'every fight ends'], ['outcome', 'in a victory or a defeat, which can be told'], ['fresh', 'a round opens with one action, one bonus action, and a block for every monster in it'], ['mercy', 'the script never strikes the fallen: every blow of a monster\'s is at a traveller still standing'], ['plan', 'the suite\'s own traveller never asks for anything refused (so the rows above are about the engine)']])
        row(!T.bad[k], m + (T.bad[k] ? ' (' + T.bad[k] + ' times; first: ' + T.first[k] + ')' : ''));
      row(badKeys.every((k) => ['acts', 'hitRule', 'dmg', 'fallen', 'squares', 'index', 'hp', 'spend', 'script', 'stall', 'walks', 'ends', 'outcome', 'fresh', 'mercy', 'plan'].includes(k)), 'no invariant went unreported');
      row(T.dashes > 0 && T.shots > 0, 'a monster too far to strike runs for it (' + T.dashes + ' dashes), and one with a bow shoots from where it stands (' + T.shots + ' shots)');
      row(T.foeDeeds > T.fights * 2 && T.hits > T.swings * .3 && T.hits < T.swings * .75, 'the script does things with its turns (' + T.foeDeeds + ' deeds), and about half of all blows land (' + T.hits + ' of ' + T.swings + ')');
      row(victory.n > 5 && victory.ok === victory.n, 'a victory shares the experience among the living, and tends the dying (' + victory.ok + ' of ' + victory.n + ')');
      row(rescue.ok === rescue.n && T.over <= T.lost, 'a party beaten but breathing wakes at the inn at eight, each with 1 hit point (' + rescue.ok + ' of ' + rescue.n + ' defeats; ' + T.over + ' tales ended)');
      row(restOK, 'a rest is refused exactly when an enemy is in sight');
      row(trip, 'after the fighting a save still round-trips byte for byte, in every world');

      /* 3. the same tale fights the same fight */
      {
        const run = () => { const st = newGame('det-1'); intent(st, { t: 'party', op: 'add' }); intent(st, { t: 'jump', site: 'S2' }); const cave = st.maps.S2; for (let g = 0; g < 30 && !inSight(st, cave).length; g++) if (!toFoe(st, cave)) break;
          intent(st, { t: 'rounds', op: 'start' }); let g = 0; while (st.round && g++ < 600) { const a = turnOf(st), it = a.pc ? pcPlan(st) : foePlan(st), r = intent(st, it); if (r.ok && it.t === 'move') walk(st, a.id); if (!r.ok) intent(st, { t: 'end' }); } return snap(st).replace(/"made":\d+/, ''); };
        const a = run(), b = run();
        row(a === b && /"t":"tell"/.test(a), 'the same seed fights the same fight, blow for blow, and the journal tells it');
      }

      /* 4. reach, sight and cover, on ground chosen for it */
      {
        const st = newGame('reach-1'), inn = st.maps.S1;
        const d = inn.doors.find((q) => !q.ext && !q.lock), sd = doorSides(d);
        d.open = false; const shut = meleeClear(inn, sd[0][0], sd[0][1], sd[1][0], sd[1][1]), los0 = reachWhy(inn, { x: sd[0][0], y: sd[0][1] }, { x: sd[1][0], y: sd[1][1] }, 12);
        d.open = true; const open = meleeClear(inn, sd[0][0], sd[0][1], sd[1][0], sd[1][1]), los1 = reachWhy(inn, { x: sd[0][0], y: sd[0][1] }, { x: sd[1][0], y: sd[1][1] }, 12);
        row(!shut && open && los0 === 'nosight' && los1 === '', 'a shut door stops a blade and a shot alike; open, it stops neither');
        /* a wall between two squares side by side: no blade passes, whichever way */
        let wall = null; for (let y = 1; y < inn.h - 1 && !wall; y++) for (let x = 1; x < inn.w - 1 && !wall; x++) if (eGet(inn, x, y, 1) === ED.WALL && tileFree(inn, x, y) && tileFree(inn, x + 1, y)) wall = [x, y];
        row(wall && !meleeClear(inn, wall[0], wall[1], wall[0] + 1, wall[1]) && !meleeClear(inn, wall[0] + 1, wall[1], wall[0], wall[1]) && reachWhy(inn, { x: wall[0], y: wall[1] }, { x: wall[0] + 1, y: wall[1] }, 1) === 'reach', 'a wall between two neighbours is out of a blade\'s reach, from either side');
        row(!meleeClear(inn, 3, 3, 5, 3) && !meleeClear(inn, 3, 3, 3, 3), 'a blade reaches the squares next to it and no further');
        /* cover: someone standing on the line of a shot */
        const town = st.maps.S0; let lane = null;
        for (let y = 2; y < town.h - 2 && !lane; y++) for (let x = 2; x < town.w - 8 && !lane; x++) { let free = true; for (let i = 0; i < 7; i++) if (!tileFree(town, x + i, y) || tokenAt(town, x + i, y) || town._.occ[y * town.w + x + i] >= 0) free = false; if (free) lane = [x, y]; }
        const none = coverOn(st, town, lane[0], lane[1], lane[0] + 6, lane[1]);
        st.party[0].site = 'S0'; st.party[0].x = lane[0] + 3; st.party[0].y = lane[1];
        const some = coverOn(st, town, lane[0], lane[1], lane[0] + 6, lane[1]), beside = coverOn(st, town, lane[0], lane[1], lane[0] + 3, lane[1]);
        row(lane && !none && some && !beside, 'someone standing on the line of a shot is cover; the shooter and the target themselves are not');
      }

      /* 5. tricks, one by one, in a fight arranged for them */
      {
        const st = newGame('abil-1'); for (let j = 0; j < 5; j++) intent(st, { t: 'party', op: 'add' });
        const by = (c) => st.party.find((p) => p.cls === c), F = by('Fighter'), Rg = by('Rogue'), C = by('Cleric'), Wz = by('Wizard'), Rn = by('Ranger'), Bd = by('Bard');
        intent(st, { t: 'jump', site: 'S2' }); const m = st.maps.S2;
        /* the ground is arranged by hand: the fighter and a bandit side by side in a chamber, the rest of the party and a second bandit close by */
        const foes = m.tokens.filter((t) => t.k === 'foe'), tok = foes[0], tok2 = foes[1];
        let pair = null; for (let i = 0; i < m.w * m.h && !pair; i++) { const x = i % m.w, y = (i - x) / m.w; if (m.rg[i] && tileFree(m, x, y) && tileFree(m, x + 1, y) && !taken(st, m, x, y, '') && !taken(st, m, x + 1, y, '') && meleeClear(m, x, y, x + 1, y) && [[0, 1], [0, -1], [1, 1], [1, -1]].filter((s) => tileFree(m, x + s[0], y + s[1])).length >= 3) pair = [x, y]; }
        F.x = pair[0]; F.y = pair[1]; moveToken(m, tok, pair[0] + 1, pair[1]);
        for (const p of st.party) if (p !== F) { const f = freeNear(st, m, F.x, F.y, p.id); p.x = f[0]; p.y = f[1]; }
        { const f = freeNear(st, m, tok.x, tok.y, 'x'); moveToken(m, tok2, f[0], f[1]); }
        look(st);
        const n0 = st.n.roll, V0 = visOf(st).g, rollers = st.party.map((p) => [p.id, abMod(p.scores.dex)]).concat(m.tokens.filter((t) => t.k === 'foe' && V0[t.y * m.w + t.x]).map((t) => [t.id, BESTIARY[tplOf(st.npcs[t.npc])].dex]));
        const s = intent(st, { t: 'rounds', op: 'start' });
        const exact = rollers.every((q, k) => { const c = st.round.order.find((x) => x.id === q[0]); return c && c.roll === 1 + Math.floor(rngFor(st.seed, 'dice', n0 + k)() * 20) + q[1]; });
        row(s.ok && st.round.order.some((c) => c.id === tok.id) && st.round.order.length === rollers.length && exact && rollers.some((q) => q[1] !== 0), 'initiative is the tale\'s own die plus dexterity, for travellers and monsters alike: ' + st.round.order.map((c) => c.roll).join(' '));
        const to = (id) => { for (let g = 0; g < 80 && st.round && turnOf(st).id !== id; g++) intent(st, { t: 'end' }); return !!st.round && turnOf(st).id === id; };
        const big = (t) => { const S2 = sheetOf(st, t, true); S2.hpMax = 400; S2.hp = 400; };     /* a punching bag: the tricks are under test, not the bandit */
        big(tok); big(tok2);
        for (const p of st.party) { p.hpMax = 300; p.hp = 300; }
        row(to(F.id), 'the turn comes round to the fighter');
        F.hp = 3;
        { const r = intent(st, { t: 'ability', name: 'Second Wind' });
          row(r.ok && r.heal >= 2 && r.heal <= 11 && F.hp === 3 + r.heal && st.round.bonus === 0 && st.round.act === 1 && F.abilities[0].uses === 0, 'Second Wind heals 1d10+1 for the bonus action, and leaves the action');
          row(intent(st, { t: 'ability', name: 'Second Wind' }).why === 'nouses', 'and cannot be used twice before a rest');
          const before = snap(st), far = intent(st, { t: 'attack', target: 'K999' }), friend = intent(st, { t: 'attack', target: Rg.id });
          row(far.why === 'notarget' && friend.why === 'friend' && snap(st) === before, 'a blow at nobody, or at a friend, is refused and changes nothing');
          const a1 = intent(st, { t: 'attack', target: tok.id });
          row(a1.ok && a1.attack === 'Longsword' && st.round.act === 0, 'the fighter beside a bandit strikes with the blade, and the action is spent: ' + (a1.say || a1.why));
          const b2 = snap(st);
          row(intent(st, { t: 'attack', target: tok.id }).why === 'noact' && intent(st, { t: 'dash' }).why === 'noact' && snap(st) === b2, 'one action a turn: a second blow or a dash is refused, and changes nothing');
          const sg = intent(st, { t: 'ability', name: 'Action Surge' });
          row(sg.ok && st.round.act === 1 && intent(st, { t: 'attack', target: tok.id, attack: 'longsw' }).ok && st.round.act === 0, 'Action Surge gives one more action, and a weapon can be named by part of its name');
          row(intent(st, { t: 'attack', target: tok.id, attack: 'Halberd' }).why === 'noact', 'and that one is spent too'); }
        row(to(Wz.id), 'the turn comes round to the wizard');
        { const hp0 = sheetOf(st, tok, false).hp, r = intent(st, { t: 'ability', name: 'Magic Missile', target: tok.id });
          row(r.ok && r.dmg >= 6 && r.dmg <= 15 && sheetOf(st, tok, false).hp === hp0 - r.dmg && Wz.abilities.find((x) => x.n === 'Magic Missile').uses === 1 && st.round.act === 0, 'Magic Missile: 3d4+3, no roll to hit, one use and the action spent');
          const r2 = intent(st, { t: 'ability', name: 'Shield' });
          row(r2.ok && Wz.conditions.includes('shielded') && acOf(Wz) === Wz.ac + 5 && st.round.bonus === 0, 'Shield: +5 armour class for the bonus action');
          row(intent(st, { t: 'ability', name: 'Magic Missile', target: F.id }).why === 'noact', 'no action left for another spell'); }
        row(to(Bd.id) && Wz.conditions.includes('shielded'), 'the turn comes round to the bard, and the wizard\'s shield is still up');
        { const r = intent(st, { t: 'ability', name: 'Bardic Inspiration', target: F.id });
          row(r.ok ? F.conditions.includes('inspired') && st.round.bonus === 0 : ['reach', 'nosight'].includes(r.why), 'Bardic Inspiration goes to a friend within reach of the voice: ' + (r.say || r.why));
          st.round.bonus = 1;
          row(intent(st, { t: 'ability', name: 'Bardic Inspiration', target: Bd.id }).why === 'notself' && intent(st, { t: 'ability', name: 'Bardic Inspiration', target: tok.id }).why === 'notarget' && intent(st, { t: 'ability', name: 'Bardic Inspiration' }).why === 'notarget' && st.round.bonus === 1, 'never to oneself, never to an enemy, never to nobody');
          st.round.bonus = 0;
          const b = snap(st);
          row(intent(st, { t: 'ability', name: 'Healing Word', target: F.id }).why === 'nobonus' && intent(st, { t: 'ability', name: 'Bardic Inspiration', target: F.id }).why === 'nobonus' && snap(st) === b, 'one bonus action a turn: a second word of power is refused, and changes nothing'); }
        row(to(C.id), 'the turn comes round to the cleric');
        { const r = intent(st, { t: 'ability', name: 'Bless' });
          row(r.ok && r.blessed.length === 3 && r.blessed.includes(C.id) && st.round.act === 0 && r.blessed.every((id) => pcOf(st, id).conditions.includes('blessed')), 'Bless: the cleric and the two nearest add 1d4 to their attacks'); }
        row(to(Rn.id), 'the turn comes round to the ranger');
        { const r = intent(st, { t: 'ability', name: 'hunter', target: tok.id });
          row(r.ok ? Rn.mark === tok.id && st.round.bonus === 0 : ['reach', 'nosight'].includes(r.why), 'Hunter\'s Mark, named by part of its name: ' + (r.say || r.why));
          let marked = null; for (let g = 0; g < 40 && !marked && r.ok; g++) { st.round.act = 1; const a = intent(st, { t: 'attack', target: tok.id }); if (a.ok && a.hit) marked = a; }
          row(!r.ok || (marked && marked.mark >= 1 && marked.mark <= 12), 'a hit on the quarry carries 1d6 more'); }
        row(to(Rg.id), 'the turn comes round to the rogue');
        { const r = intent(st, { t: 'ability', name: 'Cunning Action' });
          row(r.ok && moveLeft(st.round) === 60 && st.round.bonus === 0 && st.round.act === 1, 'Cunning Action: 30 ft more for the bonus action');
          row(intent(st, { t: 'ability', name: 'Sneak Attack' }).why === 'passive', 'Sneak Attack is not something one does');
          const d = intent(st, { t: 'dash' });
          row(d.ok && moveLeft(st.round) === 90 && st.round.act === 0, 'and a dash on top of it: 90 ft in the turn');
          /* sneak attack: with a friend beside the target, once a turn */
          const spot = freeNear(st, m, tok.x, tok.y, Rg.id); Rg.x = spot[0]; Rg.y = spot[1]; const spot2 = freeNear(st, m, tok.x, tok.y, F.id); F.x = spot2[0]; F.y = spot2[1]; look(st);
          const flank = meleeClear(m, Rg.x, Rg.y, tok.x, tok.y) && meleeClear(m, F.x, F.y, tok.x, tok.y);
          let first = null, second = null;
          for (let g = 0; g < 60 && !first && flank; g++) { st.round.act = 1; st.round.sneak = false; const a = intent(st, { t: 'attack', target: tok.id, attack: 'Rapier' }); if (a.ok && a.hit) first = a; }
          for (let g = 0; g < 60 && !second && first; g++) { st.round.act = 1; const a = intent(st, { t: 'attack', target: tok.id, attack: 'Rapier' }); if (a.ok && a.hit) second = a; }
          row(flank && first && first.sneak >= 1 && second && !second.sneak, 'a rogue\'s hit on a foe a friend stands beside is a sneak attack, once a turn and no more'); }
        /* sleep: the weakest first, and a blow wakes them */
        row(to(Wz.id) && !Wz.conditions.includes('shielded') && acOf(Wz) === Wz.ac, 'the turn comes round to the wizard again, and the shield is down: it lasts until their next turn');
        { sheetOf(st, tok, true).hp = 5; sheetOf(st, tok2, true).hp = 399; const near = cheb(tok, tok2) <= 4;
          const r = intent(st, { t: 'ability', name: 'Sleep', target: tok.id });
          row(r.ok ? r.slept.includes(tok.id) && !r.slept.includes(tok2.id) && sheetOf(st, tok, false).asleep > st.round.n : ['reach', 'nosight'].includes(r.why), 'Sleep takes the weakest within 20 ft and leaves the strong awake' + (near ? '' : ' (the second bandit stood apart)') + ': ' + (r.say || r.why));
          if (r.ok) { let skipped = false; for (let g = 0; g < 14 && st.round; g++) { const e = intent(st, { t: 'end' }); if ((e.events || []).some((x) => x.k === 'sleep' && x.who === tok.id)) skipped = true; if (st.round && turnOf(st).id === tok.id) { skipped = false; break; } if (skipped) break; }
            row(skipped, 'a sleeper is passed over when its turn comes');
            to(F.id); let woke = null; for (let g = 0; g < 40 && !woke; g++) { st.round.act = 1; const a = intent(st, { t: 'attack', target: tok.id }); if (a.ok) woke = a; }
            row(woke && woke.mode === 'advantage' && (!woke.hit || sheetOf(st, tok, false).asleep === 0), 'a blow at a sleeper has advantage, and a hit wakes it'); } }
        if (st.round) { const e = intent(st, { t: 'rounds', op: 'stop' });
          row(e.ok && e.ended.outcome === 'stop' && !st.round && !Wz.conditions.includes('shielded') && !F.conditions.includes('inspired') && !C.conditions.includes('blessed'), 'standing down ends what lasts a fight: the shield, the blessing, the inspiration'); }
        for (const t of [tok, tok2]) dropToken(st, m, t);
        look(st);
        F.hp = 2; const cure = intent(st, { t: 'ability', who: C.id, name: 'Cure Wounds', target: F.id });
        row(cure.ok && F.hp > 2 && C.abilities.find((x) => x.n === 'Cure Wounds').uses === 1, 'outside a fight a healer\'s hands still work, with nobody\'s turn asked: ' + (cure.say || cure.why));
        row(intent(st, { t: 'ability', who: Wz.id, name: 'Magic Missile', target: 'K0' }).why === 'noround' && intent(st, { t: 'ability', who: Rg.id, name: 'Cunning Action' }).why === 'noround', 'a fighting trick outside a fight is refused');
        intent(st, { t: 'jump', site: 'S0' });
        const lr = intent(st, { t: 'rest', kind: 'long' });
        row(lr.ok && st.party.every((p) => p.hp === p.hpMax && p.abilities.every((a) => a.max === null || a.uses === a.max)), 'a night\'s sleep restores every hit point and every ability');
      }

      /* 6. dying */
      {
        const st = newGame('dying-1'); intent(st, { t: 'party', op: 'add' }); intent(st, { t: 'jump', site: 'S2' });
        const m = st.maps.S2, P1 = st.party[0], tok = m.tokens.find((t) => t.k === 'foe'), spot = freeNear(st, m, P1.x, P1.y - 1, 'x'); moveToken(m, tok, spot[0], spot[1]); look(st);
        intent(st, { t: 'rounds', op: 'start' });
        if (turnOf(st).id === P1.id) intent(st, { t: 'end' });
        P1.hp = 0; P1.status = 'down'; P1.saves = { s: 0, f: 0 };
        let saves = 0, acted = false, told = true;
        for (let g = 0; g < 80 && st.round && P1.status === 'down'; g++) { if (turnOf(st).id === P1.id) acted = true; const r = intent(st, { t: 'end' }); for (const e of r.events || []) if (e.k === 'death') { saves++; if (!(e.roll >= 1 && e.roll <= 20 && /fights for life/.test(e.say))) told = false; } }
        row(saves >= 1 && !acted && told, 'the dying roll against death when their turn comes, and are passed over (' + saves + ' rolls)');
        row(['dead', 'stable', 'ok'].includes(P1.status) || !st.round, 'three one way or the other settles it: ' + P1.status);
        /* a blow at the fallen: an automatic step toward death; massive damage kills outright */
        const p = newPc('PX', 'Test', 'S2', 0, 0, 'Wizard', false); hurtPC(p, p.hpMax, false); const down = p.status; hurtPC(p, 1, false); const f1 = p.saves.f; hurtPC(p, 1, true); const f3 = p.saves.f, dead = p.status;
        const q = newPc('PY', 'Test', 'S2', 0, 0, 'Wizard', false); hurtPC(q, q.hpMax * 2, false);
        row(down === 'down' && f1 === 1 && f3 === 3 && dead === 'dead' && q.status === 'dead', 'at 0 a traveller is down; each blow after is a failed save, a critical two; twice their hit points at once is death');
        const h = newPc('PZ', 'Test', 'S2', 0, 0, 'Wizard', false); hurtPC(h, h.hpMax, false); const got = healPC(h, 4);
        row(h.status === 'ok' && h.hp === 4 && got === 4 && h.saves.f === 0, 'any healing puts the fallen back on their feet');
        /* nobody standing: defeat */
        if (st.round) { for (const x of st.party) if (x.status === 'ok') { x.hp = 0; x.status = 'down'; x.saves = { s: 0, f: 0 }; } const r = intent(st, { t: 'end' });
          row(r.ended && r.ended.outcome === 'defeat' && !st.round && (st.over === 'dead' ? st.party.every((x) => x.status === 'dead') : st.here === 'S1' && st.party.every((x) => x.hp === 1 && x.status === 'ok') && st.gold === Math.floor((15 + 20) / 2)), 'with nobody standing the fight is lost: the living wake at the inn, half their gold gone'); }
        /* everyone dead: the tale is over, and says so */
        const st2 = newGame('dying-2'); intent(st2, { t: 'jump', site: 'S2' }); const m2 = st2.maps.S2, t2 = m2.tokens.find((t) => t.k === 'foe'), s2 = freeNear(st2, m2, st2.party[0].x, st2.party[0].y - 1, 'x'); moveToken(m2, t2, s2[0], s2[1]); look(st2);
        intent(st2, { t: 'rounds', op: 'start' }); st2.party[0].hp = 0; st2.party[0].status = 'dead'; const e2 = intent(st2, { t: 'end' });
        row(e2.ended && e2.ended.over && st2.over === 'dead' && intent(st2, { t: 'jump', site: 'S0' }).why === 'over' && intent(st2, { t: 'party', op: 'add' }).why === 'over', 'with nobody alive the tale is over, and every intent after says so');
        const st3 = unpackState(JSON.parse(JSON.stringify(packState(st2))));
        row(st3.over === 'dead' && !st3.round, 'and it is still over after a save');
      }

      /* 7. the token lookup when monsters pass through one another (found by step 3's fights: a monster left behind vanished from the lookup) */
      {
        const st = newGame('index-1'); chart(st, 'S2'); const m = st.maps.S2, foes = m.tokens.filter((t) => t.k === 'foe'), A2 = foes[0], B2 = foes[1], home = [A2.x, A2.y];
        moveToken(m, A2, B2.x, B2.y); const shared = tokenAt(m, B2.x, B2.y) === A2;
        const on = freeNear(st, m, B2.x, B2.y, 'x'); moveToken(m, A2, on[0], on[1]);
        row(shared && tokenAt(m, B2.x, B2.y) === B2 && tokenAt(m, on[0], on[1]) === A2 && tokenAt(m, home[0], home[1]) === null, 'a monster that steps through another leaves it findable on its own square');
      }

      /* 8. old saves and hostile files */
      {
        const st = newGame('old-1'); intent(st, { t: 'party', op: 'add' }); intent(st, { t: 'party', op: 'add' });
        const v2 = JSON.parse(JSON.stringify(packState(st))); v2.v = 2;
        for (const k of ['time', 'gold', 'facts', 'summaries', 'quests', 'story', 'costs', 'turn', 'told', 'fallen', 'over']) delete v2[k];
        v2.party = v2.party.map((p) => ({ id: p.id, name: p.name, site: p.site, x: p.x, y: p.y })); delete v2.n.f; delete v2.n.Q;
        let o = null; try { o = unpackState(v2); } catch (e) { o = null; }
        row(o && o.v === 3 && o.party.map((p) => p.cls).join() === 'Fighter,Rogue,Cleric' && o.party.every((p) => p.hp === p.hpMax && p.stock && p.status === 'ok') && o.gold === 50 && o.time.minute === 480 && o.quests.Q0 && o.quests.Q0.status === 'active' && Array.isArray(o.story) && o.turn === 0,
          'a tale saved before there were sheets loads: each traveller is given a calling by their place in the party, a full sheet, and the tale a purse, a clock and its quest');
        const evil = JSON.parse(JSON.stringify(packState(st)));
        Object.assign(evil.party[0], { cls: 'God', level: 99, hp: 99999, hpMax: 99999, ac: 99 });
        Object.assign(evil.party[1], { level: 99, xp: -5, hp: 99999, hpMax: 5000, ac: 99, status: 'ascended', conditions: ['flying', 'blessed', 'blessed'], scores: { str: 500, dex: -3 }, items: [{ n: '<img src=x onerror=1>', q: 1e9 }, { n: '', q: 1 }, null], abilities: [{ n: 'Sneak Attack', uses: 50 }, { n: 'Wish', uses: 9 }], saves: { s: 9, f: -2 }, mark: '<script>' });
        Object.assign(evil.party[2], { hp: 0, status: 'ok', abilities: [{ n: 'Cure Wounds', uses: 99 }] });
        evil.gold = -50; evil.time = { day: -3, minute: 99999 }; evil.turn = 'x'; evil.over = 'dead';
        evil.story = [{ t: 'gm', text: 'x'.repeat(9000) }, { t: 'evil', text: 'no' }, { t: 'pl', text: 5 }, null, { t: 'chip', text: 'ok', k: '<b>' }];
        evil.costs = [{ usd: 'lots' }, null, { usd: 2, kind: 'bribe', calls: -4, tok: { in: 'a' } }]; evil.facts = [{ text: 'f'.repeat(999), subject: 'x'.repeat(99) }, { text: 3 }];
        evil.quests = { Q0: { title: 7, status: 'won' }, '__proto__': { title: 'x' }, QQ: { title: 'no' } }; evil.told = { '<x>': 1, open: 1 }; evil.fallen = [{ name: 'A', cls: 'God', level: 50 }];
        evil.npcs.N5.sheet = { tpl: 'tarrasque', hp: 99999, hpMax: 99999, ac: 99, atk: [['doom', 99, '99d99', 99]] }; evil.npcs.N5.status = 'immortal';
        let e = null; try { e = unpackState(evil); } catch (x) { e = String(x); }
        const p0 = e && e.party && e.party[0], p1 = e && e.party && e.party[1], p2 = e && e.party && e.party[2];
        row(p0 && p0.cls === 'Fighter' && p0.level === 1 && p0.hp === 12 && p0.ac === 16, 'a file naming a calling that does not exist gets an honest level 1 sheet, whatever else it claimed');
        row(p1 && p1.level === 5 && p1.xp === 0 && p1.hpMax === 999 && p1.hp === 999 && p1.ac === 30 && p1.status === 'ok' && p1.conditions.join() === 'blessed' && p1.scores.str === 30 && p1.scores.dex === 1 && p1.items.length === 1 && p1.items[0].q === 999 && p1.items[0].n.startsWith('<img') && p1.saves.s === 3 && p1.saves.f === 0 && p1.mark === '' && p1.abilities.map((a) => a.n).join() === 'Sneak Attack,Cunning Action' && p1.abilities.every((a) => a.uses === null),
          'a tampered sheet is bounded: level 5 at most, every number in range, only real conditions, and the abilities are the calling\'s own');
        row(p2 && p2.hp === 0 && p2.status === 'stable' && p2.abilities.find((a) => a.n === 'Cure Wounds').uses === 2, 'nobody stands at 0 hit points, and nobody has more uses than their calling gives');
        row(e && e.gold === 0 && e.time.day === 1 && e.time.minute === 1439 && e.turn === 0 && e.over === '' && e.story.length === 2 && e.story[0].text.length === 6000 && e.story[1].k === '<b>' && e.costs.length === 1 && e.costs[0].kind === 'gm' && e.costs[0].calls === 0 && e.facts.length === 1 && e.facts[0].text.length === 280 && e.facts[0].subject.length <= 12 &&
          Object.keys(e.quests).join() === 'Q0' && e.quests.Q0.status === 'active' && e.quests.Q0.title === 'A task' && Object.keys(e.told).join() === 'open' && e.fallen[0].cls === 'Fighter' && e.fallen[0].level === 5,
          'the purse, the clock, the story, the ledger, the facts and the quests out of a hostile file are all bounded and plain');
        { const ev2 = JSON.parse(JSON.stringify(packState(st))); Object.assign(ev2.party[1], { hp: 5, status: 'down', saves: { s: 2, f: 2 } }); Object.assign(ev2.party[2], { hp: 3, status: 'dead' }); ev2.over = 'dead'; ev2.v = 99;
          let newer = ''; try { unpackState(ev2); } catch (x) { newer = String(x.message); }
          ev2.v = 3; let e2 = null; try { e2 = unpackState(ev2); } catch (x) { e2 = null; }
          row(/newer version/.test(newer), 'a tale saved by a newer version of the game is refused, in words');
          row(e2 && e2.party[1].status === 'ok' && e2.party[1].hp === 5 && e2.party[2].status === 'dead' && e2.over === '', 'a file cannot leave someone lying down with hit points in hand, nor end a tale whose travellers still live'); }
        row(e && e.npcs.N5.sheet.tpl === 'bandit captain' && e.npcs.N5.sheet.hpMax === 400 && e.npcs.N5.sheet.hp === 400 && e.npcs.N5.sheet.ac === 25 && !('atk' in e.npcs.N5.sheet) && e.npcs.N5.status === 'alive' && foeWeapons(e.npcs.N5.sheet)[0].n === 'scimitar', 'a monster\'s block out of a file keeps bounded numbers and nothing else: its attacks are always the template\'s own');
      }

      /* 9. the rules a lucky run does not reach. The tale's dice are counted, so the count can be set where a wanted number comes up next. */
      {
        const force = (st, die, v) => { for (let n = st.n.roll; n < st.n.roll + 4000; n++) if (1 + Math.floor(rngFor(st.seed, 'dice', n)() * die) === v) { st.n.roll = n; return true; } return false; };
        const st = newGame('edge-1'); for (let j = 0; j < 5; j++) intent(st, { t: 'party', op: 'add' });
        const by = (c) => st.party.find((p) => p.cls === c), F = by('Fighter'), Rg = by('Rogue'), C = by('Cleric'), Wz = by('Wizard'), Rn = by('Ranger'), Bd = by('Bard');
        intent(st, { t: 'jump', site: 'S2' }); const m = st.maps.S2;
        const foes = m.tokens.filter((t) => t.k === 'foe'), tok = foes[0], tok2 = foes[1];
        let pair = null; for (let i = 0; i < m.w * m.h && !pair; i++) { const x = i % m.w, y = (i - x) / m.w; if (m.rg[i] && tileFree(m, x, y) && tileFree(m, x + 1, y) && !taken(st, m, x, y, '') && !taken(st, m, x + 1, y, '') && meleeClear(m, x, y, x + 1, y) && [[0, 1], [0, -1], [1, 1], [1, -1]].filter((s) => tileFree(m, x + s[0], y + s[1])).length >= 3) pair = [x, y]; }
        F.x = pair[0]; F.y = pair[1]; moveToken(m, tok, pair[0] + 1, pair[1]);
        for (const p of st.party) if (p !== F) { const f = freeNear(st, m, F.x, F.y, p.id); p.x = f[0]; p.y = f[1]; }
        { const f = freeNear(st, m, tok.x, tok.y, 'x'); moveToken(m, tok2, f[0], f[1]); }
        look(st);
        const b0 = snap(st);
        row(intent(st, { t: 'rest', kind: 'short' }).why === 'unsafe' && intent(st, { t: 'rest', kind: 'long' }).why === 'unsafe' && snap(st) === b0, 'no rest, short or long, with an enemy in sight');
        row(foePlan(st) === null, 'the monsters\' script plays nobody while no rounds are counted');
        intent(st, { t: 'rounds', op: 'start' });
        const to = (id) => { for (let g = 0; g < 80 && st.round && turnOf(st).id !== id; g++) intent(st, { t: 'end' }); return !!st.round && turnOf(st).id === id; };
        const S1 = sheetOf(st, tok, true), S2 = sheetOf(st, tok2, true), blow = (o) => { st.round.act = 1; return intent(st, Object.assign({ t: 'attack', target: tok.id, attack: 'Longsword' }, o || {})); };
        S1.hpMax = S1.hp = 400; S2.hpMax = S2.hp = 400;
        for (const p of st.party) { p.hpMax = 300; p.hp = 300; }
        row(to(F.id) && foePlan(st) === null, 'nor ever a traveller: on a traveller\'s turn it has no plan');
        const b1 = snap(st);
        row(intent(st, { t: 'rest', kind: 'long' }).why === 'inround' && snap(st) === b1, 'no rest in the middle of a round');
        row(intent(st, { t: 'attack', target: tok.id, attack: 'Halberd' }).why === 'noweapon' && snap(st) === b1, 'a weapon nobody carries is refused, and the action kept');
        const hitF = weaponsOf(F)[0].hit;
        S1.ac = 2; force(st, 20, 1); const n1 = blow();
        row(n1.ok && n1.natural === 1 && !n1.hit && n1.dmg === 0 && n1.total >= n1.ac, 'a natural 1 misses even when its total beats the armour: ' + n1.say);
        S1.ac = 60; force(st, 20, 20); const n20 = blow();
        row(n20.ok && n20.natural === 20 && n20.hit && n20.crit && n20.total < n20.ac, 'and a natural 20 lands whatever the armour: ' + n20.say);
        S1.ac = 12; F.conditions = ['blessed']; force(st, 20, 10); const bl = blow();
        row(bl.ok && bl.natural === 10 && bl.total >= 10 + hitF + 1 && bl.total <= 10 + hitF + 4 && /bless \+\d/.test(bl.say) && F.conditions.includes('blessed'), 'a blessed blow adds 1d4 to its total, and the blessing stays: ' + bl.say);
        F.conditions = ['inspired']; force(st, 20, 10); const ins = blow();
        row(ins.ok && ins.total >= 10 + hitF + 1 && ins.total <= 10 + hitF + 6 && /inspiration \+\d/.test(ins.say) && !F.conditions.includes('inspired'), 'inspiration adds 1d6 to one blow, and is spent by it: ' + ins.say);
        force(st, 20, 10); const plain = blow();
        row(plain.ok && plain.total === 10 + hitF && plain.rolls.length === 1, 'and the blow after is plain again: the die and the bonus, ' + plain.total);
        const claim = blow({ mode: 'advantage' }), given = blow({ mode: 'advantage', by: 'gm' });
        row(claim.ok && claim.mode === 'normal' && claim.rolls.length === 1 && given.ok && given.mode === 'advantage' && given.rolls.length === 2 && given.natural === Math.max(given.rolls[0], given.rolls[1]), 'advantage is the engine\'s to give: an intent that claims it rolls one die, and only the Game Master\'s word adds a second');
        F.hp = 3; st.round.bonus = 1; force(st, 10, 1); const sw = intent(st, { t: 'ability', name: 'Second Wind' });
        row(sw.ok && sw.heal === 2 && F.hp === 5, 'Second Wind on a 1 heals 2: the die and the fighter\'s level');
        F.hp = 300;
        /* spells aimed at the wrong people */
        row(to(Wz.id), 'the wizard\'s turn');
        { const b = snap(st); tok2.k = 'npc'; const calm = intent(st, { t: 'ability', name: 'Magic Missile', target: tok2.id }); tok2.k = 'foe';
          row(calm.why === 'peace' && intent(st, { t: 'ability', name: 'Magic Missile', target: F.id }).why === 'friend' && intent(st, { t: 'ability', name: 'Magic Missile' }).why === 'notarget' && snap(st) === b, 'Magic Missile is for an enemy: not someone peaceful, not a friend, not nobody'); }
        /* the dead */
        row(to(tok.id), 'the bandit\'s turn');
        { Bd.hp = 0; Bd.status = 'dead'; const b = snap(st), gone = intent(st, { t: 'attack', who: tok.id, target: Bd.id });
          row(gone.why === 'gone' && snap(st) === b, 'nobody strikes the dead'); }
        row(to(C.id), 'the cleric\'s turn');
        { const b = snap(st);
          row(intent(st, { t: 'ability', name: 'Cure Wounds', target: Bd.id }).why === 'gone' && snap(st) === b, 'and no healing reaches them');
          Bd.hp = 300; Bd.status = 'ok';
          /* touch is touch: in a fight a healer must stand beside whoever they mend */
          const spot = []; for (let i = 0; i < m.w * m.h && spot.length < 1; i++) { const x = i % m.w, y = (i - x) / m.w; if (tileFree(m, x, y) && !taken(st, m, x, y, '') && Math.max(Math.abs(x - C.x), Math.abs(y - C.y)) === 3 && visOf(st).g[i]) spot.push([x, y]); }
          const was = [Rn.x, Rn.y]; if (spot.length) { Rn.x = spot[0][0]; Rn.y = spot[0][1]; } Rn.hp = 100;
          const b3 = snap(st), far = intent(st, { t: 'ability', name: 'Cure Wounds', target: Rn.id });
          row(spot.length === 1 && far.why === 'reach' && snap(st) === b3, 'in a fight, Cure Wounds needs the healer beside whoever is mended: three squares off is out of reach');
          Rn.x = was[0]; Rn.y = was[1]; Rn.hp = 300; }
        /* the undead: turned by the cleric, untouched by sleep. The later of the two bandits on the board is the skeleton, so a rule that forgot to ask would roll for the living one first. */
        { S2.tpl = 'skeleton'; const f = freeNear(st, m, tok2.x, tok2.y, C.id); C.x = f[0]; C.y = f[1]; look(st);
          const seen = sightFrom(m, C.x, C.y, sightOf(m)), both = [tok, tok2].every((t) => cheb(t, C) <= 6 && seen[t.y * m.w + t.x]);
          force(st, 20, 2); const tu = intent(st, { t: 'ability', name: 'Turn Undead' });
          row(both && tu.ok && tu.turned.join() === tok2.id && S2.turned === st.round.n + 3 && !S1.turned && st.round.act === 0, 'Turn Undead turns the dead that fail their save, and never the living: ' + (tu.say || tu.why)); }
        row(to(tok2.id), 'the skeleton\'s turn');
        { const b = snap(st), tr = intent(st, { t: 'attack', who: tok2.id, target: C.id }), plan = foePlan(st);
          row(tr.why === 'turned' && snap(st) === b && plan && plan.t === 'end', 'a turned thing cannot strike, and its script knows to do nothing'); }
        row(to(Wz.id), 'the wizard\'s turn again');
        { S2.hp = 1; S1.hp = 5; const near = cheb(tok, tok2) <= 4, sl = intent(st, { t: 'ability', name: 'Sleep', target: tok.id });
          row(near && sl.ok && sl.slept.join() === tok.id && !S2.asleep && S1.asleep === st.round.n + 10, 'Sleep passes over the undead, however weak, and takes the living: ' + (sl.say || sl.why));
          S1.hp = 400; S2.hp = 400;
          /* and it runs out by itself */
          S1.asleep = st.round.n + 1; let woke = false, slept = 0;
          for (let g = 0; g < 40 && st.round && !woke; g++) { const e = intent(st, { t: 'end' }); if ((e.events || []).some((x) => x.k === 'sleep' && x.who === tok.id)) slept++; if (st.round && turnOf(st).id === tok.id) woke = true; }
          row(woke && S1.asleep === 0 && slept <= 1, 'sleep runs out by itself: in its last round the sleeper has its turn again'); }
        /* sneak attack needs a friend at the target's side, or advantage */
        row(to(Rg.id), 'the rogue\'s turn');
        { const away = []; for (let i = 0; i < m.w * m.h; i++) { const x = i % m.w, y = (i - x) / m.w, d = Math.max(Math.abs(x - tok.x), Math.abs(y - tok.y)); if (tileFree(m, x, y) && !taken(st, m, x, y, '') && d >= 3 && d <= 5 && visOf(st).g[i]) away.push([x, y]); }
          const others = st.party.filter((p) => p !== Rg); others.forEach((p, k) => { if (away[k]) { p.x = away[k][0]; p.y = away[k][1]; } });
          const rs = freeNear(st, m, tok.x, tok.y, Rg.id); Rg.x = rs[0]; Rg.y = rs[1]; look(st);
          const lone = away.length >= others.length && meleeClear(m, Rg.x, Rg.y, tok.x, tok.y) && !others.some((p) => cheb(p, tok) <= 1);
          S1.ac = 5; S1.asleep = 0; st.round.sneak = false; st.round.act = 1; force(st, 20, 15); const al = intent(st, { t: 'attack', target: tok.id, attack: 'Rapier' });
          row(lone && al.ok && al.hit && al.mode === 'normal' && !al.sneak && !st.round.sneak, 'a rogue alone at a waking foe lands no sneak attack: ' + (al.say || al.why));
          S1.asleep = st.round.n + 5; st.round.act = 1; force(st, 20, 15); const ad = intent(st, { t: 'attack', target: tok.id, attack: 'Rapier' });
          row(lone && ad.ok && ad.hit && ad.mode === 'advantage' && ad.sneak >= 1 && st.round.sneak && S1.asleep === 0, 'but advantage is enough: a blow at a sleeper is a sneak attack, and wakes it: ' + (ad.say || ad.why));
          CLASSES.Rogue.attacks.push({ n: 'Test Spark', ab: 'dex', d: '1d4', rg: 1, spell: true });
          S1.asleep = st.round.n + 5; st.round.sneak = false; st.round.act = 1; force(st, 20, 15); const sp = intent(st, { t: 'attack', target: tok.id, attack: 'Test Spark' });
          CLASSES.Rogue.attacks.pop();
          row(sp.ok && sp.hit && sp.mode === 'advantage' && !sp.sneak && !st.round.sneak && CLASSES.Rogue.attacks.length === 2, 'and it rides a weapon, never a spell (the rogue is lent one for a single blow to prove it)'); }
        /* the quarry falls: the mark goes with it */
        { Rn.mark = tok.id; S1.hp = 1; const fell = hurtFoe(st, m, tok, 5);
          row(fell && Rn.mark === '' && st.npcs[tok.npc].status === 'defeated' && !m.tokens.includes(tok), 'when the quarry falls the mark is gone with it'); }
        intent(st, { t: 'rounds', op: 'stop' });
        /* rests, by the clock */
        intent(st, { t: 'jump', site: 'S0' });
        { const clock = () => st.time.day * 1440 + st.time.minute, gain = (p) => Math.max(1, CLASSES[p.cls].hd + abMod(p.scores.con));
          for (const p of st.party) { p.hp = 100; for (const a of p.abilities) if (a.max !== null) a.uses = 0; }
          const t0 = clock(), sr = intent(st, { t: 'rest', kind: 'short' }), t1 = clock(), per = (p, n) => abilityDef(p.cls, n).per;
          row(sr.ok && t1 - t0 === 60 && st.party.every((p) => p.hp >= 101 && p.hp <= 100 + gain(p) && p.abilities.every((a) => a.max === null || a.uses === (per(p, a.n) === 'short' ? a.max : 0))) && F.abilities.every((a) => a.uses === a.max) && Wz.abilities.every((a) => a.uses === 0),
            'a short rest takes an hour, mends a hit die\'s worth, and brings back only what a short rest brings back: the fighter\'s tricks, not the wizard\'s spells');
          const lr = intent(st, { t: 'rest', kind: 'long' }), t2 = clock();
          row(lr.ok && t2 - t1 === 480 && st.party.every((p) => p.hp === p.hpMax && p.abilities.every((a) => a.max === null || a.uses === a.max)), 'a long rest takes eight hours and brings back everything');
          /* what is for a fight stays in a fight; what is not, works anywhere */
          const b = snap(st), only = [[F, 'Action Surge'], [Rg, 'Cunning Action'], [Wz, 'Shield'], [Wz, 'Magic Missile'], [Wz, 'Sleep'], [C, 'Bless'], [C, 'Turn Undead'], [Rn, 'hunter']];
          const no = only.filter(([p, n]) => intent(st, { t: 'ability', who: p.id, name: n, target: 'K0' }).why !== 'noround').map((q) => q[1]);
          row(!no.length && snap(st) === b, 'every fighting trick is refused outside a fight, and changes nothing' + (no.length ? ' (allowed: ' + no.join(', ') + ')' : ''));
          const bi = intent(st, { t: 'ability', who: Bd.id, name: 'Bardic Inspiration', target: F.id }); F.hp = 250; const hw = intent(st, { t: 'ability', who: Bd.id, name: 'Healing Word', target: F.id });
          row(bi.ok && F.conditions.includes('inspired') && hw.ok && F.hp > 250, 'while a word of inspiration or of healing may be spoken any time'); }
      }
      /* the party's order of things */
      {
        const st = newGame('lead-1'); intent(st, { t: 'party', op: 'add' }); const A = st.party[0], B = st.party[1];
        B.hp = 0; B.status = 'stable';
        const b = snap(st);
        row(intent(st, { t: 'lead', id: B.id }).why === 'downed' && intent(st, { t: 'party', op: 'drop', id: A.id }).why === 'last' && snap(st) === b, 'the fallen cannot lead, and the last one standing cannot be sent away');
        B.hp = 5; B.status = 'ok';
        const s = intent(st, { t: 'rounds', op: 'start' }), e1 = intent(st, { t: 'end' }), e2 = intent(st, { t: 'end' });
        row(s.ok && e1.ok && !e1.ended && e2.ok && !e2.ended && st.round && st.round.had === false, 'rounds counted with no enemy in them are nobody\'s victory: they go on until the table stands down');
        A.hp = 0; A.status = 'down'; const e = intent(st, { t: 'rounds', op: 'stop' });
        row(e.ok && st.lead === B.id && A.status === 'stable' && !st.round, 'when the leader has fallen, the lead passes to someone standing, and the dying are tended once the rounds are over');
      }
      /* rolling against death, die by die */
      {
        const force = (st, v) => { for (let n = st.n.roll; n < st.n.roll + 4000; n++) if (1 + Math.floor(rngFor(st.seed, 'dice', n)() * 20) === v) { st.n.roll = n; return true; } return false; };
        const st = newGame('saves-1'), p = st.party[0], down = () => { p.hp = 0; p.status = 'down'; p.saves = { s: 0, f: 0 }; }, save = (v) => { force(st, v); return deathSave(st, p); };
        down(); const r20 = save(20);
        row(r20.roll === 20 && p.hp === 1 && p.status === 'ok', 'a 20 against death puts the dying back on their feet with 1 hit point');
        down(); save(1); const two = p.saves.f === 2 && p.status === 'down'; save(5);
        row(two && p.status === 'dead', 'a 1 is two failures, and the third failure is death');
        down(); save(5); save(9); const hang = p.saves.f === 2 && p.status === 'down'; save(10); const held = p.saves.f === 2 && p.saves.s === 1 && p.status === 'down'; save(4);
        row(hang && held && p.status === 'dead', 'two failures are not yet death, a 10 is a success, and a third failure whenever it comes is the end');
        down(); save(12); save(19); const near = p.saves.s === 2 && p.status === 'down'; save(10);
        row(near && p.status === 'stable' && p.hp === 0, 'three successes and they will live, though not yet stand');
      }
      /* a shot: its range, what stands in its way, and who stands at the shooter's elbow */
      {
        const st = newGame('cover-1'); intent(st, { t: 'party', op: 'add' }); intent(st, { t: 'jump', site: 'S0' });
        const town = st.maps.S0, A = st.party[0], B = st.party[1], free = (x, y) => tileFree(town, x, y) && !tokenAt(town, x, y) && town._.occ[y * town.w + x] < 0;
        let lane = null;
        for (let y = 2; y < town.h - 3 && !lane; y++) for (let x = 2; x < town.w - 8 && !lane; x++) { let all = free(x + 1, y + 1) && free(x + 3, y + 1); for (let i = 0; i < 7 && all; i++) all = free(x + i, y); if (all && meleeClear(town, x, y, x + 1, y + 1) && reachWhy(town, { x, y }, { x: x + 6, y }, 30) === '') lane = [x, y]; }
        const at = (dx, dy) => ({ x: lane[0] + dx, y: lane[1] + (dy || 0) });
        row(lane && reachWhy(town, at(0), at(6), 5) === 'reach' && reachWhy(town, at(0), at(6), 6) === '' && reachWhy(town, at(0), at(2), 1) === 'reach', 'a shot reaches as far as its range and no further, sight or no sight');
        A.x = lane[0]; A.y = lane[1]; B.x = lane[0] + 3; B.y = lane[1];
        const t1 = town.tokens[0], t2 = town.tokens[1]; moveToken(town, t1, lane[0] + 6, lane[1]); t1.k = 'foe'; st.npcs[t1.npc].kind = 'foe';
        look(st); intent(st, { t: 'rounds', op: 'start' });
        const S = sheetOf(st, t1, true); S.hpMax = S.hp = 400;
        for (let g = 0; g < 20 && turnOf(st).id !== A.id; g++) intent(st, { t: 'end' });
        const shot = () => { st.round.act = 1; return intent(st, { t: 'attack', target: t1.id, attack: 'Longbow' }); };
        const c1 = shot(); B.y = lane[1] + 1; const c2 = shot();
        row(c1.ok && c1.cover === true && c1.ac === S.ac + 2 && c1.mode === 'normal' && /\(cover\)/.test(c1.say) && c2.ok && c2.cover === false && c2.ac === S.ac, 'a shot past someone must beat 2 more armour; with the line clear it need not: ' + c1.say);
        moveToken(town, t2, lane[0] + 1, lane[1] + 1); t2.k = 'foe'; st.npcs[t2.npc].kind = 'foe'; look(st);
        const c3 = shot(); st.round.act = 1; const c4 = intent(st, { t: 'attack', target: t2.id, attack: 'Longsword' });
        row(c3.ok && c3.mode === 'disadvantage' && c3.rolls.length === 2 && c3.natural === Math.min(c3.rolls[0], c3.rolls[1]) && c4.ok && c4.mode === 'normal' && c4.rolls.length === 1, 'a shot with an enemy at the shooter\'s elbow is at disadvantage; the blade drawn on that enemy is not: ' + c3.say);
      }
      return rows;
    }, 14);
    for (const [c, m] of rows) ok(c, m);
    await Q.ctx.close();
  }
  }

  if (want('R')) {
  /* ------------------------------------------------------------------ R */
  console.log('R. a fight by touch, and the monsters\' own script');
  {
    const R1 = await open({ width: 390, height: 844 }, null, { storyOpen: true }), page = R1.page;
    const quiet = (ms) => page.waitForFunction(() => G.st && !G.busy && !G.st.walk && !View.walking && View.anim.t >= 1 && !View.easing && !document.getElementById('veil').classList.contains('on'), null, { timeout: ms || 15000 });
    const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n || 3);
    const tapEl = async (sel) => { const p = await page.evaluate((sel) => { const e = document.querySelector(sel); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel); await page.touchscreen.tap(p[0], p[1]); await page.waitForTimeout(120); };
    /* centre the table on a square, clear the card off it, and say where on the glass that square is */
    const aimAt = async (x, y) => { await page.evaluate(([x, y]) => { UI.card(null); View.cam.x = x + .5; View.cam.y = y + .5; camMoved(true); viewDraw(); }, [x, y]); await frames(2); return page.evaluate(([x, y]) => { const r = View.cv.getBoundingClientRect(), s = w2s(x + .5, y + .5); return [r.left + s[0], r.top + s[1]]; }, [x, y]); };
    await begin(page);

    /* the story sits under the board; its bar is always in reach; folding it gives the board the room back */
    const lay = () => page.evaluate(() => { const q = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }; const cv = View.cv.getBoundingClientRect();
      return { board: q('board'), story: q('story'), bar: q('story-bar'), log: q('story-log'), say: q('say'), send: q('say-send'), open: document.getElementById('story').classList.contains('open'), vw: View.vw, vh: View.vh, cw: cv.width, ch: cv.height, W: innerWidth, H: innerHeight,
        sys: document.querySelectorAll('#story-log .st-sys').length, text: document.getElementById('story-log').textContent, story0: G.st.story.length, over: document.documentElement.scrollWidth > innerWidth + 1 }; });
    let L = await lay();
    ok(L.open && L.sys === 2 && L.text.includes(await page.evaluate(() => G.st.bible.opening)) && L.story0 === 2, 'with no Game Master the story opens on the tale\'s own opening lines, kept in the tale');
    ok(L.bar.b <= L.H + 1 && L.bar.t >= L.board.b - 1 && L.log.h >= 110 && L.board.h >= 380 && L.say.w >= 90 && L.send.r <= L.W + 1 && !L.over, 'the story sits under the board: its bar inside the screen, the board ' + Math.round(L.board.h) + ' px tall above it');
    await tapEl('#story-toggle'); await frames(6);
    const L2 = await lay();
    ok(!L2.open && L2.log.h === 0 && L2.board.h >= L.board.h + L.log.h - 4 && Math.abs(L2.vh - L2.ch) < 1 && Math.abs(L2.ch - L2.board.h) < 3 && L2.bar.b <= L2.H + 1, 'folding the story gives the board its room back, and the table is measured again at once (' + Math.round(L2.board.h) + ' px)');
    { /* a tap still lands on the square drawn there, after the board has changed size */
      const tgt = await page.evaluate(() => { const st = G.st, m = View.map, a = actor(), E = eyes(); let best = null; for (let i = 0; i < m.w * m.h; i++) { const x = i % m.w, y = (i - x) / m.w; if (!E.vis[i] || !tileFree(m, x, y) || taken(st, m, x, y, '') || m._.dec[i] >= 0) continue; const r = route(st, a, [[x, y]], true); if (r.ok && r.path.length >= 2 && (!best || r.path.length > best.n)) best = { x, y, n: r.path.length }; } return best; });
      const p = await aimAt(tgt.x, tgt.y); await page.touchscreen.tap(p[0], p[1]); await quiet();
      const at = await page.evaluate(() => [G.st.party[0].x, G.st.party[0].y]);
      ok(at[0] === tgt.x && at[1] === tgt.y, 'and a tap still lands on the square that is drawn there');
    }
    { const tc = await page.evaluate(() => { const t = document.getElementById('toast'), n = G.st.story.length; t.textContent = ''; UI.chip('fight', 'A line while folded.'); const said = t.textContent, kept = G.st.story.length === n + 1 && G.st.story[n].text === 'A line while folded.'; G.st.story.pop(); UI.renderStory(); return { said, kept }; });
      ok(tc.said === 'A line while folded.' && tc.kept, 'with the story folded away, what the engine does is still said in passing, and still written down'); }
    await tapEl('#story-toggle'); await frames(6);
    { const tc = await page.evaluate(() => { const t = document.getElementById('toast'); t.textContent = ''; UI.chip('fight', 'A line while open.'); const said = t.textContent, shown = [...document.querySelectorAll('#story-log .st-chip.fight')].some((x) => x.textContent === 'A line while open.'); G.st.story.pop(); UI.renderStory(); return { said, shown }; });
      ok(tc.said === '' && tc.shown, 'with the story open it is written there, and not said twice'); }
    /* the same on other screens: beside the board when the screen is wide or lying down, under it otherwise */
    { const bad = [];
      for (const [w, h] of [[320, 568], [844, 390], [1280, 800], [768, 1024], [390, 844]]) {
        await page.setViewportSize({ width: w, height: h }); await frames(8); await page.waitForTimeout(450); await frames(3);
        const v = await lay(), side = (w > h && h <= 520) || (w >= 1000 && w / h >= 1.25);
        if (v.bar.b > v.H + 1 || v.send.r > v.W + 1 || v.say.w < 60) bad.push(w + 'x' + h + ' the bar leaves the screen');
        if (v.board.w < 150 || v.board.h < (side ? 130 : 190)) bad.push(w + 'x' + h + ' the board is squeezed to ' + Math.round(v.board.w) + 'x' + Math.round(v.board.h));
        if (side ? !(v.story.l >= v.board.r - 2 && v.log.h >= 100) : !(v.story.t >= v.board.b - 2)) bad.push(w + 'x' + h + ' the story is on the wrong side');
        if (Math.abs(v.vw - v.cw) > 1 || Math.abs(v.vh - v.ch) > 1 || Math.abs(v.cw - v.board.w) > 3) bad.push(w + 'x' + h + ' the table was not measured again');
        if (v.over) bad.push(w + 'x' + h + ' the page scrolls sideways');
      }
      ok(bad.length === 0, 'on five screens the story is beside the board when the screen is wide or lying down and under it otherwise, its bar always in reach, the board never squeezed' + (bad.length ? ': ' + bad.join('; ') : ''));
    }
    { /* the panels with the most in them: nothing in Settings or the Party pushes the page sideways (a long option in a list once did) */
      const wide = await page.evaluate(() => { const out = []; UI.settings(); UI.openPanel('pan-settings'); const body = document.querySelector('#pan-settings .panel-body'); if (body.scrollWidth > body.clientWidth + 1) out.push('settings scrolls sideways');
        for (const e of body.querySelectorAll('fieldset, select, input, button, p')) { const r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1) out.push((e.id || e.tagName) + ' runs off the screen'); }
        const n = document.querySelectorAll('#set-model option').length + ',' + document.querySelectorAll('#set-m-monsters option').length; UI.closePanels(); return { out, n }; });
      ok(wide.out.length === 0 && wide.n === '4,4', 'Settings fits the screen it is on, the Game Master\'s part included' + (wide.out.length ? ': ' + wide.out.slice(0, 3).join('; ') : ''));
    }
    { /* a thing the Game Master sets down or takes away is painted: the board's picture is made again, not left as it was */
      const rp = await page.evaluate(() => { viewDraw(); const b0 = View.base, put = exec(G.st, 'place_object', { asset: 'chest', near: 'R1' }); viewDraw(); const b1 = View.base, gone = put.ok && exec(G.st, 'remove_object', { object_id: put.result.id }); viewDraw();
        return { put: put.ok, again: b1 !== b0, gone: !!gone && gone.ok, twice: View.base !== b1, key: View.base.key === bakeKey(View.map) }; });
      ok(rp.put && rp.again && rp.gone && rp.twice && rp.key, 'a thing set down on the board, or taken off it, makes the table paint its picture again');
    }
    /* letters typed into the story walk nobody; a line with no Game Master asks for a key and sends nothing */
    { const at0 = await page.evaluate(() => [G.st.party[0].x, G.st.party[0].y]);
      await page.evaluate(() => document.getElementById('say').focus()); await page.keyboard.type('wasd qezc 0+-'); await page.waitForTimeout(150);
      const typed = await page.evaluate(() => ({ v: document.getElementById('say').value, at: [G.st.party[0].x, G.st.party[0].y], walk: !!G.st.walk || View.walking }));
      ok(typed.v === 'wasd qezc 0+-' && typed.at[0] === at0[0] && typed.at[1] === at0[1] && !typed.walk, 'letters typed into the story are letters: nobody walks');
      await page.keyboard.press('Enter'); await page.waitForTimeout(200);
      const nk = await page.evaluate(() => ({ dlg: document.getElementById('dialog').classList.contains('open'), title: document.getElementById('dlg-title').textContent, kept: document.getElementById('say').value, story: G.st.story.length, busy: G.busy, on: Session.on() }));
      ok(nk.dlg && /No Game Master/.test(nk.title) && nk.kept === 'wasd qezc 0+-' && nk.story === 2 && !nk.busy && !nk.on, 'with no key, a line sent asks for one, keeps what was typed, and tells nothing');
      await page.evaluate(() => { [...document.querySelectorAll('#dlg-btns button')].find((b) => /Not now/.test(b.textContent)).click(); document.getElementById('say').value = ''; document.getElementById('say').blur(); });
      await page.evaluate(() => UI.storyOpen(false)); await frames(3);
      await page.keyboard.press('/'); await frames(3);
      const sl = await page.evaluate(() => ({ focus: document.activeElement && document.activeElement.id, open: document.getElementById('story').classList.contains('open'), v: document.getElementById('say').value }));
      ok(sl.focus === 'say' && sl.open && sl.v === '', 'the slash key opens the story and puts the pen in it, without writing a slash');
      await page.evaluate(() => document.getElementById('say').blur());
      const tk = await page.evaluate(() => { const tok = View.map.tokens[0]; UI.tokCard(tok); const all = [...document.querySelectorAll('#info-acts button')], btns = all.map((b) => b.textContent), talk = all.find((b) => b.textContent === 'Talk'); if (talk) talk.click();
        const out = { btns, dlg: document.getElementById('dialog').classList.contains('open'), title: document.getElementById('dlg-title').textContent, to: Session.to, ph: document.getElementById('say').placeholder, focus: document.activeElement && document.activeElement.id }; UI.closeDialog(); UI.card(null); return out; });
      ok(tk.btns.join() === 'Talk' && tk.dlg && /No Game Master/.test(tk.title) && tk.to === null && tk.ph === 'Say or do something' && tk.focus !== 'say', 'TALK with no Game Master asks for a key, and addresses nobody');
    }

    /* a party of four, to the cave, and seen */
    await page.evaluate(() => { for (let k = 0; k < 3; k++) document.getElementById('party-add').click(); for (const p of G.st.party) { p.hpMax = 60; p.hp = 60; } UI.follow(intent(G.st, { t: 'jump', site: 'S2' })); });   /* sixty hit points each: the flow is under test, the odds are section Q's */
    await page.waitForFunction(() => G.st.here === 'S2' && View.map && View.map.id === 'S2', null, { timeout: 8000 }); await quiet();
    const dlgOpen = () => page.evaluate(() => document.getElementById('dialog').classList.contains('open'));
    for (let h = 0; h < 30 && !(await dlgOpen()); h++) {
      await page.evaluate(() => { const st = G.st, m = View.map, Ld = leadOf(st), foes = m.tokens.filter((t) => t.k === 'foe').sort((a, b) => cheb(a, Ld) - cheb(b, Ld)), goals = []; for (const s of STEPS) goals.push([foes[0].x + s[0], foes[0].y + s[1]]); if (intent(st, { t: 'move', goals }).ok) View.walking = true; });
      await quiet(); await page.waitForTimeout(150);
    }
    ok(await dlgOpen(), 'walking into the cave, the party is seen and the table says so');
    await page.evaluate(() => [...document.querySelectorAll('#dlg-btns button')].find((b) => /initiative/i.test(b.textContent)).click());
    await page.waitForFunction(() => !!G.st.round, null, { timeout: 5000 });
    const told = await page.evaluate(() => ({ chips: G.st.story.filter((e) => e.t === 'chip').map((e) => e.text), nodes: document.querySelectorAll('#story-log .st-chip.fight').length, mode: Settings.data.monsters, order: G.st.round.order.map((c) => c.k).join() }));
    ok(told.chips.some((t) => /seen the party/.test(t)) && told.chips.some((t) => /Initiative is rolled/.test(t)) && told.nodes >= 2 && told.mode === 'script', 'being seen and rolling initiative are written into the story as they happen');

    /* the monsters' turns play themselves; the travellers' are played here by touch */
    const seen = { foeTurn: null, blow: null, noact: null, ring: null, dash: null, heal: null, foeAim: 0, foeAdj: 0, hp: null, point: null, far: null };
    for (let turn = 0; turn < 80; turn++) {
      const s0 = await page.evaluate(() => { const st = G.st, R = st.round; if (!R) return null; const a = turnOf(st); return { pc: a.pc, id: a.id, i: R.i, n: R.n, at: [a.o.x, a.o.y], story: st.story.length, hp: st.party.map((p) => p.hp).join(), armed: R.act > 0, aimN: a.pc ? -1 : [...aims()].length, inReach: a.pc ? 0 : st.party.filter((p) => p.site === a.m.id && p.status === 'ok' && !weaponFor(st, a, { pc: true, o: p, id: p.id }, '').why).length }; });
      if (!s0) break;
      if (!s0.pc) {
        if (s0.armed && s0.inReach > 0) { seen.foeAdj++; seen.foeAim += s0.aimN; }      /* a monster with a traveller in reach and its action in hand: in script mode nobody is ringed for it */
        /* a monster: nobody touches anything. It must do its deed and pass the turn by itself. */
        const moved = await page.waitForFunction((s0) => { const st = G.st, R = st.round; if (!R) return true; const a = turnOf(st); return !!a && (a.id !== s0.id || R.n !== s0.n) && !st.walk && !View.walking && View.anim.t >= 1; }, s0, { timeout: 20000 }).then(() => true, () => false);
        const s1 = await page.evaluate((s0) => { const st = G.st, m = st.maps.S2, t = m.tokens.find((q) => q.id === s0.id), n = t && st.npcs[t.npc]; return { round: !!st.round, at: t ? [t.x, t.y] : null, said: st.story.slice(s0.story).map((e) => e.text), name: n ? n.name : '', hp: st.party.map((p) => p.hp).join() }; }, s0);
        if (!seen.foeTurn && moved) seen.foeTurn = { passed: true, did: !s1.at || s1.at[0] !== s0.at[0] || s1.at[1] !== s0.at[1] || s1.said.some((t) => t.startsWith(s1.name + ':')), said: s1.said.join(' | ') };
        if (!moved) { seen.foeTurn = seen.foeTurn || { passed: false, did: false, said: 'the turn never passed' }; break; }
        continue;
      }
      await quiet();
      /* a traveller: what can be struck is ringed; a tap on it is a blow */
      const view = await page.evaluate(() => {
        const st = G.st, a = actor(), R = st.round, m = View.map, ids = [...aims()], marked = [], hps = [], orig = paintToken;
        paintToken = function (g, kind, letter, cx, cy, mark, o) { if (o && o.aim) marked.push(Math.floor(cx) + ',' + Math.floor(cy));
          const tk = kind === 'foe' ? tokenAt(m, Math.floor(cx), Math.floor(cy)) : null; if (tk) { const S = (st.npcs[tk.npc] || {}).sheet; hps.push([o ? o.hp : undefined, S ? S.hp / S.hpMax : null]); }
          return orig.apply(this, arguments); };
        try { viewDraw(); } finally { paintToken = orig; }
        const want = ids.map((id) => { const t = m.tokens.find((q) => q.id === id); return t.x + ',' + t.y; }).sort().join(' '), truth = m.tokens.filter((t) => t.k === 'foe' && eyes().vis[t.y * m.w + t.x] && !weaponFor(st, a, { pc: false, o: t, id: t.id }, '').why).map((t) => t.id).sort().join();
        const t = ids.length ? m.tokens.find((q) => q.id === ids[0]) : null, foes = m.tokens.filter((q) => q.k === 'foe' && R.order.some((c) => c.id === q.id));
        return { ids, hpOK: hps.every((q) => q[0] === q[1]), wounded: hps.filter((q) => q[1] !== null && q[1] < 1).length, ring: marked.sort().join(' ') === want && ids.slice().sort().join() === truth, act: R.act, tgt: t ? { id: t.id, x: t.x, y: t.y, hp: sheetOf(st, t, false).hp } : null, story: st.story.length, hurt: a.o.hp < a.o.hpMax, cls: a.o.cls, fx: View.fx.length, foes: foes.length, id: a.id };
      });
      if (view.ids.length && seen.ring === null) seen.ring = view.ring; else if (view.ids.length && !view.ring) seen.ring = false;
      if (!view.hpOK) seen.hp = false; else if (view.wounded && seen.hp === null) seen.hp = true;
      /* an enemy who stands further off than a blade: their card offers no blade, and in a fight neither the dice nor a word */
      { const far = await page.evaluate(() => { const st = G.st, a = actor(), m = a.m, E = eyes(), t = m.tokens.find((q) => q.k === 'foe' && E.vis[q.y * m.w + q.x] && cheb(q, a.o) > 1); if (!t || st.round.act < 1) return null; UI.tokCard(t);
          const btns = [...document.querySelectorAll('#info-acts button')].map((b) => b.textContent), blades = weaponsOf(a.o).filter((w) => w.rg <= 1).map((w) => w.n); UI.card(null); return { blade: btns.some((b) => blades.includes(b)), other: btns.includes('Roll initiative') || btns.includes('Talk') }; });
        if (far) { if (far.blade || far.other) seen.far = false; else if (seen.far === null) seen.far = true; } }
      /* once: the traveller's own card, by a tap on their own piece - DASH is on it, and spends the action for 30 ft more */
      if (!seen.dash && view.act > 0 && !view.ids.length) {
        const me = await page.evaluate(() => { const a = actor(); return [a.o.x, a.o.y]; }), p = await aimAt(me[0], me[1]);
        const r0 = await page.evaluate(() => { let n = 0; for (const v of reach()) n += v; return n; });
        await page.touchscreen.tap(p[0], p[1]); await page.waitForTimeout(150);
        const card = await page.evaluate(() => ({ on: !document.getElementById('info').hidden, text: document.getElementById('info-text').textContent, btns: [...document.querySelectorAll('#info-acts button')].map((b) => b.textContent), at: [actor().o.x, actor().o.y] }));
        await page.evaluate(() => { const b = [...document.querySelectorAll('#info-acts button')].find((x) => /^Dash/.test(x.textContent)); if (b) b.click(); }); await page.waitForTimeout(150);
        const d = await page.evaluate(() => { let n = 0; for (const v of reach()) n += v; return { left: moveLeft(G.st.round), act: G.st.round.act, sub: document.getElementById('place-sub').textContent, n, chip: G.st.story[G.st.story.length - 1].text }; });
        const p2 = await aimAt(me[0], me[1]); await page.touchscreen.tap(p2[0], p2[1]); await page.waitForTimeout(150);
        const spent = await page.evaluate(() => [...document.querySelectorAll('#info-acts button')].map((b) => b.textContent));
        seen.dashGone = spent.includes('Sheet') && !spent.some((b) => /^Dash/.test(b));
        seen.dash = { card: card.on && /HP \d+\/\d+/.test(card.text) && card.btns.some((b) => /^Dash/.test(b)) && card.btns.includes('Sheet') && card.at[0] === me[0] && card.at[1] === me[1], ok: d.left === 60 && d.act === 0 && /action spent/.test(d.sub) && d.sub.startsWith('60 ft left') && d.n > r0 && /dashes/.test(d.chip), detail: JSON.stringify([card.btns, d.sub, r0, d.n]) };
        await page.evaluate(() => UI.card(null));
      }
      const v2 = await page.evaluate(() => ({ act: G.st.round ? G.st.round.act : 0, ids: G.st.round ? [...aims()] : [] }));
      if (!seen.point && v2.ids.length && v2.act > 0) seen.point = await page.evaluate((id) => { const st = G.st, n = st.story.length, t = View.map.tokens.find((q) => q.id === id), hp = sheetOf(st, t, false).hp, act = st.round.act; UI.point(id);
        const out = { card: !document.getElementById('info').hidden && document.getElementById('info-name').textContent === (st.npcs[t.npc] || {}).name, same: st.story.length === n && sheetOf(st, t, false).hp === hp && st.round.act === act }; UI.card(null); return out; }, v2.ids[0]);
      if (v2.ids.length && v2.act > 0) {
        const tgt = await page.evaluate((id) => { const t = View.map.tokens.find((q) => q.id === id); return { id, x: t.x, y: t.y, hp: sheetOf(G.st, t, false).hp, story: G.st.story.length }; }, v2.ids[0]);
        const p = await aimAt(tgt.x, tgt.y);
        await page.touchscreen.tap(p[0], p[1]);
        const fx = await page.evaluate(() => View.fx.map((f) => f.text).join());
        await page.waitForTimeout(140);
        const after = await page.evaluate((tgt) => { const st = G.st, t = View.map.tokens.find((q) => q.id === tgt.id), said = st.story.slice(tgt.story).map((e) => e.text), R = st.round; return { act: R ? R.act : -1, hp: t ? sheetOf(st, t, false).hp : 0, gone: !t, said, sub: document.getElementById('place-sub').textContent, card: !document.getElementById('info').hidden, name: document.getElementById('info-name').textContent, text: document.getElementById('info-text').textContent, round: !!R, nodes: document.querySelectorAll('#story-log .st-chip').length, chips: st.story.filter((e) => e.t === 'chip').length, walk: !!st.walk || View.walking }; }, tgt);
        if (!seen.blow) seen.blow = { ok: after.said.length >= 1 && / at /.test(after.said[0]) && (after.act === 0 || !after.round) && after.hp <= tgt.hp && (/miss|−\d/.test(fx)) && !after.walk && after.nodes === after.chips, hit: after.hp < tgt.hp || after.gone, said: after.said[0], fx };
        /* and a second tap on the same enemy, with the action spent: a card that says so, never a second blow */
        if (!seen.noact && after.round && !after.gone && after.act === 0) {
          const p2 = await aimAt(tgt.x, tgt.y); await page.touchscreen.tap(p2[0], p2[1]); await page.waitForTimeout(140);
          const again = await page.evaluate((n) => ({ story: G.st.story.length, card: !document.getElementById('info').hidden, text: document.getElementById('info-text').textContent, hp: (() => { const t = View.map.tokens.find((q) => q.id === n.id); return t ? sheetOf(G.st, t, false).hp : -1; })() }), { id: tgt.id });
          seen.noact = { ok: again.card && /No action is left/.test(again.text) && again.hp === after.hp, text: again.text, wound: /unhurt|hurt|bloodied|barely standing/i.test(again.text) };
          await page.evaluate(() => UI.card(null));
        }
      } else if (v2.act > 0 && view.foes) {
        /* nobody in reach: walk toward the nearest of them (the engine's own planner, asked from the table), then try again next turn */
        await page.evaluate(() => { const st = G.st, a = turnOf(st), foes = a.m.tokens.filter((q) => q.k === 'foe' && st.round.order.some((c) => c.id === q.id)), way = approach(st, a, foes); if (way && way.to && intent(st, { t: 'move', who: a.id, to: way.to }).ok) View.walking = true; });
        await quiet();
        const more = await page.evaluate(() => (G.st.round ? [...aims()].length : 0));
        if (more) continue;
      }
      if (await page.evaluate(() => !!G.st.round && turnOf(G.st).pc)) { await tapEl('#btn-end'); await page.waitForTimeout(80); }
    }
    ok(seen.foeTurn && seen.foeTurn.passed && seen.foeTurn.did, 'a monster\'s turn plays itself: it does its deed and passes the turn with nobody touching the table' + (seen.foeTurn ? ' ("' + clipTo(seen.foeTurn.said, 90) + '")' : ''));
    ok(seen.ring === true, 'whoever the acting traveller could strike is ringed on the board: exactly those, by the engine\'s own reckoning');
    ok(seen.blow && seen.blow.ok, 'a tap on an enemy in reach is a blow: the action is spent, a number rises off the square, and the story says what happened' + (seen.blow ? ' ("' + clipTo(seen.blow.said, 90) + '", ' + seen.blow.fx + ')' : ''));
    ok(seen.noact && seen.noact.ok && seen.noact.wound, 'a second tap with the action spent is a card that says so and how the enemy looks, never a second blow' + (seen.noact ? ' ("' + clipTo(seen.noact.text, 90) + '")' : ''));
    ok(seen.dash && seen.dash.card && seen.dash.ok, 'a tap on your own piece is its card, with what else the turn can hold; DASH spends the action for 30 ft more, and the gold wash grows' + (seen.dash ? ' ' + seen.dash.detail : ''));
    ok(seen.dashGone === true, 'and once the action is spent the card no longer offers it');
    ok(seen.foeAdj > 0 && seen.foeAim === 0, 'while the script plays the monsters no traveller is ever ringed as a monster\'s target (' + seen.foeAdj + ' monster turns began with someone in reach)');
    ok(seen.hp === true, 'a monster that has been hurt is painted with what is left of it, and one that has not with nothing');
    ok(seen.point && seen.point.card && seen.point.same, 'an enemy\'s counter on the bar, tapped with that enemy in reach, is a card and never a blow');
    ok(seen.far === true, 'an enemy\'s card offers only what can reach: no blade for one who stands further off, and in a fight neither the dice nor a word');
    await page.waitForFunction(() => !G.st.round, null, { timeout: 3000 }).catch(() => {});
    const end = await page.evaluate(() => ({ round: !!G.st.round, init: !document.getElementById('btn-init').hidden, end: document.getElementById('btn-end').hidden, said: G.st.story.filter((e) => e.t === 'chip').map((e) => e.text).join(' | '), xp: G.st.party.map((p) => p.xp), here: G.st.here, foes: G.st.maps.S2.tokens.filter((t) => t.k === 'foe').length, log: G.st.log.filter((e) => e.t === 'tell').length, over: G.st.over }));
    ok(!end.round && end.init && end.end && /The fight is won\./.test(end.said) && end.xp.every((x) => x > 0) && /experience, \d+ each/.test(end.said) && end.log >= 3, 'the last enemy falls and the fight ends by itself: the dice are back on the bar, the experience is shared, the journal has the blows');

    /* wounds, the fallen and the mark of a target, measured off the token painter's own pixels */
    { const px = await page.evaluate(() => {
        const paint = (o, kind) => { const cv = document.createElement('canvas'); cv.width = cv.height = 160; const g = cv.getContext('2d'); g.fillStyle = VEL; g.fillRect(0, 0, 160, 160); g.setTransform(80, 0, 0, 80, 0, 0); g.lineCap = 'round'; paintToken(g, kind || 'foe', 'X', 1, 1, false, o); const d = g.getImageData(0, 0, 160, 160).data; return d; };
        const ringCount = (d, test, r0, r1) => { let n = 0; for (let y = 0; y < 160; y++) for (let x = 0; x < 160; x++) { const r = Math.hypot(x - 80, y - 80) / 80, i = (y * 160 + x) * 4; if (r >= r0 && r <= r1 && test(d[i], d[i + 1], d[i + 2])) n++; } return n; };
        const red = (r, g, b) => r > 130 && g < 90 && b < 80, green = (r, g, b) => g > r + 12 && g > b && r < 120, dark = (r, g, b) => r < 110 && g < 90 && b < 80;
        const plain = paint({}), half = paint({ hp: .7 }), low = paint({ hp: .2 }), full = paint({ hp: 1 }), aim = paint({ aim: true }), down = paint({ down: true, hp: 0 }, 'pc'), up = paint({ hp: 1 }, 'pc');
        let diff = 0; for (let i = 0; i < full.length; i++) if (full[i] !== plain[i]) diff++;
        const gold = (d) => ringCount(d, (r, g, b) => r > 150 && g > 110 && b < 110, 0, .3);
        return { g7: ringCount(half, green, .5, .62), g0: ringCount(plain, green, .5, .62), r2: ringCount(low, red, .5, .62), r0: ringCount(plain, red, .5, .62), same: diff, aim: ringCount(aim, red, .4, .62), aim0: ringCount(plain, red, .4, .62), cross: ringCount(down, red, 0, .2), cross0: ringCount(up, red, 0, .2), faded: gold(down) < gold(up) * .6, gU: gold(up) };
      });
      ok(px.g7 > 60 && px.g0 === 0 && px.r2 > 15 && px.r2 < px.g7 && px.r0 === 0 && px.same === 0, 'a wound shows as an arc round the piece: most of a ring in green at 70%, a short red one at 20%, nothing at all on the unhurt (' + px.g7 + ', ' + px.r2 + ' px)');
      ok(px.aim > 80 && px.aim0 === 0 && px.cross > 30 && px.cross0 === 0 && px.faded && px.gU > 100, 'a target in reach wears a red broken ring; the fallen are faded and struck through (' + px.aim + ', ' + px.cross + ' px)');
    }

    /* the party's sheets, and rest */
    await page.evaluate(() => { UI.party(); UI.openPanel('pan-party'); }); await page.waitForTimeout(200);
    const sheet = await page.evaluate(() => { const rows = [...document.querySelectorAll('#party-list .entry.pc')], sel = rows.map((r) => r.querySelector('select')); return { n: rows.length, text: rows[0].textContent, dis: sel.every((s) => s.disabled), cls: sel.map((s) => s.value).join(), purse: document.getElementById('party-purse').textContent, w: rows.every((r) => r.getBoundingClientRect().right <= innerWidth + 1 && [...r.children].every((c) => c.getBoundingClientRect().right <= innerWidth + 1)), gold: G.st.gold, img: document.querySelectorAll('#pan-party img').length }; });
    ok(sheet.n === 4 && /Level 1/.test(sheet.text) && /HP \d+\/60/.test(sheet.text) && /Longsword \+4, 1d8\+2/.test(sheet.text) && /Second Wind \d\/1/.test(sheet.text) && /chain mail/.test(sheet.text) && sheet.cls === 'Fighter,Rogue,Cleric,Wizard' && sheet.purse.includes('Gold ' + sheet.gold) && sheet.w,
      'the Party panel is a sheet for each traveller: calling, level, hit points, what they strike with, what they know, what they carry, all inside the screen');
    ok(sheet.dis, 'a calling that has earned experience can no longer be changed');
    await tapEl('#party-add'); await page.waitForTimeout(150);
    const fresh = await page.evaluate(() => { const rows = [...document.querySelectorAll('#party-list .entry.pc')], sel = rows[4].querySelector('select'), before = { cls: G.st.party[4].cls, hp: G.st.party[4].hpMax, dis: sel.disabled }; sel.value = 'Bard'; sel.dispatchEvent(new Event('change', { bubbles: true })); const row2 = [...document.querySelectorAll('#party-list .entry.pc')][4]; return { before, cls: G.st.party[4].cls, hp: G.st.party[4].hpMax, text: row2.textContent, sel: row2.querySelector('select').value }; });
    ok(fresh.before.cls === 'Ranger' && !fresh.before.dis && fresh.cls === 'Bard' && fresh.hp === 9 && fresh.sel === 'Bard' && /Bardic Inspiration/.test(fresh.text) && /HP 9\/9/.test(fresh.text), 'a newcomer\'s calling can still be chosen, and the sheet is written again on the spot');
    const t0 = await page.evaluate(() => { for (const t of G.st.maps.S2.tokens.slice()) if (t.k === 'foe') dropToken(G.st, G.st.maps.S2, t); look(G.st); G.st.party[0].hp = 5; return G.st.time.day * 1440 + G.st.time.minute; });
    await tapEl('#party-short'); await page.waitForTimeout(200);
    const rest = await page.evaluate(() => ({ t: G.st.time.day * 1440 + G.st.time.minute, hp: G.st.party[0].hp, text: [...document.querySelectorAll('#party-list .entry.pc')][0].textContent, chip: G.st.story[G.st.story.length - 1].text, purse: document.getElementById('party-purse').textContent }));
    ok(rest.t === t0 + 60 && rest.hp > 5 && rest.text.includes('HP ' + rest.hp + '/60') && /rests an hour/.test(rest.chip), 'REST AN HOUR: an hour passes, wounds are bound, and the sheet shows it');
    await page.evaluate(() => { UI.closePanels(); UI.chron('journal'); UI.openPanel('pan-chron'); }); await page.waitForTimeout(150);
    const jr = await page.evaluate(() => ({ text: document.getElementById('chron-list').textContent, img: document.querySelectorAll('#pan-chron img').length }));
    ok(/ at .*: a (hit|miss|critical hit)/.test(jr.text) && /The rounds ended: victory/.test(jr.text) && /rests an hour/.test(jr.text), 'the journal keeps the blows, the end of the fight and the rest');
    await page.evaluate(() => UI.closePanels());
    const hh = await page.evaluate(() => { const st = G.st, P = st.party[0], C = st.party.find((p) => p.cls === 'Cleric'), name = C.name.split(' ')[0]; P.hp = 5; UI.pcCard(P);
      const all = [...document.querySelectorAll('#info-acts button')], btns = all.map((b) => b.textContent), b = all.find((x) => x.textContent.startsWith('Cure Wounds, ' + name)), n = st.story.length; if (b) b.click();
      return { btns, mine: btns.some((x) => x.startsWith('Cure Wounds, ' + name)), hp: P.hp, said: st.story.slice(n).map((e) => e.text).join('|'), uses: C.abilities.find((a) => a.n === 'Cure Wounds').uses }; });
    ok(hh.mine && hh.btns.includes('Sheet') && hh.hp > 5 && /uses Cure Wounds on/.test(hh.said) && hh.uses === 1, 'outside a fight a wounded traveller\'s card offers the hands of whoever in the party can heal, by name: ' + hh.btns.join(', '));
    const fl = await page.evaluate(() => { G.st.fallen.push({ name: 'Old Tom', cls: 'Rogue', level: 2, day: 1 }); UI.party(); const t = document.getElementById('party-fallen').textContent; G.st.fallen.pop(); UI.party(); return { t, after: document.getElementById('party-fallen').textContent }; });
    ok(/Old Tom/.test(fl.t) && /Rogue 2 . fell on day 1/.test(fl.t) && fl.after === '', 'the Party panel keeps the names of the fallen');
    /* a table that folded its story finds it folded when the tale is taken up again */
    await page.evaluate(() => { UI.card(null); UI.storyOpen(false); UI.toTitle(); });
    await page.waitForFunction(() => !document.body.classList.contains('in-play') && !document.getElementById('btn-continue').hidden && !document.getElementById('veil').classList.contains('on'), null, { timeout: 8000 });
    await page.evaluate(() => document.getElementById('btn-continue').click());
    await page.waitForFunction(() => document.body.classList.contains('in-play') && !document.getElementById('veil').classList.contains('on'), null, { timeout: 8000 }); await frames(4);
    const fd = await page.evaluate(() => ({ open: document.getElementById('story').classList.contains('open'), log: document.getElementById('story-log').offsetHeight, story: G.st.story.length, vh: View.vh, ch: View.cv.getBoundingClientRect().height }));
    ok(!fd.open && fd.log === 0 && fd.story > 5 && Math.abs(fd.vh - fd.ch) < 1, 'a table that folded its story finds it folded when the tale is taken up again, though there is a story to show');
    await R1.ctx.close();

    /* by hand: with the monsters set to be moved by whoever holds the table, nothing moves by itself, and a tap strikes */
    const R2 = await open({ width: 390, height: 844 }, null, { monsters: 'hand', storyOpen: true }), pg = R2.page;
    await begin(pg);
    const hand = await pg.evaluate(async () => {
      const st = G.st; intent(st, { t: 'jump', site: 'S2' }); viewSetMap(st.maps.S2); UI.bar();
      const m = st.maps.S2, P = st.party[0], tok = m.tokens.find((t) => t.k === 'foe'), spot = STEPS.map((s) => [P.x + s[0], P.y + s[1]]).find((q) => tileFree(m, q[0], q[1]) && !taken(st, m, q[0], q[1], '') && meleeClear(m, q[0], q[1], P.x, P.y));
      moveToken(m, tok, spot[0], spot[1]); look(st); P.hpMax = 60; P.hp = 60;
      const btnsOf = () => [...document.querySelectorAll('#info-acts button')].map((b) => b.textContent).join();
      UI.tokCard(tok); const pre = btnsOf(), dice = [...document.querySelectorAll('#info-acts button')].find((b) => b.textContent === 'Roll initiative'); if (dice) dice.click(); const rolled = !!st.round; if (!rolled) UI.rounds(true);
      UI.tokCard(tok); const mid = btnsOf().includes('Roll initiative'); UI.card(null);
      const cap = m.tokens.find((t) => t.k === 'captive'); UI.tokCard(cap); const capBtns = btnsOf(); UI.card(null);
      UI.party(); const shut = ['party-short', 'party-long', 'party-add'].every((id) => document.getElementById(id).disabled);
      for (let g = 0; g < 6 && turnOf(st).pc; g++) UI.endTurn();
      const a = turnOf(st), key = [st.round.i, a.o.x, a.o.y, st.story.length].join();
      await new Promise((res) => setTimeout(res, 1600));
      const still = !a.pc && [st.round.i, a.o.x, a.o.y, st.story.length].join() === key, ids = [...aims()];
      UI.card(null); View.cam.x = P.x + .5; View.cam.y = P.y + .5; camMoved(true); viewDraw();
      const r = View.cv.getBoundingClientRect(), s = w2s(P.x + .5, P.y + .5);
      return { still, foe: !a.pc, ids, pid: P.id, tap: [r.left + s[0], r.top + s[1]], story: st.story.length, name: (st.npcs[a.o.npc] || {}).name, pre, rolled, mid, capBtns, shut };
    });
    await pg.touchscreen.tap(hand.tap[0], hand.tap[1]); await pg.waitForTimeout(200);
    const struck = await pg.evaluate((h) => ({ said: G.st.story.slice(h.story).map((e) => e.text), act: G.st.round ? G.st.round.act : -1, lead: G.st.lead }), hand);
    ok(hand.pre === 'Roll initiative' && hand.rolled && !hand.mid, 'an enemy\'s card, before a fight, offers the dice, and they roll; once rolled it offers them no more');
    ok(hand.capBtns === '' && hand.shut, 'in a fight nobody is talked to from their card, and the party neither rests nor grows');
    ok(hand.foe && hand.still, 'with the monsters moved by hand, a monster\'s turn waits: nothing moves and nothing is said by itself');
    ok(hand.ids.join() === hand.pid && struck.said.length === 1 && struck.said[0].startsWith(hand.name + ':') && / at /.test(struck.said[0]) && struck.act === 0, 'and on its turn a tap on a traveller in its reach is its blow: "' + clipTo(struck.said[0] || '', 80) + '"');
    /* the cross on the bar stands everyone down, and says so */
    const stood = await pg.evaluate(async () => { const st = G.st, n = st.story.length, t = document.getElementById('toast'); t.textContent = ''; document.getElementById('btn-stand').click(); await new Promise((res) => setTimeout(res, 150));
      UI.party(); const out = { round: !!st.round, said: st.story.slice(n).map((e) => e.text).join('|'), toast: t.textContent, init: !document.getElementById('btn-init').hidden, end: document.getElementById('btn-end').hidden, rest: !document.getElementById('party-short').disabled && !document.getElementById('party-long').disabled };
      UI.rounds(true); for (let g = 0; g < 6 && turnOf(st).pc; g++) UI.endTurn(); out.back = !!st.round && !turnOf(st).pc; return out; });
    ok(!stood.round && /The party stands down\./.test(stood.said) && /rounds are over/.test(stood.toast) && stood.init && stood.end && stood.rest && stood.back, 'the cross stands everyone down: the story says so, the dice are back on the bar, and the party may rest again');
    /* beaten but breathing: the party wakes at the inn, and the page shows the inn */
    const lost = await pg.evaluate(async () => {
      const st = G.st, P = st.party[0], gold0 = st.gold; P.hp = 0; P.status = 'down'; P.saves = { s: 0, f: 0 };
      UI.endTurn();
      await new Promise((res) => setTimeout(res, 900));
      return { here: st.here, map: View.map && View.map.id, hp: P.hp, status: P.status, gold: st.gold, gold0, time: st.time, round: !!st.round, init: !document.getElementById('btn-init').hidden, said: st.story.filter((e) => e.t === 'chip').slice(-2).map((e) => e.text).join(' | '), title: document.getElementById('place-name').textContent, inn: st.bible.inn, dlg: document.getElementById('dialog').classList.contains('open') };
    });
    ok(lost.here === 'S1' && lost.map === 'S1' && lost.title === lost.inn && lost.hp === 1 && lost.status === 'ok' && lost.gold === Math.floor(lost.gold0 / 2) && lost.time.day === 2 && lost.time.minute === 480 && !lost.round && lost.init && /fights for life/.test(lost.said) && /The party is beaten\..*wake at the inn the next morning, half their gold gone/.test(lost.said) && !lost.dlg,
      'beaten with someone still breathing: the death save is told, then the party wakes at the inn next morning with 1 hit point and half its gold, and the table shows the inn');
    /* nobody left: the tale is over, the table says so, and stays so */
    const dead = await pg.evaluate(async () => {
      const st = G.st, P = st.party[0]; UI.rounds(true); P.hp = 0; P.status = 'dead'; UI.endTurn();
      await new Promise((res) => setTimeout(res, 300));
      const dlg = document.getElementById('dialog').classList.contains('open'), title = document.getElementById('dlg-title').textContent, body = document.getElementById('dlg-body').textContent; UI.closeDialog();
      const a = actor(), s = w2s(a.o.x + 1.5, a.o.y + .5); tapAt(s[0], s[1]); await UI.saveNow();
      return { over: st.over, dlg, title, body, name: P.name, walk: !!st.walk || View.walking, toast: document.getElementById('toast').textContent, act: document.getElementById('act').hidden, round: !!st.round, add: intent(st, { t: 'party', op: 'add' }).why };
    });
    ok(dead.over === 'dead' && dead.dlg && dead.title === 'The tale ends' && dead.body.includes(dead.name) && !dead.walk && /tale has ended/.test(dead.toast) && dead.act && !dead.round && dead.add === 'over', 'with nobody left alive the tale ends: the table says who fell, and a tap after that walks nobody');
    await pg.reload(); await pg.waitForFunction(() => typeof UI === 'object');
    await pg.waitForFunction(() => !document.getElementById('btn-continue').hidden, null, { timeout: 8000 });
    await pg.evaluate(() => document.getElementById('btn-continue').click());
    await pg.waitForFunction(() => G.st && document.body.classList.contains('in-play') && document.getElementById('dialog').classList.contains('open'), null, { timeout: 8000 }).catch(() => {});
    ok(await pg.evaluate(() => G.st.over === 'dead' && document.getElementById('dialog').classList.contains('open') && document.getElementById('dlg-title').textContent === 'The tale ends'), 'and it is still over when the tale is opened again');
    const told2 = await pg.evaluate(() => ({ chips: document.querySelectorAll('#story-log .st-chip').length, st: G.st.story.filter((e) => e.t === 'chip').length, sys: document.querySelectorAll('#story-log .st-sys').length, sysSt: G.st.story.filter((e) => e.t === 'sys').length }));
    ok(told2.chips === told2.st && told2.chips >= 4 && told2.sys === told2.sysSt && told2.sys === 2, 'with its story written out again from the save: ' + told2.chips + ' lines of what the dice did, and the opening');
    await R2.ctx.close();
  }
  }

  if (want('S')) {
  /* ------------------------------------------------------------------ S */
  console.log('S. the Game Master\'s tools and what it is told');
  {
    const S0 = await open({ width: 390, height: 844 }), page = S0.page;
    const rows = await page.evaluate(() => {
      const rows = [], row = (c, m) => rows.push([!!c, m]);
      const snap = (st) => JSON.stringify(packState(st)).replace(/"saved":\d+/, '');
      const st = newGame('tools-1'), x = (n, i) => exec(st, n, i), bible0 = bibleText(st);
      let m = st.maps.S1;
      const defs = toolDefs();
      row(TOOL_NAMES.length === 25 && defs.every((t) => /^[a-z_]{3,24}$/.test(t.name) && t.description.length > 60 && t.input_schema.type === 'object' && t.input_schema.additionalProperties === false && (t.input_schema.required || []).every((k) => k in t.input_schema.properties)),
        'the Game Master has ' + TOOL_NAMES.length + ' tools, each described, each with a closed schema whose required fields exist');
      row(defs.every((t) => Object.values(t.input_schema.properties).every((p) => p.description && p.description.length > 3)), 'and every field of every tool says what it is for');
      /* refusals: one of each kind of bad call, and the tale byte for byte the same afterwards */
      const before = snap(st);
      const badCalls = [['roll_check', { character_id: 'P9', check: 'stealth', dc: 10 }], ['roll_check', { character_id: 'P1', check: 'juggling', dc: 10 }], ['roll_check', { character_id: 'P1', check: 'stealth', dc: 99 }], ['roll_dice', { expr: '9d9999' }], ['roll_dice', { expr: 'alert(1)' }],
        ['move', { id: 'P1', toward: 'R99' }], ['move', { id: 'nobody', toward: 'R1' }], ['move', { id: 'P1', toward: '999,999' }], ['travel_party', { to: 'Atlantis' }], ['travel_party', { to: 'S1' }], ['set_door', { door_id: 'D99', open: true }], ['set_door', { door_id: 'D0' }],
        ['place_object', { asset: 'dragon' }], ['place_object', { asset: 'coins' }], ['place_object', { asset: 'coins', on: 'O9999' }], ['remove_object', { object_id: 'O9999' }], ['reveal', { site_id: 'S99' }], ['reveal', { room_id: 'R99' }], ['create_npc', {}], ['create_npc', { role: 'x', template: 'tarrasque' }],
        ['update_npc', { npc_id: 'N99' }], ['update_npc', { npc_id: 'N0', attitude: 'smitten' }], ['update_npc', { npc_id: 'N0', status: 'ascended' }], ['end_combat', { outcome: 'truce' }], ['attack', { attacker_id: 'P1', target_id: 'N0' }], ['attack', { attacker_id: 'P1', target_id: 'nobody' }],
        ['use_ability', { character_id: 'P1', ability: 'Fireball' }], ['use_ability', { character_id: 'P1', ability: 'Action Surge' }], ['end_turn', {}], ['rest', { kind: 'nap' }], ['advance_time', { minutes: 0 }], ['advance_time', { minutes: 1.5 }],
        ['inventory', { op: 'gold', amount: -99999 }], ['inventory', { op: 'take', character_id: 'P1', item: 'crown' }], ['inventory', { op: 'steal' }], ['update_character', { character_id: 'P1', hp_change: 5000 }], ['update_character', { character_id: 'P1', add_conditions: ['sparkly'] }],
        ['create_character', { name: '', class: 'Fighter' }], ['create_character', { name: 'X', class: 'Paladin' }], ['update_quest', { op: 'note', quest_id: 'Q0' }], ['update_quest', { op: 'complete', quest_id: 'Q9' }], ['update_quest', { op: 'add', title: 'x' }],
        ['record_fact', { subject: 'N99', text: 'x y z' }], ['record_fact', { subject: 'world', text: '' }], ['lookup', { query: 'a' }], ['end_scene', { summary: 'no' }], ['nonsense', {}], ['move', null], ['roll_dice', []]];
      let refused = 0; const slack = [];
      for (const [n, i] of badCalls) { const r = x(n, i); if (!r.ok && typeof r.error === 'string' && r.error.length > 8) refused++; else slack.push(n + ' ' + JSON.stringify(i)); }
      row(refused === badCalls.length, badCalls.length + ' bad calls, one of each kind, are each refused with a reason' + (slack.length ? ' (accepted: ' + slack.join('; ') + ')' : ''));
      row(snap(st) === before, 'and a refused call changes nothing: the tale is byte for byte what it was');
      row(new Set(badCalls.map((b) => b[0])).size >= TOOL_NAMES.length - 2, 'the bad calls cover the tools: ' + TOOL_NAMES.filter((n) => !badCalls.some((b) => b[0] === n)).join(', ') + ' have none because they take nothing that can be wrong');
      /* a tool that throws half way leaves nothing behind */
      TOOLS.__boom = { desc: '', schema: {}, run(s) { s.gold = 9999; s.party[0].hp = 1; s.maps.S1.doors[0].open = !s.maps.S1.doors[0].open; throw new Error('boom'); } };
      const b2 = snap(st), boom = x('__boom', {}); delete TOOLS.__boom;
      const swapped = m !== st.maps.S1; m = st.maps.S1;        /* the tale was put back: its boards are new objects, and anything holding an old one must let go */
      row(!boom.ok && /boom/.test(boom.error) && snap(st) === b2 && st.gold !== 9999 && swapped && visOf(st).site === 'S1' && tokenAt(m, m.tokens[0].x, m.tokens[0].y) === m.tokens[0], 'a tool that throws half way through changes nothing either: the tale is put back, and the engine says what broke');

      /* characters */
      const c1 = x('create_character', { name: 'Maud Ashdown', class: 'ranger', ancestry: 'elf', background: 'bounty hunter', player: 'Zack' });
      row(c1.ok && st.party.length === 1 && st.party[0].name === 'Maud Ashdown' && st.party[0].cls === 'Ranger' && st.party[0].ancestry === 'elf' && !st.party[0].stock && c1.result.took_the_place_of_a_placeholder && /joins the tale/.test(c1.say), 'create_character turns the nameless placeholder into the character, where it stands');
      const c2 = x('create_character', { name: 'Bram', class: 'Wizard' });
      row(c2.ok && st.party.length === 2 && st.party[1].cls === 'Wizard' && !c2.result.took_the_place_of_a_placeholder && tileFree(m, st.party[1].x, st.party[1].y) && st.gold === 15 + 10, 'the next one joins beside the party, purse and all');
      row(!x('create_character', { name: 'bram', class: 'Bard' }).ok && st.party.length === 2, 'no two characters of one name');
      const sg = x('suggest_character', { class: 'Bard' });
      row(sg.ok && sg.result.class === 'Bard' && sg.result.name.split(' ').length === 2 && st.party.length === 2, 'suggest_character offers one and creates nothing');
      /* dice */
      const rc = x('roll_check', { character_id: 'Maud', check: 'Perception check', dc: 12, reason: 'listening at the door' });
      row(rc.ok && rc.result.total === rc.result.natural + rc.result.modifier && rc.result.modifier === 2 + 2 && rc.result.success === (rc.result.total >= 12) && /Perception/.test(rc.say) && /listening at the door/.test(rc.say), 'roll_check finds the character by first name, adds wisdom and proficiency, and says what came of it: ' + rc.say);
      const dn = st.n.roll, rd = x('roll_dice', { expr: '2d6+3' });
      row(rd.ok && rd.result.total >= 5 && rd.result.total <= 15 && rd.result.rolls.length === 2 && st.n.roll === dn + 1, 'roll_dice rolls the tale\'s own dice');
      /* the board: the model names things, the engine does the geometry */
      const keeper = m.tokens.find((t) => t.npc === 'N0'), L = st.party[0];
      const mv = x('move', { id: 'P1', toward: 'N0' });
      row(mv.ok && mv.result.beside_it && meleeClear(m, L.x, L.y, keeper.x, keeper.y) && cheb(st.party[1], L) <= 3 && !st.walk, 'move walks the leader to stand beside the innkeeper, through the inn\'s doors, and the party comes too');
      const was = roomAt(m, keeper.x, keeper.y).id, mn = x('move', { id: 'N0', toward: 'R2' });
      row(was === 'R1' && mn.ok && tokenAt(m, keeper.x, keeper.y) === keeper && roomAt(m, keeper.x, keeper.y).id === 'R2', 'a person can be walked to another room too, and the board\'s lookup follows');
      const door = m.doors.find((d) => !d.ext), sd = x('set_door', { door_id: door.id, locked: true });
      row(sd.ok && door.lock && !door.open && /locked/.test(sd.say), 'set_door locks a door (and shuts it)');
      row(!x('set_door', { door_id: door.id, open: true }).ok && door.lock && !door.open, 'a locked door does not open by saying so');
      row(x('set_door', { door_id: door.id, open: true, locked: false }).ok && door.open && !door.lock, 'unlocked and opened in one call');
      const table = m.objs.find((o) => !o.on && ASSETS[o.a].surf && (m._.kids.get(o.id) || []).length < ASSETS[o.a].surf * ASSETS[o.a].w * ASSETS[o.a].h);
      const n0 = m.objs.length, rev0 = m.rev | 0, po = x('place_object', { asset: 'key', on: table.id });
      row(po.ok && m.objs.length === n0 + 1 && m._.byId.get(po.result.id).on === table.id && (m.rev | 0) === rev0 + 1, 'place_object puts a key on a table as an object of its own, and the board knows it has changed');
      const pf = x('place_object', { asset: 'chest', near: 'P1' }), chest = pf.ok && m._.byId.get(pf.result.id);
      row(pf.ok && chest && m._.occ[chest.y * m.w + chest.x] >= 0 && !tileFree(m, chest.x, chest.y) && !m.doors.some((d) => doorSides(d).some((q) => q[0] === chest.x && q[1] === chest.y)), 'and a chest on a free square near the party, never in a doorway');
      /* nothing the model puts down may wall anyone in: in a tale of its own, pile crates round the traveller until the engine says no */
      { const s4 = newGame('pile-1'), m4 = s4.maps.S1, P4 = s4.party[0]; let put = 0, said = '';
        for (let k = 0; k < 60; k++) { const r = exec(s4, 'place_object', { asset: 'crate', near: 'P1' }); if (!r.ok) { said = r.error; break; } put++; }
        const reach = floodReach(m4, P4.x, P4.y), exitOK = exitGoals(m4, m4.exits[0]).some((q) => reach[q[1] * m4.w + q[0]]);
        let ring = 0; for (const d of STEPS) if (!tileFree(m4, P4.x + d[0], P4.y + d[1])) ring++;
        row(put >= 1 && put < 8 && ring < 8 && exitOK && /block a way|no free place/.test(said), 'crates piled round a traveller (' + put + ' accepted before the engine said no) never wall them in: the way out can still be walked'); }
      row(x('remove_object', { object_id: po.result.id }).ok && !m._.byId.get(po.result.id), 'remove_object takes a thing away');
      const cave0 = !!st.maps.S2, rv = x('reveal', { site_id: 'S2' });
      row(!cave0 && rv.ok && st.maps.S2 && st.maps.S2.seen.every((v) => v === 1) && st.here === 'S1', 'reveal charts a place and shows its whole map, and moves nobody');
      /* people */
      const cn = x('create_npc', { role: 'bandit scout', hostile: true, template: 'bandit archer', near: 'P1', name: 'Rafe Sedge', trait: 'nervous' });
      const scout = cn.ok && m.tokens.find((t) => t.npc === cn.result.id);
      row(cn.ok && scout && scout.k === 'foe' && st.npcs[cn.result.id].tpl === 'bandit archer' && st.npcs[cn.result.id].trait === 'nervous' && tokenAt(m, scout.x, scout.y) === scout && (st.met.S1 || []).includes(scout.id), 'create_npc sets a hostile down beside the party, with the block asked for, and the party has seen them');
      row(!x('create_npc', { role: 'twin', name: 'rafe sedge' }).ok, 'no two people of one name');
      const peace = x('update_npc', { npc_id: cn.result.id, attitude: 'neutral' });
      row(peace.ok && scout.k === 'npc' && st.npcs[cn.result.id].kind === 'npc', 'update_npc makes peace');
      const war = x('update_npc', { npc_id: 'Rafe Sedge', attitude: 'hostile', note: 'Sold the party out to the Hand.' });
      row(war.ok && scout.k === 'foe' && st.facts.some((f) => f.subject === cn.result.id && /Sold the party/.test(f.text)), 'or an enemy, by name, with a note that becomes canon');
      /* a fight through the tools: only whoever's turn it is, and by the engine's rules */
      for (const p of st.party) { p.hpMax = 300; p.hp = 300; }       /* the tools are under test here, not the party's luck */
      const sc = x('start_combat', {});
      row(sc.ok && st.round && sc.result.order.length === 3 && sc.result.order.some((o) => o.id === cn.result.id && o.side === 'hostile') && sc.result.hostiles[0].hp === 11 && sc.result.turn.round === 1, 'start_combat rolls initiative and reports the order by the ids the model knows');
      const saw = { atk: 0, wrong: 0, end: 0, told: true, peace: 0 };
      for (let g = 0; g < 60 && st.round; g++) {
        const a = turnOf(st), aid = a.pc ? a.id : a.o.npc, other = a.pc ? cn.result.id : 'P1', b4 = snap(st);
        const w = x('attack', { attacker_id: other, target_id: aid }); if (!w.ok && /turn/.test(w.error) && snap(st) === b4) saw.wrong++;
        const tgt = a.pc ? cn.result.id : (st.party.find((p) => p.status === 'ok') || {}).id;
        if (a.pc) { const pz = x('attack', { attacker_id: aid, target_id: 'N0' }); if (!pz.ok && /no harm/.test(pz.error) && snap(st) === b4) saw.peace++; x('move', { id: aid, toward: cn.result.id }); }
        const r = x('attack', { attacker_id: aid, target_id: tgt });
        if (r.ok) { saw.atk++; if (!(typeof r.result.to_hit === 'number' && r.result.turn && / at /.test(r.say))) saw.told = false; }
        if (!st.round) break;
        if (x('end_turn', {}).ok) saw.end++;
      }
      row(saw.atk >= 2 && saw.wrong >= 2 && saw.end >= 1 && saw.told, 'in a fight the Game Master can act only for whoever\'s turn it is, and each blow is reported: ' + JSON.stringify(saw));
      row(saw.peace >= 1, 'and nobody peaceful can be struck, whoever asks');
      if (st.round) x('end_combat', { outcome: 'truce' });
      row(!st.round, 'the fight ends (won, lost or called off)');
      /* the rest of the tale's furniture */
      if (!st.over && st.here === 'S1' && st.party[0].status === 'ok') {
        const P = st.party[0], inv = x('inventory', { op: 'give', character_id: P.id, item: 'cell key', qty: 2 });
        row(inv.ok && P.items.find((q) => q.n === 'cell key').q === 2 && x('inventory', { op: 'take', character_id: P.id, item: 'Cell Key' }).ok && P.items.find((q) => q.n === 'cell key').q === 1, 'inventory gives and takes, by name whatever the case');
        const g0 = st.gold; row(x('inventory', { op: 'gold', amount: 7 }).ok && st.gold === g0 + 7 && !x('inventory', { op: 'gold', amount: -(g0 + 8) }).ok && st.gold === g0 + 7, 'gold comes and goes, and never below nothing');
        const hp0 = P.hp, uc = x('update_character', { character_id: P.id, hp_change: -1, add_conditions: ['poisoned'], xp: 50, note: 'Bitten by the cellar rat.' });
        row(uc.ok && P.hp === Math.max(0, hp0 - 1) && P.conditions.includes('poisoned') && P.xp >= 50 && st.facts.some((f) => f.subject === P.id), 'update_character applies harm, a condition, experience and a note in one call');
        const uq = x('update_quest', { op: 'add', title: 'Find the ledger', goal: 'It names every hand that took the coin.' });
        row(uq.ok && st.quests[uq.result.id].status === 'active' && x('update_quest', { op: 'complete', quest_id: uq.result.id, note: 'Found under the chief\'s bed.' }).ok && st.quests[uq.result.id].status === 'done' && !x('update_quest', { op: 'fail', quest_id: uq.result.id }).ok, 'a quest is added, noted, closed, and cannot be closed twice');
        const f0 = st.facts.length;
        row(x('record_fact', { subject: 'N0', text: 'Owes the chief forty crowns.' }).ok && st.facts.length === f0 + 1 && x('record_fact', { subject: 'N0', text: 'owes the chief forty crowns.' }).result.duplicate && st.facts.length === f0 + 1 && x('record_fact', { subject: st.npcs.N0.name, text: 'Keeps a cudgel under the bar.' }).ok, 'record_fact writes canon once, by id or by name');
        const lk = x('lookup', { query: 'forty crowns' }), b3 = snap(st); x('lookup', { query: 'cudgel' });
        row(lk.ok && lk.result.matches.some((s) => /forty crowns/.test(s)) && snap(st) === b3, 'lookup finds it, and reading changes nothing');
        row(x('end_scene', { summary: 'The party met the innkeeper and learned of his debt.' }).ok && st.summaries.length === 1, 'end_scene keeps a summary');
        const t0 = st.time.minute, at = x('advance_time', { minutes: 90 });
        row(at.ok && st.time.minute === t0 + 90, 'advance_time moves the clock');
        const tp = x('travel_party', { to: st.sites.S0.name });
        row(tp.ok && st.here === 'S0' && st.party.every((p) => p.site === 'S0') && st.time.minute === t0 + 95, 'travel_party takes everyone to a place by its name, and the walk takes five minutes');
        /* what the Game Master is told */
        const ctx2 = turnContext(st, { who: P.name, id: P.id, text: 'Where does the innkeeper keep his forty crowns?', to: 'N0 ' + st.npcs.N0.name }, { rating: 'family', monsters: 'script' });
        row(/BOARD IN PLAY: S0/.test(ctx2) && /CANON/.test(ctx2) && /forty crowns/.test(ctx2) && /STORY SO FAR/.test(ctx2) && /Party \(shared gold/.test(ctx2) && /content rating family/.test(ctx2) && ctx2.trim().endsWith('says: Where does the innkeeper keep his forty crowns?') && /speaking to N0/.test(ctx2),
          'the turn context carries the board, the party, the canon that bears on the line, the story so far, and ends with the line itself');
        row(/played by: the engine/.test(ctx2) && /played by: YOU/.test(turnContext(st, { text: '' }, { monsters: 'gm', stage: 'x' })) && turnContext(st, {}, { stage: 'STAGE DIRECTION - test' }).trim().endsWith('STAGE DIRECTION - test'), 'it says who plays the monsters, and a stage direction takes the place of the line');
        /* fog honesty: the digest marks exactly what the party can see */
        const town = st.maps.S0, V = visOf(st).g, dg = boardDigest(st); let honest = true, n = 0;
        for (const t of town.tokens) { const line = dg.split('\n').find((l) => l.startsWith('  ' + t.npc + ' ')); if (!line) { honest = false; continue; } n++; if (/IN SIGHT of the party/.test(line) !== !!V[t.y * town.w + t.x]) honest = false; if (!line.includes('(' + t.x + ',' + t.y + ')')) honest = false; }
        row(honest && n === town.tokens.length && n >= 3, 'the board digest lists every person with where they stand, and marks IN SIGHT exactly those the party can see (' + n + ' people)');
        const inn = st.maps.S1; intent(st, { t: 'jump', site: 'S1' }); const dg2 = boardDigest(st); let roomsOK = true;
        inn.rooms.forEach((r, k) => { let a2 = 0, b = 0; for (let i = 0; i < inn.w * inn.h; i++) if (inn.rg[i] === k + 1) { a2++; if (inn.seen[i]) b++; } const line = dg2.split('\n').find((l) => l.startsWith('  ' + r.id + ' ')); if (!line || /UNSEEN by the party/.test(line) !== (b === 0)) roomsOK = false; });
        row(roomsOK && /Doors: D0/.test(dg2) && /Ways out: E0 to S0/.test(dg2), 'and every room, with UNSEEN on exactly the rooms nobody has looked into; then the doors and the ways out');
        row(dg2.includes(table.id + ' ' + ASSETS[table.a].n.toLowerCase()) && /\d+ x chair|\d+ x stool/.test(dg2), 'things are named with their ids; chairs and stools are only counted');
        /* the prefix that is cached must not move */
        const bt = bibleText(st);
        row(bt === bible0 && bt === bibleText(unpackState(JSON.parse(JSON.stringify(packState(st))))) && /WORLD BIBLE/.test(bt) && bt.includes(st.bible.town) && bt.includes(st.npcs.N5.name) && !/forty crowns/.test(bt) && !bt.includes(String(st.gold) + ' gold'), 'the bible text is what it was before any of this, and the same after a save: nothing that changes in play is in it, so the cached prefix stays byte-stable');
        row(SYSTEM_PROMPT.length > 6000 && /never work out distances/.test(SYSTEM_PROMPT) && /Fog of war is real/.test(SYSTEM_PROMPT) && Object.keys(CLASSES).every((c) => SYSTEM_PROMPT.includes(c)) && SYSTEM_PROMPT.includes('bandit captain') && SYSTEM_PROMPT.includes('flower_pot'), 'the instructions name the callings, the bestiary and the asset library, and tell the model it never does geometry');
        const a = snap(st), b = snap(unpackState(JSON.parse(JSON.stringify(packState(st)))));
        row(a === b && st.facts.length >= 3 && st.summaries.length === 1, 'and after all of that a save round-trips byte for byte');
      } else row(false, 'the party did not come through the tools\' fight in a state to go on (' + st.over + ' ' + st.here + ')');

      /* ---- the calls a first pass did not ask for. Every row from here on was written for a deliberate break the rows above let through. ---- */
      {
        const st = newGame('tools-2'), x = (n, i) => exec(st, n, i), inn = st.maps.S1, P = st.party[0];
        const force = (v) => { for (let n = st.n.roll; n < st.n.roll + 4000; n++) if (1 + Math.floor(rngFor(st.seed, 'dice', n)() * 20) === v) { st.n.roll = n; return true; } return false; };
        const seenIn = (m, k) => { let n = 0; for (let i = 0; i < m.w * m.h; i++) if ((!k || m.rg[i] === k) && m.seen[i]) n++; return n; };
        const lineOf = (dg, id) => dg.split('\n').find((l) => l.startsWith('  ' + id + ' ')) || '';
        const dg0 = boardDigest(st);
        row(inn.tokens.length === 4 && inn.tokens.every((t) => { const l = lineOf(dg0, t.npc); return /out of the party.s sight/.test(l) && !/IN SIGHT/.test(l) && /peaceful/.test(l) && !/ AC \d/.test(l); }), 'behind a shut door the digest marks everyone out of the party\'s sight, peaceful, and with no stat block they have not earned');
        row(/\[a placeholder nobody has claimed/.test(partyDigest(st)), 'the party digest marks the nameless placeholder that create_character fills');
        row(TOOL_NAMES.filter((n) => TOOLS[n].ro).join() === 'lookup', 'lookup is the one tool that only reads');
        /* dice */
        force(10); const eq = x('roll_check', { character_id: 'P1', check: 'athletics', dc: 14 }); force(10); const lt = x('roll_check', { character_id: 'P1', check: 'athletics', dc: 15 });
        row(eq.ok && eq.result.natural === 10 && eq.result.total === 14 && eq.result.success === true && lt.ok && lt.result.total === 14 && lt.result.success === false, 'a check that meets its DC exactly succeeds; one short of it fails');
        /* doors */
        const D2 = inn.doors.find((d) => d.id === 'D2'), far = doorSides(D2).find((q) => !inn.seen[q[1] * inn.w + q[0]]), s0 = seenIn(inn);
        const od = x('set_door', { door_id: 'D2', open: true });
        row(far && od.ok && D2.open && seenIn(inn) > s0 && inn.seen[far[1] * inn.w + far[0]] === 1, 'a door the Game Master opens lets the party see through it at once');
        const lk = x('set_door', { door_id: 'D2', locked: true });
        row(lk.ok && D2.lock && !D2.open, 'locking an open door shuts it');
        x('set_door', { door_id: 'D2', open: true, locked: false });
        /* showing one room shows one room */
        const R4 = inn.rooms.findIndex((r) => r.id === 'R4') + 1, R6 = inn.rooms.findIndex((r) => r.id === 'R6') + 1, was6 = seenIn(inn, R6), rv = x('reveal', { room_id: 'R4' });
        let all4 = true; for (let i = 0; i < inn.w * inn.h; i++) if (inn.rg[i] === R4 && !inn.seen[i]) all4 = false;
        row(rv.ok && all4 && rv.result.squares_newly_shown >= 15 && seenIn(inn, R6) === was6 && was6 === 0, 'reveal with a room shows that room and no other');
        /* things */
        const chair = inn.objs.find((o) => !o.on && !ASSETS[o.a].surf), b1 = snap(st), onChair = x('place_object', { asset: 'coins', on: chair.id });
        row(!onChair.ok && /surface/.test(onChair.error) && snap(st) === b1, 'a small thing cannot be set on something that is no surface');
        const tbl = inn.objs.find((o) => !o.on && ASSETS[o.a].surf && !(inn._.kids.get(o.id) || []).length), cap = ASSETS[tbl.a].surf * ASSETS[tbl.a].w * ASSETS[tbl.a].h; let put = 0, full = null;
        for (let k = 0; k < cap + 3; k++) { const r = x('place_object', { asset: 'coins', on: tbl.id }); if (r.ok) put++; else { full = r; break; } }
        const kids = (inn._.kids.get(tbl.id) || []).map((k) => k.id);
        row(put === cap && full && /no room left/.test(full.error) && kids.length === cap && new Set((inn._.kids.get(tbl.id) || []).map((k) => k.slot)).size === cap, 'a surface holds what it holds: ' + cap + ' on the ' + ASSETS[tbl.a].n.toLowerCase() + ', each in a place of its own, and then no more');
        const rm = x('remove_object', { object_id: tbl.id });
        row(rm.ok && !inn._.byId.get(tbl.id) && kids.every((id) => !inn._.byId.get(id)) && !inn.objs.some((o) => o.on === tbl.id), 'taking a table away takes what stood on it');
        const rev0 = inn.rev | 0, n0 = inn.objs.length, ch = x('place_object', { asset: 'chest', near: 'R1' });
        row(ch.ok && (inn.rev | 0) === rev0 + 1 && inn.objs.length === n0 + 1, 'a thing set on the floor tells the board it has changed, so it is painted');
        const b2 = snap(st), onDoor = x('place_object', { asset: 'rubble', near: 'D2' }), onMe = x('place_object', { asset: 'rubble', near: P.x + ',' + P.y });
        row(!onDoor.ok && !onMe.ok && /no free place/.test(onDoor.error) && snap(st) === b2, 'nothing is set down in a doorway or on the square someone stands on, even a thing that does not block');
        /* people */
        const cn = x('create_npc', { role: 'bandit scout', hostile: true, near: 'R1' }), sc = cn.ok && inn.tokens.find((t) => t.npc === cn.result.id);
        const hidden = cn.ok && cn.result.in_the_partys_sight === false && !(st.met.S1 || []).includes(sc.id) && cn.say === '';
        const mv = x('move', { id: cn.result.id, toward: 'P1' });
        row(hidden && mv.ok && mv.result.beside_it && meleeClear(inn, sc.x, sc.y, P.x, P.y) && (st.met.S1 || []).includes(sc.id), 'a hostile set down out of sight is unknown to the party until the Game Master walks them in: then they are met');
        const b5 = snap(st), thru = x('move', { id: 'N0', toward: 'P1' });
        row(!thru.ok && /no way/.test(thru.error) && snap(st) === b5, 'nobody is walked through someone standing in the only way: the innkeeper cannot be brought to the party past the scout');
        const dl = lineOf(boardDigest(st), cn.result.id);
        row(/HOSTILE/.test(dl) && /IN SIGHT of the party/.test(dl) && /; bandit AC 12 HP 11\/11 \[scimitar\]/.test(dl), 'and the digest then says so: hostile, in sight, with the block they fight by:' + dl.replace(/^.* - /, ' '));
        /* a fight */
        for (const p of st.party) { p.hpMax = 300; p.hp = 300; }
        const sc0 = x('start_combat', {}), S = sheetOf(st, sc, true); S.hpMax = S.hp = 400;
        const ctxF = turnContext(st, { who: 'x', text: 'Zzz.' }, {});
        row(sc0.ok && /FIGHT, round 1\. Order: /.test(ctxF) && /Acting now: \S+ .* ft of movement, 1 action, 1 bonus action left\./.test(ctxF) && !/No fight is in progress/.test(ctxF), 'in a fight the turn context gives the order, and what the one acting has left');
        const b3 = snap(st), tp = x('travel_party', { to: 'S0' }), ec = x('end_combat', { outcome: 'won' });
        row(!tp.ok && /fight/.test(tp.error) && !ec.ok && /truce or fled/.test(ec.error) && snap(st) === b3 && st.round && st.here === 'S1', 'nobody walks out of a fight by travel_party, and a fight is not ended by declaring it won');
        const act = turnOf(st), om = x('move', { id: act.pc ? cn.result.id : 'P1', toward: 'R3' });
        row(!om.ok && /turn/.test(om.error) && snap(st) === b3, 'in a fight only whoever\'s turn it is can be moved');
        for (let g = 0; g < 6 && st.round && !turnOf(st).pc; g++) x('end_turn', {});
        const adv = x('attack', { attacker_id: 'P1', target_id: cn.result.id, mode: 'advantage' });
        row(adv.ok && adv.result.mode === 'advantage' && adv.result.rolls.length === 2, 'the Game Master may grant advantage for what the engine cannot see: two dice, the higher kept');
        st.round.act = 1; const left0 = moveLeft(st.round), dm = x('move', { id: 'P1', toward: 'R5', dash: true });
        row(dm.ok && st.round.extra === 30 && st.round.act === 0 && dm.result.move_left_ft === left0 + 30 - dm.result.moved_ft, 'move with dash spends the action on 30 ft more: ' + (dm.ok ? dm.result.move_left_ft + ' ft left of ' + left0 : dm.error));
        const nd = x('move', { id: 'P1', toward: 'R5', dash: true });
        row(!nd.ok && /action/i.test(nd.error) && st.round.extra === 30, 'and cannot be asked twice in a turn');
        x('end_combat', { outcome: 'fled' });
        /* numbers and words out of bounds */
        const b4 = snap(st), nos = [['inventory', { op: 'gold', amount: 0 }], ['inventory', { op: 'gold', amount: 2.5 }], ['inventory', { op: 'gold', amount: 200000 }], ['inventory', { op: 'give', character_id: 'P1', item: '' }], ['inventory', { op: 'give', character_id: 'P1', item: 'rope', qty: 0 }],
          ['inventory', { op: 'give', character_id: 'P1', item: 'rope', qty: 1000 }], ['inventory', { op: 'give', character_id: 'P1', item: 'rope', qty: 1.5 }], ['inventory', { op: 'take', character_id: 'P1', item: 'bedroll', qty: 2 }], ['update_character', { character_id: 'P1', xp: -5 }],
          ['update_character', { character_id: 'P1', xp: 20001 }], ['update_character', { character_id: 'P1', hp_change: 0.5 }], ['update_quest', { op: 'burn' }], ['advance_time', { minutes: 10081 }]];
        const let2 = nos.filter(([n, i]) => x(n, i).ok).map(([n, i]) => n + ' ' + JSON.stringify(i));
        row(!let2.length && snap(st) === b4, nos.length + ' more bad calls, each a number or a word out of bounds, are refused and change nothing' + (let2.length ? ' (accepted: ' + let2.join('; ') + ')' : ''));
        const had = P.items.length, tk = x('inventory', { op: 'take', character_id: 'P1', item: 'bedroll' });
        row(tk.ok && tk.result.left === 0 && P.items.length === had - 1 && !P.items.some((q) => q.n === 'bedroll'), 'the last of a thing taken leaves no empty line on the sheet');
        /* what reaches the Game Master, and why */
        x('record_fact', { subject: 'N0', text: 'Waters the ale after dark.' }); x('record_fact', { subject: 'N5', text: 'Carries the strongbox key on a chain.' });
        st.story.push({ t: 'chip', text: 'Chip Alpha happened.', turn: 0, k: 'fight' }, { t: 'gm', text: 'The door creaks.', turn: 0 }, { t: 'chip', text: 'Chip Beta happened.', turn: 1, k: 'fight' }, { t: 'pl', text: 'I listen.', turn: 1, who: 'Maud', id: 'P1' });
        const cA = turnContext(st, { who: 'Maud', id: 'P1', text: 'Zzz qqq.' }, {}), cB = turnContext(st, { who: 'Maud', id: 'P1', text: 'Who holds the strongbox?' }, {});
        row(/Waters the ale/.test(cA) && !/strongbox key/.test(cA) && /strongbox key/.test(cB) && /Waters the ale/.test(cB), 'canon reaches the Game Master by what is at hand (a fact about someone on the board) and by the words of the line (a fact about someone far off, once asked after)');
        const since = (cA.split('SINCE YOU LAST SPOKE')[1] || '').split('\n\n')[0];
        row(/Chip Beta/.test(since) && !/Chip Alpha/.test(since), 'it is told what the board did since it last spoke, and not what it was told before');
        row(/RECENT EXCHANGES:\n {2}GM: The door creaks\.\n {2}Maud: I listen\./.test(cA), 'and the last things said, in order, by whom');
      }
      /* harm done by the Game Master's hand, in a fight */
      {
        const st = newGame('harm-1'), x = (n, i) => exec(st, n, i); intent(st, { t: 'party', op: 'add' }); intent(st, { t: 'party', op: 'add' });
        const [A, B, C] = st.party; x('create_npc', { role: 'bandit', hostile: true, near: 'P1' }); x('start_combat', {});
        const k1 = x('update_character', { character_id: 'P3', hp_change: -999 }), k2 = x('update_character', { character_id: 'P3', hp_change: 5 });
        row(k1.ok && C.status === 'dead' && st.party.includes(C) && st.round && !k2.ok && /is dead/.test(k2.error) && C.hp === 0, 'in a fight the dead stay where they fell until it is over, and nothing changes them');
        const d1 = x('update_character', { character_id: 'P1', hp_change: -A.hp }), mid = !!st.round && A.status === 'down', d2 = x('update_character', { character_id: 'P2', hp_change: -B.hp });
        row(d1.ok && mid && d2.ok && /beaten/.test(d2.result.fight || '') && !st.round && st.party.length === 2 && st.fallen.length === 1 && st.fallen[0].name === C.name && st.here === 'S1' && st.party.every((p) => p.hp === 1 && p.status === 'ok'),
          'harm that takes the last one standing ends the fight then and there: the dead are mourned, the rest wake at the inn');
      }
      /* ...and outside one */
      {
        const st = newGame('harm-2'), x = (n, i) => exec(st, n, i); intent(st, { t: 'party', op: 'add' }); intent(st, { t: 'jump', site: 'S0' });
        const [A, B] = st.party, g0 = st.gold, u1 = x('update_character', { character_id: 'P2', hp_change: -B.hp }), rc = x('roll_check', { character_id: 'P2', check: 'stealth', dc: 10 });
        row(u1.ok && B.status === 'stable' && B.hp === 0 && st.here === 'S0' && !rc.ok && /cannot act/.test(rc.error), 'outside a fight someone struck down is tended at once (stable, not dying), and can attempt nothing');
        const u2 = x('update_character', { character_id: 'P1', hp_change: -A.hp });
        row(u2.ok && u2.result.party_rescued === true && st.here === 'S1' && st.party.every((p) => p.hp === 1 && p.status === 'ok') && st.gold === Math.floor(g0 / 2) && /carried back to the inn/.test(u2.say), 'and when the last one standing falls, the party is carried back to the inn: one hit point each, half the purse');
      }
      /* attitudes in the middle of a fight */
      {
        const st = newGame('peace-1'), x = (n, i) => exec(st, n, i), m = st.maps.S1;
        const a = x('create_npc', { role: 'bandit', hostile: true, near: 'P1' }), b = x('create_npc', { role: 'bandit', hostile: true, near: 'P1' }), ta = m.tokens.find((t) => t.npc === a.result.id), tb = m.tokens.find((t) => t.npc === b.result.id);
        for (const p of st.party) { p.hpMax = 300; p.hp = 300; }
        x('start_combat', {}); for (let g = 0; g < 6 && !turnOf(st).pc; g++) x('end_turn', {});
        const pa = x('update_npc', { npc_id: a.result.id, attitude: 'neutral' });
        row(pa.ok && st.round && ta.k === 'npc' && m.tokens.includes(ta) && tokenAt(m, ta.x, ta.y) === ta && !st.round.order.some((c) => c.id === ta.id) && st.round.order.some((c) => c.id === tb.id) && turnOf(st).pc, 'someone who makes peace in the middle of a fight leaves the order and stays on the board; the fight goes on with the rest');
        const kb = x('update_npc', { npc_id: b.result.id, status: 'dead' });
        row(kb.ok && !m.tokens.includes(tb) && tokenAt(m, tb.x, tb.y) !== tb && st.npcs[b.result.id].status === 'dead' && !st.round && /fight/i.test(kb.result.fight || ''), 'and when the last enemy is declared dead they leave the board, and the fight is over: ' + (kb.ok ? kb.say : kb.error));
      }
      /* a truce, and a flight */
      {
        const st = newGame('truce-1'), x = (n, i) => exec(st, n, i), m = st.maps.S1, a = x('create_npc', { role: 'bandit', hostile: true, near: 'P1' }), ta = m.tokens.find((t) => t.npc === a.result.id);
        x('start_combat', {}); const tr = x('end_combat', { outcome: 'truce' });
        row(tr.ok && !st.round && ta.k === 'npc' && st.npcs[a.result.id].kind === 'npc' && /truce/.test(tr.say), 'a truce ends the fight and the enmity: those who stood down are enemies no longer');
        x('update_npc', { npc_id: a.result.id, attitude: 'hostile' }); x('start_combat', {}); const fl = x('end_combat', { outcome: 'fled' });
        row(fl.ok && !st.round && ta.k === 'foe' && /broken off/.test(fl.say), 'a fight broken off leaves them enemies still');
      }
      /* how many a board holds, and where they stand */
      {
        const st = newGame('crowd-1'), m = st.maps.S1; let made = 0, said = '';
        for (let k = 0; k < 60; k++) { const r = exec(st, 'create_npc', { role: 'extra', near: 'R1' }); if (!r.ok) { said = r.error; break; } made++; }
        const sq = new Set(m.tokens.map((t) => t.x + ',' + t.y).concat(st.party.map((p) => p.x + ',' + p.y)));
        row(m.tokens.length === 40 && made === 36 && /crowded/.test(said) && sq.size === m.tokens.length + st.party.length && m.tokens.every((t) => tileFree(m, t.x, t.y) && tokenAt(m, t.x, t.y) === t), 'a board takes forty people and no more, each on a free square of their own (' + made + ' set down in the common room: ' + said + ')');
      }
      /* the captive */
      {
        const st = newGame('cap-1'); intent(st, { t: 'jump', site: 'S2' });
        const cv = st.maps.S2, cap = cv.tokens.find((t) => t.k === 'captive'), b = snap(st), r = exec(st, 'move', { id: cap.npc, toward: 'P1' });
        row(cap && !r.ok && /held/.test(r.error) && snap(st) === b, 'a captive cannot be walked anywhere while they are held');
        const fr = exec(st, 'update_npc', { npc_id: cap.npc, attitude: 'free' });
        row(fr.ok && cap.k === 'npc' && st.npcs[cap.npc].kind === 'npc' && /is free/.test(fr.say), 'until update_npc frees them');
      }
      return rows;
    });
    for (const [c, m] of rows) ok(c, m);
    await S0.ctx.close();
  }
  }

  if (want('T')) {
  /* ------------------------------------------------------------------ T */
  console.log('T. the Game Master at the table');
  {
    const KEY = 'sk-ant-test-key-7f3a';
    /* ---- the real client, against a stand-in for api.anthropic.com ---- */
    const T1 = await open({ width: 390, height: 844 }, null, { storyOpen: true }), page = T1.page;
    const calm = (pg, ms) => pg.waitForFunction(() => G.st && !G.busy && !Session.beats.length && !G.st.walk && !View.walking && View.anim.t >= 1 && !document.getElementById('veil').classList.contains('on'), null, { timeout: ms || 15000 });
    const snapOf = (pg, noCosts) => pg.evaluate((noCosts) => { const p = packState(G.st); delete p.saved; if (noCosts) delete p.costs; return JSON.stringify(p); }, !!noCosts);
    const sse = (events) => events.map((e) => 'event: ' + e.type + '\ndata: ' + JSON.stringify(e) + '\n\n').join('');
    const USAGE = { input_tokens: 10, cache_read_input_tokens: 5, output_tokens: 1 };
    const msg = (content, stop, model) => {
      const ev = [{ type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: model || 'claude-opus-5-5', content: [], usage: USAGE } }];
      content.forEach((b, i) => {
        if (b.type === 'thinking') ev.push({ type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '' } }, { type: 'content_block_delta', index: i, delta: { type: 'signature_delta', signature: b.signature } });
        else if (b.type === 'text') { ev.push({ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } }); for (const piece of (b.whole ? [b.text] : b.text.match(/[\s\S]{1,7}/g))) ev.push({ type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: piece } }); }
        else if (b.type === 'tool_use') { const j = b.bad ? '{"expr": "1d6", "reason": ' : JSON.stringify(b.input); ev.push({ type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } }, { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: j.slice(0, 9) } }, { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: j.slice(9) } }); }
        ev.push({ type: 'content_block_stop', index: i });
      });
      ev.push({ type: 'message_delta', delta: { stop_reason: stop }, usage: { output_tokens: 20 } }, { type: 'message_stop' });
      return sse(ev);
    };
    const PER = (p) => (10 * p[0] + 20 * p[1] + 5 * p[2]) / 1e6;       /* what one stand-in reply costs at a price row [in, out, cache read] */
    const bodies = [], urls = [], tests = [];
    let mode = 'none', release = null, once = false, whole = false, tool = { name: 'create_character', input: { name: 'Ada', class: 'Wizard' } }, text = 'Ada the wizard wakes. <img src=x onerror="window.__pwned=1"> What do you do?';
    await page.route('**/*', async (route) => { const u = route.request().url(); if (/^https?:/.test(u) && !/fonts\.(googleapis|gstatic)\.com/.test(u)) urls.push(u); return route.fallback(); });
    await page.route('https://api.anthropic.com/v1/messages', async (route) => {
      const req = route.request(), body = JSON.parse(req.postData() || '{}');
      bodies.push({ body, headers: req.headers(), raw: req.postData() || '' }); urls.push(req.url());
      const json = (status, type, message) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type, message } }) });
      const stream = (b) => route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: b });
      if (mode === 'auth') return json(401, 'authentication_error', 'invalid x-api-key');
      if (body.stream === false) { tests.push(body); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: 'ready' }], stop_reason: 'end_turn', usage: { input_tokens: 12, output_tokens: 3 } }) }); }
      if (mode === 'busyOnce' && !once) { once = true; return json(529, 'overloaded_error', 'Overloaded'); }
      if (mode === 'fbAlways' && bodies.length <= 3) return json(400, 'invalid_request_error', 'fallbacks: model not permitted');     /* relents at the fourth asking, so a client that never gives up is caught by a count and not by a timeout */
      if (mode === 'refusal') return stream(msg([{ type: 'text', text: 'I will not.' }], 'refusal'));
      if (mode === 'slow') { await new Promise((res) => { release = res; }); return stream(msg([{ type: 'text', text: 'Too late.' }], 'end_turn')).catch(() => {}); }
      if (mode === 'fb' && body.fallbacks) return json(400, 'invalid_request_error', 'fallbacks: model not permitted');
      if (mode === 'effort' && body.output_config) return json(400, 'invalid_request_error', 'output_config.effort: Extra inputs are not permitted');
      const last = body.messages[body.messages.length - 1], isResult = Array.isArray(last.content) && last.content[0] && last.content[0].type === 'tool_result', served = mode === 'served' ? 'claude-opus-5' : body.model;
      if (mode === 'midfail' && isResult) return stream(sse([{ type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: body.model, content: [], usage: USAGE } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'The purse is ' } }, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }]));
      if (mode === 'silent') { const nudged = Array.isArray(last.content) && last.content.some((b) => b.type === 'text' && /Now narrate/.test(b.text)); return stream(body.messages.length === 1 ? msg([{ type: 'tool_use', id: 'tu1', name: 'roll_dice', input: { expr: '1d6' } }], 'tool_use') : nudged ? msg([{ type: 'text', text: 'The die comes up.' }], 'end_turn') : msg([], 'end_turn')); }
      if (mode === 'badjson' && !isResult) return stream(msg([{ type: 'tool_use', id: 'tu9', name: 'start_combat', bad: true }], 'tool_use'));
      if (!isResult && tool) return stream(msg([{ type: 'thinking', signature: 'SIG-abc' }, { type: 'tool_use', id: 'tu1', name: tool.name, input: tool.input }], 'tool_use', served));
      return stream(msg([{ type: 'text', text, whole }], 'end_turn', served));
    });
    const say = async (line, who) => { await page.evaluate(([line, who]) => { if (who != null) document.getElementById('say-who').value = who; document.getElementById('say').value = line; document.getElementById('say-send').click(); }, [line, who == null ? null : who]); await page.waitForFunction(() => G.busy || document.getElementById('dialog').classList.contains('open'), null, { timeout: 4000 }).catch(() => {}); await calm(page); };

    /* request shapes, model by model (ids and fields checked against the docs on 2026-10-10) */
    const shapes = await page.evaluate(() => {
      const set = { effort: 'medium' }, o = AnthropicGM.body(modelProfile({ model: 'claude-opus-5-5' }), set, [], true), s = AnthropicGM.body(modelProfile({ model: 'claude-sonnet-5-5' }), { effort: 'high' }, [], true), h = AnthropicGM.body(modelProfile({ model: 'claude-haiku-5-5' }), { effort: 'bogus' }, [], true),
        c = AnthropicGM.body(modelProfile({ model: 'custom', customModel: ' claude-next-9 ' }), set, [], true), hdr = AnthropicGM.headers('k', o.betas), raw = JSON.stringify(o.b);
      return { ids: MODELS.map((m) => m.id).join(), oThink: o.b.thinking && o.b.thinking.type, oEffort: o.b.output_config && o.b.output_config.effort, oFb: o.b.fallbacks, oBeta: o.betas.join(), oTools: o.b.tools.length, n: TOOL_NAMES.length, oChoice: 'tool_choice' in o.b, oCache: !!o.b.system[0].cache_control, oSys: o.b.system[0].text === SYSTEM_PROMPT, oMax: o.b.max_tokens, oStream: o.b.stream,
        sThink: s.b.thinking && s.b.thinking.type, sEffort: s.b.output_config.effort, sFb: 'fallbacks' in s.b, sBeta: s.betas.length, hThink: h.b.thinking && h.b.thinking.type, hEffort: h.b.output_config.effort, hFb: 'fallbacks' in h.b, cId: c.b.model, budget: /budget_tokens|temperature|top_p/.test(raw),
        hdrBrowser: hdr['anthropic-dangerous-direct-browser-access'], hdrVer: hdr['anthropic-version'], hdrKey: hdr['x-api-key'], hdrBeta: hdr['anthropic-beta'], url: API_URL };
    });
    ok(shapes.ids === 'claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5,custom' && shapes.url === 'https://api.anthropic.com/v1/messages' && shapes.cId === 'claude-next-9', 'the models offered are Opus 5.5, Sonnet 5.5, Haiku 5.5 and one typed by hand, and there is one address they are asked at');
    ok(shapes.oThink === 'adaptive' && shapes.oEffort === 'medium' && shapes.oFb === 'default' && shapes.oBeta === 'server-side-fallback-2026-07-01' && shapes.hdrBeta === shapes.oBeta && !shapes.budget, 'Opus 5.5: adaptive thinking, explicit effort, refusal fallbacks with their beta header; never a thinking budget or a sampling knob');
    ok(shapes.sThink === 'adaptive' && shapes.sEffort === 'high' && !shapes.sFb && shapes.sBeta === 0 && shapes.hThink === 'adaptive' && shapes.hEffort === 'medium' && !shapes.hFb, 'Sonnet 5.5 and Haiku 5.5: adaptive thinking and effort, no fallbacks field; an effort that is not one becomes medium');
    ok(!shapes.oChoice && shapes.oTools === shapes.n && shapes.oCache && shapes.oSys && shapes.oMax === 16000 && shapes.oStream === true && shapes.hdrBrowser === 'true' && shapes.hdrVer === '2023-06-01' && shapes.hdrKey === 'k', 'every tool declared, no forced tool choice, the instructions cached, streamed, with the browser-access and version headers');

    /* what is sent back as the assistant's turn inside a tool loop */
    const echo = await page.evaluate(() => { const E = (c) => AnthropicGM.echo(c).map((b) => b.type + (b.type === 'text' ? ':' + b.text : b.type === 'thinking' ? ':' + b.signature : b.type === 'tool_use' ? ':' + b.id + JSON.stringify(b.input) : '')).join('|');
      return { plain: E([{ type: 'thinking', thinking: 'hm', signature: 'S1' }, { type: 'text', text: 'Hello.' }, { type: 'tool_use', id: 't1', name: 'x', input: { a: 1 }, badJson: false }]), blank: E([{ type: 'text', text: ' \n ' }, { type: 'text', text: '' }, { type: 'tool_use', id: 't2', name: 'x' }]),
        fb: E([{ type: 'thinking', thinking: 'a', signature: 'OLD' }, { type: 'text', text: 'Before.' }, { type: 'tool_use', id: 'gone', name: 'x', input: {} }, { type: 'fallback' }, { type: 'thinking', thinking: 'b', signature: 'NEW' }, { type: 'tool_use', id: 't3', name: 'x', input: {} }]), red: E([{ type: 'redacted_thinking', data: 'zz' }, { type: 'tool_use', id: 't4', name: 'x', input: {} }]) }; });
    ok(echo.plain === 'thinking:S1|text:Hello.|tool_use:t1{"a":1}' && echo.blank === 'tool_use:t2{}' && echo.red === 'redacted_thinking|tool_use:t4{}', 'the assistant turn goes back as it came (thinking with its signature, redacted thinking, tool calls), less any text block that is empty or only space');
    ok(echo.fb === 'text:Before.|thinking:NEW|tool_use:t3{}', 'after a server-side fallback, what the first model thought and called is dropped and only its words are kept, ahead of the second model\'s turn');
    const price = await page.evaluate(() => { const u = (i, o, r, w) => ({ input_tokens: i, output_tokens: o, cache_read_input_tokens: r || 0, cache_creation_input_tokens: w || 0 });
      return { opus: Costs.claude('claude-opus-5-5', u(1000, 500, 10000, 2000)).usd, sonnet: Costs.claude('claude-sonnet-5-5-20260901', u(1000, 500, 10000, 2000)).usd, h1: Costs.claude('claude-haiku-5-5', u(50000, 1000)).usd, h2: Costs.claude('claude-haiku-5-5', u(500, 1000, 100000)).usd, h3: Costs.claude('claude-haiku-5-5', u(500, 1000, 99500)).usd,
        hour: Costs.claude('claude-opus-5-5', Object.assign(u(0, 0, 0, 1000), { cache_creation: { ephemeral_1h_input_tokens: 400 } })).usd, unk: Costs.claude('some-new-model', u(5, 5)), fmt: [Costs.fmt(1.5), Costs.fmt(.01234), Costs.fmt(NaN)].join() }; });
    const near = (a, b) => Math.abs(a - b) < 1e-12;
    ok(near(price.opus, (1000 * 4 + 500 * 20 + 10000 * .2 + 2000 * 5) / 1e6) && near(price.sonnet, (1000 * 2 + 500 * 10 + 10000 * .1 + 2000 * 2.5) / 1e6) && near(price.hour, (600 * 5 + 400 * 8) / 1e6), 'prices: Opus 5.5 and Sonnet 5.5 from the usage a reply reports (a dated id is priced as its family), cache reads and writes at their own rates, an hour-long cache write at twice the input price');
    ok(near(price.h1, (50000 * .1 + 1000 * .5) / 1e6) && near(price.h2, (500 * .5 + 1000 * 2.5 + 100000 * .05) / 1e6) && near(price.h3, (500 * .1 + 1000 * .5 + 99500 * .01) / 1e6), 'Haiku 5.5 has a second price above 100,000 prompt tokens, cached or not; at exactly 100,000 it is still the first');
    ok(!price.unk.known && price.unk.usd === 0 && price.fmt === '$1.50,$0.0123,$?', 'a model nobody has priced is not guessed at');

    /* the opening, through the real client */
    await page.evaluate((k) => { Settings.setKey(k, false); document.getElementById('btn-new').click(); }, KEY);
    await page.waitForFunction(() => G.st && G.st.turn >= 1 && !G.busy, null, { timeout: 12000 }); await calm(page);
    let r = await page.evaluate(() => ({ party: G.st.party.map((c) => c.name + ':' + c.cls + ':' + c.stock).join(), gm: [...document.querySelectorAll('#story-log .st-gm')].map((x) => x.textContent).join(' '), img: document.querySelectorAll('#story-log img, #story-log script').length, pwned: window.__pwned || 0, dlg: document.getElementById('dialog').classList.contains('open'),
      story: G.st.story.map((e) => e.t).join(), chip: G.st.story.find((e) => e.t === 'chip').text, told: Object.keys(G.st.told).sort().join(), open: document.getElementById('story').classList.contains('open'), first: !!document.querySelector('#story-log .st-gm.first'), turn: G.st.turn, costs: G.st.costs.slice(), tag: (document.querySelector('#story-log .cost-tag') || { textContent: '' }).textContent, letter: document.querySelector('#chips .chip.pc').textContent.charAt(0) }));
    ok(bodies.length === 2 && !r.dlg && r.open, 'with a key, a new tale opens in the story, told by the Game Master: one request, then one more after its tool call');
    ok(r.party === 'Ada:Wizard:false' && r.letter === 'A' && /Ada the Wizard joins the tale/.test(r.chip), 'a streamed tool call (its JSON split across deltas) runs through the engine: the placeholder has become Ada the wizard, on the board and on the bar');
    ok(/Ada the wizard wakes\. <img src=x onerror="window\.__pwned=1"> What do you do\?/.test(r.gm) && r.img === 0 && r.pwned === 0 && r.first, 'the streamed words become the telling, as text: markup from the model is never markup on the page');
    ok(r.story === 'chip,gm' && r.told === 'S1,open' && r.turn === 1, 'the tale keeps the telling: what the engine did, then what was said, and that this place has been told');
    const first = bodies[0].body, second = bodies[1].body, asst = second.messages[1], res = second.messages[2];
    ok(first.messages.length === 1 && first.messages[0].content[0].cache_control && /^WORLD BIBLE/.test(first.messages[0].content[0].text) && !first.messages[0].content[1].cache_control && /^TURN CONTEXT/.test(first.messages[0].content[1].text) && /STAGE DIRECTION - the tale begins now/.test(first.messages[0].content[1].text) && /BOARD IN PLAY: S1/.test(first.messages[0].content[1].text),
      'the request: the world bible as a cached block, then the turn context with the board in words and the stage direction');
    ok(asst && asst.role === 'assistant' && asst.content[0].type === 'thinking' && asst.content[0].signature === 'SIG-abc' && asst.content[1].type === 'tool_use' && asst.content[1].input.class === 'Wizard' && res.role === 'user' && res.content[0].type === 'tool_result' && res.content[0].tool_use_id === 'tu1' && !res.content[0].is_error && /"took_the_place_of_a_placeholder":true/.test(res.content[0].content),
      'the assistant turn is echoed back unchanged, thinking signature and all, and the tool result follows in one user message');
    ok(bodies.every((b) => b.headers['x-api-key'] === KEY && !b.raw.includes(KEY)) && urls.every((u) => u === 'https://api.anthropic.com/v1/messages') && urls.length === 2, 'the key travels in the x-api-key header and nowhere else, and nothing but the Game Master is ever asked for anything');
    ok(r.costs.length === 1 && r.costs[0].task === 'opening' && r.costs[0].calls === 2 && r.costs[0].model === 'claude-opus-5-5' && Math.abs(r.costs[0].usd - 2 * PER([4, 20, .2])) < 1e-12 && r.costs[0].tok.in === 20 && r.costs[0].tok.read === 10 && r.costs[0].tok.out === 40 && r.tag === '$0.0009 · Opus 5.5 · 2 calls',
      'the telling is billed from the usage each reply reported, at Opus 5.5\'s prices, and the page says so under it: ' + r.tag);

    /* a player's line */
    tool = { name: 'roll_check', input: { character_id: 'P1', check: 'arcana', dc: 10, reason: '<b>runes</b>' } }; text = 'The runes mean nothing good.';
    bodies.length = 0; await say('What do the runes on the bedpost say?');
    r = await page.evaluate(() => ({ story: G.st.story.slice(2).map((e) => e.t + ':' + (e.who || '')).join(), ctx: '', chip: [...document.querySelectorAll('#story-log .st-chip.check')].map((x) => x.textContent).join(), b: document.querySelectorAll('#story-log b').length, pl: document.querySelector('#story-log .st-pl').textContent, turn: G.st.turn, min: G.st.time.minute, cost: G.st.costs[1], val: document.getElementById('say').value, who: document.getElementById('say-who').value }));
    const ctx1 = bodies[0].body.messages[0].content[1].text;
    ok(bodies.length === 2 && r.story === 'pl:Ada,chip:,gm:' && r.turn === 2 && r.val === '' && ctx1.trim().endsWith('PLAYER LINE - Ada (P1) says: What do the runes on the bedpost say?') && /RECENT EXCHANGES:\s+GM: Ada the wizard wakes/.test(ctx1), 'a typed line goes out as the speaker\'s, after what was said before; the reply is kept after it');
    ok(/Ada: Arcana \d+ against DC 10/.test(r.chip) && /<b>runes<\/b>/.test(r.chip) && r.b === 1 && /^AdaWhat do the runes/.test(r.pl), 'a roll the Game Master asked for is shown as it happened, its reason as text');
    ok(r.cost.task === 'turn' && r.cost.turn === 1 && /Ada: “What do the runes/.test(r.cost.desc) && r.min > 480 && r.min <= 485, 'a line and its answer take a couple of minutes of the tale\'s clock, and are billed as a player turn');
    /* a model pinned for a task: its own request shape, its own prices */
    await page.evaluate(() => { Settings.data.taskModels.turn = 'claude-haiku-5-5'; });
    tool = null; bodies.length = 0; await say('I get up.');
    r = await page.evaluate(() => G.st.costs[G.st.costs.length - 1]);
    ok(bodies.length === 1 && bodies[0].body.model === 'claude-haiku-5-5' && bodies[0].body.thinking.type === 'adaptive' && !bodies[0].body.fallbacks && !('anthropic-beta' in bodies[0].headers) && r.model === 'claude-haiku-5-5' && Math.abs(r.usd - PER([.1, .5, .01])) < 1e-12, 'with a model pinned for the players\' lines, they go to it in its own shape and are priced at its rates (Haiku 5.5)');
    await page.evaluate(() => { Settings.data.taskModels.turn = ''; });
    /* a request field the model will not take: learned from its own 400, once */
    mode = 'fb'; bodies.length = 0; await say('hello');
    ok(bodies.length === 2 && bodies[0].body.fallbacks && !bodies[1].body.fallbacks && !('anthropic-beta' in bodies[1].headers) && (await page.evaluate(() => G.st.turn)) === 4, 'a 400 that names fallbacks is retried once without them, and the turn goes through');
    mode = 'effort'; bodies.length = 0; await say('hello again');
    ok(bodies.length === 2 && bodies[0].body.output_config && !bodies[1].body.output_config && !bodies[1].body.fallbacks && bodies[1].body.thinking && (await page.evaluate(() => G.st.turn)) === 5, 'and one that names effort likewise, keeping what was learned before');
    mode = 'served'; bodies.length = 0; await say('and again');
    r = await page.evaluate(() => G.st.costs[G.st.costs.length - 1]);
    ok(bodies.length === 1 && !bodies[0].body.output_config && r.model === 'claude-opus-5' && Math.abs(r.usd - PER([5, 25, .5])) < 1e-12, 'a reply served by another model is priced as the model that answered');

    /* failures: the tale is put back exactly, and what was paid for is still billed */
    mode = 'auth'; bodies.length = 0;
    const before = await snapOf(page); await say('Is anyone there?');
    r = await page.evaluate(() => ({ sys: [...document.querySelectorAll('#story-log .st-sys')].map((x) => x.textContent).join('|'), btn: !!document.querySelector('#story-log .st-sys button'), val: document.getElementById('say').value, pl: document.querySelectorAll('#story-log .st-pl').length, plSt: G.st.story.filter((e) => e.t === 'pl').length, busy: G.busy, stop: document.getElementById('say-stop').hidden, send: !document.getElementById('say-send').hidden }));
    ok(bodies.length === 1 && (await snapOf(page)) === before && /the key was refused/.test(r.sys) && r.btn && r.val === 'Is anyone there?' && r.pl === r.plSt && !r.busy && r.stop && r.send, 'a refused key: the tale is byte for byte what it was, the story says why with a way to Settings, and the line is back in the box');
    await page.evaluate(() => { document.getElementById('say').value = ''; });
    mode = 'midfail'; tool = { name: 'inventory', input: { op: 'gold', amount: 5 } }; bodies.length = 0;
    const b4 = await snapOf(page, true), n0 = await page.evaluate(() => G.st.costs.length);
    await say('I count my coins.');
    r = await page.evaluate(() => ({ gold: G.st.gold, cost: G.st.costs[G.st.costs.length - 1], n: G.st.costs.length, chips: document.querySelectorAll('#story-log .st-chip').length, chipSt: G.st.story.filter((e) => e.t === 'chip').length, gm: [...document.querySelectorAll('#story-log .st-gm')].map((x) => x.textContent).join('|'), sys: [...document.querySelectorAll('#story-log .st-sys')].map((x) => x.textContent).join('|'), tags: [...document.querySelectorAll('#story-log .cost-tag')].map((x) => x.textContent), map: View.map === G.st.maps[G.st.here] }));
    ok(bodies.length === 2 && (await snapOf(page, true)) === b4 && r.gold === 10 && r.chips === r.chipSt && !/The purse is/.test(r.gm) && /overwhelmed/.test(r.sys) && r.map, 'a telling that dies half way, after the engine had already paid out gold: the tale is put back exactly as it was, and the page shows the board that is true');
    ok(r.n === n0 + 1 && r.cost.failed === 'busy' && r.cost.calls === 2 && Math.abs(r.cost.usd - (PER([4, 20, .2]) + (10 * 4 + 1 * 20 + 5 * .2) / 1e6)) < 1e-12 && r.tags.some((t) => /2 calls/.test(t)), 'but both replies were paid for, the half one included, and the ledger says so');
    await page.evaluate(() => { document.getElementById('say').value = ''; });

    /* while the Game Master speaks the table only shows; STOP gives the turn back */
    mode = 'slow'; tool = null; bodies.length = 0;
    const b5 = await snapOf(page);
    await page.evaluate(() => { document.getElementById('say').value = 'Wait for it.'; document.getElementById('say-send').click(); });
    await page.waitForFunction(() => G.busy, null, { timeout: 4000 });
    await page.waitForFunction(() => document.querySelector('#story-log .st-wait'), null, { timeout: 4000 });
    const lock = await page.evaluate(async () => {
      const st = G.st, m = View.map, a = actor(), E = eyes(); let tgt = null;
      for (let i = 0; i < m.w * m.h && !tgt; i++) { const x = i % m.w, y = (i - x) / m.w; if (E.vis[i] && tileFree(m, x, y) && !taken(st, m, x, y, '') && m._.dec[i] < 0 && m._.occ[i] < 0 && (x !== a.o.x || y !== a.o.y) && route(st, a, [[x, y]], true).ok) tgt = [x, y]; }
      UI.card(null); const s = w2s(tgt[0] + .5, tgt[1] + .5), at0 = [a.o.x, a.o.y];
      tapAt(s[0], s[1]);
      const walked = !!st.walk || View.walking, toast = document.getElementById('toast').textContent;
      document.getElementById('btn-init').click(); const round = !!st.round;
      document.getElementById('party-add').click(); const party = st.party.length;
      const toastEl = document.getElementById('toast'), tried = (fn) => { toastEl.textContent = ''; fn(); return toastEl.textContent; }, mark = () => JSON.stringify([st.party, st.time, st.round, st.n]), m0 = mark();
      const shut = [tried(() => UI.attack('K1')), tried(() => UI.ability('P1', 'Magic Missile', 'K1')), tried(() => UI.act1({ t: 'rest', kind: 'short' })), tried(() => UI.endTurn()), tried(() => UI.exportFile())];
      document.getElementById('say').value = 'A second line.'; const again = tried(() => UI.send()), kept = document.getElementById('say').value; document.getElementById('say').value = '';
      UI.saveNow(); await new Promise((res) => setTimeout(res, 300)); const rec = await Store.get('auto');
      return { shut: shut.concat([again]).filter((t) => !/Game Master is speaking/.test(t)).length, kept, same: mark() === m0, walked, toast, round, party, at: a.o.x === at0[0] && a.o.y === at0[1], stop: !document.getElementById('say-stop').hidden, send: document.getElementById('say-send').hidden, savedPl: rec.data.story.filter((e) => e.t === 'pl' && e.text === 'Wait for it.').length };
    });
    ok(!lock.walked && lock.at && /Game Master is speaking/.test(lock.toast) && !lock.round && lock.party === 1 && lock.stop && lock.send, 'while the Game Master is speaking a tap walks nobody, the dice and the party wait, and the send button has become STOP');
    ok(lock.savedPl === 0, 'and nothing is saved in the middle of a telling: the save on the device is the tale before it began');
    ok(lock.shut === 0 && lock.same && lock.kept === 'A second line.', 'a blow, a trick, a rest, the end of a turn, a file to save and a second line are each turned away with the same words, and the second line stays in the box');
    await page.evaluate(() => document.getElementById('say-stop').click());
    await page.waitForFunction(() => !G.busy, null, { timeout: 4000 });
    if (release) release();
    r = await page.evaluate(() => ({ sys: [...document.querySelectorAll('#story-log .st-sys')].length, val: document.getElementById('say').value, wait: !!document.querySelector('#story-log .st-wait'), stop: document.getElementById('say-stop').hidden }));
    ok((await snapOf(page)) === b5 && r.val === 'Wait for it.' && r.sys === 0 && !r.wait && r.stop, 'STOP: the telling is called off without a word of complaint, the tale is as it was, and the line is back in the box');
    await page.evaluate(() => { document.getElementById('say').value = ''; });

    /* a call the engine refuses goes back to the model as an error it can read */
    mode = 'none'; tool = { name: 'move', input: { id: 'P1', toward: 'the moon' } }; text = 'There is no moon in here.'; bodies.length = 0;
    await page.evaluate(() => { Settings.data.rating = 'family'; }); await say('I walk to the moon.');
    const refused = bodies.length === 2 ? bodies[1].body.messages[2].content[0] : {};
    ok(refused.type === 'tool_result' && refused.is_error === true && /"error":"Nothing on this board is called/.test(refused.content) && /content rating family/.test(bodies[0].body.messages[0].content[1].text), 'a refused tool call goes back flagged as an error, with the engine\'s reason in it; and the table\'s content rating travels in the turn context');
    await page.evaluate(() => { Settings.data.rating = 'teen'; });
    /* overloaded before a word has arrived: tried again */
    mode = 'busyOnce'; once = false; tool = null; text = 'The floor holds.'; bodies.length = 0; const turnA = await page.evaluate(() => G.st.turn);
    await say('I test the floor.');
    r = await page.evaluate(() => ({ turn: G.st.turn, cost: G.st.costs[G.st.costs.length - 1], sys: document.querySelectorAll('#story-log .st-sys').length, gm: G.st.story[G.st.story.length - 1].text }));
    ok(bodies.length === 2 && r.turn === turnA + 1 && r.cost.calls === 1 && !r.cost.failed && r.sys === 0 && r.gm === 'The floor holds.', 'an overloaded reply before a word has arrived is tried again after a moment: the turn goes through, and only the reply that came is paid for');
    /* a model that goes on refusing a field it has already been spared is not asked for ever */
    mode = 'fbAlways'; bodies.length = 0; const b6 = await snapOf(page); await say('I wait.');
    r = await page.evaluate(() => ({ sys: [...document.querySelectorAll('#story-log .st-sys')].map((x) => x.textContent).join('|'), val: document.getElementById('say').value }));
    ok(bodies.length === 1 && (await snapOf(page)) === b6 && /Something went wrong in the telling: fallbacks/.test(r.sys) && r.val === 'I wait.', 'a 400 that names a field already dropped is not healed twice: the turn fails in words, the tale and the ledger untouched');
    await page.evaluate(() => { document.getElementById('say').value = ''; });
    /* a reply the model declines */
    mode = 'refusal'; bodies.length = 0; const b7 = await snapOf(page, true), n7 = await page.evaluate(() => G.st.costs.length); await say('Tell me what you will not.');
    r = await page.evaluate(() => ({ sys: [...document.querySelectorAll('#story-log .st-sys')].map((x) => x.textContent).join('|'), gm: [...document.querySelectorAll('#story-log .st-gm')].map((x) => x.textContent).join('|'), cost: G.st.costs[G.st.costs.length - 1], n: G.st.costs.length }));
    ok(bodies.length === 1 && (await snapOf(page, true)) === b7 && /will not tell that part/.test(r.sys) && !/I will not\./.test(r.gm) && r.n === n7 + 1 && r.cost.failed === 'refusal', 'a reply the model declines is not kept as the telling: the tale is put back, the story says so, and the reply is still paid for');
    await page.evaluate(() => { document.getElementById('say').value = ''; });
    /* tools, then silence: asked once for the telling, without an empty turn ever being sent back */
    mode = 'silent'; bodies.length = 0; await say('I roll a die.');
    r = await page.evaluate(() => ({ gm: G.st.story[G.st.story.length - 1], cost: G.st.costs[G.st.costs.length - 1] }));
    const third = bodies.length === 3 ? bodies[2].body.messages : [[], [], { content: [] }];
    ok(bodies.length === 3 && third.length === 3 && third.every((m) => Array.isArray(m.content) && m.content.length > 0) && third[2].content[0].type === 'tool_result' && third[2].content[third[2].content.length - 1].text === 'Now narrate the result to the table.' && r.gm.t === 'gm' && r.gm.text === 'The die comes up.' && r.cost.calls === 3,
      'a model that calls its tools and then says nothing is asked once more for the telling, in the same user turn as the results: no empty message is ever sent');
    /* a tool call whose input arrives broken is not run on a guess */
    mode = 'badjson'; text = 'Nothing happens.'; bodies.length = 0; await say('I mumble.');
    const bj = bodies.length === 2 ? bodies[1].body.messages : [{}, { content: [{}] }, { content: [{}] }];
    ok(bodies.length === 2 && bj[1].content[0].type === 'tool_use' && JSON.stringify(bj[1].content[0].input) === '{}' && bj[2].content[0].is_error === true && /INVALID_JSON/.test(bj[2].content[0].content) && (await page.evaluate(() => !G.st.round && G.st.story[G.st.story.length - 1].text === 'Nothing happens.')), 'a tool call whose input arrives broken is not run on a guess: the model is told to call it again, and no fight began');
    /* markup that arrives whole in one piece of the stream is still only text */
    mode = 'none'; whole = true; tool = null; text = 'Look: <img src=x onerror="window.__pwned=2"> there.'; bodies.length = 0; await say('I look.'); await page.waitForTimeout(250);
    r = await page.evaluate(() => ({ pwned: window.__pwned || 0, img: document.querySelectorAll('#story-log img').length, gm: G.st.story[G.st.story.length - 1].text, shown: [...document.querySelectorAll('#story-log .st-gm')].pop().textContent }));
    ok(r.pwned === 0 && r.img === 0 && r.gm === text && r.shown === text, 'a whole tag arriving in one piece of the stream is never an element, not even for the moment it is streaming');
    whole = false;

    /* the key */
    mode = 'none';
    r = await page.evaluate((KEY) => { const all = (s) => Object.keys(s).map((k) => k + '=' + s.getItem(k)).join('\n'); UI.settings();
      return { save: JSON.stringify(packState(G.st)).includes(KEY), ls: all(localStorage).includes(KEY), ss: sessionStorage.getItem('cyoa2.key') === KEY, blob: (localStorage.getItem('cyoa2.settings.v1') || '').includes(KEY), type: document.getElementById('set-key').type, shown: document.getElementById('set-key').value === KEY, note: document.getElementById('key-note').textContent }; }, KEY);
    const saved = await page.evaluate(async (KEY) => { await UI.saveNow(); const rec = await Store.get('auto'); return JSON.stringify(rec).includes(KEY); }, KEY);
    ok(!r.save && !saved && !r.ls && !r.blob && r.ss && r.type === 'password' && r.shown, 'the key is never in a save, never in the settings, and with "remember" off it is in this tab\'s session only');
    await page.evaluate((KEY) => { document.getElementById('set-remember').checked = true; document.getElementById('set-remember').dispatchEvent(new Event('change')); }, KEY);
    r = await page.evaluate((KEY) => ({ ls: localStorage.getItem('cyoa2.key') === KEY, ss: sessionStorage.getItem('cyoa2.key'), blob: (localStorage.getItem('cyoa2.settings.v1') || '').includes(KEY) }), KEY);
    ok(r.ls && r.ss === null && !r.blob, 'with "remember" on it is kept on the device, under its own name and still not in the settings');
    await page.evaluate(() => document.getElementById('set-test').click());
    await page.waitForFunction(() => /works|refused|did not/.test(document.getElementById('key-note').textContent), null, { timeout: 6000 });
    r = await page.evaluate(() => ({ note: document.getElementById('key-note').textContent, cost: G.st.costs[G.st.costs.length - 1], n: G.st.costs.length }));
    ok(tests.length === 1 && tests[0].max_tokens === 256 && tests[0].stream === false && !('system' in tests[0]) && !('tools' in tests[0]) && tests[0].messages.length === 1 && /The key works: Opus 5\.5 answered \(\$0\.0001\)/.test(r.note) && r.cost.kind === 'test' && r.cost.task === 'test' && Math.abs(r.cost.usd - (12 * 4 + 3 * 20) / 1e6) < 1e-12,
      'TEST KEY asks one small question with no tools and no instructions, says which model answered, and writes what it cost in the ledger: ' + r.note);
    mode = 'auth'; const nT = r.n; await page.evaluate(() => { document.getElementById('key-note').textContent = ''; document.getElementById('set-test').click(); });
    await page.waitForFunction(() => /works|refused|did not/.test(document.getElementById('key-note').textContent), null, { timeout: 6000 });
    r = await page.evaluate(() => ({ note: document.getElementById('key-note').textContent, n: G.st.costs.length }));
    ok(r.note === 'The key was refused.' && r.n === nT, 'and a key that is refused is said to be, at no cost');
    mode = 'none';

    /* the ledger */
    await page.evaluate(() => { UI.costs(); UI.openPanel('pan-costs'); }); await page.waitForTimeout(150);
    r = await page.evaluate(() => { const list = G.st.costs, rows = [...document.querySelectorAll('#costs-body .cost-row')]; return { n: list.length, rows: rows.length, big: document.querySelector('#costs-body .cost-sum b.big').textContent, total: Costs.fmt(Costs.total(list)), failed: rows.filter((x) => /failed: busy/.test(x.textContent) && x.querySelector('.usd.failed')).length, text: document.getElementById('costs-body').textContent, csv: Costs.csv(list).trim().split('\n'), w: rows.every((x) => x.getBoundingClientRect().right <= innerWidth + 1) }; });
    ok(r.rows === r.n && r.n === 14 && r.big === r.total && r.failed === 1 && /failed: refusal/.test(r.text) && /Key test/.test(r.text) && /Opening/.test(r.text) && /Player turns/.test(r.text) && /Opus 5\.5/.test(r.text) && /Haiku 5\.5/.test(r.text) && /Opus 5 /.test(r.text) && /2026-10-10/.test(r.text) && r.w, 'the Costs panel lists every paid telling, newest first, the failed one marked, with totals by task and by model: ' + r.big);
    ok(r.csv.length === r.n + 1 && /^"time","turn","kind","task"/.test(r.csv[0]) && r.csv.filter((l) => /"busy"$/.test(l)).length === 1 && r.csv[1].endsWith(',"0.000882",""'), 'and exports as a CSV, one line a telling, the dollars to six places: ' + r.csv[1].split(',').slice(-2).join(','));
    await page.evaluate(() => UI.closePanels());

    /* a tale told is still told after a reload: no second opening, nothing asked for again */
    await page.evaluate(() => UI.saveNow()); await page.waitForTimeout(400);
    const keep = await page.evaluate(() => JSON.stringify({ story: G.st.story, costs: G.st.costs, told: G.st.told, turn: G.st.turn, party: G.st.party }));
    bodies.length = 0; tool = null; text = 'Should not be asked.';
    await page.reload(); await page.waitForFunction(() => typeof UI === 'object');
    await page.waitForFunction(() => !document.getElementById('btn-continue').hidden, null, { timeout: 8000 });
    await page.evaluate(() => document.getElementById('btn-continue').click());
    await page.waitForFunction(() => G.st && document.body.classList.contains('in-play'), null, { timeout: 8000 }); await page.waitForTimeout(900); await calm(page);
    r = await page.evaluate(() => ({ s: JSON.stringify({ story: G.st.story, costs: G.st.costs, told: G.st.told, turn: G.st.turn, party: G.st.party }), gm: document.querySelectorAll('#story-log .st-gm').length, gmSt: G.st.story.filter((e) => e.t === 'gm').length, tags: document.querySelectorAll('#story-log .cost-tag').length, on: Session.on(), first: document.querySelectorAll('#story-log .st-gm.first').length, img: document.querySelectorAll('#story-log img').length }));
    ok(r.s === keep && r.gm === r.gmSt && r.gm >= 5 && r.tags >= 5 && r.first === 1 && r.img === 0 && r.on && bodies.length === 0, 'Continue brings back the story, the sheets and the ledger exactly, and the Game Master is not asked to open the tale again' + (r.s === keep ? '' : ' (the tale differs: ' + r.s.length + ' against ' + keep.length + ' characters)') + ' [' + [r.gm, r.gmSt, r.tags, r.first, r.img, r.on, bodies.length].join(' ') + ']');
    await T1.ctx.close();

    /* a key saved for CYOA on this device is offered, never taken */
    const T0 = await open({ width: 390, height: 844 }, null, { storyOpen: true }), p0 = T0.page; const asked = [];
    await p0.route('https://api.anthropic.com/**', async (route) => { asked.push(route.request().url()); return route.abort(); });
    await p0.evaluate(() => localStorage.setItem('cyoa.key', 'sk-ant-cyoa-ONE'));
    await begin(p0);
    await p0.evaluate(() => { document.getElementById('say').value = 'Hello?'; document.getElementById('say-send').click(); });
    await p0.waitForTimeout(300);
    let c = await p0.evaluate(() => { const dlg = document.getElementById('dialog').classList.contains('open'); UI.closeDialog(); UI.settings(); return { on: Session.on(), dlg, offer: !document.getElementById('set-cyoa-key').hidden, note: document.getElementById('key-note').textContent, own: localStorage.getItem('cyoa2.key') }; });
    ok(!c.on && c.dlg && c.offer && /saved on this device for CYOA/.test(c.note) && c.own === null && asked.length === 0, 'a key saved for CYOA on the same device is never used unasked: the tale begins with no Game Master, and Settings offers it');
    await p0.evaluate(() => document.getElementById('set-cyoa-key').click());
    c = await p0.evaluate(() => ({ on: Session.on(), own: localStorage.getItem('cyoa2.key'), offer: !document.getElementById('set-cyoa-key').hidden, other: localStorage.getItem('cyoa.key') }));
    ok(c.on && c.own === 'sk-ant-cyoa-ONE' && !c.offer && c.other === 'sk-ant-cyoa-ONE', 'and takes it when the button is pressed');
    await T0.ctx.close();

    /* ---- the table's side of it, with a stand-in for the model itself ---- */
    const T2 = await open({ width: 390, height: 844 }, null, { storyOpen: true }), pg = T2.page;
    await T2.ctx.addInitScript(() => {
      window.__calls = [];
      window.__CYOA2_MOCK__ = async (api) => {
        const c = api.req.context, kind = /STAGE DIRECTION - the tale begins/.test(c) ? 'opening' : /STAGE DIRECTION - the party has just walked into (S\d+)/.test(c) ? 'enter:' + RegExp.$1 : /STAGE DIRECTION - a fight has just begun/.test(c) ? 'fight' : /STAGE DIRECTION - the fight has just ended/.test(c) ? 'fightend' : /STAGE DIRECTION - it is the monsters/.test(c) ? 'monsters' : 'line';
        window.__calls.push({ kind, model: api.req.settings.model, ctx: c, bible: api.req.bible });
        api.usage({ input_tokens: 100, output_tokens: 50 });
        if (window.__gm) { const r = await window.__gm(api, kind); if (r !== 'default') return; }
        await api.text('Told: ' + kind + '.');
      };
    });
    await pg.reload(); await pg.waitForFunction(() => typeof newGame === 'function' && typeof View === 'object');
    const kinds = () => pg.evaluate(() => window.__calls.map((c) => c.kind).join());
    await pg.evaluate(() => document.getElementById('btn-new').click());
    await pg.waitForFunction(() => G.st && G.st.turn >= 1 && !G.busy, null, { timeout: 12000 }); await calm(pg);
    ok((await kinds()) === 'opening' && (await pg.evaluate(() => !document.getElementById('dialog').classList.contains('open') && G.st.story.length === 1 && G.st.story[0].text === 'Told: opening.')), 'a new tale: the table asks for the opening, once');
    /* beats: the first sight of a place, once; a place already told is not told again */
    const go = async (site) => { await pg.evaluate((site) => UI.follow(intent(G.st, { t: 'jump', site })), site); await pg.waitForFunction((site) => G.st.here === site && View.map && View.map.id === site && !document.getElementById('veil').classList.contains('on'), site, { timeout: 8000 }); await pg.waitForTimeout(500); await calm(pg); };
    await go('S0'); await go('S1'); await go('S0');
    ok((await kinds()) === 'opening,enter:S0', 'walking out into the town for the first time is a beat; coming back to the inn the tale opened in, and out again, is not: ' + (await kinds()));
    await pg.evaluate(() => { Settings.data.narrate = 'asked'; }); await go('S3');
    const quietRun = await kinds();
    await pg.evaluate(() => { Settings.data.narrate = 'beats'; }); await go('S0'); await go('S3');
    ok(quietRun === 'opening,enter:S0' && (await kinds()) === 'opening,enter:S0,enter:S3', 'set to speak only when spoken to, the Game Master is not asked for beats; set back, a place not yet told is told when the party next walks in');
    ok(await pg.evaluate(() => { const c = window.__calls; return c.every((x) => x.bible === c[0].bible) && /^WORLD BIBLE/.test(c[0].bible) && c.every((x) => /^TURN CONTEXT/.test(x.ctx)) && /BOARD IN PLAY: S3/.test(c[2].ctx); }), 'every telling carries the same world bible, byte for byte, and the board the party is standing on');

    /* the Game Master moves pieces by naming them; the board follows, and the page with it */
    await go('S1');
    await pg.evaluate(() => { window.__gm = async (api, kind) => { if (kind !== 'line') return 'default'; window.__res = [api.tool('create_character', { name: 'Maud <i>A</i>', class: 'Ranger' }), api.tool('create_character', { name: 'Bram', class: 'Cleric' }), api.tool('move', { id: 'P1', toward: 'N0' }), api.tool('move', { id: 'P1', toward: 'the moon' }), api.tool('create_npc', { role: 'pedlar', name: '<b>Tam</b>', near: 'P1' })]; await api.text('The innkeeper looks up.'); }; });
    await pg.evaluate(() => { document.getElementById('say-who').value = ''; document.getElementById('say').value = 'We go and find the innkeeper.'; document.getElementById('say-send').click(); });
    await pg.waitForFunction(() => G.busy, null, { timeout: 4000 }).catch(() => {}); await calm(pg);
    let g = await pg.evaluate(() => { const st = G.st, m = st.maps.S1, k = m.tokens.find((t) => t.npc === 'N0'), L = leadOf(st), tam = m.tokens.find((t) => (st.npcs[t.npc] || {}).name === '<b>Tam</b>'); viewDraw();
      return { res: window.__res.map((r) => r.ok).join(), err: window.__res[3].error, party: st.party.map((p) => p.name + ':' + p.cls).join(), beside: meleeClear(m, L.x, L.y, k.x, k.y), near: cheb(st.party[1], L) <= 3, chips: [...document.querySelectorAll('#chips .chip.pc')].map((x) => x.textContent.charAt(0)).join(''), tam: !!tam && tokenAt(m, tam.x, tam.y) === tam, els: document.querySelectorAll('#story-log i, #story-log b:not(.st-pl b)').length, plB: document.querySelectorAll('#story-log .st-pl b').length, said: st.story.filter((e) => e.t === 'chip').map((e) => e.text).join('|'), who: st.story.find((e) => e.t === 'pl').who, map: View.map === m, walk: !!st.walk, ctxWho: window.__calls[window.__calls.length - 1].ctx.trim().split('\n').pop() }; });
    ok(g.res === 'true,true,true,false,true' && /Nothing on this board is called/.test(g.err) && g.party === 'Maud <i>A</i>:Ranger,Bram:Cleric' && g.chips === 'MB' && g.beside && g.near && g.tam && g.map && !g.walk, 'in one telling the Game Master names two characters, walks the party to the innkeeper and sets a pedlar down; a place that is not on the board is refused and nothing breaks');
    ok(g.els === 0 && /Maud <i>A<\/i> the Ranger joins/.test(g.said) && /<b>Tam<\/b>, pedlar, appears/.test(g.said) && g.who === 'The table' && /^PLAYER LINE - The table says: We go and find/.test(g.ctxWho), 'names with markup in them are names; a line sent as All is the table\'s');
    /* talking to someone: a tap on them offers it, and the line that follows is spoken to them */
    await pg.evaluate(() => { window.__gm = null; });
    const tk = await pg.evaluate(() => { const st = G.st, k = View.map.tokens.find((t) => t.npc === 'N0'); UI.card(null); View.cam.x = k.x + .5; View.cam.y = k.y + .5; camMoved(true); viewDraw(); const r = View.cv.getBoundingClientRect(), s = w2s(k.x + .5, k.y + .5); return { tap: [r.left + s[0], r.top + s[1]], name: st.npcs.N0.name }; });
    await pg.waitForTimeout(80); await pg.touchscreen.tap(tk.tap[0], tk.tap[1]); await pg.waitForTimeout(160);
    const card = await pg.evaluate(() => ({ name: document.getElementById('info-name').textContent, btns: [...document.querySelectorAll('#info-acts button')].map((b) => b.textContent), at: [G.st.party[0].x, G.st.party[0].y] }));
    await pg.evaluate(() => [...document.querySelectorAll('#info-acts button')].find((b) => b.textContent === 'Talk').click()); await pg.waitForTimeout(100);
    const ready = await pg.evaluate(() => ({ ph: document.getElementById('say').placeholder, focus: document.activeElement && document.activeElement.id, card: document.getElementById('info').hidden, open: document.getElementById('story').classList.contains('open'), who: (() => { const p = pcOf(G.st, document.getElementById('say-who').value); return p ? p.name + ' (' + p.id + ')' : 'The table'; })() }));
    await pg.keyboard.type('What news of the north road?'); await pg.keyboard.press('Enter');
    await pg.waitForFunction(() => G.busy, null, { timeout: 4000 }).catch(() => {}); await calm(pg);
    const spoke = await pg.evaluate(() => ({ last: window.__calls[window.__calls.length - 1].ctx.trim().split('\n').pop(), ph: document.getElementById('say').placeholder, val: document.getElementById('say').value, pl: G.st.story.filter((e) => e.t === 'pl').pop().text }));
    ok(card.name === tk.name && card.btns.join() === 'Talk' && ready.ph === 'Say to ' + tk.name.split(' ')[0] && ready.focus === 'say' && ready.card && ready.open, 'a tap on someone peaceful is their card with TALK on it, which puts the pen in the story with their name on it');
    ok(spoke.last === 'PLAYER LINE - ' + ready.who + ', speaking to N0 ' + tk.name + ' says: What news of the north road?' && spoke.ph === 'Say or do something' && spoke.val === '' && spoke.pl === 'What news of the north road?', 'and the line that follows goes to the Game Master as spoken to them: "' + spoke.last + '"');
    /* and takes the party somewhere else: the page changes board */
    await pg.evaluate(() => { window.__gm = async (api, kind) => { if (kind !== 'line') return 'default'; window.__res = [api.tool('travel_party', { to: 'S0' })]; await api.text('Out into the square.'); }; });
    await pg.evaluate(() => { document.getElementById('say-who').value = G.st.party[1].id; document.getElementById('say').value = 'Let us go outside.'; document.getElementById('say-send').click(); });
    await pg.waitForFunction(() => G.busy, null, { timeout: 4000 }).catch(() => {}); await calm(pg);
    g = await pg.evaluate(() => ({ here: G.st.here, map: View.map.id, title: document.getElementById('place-name').textContent, town: G.st.bible.town, who: G.st.story.filter((e) => e.t === 'pl').pop().who, last: window.__calls[window.__calls.length - 1].ctx.trim().split('\n').pop(), kinds: window.__calls.map((c) => c.kind).join() }));
    ok(g.here === 'S0' && g.map === 'S0' && g.title === g.town && g.who === 'Bram' && /^PLAYER LINE - Bram \(P2\) says: Let us go outside\./.test(g.last) && !/enter:S0.*enter:S0/.test(g.kinds), 'travel_party changes the board on the page too; the line was Bram\'s because Bram was chosen to speak');

    /* a fight: its beats, then the monsters played by the Game Master, on a model pinned for them */
    await pg.evaluate(() => { window.__gm = null; });
    await go('S2');
    await pg.evaluate(() => { const st = G.st, m = st.maps.S2, P = st.party[0]; for (const p of st.party) { p.hpMax = 80; p.hp = 80; }
      const foes = m.tokens.filter((t) => t.k === 'foe'), tok = foes[0], spot = STEPS.map((s) => [P.x + s[0], P.y + s[1]]).find((q) => tileFree(m, q[0], q[1]) && !taken(st, m, q[0], q[1], '') && meleeClear(m, q[0], q[1], P.x, P.y));
      for (const t of foes.slice(1)) dropToken(st, m, t);
      moveToken(m, tok, spot[0], spot[1]); const S = sheetOf(st, tok, true); S.hpMax = 300; S.hp = 300; look(st); window.__foe = tok.npc;
      Settings.data.monsters = 'gm'; Settings.data.taskModels.monsters = 'claude-haiku-5-5';
      window.__gm = async (api, kind) => { if (kind !== 'monsters') return 'default'; window.__mon = (window.__mon || 0) + 1; if (window.__monFail) api.fail('busy', 'no'); const a = api.tool('attack', { attacker_id: window.__foe, target_id: 'P1' }), b = api.tool('attack', { attacker_id: window.__foe, target_id: 'P1' }), e = api.tool('end_turn', {}); window.__monRes = [a.ok, b.ok, b.error, e.ok, e.ok && e.result.turn.is_player_character]; await api.text('The bandit swings.'); };
      UI.rounds(true); });
    /* whoever won the initiative, pass the travellers' turns until the monster's comes up and has been played */
    const untilMon = async (n) => { for (let k = 0; k < 60 && (await pg.evaluate(() => window.__mon || 0)) < n; k++) { await pg.evaluate(() => { if (!G.busy && !Session.beats.length && G.st.round && turnOf(G.st).pc && !G.st.walk && !View.walking) UI.endTurn(); }); await pg.waitForTimeout(250); } };
    await untilMon(1);
    await pg.waitForFunction(() => window.__mon >= 1 && !G.busy && G.st.round && turnOf(G.st).pc, null, { timeout: 20000 }); await calm(pg);
    g = await pg.evaluate(() => ({ kinds: window.__calls.map((c) => c.kind), model: window.__calls.filter((c) => c.kind === 'monsters').map((c) => c.model).join(), other: window.__calls.filter((c) => c.kind !== 'monsters').every((c) => c.model === 'claude-opus-5-5'), res: window.__monRes, cost: G.st.costs.filter((e) => e.task === 'monsters')[0], said: G.st.story.filter((e) => e.t === 'chip').map((e) => e.text), mon: window.__mon, pc: turnOf(G.st).pc, ctx: window.__calls.find((c) => c.kind === 'monsters').ctx }));
    ok(g.kinds.includes('fight') && g.kinds.indexOf('fight') < g.kinds.indexOf('monsters'), 'rolling initiative is a beat, told before anyone acts');
    ok(g.model === 'claude-haiku-5-5' && g.other && g.mon === 1 && g.res[0] === true && g.res[1] === false && /No action is left/.test(g.res[2]) && g.res[3] === true && g.res[4] === true && g.pc && g.cost && g.cost.model === 'claude-haiku-5-5' && /played by: YOU/.test(g.ctx) && /Acting now: /.test(g.ctx),
      'set to play the monsters, the Game Master is handed their turn on the model pinned for it: one blow lands by the rules, a second in the same turn is refused, end_turn passes to a traveller');
    /* when the Game Master cannot be reached on a monster's turn, the engine's script takes it, and the fight goes on */
    await pg.evaluate(() => { window.__monFail = true; });
    await untilMon(2);
    await pg.waitForFunction(() => window.__mon >= 2, null, { timeout: 15000 });
    await pg.waitForFunction(() => !G.busy && G.st.round && turnOf(G.st).pc && !G.st.walk && !View.walking, null, { timeout: 20000 }); await calm(pg);
    g = await pg.evaluate(() => ({ mon: window.__mon, sys: [...document.querySelectorAll('#story-log .st-sys')].map((x) => x.textContent).join('|'), last: G.st.story.filter((e) => e.t === 'chip').slice(-1)[0].text, foe: (G.st.npcs[window.__foe] || {}).name, failed: G.st.costs.filter((e) => e.task === 'monsters' && e.failed).length, round: G.st.round.n }));
    ok(g.mon === 2 && /overwhelmed/.test(g.sys) && g.last.startsWith(g.foe + ':') && g.failed === 1 && g.round >= 2, 'when the Game Master fails on a monster\'s turn the script plays it instead, so the turn still comes back to the travellers: "' + clipTo(g.last, 70) + '"');
    /* the end of the fight is a beat, and it is told what happened */
    await pg.evaluate(() => { window.__monFail = false; window.__gm = null; Settings.data.monsters = 'script'; const st = G.st, m = st.maps.S2, t = m.tokens.find((q) => q.npc === window.__foe); sheetOf(st, t, true).hp = 1; });
    for (let k = 0; k < 40 && (await pg.evaluate(() => !!G.st.round)); k++) { await pg.evaluate(() => { const a = turnOf(G.st); if (a && a.pc && !G.busy && !G.st.walk && !View.walking) { const ids = [...aims()]; if (ids.length && G.st.round.act > 0) UI.attack(ids[0]); else UI.endTurn(); } }); await pg.waitForTimeout(250); }
    await pg.waitForTimeout(600); await calm(pg);
    g = await pg.evaluate(() => { const c = window.__calls.filter((x) => x.kind === 'fightend'); return { n: c.length, ctx: c.length ? c[0].ctx.trim().split('\n').pop() : '', round: !!G.st.round, last: G.st.story[G.st.story.length - 1].text, since: c.length ? /SINCE YOU LAST SPOKE[\s\S]* falls\./.test(c[0].ctx) : false }; });
    ok(!g.round && g.n === 1 && /the fight has just ended: The fight is won\. \d+ experience/.test(g.ctx) && g.last === 'Told: fightend.' && g.since, 'the end of the fight is a beat: the Game Master is told how it ended and what the board did since it last spoke');

    /* beats wait their turn: asked for once however often they are queued, never over an open panel, and not for a fight already over */
    const nCalls = () => pg.evaluate(() => window.__calls.length), c0 = await nCalls();
    const held = await pg.evaluate(async () => { UI.party(); UI.openPanel('pan-party'); for (let k = 0; k < 3; k++) Session.queue('fightend', 'The fight is won.'); const n = Session.beats.length; await new Promise((res) => setTimeout(res, 700)); return { n, still: Session.beats.length, busy: G.busy }; });
    const c1 = await nCalls();
    await pg.evaluate(() => UI.closePanels()); await pg.waitForFunction((c) => window.__calls.length > c, c1, { timeout: 6000 }).catch(() => {}); await calm(pg);
    const c2 = await nCalls();
    ok(held.n === 1 && held.still === 1 && !held.busy && c1 === c0 && c2 === c0 + 1 && (await kinds()).endsWith('fightend'), 'a beat is asked for once however often it is queued, waits while a panel is open, and is told when the table is clear');
    await pg.evaluate(() => Session.queue('fight')); await pg.waitForTimeout(700); await calm(pg);
    ok((await nCalls()) === c2 && (await pg.evaluate(() => Session.beats.length)) === 0, 'and a fight that was over before its beat could be told is not announced');

    /* the table moves on to another tale while one is still being told: the old telling can touch nothing */
    const other = await pg.evaluate(() => JSON.stringify(packState(newGame('another-tale'))));
    await pg.evaluate(() => { window.__gm = async (api, kind) => { if (kind !== 'line') return 'default'; await new Promise((res) => { window.__go = res; }); window.__late = api.tool('inventory', { op: 'gold', amount: 50 }); await api.text('Too late for this table.'); api.fail('busy', 'late'); }; });
    await pg.evaluate(() => { document.getElementById('say').value = 'Hold that thought.'; document.getElementById('say-send').click(); });
    await pg.waitForFunction(() => G.busy && typeof window.__go === 'function', null, { timeout: 4000 });
    await pg.evaluate((json) => UI.importFile(new File([json], 'other.json', { type: 'application/json' })), other);
    await pg.waitForFunction(() => G.st && G.st.seed === 'another-tale' && G.st.turn >= 1 && !G.busy, null, { timeout: 12000 }); await calm(pg);
    await pg.evaluate(() => window.__go()); await pg.waitForTimeout(500); await calm(pg);
    g = await pg.evaluate(() => ({ seed: G.st.seed, gold: G.st.gold, story: G.st.story.map((e) => e.t + ':' + e.text).join('|'), late: window.__late, busy: G.busy, shown: document.getElementById('story-log').textContent, costs: G.st.costs.length, here: View.map && View.map.id, wait: !!document.querySelector('#story-log .st-wait') }));
    ok(g.seed === 'another-tale' && g.gold === 15 && g.story === 'gm:Told: opening.' && g.late && g.late.ok === false && /another tale/.test(g.late.error) && !g.busy && !g.wait && !/Too late|Gold \+50/.test(g.shown) && g.costs === 1 && g.here === 'S1',
      'a tale opened from a file while another was being told: the old telling\'s tools are refused, its words and its failure reach nothing, and the new tale is exactly as it was opened');
    await T2.ctx.close();
  }
  }

  ok(errors.length === 0, 'no console error or uncaught exception anywhere' + (errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''));

  await browser.close();
  console.log(good + ' checks passed, ' + bad + ' failed');
  console.log(bad ? 'CYOA2: RED' : ONLY || COPY ? 'CYOA2: PARTIAL' + (ONLY ? ' sections=' + ONLY : '') + (COPY ? ' page=' + COPY : '') + ' (not a gate result)' : 'CYOA2: GREEN');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('  FAIL crashed: ' + (e && e.stack || e)); console.log('CYOA2: RED'); process.exit(1); });
