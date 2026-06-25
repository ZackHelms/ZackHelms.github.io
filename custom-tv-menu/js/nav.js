// nav.js — spatial ("D-pad") focus engine for TV remote + keyboard, alongside mouse.
//
// Any element with [data-focusable] participates. Arrow keys move focus to the nearest
// focusable in that direction; Enter activates (click); Escape/Backspace fires onBack.
// The focused element gets the .focused class (CSS draws the pulsing highlight).
//
// Performance: focusables are queried lazily per keypress (cheap for these list sizes)
// and the nearest-neighbour search is a single pass over visible rects. Movement only
// toggles a class + calls scrollIntoView — no layout-thrashing animations in JS.

const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'enter', ' ': 'enter',
  Escape: 'back', Backspace: 'back',
  // Common TV-remote remaps (browsers on some boxes emit these):
  MediaPlayPause: 'enter', GoBack: 'back',
};

let current = null;        // currently focused element
let backHandler = null;    // optional onBack callback set by the router

function focusables() {
  return [...document.querySelectorAll('[data-focusable]')]
    .filter(el => el.offsetParent !== null && !el.hasAttribute('disabled'));
}

function rectOf(el) {
  const r = el.getBoundingClientRect();
  return { el, cx: r.left + r.width / 2, cy: r.top + r.height / 2, r };
}

export function setFocus(el, { scroll = true } = {}) {
  if (current === el) return;
  if (current) current.classList.remove('focused');
  current = el || null;
  if (current) {
    current.classList.add('focused');
    if (scroll) current.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
}

export function getFocus() { return current; }

// Pick the first focusable (top-most, then left-most) — used after navigating views.
export function focusFirst() {
  const list = focusables().map(rectOf).sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
  setFocus(list.length ? list[0].el : null, { scroll: false });
}

export function setBackHandler(fn) { backHandler = fn; }

function move(dir) {
  const items = focusables();
  if (!items.length) return;
  if (!current || !current.isConnected) { focusFirst(); return; }

  const from = rectOf(current);
  let best = null, bestScore = Infinity;

  for (const item of items) {
    if (item === current) continue;
    const t = rectOf(item);
    const dx = t.cx - from.cx, dy = t.cy - from.cy;

    // Must lie in the requested direction.
    let primary, cross;
    if (dir === 'up')         { if (dy >= -1) continue; primary = -dy; cross = Math.abs(dx); }
    else if (dir === 'down')  { if (dy <= 1)  continue; primary = dy;  cross = Math.abs(dx); }
    else if (dir === 'left')  { if (dx >= -1) continue; primary = -dx; cross = Math.abs(dy); }
    else /* right */          { if (dx <= 1)  continue; primary = dx;  cross = Math.abs(dy); }

    // Prefer aligned items: cross-axis offset is weighted heavily.
    const score = primary + cross * 2;
    if (score < bestScore) { bestScore = score; best = item; }
  }

  if (best) setFocus(best);
}

function onKeyDown(e) {
  const action = KEYMAP[e.key];
  if (!action) return;
  e.preventDefault();

  if (action === 'enter') {
    if (current) current.click();
    return;
  }
  if (action === 'back') {
    if (backHandler) backHandler();
    return;
  }
  move(action);
}

// Mouse: hovering/clicking a focusable also moves the logical focus so the two
// input modes stay in sync.
function onPointerOver(e) {
  const el = e.target.closest('[data-focusable]');
  if (el) setFocus(el, { scroll: false });
}

export function initNav() {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerover', onPointerOver);
}
