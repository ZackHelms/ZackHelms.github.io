// game.js — game state, map, sprite logic

const MAP_COLS = 36;
const MAP_ROWS = 36;
const COORDS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // base-36

const MOVE_SPEED = 80; // pixels per second

// ── Debug tile renderer ───────────────────────────────────────────────────────

function makeDebugTileCache() {
  const cache = {};
  return function drawDebugTile(ctx, sx, sy, sz) {
    const key = `${sx},${sy},${sz}`;
    // We receive draw coords, but we need tile coords — pass them externally
    // This version receives (ctx, sx, sy, sz, col, row) — see call site
    throw new Error('use drawDebugTileAt');
  };
}

function drawDebugTileAt(ctx, sx, sy, sz, col, row) {
  // Background: dark slate
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(sx, sy, sz, sz);

  // Subtle grid line
  ctx.strokeStyle = '#2a2a4e';
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 0.5, sy + 0.5, sz - 1, sz - 1);

  const fontSize = Math.max(4, Math.floor(sz * 0.38));
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cx = sx + sz / 2;
  const cy = sy + sz / 2;

  // Column label — dark gray, left half
  ctx.fillStyle = '#888';
  ctx.fillText(COORDS[col], cx - sz * 0.18, cy);

  // Row label — lighter gray, right half
  ctx.fillStyle = '#ccc';
  ctx.fillText(COORDS[row], cx + sz * 0.18, cy);
}

// ── Game ──────────────────────────────────────────────────────────────────────

class Game {
  constructor(canvas) {
    this.renderer = new Renderer(canvas);
    this.input = new Input();

    // Character pixel position (top-left of sprite)
    // Start near center of map
    this.charX = (MAP_COLS / 2) * TILE;
    this.charY = (MAP_ROWS / 2) * TILE;

    // Animation
    this.animFrame = 0;
    this.animTimer = 0;
    this.ANIM_INTERVAL = 1.0; // seconds per frame
    this.sprites = [null, null]; // loaded below
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

  _tick(dt) {
    const inp = this.input.held;
    const moving = inp.left || inp.right || inp.up || inp.down;

    // Movement
    if (inp.left)  this.charX -= MOVE_SPEED * dt;
    if (inp.right) this.charX += MOVE_SPEED * dt;
    if (inp.up)    this.charY -= MOVE_SPEED * dt;
    if (inp.down)  this.charY += MOVE_SPEED * dt;

    // Clamp to map bounds (keep sprite fully on map)
    this.charX = Math.max(0, Math.min(this.charX, (MAP_COLS - 1) * TILE));
    this.charY = Math.max(0, Math.min(this.charY, (MAP_ROWS - 1) * TILE));

    // Animate only when moving
    if (moving) {
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

    // Camera: character is centered on screen
    // camX/camY = pixel offset of top-left of viewport into the map
    const camX = this.charX + TILE / 2 - GAME_W / 2;
    const camY = this.charY + TILE / 2 - GAME_H / 2;

    // ── Background tiles ──
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

    // ── Sprite (between bg and fg — no fg yet) ──
    if (this.sprites[this.animFrame]?.complete) {
      r.drawSprite(this.sprites[this.animFrame], this.charX, this.charY, camX, camY);
    }
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const game = new Game(canvas);
  window._game = game;

  // Wire up d-pad buttons (portrait primary IDs)
  ['up', 'down', 'left', 'right'].forEach(dir => {
    const btn = document.getElementById(`btn-${dir}`);
    if (btn) game.input.bindButton(btn, dir);
  });

  game.start();
});
