Create **$ARGUMENTS** new games in this repo (if no number was given, default
to 2). This is the standing overnight game-batch commission; run it end to
end without waiting for mid-task input beyond the one question round below.

## The commission

- Each game goes in the `games/` directory, **in its own subdirectory**
  (`games/<slug>/index.html`), as a single self-contained web game per the
  shared conventions in `games/CLAUDE.md` (palette, fonts, Canvas 2D loop,
  WebAudio-synth audio, build badge — the whole table).
- Each must be **unique** — from the other games in this batch and from every
  game already in the repo. Uniqueness is measured, not vibed: read
  `.claude/games-index.md` § Coverage summary first and pick concepts from
  **absent or rare** facet values (aim: new on ≥2 axes per game — genre ×
  input × session shape). Vocabulary reference: `templates/design/game-facets.md`
  in the zmhstudio repo, if checked out.
- They must be **fun on mobile, iPhone 13 especially** (390×844 @3x):
  touch-first input, one-thumb where the concept allows, safe-area-aware
  HUD, no hover dependence, 60 fps.
- Use the zmhstudio plugin commands where they apply (this repo carries a
  producer config at `.claude/zmh/producer.md`); skip them where they don't
  — building games directly per this repo's SOP is the normal path.

## Question round (once, up front)

Propose ~$ARGUMENTS+2 candidate concepts drawn from the coverage gaps and
ask the CD to pick $ARGUMENTS via AskUserQuestion (multi-select, your
recommended picks first and marked). This mirrors "ask questions now if you
have them" — one round, then fully autonomous. If the answer is a dismissal
or the question can't be asked, proceed with your recommended picks.

## Build (per game, full checklist in games/CLAUDE.md § Adding a New Game)

1. `games/<slug>/index.html` — self-contained, mobile-first.
2. Hub card in `games/index.html` (unique icon emoji — check existing cards).
3. Build-timestamp badge, stamped via `.claude/scripts/stamp-badge.sh` as
   the last pre-commit step.
4. `.claude/<slug>.md` architecture notes + a row in the game-context table
   in `CLAUDE.md`.
5. Row in `.claude/games-index.md` **and refresh its coverage summary**.
6. Inventory entry in `games/CLAUDE.md`.

## Verify before shipping (never ship untested)

- Hard gate: `node .claude/scripts/smoke-mobile.cjs` on every changed page —
  require `SMOKE: GREEN`.
- Gameplay-driving tests at the iPhone 13 viewport per
  `.claude/notes/20260724-headless-mobile-game-testing.md`: real touch
  input, deterministic scenario checks (win/lose/score/persistence), and a
  max-speed physics sweep for anything with a ball or projectile. When a
  forced test fails, first check whether the test setup is wrong — the
  note's trap list exists because the game has been right before.
- Screenshot each game mid-play and send the screenshots with the report.

## Ship

- Commit with Conventional Commits. **Branch/merge/push targets come from
  the invocation context** — the CD supplies integration instructions
  (e.g. "merge/push to main") as follow-up alongside this command; honor
  those over any default. Absent any, this repo's CLAUDE.md allows pushing
  `main` directly.
- After the push that publishes: verify the "pages build and deployment"
  workflow run for that SHA concludes **success** (`git push` ≠ live), per
  `.claude/zmh/producer.md` § Publish.

## Report (written for someone reading it 8 hours later)

Lead with what shipped and where to tap to play. Include: each game's name,
one-line pitch, which coverage gaps it fills, the exact build-badge
timestamp string (so live pages can be checked against it), test results,
commit SHAs, and deploy verification. Note any judgment calls. If
`/zmh-producer:refine-context` is warranted (non-obvious learnings beyond
the per-game docs), say so rather than silently skipping it.
