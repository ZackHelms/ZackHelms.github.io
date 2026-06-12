// engine.js — Main game loop and state machine
import { loadAllData, GameData, getMap, buildEnemyGroup, getEncounterTable } from './data.js';
import { Renderer, TILE_SIZE } from './renderer.js';
import { createHuman, createMutant, createMonster, monsterEatMeat } from './characters.js';
import { createParty, saveGame, loadGame, hasSave, fullHeal, spendGold, earnGold, getGoldEarned, addMeat, addItem } from './party.js';
import { buildTurnOrder, resolveAction, enemyChooseAction, postBattle } from './battle.js';

const STATES = {
  LOADING: 'loading', TITLE: 'title', CHAR_CREATE: 'char_create',
  WORLD: 'world', BATTLE: 'battle', MENU: 'menu',
  SHOP: 'shop', DIALOG: 'dialog', GAME_OVER: 'game_over', VICTORY: 'victory'
};

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.R = new Renderer(canvas);
    this.state = STATES.LOADING;
    this.party = null;
    this.keys = {};
    this.prevKeys = {};
    this._raf = null;

    // World state
    this.currentMap = null;
    this.cam = { x: 0, y: 0 };
    this.stepCount = 0;

    // Battle state
    this.battle = null;
    this.battleLog = [];
    this.battlePhase = 'menu'; // menu | animating | enemy_turn | result | post
    this.battleMenuIdx = 0;
    this.selectedChar = 0;
    this.partyActions = [];

    // Dialog state
    this.dialogLines = [];
    this.dialogIdx = 0;
    this.dialogCallback = null;

    // Shop state
    this.shopData = null;
    this.shopMenuIdx = 0;

    // Menu state
    this.menuStack = [];

    // Char create state
    this.charCreateSlot = 0;
    this.charCreateClass = 0;
    this.pendingParty = [];
    this.charCreateName = '';
    this.nameInput = null;

    // Title state
    this.titleSel = 0;

    // Animations
    this.fadeAlpha = 0;
    this.flashTimer = 0;

    // UI message
    this.uiMessage = '';
    this.uiMessageTimer = 0;

    this._setupInput();
  }

  _setupInput() {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      this._handleKey(e.code, e);
    });
    window.addEventListener('keyup', e => { delete this.keys[e.code]; });
  }

  _pressed(code) {
    return this.keys[code] && !this.prevKeys[code];
  }

  async start() {
    await loadAllData();
    this.state = STATES.TITLE;
    this._loop();
  }

  _loop() {
    this._raf = requestAnimationFrame(() => {
      this._update();
      this._render();
      Object.assign(this.prevKeys, this.keys);
      this._loop();
    });
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  _update() {
    if (this.uiMessageTimer > 0) this.uiMessageTimer--;
    if (this.flashTimer > 0) this.flashTimer--;

    switch (this.state) {
      case STATES.TITLE:      this._updateTitle(); break;
      case STATES.CHAR_CREATE: this._updateCharCreate(); break;
      case STATES.WORLD:      this._updateWorld(); break;
      case STATES.BATTLE:     this._updateBattle(); break;
      case STATES.MENU:       this._updateMenu(); break;
      case STATES.SHOP:       this._updateShop(); break;
      case STATES.DIALOG:     this._updateDialog(); break;
    }
  }

  // ── TITLE SCREEN ──────────────────────────────────────────────────────────
  _updateTitle() {
    const options = hasSave() ? 2 : 1;
    if (this._pressed('ArrowUp'))   this.titleSel = Math.max(0, this.titleSel - 1);
    if (this._pressed('ArrowDown')) this.titleSel = Math.min(options - 1, this.titleSel + 1);
    if (this._pressed('Enter') || this._pressed('KeyZ')) {
      if (this.titleSel === 0) {
        this._startNewGame();
      } else {
        this._loadGame();
      }
    }
  }

  _startNewGame() {
    this.pendingParty = [];
    this.charCreateSlot = 0;
    this.charCreateClass = 0;
    this.charCreateName = '';
    this.state = STATES.CHAR_CREATE;
  }

  _loadGame() {
    const save = loadGame();
    if (save) {
      this.party = save;
      this._enterMap(this.party.mapId, this.party.playerX, this.party.playerY);
    }
  }

  // ── CHARACTER CREATION ────────────────────────────────────────────────────
  _updateCharCreate() {
    const classes = ['human', 'mutant', 'monster'];
    if (this._pressed('ArrowLeft'))  this.charCreateClass = (this.charCreateClass + 2) % 3;
    if (this._pressed('ArrowRight')) this.charCreateClass = (this.charCreateClass + 1) % 3;
    if (this._pressed('Enter') || this._pressed('KeyZ')) {
      if (this.nameInput) return; // wait for name input
      this._openNameInput(classes[this.charCreateClass]);
    }
  }

  _openNameInput(charClass) {
    const defaultNames = {
      human: ['Hero', 'Knight', 'Warrior', 'Fighter'],
      mutant: ['Psi', 'Nova', 'Echo', 'Aura'],
      monster: ['Beast', 'Rex', 'Fang', 'Claw']
    };
    const name = prompt(
      `Name your ${charClass} (slot ${this.charCreateSlot + 1}/4):`,
      defaultNames[charClass][this.charCreateSlot] || charClass
    );
    if (!name) return;
    const char = charClass === 'human'
      ? createHuman(name)
      : charClass === 'mutant'
      ? createMutant(name)
      : createMonster(name, 78); // start as goblin
    this.pendingParty.push(char);
    this.charCreateSlot++;
    this.charCreateClass = 0;
    if (this.charCreateSlot >= 4) {
      this.party = createParty(this.pendingParty);
      this._enterMap('world1', 15, 10);
    }
  }

  // ── WORLD NAVIGATION ─────────────────────────────────────────────────────
  _enterMap(mapId, x, y) {
    this.currentMap = getMap(mapId);
    if (!this.currentMap) { console.error('Map not found:', mapId); return; }
    this.party.mapId = mapId;
    this.party.playerX = x;
    this.party.playerY = y;
    this.party.playerFacing = 'down';
    this._updateCamera();
    this.state = STATES.WORLD;
    this.stepCount = 0;
  }

  _updateCamera() {
    const vw = Math.floor(this.canvas.width / TILE_SIZE);
    const vh = Math.floor(this.canvas.height / TILE_SIZE);
    this.cam.x = Math.max(0, Math.min(this.currentMap.width - vw, this.party.playerX - Math.floor(vw / 2)));
    this.cam.y = Math.max(0, Math.min(this.currentMap.height - vh, this.party.playerY - Math.floor(vh / 2)));
  }

  _updateWorld() {
    if (this._pressed('Escape') || this._pressed('KeyX')) {
      this._openPartyMenu();
      return;
    }

    let dx = 0, dy = 0;
    if (this._pressed('ArrowUp'))    { dy = -1; this.party.playerFacing = 'up'; }
    if (this._pressed('ArrowDown'))  { dy =  1; this.party.playerFacing = 'down'; }
    if (this._pressed('ArrowLeft'))  { dx = -1; this.party.playerFacing = 'left'; }
    if (this._pressed('ArrowRight')) { dx =  1; this.party.playerFacing = 'right'; }

    if (dx === 0 && dy === 0) return;

    const nx = this.party.playerX + dx;
    const ny = this.party.playerY + dy;
    const tile = this._getTile(nx, ny);

    if (tile === null || tile === 1 || tile === 9) return; // wall/mountain blocked

    if (tile === 2) return; // water blocked

    this.party.playerX = nx;
    this.party.playerY = ny;
    this._updateCamera();

    // Check objects at new position
    const obj = this._getObjectAt(nx, ny);
    if (obj) {
      this._interactObject(obj);
      return;
    }

    // Random encounter check
    const map = this.currentMap;
    if (map.encounter_table && map.encounter_rate) {
      this.stepCount++;
      if (Math.random() < map.encounter_rate) {
        this._startEncounter(map.encounter_table);
      }
    }
  }

  _getTile(x, y) {
    const map = this.currentMap;
    if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
    return map.tiles[y * map.width + x];
  }

  _getObjectAt(x, y) {
    return (this.currentMap.objects || []).find(o => o.x === x && o.y === y) || null;
  }

  _interactObject(obj) {
    switch (obj.type) {
      case 'town':
      case 'dungeon':
        this._fadeAndEnterMap(obj.id, null, null);
        break;
      case 'exit':
        this._fadeAndEnterMap(obj.target_map, obj.target_x, obj.target_y);
        break;
      case 'gate':
        if (this.party.crystalBalls >= (obj.requires_balls || 4)) {
          this._showMessage('The gate opens!');
          this._fadeAndEnterMap('world1', 15, 10); // placeholder
        } else {
          this._openDialog([
            `You need ${obj.requires_balls} Crystal Balls to open this gate.`,
            `You have: ${this.party.crystalBalls}`
          ]);
        }
        break;
      case 'npc':
        const dlg = GameData.dialogue?.npcs?.[obj.id];
        if (dlg) this._openDialog(dlg.lines || [`${dlg.name || obj.name}: ...`]);
        break;
      case 'shop':
        this._openShop(obj.id);
        break;
      case 'chest':
        if (!this.party.chestOpened.has(obj.id || `${obj.x}_${obj.y}`)) {
          this.party.chestOpened.add(obj.id || `${obj.x}_${obj.y}`);
          this._openDialog([`Found: ${obj.item || 'item'}!`]);
          this._showMessage(`Found ${obj.item}!`);
        }
        break;
      case 'stairs_up':
        this._openDialog(['Ascending to next floor...']);
        break;
    }
  }

  _fadeAndEnterMap(mapId, x, y) {
    const map = getMap(mapId);
    if (map) {
      const sx = x ?? map.player_start?.x ?? 0;
      const sy = y ?? map.player_start?.y ?? 0;
      this._enterMap(mapId, sx, sy);
      saveGame(this.party);
    } else {
      this._showMessage(`Map "${mapId}" not yet implemented`);
    }
  }

  _startEncounter(tableId) {
    const enemies = buildEnemyGroup(tableId);
    if (!enemies.length) return;
    enemies.forEach(e => { e.currentHp = e.hp; if (!e.status) e.status = []; });

    this.battle = {
      enemies,
      tableId,
      turnOrder: [],
      currentTurn: 0,
      phase: 'menu',
      selectedAction: null,
      selectedTarget: 0,
      charIdx: 0,
      partyActions: [],
      log: [],
      result: null,
      animTimer: 0,
      flashEnemy: -1
    };
    this.state = STATES.BATTLE;
  }

  // ── BATTLE ────────────────────────────────────────────────────────────────
  _updateBattle() {
    const b = this.battle;
    if (!b) return;

    if (b.phase === 'menu') {
      this._updateBattleMenu();
    } else if (b.phase === 'executing') {
      this._executeTurns();
    } else if (b.phase === 'result') {
      if (this._pressed('Enter') || this._pressed('KeyZ') || this._pressed('Space')) {
        this._endBattle();
      }
    }
  }

  _updateBattleMenu() {
    const b = this.battle;
    const alive = this.party.members.filter(c => c.alive && c.hp > 0);
    if (!alive.length) {
      b.phase = 'result'; b.result = 'lose'; return;
    }

    // Check if all enemies dead
    if (!b.enemies.some(e => e.currentHp > 0)) {
      b.phase = 'result'; b.result = 'win';
      b.log = ['Victory!', `Earned ${getGoldEarned(b.enemies)} gold`];
      earnGold(this.party, getGoldEarned(b.enemies));
      const drops = postBattle(this.party.members, b.enemies);
      if (drops.drops.length) {
        b.log.push('Meat dropped: ' + drops.drops.map(d => d.name).join(', '));
        for (const meat of drops.drops) {
          const monster = this.party.members.find(c => c.class === 'monster');
          if (monster && monster.meatSlots.length < 4) {
            addMeat(monster, meat);
          }
        }
      }
      return;
    }

    // Current party member selects action
    const chars = this.party.members.filter(c => c.alive && c.hp > 0);
    if (b.charIdx >= chars.length) {
      // All party members have chosen, execute
      b.phase = 'executing';
      b.turnOrder = this._buildTurnOrder();
      b.currentTurn = 0;
      return;
    }

    const char = chars[b.charIdx];
    // Simple action selection: up/down to scroll, Z/Enter to confirm
    const actions = this._getCharActions(char);

    if (this._pressed('ArrowUp'))   b.selectedAction = Math.max(0, (b.selectedAction ?? 0) - 1);
    if (this._pressed('ArrowDown')) b.selectedAction = Math.min(actions.length - 1, (b.selectedAction ?? 0) + 1);

    if (this._pressed('Enter') || this._pressed('KeyZ')) {
      const action = actions[b.selectedAction ?? 0];
      if (!action) return;
      // Flee: immediate attempt
      if (action.type === 'flee') {
        const enemy = b.enemies.find(e => e.currentHp > 0);
        const res = resolveAction(char, enemy || b.enemies[0], action, GameData.items);
        if (res.fled) {
          this._endBattle(true);
        } else {
          b.log = ["Couldn't escape!", ''];
          b.partyActions.push({ char, action: { type: 'attack', weapon: null } });
          b.charIdx++;
          b.selectedAction = 0;
        }
        return;
      }
      b.partyActions.push({ char, action });
      b.charIdx++;
      b.selectedAction = 0;
    }
  }

  _getCharActions(char) {
    const actions = [];
    // Attack with first equipped weapon (or bare hands)
    let weapon = null;
    if (char.equipment && char.equipment.length > 0) {
      const ab = GameData.abilities[char.equipment[0]];
      if (ab && ['sword', 'weapon', 'gun', 'melee'].includes(ab.type)) {
        weapon = { ...ab, _id: char.equipment[0] };
      }
    }
    actions.push({ type: 'attack', label: weapon ? `Attack (${weapon.name})` : 'Attack', weapon });

    // Abilities for mutants
    if (char.class === 'mutant' && char.abilities?.length) {
      char.abilities.slice(0, 2).forEach(abilId => {
        const ab = GameData.abilities[abilId];
        if (ab) actions.push({ type: 'spell', label: `Use ${ab.name}`, spell: ab });
      });
    }

    // Meat for monsters
    if (char.class === 'monster' && char.meatSlots?.length) {
      actions.push({ type: 'meat', label: `Eat Meat (${char.meatSlots.length})` });
    }

    // Item use
    if (char.equipment?.length > 1) {
      const ab = GameData.abilities[char.equipment[1]];
      if (ab && ab.type === 'usable_item') {
        actions.push({ type: 'item', label: `Use ${ab.name}`, item: ab, target: char });
      }
    }

    actions.push({ type: 'flee', label: 'Flee' });
    return actions;
  }

  _buildTurnOrder() {
    const party = this.party.members.filter(c => c.alive && c.hp > 0);
    const enemies = this.battle.enemies.filter(e => e.currentHp > 0);
    const all = [
      ...this.battle.partyActions.map(pa => ({ isParty: true, char: pa.char, action: pa.action })),
      ...enemies.map(e => ({ isParty: false, enemy: e }))
    ];
    all.sort((a, b) => {
      const aA = a.char?.agi || a.enemy?.agi || 5;
      const bA = b.char?.agi || b.enemy?.agi || 5;
      return (bA - aA) + (Math.random() - 0.5) * 4;
    });
    return all;
  }

  _executeTurns() {
    const b = this.battle;
    if (b.animTimer > 0) { b.animTimer--; return; }

    if (b.currentTurn >= b.turnOrder.length) {
      b.phase = 'menu';
      b.charIdx = 0;
      b.partyActions = [];
      b.selectedAction = 0;
      b.flashEnemy = -1;
      // Check win/lose
      if (!b.enemies.some(e => e.currentHp > 0)) {
        b.phase = 'result'; b.result = 'win';
      } else if (!this.party.members.some(c => c.alive && c.hp > 0)) {
        b.phase = 'result'; b.result = 'lose';
      }
      return;
    }

    const turn = b.turnOrder[b.currentTurn];
    b.currentTurn++;

    if (turn.isParty) {
      // Party action
      const { char, action } = turn;
      if (!char.alive || char.hp <= 0) return;
      let target;
      if (action.type === 'attack' || action.type === 'spell') {
        target = b.enemies.find(e => e.currentHp > 0);
        if (!target) return;
        b.flashEnemy = b.enemies.indexOf(target);
      } else {
        target = char;
      }
      const res = resolveAction(char, target, action, GameData.items);
      b.log = [res.message];
      if (res.damage > 0) {
        target.currentHp = Math.max(0, (target.currentHp ?? target.hp) - 0);
        // already applied in resolveAction via target.hp manipulation
        // sync currentHp
        b.enemies.forEach(e => { if (e === target) e.currentHp = e.hp; });
        b.animTimer = 12;
      }
    } else {
      // Enemy turn
      const { enemy } = turn;
      if (!enemy || enemy.currentHp <= 0) return;
      const aliveParty = this.party.members.filter(c => c.alive && c.hp > 0);
      if (!aliveParty.length) return;
      const action = enemyChooseAction(enemy, aliveParty);
      if (!action) return;
      const res = resolveAction(enemy, action.target, action, GameData.items);
      b.log = [res.message];
      if (res.damage > 0) b.animTimer = 10;
    }
  }

  _endBattle(fled = false) {
    const b = this.battle;
    if (b?.result === 'lose') {
      this.state = STATES.GAME_OVER;
      return;
    }
    this.battle = null;
    this.state = STATES.WORLD;
    saveGame(this.party);
    if (!fled) this._showMessage('Victory!');
  }

  // ── DIALOG ───────────────────────────────────────────────────────────────
  _openDialog(lines, callback = null) {
    this.dialogLines = lines;
    this.dialogIdx = 0;
    this.dialogCallback = callback;
    this._prevState = this.state;
    this.state = STATES.DIALOG;
  }

  _updateDialog() {
    if (this._pressed('Enter') || this._pressed('KeyZ') || this._pressed('Space')) {
      this.dialogIdx++;
      if (this.dialogIdx >= this.dialogLines.length) {
        this.state = this._prevState || STATES.WORLD;
        if (this.dialogCallback) { this.dialogCallback(); this.dialogCallback = null; }
      }
    }
  }

  // ── SHOP ─────────────────────────────────────────────────────────────────
  _openShop(shopId) {
    const shop = GameData.shops?.shops?.find(s => s.id === shopId);
    if (!shop) { this._showMessage('Shop not available'); return; }
    this.shopData = { ...shop, menuIdx: 0 };
    this._prevState = this.state;
    this.state = STATES.SHOP;
  }

  _updateShop() {
    const s = this.shopData;
    if (!s) { this.state = this._prevState || STATES.WORLD; return; }

    const items = [...(s.inventory || []), { name: 'Leave', price: null }];
    if (this._pressed('ArrowUp'))   s.menuIdx = Math.max(0, s.menuIdx - 1);
    if (this._pressed('ArrowDown')) s.menuIdx = Math.min(items.length - 1, s.menuIdx + 1);

    if (this._pressed('Enter') || this._pressed('KeyZ')) {
      const item = items[s.menuIdx];
      if (!item || item.name === 'Leave') {
        this.state = this._prevState || STATES.WORLD;
        this.shopData = null;
        return;
      }
      if (item.price && spendGold(this.party, item.price)) {
        // Give item to first party member who can hold it
        for (const c of this.party.members) {
          if (c.class !== 'monster' && addItem(c, item.ability_id)) {
            this._showMessage(`Bought ${item.name}!`);
            break;
          }
        }
      } else {
        this._showMessage('Not enough gold!');
      }
    }

    if (this._pressed('Escape') || this._pressed('KeyX')) {
      this.state = this._prevState || STATES.WORLD;
      this.shopData = null;
    }
  }

  // ── PARTY MENU ────────────────────────────────────────────────────────────
  _openPartyMenu() {
    this.menuStack = [{ type: 'main', idx: 0 }];
    this._prevState = this.state;
    this.state = STATES.MENU;
  }

  _updateMenu() {
    if (!this.menuStack.length) { this.state = this._prevState || STATES.WORLD; return; }
    const top = this.menuStack[this.menuStack.length - 1];
    const items = this._getMenuItems(top.type);

    if (this._pressed('ArrowUp'))   top.idx = Math.max(0, top.idx - 1);
    if (this._pressed('ArrowDown')) top.idx = Math.min(items.length - 1, top.idx + 1);
    if (this._pressed('Escape') || this._pressed('KeyX')) {
      this.menuStack.pop();
      if (!this.menuStack.length) this.state = this._prevState || STATES.WORLD;
      return;
    }
    if (this._pressed('Enter') || this._pressed('KeyZ')) {
      const item = items[top.idx];
      if (item?.action === 'close' || item?.label === 'Close') {
        this.menuStack.pop();
        if (!this.menuStack.length) this.state = this._prevState || STATES.WORLD;
      } else if (item?.action === 'status') {
        this.menuStack.push({ type: 'status', idx: 0, charIdx: top.idx });
      } else if (item?.action === 'save') {
        saveGame(this.party);
        this._showMessage('Game saved!');
      }
    }
  }

  _getMenuItems(menuType) {
    if (menuType === 'main') {
      const base = this.party.members.map((c, i) => ({
        label: c.name, value: `HP ${c.hp}/${c.maxHp}`, action: 'status', charIdx: i
      }));
      return [...base, { label: `Gold: ${this.party.gold}`, value: '' },
               { label: 'Save', action: 'save' }, { label: 'Close', action: 'close' }];
    }
    return [{ label: 'Close', action: 'close' }];
  }

  _showMessage(msg, ticks = 120) {
    this.uiMessage = msg;
    this.uiMessageTimer = ticks;
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  _render() {
    const R = this.R;
    R.clear();

    switch (this.state) {
      case STATES.LOADING:  this._renderLoading(); break;
      case STATES.TITLE:    this._renderTitle(); break;
      case STATES.CHAR_CREATE: this._renderCharCreate(); break;
      case STATES.WORLD:    this._renderWorld(); break;
      case STATES.BATTLE:   this._renderBattle(); break;
      case STATES.MENU:     this._renderWorld(); this._renderMenu(); break;
      case STATES.SHOP:     this._renderWorld(); this._renderShop(); break;
      case STATES.DIALOG:   this._renderWorld(); this._renderDialog(); break;
      case STATES.GAME_OVER: this._renderGameOver(); break;
    }

    // Persistent UI message
    if (this.uiMessageTimer > 0 && this.uiMessage) {
      const alpha = Math.min(1, this.uiMessageTimer / 20);
      R.ctx.globalAlpha = alpha;
      R.drawPanel(R.W / 2 - 120, R.H - 60, 240, 30);
      R.drawText(this.uiMessage, R.W / 2, R.H - 48, { size: 11, align: 'center' });
      R.ctx.globalAlpha = 1;
    }
  }

  _renderLoading() {
    this.R.drawTitle('LOADING…', this.R.W / 2, this.R.H / 2, { size: 24 });
  }

  _renderTitle() {
    const R = this.R;
    // Background gradient
    const g = R.ctx.createLinearGradient(0, 0, 0, R.H);
    g.addColorStop(0, '#06060e');
    g.addColorStop(1, '#0a0a1a');
    R.ctx.fillStyle = g; R.ctx.fillRect(0, 0, R.W, R.H);

    // Stars
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137.508 + 50) % R.W;
      const sy = (i * 97.3 + 30) % R.H;
      const bri = 0.3 + 0.7 * ((Math.sin(Date.now() / 1000 + i) + 1) / 2);
      R.ctx.fillStyle = `rgba(221,227,255,${bri * 0.6})`;
      R.ctx.fillRect(sx, sy, 1, 1);
    }

    R.drawTitle('FINAL FANTASY', R.W / 2, R.H * 0.25, { color: '#ffc300', glow: '#ffc300', size: 22 });
    R.drawTitle('LEGEND', R.W / 2, R.H * 0.38, { color: '#ffc300', glow: '#ffc300', size: 36 });
    R.drawText('MAKAI TOUSHI SA·GA · GAME BOY 1989', R.W / 2, R.H * 0.52,
      { size: 9, align: 'center', color: '#353555' });

    const options = [{ label: '▶ NEW GAME' }];
    if (hasSave()) options.push({ label: '▶ CONTINUE' });

    options.forEach((opt, i) => {
      const y = R.H * 0.65 + i * 26;
      const sel = this.titleSel === i;
      R.drawText(opt.label, R.W / 2, y, {
        size: 14, align: 'center',
        color: sel ? '#39ff14' : '#353555'
      });
      if (sel) {
        R.ctx.shadowColor = '#39ff14';
        R.ctx.shadowBlur = 12;
        R.drawText(opt.label, R.W / 2, y, { size: 14, align: 'center', color: '#39ff14' });
        R.ctx.shadowBlur = 0;
      }
    });
    R.drawText('ENTER/Z: select  ·  ARROWS: navigate', R.W / 2, R.H - 20,
      { size: 8, align: 'center', color: '#252545' });
  }

  _renderCharCreate() {
    const R = this.R;
    R.drawTitle('CREATE PARTY', R.W / 2, 50, { size: 20 });
    R.drawText(`Character ${this.charCreateSlot + 1} of 4`, R.W / 2, 80,
      { size: 10, align: 'center', color: '#353555' });

    const classes = [
      { id: 'human',  color: '#ffc300', desc: '8 item slots · Stat items · Full armor' },
      { id: 'mutant', color: '#39ff14', desc: '4 item + 4 ability slots · Battle growth' },
      { id: 'monster',color: '#ff4455', desc: '4 meat slots · Transform via eating' }
    ];

    classes.forEach((cls, i) => {
      const x = 80 + i * 180;
      const y = 120;
      const sel = this.charCreateClass === i;
      R.drawPanel(x - 60, y, 150, 180, cls.id.toUpperCase());
      if (sel) {
        R.ctx.strokeStyle = cls.color;
        R.ctx.lineWidth = 2;
        R.ctx.strokeRect(x - 60, y, 150, 180);
      }
      R.drawText(cls.desc, x - 50, y + 30, { size: 9, color: '#aaaaaa' });

      // Mini stats preview
      const stats = cls.id === 'human'
        ? { HP: 150, STR: 12, DEF: 8, AGI: 10, MANA: 4 }
        : cls.id === 'mutant'
        ? { HP: 80, STR: 6, DEF: 5, AGI: 8, MANA: 15 }
        : { HP: 60, STR: 10, DEF: 8, AGI: 8, MANA: 5 };

      let sy = y + 70;
      for (const [stat, val] of Object.entries(stats)) {
        R.drawText(`${stat}: ${val}`, x - 50, sy, { size: 9, color: '#dde3ff' });
        sy += 16;
      }

      if (sel) {
        R.drawText('▶ ENTER to select', x - 50, y + 155, { size: 8, color: cls.color });
      }
    });

    // Show already-created slots
    this.pendingParty.forEach((c, i) => {
      R.drawCharStatus(c, 20 + i * 210, R.H - 70, false);
    });

    R.drawText('◀▶ choose class  ·  ENTER/Z confirm  ·  name dialog will appear',
      R.W / 2, R.H - 14, { size: 8, align: 'center', color: '#252545' });
  }

  _renderWorld() {
    if (!this.currentMap || !this.party) return;
    const R = this.R;
    const mapData = this.currentMap;
    const player = {
      x: this.party.playerX, y: this.party.playerY, facing: this.party.playerFacing || 'down'
    };
    R.drawMap(mapData, this.cam.x, this.cam.y, player, mapData.objects || []);

    // HUD — party status strip at bottom
    const hh = 56;
    R.ctx.fillStyle = 'rgba(6,6,14,0.85)';
    R.ctx.fillRect(0, R.H - hh, R.W, hh);
    this.party.members.forEach((c, i) => {
      R.drawCharStatus(c, 4 + i * (Math.floor((R.W - 8) / 4)), R.H - hh + 2, false);
    });

    // Map name
    R.drawText(mapData.name || '', 8, 8, { size: 9, color: '#252545' });
    R.drawText(`Gold: ${this.party.gold}`, R.W - 8, 8, { size: 9, align: 'right', color: '#ffc300' });
    R.drawText(`Crystals: ${this.party.crystalBalls}/4`, R.W - 8, 22, { size: 9, align: 'right', color: '#00f5ff' });
  }

  _renderBattle() {
    const R = this.R;
    const b = this.battle;
    if (!b) return;

    R.drawBattleBackground(this.party.currentWorld || 1);

    // Draw enemies (top half)
    const enemies = b.enemies;
    const eCount = enemies.length;
    const eW = 80, eH = 80;
    enemies.forEach((e, i) => {
      const x = R.W * 0.15 + i * (R.W * 0.65 / Math.max(1, eCount));
      const y = R.H * 0.08;
      const flash = b.flashEnemy === i && b.animTimer > 0;
      if (e.currentHp > 0) R.drawEnemy(e, x, y, eW, flash);
    });

    // Draw party (bottom area above status)
    const ph = R.H - 180;
    this.party.members.forEach((c, i) => {
      R.drawCharStatus(c, 4 + i * Math.floor((R.W - 8) / 4), ph, b.charIdx === i && b.phase === 'menu');
    });

    // Battle log
    const logY = ph - 46;
    R.drawPanel(4, logY, R.W - 8, 44);
    (b.log || []).slice(-2).forEach((line, i) => {
      R.drawText(line, 12, logY + 6 + i * 16, { size: 10, color: '#dde3ff' });
    });

    // Battle menu for current character
    if (b.phase === 'menu') {
      const chars = this.party.members.filter(c => c.alive && c.hp > 0);
      if (b.charIdx < chars.length) {
        const char = chars[b.charIdx];
        const actions = this._getCharActions(char);
        const menuItems = actions.map((a, i) => ({
          label: a.label, value: '',
          selected: i === (b.selectedAction ?? 0)
        }));
        R.drawMenu(menuItems, R.W - 190, logY - actions.length * 18 - 22, 186, b.selectedAction ?? 0);
        R.drawText(`${char.name}'s turn:`, R.W - 190, logY - actions.length * 18 - 32,
          { size: 9, color: '#ffc300' });
      }
    }

    if (b.phase === 'result') {
      const win = b.result === 'win';
      R.drawPanel(R.W / 2 - 120, R.H / 2 - 40, 240, 80);
      R.drawTitle(win ? 'VICTORY!' : 'DEFEAT', R.W / 2, R.H / 2 - 20,
        { color: win ? '#39ff14' : '#ff4455', size: 22, glow: win ? '#39ff14' : '#ff4455' });
      R.drawText('Press ENTER to continue', R.W / 2, R.H / 2 + 12,
        { size: 9, align: 'center', color: '#353555' });
    }

    R.drawText('Z/Enter: confirm  ·  ESC: menu', 8, R.H - 10, { size: 8, color: '#252545' });
  }

  _renderMenu() {
    const R = this.R;
    if (!this.menuStack.length) return;
    const top = this.menuStack[this.menuStack.length - 1];
    const items = this._getMenuItems(top.type);
    const w = 240, x = R.W / 2 - w / 2;
    R.drawMenu(items.map((it, i) => ({ label: it.label, value: it.value || '' })),
      x, 60, w, top.idx);
    R.drawText('ESC/X: back', x, 58, { size: 8, color: '#252545' });
  }

  _renderShop() {
    const R = this.R;
    const s = this.shopData;
    if (!s) return;
    const items = [...(s.inventory || []).map(i => ({ label: i.name, value: `${i.price}g` })),
                   { label: 'Leave', value: '' }];
    R.drawPanel(R.W / 2 - 130, 40, 260, items.length * 18 + 50, s.name);
    R.drawMenu(items, R.W / 2 - 130, 40, 260, s.menuIdx);
    R.drawText(`Gold: ${this.party.gold}`, R.W / 2 + 80, 46, { size: 9, color: '#ffc300' });
  }

  _renderDialog() {
    const R = this.R;
    const lines = this.dialogLines.slice(this.dialogIdx, this.dialogIdx + 3);
    R.drawDialog(lines, 20, R.H * 0.6, R.W - 40, 80);
  }

  _renderGameOver() {
    const R = this.R;
    R.drawTitle('GAME OVER', R.W / 2, R.H / 2 - 20, { color: '#ff4455', glow: '#ff0000', size: 32 });
    R.drawText('Press ENTER to return to title', R.W / 2, R.H / 2 + 30,
      { size: 11, align: 'center', color: '#353555' });
    if (this._pressed('Enter') || this._pressed('KeyZ')) {
      this.party = null;
      this.battle = null;
      this.state = STATES.TITLE;
      this.titleSel = 0;
    }
  }
}
