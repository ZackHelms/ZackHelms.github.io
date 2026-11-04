# dsradio follow-up

## Blocked - needs you

Nothing.

## Decisions made on your behalf - review

- **The squared-taper row's windows (the overseer's call).** Under `lvT` the unbroken page failed
  "the engine slider half way is a quarter of the level" once (0.361 against 0.25 +- 0.08). The plan
  called any non-stations band failure an escalation. Traced to the page: the engine's two oscillators
  are set to `f` and `f * 1.007` (`SND.update`), so its level beats at about 0.18 Hz (5.4 s at section
  9's 789 rpm), and the 2 s windows read the half-way level at 0.17-0.37 of the full one by phase alone.
  This is a measurement artefact, not a taper finding, so I did not stop. The row now compares two
  back-to-back `lvT` windows, engine 100 then 50, each a whole number of beat periods (two beats, about
  10.98 s), the period taken from the page's rpm at measure time. The band and the wording are
  unchanged. It now reads 0.249-0.252. Revert or redirect if you want a different measurement.
- **Implementer choices recorded as "Assumed, not decided" rows (dsradio)** in
  `.claude/driving-simulator.md`:
  - a second witness that no frame ran (`drawn`: `PERF.k` / `PERF.t0` unmoved);
  - the method row requires exactly nine windows;
  - the hold wait sits inside the `try`;
  - reads are counted, not timed.
- **`radio-quiet`'s expected level restated.** The plan expected the radio at 0.13-0.2x the engine; it
  read 0.21x, because under `lvT` the radio is about 0.9-1.1x the engine (it was 0.5-0.75x under the
  old sampler). It is still caught by its row.
- **Step 3 (ship) was run by the overseer** rather than a separate implementer: it is the documented
  procedure and overlaps the oversee wrap-up.
- **One wording fix by the overseer** in the step-2 docs and the step-1 suite comment: "0.17 to 0.37
  of another 2 s window" became the half-way/full ratio it actually is (0.25 expected), plus the
  measured +-20% swing of a 2 s window at a fixed level.
- **Preflight:** clean. Line anchors drifted by at most two lines; no counts were wrong.

## Deferred / discovered follow-ups

- `lvOn`'s 2 s engine window still falls anywhere on the 0.18 Hz beat, so the radio/engine (0.86-1.10)
  and ambient/engine (0.13-0.145) ratios move run to run, inside their bands. A whole-beat `lvOn`
  would steady them. Not needed now.
- From the plan, unchanged (inferred, not run): `station()` returning 0 for every selection would pass
  the stations row, since it compares levels only.
- The perf block's row (FPS 0) still reads wall-clock FPS and can flap under load (untraced).
- The container restarted once mid-run (during step 1's final report). The committed work survived,
  as `.claude/zmh/producer.md` section Environment predicts.
