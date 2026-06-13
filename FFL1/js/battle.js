// battle.js — turn-based combat engine
import { GameData, getAbility } from './data.js';
import {
  isAlive, applyDamage, healChar, applyStatus, clearStatus, hasStatus,
  getTotalDef, getEffectiveStat, mutantPostBattle, monsterDropMeat, mutantLearnAbility
} from './characters.js';

// ── DAMAGE FORMULAS ────────────────────────────────────────────────────────────
function rnd(min, max) { return min + Math.random() * (max - min); }

export function calcPhysicalDamage(attacker, defender, weaponPower = 0) {
  const str = getEffectiveStat(attacker, 'str');
  const def = getTotalDef(defender);
  const base = weaponPower + str;
  const raw  = rnd(base * 1.5, base * 2.5) - def;
  return Math.max(1, Math.floor(raw));
}

export function calcMagicDamage(caster, spell) {
  const mana = getEffectiveStat(caster, 'mana');
  const base = (spell.base_power || 50) + mana * 1.5;
  return Math.max(1, Math.floor(rnd(base * 0.8, base * 1.3)));
}

export function calcGunDamage(weapon) {
  return Math.max(1, Math.floor(rnd(weapon.base_power * 0.8, weapon.base_power * 1.2)));
}

export function calcAgiDamage(attacker, weaponPower) {
  const agi = getEffectiveStat(attacker, 'agi');
  return Math.max(1, Math.floor(rnd((agi + weaponPower) * 0.8, (agi + weaponPower) * 1.5)));
}

// ── ACTION RESOLUTION ──────────────────────────────────────────────────────────
// Returns { hit, damage, status, message, actionType }
export function resolveAction(actor, target, action, itemsDb) {
  if (!isAlive(actor)) return { hit: false, message: '' };
  if (hasStatus(actor, 'sleep')) {
    clearStatus(actor, 'sleep');
    return { hit: false, message: `${actor.name} wakes up!` };
  }
  if (hasStatus(actor, 'stone')) {
    return { hit: false, message: `${actor.name} is petrified!` };
  }

  const result = { hit: true, damage: 0, status: null, actionType: action.type };

  if (action.type === 'attack') {
    const weapon = action.weapon;
    let dmg = 0;
    let missed = false;
    if (hasStatus(actor, 'blind') && Math.random() < 0.5) {
      missed = true;
    }
    if (!missed) {
      if (weapon) {
        if (weapon.weapon_type === 'gun') {
          dmg = calcGunDamage(weapon);
        } else if (weapon.stat_used === 'agi') {
          dmg = calcAgiDamage(actor, weapon.base_power);
        } else if (weapon.stat_used === 'mana') {
          dmg = calcMagicDamage(actor, weapon);
        } else {
          dmg = calcPhysicalDamage(actor, target, weapon.base_power);
        }
        // Decrement uses
        if (weapon._usesLeft !== undefined) weapon._usesLeft--;
      } else {
        dmg = calcPhysicalDamage(actor, target, 0);
      }
    }
    if (missed) {
      result.hit = false;
      result.message = `${actor.name} missed!`;
    } else {
      target.hp = Math.max(0, target.hp - dmg);
      if (target.hp === 0) target.alive = false;
      result.damage = dmg;
      result.message = `${actor.name} attacks ${target.name} for ${dmg} damage!`;
    }
    result.actionType = 'attack';
    result.usedStr = weapon ? weapon.stat_used === 'str' : true;
    result.usedAgi = weapon ? weapon.stat_used === 'agi' : false;

  } else if (action.type === 'spell') {
    const spell = action.spell;
    let dmg = 0;
    if (spell.status) {
      // Status-inflicting spell
      if (Math.random() < 0.7) {
        applyStatus(target, spell.status);
        result.status = spell.status;
        result.message = `${actor.name} casts ${spell.name}! ${target.name} is ${spell.status}!`;
      } else {
        result.message = `${actor.name} casts ${spell.name} but ${target.name} resisted!`;
        result.hit = false;
      }
    } else {
      dmg = calcMagicDamage(actor, spell);
      target.hp = Math.max(0, target.hp - dmg);
      if (target.hp === 0) target.alive = false;
      result.damage = dmg;
      result.message = `${actor.name} casts ${spell.name} for ${dmg} damage!`;
    }
    result.usedMana = true;

  } else if (action.type === 'item') {
    const item = action.item;
    const heal = item.heal_amount;
    if (heal) {
      healChar(target, heal);
      result.damage = -heal;
      result.message = `${actor.name} uses ${item.name}. ${target.name} recovers ${heal} HP!`;
    } else if (item.effect === 'cure_status') {
      clearStatus(target, item.status === 'all' ? null : item.status);
      if (item.status === 'all') target.status = [];
      result.message = `${actor.name} uses ${item.name}. Status cleared!`;
    } else if (item.effect === 'revive') {
      if (!isAlive(target)) {
        target.alive = true;
        target.hp = Math.max(1, Math.floor(target.maxHp * 0.25));
        result.message = `${actor.name} uses ${item.name}. ${target.name} revived!`;
      }
    }

  } else if (action.type === 'flee') {
    const partyAgi = actor.agi || 10;
    const enemyAgi = target.agi || 10;
    result.fled = Math.random() < (partyAgi / (partyAgi + enemyAgi) + 0.1);
    result.message = result.fled ? 'Escaped!' : 'Couldn\'t escape!';
  }

  return result;
}

