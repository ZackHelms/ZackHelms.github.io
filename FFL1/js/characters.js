// characters.js — Human, Mutant, Monster class logic
import { GameData, getMonster } from './data.js';

const MAX_EQUIPMENT = { human: 8, mutant: 4, monster: 0 };
const MAX_ABILITIES  = { human: 0, mutant: 4, monster: 0 };
const MAX_MEAT       = { human: 0, mutant: 0, monster: 4 };

// ── STAT CAPS ────────────────────────────────────────────────────────────────
export const DISPLAY_CAP = 99;
export const INTERNAL_CAP = 255;
export const HP_CAP = 999;

export function capStat(v) { return Math.max(0, Math.min(v, INTERNAL_CAP)); }
export function displayStat(v) { return Math.min(v, DISPLAY_CAP); }
export function displayHp(v)   { return Math.min(v, HP_CAP); }

// ── HUMAN ─────────────────────────────────────────────────────────────────────
export function createHuman(name, gender = 'm') {
  return {
    name, class: 'human', gender,
    hp: 150, maxHp: 150,
    str: 12, def: 8, agi: 10, mana: 4,
    equipment: [],
    statItems: { str: 0, def: 0, agi: 0, mana: 0, hp: 0 },
    gold: 0,
    alive: true, status: []
  };
}

export function humanEquip(char, abilityId) {
  if (char.equipment.length < MAX_EQUIPMENT.human) {
    char.equipment.push(abilityId);
    return true;
  }
  return false;
}

export function humanUnequip(char, slot) {
  char.equipment.splice(slot, 1);
}

export function humanApplyStatItem(char, statName, amount = 1) {
  if (statName === 'hp') {
    char.maxHp = Math.min(HP_CAP, char.maxHp + amount * 50);
    char.hp = Math.min(char.maxHp, char.hp + amount * 50);
  } else {
    char[statName] = capStat(char[statName] + amount);
  }
  char.statItems[statName] = (char.statItems[statName] || 0) + amount;
}

// ── MUTANT ────────────────────────────────────────────────────────────────────
export function createMutant(name, gender = 'm') {
  return {
    name, class: 'mutant', gender,
    hp: 80, maxHp: 80,
    str: 6, def: 5, agi: 8, mana: 15,
    equipment: [],
    abilities: [],   // ability IDs (max 4)
    gold: 0,
    alive: true, status: []
  };
}

export function mutantPostBattle(char, battleActions) {
  // battleActions: { usedStr, usedAgi, usedMana, killedEnemy }
  const gains = {};
  if (battleActions.killedEnemy && Math.random() < 0.4) {
    const hpGain = 3 + Math.floor(Math.random() * 8);
    char.maxHp = Math.min(HP_CAP, char.maxHp + hpGain);
    char.hp = Math.min(char.maxHp, char.hp + hpGain);
    gains.hp = hpGain;
  }
  if (battleActions.usedStr && Math.random() < 0.2) {
    char.str = capStat(char.str + 1);
    gains.str = 1;
  }
  if (battleActions.usedAgi && Math.random() < 0.25) {
    char.agi = capStat(char.agi + 1);
    gains.agi = 1;
  }
  if (battleActions.usedMana && Math.random() < 0.45) {
    char.mana = capStat(char.mana + (Math.random() < 0.3 ? 2 : 1));
    gains.mana = char.mana;
  }
  if (Math.random() < 0.15) {
    char.def = capStat(char.def + 1);
    gains.def = 1;
  }
  return gains;
}

export function mutantLearnAbility(char, abilityId) {
  if (!char.abilities.includes(abilityId)) {
    if (char.abilities.length >= MAX_ABILITIES.mutant) {
      // Random slot deletion — no warning
      const slot = Math.floor(Math.random() * char.abilities.length);
      char.abilities.splice(slot, 1);
    }
    char.abilities.push(abilityId);
    return true;
  }
  return false;
}

