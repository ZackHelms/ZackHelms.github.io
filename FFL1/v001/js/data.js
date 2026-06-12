// data.js — loads and caches all game data from data/*.json
export const GameData = {
  monsters: null, abilities: null, items: null,
  transformation: null, world: null, shops: null,
  encounters: null, dialogue: null, maps: null,
  loaded: false
};

export async function loadAllData() {
  const BASE = 'data/';
  const files = ['monsters','abilities','items','transformation','world','shops','encounters','dialogue'];
  const results = await Promise.all(files.map(f => fetch(BASE + f + '.json').then(r => r.json())));
  files.forEach((f, i) => GameData[f] = results[i]);
  GameData.maps = await fetch(BASE + 'maps/maps.json').then(r => r.json());
  GameData.loaded = true;
  return GameData;
}

export function getMonster(id) { return GameData.monsters[id]; }
export function getAbility(id) { return GameData.abilities[id]; }
export function getEncounterTable(tableId) {
  return GameData.encounters.encounter_tables.find(t => t.area === tableId);
}
export function getShop(shopId) {
  return GameData.shops.shops.find(s => s.id === shopId);
}
export function getMap(mapId) { return GameData.maps[mapId]; }
export function getDialogue(id) {
  const parts = id.split('_');
  let obj = GameData.dialogue;
  for (const p of parts) { obj = obj?.[p]; if (!obj) break; }
  return Array.isArray(obj) ? obj : [String(obj || '')];
}

export function rollEncounter(tableId) {
  const table = getEncounterTable(tableId);
  if (!table) return null;
  const total = table.monsters.reduce((s, m) => s + m.weight, 0);
  let r = Math.random() * total;
  for (const m of table.monsters) {
    r -= m.weight;
    if (r <= 0) return { ...getMonster(m.monster_id), count: 1 };
  }
  return { ...getMonster(table.monsters[0].monster_id), count: 1 };
}

export function buildEnemyGroup(tableId) {
  const table = getEncounterTable(tableId);
  if (!table) return [];
  const sz = table.group_size;
  const count = sz.min + Math.floor(Math.random() * (sz.max - sz.min + 1));
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const m = rollEncounter(tableId);
    if (m) enemies.push({ ...m, currentHp: m.hp, status: [] });
  }
  return enemies;
}
