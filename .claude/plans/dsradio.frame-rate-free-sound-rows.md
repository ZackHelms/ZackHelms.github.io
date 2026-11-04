# dsradio - Driving Simulator: the radio's test rows stop depending on the frame rate

**Status:** DRAFT
**Drafted on** `main` at `ab33aed` (suite 157 checks, break list 76). Every `file:line` below was read
on `ab33aed`; re-grep each anchor before editing, as another session may land first.
**Requested:** 2026-11-03, the CD, on the radio rows flapping in the dssky ship step (verbatim):

> sounds fine to me

So this is a note, not a game change: fix the measurement, not the radio. Source TODO entry:
`TODO.md` section Later, "[driving-sim] Make the radio's test rows independent of the test machine's
frame rate". Trace: `.claude/plans/DONE/dssky.horizon-stars-moon-sliders.md` step 7 Results.

**Scope:** the suite `.claude/tests/drive-driving-simulator.cjs` (section 9's sampler and the
stations row), the break list `.claude/tests/negtests/driving-simulator.json`, and the docs
`.claude/driving-simulator.md`, `.claude/tests/README.md`, `games/CLAUDE.md` (the suite's count in
the Driving Simulator paragraph), `TODO.md`, `DONE.md`. **`games/driving-simulator/index.html` is
not edited** (the breaks in step 2 touch copies only).

> CD note: this template exists to make plans executable by
> `/zmh-producer:oversee-implementation` (zmh-producer plugin, configured via
> `.claude/zmh/producer.md`) - the "Implementation guidance" section is what
> the overseer reads to assign models/effort and to make decisions without
> asking.

## Goal

Section 9's sound rows and the stations row read the same levels on a phone, on a fast desktop and
on this container's software renderer at a second a frame. Each of their sampling windows holds the
live loop and steps the sound scheduler from a 50 ms timer with `Math.random` seeded, as section 9a
already does for the seasons, and a new row proves every window really ran that way. The rows'
wording and bands do not change. Three new breaks prove the converted rows still catch a silent, a
quiet and an untrimmed radio.

## Context

- **The cause (traced, dssky step 7).** The radio is queued from `SND.update()` only 0.4 s ahead:
  `games/driving-simulator/index.html:3997-4001` (`if (nextBeat < t) nextBeat = t + 0.1;` then
  `while (nextBeat < t + 0.4) { BEATS[st](...) }`). `SND.update(dt)` is called once a frame from
  `frame()` (`:4384`). When a frame takes about a second (SwiftShader here), beats in the gap are
  never scheduled, so the music probe reads quiet against the engine, whose oscillators run
  continuously. `__DS.setPaused(true)` stops `tick()` only (`:4373`); frames, and `SND.update`, still
  run. On a phone the queue never runs dry; the CD hears no fault.
- **The ambient is queued the same way**, 0.3 s ahead from the same call (`:3976-3993`).
  Untraced hypothesis: the ambient bed row's one low read (0.049x against 0.05, dsseasons step 4)
  has the same cause. It shares the converted window, so it is covered either way.
- **Extra `SND.update` calls are harmless.** It schedules against `ac.currentTime` and never uses `dt`
  for timing; beats and birds advance by time, not by call (`:3953-4002`). `S.tune()` restarts the
  radio at beat 0, 0.3 s on, with a 0.3 s burst of static on `ch.music` (`:4132-4139`).
