# TAAS (Team AI Adoption Simulator) - context

`games/taas/index.html` (single file, ~5,200 lines) holds **two modes**, picked from a
dropdown beside the menu button (2026-10-13; the menu replaced the back and mute buttons on
2026-10-14): **Formal** (everything in this file down to §
Robot factory mode; the default) and **Robot factory** (§ Robot factory mode, a playful
cel-shaded take on the same story). The formal mode is a management sim: you run one team
for **eight quarters** (Y1Q1 to Y2Q4), and each quarter you split **60 story points (SP)**
between shipping work and building the team's AI skill, inside a **9,000 AI-credit (AIC)**
budget. The team starts with no AI skill and owes **240 units of work a year**. The
traditional run (all 60 SP on delivery, nothing invested) ships exactly 480 and learns
nothing; the game is whether you can beat it.

Designed with the CD in a claude.ai session on 2026-10-09 (research, a four-question
Q&A, then a playable first draft published as a private artifact named "TAAS"), and
shipped here on 2026-10-12 at the CD's request: 3rd card on the hub, after CYOA2 and
CYOA, with the restrictive licence. **Proprietary** (`games/taas/LICENSE`; one of the
nine protected games). Suites: `.claude/tests/drive-taas.cjs` (the engine's rules, 43
checks, pure node), `.claude/tests/drive-taas-ui.cjs` (the page, 39 checks, Chromium at
phone width) and `.claude/tests/eval-taas.cjs` (balance shape, opt-in); both drive suites
are negative-tested (§ Negative tests). The robot factory has its own three
(`drive-taas-factory.cjs`, 358 checks; `drive-taas-factory-ui.cjs`, 159; `eval-taas-factory.cjs`, 35, about 1.6 minutes;
break lists 216, 148 and 14, section Negative tests (factory)). Since 2026-10-20 a new factory starts with slot 01 and one
stall only, and three goals on the wall unlock the other slots (section Goals that unlock the slots, below). It is a
**first draft the CD is still designing**; most numbers below are guesses waiting for the
CD's tuning.

## The CD's brief (2026-10-09) - stated, do not relitigate

- Name **TAAS**, "team AI adoption simulator". A web app; it would move to a repo once
  the CD decided where (this one, 2026-10-12).
- **8 quarters over two years**, a progress tracker at the top showing Y1Q1 ... Y2Q4.
- The team the player manages has **two resources each quarter: 60 SP and 9,000 AIC**.
- The team **starts with no AI skills**, and **each year needs 240 units of work**.
- **Baseline "traditional" approach:** all 60 SP to regular work, which easily meets
  240 a year, and no SP invested in the team learning AI (training courses, practising
  prompt engineering, personal context files, shared team context, loop engineering such
  as SDK-based specialised agents, graph engineering).
- **One big opportunity or problem per quarter**, the item that gives the biggest ROI
  for SP and AIC.
- As the team's skills improve (the CD named knowledge, quality, flow, trust),
  **new general opportunities open up** for spending a few SP: more prompt practice,
  cultivating context files, beefing up evals.
- The CD asked for research into **existing standards** to add breadth and depth.

### The CD's AI adoption ladder (his framing, his words paraphrased)

| Level | Name | What it means to the CD |
|---|---|---|
| L0 | Traditional | No AI |
| L1 | Light AI | AI search answers, targeted single-line Copilot completions or edits, getting a Linux or PowerShell command |
| L2 | Prompt engineer | AI is like a **new intern** |
| L3a | Context engineer | Most time spent training the AI through context engineering files (instructions, skills); a well-trained intern that still needs frequent hand-holding and review |
| L3b | (context engineering, advanced) | Deterministic-first AI with solid script support and evals; an intern trusted with more and more tasks. The CD asked for L3 to be split into at least two sub-levels |
| L4 | Loop engineer | Hand-crafted MCP-served tools and SDK-based agents with a custom harness; more capable interns that specialise |
| L5 | Graph engineer | How all these assets interact with people in a shared ecosystem. A gray area: futuristic, on the horizon, not something to implement within one or even two years |

The CD described himself as **L3b**, thinking about L4 work he could do with enough AIC
budget and approved scoped tasks. The name "Deterministic-first" for L3b is the
simulator's label, not the CD's (see Assumed, not decided).

### The Q&A (2026-10-09) - stated

| Question | CD's answer |
|---|---|
| Audience | Potentially all of: himself, his leadership, an enablement workshop, the public. **For now a tool for himself to explore and learn**; the next step is using it at work as a fun way to educate people, **including management**. |
| Team model | **Aggregate stats** (one team level plus Knowledge, Context, Quality, Trust, Flow), not named individuals |
| The quarterly opportunity | **Scripted story**: a fixed sequence of eight, easy to tune and teach from |
| Missing the 240 goal | **Score vs baseline**: a miss is a penalty, and the final grade compares the run to the traditional 480 |
| Shipping (2026-10-12) | Add to this repo's arcade, **3rd after CYOA2 and CYOA**, with **the more restrictive licence**, plus this context file |

## Research behind it (2026-10-09)

What the first draft borrows, and from where. Sources are linked from the page's "How
the model works" panel too.

- **DORA AI Capabilities Model (2025).** Seven team capabilities that amplify AI's
  benefit: a clear and communicated AI stance, healthy data ecosystems, AI-accessible
  internal data, strong version control, small batches, user-centric focus, quality
  internal platforms. Four of the eight scripted opportunities come from it (Y1Q1 stance,
  Y1Q3 context repo, Y2Q2 small batches + version control). Not yet used: healthy data,
  user-centric focus, internal platforms (candidate opportunities or events).
  https://cloud.google.com/blog/products/ai-machine-learning/introducing-doras-inaugural-ai-capabilities-model
- **DORA ROI of AI-assisted development (2026).** Adoption follows a **J-curve**: a
  temporary dip (their calculator defaults to 15%) from the learning curve, the
  **verification tax** (reviewing AI output) and downstream pipelines adapting, plus an
  **instability tax** (more rework and failures). Sample payback about eight months.
  These became the learning dip, the flow share and the rework term.
  https://infoq.com/news/2026/05/dora-roi-ai-assisted-dev-report
- **Bassim Eledath, "The 8 Levels of Agentic Engineering" (March 2026).** Tab complete,
  agent IDE, context engineering, compounding engineering (plan, delegate, assess,
  codify), MCP + skills, harness engineering (backpressure from tests and linters),
  background agents, autonomous agent teams. Mapping used: CD L1 = 1, L2 = 2, L3a = 3,
  L3b = 4 plus deterministic-first and evals, L4 = 5 to 7, L5 = 8 (which he says nobody
  has mastered). His **multiplayer effect** (a high-level developer is throttled by a
  low-level reviewer) is why Flow gates how much AI speed survives.
  https://www.bassimeledath.com/blog/levels-of-agentic-engineering
- **Loop vs graph engineering (mid-2026 coinages).** A loop is one agent's plan, execute,
  verify, retry, stop cycle; a graph wires several loops, tools, validators and people
  together with routes and approval gates, and contains loops rather than replacing them.
  "Graph engineering" still has competing meanings (execution topology, interacting
  control loops, knowledge graphs); the sim uses the first.
  https://aman.ai/primers/ai/loop-and-graph-engineering/ and
  https://www.puppyone.ai/en/blog/graph-engineering-ai-agents-map
- **DX AI Measurement Framework.** Utilization, impact, cost. The quarter log and the AIC
  meter follow that split.
  https://getdx.com/ai-measurement-framework/
- **METR randomized trial (2025).** Experienced developers were measured slower with AI
  while believing they were faster (a secondary source says METR later revised the
  slowdown down). That is the **Team says vs Measured** column.
  https://dev.to/thesythesis/the-j-curve-32hn
- **Gartner / MITRE / MIT CISR maturity models.** Organisation-level, four or five
  stages; too coarse to drive a team sim, but familiar labels if the sim is shown to
  leadership. https://aimaturitymodel.mitre.org/

## Assumed, not decided (Claude's choices; the CD has not ruled on these)

| Assumption | Where it lives | Why |
|---|---|---|
| **No slack in year 1.** 1 SP ships 1 unit with no AI, so 60 x 4 is exactly 240, and almost any investment misses the year-1 goal; only "stance + workshop, nothing else" just clears it (240.7) | `CFG`, `LEVELS` | Follows the CD's numbers literally. The CD said the traditional run "easily" meets 240, which may mean they want slack (open question 1) |
| **Miss penalty:** a shortfall is subtracted from the score, and a year 1 more than 10% short (under 216) cuts year 2's budget to 7,500 AIC a quarter | `summary()`, `commit()`, `CFG.budgetCut*` | "Score vs baseline" plus a consequence a manager would recognise |
| **AIC rules:** investments spend first, then AI-assisted delivery burns credits per SP by level; credits short means only part of the work gets AI help; nothing rolls over | `output()` | Makes the CD's remark about needing more AIC for L4 work true in play: at L4 the 9,000 binds unless deterministic-first (25% less burn) was funded |
| **Five stats:** Knowledge, Context, Quality, Trust, Flow | `STATS` | The CD named knowledge, quality, flow, trust; Context added because L3 is about context |
| **L3b named "Deterministic-first"** | `LEVELS[4]` | The CD's L3b description; his own name for it may differ |
| **One level a quarter at most**, and levels never drop (they ratchet) | `forecast()` | Pacing, and no confusing drop after context rot |
| **Skills bought this quarter apply next quarter** | `forecast()` | Makes the J-curve visible quarter by quarter |
| **Score credits the exit run rate**: `(units - 480) - shortfalls + 2 x (exit rate - 60)` | `summary()` | Without it the last quarters' investments are worth nothing in-game |
| **Grades**: Traditional / Stalled pilot (< 0) / Paid for itself (< 60) / Compounding team (< 140) / Force multiplier | `summary()` | First guess |
| **Every speedup, cost, threshold, rate and decay** | `CFG`, `LEVELS`, `OPPS`, `INVESTS` | Tuned so the shape below holds; not from research beyond the J-curve's existence and DORA's rough magnitudes |
| **The eight scripted opportunities, their order and copy** | `OPPS` | Picked to walk the ladder, mostly from DORA and Eledath |
| **Its own "planning board" look**, not Neon Arcade: light and dark themes, Bricolage Grotesque + IBM Plex Sans + IBM Plex Mono, a DOM page with an SVG chart | the page's `<style>` | It is what the CD played and reviewed as the artifact; the repo default is Neon Arcade, so restyling is one ask away (open question 4) |
| **Repo chrome positioned `absolute`, not fixed** | `#menu-btn`, `#mode-btn`, `#reload-btn`, `#menu` | The page scrolls; fixed buttons would sit on top of the text as it passes |
| **Audio**: soft UI clicks, a fund/unfund pair, a quarter "stamp", a level-up arpeggio, year-end met/missed cues, and a slow four-chord office loop (76 bpm, music gain 0.09) | the page's audio block | The repo's every-game audio rule; a management sim wanted quiet |

## Open questions for the CD

1. **Should a well-played year 1 be able to hit 240, or is the forced dip the lesson?**
   Today only the minimal path makes it (eval row `(current tuning)`). Slack would come
   from a base rate above 1 unit/SP, a lower goal, or bigger early gains.
2. **Is one aggregate team level enough, or a spread (champions vs skeptics)?** A
   distribution would model the multiplayer effect directly (the slowest reviewer
   throttles the fastest author).
3. **Random events?** Candidates: a model upgrade (speedup jump), a budget freeze, a key
   person leaving (Knowledge and Context drop), a security incident (Trust drop, Quality
   matters), a reorg, a vendor price change (burn up). The scripted roadmap would stay;
   events would sit on top.
4. **Keep the planning-board look, or restyle in Neon Arcade?** (Assumed above.)

### Weak spots seen in the first draft

- **Ongoing investments mostly pay through the exit run rate**, not in-game units,
  unless they tip a level a quarter early. The hand-played skilled line ships 8 units
  more than funding opportunities alone but scores 79 more.
- **L5 is effectively unreachable** (no named line gets there; the optimiser does not
  either). That matches the CD's "horizon" view, but it also means the Y2Q4 handoff
  pilot is a bet on year three with little in-game payoff.
- **Context rot can block L4 by one point** (the hand line sat at Context 58 vs 60 for a
  quarter because a quarter had no context work). Realistic, possibly frustrating.
- **Trust can never fall in today's tables** (found by the 2026-10-12 negative tests). The
  drift rule "Trust -4 when rework outweighs the gain" needs rework > gain, and gain over
  rework is at least 3.25 at every level even with Flow, Quality and Context all at 0
  (L1 and L2: (speedup - 1) x 0.65 / risk = 3.25; L5: 5.85). So trust only ever rises,
  and the "How the model works" panel promises a fall that cannot happen. Fixing it is a
  tuning call (riskier levels, a learning dip that counts against the gain, or a fall when
  the measured gain is small rather than negative); the rule itself is tested on a
  borrowed table so it stays right whatever the CD picks.

## Architecture

One file, two `<script>` blocks.

1. **The engine**, `const TAAS = (function () { ... })()`, pure functions and no DOM,
   ending `if (typeof module !== 'undefined') module.exports = TAAS;`. The suites lift
   exactly that span out of the page, so keep the opening line and that last line as
   they are.
   - **Tables:** `CFG` (budgets, goal, step sizes, taxes, rot, drift, the budget cut),
     `LEVELS` (`mult` potential speedup, `burn` AIC per delivery SP, `risk` raw rework
     rate, `req` stat thresholds), `OPPS` (one per quarter: `sp`, `aic`, `minLevel`,
     `gain`, and optional `burnFactor`, `agentUnits` + `agentAic`, `extra` copy),
     `INVESTS` (`unlock` level, `aic` per SP, `rate` stat points per SP, optional
     `upkeep: 'context'|'quality'`).
   - **State:** `{ version, q, level, leveledUp, stats{5}, burnFactor, agentUnits,
     agentAic, budgetCut, history[] }`. **Plan:** `{ opp: bool, inv: { id: sp } }`.
   - **`forecast(state, plan)` is the one place an outcome is computed**; `commit()`
     calls it and applies the result, so the preview on screen is the result
     (`drive-taas` proves it over 400 seeded runs). Never compute an outcome anywhere
     else.
   - `output()` is the units formula; `summary()` the scorecard; `exitRate()` units the
     team would ship with all 60 SP on delivery and no new investment.
2. **The UI**: `render()` rebuilds each region with `innerHTML` from `state` + `plan`
   (there is no user text anywhere, so that is safe here; it is not a precedent for a page
   that holds keys or typed text). Clicks go through one delegated handler keyed on
   `data-act`; focus is restored by `data-key` after each render. `tryPlan()` refuses a
   change that would make the plan invalid, which is also how `+` and Fund disable
   themselves.
   - **Storage:** `localStorage['taas.v' + CFG.version]` holds `{ state, plan }`; bump
     `CFG.version` whenever the state shape or the tables change meaning, which discards
     old saves instead of replaying them under new rules. `taas-mute` holds the sound switch
     and `taas-vol` the three volumes (both modes share them).
     `drive-taas-ui` reads the run and the plan back out of this save after every click
     and checks the screen against `forecast()` on them, so the save's shape is part of
     what that suite relies on. It serves the page over a local http server rather than
     `file://`, so a copy with `CFG.version` bumped shares the same localStorage.
   - **Chart:** an SVG redrawn on resize at the container's width (300-640 px) so the
     type stays readable on a phone; value labels sit inside the bars so they never
     collide with the dashed 60 baseline.
   - **Audio:** lazy `AudioContext` on the first click, `sfxGain`/`musicGain` masters,
     suspended on `visibilitychange`; the music scheduler rejoins at "now" after a pause
     instead of replaying the gap.

## The model (2026-10-09 tuning)

- **Units** = delivery SP x (1 + AI gain - rework - learning dip) + agent units x coverage.
- **AI gain** = (level speedup - 1) x adoption x coverage x flow share.
  Adoption = 0.5 + Trust/200 (0 at L0). Flow share = 0.65 + 0.35 x Flow/100.
- **Rework** = level risk x adoption x coverage x (1 - guard). Guard = (0.7 x Quality +
  0.3 x Context)/100.
- **Coverage** = credits left after investments / credits the AI-assisted work needs
  (delivery SP x burn x adoption x burnFactor + agent upkeep), capped at 1.
- **Learning dip**: 2% of delivery in the quarter after a level-up.
- **Investments**: full rate for the first 6 SP, half rate beyond; 2 SP a click, 12 max.
- **Opportunities**: half the gain if the team is below `minLevel`, no lasting bonus,
  and only half of deterministic-first's burn saving.
- **Drift**: Context -3 a quarter from L3a with no context work (personal or shared
  context, the context repo or the lessons loop); Quality -2 from L3b with no script or
  eval work; Trust +3 when the measured net gain is over 3%, -4 when rework outweighs
  the gain.
- **Team says** = (level speedup - 1) x adoption: the speedup felt while prompting,
  ignoring review queues, rework and the dip.

| Level | Speedup | AIC per SP | Rework risk | Needs |
|---|---|---|---|---|
| L0 Traditional | 1.00 | 0 | 0% | - |
| L1 Light AI | 1.10 | 15 | 2% | Knowledge 10 |
| L2 Prompt engineer | 1.30 | 45 | 6% | Knowledge 25, Trust 20 |
| L3a Context engineer | 1.50 | 85 | 9% | Knowledge 40, Context 25 |
| L3b Deterministic-first | 1.80 | 120 | 11% | Knowledge 50, Context 40, Quality 30 |
| L4 Loop engineer | 2.30 | 190 | 15% | Knowledge 65, Context 60, Quality 55, Trust 50, Flow 40 |
| L5 Graph engineer | 2.80 | 280 | 20% | all five at 75-85 |

| Quarter | Opportunity (short name) | SP | AIC | Ready at | Gives |
|---|---|---|---|---|---|
| Y1Q1 | AI stance | 4 | 500 | L0 | Trust 20, Knowledge 12 |
| Y1Q2 | Prompt workshop | 5 | 1,500 | L1 | Knowledge 20, Trust 8 |
| Y1Q3 | Context repo | 8 | 2,000 | L2 | Context 30, Knowledge 8, Flow 5 |
| Y1Q4 | Lessons loop | 6 | 1,000 | L3a | Context 16, Quality 10, Flow 8, Knowledge 6 |
| Y2Q1 | Scripts + evals | 8 | 2,000 | L3a | Quality 30, Trust 6, Knowledge 6; delivery burns 25% fewer AIC |
| Y2Q2 | Review flow | 6 | 1,500 | L3a | Flow 28, Quality 6 |
| Y2Q3 | First agent | 10 | 3,000 | L3b | Knowledge 12, Flow 10, Trust 6; +6 units a quarter for 600 AIC |
| Y2Q4 | Handoff pilot | 8 | 2,500 | L4 | Flow 12, Knowledge 10, Trust 6; +4 units a quarter for 400 AIC |

Ongoing investments (per SP, AIC per SP, unlocks at): Training courses Knowledge 4 (20,
L0); Demos and show-and-tell Trust 4 (10, L1); Prompt practice Knowledge 2 + Trust 2
(60, L1); Review and small-batch habits Flow 4 (20, L2); Personal context files Context
3.5 + Knowledge 0.5 (60, L2, context upkeep); Shared context upkeep Context 3 + Flow 1
(60, L3a, context upkeep); Scripts and evals Quality 4 (80, L3a, quality upkeep); Agent
and tool building Knowledge 2 + Flow 2 (250, L3b); Agent handoff design Flow 2.5 +
Trust 1.5 (300, L4).

## Balance as measured (`node .claude/tests/eval-taas.cjs --search`, 2026-10-12)

| Strategy | Y1 | Y2 | Total | Exit | Score | Ends |
|---|---|---|---|---|---|---|
| Traditional | 240 | 240 | 480 | 60 | 0 | L0 |
| All 8 opportunities only | 228.7 | 286.5 | 515.2 | 95.5 | 95 | L3b |
| Stance + workshop only | 240.7 | 262.4 | 503.1 | 65.9 | 35 | L2 |
| Year 1 opportunities, coast | 228.7 | 285.7 | 514.4 | 72 | 47 | L3a |
| Skip Q3+Q4, then year 2 | 240.7 | 229.9 | 470.6 | 67.8 | -4 | L2 |
| Hand-played skilled line | 218.2 | 305.1 | 523.3 | 136.5 | 174 | L4 |
| Cautious line | 228.7 | 269.2 | 497.9 | 131.1 | 149 | L4 |
| Opportunities + 24 SP/quarter | 166.9 | 188 | 354.9 | 111.2 | -148 | L3b, budget cut |

Seeded random search (20,000 runs): 56.6% beat 480; p10 438.7, p50 484.7, p90 510.1.
Hill-climbed best: 595.7 units, exit 133.9, score 240, L4 from Y2Q3. The shape the eval
asserts: J-curve, payback, sequencing, over-investment loses, skill beats coasting, L5 on
the horizon. When the CD retunes, re-run the eval, update this table, and change an eval
row only if the CD has changed the design it describes.

## Negative tests (2026-10-12)

Every rule the two drive suites claim was broken on purpose, on copies of the page, and
each break had to turn a named row red. The lists are kept so they can be re-run after a
redesign (`.claude/tests/negtests/taas-engine.json`, 39 breaks; `taas-ui.json`, 40):

```
python3 .claude/scripts/negtest-copies.py .claude/tests/negtests/taas-engine.json --page-env TAAS_PAGE --jobs 4 -- node .claude/tests/drive-taas.cjs
NODE_PATH=/opt/node-tools/node_modules python3 .claude/scripts/negtest-copies.py .claude/tests/negtests/taas-ui.json --page-env TAAS_PAGE --jobs 3 -- node .claude/tests/drive-taas-ui.cjs
```

A break whose anchor no longer exists is reported before anything runs; re-anchor it on
the new code rather than dropping it.

- **Engine, first pass: 19 of 39 caught.** The rows played real quarters, and most of the
  rules never come up in seeded play: the sweep never runs short of credits at 9,000,
  never rots a stat to 0, never reaches an agent quarter unready, and no level-up-free
  quarter at L1 or above was in the dip row's line. Two rows could not fail at all: "no
  lasting bonus from an unready opportunity" checked Y2Q1, whose opportunity has no
  agent, and "a positive gain raises trust" was written `premise ? check : true`. Section
  9 of `drive-taas.cjs` builds the states those rules are about; now **39 of 39**.
- **Page: 23 of 24 caught**, and the first pass also caught three only by a 30 s click
  timeout. The suite now gives each section a clean save, catches its own crash, and
  clicks with a 4 s timeout, so each break fails a row that names it.
- **The shared chrome (2026-10-14, night): 17 more breaks, 17 caught** (`taas-ui.json` now
  39 of 40): the menu button off screen, Info doing nothing or leaving the notes shut, a dead
  sound switch, the switch leaving the ambience on, a slider on the wrong bus, volumes not
  saved or not loaded, a tap outside or Escape not closing the menu, a reload on the same
  address, a silent or a loud ambience, no cross-fade between the modes' ambiences, a badge left
  in UTC or with no US Eastern fallback, Exit game pointing at the wrong place. Two rows were
  tightened by the run: Exit game's link resolved to the same address either way on the
  suite's server, so the row reads the attribute; and a menu left open by a broken scrim made
  the next tap time out, so the row closes it itself and fails by name.
- **One equivalent change, recorded rather than tested:** the `inc` click handler
  clamps to `investMax`, but `renderLeft()` disables the + at 12 and a disabled button
  never fires a click, so the clamp is unreachable through the page. Removing the
  *disabled* state is caught (`ui-no-invest-max`); removing the clamp is not, and cannot be.
- What the page suite measures that a reading of the code would not: a log table allowed
  to overflow widens the phone's layout viewport to ~850 px, and the tracker then lies
  over the plan's buttons. The layout row asks for `innerWidth` to stay the screen's.

## Tips: what the game teaches (both modes)

