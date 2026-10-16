# TAAS (Team AI Adoption Simulator) - context

`games/taas/index.html` (single file, ~4,100 lines) holds **two modes**, picked from a
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
checks, pure node), `.claude/tests/drive-taas-ui.cjs` (the page, 26 checks, Chromium at
phone width) and `.claude/tests/eval-taas.cjs` (balance shape, opt-in); both drive suites
are negative-tested (§ Negative tests). The robot factory has its own three
(`drive-taas-factory.cjs`, 156 checks; `drive-taas-factory-ui.cjs`, 86; `eval-taas-factory.cjs`, 19). It is a
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

### Assumed, not decided (Claude's choices; the CD has not ruled on these)

| Assumption | Where it lives | Why |
|---|---|---|
| **Formal stays the default** on a first visit; the choice is remembered (`taas-mode`) and `?mode=` wins over it | `MODE` | The CD said the current game *becomes* a mode |
| **The look**: a chibi in a yellow hard hat; white robots on a hover base; customers in their own shirts and hair, no hat; a grey concrete floor, a wooden shop floor and counter, steel-blue planer, grey input bins, blue output bins, a green recycle bin, a white table saw with an orange guard, a green extractor with a glass tank, a wooden bench | `COL`, `AV`, `RB`, `custParts()` | Taste |
| **Camera**: orthographic, 50 degrees above the floor, no yaw | `ELEV` | Zelda-like |
| **Timings**: 0.9 s for the next log, 0.8 s out-feed, 0.35 s drop, 0.6 s to toss, 0.4 s to empty a bin into your arms, 0.45 s to stock the counter, 3 s a cut, 4 s an extraction, 5 s a carving, 2.5 s for a customer to pay; walk 1.7 m/s, robots 1.3, customers 1.1 | `FACTORY.CFG` | The CD fixed only the 4 s and "within a few seconds" |
| **Storefront: "Fix sap jam costs $5" means scrubbing a jam clean costs $5**, charged when it is clean (inferred), on top of the log's $1 | `CFG.fixCost`, `stepAvatar()` | The open question "should a jam cost more than time" had asked exactly that |
| **Storefront: the customer in the CD's stocking example pays $4**, not $5 (inferred: the CD's "$5" there is the old price; the stall is "$4 medium plank") | `buy()` | The brief cut the price to $4 |
| **Storefront: satisfaction already set prices** ($ times satisfaction since the first build); kept, now what customers pay at the stall, and **shown on the counter's label** (green at full price, amber or red below) | `paid()`, `drawPlate()` | The CD asked for it as if new: making it visible is the change |
| **Storefront: the goal is a dark board across the top of the wall**, drawn live from the stall's price; the wall grew to 3.3 m for it | `drawBoards()`, `BOARD.goal` | "Add to the rear wall"; under the boards the shop's customers would cover it |
| **Storefront: the log mix**: 20 / 65 / 15% by size, 75 / 15 / 10% by quality, one named roll over the nine kinds | `CFG.logs`, `nextLog()` | About half normal medium logs, as before |
| **Storefront: the three lengths drawn 0.55, 0.85, 1.1 m** | `LEN` | 2', 4', 8' would not fit the belts |
| **Storefront: you at the planer press a normal medium log, or any normal log you racked yourself, and toss the rest** | `yours()`, `work()` | "Always correct" for the goal; a log you put on the rack is your choice, and the CD wants extracted logs to go back to the planer |
| **Storefront: a tap on an output bin takes everything** (no bubble); input bins and the recycle bin open a bubble, one button a kind, one tap moving all of that kind; arms hold any number | `arrive()`, `options()`, `choose()` | The CD's flow (pick up, deliver, keep the rest, recycle the extras) in the fewest taps |
| **Storefront: the stall holds 6**, shown as a stack on a teal tray; one stall, `CFG.stalls`, ready for more | `CFG.stallCap`, `CFG.stalls` | "Initially one slot" |
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

### Open questions for the CD (factory)

1. **Hiring the operator first is a trap now.** Revenue is capped by the customers, so a first robot
   on the planer (as in every earlier build) presses every log, junk included, while you still carry
   every plank: money falls and no persona that keeps it there ever affords the second robot.
   Moving it to stocking (one tap) recovers (measured, below). Keep the trap as a lesson, or shape it
   (a hint, cheaper slots, or customers arriving with demand)?
