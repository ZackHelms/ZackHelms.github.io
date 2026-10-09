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
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const PAGE = 'file://' + path.join(ROOT, 'games', 'cyoa2', 'index.html');
const SEEDS = 36;
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
      intent(st, { t: 'jump', who: 'P1', site: 'S2' }); intent(st, { t: 'move', who: 'P1', to: cs }); for (let k = 0; k < 400 && st.walk; k++) intent(st, { t: 'step', who: 'P1' });
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
      const door = st.maps[house].doors[0]; door.open = true;
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
      const m = View.map, st = G.st, pc = st.party[0], out = [];
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
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
    await page.evaluate(() => { const m = View.map, t = m.tokens.find((q) => q.npc === 'N0'); const pc = G.st.party[0]; const f = freeNear(G.st, m, t.x - 2, t.y, pc.id); go({ goals: [f] }); });
    await idle(page);
    const tok = await pick('token');
    if (!tok) fail('nobody on screen to tap'); else {
      await tap(tok); await page.waitForTimeout(120);
      const c = await page.evaluate(() => ({ name: document.getElementById('info-name').textContent, text: document.getElementById('info-text').textContent, sel: !!(View.sel && View.sel.tok) }));
      ok(c.name === tok.name && c.text.length > 5 && c.sel, 'a tap on a person shows who they are: ' + c.name + ' - ' + c.text);
    }
    /* out of the building: a tap on the ground outside walks to the nearest of it and leaves */
    await page.evaluate(() => { View.cam.z = View.zmin; camMoved(true); viewDraw(); });
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
    const roof = await page.evaluate(() => { const m = View.map; View.cam.z = View.zmin; View.cam.x = m.w / 2; View.cam.y = m.h / 2; camMoved(true); viewDraw(); const L = m.lots.find((l) => l.kind === 'chapel'), s = w2s(L.x + L.w / 2, L.y + 1.2); return { sx: s[0], sy: s[1], site: L.site, charted: !!G.st.maps[L.site] }; });
    await tap(roof);
    await page.waitForFunction((id) => G.st.here === id, roof.site, { timeout: 30000 }).catch(() => {});
    await idle(page);
    const ch = await page.evaluate((id) => ({ here: G.st.here, charted: !!G.st.maps[id], kind: View.map.kind }), roof.site);
    ok(!roof.charted && ch.here === roof.site && ch.charted && ch.kind === 'chapel', 'a tap on a roof walks to that door, goes in, and charts the place');
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

  /* ------------------------------------------------------------------ K */
  console.log('K. a tap lands on the square that is drawn there');
  {
    for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }, { width: 1024, height: 768 }, { width: 600, height: 1100 }]) {
      const K = await open(vp), page = K.page, tag = vp.width + 'x' + vp.height;
      await begin(page);
      /* resize while the board is hidden behind a panel, then come back */
      await page.evaluate(() => { UI.settings(); UI.openPanel('pan-settings'); });
      await page.setViewportSize({ width: vp.width - 40, height: vp.height - 60 }); await page.waitForTimeout(150);
      await page.setViewportSize(vp); await page.waitForTimeout(150);
      await page.evaluate(() => UI.closePanels()); await page.waitForTimeout(600);
      const geo = await page.evaluate(() => { const r = View.cv.getBoundingClientRect(), b = document.getElementById('board').getBoundingClientRect(); return { cw: View.cv.width, ch: View.cv.height, rw: r.width, rh: r.height, dpr: View.dpr, vw: View.vw, vh: View.vh, bw: b.width, bh: b.height, inView: r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 }; });
      ok(geo.cw === Math.round(geo.rw * geo.dpr) && geo.ch === Math.round(geo.rh * geo.dpr) && geo.vw === geo.rw && geo.vh === geo.rh && Math.abs(geo.rw - geo.bw) < 1 && Math.abs(geo.rh - geo.bh) < 3 && geo.inView && geo.rh > 150, tag + ': the canvas, its backing store and the view agree on one box (' + Math.round(geo.rw) + 'x' + Math.round(geo.rh) + ')');
      /* aim at the free square furthest from the middle of the screen, where any error in the mapping is largest; three turns */
      let hits = 0, tries = 0;
      for (let turn = 0; turn < 3; turn++) {
        const t = await page.evaluate(() => {
          const m = View.map, st = G.st, pc = st.party[0], seen = floodReach(m, pc.x, pc.y); let best = null;
          for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
            if (!seen[y * m.w + x] || !tileFree(m, x, y) || tokenAt(m, x, y) || m._.occ[y * m.w + x] >= 0 || !m.rg[y * m.w + x] || (x === pc.x && y === pc.y) || doorNear(m, x + .5, y + .5)) continue;
            const s = w2s(x + .5, y + .5); if (s[0] < 14 || s[1] < 14 || s[0] > View.vw - 14 || s[1] > View.vh - 14) continue;
            const d = Math.hypot(s[0] - View.vw / 2, s[1] - View.vh / 2); if (!best || d > best.d) best = { x, y, sx: s[0], sy: s[1], d };
          }
          const r = View.cv.getBoundingClientRect(); if (best) { best.cx = r.left + best.sx; best.cy = r.top + best.sy; } return best;
        });
        if (!t) break; tries++;
        await page.touchscreen.tap(t.cx, t.cy); await idle(page);
        const at = await page.evaluate(() => [G.st.party[0].x, G.st.party[0].y]);
        if (at[0] === t.x && at[1] === t.y) hits++;
        await page.evaluate(() => { UI.card(null); });
      }
      ok(tries === 3 && hits === 3, tag + ': three taps at the far corners of the view each walked to the square under the finger (' + hits + '/' + tries + ')');
      await K.ctx.close();
    }
  }

  /* ------------------------------------------------------------------ L */
  console.log('L. gestures and keys');
  {
    const L = await open({ width: 390, height: 844 }), page = L.page;
    await begin(page);
    const cdp = await L.ctx.newCDPSession(page);
    const box = await page.evaluate(() => { const r = View.cv.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, id) => ({ x: box.l + p[0], y: box.t + p[1], id })) });
    const state = () => page.evaluate(() => ({ x: G.st.party[0].x, y: G.st.party[0].y, cx: View.cam.x, cy: View.cam.y, z: View.cam.z, walk: !!G.st.walk || View.walking, re: !document.getElementById('recenter').hidden }));
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
  ok(errors.length === 0, 'no console error or uncaught exception anywhere' + (errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''));

  await browser.close();
  console.log(good + ' checks passed, ' + bad + ' failed');
  console.log(bad ? 'CYOA2: RED' : 'CYOA2: GREEN');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('  FAIL crashed: ' + (e && e.stack || e)); console.log('CYOA2: RED'); process.exit(1); });
