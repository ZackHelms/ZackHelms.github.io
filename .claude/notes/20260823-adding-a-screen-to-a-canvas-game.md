# Adding a screen to a canvas game — three traps, and what each test method catches

From the 2026-08-23 Star Surge session, which inserted three new states
(`report`, `launch`, `station`) into a game that had four, then a second pass
that deleted `menu` and rewired the whole flow around the new hub
(`992a7bd`, `430b647`). Game-specific detail is in `.claude/star-surge.md`
§ Routing; this note is the part that transfers.

These games all share one shape — a module-level `state` string, one `update(dt)`
that early-returns off `'play'`, one `draw()` that paints by state, and one
persistent `#overlay` div for HTML screens. Every trap below comes from that
shape, so every one of them is waiting in the next game that adds a screen.

## What broke, and what found it

Six defects, all self-caught before shipping:

| Defect | Found by |
| --- | --- |
| Station 2× too large — hangar and drydock clipped off both edges | screenshot |
| Docked ship illegible behind the repair arms | screenshot |
| Play HUD bleeding through the report, captioned `SECTOR 4` on the sector-3 report | screenshot |
| Stage banner frozen in gold behind the SHIP DOWN overlay | screenshot |
| Shipyard return replayed the arrival crossfade, deadening taps for ~0.3 s | driving the flow headlessly |
| `endRun(true)` unreachable once a cleared sector routed to the report | reading, during the rewire |

A second pass on the same game (2026-08-24, the title screen) found the split
again and sharpened it: a screenshot of an *animating* scene is a sample of
size one, and the frame you catch is routinely the boring one — a dogfight read
as "completely broken, no ships visible" from a single shot when the ships were
fine and the shot had landed in a lull. Use `.claude/scripts/shot-strip.cjs`
(N frames, spaced, tiled into one image) for anything that moves on its own.

**Screenshots caught four of six.** Not one of those four would have failed any
test that existed. Budget a screenshot round per visual feature — but note
what the screenshots did *not* catch, below.

## Trap 1 — a countdown-driven visual freezes wherever it stops ticking

`stageBanner` decrements inside `update()`'s **play** branch. `draw()` painted
it whenever `stageBanner > 0`. Add a state where `update()` early-returns and
the last banner freezes at whatever value it held and paints forever — a gold
`STAGE 1 · WAVE 1` sat behind the SHIP DOWN overlay.

This predates the new screens: it was always reachable by dying just after a
banner. Adding states only made it constant instead of rare.

> **Rule.** Every timer-driven visual must either tick in all states that draw
> it, or be scoped to the states where it ticks. Prefer scoping — one
> `state === 'play'` guard on the draw is cheaper than auditing the ticker.

It is assertable without a screenshot, and cheaply, if the element has a
distinct hue. Star Surge's banner is gold on a blue/green scene, so hue alone
separates it from everything behind it:

```js
const goldInBand = () => {
  ctx.setTransform(1, 0, 0, 1, 0, 0); draw();
  const d = ctx.getImageData(0, Math.round(H * 0.33), W, 60).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4)
    if (d[i] > 200 && d[i + 1] > 140 && d[i + 2] < 120) n++;
  return n;
};
stageBanner = 5; state = 'play'; const inPlay = goldInBand();   // 563
state = 'over';                  const offPlay = goldInBand();  // 0, was 563
```

Count by **hue in a band**, not by brightness: a brightness threshold catches
the starfield and the check passes for the wrong reason.

## Trap 2 — a handler bound to the persistent overlay stacks per build

`#overlay` is one long-lived element that every HTML screen rewrites via
`innerHTML`. Binding a tap handler inside the screen *builder* therefore adds a
listener every time that screen is shown — eleven sector clears, eleven live
`beginLaunch` handlers, all firing on one tap.

> **Rule.** Bind overlay-level handlers **once**, at init, and scope them with a
> `state === '<screen>'` check. The state check doubles as the debounce, because
> the handler's own action moves the state on, so the trailing synthetic click
> after `touchend` is already a no-op.

Two details that matter for a full-screen tap target: `#overlay` has
`overflow-y:auto`, so treat >14 px of finger travel between `touchstart` and
`touchend` as a scroll rather than a tap; and `preventDefault()` on the
bubbled `touchend` is safe for child `<button>`s, which have handled it in the
target phase already.

## Trap 3 — a new terminal state orphans the old one

