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
 * CYOA2_ONLY=NOP (any letters; A stands for A to I) runs only those sections, for
 * negative tests aimed at one of them. A partial run never prints "CYOA2: GREEN".
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
const PAGE = 'file://' + path.join(ROOT, 'games', 'cyoa2', 'index.html');
const SEEDS = 36;
/* CYOA2_ONLY=NOP runs only those sections (A stands for A to I, which share a page). It is for negative tests, where
   one break is aimed at one section; a partial run never prints the GREEN line a gate looks for.                       */
const ONLY = (process.env.CYOA2_ONLY || '').toUpperCase(), want = (k) => !ONLY || ONLY.includes(k);
let bad = 0, good = 0;
const fail = (m) => { bad++; console.log('  FAIL ' + m); };
const ok = (c, m) => { if (c) { good++; console.log('  ok   ' + m); } else fail(m); };

(async () => {
  let browser;
  try { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  catch (e) { try { browser = await chromium.launch(); } catch (e2) { console.log('CYOA2: RED'); console.error('no chromium: ' + e2.message); process.exit(1); } }
  const errors = [];
  const open = async (vp, opts) => {
    const ctx = await browser.newContext(Object.assign({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, opts || {}));
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/i.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.addInitScript(() => { try { localStorage.setItem('cyoa2.settings.v1', JSON.stringify({ seed: 'drive-seed-1', musicVol: 0, sfxVol: 0, theme: 'light' })); } catch (e) { /* ignore */ } });
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
    ok(/connect-src 'none'/.test(r.csp), 'the page may not call any network service');
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
    ok(r.v1 && r.v1.v === 2 && r.v1.seen > 3 && r.v1.lead === 'P1' && !r.v1.town, 'a save from before the fog loads: the party sees from where it stands, and the rest waits to be seen' + (typeof r.v1 === 'string' ? ' (' + r.v1 + ')' : ''));

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
    const P = await open({ width: 390, height: 844 }), page = P.page;
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
    ok(off.round === null && off.init && off.end && off.add && off.sub === off.mapSub, 'the cross stands everyone down: the dice are back on the bar and the header names the place again');
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
  ok(errors.length === 0, 'no console error or uncaught exception anywhere' + (errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''));

  await browser.close();
  console.log(good + ' checks passed, ' + bad + ' failed');
  console.log(bad ? 'CYOA2: RED' : ONLY ? 'CYOA2: PARTIAL sections=' + ONLY + ' (not a gate result)' : 'CYOA2: GREEN');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('  FAIL crashed: ' + (e && e.stack || e)); console.log('CYOA2: RED'); process.exit(1); });
