# TAAS (Team AI Adoption Simulator) - context

`games/taas/index.html` (single file, ~900 lines). A management sim: you run one team
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
are negative-tested (§ Negative tests). It is a **first draft
the CD is still designing**; most numbers below are guesses waiting for the CD's tuning.

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

## How to change it

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
- 2026-10-12 (later): negative tests over both drive suites. `drive-taas` grew from 29 to
  43 checks (section 9, hand-built states) and lost two rows that could not fail;
  `drive-taas-ui` added (the page in Chromium); found that trust can never fall in
  today's tables (Weak spots). No change to the game.
