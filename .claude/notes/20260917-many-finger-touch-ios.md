# Many-finger touch on iOS, and how to test it headlessly (2026-09-17)

From the CD's music-mixer playtest: *"I can press five fingers down, but if I
try a sixth it fails and results in nothing being held, like it cancels all my
current gestures."* Their reading was exactly right — Safari **was** cancelling
them. Three causes, and the fix is to stop using Pointer events for fingers.

The one-line rule is now `games/CLAUDE.md` § Many-finger input. This is the
trace and the test method.

## Cause 1 — `preventDefault()` on `pointerdown` does nothing on iOS

Safari **derives** pointer events from touch events. Preventing the pointer
event's default never reaches the gesture recognizer underneath. Only a
**non-passive** `touchstart`/`touchmove` listener does. Left unprevented, the
recognizer eventually decides a many-finger touch might be a system gesture and
fires `pointercancel` **for the fingers already down** — the sixth finger does
not fail on its own, it takes the other five with it.

`touch-action:none` is necessary but not sufficient, and it has to be on
whichever element the listeners are actually bound to, not just the visual one
(the listeners moved from `#grid` to `#stage` so the margins around the grid
refuse scrolling too).

## Cause 2 — a `blur` handler that cleared input state

`window.addEventListener('blur', releaseEverything)` looks obviously correct
and is the second half of the bug: Safari can blur the window for an instant
while it makes that same decision, so the handler drops the grip. **Fingers are
released by `touchend`/`touchcancel`, which are reliable.** Blur should release
only keys and the mouse — a key genuinely cannot be held across a focus change,
a finger genuinely can.

## Cause 3 — the state was accumulated instead of recomputed

The architectural half, and the one that makes the other two survivable. A
`Map` keyed by `pointerId` and maintained incrementally **never recovers** from
one missed or extra event: it stays wrong until every finger lifts.

`e.touches` is the authoritative list of every finger on the glass on *every*
touch event — including `touchend` and `touchcancel`, where it carries the
fingers that **remain**. Rebuild the whole held set from it each time and the
state is self-healing: one cancelled finger costs exactly one finger, and no
sequence of dropped or duplicated events can desync it.

```js
function fromTouches(list) {
  touchOn.fill(false);
  for (let t = 0; t < list.length; t++)
    for (const i of hitsAt(list[t].clientX, list[t].clientY)) touchOn[i] = true;
  recompute();
}
```

Keep a pointer path for **mouse and pen only**, gated on
`e.pointerType === 'touch'` *and* on `TouchEvent` actually existing — that way
the two can never double-count, and a browser with no touch events still works.

## The related trap: edges vs levels, and programmatic releases

The tap-to-lock toggle added the day after needs press/lift **edges**, not
levels (in lock mode a press toggles the lock; in hold mode a lift clears one),
which means a `contactPrev[]` array. That immediately creates a second version
of the blur bug: a **programmatic** release — going to the background — looks
exactly like the player lifting a finger, and would silently clear a lock they
set. Hence `recompute(noLatch)`, which still updates `contactPrev` but skips
the edge handling. Any input layer that derives actions from transitions needs
this distinction between a user release and a state reset.

## Testing it headlessly

Synthetic `PointerEvent`s **cannot see any of this** — that was the original
test and it passed at fifteen pads while the game was broken on a phone. Use
CDP.

```js
const page = await browser.newPage({ viewport: {...}, hasTouch: true });
const cdp = await page.context().newCDPSession(page);
// Chromium DIFFS touchPoints against the previous call and synthesizes the
// per-finger events, so pass the FULL active set each time.
const setTouches = (pts) => cdp.send('Input.dispatchTouchEvent', {
  type: pts.length ? 'touchStart' : 'touchEnd',
  touchPoints: pts.map((p, i) => ({ x: Math.round(p.x), y: Math.round(p.y), id: i + 1 })),
});
```

Three assertions earn their Chromium launch:

1. **A ladder.** Add fingers one at a time and require the held count to climb
   and never fall (measured `2 3 4 5 9 11 13 15`). A single end-state check at
   eight fingers passes on code that cancels at six and re-acquires.
2. **A partial cancel.** CDP's `touchCancel` cancels everything, so build the
   one-finger case in-page with the `Touch` constructor — `touches` listing the
   seven that remain, `changedTouches` the one that went:
   ```js
   window.dispatchEvent(new TouchEvent('touchcancel',
     { touches: keep, targetTouches: keep, changedTouches: [gone], bubbles: true }));
   ```
3. **A blur.** Dispatch `new Event('blur')` with the grip down and require it
   still held.

Derive every touch point from the **live element rectangles** rather than
numbers read off a screenshot, so the test follows a layout change.

**Negative-test the regression checks.** Restoring the old blur handler makes
check 3 fail with *"dropped the grip from 15 pads to 0"* — the CD's symptom
verbatim. A regression check nobody has seen fail is a guess.

## What no page can fix

On **iPadOS**, four- and five-finger swipes and the five-finger pinch are
system gestures above the browser; they will take the touches whatever the page
does, until multitasking gestures are turned off in Settings. iPhone has no
such gesture, so on a phone the fixes above are the whole story. Say this to
the CD rather than chasing it in code.

## Bonus: a pointer is a contact patch

Worth stealing independently of the bug. Holding **every** pad whose rect a
pointer reaches within a tolerance (default 12 px, exposed as a slider) is what
lets one fingertip laid across a seam hold two pads, one on a four-pad crossing
hold four, and eight fingers hold fifteen. It is the difference between a grid
of buttons and an instrument — and it is the first thing a later session will
try to "fix" into a point test, so assert the grips by number.
