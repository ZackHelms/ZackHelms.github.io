# dssound - Driving Simulator: other cars make sound, in stereo, with real Doppler (DS-2)

**Status:** DRAFT (2026-11-02). Drafted on `main` at `e43a233` (suite 108 checks, break list 25).
**Run after** `dssky.horizon-stars-moon-sliders.md` lands (landed 2026-11-03, now in `DONE/`): both edit `index.html` and the suite.
This plan's anchors are named by symbol; the line numbers were read on `e43a233` and will have
moved by then, so re-grep each one before editing.
**Requested:** 2026-11-01, the CD (verbatim):

> Other cars should make sound yes; stereo so that if i pass a car and it is on my right i hear it
> in right speaker mostly (a little in left too is realistic), also doppler effect should be
> realistically simulated. Add this to backlog for driving simulator.

**Scope:** `games/driving-simulator/index.html` (`SND`, `VOL_KEYS`, `VOL_LABELS`, `window.__DS`),
the suite `.claude/tests/drive-driving-simulator.cjs`, the break list
`.claude/tests/negtests/driving-simulator.json`, and the docs `.claude/driving-simulator.md`,
`.claude/tests/README.md`, `TODO.md`, `DONE.md`. Source TODO entry: `TODO.md` § Now, "Other cars
make sound, in stereo, with real Doppler". Full spec: `.claude/driving-simulator.md` § Backlog,
DS-2.

> CD note: this template exists to make plans executable by
> `/zmh-producer:oversee-implementation` (zmh-producer plugin, configured via
> `.claude/zmh/producer.md`) - the "Implementation guidance" section is what
> the overseer reads to assign models/effort and to make decisions without
> asking.

## Goal

The six traffic cars nearest the listener, within 150 m, each sound: an engine whose pitch
follows its speed and kind, and tyre roar. Each is panned by its bearing from where the camera
looks (a car abeam on the right plays about 0.99 right and 0.16 left), thinned by air with
distance, quieter with distance, muffled by the glass in the cockpit, and pitched by Doppler
computed every frame (an oncoming car at 25 m/s each way drops about five semitones as it passes).
An "Other cars" slider in SOUND sets their level, and an old save reads 100.

## Context

- Today only the player's car makes sound. `SND` (`index.html:3668-3884` on `e43a233`) builds a
  fixed graph once in `S.unlock()`: master -> `sfx` and `music` buses -> one gain per `VOL_KEYS`
  entry (`VOL_KEYS`, `index.html:1155`) with an analyser probe on each (`S.rms(k)`). `S.update(dt)` runs every
  frame from `frame()` (`index.html:4001`), paused or not, and moves the engine with
  `setTargetAtTime`.
- The settings rows are built from `VOL_KEYS` and `VOL_LABELS` (`index.html:3895-3897`), and the
  loader merges saved `vols` over defaults of 100 (`index.html:1207-1212`). Adding `traffic` to
  `VOL_KEYS` gives old saves 100 with no loader change.
- Traffic cars (`spawnCar()`, `index.html:2783-2799`) carry `x, y, z`, `yaw` (heading, with pi
  added for `dir < 0`, `placeCar()`), `v` (speed along the heading, m/s) and `kind`. A heading
  `yaw` points along `[sin yaw, 0, cos yaw]` in the world (`stepPlayer()`'s
  `fx = Math.sin(P.yaw), fz = Math.cos(P.yaw)`).
- The player's world velocity is `P.vx * [sin yaw, cos yaw] + P.vy * [cos yaw, -sin yaw]`
  (`stepPlayer()`, `index.html:2692-2693`, `lx, lz`).
- The listener is the camera: `CAM.eye`, `CAM.fwd` (`index.html:3044-3100`), set for each of the
  three views.

## Design (decision defaults: the overseer decides by these and logs, it does not ask)

- **Everything is built once in `S.unlock()`.** A pool of 6 voices, each: two saws and a square ->
  a lowpass (the player's engine's shape) -> a gain; a looping `BufferSource` on the shared noise
  buffer -> a bandpass -> a gain (tyres); both into an air-absorption lowpass -> a distance gain ->
  a `ChannelMerger(2)` fed by a left gain and a right gain -> `ch.traffic`. No AudioNode is created
  in `S.update()`.
- **A new channel `traffic`** in `VOL_KEYS` (after `tyres`), label "Other cars" in `VOL_LABELS`.
  `ch.traffic` -> `sfx`, as every other sound channel. Probes: `traffic` (the existing loop picks
  it up), and `trafficL` / `trafficR` from a `ChannelSplitter(2)` off `ch.traffic` with an analyser
  per side. An `AnalyserNode` downmixes to mono, so the splitter is required for a stereo check.
