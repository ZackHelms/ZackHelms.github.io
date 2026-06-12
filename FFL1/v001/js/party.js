// party.js — Party state management and save/load
import { isAlive } from './characters.js';

const SAVE_KEY = 'ffl1_save';

export function createParty(members) {
  return {
    members,            // array of 4 character objects
    gold: 200,
    crystalBalls: 0,
    currentWorld: 1,
    mapId: 'world1',
    playerX: 15,
    playerY: 10,
    visitedMaps: new Set(['world1']),
    chestOpened: new Set(),
    flags: {}           // story/progress flags
  };
}

export function partyAlive(party) {
  return party.members.some(isAlive);
}

export function partyGold(party) { return party.gold; }

export function spendGold(party, amount) {
  if (party.gold < amount) return false;
  party.gold -= amount;
  return true;
}

export function earnGold(party, amount) { party.gold += amount; }

export function addItem(char, abilityId) {
  const maxSlots = { human: 8, mutant: 4, monster: 0 }[char.class] || 0;
  if (char.equipment.length >= maxSlots) return false;
  char.equipment.push(abilityId);
  return true;
}

export function removeItem(char, slot) {
  if (slot < 0 || slot >= char.equipment.length) return null;
  return char.equipment.splice(slot, 1)[0];
}

export function addMeat(char, meat) {
  if (char.class !== 'monster') return false;
  if (char.meatSlots.length >= 4) return false;
  char.meatSlots.push(meat);
  return true;
}

export function fullHeal(party) {
  for (const c of party.members) {
    c.hp = c.maxHp;
    c.status = [];
    c.alive = true;
  }
}

export function saveGame(party) {
  try {
    const data = {
      ...party,
      visitedMaps: [...party.visitedMaps],
      chestOpened: [...party.chestOpened],
      savedAt: Date.now()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    data.visitedMaps = new Set(data.visitedMaps || []);
    data.chestOpened = new Set(data.chestOpened || []);
    return data;
  } catch { return null; }
}

export function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function getAliveMember(party, preferIdx = 0) {
  if (isAlive(party.members[preferIdx])) return party.members[preferIdx];
  return party.members.find(isAlive) || null;
}

export function getGoldEarned(enemies) {
  // Rough gold formula based on enemy HP
  return enemies.reduce((sum, e) => {
    return sum + Math.floor((e.hp || 10) / 5) + Math.floor(Math.random() * 10);
  }, 0);
}
