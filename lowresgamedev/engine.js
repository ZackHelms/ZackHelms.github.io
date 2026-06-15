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
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isPortrait = vw <= vh;
    const availW = isPortrait ? vw : vw - 160;
    const availH = isPortrait ? vh - 160 : vh;

    const scaleX = availW / GAME_W;
    const scaleY = availH / GAME_H;
    this.scale = Math.min(scaleX, scaleY);

    this.canvas.width  = Math.floor(GAME_W * this.scale);
    this.canvas.height = Math.floor(GAME_H * this.scale);
    this.ctx.imageSmoothingEnabled = false;
  }

  clear() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawTile(fn, tx, ty, camX, camY) {
    const sx = Math.round((tx * TILE - camX) * this.scale);
    const sy = Math.round((ty * TILE - camY) * this.scale);
    const sz = Math.round(TILE * this.scale);
    if (sx + sz < 0 || sy + sz < 0 ||
        sx > this.canvas.width || sy > this.canvas.height) return;
    fn(this.ctx, sx, sy, sz);
  }

  drawSprite(img, pixelX, pixelY, camX, camY) {
    const sx = Math.round((pixelX - camX) * this.scale);
    const sy = Math.round((pixelY - camY) * this.scale);
    const sz = Math.round(TILE * this.scale);
    this.ctx.drawImage(img, sx, sy, sz, sz);
  }
}

// ── Input ────────────────────────────────────────────────────────────────────
//
// Visual state is managed here via the .btn-active CSS class.
// Keyboard and touch are tracked separately so releasing one doesn't
// clear the other.

class Input {
  constructor() {
    this._kb    = { left: false, right: false, up: false, down: false };
    this._touch = { left: false, right: false, up: false, down: false };
    // Elements to visually activate per direction (populated by bindDpad)
    this._dirEls = { left: [], right: [], up: [], down: [] };
    this._bindKeys();
  }

  // Read-only composite: direction is active if keyboard OR touch holds it.
  get held() {
    const kb = this._kb, t = this._touch;
    return {
      left:  kb.left  || t.left,
      right: kb.right || t.right,
      up:    kb.up    || t.up,
      down:  kb.down  || t.down,
    };
  }

  _bindKeys() {
    const map = {
      ArrowLeft: 'left', ArrowRight: 'right',
      ArrowUp: 'up', ArrowDown: 'down',
      a: 'left', d: 'right', w: 'up', s: 'down',
    };
    window.addEventListener('keydown', e => {
      if (!map[e.key]) return;
      e.preventDefault();
      if (this._kb[map[e.key]]) return; // already held
      this._kb[map[e.key]] = true;
      this._refreshDirVisual(map[e.key]);
    });
    window.addEventListener('keyup', e => {
      if (!map[e.key]) return;
      this._kb[map[e.key]] = false;
      this._refreshDirVisual(map[e.key]);
    });
  }

  // Update visual state of all registered elements for a direction.
  _refreshDirVisual(dir) {
    const active = this._kb[dir] || this._touch[dir];
    for (const el of this._dirEls[dir]) {
      el.classList.toggle('btn-active', active);
    }
  }

  // Bind an element that has no game-state effect (Select/Start/A/B in v0.1).
  // Shows .btn-active + red outline on press via touch.
  bindVisual(el) {
    el.addEventListener('pointerdown',  () => el.classList.add('btn-active'));
    el.addEventListener('pointerup',    () => el.classList.remove('btn-active'));
    el.addEventListener('pointerleave', () => el.classList.remove('btn-active'));
    el.addEventListener('pointercancel',() => el.classList.remove('btn-active'));
  }

  // Bind a d-pad container. dirMap: { elementId -> direction }
  // One pointer is tracked; the active button follows the finger as it moves.
  bindDpad(containerEl, dirMap) {
    // Register each button element for keyboard visual feedback
    for (const [id, dir] of Object.entries(dirMap)) {
      const el = document.getElementById(id);
      if (el && !this._dirEls[dir].includes(el)) this._dirEls[dir].push(el);
    }

    // id→dir and dir→id lookups for this specific dpad
    const dirForId = dirMap;
    const idForDir = {};
    for (const [id, dir] of Object.entries(dirMap)) idForDir[dir] = id;

    let capturedPointerId = null;
    let activeDir = null; // direction currently pressed by touch on this dpad

    const setTouchDir = (newDir) => {
      if (newDir === activeDir) return;

      // Clear previous
      if (activeDir) {
        this._touch[activeDir] = false;
        // Visual: only show red if keyboard still holds it
        const prevEl = document.getElementById(idForDir[activeDir]);
        if (prevEl) prevEl.classList.toggle('btn-active', this._kb[activeDir]);
      }

      activeDir = newDir;

      // Activate new
      if (newDir) {
        this._touch[newDir] = true;
        const nextEl = document.getElementById(idForDir[newDir]);
        if (nextEl) nextEl.classList.add('btn-active');
      }
    };

    const update = (e) => {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      setTouchDir((target && target.id in dirForId) ? dirForId[target.id] : null);
    };

    containerEl.addEventListener('pointerdown', (e) => {
      if (capturedPointerId !== null) return;
      capturedPointerId = e.pointerId;
      containerEl.setPointerCapture(e.pointerId);
      update(e);
    });

    containerEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== capturedPointerId) return;
      update(e);
    });

    const release = (e) => {
      if (e.pointerId !== capturedPointerId) return;
      capturedPointerId = null;
      setTouchDir(null);
    };

    containerEl.addEventListener('pointerup',     release);
    containerEl.addEventListener('pointercancel', release);
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
