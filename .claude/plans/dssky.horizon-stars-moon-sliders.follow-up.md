# dssky follow-up (overseer notes, 2026-11-02/03)

## Blocked - needs you

- None. The run stopped at the CD's quota (step 6 in progress); the plan's HANDOFF STATE says how to finish.

## Decisions made on your behalf - review

- preflight: clean, 0 corrections (page/suite unchanged since e43a233; anchors as cited).
- step1 opus/high first pass OK, 2fb91c0. Decision: skySum(d, bodies) 0/1 weight instead of skyBase+skyBodies (bit-identical sky); skyBodies split deferred to step 3. Unchanged row checks 5 hashes (stricter). Repro before sun 1.956 moon 11.217, after 0.985/1.126.
- deferred: row name still says skyCol() (step 6); breaks "disc in hills"/"bodies below ridge" untested (step 6); moon margin 1.126 vs 1.25.
- step2 opus/high; hit usage limit mid-task, resumed same agent via SendMessage (no respawn); 5ea4a0f. Decisions: floor 0.5*max(uPx,1) (not 0.5*uPx: keeps half-fb-px floor below RSCALE 1); STAR_GAIN 4.0; phases on the diagonal; iota Leo position from kit catalogue data + suite's own precess (SIMBAD unreachable); step-1 unchanged row restated with stars off.
- overseer landing: badge build 2026-11-02 17:17 UTC, gates 112 GREEN, landed cec3b2f on main (base 2bff358), merged back e02063d. Pages run 41490375239 in_progress at check 1.
- Pages run 41490375239 for cec3b2f: build/deploy/report all success (check 2).
- step3 opus/high first pass OK, dcc8db5, suite 120, 6 breaks each caught by own row. Decisions: maria 4 fixed patches (vn() only edges: SwiftShader gave 1 patch; GPU sin precision); pole of date exact (0,sinlat,coslat) ENU; sun disc angle by chord; MOON_K a uniform. Plan tolerances traced+restated: last quarter at TRUE quarter (Meeus 49 quarter terms; mean quarter gives 0.570), upper limb 0.050 within 0.02 (plan bound sat on expected value). Restated: sun row (0.2 rad FOV), sky-unchanged row (4 hashes re-pinned, means within 0.5, night22 keeps pre-split hash).
- overseer call: earthshine showed by day (dark part lighter than blue sky): added to step 4 scope: earthshine x SKY.night + row. ES_GAIN 600 reads 43/169 levels after tonemap: playtest lever.
- step4 opus/high; usage limit mid-task, resumed same agent; 1125705, suite 123. MOON_RGB old colour at old full level, MOON_AMB 1.0, MOON_DIM 0.6, earthshine x night (overseer add). Night row measures ground from 30 m (chase view dilutes + unstable 17.8-29.0); quarter-moon phase check added (sun -25 deg). Restated sky-away row moon4 frame (traced: glow -5.2, MW dim -0.8). Breaks: 4 caught by own rows. Step 5 expect 128.
- step5 opus/medium first pass OK, d573462, suite 128. Decisions: separate uStarsK; Moonlight 0 removes earthshine too (uMoonK multiplies whole kit disc); Sun slider = SKY.sunCol only (day stays blue at 0); invalid stored value reads 100; no % readout. Restated "radio selector heads the sound section" (finds h3 SOUND by text). 100% row: 7 hashes equal to pre-step page; traced run-to-run noise (uWind=now; car position) and pinned both. Planet 200 check forces night 0.04 (Jupiter 235 saturates).
- deferred to step 6: sun/moonlight wrong-term breaks; DS-4 checks list text "If DS-6 has landed"; tests README count.

## Deferred / discovered follow-ups

- Playtest levers: ES_GAIN 600 reads 43/169 levels after the tonemap (strong earthshine); no minimum disc size; MOON_K 1.2; MOON_AMB 1.0; MOON_DIM 0.6.
- The moon column ratio after the fix is 1.126 against the 1.25 limit (smaller margin than the sun's 0.985).
