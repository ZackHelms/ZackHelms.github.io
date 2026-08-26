# Pinch-zoom on a canvas board, and driving multi-touch headlessly

Written 2026-08-25 adding zoom + a settings panel to `games/ember-depths/`.
The game-specific outcome lives in `.claude/ember-depths.md`; this note is the
**technique**, which is reusable by any game here that wants a zoomable board.

Related: `.claude/notes/20260724-headless-mobile-game-testing.md` is the general
harness note — its "Touch drags" bullet covers *single*-finger drags via
`new Touch()` inside `page.evaluate` and does not cover multi-touch. § 4 below
is the missing half. (Worth folding into that note; left here because the
2026-08-25 refine pass was scoped to Ember Depths.)

---

## 1. Retrofit zoom by making the existing offsets derived, not by adding a transform

The tempting move is `ctx.scale()` / `setTransform` around the world draw. Do
not: this repo's games hit-test taps by inverting the same `ox`/`oy`/`tile`
they draw with, and a transform splits that into two sources of truth that
drift. Ember Depths' renderer already funnelled every world coordinate through
`cellPx(x,y) = [ox + x*tile, oy + y*tile]`, so the whole retrofit was **making
those three variables derived** and changing nothing else:

```
baseTile  = the whole-board fit resize() already computed
tile      = baseTile * zoom
camX/camY = the world point held at the centre of the board viewport
ox/oy     = viewX + viewW/2 - camX*tile   (then clamped, see §2)
```

Renderer untouched, hit-test untouched, light map untouched — `handleTap`
inherits zoom for free because it was already reading `ox`/`tile`. If a game
does **not** already have a single `cellPx`-style funnel, give it one first;
that refactor is smaller and safer than a transform.

**Ordering trap:** `applyView()` reads the view rect that `resize()` computes,
and `centerCam()` reads `player`. Ember Depths calls `genFloor(1)` at the very
bottom of the script, after `resize()`, so both are initialised. A future edit
that hoists `genFloor(1)` above `resize()` gets a camera clamped against a
zero-size viewport, and the board renders off-screen with no error.

## 2. Clamp the camera, and let the clamp *be* the zoom-1 case

One `applyView()` handles both, with no `if (zoom === 1)` branch anywhere:

- board **smaller** than the viewport on an axis → centre that axis outright;
- board **larger** → clamp the focus point to
  `[viewW/2/tile, COLS - viewW/2/tile]`, which is exactly "an edge of the board
  may reach an edge of the viewport, never pass it".

Zoom 1 is the smaller-than case on both axes by construction (`baseTile` is the
fit), so **zoom 1 reproduces the original layout for free** — worth asserting,
because it means the whole feature is provably invisible until used.

Set `MIN_ZOOM = 1` (the fit). Below the fit there is nothing to reveal but
margin, and a board that can shrink to a postage stamp reads as a bug.

Anchor a pinch by pinning the world point under the midpoint:

```js
const wx = (sx - ox) / tile;        // before changing tile
tile = baseTile * (zoom = nz);
camX = wx + (viewX + viewW/2 - sx) / tile;   // solves ox' = sx - wx*tile
```

## 3. Three gestures on one canvas, and the latch that keeps them apart

`tap` / `drag-pan` / `pinch` share the surface, and the failure everyone ships
first is a pinch or a drag ending in a **stray tap** — on this game that means
the player walks somewhere they never asked to go.

- 1 finger under `TAP_SLOP` (14 px) → tap
- 1 finger over slop → pan, **only while zoomed in** (at the fit there is
  nothing to pan, so a long drag stays a cancelled tap)
- 2 fingers → zoom + pan at the midpoint

The fix is a **latch, not a check**: `gestured` is set the moment a pinch or a
drag begins and is cleared only when the *last* finger lifts. Checking
"were there 2 touches at touchend?" fails, because by then there is one.
Handle the two-to-one transition explicitly (hand the drag to the survivor,
keep the latch set) or lifting one finger of a pinch taps.

### Keeping the gesture off the *page*

`user-scalable=no` in the viewport meta is not enough on iOS. The full stack:

- `touch-action:none` on the canvas, and `preventDefault()` in **every** canvas
  touch handler including `touchmove` (which this game did not previously have
  — with no `touchmove` listener there is nothing to prevent);
