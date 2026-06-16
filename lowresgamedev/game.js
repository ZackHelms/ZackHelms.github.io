// game.js — game state, map, sprite logic

const MAP_COLS = 36;
const MAP_ROWS = 36;
const COORDS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // base-36

const MOVE_SPEED = 80; // pixels per second — default, overridable via settings.json

// ── Debug tile renderer ───────────────────────────────────────────────────────

function drawDebugTileAt(ctx, sx, sy, sz, col, row) {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(sx, sy, sz, sz);

  ctx.strokeStyle = '#2a2a4e';
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 0.5, sy + 0.5, sz - 1, sz - 1);

  const fontSize = Math.max(4, Math.floor(sz * 0.38));
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cx = sx + sz / 2;
  const cy = sy + sz / 2;

  ctx.fillStyle = '#888';
  ctx.fillText(COORDS[col], cx - sz * 0.18, cy);
  ctx.fillStyle = '#ccc';
  ctx.fillText(COORDS[row], cx + sz * 0.18, cy);
}

// ── Game ──────────────────────────────────────────────────────────────────────

class Game {
  constructor(canvas, settings = {}) {
    this.renderer = new Renderer(canvas);
    this.input = new Input();

    // Integer tile position — where the character currently stands
    this.tileX = Math.floor(MAP_COLS / 2);
    this.tileY = Math.floor(MAP_ROWS / 2);

    // Pixel position used for rendering (interpolates toward target)
    this.charX = this.tileX * TILE;
    this.charY = this.tileY * TILE;

    // Tile-locked movement: target is always exactly one tile away
    this.targetTileX = this.tileX;
    this.targetTileY = this.tileY;
    this.moving = false;

    // Animation
    this.animFrame = 0;
    this.animTimer = 0;
    this.moveSpeed = settings.move_speed ?? MOVE_SPEED;

    const fps = settings.walk_animation_framerate ?? 1;
    this.ANIM_INTERVAL = 1 / fps;
    this.sprites = [null, null];
    this._loadSprites();

    this.loop = new Loop((dt) => this._tick(dt));
  }

  _loadSprites() {
    for (let i = 0; i < 2; i++) {
      const img = new Image();
      img.src = `assets/sprite001-${i === 0 ? 'a' : 'b'}.png`;
      this.sprites[i] = img;
    }
  }

  start() { this.loop.start(); }

  reset() {
    this.tileX = Math.floor(MAP_COLS / 2);
    this.tileY = Math.floor(MAP_ROWS / 2);
    this.charX = this.tileX * TILE;
    this.charY = this.tileY * TILE;
    this.targetTileX = this.tileX;
    this.targetTileY = this.tileY;
    this.moving = false;
    this.animFrame = 0;
    this.animTimer = 0;
    this.input.clearAll();
  }

  // If not already moving and a direction is held, commit to one tile of movement.
  // Called when movement completes (to chain the next tile) and each tick when idle.
  _tryStartMove(inp) {
    let dir = null;
    if      (inp.right) dir = 'right';
    else if (inp.left)  dir = 'left';
    else if (inp.down)  dir = 'down';
    else if (inp.up)    dir = 'up';
    if (!dir) return;

    let nx = this.tileX, ny = this.tileY;
    if (dir === 'right') nx++;
    else if (dir === 'left')  nx--;
    else if (dir === 'down')  ny++;
    else if (dir === 'up')    ny--;

    nx = Math.max(0, Math.min(nx, MAP_COLS - 1));
    ny = Math.max(0, Math.min(ny, MAP_ROWS - 1));

    if (nx === this.tileX && ny === this.tileY) return; // already at map edge

    this.targetTileX = nx;
    this.targetTileY = ny;
    this.moving = true;
  }

  _tick(dt) {
    const inp = this.input.held;

    if (this.moving) {
      const tx = this.targetTileX * TILE;
      const ty = this.targetTileY * TILE;
      const step = this.moveSpeed * dt;
      const dx = tx - this.charX;
      const dy = ty - this.charY;
      const dist = Math.abs(dx) + Math.abs(dy); // Manhattan — only one axis moves at a time

      if (dist <= step) {
        // Snap to target tile
        this.charX = tx;
        this.charY = ty;
        this.tileX = this.targetTileX;
        this.tileY = this.targetTileY;
        this.moving = false;
        // Immediately chain to next tile if input is still held
        this._tryStartMove(inp);
      } else {
        this.charX += Math.sign(dx) * Math.min(step, Math.abs(dx));
        this.charY += Math.sign(dy) * Math.min(step, Math.abs(dy));
      }
    } else {
      this._tryStartMove(inp);
    }

    // Animation runs while moving, resets to frame 0 when idle
    if (this.moving) {
      this.animTimer += dt;
      if (this.animTimer >= this.ANIM_INTERVAL) {
        this.animTimer -= this.ANIM_INTERVAL;
        this.animFrame = 1 - this.animFrame;
      }
    } else {
      this.animFrame = 0;
      this.animTimer = 0;
    }

    this._draw();
  }