2. **Overproduction.** An instructed operator makes medium planks faster than customers buy them,
   so the output bin fills with planks that cost $1 each and wait. An instruction about pace ("stop
   when the stall is full"), or let surplus feed the saw?
3. **Demand.** Customers come one every 8-16 s whatever happens. Should fewer come when satisfaction
   is low (and more when it is high)? That would also break the slide where a long line drops
   satisfaction, prices fall with it and the money for instructions never comes.
4. **What sells next, and for what?** The CD priced planks of every length, sap and cut wood; gnarled
   planks and carvings have no price. Each new stall is a `CFG.stalls` row.
5. **Robots on slots 02 to 04**: which jobs, which mistakes, which instructions?
6. **How should instructions grow more nuanced?** (still open from the second brief)
7. **Should stopping to think have an instruction**, or stay the price of an agent?
8. **Should every instruction be on the list from the start**, look-alikes included?
9. **Who writes the evals?** (the CD's FYI, fourth brief)

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
     planer makes of it, or `'jam'`), `priceOf()` (the CD's prices; `null` for what has none) and
     `ACCEPTS` (what each bin you put things in takes) are the vocabulary.
   - **State**: the planer (`machine`, its `rack` queue of logs you put there, `belt`, `bin`), the
     `recycle` bin (everything in it), the `saw` and `extract` mills (`in`, `phase`, `belt`, `out`),
     the `bench`, the `stalls`, the `shop` (its people, the next arrival, how many served and how
     many sold something else), the avatar with its `inv`, the robots, and `spent` with its parts
     in `costs` (logs, fixes, saw, extract).
   - **Every roll is named** (`log`, `think`, `slip`, `find`, `turnup`, `arrive`, `carve`) and goes
     through `roll()`; `s.force[name]` is a test queue. A robot rolls only where it has a choice,
     so an instruction it does not hold, or one about another job, changes nothing, down to the dice.
   - **An instruction** is a `RULES` row: an operator one lists the logs it keeps out
     (`rejects: { quality, size }`), a stocker one the things it takes out of the output bin
     (`recycles: { kind, size }`), a look-alike only `joins`. `keepers(log)` is every instruction
     that would have kept a log out (they join the list when an operator cuts it); `see()` puts
     instructions on the list; `follows()` rolls the slip.
   - **The avatar's places** (`PLACES`): the planer (`work()`), output bins (`pick`), the counter
     (`stock`), the extractor (a press), the bench (`carve`), and bubbles for the rack, the input
     bins, the recycle bin, the saw, the dock and robots. `store(s, place)` is the array behind a
     bin. The planer's output bin is reached from the nearer of two spots (`pathLen()`).
   - **The shop** is `stepShop()`: arrivals while fewer than `CFG.shop.max` are inside, the line
     (place 0 at the stall, each place `gap` further west), paying (`buy()`, the price times
     satisfaction, the hit for anything but the stall's `want`), leaving by the door, and the
     waiting drain. `waitingNow()` counts the customers standing in line.
   - **The stocker** is `stocker()`: reach (decide the hunt once a stocking), turn up, recycle or
     look or carry, place when the stall has room, cool. **The operator** is `operate()`, as before.
   - **Evals** are `r.record`, keyed `action[:thing][!]`; `GRADE` and `gradeOf()` colour them
     (`jam` and `misstock` red; `cut`, `think`, `looking` yellow; `plank`, `reject`, `caught`, `stock`,
     `recycle` green).
   - The engine emits `s.events` (press with where and what it cost, made, milled, binned, jam,
     cleaned with its cost, recycled, looking, customer, paying, sold, stocked, picked, put, took,
     carved, hired, assigned, outcome, rule, slot, instructed, notes, arrive).
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
     The avatar carries up to four things across its arms and a count chip.
   - **Live machine bits**: belt tops per row, the planer's window and beacon, a red button on each
     console (lit when a press would do something), the saw's blade (still until it cuts), the
     extractor's tank level.
   - **Boards**: `drawBoards()` writes the goal, the money and customer satisfaction on the wall;
     `drawPlate()` writes the stall's label and its price now. `boardRect(k)` is where each is drawn
     (`cash`, `sat`, `goal`, `plate`).
   - **The bubble** groups put and take buttons into two rows (arrows say which); a thing's picture
     comes from `mini(id)` and its name from `NAME(id)`.
   - **Input**: `hitTest()` walks the `TAPS` table (sprite id to place), robots first, the front-most
     sprite next, then the floor.
   - **Test hook**: `window.TAAS_FACTORY` as before (`s`, `view`, `tick`, `paused`, `hitTest`,
     `spriteRect`, `screen`, `board`, `showInfo`, `save`, `layout`, `openRobot`, `closePanel`, `page`).

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
remaining trap (open question 1).

Frame cost (`.claude/scripts/frame-budget.cjs games/taas/index.html select=#mode-btn:robot-factory
evalFile=.claude/scripts/poses/taas-factory-busy.js`, 390x844; the busy pose: both robots at work,
the stocker hunting a bin of junk, a full shop with one leaving, every slot's bins full, the saw
cutting, the extractor running, the avatar walking with its arms full): first measured at **33.3 ms
median** (every second frame missed), with no single part to blame (only skipping the things and
the people together brought it back). Baking the things in bins and on belts, then baking customers
standing in line and giving customers fewer facets: **16.7 ms median, p95 16.8, 3-5 of 149 over**
across four runs, against 0 of 149 for the menu build's busy pose in the same container the same
hour (a quieter scene): inside budget.

### Negative tests (factory)

`.claude/tests/negtests/taas-factory-engine.json` (101 breaks, against `drive-taas-factory.cjs`)
and `taas-factory-ui.json` (50, against `drive-taas-factory-ui.cjs`), both rebuilt for the
storefront: **100 and @UICAUGHT@ caught**. The first engine run caught 92: nine misses were rows not
yet written (a customer walking in counted as waiting, a wrong sale's money, the second in line
paying early, one tap putting in only one of a kind, the extractor's bin taking clean logs, the
output bin always reached from the floor, a robot double-pressing a planer you started, a stocker
overfilling a stall that filled while it carried), and one was caught only by a crash (a row that
read an event before checking one existed, made null-safe). **The engine's one miss is the known
equivalent change**: `bubbleOpen()`'s arrival check, which every `tap()` already makes redundant by
clearing the bubble. @UIMISSES@

### How to change it (factory)

- **Retune**: `FACTORY.CFG` only. Then `.claude/scripts/gates.sh games/taas/index.html` and
  `node .claude/tests/eval-taas-factory.cjs` (it prints the table above), and bump `CFG.version` if
  a save would now mean something else. The customers' rate is a balance lever with a cliff: see
  Measured.
- **A new stall** (another thing on sale): a `CFG.stalls` row with its `want`, its price in
  `CFG.price`, a spot on the counter, a second label, and customers who want it (`stepShop()`
  serves one stall today; give each customer a `stall` and a line per stall).
- **Add an instruction**: a `RULES` row (an operator one with `rejects: { quality, size }`, a stocker
  one with `recycles: { kind, size }`, a look-alike with `joins`); in its job's code a `follows()`
  where the robot would make the mistake (the data rows need none: `operate()` and `stocker()` ask
  every row that matches); a `see()` where the mistake shows; a `DOING` line if it adds a new
  action; rows in the rules suite's § 8.
- **A new kind of thing**: a size or quality goes in `SIZES` or the `LOGS` list and `CFG.logs`; a
  product in `ITEMS` (and `PRODUCTS` if the planer makes it), `makes()`, `priceOf()`, `ACCEPTS` for
  the bins that take it, a model in the UI's `ITEM_MODEL` builders, a `mini()` picture and a `NAME()`.
  The rules suite's § 1 and the eval's coverage row fail until every bad log and every product but
  the stall's has its instruction.
- **A new machine slot**: a row in `LAYOUT` (`mill(y)` builds a saw-like one), a state like `saw`,
  a `stepMill()`-style step, a press in `arrive()` or a bubble in `options()`, its bins in `store()`
  and `ACCEPTS`, sprites in `sceneObjects()`, `TAPS` entries, a bay in `SLOTS`, and the rules suite's
  § 9. A robot job for it: a state machine beside `operate()` / `stocker()`, a branch in `homeOf()`,
  a bubble option, an `ICON`, a `BASE`.
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
  first, the trap it found); break lists 101 and 50 (100 and @UICAUGHT@ caught).
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
