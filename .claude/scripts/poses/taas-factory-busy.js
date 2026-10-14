// TAAS robot factory, the busiest scene: both robots hired and at work (the seller told to sell
// only planks and hunting a bin full of other things), the avatar walking, machine 01 running,
// the recycle bin with things in it and a sap log rolling in next. For frame-budget.cjs
// evalFile= (after select=#mode-btn:robot-factory).
(function () {
  const F = FACTORY, s = F.newGame(7), run = n => { for (let k = 0; k < n; k++) F.step(s, 0.05); };
  s.money = 60;
  F.tap(s, { kind: 'dock' }); run(200);
  F.choose(s, 'hire'); F.choose(s, 'job:operate');
  F.tap(s, { kind: 'dock' }); run(20);
  F.choose(s, 'hire'); F.choose(s, 'job:sell');
  s.money = 100; s.seen.sellOnly = true; F.buySlot(s, 1); F.setRule(s, 1, 0, 'sellOnly');
  s.bin.push('plank', 'rough', 'dowels', 'largePlank', 'dowels', 'rough', 'largePlank', 'rough', 'plank');
  s.recycled.push('gnarled', 'small', 'sappy', 'dowels'); s.recycledN = 4;   // the recycle bin with things poking out
  s.force.log = ['sappy']; s.force.slip = [false];                            // a sap log rolls in next
  run(120);
  F.tap(s, { kind: 'floor', x: 1.0, y: 12 });
  window.TAAS_FACTORY.s = s;
})();
