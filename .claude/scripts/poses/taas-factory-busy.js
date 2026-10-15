// TAAS robot factory, the busiest scene: both robots hired and at work (the stocker told to
// stock only medium planks and hunting an output bin full of other things), the planer running,
// a full shop of customers waiting at the counter (hourglasses), one leaving with a plank, every
// slot's bins full, the table saw cutting and the sap extractor running, the avatar walking with
// its arms full, the recycle bin with things in it and a sap log rolling in next. For
// frame-budget.cjs evalFile= (after select=#mode-btn:robot-factory). It opens at the top of the
// floor, so the wall's boards and the shop are on screen.
(function () {
  const F = FACTORY, s = F.newGame(7), run = n => { for (let k = 0; k < n; k++) F.step(s, 0.05); };
  s.money = 60;
  F.tap(s, { kind: 'dock' }); run(400);
  F.choose(s, 'hire'); F.choose(s, 'job:stock');
  F.tap(s, { kind: 'dock' }); run(20);
  F.choose(s, 'hire'); F.choose(s, 'job:operate');
  s.money = 100; s.seen.stockOnly = true; F.buySlot(s, 0); F.setRule(s, 0, 0, 'stockOnly');
  s.bin.push('plank.m', 'rough.m', 'plank.s', 'plank.l', 'rough.s', 'rough.l', 'plank.l', 'rough.m', 'plank.s');
  s.recycle.push('gnarled.m', 'log.s', 'sappy.l', 'plank.s');   // the recycle bin with things poking out
  s.saw.in.push('plank.l', 'plank.m', 'plank.s'); s.saw.out.push('b2x4.m', 'dowels.l', 'b2x2.s');
  s.extract.in.push('sappy.m', 'sappy.s'); s.extract.out.push('log.l', 'sap', 'sap', 'sap');
  s.bench.in.push('gnarled.l', 'rough.m'); s.bench.out.push('carving.bird', 'carving.bowl', 'carving.owl');
  s.force.log = ['sappy.m']; s.force.slip = [false]; s.force.arrive = Array(40).fill(8);   // a sap log rolls in next; customers keep coming
  run(300);
  s.stalls[0].stock.length = 0; s.shop.people.length = 0;
  for (let k = 0; k < 5; k++) s.shop.people.push({ id: 90 + k, x: F.LAYOUT.SHOP.x0 - k * 0.62, y: F.LAYOUT.SHOP.lineY, state: 'wait', t: 3, stall: 0, item: null, by: null, wrong: false });
  s.shop.people.push({ id: 99, x: 2.2, y: F.LAYOUT.SHOP.walkY, state: 'out', t: 0.5, stall: 0, item: 'plank.m', by: 0, wrong: false });
  s.saw.phase = 'idle'; F.store(s, 'sawIn').length && (s.saw.phase = 'run', s.saw.item = s.saw.in.shift(), s.saw.cut = 'b2x2', s.saw.t = 0.3);
  s.extract.phase = 'run'; s.extract.item = s.extract.in.shift(); s.extract.t = 0.5;
  s.avatar.inv.push('plank.m', 'plank.s', 'log.l', 'sap');
  F.tap(s, { kind: 'floor', x: 5.4, y: 9 });
  window.TAAS_FACTORY.s = s;
})();
