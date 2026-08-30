# Verlet Physics Ragdoll — context

`games/verlet-physics-ragdoll/index.html` (single self-contained file, MIT
`LICENSE` beside it). Hub card 🦖 **VERLET RAGDOLL**.

**Status: starter page.** The CD supplied a working T-Rex ragdoll toy
(2026-08-30) and asked for it to land as the seed of a game. It ships as a
*sandbox* — no score, no goal, no fail state — plus the repo's standard chrome
(back button, mute, build badge, WebAudio SFX + music). Anything that turns it
into a scored game is still unwritten design space; ask the CD before inventing
one.

## The simulation

Verlet integration: a point stores `x/y` and `oldx/oldy` and nothing else, so
its velocity is the gap between the two. Each frame:

1. Every point takes a damped step (`DAMPING 0.965`), plus gravity
   (`GRAVITY 0.55 × scale`, toggleable) and a **rest-pose spring**
   (`SPRING 0.045`) pulling it back toward its posed position.
2. `ITER = 5` relaxation passes restore every bone to its rest length.
   The dragged point is **immovable** during relaxation — its partner takes the
   whole correction — which is what makes a grabbed bone feel held rather than
   rubbery.

The rest pose is the local skeleton rotated by `theta` (set by dragging empty
space) plus a small idle `wobble` that is suppressed while the player is
touching the rig. Because the pose is a *spring target* and not a constraint,
the skeleton always crawls back to shape on release with no reset logic.

## Coordinates and scale

`BASE` holds the skeleton in nominal local coords (head at `-x`, tail at `+x`),
recentred on its centroid at load so a spin reads as a spin about the body.
`layout()` derives each point's `lx/ly` and every `boneLen[i]` from `BASE ×
scale` on **every resize**, where `scale = clamp(min(W/760, H/780), 0.34, 1.1)`.

That is the rule to keep: **nothing derived from `BASE` is cached across a
resize.** A resize therefore needs no pose reset — the rest positions move and
the springs walk the live points there over a few frames, which is also what
keeps an iOS URL-bar resize from snapping the skeleton. Every drawn size (bone
width, joint radius, teeth, eye, gravity) multiplies by `scale` too; a hardcoded
pixel size will look right on desktop and wrong on a phone.

## Data

- `BASE` — 37 named points. Add a bone by adding points here plus a row in
  `bones`; `boneLen` is derived, never hand-written.
- `bones` — `[a, b, category, width]`. `category` drives both draw order and
  the far-side alpha.
- `DRAW_ORDER` — back-to-front category groups (`legFar` first, `skull` last).
  The far leg/toes draw at `globalAlpha 0.55`; that is the only depth cue.
- `JOINT_R` — per-joint radii, default 3.5.

## Input

`findBoneHit()` returns the **nearer endpoint** of the closest bone segment
within `26 × max(scale, 0.6)` px, so a tap near a bone grabs a joint. A hit
starts a drag; a miss starts a whole-rig spin about `pivot`. Touch handlers live
on the canvas (`touchstart`/`touchmove`, `preventDefault`), and pointer-up is on
`window` so a finger released off-canvas still releases the bone. The panel
buttons go through `bindTap` (400 ms double-fire guard) — the standard helper,
and note the CLAUDE.md rule that it must never be put on a native picker.

## Chrome

Back + mute at the top-left (`z-index:80`, above everything); the hint panel and
RESET / GRAVITY buttons sit at the **bottom**, safe-area-aware, specifically so
they cannot collide with that chrome or with the centred title. The title block
is `pointer-events:none` so it never swallows a drag.

## Audio

Standard stack: lazy `AudioContext` on first gesture, `sfxGain`/`musicGain`
masters, mute persisted to `verlet-ragdoll-mute`, suspend on
`visibilitychange`. The shared noise buffer is built once inside `audio()` (per
the repo rule — never lazily inside one SFX). Music is a 32-step, ~64 BPM
tar-pit ambience on a 100 ms lookahead sequencer. `sndRattle` is rate-limited to
one hit per 0.14 s off a total-motion threshold, or a hard drag becomes a buzz.
