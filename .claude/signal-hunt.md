# Signal Hunt — architecture notes

`games/signal-hunt/index.html` (~790 lines). Pan-and-pinch hidden-object
search over a scrollable circuit grid. **The repo's first async-versus game.**

## The idea

Eight rogue signals hide among ~350 decoys on a 1100 × 1900 world. Each target
is an exact **shape + colour** pair; every decoy shares one attribute but never
both. That's a *conjunction search* — the one visual-search task that provably
cannot be done in parallel by the visual system, so it scales in difficulty
without needing clutter. 90 seconds, 8 targets, decoy taps cost 4 s.

## Async versus (the new session shape)

A round is fully determined by its seed, so a score is only meaningful with the
grid attached. Both travel in an 11-character code:

```
6 chars seed (base36) + 4 chars score (base36) + 1 checksum char
```

`makeCode(seed, score)` / `parseCode(txt)`. Parse strips every non-alphanumeric
character and upper-cases, so a code survives being retyped out of a text
message; the checksum rejects a typo instead of silently loading a wrong grid.
`shareURL(code)` appends `#h=<code>`; CHALLENGE A FRIEND uses `navigator.share`
when present, else clipboard.

**`SEED_MAX = 36^6` is load-bearing.** Seeds are generated and reduced modulo
it everywhere (`startRound`, `dailySeed`). The drive caught the original code
`.slice(-6)`-ing a full 32-bit seed, which meant roughly half of all free-hunt
duels would have handed the rival a *different grid* — the feature would have
looked like it worked and silently lied.

`hashchange` is wired as well as boot-time parse: tapping a challenge link
while the page is already open is a same-document fragment navigation, so
nothing reloads and a boot-only read never sees the new code.

Verdicts recorded in `save.cw` / `save.cl`. Also DAILY GRID (UTC-date FNV seed)
and FREE HUNT.

## World generation

`genWorld(seed)` — jittered grid placement (`CELL` 58, `JIT` 16, 38% of cells
skipped to break the lattice), ~350 nodes.

- **Targets**: one per world block (2 cols × 4 rows) so they can never cluster;
  8 distinct (glyph, colour) combos drawn from the 48.
- **Decoys**: 84% drawn from the `near` set (shares glyph *or* colour with some
  target, but is not a target combo), rest from `other`. No decoy ever wears a
  target's exact combo, so **each target combo appears exactly once in the
  world** — the drive asserts this per seed. Measured confusion set: 81–84%.
- Dressing: L-bend traces between nearby nodes, translucent substrate pads.

## Rendering + performance

Nodes are **pre-rendered sprites** — 48 combos × 2 (plain and letter-stamped) at
72 px, blitted with `drawImage` at the zoomed size. Everything is viewport-
culled. Measured 320 nodes on screen at max zoom-out, ~8 ms/frame (drive gate:
under the 16.7 ms 60 fps budget).

Traces are batched into two paths by line weight rather than stroked per
segment.

## Input

`ptrs` Map keyed by touch identifier.

- 1 finger drag → pan. Movement > 12 px cancels the pending tap.
- 2 fingers → pinch zoom about the anchor midpoint, and pan with the midpoint.
- tap (< 12 px, < 600 ms) → hit test nodes with a **screen-space** grab radius
  (`18/cam.z`) so the target is finger-sized at every zoom.
- Tapping empty grid is free — no penalty, no sound. Only tapping an actual
  decoy costs time. This matters a lot for feel.

`ZMIN` 0.42 fits the world's full height but not its width, so max zoom-out is
a real coarse-scan strategy rather than a way to see everything at once.

## Accessibility

Green/amber is the CVD-inseparable pair, and six hues can't all be separated.
So colour is available as a **second channel**: LABELS: ON stamps each colour's
unique initial (G/A/B/R/V/C) on every node, turning the hunt into a
shape + letter conjunction — identical difficulty, no colour required. Dock
chips always print the colour name, and tapping a chip prints
`SHAPE · COLOUR` above the dock.

## HUD

Top bar (opaque — grid nodes read through a translucent one), 8-chip WANTED
dock in 2 rows of 4, minimap showing the viewport rect and *found* targets only
(unfound ones would spoil the hunt; they appear at end of round). A purple
rival-progress bar tracks your score against the duel target.

Both the dock height and the HUD top are **measured from `env(safe-area-inset-*)`
via zero-width probe divs** (`#sa-top` / `#sa-bot`) — a canvas HUD can't read
`env()` itself, and without it the dock's bottom chip row lands under the
iPhone home indicator.

## Persistence

`signalHunt` → `{best, daily:{d,score,found}, cw, cl}`. Plus
`signal-hunt-mute`, `signal-hunt-labels`.

## Gotchas for future work

- `endRound` is state-guarded (reachable from a tap and from the timer in the
  same frame) and captures everything the overlay needs at schedule time.
- On a loss the camera pulls back to `ZMIN` and the overlay is delayed to
  1.9 s so the missed targets actually get seen pulsing.
- `dockRects` is cleared in `toMenu()` — stale canvas hitboxes are a known
  repo bug class (2026-07-24 grid-defense).
- `applyMute()` sets the icon before the `if(!AC) return` guard; see the same
  note in `.claude/sky-lantern.md`.
