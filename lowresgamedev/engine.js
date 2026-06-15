// engine.js — renderer, input, animation loop

const GAME_W = 160;
const GAME_H = 144;
const TILE = 16;

// ── Renderer ────────────────────────────────────────────────────────────────

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Compute available area (leave room for controls below/beside)
    // Controls height in portrait; controls width in landscape handled in CSS
    const isPortrait = vw <= vh;
    const availW = isPortrait ? vw : vw - 160;  // 160px for side controls
    const availH = isPortrait ? vh - 160 : vh;  // 160px for bottom controls

    const scaleX = availW / GAME_W;
    const scaleY = availH / GAME_H;
    this.scale = Math.min(scaleX, scaleY);

    const drawW = Math.floor(GAME_W * this.scale);
    const drawH = Math.floor(GAME_H * this.scale);

    this.canvas.width = drawW;
    this.canvas.height = drawH;
    this.ctx.imageSmoothingEnabled = false;
  }

  clear() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Draw a tile-layer item at tile coords (tx, ty) with pixel offset (camX, camY)
  drawTile(imageOrFn, tx, ty, camX, camY) {
    const sx = Math.round((tx * TILE - camX) * this.scale);
    const sy = Math.round((ty * TILE - camY) * this.scale);
    const sz = Math.round(TILE * this.scale);
    if (sx + sz < 0 || sy + sz < 0 ||
        sx > this.canvas.width || sy > this.canvas.height) return;
    if (typeof imageOrFn === 'function') {
      imageOrFn(this.ctx, sx, sy, sz);
    } else {
      this.ctx.drawImage(imageOrFn, sx, sy, sz, sz);
    }
  }

  drawSprite(img, pixelX, pixelY, camX, camY) {
    const sx = Math.round((pixelX - camX) * this.scale);
    const sy = Math.round((pixelY - camY) * this.scale);
    const sz = Math.round(TILE * this.scale);
    this.ctx.drawImage(img, sx, sy, sz, sz);
  }
}

// ── Input ────────────────────────────────────────────────────────────────────

class Input {
  constructor() {
    this.held = { left: false, right: false, up: false, down: false };
    this._bindKeys();
  }

  _bindKeys() {
    const map = {
      ArrowLeft: 'left', ArrowRight: 'right',
      ArrowUp: 'up', ArrowDown: 'down',
      a: 'left', d: 'right', w: 'up', s: 'down',
    };
    window.addEventListener('keydown', e => {
      if (map[e.key]) { this.held[map[e.key]] = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', e => {
      if (map[e.key]) this.held[map[e.key]] = false;
    });
  }

  bindButton(el, dir) {
    const start = () => { this.held[dir] = true; };
    const stop  = () => { this.held[dir] = false; };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup',   stop);
    el.addEventListener('pointerleave', stop);
    el.addEventListener('pointercancel', stop);
  }
}

// ── Animation loop ───────────────────────────────────────────────────────────

class Loop {
  constructor(updateFn) {
    this._update = updateFn;
    this._last = null;
    this._raf = null;
  }

  start() {
    const tick = (ts) => {
      const dt = this._last === null ? 0 : (ts - this._last) / 1000;
      this._last = ts;
      this._update(dt);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() { cancelAnimationFrame(this._raf); }
}
