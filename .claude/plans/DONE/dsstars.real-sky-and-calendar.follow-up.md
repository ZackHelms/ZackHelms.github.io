# dsstars follow-up - oversee run of 2026-11-01

Run outcome: **partial**. Step 1 of 5 (the calendar and the sun from the date) is built, gated GREEN
(suite 78 -> 86) and pushed to `claude/brave-sagan-odwmrd`. The run stopped at step 2 on the plan's
first escalation trigger. Nothing of the game reached `main`.

## Blocked - needs you

**Resolved 2026-11-02, no action needed:** the CD shipped zmhstudio's `zmh-sky` kit, which carries
its own star catalogue, and the plan was revised to use it, so nothing is downloaded and the host
below no longer matters. The record of the block is kept as it was:

- **The catalogue host is still refused.** `https://cdsarc.cds.unistra.fr/ftp/V/50/ReadMe` was tried
  once at 19:05 UTC (in a container 3 minutes old, so started after your "Allow the host" answer)
  and once at 20:17 UTC. Both times the agent proxy answered 403 to CONNECT. Its status page listed
  the host under `recentRelayFailures` as `connect_rejected` ("gateway answered 403 to CONNECT
  (policy denial or upstream failure)"). Per the plan, no other host or package was tried.
  - To fix: in the environment's settings (the cloud environment menu in the session's title bar,
    then Edit), under Network access, either choose a broader access level or add
    `cdsarc.cds.unistra.fr` under Allowed domains, leaving "Allow package managers" ticked. Docs:
    https://code.claude.com/docs/en/cloud-environments#network-access. The change reaches new
    sessions, not running ones.
  - Then, in a new session: `/zmh-producer:oversee-implementation .claude/plans/dsstars.real-sky-and-calendar.md`.
    The plan's Resume section tells that run to start from `claude/brave-sagan-odwmrd`.

## Decisions made on your behalf - review

- **Branch.** The plan names `ds-stars` for the step commits. This session may push only to its
  designated branch, `claude/brave-sagan-odwmrd`, so step 1 is there. The plan's Resume section and
  the `TODO.md` entry now say so.
- **The worktree was made by hand** (`git worktree add`, branch `worktree-oversee+dsstars`). This is a
  multi-repo session, whose working directory is not a git repository, so `EnterWorktree` could not be
  used. It is kept at `.claude/worktrees/oversee+dsstars` in case this session resumes.
- **Docs to `main`, the game not.** The plan keeps the page off `main` until step 5. This plan file,
  this follow-up and the `TODO.md` entry went to `main` as a docs-only commit, so a new session finds
  the partial state there. Their text is identical on the branch.
- **One comment corrected by the overseer.** Step 1's settings comment said the saved date "carries the
  moon's phase between visits". The moon is still the placeholder rule until DS-4. The comment now
  says the date comes back on the next visit.
- **Step 1's own assumed choices** are listed in the plan, under "Step 1 results", "Assumed". The main
  ones: `SEASON_DATES` rows are `[first, last, middle]`; the hour skipped on the spring-forward day
  reads as EDT; `dst` is re-derived for 00:00 at each date step; the Date gets **its own row** in TIME
  at every width (inside the Time-of-day row it measured 50 px too wide at 320 px); the first-visit
  row accepts 13.0-13.5 because the live loop runs a few frames before the suite pauses it. Step 4
  moves them into `.claude/driving-simulator.md`'s Assumed table.
- **Profile:** the plan was drafted at balanced (assumed), and the run used balanced (this repo has no
  task-scoping skill). The plan's tiers were not changed.

## Deferred / discovered follow-ups

- **Step 4's break list will be slow.** The step 1 implementer ran a `negtest-copies.py` of eight
  breaks at `--jobs 4`, and it printed no verdict within 10 minutes; a solo suite run takes about
  2.4 min. Hypothesis, not traced: SwiftShader suites in parallel slow each other well past the
  job count. Step 4 should run `--jobs 2` in `--only` batches of about 3 (under the ~9 minute
  chunk rule in `.claude/zmh/producer.md` § Environment).
- Ledger: none (the config names no metrics ledger). Step 1: opus, high effort, first pass green,
  interrupted once by a usage limit and resumed warm with SendMessage; one overseer fix (the comment).

---

# dsstars follow-up - oversee run of 2026-11-02 (steps 2-5)