- **What draws dice in a radio window:** `noiseHit()`'s buffer offset `s.start(t, Math.random())`
  (`:4086`, used by every station's hats) and the ambient's birds (`:3981-3983`).
- **The sampler.** `lv(keys, secs = 2)` (suite `:1760-1762`) reads `S.rms(k)` every 50 ms by
  `setTimeout` and returns each key's root-mean-square over the reads. Section 9's rows use it at
  `:1767` (`lvOn`), `:1769` (`lvOff`), `:1772` (`engOff`), `:1774` (`engHalf`); the rows are
  `:1776-1780`. The stations row tunes each station, waits 800 ms and reads `lv(['music'], 8)`
  (`:2046-2054`). **Section 9b also uses `lv`** (`:1873-1976`) and its `settle()` waits on voices
  the frame loop updates: 9b must keep `lv` as it is.
- **The pattern to copy is section 9a's `ambWin`** (`:1782-1817`): before the window, swap
  `window.requestAnimationFrame` for a stub that keeps the callback (`held`), wait until the queued
  frame has run once and been held, seed `Math.random` (mulberry32 at `AMB_SEED`, `:1791`), run
  `S.update(0)` from a 50 ms `setInterval`, sample, and in `finally` clear the interval, restore
  `Math.random` and `requestAnimationFrame`, and re-queue `held`. JavaScript has one thread, so a
  timer cannot fire during a one-second frame: **holding the loop is what makes the timer work.** A
  timer alone, with frames still drawing, would not fix the rows.
- **Why the rows matter.** In dssky's ship step the gates went red six runs of six on these rows;
  across that session's 48 suite runs they were all green in 12. DS-3's plan carried "red only on
  the known rows counts as green" for the same reason. `.claude/driving-simulator.md:1255-1259`
  ("A known flake (untraced hypothesis)") and `.claude/tests/README.md:308` ("Under load its sound
  rows ... can flap") both still call it untraced.
- **Measured levels** (`.claude/driving-simulator.md:1310-1313`): the radio about 0.5-0.75x the
  engine at half throttle; the stations untrimmed 0.0515 / 0.0569 / 0.0372 / 0.0335, trimmed
  (1.0 / 0.9 / 1.38 / 1.54, `index.html:3845-3850`) 0.049-0.054.
- **The break list** has no radio break today (76 entries, none naming music, radio or a station).
  An entry is `{ name, row, file, old, new }` with `/* @negtest */` in `new` (first entry of the
  file). Three anchors were checked unique in the page: `bpm: 76, trim: 1.54`,
  `music.gain.value = 1.5;` and the whole `while (nextBeat < t + 0.4) { ... }` line at `:4000`.

## Implementation guidance (for the overseer)

Profile: **balanced** (assumed: this repo has no task-scoping skill, `.claude/zmh/producer.md`
section Plans). One task per step; each is one commit on the plan's branch.

| # | Task | Category | Model | Effort | Rationale |
| - | ---- | -------- | ----- | ------ | --------- |
| 1 | `lvT` (held loop, timer, seed); section 9's windows and the stations row on it; the method row; the slow-frame proof | tests | opus | high | a measurement that must be shown frame-rate free, with a held-loop trap that silently falls back to the old behaviour |
| 2 | Three radio breaks; docs (the flake paragraph, the method row, counts) | eval+docs | sonnet | high | breaks with exact anchors given below; docs restate a traced cause |
| 3 | Ship: gates, land on `main`, Pages, TODO/DONE, report | ship | sonnet | medium | the documented procedure |

- **Ordering:** 1 -> 2 -> 3. Nothing in parallel (one suite).
- **Files owned per task:** 1: the suite; 2: the break list, `.claude/driving-simulator.md`,
  `.claude/tests/README.md`, `games/CLAUDE.md`; 3: the plan's move to `DONE/`, `TODO.md`, `DONE.md`.
- **Validation per task:** `.claude/scripts/gates.sh games/driving-simulator/index.html` at the end of
  every step, **run alone** (check `uptime` first; producer config section Environment). After step 1
  the gates must be GREEN with no exception for the sound rows: the "red only on known rows"
  allowance of DS-3's plan ends here. The perf block's row may still flap under load (out of scope);
  if it is the only red, re-run once alone and record both runs.
- **Tier audit (required):** no step passes a haiku checklist. Step 1 designs a measurement and
  proves it under slow frames: opus, high. Step 2 is exact anchors plus prose that must not
  overclaim: sonnet, high. Step 3 is the procedure but pushes to `main`: sonnet, medium.
- **Decision defaults:**
  - **The page is not edited.** No trim, gain, horizon or scheduler change, even where it would make
    a row pass (the CD: the radio sounds fine; the TODO entry: "Fix the measurement ... not the
    radio"). No badge stamp, since no game file changes.
  - **A new sampler beside `lv`, not a changed `lv`.** 9b keeps `lv`. Name it `lvT`.
  - **`lvT` keeps `lv`'s aggregate** (root-mean-square of the 50 ms reads), so the rows' bands keep
    their meaning; 9a's plain mean stays 9a's.
  - **A lead-in before sampling:** start the timer, then wait 1 s before the first read, so the
    radio's 0.4 s queue and the ambient's 0.3 s are full when the window opens.
  - **The seed:** `AMB_SEED` (20261103), the same constant 9a uses. It is declared at `:1791`, after
    section 9's first windows run: move its declaration up to section 9's head (same value) rather
    than reference it early (a `const` read before its line throws). 9a's figures must not move.
  - **The stations row** keeps `tune()`, the 800 ms wait and 8 s windows, each window through `lvT`
    with the seed reset per station (so every station hears the same dice).
  - **If the unbroken page fails a band under `lvT`**, do not move the band. For the stations row
    only, first re-measure each station over one whole loop of its own from beat 0 (32 steps:
    lo-fi 84 bpm 11.43 s, synthwave 104 bpm 9.23 s, jazz 132 bpm 7.27 s, classical 76 bpm 12.63 s;
    step = 60 / bpm / 2) and, if that holds, use it and restate the row's wording ("over a whole
    loop"), logging the change. Any other band failing on the unbroken page is an escalation (below).
  - **A choice not listed here** becomes a row in `.claude/driving-simulator.md`'s "Assumed, not
    decided" table, marked dsradio.
- **Embedded-content QA.** Suite: 157 + 1 (the method row) = **158**; no row removed, the six
  converted rows keep their text unless the stations fallback above fires. Break list: 76 + 3 =
  **79**. If another session lands rows first, state the real numbers as start + 1 and start + 3.
- **Escalation triggers:** under `lvT` the unbroken page reads outside a row's band (other than the
  stations row's whole-loop fallback): stop and report the measured levels, since moving a band or
  retuning the radio is the CD's call. Also stop if the held loop cannot be made to hold in this
  harness (the method row cannot pass on the unbroken page).
- **Playtest:** none. No game file changes, so nothing on the phone moves.
- **Publish:** step 3 pushes `main`, which is the publish (no player-facing change; the Pages run is
  still verified, as every push to `main` deploys).
- **Commit strategy:** one conventional commit per step on the plan's branch (`ds-radio-rows`, or the
  branch your session may push to), scope `driving-simulator`, ending "(dsradio step N)". Step 3
  lands the branch on `main` as one commit with `.claude/scripts/land-on-main.sh`, dry-run first.

## Steps

### Step 1 - a sampler that holds the loop; the proof under slow frames

- **First, the baseline.** Run `gates.sh games/driving-simulator/index.html` alone on the base and
  record which rows are red (the sound rows may or may not be, depending on the machine's load).
- **`lvT(keys, secs = 2)`** in section 9, after `lv` (`:1760`), by 9a's pattern (Context): hold the
  loop, seed `Math.random`, `S.update(0)` once and then every 50 ms, lead-in 1 s, then `secs * 20`
  reads 50 ms apart, root-mean-square per key; `finally` restores everything and re-queues the held
  frame. It also returns `{ frames, steps }`: `frames` counts calls to the rAF stub after the hold
  took (each `frame()` calls `requestAnimationFrame` first, so a call is a frame drawn) and must be 0
  over the lead-in and the window; `steps` counts the interval's `S.update(0)` calls.
- **Convert** `lvOn`, `lvOff`, `engOff`, `engHalf` (`:1767-1774`) and the stations loop's reads
  (`:2051`) to `lvT`. The `page.waitForTimeout` settles before them stay (gains settle on the audio
  thread). Move `AMB_SEED` to section 9's head. 9b is untouched.
- **One new row** after the stations row (the last `lvT` window), collecting every `lvT` result:
  `ok('the sound windows of section 9 and the stations ran with the frame loop held and the scheduler on its timer (no frame drawn, at least 15 steps a second)', ...)`,
  failing if any window had `frames > 0` or `steps < 15 * (lead + secs)`, with the per-window
  figures as its detail. A window that never held must fail here, not skip (`games/CLAUDE.md`, "A
  check that can skip").
- **The slow-frame proof** (the point of the plan; into the Results, not the suite). Make a copy of
  the page with a busy-wait at the top of `frame()` (`index.html:4367`):
  `const _b = performance.now(); while (performance.now() - _b < 900);` Build a scratch harness from
  the suite's own boot and section 9 through the stations row, copied verbatim (as DS-2 and DS-3 did
  for their breaks; say so). Run it with `DS_PAGE` pointing at the slow copy:
  - with the **old** samplers (`lv` everywhere): at least one of "the radio sits near it" and "all
    four stations ... within 25%" must go red. If neither does at 900 ms, raise the wait to 1500 ms
    and record it. This proves the harness reproduces the fault;
  - with **`lvT`**: every converted row and the method row green, **five runs of five**;
  - with `lvT` on the unbroken page: green, and record the levels (radio vs engine, the four
    stations, ambient vs engine) beside `.claude/driving-simulator.md:1310-1313`'s figures.
- Gates: GREEN alone, with no sound-row exception. Expected total: start + 1 (158).

### Step 2 - the breaks and the docs

- **Breaks** (`.claude/tests/negtests/driving-simulator.json`, 76 now), each with its `row`:
  - `radio-unscheduled`: old `while (nextBeat < t + 0.4) { BEATS[st](nextBeat, beat++, step); nextBeat += step; }`,
    new `/* @negtest */`; row `the engine is audible and the radio sits near it (0.5-1.6x the engine)`.
  - `radio-quiet`: old `music.gain.value = 1.5;`, new `music.gain.value = 0.4; /* @negtest */`; the
    same row (the radio about 0.13-0.2x the engine).
  - `station-untrimmed`: old `bpm: 76, trim: 1.54`, new `bpm: 76, trim: 1.0 /* @negtest */`; row
    `all four stations play and sit within 25% of each other` (classical untrimmed about 0.65x the
    others).
  Run them on copies with `negtest-copies.py ... --page-env DS_PAGE --only <names>` in the
  foreground, alone, or through step 1's harness (passed on the unbroken page first; say which). Each
  must be caught by its named row. **Also run `station-untrimmed` and `radio-unscheduled` against the
  slow copy's harness**: a break caught only on a fast machine is not caught (the reason for this
  plan). A MISSED break gets a row or an argued equivalence in the Results.
- **Docs:**
  - `.claude/driving-simulator.md`: replace "A known flake (untraced hypothesis)" (`:1255-1259`) with
    the traced cause and what the rows do now; the perf block's row stays a known flake, still
    untraced. Add an "Assumed, not decided" row for `lvT`'s method beside 9a's (`:92`): the lead-in,
    the aggregate, the seed. The measured levels from step 1 under section Measured (`:1310-1313`).
    The count on `:6` (158). Section Testing: the method row and the three breaks.
  - `.claude/tests/README.md:308`: the count (158), the break count (79), and "Under load its sound
    rows ... can flap (untraced hypothesis ...)" restated: section 9's rows and the stations row hold
    the loop and step the scheduler on a timer; the perf block's row can still flap.
  - `games/CLAUDE.md:1165`: the count (158).
- Gates: GREEN alone.

### Step 3 - ship

- `gates.sh games/driving-simulator/index.html` alone, GREEN. No badge (no game file changed); say so.
- Move this plan to `.claude/plans/DONE/`, Status `IMPLEMENTED <date>`, with a Results section.
- Land with `land-on-main.sh` (dry run first). Message:
  `test(driving-simulator): the radio's rows no longer depend on the frame rate` with the session's
  trailers. If `behind`, merge `origin/main` into the branch, re-run the gates, check the other
  session's files survived.
- `TODO.md`: the entry to `DONE.md` (no badge; name the suite count).
- Verify the Pages run for the landed SHA (`mcp__github__actions_list`, `resource_id '266280069'`,
  `perPage 1`; match `head_sha`, read the jobs; two checks, then report).
- Report: the slow-frame proof (old samplers red, `lvT` five of five green), the levels, the breaks.

## Gotchas / bindings

- **A timer cannot rescue a busy thread.** With frames still drawing, a 50 ms `setInterval` waits
  out each one-second frame and the queue still runs dry. Hold the loop first (9a's stub), then run
  the timer. The method row exists because a hold that silently fails falls back to exactly the
  measurement this plan replaces, and stays green on a fast box.
- **Always give the loop back.** Restore `requestAnimationFrame` and re-queue the held frame in a
  `finally`, or every later section (10's FPS rows wait on frames) hangs or reads FPS 0.
- **`AMB_SEED` is a `const` declared after section 9** (`:1791`); reading it from `lvT` before that
  line throws. Move the declaration, do not duplicate the number.
- **Do not touch `lv`.** 9b's `settle()` and its rows depend on the frame loop updating the voices.
- **Do not edit the page** to make a row pass (Decision defaults). The breaks touch copies only.
- **Two `Math.random` users in a radio window** (the hats' noise offset and the birds): seed both by
  seeding `Math.random` itself, as 9a does; restore it in the `finally`.
- **`tune()` plays 0.3 s of static on the music channel** (`:4138`); the 800 ms wait and the 1 s
  lead-in keep it out of the window.
- **Run the gates alone** (`uptime` first). Never count a catch only a timed row made under load.
- **Commit hygiene:** explicit pathspecs, never `git add -A`. No model names in commits or files.

## Validation

`gates.sh` at the end of every step, alone, GREEN with no sound-row allowance; the slow-frame proof
in step 1 (old samplers red, `lvT` green five of five, the unbroken page green); the three breaks in
step 2 caught by their named rows, on the unbroken harness and on the slow one. No playtest: nothing
the player hears or sees changes.

## Follow-ups

- Inferred, not run: the stations row compares levels only, so `station()` returning 0 whatever is
  selected (four identical stations) would pass it. A row that the four stations differ (for
  example their spectra) would close that; not in this item.
- The perf block's row still reads wall-clock FPS and can flap under load (untraced).

## Handoff

```
/compact
/zmh-producer:oversee-implementation .claude/plans/dsradio.frame-rate-free-sound-rows.md
```
