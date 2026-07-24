# Neon Air Hockey — Context (`games/air-hockey/index.html`)

Vs-AI physics air hockey on a portrait vertical table. Drag anywhere to move
your mallet (it rides `FINGER_OFF` 6u above the finger so the thumb never
hides it); smack the puck into the top goal, defend the bottom one; first to
7 wins. Three AI difficulties (ROOKIE / PRO / LEGEND) picked on the start
overlay, per-difficulty W–L record persisted. Single self-contained file.

## Unit space & physics

- **Unit space**: table 100 wide × 160 tall (`UW`/`UH`), y grows downward,
  `CENTER` 80. Letterboxed to the canvas (`scale = min(w/100, h/160)`,
  `ox/oy` centering) — portrait fills, landscape letterboxes to height.
  **`#game` needs `min-height:0`** — without it the canvas's default 300×150
  intrinsic aspect ratio sets a flex min-content height of `width/2` and the
  table overflows the viewport in landscape (found via screenshot, not the
  fit assertion — see traps).
- Geometry: mallets r `MAL_R` 7, puck r `PUCK_R` 4.5, goal mouths `GOAL_W` 34
  centered top/bottom (x 33–67), post circles r `POST_R` 1.2 at the mouth
  corners, rounded corners as arc circles `CORNER_R` 13.
- Fixed substeps at `PHYS_HZ` 240 (`n = round(dt*240)`, dt capped 0.1 s).
  Per-substep max puck travel = 220/240 ≈ 0.92u ≪ any collision radius, so
  overlap resolution alone is tunnel-proof.
- Puck: linear damping `PUCK_DAMP` 0.18/s, wall restitution `WALL_E` 0.92,
  mallet restitution `MAL_E` 0.88, **hard speed cap `PUCK_VMAX` 220 u/s**
  (re-capped after every mallet impulse).
- Collision order per substep: move mallets → damp/cap/integrate puck →
  walls → player mallet → AI mallet → walls again (re-resolve squeezes) →
  cap → goal check. Walls = side clamps, top/bottom clamps *outside* the
  mouth x-band, post circles inside it, corner arcs (push to
  `CORNER_R - PUCK_R` ring + reflect if moving outward).
- Player mallet: proportional chase to the drag target (`PMAL_K` 26, cap
  `PMAL_VMAX` 460 u/s); velocity = actual displacement / h (that's what the
  impulse uses). Clamped to x∈[7,93], y∈[87,153] — **edge never crosses the
  center line** — plus corner-arc clamp. AI mirror-clamped to y∈[7,73].
- Goals: puck **fully** across the line (`y < -4.5` top / `y > 164.5`
  bottom) → score, horn + flash + shake, serve from the conceding side's
  half center ((50,120) / (50,40)) after a 0.8 s `state='count'` countdown
  (2 blips + go). `WIN_SCORE` 7 → match over.

## AI (all knobs in the `AI` table)

| diff | max speed u/s | reaction ms | aim error ±u |
|---|---|---|---|
| ROOKIE | 55 | 220 | 14 |
| PRO | 85 | 120 | 7 |
| LEGEND | 120 | 60 | 3 |

`aiThink(dt)` (per frame) targets, `physSub` moves at `aMal.spd` toward it:
- **Reaction delay**: AI reads `puckDelayed(react)` from `puckHist` (0.6 s
  ring of per-frame snapshots keyed by `simT`) — it literally sees a stale puck.
- **Defend** (puck in player half, or during countdown): home spot y 20
  (`AI_HOME_Y`), x tracks 0.7×puck-x clamped ±20 around center, at 0.8×speed.
- **Attack** (delayed puck in AI half): move to a strike point `STRIKE_BACK`
  13u behind the puck on the line to the player's goal (aim x = 50 + aimErr,
  re-rolled every 0.7 s); within 5u of it → lunge target 3u *through* the puck.
- **Own-goal guard**: if the delayed puck is above the mallet
  (`dp.y < aMal.y - 1`) the AI circles to the puck's side (x offset ±16.5)
  instead of pushing it toward its own net.

## Audio