Run outcome: **done**. Steps 2-5 built on the worktree branch `worktree-oversee+dsstars`, cut from
`origin/claude/brave-sagan-odwmrd` (d47bc1d, step 1 plus the revised plan), pushed to that branch
after each step, and landed on `main` as one commit. Suite 86 -> 108, break list 25/25.

## Blocked - needs you

Nothing.

## Decisions made on your behalf - review

- **The sky was mirrored, and the plan was wrong about it (traced).** The plan (my 2026-11-02
  revision) said the kit's ENU `[east, up, north]` is the page's x, y, z with no remap. `M4.look`
  builds screen-right as `f x up`; facing +z that is (-1, 0, 0), so +x (east) drew on the LEFT. The
  page's world is (east, up, south). Every sky the game has drawn was a mirror image, step 1's sun
  included. The kit's own skill says this (Conventions, Handedness: "A host frame that is
  right-handed (x east, y up, z south) flips one axis ... map it explicitly"). Step 3 found it on
  screen (the sun 17 deg left of centre where the real sky has it 17 deg right) and added
  `enuToWorld(v) = [v[0], v[1], -v[2]]` where values go to the GPU (`SKY.sunW`, `moonW`,
  `starW = W * starM`); `SKY.sun/.moon/.planets/.starM` stay ENU. Side effect: the daytime sun glow
  and the light direction moved to their real, mirrored-back side.
- **Gains:** `STAR_GAIN = 3.2` (at 1.6 Spica peaked at luminance 118, not white); `MW_GAIN = 0.012`,
  the kit's peak (on-band patch 32.8 against 19.5 off it, faint). Both one constant each.
- **A 0.5-px minimum star width.** The kit's point profile is under 0.4 px wide for faint stars, so
  they came out at about a fifth of the law's brightness; from about 2.8 px up it is exactly the
  kit's. Worth a note to zmhstudio (below).
- **Five rows beyond the plan's 13 + 4** (suite 103 -> 108), each added because a step-4 break was
  missed or caught only incidentally: the Milky Way all round the sky (36 patches), the planet
  vertices read back from the GPU after a date step, Capella hidden under the skyline, the stars
  fading with the night, and the sun drawn where it is.
- **Step 2's commit and step 5 were done by the overseer.** Step 2's implementer stopped short of
  committing because its gate runs were red on sound rows (below); the overseer re-ran the gates on a
  quiet machine (GREEN, 90), wrote the Results and committed. Step 5 is the documented procedure and
  the same work as the oversee wrap-up, so it ran without a separate sonnet implementer.
- **One overseer fix:** `updateSky()`'s comment still said "no remap" after step 3's flip; corrected
  (ed140fa).
- **Profile:** balanced, as drafted. No tier changes.

## Deferred / discovered follow-ups

- **The sound and perf rows go red under machine load.** With a second Chromium suite running, the
  engine/radio level, engine slider and four-stations rows (and the perf block's FPS row) failed in
  almost every run; alone, they pass. The step-1 page failed the same way under the step-1 suite, so
  it predates this arc. Hypothesis, not traced: they measure over wall-clock time. Until traced, run
  the gates alone, and never count a sound-row "catch" in a break list.
- **For zmhstudio (zmh-sky), a report, not an edit from here:** `STAR_FRAGMENT`'s point profile is
  under 0.4 px wide for faint stars, which drops them to about a fifth of `starAppearance`'s
  brightness at 1-2 px point sizes; the kit's demo hides it by drawing 2-6 px stars.
- **A whole-frame difference in 2 of 8 loads** (old and new page alike) during step 3's
  byte-identity check, from the world's state when the suite pauses. Hypothesis, not traced; the
  sky pass alone was byte-identical in 15 day views.
- **The suite now takes 2.5-5 minutes solo** (the plan said 2.4), and a pair of broken copies 6-7
  minutes.
- Re-sweep DS-2, DS-3 and DS-4: `/zmh-producer:backlog-plan-gen driving-sim`.
- Ledger: none. Step 2: opus high, built green but uncommitted (load flake), interrupted once by the
  usage limit and resumed warm. Step 3: opus high, first pass green, one overseer comment fix. Step
  4: opus high, first pass green, interrupted once by the usage limit and resumed warm. Step 5:
  overseer.