  _draw() {
    const r = this.renderer;
    r.clear();

    // Camera: character is always centered
    const camX = this.charX + TILE / 2 - GAME_W / 2;
    const camY = this.charY + TILE / 2 - GAME_H / 2;

    const startCol = Math.max(0, Math.floor(camX / TILE) - 1);
    const startRow = Math.max(0, Math.floor(camY / TILE) - 1);
    const endCol   = Math.min(MAP_COLS - 1, Math.ceil((camX + GAME_W) / TILE));
    const endRow   = Math.min(MAP_ROWS - 1, Math.ceil((camY + GAME_H) / TILE));

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        r.drawTile((ctx, sx, sy, sz) => {
          drawDebugTileAt(ctx, sx, sy, sz, col, row);
        }, col, row, camX, camY);
      }
    }

    if (this.sprites[this.animFrame]?.complete) {
      r.drawSprite(this.sprites[this.animFrame], this.charX, this.charY, camX, camY);
    }
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
  let settings = {};
  try {
    const res = await fetch('settings.json');
    if (res.ok) settings = await res.json();
  } catch (_) {}

  // Apply CSS variables from settings before canvas resize
  const root = document.documentElement;
  root.style.setProperty('--portrait-margin-top',        (settings.portrait_margin_top        ?? 8) + 'px');
  root.style.setProperty('--game-screen-margin',         (settings.game_screen_margin         ?? 4) + 'px');
  root.style.setProperty('--portrait-btn-divider-offset',(settings.portrait_btn_divider_offset ?? 4) + 'px');

  // Position the divider at portrait_btn_divider_pos px from the bottom of the screen.
  // Extra padding is added below #controls-lower so the buttons sit at the right height.
  const dividerPos    = settings.portrait_btn_divider_pos    ?? 90;
  const dividerOffset = settings.portrait_btn_divider_offset ?? 4;
  const lowerEl = document.getElementById('controls-lower');

  function recalcPortraitPad() {
    if (!lowerEl) return;
    if (window.innerWidth > window.innerHeight) return; // landscape: skip
    // Reset before measuring so we get the natural (un-padded) height
    root.style.setProperty('--controls-lower-bottom-pad', '0px');
    const lowerNaturalH = lowerEl.offsetHeight;
    const extraPad = Math.max(0, dividerPos - dividerOffset - lowerNaturalH);
    root.style.setProperty('--controls-lower-bottom-pad', extraPad + 'px');
  }

  recalcPortraitPad();
  window.addEventListener('resize', recalcPortraitPad);
  // iOS fires orientationchange before the viewport updates; delay matches Renderer workaround
  window.addEventListener('orientationchange', () => setTimeout(recalcPortraitPad, 150));

  const canvas = document.getElementById('game-canvas');
  const game = new Game(canvas, settings);
  window._game = game;

  // D-pad buttons (both portrait and landscape share the same actions)
  const dpadBtns = {
    'btn-up': 'up', 'btn-down-p': 'down', 'btn-left-p': 'left', 'btn-right-p': 'right',
    'btn-up-l': 'up', 'btn-down': 'down', 'btn-left': 'left', 'btn-right': 'right',
  };
  for (const [id, action] of Object.entries(dpadBtns)) {
    const el = document.getElementById(id);
    if (el) game.input.register(el, action);
  }

  // Action buttons — visual state only in v0.1
  const actionBtns = {
    'btn-a': 'a', 'btn-a-l': 'a',
    'btn-b': 'b', 'btn-b-l': 'b',
    'btn-select': 'select', 'btn-select-l': 'select',
    'btn-start': 'start', 'btn-start-l': 'start',
  };
  for (const [id, action] of Object.entries(actionBtns)) {
    const el = document.getElementById(id);
    if (el) game.input.register(el, action);
  }

  // Utility buttons — fire on first contact (tap or slide-to)
  ['btn-reload', 'btn-reload-l'].forEach(id => {
    const el = document.getElementById(id);
    if (el) game.input.register(el, null, { onEnter: () => location.reload(true) });
  });

  // Debug toggle — shows tap target outlines with orange fill
  let debugMode = false;
  const debugEls = [];
  function toggleDebug() {
    debugMode = !debugMode;
    document.body.classList.toggle('debug-mode', debugMode);
    debugEls.forEach(el => el.classList.toggle('debug-btn-active', debugMode));
  }
  ['btn-debug', 'btn-debug-l'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      debugEls.push(el);
      game.input.register(el, null, { onEnter: toggleDebug });
    }
  });

  game.start();
});