// ── ENEMY AI ───────────────────────────────────────────────────────────────────
export function enemyChooseAction(enemy, party) {
  const aliveParty = party.filter(isAlive);
  if (!aliveParty.length) return null;
  const target = aliveParty[Math.floor(Math.random() * aliveParty.length)];

  // Simple AI: attack most of the time; occasionally use special ability
  if (enemy.mana > 20 && Math.random() < 0.25) {
    // Cast a spell-like attack
    return {
      type: 'spell',
      target,
      spell: { name: 'fire', base_power: 40, stat_used: 'mana', element: 'fire' }
    };
  }
  return { type: 'attack', target, weapon: null };
}

// ── BATTLE ORCHESTRATION ────────────────────────────────────────────────────────
export function buildTurnOrder(party, enemies) {
  const combatants = [
    ...party.filter(isAlive).map(c => ({ actor: c, isParty: true })),
    ...enemies.filter(e => e.hp > 0).map(e => ({ actor: e, isParty: false }))
  ];
  combatants.sort((a, b) => {
    const aAgi = a.actor.agi || 5;
    const bAgi = b.actor.agi || 5;
    return (bAgi - aAgi) + (Math.random() - 0.5) * 3;
  });
  return combatants;
}

export function postBattle(party, enemies) {
  const results = { drops: [], mutantGains: [], abilityGains: [] };

  // Meat drops
  for (const e of enemies) {
    const meat = monsterDropMeat(e.id, e.meat_level);
    if (meat) results.drops.push(meat);
  }

  // Mutant stat gains
  for (const c of party) {
    if (!isAlive(c) || c.class !== 'mutant') continue;
    const gains = mutantPostBattle(c, {
      usedStr: Math.random() < 0.5,
      usedAgi: Math.random() < 0.3,
      usedMana: Math.random() < 0.5,
      killedEnemy: true
    });
    if (Object.keys(gains).length) results.mutantGains.push({ char: c.name, gains });

    // Random ability gain
    if (Math.random() < 0.15 && GameData.abilities.length) {
      const abilPool = GameData.abilities.filter(a =>
        ['ability', 'spell'].includes(a.type) && a.name
      );
      if (abilPool.length) {
        const newAbil = abilPool[Math.floor(Math.random() * abilPool.length)];
        const lost = mutantLearnAbility(c, newAbil.id);
        results.abilityGains.push({ char: c.name, ability: newAbil.name });
      }
    }
  }

  return results;
}
