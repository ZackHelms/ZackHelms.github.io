# TODO — ZackHelms.github.io backlog

Buckets in order: In progress · Now · Needs Zack · Next · Later · Icebox.
Done log: `DONE.md`. Created 2026-07-31 scoped to **Phasic** — other work
in this repo is tracked per-game in `.claude/<game>.md` until it earns a
backlog entry here.

## In progress

- (none)

## Now

- (none)

## Needs Zack

- [repo] Delete the remote branch **`cyoa2-step3`** (GitHub > branches). It is
  a safety copy pushed mid-session on 2026-10-10 (`8020174`, work in progress);
  everything in it shipped in `3ea55c4` on `main`. A remote session cannot
  delete it: the agent proxy refuses ref deletion and API writes
  (`.claude/zmh/producer.md` § Environment).
- [cyoa2] **Play a tale with only the script** (the default now: no key, no
  cost), then give Claude one area at a time in Settings and play on. That is
  the experiment you asked for. Rate passages with the thumbs as you go, open
  "Script's version" under Claude's, and read Menu > Compare at the end
  (there is a CSV). What I most need to hear: where the script is good enough,
  and where it is not.
- [cyoa2] **Every line the script speaks is mine and you have not read any of
  it**: the four jobs, six whispers, the greetings, small talk, place
  descriptions and the ending (tables `MAIN`, `WHISPERS`, `GREET`, `GANG`,
  `ABOUT`, `IDLE`, `ENTER` in the page's THE SCRIPT section). Rewrite freely;
  the suite checks shape, not wording.
- [cyoa2] Overrule what is wrong in the two new "assumed, not decided" tables
  in `.claude/cyoa2.md` (who runs the table; the script's adventure). The ones
  most worth a look: with only the script at the table **being seen is always
  a fight**; a night is slept **at the inn for a coin a head or in an emptied
  hideout**, nowhere else; **only things in the hideout can be searched**;
  what each whisper does once settled; and the pay (60 gold and 150 experience
  for the job, 75 for a whisper).
- [cyoa2] First play with a real key. Step 3's Game Master has only ever
  answered a stand-in server: no request has been sent to the live API, and
  nothing has been tried on a real iPhone. While there, read the older
  "assumed, not decided" tables in `.claude/cyoa2.md` (no reactions, half
  cover, the script never strikes the fallen, a beaten party wakes at the inn)
  and overrule any that are wrong.
- [cyoa] Say yes or no to a two-line fix in CYOA's client: a reply with no
  words after a tool round is echoed back as an empty turn, which is expected
  to fail that turn (rolled back, nothing lost) where one nudge would have
  saved it. CYOA2 already carries the fix. Not reproduced live.
  `.claude/cyoa.md` § Known, not fixed.

- [phasic·IP] USPTO clearance search for "PHASIC" before filing:
  https://www.uspto.gov/trademarks/search — check live + dead marks in
  Class 9 (downloadable game software) and Class 41 (online game
  services; the web version is arguably 41). Also search the Apple App
  Store for "Phasic" directly. Known name-adjacent actors to clear
  against (found 2026-07-31): **Phasic Labs** (UK indie game developer,
  made "Guide The Light"), **phasicfun.com** (web games portal),
  Mattel's **PHASE 10** family (huge mark, different word but same
  aisle). Gameplay mechanics are not trademark territory — the name/
  logo/slogan are.
- [phasic·IP] Decide: self-file via USPTO TEAS ($350/class base fee, +$200/class
  for a custom goods description; ~4.4 months to first action, ~10-18
  months to registration) vs engage an IP attorney (typ. $500-2000 +
  fees — recommended for the clearance opinion given Phasic Labs).
  Decide filing entity (you personally vs an LLC). Consider filing the
  logo mark too once the 2x2-gem icon ships (phasbrand). File
  intent-to-use (1(b)) now if the App Store launch is months out.
- [phasic·IP] US copyright registration of the game (copyright.gov eCO,
  ~$45-65) — protection is automatic without it, but registration
  before/soon after publication unlocks statutory damages + fees in
  infringement suits.
- [phasic·IP] Reserve the app name "Phasic" in App Store Connect as early
  as possible (name reservations are first-come within Apple's rules; the
  name is unique across the entire App Store — have a backup like "Phasic
  Gems"). *Amended 2026-08-01: the enrollment half is already DONE — the
  account is active (Team `TT479XD8ZL`, distribution cert to 2027-05-10)
  and has shipped TestFlight builds via rn-ios-flightdeck. The reservation
  is step 3 of flightdeck's `apple-app-setup` per-game checklist, handed
  to you in full (with the build + playtest steps) in
  `.claude/plans/DONE/phasport.rn-flightdeck-ios-app.follow-up.md` — the
  app itself imported preflight-green 2026-08-02.*
- [phasic·IP] Source visibility. *Decided 2026-08-01: keep Phasic's source
  public until the App Store submission nears — Pages keeps serving the
  web version, the license carve-out stands, and the iOS copy lives in the
  already-private rn-ios-flightdeck repo. Revisit at submission time
  (going private then = its own plan: Pages restructure / built-output
  only).*

### AGENT-OPP: break-writer (proposed 2026-10-10, not built)

- **What:** an agent that reads a page (or a diff) and writes a negative-test
  break list for it, one-line changes that each delete a rule the page is
  supposed to keep, in `negtest-batch.py`'s JSON format, **without being shown
  the suite**. Then `negtest-copies.py` runs the list and the session writes
  rows for what came back MISSED.
- **Why:** CYOA2 step 3's suite was written by the same hand as the code, in
  the same hour, and was green at 390 checks while 129 of 335 first-pass breaks
  passed it. The breaks were also written by that hand, which bounds what they
  can find. A reader with no stake in the suite is the cheap independent check.
- **Tools:** Read, Grep, Bash (to validate that each `old` anchor is found
  exactly once). No write access to the page or the suite.
- **Draws on:** `.claude/tests/README.md` § Rules a check has to clear,
  `.claude/scripts/README.md` (negtest-batch, negtest-copies), the game's
  context file.
- **Decision for Zack:** worth a `.claude/agents/` home in this repo (it has
  none today), or keep it as a prompt in the tests README?

## Next

- [phasic] Endless launch-board weighting: endless (73+) never draws the
  launch template (block-8 curriculum only, by construction). Decide a
  weighting and wire it in — unblocked 2026-08-29 by the block-8 audition
  passing. Plan-shaped: draft via `/zmh-producer:backlog-plan-gen`.
  Source: `.claude/plans/DONE/phasacro.acrobatics-block.follow-up.md`.

## Later

- (none)

## Icebox

- [phasic] Seed browser / level-code entry for the endless space.
