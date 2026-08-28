/* star-surge-field.js — the saturated combat scene every star-surge frame-cost
   number in .claude/star-surge.md is measured on: 16 enemies of all four
   types, a mini-boss, and 60 live bullets, at sector 5 (so the hue and the
   difficulty scaling are a real mid-campaign stage, not stage 1).

   Invoke:
     node .claude/scripts/frame-budget.cjs games/star-surge/index.html \
       select=#gfx-select:<style> evalFile=.claude/scripts/poses/star-surge-field.js

   It exists because the pose used for the 2026-08-25 and 08-27 measurements
   was only ever described in prose ("a 16-enemy + boss + 60-bullet field"),
   and re-deriving it by hand for the 08-27 scale-up pass produced a scene
   that is close to, but not provably, the one the earlier numbers came from.
   A frame-cost number is only comparable against the scene it was taken on,
   so the scene belongs in the repo next to the tool, not in a sentence. */
saves[0] = newCharacter('PERF'); activeSlot = 0; save = saves[0];
startGame(5);
spawnQueue.length = 0; enemies.length = 0;
const T = ['drone', 'shooter', 'spinner', 'tanker'];
for (let i = 0; i < 16; i++) spawnEnemy(T[i % 4], 40 + (i % 5) * 70, 120 + Math.floor(i / 5) * 90);
spawnBoss();
for (let i = 0; i < 60; i++) {
  bullets.push({ x: 40 + (i % 10) * 32, y: 200 + (i % 17) * 30, vx: 0, vy: -600, dmg: 5, r: 3, kind: 'blaster', life: 9 });
}
