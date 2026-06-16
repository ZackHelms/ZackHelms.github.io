// engine.js — renderer, input, animation loop

const GAME_W = 160;
const GAME_H = 144;
const TILE = 16;

// ── Renderer ─────────────────────────────────────────────────────────────────

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.scale = 1;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => this._onOrientationChange());
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this._resize());
    }
  }

  // iOS Safari: position:fixed elements whose display changes via CSS media query on
  // orientation change get stale compositing-layer hit regions. A temporary transform
  // on the fixed overlay forces the GPU layer to rebuild, fixing tap-target alignment.
  _onOrientationChange() {
    setTimeout(() => {
      const el = document.getElementById('controls-landscape');
      if (el) {
        el.style.transform = 'translateZ(0)';
        requestAnimationFrame(() => {
          el.style.transform = '';
          this._resize();
        });
      } else {
        this._resize();
      }
    }, 100);
  }

  _resize() {
    const vv = window.visualViewport;
    const vw = vv ? vv.width  : window.innerWidth;
    const vh = vv ? vv.height : window.innerHeight;
    // screen.orientation.angle updates atomically on rotation (before innerWidth/Height
    // settle in iOS PWA mode), preventing stale-dimension misdetection.
    const angle = window.screen?.orientation?.angle;
    const isPortrait = angle !== undefined ? (angle % 180 === 0) : (vw <= vh);

    let availW, availH;
    if (isPortrait) {
      const ctrlEl = document.getElementById('controls');
      const ctrlH = ctrlEl ? ctrlEl.offsetHeight : 220;
      const marginTop = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--portrait-margin-top')
      ) || 8;
      availW = vw;
      availH = vh - ctrlH - marginTop;
    } else {
      // side-left: 140px, side-right: 150px
      availW = vw - 140 - 150;
      availH = vh;
    }

    // Subtract game screen margin (the #screen-frame padding on each side)
    const margin = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--game-screen-margin')
    ) || 0;
    availW = Math.max(0, availW - margin * 2);
    availH = Math.max(0, availH - margin * 2);

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

  drawSprite(img, pixelX, pixelY, camX, camY, mirrorX = false) {
    const sx = Math.round((pixelX - camX) * this.scale);
    const sy = Math.round((pixelY - camY) * this.scale);
    const sz = Math.round(TILE * this.scale);
    if (mirrorX) {
      this.ctx.save();
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(img, -(sx + sz), sy, sz, sz);
      this.ctx.restore();
    } else {
      this.ctx.drawImage(img, sx, sy, sz, sz);
    }
  }
}

// ── Input ─────────────────────────────────────────────────────────────────────
//
// Unified pointer tracking: any active pointer that slides over a registered
// button activates it; sliding away deactivates it. Works from anywhere on
// screen — no need to start the touch on the button itself. Multiple simultaneous
// pointers are fully supported so all buttons can be held at once. D-pad opposing
// directions (left/right, up/down) cancel each other in `held`.

class Input {
  constructor() {
    this._kb          = {};        // direction -> bool (keyboard state)
    this._touchCounts = {};        // action -> int (pointers currently holding it)
    this._elemCounts  = {};        // elementId -> int (pointers currently on it)
    this._btnRegistry = {};        // elementId -> { el, action, onEnter, onLeave }
    this._pointers    = new Map(); // pointerId -> current elementId (or null)
    this._bindKeys();
    this._bindGlobalTouch();
  }

  // Register a button element. action is a logical name ('left', 'a', …) or null
  // for utility buttons. onEnter fires when a pointer first lands on the button.
  register(el, action = null, { onEnter, onLeave } = {}) {
    this._btnRegistry[el.id] = { el, action, onEnter, onLeave };
    if (action !== null && !(action in this._touchCounts)) this._touchCounts[action] = 0;
    this._elemCounts[el.id] = 0;
  }

  // Composite held state: keyboard OR touch. D-pad opposing directions cancel.
  get held() {
    const t  = this._touchCounts;
    const kb = this._kb;
    return {
      left:   (kb.left  || false) || ((t.left  > 0) && !(t.right > 0)),
      right:  (kb.right || false) || ((t.right > 0) && !(t.left  > 0)),
      up:     (kb.up    || false) || ((t.up    > 0) && !(t.down  > 0)),
      down:   (kb.down  || false) || ((t.down  > 0) && !(t.up    > 0)),
      a:      (t.a      || 0) > 0,
      b:      (t.b      || 0) > 0,
      select: (t.select || 0) > 0,
      start:  (t.start  || 0) > 0,
    };
  }

  clearAll() {
    this._kb = {};
    for (const action of Object.keys(this._touchCounts)) this._touchCounts[action] = 0;
    for (const id     of Object.keys(this._elemCounts))  this._elemCounts[id]      = 0;
    this._pointers.clear();
    for (const id of Object.keys(this._btnRegistry)) this._refreshEl(id);
  }

  _refreshEl(id) {
    const reg = this._btnRegistry[id];
    if (!reg) return;
    const touchOn = (this._elemCounts[id] || 0) > 0;
    const kbOn    = reg.action ? (this._kb[reg.action] || false) : false;
    reg.el.classList.toggle('btn-active', touchOn || kbOn);
  }

  _refreshAction(action) {
    for (const id of Object.keys(this._btnRegistry)) {
      if (this._btnRegistry[id].action === action) this._refreshEl(id);
    }
  }

  _idAt(cx, cy) {
    // On mobile, pointer clientX/Y are visual-viewport-relative while elementFromPoint
    // may use layout-viewport coordinates; visualViewport.offset corrects the delta.
    const vv = window.visualViewport;
    const x = cx + (vv?.offsetLeft ?? 0);
    const y = cy + (vv?.offsetTop  ?? 0);
    const el = document.elementFromPoint(x, y);
    return (el?.id && el.id in this._btnRegistry) ? el.id : null;
  }

  _activate(pointerId, newId) {
    const oldId = this._pointers.get(pointerId) ?? null;
    if (oldId === newId) return;

    if (oldId !== null) {
      const reg = this._btnRegistry[oldId];
      if (reg) {
        reg.onLeave?.();
        if (reg.action !== null) this._touchCounts[reg.action]--;
        this._elemCounts[oldId]--;
        this._refreshEl(oldId);
      }
    }

    this._pointers.set(pointerId, newId);

    if (newId !== null) {
      const reg = this._btnRegistry[newId];
      if (reg) {
        reg.onEnter?.();
        if (reg.action !== null) this._touchCounts[reg.action]++;
        this._elemCounts[newId]++;
        this._refreshEl(newId);
      }
    }
  }

  _bindGlobalTouch() {
    document.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._pointers.set(e.pointerId, null);
      this._activate(e.pointerId, this._idAt(e.clientX, e.clientY));
    });

    document.addEventListener('pointermove', (e) => {
      if (!this._pointers.has(e.pointerId)) return;
      this._activate(e.pointerId, this._idAt(e.clientX, e.clientY));
    });

    const release = (e) => {
      if (!this._pointers.has(e.pointerId)) return;
      this._activate(e.pointerId, null);
      this._pointers.delete(e.pointerId);
    };
    document.addEventListener('pointerup',     release);
    document.addEventListener('pointercancel', release);
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
      const dir = map[e.key];
      if (this._kb[dir]) return;
      this._kb[dir] = true;
      this._refreshAction(dir);
    });
    window.addEventListener('keyup', e => {
      if (!map[e.key]) return;
      const dir = map[e.key];
      this._kb[dir] = false;
      this._refreshAction(dir);
    });
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
