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

- [taas] **Play Robot factory v2** (shipped 2026-10-26; the mode dropdown's third choice, or
  `games/taas/factory-v2.html`; built with no Q&A, as asked). Check: the planer running by itself
  from its hopper; the dump truck's tail tipping ten logs into the raw materials bin when it is empty;
  buying a robot at the terminal and watching it ride the elevator up, and sending one down; a
  robot's page: tap the main prompt, then a source and a destination on the floor; build lines in
  the sentence builder and reorder them (try "Recycle any sap logs" above and below "Only take medium
  logs"); a nonsense line and the slip figure. Then answer the eight open questions in `.claude/taas.md`
  section Robot factory v2, most of all **1: the word lists** (your prompt stopped before them; the
  four lists are a guess), **2: the long haul** from the raw materials bin to the planer's hopper
  (one robot carrying one log a trip cannot keep a stall stocked; two carrying six can), and
  **3: the truck only comes for an empty bin**, so an "Only take" robot that leaves logs behind stops
  the deliveries. Overrule anything in its 27-row assumed table.

- [taas] **Play the goals arc** (shipped 2026-10-21, `build 2026-10-21 12:04 UTC`; start over or a new
  save for a new factory, an old save counts as all goals met). Check: one stall and only slot 01 at
  the start; "Sell 50 medium planks" counting down and the sap extractor arriving in slot 02; goal 2's
  countdown, and starting over when satisfaction dips; the bench in 03; "Sell 25 sap" and the saw in
  04; a stall's Re-assign / Re-stock / Close and the zzz; the green dots; putting things in output bins
  for the robots; a plank in the planer's input bin jamming it under a robot; Prices in the menu. Then
  answer open questions 16-19 in `.claude/taas.md` (most of all **19: is $1 the default you want**? At
  $1 five of the eval's lessons change, operator-first is no longer a trap, and Tip 3 is no longer
  shown), and overrule what is wrong among the 31 new assumed rows (the ones most worth a look are
  listed in `.claude/plans/DONE/taasgoals.goals-arc.follow-up.md`).

- [cyoa2] **Try step 4 on two phones.** Host: Menu > Players > Invite a player.
  Guest: point the camera at the code, open the link, type a name, and show the
  code that appears to the host's camera; on the host, go back to the game's tab.
  It has only ever met two browsers on one machine. What only phones can answer:
  does Safari take the connection at all (inferred: yes, it is standard WebRTC);
  do two iPhones on one Wi-Fi find each other with no server (inferred: yes, by
  their .local names, not checked); does the camera's link open as a second tab
  that hands the code to the game's tab; and does a guest that locks its screen
  come back on the same line. Also overrule what is wrong in the new "assumed"
  table for step 4 in `.claude/cyoa2.md` (most worth a look: any guest may roll
  initiative, only the host rests or stands down; guests read the notes and
  ratings but cannot change them; a model's words reach a guest when the telling
  is done, not as they stream).

- [taas] **Play the robot factory** (TAAS's mode dropdown, or `games/taas/?mode=robot-factory`)
  and overrule anything in its "assumed, not decided" table (`.claude/taas.md` § Robot factory
  mode); then say what comes after prompt engineering (its four open questions suggest the
  next rungs: context binders, an in-feed filter, a maintenance robot) and what the bays hold.
- [taas] **Answer the four open questions** in `.claude/taas.md` § Open questions:
  should a well-played year 1 be able to hit 240 (today only "stance + workshop,
  nothing else" does), one aggregate team level or a champions-to-skeptics spread,
  random events on top of the scripted story, and keep the planning-board look or
  restyle in Neon Arcade. Then overrule anything wrong in its "assumed, not decided"
  table; every number in the engine is a first-draft guess.
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
- [cyoa2] **Turn on the OpenAI voice and listen.** Settings > Voice > Narrator >
  "OpenAI voice (GPT api key)". If CYOA has your OpenAI key on this device a
  button offers to take it; otherwise paste it, then "Hear it". It has only
  ever met a stand-in here: **no request has gone to OpenAI**. What only your
  key on your phone can answer: does it sound like CYOA's (Cedar, the same
  direction); how long before the first sentence; does Pace change it; does
  the phone's silent switch mute it (inferred: yes, as it would CYOA's). The
  cost (the Costs button beside "Hear it") is an estimate on CYOA's figures,
  never set against an invoice.
- [cyoa2] Overrule what is wrong in the new "assumed" table for the paid voice
  (`.claude/cyoa2.md`, "The paid voice"). Most worth a look: the device's
  voice is **still the default**; **one sentence that fails is read by the
  device's voice** and only a refusal or three failures running hand it the
  rest (CYOA gives up at the first); **OpenAI only**, no ElevenLabs; the
  narrator dropdown's wording, which copies yours; and the words on the five
  dropdowns you asked to have shortened, which are mine: "Scripted" / "AI",
  "Off" for typed lines, "By hand" for the monsters.
- [cyoa2] **Hear it on your phone.** The narrator and the microphone have only
  ever met stand-ins: a headless browser has no voice and cannot listen. Four
  things only a device can answer. Does the opening speak on the first new
  tale after a fresh load in Safari? Which voice did it pick (Settings > Voice
  lists them best first; on an iPhone "Whatever this device is set to" may
  sound better than anything Safari lists)? Does a tap on the story silence it
  at once? Does the microphone work at all in your browser (it shows only
  where Claude reads the line)?
- [cyoa2] Say if the narrator should be **off** until asked for. It is on by
  default because CYOA's is; one tap on the speaker beside the story turns it
  off for good. Other calls in the same table that are yours to overrule
  (`.claude/cyoa2.md`, the second push's "assumed" table): it reads tellings
  but not dice lines; an answer interrupts, a beat waits; the words do not
  wait for the voice; no microphone at the script's table.
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

- [taas] **Demand in the robot factory** (the CD, 2026-10-16: "Will deal w
  this later"). Customers come one every 8-16 s whatever happens. Should fewer
  come when customer satisfaction is low, and more when it is high? That would
  also break the slide where a long line drops satisfaction, prices fall with
  it and the money for instructions never comes. Needs the CD's design first.
  Source: `.claude/taas.md` § Open questions for the CD (factory), 3.

- [cyoa2] Trace why section T's **Continue row loses its key** across the
  reload when three whole suites run at once (16 times in the 2026-10-13
  negative-test pass; it passes on a quiet machine). Until then a break
  "caught" only by that row, or by section 2's pairing under the same load, is
  noise, not a catch (`.claude/cyoa2.md` § Tests, the second pass).

## Icebox

- [phasic] Seed browser / level-code entry for the endless space.
