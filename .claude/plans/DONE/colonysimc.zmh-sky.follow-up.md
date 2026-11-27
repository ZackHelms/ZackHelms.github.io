# colonysimc follow-up: the real sky

## Blocked: needs you

Nothing is blocked. The playtest is yours: see the TODO.md entry "Playtest the real sky".

## Decisions made on your behalf: review

- **Tuned light:** `SUN_GAIN 1.8`, `AMB_GAIN 1.4`, `NIGHT_FLOOR [0.035, 0.042, 0.075]`, up from the plan's starting 1.25 / 1 / [0.02, 0.025, 0.05].
  - The July sun at 15°S stands only 52° up at noon, in the north, and the land rises northward, away from it.
  - With those values, midday is measured no darker than the old build.
  - A moonless 23:00 is dimmer than before, but the settlers are still readable. The old sky lit every night with a fake moon.
- **The sky pass is scissored** to the rows where sky can show (`skyRows()` in `render.js`). This is not in the plan.
  - SwiftShader shades a full-screen pass in full even where depth rejects it. Unscissored, the frame went from 210 to 400 ms, and the 16x clock failed its drive row.
  - Screenshots match the unscissored build within 0.2 per channel.
  - The one difference: under deep water below that line, the background is black rather than the kit's below-horizon haze. The water there is about 94% opaque.
- **`LICENSE-d3-celestial.txt` is stored with LF line endings**: the same text as the kit's file, not the same bytes. The kit's copy is CRLF only because of the Windows checkout, and the repo's EOL guard requires LF.
- **Drive rows: three departures from the plan's letter.**
  - Row 3's threshold is a mean difference of under 0.05 levels on the 0-255 scale, plus zero pixels differing by more than 2. The plan's "1/255" would have missed break (c), which measured 0.24.
  - Row 2 projects the sun as target + 1e5 × dir, so where the eye sits does not matter.
  - Break (f) is an addition. It changes the credit text in `ui.js`, which proves row 6 can fail; the plan had no break for it.
- **Break (c) turns row 2 red as well as row 3.** The plan listed only row 3. That is correct: a camera-dependent clock moves the sun too.

## Deferred / discovered follow-ups

- **zmh-sky (upstream, zmhstudio), not this repo:** at nautical twilight (sun about −8°), `skyRadiance` / `zmhSkyRadianceAt` ends the glow in a hard edge on the anti-sun side.
  - The cause is single scattering with a geometric Earth shadow. Points in shadow add exactly 0, and the display gamma turns the last 0.005 into a visible step.
  - Shown in Node with no WebGL: at 8° altitude the red channel drops 0.005 → 0 at 74-76° from the sun ('low' quality). 'high' quality only moves the edge about 6° further out.
  - Wants a multiple-scattering or ambient fill, or a soft shadow term.
  - Driving Simulator's port of the same model probably shows it too.
- **Twilight fog is warm on every side.** It is the mean over 8 azimuths, so at dusk the far treeline is tinted warm all round, not just in the west. Weighting it by azimuth is possible if the CD notices.
- **Game 18:15 is already deep twilight.** Sunset on 5 July at 15°S is about 17:40 local mean time. This is real, not a bug, but the settlers' evening routine was tuned on the old arc's later dusk; worth a look in the playtest.
