#!/usr/bin/env node
/**
 * drive-taas-ui.cjs — the page around the TAAS engine, in Chromium at a phone's width.
 *
 * drive-taas.cjs proves the engine. This proves the page keeps the engine's promises on
 * screen: the forecast shown is the forecast, Run ships what was shown and commits the plan
 * on screen, every button that refuses agrees with the engine (and the one rule only the
 * page keeps, 12 SP an investment), a reload puts back the run and the half-made plan, a
 * save from another version is never replayed, and the scorecard prints the engine's score.
 * Plus the phone layout and the keyboard focus that every render has to put back.
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
const VERSION_RE = /(\n\s*version: )(\d+)(,)/;
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
    ok((SRC.match(new RegExp(VERSION_RE.source, 'g')) || []).length === 1, 'the page has exactly one CFG.version line for the bump to move');

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
          const b = box('back-btn'), m = box('mute-btn'), h = document.querySelector('.mast h1').getBoundingClientRect();
          const svg = document.querySelector('#chart svg').getBoundingClientRect();
          return { vw, iw: innerWidth, rows: document.querySelectorAll('#log tbody tr').length, sw: document.scrollingElement.scrollWidth, chrome: b.left >= 0 && m.right <= vw && b.right <= m.left, overH1: !(h.top >= Math.max(b.bottom, m.bottom) || h.right <= b.left), chart: svg.right <= vw + 0.5 };
        });
        if (r.rows !== 2) bad.push(w + ': the log has ' + r.rows + ' rows, not 2');
        if (r.sw > r.vw || r.iw !== w) bad.push(w + ': page is ' + Math.max(r.sw, r.iw) + ' px wide');
        if (!r.chrome) bad.push(w + ': back/mute off screen or overlapping');
        if (r.overH1) bad.push(w + ': back/mute sit on the title');
        if (!r.chart) bad.push(w + ': chart wider than the screen');
      }
      ok(!bad.length, 'at 390 and 320 px nothing scrolls sideways, the chart fits, and the back and mute buttons clear the title', bad.join('; '));
    });

    ok(!errors.length, 'no page errors or console errors over the whole drive', errors.slice(0, 3).join(' | '));
  }

  await browser.close();
  server.close();
  console.log('CHECKS=' + checks + ' PASSED=' + (checks - failed) + ' FAILED=' + failed);
  console.log('TAAS-UI: ' + (failed ? 'RED' : COPY ? 'PASS-ON-COPY' : 'GREEN'));
  process.exit(failed ? 1 : 0);
})();