- **Assignment:** each frame, the cars within 150 m of `CAM.eye` sorted by distance; the nearest 6
  hold voices. A voice whose car leaves the 6 fades to 0 over about 80 ms
  (`setTargetAtTime(0, t, 0.027)`) and is reassigned only after the fade (track a per-voice
  `freeAt`). A voice keeps its car while that car stays in the 6, so a voice never jumps between
  cars mid-sound.
- **The engine of a voice:** frequency from the car's speed through the same gearbox shape as the
  player's (`GEARS`, `FINAL`, `rpm -> f = rpm / 60 * 2`), times a kind factor *chosen*:
  `boxTruck` 0.7, `pickup` 0.85, `suv` 0.95, `sedan` and `minivan` 1.0, `hatchback` 1.15. Tyre
  roar's level follows speed as the player's does (`min(0.12, v * 0.004)`).
- **Air absorption** *chosen*: the lowpass at `16000 * (3000 / 16000) ^ ((d - 5) / 145)` Hz,
  clamped to 3-16 kHz (16 kHz at 5 m, 3 kHz at 150 m). **Distance:** `gain = 5 / max(d, 1)`,
  capped at 1 (reference 5 m).
- **Stereo:** `right = cross(CAM.fwd, up)` with `up = [0, 1, 0]`: in this renderer an OpenGL
  lookAt facing +z puts +x on the screen's LEFT, so right is NOT +x (the suite's `__dsAimed`
  projects with the same cross product, `drive-driving-simulator.cjs:765-766`). `sin θ` is the
  unit vector to the car dotted with `right` (normalised in the horizontal plane);
  `p = 0.8 sin θ`, `L = cos((p + 1) π / 4)`, `R = sin((p + 1) π / 4)`. Abeam right:
  p = 0.8, L = cos(0.45 π) = 0.156, R = sin(0.45 π) = 0.988.
- **Doppler, by hand** (Web Audio's PannerNode no longer does it):
  `k = (c + v_L · û) / (c + v_S · û)`, c = 343 m/s, û the unit vector from the listener to the car,
  v_L the player's world velocity (in every view), v_S the car's
  (`c.v * [sin c.yaw, 0, cos c.yaw]`). Apply `k` to the three oscillators' frequencies and the tyre
  source's `playbackRate` with `setTargetAtTime(..., 0.03)`. Clamp `k` to 0.5-2 against a
  teleport's jump. Worked cases (re-derived 2026-11-02): oncoming, both 25 m/s, approaching:
  û toward the car, v_L · û = +25, v_S · û = -25: `k = 368 / 318 = 1.157`; receding:
  `318 / 368 = 0.864`; the drop 1.157 / 0.864 = 1.339, 12 log2(1.339) = 5.05 semitones.
  Overtaking at 5 m/s relative (30 vs 25, behind then ahead): under 1.5%.
- **Cockpit:** the traffic channel's own lowpass at 1.5 kHz and x0.5 when `CAM.mode === 0`, as
  the ambient bed is muffled (`amb.ambF`, `muff`).
- **Paused:** the loop keeps calling `S.update()` with the menu open; traffic positions do not
  change while paused, so the voices hold. Nothing extra to do; a row checks it.
- **Level** is measured, never set by ear: a car passing 4 m away at 25 m/s, heard from the chase
  view, peaks at 0.5-1.0x the player's engine RMS at a cruise; in the cockpit about half that.
  Tune one constant (`TRAFFIC_GAIN`) by `S.rms('traffic')` against `S.rms('engine')`.
- **The test hook:** `__DS.SND.traffic()` returns the pool's state each frame: per voice
  `{ id, d, pan: [L, R], k, f, gain }`. Read-only.

## Implementation guidance (for the overseer)

Profile: **balanced** (assumed: this repo has no task-scoping skill, `.claude/zmh/producer.md`
§ Plans). One task per step; each is one commit on the plan's branch.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | The voice pool, the `traffic` channel and slider, pan, air, distance, Doppler, the probes and hook; the stereo, Doppler, pool, range, slider and paused rows | audio | opus | high | a fixed Web Audio graph that must never grow, a handedness trap in the pan, and rows that must measure (FFT, per-side RMS) rather than echo the code |
| 2 | Level by measurement; break list and negative tests; frame cost; docs | eval+docs | opus | high | the level row against the engine; each break on its own row; MISSED needs a row or an argued equivalence |
| 3 | Ship: badge, gates, land on `main`, Pages, TODO/DONE, report | ship | sonnet | medium | the documented procedure |

- **Ordering:** 1 -> 2 -> 3. Nothing in parallel (one page, one suite).
- **Files owned per task:** 1: `SND`, `VOL_KEYS`, `VOL_LABELS`, `window.__DS`, the suite; 2: the
  break list, the docs (and `TRAFFIC_GAIN`); 3: the badge line, the plan's move to `DONE/`,
  `TODO.md`, `DONE.md`.
- **Validation per task:** `node .claude/scripts/check-inline-js.cjs games/driving-simulator/index.html`
  after every page edit; `.claude/scripts/gates.sh games/driving-simulator/index.html` GREEN at the
  end of every step, **run alone** (check `uptime` first; the sound rows go red when two Chromium
  suites share the box, producer config § Environment).
- **Tier audit (required):** no step passes a haiku checklist. Step 1 is audio-graph design plus
  measuring rows (opus, high). Step 2 needs judgment on rows and breaks (opus, high). Step 3 is
  the procedure but pushes to `main` (sonnet, medium).
- **Decision defaults:** everything under "Design". Beyond it:
  - A choice not listed here becomes a row in `.claude/driving-simulator.md`'s "Assumed, not
    decided" table (the kind factors, the air curve, the reference distance, `TRAFFIC_GAIN`).
  - A suite row the new sound contradicts is restated, never deleted. Likely: "the engine is
    audible and the radio sits near it" (`drive-driving-simulator.cjs:954`) and "the radio slider
    at 0 silences the music bus and nothing else" (`:956`, which reads `sfx`, now carrying
    traffic too) - restate if their numbers move, and name them.
  - "Settings have a volume slider for ... every other sound" (`:963`) lists the keys by hand: add
    `traffic` to its list.
