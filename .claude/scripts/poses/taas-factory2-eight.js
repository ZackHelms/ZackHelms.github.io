// TAAS Robot factory v2 with everything bought (2026-10-26): every goal met, four stalls set to sell
// four things, eight robots on the floor told what to carry (two hauling logs from the raw materials
// bin to the planer's hopper, carrying four, one to the extractor's hopper, one stocking each of two
// stalls, one taking planks to the saw, one gnarled planks to the bench, one emptying the recycle bin
// to the raw materials bin), a full shop, the truck parked. For frame-budget.cjs evalFile= on
// games/taas/factory-v2.html. It opens half way down the floor, robots and machines on screen.
(function () {
  const F = FACTORY2, s = F.newGame(7), run = n => { for (let k = 0; k < n; k++) F.step(s, 0.05); };
  s.goal = F.CFG.goals.length; s.money = 2000;
  const wants = ['plank.m', 'plank.l', 'b2x4.m', 'sap'];
  for (let i = 1; i < 4; i++) { s.stalls[i].bought = true; s.stalls[i].want = wants[i]; }
  for (let i = 0; i < 8; i++) F.buyRobot(s);
  run(600);
  const jobs = [['raw', 'planerIn', [['recycle', 'any', 'slogs', 'none'], ['carry', '4', 'things', 'atime']]], ['raw', 'planerIn', [['carry', '4', 'things', 'atime']]],
    ['raw', 'extractIn', [['only', 'any', 'slogs', 'none']]], ['bin', 'stall0', [['recycle', 'any', 'gplanks', 'none']]], ['bin', 'stall1', [['only', 'large', 'planks', 'none']]],
    ['bin', 'saw', [['only', 'medium', 'planks', 'none']]], ['bin', 'bench', [['only', 'any', 'gplanks', 'none']]], ['extractOut', 'stall3', [['only', 'any', 'sap', 'none']]]];
  jobs.forEach(([src, dst, lines], i) => { F.setPrompt(s, i, src, dst); lines.forEach((l, k) => F.setLine(s, i, k, l)); });
  s.force.arrive = Array(80).fill(8);
  s.raw.push('log.m', 'log.l', 'gnarled.m', 'sappy.m', 'log.m', 'log.s', 'sappy.l', 'log.m');
  run(400);
  const SH = F.LAYOUT.SHOP;
  s.shop.people.length = 0;
  [0, 1, 2, 3].forEach(k => s.shop.people.push({ id: 80 + k, x: SH.places[k], y: SH.lineY, state: 'wait', t: 3, stall: k, at: 'stall', item: null, by: null, wrong: false }));
  s.avatar.inv.push('plank.m', 'plank.s', 'log.l', 'sap');
  F.tap(s, { kind: 'floor', x: 5.4, y: 9 });
  s.events.length = 0;
  const T = window.TAAS_FACTORY2;
  T.s = s; T.view.camY = T.view.minY + (T.view.maxY - T.view.minY) * 0.45;
})();