- `document`-level `gesturestart` / `gesturechange` / `gestureend` →
  `preventDefault` (Safari's own pinch events, which fire independently of
  touch handlers);
- a `document`-level `touchmove` guard that preventDefaults whenever
  `ev.touches.length > 1`, so a pinch started over a DOM overlay is dead too.

Assert it rather than believing it: after a synthetic two-finger spread,
`window.visualViewport.scale` must still be 1 and `scrollX/scrollY` must be 0.

## 4. Driving a real pinch in headless Chromium (CDP)

Playwright has no pinch API and `page.touchscreen` only taps. Building a
consistent multi-touch sequence with `new Touch()` in `page.evaluate` means
hand-maintaining `touches` / `changedTouches` / `targetTouches` across every
event — easy to get subtly wrong in a way that makes the *test* the thing under
test. Use CDP instead; the browser tracks the points for you:

```js
const cdp = await context.newCDPSession(page);
const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
  type,                                    // touchStart | touchMove | touchEnd
  touchPoints: pts.map(p => ({ x: p[0], y: p[1], id: p[2],
                               radiusX: 12, radiusY: 12, force: 1 })),
});

await T('touchStart', [[cx - 40, cy, 1], [cx + 40, cy, 2]]);
for (let i = 1; i <= 8; i++) {                       // spread
  await T('touchMove', [[cx - 40 - i*14, cy, 1], [cx + 40 + i*14, cy, 2]]);
  await page.waitForTimeout(16);
}
await T('touchEnd', [[cx + 152, cy, 2]]);            // one finger up…
await T('touchEnd', []);                             // …then the other
```

Notes that cost time:

- `touchPoints` is the **current** set, not a delta: for `touchEnd` pass the
  points that are *still down*, and `[]` for the last lift.
- Stable `id`s per finger across the whole sequence, or the page sees fingers
  teleporting.
- The context needs `hasTouch: true`; `devices['iPhone 13']` supplies it.
- This is also the cleanest way to test the two-to-one transition in § 3, which
  is where the stray-tap bug actually lives.

The assertions that earn their place are the **negative** ones: after a pinch,
and after a drag, the player must not have moved and `pathQueue` must be empty
— while a short tap in the same run still moves them.

## 5. Two traps this session actually hit

### The camera eases every frame, so act and read in ONE `page.evaluate`

`followCam` runs on the next rAF after any camera change. A check that does
`evaluate(() => panBy(9999, 9999))` and then reads `ox` in a **second**
`evaluate` measures the follow, not the pan. Three checks failed this way — the
clamp and pinch-anchor code was right and the test was wrong. Anything driven
by an eased/rAF-updated value has this shape; do the action and the read in the
same round trip.

### A property that held by accident of the fit is not an invariant

The renderer had no viewport concept: "the board stays inside the play area"
was true only because the board was always sized to fit. Zoom made it false and
the dungeon rendered up behind the HUD text.

**Rejected fix — `ctx.clip()` to the view rect.** Two problems. (a) The world
draw sits inside a `save()/translate(shake)` block, so a clip applied after the
translate shakes with the content, and applied before it can shave a pixel off
the outermost column (the board is 385 px in a 390 px viewport and shake is
±3.5 px). (b) It only covers the world layer — the half-res light map, the
additive glow and the vignette are all painted full-screen *outside* that
block, so the strips would still light up.

**Shipped fix — mask after drawing, before the vignette.** Fill the strips
outside the view rect with the background colour once the light map and glow
are down but before the vignette, so those strips darken exactly as the
(already-empty) strips do at zoom 1. One rect per side, no interaction with
shake, and it covers every layer by construction.

## 6. Chrome z-index: the *whole* row, not just the new button

`games/CLAUDE.md` § Chrome above overlays requires ← and 🔊 to outrank every
full-screen overlay. A settings **scrim** is a full-screen overlay, and it is
easy to raise only the cogwheel above it (the cog needs it to stay a toggle)
and leave ← and mute buried — which is how this shipped for one commit. Ember
Depths now puts all three at z 45 over a z-40 scrim; `neon-clash` does the same
with `#hud-left` at z 80 over `#ov-settings` at 78.

Cheap check, worth copying: for each overlay the game can raise, walk the
chrome buttons and assert `document.elementFromPoint(centre)` returns that
button's own id.
