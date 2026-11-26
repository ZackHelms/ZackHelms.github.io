// data.js — every number and every written thing the simulation reads.
// Tuned by headless runs (tools/run.mjs); see .claude/colony-sim.md § Measured.

export const TUNE = {
  // per game hour
  energyWork: 3.6, energyLight: 2.6, energyIdle: 1.7,
  hungerAwake: 3.6, hungerSleep: 1.4,
  bladderAwake: 6.2, bladderSleep: 1.6,
  bowelAwake: 3.3, bowelSleep: 1.2,
  cleanAwake: 0.32, cleanDirty: 0.62, cleanSleep: 0.15,
  moodRate: 3,
  healIdle: 0.8, healSleep: 1.6, healWork: 0.25,
  // sleep: energy per hour and the cap each place allows
  sleep: { bed: [12, 100], leanto: [10, 90], hut: [10, 92], ground: [8, 72], wild: [6, 50] },
  meal: 36, berry: 5, rawFish: 10,
  peeAt: 40, pooAt: 34,
  wakeHour: 6, latestWake: 9,
  injuryPerHour: 0.012,
  toolWear: 1.4, toolFloor: 50, toolFix: 60,
  spoil: { berries: 3, meat: 1.2, fish: 1, meal: 2, dried: 10 },     // days, outside the food store
  spoilStored: { berries: 5, meat: 2, fish: 1.6, meal: 5, dried: 14 },
  mealsPerDay: 2,
  foodGoalDays: 3,
  startMeals: 6,
  bushRegrowDays: 3,
  trapCatchPerDay: 0.45,
  fishPerHour: 1.8,
  carry: { wood: 2, stone: 3 },
};

// The founders (CD: a leader, a gatherer, a hunter and an architect, chosen by the
// expedition's backers for a well-rounded set of skills). Immortal, with perseverance.
export const FOUNDERS = [
  {
    id: 0, name: 'Ada', role: 'leader', title: 'Leader',
    attrs: { STR: 10, DEX: 11, CON: 12, INT: 15, WIS: 16, CHA: 16 },
    strengths: ['Sees the critical path', 'Keeps people talking', 'Good cook'],
    weaknesses: ['Takes on too much herself', 'Weak swimmer'],
    prefs: ['Coffee at dawn', 'Everyone eating together', 'A tidy camp'],
    goals: ['Bring all four through the first season', 'Have the camp ready for newcomers'],
    fears: ['Losing someone on her watch', 'Deep water'],
    look: { skin: '#c99a76', hair: '#3b2a1f', hairStyle: 'bun', beard: false, shirt: '#2f6f8f', pants: '#4a4237', boots: '#3a2a1c', hat: null, height: 1.0, width: 0.97 },
  },
  {
    id: 1, name: 'Bram', role: 'gatherer', title: 'Gatherer',
    attrs: { STR: 16, DEX: 12, CON: 16, INT: 11, WIS: 12, CHA: 10 },
    strengths: ['Strong and tireless', 'Fells a tree fast', 'Carries more'],
    weaknesses: ['Pushes on when he should stop', 'Impatient with planning'],
    prefs: ['Working outdoors', 'A big dinner', 'Sleeping by the fire'],
    goals: ['A woodpile that never runs low', 'A proper axe of his own one day'],
    fears: ['Being idle', 'Heights'],
    look: { skin: '#7a4e2d', hair: '#151010', hairStyle: 'short', beard: true, shirt: '#a0452d', pants: '#3d4a5c', boots: '#2b211a', hat: null, height: 1.06, width: 1.12 },
  },
  {
    id: 2, name: 'Kit', role: 'hunter', title: 'Hunter',
    attrs: { STR: 12, DEX: 16, CON: 13, INT: 12, WIS: 15, CHA: 11 },
    strengths: ['Reads tracks and weather', 'Patient with traps', 'Knows edible plants'],
    weaknesses: ['Roams too far', 'Forgets to eat while out'],
    prefs: ['Dawn and dusk', 'Quiet', 'Fish over meat'],
    goals: ['Three days of food in store', 'Find fresh water inland'],
    fears: ['Being lost after dark', 'Snakes'],
    look: { skin: '#e0b48e', hair: '#a8642a', hairStyle: 'pony', beard: false, shirt: '#4f6b34', pants: '#5b4a33', boots: '#3d2e20', hat: '#6b5a3a', height: 0.96, width: 0.95 },
  },
  {
    id: 3, name: 'Ines', role: 'architect', title: 'Architect',
    attrs: { STR: 12, DEX: 15, CON: 12, INT: 16, WIS: 13, CHA: 12 },
    strengths: ['Designs and builds', 'Measures twice', 'Steady hands'],
    weaknesses: ['Perfectionist: slow to call a job done', 'Hates being dirty'],
    prefs: ['Straight lines', 'A clean shirt', 'Quiet evenings'],
    goals: ['A hut for everyone before the rains', 'A real workshop'],
    fears: ['Fire getting loose', 'The dark'],
    look: { skin: '#a8754f', hair: '#1c1612', hairStyle: 'long', beard: false, shirt: '#d8c9a3', pants: '#2c3e50', boots: '#4a3322', hat: null, height: 1.0, width: 0.96 },
  },
];

// Tools (CD): one indestructible set whose effectiveness wears from 100% to 50%.
export const TOOLS = ['axe', 'pick', 'hammer', 'knife', 'spear'];

