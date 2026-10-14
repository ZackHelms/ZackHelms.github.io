#!/usr/bin/env node
/**
 * drive-taas-ui.cjs — the page around the TAAS engine, in Chromium at a phone's width.
 *
 * drive-taas.cjs proves the engine. This proves the page keeps the engine's promises on
 * screen: the forecast shown is the forecast, Run ships what was shown and commits the plan
 * on screen, every button that refuses agrees with the engine (and the one rule only the
 * page keeps, 12 SP an investment), a reload puts back the run and the half-made plan, a
 * save from another version is never replayed, and the scorecard prints the engine's score.
 * Plus the phone layout and the keyboard focus that every render has to put back, and the
 * chrome both modes share (the CD, 2026-10-14): the menu (Info, the sound switch and three
 * volumes that reach the audio buses and persist, Exit game), the reload button that comes
 * back on a fresh address in the same mode, and the build badge in the device's own time zone
 * (US Eastern when the device will not say, the UTC stamp when neither works).
 *
 * The page is served from a local http server rather than file://, so one page can be
 * served again with CFG.version bumped at the same origin (same localStorage), which is
 * the only honest way to ask what a version bump does to an existing save.
 *
 * Usage:
 *   node .claude/tests/drive-taas-ui.cjs            (needs playwright-core on NODE_PATH; gates.sh finds it)
 *   TAAS_PAGE=/path/to/copy.html node .claude/tests/drive-taas-ui.cjs   # negtest-copies
 *
 * Final line: TAAS-UI: GREEN | RED   (exit 0 / 1). Never GREEN when pointed at a copy.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
let chromium;
try { ({ chromium } = require('playwright-core')); } catch (e) { console.log('NO-PLAYWRIGHT: playwright-core not resolvable (run via .claude/scripts/gates.sh)'); console.log('TAAS-UI: RED'); process.exit(1); }

const COPY = !!process.env.TAAS_PAGE;
const PAGE = process.env.TAAS_PAGE || path.join(process.cwd(), 'games', 'taas', 'index.html');
const SRC = fs.readFileSync(PAGE, 'utf8');

let checks = 0, failed = 0;
function ok(cond, name, detail) {
  checks++;
  if (cond) console.log('PASS ' + name);
  else { failed++; console.log('FAIL ' + name + (detail !== undefined && detail !== '' ? ' (' + detail + ')' : '')); }
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// serve the page; `bump` serves it with CFG.version + 1
let bump = false;
// the formal engine's CFG.version (the robot factory's engine has its own, later in the page)
const VERSION_RE = /(const TAAS = \(function \(\) \{[\s\S]*?\n\s*version: )(\d+)(,)/;
const server = http.createServer((req, res) => {
  if (!req.url.startsWith('/taas.html')) { res.writeHead(404); res.end(); return; }
  const body = bump ? SRC.replace(VERSION_RE, (m, a, n, c) => a + (+n + 1) + c) : SRC;
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
});

/* In-page audit, run after every click: the screen against the engine, reading the run
 * and the plan out of the page's own save. Returns a list of named problems. */
