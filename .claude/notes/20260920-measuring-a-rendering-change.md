# Measuring a rendering change you cannot see

2026-09-20, from the interlock lighting pass (sun-and-moon rig, shadows +
ambient occlusion, transmissive glass, a procedural sky and terrain).

The code half of that work is in `.claude/interlock.md`. This note is about the
other half, which took longer: **proving any of it.** Five checks in that
session were green and worthless, and each one produced a confident number
first. They are worth writing down together because they are not five bugs —
they are five faces of one mistake, which is measuring something correlated
with the thing you care about instead of the thing itself.

---

## 1. Two page loads are two different boards

**The check.** "Do shadows contribute anything?" Build the page with
`shadowMap.enabled = true`, screenshot; build it again with `false`,
screenshot; diff the pixels. Result: **20% of the frame differs.** Shipped that
number in a report.

**Why it was wrong.** Interlock generates a new random puzzle on every load. The
two screenshots were of two different boards. Almost all of that 20% was the
shape of the cube, not the presence of shadows.

**The honest number.** Toggle `shadowMap.enabled` at runtime on ONE loaded
page: **0.35-0.56%** of the frame, and 350-540 pixels meaningfully darker.

**The general form.** Any page with seeded or procedural content — which here
means most of the catalog — cannot be measured by diffing two loads. If the
page will not let you toggle the feature, add a test-only toggle; that is what
`window.interlock.shadows(on)` and `.transmission(on)` are for.

**And 0.4% is the right answer, not a disappointment.** Interlock's pieces are
flush faces of one solid, so the only places anything can cast are the
recesses. Knowing that the true figure is small is what redirected the work to
**ambient occlusion**, which is what actually makes the crevices read. A wrong
number can also send you to the wrong fix.

---

## 2. Comparing two variants is not a causal test

**The check.** "Can you see the other pieces through the glass?" Measure
high-frequency detail strictly inside the board's silhouette for a glass
material, and compare it against an opaque material as a control.

**Why it was wrong.** Wood grain is high-frequency too. Measured across the
whole material set:

```
ice 18.0%   honey 12.2%   jello 9.1%      <- the three transmissive ones
pine 11.1%  rust 9.4%   metal 8.6%  walnut 7.2%   <- opaque
```

Opaque **pine outscores two of the three glasses.** The metric could not
discriminate at all, and a threshold picked to make it pass would have been
fitted to the one material that happened to be tested.

**The fix.** Measure the same scene with transmission on and off. Ratios then
come out 1.6-3.5x with a ~34% whole-frame change, and the floor sits under the
observed minimum with margin.

**The general form.** A control that differs from the subject in more than the
one variable is not a control. When the only honest comparison is the feature
against itself, the page needs a toggle — and a test-only writer on a
diagnostics object is a reasonable price for a causal check.

---

## 3. Aim where the error is largest, and more than once

**The check.** The viewport suite proves a tap lands on the piece it was aimed
at when the canvas box is shorter than `innerHeight`. It clicked the *lowest*
free piece and asserted that piece left.

**Why it was weak.** The error being hunted — normalising a tap by
`innerHeight` when the box is shorter — is **zero at the vertical centre line
and grows with distance from it**. "Lowest free piece" is not "furthest from
centre", and the displacement at a near-centre target is small enough that a
large piece absorbs it. Reinstating the bug on purpose, the row **passed**.

Two intermediate versions also failed as checks, both for board-dependence:
asserting merely that *a* piece was removed passed on the bug (a displaced ray
lands on a piece higher up, which is often also free), and requiring a piece to
be unoccluded *at its own centre* found no candidate at all on some boards and
reported that as a failure.

**The fix.** Scan a grid of points, keep every point where `pick()` reports a
free piece, aim at the one furthest from the centre line, and take **three
turns**. Against a deliberately broken `tap()` across three runs: 3/3 red, and
the middle run shows tap 1 passing by luck with taps 2 and 3 catching it —
which is the argument for three.

**The general form.** Find where the defect's signal is strongest and aim
there; and if a single trial can pass by luck, take several. "It went red once"
is not evidence a row discriminates.

---

## 4. Wait in rendered frames, never milliseconds

The viewport suite passed alone and went **red inside `gates.sh`**, where three
Chromium suites run back to back. Nothing about the page had changed. Its fixed
`waitForTimeout(400)` had become **zero frames** under load: this container
rasterizes WebGL in software, where a frame costs 300-700 ms. The row that
broke was the one that depends on the per-frame re-measure having run at all.

Both browser suites now wait on `requestAnimationFrame` counts, and better,
on the property itself (`until(page, () => rig().lights[0].intensity === 0)`).

**The general form.** A wall-clock wait encodes an assumption about machine
speed that is false the moment anything else is running. Wait on the thing you
are waiting for.

---

## 5. The dirty tree, and why this note exists

Midway through, the night-luminance row started failing: 103 mean luminance
against 129 at noon, when it had read 32 earlier. It had passed before, and it
was now failing inside two *unrelated* negative tests. Diagnosis: a timing
flake. Fix: frame-based waits (§4 above, which was a real improvement for its
own reasons).

**That diagnosis was wrong.** A previous negative test had left this line in
`world.js`:

```js
this.scene.environmentIntensity = 0.82; this.sky.uZenith.value.setHex(0x6688cc); this.sky.uHorizon.value.setHex(0x99bbdd);
```

It overwrote the night sky with daytime blue on every frame. The gate was right
the whole time. It had been left behind because the restoring `cp` ran from a
drifted working directory — **the identical failure `negtest.sh`'s header
records from 2026-08-23** — and because the sweep for leftover sabotage checked
three of the four markers applied and missed the fourth.

Two things follow, and they are worth more than the frame-wait helper:

- **When a gate with teeth suddenly disagrees with you, suspect the tree before
  the harness.** Measuring the property directly settled it in one command:
  screenshot the night frame and look at it. It was obviously a dim overcast
  afternoon. Half an hour of harness theory preceded that screenshot.
- **Use `negtest.sh save|restore`.** It cmp-verifies the restore and exits
  non-zero when it fails, which is exactly the failure that occurred. Hand-rolled
  `cp` does not. `scan` now also fails on a snapshot saved and never restored, so
  the correct workflow is self-enforcing — but nothing protects a break made
  without the script at all.

---

## Performance, and what cannot be measured here

`frame-budget.cjs` reported **283 ms/frame** for the new build and **233
ms/frame for the build already in production**. Both numbers are meaningless as
phone performance: this container renders WebGL through SwiftShader
(`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader
driver)`), i.e. on the CPU.

What *is* real is the **ratio** and the **relative shares**, obtained by
bisecting with the scene handles (iPhone 13, dpr 3):

| removed | median frame |
|---|---|
| nothing | 733 ms |
| - sky dome | 633 ms (~14%) |
| - terrain, water, grass | 367 ms (~36%) |
| - shadow mapping | 333 ms (~5%) |
| - environment/IBL | 333 ms (~0%) |

Shadows and image-based lighting being nearly free is the useful finding; the
terrain is what to cut first if a real device struggles, and `bigDevice` in the
`World` constructor moves grid density, shadow-map size and particle counts
together. The CD confirmed on-device performance was good, which is the only
measurement that settles it.

**The rule:** quote a ratio or a share from this container, never an absolute
frame time, and say which it is.