// Buildings; f = metres toward the island's interior from the campfire, r = metres to its right.
export const BUILDINGS = {
  campfire: { label: 'Campfire', cost: { wood: 4, stone: 9 }, hours: 1.5, f: 0, r: 0, size: [1.8, 1.8, 0.5] },
  leanto: { label: 'Lean-to', cost: { wood: 12, stone: 0 }, hours: 5.0, f: 7, r: -9, size: [5, 3, 2.2], sleeps: 4, sleep: 'leanto' },
  storage: { label: 'Storage', cost: { wood: 9, stone: 3 }, hours: 3.0, f: 6, r: 10, size: [4, 4, 1.2] },
  foodstore: { label: 'Food store', cost: { wood: 12, stone: 9 }, hours: 6.5, f: -6, r: 9, size: [3, 3, 2.4] },
  latrine: { label: 'Latrine', cost: { wood: 8, stone: 0 }, hours: 3.0, f: 24, r: 18, size: [1.6, 1.6, 2.2] },
  hut1: { label: 'Hut', cost: { wood: 30, stone: 15 }, hours: 14.5, f: 16, r: -7, size: [5.5, 4.5, 3], sleeps: 3, sleep: 'hut' },
  hut2: { label: 'Second hut', cost: { wood: 30, stone: 15 }, hours: 14.5, f: 16, r: 7, size: [5.5, 4.5, 3], sleeps: 3, sleep: 'hut' },
  bed: { label: 'Bed', cost: { wood: 6, stone: 0 }, hours: 2.5, size: [0.9, 2, 0.5], sleeps: 1, sleep: 'bed' },
  toolbench: { label: 'Tool bench', cost: { wood: 12, stone: 6 }, hours: 5.0, f: -5, r: -9, size: [2.4, 1.2, 1] },
  dryrack: { label: 'Drying rack', cost: { wood: 9, stone: 0 }, hours: 3.0, f: -9, r: 1, size: [2.4, 1, 1.6] },
};

// Colony goals the leader works from (CD: goals board, control A).
export const GOALS = {
  campfire: { label: 'Campfire', builds: ['campfire'], prereq: [] },
  leanto: { label: 'Lean-to shelter', builds: ['leanto'], prereq: ['campfire'] },
  storage: { label: 'Storage area', builds: ['storage'], prereq: ['campfire'] },
  food3: { label: '3 days of food', food: true, prereq: [] },
  foodstore: { label: 'Food store', builds: ['foodstore'], prereq: ['campfire'] },
  latrine: { label: 'Latrine', builds: ['latrine'], prereq: ['campfire'] },
  hut1: { label: 'Hut', builds: ['hut1'], prereq: ['leanto'] },
  hut2: { label: 'Second hut', builds: ['hut2'], prereq: ['leanto'] },
  beds5: { label: '5 beds', builds: ['bed', 'bed', 'bed', 'bed', 'bed'], prereq: ['hut1', 'hut2'] },
  toolbench: { label: 'Tool bench', builds: ['toolbench'], prereq: ['campfire'] },
  dryrack: { label: 'Drying rack', builds: ['dryrack'], prereq: ['campfire'] },
};
export const DEFAULT_GOALS = ['campfire', 'leanto', 'food3', 'storage', 'foodstore', 'latrine', 'hut1', 'toolbench', 'hut2', 'beds5', 'dryrack'];
export const PHASE1_BUILDS = ['campfire', 'leanto', 'storage', 'foodstore', 'latrine', 'hut1', 'hut2', 'toolbench'];

// Lessons (CD: learned by trial and error, at a rate set by INT and WIS). The list of
// what can be learned is written here; the number inside each lesson is learned.
export const LESSONS = {
  overwork: { label: 'Stop before exhaustion', param: 'stopEnergy', start: 10, target: 32, fmt: (v) => 'stops work at ' + v.toFixed(0) + '% energy' },
  lateNight: { label: 'Bed at a sane hour', param: 'bedHour', start: 23.6, target: 21.4, fmt: (v) => 'in bed by ' + hhmm(v) },
  skipMeal: { label: "Don't skip meals", param: 'eatHunger', start: 12, target: 52, fmt: (v) => 'eats below ' + v.toFixed(0) + '% hunger' },
  hygiene: { label: 'Wash regularly', param: 'washAt', start: 42, target: 62, fmt: (v) => 'bathes below ' + v.toFixed(0) + '% clean' },
  farAtDusk: { label: 'Head home before dark', param: 'homeHour', start: 19.8, target: 17.6, fmt: (v) => 'heads home by ' + hhmm(v) },
  dullTools: { label: 'Keep tools sharp', param: 'fixAt', start: 0, target: 70, fmt: (v) => 'sharpens tools below ' + v.toFixed(0) + '%' },
};
export function hhmm(h) { const H = Math.floor(h), M = Math.round((h - H) * 60); return String(H % 24).padStart(2, '0') + ':' + String(M % 60).padStart(2, '0'); }

// What a settler says when they refuse an order a lesson tells them is a mistake.
export const REFUSALS = {
  overwork: "I'm running on empty. Last time I pushed on like this I got hurt. Sleep first.",
  lateNight: "It's late. Every time I stay up, tomorrow is wasted. I'm going to bed.",
  skipMeal: "I need to eat first. I collapsed the last time I worked through hunger.",
  hygiene: "I'm filthy, and it's getting to me. I'm washing first.",
  farAtDusk: "Not this late. I got caught out after dark once already.",
  dullTools: "These tools are dull enough to be dangerous. They get sharpened first.",
};
export const LEARNED = {
  overwork: 'Lesson learned: stop before I drop.',
  lateNight: 'Lesson learned: no more late nights.',
  skipMeal: 'Lesson learned: eat before I fade.',
  hygiene: 'Lesson learned: a wash keeps me sane.',
  farAtDusk: 'Lesson learned: start home before dusk.',
  dullTools: 'Lesson learned: sharp tools, safe hands.',
};