function audit() {
  const E = TAAS, C = E.CFG, out = [];
  const d = JSON.parse(localStorage.getItem('taas.v' + C.version) || 'null');
  if (!d) return ['no save under taas.v' + C.version];
  const s = d.state, p = d.plan;
  if (s.q >= 8) return out;
  const n1 = v => (Math.round(v * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const f = E.forecast(s, p);
  if (!f.valid) out.push('the saved plan is one the engine refuses');
  const big = document.querySelector('.outcome .big');
  if (!big || big.textContent !== n1(f.out.units)) out.push('forecast shows ' + (big && big.textContent) + ', engine says ' + n1(f.out.units));
  const nowVal = document.querySelector('.q.now .q-val');
  if (!nowVal || nowVal.textContent !== n1(f.out.units)) out.push('tracker forecast shows ' + (nowVal && nowVal.textContent));
  const meter = [...document.querySelectorAll('.meter-head .num')][0];
  const want = (f.spOpp + f.spInvest) + ' invested / ' + f.deliverySp + ' delivery';
  if (!meter || meter.textContent !== want) out.push('SP meter "' + (meter && meter.textContent) + '" vs "' + want + '"');
  const fund = document.querySelector('button.fund');
  const canFund = !!p.opp || E.forecast(s, Object.assign({}, p, { opp: true })).valid;
  if (!fund) out.push('no Fund button');
  else {
    if (fund.disabled === canFund) out.push('Fund ' + (fund.disabled ? 'disabled' : 'enabled') + ' but the engine says ' + (canFund ? 'it fits' : 'it does not'));
    if (fund.getAttribute('aria-pressed') !== String(!!p.opp)) out.push('Fund pressed=' + fund.getAttribute('aria-pressed') + ' but plan.opp=' + !!p.opp);
  }
  const shown = [...document.querySelectorAll('button[data-act="inc"]')].map(b => b.dataset.id).sort().join();
  const unlocked = E.unlocked(s).map(i => i.id).sort().join();
  if (shown !== unlocked) out.push('steppers for [' + shown + '], unlocked [' + unlocked + ']');
  E.unlocked(s).forEach(i => {
    const sp = p.inv[i.id] || 0;
    const inc = document.querySelector('button[data-act="inc"][data-id="' + i.id + '"]');
    const dec = document.querySelector('button[data-act="dec"][data-id="' + i.id + '"]');
    if (!inc || !dec) return;
    const trial = { opp: p.opp, inv: Object.assign({}, p.inv, { [i.id]: sp + C.investStep }) };
    const canAdd = sp + C.investStep <= C.investMax && E.forecast(s, trial).valid;
    if (inc.disabled === canAdd) out.push(i.id + ' + ' + (inc.disabled ? 'disabled' : 'enabled') + ' at ' + sp + ' SP, engine says ' + (canAdd ? 'room' : 'no room'));
    if (dec.disabled !== (sp === 0)) out.push(i.id + ' - ' + (dec.disabled ? 'disabled' : 'enabled') + ' at ' + sp + ' SP');
    const o = inc.parentElement.querySelector('output');
    if (!o || o.textContent !== sp + ' SP') out.push(i.id + ' shows ' + (o && o.textContent) + ', plan has ' + sp);
  });
  return out;
}

const saved = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('taas.v' + TAAS.CFG.version) || 'null'));
const click = (p, sel) => p.locator(sel).first().click();

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const URL = 'http://127.0.0.1:' + server.address().port + '/taas.html';
  let browser;
  try { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  catch (e) { try { browser = await chromium.launch(); } catch (e2) { console.log('FAIL chromium launches (' + e2.message + ')'); console.log('TAAS-UI: RED'); server.close(); process.exit(1); } }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route(u => !String(u).startsWith('http://127.0.0.1'), r => r.abort());   // fonts: not part of the gate
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  const load = async () => { await page.goto(URL, { waitUntil: 'load' }); await page.waitForSelector('.outcome .big'); };
  const auditNow = () => page.evaluate(audit);

  page.setDefaultTimeout(4000);   // a click on something a failed row left missing fails fast, not in 30 s
  const fresh = async () => { await page.evaluate(() => localStorage.clear()); await load(); };
  // each section starts from a known save and reports its own crash, so one broken row cannot take the rest down
  async function section(name, fn) { try { await fn(); } catch (e) { ok(false, name + ' played through', e.message.split('\n')[0]); } }

  {
    ok((SRC.match(new RegExp(VERSION_RE.source, 'g')) || []).length === 1, 'the formal engine has exactly one CFG.version line for the bump to move');

    /* ---------- 1. a fresh page ---------- */
    await section('1. a fresh page', async () => {
      await load();
      await fresh();
      const r = await page.evaluate(() => ({
        now: document.querySelector('.q.now .q-name') && document.querySelector('.q.now .q-name').textContent,
        big: document.querySelector('.outcome .big').textContent,
        funded: document.querySelector('button.fund').getAttribute('aria-pressed'),
        restart: document.getElementById('restart').textContent
      }));
      ok(r.now === 'Y1Q1' && r.big === '60' && r.funded === 'false' && r.restart === '', 'a fresh page opens on Y1Q1, forecasting the traditional 60 with nothing funded', JSON.stringify(r));
      const a = await auditNow();
      ok(!a.length, 'and every control on it agrees with the engine', a.join('; '));
    });

    /* ---------- 2. one stepper: 2 SP a click, 12 at most, minus and Clear ---------- */
    await section('2. one stepper: 2 SP a click, 12 at most, minus and Clear', async () => {
      await fresh();
      const seen = [];
      for (let k = 0; k < 7; k++) {
        const inc = page.locator('button[data-act="inc"][data-id="train"]');
        if (await inc.isDisabled()) { seen.push('x'); continue; }
        await inc.click();
        seen.push((await saved(page)).plan.inv.train);
      }
      const incOff = await page.locator('button[data-act="inc"][data-id="train"]').isDisabled();
      ok(seen.join() === '2,4,6,8,10,12,x' && incOff, 'a + adds 2 SP a click and turns itself off at 12', seen.join());
      await click(page, 'button[data-act="dec"][data-id="train"]');
      const after = (await saved(page)).plan.inv.train;
      for (let k = 0; k < 5; k++) await click(page, 'button[data-act="dec"][data-id="train"]');
      const gone = (await saved(page)).plan.inv;
      ok(after === 10 && !('train' in gone) && await page.locator('button[data-act="dec"][data-id="train"]').isDisabled(), 'a - takes 2 SP back, and at 0 the investment leaves the plan and - turns off', after + ' / ' + JSON.stringify(gone));
      await click(page, 'button.fund');
      await click(page, 'button[data-act="inc"][data-id="train"]');
      await click(page, 'button[data-act="clear"]');
      const cleared = (await saved(page)).plan;
      ok(!cleared.opp && !Object.keys(cleared.inv).length, 'Clear empties the plan', JSON.stringify(cleared));
    });

    /* ---------- 3. eight quarters of seeded clicking ---------- */
    await section('3. eight quarters of seeded clicking', async () => {
      const r = rng(20261012);
      const auditBad = [], shipBad = [], commitBad = [];
      let clicks = 0, sawFundOff = false, sawAddOffUnderMax = false, maxLevel = 0, crash = '', played = 0;
      await fresh();
      try {
      for (let q = 0; q < 8; q++) {
        // Y1Q4 is the crowded quarter: nothing funded, then + on everything until no + is left, so the
        // plan runs out of SP and both Fund and the + under 12 have to refuse
        const greedy = q === 3;
        const n = greedy ? 40 : 2 + Math.floor(r() * 5);
        if (!greedy && (r() < 0.85 || q < 3)) { await click(page, 'button.fund'); clicks++; const a = await auditNow(); if (a.length && !auditBad.length) auditBad.push('Q' + (q + 1) + ' fund: ' + a.join('; ')); }
        for (let k = 0; k < n; k++) {
          const ids = await page.$$eval('button[data-act="inc"]:not([disabled])', bs => bs.map(b => b.dataset.id));
          const decs = await page.$$eval('button[data-act="dec"]:not([disabled])', bs => bs.map(b => b.dataset.id));
          if (greedy && !ids.length) break;
          const useDec = !greedy && decs.length && r() < 0.25;
          const pool = useDec ? decs : ids;
          if (!pool.length) continue;
          const id = pool[Math.floor(r() * pool.length)];
          await click(page, 'button[data-act="' + (useDec ? 'dec' : 'inc') + '"][data-id="' + id + '"]');
          clicks++;
          const a = await auditNow();
          if (a.length && !auditBad.length) auditBad.push('Q' + (q + 1) + ' click ' + k + ': ' + a.join('; '));
        }
        const st = await page.evaluate(() => {
          const fund = document.querySelector('button.fund');
          const d = JSON.parse(localStorage.getItem('taas.v' + TAAS.CFG.version));
          const offUnderMax = [...document.querySelectorAll('button[data-act="inc"][disabled]')].some(b => (d.plan.inv[b.dataset.id] || 0) < TAAS.CFG.investMax);
          return { fundOff: fund.disabled && fund.textContent === 'Not enough SP or AIC', offUnderMax, big: document.querySelector('.outcome .big').textContent, before: d };
        });
        if (st.fundOff) sawFundOff = true;
        if (st.offUnderMax) sawAddOffUnderMax = true;
        await click(page, 'button[data-act="run"]');
        const after = await page.evaluate((q) => {
          const d = JSON.parse(localStorage.getItem('taas.v' + TAAS.CFG.version));
          const done = document.querySelectorAll('.q.done')[q];
          const rep = document.querySelector('.report b');
          return { d, val: done && done.querySelector('.q-val').textContent, report: rep && rep.textContent };
        }, q);
        if (after.val !== st.big || !after.report || after.report.indexOf(' shipped ' + st.big + ' units') < 0) shipBad.push('Q' + (q + 1) + ': showed ' + st.big + ', tracker ' + after.val + ', report "' + after.report + '"');
        const want = await page.evaluate(({ s, p }) => JSON.stringify(TAAS.commit(s, p)), { s: st.before.state, p: st.before.plan });
        if (JSON.stringify(after.d.state) !== want || after.d.plan.opp || Object.keys(after.d.plan.inv).length) commitBad.push('Q' + (q + 1));
        maxLevel = Math.max(maxLevel, after.d.state.level);
        played++;
      }
      } catch (e) { crash = 'Q' + (played + 1) + ': ' + e.message.split('\n')[0]; }
      // the rows report what was seen even when a quarter could not be played, so a break shows up by name
      ok(!crash, 'all eight quarters could be played by clicking', crash);
      ok(!auditBad.length && clicks > 40, 'every control agrees with the engine after every click, over eight quarters (' + clicks + ' clicks)', auditBad.join(' | '));
      ok(sawFundOff, 'Fund turns itself off, and says so, once the investments leave too few SP or AIC');
      ok(sawAddOffUnderMax, 'a + turns itself off under 12 SP when the plan has no room for it');
      ok(!shipBad.length, 'each quarter ships the units the forecast showed, in the tracker and in the report', shipBad.join(' | '));
      ok(!commitBad.length && maxLevel >= 3, 'Run commits exactly the plan on screen, then starts the next quarter empty', commitBad.join(', ') + ' max level ' + maxLevel);
    });

    /* ---------- 4. the scorecard ---------- */
    await section('4. the scorecard', async () => {
      const r = await page.evaluate(() => {
        const d = JSON.parse(localStorage.getItem('taas.v' + TAAS.CFG.version));
        const m = TAAS.summary(d.state);
        const num = t => parseFloat(String(t).replace(/,/g, '').replace(/^\+/, ''));
        const dds = [...document.querySelectorAll('.score-lines dd')].map(e => e.textContent);
        const delta = num((dds[0].match(/\(([-+]?[\d.,]+)\)/) || [])[1]);
        const s1 = dds[1] === 'met' ? 0 : num(dds[1]), s2 = dds[2] === 'met' ? 0 : num(dds[2]);
        const head = num(dds[3]), score = num(dds[4]);
        return { q: d.state.q, grade: document.querySelector('.grade').textContent, want: m.grade, score, mScore: m.score, sum: delta + s1 + s2 + head, run: !!document.querySelector('button[data-act="run"]') };
      });
      ok(r.q === 8 && !r.run && r.grade === r.want && r.score === r.mScore, 'after Y2Q4 the scorecard prints the engine\'s grade and score, with no Run button', JSON.stringify(r));
      ok(Math.abs(r.sum - r.score) <= 0.5 + 1e-9, 'and its printed lines add up to the printed score', r.sum + ' vs ' + r.score);
      await click(page, 'button[data-act="reset"]');
      const again = await page.evaluate(() => ({ now: document.querySelector('.q.now .q-name').textContent, done: document.querySelectorAll('.q.done').length, q: JSON.parse(localStorage.getItem('taas.v' + TAAS.CFG.version)).state.q }));
      ok(again.now === 'Y1Q1' && again.done === 0 && again.q === 0, 'Play again starts a new run at Y1Q1', JSON.stringify(again));
    });

    /* ---------- 5. reload mid-quarter; a save from another version ---------- */
    await section('5. reload mid-quarter; a save from another version', async () => {
      await fresh();
      for (let q = 0; q < 3; q++) { await click(page, 'button.fund'); await click(page, 'button[data-act="run"]'); }
      await click(page, 'button.fund');
      await click(page, 'button[data-act="inc"][data-id="train"]');
      await click(page, 'button[data-act="inc"][data-id="habits"]');
      const snap = () => page.evaluate(() => ({ tracker: document.getElementById('tracker').innerHTML, left: document.getElementById('left').innerHTML, right: document.getElementById('right').innerHTML, log: document.getElementById('log').innerHTML }));
      const before = await snap();
      await load();
      const back = await snap();
      const diff = Object.keys(before).filter(k => before[k] !== back[k]);
      ok(!diff.length && before.left.indexOf('aria-pressed="true"') >= 0, 'a reload mid-quarter puts back the run and the half-made plan, to the byte', diff.join(', '));

      bump = true;
      await load();
      const bumped = await page.evaluate(() => ({ q: document.querySelector('.q.now .q-name').textContent, done: document.querySelectorAll('.q.done').length, v: TAAS.CFG.version }));
      bump = false;
      ok(bumped.q === 'Y1Q1' && bumped.done === 0, 'a page whose CFG.version moved starts fresh instead of replaying the old save', JSON.stringify(bumped));
      await load();
      const kept = await page.evaluate(() => document.querySelectorAll('.q.done').length);
      ok(kept === 3, 'and the old version still finds its own save', kept);
      await page.evaluate(() => { const k = 'taas.v' + TAAS.CFG.version, d = JSON.parse(localStorage.getItem(k)); d.state.version = TAAS.CFG.version + 7; localStorage.setItem(k, JSON.stringify(d)); });
      await load();
      const stale = await page.evaluate(() => document.querySelectorAll('.q.done').length);
      ok(stale === 0, 'a save whose state carries another version is not loaded, even under the right key', stale);
    });

    /* ---------- 6. Restart asks twice ---------- */
    await section('6. Restart asks twice', async () => {
      await fresh();
      // clicked in the page, not through Playwright: a row that leaves the button missing then fails as itself
      const press = () => page.evaluate(() => { const b = document.querySelector('button[data-act="restart"]'); if (b) b.click(); return !!b; });
      const look = () => page.evaluate(() => ({ t: document.getElementById('restart').textContent, done: document.querySelectorAll('.q.done').length }));
      await click(page, 'button.fund'); await click(page, 'button[data-act="run"]');
      await press();
      const asked = await look();
      ok(asked.done === 1 && /again/i.test(asked.t), 'Restart asks before it wipes anything', JSON.stringify(asked));
      await click(page, 'button[data-act="inc"][data-id="train"]');
      const disarmed = await look();
      ok(disarmed.t === 'Restart' && disarmed.done === 1, 'and any other click takes the question back', JSON.stringify(disarmed));
      await press(); await press();
      const wiped = await look();
      ok(wiped.done === 0 && wiped.t === '', 'a second click on it wipes the run', JSON.stringify(wiped));
    });

    /* ---------- 7. the keyboard ---------- */
    await section('7. the keyboard', async () => {
      await fresh();
      await page.focus('button[data-act="inc"][data-id="train"]');
      for (let k = 0; k < 3; k++) await page.keyboard.press('Enter');
      const r = await page.evaluate(() => ({ key: document.activeElement && document.activeElement.dataset.key, sp: JSON.parse(localStorage.getItem('taas.v' + TAAS.CFG.version)).plan.inv.train }));
      ok(r.key === 'inc-train' && r.sp === 6, 'Enter on a + adds 2 SP a press and the focus stays on it through the re-render', JSON.stringify(r));
      for (let k = 0; k < 3; k++) await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      const r2 = await page.evaluate(() => ({ key: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null, sp: JSON.parse(localStorage.getItem('taas.v' + TAAS.CFG.version)).plan.inv.train }));
      ok(r2.sp === 12, 'and stops at 12 when it turns itself off', JSON.stringify(r2));
    });

    /* ---------- 8. phone layout ---------- */
    await section('8. phone layout', async () => {
      await fresh();
      // rows in the log and bars in the chart, clicked in the page: a layout break can put something over the
      // buttons, and this row has to measure the layout rather than die on the click
      for (let q = 0; q < 2; q++) await page.evaluate(() => { document.querySelector('button.fund').click(); document.querySelector('button[data-act="run"]').click(); });
      const bad = [];
      for (const w of [390, 320]) {
        await page.setViewportSize({ width: w, height: 760 });
        await page.waitForTimeout(200);   // the chart redraws 120 ms after a resize
        const r = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const box = id => document.getElementById(id).getBoundingClientRect();
          const b = box('menu-btn'), m = box('mode-btn'), rl = box('reload-btn'), h = document.querySelector('.mast h1').getBoundingClientRect();
          const svg = document.querySelector('#chart svg').getBoundingClientRect();
          return { vw, iw: innerWidth, rows: document.querySelectorAll('#log tbody tr').length, sw: document.scrollingElement.scrollWidth,
            chrome: b.left >= 0 && b.right <= m.left && m.right <= rl.left && rl.right <= vw && vw - rl.right < 24,
            overH1: !(h.top >= Math.max(b.bottom, m.bottom, rl.bottom)), chart: svg.right <= vw + 0.5 };
        });
        if (r.rows !== 2) bad.push(w + ': the log has ' + r.rows + ' rows, not 2');
        if (r.sw > r.vw || r.iw !== w) bad.push(w + ': page is ' + Math.max(r.sw, r.iw) + ' px wide');
        if (!r.chrome) bad.push(w + ': menu/mode/reload off screen, overlapping or out of order');
        if (r.overH1) bad.push(w + ': the chrome sits on the title');
        if (!r.chart) bad.push(w + ': chart wider than the screen');
      }
      ok(!bad.length, 'at 390 and 320 px nothing scrolls sideways, the chart fits, and the menu, mode and reload buttons clear the title with reload in the top right corner', bad.join('; '));
    });

    /* ---------- 9. the menu (the CD, 2026-10-14): Info, sound, Exit game ---------- */
    await section('9. menu', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await fresh();
      const gone = await page.evaluate(() => ['back-btn', 'mute-btn'].filter(id => document.getElementById(id)));
      ok(!gone.length, 'the back button and the mute button have gone from the top bar', gone.join());
      await page.tap('#menu-btn');
      const m = await page.evaluate(() => ({ open: !document.getElementById('menu').hidden, exp: document.getElementById('menu-btn').getAttribute('aria-expanded'), sub: document.getElementById('menu-info-sub').textContent,
        items: [...document.querySelectorAll('#menu .mi')].map(e => e.firstChild.textContent.trim()), exit: document.getElementById('menu-exit').getAttribute('href'), sliders: [...document.querySelectorAll('#menu input[type=range]')].map(e => e.closest('label').firstElementChild.textContent) }));
      ok(m.open && m.exp === 'true' && m.sub === 'How the model works' && m.items.join() === 'Info,Exit game' && m.exit === '../index.html' && m.sliders.join() === 'Music,Ambient sounds,Sound effects',
        'the menu opens with Info (how the model works), a volume for music, ambient sounds and sound effects, and Exit game back to the games list', JSON.stringify(m));
      // the ambience is really playing, and sits under the music (measured on the buses, 1.5 s)
      const lv = await page.evaluate(async () => {
        const A = { music: SND.probe('music'), amb: SND.probe('amb') }, sum = { music: 0, amb: 0 }, buf = new Float32Array(2048);
        for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 50)); Object.keys(A).forEach(k => { A[k].getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; sum[k] += s / buf.length; }); }
        return { music: Math.sqrt(sum.music / 30), amb: Math.sqrt(sum.amb / 30) };
      });
      ok(lv.amb > 0.0003 && lv.amb < lv.music * 0.6, 'the office ambience is audible and sits well under the music', JSON.stringify(lv));
      await page.tap('[data-menu="info"]');
      await page.waitForTimeout(100);
      const info = await page.evaluate(() => { const d = document.getElementById('model'), r = d.getBoundingClientRect(); return { open: d.open, top: r.top, vh: innerHeight, menu: !document.getElementById('menu').hidden }; });
      ok(info.open && info.top >= -1 && info.top < info.vh / 2 && !info.menu, 'Info closes the menu and opens how the model works, scrolled into view', JSON.stringify(info));
      await page.evaluate(() => window.scrollTo(0, 0));
      // the sound switch and the three volumes reach the buses, and persist
      await page.tap('#menu-btn');
      await page.tap('#snd-on');
      const off = await page.evaluate(() => ({ muted: SND.muted, aria: document.getElementById('snd-on').getAttribute('aria-checked'), stored: localStorage.getItem('taas-mute'), g: SND.gains }));
      await page.tap('#snd-on');
      const on = await page.evaluate(() => ({ muted: SND.muted, stored: localStorage.getItem('taas-mute'), g: SND.gains }));
      ok(off.muted && off.aria === 'false' && off.stored === '1' && off.g && off.g.music === 0 && off.g.amb === 0 && off.g.sfx === 0 && !on.muted && on.stored === '0' && on.g.sfx > 0 && on.g.music > 0 && on.g.amb > 0,
        'the sound switch silences music, ambience and effects together, and turns them back on', JSON.stringify([off, on]));
      await page.locator('#vol-music').fill('40');
      await page.locator('#vol-amb').fill('0');
      await page.locator('#vol-sfx').fill('70');
      const v = await page.evaluate(() => ({ vol: SND.vol, g: SND.gains, out: ['music', 'amb', 'sfx'].map(k => document.getElementById('vol-' + k + '-out').textContent), stored: JSON.parse(localStorage.getItem('taas-vol')) }));
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      ok(near(v.vol.music, 0.4) && near(v.vol.amb, 0) && near(v.vol.sfx, 0.7) && near(v.g.music, 0.09 * 0.4) && v.g.amb === 0 && near(v.g.sfx, 0.4 * 0.7) && v.out.join() === '40%,0%,70%' && !!v.stored && near(v.stored.music, 0.4) && near(v.stored.sfx, 0.7),
        'each slider sets its own bus (music 40%, ambient 0, effects 70%) and is saved', JSON.stringify(v));
      ok(Object.keys(v.g.beds).sort().join() === 'factory,formal' && v.g.bed === 'formal' && v.g.beds.formal > 0.9 && v.g.beds.factory < 0.1, 'there is an ambience for each mode, and only the formal one is playing', JSON.stringify(v.g));
      await page.mouse.click(380, 800);   // outside the menu: the scrim takes it
      const shut = await page.evaluate(() => document.getElementById('menu').hidden);
      if (!shut) await page.evaluate(() => TAAS_MENU.close());   // so a failure here is this row's, not a stuck menu's
      await page.tap('#menu-btn');
      await page.keyboard.press('Escape');
      const esc = await page.evaluate(() => ({ hidden: document.getElementById('menu').hidden, focus: document.activeElement && document.activeElement.id }));
      ok(shut && esc.hidden && esc.focus === 'menu-btn', 'a tap outside closes the menu, and so does Escape (focus back on the menu button)', JSON.stringify(esc));
      await load();
      await page.tap('#menu-btn');
      const kept = await page.evaluate(() => ({ vol: SND.vol, out: ['music', 'amb', 'sfx'].map(k => document.getElementById('vol-' + k + '-out').textContent) }));
      ok(kept.out.join() === '40%,0%,70%' && near(kept.vol.music, 0.4), 'after a reload the menu shows the same volumes', JSON.stringify(kept));
      await page.selectOption('#mode-btn', 'robot-factory');
      await page.waitForTimeout(1600);   // the fade's time constant is 0.4 s
      const fac = await page.evaluate(() => ({ g: SND.gains, sub: (TAAS_MENU.sync(), document.getElementById('menu-info-sub').textContent) }));
      ok(fac.g && fac.g.bed === 'factory' && fac.g.beds.factory > 0.9 && fac.g.beds.formal < 0.1 && fac.sub === 'How the factory works', 'switching to the factory fades its own ambience in and the office out, and Info speaks for the factory', JSON.stringify(fac));
      await page.selectOption('#mode-btn', 'formal');
      await page.evaluate(() => { localStorage.removeItem('taas-vol'); localStorage.removeItem('taas-mute'); });
    });

    /* ---------- 10. reload: the latest version, past any cache, in the same mode ---------- */
    await section('10. reload', async () => {
      await fresh();
      await page.evaluate(() => document.querySelector('button.fund').click());
      const before = await saved(page);
      await page.selectOption('#mode-btn', 'robot-factory');
      const nav = page.waitForNavigation({ waitUntil: 'load' });
      await page.tap('#reload-btn');
      await nav;
      await page.waitForFunction(() => document.documentElement.dataset.mode);
      const r = await page.evaluate(() => ({ url: location.search, mode: document.documentElement.dataset.mode, rect: document.getElementById('reload-btn').getBoundingClientRect().right, vw: innerWidth }));
      const after = await saved(page);
      ok(/[?&]_r=[0-9a-z]+/.test(r.url) && /mode=robot-factory/.test(r.url) && r.mode === 'robot-factory' && after && after.plan.opp === before.plan.opp && before.plan.opp === true,
        'the reload button comes back on a fresh address, in the same mode, with the run as it was', JSON.stringify(r));
      await page.goto(URL + '?mode=formal', { waitUntil: 'load' });
    });

    /* ---------- 11. the badge in the device's own time zone ---------- */
    await section('11. badge time zone', async () => {
      const stamp = (SRC.match(/id="build-badge"[^>]*>([^<]*)</) || [])[1];
      const m = /build (\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d) UTC/.exec(stamp || '');
      if (!m) { ok(false, 'the page carries a UTC build stamp', stamp); return; }
      const t = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]));
      const want = tz => { const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).formatToParts(t), g = k => f.find(x => x.type === k).value; return 'build ' + g('year') + '-' + g('month') + '-' + g('day') + ' ' + g('hour') + ':' + g('minute') + ' ' + g('timeZoneName'); };
      const seen = {};
      for (const [tz, init] of [['America/New_York'], ['Asia/Tokyo'], ['America/Los_Angeles', 'local'], ['America/Los_Angeles', 'none']]) {
        const c = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: tz });
        await c.route(u => !String(u).startsWith('http://127.0.0.1'), r => r.abort());
        // 'local': this device will not name its own zone, so the page falls back to US Eastern; 'none': no Intl zones at all
        if (init === 'local') await c.addInitScript(() => { const D = Intl.DateTimeFormat; Intl.DateTimeFormat = function (l, o) { if (!o || !o.timeZone) throw new RangeError('no zone'); return new D(l, o); }; });
        if (init === 'none') await c.addInitScript(() => { Intl.DateTimeFormat = function () { throw new RangeError('no Intl'); }; });
        const p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' });
        seen[tz + (init ? '/' + init : '')] = await p.evaluate(() => ({ text: document.getElementById('build-badge').textContent, utc: document.getElementById('build-badge').dataset.utc }));
        await c.close();
      }
      ok(seen['America/New_York'].text === want('America/New_York') && /E[DS]T$/.test(seen['America/New_York'].text) && seen['Asia/Tokyo'].text === want('Asia/Tokyo'),
        'the badge shows the build time in the device\'s own zone (New York, Tokyo)', JSON.stringify(seen));
      ok(seen['America/Los_Angeles/local'].text === want('America/New_York') && seen['America/Los_Angeles/none'].text === stamp && seen['America/New_York'].utc === stamp,
        'a device that will not name its zone gets US Eastern, and with no time zones at all the UTC stamp stays as written', JSON.stringify(seen));
    });

    ok(!errors.length, 'no page errors or console errors over the whole drive', errors.slice(0, 3).join(' | '));
  }

  await browser.close();
  server.close();
  console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
  console.log('TAAS-UI: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
  process.exit(failed ? 1 : 0);
})();