The CD, 2026-10-16, on two findings of the factory's eval: "Those two things your test found are
**perfect examples of how sometimes AI agents are not worth it until you have sufficient experience
and funding to properly support them.** Add these to a list of tips in the info section. I might want
to find a way to surface these types of insights in the natural flow of the game later, so for now I
just want you to capture them in that in game info section (via top left menu) and capture in a
context file for this taas game (both modes). In this case the simplest lesson is that **the first
draft of an agent will likely not provide ROI**, it takes time to learn where it needs supporting
instructions/guardrails and eventually it will start to show **positive (>1) ROI (ie return >
investment+maintenance+cleanup)**."

This is the list. **Each tip is shown in the robot factory's Info** (menu > Info, under "Tips"; the
wording there is Claude's, from the CD's words), and each names the evidence that found it. A later
brief may move them into the flow of play (the CD's "later"); until then they stay behind the
opt-in panel, per the discovery rule.

| Tip | Where the game shows it | Evidence |
|---|---|---|
| **A first agent rarely pays for itself.** The first draft of an agent will likely not return what it costs: it takes time to learn where it needs instructions and guardrails, and only then does it return more than its investment, upkeep and cleanup (ROI above 1). Agents are worth it once you have the experience and the funding to support them | Factory: a robot line loses money until it holds its instructions, and the slots cost money it has not earned yet. Formal: the **J-curve** (§ Research, DORA): skill bought costs delivery before it pays back | Factory eval, seed 7, an hour (§ Measured, the bins): without the delay the robots' plans of four come at 50 / 45 minutes, and the supervisor's line nets $2.40 a minute at the end of the hour; the jams ($5 each) and the logs it recycles are the cleanup |
| **An agent faster than demand makes waste.** Pace it, starting the wait short | Factory: an instructed operator handles about 18 logs a minute against about 5 customers; without the delay its output bin holds 78-134 medium planks at the hour, every one paid for; given "Wait between tasks" as it is hired, 0-13, it spends less on every seed and ends the hour richer on 10 of 12. The 5 s the slider starts at starves the line on some seeds (the two that end poorer) | The eval over seeds 1-12, the paced persona against the supervisor (§ Measured, 2026-10-17). **Corrected 2026-10-17**: seed 7 alone had said the plans come "about twice as fast" (23 / 17 against 50 / 45 minutes); over twelve seeds that held on seed 7 only, and Info said so too until then |
| **Give an agent the next best task, not the biggest.** A first robot on the planer, while you still carry every plank, presses logs nobody is selling | Factory: the operator-first trap (open question 1, kept as a lesson by the CD: "if not careful we learn this the painful way") | The eval's "operator first" persona since the storefront (§ Measured, storefront) |
| **More agents do not make more demand.** A second stall and its robot that sell what the first sells only split the same customers and never pay; a new stall pays when it sells something worth more | Factory: customers come one every 8-16 s whatever is on the counter; a stall of medium 2x4s from the table saw pays | The eval's "second stall" and "saw line" personas, seeds 7-12 (§ Measured, 2026-10-17): $4.00 a customer as without it and $97-197 behind at two hours; with 2x4s $4.86-5.08 a customer and ahead on 5 of 6. Added 2026-10-17 (taasstalls step 4), not yet seen by the CD |
| **An agent is only as good as what feeds it.** A stall whose thing is scarce, or whose robot fetches one thing at a time from a far bin, leaves its customers waiting, and they fill the shop so nobody else gets in; set a stall to sell only once someone can keep it stocked | Factory: the large plank stall, the one stall switched to 2x4s, a stall set before its robot is hired | The eval's "large planks", "cut stall" and "set first" personas, seeds 7-12 (§ Measured, 2026-10-17): satisfaction 10-14% at two hours with the shop full, and the last sells nothing at all. Added 2026-10-17, not yet seen by the CD |

**The five rechecked at the flat $1 (2026-10-20, taasgoals step 5; the Tips in Info are unchanged, no Tip is
removed).** Robots and stalls cost $1 each since the goals brief, which moves what the eval can show
(section Measured, 2026-10-20, the goals):

- **Tip 1, a first agent rarely pays for itself: holds, starker.** The hire is cheap at $1, the cleanup is
  not: a supervisor's money hovers at or below zero until its plans are whole.
- **Tip 2, pace it, starting the wait short: holds, and the eval says why.** A 5 s wait put in at the hire
  (30 s into the game at $1, before the line runs) starves the line on 12 of 12 seeds (the persona `paced
  early`); put in once a stall's worth of medium planks has piled up behind a full stall (`paced`), the lowest
  satisfaction after it is 78-100%.
- **Tip 3, give an agent the next best task: no longer shown by the eval at $1.** The trap needs a stretch
  with one robot, which a $1 second robot removes (the operator hired first is never swapped: the stocker
  is the next $1, on staff within the minute, and the line ends healthy, 100% and 6.1 $ a minute). It
  still holds whenever a robot costs more than the first sales (inferred: a robot priced up in the menu's
  Prices, to $200).
- **Tip 4, more agents do not make more demand: holds** (a second stall: $4.00 a customer, behind on every
  seed). Its example, a new stall pays when it sells something worth more "like 2x4s from the table saw",
  now points at the machine that arrives last (goal 3 unlocks the saw in slot 04).
- **Tip 5, an agent is only as good as what feeds it: holds for large planks and the cut stall**, but its line
  "set a stall to sell only once someone can keep it stocked" is **not shown at $1**: a stall set before its
  robot is hired no longer locks the shop, since the robot is hired at once (the persona `set first`).

When a new finding of this kind turns up (in an eval, a playtest, or the CD's report), add a row
here and a line to the factory's Info "Tips" (`renderPanel()`), and the page suite's tips row
(`drive-taas-factory-ui.cjs` section 7) with it.

## Robot factory mode (2026-10-13)

### The CD's brief - stated, do not relitigate

Asked for on 2026-10-12, built overnight. In the CD's words, lightly trimmed:

- **A mode button** at the top, right of the mute button (the menu button since 2026-10-14), that opens a dropdown and shows
  the selected mode's name. The existing game becomes **"mode=formal"**.
- **"Robot factory"**: the same concepts, as a more playful game. A **top-down view at a
  slight angle where up/down and left/right movement is parallel to the screen edges**
  (like the original Legend of Zelda). **Cel-shaded (toon) 3D models.** The player is a
  **chibi human who walks where you tap**. **Scroll up and down** to see the whole floor.
- **machine01 with a glowing red button.** Tap it: if the avatar is not near, it **walks
  over (animated)** and presses it; the button **depresses and goes dark** while one wood
  plank is made (**4 seconds**). Raw lumber goes in on an **in-feed conveyor**; a smooth
  plank comes out **at the same rate** on the out-feed and **drops into a storage bin**.
- **Tap the bin** (the avatar walks to it): one option, **sell planks one at a time**, as a
  **green USD bill in a white chat bubble**. A sale takes the plank away and money goes
  **$0 to $5**.
- At **$20, hire a robot "agent"** and assign it to the **button** or to **selling from the
  bin**. Robots are AI agents, drawn as **cute cel-shaded robots**. The **second costs $40**:
  a fully automated make-and-sell loop.
- Then **prompt engineering** is the next upgrade. Robots do a good job **sometimes**, a bad
  one sometimes, and in between; **each robot's chances are independent**. The CD's
  examples: an operator puts **sap** in (it gums up the machine and **you clean it
  manually**) or turns a log into **dowel rods** (worth **$1 at most**); a seller sells a
  good plank for **$0**, or sells **dowels for $5**, which costs **customer trust**. "These
  are just examples to get us started"; the factory will grow.

### Customer satisfaction, and the factory on its own (CD, 2026-10-13) - stated

The day after the build, in the CD's words: "For robot factory change 'trust' to 'customer
satisfaction' which should start at 100% as an indicator that our customers trust us and our
products. As we start using AI, it is important to not let that erode."

And: "For now, I want to work on robot factory separately from formal mode to help me get a
different perspective." The two words were never one metric:

- **Formal's Trust** is how much the **employees trust the AI tool**, from their experience
  with it (a `STATS` row; unchanged).
- **The factory's customer satisfaction** is how much the **customers trust the company** and
  its products: it starts at 100%, sets what they pay, and is what the robots must not erode.

"Both are useful metrics." So the factory is developed **as its own game for now**: its HUD,
reference panel and copy use none of the formal mode's terms (no L0-L5 ladder, no "L2
rung"), and nothing in one mode reads the other. The engine's field is `s.satisfaction` and
its tuning `CFG.sat*`; a save from before the rename keeps its number (`load()` reads the old
`trust` field once).

### The Q&A (2026-10-12, before the build) - stated

| Question | CD's answer |
|---|---|
| How to render cel-shaded 3D | **Canvas 2D meshes**: hand-written low-poly meshes, toon bands, ink outlines (as Star Surge's 3D style and Animation Rigs); no library, one file |
| Prompt engineering in the first build | **Yes**: bought with $, steps that raise the good odds; prices and steps are Claude's, to tune (**superseded 2026-10-14** by per-robot instructions, below) |
| What customer trust does (now **customer satisfaction**) | **Lowers prices**: a good plank sells for $5 x satisfaction; fair sales win it back |
| Outcome split at the start | **25 good / 35 so-so / 40 bad** (so-so: a slow cycle or a plank let go for $3) (**superseded 2026-10-14**: mistakes now come from causes, below) |

### Instructions instead of prompt levels (CD, 2026-10-14) - stated

The CD's second brief, after playing the first build, lightly trimmed:

- **Remove the "robot factory" label from the back wall.**
- **Instead of upgrading prompt quality at a computer**, the next step after buying the two
  robots is: **tap a robot to add instructions to it, one at a time**. Instructions are
  **attached to the robot**: each robot has **its own set**. **Instruction slots are bought
  with cash, per robot: slots 1 / 2 / 3 / 4 / 5 cost $5 / $10 / $15 / $20 / $25**, so $150
  unlocks all five on both robots.
- **Each robot can be given a name.**
- Instructions come from **a pool of pre-canned rules**, assigned to a slot: "I need to
  scroll through the list and select the one I want that is appropriate for the task the
  robot is doing." The six to start with (the CD's words, quotes made straight):
  - Never put sap on input log
  - Put gnarled logs in recycle bin
  - Only input logs bigger than 1"x4"x4'
  - Only output 1"x4"x4' wood planks
  - Only sell 1"x4"x4' wood planks
  - Sell 1"x4"x4' wood planks for $5
- "These instructions start out obvious and straightforward, but later, as I want to
  increase complexity of what I produce in my factory, the instructions will need to be
  more nuanced. More on that later. **I want to playtest first** and think more on how I
  want it to progress next."
- **Why**: "The robots mimic AI because I am asking them to do tasks that are non-trivial
  (QA input material and process into output, QA inventory and sell appropriately), and
  like an intern they might occasionally mess up. So I see how they mess up and provide
  instructions (ie guardrails) based on what I observe. Feels like prompt or context
  engineering for a work task I ask AI for help on, and over time I observe ways I need to
  refine my prompt."
- **The robot's instructions page shows its base prompt at the top**, above the
  instructions (guardrails) added to it: "use machine01 to refine raw materials", "sell the
  items in this bin".

Four answers the CD gave before the build (2026-10-14):

| Question | CD's answer |
|---|---|
| Where mistakes come from | **Causes + rules**: the rack holds good, gnarled and small logs and a recycle bin joins the line; every mistake has a cause you can see, and the matching instruction in that robot's slots stops it. This **replaces the 25 / 35 / 40 dice and the prompt levels** |
| How reliably a robot follows an instruction it has | **Rarely slips**: about 1 job in 20 it still makes that mistake (guardrails cut errors, they do not end them) |
| An instruction about another job (e.g. the price rule on the operator) | **Does nothing**: a wasted slot, learned by watching |
| Which instructions the list offers | **Only mistakes you have seen**: an instruction joins the list the first time a robot makes the mistake it prevents |

### Sap logs, $1 a log, a seller that only sells what is in the bin (CD, 2026-10-14, after playtesting) - stated

The CD's third brief, after playing the instructions build, lightly trimmed (quotes made straight):

- **The seller's base prompt is "Sell the items in this bin."**, "so it should only sell items
  from the bin, **not toss items in recycle bin**." With the instruction that keeps it off
  non-planks (inferred: the CD wrote "once I add the instruction 'Sell the items in this bin'",
  which is the base prompt; the instruction that leaves non-planks behind is "Only sell
  1"x4"x4' wood planks") "I should see the bin filling up with extraneous items that introduce
  a new issue where the robot takes longer to complete its task because of the reduced signal
  (planks) to noise (non planks) ratio. This should appear in its log as **'looking for plank'
  with a counter** to show how often it has happened. Could calculate **'find success' chance as
  number of sellable items divided by total number of items on each attempt cycle**."
- "**Remove the sap bucket for now and add a 'sappy log' to the input pile** (wood log with holes
  and excessive green sap on it). The corresponding instruction would be **'put sap logs in
  recycle'**."
- "**Gnarled log looks like it has holes in it** (which is fine) **but the output should also
  have holes in it in the same places.**"
- "**Make it cost $1 each time a log is processed by machine01.** $ amount can drop below zero
  to a negative number that is **red instead of black**. This gives me a motivation to consider
  instructions like 'put gnarled log in recycle'."
- Looking ahead: "In the future I may want to produce dowel rods, so I will need to choose
  between general instructions like (only input logs bigger than 1"x4"x4') and (put gnarled
  logs in recycle)."
- "**I am OK with there being extraneous instructions in the list to choose from.** It is like a
  middle ground between free form text instructions (harder to implement) and a trivial short
  list of instructions to choose from (too easy for the player)."

No questions were asked before this build. What was inferred or assumed is marked "third brief"
in the table below.

### Medium logs, recycle instructions and evals (CD, 2026-10-14, fourth brief) - stated

The CD's fourth brief, after playing the third, lightly trimmed (quotes made straight):

- **Add instructions**: "put small log in recycle", "put large log in recycle", "put medium log
  in recycle", "put dowel rods in recycle".
- "**Change the specific 1"x4"x4' size to 'medium' log** (update existing instructions)."
- "**Update evals so they can confirm a valid optimal path is available.** This should catch
  issues like what I see now where sales bin fills up but there are no instructions available
  to help Sales robot clean out the unsellable or unusable items."
- "**Add a button to reset each robot's action history** (e.g. 'what refiner has done', and
  'what seller has done') so that I can begin capturing fresh data for my latest applied
  instructions."
- "**Update the color dots** in the action history so **red dots only go on actions that cause
  blockers (sap log jam) or negative impact to customer satisfaction** (eg. 'Sold something as
  plank that was not one'). **All other 'unexpected' and 'suboptimal' actions are yellow.**"
- "I see 'sold a plank with holes or dowels for their price' with a green dot, this confused me
  at first but then I realized that based on the base prompt 'sell the items in this bin', this
  was actually the correct behavior. Later, I added the instruction to only sell medium planks,
  so after that point I would expect 'sell holey plank' and 'sell dowels' to begin showing up
  with a yellow dot (as a new entry in the list). This makes me realize this audit history is
  really more like the output from evaluations... so let's go ahead and **rename that lower
  section to 'Evals'**."
- **"Move the version timestamp from top right corner to bottom right corner."**
- FYI, nothing to build yet: "Realizing that this is a good analogy for evals is exciting to me
  and only something I noticed because I am play testing this in a very incremental and
  deliberate way. ... I need some time to think about this more and figure out if I want to
  update this eval section for each robot so that **the player has to define the eval criteria
  (ie rubric)**. Or perhaps I will just leave this as it is to introduce the idea and then give
  the opportunity to the player to define their own evals at a higher level, like for **the
  factory trying to manufacture tables, which are being built from multiple refined
  components**."

Four answers the CD gave before the build (2026-10-14):

| Question | CD's answer |
|---|---|
| What machine01 makes of a large log | **A large plank.** "Split instructions so it's not just 'put junk in recycle' but 'put large plank in recycle', 'put dowel rods in recycle', 'put gnarled plank in recycle'." |
| Whose "Put dowel rods in recycle" is | **The seller's**: when its reach turns up dowels, it drops them in the recycle bin |
| What clears gnarled planks from the sale bin | **Add a recycle rule** for the seller ("put gnarled plank in recycle", per the first answer) |
| How "Only input logs bigger than 1"x4"x4'" reads now | **"Only input medium logs"**: rejects small and large logs; gnarled and sap logs count as medium-sized, so they still need their own instructions |

### The menu, a reload button and scoreboards on the wall (CD, 2026-10-14, night) - stated

The CD's next note, from a phone screenshot of the factory (lightly trimmed, quotes made
straight):

- "**Move build date timestamp to lower right corner and change timezone to local device
  timezone**; if not possible then just print in eastern time zone. Do this in all TAAS modes."
- "I don't see the page reload button in the top right corner. ... **Add page reload btn to top
  right corner** (in all TAAS modes)."
- "**Move the '$' and 'customer satisfaction' values to the factory wall** (behind machine01 and
  sales bin). These remain on the wall like scoreboards and I have to scroll to the top to see
  them, but it frees up some screen space nicely."
- "**Replace the top left 'Back' button with a settings accordion/hamburger 'menu' icon.** I can
  tap the 'menu' icon in order to exit game (returns me to the arcade listing) or change settings
  like **volume for music, ambient sounds, sound effects**. **Move the 'i' info button** from main
  screen into this 'menu' list as an 'info' option I can click to see details about the current
  TAAS mode."
- The Evals name and the Reset evals button were missing on the CD's phone. **Traced**: the
  fourth brief's push (`f47b497`) built, but its Pages *deploy* step failed after ten minutes
  (run 38592967814), so the site kept serving the third brief; the screenshot's badge,
  `12:46 UTC`, is the third brief's. This round's push redeployed both.

Three answers the CD gave before the build:

| Question | CD's answer |
|---|---|
| TAAS had no ambient sounds; what does the Ambient slider control? | **Add ambience**: a room tone in each mode with an occasional sound from elsewhere, and machine01's whir moved from effects to ambient |
| Keep the mute button beside the menu? | **Fold it into the menu**: the top bar is the menu, the mode dropdown and the reload button |
| Where on the wall do the boards go? | **"Window in middle, $ on left, customer satisfaction on right."** |

### The storefront, wood in two dimensions, and four slots (CD, 2026-10-15) - stated

The CD's next brief, lightly trimmed (quotes made straight):

- "**Add to the rear wall 'Goal: Sell medium planks for $4'**." "**Reduce price of medium plank from
  $5 to $4.**" "**Fix sap jam costs $5.**" "**Customer satisfaction affects sale price.** As
  satisfaction decreases so does sale price."
- "Refactor so we have the following: **wood raw materials have two dimensions: size (small,
  medium, large), and quality (normal, gnarled, sappy).** Sappy S/M/L wood input into machine01
  always jams it up; gnarled S/M/L wood input into machine01 outputs gnarled S/M/L planks; normal
  S/M/L turn into small planks / medium planks / large planks."
- "machine01 outfeed conveyer belt drops its output into **'machine01 output bin'**." "**Add a sales
  counter row above the machine01 row.**"
- "A new task: **'put items on the sales counter'**. Initially the sales counter has **one slot
  labeled 'medium planks'**. The human player avatar can **tap in m01outbin to pick up items, then
  tap on the sales counter to deliver** items to it (human avatar always does this correctly and
  **holds any extra items in its personal inventory**). Player can **tap on recycle bin to place**
  any extraneous inventory items. Player can **tap on the recycle bin again in order to remove items**
  from it that they may want. It is possible to put medium (or small or large) planks into the
  recycle bin and then get them back out."
- "**The sales counter does not need anyone present to operate.** It can be like a vending machine
  dispenser where **visitors should walk into the factory storefront from the left side, stand in
  front of the stall** for the item that they want to buy (for now this is only medium planks...),
  and **within a few seconds, they tap their credit card** to complete the purchase and **carry away
  their plank. If there are no planks, then they wait.** It is possible that new customers will
  walk in and **form a line. Each second that a customer has to wait corresponds to a decrease in
  customer satisfaction by 0.1%**; for example, if three people are waiting in line when customer
  satisfaction is at 100%, then four seconds later I should see customer satisfaction has dropped
  to round(100%-(0.1%*3*4)) = round(98.8%) = 99%."
- "**'sales' robot is now responsible for stocking sales stalls** with the correct items. Can make
  mistakes like putting small planks, or large planks, or gnarled planks into the '$4 medium plank'
  stall. **Each of those mistakes is a 'red' eval dot** (grade) because it results in customer paying
  $5, expecting a medium plank, but getting something else (customer satisfaction decreases)."
- "**Rename machine01 to 'planer'**, it appears in **factory slot01** (put **'01' on the floor on the
  left and right and middle** of the row area where the machine01 conveyers and in/out bins are)."
- "Add a **'table saw' to factory slot02** (same '02' printed on floor). The table saw can be used to
  convert s/m/l planks into **two 2"x4" or four 2"x2" or sixteen dowel rods**. S/M/L corresponds to
  length of **2'/4'/8'**, but we can informally continue using 'small'/'medium'/'large' in chat and in
  game. Add an input bin and an output bin with conveyer belt in and out (like machine01). **Costs $1
  to process each input.**"
- "Slot03 gets a **'sap extractor'** machine with in & out bins and belts. Input s/m/l sappy logs to
  get **s/m/l amounts of sap (like 1/2/4 units of sap) plus s/m/l logs** (that can be delivered to
  slot01 input bin for machine01). **Costs $1** to process each input."
- "Slot04 will be different. Input bin on left, output bin on right, but **no machine**. Instead this
  is a **'hand crafting station** with small manual woodworking tools where human or robot can hand
  craft **gnarled wood into interesting distinctive decorative pieces**."
- "For now, **only medium planks can be sold**. But we can define the correct sale price of these new
  items: **$2 for one small plank, $4 for one medium plank, $8 for one large plank, $1 for 1 sap, $3 /
  $6 / $12 for small / medium / large length two 2"x4" or four 2"x2" or sixteen dowel rods**."
- "For now **I can only assign robots to slot01 machine and to 'sales/stocker' job**. The other slots
  can be manually operated by the human player character."

Two answers the CD gave before the build (2026-10-15):

| Question | CD's answer |
|---|---|
| Where do customers stand at the counter? | **Across the counter**: a strip along the back wall is the shop; customers come in a door on the left, queue along the wall and face you across the counter; the robot and you stock it from the factory side, never among customers |
| A line can form while the stall is empty: what happens as it grows? | **The room fills up**: they wait as long as it takes; once the shop holds about six, nobody else comes in until someone leaves; each waiting customer costs 0.1% a second |

### What was built

As built for the storefront (2026-10-15), with one stall and two robots. **The stalls (2026-10-17)
changed three things here**: the counter has four places, any three of them bought, each stall set
to sell one of 13 things; up to eight robots, a stall's robot for each stall and robots for slots 02
to 04; and customers who pick a stall. See § Four stalls and eight robots; the rest of this
section still holds.