- **The suite's oracles:** the pan law and the Doppler formula are typed into the suite from the
  spec (they are physics and a stated law, not the page's code); the measured side is always the
  audio graph (analysers, an FFT), never the hook's own numbers alone.
- **Embedded-content QA.** Rows added in step 1 (one claim each): stereo right, stereo left, dead
  ahead, Doppler factor, Doppler in the FFT, the pool, no node growth, range, the slider at 0,
  paused = 10. Step 2 adds the level row (outside and cockpit as one row) = 1. Expected: the suite's
  total at the start of this plan + 11 (108 + 11 = 119 if `dssky` has not landed; state the real
  numbers).
- **Escalation triggers:** the node count grows and cannot be held flat without dropping a sound;
  the level cannot sit in 0.5-1.0x the engine without masking the player's engine; anything that
  needs a change to `drivingSimulator.settings.v1`'s key.
- **Playtest:** chase view, a two-lane road, oncoming traffic: a car passing on the left is
  mostly in the left ear and drops in pitch as it passes; overtake a truck (lower engine) slowly
  and hear almost no pitch change; the cockpit muffles them; "Other cars" at 0 silences only
  them. Wear headphones.
- **Publish:** step 3 pushes `main`, which is the publish. Verify the Pages run.
- **Commit strategy:** one conventional commit per step on the plan's branch (`ds-sound`, or the
  branch your session may push to), scope `driving-simulator`, ending "(dssound step N)". Step 3
  lands the branch on `main` as one commit with `.claude/scripts/land-on-main.sh`, dry-run first.

## Steps

### Step 1 - the voices