Routing a cleared sector to the new report made `endRun(true)` unreachable —
including the "you beat the campaign" branch, which had simply stopped
existing. Nothing failed; the dead branch sat there looking maintained.

> **Rule.** When you insert a terminal state into a flow, grep the old terminal
> for its call sites before you finish. A branch with zero callers is not
> harmless — the next reader will maintain it, and a test written against it
> passes forever without proving anything.

## Trap 4 — a cached bitmap that never re-bakes

Added 2026-08-24, from the title screen. A screen that bakes something
expensive into an offscreen bitmap (there: a logo spelled out of ~116
cel-shaded hulls) must key that cache on **everything the bake read**. Miss the
graphics style and a style switch repaints the whole screen around a logo that
is still in the old style, forever, with no error anywhere.

> **Rule.** Key a baked bitmap on `gfx` + derived size + `dpr`, and assert the
> key *differs* between styles. Two lines, and it catches the whole class:
>
> ```js
> gfx = 'toon'; const kT = buildTitleWord().key;
> gfx = 'neon'; const kN = buildTitleWord().key;   // kT !== kN
> ```

Bake-vs-paint-live, and how to measure which you need:
`.claude/notes/20260824-canvas-pseudo-3d-and-measuring-canvas-cost.md`.

## Canvas UI has no layout engine — so assert what a layout engine would

Buttons and callout lines drawn on canvas get no clipping, no overflow, no
collision detection. The first station was sized off a hub radius that let the
solar array reach `cx ± R*1.78`, which pushed two modules off a 390 px screen;
nothing complained.

Cheap assertions that would have caught it, all derived from `W`/`H`:

- every button rect is fully inside the viewport, and no two overlap;
- every feature a callout points at is fully on-screen;
- **the structural invariant, whatever it is for this layout** — Star Surge's is
  that left-column buttons point at left-hand features and right at right-hand
  ones, which is the entire reason no connector line crosses the station or
  another line. Re-pair one button and the picture is still "fine" to a
  screenshot reviewer who does not know the rule.

Derive every position from `W`/`H` in one layout function that both the
renderer and the hit-tester call. Two copies of the geometry is how a button
stops matching the thing it draws.

**Sweep viewports, don't assert one.** All of the above is cheap enough to run
at six or seven sizes — and it has to be, because there is no reflow: a title
sized off a column count and a row of bays sized off a viewport fraction can
collide at one aspect ratio and be perfectly fine at every other. Include at
least one landscape and one very narrow viewport, and **draw a real frame at
each** (a layout that computes fine can still throw in a painter):

```js
for (const [w, h] of [[320,568],[430,932],[768,1024],[844,390],[1024,600],[280,650]]) {
  await page.setViewportSize({ width: w, height: h });
  // ...recompute the layout, collect violations by name, then draw()
}
await page.setViewportSize({ width: 390, height: 844 });   // put it back
```

Collect violations as **named strings** (`'icon-above-bay'`, `'title-too-wide'`)
rather than a boolean per viewport: when it goes red you want to know which rule
broke at which size, not that something did.

## Save points: resume must not become undo-my-death

Star Surge's station became a real save point (`snapshotRun()` banks score,
hull, pip, shields and running totals; `restoreRun()` reads it back on pilot
select). The rule that makes it safe is an **asymmetry**:

> The snapshot is written wherever the player is idle **and** safe. It is
> cleared by exactly one event — the run ending. Nothing else clears it, and
> nothing clears it on the way *into* danger.

Resting resumes; dying does not. Get that backwards — clear on launch, or
write on death — and "resume" becomes either a lost run or an undo button.

One consequence worth deciding deliberately rather than discovering: because
the snapshot is not cleared on launch, quitting mid-sector rewinds to the last
safe point with the score intact. That is leniency, and it is the right default
for a phone game, but it is a choice — the alternative punishes a dropped
connection exactly like a death.

## Screenshots catch space; driving catches time

The four screenshot-caught defects were all **spatial** — wrong size, wrong
place, drawn on top of something. The one that no screenshot could catch was
**temporal**: `enterStation()` set `veil = 1` unconditionally, so returning
from the shipyard replayed the arrival crossfade, and since taps are ignored
while the veil is up the screen was dead for ~0.3 s. Every individual frame of
that is correct. Only walking the flow — tap upgrades, tap back, check `state`
and `veil` — shows it.

So run both, and know which is which: shoot the screen, then drive the
transitions with `page.evaluate` into the game's own functions. Reading the
code found only the dead branch, which is the one thing neither method sees.
