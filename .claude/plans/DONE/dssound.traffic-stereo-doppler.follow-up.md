# dssound follow-up (2026-11-03)

## Blocked - needs you

- **The playtest, on headphones** (a headless browser has no ears). From the plan: chase view, a
  two-lane road, oncoming traffic. Check that a car passing on the left is mostly in the left ear
  and drops in pitch as it passes. Overtake a truck slowly: its engine is lower and its pitch
  barely changes. The cockpit muffles them. "Other cars" at 0 silences only them.

## Decisions made on your behalf - review

- **The gates' red rows were treated as the known environment reds.** The baseline gates on
  unchanged `main` (6f8816a) were already RED here on two rows: "the radio sits near it" and "the
  detail block shows frame..." (its fps reads 0 because every SwiftShader frame took more than 1 s,
  and the page drops frames of 1 s or more from its average). "All four stations within 25%" flakes
  the same way. These are the frame-rate rows already in `TODO.md` § Later, which you accepted on
  2026-11-03. Each step passed when nothing else went red and every new row passed. No row was
  changed to get there.
- **Suite 141, not 140.** The linear-pan break passed the stereo rows (9 is inside 4-12), so step 2
  added a pan-law row instead of widening a band.
- **The new breaks were run through a harness, not the full suite.** The harness is built from the
  suite's own row code, its boot and its section-9 setup, and it passed 18/18 on the unbroken page
  first. The reason: one full-suite run takes about 11.5 minutes in this container, and there were
  10 breaks. The 47 older breaks were not rerun, because none of them edits the sound code this arc
  changed.
- **Choices beyond the plan's Design** are now "assumed, not decided" rows in
  `.claude/driving-simulator.md`:
  - shift points of 1300 and 2600 rpm, and idle at 800 rpm;
  - each voice's engine level 0.08, its lowpass at 500 + 0.12 x rpm, and the tyre band at
    380 + 6 x v Hz;
  - the sound comes from a point 0.5 m above the road;
  - the fade constants: 0.05 s in, 0.027 s out, and a voice is free 0.12 s later;
  - the cockpit muffle sits on the whole traffic channel, ahead of the slider.
- **To give the paused row teeth, it opens the menu with the sim not paused**, so the open menu
  alone must hold the voices.

## Deferred / discovered follow-ups

- The plan's own Follow-ups still stand: other cars' horns, brakes and indicators (if you ask), and
  reflections and tunnel reverb. Neither is runnable without your call.
- No follow-up plan was drafted. The residue needs a CD decision, or is the frame-rate test item
  already in `TODO.md` § Later.