// ── MONSTER ───────────────────────────────────────────────────────────────────
export function createMonster(name, monsterId = 78) {
  const base = getMonster(monsterId) || {};
  return {
    name, class: 'monster',
    hp: base.hp || 60, maxHp: base.hp || 60,
    str: base.str || 10, def: base.def || 8,
    agi: base.agi || 8, mana: base.mana || 5,
    meatSlots: [],   // { monster_id, level }
    monsterFamily: base.family || 'goblinoid',
    monsterId,
    monsterName: base.name || name,
    gold: 0,
    alive: true, status: []
  };
}

export function monsterEatMeat(char, meat) {
  // meat: { monster_id, level, family }
  char.meatSlots.push(meat);

  // Check for transformation: 4 of same family
  const familyCounts = {};
  for (const m of char.meatSlots) {
    familyCounts[m.family] = (familyCounts[m.family] || 0) + 1;
  }
  for (const [family, cnt] of Object.entries(familyCounts)) {
    if (cnt >= 4) {
      return attemptTransform(char, family);
    }
  }
  return { transformed: false };
}

function attemptTransform(char, targetFamily) {
  // Find the highest-level monster matching the family
  const matching = char.meatSlots.filter(m => m.family === targetFamily);
  const maxLevel = Math.max(...matching.map(m => m.level || 1));

  // Find a monster of the target family at the right tier
  const candidates = GameData.monsters.filter(m =>
    m.family === targetFamily && m.can_drop_meat
  );
  if (!candidates.length) return { transformed: false };

  // Pick based on level: level 1-3 → tier 1, 4-7 → tier 2, 8-11 → tier 3, etc.
  const tierIdx = Math.min(Math.floor((maxLevel - 1) / 3.5), candidates.length - 1);
  const newForm = candidates[tierIdx] || candidates[candidates.length - 1];

  const oldName = char.monsterName;
  char.monsterId = newForm.id;
  char.monsterName = newForm.name;
  char.monsterFamily = newForm.family;
  char.hp = newForm.hp;
  char.maxHp = newForm.hp;
  char.str = newForm.str;
  char.def = newForm.def;
  char.agi = newForm.agi;
  char.mana = newForm.mana;
  char.meatSlots = [];

  return { transformed: true, oldName, newName: newForm.name, newForm };
}

export function monsterDropMeat(monsterId, level) {
  const m = getMonster(monsterId);
  if (!m || !m.can_drop_meat) return null;
  if (Math.random() > 0.3) return null; // ~30% drop rate
  return { monster_id: monsterId, family: m.family, level: level || m.meat_level || 1, name: m.name };
}

// ── SHARED ────────────────────────────────────────────────────────────────────
export function getEffectiveStat(char, stat, equipment = []) {
  let base = char[stat] || 0;
  // Add bonus from equipped armor (for humans/mutants)
  for (const abilId of (char.equipment || [])) {
    const ab = GameData.abilities[abilId];
    if (ab && ab.stat_bonus) base += (ab.stat_bonus[stat] || 0);
  }
  return capStat(base);
}

export function getTotalDef(char) {
  let def = char.def || 0;
  for (const abilId of (char.equipment || [])) {
    const ab = GameData.abilities[abilId];
    if (ab && ab.stat_bonus && ab.stat_bonus.def) def += ab.stat_bonus.def;
  }
  return capStat(def);
}

export function isAlive(char) { return char.alive && char.hp > 0; }

export function applyDamage(char, dmg) {
  char.hp = Math.max(0, char.hp - Math.floor(dmg));
  if (char.hp === 0) char.alive = false;
  return char.hp;
}

export function healChar(char, amount) {
  char.hp = Math.min(char.maxHp, char.hp + Math.floor(amount));
  char.alive = char.hp > 0;
}

export function applyStatus(char, status) {
  if (!char.status.includes(status)) char.status.push(status);
}

export function clearStatus(char, status) {
  char.status = char.status.filter(s => s !== status);
}

export function hasStatus(char, status) {
  return char.status.includes(status);
}
