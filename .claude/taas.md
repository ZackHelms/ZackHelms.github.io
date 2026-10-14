# TAAS (Team AI Adoption Simulator) - context

`games/taas/index.html` (single file, ~3,100 lines) holds **two modes**, picked from a
dropdown beside the mute button (2026-10-13): **Formal** (everything in this file down to §
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
(`drive-taas-factory.cjs`, `drive-taas-factory-ui.cjs`, `eval-taas-factory.cjs`). It is a
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
| **Repo chrome positioned `absolute`, not fixed** | `#back-btn`, `#mute-btn` | The page scrolls; fixed buttons would sit on top of the text as it passes |
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
     old saves instead of replaying them under new rules. `taas-mute` holds the mute.
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
redesign (`.claude/tests/negtests/taas-engine.json`, 39 breaks; `taas-ui.json`, 24):

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

- **A mode button** at the top, right of the mute button, that opens a dropdown and shows
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

### What was built

**The floor** is 6 m wide and 26 m deep (`FACTORY.LAYOUT`), drawn orthographically at a 50
degree elevation, so x is screen x and depth is screen y, with heights foreshortened by
cos 50. A plain back wall (windows and a pipe; no sign since 2026-10-14); the production
line along it (log rack, in-feed belt, machine01 with its console and red button, out-feed
belt, blue sale bin); a **green recycle bin** in front of the out-feed, between the button and
the seller (the sap barrel that stood by the in-feed went on 2026-10-14); the hatch in the east wall where sold goods
leave; the robot dock (charging panel, two crates on two pads); then two empty bays
(pallets, a machine under a tarp, cones) as room to grow. The prompt lab's desk is gone. A
portrait phone sees the whole working area; the bays are a scroll away.

**The loop.** Tap anything and the avatar walks there (an A* over 0.2 m cells, string-pulled,
aimed only at floor it can actually reach) and does the thing on arrival: works the
machine, scrubs a jam, or opens that thing's chat bubble. Within 0.6 m it acts without
walking. The factory makes **medium planks**. **Logs come off the rack in five kinds**: good
medium logs (50%), **gnarled** (15%, dark, with three holes), **small** (15%, thin), **large**
(10%, fat and long) and **sap logs** (10%, holes oozing bright green sap); gnarled and sap logs
are medium-sized. The first log of a new factory is always good. At the machine **you always
get it right**: any other log is tossed in the recycle bin (0.6 s) and you wait for the next to
roll in (0.9 s), and you press on a good one. A press starts a 4 s cut: the log feeds in and
the plank feeds out at the same speed, rides the out-feed (1 s) and drops into the bin
(0.35 s); the next log rolls in, and only then does the button light again.

**Every press costs $1** for the log, whoever presses and whatever the log (a sap log that jams
included); a log tossed in the recycle bin costs nothing. "-$1" floats up from the machine at
each press, and money may go **below zero**: the HUD then reads "-$3" in red. A purchase still
needs the money in hand.

**Robots.** The dock's bubble hires one ($20, then $40; two at most for now); it climbs out
of its crate and the bubble turns to it: its **name** on top, then **the button**,
**selling**, **rest**, and **its clipboard**. Giving a job someone already has swaps them.
A robot does what is in front of it; **what it gets wrong depends on what it meets and on
what it has been told**:

| Robot | It meets | Without the instruction | The instruction that prevents it |
|---|---|---|---|
| Operator | a sap log | feeds it in ($1): the machine jams until **you** scrub it (2.5 s; robots never clean) | Put sap logs in recycle bin (it tosses the log and waits for the next) |
| Operator | a gnarled log | feeds it in ($1): **a gnarled plank** ($3), the holes where the log's were | Put gnarled logs in recycle bin |
| Operator | a small log | feeds it in: dowel rods ($1) | Only input medium logs, or Put small logs in recycle bin |
| Operator | a large log | feeds it in: a large plank ($3) | Only input medium logs, or Put large logs in recycle bin |
| Operator | a gnarled plank, dowels or a large plank coming out | they go to the sale bin | Only output medium wood planks (it flicks the bad cut into the recycle bin as it leaves the machine; the log was already paid for) |
| Operator | - | - | **Never put sap on input log** prevents nothing since the barrel went: nothing in the operator's code asks about it. It joins the list beside the sap-log instruction, a choice that sounds right |
| Operator | - | - | **Put medium logs in recycle bin** throws every medium-sized log away, good ones included (for a factory that wants dowels; on a plank line, a trap). It joins the list with the small- and large-log ones |
| Operator | every cycle | 25% of the time it stops and thinks 3 s first; **no instruction covers this yet** | - |
| Seller | a plank | 25% it gives it away for $0, 35% it lets it go for $3, else $5 | Sell medium wood planks for $5 |
| Seller | a gnarled plank, dowels or a large plank | it takes the next thing in the bin, whatever it is: 50% it sells it **as a medium plank for $5** (the sale goes through, customer satisfaction -15), else at its own price | Only sell medium wood planks: it **leaves everything else in the bin** and hunts for a plank. Each reach (0.45 s) finds one with the chance **planks / everything in the bin** (the CD's formula); a reach that turns up something else picks it in proportion to what is there and is a **"looking for plank"**, 0.8 s putting it back |
| Seller | a gnarled plank, dowels or a large plank it turns up | as above | **Put gnarled planks / dowel rods / large planks in recycle bin**: that thing goes in the recycle bin (0.6 s), never back in the bin and never to a customer. These join the list the first time the seller turns the thing up without the instruction |

A robot that holds an instruction **slips 1 time in 20** and does what it would have done
without it; the seller decides **once a sale** whether to follow "only sell planks", so a long
hunt is one chance to slip, not one per reach. **An instruction about another job is never consulted** (each job's code asks
only about its own), so it does nothing; the rules suite proves it by playing a day with
the instructions crossed between the robots and getting the same day, roll for roll, as
with none. Instructions **belong to the robot**, so swapping jobs leaves each robot holding
instructions for the job it no longer does. Two operator instructions about the same log (say
"Only input medium logs" and "Put small logs in recycle bin") each get their own chance, so a
slip on one is caught by the other. An upstream instruction can keep a downstream mistake from
ever happening: an operator told about every bad log hands the seller only planks, so its
"only sell medium planks" instruction never even joins the list (the rules suite asserts it
with slips held off). Behind an operator told nothing, the sale bin fills with everything that
is not a medium plank unless the seller holds the recycle instructions for those things; told
only to sell medium planks, it spends most of its reaches looking (measured below).

Each outcome shows: a check, a squiggle or a cross pops over the robot, its screen face
changes, and it beeps; a jammed machine shakes, smokes and flashes amber while its operator
shows a "?"; a seller hunting the bin leans in, shakes its head and shows a magnifying glass.
Anything recycled arcs into the recycle bin, and the last few things in it
poke out of its mouth. The first time a robot makes a kind of mistake, "new instruction"
floats up over it.

**Customer satisfaction** multiplies every price (`round(base x satisfaction)`), starts at
100%, takes 15 points per anything else sold as a medium plank, gives one back per fair
sale, never drops below 10%, and **heals by itself**: each second closes 0.5% of the gap to
100 (customers forget). Your own sales are always fair.

**A robot's page** (its bubble's clipboard) is a panel over the floor: its **name** in an
editable field (16 characters at most, trimmed; blank puts its own back), its **base
prompt** for its current job in a dark prompt box ("Use machine01 to refine raw
materials." / "Sell the items in this bin."; none while resting), then its **five slots**:
filled ones show the instruction with a remove button, empty bought ones say "+ add an
instruction", the next one to buy shows its price (greyed until both robots are on staff and
the money is there), the rest just their prices. Tapping an empty or filled slot opens the
**list**: the instructions for mistakes seen so far, one already in another slot greyed with
its slot number; tap one to put it in the slot. Buying a slot opens the list for it straight
away. Under the slots, its **Evals** (the CD's name, fourth brief): what it has done since its
evals were last reset, one line per action and thing ("Put a small log in the recycle bin",
"Sold dowel rods for their price", "Looking for plank"), counted, with a dot: **red** only for a
blocker or a hit to customer satisfaction (a sap log fed in; anything sold as a medium plank
that was not one), **yellow** for anything unexpected or wasteful (thinking, a bad log cut,
a plank given away or let go cheap, a reach that came up empty), **green** for what was asked.
Anything done **against the robot's own instructions** (on a slip) is a line of its own, ending
"against its instructions", and is yellow where it would have been green: the CD's example is
"Sold a gnarled plank for its price", green under the bare base prompt and a yellow line once
the seller was told to sell only medium planks. The header shows how long the evals have run;
**Reset evals** empties them and starts the clock again (it also zeroes the tally in the i
panel). The page stays live while open (money and the evals update). The robot's antenna
bulb shows how many instructions it holds: red none, orange 1-2, yellow 3-4, green all five.

**The build badge** sits in the bottom right corner (the CD, fourth brief), not the top right
where every other game keeps it. **The HUD** (top right) is the money (red, minus first, below zero) with the i button beside it, and under them a white
pill reading **customer satisfaction** with its percentage and a bar (green, amber under
85%, red under 60%). **The i button** opens the reference: what maps to what (machine01 is a
task you can always do yourself, robots are AI agents that take the work off you and do not
always do it well), what customer satisfaction is, the log mix and the $1 a log, what each
grade does, the seller that hunts for planks, how
instructions work (prices, the list growing with mistakes seen, the slip, an off-task
instruction doing nothing), each robot's measured tally by name, your own counts (and what the logs cost), and
**Start over** (two taps). It names nothing from the formal mode.

### Assumed, not decided (Claude's choices; the CD has not ruled on these)

| Assumption | Where it lives | Why |
|---|---|---|
| **Formal stays the default** on a first visit; the choice is remembered (`taas-mode`) and `?mode=formal` or `?mode=robot-factory` wins over it | `MODE` | The CD said the current game *becomes* a mode, not that it stops being the front door |
| **The look**: a chibi in a yellow hard hat and blue shirt; white robots on a hover base with a screen face, teal and orange accents; a light grey concrete floor, steel-blue machine, blue sale bin, green recycle bin with three chasing arrows; gnarled logs dark and knotted, small logs thin | `COL`, `AV`, `RB`, `M_GNARLED`, `M_SMALL` | "Cute cel-shaded robots" and a chibi; the rest is taste |
| **Camera**: orthographic, 50 degrees above the floor, no yaw | `ELEV` | Zelda-like: moving up/down and left/right stays parallel to the screen edges |
| **The floor's size and layout**, the two empty bays, and **the recycle bin in front of the out-feed** | `FACTORY.LAYOUT` | Within reach of the button and the seller, so a toss needs no walk; where the prompt desk stood is open floor |
| **Timings**: 0.9 s for the next log, 1 s out-feed, 0.35 s drop, 0.6 s to toss something in the recycle bin; "near" is 0.6 m; walk 1.7 m/s, robots 1.3 m/s | `FACTORY.CFG` | The CD fixed only the 4 s |
| **The log mix**: 50% good, 20% gnarled, 20% small, 10% sap logs (third brief; it was 55 / 20 / 25 with no sap logs) | `CFG.logs` | Bad logs common enough that an uninstructed operator shows every mistake within a few minutes; sap logs rarer, since each one stops the line |
| **What a robot does without an instruction**: thinking 25% a cycle, every bad log fed in, every bad cut binned; a plank given away 25% / let go cheap 35%; a non-plank passed off as a plank 50% | `CFG.uninstructed` | Close to the CD's first-build 25 / 35 / 40 when it was set (2026-10-14, before the third brief took the poured sap away) |
| **The slip is 5%** and a slip means "does what it would have done anyway" (with the gnarled instruction, from every gnarled log to 1 in 20) | `CFG.slip`, `follows()` | The CD's "about 1 job in 20" |
| **Stopping to think has no instruction** | `operate()` | None of the CD's six covers it; it stays as a robot's cost of doing business until the CD adds one |
| **You always get it right**: you toss bad logs, sap logs included, yourself and never press one | `work()` | The CD's "you never get it wrong", carried over; it also shows the player what a gnarled log looks like before a robot feeds one |
| **The first log of a new factory is good** | `newGame()` | The CD's first press makes a plank |
| **Slots open once both robots are on staff**, are bought in order, and an instruction is free to put in, take out or swap | `buySlot()`, `setRule()` | The CD: "the next step (after buying the 2 robots)"; the CD priced slots, not rules |
| **The same instruction may sit on both robots**, once per robot | `setRule()` | "Each robot has a distinct set": distinct per robot, not exclusive between them |
| **Default names** Bolt and Sprocket, 16 characters at most | `CFG.names`, `CFG.nameMax` | Something to tell them apart before the CD names them |
| **The robot's page opens from a clipboard in its bubble**, which keeps the jobs one tap away; buying a slot opens the list for it | `options()`, `openRobot()` | The CD: "tap a robot to add instructions" |
| **The output check happens at the machine's exit** (the bad cut never reaches the sale bin) | `stepMachine()` | The rule says what not to do; the recycle bin is the only other place for the thing. (Until the third brief "only sell planks" dropped a non-plank in the recycle bin too; the CD reversed that: the seller only sells) |
| **Recycled things are worth nothing** | `recycle()` | Nothing buys them yet |
| **"new instruction"** floats over the robot the first time it makes a kind of mistake | `drain()` | A consequence shown when it happens; the list is behind the clipboard |
| **The antenna bulb counts instructions** (it counted prompt levels) | `bulbOf()` | The robot's own progress, visible on the floor |
| **A save from the prompt-level factory (version 1) is not loaded**: the factory starts fresh | `CFG.version = 2` | The mechanics changed under it; a fresh start is the playtest the CD asked for |
| **Customer satisfaction**: -15 per mislabelled sale, +1 per fair one, floor 10%, heals 0.5% of the gap a second | `CFG.sat*` | Without the healing an uninstructed seller drives satisfaction to the floor and every price (yours too) falls to about $1; with it, uninstructed robots sit near 30% and instructed ones at 100% (measured, below) |
| **Rest** as a third job, and **swap** when a job is taken | `choose()` | A way to stop a robot that is costing you customer satisfaction, and no two operators on one button |
| **Robots never clean a jam** | `operate()` | The CD: "you have to manually do maintenance" |
| **Two robots at most** until the factory grows | `CFG.hire` | Two jobs exist |
| **Whole dollars**; satisfaction as a labelled percentage over a bar, amber under 85%, red under 60% | `paid()`, the HUD | Readable at a glance |
| **Music**: a bouncy 112 bpm marimba loop in this mode, the office loop in formal | `SND` | The repo's every-game audio rule; a playful mode wanted a playful loop |
| **The canvas draws at 2x device pixels at most** | `layout()` | Crisp for toon art, and a 3x phone pays 2.25x less (it took the busy scene from over budget to inside it) |
| **Third brief: "the instruction 'Sell the items in this bin'" means "Only sell 1"x4"x4' wood planks"** (inferred) | `vend()` | The words are the seller's base prompt, which is not added; the instruction that leaves non-planks behind is "only sell planks" |
| **Third brief: "Never put sap on input log" stays in the pool and joins the list with the sap-log instruction** | `RULES` (`joins`), `see()` | The CD is "OK with extraneous instructions in the list"; under "only mistakes you have seen" it would otherwise never show in a new factory, since nothing pours sap. It prevents nothing and is never consulted (proved roll for roll) |
| **Third brief: the sap-log instruction reads "Put sap logs in recycle bin"** | `RULES` | The CD's "put sap logs in recycle", worded like its sibling "Put gnarled logs in recycle bin" |
| **Third brief: a sap log fed in jams the machine**, as poured sap did | `MAKES.sappy` | The mistake the barrel used to cause, now with its cause on the rack |
| **Third brief: the $1 is charged at the press**, so a sap log that jams costs $1 too, your own presses pay, and a log tossed in the recycle bin costs nothing | `press()` | "each time a log is processed by machine01" |
| **Third brief: the minus goes before the dollar** (-$3), and a purchase still needs the money in hand | `cash()`, `buySlot()`, `choose()` | Reads as money owed; nothing is bought on credit |
| **Third brief: the seller decides once a sale whether to follow "only sell planks"** | `vend()` (`r.hunt`) | Deciding once a reach let about 40% of the junk out through slips behind an untold operator (measured: satisfaction 35%), which is not "rarely slips" |
| **Third brief: a reach takes 0.45 s, putting back what was not a plank 0.8 s**, and a reach with no plank in the bin at all still counts | `CFG.reachSec`, `CFG.lookSec` | The CD's formula gives 0 then; a bin of nothing but junk costs the seller about 48 reaches a minute |
| **Third brief: only a sale takes anything out of the sale bin**: yours, by hand at its own price, or the seller's slip | `vend()`, `choose()` | The CD: the seller only sells; the recycle bin is the operator's and yours |
| **Third brief: a factory saved before it still loads** (save version 2 kept): a robot caught fetching or pouring sap, or dropping something in the recycle bin, stands idle, anything it held goes back in the bin, and a log with sap poured on it is a sap log | `load()` | The CD has a factory in progress, and nothing in it means something else now |
| **Third brief: the plank with holes keeps the id `rough`** | `MAKES`, `ITEMS` | Saves and suites name it; the page calls it "a plank with holes" |
| **Third brief: the look**: a sap log is a brown log with holes, a pool of bright green sap along its top and drips down its front; a gnarled log's three holes sit at fixed places, so every gnarled log's plank has them in the same three places; a hunting seller leans into the bin, shakes its head and shows a magnifying glass | `HOLES`, `M_SAPPY`, `lens()` | Taste; fixed holes are the simplest way to keep log and plank matched |
| **Fourth brief: the size instructions' wording**: "Put small logs in recycle bin" and its siblings, plural and ending "recycle bin" like the CD's earlier "Put gnarled logs in recycle bin"; the seller's are "Put dowel rods / large planks / gnarled planks in recycle bin" | `RULES` | The CD's "put small log in recycle" and "put large plank in recycle", in the pool's existing style |
| **Fourth brief: "medium" in place of 1"x4"x4'** in every instruction: "Only output medium wood planks", "Only sell medium wood planks", "Sell medium wood planks for $5" | `RULES` | The CD: "change the specific 1x4x4 size to medium" |
| **Fourth brief: gnarled and sap logs are medium-sized**, so "Put medium logs in recycle bin" throws them away too, and small and large logs are always clean | `RULES` (`rejects`) | Consistent with the CD's answer for "Only input medium logs"; one size per log keeps every log one kind |
| **Fourth brief: "Put medium logs in recycle bin" joins the list with the small- or large-log instruction**, like the old sap one rides in with the sap-log one | `RULES` (`joins`) | No mistake ever calls for it on a plank line; it is the CD's dowel-factory instruction, and "OK with extraneous instructions" |
| **Fourth brief: the log mix** 50% good, 15% gnarled, 15% small, 10% large, 10% sap | `CFG.logs` | Large logs added without making the line worse: still half good |
| **Fourth brief: a large plank sells for $3** at its own price | `CFG.price.largePlank` | "Unsellable or unusable" for a medium-plank line, priced like a gnarled plank |
| **Fourth brief: a seller's recycle instruction joins the list the first time it turns that thing up without it** (selling it, or putting it back on a hunt) | `vend()` | The moment the bin's junk becomes the seller's problem; it makes the remedy available exactly when the CD's playtest needed it |
| **Fourth brief: a hunting seller's empty reach turns up one thing in proportion to what is in the bin** (a named roll, `turnup`) | `vend()` | So a recycle instruction for one kind of junk works through a bin of several kinds |
| **Fourth brief: what counts as against its instructions** is a slip on an instruction the robot holds about that very moment (a log it holds an instruction about, cut anyway; a non-plank sold on a sale it slipped "only sell"; a plank let go below $5 on a slip of the price one; a thing put back on a slip of its recycle one) | `operate()`, `vend()`, `credit()` | The CD's "after that point I would expect ... a yellow dot (as a new entry)": the instruction is what changes the grade, so the line is its own |
| **Fourth brief: the colours**: yellow for thinking, every bad log cut (dowels were red), a plank given away (was red) or let go cheap, a "looking for plank"; green for a log or thing recycled as told, a plank sold for $5, and anything sold for its own price | `GRADE`, `gradeOf()` | The CD's rule: red only for blockers and hits to customer satisfaction |
| **Fourth brief: Reset evals is one tap**, per robot, and also zeroes that robot's tally in the i panel; the header counts minutes since | `resetEvals()`, `renderRobot()` | Fresh data for the latest instructions, as the CD asked; counts are cheap to rebuild, so no confirm |
| **Fourth brief: the badge moved on this page only**, to the bottom right, inside the safe area | `#build-badge` | The CD was playtesting TAAS; the other games keep the SOP's top right until the CD says otherwise |
| **Fourth brief: a factory saved before it loads**: "Only input logs bigger than 1"x4"x4'" (`small`) becomes "Only input medium logs" (`medium`) in its slot and on the list; save version 2 kept | `RENAMED`, `load()` | The CD's factory in progress |

### Open questions for the CD (factory)

1. **How should instructions grow more nuanced?** The CD: "More on that later." Ideas in the
   factory's own terms (assumed, not asked for): instructions that conflict or need an order
   (a long list a robot reads more slowly, the way a long prompt costs); instructions with a
   condition ("only on Tuesdays", "unless the bin is full"); products where the right
   instruction depends on the order (a customer who wants dowels).
2. **Should stopping to think have an instruction** (it is the one mistake none of the six
   covers), or stay as the price of an agent?
3. **What do the bays hold next?** A second machine (logs to dowels on purpose, or planks to
   furniture) would give dowels and gnarled logs a real use and the operators a second line.
4. **Should a jam cost more than time** (a repair bill)? Since the third brief the jammed log
   costs its $1; otherwise a jam only stops the line until you scrub it.
5. ~~Should the factory and the formal mode share anything?~~ **Answered 2026-10-13: not
   for now.** The CD is working on the factory separately for a different perspective (see
   Customer satisfaction, above); independent rules, copy and saves.
6. **Should every instruction be on the list from the start**, extraneous ones included, or
   stay "only mistakes you have seen" with a look-alike riding in beside the real one (today:
   the old sap instruction with the sap-log one)? The CD's "middle ground" note may want more
   choices than the exact fixes.
7. **How should what is not a plank leave the sale bin?** Today only a sale takes it out: yours
   by hand, or the seller's slip. A "clear the bin" for you would be the obvious next control;
   giving it to the seller would undo "sell the items in this bin".
8. **Dowels on purpose** (the CD's own note): once dowels are a product, "Only input medium
   logs" (general) and "Put gnarled logs in recycle bin" (specific) stop being interchangeable,
   since the first throws away the dowel stock; "Put medium logs in recycle bin" is already in
   the pool for that day. It wants a second product, and probably a customer who asks for it.
9. **Who writes the evals?** (the CD's FYI, fourth brief, nothing to build yet): leave each
   robot's evals as they are, graded by the game, to introduce the idea, or have the player
   define the criteria (a rubric) per robot, or let the player define evals at a higher level,
   for a factory making tables out of several refined parts.

### Architecture (factory)

Three script blocks join the page, in this order after the formal engine:

1. **`const FACTORY = (function () { ... })()`**, the factory engine: pure functions over one
   plain state object, no DOM, ending `if (typeof module !== 'undefined') module.exports =
   FACTORY;` (the suites lift exactly that span, so keep both lines). It owns the layout,
   pathing, the avatar's tasks and acts (`work()`: you always get it right), the machine,
   belt, bin and recycle bin, the robots' state machines (`operate()`, `vend()`), the
   instructions (`RULES`, `BASE`, `follows()`, `see()`, `known()`, `slotsOpen()`,
   `slotPrice()`, `buySlot()`, `setRule()`, `rename()`), prices and customer satisfaction
   (`settle()`), the chat bubble's options (`options()` / `choose()`) and saving.
   - **Every roll is named** and goes through `roll()`: `log`, `think`, `slip`, `price`,
     `mislabel`, `find`, `turnup`. The dice are a mulberry32 on `s.seed`, so **a save resumes the same
     luck**, and `s.force[name]` is a test queue: what the next rolls of that name come up.
     A robot only rolls where it has a choice to make, so an instruction it does not hold, or
     one about another job, changes nothing, down to the dice.
   - **An instruction is three things**: a `RULES` row (id, job, the CD's text), a
     `follows(s, r, id)` call in its own job's code where the mistake would happen, and a
     `see(s, id, by)` where the mistake shows (which puts it on the list and emits `rule`). A
     row with `joins: [ids]` rides onto the list when one of those instructions joins: that is
     how "Never put sap on input log" stays, prevents nothing, and still shows up. Since the
     fourth brief the rules are data: an operator instruction lists the logs it keeps out
     (`rejects`; `operate()` asks every one the robot holds, each with its own slip) and a seller
     one the thing it takes out of the sale bin (`recycles`); `FED` says which instructions a
     wrong cut puts on the list, and `see()` takes several at once.
   - **Evals** are `r.record`, keyed `action[:thing][!]` ('reject:small', 'honest:rough!'): `!`
     means done against the robot's own instructions (a slip on one it held about that very
     moment), and `gradeOf(key)` turns the `GRADE` of the action yellow when it was green.
     `credit()` counts an outcome in the evals and the tally; `note()` counts a line that is not
     an outcome (a looking, a cut caught at the exit). `resetEvals()` empties both and sets
     `r.since`.
   - **Money**: `press()` charges `CFG.logCost` and counts it in `s.spent`, so money is always
     what was earned less the logs, the robots and the slots (the fuzz row checks exactly that),
     and it may go below zero.
   - **The seller's hunt** is `r.hunt`: decided once a sale (`follows(s, r, 'sellOnly')`), then
     each reach rolls `find` at planks / everything in the bin and, on a miss, `turnup` for which
     thing it came up with. A thing it holds a recycle instruction for goes in the recycle bin
     (the `drop` state); otherwise a miss counts a looking, emits `looking` and spends
     `CFG.lookSec` in the `look` state.
   - The engine emits `s.events` (press with its cost, made, binned, jam, cleaned, recycled,
     looking, sold, hired, assigned, outcome, rule, slot, instructed, notes, arrive) that the
     page drains for sound and effects; `notes` opens the robot's page.
2. **`SND` and `MODE`**, shared by both modes: one AudioContext (formal's sounds moved here
   unchanged, plus the factory's), two music tracks switched by the mode, the mute button;
   and the mode switch, a native `<select id="mode-btn">` dressed as the third chrome
   button (it listens to `change`, per the native-form-controls rule), which sets
   `html[data-mode]` (CSS shows one mode and hides the other), remembers the choice, writes
   `?mode=` with `replaceState`, and calls each mode's `enter`/`leave` hooks.
3. **The factory UI** (an IIFE): the 3D kit and everything on screen.
   - **Primitives** (`box`, `cyl`, `ell` superellipsoids) are convex, wound outward by the
     centroid rule, and carry their **edge list** with the face on each side. `drawPrim()`
     transforms, culls back faces, shades each face into **three flat bands** (shadows pushed
     cool, a high floor, a colour starting `!` is emissive), strokes the ink only on
     **silhouette edges** (a shown face against a hidden one), then fills **one path per
     colour band** (a convex primitive's shown faces never overlap). Parts of a character are
     drawn back to front by their centres, each with its own ink, so an arm over a body gets
     its line.
   - **Static scenery is baked once per scale** into one canvas per object (the key carries
     scale, dpr and offset), and blitted on **whole device pixels**; the floor is one baked
     canvas keyed on the robots hired (the pads light). Everything else is drawn live in
     **depth order** (sorted by each thing's front edge): belt tops, the machine's window
     (a spinning blade, sap drips), the button and beacon, items (each log by its kind), the
     recycle bin's contents, the avatar, robots. Flights (a sale to the hatch, anything into
     the recycle bin) are arcs drawn over the scene.
   - **The avatar** is a joint chain of matrices (hips, torso, head with hair and hard hat,
     arms, two-segment legs and boots) with a walk cycle **driven by distance walked** (a
     0.62 m stride, so feet do not slide), arms counter-swinging, a bob, and acts: press,
     toss, scrub (with a sponge), hold a sale overhead. Facing turns through an exponential
     spring. Its painter-side state lives in a WeakMap, off the sim objects.
   - **Robots** hover and bob, lean into motion, and pose per state (press, think, toss a log,
     flick a cut, reach, look, pitch); their face screen draws eyes by mood.
   - **A gnarled log's holes and its plank's** come from one `HOLES` table ([along, across] in
     metres), so they cannot drift apart; a hole is a dark cap sunk into the log's surface, or
     drawn over the board with a sort `bias` (a primitive option), without which the hole on the
     far half of the plank sorted under it.
   - **Input**: touch and mouse on the canvas; past 10 px of travel it is a scroll (with a
     little fling), otherwise a tap, resolved by `hitTest()` against the drawn sprites'
     boxes (front-most wins), robots' projected boxes, then the floor. **One coordinate
     space**: the canvas is sized from its own `getBoundingClientRect()`, re-measured every
     frame, on resize, and on the way back into the mode.
   - **The bubble, HUD and panel are DOM** over the canvas, so they stay crisp and are
     testable; the bubble follows its anchor every frame and is clamped on screen. The panel
     has two modes: the i reference (`renderPanel()`) and **a robot's page** (`openRobot()`,
     `renderRobot()`): the name field is built once and never re-rendered while typing; the
     rest re-renders only when its signature changes. **A robot's name is the player's
     text**: it goes in through `textContent` or `esc()`, never raw into `innerHTML`.
   - **Saving**: `localStorage['taas.factory.v' + CFG.version]` (now `v2`), every 2 s while
     running, on `pagehide`, on hiding and on leaving the mode. A save from another version
     is ignored; an instruction renamed since (`RENAMED`) comes back under its new id, in its
     slot and on the list; a hand-edited one is clamped (money to a whole number, below zero allowed;
     what was spent; satisfaction, slots, unknown or repeated instructions, the name, an
     unknown log, a robot state this build no longer has), and an instruction a robot holds
     counts as seen.
   - **Test hook**: `window.TAAS_FACTORY` (`s`, `view`, `tick`, `paused`, `hitTest`,
     `spriteRect`, `screen`, `save`, `layout`, `openRobot`, `closePanel`, `page`): the suites
     step exact frames, find where things are drawn, and read which page is open.

### Measured (2026-10-14, fourth brief)

`node .claude/tests/eval-taas-factory.cjs` (30 simulated minutes, every action walked, the
robot's page included; money net of the $1 logs). A persona that instructs follows one PLAN, an
optimal path through the instructions as they join the list (operator: sap logs, gnarled logs,
only medium logs, only medium planks out; seller: only medium planks, $5, and the three recycle
ones), and resets a robot's evals once it holds its whole plan:

| Persona | $20 | robot 1 | robot 2 | first instruction | operator holds its 4 | seller holds its 5 | earned | logs | $/min net, last 5 | satisfaction end/min | seller sold / looking | junk left in bin |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hands-on (sells by hand too) | 0.8m | 0.9m | 2.3m | 2.5m | 5.3m | 6.5m | 1160 | 247 | 25.8 | 100/85 | 185 / 0 | 0 |
| supervisor (never sells by hand) | 0.8m | 0.9m | 2.3m | 2.5m | 6.6m | 7.6m | 1095 | 243 | 23.6 | 100/85 | 170 / 0 | 0 |
| walks away after hiring | 0.8m | 0.9m | 2.3m | - | - | - | 90 | 21 | 0.0 | 100/85 | 2 / 0 | 0 |
| uninstructed | 0.8m | 0.9m | 2.3m | - | - | - | 444 | 255 | -0.6 | 16/10 | 214 / 0 | 0 |
| crossed | 0.8m | 0.9m | 2.3m | 2.5m | - | - | 445 | 256 | -0.6 | 18/10 | 121 / 0 | 0 |
| seller only (its whole plan; the operator told nothing) | 0.8m | 0.9m | 2.3m | 2.5m | - | 8.0m | 663 | 250 | 5.8 | 100/75 | 170 / 3 | 0 |
| sell planks (only "only sell medium planks" and $5, as in the CD's third-brief playtest) | 0.8m | 0.9m | 2.3m | 2.5m | - | - | 578 | 247 | 6.4 | 100/75 | 101 / 1058 | 91 |

The shape it asserts, beside the old rows (first robot fast, robots alone stall, instructions
pay, satisfaction, crossed wires worth nothing, agents not free speed, the hunt through a filling
bin): **a valid optimal path exists and works** (the CD's ask). Every bad log and everything
but a medium plank has an instruction that deals with it, and each of those joins the list in
the uninstructed run, which meets everything; the supervisor's sale bin never holds more than
four things that are not medium planks in its last ten minutes, though it never sells by hand,
with customers at 100%; once each robot holds its plan and its evals are reset, the operator's
come back at least 60% green (its yellow is stopping to think, which no instruction covers) and
the seller's at least 80% green with no red; and **wherever a sale bin fills up, every kind of
thing filling it has a recycle instruction already on that persona's list**, so the dead end was
the persona's and not the game's. Run against a copy of the page without the seller's three
recycle instructions (the third-brief game), that row fails with "NO WAY OUT for seller only,
sell planks", and so do the coverage and plan rows: the check would have caught the sale bin the
CD watched fill up. The seller with its whole plan keeps the bin clear even behind an operator
told nothing, at the price of every junk log.

Frame cost (`.claude/scripts/frame-budget.cjs games/taas/index.html
select=#mode-btn:robot-factory evalFile=.claude/scripts/poses/taas-factory-busy.js`, 390x844,
the busy pose now with the seller hunting a bin of junk, large planks among it, the recycle bin
full and a sap log rolling in): **16.7 ms median, 2-6 of 149 frames over** across three runs
(2026-10-14, fourth brief), against 1-2 of 149 for the third-brief build measured in the same
container the same hour (it read 0 earlier that day): inside budget, at this container's noise. The 2026-10-13 fixes still carry it: blitting baked
sprites on whole device pixels (fractional offsets during a scroll forced resampling),
capping the canvas at 2x, and baking the floor; before them, 26-57 of 149 were over.

### Negative tests (factory)

`.claude/tests/negtests/taas-factory-engine.json` (102 breaks, against
`drive-taas-factory.cjs`) and `taas-factory-ui.json` (54, against
`drive-taas-factory-ui.cjs`): **101 and 52 caught** (2026-10-14, fourth brief: no large logs or
a large log cut into a medium plank, only the first instruction about a log consulted, "Only
input medium logs" letting large logs through, "Put medium logs in recycle bin" doing nothing, a
wrong cut putting nothing on the list, a seller that never recycles or whose recycle
instructions never join, a turn-up that always picks the first kind, slips never marked or
staying green, a free plank or dowels red again, a reset that keeps the tally or the clock, an
old instruction or list entry not renamed; on the page, the badge back at the top, the old
section name, a dead Reset, slips unlabelled, the dots read off the old table, the large plank's
icon gone. Three rows were made to bite by the run: the "medium logs" row read its event before
checking one existed (a crash, not a fail), the rename row passed because a held instruction
re-lists itself, and the slip row never looked at the evals. Third brief: logs that
cost nothing, a toss that costs, what was spent not kept, sap logs gone or cutting into planks,
the sap-log instruction ignored, the old sap instruction consulted or never joining, the seller
recycling again, a hunt that ignores the bin's mix or rolls a slip every reach, the looking
never counted, an instructed seller that never slips or an uninstructed one that hunts, a save
that floors money, keeps dead states or loses poured sap; on the page, money never red or
"$-1", a plank's holes moved or sorted under the board, a dry sap log, the barrel back, the
looking row or the $1 sentence gone. Before that, rebuilt for instructions: every instruction ignored, never slipping, an operator instruction leaking into
selling, slots before both robots / free / flat-priced / shared between robots, an unseen or
repeated instruction allowed, a mistake never or always announced, you pressing bad or
sapped logs, a toss that keeps the log, the robot's page never opening, a name read as
markup, the picker offering unseen instructions or a repeat, the wall sign back, the recycle
bin gone). The misses are **equivalent changes**, recorded rather than tested:
`bubbleOpen()`'s arrival check (every `tap()` clears the bubble first, so nothing can show it
early), the console's own tap box (the machine's box covers it), and the `pagehide` save (in
Chromium the `visibilitychange` save fires on the same navigation; on iOS Safari `pagehide`
is the reliable one, so both stay). **One break showed a check was redundant, not a row
missing**: `follows()` used to ask whether the instruction was about the robot's job, and
deleting that check changed nothing, because each job's code only ever asks about its own
instructions. The check went; the property is now structural, and its break became "an
operator instruction leaks into selling", which the crossed-wires row catches. Earlier passes
found rows that could not fail: the "near the button" row started the avatar on the spot
itself, the "walking away" row looked while it was still walking, the slow-operator row
could time out and pass, the scroll-clamp row was rescued by the fling's own clamp, and the
save row was rescued by `pagehide`.

### How to change it (factory)

- **Retune**: `FACTORY.CFG` only. Then `.claude/scripts/gates.sh games/taas/index.html` and
  `node .claude/tests/eval-taas-factory.cjs`, and bump `CFG.version` if a save would now
  mean something else.
- **Add an instruction**: a `RULES` row (id, job, the CD's words); in its job's code, a
  `follows(s, r, id)` where the robot would make the mistake, choosing what it does instead;
  a `see(s, id, by)` where the mistake shows; a `DOING` line in the UI if it adds something
  new to a robot's record; and rows in the suite's § 7 (it prevents its mistake, it slips, it
  joins the list only when seen). The page and the list pick it up from `RULES`. An
  instruction meant to be a look-alike that prevents nothing needs only the row, with
  `joins: <the id it rides in with>`, and a roll-for-roll row in § 7 proving it inert.
- **A new kind of log or item**: `LOGS` and `MAKES` (what it becomes; keep a log's id and its
  product's apart, as `large` and `largePlank` are, since `ITEM_MODEL` holds both), its odds in
  `CFG.logs` and a row in `nextLog()`'s table, `FED` (which instructions a robot cutting it puts
  on the list), an operator instruction whose `rejects` names it, a model in `ITEM_MODEL` and a
  resting height in `LIFT`; for an item, `ITEMS`, its price, a seller instruction whose
  `recycles` names it, and `ITEM_NAME`, `MINI`. The suite's § 1 and the eval's coverage row
  fail until every bad log and every item but the product has its instruction.
- **An eval line**: a key in `GRADE` (its colour), a `DOING` phrase in the UI (with the thing it
  was done to), and `credit()` or `note()` where it happens.
- **Move or add a thing on the floor**: its footprint in `LAYOUT.SOLID` (pathing reads it),
  its model in `sceneObjects()` (key = its front edge's y), a tap target in `hitTest()` if
  it does something, and a spot in `LAYOUT.SPOT`. The suite walks every spot to every other.
- **A new job or machine**: a state machine beside `operate()`/`vend()`, a branch in
  `homeOf()`, a bubble option in `options()`, an icon in `ICON`, a base prompt in `BASE`,
  and its instructions as above.


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