Lazy `AC` on first gesture; `sfxGain`(0.9) and `musicGain`(`MUSIC_VOL` 0.5)
→ `masterGain` → destination. Mute = masterGain 0/1 (+ all synth helpers
early-return when `muted`, so heavy test loops don't pile up nodes), persists
`air-hockey-mute`, button top-left stops propagation. `visibilitychange`:
hidden → suspend; visible → resume unless muted. Music: 32-step 16th-note
sequencer @110 BPM, lookahead scheduler (`setInterval` 100 ms scheduling to
`AC.currentTime+0.3`), saw bass 8ths + sparse square lead + sine-drop kick on
quarters + noise-buffer hats (closed 8ths / open off-beats); starts with the
match, stops at match over, `duckMusic()` dips to 0.12 and ramps back over
1.1 s under the goal horn. SFX: wall click + mallet thunk scale pitch/gain
with impact speed (thunk gated at rel-speed > 25 to avoid push-contact spam),
countdown blips, rising (you) / falling (AI) goal jingle over the horn,
win fanfare / lose sting.

## State & persistence

`state`: `title | count | play | over` (tests use `'paused'` — rAF only
steps `play`/`count`, but a direct `step()` call always simulates; puck is
frozen only in `count/over/title`). Top-level lets reachable from
`page.evaluate`: `puck, pMal, aMal, dragTarget, scoreP, scoreA, diff, aiP,
countT, muted, musicTimer, rec, AC…`. localStorage (try/catch):
`air-hockey-record` `{ROOKIE:{w,l},PRO:{w,l},LEGEND:{w,l}}` (shown on the
start-overlay buttons), `air-hockey-mute`. Overlay/HUD buttons share a
400 ms tap debounce (`bindTap` — iOS fires touchend AND click).

## Fairness rules (asserted headlessly, must keep holding)

- Puck can never leave the table except fully through a goal mouth; no NaN
  ever; speed cap 220 always enforced; with nothing feeding it energy the
  puck always damps to rest.
- Mallet **edges** never cross the center line (center-clamp includes MAL_R).
- AI never deliberately pushes the puck toward its own goal (circle-around
  rule).

## § headless test recipe

Drive: scratchpad `air-hockey/drive.cjs` (playwright-core,
`executablePath:'/opt/pw-browsers/chromium'`, iPhone 13 profile, `file://`,
32 checks). Pattern per `.claude/notes/20260724-headless-mobile-game-testing.md`:
set `state='paused'` to freeze rAF, then call `step(1/60)` in a loop;
scripted player = set `dragTarget` directly each step. Launch Chromium with
`--autoplay-policy=no-user-gesture-required` to assert `AC.state==='running'`.
Traps hit:
- **"Eventually comes to rest" fails with a live AI** — 8/216 max-speed sweep
  runs were still moving at 45 s because the AI kept rallying (legit
  gameplay, not an energy leak). Split the sweep: bounds/NaN/cap vs live AI,
  rest-assertion vs a pinned AI (`aiP={spd:0,...}` — real parameter, no test
  hook). Pinned: 216/216 rest.
- **Goal exits are legal "out of bounds"** — the bounds predicate must allow
  y ∈ (−7.5, +5.5) (and mirrored) while x is inside the mouth band; the reset
  teleports the puck the same substep it fully crosses.
- **Landscape fit must be asserted against `window.innerHeight`**, not the
  game's own `ch` — the flex min-height bug made canvas *and* check agree at
  422px tall in a 390px viewport; only a screenshot caught it.
- `matchOver()` fills `#o-title` text immediately but unhides the overlay on
  a 900 ms timeout — assert `textContent`, don't wait for visibility.
- Sweep/rally loops: set `muted=true` first so synth helpers no-op.

## Tuning knobs / follow-up ideas

`PUCK_DAMP`/`WALL_E` (rally length), `PUCK_VMAX` (shot scariness),
`PMAL_K`/`PMAL_VMAX` (input feel), `AI` table + `AI_HOME_Y`/`STRIKE_BACK`
(difficulty), `GOAL_W`/`POST_R` (scoring ease — effective slot is narrowed
by post+puck radii), `COUNT_T`. Ideas: 2-player hot-seat (mirror input to
the top half), puck spin/english, sudden-death overtime at 6–6, power puck
that ignores damping for 3 s, best-of-series flow.
