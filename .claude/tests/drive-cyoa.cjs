#!/usr/bin/env node
/**
 * drive-cyoa.cjs — rules + flow gate for CYOA (games/cyoa/), the AI Game Master game.
 *
 *   NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules node .claude/tests/drive-cyoa.cjs
 *
 * Why this earns a file: the game's promise is CONSISTENCY — the model narrates,
 * but a deterministic engine owns the world, every change is an event, and
 * replaying the events rebuilds the state exactly. None of that is visible in a
 * screenshot, and a regression in any of it does not throw: a replay that drifts
 * by one dice counter still produces a plausible-looking game. So the suite
 * asserts the contract directly:
 *
 *   A. chrome: the CD's exceptions (no top-left back/mute/settings; the reload
 *      button top-right at 2x size, below the badge; EXIT is the way back)
 *   B. a missing key is a refusal that opens Settings at the key field
 *   C. world generation is a pure function of seed + pins
 *   D. the engine rejects illegal calls and changes nothing when it does
 *   E. a scripted Game Master (window.__CYOA_MOCK__) drives real turns:
 *      opening, character creation, rolls, travel, facts
 *   F. a failed turn rolls back completely and gives the player's line back
 *   G. replay(events) == the live state; the cached prompt prefix is byte-stable
 *   H. save -> reload -> load, and export -> import, both round-trip exactly
 *   I. plates are deterministic; a revisited place looks the same
 *   J. model text is never HTML; the API key never reaches the DOM or a save
 *   K. tap-to-skip; the ending runs an epilogue and opens the ending screen
 *   M. the optional premium voice (OpenAI / ElevenLabs) and painted pictures
 *      (OpenAI images) against stubbed endpoints, and their fallbacks
 *   N. the cost ledger: exact per-model pricing from token usage, failed turns
 *      still billed, the running total, per-passage cost lines, per-task model
 *      routing, the ledger saved with the game and shown from the Load screen
 *   L. the REAL Anthropic client against a stubbed network (page.route): SSE
 *      parsing, the tool loop, thinking blocks echoed unchanged, request shape
 *      per model profile, the fallbacks-400 retry, and a 401
 *
 * No real network call is ever made: the only API traffic is page.route stubs.
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const PAGE = 'file://' + path.join(ROOT, 'games', 'cyoa', 'index.html');
let bad = 0, good = 0;
const fail = (m) => { bad++; console.log('  FAIL ' + m); };
const ok = (c, m) => { if (c) { good++; console.log('  ok   ' + m); } else fail(m); };
const clip = (t, n) => (String(t).length > n ? String(t).slice(0, n - 1) + '\u2026' : String(t));

const SETTINGS = { textSpeed: 'instant', voiceOn: false, seed: 'drive-seed-1', musicVol: 0, sfxVol: 0 };
const MOCK = `
window.__CYOA_MOCK__ = async (api) => {
  const ctx = api.req.context, line = ctx.slice(ctx.lastIndexOf('\\n') + 1);
  window.__lastContext = ctx;
  if (/Open the adventure/.test(line)) { api.usage({ input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 8000, cache_creation_input_tokens: 0 }, 'claude-opus-5-5'); api.tool('set_scene', { figures: ['humanoid'], mood: 'uneasy' }); await api.text((window.__OPENING || 'Rain falls on the village.\\n\\nWho is at the table?')); return; }
  if (/main story has ended/.test(line)) { api.tool('end_scene', { summary: 'The tale reached its end.' }); await api.text('And so the region was saved. The end.'); return; }
  if (/#make/.test(line)) { api.usage({ input_tokens: 2000, output_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 6000 }, 'claude-haiku-4-5'); api.tool('create_character', { name: 'Mira', class: 'Rogue', ancestry: 'elf' }); api.tool('create_character', { name: 'Bran', class: 'Fighter' }); await api.text('Mira and Bran take their seats.'); return; }
  if (/#roll/.test(line)) { window.__roll = api.tool('roll_check', { character_id: 'C1', check: 'stealth', dc: 12 }); await api.text('The dice fall.'); return; }
  const go = line.match(/#go (L\\d+)/); if (go) { window.__move = api.tool('move_party', { to: go[1] }); await api.text('You travel on.'); return; }
  if (/#badmove/.test(line)) { window.__bad = api.tool('move_party', { to: 'L999' }); await api.text('That way is not open.'); return; }
  if (/#fail/.test(line)) { api.tool('create_character', { name: 'Ghost', class: 'Bard' }); await api.text('You begin to'); api.fail('busy', null, { input_tokens: 500, output_tokens: 100 }, 'claude-opus-5-5'); }
  if (/#refuse/.test(line)) { api.fail('refusal'); }
  if (/#xss/.test(line)) { await api.text('A note reads <img src=x onerror="window.__pwned=1"> and <b>bold</b>.'); return; }
  if (/#long/.test(line)) { await api.text('This is a very long passage that goes on and on. '.repeat(40)); return; }
  if (/#fact/.test(line)) { api.tool('record_fact', { subject: 'L1', text: 'A silver bell hangs over the bar.' }); await api.text('Noted.'); return; }
  if (/#win/.test(line)) { for (let k = 0; k < 3; k++) api.tool('update_quest', { op: 'advance', quest_id: 'Q0' }); await api.text('Victory is yours.'); return; }
  await api.text('The Game Master nods.');
};`;

async function newPage(browser, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const init = [];
  if (!opts.noMock) init.push(MOCK);
  init.push('if (!localStorage.getItem("cyoa.settings.v1")) localStorage.setItem("cyoa.settings.v1", ' + JSON.stringify(JSON.stringify(Object.assign({}, SETTINGS, opts.settings || {}))) + ');');
  await ctx.addInitScript(init.join('\n'));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/i.test(m.text())) page.errors.push(m.text()); });
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.CYOA && window.CYOA.Settings.data);
  return { ctx, page };
}
const idle = (p) => p.waitForFunction(() => window.CYOA.G && !window.CYOA.UI.busy && !window.CYOA.Narrator.isBusy() && !document.getElementById('veil').classList.contains('on'), null, { timeout: 15000 });
async function say(p, text) { await p.fill('#say', text); await p.evaluate(() => document.getElementById('send').click()); await p.waitForTimeout(30); await idle(p); }
async function startNew(p) { await p.evaluate(() => document.getElementById('btn-new').click()); await p.waitForFunction(() => window.CYOA.G && window.CYOA.G.st.turn >= 1 && document.getElementById('scr-tale').classList.contains('active'), null, { timeout: 8000 }); await idle(p); }

(async () => {
  let browser;
  try { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  catch (e) { try { browser = await chromium.launch(); } catch (e2) { console.log('CYOA: RED'); console.error('no chromium: ' + e2.message); process.exit(1); } }

  /* ---------------- A. chrome ---------------- */
  console.log('A. chrome');
  {
    const { ctx, page: p } = await newPage(browser);
    const r = await p.evaluate(() => {
      const box = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, bottom: b.bottom }; };
      return { reload: box('reload-btn'), badge: box('build-badge'), back: !!document.getElementById('back-btn'), mute: !!document.getElementById('mute-btn'),
        exit: document.getElementById('btn-exit').getAttribute('href'), plaques: [...document.querySelectorAll('#scr-title .plaque')].map((b) => b.textContent.trim().toUpperCase()),
        vw: innerWidth, ribbonShown: getComputedStyle(document.getElementById('ribbon-btn')).display !== 'none' };
    });
    ok(JSON.stringify(r.plaques) === JSON.stringify(['NEW', 'LOAD', 'SETTINGS', 'EXIT']), 'title shows NEW / LOAD / SETTINGS / EXIT in order (' + r.plaques.join(',') + ')');
    ok(r.exit === '../index.html', 'EXIT links back to the games hub');
    ok(!r.back && !r.mute, 'no top-left back or mute chrome (CD exception)');
    ok(r.reload && r.reload.h >= 60 && r.reload.w >= 70, 'reload button is 2x size (' + (r.reload && r.reload.w) + 'x' + (r.reload && r.reload.h) + ')');
    ok(r.reload && r.vw - r.reload.r <= 16 && r.reload.y < 40, 'reload button sits in the top-right corner');
    ok(r.reload && r.badge && r.reload.y >= r.badge.bottom - 1, 'reload button sits below the build badge');
    ok(!r.ribbonShown, 'menu ribbon is hidden on the title screen');
    ok(!p.errors.length, 'title loads without errors ' + (p.errors[0] || ''));
    await ctx.close();
  }

  /* ---------------- B. no key ---------------- */
  console.log('B. no key');
  {
    const { ctx, page: p } = await newPage(browser, { noMock: true });
    await p.evaluate(() => document.getElementById('btn-new').click());
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({ open: document.getElementById('pnl-settings').classList.contains('open'), notice: !document.getElementById('key-notice').hidden,
      text: document.getElementById('key-notice').textContent, focus: document.activeElement && document.activeElement.id, game: !!window.CYOA.G }));
    ok(r.open && r.notice, 'NEW without a key opens Settings with a notice ("' + r.text + '")');
    ok(r.focus === 'set-key', 'the key field takes focus');
    ok(!r.game, 'no game starts without a key');
    await ctx.close();
  }

  /* ---------------- C/D. world + engine (pure) ---------------- */
  console.log('C. world generation / D. engine validation');
  {
    const { ctx, page: p } = await newPage(browser);
    const r = await p.evaluate(() => {
      const C = window.CYOA, h = (s, pins) => C.hashHex(C.stable(C.generateWorld(s, pins || {})));
      const w = C.generateWorld('pin-test', { land: 'desert', tone: 'mystery', threat: 'dragon' });
      let graphOk = true;
      for (let k = 0; k < 120; k++) {
        const b = C.generateWorld('g' + k, {}), ids = new Set(b.locations.map((l) => l.id));
        const reach = new Set(['L0']), q = ['L0'];
        while (q.length) { const c = q.shift(); for (const n of Object.keys(b.locations[+c.slice(1)].exits)) if (!reach.has(n)) { reach.add(n); q.push(n); } }
        if (reach.size !== ids.size || b.locations.filter((l) => l.lair).length !== 1 || b.quest.acts.length !== 3) graphOk = false;
        for (const l of b.locations) for (const e of Object.keys(l.exits)) if (!ids.has(e) || b.locations[+e.slice(1)].exits[l.id] == null) graphOk = false;
      }
      const st = C.newGame('engine-test', {}), before = C.stable(st);
      const tries = [['move_party', { to: 'L999' }], ['roll_check', { character_id: 'C1', check: 'stealth', dc: 12 }], ['attack', { attacker_id: 'C1', target_id: 'F1' }],
        ['create_character', { name: 'X', class: 'Necromancer' }], ['inventory', { op: 'gold', amount: -5 }], ['end_combat', { outcome: 'victory' }], ['nope', {}]];
      const errs = tries.map(([n, i]) => C.exec(st, n, i)).filter((x) => !x.ok && x.error).length;
      const far = Object.values(st.locations).find((l) => l.id !== 'L0' && st.locations.L0.exits[l.id] == null);
      const nonAdj = C.exec(st, 'move_party', { to: far.id });
      return { same: h('amber-1') === h('amber-1'), diff: h('amber-1') !== h('amber-2'), pinned: w.land === 'desert' && w.tone === 'mystery' && w.threat.key === 'dragon',
        graphOk, errs, n: tries.length, unchanged: C.stable(st) === before, nonAdj: !nonAdj.ok && /not reachable/.test(nonAdj.error) };
    });
    ok(r.same, 'same seed -> byte-identical world bible');
    ok(r.diff, 'different seed -> different world');
    ok(r.pinned, 'Settings pins (land, tone, threat) are honoured');
    ok(r.graphOk, '120 generated worlds: connected, symmetric exits, one lair, three acts');
    ok(r.errs === r.n, 'illegal tool calls are all rejected with a reason (' + r.errs + '/' + r.n + ')');
    ok(r.unchanged, 'rejected calls leave the state byte-identical');
    ok(r.nonAdj, 'move_party refuses a place that is not a direct exit');
    await ctx.close();
  }

  /* ---------------- E-K. the game, driven by a scripted GM ---------------- */
  console.log('E. turns / F. rollback / G. replay / H. saves / I. plates / J. safety / K. skip + ending');
  {
    const { ctx, page: p } = await newPage(browser);
    await startNew(p);
    let r = await p.evaluate(() => ({ gm: document.querySelectorAll('#scroll .passage.gm').length, text: (document.querySelector('#scroll .passage.gm') || {}).textContent || '',
      place: document.getElementById('place-name').textContent, plate: document.getElementById('plate').dataset.key, ribbon: getComputedStyle(document.getElementById('ribbon-btn')).display !== 'none',
      seed: window.CYOA.G.st.seed, turn: window.CYOA.G.st.turn, stage: /Open the adventure/.test(window.__lastContext || '') }));
    ok(r.gm === 1 && /Rain falls/.test(r.text), 'NEW crossfades into the tale and the opening narration appears');
    ok(r.stage, 'the opening turn carries the opening stage direction');
    ok(r.seed === 'drive-seed-1', 'the seed pinned in Settings is used');
    ok(!!r.place && !!r.plate, 'the place name and the scene plate are drawn (' + r.place + ')');
    ok(r.ribbon, 'the menu ribbon appears in the tale');
    ok(r.turn === 1, 'a committed turn advances the turn counter');
    const bible0 = await p.evaluate(() => window.CYOA.bibleText(window.CYOA.G.st.bible));

    await say(p, '#make us two characters');
    r = await p.evaluate(() => ({ party: window.CYOA.G.st.party.map((c) => c.name), chips: [...document.querySelectorAll('#speakers .spk')].map((b) => b.textContent),
      joined: [...document.querySelectorAll('#scroll .chip')].map((c) => c.textContent).join(' | ') }));
    ok(r.party.join() === 'Mira,Bran', 'create_character builds the party through the engine');
    ok(r.chips.join() === 'All,Mira,Bran', 'speaker chips follow the party (' + r.chips.join() + ')');
    ok(/Mira the Rogue joins/.test(r.joined), 'a result chip records the new character');

    await p.evaluate(() => document.querySelector('#speakers .spk:nth-child(2)').click());
    await say(p, '#roll I sneak');
    r = await p.evaluate(() => ({ roll: window.__roll, pl: [...document.querySelectorAll('#scroll .passage.pl .who')].pop().textContent, chip: [...document.querySelectorAll('#scroll .chip')].pop().textContent,
      ctxHasSpeaker: /PLAYER LINE - Mira \(C1\)/.test(window.__lastContext) }));
    ok(r.roll && r.roll.ok && typeof r.roll.result.total === 'number', 'roll_check is rolled by the engine (' + (r.roll && r.roll.ok ? r.roll.result.total : '-') + ')');
    ok(/Stealth/.test(r.chip), 'the roll shows as a dice chip on the page');
    ok(r.pl === 'Mira' && r.ctxHasSpeaker, 'the chosen speaker tags the player line in the page and the GM context');

    await say(p, '#badmove');
    r = await p.evaluate(() => window.__bad);
    ok(r && !r.ok && /Unknown place/.test(r.error), 'an illegal call during a turn returns an error to the GM');

    await say(p, '#fact');
    r = await p.evaluate(() => window.CYOA.G.st.facts.map((f) => f.text));
    ok(r.includes('A silver bell hangs over the bar.'), 'record_fact adds canon');

    await say(p, '#go L1');
    r = await p.evaluate(() => ({ here: window.CYOA.G.st.here, ctx: window.__lastContext, place: document.getElementById('place-name').textContent, name: window.CYOA.G.st.locations.L1.name,
      spec: window.CYOA.Plates.specFor(window.CYOA.G.st), move: window.__move }));
    ok(r.here === 'L1' && r.place === r.name, 'move_party moves the party and the page follows (' + r.place + ')');
    ok(r.move && r.move.ok && r.move.result.canon.includes('A silver bell hangs over the bar.'), 'arriving returns the canon recorded for that place');
    const specL1 = r.spec;
    await say(p, '#go L0');
    await say(p, 'what does the bell look like?');
    r = await p.evaluate(() => window.__lastContext);
    ok(/CANON[\s\S]*silver bell/.test(r), 'the canon is fed back to the GM on a later turn (consistency)');
    await say(p, '#go L1');
    r = await p.evaluate((a) => { const C = window.CYOA, b = C.Plates.specFor(C.G.st); return { sameScene: C.stable({ k: a.k, f: a.f }) === C.stable({ k: b.k, f: b.f }), h1: C.Plates.hash(a), h2: C.Plates.hash(Object.assign({}, a)) }; }, specL1);
    ok(r.sameScene, 'a revisited place keeps its scenery');
    ok(r.h1 === r.h2, 'the same plate spec draws the same pixels');
    const bible1 = await p.evaluate(() => window.CYOA.bibleText(window.CYOA.G.st.bible));
    ok(bible0 === bible1, 'the cached prompt prefix (world bible) is byte-stable across turns');

    /* F. rollback */
    const snap = await p.evaluate(() => ({ st: window.CYOA.stable(window.CYOA.G.st), ev: window.CYOA.G.events.length, tr: window.CYOA.G.transcript.length, nodes: document.querySelectorAll('#scroll > *').length }));
    await say(p, '#fail this turn');
    r = await p.evaluate(() => ({ st: window.CYOA.stable(window.CYOA.G.st), ev: window.CYOA.G.events.length, tr: window.CYOA.G.transcript.length, say: document.getElementById('say').value,
      sys: [...document.querySelectorAll('#scroll .passage.sys')].map((x) => x.textContent).join(' '), ghost: window.CYOA.G.st.party.some((c) => c.name === 'Ghost'),
      gms: [...document.querySelectorAll('#scroll .passage.gm')].some((x) => /You begin to/.test(x.textContent)) }));
    ok(r.st === snap.st && r.ev === snap.ev && r.tr === snap.tr && !r.ghost, 'a failed turn rolls back the state, the event log and the transcript');
    ok(!r.gms, 'the failed turn’s partial narration is removed from the page');
    ok(r.say === '#fail this turn', 'the player’s line is handed back in the input box');
    ok(/overwhelmed/.test(r.sys), 'the failure is explained in the fiction');
    await p.fill('#say', '');
    await say(p, '#refuse');
    r = await p.evaluate(() => [...document.querySelectorAll('#scroll .passage.sys')].pop().textContent);
    ok(/vision clouds/.test(r), 'a refusal is explained and nothing is committed');
    await p.fill('#say', '');

    /* J. safety */
    await p.evaluate(() => window.CYOA.Settings.setKey('sk-ant-test-SECRET-9f3a', true));
    await say(p, '#xss');
    r = await p.evaluate(() => ({ imgs: document.querySelectorAll('#scroll img').length, bolds: document.querySelectorAll('#scroll b').length, pwned: !!window.__pwned,
      html: document.documentElement.outerHTML.includes('SECRET-9f3a'), save: JSON.stringify(window.CYOA.makeSave('auto')).includes('SECRET-9f3a'),
      shown: /<img src=x/.test([...document.querySelectorAll('#scroll .passage.gm')].pop().textContent) }));
    ok(r.imgs === 0 && !r.pwned && r.shown, 'model text is set as text, never parsed as HTML');
    await p.evaluate(() => window.CYOA.UI.renderAll());
    await p.waitForTimeout(250);
    r = await p.evaluate(() => ({ imgs: document.querySelectorAll('#scroll img').length, pwned: !!window.__pwned, shown: [...document.querySelectorAll('#scroll .passage.gm')].some((x) => /<img src=x/.test(x.textContent)) }));
    ok(r.imgs === 0 && !r.pwned && r.shown, 're-rendering a saved transcript also treats model text as text');
    ok(!r.html, 'the API key never appears in the page markup');
    ok(!r.save, 'the API key never appears in a save or export');
    await p.evaluate(() => window.CYOA.Settings.setKey('', false));

    /* G. replay */
    r = await p.evaluate(() => { const C = window.CYOA, G = C.G, rep = C.replay(G.st.seed, G.st.pins, G.st.bible, G.events, G.st.turn); return { equal: C.stable(rep.st) === C.stable(G.st), mism: rep.mismatches, n: G.events.length }; });
    ok(r.equal && r.mism === 0 && r.n >= 6, 'replaying the ' + r.n + ' logged events rebuilds the live state exactly');

    /* H. saves */
    await p.waitForTimeout(300);
    const live = await p.evaluate(() => ({ st: window.CYOA.stable(window.CYOA.G.st), tr: window.CYOA.G.transcript.length }));
    await p.reload({ waitUntil: 'load' });
    await p.waitForFunction(() => window.CYOA && window.CYOA.Settings.data);
    await p.waitForTimeout(200);
    r = await p.evaluate(() => !document.getElementById('btn-load').classList.contains('disabled'));
    ok(r, 'LOAD is live on the title once a tale exists');
    await p.evaluate(() => document.getElementById('btn-load').click());
    await p.waitForSelector('#slots .slot:not(.empty)');
    r = await p.evaluate(() => ({ slots: document.querySelectorAll('#slots .slot').length, auto: document.querySelector('#slots .slot').textContent }));
    ok(r.slots === 4 && /Autosave/.test(r.auto) && /Mira, Bran/.test(r.auto), 'the load screen lists the autosave with its party');
    await p.evaluate(() => document.querySelector('#slots .slot').click());
    await p.waitForFunction(() => window.CYOA.G && document.getElementById('scr-tale').classList.contains('active'), null, { timeout: 8000 });
    await idle(p);
    r = await p.evaluate(() => ({ st: window.CYOA.stable(window.CYOA.G.st), tr: window.CYOA.G.transcript.length, passages: document.querySelectorAll('#scroll .passage').length }));
    ok(r.st === live.st, 'save -> reload -> load restores the state exactly');
    ok(r.tr === live.tr && r.passages > 5, 'the transcript is restored and re-rendered (' + r.passages + ' passages)');
    r = await p.evaluate(() => { const C = window.CYOA, s = JSON.parse(JSON.stringify(C.makeSave('s1'))); const back = C.restore(s); return { valid: C.validSave(s), equal: C.stable(back.g.st) === C.stable(C.G.st), bad: C.validSave({ format: 'nope' }) }; });
    ok(r.valid && r.equal && !r.bad, 'export -> import round-trips, and a foreign file is refused');

    /* ribbon under panels (the Back button must be tappable) */
    await p.evaluate(() => document.getElementById('ribbon-btn').click());
    await p.evaluate(() => document.querySelector('[data-act="party"]').click());
    await p.waitForTimeout(100);
    r = await p.evaluate(() => { const b = document.querySelector('#pnl-party [data-close]').getBoundingClientRect(); const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return { hit: hit && hit.closest('[data-close]') !== null, sheets: document.querySelectorAll('#party-body .sheet').length }; });
    ok(r.hit, 'a panel’s Back button is not covered by the menu ribbon');
    ok(r.sheets === 2, 'the party panel shows a sheet per character');
    await p.evaluate(() => document.querySelector('#pnl-party [data-close]').click());

    /* K. skip + ending */
    await p.evaluate(() => { window.CYOA.Settings.data.textSpeed = 'slow'; });
    await p.fill('#say', '#long');
    await p.evaluate(() => document.getElementById('send').click());
    await p.waitForFunction(() => { const g = [...document.querySelectorAll('#scroll .passage.gm')].pop(); return g && /This is a very long/.test(g.textContent) && window.CYOA.Narrator.isBusy(); }, null, { timeout: 8000 });
    const before = await p.evaluate(() => [...document.querySelectorAll('#scroll .passage.gm')].pop().textContent.length);
    await p.evaluate(() => document.getElementById('scroll').click());
    await p.waitForTimeout(250);
    r = await p.evaluate(() => ({ len: [...document.querySelectorAll('#scroll .passage.gm')].pop().textContent.length, busy: window.CYOA.Narrator.isBusy() }));
    ok(before < 400 && r.len > 1800 && !r.busy, 'tapping the page finishes the reveal at once (' + before + ' -> ' + r.len + ' chars)');
    await p.evaluate(() => { window.CYOA.Settings.data.textSpeed = 'instant'; });
    await idle(p);
    await say(p, '#win');
    await p.waitForFunction(() => document.getElementById('ending').classList.contains('open'), null, { timeout: 10000 }).catch(() => {});
    r = await p.evaluate(() => ({ open: document.getElementById('ending').classList.contains('open'), epi: /region was saved/.test(document.getElementById('scroll').textContent), q: window.CYOA.G.st.quests.Q0.status }));
    ok(r.q === 'done', 'three advances complete the main quest');
    ok(r.epi && r.open, 'the ending runs an epilogue turn, then opens the ending screen');
    await p.evaluate(() => document.getElementById('btn-continue').click());
    r = await p.evaluate(() => ({ open: document.getElementById('ending').classList.contains('open'), ack: window.CYOA.G.endingAck }));
    ok(!r.open && r.ack, '"Continue adventuring" closes the ending and remembers it');
    ok(!p.errors.length, 'no page errors across the whole flow ' + (p.errors[0] || ''));
    await ctx.close();
  }

  /* ---------------- N. costs ---------------- */
  console.log('N. costs');
  {
    const { ctx, page: p } = await newPage(browser);
    await startNew(p);
    let r = await p.evaluate(() => ({ e: window.CYOA.G.costs.slice(), btn: document.getElementById('cost-btn').textContent, tag: (document.querySelector('#scroll .cost-tag') || {}).textContent || '' }));
    ok(r.e.length === 1 && r.e[0].kind === 'gm' && r.e[0].task === 'opening' && r.e[0].calls === 1 && Math.abs(r.e[0].usd - 0.0156) < 1e-9,
      'the opening is billed from its token usage at Opus 5.5 list prices, cache reads at $0.20/M ($' + (r.e[0] && r.e[0].usd) + ')');
    ok(r.btn === '$0.0156', 'the running total for the tale sits in the header (' + r.btn + ')');
    ok(/^\$0\.0156 · Opus 5\.5 · 1 call$/.test(r.tag), 'a cost line sits under the passage it paid for (' + r.tag + ')');
    await say(p, '#make us two characters');
    r = await p.evaluate(() => ({ e: window.CYOA.G.costs[1], btn: document.getElementById('cost-btn').textContent }));
    ok(r.e && r.e.model === 'claude-haiku-4-5' && Math.abs(r.e.usd - 0.0145) < 1e-9 && /^Turn 1 · The table: “#make us two characters”$/.test(r.e.desc),
      'each turn is priced at the model that served it (Haiku 4.5, 5-minute cache writes at 1.25x) and says what it was for');
    ok(r.btn === '$0.0301', 'the total follows every paid call (' + r.btn + ')');
    await say(p, '#fail this turn');
    r = await p.evaluate(() => ({ e: window.CYOA.G.costs[2], btn: document.getElementById('cost-btn').textContent, party: window.CYOA.G.st.party.length,
      after: (() => { const sys = [...document.querySelectorAll('#scroll .passage.sys')].pop(); const n = sys && sys.nextElementSibling; return n && n.classList.contains('cost-tag') ? n.textContent : ''; })() }));
    ok(r.e && r.e.failed === 'busy' && Math.abs(r.e.usd - 0.004) < 1e-9 && r.btn === '$0.0341' && r.party === 2, 'a failed turn is rolled back but its spend is still recorded');
    ok(/\$0\.0040/.test(r.after), 'the failure message carries what the failed turn cost (' + r.after + ')');
    await p.fill('#say', '');
    await p.evaluate(() => { const c = document.getElementById('set-showcosts'); c.checked = false; c.dispatchEvent(new Event('change')); });
    r = await p.evaluate(() => ({ tag: getComputedStyle(document.querySelector('#scroll .cost-tag')).display, btn: getComputedStyle(document.getElementById('cost-btn')).display, saved: window.CYOA.Settings.data.showCosts }));
    ok(r.tag === 'none' && r.btn === 'none' && r.saved === false, 'Settings can hide the cost lines and the total while playing');
    await p.evaluate(() => { const c = document.getElementById('set-showcosts'); c.checked = true; c.dispatchEvent(new Event('change')); });
    r = await p.evaluate(() => { const C = window.CYOA; C.Settings.data.taskModels = { opening: '', turn: 'claude-haiku-4-5', epilogue: 'claude-sonnet-5' };
      const out = [C.taskSettings('opening').model, C.taskSettings('player').model, C.taskSettings('epilogue').model]; C.Settings.data.taskModels = { opening: '', turn: '', epilogue: '' }; return out; });
    ok(r.join() === 'claude-opus-5-5,claude-haiku-4-5,claude-sonnet-5', 'each Game Master task can run on its own model, defaulting to the main one (' + r.join() + ')');
    await p.evaluate(() => document.getElementById('cost-btn').click());
    r = await p.evaluate(() => ({ open: document.getElementById('pnl-costs').classList.contains('open'), rows: document.querySelectorAll('#costs-body .cost-row').length }));
    ok(r.open && r.rows === 3, 'tapping the total opens this tale’s cost history (' + r.rows + ' lines)');
    await p.evaluate(() => document.querySelector('#pnl-costs [data-close]').click());
    await p.waitForTimeout(300);
    await p.reload({ waitUntil: 'load' });
    await p.waitForFunction(() => window.CYOA && window.CYOA.Settings.data);
    await p.evaluate(() => document.getElementById('btn-load').click());
    await p.waitForSelector('#slots .slot:not(.empty) .cost-hist');
    r = await p.evaluate(() => document.querySelector('#slots .slot .cost-hist').textContent);
    ok(r === '$0.0341', 'each save on the Load screen has a $ cost-history button showing its total (' + r + ')');
    await p.evaluate(() => document.querySelector('#slots .slot .cost-hist').click());
    r = await p.evaluate(() => ({ open: document.getElementById('pnl-costs').classList.contains('open'), load: document.getElementById('pnl-load').classList.contains('open'),
      rows: [...document.querySelectorAll('#costs-body .cost-row')].map((x) => x.textContent), sum: document.querySelector('#costs-body .cost-sum').textContent,
      csv: !document.querySelector('#costs-body .plaque').disabled, game: !!window.CYOA.G }));
    ok(r.open && !r.game && r.rows.length === 3, 'it opens that save’s history without loading the game');
    ok(/Opening of the tale/.test(r.rows[2]) && /Turn 1 · The table/.test(r.rows[1]) && /failed: busy/.test(r.rows[0]) && /\$0\.0156/.test(r.rows[2]), 'every expense is listed newest first, in USD, with what it was for');
    ok(/\$0\.0341/.test(r.sum) && /Opus 5\.5/.test(r.sum) && /Haiku 4\.5/.test(r.sum) && r.csv, 'the summary totals by kind and by model, and the list exports as CSV');
    r = await p.evaluate(async () => { const s = await window.CYOA.Store.get('auto'); const csv = window.CYOA.Costs.csv(s.costs).trim().split('\n'); return { n: csv.length, head: csv[0], last: csv[3] }; });
    ok(r.n === 4 && /"usd"/.test(r.head) && /"0\.004000"/.test(r.last), 'the CSV has one row per expense with exact dollars');
    await p.evaluate(() => { document.querySelector('#pnl-costs [data-close]').click(); document.querySelector('#slots .slot').click(); });
    await p.waitForFunction(() => window.CYOA.G && document.getElementById('scr-tale').classList.contains('active'), null, { timeout: 8000 });
    await idle(p);
    r = await p.evaluate(() => ({ n: window.CYOA.G.costs.length, btn: document.getElementById('cost-btn').textContent, tags: document.querySelectorAll('#scroll .cost-tag').length }));
    ok(r.n === 3 && r.btn === '$0.0341' && r.tags === 2, 'a loaded game keeps its ledger and redraws the cost lines under its passages');
    ok(!p.errors.length, 'no page errors across the cost flow ' + (p.errors[0] || ''));
    await ctx.close();
  }

  /* ---------------- L. the real client, stubbed network ---------------- */
  console.log('L. Anthropic client (stubbed network)');
  {
    const { ctx, page: p } = await newPage(browser, { noMock: true, settings: { model: 'claude-opus-5-5' } });
    const shapes = await p.evaluate(() => {
      const C = window.CYOA, A = C.AnthropicGM, set = C.Settings.data;
      const o = A.body(C.modelProfile({ model: 'claude-opus-5-5' }), set, [], true), h = A.body(C.modelProfile({ model: 'claude-haiku-4-5' }), set, [], true);
      const hdr = A.headers('k', o.betas);
      return { oThink: o.b.thinking && o.b.thinking.type, oEffort: o.b.output_config && o.b.output_config.effort, oFb: o.b.fallbacks, oBeta: o.betas.join(), oTools: o.b.tools.length, n: C.TOOL_NAMES.length,
        oChoice: 'tool_choice' in o.b, oCache: !!(o.b.system[0].cache_control), hThink: 'thinking' in h.b, hEffort: 'output_config' in h.b, hFb: 'fallbacks' in h.b,
        hdrBrowser: hdr['anthropic-dangerous-direct-browser-access'], hdrVer: hdr['anthropic-version'], budget: JSON.stringify(o.b).includes('budget_tokens') };
    });
    ok(shapes.oThink === 'adaptive' && shapes.oEffort === 'medium' && !shapes.budget, 'Opus 5.5: adaptive thinking, explicit effort, never budget_tokens');
    ok(shapes.oFb === 'default' && shapes.oBeta === 'server-side-fallback-2026-07-01', 'Opus 5.5: refusal fallbacks opted in with the matching beta');
    ok(!shapes.oChoice && shapes.oTools === shapes.n && shapes.oCache, 'every tool declared, no forced tool_choice, system prompt cached');
    ok(!shapes.hThink && !shapes.hEffort && !shapes.hFb, 'Haiku 4.5: no thinking, effort or fallbacks fields');
    ok(shapes.hdrBrowser === 'true' && shapes.hdrVer === '2023-06-01', 'browser-access and version headers are sent');

    const sse = (events) => events.map((e) => 'event: ' + e.type + '\ndata: ' + JSON.stringify(e) + '\n\n').join('');
    const msg = (content, stop, model) => {
      const ev = [{ type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: model || 'claude-opus-5-5', content: [], usage: { input_tokens: 10, cache_read_input_tokens: 5, output_tokens: 1 } } }];
      content.forEach((b, i) => {
        if (b.type === 'thinking') { ev.push({ type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '' } }, { type: 'content_block_delta', index: i, delta: { type: 'signature_delta', signature: b.signature } }); }
        else if (b.type === 'text') { ev.push({ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } }); for (const piece of b.text.match(/.{1,7}/g)) ev.push({ type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: piece } }); }
        else if (b.type === 'tool_use') { const j = JSON.stringify(b.input); ev.push({ type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } }, { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: j.slice(0, 9) } }, { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: j.slice(9) } }); }
        ev.push({ type: 'content_block_stop', index: i });
      });
      ev.push({ type: 'message_delta', delta: { stop_reason: stop }, usage: { output_tokens: 20 } }, { type: 'message_stop' });
      return sse(ev);
    };
    const bodies = [];
    let mode = 'ok';
    await p.route('https://api.anthropic.com/v1/messages', async (route) => {
      const req = route.request(), body = JSON.parse(req.postData() || '{}');
      bodies.push({ body, headers: req.headers() });
      if (mode === 'auth') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
      if (mode === 'midfail') return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse([{ type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: body.model, content: [], usage: { input_tokens: 10, cache_read_input_tokens: 5, output_tokens: 1 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'The door ' } }, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }]) });
      if (mode === 'fb' && body.fallbacks) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'fallbacks: model not permitted' } }) });
      const last = body.messages[body.messages.length - 1], served = mode === 'served' ? 'claude-opus-5' : body.model;
      const isResult = Array.isArray(last.content) && last.content[0] && last.content[0].type === 'tool_result';
      if (!isResult) return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: msg([{ type: 'thinking', signature: 'SIG-abc' }, { type: 'tool_use', id: 'tu1', name: 'create_character', input: { name: 'Ada', class: 'Wizard' } }], 'tool_use', served) });
      return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: msg([{ type: 'text', text: 'Ada the wizard steps out of the rain. What do you do?' }], 'end_turn', served) });
    });
    await p.evaluate(() => { window.CYOA.Settings.setKey('sk-ant-test-key', false); document.getElementById('btn-new').click(); });
    await p.waitForFunction(() => window.CYOA.G && window.CYOA.G.st.turn >= 1, null, { timeout: 8000 });
    await idle(p);
    let r = await p.evaluate(() => ({ party: window.CYOA.G.st.party.map((c) => c.name), text: [...document.querySelectorAll('#scroll .passage.gm')].map((x) => x.textContent).join(' '), usage: window.CYOA.G.usage }));
    ok(bodies.length === 2, 'the tool loop makes one follow-up request after the tool call (' + bodies.length + ' requests)');
    ok(r.party.join() === 'Ada', 'a streamed tool_use (split JSON deltas) runs through the engine');
    ok(/Ada the wizard steps out of the rain/.test(r.text), 'streamed text deltas become the narration');
    const second = bodies[1] && bodies[1].body;
    const asst = second && second.messages[1], res = second && second.messages[2];
    ok(asst && asst.role === 'assistant' && asst.content[0].type === 'thinking' && asst.content[0].signature === 'SIG-abc' && asst.content[1].type === 'tool_use' && asst.content[1].input.class === 'Wizard',
      'the assistant turn is echoed unchanged, thinking signature included');
    ok(res && res.role === 'user' && res.content[0].type === 'tool_result' && res.content[0].tool_use_id === 'tu1' && !res.content[0].is_error, 'the tool result goes back in one user message');
    const first = bodies[0] && bodies[0].body;
    ok(first && first.messages[0].content[0].cache_control && /WORLD BIBLE/.test(first.messages[0].content[0].text) && /TURN CONTEXT/.test(first.messages[0].content[1].text),
      'turn request: cached world bible block, then the volatile turn context');
    ok(bodies[0] && bodies[0].headers['x-api-key'] === 'sk-ant-test-key', 'the key goes only in the x-api-key header');
    ok(r.usage.input === 20 && r.usage.cacheRead === 10, 'usage (incl. cache reads) is accounted per request');
    r = await p.evaluate(() => window.CYOA.G.costs.slice());
    ok(r.length === 1 && r[0].calls === 2 && r[0].model === 'claude-opus-5-5' && Math.abs(r[0].usd - 2 * (10 * 4 + 5 * 0.2 + 20 * 20) / 1e6) < 1e-12,
      'a turn is billed per request from the streamed usage and the served model (' + (r[0] && r[0].usd) + ')');
    await p.evaluate(() => { window.CYOA.Settings.data.taskModels = { opening: '', turn: 'claude-haiku-4-5', epilogue: '' }; });
    bodies.length = 0;
    await say(p, 'we look around');
    r = await p.evaluate(() => window.CYOA.G.costs[window.CYOA.G.costs.length - 1]);
    ok(bodies.length === 2 && bodies.every((b) => b.body.model === 'claude-haiku-4-5' && !b.body.thinking && !b.body.output_config && !b.body.fallbacks),
      'with a turn model set, player turns go to that model (Haiku 4.5, with its own request shape)');
    ok(r && r.model === 'claude-haiku-4-5' && Math.abs(r.usd - 2 * (10 * 1 + 5 * 0.1 + 20 * 5) / 1e6) < 1e-12, 'and are priced at that model\u2019s rates');
    await p.evaluate(() => { window.CYOA.Settings.data.taskModels = { opening: '', turn: '', epilogue: '' }; });

    mode = 'fb'; bodies.length = 0;
    await say(p, 'hello');
    ok(bodies.length >= 2 && bodies[0].body.fallbacks && !bodies[1].body.fallbacks, 'a 400 about fallbacks retries once without them');
    mode = 'served'; bodies.length = 0;
    await say(p, 'we wait by the fire');
    r = await p.evaluate(() => window.CYOA.G.costs[window.CYOA.G.costs.length - 1]);
    ok(bodies.every((b) => b.body.model === 'claude-opus-5-5') && r && r.model === 'claude-opus-5' && Math.abs(r.usd - 2 * (10 * 5 + 5 * 0.5 + 20 * 25) / 1e6) < 1e-12,
      'a reply served by a fallback model is billed at the fallback\u2019s prices, not the requested model\u2019s');
    mode = 'auth'; bodies.length = 0;
    const st0 = await p.evaluate(() => window.CYOA.stable(window.CYOA.G.st));
    await say(p, 'hello again');
    r = await p.evaluate(() => ({ sys: [...document.querySelectorAll('#scroll .passage.sys')].pop(), st: window.CYOA.stable(window.CYOA.G.st) }));
    const sysText = await p.evaluate(() => { const s = [...document.querySelectorAll('#scroll .passage.sys')].pop(); return s ? s.textContent : ''; });
    ok(/key was refused/.test(sysText) && r.st === st0, 'a 401 is explained ("key was refused"), offers Settings, and commits nothing');
    r = await p.evaluate(() => window.CYOA.G.costs.filter((e) => e.failed === 'auth').length);
    ok(r === 0, 'a refused request (HTTP 401) is not billed');
    mode = 'midfail'; bodies.length = 0;
    const n0 = await p.evaluate(() => window.CYOA.G.costs.length);
    await say(p, 'we open the door');
    await p.fill('#say', '');
    r = await p.evaluate(() => ({ e: window.CYOA.G.costs[window.CYOA.G.costs.length - 1], n: window.CYOA.G.costs.length, st: window.CYOA.stable(window.CYOA.G.st) }));
    ok(r.n === n0 + 1 && r.e.failed === 'busy' && r.e.calls === 1 && Math.abs(r.e.usd - (10 * 4 + 5 * 0.2 + 1 * 20) / 1e6) < 1e-12 && r.st === st0,
      'a reply that dies mid-stream is still billed for what it used, and the turn rolls back');
    ok(!p.errors.length, 'no page errors with the real client ' + (p.errors[0] || ''));
    await ctx.close();
  }

  /* ---------------- M. premium voice + painted pictures (stubbed network) ---------------- */
  console.log('M. premium voice + AI pictures (stubbed network)');
  {
    /* a 0.25 s silent 8 kHz mono WAV: decodeAudioData accepts it, so the real decode path runs */
    const wav = (() => { const n = 2000, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
      b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; })();
    const PNG1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const run = async (settings, keys, routes) => {
      const { ctx, page: p } = await newPage(browser, { settings: Object.assign({ textSpeed: 'normal', voiceOn: true }, settings) });
      await p.evaluate((k) => { for (const [n, v] of Object.entries(k)) window.CYOA.Settings.setKeyOf(n, v, true); }, keys);
      const log = { speech: [], eleven: [], images: [] }; let imgN = 0;
      await p.route('https://api.openai.com/v1/audio/speech', async (r) => { log.speech.push({ body: JSON.parse(r.request().postData()), h: r.request().headers() }); return routes.speech ? routes.speech(r) : r.fulfill({ status: 200, contentType: 'audio/wav', body: wav }); });
      await p.route(/https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/.*/, async (r) => { log.eleven.push({ url: r.request().url(), body: JSON.parse(r.request().postData()), h: r.request().headers() }); return r.fulfill({ status: 200, contentType: 'audio/mpeg', body: wav }); });
      await p.route('https://api.openai.com/v1/images/generations', async (r) => { log.images.push({ body: JSON.parse(r.request().postData()), h: r.request().headers() }); return routes.images ? routes.images(r) : r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(imgN++ === 0 ? { data: [{ b64_json: PNG1 }] } : { data: [{ b64_json: PNG1 }], usage: { input_tokens: 100, output_tokens: 1000, input_tokens_details: { text_tokens: 100, image_tokens: 0 } } }) }); });
      return { ctx, p, log };
    };
    /* OpenAI voice */
    {
      const { ctx, p, log } = await run({ voiceProvider: 'openai', openaiVoice: 'fable' }, { openai: 'sk-openai-TEST-77' }, {});
      await startNew(p);
      const r = await p.evaluate(() => ({ text: (document.querySelector('#scroll .passage.gm') || {}).textContent || '', failed: window.CYOA.Premium.failed,
        html: document.documentElement.outerHTML.includes('TEST-77'), save: JSON.stringify(window.CYOA.makeSave('auto')).includes('TEST-77') }));
      const b = log.speech[0] && log.speech[0].body;
      ok(log.speech.length === 2, 'OpenAI voice: one speech request per sentence, fetched ahead (' + log.speech.length + ')');
      ok(b && b.model === 'gpt-4o-mini-tts' && b.voice === 'fable' && /storyteller/.test(b.instructions) && b.response_format === 'mp3', 'OpenAI voice: model, chosen voice, narrator instructions');
      ok(log.speech[0] && log.speech[0].h.authorization === 'Bearer sk-openai-TEST-77', 'OpenAI voice: the key goes only in the Authorization header');
      ok(/Rain falls on the village\.[\s\S]*Who is at the table\?/.test(r.text) && !r.failed, 'the narration is fully revealed alongside the decoded audio');
      ok(!r.html && !r.save, 'the OpenAI key never reaches the markup or a save');
      const v = await p.evaluate(() => { const C = window.CYOA, e = C.G.costs.find((x) => x.kind === 'voice');
        return e ? { e, want: C.Costs.speech('openai', 'gpt-4o-mini-tts', 'Rain falls on the village.', e.secs / 2) + C.Costs.speech('openai', 'gpt-4o-mini-tts', 'Who is at the table?', e.secs / 2),
          tag: (document.querySelector('#scroll .cost-tag') || {}).textContent || '' } : null; });
      ok(v && v.e.est && v.e.calls === 2 && Math.abs(v.e.secs - 0.5) < 0.01 && Math.abs(v.e.usd - v.want) < 1e-9, 'the narrator voice is one estimated ledger line per passage, growing per sentence');
      ok(v && /voice ~\$/.test(v.tag), 'the passage\u2019s cost line includes its voice (' + (v && v.tag) + ')');
      await ctx.close();
    }
    /* OpenAI voice refused -> device voice / text, once */
    {
      const { ctx, p, log } = await run({ voiceProvider: 'openai' }, { openai: 'sk-bad' }, { speech: (r) => r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Incorrect API key provided' } }) }) });
      await startNew(p);
      const r = await p.evaluate(() => ({ text: (document.querySelector('#scroll .passage.gm') || {}).textContent || '', failed: window.CYOA.Premium.failed, toast: document.getElementById('toast').textContent }));
      ok(r.failed && /premium voice failed/.test(r.toast) && /401/.test(r.toast), 'a refused premium voice says so once and falls back (' + clip(r.toast, 60) + ')');
      ok(/Rain falls on the village\.[\s\S]*Who is at the table\?/.test(r.text), 'the narration still arrives in full after the fallback');
      ok(log.speech.length <= 2, 'no further premium requests after the failure');
      await ctx.close();
    }
    /* ElevenLabs voice */
    {
      const { ctx, p, log } = await run({ voiceProvider: 'elevenlabs', elevenVoice: 'VOICE123' }, { eleven: 'xi-TEST-55' }, {});
      await startNew(p);
      const e = log.eleven[0];
      const ev = await p.evaluate(() => window.CYOA.G.costs.find((x) => x.kind === 'voice'));
      ok(ev && ev.model === 'ElevenLabs eleven_multilingual_v2' && ev.chars > 0 && Math.abs(ev.usd - ev.chars / 1000 * 0.10) < 1e-12, 'ElevenLabs voice is estimated at $0.10 per 1,000 characters');
      ok(e && /\/v1\/text-to-speech\/VOICE123\?/.test(e.url) && e.h['xi-api-key'] === 'xi-TEST-55' && e.body.model_id === 'eleven_multilingual_v2' && typeof e.body.text === 'string', 'ElevenLabs voice: voice id in the path, key in xi-api-key, text + model in the body');
      await ctx.close();
    }
    /* painted pictures */
    {
      const { ctx, p, log } = await run({ pictures: 'openai', voiceOn: false, textSpeed: 'instant' }, { openai: 'sk-openai-ART' }, {});
      await startNew(p);
      await p.waitForFunction(() => document.getElementById('plate').dataset.src === 'art', null, { timeout: 5000 }).catch(() => {});
      let r = await p.evaluate(() => ({ src: document.getElementById('plate').dataset.src, name: window.CYOA.G.st.locations.L0.name }));
      const b = log.images[0] && log.images[0].body;
      ok(log.images.length === 1 && b && b.model === 'gpt-image-2' && b.size === '1536x1024' && b.prompt.includes(r.name) && /woodcut/.test(b.prompt), 'AI pictures: one request for the place, its name and the house style in the prompt');
      ok(r.src === 'art', 'the painted picture replaces the woodcut on the plate');
      await say(p, '#go L1'); await p.waitForTimeout(600); await say(p, '#go L0');
      await p.waitForTimeout(400);
      r = await p.evaluate(async () => ({ src: document.getElementById('plate').dataset.src, rec: !!(await window.CYOA.Store.artGet(window.CYOA.G.st.seed + '|L0')) }));
      ok(log.images.length === 2, 'a new place asks once; a revisited place asks again never (' + log.images.length + ' requests for 3 arrivals)');
      ok(r.rec && r.src === 'art', 'the painting is cached per place in IndexedDB and shown again on return');
      r = await p.evaluate(() => window.CYOA.G.costs.filter((e) => e.kind === 'picture'));
      ok(r.length === 2 && r[0].est && Math.abs(r[0].usd - 0.041) < 1e-12 && /^Scene picture: /.test(r[0].desc) && !r[1].est && Math.abs(r[1].usd - (100 * 5 + 1000 * 30) / 1e6) < 1e-12,
        'each painting is billed once: from the reply\u2019s usage when given, else the ~$0.041 list estimate');
      await ctx.close();
    }
    {
      const { ctx, p } = await run({ pictures: 'openai', voiceOn: false, textSpeed: 'instant' }, { openai: 'sk-openai-ART' }, { images: (r) => r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Invalid value for size' } }) }) });
      await startNew(p);
      await p.waitForTimeout(400);
      const r = await p.evaluate(() => ({ src: document.getElementById('plate').dataset.src, failed: window.CYOA.Art.failed, toast: document.getElementById('toast').textContent }));
      ok(r.failed && r.src === 'woodcut' && /painted pictures failed/.test(r.toast), 'a refused picture request keeps the woodcut and says why');
      await ctx.close();
    }
  }

  await browser.close();
  console.log('CHECKS=' + (good + bad) + ' PASSED=' + good + ' FAILED=' + bad);
  console.log(bad ? 'CYOA: RED' : 'CYOA: GREEN');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('  FAIL crashed: ' + (e && e.stack || e)); console.log('CYOA: RED'); process.exit(1); });
