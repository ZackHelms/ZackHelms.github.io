#!/usr/bin/env node
/**
 * drive-fire-clicker.cjs — rules drive for the Fire Clicker village sim.
 *
 * 36 checks: cold start (villagers hide/huddle), tap-to-bank (1s/tap, cap,
 * drain-from-the-moment-it-lands, off-fire taps bank nothing), warm villagers
 * gather / fire-out retreat, the toggleable upgrade panel + its scroll
 * container, houses (5 villagers each, BUILD HOUSE slots, recruit cap =
 * houses*5), the CAMP→VILLAGE stage gate and the three businesses' live
 * effects, the firekeeper feeding the fire from stockpiled wood, chat bubbles
 * (real-tap summon, never stokes, ONE at a time, 5s expiry, contextual
 * pools), a night-lighting pixel assert (fireside snow brighter than far
 * snow), and save/reload persistence.
 *
 * Run from the repo root (same harness as the smoke gate):
 *   NODE_PATH=<dir-with-playwright-core>/node_modules \
 *     node .claude/tests/drive-fire-clicker.cjs
 * Optional: SHOTDIR=<dir> saves day/night/village/bubble screenshots.
 * Prints "FIRE-CLICKER DRIVE: N passed, M failed" and exits 0/1.
 */
const { chromium } = require('playwright-core');
const path = require('path');
const DIR = process.env.SHOTDIR || '';
const shot = (page, name) => DIR ? page.screenshot({ path: DIR + '/' + name }) : Promise.resolve();
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve('games/fire-clicker/index.html'));
  await page.waitForTimeout(800);
  const checks = [];
  const ok = (name, cond) => checks.push((cond ? 'PASS ' : 'FAIL ') + name);

  // cold start: fire out, villagers huddling or inside
  let st = await page.evaluate(() => ({
    bank: S.bank, burning: FIRE.burning, n: villagers.length,
    states: villagers.map(v => v.state),
  }));
  ok('starts cold (bank=' + st.bank + ', burning=' + st.burning + ')', st.bank === 0 && !st.burning);
  ok('4 villagers spawn (' + st.n + ')', st.n === 4);
  await page.waitForTimeout(4000);
  st = await page.evaluate(() => ({ states: villagers.map(v => v.state) }));
  const coldStates = st.states.filter(s => ['huddle','toSeat','toHome','inside'].includes(s)).length;
  ok('cold villagers hide/huddle (' + st.states.join(',') + ')', coldStates >= 3);

  // tap the fire: banks tapPower, mote spawns, fire lights
  const fire = await page.evaluate(() => G.fire);
  await page.touchscreen.tap(fire.x, fire.y);
  await page.waitForTimeout(120);
  st = await page.evaluate(() => ({ bank: S.bank, burning: FIRE.burning, motes: motes.length }));
  ok('one tap banks ~1s (' + st.bank.toFixed(2) + ') and lights fire', st.bank > 0.7 && st.bank <= 1 && st.burning);
  ok('mote spawned (' + st.motes + ')', st.motes >= 1);

  // bank caps at 5
  for (let i = 0; i < 12; i++) { await page.touchscreen.tap(fire.x, fire.y); await page.waitForTimeout(50); }
  st = await page.evaluate(() => ({ bank: S.bank, max: maxBank() }));
  ok('bank caps at maxBank (' + st.bank.toFixed(1) + '/' + st.max + ')', st.bank <= st.max && st.bank > st.max - 1);

  // bank drains ~1s/s
  const b0 = st.bank;
  await page.waitForTimeout(2000);
  st = await page.evaluate(() => ({ bank: S.bank }));
  ok('bank drains while burning (' + b0.toFixed(1) + ' -> ' + st.bank.toFixed(1) + ')', st.bank < b0 - 1.2 && st.bank > b0 - 3);

  // tap off-fire does NOT bank
  const bOff0 = st.bank;
  await page.touchscreen.tap(30, 700);
  await page.waitForTimeout(120);
  st = await page.evaluate(() => ({ bank: S.bank }));
  ok('off-fire tap banks nothing', st.bank <= bOff0);

  // warm villagers work and haul resources
  await page.evaluate(() => { S.bank = 60; });
  const r0 = await page.evaluate(() => ({ ...S.res }));
  await page.waitForTimeout(16000);
  const r1 = await page.evaluate(() => ({ res: { ...S.res }, states: villagers.map(v => v.state) }));
  const gained = (r1.res.wood - r0.wood) + (r1.res.stone - r0.stone) + (r1.res.food - r0.food);
  ok('warm villagers gather (' + JSON.stringify(r1.res) + ')', gained >= 2);
  ok('some villagers working (' + r1.states.join(',') + ')', r1.states.some(s => ['toWork','working','toStock'].includes(s)));

  // fire dies -> villagers retreat
  await page.evaluate(() => { S.bank = 0.1; });
  await page.waitForTimeout(6000);
  st = await page.evaluate(() => ({ burning: FIRE.burning, states: villagers.map(v => v.state) }));
  const retreat = st.states.filter(s => ['huddle','toSeat','toHome','inside','idle'].includes(s)).length;
  ok('fire out -> villagers retreat (' + st.states.join(',') + ')', !st.burning && retreat >= 3);

  // day cycle advances; buy an upgrade
  const d0 = await page.evaluate(() => S.dayT);
  await page.evaluate(() => { S.res = { wood: 500, stone: 500, food: 500 }; });
  await page.locator('#upg-btn').click();
  await page.waitForTimeout(300);
  ok('upgrade panel opens', await page.locator('#upg-panel.open').count() === 1);
  await page.locator('.up-card').first().click();  // FIRE PIT
  await page.waitForTimeout(200);
  st = await page.evaluate(() => ({ pit: S.up.pit, max: maxBank(), stone: S.res.stone }));
  ok('FIRE PIT bought (lvl=' + st.pit + ', maxBank=' + st.max + ')', st.pit === 1 && st.max === 10 && st.stone < 500);

  // hire a keeper, verify auto-feed from wood
  st = await page.evaluate(() => {
    const u = UPG.find(u => u.id === 'keeper');
    const c = u.cost(S.up.keeper);
    for (const k of Object.keys(c)) S.res[k] -= c[k];
    S.up.keeper++; syncVillagers();
    S.bank = 0.5; S.res.wood = 50;
    return { n: villagers.length, keepers: villagers.filter(v => v.keeper).length };
  });
  ok('keeper hired (' + st.n + ' villagers, ' + st.keepers + ' keeper)', st.keepers === 1 && st.n === 5);
  await page.waitForTimeout(13000);
  st = await page.evaluate(() => ({ bank: S.bank, wood: S.res.wood, burning: FIRE.burning }));
  ok('keeper feeds fire from wood (bank=' + st.bank.toFixed(1) + ', wood=' + st.wood + ')', st.burning && st.wood < 50);

  // --- upgrades panel toggle + scroll container ---
  ok('scroll container exists', await page.locator('#upg-scroll').count() === 1);
  await page.locator('#upg-btn').click();   // panel is open -> toggles closed
  await page.waitForTimeout(200);
  ok('upgrades button toggles panel closed', await page.locator('#upg-panel.open').count() === 0);
  await page.locator('#upg-btn').click();   // toggles open again
  await page.waitForTimeout(200);
  ok('upgrades button toggles panel open', await page.locator('#upg-panel.open').count() === 1);

  // --- houses & stages ---
  await page.evaluate(() => { S.res = { wood: 99999, stone: 99999, food: 99999 }; refreshHUD(); });
  for (let i = 0; i < 3; i++) { await page.locator('.up-card[data-uid="house"]').click(); await page.waitForTimeout(120); }
  st = await page.evaluate(() => ({
    n: houses(), homes: activeHomes().length,
    bunkMax: maxOf(UPG.find(u => u.id === 'bunk')),
    villageCard: !!document.querySelector('.up-card[data-uid="village"]'),
  }));
  ok('built up to 5 houses (' + st.n + ')', st.n === 5 && st.homes === 5);
  ok('villager cap follows houses (bunk max=' + st.bunkMax + ')', st.bunkMax === 21);
  ok('FOUND VILLAGE appears at 5 houses', st.villageCard);
  await shot(page, 'fire-camp5.png');
  await page.locator('.up-card[data-uid="village"]').click();
  await page.waitForTimeout(250);
  st = await page.evaluate(() => ({
    stage: stageName(), maxH: stageMaxHouses(),
    tavern: !!document.querySelector('.up-card[data-uid="tavern"]'),
    shop: !!document.querySelector('.up-card[data-uid="shop"]'),
    saw: !!document.querySelector('.up-card[data-uid="sawbones"]'),
  }));
  ok('FOUND VILLAGE -> stage VILLAGE, cap 10 houses', st.stage === 'VILLAGE' && st.maxH === 10);
  ok('businesses unlocked (tavern/shop/sawbones)', st.tavern && st.shop && st.saw);
  const y0 = await page.evaluate(() => tripYield());
  for (const uid of ['tavern', 'shop', 'sawbones']) { await page.locator('.up-card[data-uid="' + uid + '"]').click(); await page.waitForTimeout(120); }
  for (let i = 0; i < 3; i++) { await page.locator('.up-card[data-uid="house"]').click(); await page.waitForTimeout(100); }
  st = await page.evaluate(() => ({ biz: activeBiz().length, yield: tripYield(), homes: activeHomes().length }));
  ok('3 businesses built + shop yield bonus (' + y0 + ' -> ' + st.yield + ')', st.biz === 3 && st.yield === y0 + 1);
  ok('village grows to 8 houses (' + st.homes + ')', st.homes === 8);
  await page.locator('#upg-btn').click();  // close via the bottom-right toggle
  await page.waitForTimeout(200);
  ok('panel closed via bottom-right button', await page.locator('#upg-panel.open').count() === 0);
  await page.evaluate(() => { S.bank = 60; S.dayT = 0.30; });
  await page.waitForTimeout(700);
  await shot(page, 'fire-village.png');

  // --- chat bubbles ---
  await page.evaluate(() => { S.bank = 60; });
  // real tap on a villager summons a bubble and does NOT stoke
  let vpos = await page.evaluate(() => {
    const v = villagers.find(v => v.state !== 'inside');
    return { x: v.x, y: v.y - 12, id: v.id, bank: S.bank };
  });
  await page.touchscreen.tap(Math.round(vpos.x), Math.round(vpos.y));
  await page.waitForTimeout(150);
  st = await page.evaluate(() => ({ has: !!bubble, id: bubble && bubble.v.id, text: bubble && bubble.lines.join(' '), bank: S.bank }));
  ok('villager tap summons bubble ("' + (st.text || '') + '")', st.has && st.text.length > 3);
  ok('villager tap does not stoke', st.bank <= vpos.bank);
  // second villager tap while a bubble is up: ignored (one bubble at a time)
  st = await page.evaluate(() => {
    const other = villagers.find(v => v.state !== 'inside' && (!bubble || v.id !== bubble.v.id));
    const before = bubble && bubble.v.id;
    if (other) speak(other);
    return { before, after: bubble && bubble.v.id };
  });
  ok('only one bubble at a time (v' + st.before + ' stays)', st.before === st.after);
  await shot(page, 'fire-bubble.png');
  // bubble expires after ~5s, then a new one can appear
  await page.waitForTimeout(5400);
  st = await page.evaluate(() => {
    const gone = !bubble;
    const v = villagers.find(v => v.state !== 'inside');
    speak(v);
    return { gone, again: !!bubble };
  });
  ok('bubble expires after 5s and a new one can appear', st.gone && st.again);
  await page.evaluate(() => { bubble = null; });
  // contextual pools: a carrier mentions their haul; night draws reach the night pool
  st = await page.evaluate(() => {
    const v = villagers[0];
    const saveCarry = v.carry; v.carry = 'wood';
    let woodHit = false;
    for (let i = 0; i < 60; i++) { const l = pickLine(v); if (SAY.carry.wood.includes(l)) woodHit = true; }
    v.carry = saveCarry;
    S.dayT = 0.85; // night
    let nightHit = false;
    for (let i = 0; i < 60; i++) { const l = pickLine(villagers[1]); if (SAY.night.includes(l)) nightHit = true; }
    return { woodHit, nightHit };
  });
  ok('carry lines reachable (wood)', st.woodHit);
  ok('night lines reachable at night', st.nightHit);

  // night lighting: fire-lit ground brighter than far corner
  await page.evaluate(() => { S.dayT = 0.85; S.bank = 40; });
  await page.waitForTimeout(1200);
  const lum = await page.evaluate(() => {
    const c = document.getElementById('scene');
    const g = c.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = (x, y) => {
      const d = g.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data;
      return (d[0] + d[1] + d[2]) / 3;
    };
    return { near: px(G.fire.x + 40, G.fire.y + 20), far: px(20, window.innerHeight - 30) };
  });
  ok('night: fireside brighter than far snow (' + lum.near.toFixed(0) + ' vs ' + lum.far.toFixed(0) + ')', lum.near > lum.far + 25);
  await shot(page, 'fire-night.png');

  // day screenshot + persistence
  await page.evaluate(() => { S.dayT = 0.30; S.bank = 8; save(); });
  await page.waitForTimeout(800);
  await shot(page, 'fire-day.png');
  await page.reload();
  await page.waitForTimeout(800);
  st = await page.evaluate(() => ({ pit: S.up.pit, keeper: S.up.keeper, day: S.day, wood: S.res.wood }));
  ok('save persists (pit=' + st.pit + ', keeper=' + st.keeper + ')', st.pit === 1 && st.keeper === 1);

  ok('back-btn present', await page.locator('#back-btn').count() === 1);
  ok('mute-btn present', await page.locator('#mute-btn').count() === 1);

  console.log(checks.join('\n'));
  console.log('ERRORS=' + errors.length);
  errors.forEach(e => console.log('  ' + e));
  const failed = checks.filter(c => c.startsWith('FAIL')).length + errors.length;
  const passed = checks.length - (failed - errors.length);
  console.log('FIRE-CLICKER DRIVE: ' + passed + ' passed, ' + failed + ' failed');
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