- Build per Design. Re-grep every anchor named in Context first.
- Rows (the suite's sound section, after the existing level rows; the AudioContext is unlocked
  there already):
  - **stereo right:** a car parked 6 m to the listener's right (placed by `teleport`/`spawnCar`
    and held: `stepTraffic` not run, or `v = 0`), every other car moved beyond 150 m: the
    `trafficR` / `trafficL` RMS ratio is 4-12 (the law gives 0.988 / 0.156 = 6.3);
  - **stereo left:** the mirror, `trafficL / trafficR` 4-12;
  - **dead ahead:** L and R within 10% of each other;
  - **Doppler factor:** for an oncoming car, a receding car and a car at the player's speed, the
    voice's applied `k` (hook) equals the suite's own formula within 0.5%;
  - **Doppler in the FFT:** a test-only hook flag mutes the voices' tyre gain so the engine's
    peak stands alone. The car is held (positions fixed, `c.v` and `P.vx` set, nothing stepped):
    first 50 m ahead and oncoming (approaching), then 50 m behind and going away (receding). The
    traffic channel's spectral peak between 20 and 400 Hz moves by `k_approach / k_recede` within
    3% (`AnalyserNode.getFloatFrequencyData`, fftSize 16384, a parabolic peak fit);
  - **the pool:** in heavy traffic (`SETTINGS.traffic = 1.8`) at most 6 voices have a gain over
    0.001, and they belong to the 6 nearest cars within 150 m;
  - **no node growth:** wrap `BaseAudioContext.prototype.create*` and count over 60 s of heavy
    traffic with the radio and the ambient at 0 (they create nodes per note by design), the horn
    up, the player stopped and nothing hit: 0 nodes created;
  - **range:** a car at 160 m is silent (its voice's gain under 0.001, or no voice);
  - **the slider:** "Other cars" at 0 puts `traffic` under 0.0005 RMS while `engine` stays above
    0.02;
  - **paused:** with the settings open for 2 s, the voices' `k`, `pan` and `gain` are unchanged.
- Expected total: start + 10.

### Step 2 - level, breaks, frame cost, docs

- The level row: a car passing 4 m away at 25 m/s (the player at a cruise in the next lane, the car
  oncoming), peak `traffic` RMS over the pass is 0.5-1.0x the `engine` RMS in the chase view, and
  0.25-0.6x in the cockpit. Tune `TRAFFIC_GAIN` to it.
- Breaks, at least: pan sign flipped (`right = [1, 0, 0]`); pan law linear; Doppler sign flipped;
  Doppler off; v_L ignored; a node created per frame; a 7th voice; range 1500; the cockpit not
  muffled; the slider wired to `tyres`. Each caught by its named row; any MISSED gets a row or an
  argued equivalence in the Results. Run them in foreground chunks (`negtest-copies.py --only`),
  and not beside another Chromium suite.
- Frame cost: the perf block's CPU time before and after with heavy traffic.
- Docs: `.claude/driving-simulator.md` (DS-2 built, § Architecture's sound, § Testing, the assumed
  rows), `.claude/tests/README.md` (the count). Open question 6 there is already answered.

### Step 3 - ship

- `stamp-badge.sh`, then `check-inline-js` and `gates.sh` GREEN after the stamp (alone).
- Move this plan to `.claude/plans/DONE/`, Status `IMPLEMENTED <date>`.
- Land with `land-on-main.sh` (dry run first). Message:
  `feat(driving-simulator): other cars make sound, in stereo, with Doppler (DS-2)` with the
  session's trailers. If `behind`, merge `origin/main` into the branch, re-run the gates, check the
  other session's files survived.
- `TODO.md`: the entry to `DONE.md` with the badge string.
- Verify the Pages run for the landed SHA (two checks, then report).
- Report: the badge string, the playtest list, the assumed rows (the kind factors, the air curve,
  `TRAFFIC_GAIN`).

## Gotchas / bindings

- **Right is `cross(fwd, up)`, not +x.** The world is (east, up, south) and the screen's +x is the
  world's left when facing +z. The CD's whole ask is "on my right ... right speaker": a flipped sign
  passes every row that only checks magnitudes. The stereo rows must place the car by the camera's
  own right vector and check which side is louder.
- **`AnalyserNode` is mono** (it downmixes); per-side levels need the `ChannelSplitter`.
- **`SND`'s `ac` is private.** To count node creation, wrap the prototype methods
  (`BaseAudioContext.prototype.createOscillator`, `createGain`, `createBiquadFilter`,
  `createBufferSource`, `createChannelMerger`, `createChannelSplitter`, `createAnalyser`,
  `createStereoPanner`), not `ac`'s.
- **The radio and the ambient create nodes per note** (`tone()`, `noiseHit()`, `bird()`,
  `cricket()`); so do crashes and the horn. The no-growth row must silence them (volume 0 stops
  their scheduling: `level('music') > 0`, `level('ambient') > 0`) and keep the player still.
- **Doppler on a `BufferSource`'s `playbackRate`** also shifts the tyres' band; that is right.
  `detune` is not needed.
- **Never `new` a node per frame,** and never `disconnect()` the pool: fade to 0 and reassign.
- **Timed rows go red under load** (producer config § Environment). Run the gates alone; never
  count a catch only a sound or perf row made in a run with another suite beside it.
- **Commit hygiene:** explicit pathspecs, never `git add -A`. No model names in commits or files.

## Validation

`check-inline-js` after every page edit; `gates.sh` GREEN at the end of every step, alone; the
break list in step 2 with every break caught or argued. Beyond the gates: the CD's ears, on
headphones, with the playtest list above. A headless browser has no ears; the rows measure levels
and spectra, not how it sounds.

## Follow-ups

- Horns, brakes and indicators from other cars, if the CD asks.
- Reflections off buildings and a tunnel's reverb: not in this item.

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/dssound.traffic-stereo-doppler.md
```
