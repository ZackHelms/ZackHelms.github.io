// TAAS robot factory with everything bought (taasstalls, 2026-10-17): four stalls set to sell four
// things, eight robots at work (the planer's, one at each stall told to stock only its thing, the
// saw's, the extractor's, the bench's), a full shop (one at each stall, two in the back line), every
// slot's bins full and the avatar walking with its arms full. For frame-budget.cjs evalFile= (after
// select=#mode-btn:robot-factory). It opens at the top of the floor, so the counter is on screen.
(function () {
  const F = FACTORY, s = F.newGame(7), run = n => { for (let k = 0; k < n; k++) F.step(s, 0.05); };
  s.money = 2000;
  const wants = ['plank.m', 'plank.l', 'b2x4.m', 'sap'];
  for (let i = 1; i < 4; i++) { F.tap(s, { kind: 'stall', i }); run(300); F.choose(s, 'buystall'); F.choose(s, 'sell:' + wants[i]); s.bubble = null; }
  ['operate', 'stock:0', 'stock:1', 'stock:2', 'stock:3', 'saw', 'extract', 'carve'].forEach(j => { F.tap(s, { kind: 'dock' }); run(400); F.choose(s, 'hire'); F.choose(s, 'job:' + j); s.bubble = null; });
  s.money = 500;
  wants.forEach((w, i) => { const r = s.robots[i + 1], id = F.ONLY[w]; s.seen[id] = true; F.buySlot(s, r.id); F.setRule(s, r.id, 0, id); });
  s.force.slip = Array(400).fill(false); s.force.arrive = Array(80).fill(8);
  s.bin.push('plank.m', 'plank.l', 'rough.m', 'plank.s', 'plank.l', 'plank.m');
  s.saw.in.push('plank.m', 'plank.m', 'plank.m', 'plank.l'); s.extract.in.push('sappy.m', 'sappy.l', 'sappy.s');
  s.bench.in.push('gnarled.l', 'gnarled.m', 'gnarled.s');
  run(400);
  const SH = F.LAYOUT.SHOP;
  s.shop.people.length = 0;
  [0, 1, 2, 3].forEach(k => s.shop.people.push({ id: 80 + k, x: SH.places[k], y: SH.lineY, state: 'wait', t: 3, stall: k, at: 'stall', item: null, by: null, wrong: false }));
  [0, 1].forEach(k => s.shop.people.push({ id: 90 + k, x: SH.x0 - k * 0.62, y: SH.backY, state: 'wait', t: 3, stall: k, at: 'line', item: null, by: null, wrong: false }));
  s.stalls.forEach(st => { st.stock.length = 0; });
  s.avatar.inv.push('plank.m', 'plank.s', 'log.l', 'sap');
  F.tap(s, { kind: 'floor', x: 5.4, y: 9 });
  s.events.length = 0;
  window.TAAS_FACTORY.s = s;
})();
