#!/usr/bin/env node
/**
 * drive-fire-clicker.cjs — rules drive for the Fire Clicker village sim.
 *
 * 60 checks: cold start (villagers hide/huddle), tap-to-bank (1s/tap, cap,
 * drain-from-the-moment-it-lands, off-fire taps bank nothing), warm villagers
 * gather / fire-out retreat, the toggleable upgrade panel + its scroll
 * container, houses (5 villagers each, BUILD HOUSE slots, recruit cap =
 * houses*5), the CAMP→VILLAGE stage gate and the three businesses' live
 * effects, the firekeeper feeding the fire from stockpiled wood, the
 * DEAD-CAMP RECOVERY VALVE (a dead fire + empty woodpile is the one terminal
 * state, so the keeper — and only the keeper — forages in the cold and comes
 * back with an armful big enough to RELIGHT, not flicker), the ROARING FIRE
 * ramp (half the bonus at the 75% line, strictly increasing to full at a
 * brimming bank, and a deeper FIRE PIT paying more one second after a tap),
 * the BELLOWS card staying hidden until the fire has roared once, chat bubbles
 * (real-tap summon, never stokes, ONE at a time, 5s expiry, contextual
 * pools), a night-lighting pixel assert (fireside snow brighter than far
 * snow), save/reload persistence, and the rotation/orientation geometry:
 * a stale layout self-heals, and — the landscape bug — the layout follows the
 * canvas's own box rather than window.innerHeight, so the DRAWN fire circle
 * is tappable top to bottom even when the two disagree (iOS after rotating
 * into landscape).
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

  /* THE DEAD-CAMP RECOVERY VALVE. A dead fire plus an empty woodpile is the one
     state the camp cannot work its way out of on its own: cold villagers huddle
     or go inside, so nobody gathers, so the keeper has nothing to throw. A
     player reaches it by spending the last wood as the bank runs out. The
     keeper must go fetch wood ITSELF — and it must be the only one who does,
     or the cold would stop costing a hands-off player anything. */
  await page.evaluate(() => { S.res.wood = 0; S.bank = 0; FIRE.burning = false; });
  await page.waitForTimeout(2000);
  st = await page.evaluate(() => ({
    keeper: villagers.filter(v => v.forage).length,
    others: villagers.filter(v => !v.keeper && (v.state === 'toWork' || v.state === 'working')).length,
  }));
  ok('only the keeper works in the cold (' + st.keeper + ' foraging, ' + st.others + ' others)',
     st.keeper === 1 && st.others === 0);
  /* One armful is a WHOLE round trip of fire, not a flicker: the keeper must
     come back with enough that the fire is still burning while the rest of the
     camp completes a gather trip. Asserting `burning` as well as `wood` is what
     makes this a recovery check rather than a "the keeper walked somewhere"
     check — a one-log run passes the wood half and still leaves a dead camp. */
  await page.waitForTimeout(26000);
  st = await page.evaluate(() => ({ wood: S.res.wood, bank: S.bank, burning: FIRE.burning }));
  ok('a dead camp relights itself (wood=' + st.wood + ', bank=' + st.bank.toFixed(1) + ', burning=' + st.burning + ')',
     st.wood > 0 && st.burning);
  await page.evaluate(() => { S.res.wood = 200; S.bank = 60; });

  // --- upgrades panel toggle + scroll container ---
  ok('scroll container exists', await page.locator('#upg-scroll').count() === 1);

  /* THE TWO DISTRICTS. Villagers walk between the stockpile and the three work
     sites; nothing may be BUILT on that corridor. Canvas has no collision, so
     a hut on a lane is not an obstacle — villagers stroll straight through it,
     which reads worse than an obstacle would. Checked at a FULL district (ten
     houses plus all three businesses) and in both orientations, because the
     bands are fractions of the ground and landscape's ground is a third the
     depth of portrait's — the arrangement that fits one can invert in the
     other. Three claims: every building sits inside the build district, every
     building clears every walking lane, and the build district is the bigger
     of the two, which is the CD's actual ask. */
  for (const vp of [{ width: 390, height: 844, n: 'portrait' }, { width: 844, height: 390, n: 'landscape' }]) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);
    st = await page.evaluate(() => {
      const save = { ...S.up };
      S.up.village = 1; S.up.house = 8; S.up.tavern = 1; S.up.shop = 1; S.up.sawbones = 1;
      resize();
      const lanes = JOBS.map(j => { const s = j.site(); return [G.stock.x, G.stock.y, s.x, s.y]; });
      const bld = activeHomes().concat(activeBiz()).map(b => ({ x: b.x, y: b.y, w: b.w, top: b.y - b.w * 0.78 }));
      const d2seg = (px, py, x1, y1, x2, y2) => {
        const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, L ? ((px - x1) * dx + (py - y1) * dy) / L : 0));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
      };
      let lane = Infinity;
      for (const b of bld) for (const L of lanes)
        for (const c of [[b.x, b.y], [b.x - b.w / 2, b.y], [b.x + b.w / 2, b.y], [b.x, b.top]])
          lane = Math.min(lane, d2seg(c[0], c[1], L[0], L[1], L[2], L[3]));
      const out = {
        n: bld.length,
        inDistrict: bld.every(b => b.y >= G.zone.buildTop - 1 && b.y <= G.zone.buildBot + 1),
        lane: Math.round(lane),
        build: Math.round(G.zone.buildBot - G.zone.buildTop),
        work: Math.round(G.zone.workBot - G.zone.workTop),
        // the work band must start below the stockpile, or a "lane" is zero-length
        bandsOrdered: G.zone.buildBot < G.fire.y && G.stock.y < G.zone.workTop,
      };
      Object.assign(S.up, save); resize();
      return out;
    });
    ok(vp.n + ': all ' + st.n + ' buildings sit in the build district', st.inDistrict);
    ok(vp.n + ': no building on a walking lane (' + st.lane + 'px clear)', st.lane > 40);
    ok(vp.n + ': build district is the bigger one (' + st.build + ' vs work ' + st.work + ')', st.build > st.work);
    ok(vp.n + ': districts are ordered build < hearth < work', st.bandsOrdered);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  /* ------------------------- THE STAGE LADDER ------------------------- */
  st = await page.evaluate(() => {
    const save = JSON.stringify(S.up);
    for (const k of Object.keys(S.up)) S.up[k] = 0;
    const out = { rungs: [], gate: {} };
    S.res = { wood: 1e12, stone: 1e12, food: 1e12 };
    /* The FOUND gate is two clauses and both must bite: every house slot of
       the rung below built, AND every civic building of that rung open. */
    S.up.village = 1; S.up.house = 8;                 // 10 houses, no businesses
    out.gate.housesOnly = showU(UPG.find(u => u.id === 'town'));
    S.up.house = 0; S.up.tavern = 1; S.up.shop = 1; S.up.sawbones = 1;
    out.gate.bizOnly = showU(UPG.find(u => u.id === 'town'));
    S.up.house = 8;
    out.gate.both = showU(UPG.find(u => u.id === 'town'));
    for (const k of Object.keys(S.up)) S.up[k] = 0;
    // walk the ladder and record what each rung actually changes
    for (const stg of STAGES) {
      if (stg.id) S.up[stg.id] = 1;
      resize();
      out.rungs.push({ n: stageName(), cap: stageMaxHouses(), hearth: stage().hearth,
                       walls: stage().walls, w: +houseW().toFixed(1),
                       lamps: (G.lamps || []).length, slots: houseSlots().length });
    }
    for (const k of Object.keys(S.up)) S.up[k] = 0;
    Object.assign(S.up, JSON.parse(save)); resize();
    return out;
  });
  ok('FOUND TOWN needs its businesses, not just houses', st.gate.housesOnly === false);
  ok('FOUND TOWN needs its houses, not just businesses', st.gate.bizOnly === false);
  ok('FOUND TOWN opens when the village is complete', st.gate.both === true);
  ok('five rungs: ' + st.rungs.map(r => r.n).join(' -> '), st.rungs.length === 5);
  ok('every rung has its own hearth (' + st.rungs.map(r => r.hearth).join(',') + ')',
     new Set(st.rungs.map(r => r.hearth)).size === 5);
  ok('every rung has its own architecture', new Set(st.rungs.map(r => r.walls)).size === 5);
  /* Buildings must SHRINK every rung and the cap must grow, or a metropolis
     does not fit its own district — the two numbers are the whole reason the
     grid reads as denser rather than just taller. */
  ok('house caps grow (' + st.rungs.map(r => r.cap).join(',') + ')',
     st.rungs.every((r, i) => i === 0 || r.cap > st.rungs[i - 1].cap));
  ok('buildings shrink every rung (' + st.rungs.map(r => r.w).join(',') + ')',
     st.rungs.every((r, i) => i === 0 || r.w < st.rungs[i - 1].w));
  ok('a slot exists for every house the rung allows',
     st.rungs.every(r => r.slots >= r.cap));
  ok('street lamps arrive with the town and multiply (' + st.rungs.map(r => r.lamps).join(',') + ')',
     st.rungs[0].lamps === 0 && st.rungs[1].lamps === 0 && st.rungs[4].lamps > st.rungs[2].lamps);

  /* --------------------------- EVOLUTION ----------------------------- */
  st = await page.evaluate(() => {
    const out = {};
    /* evolve() REPLACES S wholesale — that is its job — so this block
       snapshots the whole run and puts it back afterwards. Without that it
       silently wiped the upgrades the save-persistence check further down
       depends on, and that check failed a hundred lines from the cause. */
    const snapshot = JSON.stringify(S);
    for (const k of Object.keys(S.up)) S.up[k] = 0;
    S.bestReach = 0; S.embers = 0; S.evolutions = 0; S.gathered = 0;
    out.coldCamp = canEvolve();                    // a camp has nothing to bank
    S.up.village = 1;
    out.atVillage = canEvolve();
    S.gathered = 40000; S.res = { wood: 5, stone: 5, food: 5 }; S.up.house = 3;
    out.gain1 = evolveGain();
    evolve();
    out.after1 = { embers: S.embers, best: S.bestReach, evos: S.evolutions,
                   stage: stageName(), houses: houses(), gathered: S.gathered,
                   res: S.res.wood + S.res.stone + S.res.food,
                   villagers: villagers.length, mul: +emberMul().toFixed(2) };
    // THE HIGH-WATER RULE: a shallower run banks nothing at all
    S.up.village = 1; S.gathered = 30000;
    out.gainShallower = evolveGain();
    evolve();
    out.after2 = { embers: S.embers, best: S.bestReach, evos: S.evolutions };
    // ...and a deeper one pays
    S.up.village = 1; S.gathered = 120000;
    out.gainDeeper = evolveGain();
    evolve();
    out.after3 = { embers: S.embers, best: S.bestReach };
    // the bonus is a real multiplier on what a trip hauls
    S.up.tools = 0; S.up.shop = 0; S.up.school = 0;
    out.yield = +tripYield().toFixed(2);
    S = JSON.parse(snapshot);
    HOMES.length = 0; villagers.length = 0; seatTaken.fill(false);
    resize(); syncVillagers();
    return out;
  });
  ok('a camp cannot evolve yet', st.coldCamp === false);
  ok('a village can', st.atVillage === true);
  ok('a first run banks embers (' + st.gain1 + ' from 40k hauled)', st.gain1 > 0);
  ok('evolving resets the settlement (' + st.after1.stage + ', ' + st.after1.houses +
     ' houses, ' + st.after1.res + ' res, ' + st.after1.gathered + ' hauled)',
     st.after1.stage === 'CAMP' && st.after1.houses === 2 && st.after1.res === 0 &&
     st.after1.gathered === 0 && st.after1.villagers === 4);
  ok('...and keeps the embers (' + st.after1.embers + ', x' + st.after1.mul + ')',
     st.after1.embers === st.gain1 && st.after1.mul > 1);
  /* The rule the CD asked for, stated as a test: reaching the same depth a
     second time banks NOTHING, because embers are a function of the
     high-water mark rather than a running total. */
  ok('a SHALLOWER run banks nothing (gain ' + st.gainShallower + ')', st.gainShallower === 0);
  ok('...and the mark does not move down (' + st.after2.best + ')',
     st.after2.best === st.after1.best && st.after2.embers === st.after1.embers);
  ok('...but the evolution still counted (' + st.after2.evos + ')', st.after2.evos === 2);
  ok('a DEEPER run pays again (+' + st.gainDeeper + ' -> ' + st.after3.embers + ')',
     st.gainDeeper > 0 && st.after3.embers === st.after1.embers + st.gainDeeper);
  ok('embers multiply what a trip hauls (' + st.yield + ' from a base of 1)', st.yield > 1.5);

  /* ---------------------------- MISHAPS ------------------------------
     The accident/crime/fire layer. Like EVOLUTION above this block moves the
     settlement several rungs up the ladder and back, so it snapshots S and
     rebuilds the scene at the end — a stage flip resizes every building, and
     leaving one half-applied breaks a later check a long way from the cause. */
  st = await page.evaluate(() => {
    const out = {};
    const snapshot = JSON.stringify(S);
    const atStage = (k) => { for (const s of STAGES) if (s.id) S.up[s.id] = 0;
                             for (let j = 1; j <= k; j++) S.up[STAGES[j].id] = 1; resize(); };

    /* 1. A CAMP has nothing worth stealing and nothing to burn. */
    atStage(0);
    MISH.length = 0; THIEF = null;
    for (let i = 0; i < 60; i++) spawnMishap();
    out.campQuiet = MISH.length === 0 && !THIEF;
    out.campNoRow = ['med','crime','fire'].every(f => mishapFor(f) === null);

    /* 2. The ladder escalates the incident AND the rank it takes to answer. */
    out.ladder = [];
    for (let k = 1; k < STAGES.length; k++) {
      atStage(k);
      out.ladder.push({ st: STAGES[k].n,
        med: mishapFor('med').id, crime: mishapFor('crime').id, fire: mishapFor('fire').id,
        need: mishapFor('crime').need });
    }

    /* 3. An INJURY idles a villager; a tap advances the bar; healing frees them. */
    atStage(1);
    S.res = { wood: 2000, stone: 2000, food: 2000 };
    S.up.house = 8; S.up.bunk = 6; S.up.sawbones = 1; layoutBuildings(); syncVillagers();
    FIRE.burning = true; S.bank = maxBank();
    MISH.length = 0; THIEF = null;
    spawnInjury(mishapFor('med'));
    const inj = MISH[0];
    out.injState = inj.v.state;
    out.injLinked = inj.v.hurt === inj;
    const p0 = inj.prog;
    tapMishap(inj.v.x, inj.v.y - 12);
    out.injTap = +(inj.prog - p0).toFixed(3);
    out.injTapWant = +(inj.k.work * MISHAP_TAP).toFixed(3);
    /* A hurt villager is a DEAD END — only mishapStep moves them — so prove
       the step both holds them there and lets them go. */
    for (let i = 0; i < 30; i++) villagerStep(inj.v, 1 / 30);
    out.injStuck = inj.v.state === 'hurt';
    for (let i = 0; i < 60 * 40 && MISH.length; i++) mishapStep(1 / 60);
    out.injFreed = inj.v.state !== 'hurt' && !inj.v.hurt && MISH.length === 0;

    /* 4. A better building answers faster — the CD's rule, as arithmetic. */
    const fever = MISHAPS.find(k => k.id === 'fever');
    out.rateLadder = [0, 1, 2].map(l => +mishapRate(fever, l).toFixed(2));

    /* 5. A BLAZE takes the building's EFFECT off, not just its looks. */
    S.up.tavern = 1; S.up.shop = 1; layoutBuildings();
    MISH.length = 0;
    out.walkBefore = +walkMul().toFixed(3);
    BIZ.tavern.dmg = true;
    out.walkBurning = +walkMul().toFixed(3);
    BIZ.tavern.dmg = false;
    spawnBlaze(mishapFor('fire'));
    out.blazeDmg = MISH[0].b.dmg === true;
    for (let i = 0; i < 60 * 60 && MISH.length; i++) mishapStep(1 / 60);
    out.blazeOut = MISH.length === 0 && !BIZ.tavern.dmg && +walkMul().toFixed(3) === out.walkBefore;

    /* 6. The THIEF, and the law. A tap is a real pointer event, because the
          ORDER of the hit tests is the thing being asserted: the thief has to
          win against the fire, the work sites and the chat bubble. */
    atStage(2);                       // TOWN: the burglar needs a constable
    S.up.constable = 0; S.res = { wood: 1000, stone: 1000, food: 1000 };
    THIEF = null; MISH.length = 0; bubble = null;
    spawnThief(mishapFor('crime'));
    THIEF.x = W / 2; THIEF.y = G.zone.buildBot + 20;
    THIEF.bag = { wood: 40, stone: 30, food: 20 }; THIEF.loot = 90;
    const r = cv.getBoundingClientRect();
    const tapAt = (x, y) => cv.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: r.left + x, clientY: r.top + y, bubbles: true, pointerId: 1 }));
    const bank0 = S.bank;
    tapAt(THIEF.x, THIEF.y - 12);
    out.noLaw = { still: !!THIEF && THIEF.state !== 'caught', bubble: bubble ? bubble.lines.join(' ') : null,
                  stoked: +(S.bank - bank0).toFixed(3) };
    S.up.constable = 1;               // now the settlement can make the catch
    THIEF.x = W / 2; THIEF.y = G.zone.buildBot + 20;
    const before = S.res.wood + S.res.stone + S.res.food;
    tapAt(THIEF.x, THIEF.y - 12);
    out.withLaw = { state: THIEF && THIEF.state, recovered: (S.res.wood + S.res.stone + S.res.food) - before,
                    caught: S.caught };

    /* 7. A grab is CAPPED. Uncapped, a share of the hoard is an unbounded tax
          on saving up for a stage — measured, it put CITY out of reach. */
    THIEF = null;
    S.res = { wood: 1e6, stone: 1e6, food: 1e6 };
    spawnThief(mishapFor('crime'));
    const huge = S.res.wood;
    thiefGrab();
    out.capped = { took: huge - S.res.wood, cap: Math.ceil(thiefGrabCap(popCap(), tripYield())),
                   share: Math.floor(huge * THIEF.k.cut) };

    /* 8. What an escaped thief costs — and what he CANNOT cost. Reach is what
          the camp HAULED, and a thief cannot un-haul it. */
    S.stolen = 0; S.gathered = 5000;
    THIEF.loot = 777; THIEF.x = -100; THIEF.state = 'flee';
    thiefStep(1 / 60);
    out.escaped = { gone: THIEF === null, stolen: S.stolen, gathered: S.gathered };

    /* 9. Incidents belong to the run that was. */
    MISH.length = 0; spawnInjury(mishapFor('med')); spawnBlaze(mishapFor('fire'));
    S.gathered = 50000; evolve();
    out.evolved = MISH.length === 0 && THIEF === null && !villagers.some(v => v.hurt);

    /* 10. The dead-end guard. 'hurt' is a state nothing but mishapStep leaves,
           so a villager whose ROLE changes while hurt would be stranded there
           for the rest of the run — the exact shape of the keeper-flag bug
           this suite already pins. Today the reachable flip is keeper->worker
           and keepers are never injured, so this drives the other direction
           (popCap falling below the villager's index) to prove the release
           actually fires rather than trusting that it is unreachable. */
    S = JSON.parse(snapshot);
    atStage(1);
    S.up.keeper = 0; S.up.house = 8; S.up.bunk = 12; layoutBuildings(); syncVillagers();
    MISH.length = 0;
    /* spawnInjury picks at random, so narrow its pool to the two villagers a
       popCap of 10 will demote — this has to land on a HIGH index to flip. */
    const hidden = villagers.slice(0, 14);
    for (const v of hidden) v.state = 'inside';
    spawnInjury(mishapFor('med'));
    for (const v of hidden) v.state = 'idle';
    const hv = MISH[0].v;
    const hurtIx = villagers.indexOf(hv);
    S.up.house = 0; layoutBuildings(); syncVillagers();   // popCap falls past it -> role flip
    out.flip = { flipped: hurtIx >= popCap(), stillHurt: hv.state === 'hurt' || !!hv.hurt,
                 open: MISH.length };

    /* 11. The clock only runs on a WORKING camp. */
    S = JSON.parse(snapshot);
    atStage(1);
    MISH.length = 0; THIEF = null; FIRE.burning = false; mishT = 0.1;
    for (let i = 0; i < 60 * 300; i++) mishapStep(1 / 60);
    out.coldQuiet = MISH.length === 0 && !THIEF;

    S = JSON.parse(snapshot);
    MISH.length = 0; THIEF = null; bubble = null;
    /* SILENCE the layer for the rest of the suite. Everything below this block
       runs a VILLAGE with a burning fire, which is exactly the state that
       spawns incidents — and an incident intercepts a tap by design (a hurt
       villager's tap is help, not a chat bubble), so a random injury landing on
       the villager the bubble checks tap makes those checks flaky. Caught by
       the gate running this suite while another copy was running: the bubble
       pair went red there and green in isolation. */
    mishT = 1e9;
    HOMES.length = 0; villagers.length = 0; seatTaken.fill(false);
    resize(); syncVillagers();
    return out;
  });
  ok('a CAMP has no incidents (' + st.campQuiet + ')', st.campQuiet && st.campNoRow);
  ok('the crime ladder escalates (' + st.ladder.map(l => l.crime).join(' -> ') + ')',
     st.ladder.map(l => l.crime).join(',') === 'sneak,burglar,runner,heist');
  ok('...and so does the rank it takes to answer (' + st.ladder.map(l => l.need).join(',') + ')',
     st.ladder.map(l => l.need).join(',') === '0,1,1,2');
  ok('every family escalates with the rung (' +
     st.ladder.map(l => l.med + '/' + l.fire).join(' ') + ')',
     new Set(st.ladder.map(l => l.med)).size === 4 && new Set(st.ladder.map(l => l.fire)).size === 4);
  ok('an injury idles a villager (' + st.injState + ')', st.injState === 'hurt' && st.injLinked);
  ok('a tap advances the recovery bar (+' + st.injTap + ' of ' + st.injTapWant + ')',
     Math.abs(st.injTap - st.injTapWant) < 1e-6);
  ok('only mishapStep moves them — villagerStep cannot', st.injStuck === true);
  ok('the bar closing puts them back to work', st.injFreed === true);
  ok('a better building recovers faster (' + st.rateLadder.join(' -> ') + ')',
     st.rateLadder[0] < st.rateLadder[1] && st.rateLadder[1] < st.rateLadder[2]);
  ok('a burning building loses its EFFECT (walk ' + st.walkBefore + ' -> ' + st.walkBurning + ')',
     st.walkBurning < st.walkBefore && st.blazeDmg === true);
  ok('...and gets it back when the fire is out', st.blazeOut === true);
  ok('a thief tap without the law does not catch him', st.noLaw.still === true);
  ok('...it explains why, in a villager\'s own words ("' + (st.noLaw.bubble || '') + '")',
     /constable|station/i.test(st.noLaw.bubble || ''));
  ok('...and it is not a stoke', st.noLaw.stoked === 0);
  ok('a thief tap WITH the law makes the catch (' + st.withLaw.state + ')',
     st.withLaw.state === 'caught' && st.withLaw.caught >= 1);
  ok('...and every stolen unit comes back (' + st.withLaw.recovered + ' of 90)',
     st.withLaw.recovered === 90);
  ok('a grab is capped, not a share of the hoard (' + st.capped.took + ' of a possible ' +
     st.capped.share + ')', st.capped.took === st.capped.cap && st.capped.took < st.capped.share);
  ok('an escaped thief costs the stockpile (' + st.escaped.stolen + ')',
     st.escaped.gone === true && st.escaped.stolen === 777);
  ok('...but never the evolution reach (' + st.escaped.gathered + ')', st.escaped.gathered === 5000);
  ok('an evolution clears every incident', st.evolved === true);
  ok('a role flip releases an injury (flipped ' + st.flip.flipped + ', open ' + st.flip.open + ')',
     st.flip.flipped === true && st.flip.stillHurt === false && st.flip.open === 0);
  ok('a cold camp gets no new incidents', st.coldQuiet === true);

  /* BELLOWS is hidden until the fire has ROARED once — it multiplies a bonus a
     player who has never crossed 75% has never seen, which made it the one
     card that could be bought for nothing. */
  st = await page.evaluate(() => {
    const bellowsShown = () => { buildUpgPanel(); return !!upgList.querySelector('[data-uid="bellows"]'); };
    const wasRoared = S.roared, wasLvl = S.up.bellows;
    S.roared = false; S.up.bellows = 0;
    const hidden = !bellowsShown();
    S.roared = true;
    const shown = bellowsShown();
    S.roared = false; S.up.bellows = 1;
    const kept = bellowsShown();            // an older save that already owns it
    S.roared = wasRoared; S.up.bellows = wasLvl; buildUpgPanel();
    return { hidden, shown, kept };
  });
  ok('BELLOWS is hidden until the fire has roared', st.hidden);
  ok('BELLOWS appears once the fire has roared', st.shown);
  ok('BELLOWS stays visible for a save that already owns it', st.kept);
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

  /* ---- ROARING FIRE: the reward for tending the fire yourself (2026-08-28) ---- */
  // Two properties. The bonus is a threshold on the BANK FRACTION, not on the
  // raw bank, so it survives a FIRE PIT moving the denominator. And above the
  // line it RAMPS — half at ROAR_AT, all of it at a brimming bank — which is
  // what gives FIRE PIT a throughput price instead of only a comfort one.
  st = await page.evaluate(() => {
    S.up.bellows = 0; S.up.pit = 0;
    const out = {};
    S.bank = maxBank() * 0.5;      FIRE.burning = true; out.half   = heatBoost();
    S.bank = maxBank() * ROAR_AT;                       out.atLine = heatBoost();
    S.bank = maxBank() * 0.875;                         out.mid    = heatBoost();
    S.bank = maxBank();                                 out.full   = heatBoost();
    S.up.bellows = 6; S.bank = maxBank() * ROAR_AT;     out.maxedAtLine = heatBoost();
    S.bank = maxBank();                                 out.maxed  = heatBoost();
    // one second of drain after a tap: a deeper pit is a shallower dip
    S.up.bellows = 0; S.bank = maxBank() - 1;           out.shallow = heatBoost();
    S.up.pit = 8; out.bigBank = maxBank();
    S.bank = maxBank() - 1;                             out.deep   = heatBoost();
    S.bank = maxBank() * 0.60;                          out.coldBig = heatBoost();
    FIRE.burning = false;                               out.dead   = heatBoost();
    S.up.bellows = 0; S.up.pit = 0; S.bank = 0; FIRE.burning = false;
    return out;
  });
  ok('no heat bonus below the 75% line (' + st.half + ')', st.half === 1);
  ok('half the bonus AT the 75% line (' + st.atLine.toFixed(3) + ')',
    Math.abs(st.atLine - 1.05) < 1e-9);
  ok('the bonus RAMPS across the top quarter (' +
    [st.atLine, st.mid, st.full].map(v => v.toFixed(3)).join(' < ') + ')',
    st.atLine < st.mid && st.mid < st.full);
  ok('full bonus only at a brimming bank (' + st.full.toFixed(2) + ')',
    Math.abs(st.full - 1.1) < 1e-9);
  ok('BELLOWS raises both ends of the ramp (' + st.maxedAtLine.toFixed(2) + ' / ' +
    st.maxed.toFixed(2) + ')',
    Math.abs(st.maxedAtLine - 1.35) < 1e-9 && Math.abs(st.maxed - 1.7) < 1e-9);
  ok('a DEEPER pit pays more one second after a tap (' + st.shallow.toFixed(3) +
    ' -> ' + st.deep.toFixed(3) + ')', st.bigBank === 45 && st.deep > st.shallow);
  ok('the threshold is a FRACTION of a bigger bank (' + st.bigBank + 's)',
    st.coldBig === 1);
  ok('a dead fire never roars', st.dead === 1);

  // The boost is what makes the work faster, so it must reach the work clock —
  // v.w, not v.t, or a roaring fire would look hot and change nothing.
  st = await page.evaluate(() => {
    const v = villagers.find(x => !x.keeper);
    v.state = 'working'; v.t = 0; v.w = 0; v.job = JOBS[0];
    S.up.bellows = 6; S.up.pit = 0; S.bank = maxBank(); FIRE.burning = true;
    for (let i = 0; i < 30; i++) villagerStep(v, 1 / 30);
    const out = { t: v.t, w: v.w };
    S.up.bellows = 0; S.bank = 0; FIRE.burning = false;
    return out;
  });
  ok('a roaring fire speeds the work clock (' + st.w.toFixed(2) + 's of work in ' + st.t.toFixed(2) + 's)',
    st.w > st.t * 1.6);

  /* ---- FIREKEEPER is a one-off: a second one feeds the same bank ---- */
  ok('FIREKEEPER caps at one', await page.evaluate(() =>
    UPG.find(u => u.id === 'keeper').max) === 1);

  /* ---- MICROMANAGEMENT: tapping a work site directs the whole camp ---- */
  st = await page.evaluate(() => {
    S.up.micro = 0; S.focus = null;
    const trees = JOBS[0].site();
    return { locked: siteAt(trees.x, trees.y) };   // no upgrade, no control
  });
  ok('work sites are inert until MICROMANAGEMENT is bought', st.locked === null);

  st = await page.evaluate(() => {
    S.up.micro = 1; S.focus = null;
    const rocks = JOBS[1].site(), r = cv.getBoundingClientRect();
    const fire0 = S.bank;
    const send = (p) => cv.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: r.left + p.x, clientY: r.top + p.y, bubbles: true, pointerId: 1 }));
    send(rocks); const first = S.focus;
    send(rocks); const second = S.focus;                 // same site again releases them
    send(JOBS[2].site()); const third = S.focus;
    return { first, second, third, stoked: S.bank - fire0 };
  });
  ok('tapping a site directs the camp (' + st.first + ')', st.first === 'stone');
  ok('tapping it again releases them (' + st.second + ')', st.second === null);
  ok('tapping another site switches focus (' + st.third + ')', st.third === 'food');
  ok('a site tap is not a stoke', st.stoked === 0);

  // and the direction has to actually reach the job picker
  st = await page.evaluate(() => {
    S.up.micro = 1; S.focus = 'stone';
    S.res.wood = 0; S.res.stone = 999; S.res.food = 0;   // stone is the LAST thing they would choose
    FIRE.burning = true; S.bank = 5;
    const picks = {};
    for (const v of villagers.filter(x => !x.keeper).slice(0, 6)) {
      v.state = 'idle'; v.wait = 0; v.job = null; v.seat = -1;
      villagerStep(v, 1 / 30);
      if (v.job) picks[v.job.res] = (picks[v.job.res] || 0) + 1;
    }
    S.focus = null; S.up.micro = 0; S.bank = 0; FIRE.burning = false;
    return picks;
  });
  ok('directed villagers ignore scarcity and go where told (' + JSON.stringify(st) + ')',
    st.stone > 0 && !st.wood && !st.food);

  // rotation self-heal: iOS can hand resize() a stale box — corrupt the
  // layout globals and the per-frame guard must relayout within a few frames
  await page.evaluate(() => { W = 111; H = 222; G.fire = { x: 55, y: 111 }; });
  await page.waitForTimeout(500);
  st = await page.evaluate(() => {
    const r = cv.getBoundingClientRect();
    return { W, H, fx: G.fire.x, bw: r.width, bh: r.height };
  });
  ok('stale layout self-heals (' + st.W + 'x' + st.H + ')',
    st.W === st.bw && st.H === st.bh && st.fx === st.bw * 0.5);

  // THE landscape bug: on iOS the canvas box can be shorter than
  // window.innerHeight, so a scene laid out from innerHeight is squashed
  // upward on screen while the hit tests stay put — the fire then only
  // answers taps at the bottom of the drawn circle and below. Layout must
  // come from the canvas's OWN box, which is the space taps resolve in.
  await page.addStyleTag({ content: '#scene{height:calc(100% - 60px)!important}' });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(600);
  st = await page.evaluate(() => {
    const r = cv.getBoundingClientRect();
    return { W, H, bw: r.width, bh: r.height, fx: G.fire.x, fy: G.fire.y, hitR: G.hitR };
  });
  ok('layout follows the canvas box, not innerHeight (' + st.H.toFixed(0) + ' vs box ' + st.bh.toFixed(0) + ')',
    Math.abs(st.H - st.bh) <= 1 && Math.abs(st.W - st.bw) <= 1);
  // tap where the fire is DRAWN (backing store stretched into the box), at the
  // top / centre / bottom of the visible circle — all three must stoke
  const sy = st.bh / st.H, sx = st.bw / st.W;
  const drawnX = st.fx * sx, drawnY = st.fy * sy, rad = (st.hitR / 1.4) * sy * 0.8;
  const hits = [];
  for (const y of [drawnY - rad, drawnY, drawnY + rad]) {
    await page.evaluate(() => { S.bank = 0; });
    await page.touchscreen.tap(drawnX, y);
    await page.waitForTimeout(120);
    hits.push(await page.evaluate(() => S.bank > 0));
  }
  ok('drawn fire circle is tappable top-to-bottom (' + hits.join(',') + ')', hits.every(Boolean));

  console.log(checks.join('\n'));
  console.log('ERRORS=' + errors.length);
  errors.forEach(e => console.log('  ' + e));
  const failed = checks.filter(c => c.startsWith('FAIL')).length + errors.length;
  const passed = checks.length - (failed - errors.length);
  console.log('FIRE-CLICKER DRIVE: ' + passed + ' passed, ' + failed + ' failed');
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
