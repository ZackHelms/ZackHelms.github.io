// TAAS robot factory, the busiest scene: both robots hired and at work, the avatar walking,
// machine 01 running, a bin and the recycle bin with things in them. For frame-budget.cjs evalFile= (after
// select=#mode-btn:robot-factory).
(function () {
  const F = FACTORY, s = F.newGame(7), run = n => { for (let k = 0; k < n; k++) F.step(s, 0.05); };
  s.money = 60;
  F.tap(s, { kind: 'dock' }); run(200);
  F.choose(s, 'hire'); F.choose(s, 'job:operate');
  F.tap(s, { kind: 'dock' }); run(20);
  F.choose(s, 'hire'); F.choose(s, 'job:sell');
  s.bin.push('plank', 'rough', 'dowels', 'plank', 'plank', 'plank');
  s.recycled.push('gnarled', 'small', 'rough', 'dowels'); s.recycledN = 4;   // the recycle bin with things poking out
  s.force.log = ['gnarled'];                                                 // a gnarled log rolls in next
  run(120);
  F.tap(s, { kind: 'floor', x: 1.0, y: 12 });
  window.TAAS_FACTORY.s = s;
})();