**The floor** is 6 m wide and 18 m deep (`FACTORY.LAYOUT`), drawn orthographically at a 50 degree
elevation, so x is screen x and depth is screen y, with heights foreshortened by cos 50. From the
back: **the wall** (3.3 m), carrying **the goal** across the top ("GOAL" on a yellow tag, then "Sell
medium planks for $4", drawn from the stall's price) and under it the two scoreboards, money on the
left and customer satisfaction on the right, with a window between them in the middle; **the shop**,
a wooden floor 1.25 m deep with **a door in the left wall**; **the sales counter** the whole width
of the floor, its stall (a teal tray holding six) at the east end and the stall's **label** on the
counter's front, "MEDIUM PLANKS" and the price a customer pays now; **the walkway** on the factory
side, where the counter is stocked; then **four slots**, each a row in a painted bay with its number
on the floor at the left, the middle and the right: **01 the planer** (once machine01: its rack of
logs, the in-feed, the planer with its console, the out-feed, its blue output bin, and the green
recycle bin in front of the out-feed), **02 the table saw** and **03 the sap extractor** (each: a grey
input bin, the in-feed, the machine, a console on its right, the out-feed and a blue output bin),
**04 the hand crafting bench** between a grey input bin and a blue output bin; and **the robot dock**
at the bottom. Every row is open at its east end, so the floor is one piece: the walkway is reached
round the planer's output bin. A portrait phone sees from the wall down to slot 04; the dock is a
short scroll away.

**Wood has a size and a quality** (the CD): small, medium or large (2', 4', 8' in the CD's words;
drawn 0.55, 0.85 and 1.1 m long to fit the belts) and normal, gnarled or sappy: nine kinds of log.
Off the rack, 20% are small, 65% medium and 15% large, and 75% normal, 15% gnarled and 10% sappy
(so about half are normal medium logs); the first log of a new factory is normal medium. The
planer makes a normal log a plank of its size, a gnarled one a gnarled plank of its size (the log's
holes in the same places), and **any sap log jams it**.

**The planer by hand.** Tap anything and the avatar walks there (an A* over 0.2 m cells,
string-pulled, aimed only at floor it can actually reach) and does the thing on arrival. At the
planer **you always get it right**: you press a normal medium log, and any normal log you put on
its rack yourself; anything else you toss in the recycle bin (0.6 s) and wait for the next to roll
in (0.9 s). A press starts a 4 s cut: the log feeds in, the plank rides the out-feed (0.8 s) and
drops into the output bin. **Every press costs $1**, and **scrubbing a jam clean costs $5** (2.5 s of
scrubbing, charged when it is clean; robots never clean). Money may go **below zero**, red on the
board.

**Your arms** (the CD's "personal inventory"). **A tap on an output bin takes everything in it**
(the planer's from whichever side is nearer: the floor, or the walkway by the counter). **A tap on
the counter stocks the stall** with the medium planks you carry and only those (you always get it
right); the rest stay with you. **A tap on the recycle bin** opens a bubble with one button for each
kind of thing in your arms (a teal arrow: put them all in) and one for each kind in the bin (an
orange arrow: take them all out), so anything put in the recycle bin can be had back. **A tap on an
input bin** offers what you carry that it takes: the planer's rack normal logs (they roll in before
the pile's), the saw's planks, the extractor's sap logs, the bench's gnarled logs and gnarled
planks. When you carry more than one thing a white chip over the avatar says how many.

**The counter sells by itself.** Customers walk in at the door on the left, the first after 12 s
and then one every 8 to 16 s, and queue along the counter for the stall, the first at the stall
facing you across it. With something in the stall, **the customer at it taps a card 2.5 s later,
pays, and carries it out the door**; with nothing, **every customer standing in line waits, and
each costs 0.1% of customer satisfaction a second** (an hourglass over each one); the CD's example
comes out exactly (three waiting at 100%, four seconds later 98.8%, shown as 99%). A customer
walking in, or paying, is not waiting. **Once six are inside, nobody else comes in** until someone
leaves (the CD's answer). **What customers pay is the stall's $4 times customer satisfaction** (the
CD: satisfaction affects the price): $3 at 85% and 70%, $2 at 50%, $1 at 30%; the counter's label
shows what they pay now, green at the full price and amber or red below it. Anything but a medium
plank in the medium plank stall **still sells, as a medium plank, for the same money**, and costs
15 points of customer satisfaction (the customer leaves with a red "!"). Only medium planks are
sold for now; the CD's prices for the rest are in `CFG.price` for when they are.

**Robots.** The dock's bubble hires one ($20, then $40; two at most); it climbs out of its crate
and the bubble turns to it: its **name** on top, then **the planer**, **stocking the counter**,
**rest**, and **its clipboard**. Giving a job someone already has swaps them. Robots work only the
planer and the counter for now (the CD). A robot does what is in front of it; what it gets wrong
depends on what it meets and on what it has been told:

| Robot | It meets | Without the instruction | The instruction that prevents it |
|---|---|---|---|
| Operator | a sap log, any size | feeds it in ($1): the planer jams until **you** scrub it ($5); red | Put sap logs in recycle bin; or, for a small or large one, the size instructions below |
| Operator | a gnarled log | feeds it in ($1): a gnarled plank of its size; yellow | Put gnarled logs in recycle bin |
| Operator | a small or large log | feeds it in: a small or large plank; yellow | Only input medium logs (small and large, every quality), or Put small / large logs in recycle bin |
| Operator | anything but a medium plank coming out | it goes to the output bin | Only output medium wood planks (flicked into the recycle bin as it leaves the planer) |
| Operator | - | - | **Never put sap on input log** prevents nothing (no robot pours sap): a look-alike that joins the list with the sap-log one |
| Operator | - | - | **Put medium logs in recycle bin** throws every medium log away, good ones included: it joins the list with the small- and large-log ones |
| Operator | every cycle | 25% of the time it stops and thinks 3 s first; **no instruction covers this yet** | - |
| Stocker | anything but a medium plank in the output bin | it takes the next thing, whatever it is, and **puts it in the medium plank stall**: red (a customer will pay $4 for a medium plank and get something else) | Only stock medium planks: it leaves everything else in the bin and **hunts** for a medium plank, each reach finding one with the chance medium planks / everything in the bin; a reach that turns up something else picks it in proportion to what is there and is a **"looking for plank"** (0.8 s putting it back) |
| Stocker | a small plank, a large plank or a gnarled plank it turns up | as above | **Put small planks / large planks / gnarled planks in recycle bin** (gnarled of any size): that thing goes over the out-feed into the recycle bin, never back in the bin and never into the stall. These join the list the first time the stocker turns the thing up without the instruction |
| Stocker | - | - | **Sell medium wood planks for $4** prevents nothing (the stall sets the price; a stocker never names one): a look-alike that joins with "Only stock medium planks" |
| Stocker | a full stall | waits; one already carrying holds it until there is room | - |
| Either | the end of a task (operator: each log pressed, tossed or caught at the exit; stocker: each thing stocked or recycled) | goes straight on to the next, so an instructed operator fills the output bin faster than customers buy | **Wait between tasks** (2026-10-16): on the list from the start, set under its slot to 0-60 s (5 to begin with); the robot waits that long under a pause sign (§ A delay between tasks) |

A robot that holds an instruction **slips 1 time in 20** and does what it would have done without
it; the stocker decides **once a stocking** whether to follow "only stock", so a long hunt is one
chance to slip. **An instruction about another job is never consulted**, so it does nothing (the
rules suite plays a day with the instructions crossed, and with the look-alikes, and gets the same
day roll for roll as with none). Instructions **belong to the robot**. Two operator instructions
about the same log each get their own chance. An upstream instruction can keep a downstream mistake
from ever happening: an operator told about every bad log hands the stocker only medium planks, so
"Only stock medium planks" never even joins the list. Cutting a log puts on the list every
instruction that would have kept it out (a small sap log that jams the planer adds the sap-log one
and both size ones).

Each outcome shows: a check, a squiggle or a cross pops over the robot, its screen face changes,
and it beeps; a jammed planer shakes, smokes and flashes amber while its operator shows a "?"; a
stocker hunting the bin leans in and shows a magnifying glass. Anything recycled arcs into the
recycle bin (a stocker's throw goes over the out-feed), and the last few things in it poke out of
its mouth. The first time a robot makes a kind of mistake, "new instruction" floats up over it.

**Slots 02 to 04 are yours** (the CD). **The table saw**: a tap on it (or its console) opens three
cuts, **2x4, 2x2 and dowels**, greyed until there is a plank in its input bin; a tap presses it
($1) and the first plank in becomes **two 2"x4"s, four 2"x2"s or sixteen dowel rods of its length**
(3 s), banded, in its output bin; its blade spins only while it cuts. **The sap extractor**: a tap
presses it ($1) on the first sap log in; 4 s later **a clean log of the same size and 1 / 2 / 4
jars of sap** (one jar a unit) ride out to its output bin, and the sap rises in its glass tank while
it runs; the clean log can go on the planer's rack. **The bench**: a tap starts you carving the
first piece of gnarled wood in (a gnarled log or a gnarled plank) by hand, 5 s, free, into **a
carved bowl, bird, spoon or owl**; walking away leaves the piece on the bench, half done. Carvings
and gnarled planks have no price yet.

**Customer satisfaction** starts at 100%, takes 15 points per anything else sold as a medium plank
and 0.1% a second per customer waiting, gives one back per fair sale, never drops below 10%, and
**heals by itself** (each second closes 0.5% of the gap to 100).

**A robot's page** (its bubble's clipboard): its **name** in an editable field (16 characters at
most; blank puts its own back), its **base prompt** ("Use the planer to refine raw materials." /
"Stock the sales counter with the items in this bin."), then its **five slots** ($5 to $25, once
both robots are on staff) and the **list** of instructions for mistakes seen so far, then its
**Evals**: one line per action and thing, naming every log by its size and quality ("Cut a small
log: a small plank", "Fed in a large sap log: a jam", "Put a medium gnarled plank in the medium
plank stall"), counted, with a dot: **red** only for a blocker (a jam) or a hit to customer
satisfaction (anything but a medium plank put in the medium plank stall), **yellow** for anything
unexpected or wasteful (thinking, any other log cut, a reach that came up empty), **green** for what
was asked; done against its own instructions, green turns yellow, as a line of its own. **Reset
evals** starts them again. The antenna bulb shows how many instructions it holds.

**The chrome** (both modes): the menu button top left (Info, Sound, Exit game), the mode dropdown
beside it, a reload button top right, the build badge bottom right in the device's time zone. Info
here starts from the goal and explains wood, your arms, the counter and its customers, the slots
and the CD's prices, the robots, the evals and instructions, each robot's tally and yours, and
**Start over**.

### A delay between tasks (CD, 2026-10-16) - stated

The CD's answer to open question 2 (overproduction), quotes made straight: "**Add an instruction
that lets me add a delay between iterations of its task.** Let the delay be a **configurable value,
a positive integer 0,1,2,...,60 seconds**." Four answers the same day, before any code:

| Question | CD's answer |
|---|---|
| Which robots can take it? | **Every robot**: one instruction, any job (the operator waits between logs, the stocker between stockings). The first instruction that belongs to no one job |
| When does it join the list? | **From the start**: on the list as soon as there is a slot to put it in, not after a mistake (the first exception to "an instruction joins when its mistake is seen") |
| Does a robot ever ignore it? | **Slips 1 in 20**, like every instruction: about one iteration in 20 it goes straight on |
| What is one operator iteration? | **Every log it handles**: the wait comes after each press (once the cut is out) and after each log it tosses in the recycle bin |

**What was built.** "**Wait between tasks**" is on every robot's list from the first slot. Put in a
slot, the slot grows a second line: a **slider** from 0 to 60 s in whole seconds with a **-** and a
**+** either side (greyed at the ends) and the figure, "5 s" to begin with. Each robot keeps its
own number, even with the instruction out of its slot. At the end of each task (the operator:
after each log pressed, once its cut is out or the planer has jammed, after each log tossed, after
each bad plank caught at the exit; the stocker: after each thing stocked or recycled, never after a
reach that found nothing) a robot that holds it waits that long: a **pause sign** over it (a white
disc, two bars and a teal ring that empties) and a calm face. About one task in 20 it **goes
straight on** instead. Its Evals gain "**Waited between tasks**" (green) and "**Went straight on,
against its instructions**" (yellow, the slip). A job change, rest, or the instruction taken out
of its slot ends a wait; a shorter wait set mid-wait ends it sooner. The next log rolls onto the
planer while its operator waits, so the gap between two logs is the longer of the wait and the
0.9 s roll-in, then the press. Info says all of this under Instructions.

**Measured** (the eval's paced persona, § Measured, the delay): with the slider moved by what piles
up in the output bin, the hour ends with 3 medium planks there instead of 116 and climbing, 297
customers served instead of 302, satisfaction at 100%, and $83 more. **The 5 s it starts at starves the line** behind an
operator holding its whole plan (satisfaction ends at 10-24% on all eight seeds); 3 s works on all
eight (open question 10).

**The hair, the same day** (the CD: "customers appear to go bald when they turn to face towards
me (down)", the avatar too). Traced: the hair sorted by its own centre, which lies behind the
head's, so facing the camera the head drew over it. The hair is now the old ellipsoid less the
facets in front of the head's centre and below a hairline 0.1 m up (`hairOver()`), sorted as the
head with a small bias: the face shows through and the back and sides are as they were.

### Bins you can take from, logs bought by the ten, and $0.10 a machine run (CD, 2026-10-16) - stated

The CD, after playing the delay build (quotes made straight): "**Fix this bug where I am scrolling
in the list of instructions to select one and it unexpectedly (frequently) moves back to the top of
the list.**" "**Enable removing items from the input bins.** For example I might put a plank in the
table saw input bin but then change my mind and decide to sell it." "**Allow adding/removing logs
to/from the planer input bin.** This way I can add logs output by the sap extractor. **Start new
game with 10 logs in the slot01 input bin. When I run out, auto restock it with 10 more that cost
me $10. No limit to how many items are in any bin.**" And the bins' bubble: "**top half** of the
white list area shows items I hold but could put in the bin; **lower half** lists items I could
move from the bin into my inventory; **the horizontal line dividing top from bottom should not
move** as items are moved between my inventory and bin; the listed items on the top should
**settle into the lower left corner** of the top section (so that I could repeatedly tap that lower
left item tile spot to move everything from me to the bin); items on the bottom should **settle
into the upper left corner** of the bottom section."

Three answers before any code:

| Question | CD's answer |
|---|---|
| Logs cost $1 each when bought: does the planer still charge a press too? | **Keep both** (then changed, below) |
| Which logs can go in the planer's input bin? | **Any log**, sap and gnarled too; the planer treats them as before |
| When does the restock happen? | **When the planer needs a log** and the bin is empty; emptying it by hand costs nothing until then |

Measured before going on (the eval, below): with $1 a log and $1 a press a good medium plank cost
about $3.05 to make and sold for $4, and an attentive line lost money. Shown that, **the CD changed
the costs**: "**Reduce machine operating cost from $1/input to $0.10/input.** This represents
electricity and general wear and tear. **Ensure minimum sale price of any item never decreases below
the material+labor cost** (I think this would be **$1.10 min sale price for any plank, $1.20 for two
2"x4"**, ...) where sale price decreases as customer satisfaction decreases. This should ensure I can
always recover my operating costs and slowly restore customer satisfaction given enough time." The
same answer asked for **up to four stalls** ($50, $100, $150), set by tapping, with one stocking
robot each, and **robots for slots 02 to 04**; four answers on those (customers pick a stall at
random; slot robots make no mistakes yet; robots +$20 each, $20 to $160; an "Only stock X" per
item) are recorded with their plan, `.claude/plans/DONE/taasstalls.stalls-arc.md`, and were built after
this brief (§ Four stalls and eight robots, below).

**What was built.**
- **The list that jumped** (traced): the robot's page was rebuilt whole whenever its signature
  changed, and the signature held the robot's evals, so every log it finished rebuilt the picker's
  list, which scrolls by itself, back at the top, and could swap the button under a finger. The page
  is now **three parts** (base prompt and slots, the picker, the evals), each rebuilt only when what
  it shows changes, never while a finger is down in it, and keeping where its lists were scrolled.
- **Every bin you put things in gives them back**: the planer's, the table saw's, the sap
  extractor's and the bench's input bins as well as the recycle bin. **Its bubble** is two halves of
  the same height with an ink line between them: what you carry that the bin takes on top, settled
  into the lower left; what is in the bin below, settled into the upper left; one tap moves every
  one of a kind; an empty half shows a faded tile where the next would be. The halves are sized when
  the bubble opens to hold every kind on either side (and only grow), so moving things never moves
  the line, and tapping one spot again and again moves everything across.
- **The planer's input bin** (its rack): a new factory starts with **10 logs** in it, drawn as logs
  are bought (the first log on the in-feed is still a normal medium one, as it always was); any
  log goes in; logs you put in roll in before the ones bought, and you press any normal log you put
  in yourself; when the planer needs its next log and the bin is empty, **10 more arrive for $10**
  ("-$10, 10 logs bought" floats up over the rack). The rack shows up to six of its logs. No bin has
  a limit.
- **$0.10 a machine run** (the planer, the table saw, the sap extractor; fixing a jam stays $5).
  Money is kept **to the cent** and the wall board shows the cents.
- **The price floor**: what a customer pays is the list price times customer satisfaction, now to
  the cent, and **never less than the thing cost to make** (`CFG.floor`): any plank $1.10 and any
  cut $1.20 (the CD's numbers), a log $1, sap $0.10, a carving $1.

**Measured** (the eval, seed 7, an hour; § Measured, the bins): a person alone has $20 at 1.6 min
and the second robot at 7.7 (4.7 before logs cost money). An instructed operator handles about 18
logs a minute against 5 customers, so **a line without the delay now buys logs it never sells**:
its plan of four instructions comes at 50 / 45 minutes. With the delay put in the moment the
operator is hired, the plans come at 23 / 17 minutes, the line clears $11.50 a minute, and that is
the new optimal path. (Seed 7. Over seeds 1-12 the plans come sooner on seven, about the same on
three, later on one and never on one; the money ends higher on ten: § Measured, 2026-10-17.)

### Four stalls and eight robots (CD, 2026-10-16) - stated

Asked inside the CD's answer to the bins brief (quotes made straight): "... (and ability to sell all
finished products... go ahead and **add a way to purchase additional sales stalls (up to 4 total)**,
and allow me to **specify what is sold at each by tapping on it** to set its item; **any unsold items
automatically go into my inventory** when i change what is sold in a stall. **Each additional stall
costs $50, $100, $150.** **One robot per stall, so add 3 more robots** i can order. These robots will
**travel to specific bin to fetch an item and put it in the stall**. Each gets **same base prompt** and
my instructions ensure they stock correctly. **Add 3 more robots i can buy so i can staff them to the
other slots 2,3,4.**" Four answers the same day, before any code:

| Question | CD's answer |
|---|---|
| With up to four stalls, what does each customer come in for? | **A stall, at random**: each customer picks one of the stalls that has an item set, all equally likely, and waits there if it is empty (costing satisfaction as now). Arrivals stay one every 8-16 s |
| What can the robots on slots 02-04 get wrong? | **Nothing yet**: each works its machine on whatever is in its input bin, no mistakes and no instructions of its own for now. The saw robot makes the cut chosen on its page. Mistakes can come in a later brief |
| What do the six new robots cost? | **+$20 each**: $20, $40, $60, $80, $100, $120, $140, $160 |
| How do the stall robots' instructions keep them right? | **Rules per item**: one "Only stock X" instruction for each item a stall can sell (Only stock small planks, Only stock 2x4s, ...), joining the list as each mistake is seen |

Built in steps 1-4 on branch `taas-stalls` (plan arc `.claude/plans/DONE/taasstalls.stalls-arc.md`, its
Results per step). Each choice the CD did not make is an assumed row below, from "Stalls: ..." on.

**What was built.**
- **Four places along the counter**, east to west, the first where the one stall always stood. The
  first is a stall of medium planks from the start; an empty place is a dashed outline with a white
  plus, and a tap on it buys it for the next price ($50, $100, $150 by how many are bought). A stall
  bought sells nothing, and nobody comes for it, until you set it.
- **A tap on a stall** stocks it with what you carry of its thing and opens a bubble of the **13
  things with a price** (planks small, medium and large; sap; 2x4s, 2x2s and dowel rods at three
  lengths), each with its picture and what a customer pays for it now. Choosing another puts the
  unsold stock in your arms. Each stall has its tray and its label on the counter: the price a
  customer pays now, then the thing in capitals; a stall not yet set has a blank label.
- **Customers pick an open stall at random** (one die, rolled only when there are two or more). One
  waits at each stall across the counter; anyone whose stall is taken waits in **one line along the
  back wall**, first come first served (its hourglasses beside the head). A customer waits at an empty
  stall for ever, so a stall nobody stocks fills the shop (open question 12). What each pays is its
  stall's price times satisfaction, never below the floor; a wrong thing costs 15 points and says what
  was wanted.
- **Eight robots**, Bolt to Dynamo, $20 to $160, hired from **a dock of eight** (two rows of four
  crates). Jobs: the planer, **a stall each** (one job for each stall bought), **the table saw**,
  **the sap extractor**, **the bench**, or rest; one robot to a job. Instruction slots open once two
  robots are on staff.
- **A stall's robot** waits at the output bin its stall's thing comes out of (planks the planer's,
  cuts the saw's, sap the extractor's), reaches in, walks **one thing** to its stall in both claws and
  walks back. The same base prompt for every stall robot; **"Only stock X" for each of the 13 things**
  (the medium plank one is the old "Only stock medium planks"), only its own stall's consulted; a
  recycle instruction never takes the stall's own thing. Its evals name the thing.
- **Slot robots** press the saw or the extractor whenever it is idle with something in its input bin,
  and carve the bench's gnarled wood piece by piece; no mistakes, and no instruction but the delay.
  **The saw robot's page has its cut** (2x4, 2x2, dowels). The bench is one pair of hands: you or its
  robot. Nothing carries between machines but you (open question 13).
- **Info** tells all of this, and its Tips gained two (§ Tips). Saves stay version 3: `load()` makes an
  older save's stall the first, with three places to buy, and its stocker the first stall's robot.

**Measured** (§ Measured, 2026-10-17): a stall changes what a customer pays, never how many come; a
second stall of the same thing never pays, a saw line selling 2x4s pays on most seeds, and a stall
whose thing is scarce, or that nobody stocks, takes the shop with it. With four stalls and eight robots
the scene holds the frame budget once robots are baked by pose (§ Measured, storefront, frame cost).

### Goals that unlock the slots, bins and stalls you fill by hand, flat prices (CD, 2026-10-20) - stated

The CD's sixth factory brief, after playing the stalls build (quotes made straight):

> - start with only one sales stall set to sell medium planks, and slot01 with the planer.
> - use the same add/remove interaction i have with the recycle bin to every input bin and output
>   bin and sales stall. Later i will have robots moving items between bins, and they will mess up
>   sometimes, so each station needs mechanics for what can go wrong with wrong inputs.
> - when i tap in a sales stall give me two options to choose from: "re-assign" and "re-stock". If
>   i tap reassign then it takes me to the current menu where i select what to sell in that stall.
>   If i tap restock then open the standard add/remove menu (with all items).
> - add green dots to the sales stall (one dot for each item in the stall) as a visual indicator of
>   how many items are stocked there. Put these green dots immediately above the price and item name.
> - i need to be able to add/remove with output bins too so that i can put the correct items there
>   for the robots to grab when restocking.
> - Change first goal to "Goal: Sell 50 medium planks", when it is completed the player is rewarded
>   with slot02 gaining the sap extractor.
> - second goal is "Goal: >$50 & >90% customer satisfaction for 10 minutes" where 10 counts down in
>   real time while customer satisfaction is above 90%, but resets to 10 if drops below 90%. Reward
>   is the handcrafting station added to slot03.
> - make the default cost of each new sales stall and robot a flat $1. Add settings menu options to
>   adjust this flat cost for robots and an option for sales stall cost.
> - allow a sales stall to be "closed" (similar to robot sleep mode) if i want to stop selling items in it.

Four answers before any code:

| Question | CD's answer |
|---|---|
| The goals put the extractor in slot02 and the bench in slot03; where does the table saw go? | **Slot04, goal 3**: slot04 starts empty and a third goal unlocks the saw there. Goal 3 drafted by Claude as **"Sell 25 sap"** (assumed; the CD may change it) |
| What does a machine do when run on the wrong thing? | **It jams**, like a sap log in the planer today: $5 to fix, and the thing goes to the recycle bin. An extractor on a log with no sap runs empty ($0.10, the log back). Stalls and output bins go wrong as now (wrong sales, misstocks) |
| Goal 2: money drops to $50 or below while the 10 counts down? | **Resets to 10**: both conditions must hold the whole 10 minutes; either failing starts the countdown over |
| The new menus replace two one-tap shortcuts (a stall stocks itself when you reach it; an output bin empties into your arms). Keep one? | **As written**: every bin and stall works like the recycle bin, no automatic action on arrival. Robots will do most of the carrying later |

The brief also answers open question 13 ("Should a robot carry things between machines?"): **later**
("Later i will have robots moving items between bins"). Built in steps 1-5 on branch `taas-goals`
(plan arc `.claude/plans/DONE/taasgoals.goals-arc.md`, its Results per step; the file moves into `DONE/`
when the arc ships). Each choice the CD did not make is an assumed row below, from "Goals: ..." on.

**What was built.**
- **A new factory starts small.** One stall of medium planks and slot 01's planer; slots 02-04 are empty
  bays (the painted number only): nothing of a locked slot is drawn, tappable, offered as a robot's job
  or in the walk grid. Which slots are open is derived from `s.goal` (goals met, 0-3), never stored.
  **The slots' new order** is 02 the sap extractor, 03 the hand crafting bench, 04 the table saw
  (`ROW = { planer: 4.0, extract: 7.3, bench: 10.1, saw: 12.75 }`; the bench's footprint is offsets
  from its row).
- **Three goals on the wall** (`CFG.goals`), one at a time. 1: "Sell 50 medium planks" (the number
  counts down as they sell; unlocks the extractor). 2: ">$50 & >90% customer satisfaction for 10
  minutes" (unlocks the bench): a 600 s countdown (`s.goalT`) runs while money is above $50 **and**
  the satisfaction as the board shows it is above 90, and goes back to 600 on any step either fails;
  the board reads "for 9:41" while it counts. 3: "Sell 25 sap" (unlocks the saw; the draft). Then
  "All goals met". A goal met fires a `goal` event: the level sound, sparks along the slot, the
  machine fading in over 0.6 s and a cyan float "slot 02: the sap extractor" (3 s). Anyone standing
  where a machine arrives steps aside and every walk under way is replanned.
- **Every bin and stall works like the recycle bin.** The four input bins, the four output bins and each
  stall open the bubble of two halves (what you carry, any kind, on top; what is in it below; a tap a
  kind). Nothing happens by itself on arrival: an output bin no longer empties into your arms and a
  stall no longer stocks itself. Nothing filters what goes in (`ACCEPTS` names all nine bins).
- **A stall's tap offers three words**: **Re-assign** (the stall's thing as its picture; the 13 things
  under a back button, choosing one sets it without stocking and goes back), **Re-stock** (the two
  halves under a back button; a put fills the stall to six and keeps the rest in your arms; a take
  returns every one of a kind) and **Close** / **Open** (the zzz). A closed stall is read **CLOSED** in
  red in place of its price; nobody new picks it, a customer at it who is not paying picks again among
  the open stalls or, with none open, walks out at no cost to satisfaction; with none open nobody
  comes in and no die is rolled. Its stock, dots and robot stay (the robot idle). **Green dots**: one
  for each thing in the stall (at most six), all green, in a row above the price and the name.
- **A machine run on the wrong thing jams** (`RIGHT` says what each is made for, `runOf(key, item)`
  says 'run', 'empty' or 'jam'): the planer on anything `makes()` calls a jam (so a plank), the saw on
  anything but a plank (rough planks included), the extractor on anything but a log, the bench's
  chisel on anything but gnarled wood. The run is charged, the machine stops 1.3 s in (`CFG.jamAt`) and
  stays jammed, drawn with an amber light, grime down its front as long as its dirt and smoke, until
  you tap it and scrub it ($5; `unjam()`), **and every cleaned jam puts the jammed thing in the recycle
  bin** (the planer's sap log too, which used to vanish). The extractor on a normal or gnarled log runs
  **empty** ($0.10, the log back, no sap; yellow for a robot). A robot on a jammed machine waits, red
  `jam:<item>` in its evals. **You never get it wrong**: a press when the first thing in an input bin
  is not what the machine is for tosses it into the recycle bin instead, one a tap.
- **Flat prices**: a robot and a stall cost **$1** each, set in the menu (factory only, **Prices**:
  "Robot $1" and "Stall $1" with - / + steppers, whole dollars $0-$200, saved at once, kept by Start
  over). `CFG.flat` replaces `CFG.hire` and `CFG.stalls.prices`.
- **Info rewritten**: the goals as a numbered list, the slots' order, "Your arms", the stall's three
  choices, the dots, closing, the wrong thing in a machine and Prices. The Tips are unchanged.
- **Saves stay version 3.** A save from before this brief is all three goals met (every slot and
  whatever is in the bins is kept); `load()` no longer filters bins by `ACCEPTS` or resets a
  non-log on the planer's in-feed. An old save's `pick` and `stock` acts finish as they began.
- **Suites**: rules 260 -> 358 (sections 16 and 17), page 129 -> 159 (sections 22 and 23), eval 32 -> 35
  (the goals rows); break lists 144 -> 216, 108 -> 148, 9 -> 14. Formal untouched (43 / 39 / 9).

**Measured** (section Measured, 2026-10-20, the goals): a goals persona plays from a new factory through
all three goals on 12 of 12 seeds inside the hour (goal 1 at 9.8-11.8 minutes, goal 2 at 28.2-36.9,
goal 3 at 36.0-48.9); the flat $1 changes five of the eval's claims in substance (open
question 19).

### Assumed, not decided (Claude's choices; the CD has not ruled on these)

| Assumption | Where it lives | Why |
|---|---|---|
| **Formal stays the default** on a first visit; the choice is remembered (`taas-mode`) and `?mode=` wins over it | `MODE` | The CD said the current game *becomes* a mode |
| **The look**: a chibi in a yellow hard hat; white robots on a hover base; customers in their own shirts and hair, no hat; a grey concrete floor, a wooden shop floor and counter, steel-blue planer, grey input bins, blue output bins, a green recycle bin, a white table saw with an orange guard, a green extractor with a glass tank, a wooden bench | `COL`, `AV`, `RB`, `custParts()` | Taste |
| **Camera**: orthographic, 50 degrees above the floor, no yaw | `ELEV` | Zelda-like |
| **Timings**: 0.9 s for the next log, 0.8 s out-feed, 0.35 s drop, 0.6 s to toss, 0.4 s to empty a bin into your arms, 0.45 s to stock the counter, 3 s a cut, 4 s an extraction, 5 s a carving, 2.5 s for a customer to pay; walk 1.7 m/s, robots 1.3, customers 1.1 | `FACTORY.CFG` | The CD fixed only the 4 s and "within a few seconds" |
| **Storefront: "Fix sap jam costs $5" means scrubbing a jam clean costs $5**, charged when it is clean (inferred), on top of the press | `CFG.fixCost`, `stepAvatar()` | The open question "should a jam cost more than time" had asked exactly that |
| **Storefront: the customer in the CD's stocking example pays $4**, not $5 (inferred: the CD's "$5" there is the old price; the stall is "$4 medium plank") | `buy()` | The brief cut the price to $4 |
| **Storefront: satisfaction already set prices** ($ times satisfaction since the first build); kept, now what customers pay at the stall, and **shown on the counter's label** (green at full price, amber or red below) | `paid()`, `drawPlate()` | The CD asked for it as if new: making it visible is the change |
| **Storefront: the goal is a dark board across the top of the wall**, drawn live from the stall's price; the wall grew to 3.3 m for it | `drawBoards()`, `BOARD.goal` | "Add to the rear wall"; under the boards the shop's customers would cover it |
| **Storefront: the log mix**: 20 / 65 / 15% by size, 75 / 15 / 10% by quality, one named roll over the nine kinds, now rolled as logs are bought | `CFG.logs`, `buyLogs()` | About half normal medium logs, as before |
| **Storefront: the three lengths drawn 0.55, 0.85, 1.1 m** | `LEN` | 2', 4', 8' would not fit the belts |
| **Storefront: you at the planer press a normal medium log, or any normal log you put in its bin yourself, and toss the rest** (a sap or gnarled log you put in is tossed too) | `yours()`, `work()`, `s.rackMine` | "Always correct" for the goal; a log you put on the rack is your choice, and the CD wants extracted logs to go back to the planer |
| **Storefront: a tap on an output bin takes everything** (no bubble); input bins and the recycle bin open a bubble, one button a kind, one tap moving all of that kind (in or out, since 2026-10-16); arms hold any number | `arrive()`, `options()`, `choose()` | The CD's flow (pick up, deliver, keep the rest, recycle the extras) in the fewest taps |
| **Storefront: the stall holds 6**, shown as a stack on a teal tray; one stall, `CFG.stalls`, ready for more (four since 2026-10-17, each holding 6) | `CFG.stallCap`, `CFG.stalls` | "Initially one slot" |
| **Storefront: customers**: the first after 12 s, then every 8, 10, 12, 14 or 16 s (a named roll, `arrive`); they pay 2.5 s after reaching a stocked stall; **waiting** means standing in line, at an empty stall or behind someone, not walking in and not paying; they leave by the door they came in | `CFG.shop`, `stepShop()` | Demand a person alone can just keep up with (measured, below): faster and the line fills, satisfaction hits the floor, prices with it, and no persona ever affords the second robot |
| **Storefront: a wrong sale still pays $4 times satisfaction** and costs the old 15 points | `buy()`, `CFG.satHit` | The CD: "customer paying [$4] ... getting something else (customer satisfaction decreases)" |
| **Storefront: healing, +1 a fair sale and the 10% floor kept** | `CFG.sat*` | The CD's 99% example still comes out (healing adds about a hundredth) |
| **Storefront: the stocker's job**, base prompt "Stock the sales counter with the items in this bin.", and instruction wording "Only stock medium planks", "Put small / large / gnarled planks in recycle bin" | `BASE`, `RULES` | The CD named the mistakes, not the words |
| **Storefront: an uninstructed stocker stocks whatever comes next** (the seller's 50% honest sale had nowhere to go: the stall prices everything as a medium plank) | `stocker()` | Every such mistake is red, as the CD said |
| **Storefront: the red mark goes on at stocking**, the satisfaction hit at the sale | `stocker()`, `buy()` | The mistake is the robot's; the hit is the customer's |
| **Storefront: the seller's giveaways and cheap sales are gone, and so are "Sell ... for $5" as a rule and "Put dowel rods in recycle bin"**; "Sell medium wood planks for $4" stays as a look-alike | `RULES` | The stall sets the price; the planer no longer makes dowels |
| **Storefront: instructions read logs by quality and by size** ("Only input medium logs" keeps out small and large of every quality; a small sap log is kept out by it, by "Put small logs in recycle bin" and by "Put sap logs in recycle bin") | `RULES` (`rejects`, `matches()`) | The CD's two dimensions |
| **Storefront: the layout**: rows down the floor, open at their east end; the walkway reached round the planer's output bin; the recycle bin left in front of the planer's out-feed (the stocker throws over the belt); the stocker west of the stall's label and your counter spot east of it, so neither covers it; the dock at the bottom; the bays, the hatch and the old props gone | `LAYOUT` | One floor; the label readable; the operator's tosses as short as before |
| **Storefront: the numbers on the floor** sit in each bay's front margin, at 0.45, 3.0 and 5.52 m | `SLOTS` | "Left, right and middle" |
| **Storefront: the saw's cut is chosen per press** from its bubble; the first plank in is cut; a cut is one banded bundle | `options()`, `startMill()` | The fewest taps for one cut; a bundle is what the CD priced |
| **Storefront: sap is one jar per unit**, the clean log first down the out-feed | `millOut()` | The CD's 1 / 2 / 4 units |
| **Storefront: the bench takes gnarled logs and gnarled planks**, 5 s by hand, free, four designs from a named roll (`carve`); walking away keeps the progress | `carve()`, `DESIGNS` | "Gnarled wood"; no cost or price was given |
| **Storefront: a factory saved before this brief starts fresh** (save version 3) | `CFG.version` | Wood, the bins and the jobs all changed under it |
| **Storefront: things in bins and on belts, and customers standing in line, are baked once and blitted** | `itemSprite()`, `personSprite()` | The busy scene was missing every second frame without it (measured, below) |
| **Slip 5%** and **slots, names, the robot's page, the antenna bulb, Reset evals, the menu, sound and the badge** as before | `CFG`, the page | Unchanged by this brief |
| **Delay: the wording** "Wait between tasks", one row with `job: null` (consulted by every job), last on the list; **held once**, like any instruction; **one number per robot** (`r.wait`), kept while the instruction is out of its slot | `RULES`, `newRobot()` | The CD gave the meaning, not the words |
| **Delay: 5 s to begin with** (and for a loaded robot without a number) | `CFG.wait.start`, `load()` | 0 would look like it does nothing. **Measured to starve customers** behind an operator holding its whole plan; 3 s works (open question 10) |
| **Delay: what ends an iteration**: the operator's press once the cut is out **or the planer has jammed** (a sap log fed in was handled too), a toss, a bad plank caught at the exit; the stocker's stocking or recycling, **never a reach that found nothing** (the thing went back, so the job is not done); a toss you beat the robot to is none | `done()` | The CD's "every log it handles"; the stocker's iteration by analogy |
| **Delay: the slip is rolled once an iteration, at its end, and only when the wait is above 0**: at 0 s no die is used, so a day matches a day without the instruction roll for roll | `done()`, `follows()` | The "crossed wires" proof stays possible |
| **Delay: a wait is a robot state, `pause`**, left after `r.wait` seconds (read every step), or by a job change, rest, or the instruction taken out | `pause()`, `release()` | Like every other state |
| **Delay: the wait overlaps the next log rolling in**, so the gap between logs is the longer of the wait and 0.9 s, then the press | `operate()` | "Sleep N between iterations"; the next iteration still waits for its log |
| **Delay: `setWait()` refuses** anything but a whole number 0-60 (no rounding); allowed with the instruction in no slot | `setWait()` | The slider and steppers only give whole numbers; a fraction can only be a bug |
| **Delay: Evals** "Waited between tasks" (green) and "Went straight on, against its instructions" (yellow), written as lines (no tally, no face, no outcome) | `GRADE`, `DOING`, `note()` | The fourth brief's rules: a slip is a yellow line of its own |
| **Delay: saves** keep version 3: `load()` puts the delay on the list and clamps `r.wait` (anything not a number -> 5) | `startSeen()`, `load()` | A bump would wipe every player's factory |
| **Delay: the controls**: a slider (0-60, step 1) with - and + under the slot and the figure "N s"; at 360 px and under the row drops its indent; never redrawn while a finger holds the slider | `renderRobot()`, `part()`, `holdPart` | The CD's "configurable value"; a 60 fps redraw would stop a drag |
| **Delay: the pause sign**: a white disc, two bars, a teal ring that empties, beside the mood badge while it is up; a calm face; a slip draws nothing | `pauseSign()`, `drawRobot()` | The wait has to be seen, or a robot told to wait looks broken |
| **Hair: a hairline 0.1 m up**, the facets in front of the head's centre and below it cut away, the rest as it was | `hairOver()`, `hairCap()` | The CD asked for hair, not this shape; a cap of the facets outside the head was tried first and left a bald patch seen from behind |
| **Bins: the first log on the in-feed is not one of the 10**: a new factory has a normal medium log on the planer, as always, and 10 in the bin | `newGame()` | "Start new game with 10 logs in the slot01 input bin", read literally |
| **Bins: the 10 to start are free**; a restock is 10 more drawn the same way | `newGame()`, `restock()` | Money starts at $0 |
| **Bins: logs you put in the planer's bin roll in first** and you press the normal ones whatever their size (`s.rackMine` counts them, always the front of the bin); taking a kind out takes yours and the bought ones alike | `choose()`, `nextLog()` | As the rack worked before; the CD wants the extractor's clean logs to go back to the planer |
| **Bins: a save from before** keeps its rack as yours and gets the 10 a new factory starts with, free; no version bump | `load()` | A bump would wipe every player's factory |
| **Bins: the bubble** for the five bins (planer, saw, extractor, bench, recycle): one tile a kind (all of that kind per tap, as before), two halves of the same height sized at open for every kind on either side and only growing, a faded tile where an empty half's first would be, each half scrolling once it has more rows than half the screen | `binHalves()`, `binLay` | The CD's layout; one tap per kind keeps "tap the same spot until it is all across" to a few taps |
| **Bins: the rack draws up to six of its logs**, three, two and one, the next to roll in on top; the old painted pile is gone | `RACK_AT`, the item pass | A bin of bought logs has to look like what is in it |
| **Bins: the robot's page in three parts**, each with its own signature; a finger down in a part holds it (a touch until it ends, since a browser cancels a pointer when a touch starts to scroll); a rebuild keeps every list's scroll | `part()`, `holdPart` | The jump the CD reported, traced to the whole page being rebuilt on every robot action |
| **Bins: $0.10 a machine run is per thing processed** (a log pressed, a plank sawn, a sap log extracted); the bench is by hand and free; fixing a jam stays $5 | `CFG.logCost`, `sawCost`, `extractCost` | "$0.10/input" |
| **Bins: money to the cent** (every change rounded to the cent); the wall board always shows cents ($12.30), a price or a cost only when it has some ($4, $3.41, -$0.10) | `cents()`, `cash()`, `usd()` | A $0.10 run makes cents everywhere |
| **Bins: prices to the cent** ($4 at 85% is $3.40; it was a whole $3) and **the floors**: a log $1, any plank $1.10, any cut $1.20 (the CD's), sap $0.10 (one extractor run; the log comes back clean, so it carries the log's cost), a carving $1 (a gnarled log, by hand); a wrong sale's floor is the stall's thing's | `CFG.floor`, `floorOf()`, `paid()` | "material+labor cost"; only medium planks sell today, so only the plank floor shows |
| **Bins: the eval's player** presses the planer only while fewer than eight medium planks wait (logs cost money now), every persona plays an hour, and the paced persona puts the delay in the moment its operator is hired | `eval-taas-factory.cjs` | A player who keeps pressing logs nobody buys loses money; measured, below |
| **Stalls: what a stall can sell**: the 13 things with a price (planks small, medium and large; sap; the nine cuts); logs, gnarled planks and carvings have no price, so no stall sells them (if they should, the CD names prices) | `SELLS`, `priceOf()` | Every thing the CD priced |
| **Stalls: four places along the counter**, east to west, the first where the one stall always stood and each of the others 1.35 m further west; **any empty place can be bought**, the price going by how many are bought ($50, $100, $150), never below zero money | `STALLS`, `stallPrice()` | "Up to 4 total"; the CD gave the prices in order, not the places |
| **Stalls: a tap on a stall** stocks it with what you carry of its thing (as the counter always did) and opens a bubble of the 13 things, each with what a customer pays for it now, the one it sells marked; choosing another brings everything unsold back into your arms (the CD) and stocks what you carry of the new thing; an empty place's bubble offers the stall at its price | `arrive()`, `options()`, `choose()` | "Tapping on it to set its item"; one tap to stock, as before |
| **Stalls: a stall bought sells nothing until you choose**, and nobody comes for it; there is no way to set a stall back to nothing (choose something else) | `openStalls()` | The CD: customers pick "one of the stalls that has an item set" |
| **Stalls: the shop in three rows**: one customer waits at each stall, across the counter from it; anyone whose stall is taken waits in **one line along the back wall**, first come first served (whoever's stall frees first goes, even past someone who came earlier for another); everyone walks in and out along **a walk between the rows**. With one stall that is one customer at it and the rest behind along the wall (the line along the counter is gone) | `SHOP` (`lineY`, `laneY`, `backY`), `stepShop()`, `walkTo()` | Four stalls side by side leave no room for a line at each in a 1.25 m shop; the CD's "waits there" |
| **Stalls: an empty stall fills the shop** (the CD's rule followed through): its customers wait while the others are served, until all six in the shop are its and nobody else comes in | `stepShop()` | "Waits there if it is empty"; asserted in the rules suite, to be weighed in the eval (taasstalls step 4) |
| **Stalls: no die for a counter with one stall** to choose from, so a day with one stall rolls exactly as it would have | `stepShop()` (`stall` roll) | The "crossed wires" proof stays possible |
| **Stalls: saves keep version 3**: `load()` gives a save from before its one stall as the first and three places to buy, a stall a thing with no price back to medium planks (the first) or nothing (the others), and a customer for a stall that sells nothing to the first | `load()` | A bump would wipe every player's factory |
| **Stalls: the goal on the wall stays "Sell medium planks for $4"** whatever the first stall sells | `WANT()`, `CFG.stalls.start` | It is the factory's goal, not a stall's label |
| **Superseded. Stalls, until robots get a stall each** (taasstalls step 2): the stocker stocks the first stall from the planer's output bin, whatever it sells | `stocker()` | Step 2 gives each stall its robot and its bin (done 2026-10-16: the rows below) |
| **Robots: the jobs are strings**: `operate`, `stock:0` to `stock:3` (one for each stall bought), `saw`, `extract`, `carve`; null rests. One robot to a job, so giving one a job someone has swaps them, as before. A save's `stock` is `stock:0` | `jobsOpen()`, `jobKind()`, `stallOfJob()`, `load()` | The stocker's job was the first stall's all along |
| **Robots: the dock of eight**: two rows of four crates 0.6 m square in front of the panel (which keeps its place and width, low enough not to hide slot 04's number), a cell of floor between any two so a robot unpacked anywhere can walk out; you hire from the aisle between the rows; the names after Bolt and Sprocket are Widget, Gizmo, Rivet, Piston, Ratchet and Dynamo | `CRATES`, `SPOT.rest`, `SPOT.dock`, `CFG.names` | A first try with the panel across the whole dock sent every robot round its east end and tipped the eval's paced persona into a jam spiral (traced: the old dock with everything else new played as before) |
| **Robots: instruction slots open once two are on staff** (it was "both", of two) | `CFG.slotsAt`, `slotsOpen()` | The plan's reading of "both" with eight to hire |
| **Stall robots wait at the bin, not the stall**: a stall's robot stands at the output bin its stall's thing comes out of (planks the planer's, cuts the saw's, sap the extractor's), reaches in, walks the thing to its stall, puts it in, and walks back; one thing a trip (the CD: "fetch an item"). The first stall's robot on planks stands where the stocker always stood, the bin behind and the stall in front, and never takes a step. A stall selling nothing: its robot waits at the stall | `homeOf()`, `SPOT.fetch`, `SPOT.stallBots`, `stocker()` (`carry`) | It sees the bin fill without walking; the first stall plays exactly as before |
| **Stall robots: "Only stock X" for each of the 13 things**, worded "Only stock small planks", "... sap", "... small 2x4s", "... small 2x2s", "... small dowel rods" (the medium plank one, `stockOnly`, as it was); a robot consults only the one for its stall's thing, so the rest do nothing on it (no die rolled) | `RULES` (`only`), `ONLY`, `stocker()` | The CD's "rules per item"; sizes because a stall sells one size |
| **Stall robots: a recycle instruction never takes the stall's own thing** ("Put large planks in recycle bin" on the large plank stall's robot does nothing to large planks, and does not join the list from it); the recycle instructions stay by kind, and only the planer's bin holds what they name | `stocker()` | Otherwise the instruction would throw away what the stall sells |
| **Stall robots: a stall set to something else mid-fetch** sends what its robot carries back to the bin it came from, and the robot starts over for the new thing; nothing goes in the stall | `choose('sell:')`, `release()` | The CD's "unsold items go into my inventory" is about the stall's stock, not the robot's hands |
| **Stall robots: their evals name the thing**: `stock:plank.l`, `misstock:plank.s@plank.l` (what went in which stall), `looking:sap`; a save's older keys are the medium plank stall's | `stocker()`, `GRADE`, the page's `DOING` | Thirteen stalls' worth of the same three lines |
| **Slot robots** (the CD: nothing goes wrong yet): the saw's presses whenever the saw is idle with a plank in its input bin, making the cut set on its page (2"x4"s until set; `setCut()`); the extractor's the same on sap logs; the bench's carves the input bin's gnarled wood one piece after another (the design rolled as yours is). Each stands west of where you do; one press or one carving is one iteration, so the delay works on them; green every time; no slip die ever rolled without the delay | `miller()`, `carver()`, `setCut()`, `SPOT.sawBot` / `extractBot` / `benchBot`, `GRADE` (`sawn`, `extracted`, `carved`) | The plan's reading of "staff them to the other slots" |
| **The bench: one pair of hands at a time**: you cannot carve while its robot carves (your tap does nothing), it waits while you carve, and a carving left half done is finished by whoever comes next | `carve()`, `carver()`, `bench.by` | One bench, one piece on it |
| **Slot robots' base prompts**: "Use the table saw to cut planks.", "Use the sap extractor to take the sap out of sap logs.", "Carve gnarled wood into decorative pieces at the bench."; every stall's robot keeps "Stock the sales counter with the items in this bin." (the CD: the same for each) | `BASE` | The planer's is the model |
| **Saves still version 3** with the robots: a second robot on one job, a job for a stall not bought, a bad cut or a carry with nothing carried are cleared by `load()` | `load()` | As the stalls |
| **The eval's one-line personas still hire two** (the planer's and the first stall's): their claims are about one line's instructions, and they keep seed 7's numbers exactly (the persona was rebuilt to grow and plays byte for byte as before when it does not) | `eval-taas-factory.cjs` | Growing them would mix two questions in every row |
| **The eval's growing personas** (taasstalls step 4): the paced persona that, once both robots hold their plans, buys a stall (which sells nothing, so nobody comes for it), hires its robot and then sets what it sells, each step when it can pay and keep $20; takes out of a robot's slots any instruction its new plan has not got (for a large plank stall the operator's "Only input medium logs" and "Only output medium wood planks" and the first stall's "Put large planks in recycle bin"); carries medium planks from the planer's bin to the table saw only while the saw's two bins hold less than a stall's worth, sap logs out of the recycle bin to the extractor and its clean logs back to the planer's input bin, and gnarled wood to the bench; and, once growing, also shortens the delay whenever a customer waits at any empty stall | `eval-taas-factory.cjs` (`G`, `GROW`) | Assumed players, each choice traced to a first try that failed for the persona's reason: buying and setting a stall in one go locked the shop (kept, as the "set first" persona); feeding the saw every plank moved the waste from the planer to the saw (130 2x4s in its bin on seed 7 at 90 minutes); pacing by medium planks alone ran the delay up to 60 s behind a large plank stall |
| **The counter on screen** (taasstalls step 3): each stall bought has its tray on the counter and its label on the counter's front, the price first at the label's west end and then the thing in capitals ("$8 LARGE PLANKS", "$6 MEDIUM 2x4s", "$1 SAP" at full satisfaction); a stall bought with nothing set has a blank label; an empty place is a dashed outline on the counter's top with a white plus in the middle | `sceneObjects()` (`stall0`-`stall3`, `plate0`-`plate3`, each `{ stall }`), `onFloor()`, `drawPlate(i)`, `drawPlace(i)`, `PLATE_NAME` | The plus is the affordance (no caption). Price first because the robots that never move stand in front of a label's east end: the first stall's in front of the second's, the second's at the planer's bin in front of the first's |
| **A stall's tray sorts in front of the counter it sits on**: since the storefront brief it sorted behind it, so the counter's top hid all of the tray but its back rim (traced: key 2.26 against the counter's 2.30) | `sceneObjects()` (`ct[3] + 0.052`) | A bug, found in step 3's first screenshot |
| **A tap reaches the front-most thing drawn under the finger**: of the sprite boxes a tap lands in, the front-most with paint within the 8 px tap pad wins, and only if none has paint there the front-most box, as before | `hitTest()`, `inked()` | The planer's box (its chimney, plus the pad) reached over the second and third stalls' labels, so a tap on either went to the planer |
| **A tap on the counter is a tap on the stall nearest it**, an empty place included; a tray or a label is its stall's | `stallUnder()`, `TAPS` | One counter, four places |
| **The stall's bubble**: the 13 things in four rows (planks and sap; 2x4s; 2x2s; dowel rods), each its picture and what a customer pays for it now, the one the stall sells marked; an empty place's bubble a picture of a stall and its price | `stallRows()`, `optButton()` (`sell`, `stall`) | A row to a kind reads as the saw's three cuts at three lengths |
| **A bubble with no room over its thing goes under it** (with its tail on top), and only failing that wherever it fits | `renderBubble()` (`under`) | Thirteen things over the second stall covered the stall being set |
| **The robots' jobs in the bubble**: a stall's job shows what that stall sells and its number (the stocking icon while it sells nothing); the saw, the extractor and the bench each have a picture of their own (a blade, a jar of sap, a chisel). A stall robot's job name says what it stocks ("stocking stall 2, large planks") | `optButton()`, `ICON.saw` / `extract` / `carve`, `JOB_NAME` | Stall numbers are not painted anywhere, so the thing is what tells the stalls apart |
| **The saw robot's cut is on its page**: three buttons under its base prompt (2x4, 2x2, dowels, the cut it makes marked); no other robot's page has them | `renderRobot()`, `setCut()` | The CD: "the cut chosen on its page" |
| **Robots waiting at one output bin stand 0.8 m apart** (four places a bin: at the planer's the first stall's own and one on the walkway side clear of the first stall's price, then two east of the bin; at the saw's and the extractor's two in front and two east of it) | `SPOT.fetch`, `fetchAt()` | At 0.4 m two robots at one bin were drawn one over the other (step 2's screenshot) |
| **The back line's hourglasses sit beside the head**, at 70%: over it they covered the customer satisfaction board's number (step 1's screenshot); those at a stall keep theirs over the head | `drawCustomer()`, `hourglass(x, y, k)` | Each still costs 0.1% a second, so each still shows it |
| **The dock's bay**: the floor round the panel and all eight pads painted teal and outlined, like the slots' bays; the panel itself stays at the west end | `floorStatic()`, `DOCK_BAY` | Step 2's panel across the whole dock tipped the eval into a jam spiral; the floor can say "this is the dock" without moving a solid |
| **Robots at work on screen**: a stall's robot walks its thing over in both claws, out in front; the bench's robot holds a chisel and the bench throws chips while it carves, as it does for you; the saw's and the extractor's press their buttons in the planer operator's pose | `drawRobot()` (`carry`, `carve`), `tick()` | Their states from step 2, drawn |
| **A wrong sale says what was wanted**: "wanted a large plank: satisfaction -15%" (it said "not a medium plank" whatever the stall) | `drain()` (`sold`) | Four stalls, four wants |
| **Robots are baked by pose**: each robot's pose is rounded (a twentieth of a radian for the arms, head and tilt, a 64th of a turn for its heading) and baked once, with its bulb, its face's mood and blink and what it holds, into a canvas the size of what it draws; it is blitted wherever it stands, its hover a vertical offset. Poses are kept least recently used first out, within 12 MB; one growing out of its crate is drawn live | `drawRobot()`, `robotParts()`, `robotSprite()`, `ROBOT_BAKE` | Eight robots drawn live cost a frame in two (the eight-robot pose: 33.3 ms median; with robots stubbed out, 1 of 149 over). Baked: 0 of 149 over. A busy quarter hour without the budget bakes 335 poses, 17 MB |
| **Info** tells of the four stalls and their prices, the eight robots and theirs, slots 02 to 04 run by you or a robot, a stall robot's bin, "once two robots are on staff", and all the prices; it no longer says only medium planks sell | `renderPanel()` | It was the one-stall game's |
| **Superseded 2026-10-20 (the goals brief)**: "a tap on an output bin takes everything (no bubble)"; "a tap on a stall stocks it with what you carry"; "a stall bought sells nothing until you choose" now opens Re-assign first; "bubbles for the rack, the input bins" filtering what they take (`ACCEPTS` took one thing per bin); "the three stalls cost $50 / $100 / $150" and the robots "$20 to $160" ($1 each, set in the menu); "Info tells of the four stalls and their prices"; "Slot robots ... nothing goes wrong yet" for what is put in their bins (a wrong thing jams the machine under a robot too); the slots' old order (saw 02, extractor 03) | `options()`, `chooseStall()`, `RIGHT`, `CFG.flat`, `renderPanel()` | The rows above are the record of the earlier builds; the rows below this one are what holds now |
| **Goals (2026-10-20): the slots' new order** 02 the sap extractor, 03 the bench, 04 the table saw: the machines move, the numbers stay; the bench's footprint is offsets from its own row (it was hard-coded at slot 04) | `ROW`, `SLOT_JOBS` (`extract, carve, saw`), `by(d)` | The CD named 02 and 03 and answered 04; the rows' y positions are Claude's. The robot's bubble lists jobs in this order, which is also the order the goals unlock them |
| **Goals (2026-10-20): a slot is unlocked by its goal and the state is derived, never stored**: `s.goal` (0-3) says which; a locked slot has no machine, bins or robot post: not drawn (the painted bay and number stay), not tappable, not offered as a job, out of the walk grid (the grid's cache key gains `s.goal`), no shadows on the baked floor (the floor key gains it too), and nothing live drawn in it even from a hand-edited save | `unlocked()`, `placeOpen()`, `jobsOpen()`, `tap()`, `rects()`, `grid()`, `onFloor()` | "Slot04 starts empty"; derived state cannot disagree with itself |
| **Goals (2026-10-20): goal 1 counts every medium plank a customer pays for and carries away**, whatever the stall was set to (a medium plank from a 2x4 stall counts, a small plank does not); the board counts **down** ("Sell 50 medium planks" ... "Sell 1 medium plank") | `buy()`, `goalN` | Mirrors goal 2's countdown; the CD wrote the goal, not the counting |
| **Goals (2026-10-20): goal 2's satisfaction is the figure the board shows** (`Math.round(satisfaction) > 90`, so 90.4 resets and 90.6 counts) and its money is `> $50`; the countdown is engine time (real time while the tab shows); any step either fails sets it back to 600 s | `stepGoal()`, `goalT` | What you see is what counts. The CD answered that either failing starts the 10 over |
| **Goals (2026-10-20): the board's words**: the CD's "Goal:" is the board's existing yellow tag, so the white text is "Sell 50 medium planks"; the countdown reads ">$50 & >90% customer satisfaction for 10 minutes" at rest and "for 9:41" (m:ss, seconds rounded up) while counting; "Sell 25 sap" counting down; "All goals met" after the third; shrunk with `fitText`, never cut | `goalText()`, `mss()`, `drawBoards()` | The m:ss format and "All goals met" are Claude's |
| **Goals (2026-10-20): `s.goalN` starts again at 0 when the next goal begins** (a sap sold before goal 3 does not count toward it), and `s.goalT` is back at the full 600 whenever a goal is met | `stepGoal()` | One count at a time |
| **Goals (2026-10-20): goal 3 is "Sell 25 sap"** (a draft; the CD may change it, open question 16) | `CFG.goals` | The CD answered where the saw goes, not what the goal is |
| **Goals (2026-10-20): a machine arriving**: the level sound, five sparks along the slot, its sprites fading in over 0.6 s, a cyan float "slot 02: the sap extractor" for 3 s (the other floats 1.3 s, shrunk and clamped to stay on screen); anyone standing in its footprint steps to the nearest free floor and every walk under way is replanned, an avatar whose walk then ends where it stands arrives | `ev('goal')`, `ARRIVE`, `FLOAT`, `clearWay()` | A machine appearing under someone needs somewhere for them to be |
| **Goals (2026-10-20): a goal rolls no die** (two days match roll for roll), and a goal met in one step is seen at the next | `stepGoal()` | The "crossed wires" proof stays possible |
| **Goals (2026-10-20): saves** stay version 3: a save with no `goal` is all three met; a goal that is not a finite number is all three, a fraction is floored and clamped to 0-3, `goalN` is clamped to 0..the goal's `n` (a count at `n` meets it on the next step), `goalT` to 0..600 (else 600), prices through `flatOf()`; a robot on a slot still locked rests; what a hand-edited save puts in a locked slot's bins is kept but out of reach | `load()` | A bump would wipe every player's factory; an old factory must keep every slot it has |
| **Flat prices (2026-10-20): `setFlat()` rounds a fraction to the nearest dollar and clamps to $0-$200** (unlike `setWait()`, which refuses); anything not a number, and any `what` but `robot` / `stall`, changes nothing; a price of $0 is free even with money below zero; "Start over" keeps the prices (a setting, not progress) | `setFlat()`, `flatOf()`, `afford()`, `newGame(seed, flat)` | The CD gave the default and a setting; the bounds and Start over are Claude's |
| **Flat prices (2026-10-20): the menu's Prices** sits between the sound block and Exit game, factory only, "Robot $1" and "Stall $1" with - / + buttons and no slider or typed amount (formal's suite reads the menu: `.mi` is "Info,Exit game", three ranges), saving on every tap, a button disabled at $0 and $200; the menu calls its mode's own `menu()` hook when it opens | `#menu-prices`, `renderPrices()`, `MODE.menu` | Formal must stay as it was |
| **Bins (2026-10-20): every bin and stall puts and takes any kind**: the bubble's top half is everything you carry (not filtered), nothing happens on arrival, and an old save's `pick` and `stock` acts finish as they began | `ACCEPTS`, `options()`, `choose()`, `ACTS` | The CD: "the same add/remove interaction ... to every input bin and output bin and sales stall" |
| **Bins (2026-10-20): a put into a stall fills it to `CFG.stallCap` (6) and the rest stay in your arms**, each going in as `{ item, by: 'player' }`; the put buttons go dark once it is full but keep their counts (faded, the count red, "No room in this stall for ..."); a take returns every one of a kind | `chooseStall()`, `room()` | A stall holds 6; "0" on a full stall's buttons read as nothing to put |
| **Stall (2026-10-20): buying a stall turns its bubble straight to Re-assign** (it sells nothing yet); every `sell:` (the one it sells included) sets the stall without stocking it and goes back to the first level | `chooseStall()` | The first thing a new stall needs is a thing to sell |
| **Stall (2026-10-20): the first level sits over the stall** like every counter bubble, so it covers part of the satisfaction board while open; the second levels go under it or, on a landscape phone, beside it; a bubble too tall for over or under its thing goes beside it (any bubble, a robot's or a bin's too) | `renderBubble()`, `.stall1`, `.fx-back` | The Re-assign list on a landscape phone covered its own stall |
| **Stall (2026-10-20): the first level's words are the CD's own** ("Re-assign", "Re-stock") plus "Close" / "Open" (the zzz); the Re-assign button shows the stall's thing as its picture, three buttons one width and one icon height; the back button is an icon (aria "Back") | `optButton()`, `backRow()` | The CD named the first two; the third is "closed (similar to robot sleep mode)" |
| **Closing (2026-10-20): a customer at a closed stall who is not already paying picks again among the open stalls** (the `stall` die only when there is a choice, a `repick` event) **or, with none open, walks out** (a `walkout` event) at no cost to satisfaction and not counted as served; while none is open nobody comes in and no die is rolled; the next walks in as soon as one opens (the arrival clock is not pushed back) | `stepShop()`, `openStalls()` | The CD asked only that a stall can close; the customers' reaction is Claude's |
| **Closing (2026-10-20): a closed stall's robot finishes putting in a thing already in its hands, then starts nothing** (a hunt it had decided is kept for when the stall opens); its stock stays, re-assign and re-stock still work | `stocker()` | Like the robot's rest |
| **Closing (2026-10-20): CLOSED is red and takes the price's place** (up to 0.42 of the label, the price 0.3; the name stays); a closed stall's tray is **not** drawn shut | `drawPlate()` | The plan's optional look, not built |
| **Dots (2026-10-20): green dots, one per thing in the stall, at most six, all green whatever the thing** (a wrong thing is a green dot too: open question 18), in a row across the top of the label, from its west end, above the price and the name; the row is always kept, with no hollow places for the empty, and a stall bought and not yet set draws only its dots | `drawPlate()`, `DOT_COL` | The CD asked for green dots; the layout is Claude's |
| **Wrong inputs (2026-10-20): the planer jams on anything `makes()` calls a jam** (every sap log and every thing that is not a log); an operator's log instructions match logs only (`rejectsLog()`), so a robot presses a plank and jams (red `jam:<item>`), and no new instruction joins for it (open question 17) | `runOf('planer')`, `rejectsLog()` | The CD: "it jams"; a new instruction is a later brief |
| **Wrong inputs (2026-10-20): the table saw jams on anything but a plank, rough planks included** (the earlier build took planks only, and a cut from a plank with holes has no meaning yet); **the extractor jams on anything but a log and runs empty on a normal or gnarled log** (a run, $0.10, the same log out, no sap, yellow `empty:<log>` for a robot, graded 'soso'); **the bench's chisel breaks on anything but gnarled wood** (gnarled logs, rough planks) | `RIGHT`, `runOf()`, `jamBench()` | The CD's answers; "rough planks" read from the brief's "gnarled wood" |
| **Wrong inputs (2026-10-20): a jam stops the machine `CFG.jamAt` (1.3 s) into the run**, the run is charged at the press, it stays jammed until scrubbed ($5, `unjam()`, 2.5 s), a half scrub is kept, **every cleaned jam puts the jammed thing in the recycle bin** (a `recycled` event `from: 'jam'`; the planer's sap log used to vanish), and a jam rolls no die anywhere (the bench rolls its `carve` die only for gnarled wood) | `stepMill()`, `unjam()`, `jamBench()` | One rule for every jam; the CD wrote "$5 to fix, and the thing goes to the recycle bin" |
| **Wrong inputs (2026-10-20): a robot at a jam waits** (mood 'stuck', red `jam:<item>`); at the bench a robot's jam is one iteration (it waits the delay, if it holds it, then stands stuck); a wrong piece a robot left on the bench is yours to toss off it | `miller()`, `carver()` | The planer's robot already worked this way |
| **Wrong inputs (2026-10-20): you never get it wrong**: a press at a slot when the first thing in its input bin is not what it is made for (the clean log in the extractor included) tosses that thing into the recycle bin instead, one a tap (a `recycled` event `from:` the slot's key, `tally.tossed`); a tap on a jammed saw scrubs it at once (no cuts bubble) | `pressMill()`, `carve()`, `tossAt()`, `tossOut()` | As at the planer; the press act's own "changed under your hand" guard tosses the same thing a moment later, which is why removing the toss from `pressMill()` alone is an equivalent change |
| **Jams on screen (2026-10-20)**: an amber light flashing on top (exists only while jammed; slots 02-04 have none otherwise), six runs of dark brown grime (`#4a3524`, not the planer's sap green: what jams a slot is not sap) down the front as long as the machine's `dirt`, so a scrub visibly shortens them; the machine shakes (the bench too); the saw's and extractor's buttons dead; the thing that jammed it drawn stuck where it stopped; smoke; the `jam` puff, the "-$5 jam fixed" float and its sparks at the machine that jammed | `slotJam()`, `JAM_LOOK`, `GRIME`, `M_BEACON`, `SMOKE`, `SCRUB`, `AT`, `blit()` (`F.jammed()`) | The planer's jam is the model; a slot's has no sap |
| **Info's Tips are unchanged (2026-10-20)** (the overseer's decision); section Tips here records what each shows at $1 | `renderPanel()` | The eval's recheck came after the page was done |
| **Eval (2026-10-20): the goals persona** (an assumed sensible player): the paced line for goals 1 and 2; when the extractor arrives it hires a robot for it and carries the sap logs the operator recycles to it (and its clean logs back to the planer's input bin), so sap piles up in its output bin while goal 2 counts; when the bench arrives it buys a second stall, hires its robot and sets it to sap; **its way out** of a line that has run out of money (money below zero two minutes running, the operator short of an instruction it cannot pay for) is to rest the operator and press the planer by hand until the next slot is paid for, then put it back | `eval-taas-factory.cjs` (`goals`) | Without it seed 2 never reached goal 2 inside 90 minutes (traced: a supervisor stepping back at 30 s with $2 in hand, an untold operator jamming, no money for slots ever) |
| **Eval (2026-10-20): `paced` puts the delay in once a stall's worth of medium planks has piled up behind a full stall** and buys no other instruction until it is in (`paced early` keeps the old rule, the moment the operator is hired); **`stocker only` hires only with the stocker's four slots ($50) in hand**; **`alone`** never hires and plays ten minutes; every persona but `goals` starts with all three goals met | `eval-taas-factory.cjs` | Each a first try that failed for the persona's reason at $1: the old `paced` rule put a 5 s wait in 30 s into the game and starved the line on 12 of 12 seeds; hiring with $2 it never paid for the slots (traced); every other persona's first robot now comes 30 s in |

### Open questions for the CD (factory)

1. **Hiring the operator first is a trap now.** Revenue is capped by the customers, so a first robot
   on the planer (as in every earlier build) presses every log, junk included, while you still carry
   every plank: money falls and no persona that keeps it there ever affords the second robot.
   Moving it to stocking (one tap) recovers (measured, below). **Answered 2026-10-16: the trap stays,
   as a lesson.** The CD: "Yes. Sometimes we try creating an agent for a task that is more complex and
   not the next best choice for an agent; if not careful we learn this the painful way."
   **Since the flat $1 (2026-10-20) the eval no longer shows the trap**: the stocker is the next $1,
   on staff within the minute, so the operator is never swapped (question 19).
2. **Overproduction.** An instructed operator makes medium planks faster than customers buy them,
   so the output bin fills with planks that cost $1 each and wait. **Answered 2026-10-16:** "Add an
   instruction that lets me add a delay between iterations of its task. Let the delay be a
   configurable value, a positive integer 0,1,2,...,60 seconds." Asked the same day: **every robot**
   can take it, it is **on the list from the start**, it **slips 1 time in 20** like any instruction,
   and for the operator **one iteration is one log handled** (pressed or tossed). **Built
   2026-10-16** (§ A delay between tasks; plan arc `.claude/plans/DONE/taasdelay.delay-arc.md`).
3. **Demand.** Customers come one every 8-16 s whatever happens. Should fewer come when satisfaction
   is low (and more when it is high)? That would also break the slide where a long line drops
   satisfaction, prices fall with it and the money for instructions never comes. **Deferred
   2026-10-16** (the CD: "Will deal w this later"): `TODO.md` § Later.
4. **What sells next, and for what?** The CD priced planks of every length, sap and cut wood, and
   since the stalls (2026-10-17) a stall can sell any of those 13; gnarled planks and carvings still
   have no price, so no stall sells them (see 15).
5. **Robots on slots 02 to 04**: which jobs, which mistakes, which instructions? **A first answer
   (2026-10-16): "nothing yet"** goes wrong there; built 2026-10-17 (a robot each for the saw, the
   extractor and the bench, no mistakes, only the delay). Their mistakes and instructions stay open.
   Since 2026-10-20 a wrong thing in a slot's bin jams its machine under a robot too (red `jam:`),
   with no instruction yet to prevent it (question 17).
6. **How should instructions grow more nuanced?** (still open from the second brief)
7. **Should stopping to think have an instruction**, or stay the price of an agent?
8. **Should every instruction be on the list from the start**, look-alikes included? **A first
   answer, for one instruction (2026-10-16):** the delay is on the list from the start (the CD);
   every other instruction still joins when its mistake is seen.
9. **Who writes the evals?** (the CD's FYI, fourth brief)
10. **What should the delay start at?** 5 s (assumed) starves the line behind an operator holding
   its whole plan: over an hour on eight seeds satisfaction ends at 10-24% on all eight; 4 s starves
   4 of 8; **3 s keeps 100% on all eight** and the bin at 6-37; 2 s still overproduces (45-67 in the
   bin). A player who leaves the slider alone at 5 s learns the lesson the hard way, as with the
   operator-first trap. Not changed: the CD's call. **Sharpened at the flat $1 (2026-10-20):** the
   delay put in at the operator's hire is 30 s into the game, before the line runs, and starves it on
   12 of 12 seeds (money -$93 to -$550 at the hour); put in once the planks pile up behind a full
   stall, the lowest satisfaction after it is 78-100%. The start is too long for a line not yet running.
11. **The economy since logs cost money** (2026-10-16). With logs at $1 and a run at $0.10, a robot
   line without the delay buys about twice the logs the customers can use, so its instructions come
   slowly (the plan of four at about 50 minutes; 23 with the delay put in first) and the delay is
   now the first instruction a player needs. Is that the lesson you want, or should demand, the log
   price or the restock size move? (Inferred then: four stalls would add demand only by splitting
   the same customers between stalls.) **Measured with the four stalls (2026-10-17):** they do: a stall
   changes what a customer pays, never how many come, so growing pays only by selling something worth
   more and only while it is kept supplied (§ Measured, 2026-10-17).
12. **Should a customer give up?** A customer waits at an empty stall for ever (the CD's "waits there
   if it is empty") and six in the shop is the most, so a stall that nobody stocks, or whose thing is
   scarce, fills the shop with its customers and nobody else is served: a stall set before its robot is
   hired sells nothing for the rest of the game, and a large plank stall ends customer satisfaction at
   10-13% (§ Measured, 2026-10-17). Leaving after a while (costing satisfaction as they go) would cap
   it. Not changed: the CD's call. Since 2026-10-20 a stall can be **closed** (a customer at it who is
   not paying picks again or, with none open, walks out at no cost), which is a way to stop a stall
   taking customers by hand; a customer still waits at an open stall that is empty.
13. **Should a robot carry things between machines?** Planks reach the table saw, sap logs the
   extractor and gnarled wood the bench only in your arms: a slot robot only presses and a stall robot
   only stocks, so every growing persona that sells cuts or sap carries by hand. **Answered later
   (2026-10-20):** the CD's brief says "Later i will have robots moving items between bins, and they
   will mess up sometimes". Until then the bins take anything by hand and a machine run on the wrong
   thing jams.
14. **One thing a trip.** A stall's robot walks one thing at a time from its bin (the CD: "fetch an
   item"). From the saw's output bin to the first stall that is about 10.7 m there and back, about 4.4
   a minute, below the shop's 5 customers a minute, so the one stall switched to 2x4s starves while a
   second stall of 2x4s (half the customers) keeps up. Carry more, bring the saw nearer, or keep it as
   a lesson?
15. **The bench earns nothing.** Carvings have no price (open question 4), so the bench's robot carves
   what no stall can sell.
16. **Is "Sell 25 sap" the right goal 3?** Claude drafted it (the CD answered only that the saw is
   goal 3, slot 04). It is the sap extractor's product, so goal 3 asks for the machine goal 1
   unlocked; the CD may set it and anything after it. Measured: met at 36.0-48.9 minutes from a new
   factory, on 12 of 12 seeds.
17. **An instruction for things that are not logs on the planer, and for each slot.** A robot on the
   planer given a plank jams it and no instruction prevents it; the same for a wrong thing in the saw,
   the extractor or the bench. The CD said "later", once robots move things between bins and mess up.
18. **A dot that shows a wrong thing in a stall differently.** The CD asked for green dots; every dot is
   green, a log or a carving in a stall included.
19. **Is a flat $1 the default you want, given what it does to the lessons?** At $1 a robot and a stall
   the eval's claims move (section Measured, 2026-10-20, the goals): the operator-first trap is gone
   (the stocker is the next $1), the set-first lock is gone (the robot is hired at once), buying
   everything ends ahead (+$164 to +$435 for the full house, +$365 to +$703 for all medium), Tip 3 is
   not shown, and a 5 s delay put in at the hire starves the line on every seed. Every persona hires
   two robots at 30 s, and an operator told nothing drains the money (it jams), so a line left
   uninstructed can stay too poor to pay for the slots (traced on seed 2): the goals persona needed a
   way out ("press by hand until the next slot is paid for") on 5 of 12 seeds. The CD asked for the price
   and the Prices setting (up to $200) so it can be tried; the question is whether $1 should be what
   a new game starts with.

Answered by this brief: what the bays hold (slots 02 to 04), whether a jam should cost more than
time ($5 to fix), how what is not a plank leaves the bin (your arms, and the stocker's recycle
instructions), and dowels on purpose (the table saw; the planer no longer makes them).

### Architecture (factory)

Three script blocks join the page, in this order after the formal engine:

1. **`const FACTORY = (function () { ... })()`**, the factory engine: pure functions over one
   plain state object, no DOM, ending `if (typeof module !== 'undefined') module.exports =
   FACTORY;` (the suites lift exactly that span, so keep both lines).
   - **Things are strings**, `kind.size`: the nine logs (`log`, `gnarled`, `sappy` x `s`, `m`, `l`),
     planks (`plank.*`, `rough.*`), `sap`, the saw's bundles (`b2x4.*`, `b2x2.*`, `dowels.*`) and
     carvings (`carving.bowl` ...). `kindOf()`, `sizeOf()`, `isItem()`, `makes(log)` (what the
     planer makes of it, or `'jam'`), `priceOf()` (the CD's prices; `null` for what has none),
     `SELLS` (the 13 things with a price, what a stall can sell), `ACCEPTS` (the nine bins you put things
     in, each taking any thing since 2026-10-20) and `RIGHT` (what each machine is made for) are the
     vocabulary.
   - **State**: the planer (`machine`, its input bin `rack` with `rackMine` of them yours at the front,
     `belt`, `bin`), the
     `recycle` bin (everything in it), the `saw` and `extract` mills (`in`, `phase`, `belt`, `out`),
     the `bench`, the four `stalls` (each `bought`, its `want`, the thing it sells or null, and its
     `stock`), the `shop` (its people, the next arrival, how many served and how many sold something
     else), the avatar with its `inv`, up to eight robots (`hired`), and `spent` with its parts
     in `costs` (logs pressed, fixes, saw, extract, and logs `bought`). **Money is kept to the cent**:
     every change goes through `cents()` (`spend()`, a sale, a hire, a slot), and `load()` rounds too.
   - **The planer's input bin** (2026-10-16): `newGame()` puts `CFG.startLogs` logs in it
     (`buyLogs()`, the `log` dice); `nextLog()` takes the front one, and only when the bin is empty
     calls `restock()` (`CFG.restock`: 10 logs for $10, cost `bought`, event `restock`). What a
     customer pays is `paid(s, item)`: the price times satisfaction to the cent, never below
     `floorOf(item)` (`CFG.floor`).
   - **Every roll is named** (`log`, `think`, `slip`, `find`, `turnup`, `arrive`, `stall`, `carve`) and goes
     through `roll()`; `s.force[name]` is a test queue. A robot rolls only where it has a choice,
     so an instruction it does not hold, or one about another job, changes nothing, down to the dice.
   - **An instruction** is a `RULES` row: an operator one lists the logs it keeps out
     (`rejects: { quality, size }`), a stocker one the things it takes out of the output bin
     (`recycles: { kind, size }`), an "Only stock X" the thing it is about (`only`, one for each of
     the 13; `ONLY[item]` is its id), a look-alike only `joins`. `keepers(log)` is every instruction
     that would have kept a log out (they join the list when an operator cuts it); `see()` puts
     instructions on the list; `follows()` rolls the slip.
   - **An instruction with a value** (the delay, 2026-10-16): the row `{ id: 'delay', job: null,
     wait: true, start: true }`. **A row with `job: null` belongs to every job** and is consulted
     by each, at the end of every iteration (`done(s, r)`); the operator's and stocker's data
     filters skip it. `start: true` puts it on the list in `newGame()` and `load()`
     (`startSeen()`). Its value is `r.wait` (`CFG.wait`, 0-60, 5 to begin with), set only through
     **`setWait(s, id, sec)`**, which refuses anything but a whole number in range. `done()` sends a
     robot that holds it with `r.wait > 0` to the state **`pause`** (one `slip` die), which
     `pause()` leaves after `r.wait` seconds or once the instruction is out of its slot.
   - **The avatar's places** (`PLACES`): the planer (`work()`), output bins (`pick`), a stall
     (`{ kind: 'stall', i }`: stock it, then its bubble, `buystall` for an empty place or a `sell:`
     for each of `SELLS`; `choose()` puts the unsold stock in your arms; `stallPrice()` is the next
     place's price, `openStalls()` the stalls set to sell), the extractor (a press), the bench (`carve`), and bubbles for the rack, the input
     bins, the recycle bin, the saw, the dock and robots. **A bin's bubble** (`options()` for any
     `ACCEPTS` place) offers a `put:` for each kind in your arms it takes and a `take:` for each kind
     in it (`take:` from the rack keeps `rackMine` right); `F.SAMPLE` is the picture an empty half shows. `store(s, place)` is the array behind a
     bin. The planer's output bin is reached from the nearer of two spots (`pathLen()`).
   - **The shop** is `stepShop()`: arrivals while fewer than `CFG.shop.max` are inside, each with
     its stall (the `stall` die over `openStalls()`, none with one to choose from), in three rows
     (`SHOP`: one at each stall on `lineY`, the rest in one line along the back wall on `backY`, first
     come first served, everyone walking on `laneY`, `walkTo()`), paying (`buy()`, its stall's price
     times satisfaction, the hit for anything but that stall's `want`; payments settled before places
     are handed out), leaving by the door, and the waiting drain. `waitingNow()` counts the customers
     waiting (state `wait`).
   - **Robots**: jobs are strings (`operate`, `stock:0`-`stock:3`, `saw`, `extract`, `carve`;
     `jobKind()`, `stallOfJob()`, `jobsOpen()`), one robot to a job, hired at `hirePrice()` (the flat `s.flat.robot` since 2026-10-20). `homeOf()` is
     where each waits (`SPOT`: the planer's button, a slot, `SPOT.fetch[bin][i]` at the output bin its
     stall's thing comes out of, `srcOf(item)`, or its pad); `go()` walks a robot to a spot on its job
     and `release()` lets go of what a job had it holding. **A stall's robot** is `stocker()`: reach at
     its bin (decide the hunt once a stocking), turn up, recycle or look or carry, walk it over
     (`carry`, `src`), place when its stall has room (`room(s, i)`), walk back, cool. **The operator**
     is `operate()`, as before; **the saw and extractor robots** `miller()` (the saw's cut `r.cut`, set
     only through `setCut()`), **the bench's** `carver()` (the bench's `by` says whose hands).
   - **Evals** are `r.record`, keyed `action[:thing][!]`; `GRADE` and `gradeOf()` colour them
     (`jam` and `misstock` red; `cut`, `think`, `looking` yellow; `plank`, `reject`, `caught`, `stock`,
     `recycle`, `waited` green; `straight!`, the delay's slip, yellow by its '!').
   - The engine emits `s.events` (press with where and what it cost, made, milled, binned, jam,
     cleaned with its cost, recycled, looking, customer, paying, sold, stocked, picked, put, took,
     carved, hired, assigned, outcome, rule, slot, instructed, notes, arrive, waitset, paused,
     straight, restock, stallbought, stallset, cutset, evalsReset; since 2026-10-20 also goal, flatset,
     repick and walkout, and jam and cleaned carry `at` (the machine's key) and `item`).
   - **Goals, flat prices, the slots' order** (2026-10-20): `CFG.goals` (one row per goal: `id`, then
     `item` and `n`, or `money`, `sat` and `sec`, and `unlocks`, a job in `SLOT_JOBS`), `CFG.flat`
     (`{ robot, stall, min, max }`, the bounds; the state's own prices are `s.flat`, always through
     `flatOf()`), and the state `s.goal` (goals met, 0-3), `s.goalN` (the current goal's thing sold),
     `s.goalT` (goal 2's seconds left, 600 at rest). `stepGoal(s, dt)` runs once per sub-step after
     `stepShop()`; `buy()` counts the sale; a goal met does `s.goal++`, `goalN = 0`, `goalT = 600`,
     `clearWay()` and `ev(s, 'goal', { n, id, unlocks })`. `goalNow(s)` is `{ i, goal, done, left, t,
     counting }` for the board. `ROW = { planer, extract, bench, saw }` is each slot's centre line (the
     bench's solids and spots are offsets from `ROW.bench`); `SLOT_JOBS` is `['extract', 'carve', 'saw']`;
     `slotOf(k)` maps a place or a solid's key to its slot's job, `unlocked(s, job)` and
     `placeOpen(s, k)` say whether it is open (a job with no goal is always open), and `jobsOpen()`,
     `tap()`, `rects()` and `grid()` (cache key `'h' + hired + 'g' + goal`) honour them.
     `setFlat(s, what, dollars)` is the one way to change a price; `newGame(seed, flat)` carries
     prices over for Start over.
   - **Bins and stalls take anything** (2026-10-20): `options()` and `choose()` serve all nine bins
     (`BUBBLES` includes the four output bins; `arrive()` starts no `pick` and a stall no longer stocks
     itself); the stall has its own two-level menu in `chooseStall()` (`s.bubble = { kind: 'stall', i,
     menu }`, `menu` null / 'assign' / 'stock'; `back`, `assign`, `restock`, `close` / `open`, `sell:`,
     `put:`, `take:`). A stall's stock is `{ item, by }` objects, so it has its own put and take path
     (`store()` covers bins only). `st.closed` and `openStalls()` drop a closed stall; `stepShop()`
     re-picks (`pick()`, the `stall` die only with a choice) or lets a customer walk out and admits
     nobody while none is open. The old `pick` and `stock` acts stay in `ACTS` so an old save finishes.
   - **Wrong inputs** (2026-10-20): `RIGHT[key](item)` (`planer`, `saw`, `extract`, `bench`) says what a
     machine is made for and `runOf(key, item)` what a run comes to: 'run', 'empty' (the extractor on a
     normal or gnarled log) or 'jam'; `MACHINES` lists the four, `stateOf()` and `jammed(s, key)` read a
     machine's jam (a mill's `phase` and `result` and `dirt`, the bench's `phase` 'idle' / 'jam' and `dirt`
     from `newBench()`). `startMill()` records the `result`, `stepMill()` jams `CFG.jamAt` into a wrong
     run (`jam { at, item, by }`) or runs an empty one its whole length; the bench goes through
     `benchNext()` and `jamBench()`; `miller()` and `carver()` wait 'stuck'. **`unjam(s, key, by)` is the
     one clean** ($5, the machine free, `cleaned { at, item }`, the jammed thing to the recycle bin
     `recycled { from: 'jam' }`); the avatar's `clean` act carries `on` (absent = the planer). Your toss:
     `pressMill()` and `carve()` scrub a jam, else toss a wrong first thing (`tossAt()`, act `toss { on }`,
     `tossOut()`, one a tap).
   - **Saves** (`load()`, version 3): a missing `goal` is all three met; no `ACCEPTS` filtering; a mill or
     bench jam kept with its `dirt`; `closed` filled false; a stall bubble's `menu` and a `clean` / `toss`
     `on` validated; a bin's contents, the planer's in-feed included, kept whatever they are.
2. **`SND`, `MODE` and the menu**, shared by both modes (unchanged but for two new effects: a door
   bell when a customer comes in and a card's beep when one pays).
3. **The factory UI** (an IIFE): the 3D kit and everything on screen.
   - Primitives, shading, `drawPrim()` and `drawParts()` as before. **Static scenery** (the wall,
     the door, the counter and its stall, every row's machines, belts and bins, the bench, the
     dock and crates) is baked once per scale and blitted on whole device pixels; the floor (the
     shop's boards, the bays and their numbers, the pads) is one baked canvas.
   - **Things in bins, on belts and on the counter are baked too** (`itemSprite()`, once per kind,
     turn and scale, cleared on a re-layout) and blitted (`blitItem()`): with an orthographic camera
     and no yaw a thing looks the same wherever it lies. Things held in hands and flying into the
     recycle bin are drawn live (`drawItem()`).
   - **People**: `drawPerson()` draws the avatar's rig or a customer's (`custParts()`: the avatar's
     shapes with fewer facets, in the customer's own shirt, hair and trousers, no hat). **A customer
     standing in line is baked** (`personSprite()`, once per look and facing, by borrowing `ctx` and
     moving the camera the way the floor's bake does); walking, paying and leaving ones are live.
     The avatar carries up to four things across its arms and a count chip. **A part that sits on
     another sorts with that part's centre, not its own**: the hair (`hairOver()`, built by
     `hairCap()`) is its ellipsoid less the facets in front of the head's centre and below a 0.1 m
     hairline, sorted at the head's centre with bias +0.001, so facing the camera it is no longer
     drawn under the face (2026-10-16; a cap of the facets outside the head was tried first and
     left a bald patch seen from behind, `.claude/plans/DONE/taasdelay.s1-hair.md`).
   - **Live machine bits**: belt tops per row, the planer's window and beacon, a red button on each
     console (lit when a press would do something), the saw's blade (still until it cuts), the
     extractor's tank level.
   - **Boards**: `drawBoards()` writes the goal, the money and customer satisfaction on the wall;
     `drawPlate(i)` writes a stall's label and its price now. `boardRect(k, i)` is where each is drawn
     (`cash`, `sat`, `goal`, `plate` for stall i).
   - **The bubble**: a bin's (`binHalves()`) is two halves, `.fx-mine` (a `column-reverse` of rows,
     so the first tile sits lower left) and `.fx-bins` (rows from the upper left), each the height of
     `binLay.rows` rows and `binLay.cols` wide: `binLay` remembers every kind seen since the bubble
     opened, so the halves only grow and the line between them (`.fx-line`) stays put. Other bubbles
     are a row of buttons. A thing's picture comes from `mini(id)` and its name from `NAME(id)`.
   - **Robots are baked by pose** (`robotSprite()`): the key is every field of the pose, rounded,
     with the scale; each canvas the size of what it draws; the least recently used go once
     `ROBOT_BAKE` passes 12 MB (`ROBOT_BAKE_BYTES`). Drawn live, eight robots missed a frame in two.
   - **Input**: `hitTest()` walks the `TAPS` table (sprite id to place; `stall0`-`stall3` and
     `plate0`-`plate3` are their stalls), robots first, then **the front-most sprite with paint under
     the finger** (`inked()`, within the 8 px tap pad), falling back to the front-most box, then the
     floor. A tap on the counter is a tap on the stall nearest it (`stallUnder()`).
   - **The robot's page** (`renderRobot()`) is three parts, `[data-part]` `slots`, `pick` and
     `evals`, each written by `part(name, sig, html)` only when its own signature changes, never while
     a finger is down in it (`holdPart`: set on pointerdown or touchstart, released when the touch
     ends or, for a mouse, the pointer comes up), and keeping the scroll of each `.fx-rules` and
     `.fx-scroll` in it. One whole-page signature holding the evals rebuilt the picker's own scroller
     on every robot action, back at the top (the CD's jumping list, 2026-10-16). A slot holding the
     delay grows `.fx-wait` (-, the slider `#fx-wait`, +, the figure). A robot in `pause` wears
     `pauseSign()`.
   - **Money on screen**: `cash()` (the wall board and the screen-reader line, always with cents) and
     `usd()` (prices and costs, cents only when there are some).
   - **Test hook**: `window.TAAS_FACTORY` as before (`s`, `view`, `tick`, `paused`, `hitTest`,
     `spriteRect`, `screen`, `board`, `showInfo`, `save`, `layout`, `openRobot`, `closePanel`, `page`),
     `person(who, face)`, one person baked alone (`bakePerson()`), and `robotBake()`, the robot bake's
     count, bytes and budget.
   - **The goals brief on screen** (2026-10-20). *Locked slots:* `bake()` tags every sprite with
     `slot: F.slotOf(id)` and `onFloor()` hides one whose slot is not `F.unlocked()`, so a locked
     slot's machine, belts, console and bins are neither drawn nor in `spriteRect()` / `TAPS` /
     `hitTest()`; `draw()` keeps everything live out of a locked slot too, and the baked floor's key gains
     `s.goal` (`F.placeOpen()` leaves a locked slot's contact shadows off). *The board:* `goalText()` from
     `F.goalNow(s)` (`mss()` for m:ss, `ONE` for the singular nouns), fitted by `fitText` in
     `drawBoards()`, and read again by the screen-reader line and Info. *A machine arriving:* the `goal`
     event, the `ARRIVE` table (seconds since each job's goal, `ARRIVE_SEC` 0.6, an alpha in `blit()`), the
     `ARRIVED` names for the float ("slot 02: the sap extractor"; `FLOAT` entries gain optional `life`
     and `fit`). *Prices:* `#menu-prices` (hidden in formal by the `hidden` attribute that `sync()`
     sets from the mode and by CSS on `html[data-mode]`; plain buttons `data-price` / `data-by`, no `.mi`,
     no range input), `renderPrices()` registered through `MODE.menu`, a tap calling `F.setFlat` and
     saving; Start over is `F.newGame(seed, s.flat)`.
   - **Bubbles, dots and jams on screen** (2026-10-20). *A stall's bubble:* `renderBubble()` routes
     `menu: 'stock'` to `binHalves()` and `'assign'` to `stallRows()` (only `sell` rows), each under
     `backRow()` (`.fx-back`, 34 px, aria "Back"), and the first level to three buttons of one width
     (`optButton()`, class `stall1`, 84 px); a bubble too tall for over or under its thing goes beside it
     (left, else right, no tail). Output bins use `F.SAMPLE` placeholders and `anchorOf()`. *The label:*
     `drawPlate(i)` draws a row of green dots first (`DOT_COL`, one per thing, `C.stallCap` at most, from
     its west end), then the price (CLOSED in red `#ff6b6b` in its place while closed) and the name.
     *A jammed slot:* `slotJam(key)` with `JAM_LOOK` (the amber light `M_BEACON`, drawn only while
     jammed; `GRIME` runs as long as the machine's `dirt`; the stuck thing at `CFG.jamAt`), the
     machine shakes through a `shake` tag that `blit()` reads from `F.jammed()` for any tag, and the
     `SMOKE`, `SCRUB` and `AT` tables place the puff, the "-$5 jam fixed" float and its sparks per
     machine. A tap on a jammed machine scrubs it (the engine's). *The suite:* `fresh()` goes to the
     server's `/blank` before it clears storage so the old page's `pagehide` save lands first, and
     `loaded` keeps what the new page loaded by itself (page section 23's first row holds it to a new
     game).

### Measured (2026-10-15, storefront)

`node .claude/tests/eval-taas-factory.cjs` (30 simulated minutes, every action walked, the robot's
page included; money net of the running costs). A persona that instructs follows one PLAN
(operator: sap logs, gnarled logs, only medium logs, only medium planks out; stocker: only medium
planks, and the small, large and gnarled plank recycle ones) and resets a robot's evals once it
holds its whole plan. The attentive personas hire **the stocker first** and keep pressing the
planer themselves; "operator first" does as every earlier build did and moves that robot to
stocking after two minutes of money falling.

| Persona | $20 | robot 1 | robot 2 | first instruction | operator x4 | stocker x4 | earned | costs | $/min net, last 5 | satisfaction end/min | served / sold wrong | waiting, last 10 min | stocked / looking | junk in bin |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hands-on | 1.9m | 2.1m | 4.9m | 5.5m | 14.9m | 13.0m | 591 | 244 | 12.6 | 100/85 | 148 / 1 | 0.00 | 85 / 0 | 0 |
| supervisor | 1.9m | 2.1m | 4.9m | 5.4m | 14.9m | 12.6m | 598 | 241 | 13.4 | 100/85 | 150 / 2 | 0.00 | 90 / 0 | 0 |
| walks away | 1.9m | 2.1m | 4.9m | - | - | - | 140 | 36 | 0.0 | 10/10 | 35 / 0 | 6.00 | 22 / 0 | 0 |
| uninstructed | 1.9m | 2.1m | 4.9m | - | - | - | 319 | 353 | -6.4 | 19/10 | 146 / 46 | 0.00 | 139 / 0 | 35 |
| crossed | 1.9m | 2.1m | 4.9m | 5.4m | - | - | 325 | 362 | -6.2 | 14/10 | 146 / 47 | 0.00 | 139 / 0 | 28 |
| stocker only | 1.9m | 2.1m | 4.9m | 6.2m | - | 11.5m | 581 | 339 | 8.4 | 100/85 | 146 / 2 | 0.00 | 91 / 3 | 0 |
| stock planks (only "only stock medium planks") | 1.9m | 2.1m | 4.9m | 6.2m | - | - | 416 | 344 | -7.8 | 30/10 | 139 / 6 | 3.99 | 103 / 786 | 78 |
| operator first (moved to stocking at 5.0m) | 1.9m | 2.1m | 10.1m | 10.1m | - | - | 569 | 294 | 9.6 | 100/60 | 146 / 2 | 0.00 | 98 / 0 | 0 |

The shape it asserts: the first $20 inside two and a half minutes; a person alone keeps customer
satisfaction above 80% until the first robot; both robots inside seven minutes; robots left alone
stall on the first jam and **the shop fills with six customers waiting**, taking satisfaction to the
floor; instructions pay (over twice); an uninstructed stocker puts everything in the medium plank
stall and wears satisfaction down; crossed wires are worth nothing; agents without instructions are
not free speed; **a stocker told only to stock medium planks sells hardly anything wrong but, hunting
through the junk, restocks so slowly that customers wait and satisfaction falls anyway** (the CD's
"reduced signal to noise", now with a cost); a robot on the planer first loses money until it is
moved to stocking, then the money, the second robot and a healthy line follow; and, as since the
fourth brief, **a valid optimal path exists**: every log but a normal medium one and every product
but a medium plank has an instruction that deals with it and every one joins the list in real play,
the plan followed leaves no junk, hardly anyone waiting and evals mostly green (the stocker's with
no red), and wherever an output bin fills up the instructions that would empty it were on that
persona's list ("NO WAY OUT" otherwise). The books balance for every persona.

**Tuned by it**: customers first came every 6-14 s; the eval showed the line filling faster than one
person can carry planks round, satisfaction at the floor, prices near $0 and the second robot never
affordable, so they now come every 8-16 s (12 s on average). Hiring the operator first is the
remaining trap (open question 1), **kept as a lesson** by the CD's call (2026-10-16).

Frame cost (`.claude/scripts/frame-budget.cjs games/taas/index.html select=#mode-btn:robot-factory
evalFile=.claude/scripts/poses/taas-factory-busy.js`, 390x844; the busy pose: both robots at work,
the stocker hunting a bin of junk, a full shop with one leaving, every slot's bins full, the saw
cutting, the extractor running, the avatar walking with its arms full): first measured at **33.3 ms
median** (every second frame missed), with no single part to blame (only skipping the things and
the people together brought it back). Baking the things in bins and on belts, then baking customers
standing in line and giving customers fewer facets: **16.7 ms median, p95 16.8, 3-5 of 149 over**
across four runs, against 0 of 149 for the menu build's busy pose in the same container the same
hour (a quieter scene): inside budget. Re-run after the delay and the hair (2026-10-16), four runs:
**16.7 ms median, p95 16.7-16.8, 0-2 of 149 over**. With four stalls and eight robots
(`.claude/scripts/poses/taas-factory-eight.js`, taasstalls step 3, 2026-10-17): **33.3 ms median, 81-89
of 149 over** with every robot drawn live, the robots alone to blame (stubbing them out: 1 of 149 over;
customers, labels or things: still 60-67 over); with robots baked by pose, **16.7 ms median, 0-1 of 149
over** over three runs, and the old busy pose 1-3 of 149 as before.

### Measured (2026-10-16, the delay)

`node .claude/tests/eval-taas-factory.cjs` adds a ninth persona, **paced**: the supervisor, for an
hour, who once its operator holds its whole plan and a stall's worth of medium planks waits behind
a full stall puts the delay in a fifth slot, leaves it at 5 s and then moves it a second a minute
by the bin (one less when the bin is nearly empty or a customer waits at an empty stall, one more
when the bin is over a stall's worth and not shrinking; an assumed player, not a measured one).
Beside it, the supervisor for the same hour, seed 7:

| Persona, an hour | delay in | bin at the hour | most in the bin, last 20 min | served | satisfaction | spent | money |
|---|---|---|---|---|---|---|---|
| supervisor | - | 116, climbing | - | 302 | 100% | $471 | $575 |
| paced | 16.7 min | 3 | 12 | 297 | 100% | $343 | **$658** |

The waits it chose ran 5, 6, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 4, 3, 2 s. The eval asserts that
the supervisor overproduces (the bin past ten stalls' worth and still growing), that the paced bin
stays bounded (at most three stalls' worth over the last 20 minutes, under a quarter of the
supervisor's), that nobody starves (satisfaction at least 90% at the end and 50% throughout, under
one waiting on average over the last ten minutes, served at least 95% of the supervisor's), and
that it pays (less spent, and more money by more than the $25 slot). The books balance for all
ten runs.

`EVAL_WAITS=1` adds a sweep (printed, not asserted): seeds 1-8, the supervisor for an hour, the
delay put in at the same moment and then left alone at one value:

| Wait | bin at the hour | satisfaction at the hour | money against no delay |
|---|---|---|---|
| none | 116-151 | 100% on all 8 | - |
| the paced persona's | 3-10 | 100% on all 8 (one dipped to 59% mid-run) | +$51 to +$120 |
| 2 s | 45-67 | 100% on all 8 | +$23 to +$65 |
| 3 s | 6-37 | 100% on all 8 | +$60 to +$102 |
| 4 s | - | starved on 4 of 8 (10-33%) | -$102 to +$119 |
| 5 s (the start) | - | starved on all 8 (10-24%) | -$321 to +$53 |

So the delay ends overproduction and pays, inside a narrow band (about 3 s against today's
demand), and the 5 s it starts at starves the line (open question 10).

### Measured (2026-10-16, the bins: logs bought, $0.10 a run)

`node .claude/tests/eval-taas-factory.cjs`, seed 7. First with the CD's first answer, **$1 a log
bought and $1 a press**: a medium plank cost about $3.05 to make (about two logs bought for each
normal medium one, plus the press) and sold for $4; the attentive player never reached the first
$20 in 30 minutes while it pressed whenever the planer was ready, and with a player who stops at
eight planks waiting, the second robot came at 14.9 minutes and an instructed line lost about $1 a
minute. With **$0.10 a run** (the CD's change) and every persona playing an hour:

| Persona, an hour | $20 | robot 2 | plan of four (op / stock) | $/min, last 5 | money |
|---|---|---|---|---|---|
| hands-on (presses while < 8 wait) | 1.6 min | 7.8 | - / - | 2.4 | $2 |
| supervisor | 1.6 | 7.7 | 50.4 / 45.2 | 2.4 | $39 |
| **paced** (the delay at the operator's hire) | 1.6 | 7.7 | **23.4 / 16.6** | **11.5** | **$60** |
| operator first | 1.6 | 10.5 | - | 11.5 | $450 |

An instructed operator handles about 18 logs a minute (a toss is 1.5 s, a press about 5) against
about 5 customers a minute, so without the delay it buys about twice the logs the counter can use:
the supervisor's hour spent $780 on logs and $140 on 28 jams (its operator's plan, the sap
instruction among it, was whole only at 50 minutes). The paced line spent $590 and $25. Before this change (a
press $1, logs free) the plans came at 11 and 14 minutes. "Operator first" ends rich for a traced
reason that is the persona's, not the game's: its second robot is given the stocking job, which
swaps the first one (already moved to stocking) to rest, so nobody but the person runs the planer,
and the person never presses a log nobody will buy.

### Measured (2026-10-17, the stalls: the delay over twelve seeds, and growing the factory)

`node .claude/tests/eval-taas-factory.cjs` (about a minute). taasstalls step 4.

**The delay, restated over seeds 1-12.** One row had gone red with the stalls: "without the delay
it takes over twice as long" (the supervisor's operator plan at 45.3 minutes, the paced one's at
24.1). Measured on `main` and here over seeds 1-12 it held on seed 7 only, so it was luck, and
every claim about the delay is now made over the twelve. An hour each, the paced persona against
the supervisor:

| Seed | paced: delay in | plans (op / stock, min) | bin at 1h | lowest satisfaction after | money | supervisor: plans | bin | money |
|---|---|---|---|---|---|---|---|---|
| 1 | 9.3m | 28 / 20 | 5 | 73% | $309 | 34 / 28 | 99 | $139 |
| 2 | 9.3m | 33 / 26 | 0 | 48% | $272 | 37 / 25 | 101 | $95 |
| 3 | 8.3m | 22 / - | 3 | 89% | $380 | 25 / 21 | 99 | $118 |
| 4 | 9.8m | 31 / 25 | 5 | 79% | $203 | 30 / 27 | 78 | $83 |
| 5 | 9.5m | 25 / 17 | 4 | 91% | $291 | 26 / 21 | 100 | $165 |
| 6 | 7.7m | - / - | 0 | 11% | -$305 | 34 / 29 | 105 | $130 |
| 7 | 7.7m | 24 / 17 | 2 | 85% | $377 | 45 / 39 | 87 | $55 |
| 8 | 9.2m | 26 / 19 | 1 | 67% | $331 | 38 / 30 | 121 | $95 |
| 9 | 11.6m | 30 / 21 | 3 | 53% | $294 | 34 / 29 | 97 | $89 |
| 10 | 8.6m | 48 / 41 | 4 | 33% | $89 | 24 / 21 | 83 | $154 |
| 11 | 6.4m | 23 / 14 | 13 | 80% | $322 | 22 / 15 | 134 | $137 |
| 12 | 6.6m | 29 / 24 | 8 | 59% | $257 | 28 / 22 | 101 | $112 |

What holds on every seed: without the delay the bin holds ten stalls' worth at the hour and is
still climbing (78-134 planks); with it the bin never holds more than three stalls' worth in the
last twenty minutes (at most 13); the paced line spends less. What holds on most: it ends the hour
richer (10 of 12), and both plans are whole inside the hour (10 of 12). The two seeds that end
poorer (6 and 10) are the two where the 5 s the slider starts at starved the line (traced: on both,
customers waited 4-5 on average within a few minutes of the delay going in, satisfaction fell to 11%
and 33%, prices with it, and on seed 6 money went below zero and the operator's plan was never whole).
How long the plans take varies too much to claim more: the operator's plan comes sooner with the
delay on seven seeds, about the same on three, later on one and never on one. **The Tip changed
with it** (§ Tips: "pace it, starting the wait short", where Info had said "about twice as fast").

**Growing the factory.** Seven growing personas (§ Assumed, "The eval's growing personas"), two
hours each on seeds 7-12, beside the paced line that never grows ($674-922 at two hours, $4.00 a
customer, 8.4-11.2 net $ a minute over the last 20 minutes):

| Persona | invested | all bought by | $ a customer, last 20 min | net $/min, last 20 min | money at 2h against the line | satisfaction at 2h |
|---|---|---|---|---|---|---|
| second stall (medium planks again, its robot) | $160 | 35-68 min | $3.99-4.00 | 7.1-11.2 | -$97 to -$197 on every seed | 100% |
| saw line (a stall of medium 2x4s, a saw robot, its robot; you carry planks to the saw) | $190 | 47-72 | $4.86-5.08 | 12.3-14.2 | -$54 to +$181, ahead on 5 of 6 | 100% |
| all medium (four stalls, three of 2x4s) | $660 | 81-109 | $5.43-5.56 | 14.9-17.8 | -$178 to -$487 on every seed | 100% |
| cut stall (the one stall switched to 2x4s, a saw robot) | $60 | 33-64 | $1.20 | -10.0 to -12.6 | -$1,084 to -$1,714 | 10-14% |
| large planks (a stall of large planks, its robot) | $140 | 35-69 | $1.10-1.43 | -10.6 to -13.2 | -$780 to -$1,733 | 10-13% |
| set first (a stall set to sell before its robot) | $50 | never | none served | -15.3 to -17.0 | -$1,701 to -$2,261 | 10% |
| full house (four stalls: planks, two of 2x4s, sap; all eight robots) | $965 | 99-114 (not by 2h on seed 10) | $3.51-4.76 | 9.6-17.2 | -$519 to -$732 on every seed | 90-100% |

Four hours (seeds 7, 8, 11; printed, not asserted): the saw line is $567-633 ahead, all medium
$517-680 ahead and still earning the most a minute (15.1-19.0 against the line's 8.1-9.8), the
second stall $140-260 behind.

What it shows (each a row, over every seed it grew on unless it says otherwise):
- **Stalls change what a customer pays, never how many come**: one every 8-16 s whatever is on
  the counter. A second stall selling the same thing never pays.
- **A stall pays when it sells something worth more and is kept supplied**: medium 2x4s ($6) from
  medium planks, which the planer makes plenty of, raise what a customer pays by about a fifth; the
  saw line is ahead within two hours on most seeds, four stalls of 2x4s earn the most but take
  between two and four hours to pay back $660.
- **A stall whose thing is scarce takes the shop with it**: large planks come from about one log in
  nine (15% of logs are large, 75% of those normal), half the customers come for them, they fill the
  six places in the shop and wait, and fewer of the others get in.
- **A stall nobody stocks locks the shop for good**: set to sell before its robot is hired, its
  customers fill the shop and never leave, nothing else sells, and the robot is never affordable.
- **One robot fetching one thing a trip cannot serve every customer**: the one stall switched to
  2x4s has its robot walk about 10.7 m from the saw's output bin and back for each, about 4.4 a
  minute against the shop's 5 (traced: 372 stocked in 85 minutes), so the line grows and satisfaction
  drains; a second stall of 2x4s, with half the customers, keeps up.
- **Buying everything does not pay**: with sap at $1 taking a quarter of the customers from the
  $4 and $6 stalls a customer pays less than with the saw line alone, the bench's robot carves what
  no stall can sell, and the factory ends two hours behind the one that never grew.

Traced on the way (the persona's fault, fixed in the persona): feeding the saw every plank in the
planer's bin made 207 2x4s for 77 sold (130 left in its output bin, seed 7 at 90 minutes), the waste
moved from the planer to the saw; and the paced slider rule, reading only the medium planks in the
planer's bin, ran the delay up to 60 s behind a large plank stall (medium planks pile up behind the
full medium stall when large plank customers fill the shop), which starved the large planks further.

### Measured (2026-10-20, the goals: the economy at a flat $1)

`node .claude/tests/eval-taas-factory.cjs` (about 1.6 minutes), taasgoals step 5. No escalation trigger
fired: the goals persona met every goal on every seed inside the hour.

**The goals persona** (`goals`, a new factory, seeds 1-12, an hour each; an assumed sensible player,
section Assumed, "Eval: the goals persona"). Minutes from a new factory to each goal, goal 2's
countdown started / started over, and whether the operator rested for lack of money:

| Seed | goal 1 | goal 2 | goal 3 | countdown started / reset | rested |
|---|---|---|---|---|---|
| 1 | 11.0 | 30.3 | 39.0 | 2 / 1 | 0 |
| 2 | 10.6 | 34.9 | 45.1 | 3 / 2 | 1 |
| 3 | 9.8 | 28.2 | 40.2 | 1 / 0 | 0 |
| 4 | 11.3 | 32.7 | 45.6 | 3 / 2 | 1 |
| 5 | 10.5 | 29.7 | 38.8 | 2 / 1 | 1 |
| 6 | 10.5 | 33.7 | 43.5 | 1 / 0 | 1 |
| 7 | 11.1 | 30.8 | 42.7 | 2 / 1 | 0 |
| 8 | 10.5 | 28.9 | 38.5 | 1 / 0 | 0 |
| 9 | 11.8 | 36.9 | 48.9 | 3 / 2 | 0 |
| 10 | 11.0 | 28.5 | 40.2 | 2 / 1 | 0 |
| 11 | 10.6 | 29.5 | 36.0 | 1 / 0 | 1 |
| 12 | 11.5 | 29.7 | 40.0 | 2 / 1 | 0 |

**12 of 12 seeds** reach every goal inside the hour: goal 1 at 9.8-11.8 minutes, goal 2 at 28.2-36.9,
goal 3 at 36.0-48.9. Goal 2's countdown started over on 8 of 12 seeds (11 resets in all, summed from the table; step 5's
note said 12; at most 2 on a seed) and always completed. The operator rested for lack of money on 5 seeds (2, 4, 5, 6, 11): the
persona's way out of a line that has run out of money (rest the operator, press by hand until the next
slot is paid for, then put it back). Without it seed 2 never reached goal 2 inside 90 minutes and seed 6
took 70.8 / 83.5 minutes to goals 2 / 3 (traced: a supervisor stepping back at 30 s with $2 in hand, an
untold operator jamming, no money for slots ever). Traced on the way and fixed in the persona, not the
game: a hauling persona's block ended in `continue`, so one that had to work by hand stood idle.

At the hour (printed by the eval, not asserted) the goals persona holds $314-420, customer satisfaction
100% on eight seeds and 89%, 90%, 39% and 20% on seeds 1, 5, 8 and 12 (a hypothesis, not traced: the
persona plays no plan after goal 3, so its sap stall may be one its robot cannot keep stocked).

**The eval's rows**: 32 -> 35 (three added: every goal inside the hour on most seeds, measured 12 of 12
each; goal 2's countdown starts over in real play and still completes; nothing dead-ends, in the data
(each count goal's thing is one a stall can sell, made by a machine there before the goal begins, every
slot's machine some goal's reward) and in play (every seed past the last goal)). Every persona but
`goals` starts with all three goals met and plays at $1 through the new bubbles.

**Personas restated** (each traced, each named in the eval's header): `paced` now puts the delay in once a
stall's worth of medium planks has piled up behind a full stall and buys no other instruction until it
is in (its old rule, the moment the operator is hired, put a 5 s wait in 30 s into the game at $1 and
starved the line on 12 of 12 seeds, money -$93 to -$550 at the hour; that rule is kept as `paced early`);
`stocker only` hires only with the stocker's four slots ($50) in hand (hiring with $2 it never paid
for them behind an operator told nothing: money below zero from minute 6, plan never whole on seed 7);
the new `alone` never hires and plays ten minutes (every other persona's first robot comes 30 s in).

**Claims restated, old -> new** (same claim unless marked SUBSTANCE CHANGED):

| Claim | Before (the stalls arc, $20-$160 robots) | At the flat $1 |
|---|---|---|
| the first $20 inside 2.5 min | 1.6 min on hands-on | 1.6 min by hand (`alone`); the first robot, at $1, inside a minute (0.5 min) |
| both robots inside nine minutes | 7.8 min | inside a minute (0.5 min) |
| satisfaction above 80% working alone until the first robot | until the first robot | over ten minutes of `alone` (100% throughout) |
| uninstructed robots barely beat a person alone | -8.1 vs 11.2 $/min | -3.0 vs 11.3 (`alone`'s minutes 1-2) |
| **SUBSTANCE CHANGED: operator first** | the operator hired first loses money until moved to stocking (swapped at 5.0 min, robot 2 at 10.4) | the stocker is the next $1, on staff within the minute; it never swaps and ends healthy (100%, 6.1 $/min); the row asserts the trap is gone at this price |
| supervisor's bin | ten stalls' worth and climbing (78-134) | seven stalls' worth, a minute may dip by 3 not 2 (45-143; seed 9's supervisor never pays for its plans at $1) |
| paced bin within three stalls' worth | in the last 20 minutes (max 13) | from ten minutes after the delay went in (max 15), since it now goes in at 5.7-45.2 minutes |
| paced spends less on every seed | holds ($761-990 supervisor) | holds ($624-721 paced) |
| the paced line pays | on most seeds (10 of 12) | on every seed (12 of 12) |
| **SUBSTANCE CHANGED: the 5 s start** | too long on some seeds (3 of 12 under 50%) | put in at the hire (`paced early`) it starves 12 of 12 and the money ends below zero on all; put in once the pile shows, the lowest satisfaction after it is 78-100% (open question 10 sharpened) |
| both plans whole inside the hour on most seeds | 10 of 12 | 11 of 12 (row reworded "the delay as soon as planks pile up") |
| the growing persona grew on most seeds | 6 of 6 | 5 of 6 (seed 8's stocker plan never whole) |
| a second stall never pays | -$97 to -$197 | -$5 to -$199 (seed 7 within $5: fragile) |
| the saw line ahead on most seeds | 5 of 6 | 5 of 5 (+$194 to +$411) |
| **SUBSTANCE CHANGED: all medium** | costs too much ($660) to pay back in two hours (-$178 to -$488) | at $7 in all (slots apart) it is ahead within two hours on every seed (+$365 to +$703); the row asserts that |
| the cut stall | holds | holds (10-11%, 5.7 waiting) |
| large planks | 5.0-5.6 waiting, 10-13% | 3.9-5.6 waiting, 10-25%; thresholds restated to >= 3.5 and <= 30% |
| **SUBSTANCE CHANGED: set first** | a stall set before its robot locks the shop for good (none served, the robot never affordable) | the robot is hired at once (hired 3), the shop never locks, and it ends as a second stall does (behind the line, -$2 to -$185); the row asserts that |
| **SUBSTANCE CHANGED: full house** | buying everything ends two hours behind (-$519 to -$732) | it ends ahead (+$164 to +$435) but behind the four stalls of 2x4s on every seed, and a customer still pays less than with the saw line alone ($4.09-4.42 vs $4.76-5.11); the row asserts that |

Every other row held with its old threshold: instructions pay (3.3 vs -3.0), uninstructed 24% with 124
wrong vs 100%, crossed -6.3 vs -4.8, stock planks 189 junk and looking 2347, the plan clears the floor,
evals 0.85 / 1.0 green, NO WAY OUT none, stocker only 0 left and jams $205 vs $25, the books balance
over 107 runs. The four SUBSTANCE CHANGED rows besides the 5 s start are each a consequence of cheap
staffing, which the CD may want to see (open question 19).

**Frame cost** with the eight pose (`frame-budget.cjs ... poses/taas-factory-eight.js`, which now sets
`s.goal = CFG.goals.length`), nothing else running: median 16.7 ms, p95 16.7, max 16.8, **0 of 149
over**, measured at steps 3, 4 and 5.

### Negative tests (factory)

**taasgoals step 5 (2026-10-20), every list re-run whole on copies** (`negtest-copies.py --jobs 3`): engine
**214 of 216** caught, page **147 of 148**, eval **14 of 14**; each suite was run once on the unbroken page
first (358 / 159 / 35 green). Where each list's size came from:

- **Engine 144 -> 216** (77 added, 5 retired). Added: step 1's twelve (recovered from the step's `br/*.html`
  copies and re-anchored, `goals-*`), step 2's 22 (`s2-*`), and new ones for goal counts and met, the
  countdown's money and satisfaction boundaries and its reset, the unlock gate, the `goal` event, load
  clamps, `setFlat` bounds and rounding, flat hire and stall prices, `flatOf`, each stall level (back,
  assign, close, open, take, sell keeping or returning stock), the paying customer at a closed stall,
  walking out free, the re-pick, the jam's timing / charge / dirt, the bench never jamming or jamming on
  rough planks, the extractor on normal logs, the saw on logs, the empty run's sap / log / grade,
  `unjam()` freeing and its recycled thing, the toss (two, uncounted, by hand at the bench), the planer
  on a plank, a logs-only rack. Repointed 6 stale anchors (`fix-not-charged`, `line-no-cap`,
  `clean-instant`, `robot-cleans`, `stocker-ignores-full`, `load-keeps-junk`). Retired 5
  (`rack-takes-planks`, `saw-takes-gnarled`, `extract-takes-logs`, `bench-no-planks`,
  `bins-rack-normal-only`): each broke "a bin takes only its machine's thing", a rule the CD withdrew;
  what replaced it is broken by `planer-cuts-planks`, `saw-takes-logs`, `extract-runs-logs`,
  `bench-rough-jams`, `rack-logs-only` and `s2-acc-filter`. **Two misses, both equivalent changes:**
  `bubble-before-arrival` (the known one: `bubbleOpen()`'s arrival check, which every `tap()` already makes
  redundant) and `s2-no-slot-toss` (traced in step 2: the toss removed from `pressMill()` alone is
  caught nowhere, because the press act's own "changed under your hand" guard tosses the same thing a
  moment later; removed from both places it is caught). `unjam-wrong-thing` was first written as an
  equivalent (`m.log || m.item`) and missed; rewritten to recycle the next log instead, caught.
- **Page 108 -> 148** (40 added). Added: step 3's 15 (less `s3-floor-key-no-goal`, the same change as
  step 4's `s3-floor-key`), step 4's 22, and 4 new (`goals-ui-words-swapped`, `goals-ui-no-back-row`,
  `goals-ui-float-wrong-slot`, `goals-ui-all-met-unsaid`). Repointed 8 stale anchors (`goal-text-gone`,
  `goal-not-heard`, `plate-never-amber`, `stalls-ui-trays-always`, `stalls-ui-plate-first-only`,
  `stalls-ui-plate-name-fixed`, `stalls-ui-sell-flat`, and `goal-wrong-price` renamed `goal-wrong-thing`:
  the goal carries no price now, so it breaks the sap wording). **One miss, the known equivalent:**
  `no-remeasure` (`enter()`'s `VW.w = 0`). `goals-ui-float-wrong-slot` was first missed (the arrival row
  read only the float's cyan pixels); the row now also reads its words, "slot 02: the sap extractor", and
  catches it (the page suite is still 159, that row restated). No flaky row: the most-catching rows
  (taps at six sizes, 7; the CLOSED label, 7, all label breaks) catch related breaks only. `fresh()`'s
  order is a suite-level change, outside a page list; step 4 proved it on a suite copy (the old order
  fails one row, `loaded`, and the other 158 pass). Step 3's floor-key break was first **missed**: its row
  compared a re-bake and could not see the break (traced: `fresh()` cleared storage and the old page's
  `pagehide` save wrote it again, so each new page first baked the previous row's factory); the row now
  checks the grey machine shadows left in an empty bay through Start over from a finished factory.
  Not asserted anywhere: the jam's dead buttons, its stuck thing and its smoke (drawn, seen in the
  screenshots).
- **Eval 9 -> 14** (all caught). Repointed `ev-first-stall-only`; added `ev-goal2-frozen`,
  `ev-goal2-never-resets`, `ev-goal1-unlocks-saw` (caught by the dead-end row), `ev-robots-twenty` and
  `ev-empty-gives-nothing`.

The lists below this paragraph are the history up to the stalls arc; the sizes today are the engine's
**216**, the page's **148** and the eval's **14**.

**taasstalls step 4 (2026-10-17), every list re-run whole on copies**: engine **143 of 144** caught,
page **107 of 108**, eval **9 of 9**; each suite was run once on the unbroken page first (260 / 129 / 32
green). The misses are the two known equivalent changes below (`bubble-before-arrival`,
`no-remeasure`). **33 breaks were stale** (their "old" text no longer appeared exactly once, from
steps 1-3): 22 engine (the shop's line, payment and leaving; the stocker's hunt, recycle, looking
and misstock lines, now per stall and per bin; `room()` per stall; `release()`; `slotsOpen()`;
the bench; the stall load; the delay's state and grade) and 11 page (the counter's tap, the
dock's, the tap keys, the stall's label and its price colour, the stock on the trays, the
hourglass, a stall job's aria label, the misstock words, the slots part's signature). All were
repointed at the current code and caught; none was retired, since each still had code to break.
One page miss was new and real: `delay-ui-no-info` (the delay's sentence in Info deleted) went
unseen because its row only asked that Info mention "Wait between tasks", which the corrected Tip
also does; the row now reads the sentence itself, and the break is caught. The eval gained four
breaks for the growth rows (`ev-one-price`, every stall priced as a medium plank; `ev-first-stall-only`,
every customer for the first stall; `ev-customers-give-up`, a customer leaves after 30 s; `ev-carver-idle`,
the bench's robot never carves); a fifth, carvings given a price, crashed the engine on load (no
"Only stock" wording exists for a carving) and was replaced by `ev-carver-idle`. No row was flaky:
the rows that catch most breaks (the taps at six sizes, 7; a stall's label, 5; the hair, 5) catch
related ones only. The page list takes about 80 minutes at three jobs, the engine's 4, the eval's 3.

`.claude/tests/negtests/taas-factory-engine.json` (**216** breaks today, against `drive-taas-factory.cjs`),
`taas-factory-ui.json` (**148**, against `drive-taas-factory-ui.cjs`) and `taas-factory-eval.json`
(**14**, against `eval-taas-factory.cjs`; `ev-logs-free` added 2026-10-16, four for the stalls 2026-10-17, five for
the goals 2026-10-20): 214, 147 and 14 caught today (above); 143 of 144, 107 of 108 and 9 of 9 before the goals arc. Before the stalls: **142, 83 and 5 caught** of 143, 84 and 5 (2026-10-16, later, every break in each list re-run on copies). The bins brief (2026-10-16, later) added 19
engine breaks (`bins-*`: no starting logs or billed ones, a free restock, one every pull, five not
ten, yours at the back or never yours, takes only at the recycle bin, a take that forgets yours,
the rack taking only normal logs, $1 a press or a saw run, money not to the cent, no floor, whole
dollars, a plank floor of $1, a cut floored as a plank, an old save with no logs, an unclamped
count of yours) and 13 page breaks (`bins-ui-*`: the picker rebuilt on every robot action, no
scroll kept, a hold that never lets go, the halves flowing the wrong way or sized by their content,
no faded tile, no take half, a rack drawn empty, money and prices in whole dollars, no restock
float), and re-anchored 12 engine and 6 page breaks to the new code (`rack-takes-sap` became
`rack-takes-planks`, since any log now goes in). `take-row-gone` was retired: the two-row bubble it broke became dead code once every bin's bubble came in halves, so the branch was deleted and `bins-ui-take-hidden` breaks the take half instead. Before the bins brief:
**123, 70 and 4 caught** of 124, 71 and 4 (2026-10-16, the whole of each list re-run on copies). The delay added 23 engine breaks (`delay-*`), 16 page breaks
(`delay-ui-*`) and the eval's four (demand doubled, a robot that never pauses, every wait at 60 s,
a wait that costs money); the hair added five page breaks (`hair-*`). All were caught; on the way,
two rows were widened or tightened (a load row that only loaded a save already holding the delay;
a stepper that never saved, hidden by the page's own `pagehide` save). The page list takes about
45 minutes at three jobs. The storefront's runs: **100 and 49 caught** of 101 and 50. The first engine run caught 92: eight of its nine misses were rows not yet
written (a customer walking in counted as waiting, a wrong sale's money, the second in line paying
early, one tap putting in only one of a kind, the extractor's bin taking clean logs, the output bin
always reached from the floor, a robot double-pressing a planer you started, a stocker overfilling a
stall that filled while it carried), and one was caught only by a crash (a row that read an event
before checking one existed, made null-safe). **The engine's one miss is the known equivalent
change**: `bubbleOpen()`'s arrival check, which every `tap()` already makes redundant by clearing
the bubble. The page list's first runs caught 44 of 50: five misses were rows not yet written or
rows that could not fail (a tap where the planer's box overlaps the recycle bin's, which only the
depth key settles; the money board drawn one frame late, since `draw()` runs before `renderHud()`;
the saw-blade row, which passed on the sliding plank and the dust with the blade frozen; the planks
on the stall; the count badge over your arms), and all five are caught now. **The page's one miss is
an equivalent change**: `enter()`'s `VW.w = 0`, since `layout()` only runs while the factory shows
and compares against the size it last measured, so a resize made in formal mode is still caught on
the way back; its only visible effect is that coming back from formal mode scrolls the view to the
top.

### How to change it (factory)

- **Retune**: `FACTORY.CFG` only. Then `.claude/scripts/gates.sh games/taas/index.html` and
  `node .claude/tests/eval-taas-factory.cjs` (it prints the table above), and bump `CFG.version` if
  a save would now mean something else. The customers' rate is a balance lever with a cliff: see
  Measured.
- **Another thing on sale** (a carving, a gnarled plank): its price in `CFG.price` and its floor in
  `CFG.floor` put it in `SELLS`, so every stall's bubble offers it; it also needs an `ONLY_TEXT`
  wording for its kind (the "Only stock X" rows are built from `SELLS` as the engine loads, and it
  throws without one: a break that priced carvings crashed the page on load), a `srcOf()` bin for a stall's
  robot to fetch it from (null: only you can stock it), a `PLATE_NAME` / `SELL_NAME`, and a row in
  the bubble's four (`renderBubble()`).
- **A fifth stall**: a place in `LAYOUT.STALLS` (1.35 m apart; the counter has room for four),
  `CFG.stalls` (`n`; its price is the flat `s.flat.stall`, no table), its robots' spots (`SPOT.fetch` at each bin,
  `SPOT.stallBots`), its place in the shop (`SHOP.places` follows `STALLS`), and the rules suite's
  section 14 (its first row pins four); `TAPS` and `jobsOpen()` follow `STALLS` and the stalls bought.
- **A bin you put things in**: an `ACCEPTS` row (every bin takes any thing; what a machine is made for
  is `RIGHT`, not the bin), a `store()` case, a `SAMPLE` picture, a `BUBBLES` entry and a `TAPS` entry;
  its bubble comes in two halves by itself.
- **Another goal** (2026-10-20): a row in `CFG.goals`, either a count goal `{ id, item, n, unlocks }` (a
  thing a customer carries away, counted in `buy()`) or a countdown goal `{ id, money, sat, sec,
  unlocks }` (the one `stepGoal()` branch that reads `sec`), with `unlocks` a job in `SLOT_JOBS`.
  What reads the table, so nothing else needs the number three: `stepGoal()`, `goalNow()`,
  `unlocked()`, `load()` (its clamps use `CFG.goals.length`), `grid()`'s cache key, the board's
  `goalText()` (a count goal needs `sellN` to know its item's name), Info's numbered list (it prints
  each goal's slot as `SLOT_JOBS.indexOf(unlocks) + 2`, so list the jobs in the order the goals unlock
  them) and the float's `ARRIVED` name. Check by hand: the rules suite's section 16 pins the table
  (three goals, their unlocks; inferred: restate those rows), a pose that sets `s.goal =
  CFG.goals.length` still opens every slot, and the eval's `goals` persona plays the new goal (and its
  data rows, "each count goal's thing a stall can sell, made by a machine there before the goal
  begins") or it fails by name.
- **A fifth slot** (2026-10-20): everything in "A new machine slot" below, plus: an entry in `ROW` (and
  the slot's solids and spots from it), a job in `SLOT_JOBS`, a `CFG.goals` row that unlocks it (a
  slot with no goal is open from the start: `unlocked()` is true for a job no goal names), a
  `RIGHT` row and a place in `MACHINES` (so `runOf()` says what jams it, and the extractor-style
  'empty' case if it has one), its `jamBench()` / `stepMill()` jam, a `JAM_LOOK` entry and `SMOKE`,
  `SCRUB` and `AT` entries for its look and puff, a `SLOTS` bay with its number, an `ARRIVED` name, and
  a branch in `slotOf()` (a key-prefix test, so the slot's places and solids must be named with the
  machine's prefix) so `onFloor()` and `placeOpen()` hide it while locked.
  Rules suite section 16 (the start, each unlock, a locked slot refusing taps and jobs) and section 17
  (its wrong inputs) gain its rows.
- **Add an instruction**: a `RULES` row (an operator one with `rejects: { quality, size }`, a stocker
  one with `recycles: { kind, size }`, a look-alike with `joins`); in its job's code a `follows()`
  where the robot would make the mistake (the data rows need none: `operate()` and `stocker()` ask
  every row that matches); a `see()` where the mistake shows; a `DOING` line if it adds a new
  action; rows in the rules suite's § 8. **An instruction with a value**, like the delay: a field
  on the robot (`r.wait`), a `CFG` range, a setter that refuses what the control cannot give
  (`setWait()`), a clamp in `load()`, the `slots` part's signature holding it, and a control under the
  slot in `renderRobot()` (a part is never rebuilt while a finger is down in it). A row with `job: null` is
  consulted by every job, so give it a place in each (`done()`); `start: true` puts it on the
  list from the start.
- **A new kind of thing**: a size or quality goes in `SIZES` or the `LOGS` list and `CFG.logs`; a
  product in `ITEMS` (and `PRODUCTS` if the planer makes it), `makes()`, `priceOf()`, `ACCEPTS` for
  the bins that take it, a model in the UI's `ITEM_MODEL` builders, a `mini()` picture and a `NAME()`.
  The rules suite's § 1 and the eval's coverage row fail until every bad log and every product but
  the stall's has its instruction.
- **A new machine slot**: a row in `LAYOUT` (`mill(y)` builds a saw-like one), a state like `saw`,
  a `stepMill()`-style step, a press in `arrive()` or a bubble in `options()`, its bins in `store()`
  and `ACCEPTS`, sprites in `sceneObjects()`, `TAPS` entries, a bay in `SLOTS`, and the rules suite's
  § 9. A robot job for it: a job string in `SLOT_JOBS` (`jobsOpen()` offers it), a state machine
  beside `miller()` / `carver()` that calls `done()` at the end of each iteration (so the delay works
  on it), a branch in `homeOf()` and its `SPOT`, an `ICON`, a `BASE`, a `JOB_NAME`, `DOING` lines for
  its evals, and rows in the rules suite's § 15.
- **An eval line**: a key in `GRADE`, a `DOING` phrase, and `credit()` or `note()` where it happens.
- **A sound**: an effect is a row in `SND`'s `FX`; check a level change with `SND.probe(bus)`.
- **Something on the wall or the counter's label**: `BOARD` / `PLATE` hold where, `drawBoards()` /
  `drawPlate()` what; draw it from the state.
- **Move or add a thing on the floor**: its footprint in `LAYOUT.SOLID`, its model in
  `sceneObjects()` (key = its front edge's y), a `TAPS` entry if it does something, and a spot in
  `LAYOUT.SPOT`. The rules suite walks every spot to every other.


## How to change it (formal)

- **Retune:** edit the tables only. Run `.claude/scripts/gates.sh games/taas/index.html`
  (smoke + both drive suites; rules must stay green whatever the numbers) and
  `node .claude/tests/eval-taas.cjs --search`
  (shape), then bump `CFG.version` if a saved run would now replay differently.
- **Add an opportunity or reorder the story:** `OPPS` must stay eight long (one per
  quarter, `drive-taas` checks it); give it `short`, `title`, `pitch`, `basis`; if it
  should count as context or quality upkeep, add its id to the two `upkeep` lines in
  `forecast()`.
- **Add an ongoing investment:** one `INVESTS` row; the plan panel, the "opens up" list
  and the drift rules pick it up from `unlock` and `upkeep`.
- **Add a level or a stat:** every `req` and `rate` key must be in `STATS`, and each
  level must ask at least as much as the one below (both checked). The ladder strip is
  drawn from `LEVELS`, so a level is one row; a stat also needs a line in the UI's `STAT`
  copy table.
- **Copy rule:** plain ASCII in the page (straight quotes, hyphens); the CD prefers it.

## History

- 2026-10-20: **goals that unlock the slots, bins and stalls you fill by hand, flat prices** (the CD's
  sixth factory brief and four answers; plan arc `.claude/plans/DONE/taasgoals.goals-arc.md`, built in
  steps 1-6 on branch `taas-goals`): a new factory starts with one stall of medium planks and slot 01
  only; three goals on the wall unlock the sap extractor (sell 50 medium planks, slot 02), the bench
  (over $50 and over 90% customer satisfaction for 10 minutes, the countdown starting over whenever
  either fails, slot 03) and the table saw (sell 25 sap, a draft, slot 04); every input bin, output bin
  and stall puts and takes any kind through the recycle bin's two-half bubble, with nothing done on
  arrival; a stall's tap offers Re-assign, Re-stock and Close, its label carries a green dot per thing
  and reads CLOSED when closed; a machine run on the wrong thing jams (an extractor on a log with no
  sap runs empty), a scrub is $5 and puts the jammed thing in the recycle bin; a robot and a stall cost
  a flat $1 each, set under Prices in the menu. Answers open question 13 ("later"); adds questions
  16-19. The eval's goals persona meets every goal on 12 of 12 seeds; the flat $1 changes five of
  its claims in substance and Tip 3 is no longer shown (the Tips in Info are unchanged). Save
  version 3 kept (an older save is all three goals met). Rules 358, page 159, eval 35; break lists
  216, 148 and 14 (214, 147 and 14 caught, the three misses equivalent changes). Formal untouched
  (43 / 39 / 9).
- 2026-10-17: **four stalls and eight robots** (the CD's answer to the bins brief, and four answers;
  plan arc `.claude/plans/DONE/taasstalls.stalls-arc.md`, built in steps on branch `taas-stalls`): three
  more places on the counter bought for $50 / $100 / $150, each stall set by tapping to one of the 13
  things with a price, the unsold stock into your arms; customers pick an open stall at random and
  wait in one line along the back wall when theirs is taken; six more robots ($20 to $160, a dock of
  eight), one for each stall, fetching from the bin its thing comes out of, with an "Only stock X" for
  each thing, and one for each of the table saw (its cut on its page), the sap extractor and the bench,
  making no mistakes yet; robots baked by pose to hold the frame budget; a tap goes to the front-most
  thing painted under the finger. The eval's persona grows the factory, and the delay's claims are
  restated over twelve seeds (the "twice as fast" Tip corrected); two Tips added and open questions
  12-15. Save version 3 kept. Rules 260, page 129, eval 32; break lists 144, 108 and 9 (143, 107 and
  9 caught, the two misses the known equivalents).
- 2026-10-16 (later still): **Tips** in the factory's Info and § Tips here (the CD: the eval's two
  findings are "perfect examples of how sometimes AI agents are not worth it until you have
  sufficient experience and funding to properly support them"): a first agent rarely pays for
  itself, an agent faster than demand makes waste, give an agent the next best task. Page suite
  111 (the tips row); page break list 84 (`tips-gone`).
- 2026-10-16 (later): **bins you can take from, logs bought by the ten, $0.10 a run** (the CD's
  bins brief, three answers, then a change of costs once the first answer was measured): the
  robot's page in three parts so the instruction list stops jumping to the top; every input bin and
  the recycle bin give things back through a bubble in two halves whose line never moves; the
  planer's input bin starts with 10 logs and buys 10 more for $10 when the planer needs one; a
  machine run costs $0.10; money and prices are kept to the cent; nothing sells below what it cost
  to make. The eval's players stop pressing at eight planks waiting and play an hour, and the paced
  one puts the delay in first (the new optimal path). Rules 194, page 110, eval 24; break lists
  142 of 143, 82 of 83 and 5 of 5 caught (the two misses the known equivalents). The four stalls and eight robots asked in the same answer are planned in
  `.claude/plans/DONE/taasstalls.stalls-arc.md`.
- 2026-10-16: **a delay between tasks** (the CD's answer to overproduction, and four answers):
  "Wait between tasks" on every robot's list from the start, a slider 0-60 s (5 to begin with)
  under its slot, a wait after each log handled and each thing stocked or recycled under a pause
  sign, a 1-in-20 slip. The eval's ninth persona, paced, proves it ends overproduction and pays;
  a sweep finds the 5 s start starves the line (open question 10). And **people keep their hair**
  facing the camera (`hairOver()`). Save version 3 kept. Rules suite 180 checks, page 99, eval 23;
  break lists 124, 71 and the eval's new 4 (123, 70 and 4 caught).

- 2026-10-09: designed in a claude.ai session; first draft published as a private
  artifact ("TAAS", First playable draft).
- 2026-10-12: shipped to `games/taas/` (3rd on the hub, proprietary), with the repo's
  chrome, badge and audio added and the score made to add up from its printed parts
  (`summary()` now rounds the shortfalls before scoring). Suites added.
- 2026-10-13: **robot factory mode** (overnight, at the CD's request; four answers before the
  build): the mode dropdown, the factory engine, the Canvas 2D toon renderer, shared audio,
  three suites and two break lists. Formal mode unchanged apart from its sounds moving into
  `SND`.
- 2026-10-15: **the storefront** (the CD's fifth factory brief and two answers): wood in two
  dimensions (size by quality; every sappy log jams), machine01 renamed **the planer** in slot 01
  with its own output bin, a **sales counter** row along the back wall that sells by itself to
  customers who walk in from the left, line up across the counter (six at most in the room) and
  pay $4 times customer satisfaction, **0.1% a second for each one waiting**; your arms carry from
  the output bin to the counter and in and out of the recycle bin; the seller became **the stocker**;
  $5 to fix a jam; the goal on the wall and the price on the counter's label; **slots 02-04** (table
  saw, sap extractor, hand crafting bench), worked by hand; robots on the planer or stocking only.
  Save version 3 (older factory saves ignored). Items and waiting customers baked to sprites to
  hold the frame budget. Rules suite 156 checks, page 86, eval 19 with an eighth persona (operator
  first, the trap it found); break lists 101 and 50 (100 and 49 caught).
- 2026-10-14 (night): **the menu, a reload button and scoreboards on the wall** (the CD's
  note from a phone screenshot, and three answers). The back, mute and i buttons gave way to a
  menu (Info for the mode in front of you, a sound switch, Music / Ambient sounds / Sound
  effects volumes, Exit game); a reload button in the top right corner; the build badge in the
  device's own time zone in both modes; **ambience** for each mode; money and customer
  satisfaction painted on the back wall, either side of one window over machine01. Found while
  answering it: the fourth brief's Pages deploy had failed, so the CD was still playing the third
  brief; this push redeployed it. Page suites: formal 39 checks, factory 63; break lists 40 and
  60 (39 and 57 caught, every miss an equivalent change).
- 2026-10-14 (evening): **the fourth brief**: logs in sizes (small, medium, large; gnarled and
  sap logs medium-sized), large logs and large planks, 1"x4"x4' renamed "medium" in every
  instruction, the CD's size instructions (small, large, medium logs in the recycle bin) and,
  from the four answers, the seller's three recycle instructions (dowel rods, large planks,
  gnarled planks); each robot's record renamed **Evals**, graded red only for blockers and hits to
  customer satisfaction, with slips as lines of their own and a **Reset evals** button; the eval
  rebuilt around **a valid optimal path** (and shown to catch the third brief's dead end); the
  build badge moved to the bottom right. Rules suite 128 checks, page 55, eval 15 with seven
  personas; break lists 102 and 54.
- 2026-10-14 (later): **the third brief**, after the CD played the instructions build: the sap
  barrel gone and **sap logs** on the rack (10%), with "Put sap logs in recycle bin" and the old
  sap instruction kept as a look-alike that prevents nothing; **$1 a log** at machine01, money
  allowed below zero and shown red; the **seller only sells what is in the bin**, and told to sell
  only planks it hunts for one at planks / everything in the bin, counting "looking for plank";
  a gnarled log's **holes in the same places on its plank** (a pixel check found the middle hole
  sorted under the board, now drawn over it). Save version 2 kept, older saves migrated. Rules
  suite 109 checks (the upstream masking moved here from the eval), page 51, eval 10 with a
  sixth persona; break lists rebuilt (84 and 48).
- 2026-10-14: **instructions instead of prompt levels** (the CD's second factory brief and four
  answers): logs in three kinds and a recycle bin, mistakes from causes, each robot's own
  named page with its base prompt and five bought slots, the CD's six instructions joining
  the list as their mistakes are seen, a 1-in-20 slip, off-task instructions doing nothing;
  the wall sign and the prompt lab removed; save version 2. Suites rebuilt (rules 97 checks,
  page 45, eval 9) and both break lists rebuilt.
- 2026-10-13 (later): the factory's **trust** became **customer satisfaction** (CD: how much
  the customers trust the company, not formal's Trust in the AI tool), shown as a labelled
  percentage on the HUD, and the factory is developed **separately from formal** for now:
  its panel no longer names the formal ladder. Rules and tuning unchanged; old saves keep
  their number.
- 2026-10-12 (later): negative tests over both drive suites. `drive-taas` grew from 29 to
  43 checks (section 9, hand-built states) and lost two rows that could not fail;
  `drive-taas-ui` added (the page in Chromium); found that trust can never fall in
  today's tables (Weak spots). No change to the game.
