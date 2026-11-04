# Combat Simulator (`games/combat-simulator/`)

A third-person katana duel in WebGL2: you against one AI swordsman at a time, up a
ladder of ten named masters, in a walled stone courtyard whose light runs from
mid-morning at rank 1 to a lantern-lit dusk at rank 10. CD commission, 2026-11-01,
placed on the hub straight after Driving Simulator. Open licence (MIT, the default).
One self-contained file (~1,800 lines). Suite: `.claude/tests/drive-combat-simulator.cjs`
(96 checks; 32 negative controls on the game and 24 on its graphics styles, all caught). Since
2026-11-03 (CS-3, CS-4) a parry only counts before the blade lands, and there are three kinds of strike:
the normal five-cut chain, a **quick** strike (a jab) and a **heavy** strike, each on its own button and key.

## The CD's brief (verbatim)

> This session will focus on a new arcade game "combat simulator" that goes in list
> after driving simulator.
>
> This game is 3rd person with camera perspective behind and above my character who has
> a katana sword. Joystick on lower left corner to move, on bottom right buttons for
> attack, dodge, parry. Pressing attack multiple times sequentially does a combo attack
> (3, 4, or 5 hit combo) cycle before repeating the attack animation sequence. If i press
> parry within a short interval during the opponents attack will stagger them and if i
> attack while they are staggered they cant dodge or parry and it does +10% dmg. dodge
> gives invincibility frames (iframes) so i could dodge directly into an attack and not
> get hurt if i time it right. Successful dodges and parries and 3 hit and 5 hit combos
> grant +1 energy into "power attack" (a 4th btn on the bottom right), when this reaches
> 10 energy points It closes and flashes to indicate that I can use it. I can bank up to
> 20 points unable to use it two times in a row. Power attack from me or from the enemy
> can only be dodged, It cannot be parried.
>
> Load and init zmh-producer and zmh-3d plugins.

## The four answers given before the build

| Question | CD's answer |
|---|---|
| Who you fight | **1v1 duel ladder**: one opponent at a time, each rank faster and smarter; win to climb, lose and retry that rank. |
| The 3, 4 or 5 hit combo | **One 5-hit chain**: taps run cuts 1-5 then start over; the 3rd and 5th landed cut each pay +1 energy. |
| Look | "All three with selector in settings menu. Default to realistic webgl. Its a lot so put items in backlog in a combat simulator section and i can run "backlog-plan-gen" for them later." Realistic shipped; the selector, toon and neon are **CS-1** and **CS-2** below. |
| The 20-point bank | "I can power attack once at 10 or if save to 20 can use it twice in a row." ("unable" in the brief was "enabling".) |

## Assumed, not decided

| Thing | What was built | Why |
|---|---|---|
| The opponent's power attack (**decided 2026-11-03**: keep it) | It fills the **same meter by the same rules** (its parries, its slipped dodges, its 3rd/5th landed cuts) and spends 10 on a telegraphed spin: a red ring on the ground and a glowing blade through a long wind-up | Offered as the recommended option; the CD answered the other half of that question only |
| "Successful dodge" | A dodge pays only when its invincible frames actually slip a cut (once per cut) | Otherwise dodging in the air farms energy |
| "3 hit and 5 hit combos" | A run of landed cuts in a row; a whiff, a parried cut or a dodged cut breaks it (the chain itself carries on) | "Combo" read as connected hits |
| Being hit | A cut **flinches** the fighter it lands on (0.22 s, cancels their swing) unless they are staggered or winding a power attack | Without it nothing interrupts a swing; short enough to parry between an opponent's cuts |
| Power attack armour | A fighter winding or swinging a power attack **does not flinch** (takes the damage, keeps swinging) | Makes "can only be dodged" literal: you cannot cut your way out of it either |
| Timings | Parry window 0.24 s of a 0.5 s parry; dodge 0.4 s with invincibility 0.02-0.28 s, 2.6 m; stagger 1.5 s; cuts 0.14-0.26 s wind-up | Stagger set so the whole five-cut punish fits after a parry from close range (measured: 1.3 s left the fifth cut out) |
| Damage | Cuts 7/7/9/10/15 (48 a full chain), power 26; you have 100 HP, opponents 80-150 | |
| The ladder | Ten named opponents (`LADDER`), tuned by `rankParams()`; past rank 10 it goes on as "KENSEI +n", a little harder each time | The CD asked for a ladder, not its length |
| Light per rank | Rank 1 at 9:30 am to rank 10 at 8:36 pm (dusk, the four stone lanterns lit) | A visible sense of climbing; free with the sky model |
| Facing | Both fighters always face each other (lock-on); the stick moves you relative to the camera, so up walks at your opponent and sideways circles | The camera is behind you looking past you at them, as asked |
| The stick | Floats: a thumb anywhere in the lower left puts it there; drawn at its home position when idle | Standard phone action-game control |
| No blood | Hits throw white sparks; a cut on a staggered fighter shows its number in gold with "!" | House games are all-ages |
| Licence | Open MIT | The default; not one of the protected nine |
| Performance stats | FPS only by default (pure green, top centre); details in the settings | Driving Simulator's stats were a CD ask; kept the habit, default lighter |
| Toon's look, every row below from here to Toon's pine rim | **Signed off by the CD 2026-11-03** after a playtest of CS-1 | The rows stay as the record of what was built |
| Toon's band levels | A lit band of 0.7 above `k = 0.55`, a mid band of 0.4 above 0.12, else 0 (`k` is N.L times the shadow) | The plan's 1.0 and 0.55 blew out the pale flagstones at rank 1 once saturation was pushed; the implementer lowered them |
| Toon's ambient floor | `max(mix(ambGnd, ambSky, 0.5) * ao, keyCol * 0.1 + 0.1)`, flat (no `N.y` gradient) | The plan's `0.18 + 0.12` washed rank 1 out; checked by eye at ranks 1, 5 and 10 |
| Toon's lanterns | Two steps: `+0.15` where the lantern's light passes 0.08 and `+0.45` where it passes 0.3, in the lamp colour; the paper's own glow does not flicker | The light banded like the sun |
| Toon's saturation | Albedo pushed by 1.6 before shading, the whole frame by `satp(..., 1.15)` after the tonemap | The plan's factors, kept |
| Toon's joints and gravel | Flagstone joints a hard line where `e < 0.022` at 0.42 x the stone colour; gravel in two tones (1.0 and 0.8) on the sign of the furrow sine | Flat, with the pattern kept |
| Toon's blade | One white highlight (strength 4.0 before the tonemap) where `dot(N, H) > 0.985`; it keeps the power glow `uGlow * 1.8`; no rim | The spec's single hard highlight |
| Toon's sky | Two colours from `skyCol`'s zenith and horizon, blended `smoothstep(0.02, 0.55, d.y)`; clouds at a noise threshold of 0.66, 85% opaque, tinted from 0.07 grey at night to 1.2 white by day; the sun a flat disc at `cos > 0.9992`, the moon at `cos > 0.99965`; **no stars**; the far range `(0.05, 0.08, 0.14)` and the near `(0.03, 0.06, 0.05)`, scaled by the day and mixed 45% and 25% toward the horizon. Fog mixes toward the same horizon colour | Dawn-to-dusk by rank still holds |
| Toon's trail | A solid white crescent at alpha 0.9 on every vertex, power cuts included (power is not tinted in toon) | The spec's white crescent |
| Toon's sparks | The plan's five-point star; the colour clamped to 1 and scaled by life, with no 2x over-bright | Crisp edge |
| Toon's ink | `#0d0b10` at 1.5 CSS px, the same width on the blade (at the duel's distance the blade is narrower than its two ink edges, so it reads as a dark line with a light core) | The spec's 0.012 m is about 1.5 px at the duel's camera distance |
| Toon's wall joints | The arena's overlapping wall boxes (each is `hl + 0.02` long) draw a short vertical ink line at every segment joint, so the wall reads as panels | Kept rather than special-cased |
| Toon's pine rim | The open bottom of a pine's foliage cone shows the shell's bottom ring as a dark band where the camera sees under it | Kept as the rim's own line |
| Neon is a dark theme in display space | No tonemap and no exposure: every body is `N_BG + vCol * 0.05 * (0.55 + 0.45 N.V)`, lit only a little by facing so a wall's faces still separate; fighters `vCol * 0.06` with no facing term (their rim does that job) | Neon is the site's Neon Arcade palette, whose colours are display values; the CD's playtest decides |
| Neon's flagstone joints | `N_BLUE` at 85%, a 0.012 half-width line in stone units, antialiased by `fwidth` and faded out where the joints are thinner than a pixel | The far floor would otherwise moire |
| Neon's lanterns | Flat `N_GOLD`, 0.8-1.0 by facing, no flicker, the same at every rank; they cast no light in neon | The spec's emissive edge lines; a point light would need the tonemap neon dropped |
| Neon's sky | Horizon `N_PURPLE * 0.14` to `N_BG` by `d.y = 0.5`; stars on a 150-per-radian grid (0.7% of cells, white at 35-85%, faded in from `d.y` 0.08); each mountain range a `fwidth`-wide `N_PURPLE` line with an exponential glow of 0.006 rad, the far one at 60% and the near one at 100%; pure `N_BG` below the near ridge, `N_BG * 1.2` between the ridges; no sun, moon or clouds, at any rank | A night sky in outline, as the walls are |
| Neon's edges | 2 CSS px; purple for walls, torii and trees, gold for lanterns, `N_BLUE * 0.4` for the paving, purple for any arena material outside the list; flat (no fog); the fighters' edges in their side's colour | The spec's emissive edge lines; 2 CSS px is the plan's width, and nothing was widened for the bloom pass, where they are half a target pixel and still glow |
| Neon's rim | `pow(1 - N.V, 2.2) * 1.4` in green (you) and red (them); the blade white-hot `(1.0, 0.97, 0.92)` plus the power glow, clamped to 1 | The spec: you green, the opponent red, the blade white-hot |
| Neon's ground glow | A 0.7 m ring at alpha 0.14 in the side's colour under each fighter, at y 0.02, in the additive flat draw | The spec's faint glow in place of sun shadows; there is no shadow pass in neon |
| Neon's trails and sparks | Trails in the side's colour (gold for a power cut) at alpha 0.9 at the leading edge; sparks 1.5x as big, in their own colours rather than the palette | The spec's stronger trails and sparks |
| The bloom's numbers | A quarter-resolution target, a bright-pass at 0.45, the composite at 0.9; one 9-tap blur each way, so the halo reaches about 16 device px; no second, wider level | The plan's numbers. They read well on the rank-1 frame (edges and rims glow, the floor's joints get a soft wash near the fighters, the dark bodies stay dark); the CD's playtest decides |
| The bloom draws what the screen draws | The quarter-resolution pass is neon exactly as the screen has it: edges at the same CSS width (half a target pixel there), effects included, so a trail and sparks bloom too | One scene routine (`drawScene`) serves both passes |
| The bloom is neon's alone | At every rank, with no setting of its own (only the test switch `FX.bloom`); the quality select (`SETTINGS.gfx`) does not change it | Realistic and toon must stay byte-identical |
| The bloom's draw calls | An idle neon frame is 19 draw calls (8 with `FX.bloom` off) and 21 with a trail, a ring and sparks (9 off). The bloom is the scene pass again (8 or 9) plus 3 post passes (two blurs and the composite) | The plan's escalation trigger was "more than neon's own main pass plus four"; the bloom adds 12 with effects against a bound of 13, so it was not escalated. If neon's frame rate is poor on the CD's phone, a cheaper bloom exists: resolve the main pass with `blitFramebuffer` into a full-size texture and downsample from it, with no second scene. Not built (overseer's decision, 2026-11-04) |
| Ink is flat | Drawn in display space with no tonemap and no fog, so a far pine's outline is as dark as a near one's; it writes depth, so the additive effects depth-test against it | Simplest; screen-constant width already keeps distant lines thin |
| The HUD in every style | Keeps one look and layout | The spec says only the controls keep their layout; a styled HUD is a separate ask |
| CS-3 and CS-4, every row below from Parry rows to The help wording | **Signed off by the CD 2026-11-04** after a playtest of both (backlog refinement), except contact, which the CD decided to move (CS-5) | The rows stay as the record of what was built |
| Parry rows (CS-3, 2026-11-03) | The parry is judged against the attacker's `ATTACKS` row (`parry`, `parryWin`); the normal rows are today's chain with `parryWin` 0.24 s, the power row is `parry: false`, `parryWin: 0`, `idx: -1` | The plan's one-table design; the old numbers are unchanged |
| A parry from a flinch (assumed: not asked in these words) | A parry pressed while flinching or staggered is **dropped**, never buffered, for both fighters; attack, dodge and power presses are still buffered | The traced cause: a buffered parry fired the instant the flinch ended and caught the next chained cut |
| A buffered parry meets a hit (assumed) | A parry already in the buffer is **cleared** when its fighter is flinched or staggered. The stagger clear has no check of its own (a 1.5 s stagger outlasts the 0.22 s buffer, so it cannot show in play) | Belt and braces, so the rule holds if `RULES.buffer` ever outgrows the flinch |
| The opponent's parry lead (assumed) | `aiIntent()` schedules its parry `Math.min(0.10, 0.8 * parryWin)` before contact; 0.10 s for every row today | A shorter-window row would otherwise be asked for a parry that cannot land |
| Contact left where it is (**decided 2026-11-04: move it**, CS-5) | `tryHit()` still runs on the first in-reach tick of the active window; three of ten cuts deal damage with the blade over 0.25 m from the body (table under "CS-3 as built") | Left as the default because moving it changes every timing the ladder was measured on; the CD chose "land on the blade" at backlog refinement, specified as CS-5 |
| Strike kinds (CS-4, 2026-11-03) | `RULES.kinds`: quick `wind` x0.5, `rec` x0.8, `dmg` x0.6; heavy `wind` x2.0, `rec` x1.3, `dmg` x1.6, applied to every row of the chain; `act`, `reach`, `arc` and `lunge` are the chain row's | The plan's numbers, picked for the CD to playtest; quick and heavy are the same five cuts timed differently, so the chain's poses and reach still read |
| A kind's parry window (the CD: scales with the telegraph) | `parryWin = min(0.24 * K.wind, 0.50 - 0.10)`: quick 0.12 s, heavy 0.40 s (0.48 capped), the normal chain 0.24 s at every rank. The factor is the kind's, never the rank's `windMul` | "Scale with the telegraph" read as the kind's wind-up factor; a parry always ends with 0.10 s still open |
| The opponent's strike mix (assumed) | `quickP` = lerp(0.05, 0.30) and `heavyP` = lerp(0.25, 0.15) from rank 1 to 10; each cut it starts or chains rolls once on `F.krng`; the stagger punish stays normal cuts | Low ranks lean on readable heavies, high ranks on jabs. Measured shares below the ladder |
| A second random stream (assumed) | `F.krng = mulberry32((seed || 1) ^ 0x5bd1e995)`, drawn only by `aiStrike()`; `F.rng` is drawn exactly as before | A kind roll must not shift the draws the ladder was measured on |
| The 0.10 s parry cap (assumed) | The AI's parry lead is `min(0.10, 0.8 * parryWin)`: 0.10 s for the normal and heavy rows, 0.096 s for quick (0.8 x 0.12) | A quick row's 0.12 s window would otherwise be asked for a parry that cannot land |
| The `counter` persona reads the telegraph (assumed, test only) | It parries at `until <= min(0.13, 0.9 * parryWin)`, so against a quick it presses 0.108 s ahead; a power attack is still dodged at 0.13 | A player who reads the row's own window; the ladder's rank-10 rate stayed 1 |
| A queued strike keeps its kind (assumed) | `f.queued` holds the kind string (`'normal'`, `'quick'`, `'heavy'`), truthy, and `startHit()` resets it to false; a queue left at the end of recovery goes back in the buffer as its own action (`atk`, `quick`, `heavy`) | The queue was a boolean; a mix-in needs the kind |
| Keys U and O (assumed) | `U` quick, `O` heavy, beside J K L I | Same row of the keyboard, next to attack |
| Where the two buttons sit (assumed) | On an arc of **3.4 R** round attack, quick at **22.5 deg** (low, by the thumb's rest) and heavy at **67.5 deg** (high), radius 0.6 R; the four old buttons did not move | Checked at all seven swept sizes with zero safe insets: inside the viewport, clear of the power ring at 1.3 r, clear of the stick by 8 px, below the bars + 40. 3.2 R overlaps power. See "How to add" for the limit |
| The telegraph you can see (assumed) | In the wind-up, quick's hand key is `mixKey(POSE.guard, C.wind, 0.55)` (a short backswing) and heavy's `mixKey(POSE.guard, C.wind, 1.25)` with the pelvis `drop` 0.14 (a big one); the normal cut's `C.wind` as before; sweep and follow-through the same for all | Timing already follows the row; only the size of the backswing is new |
| The telegraph you can hear (assumed) | `SND.tell(kind)`: quick a 0.06 s noise burst sweeping 1500 to 800 Hz; heavy a 0.22 s burst sweeping 500 to 200 Hz at a slightly higher level; any other kind the old 0.1 s, 900 to 400 Hz | Quick shorter and higher, heavy longer and lower |
| The icons (assumed) | In units of r/46: quick is a 4.5 blade, a 6 hilt stroke and three 2.6 speed lines fading, the middle one longer; heavy is the 4.5 katana under two 4.5 arcs of radius 24 and 33 at 100% and 60% alpha | Quick reads fast, heavy reads big |
| The help wording (assumed) | HOW TO FIGHT gains a "Quick and heavy strikes" paragraph before Dodge (less or more damage, a shorter or longer wind-up and parry window, either is any cut of the chain, the opponent throws them too), `U quick strike, O heavy strike` on the Keyboard line, and (CS-3) "A parry pressed while you reel from a hit does nothing." under Parry | Opt-in text in the settings, so the discovery rule allows it |
| Music | Koto and shakuhachi on the in-sen scale, taiko during the fight; wind and birds by day, crickets at dusk | Every game here has music |

## Architecture

- **`/*ENGINE:BEGIN*/ ... /*ENGINE:END*/`** is the whole fight, DOM-free: `RULES`,
  `LADDER`, `rankParams()`, `newFight()`, `stepFight(F, dt, inP, inE)`, `aiIntent(F, dt)`.
  The suite lifts it into node with `new Function`. Nothing in it draws or reads the
  clock; the page steps it at a fixed 120 Hz.
- **A fighter is a state machine**: `free`, `atk` (with `chain` 0-4), `power`, `dodge`,
  `parry`, `stagger`, `flinch`, `down`, `win`. Each swing has wind-up / active / recovery
  (`phasesOf()`: an opponent's wind-up and recovery are stretched by its rank's
  `windMul` / `recMul`; the active window is the same for all). **`tryHit()` is the one
  place a blade meets a body**: in reach and arc, then dodge (i-frames), parry (judged by the
  attacker's `ATTACKS` row: `H.parry && d.st === 'parry' && d.t < H.parryWin`; the row comes
  from `specOf()`: `ATTACKS[f.kind][f.chain]` or `ATTACKS.power`), else hit (+10% on a staggered target, flinch unless staggered or
  armoured, the combo count, the knockout).
- **One attack table, `ATTACKS`** (built once after `RULES` from `RULES.chain`, `RULES.power` and
  `RULES.kinds`, which stay the source): a row carries `name, kind, idx, dmg, wind, act, rec, reach,
  arc, lunge, parry, parryWin`. `ATTACKS.normal` is the chain as it always was, `ATTACKS.power` is
  the power row (`parry: false`, `idx: -1`), and **a loop over `RULES.kinds` builds `ATTACKS.quick`
  and `ATTACKS.heavy`**: the chain with `wind`, `rec` and `dmg` scaled and `parryWin = min(0.24 *
  K.wind, 0.40)`. A fighter has a `kind` (`f.kind`, `normal` by default), `startHit(F, f, idx, kind)`
  sets it and the `swing` event carries it, and `specOf(f)` reads the row, so `phasesOf()`, the AI,
  the pose and the swish all follow it. `hit` and `parry` events carry `atk` (the swing's id). A new
  kind of strike is a `RULES.kinds` entry, with no parry code.
- **`STRIKE`** maps the actions that cut to the kind each throws: `{ atk: 'normal', quick: 'quick',
  heavy: 'heavy' }`; `ACTIONS` lists the actions in the order the first pressed wins (`power, dodge,
  parry, heavy, quick, atk`). `begin()` takes the next chain index by the grace rule for any `STRIKE`
  action and starts its own kind, so quick and heavy mix into the five-cut chain and every landed cut
  counts for the 3rd/5th energy, whatever its kind. **`f.queued` is a kind string**, never `=== true`:
  a tap in the second half of a wind-up stores `STRIKE[f.buf]`, the chained cut starts with it, and
  every use elsewhere is a truthiness test.
- **Input is buffered** (`buf`, 0.22 s): a press made while busy fires when the fighter
  can act. **Two exceptions for the parry** (CS-3): a parry pressed while the fighter is
  flinching or staggered is **dropped**, never buffered (the input loop in `stepFighter()`); and
  a parry already buffered is **cleared** when its fighter is flinched or staggered (`tryHit()`).
  Both live in the engine, so they hold for the opponent too. A tap during a cut's second half of wind-up or later **queues** the next cut;
  a tap within `RULES.grace` after a cut's recovery still continues the chain.
- **The opponent** (`aiIntent`) reads each of your swings **once, when it starts**, and
  decides then to parry or dodge it, answering no sooner than its `react` time; so a slow
  mind cannot parry your fast first cut and a fast one can. It punishes your stagger with
  a full chain, throws a power attack when it has 10, otherwise circles at 2.5-3.3 m and
  steps in for chains of up to its rank's `maxChain`. **It throws all three kinds**: `aiStrike(F)`
  rolls once per cut it starts or chains and returns `quick`, `heavy` or `atk` by the rank's `quickP`
  and `heavyP`, on **`F.krng`**, a second random stream seeded from the fight's seed, so a kind roll
  never shifts a draw of `F.rng`. The stagger punish keeps normal cuts.
- **The rig** (`rigFighter`): poses are **hand position + blade direction keys** in the
  fighter's local frame (`POSE`: guard, five cuts each as wind / sweep / follow, parry,
  stagger, the power spin...), timed by the engine state alone (`poseOf()`). The right arm
  reaches the key by two-bone IK, the left arm reaches the pommel by IK, the legs reach
  feet planted in the world by IK, and the feet step on their own when the body leaves
  them (`stepFeet`). Torso twist follows the hands. Local frame: x right, y up, z forward,
  with right = forward x up (`frameOf`); get this wrong and every fighter is left-handed.
- **Rendering**: hand-written WebGL2. The arena is one static mesh with a
  material-switched shader (flagstones, raked gravel, plaster, tile, wood, lacquer,
  paper lanterns). Fighters are ~25 **instanced tapered capsules** each (`VS_LIMB` builds
  the capsule from A, B, r0, r1), drawn in two instanced calls. One shadow map from the
  key light (sun, or moon at night); four lantern point lights at dusk; additive blade
  trails, ground rings and sparks. About 12 draw calls a frame in realistic. The page has
  a **Graphics style** selector (realistic, toon, neon) that swaps the shaders and the effects'
  colours without touching the fight; see Graphics styles below.
- **HUD** is a 2D canvas over the GL one: the bars and energy ticks, the six buttons
  (attack, dodge, parry, power, and since CS-4 quick and heavy; `LAY.btn`) and their icons, the power ring (inner ring 0-10, closes and flashes at 10; outer ring
  10-20), the floating numbers, the combo count, banners. `LAY` holds the layout.
- **Sound** (`SND`): WebAudio only; three buses (music, ambient, sfx) under a master,
  a slider each. Karplus-Strong koto baked per pitch. The opponent's wind-up has a quiet
  scrape (`tell`, which takes the swing's kind: a jab's is short and high, a heavy's long and low) and every cut's swish starts on its first active frame: both are
  timing cues for parrying.
- **Test hook** `window.__CS`: `POSE` (CS-4: so a row can measure a wind-up's backswing), `setPaused`, `tick(dt, n)`, `press(k)`, `stick(x, y)`,
  `startDuel(rank, seed)`, `hud()` (draw the HUD now), `F`, `LAY`, `SKY`, `APP` (with a
  `frames` counter: wait on frames, never wall time, under SwiftShader), and for the
  styles `STYLES`, `setStyle(s)`, `draw()`, `pixels(x, y, w, h)`, `glError()`, `PARTS` and
  `FX` (Graphics styles, Hooks).

## Graphics styles

The settings' PICTURE section opens with a **Graphics style** select (`#style-sel`, written in
the HTML and not generated from `STYLES`, so a row that says it offers exactly these is not a
tautology): `realistic` (the default, the shipped look), `toon` and `neon`. It sits above the older
`Graphics` quality select (`SETTINGS.gfx`), which is not the style and is unchanged. Choosing
one fires `change`, sets `SETTINGS.style`, saves, and the next frame uses it: no reload, no
new duel. **A skin is paint**: the engine never sees the style (the suite checks the engine
text has no "style"), and a fixed-seed duel steps to byte-identical fighters under every
style, with real frames drawn between the ticks, and when the style is switched mid-duel.

- **`STYLES = ['realistic', 'toon', 'neon']`** sits beside `SETTINGS`; a style's index is its GLSL
  `STYLE` number (GLSL `STYLE 2` is neon). `SETTINGS.style` defaults to `'realistic'` and is validated right after the
  load: a save without the key, or a junk value (`chalk`), reads realistic.
- **`withStyle(src, n)`** puts `#define STYLE n` straight after the shader's first line. It
  **throws** if the source does not start with `#version 300 es\n`: `#if STYLE == 1` on an
  undefined macro is an error in GLSL ES 3.00 whose message does not say why, so a source it
  cannot patch fails loudly instead.
- **`PROGS` and `progsFor(look)`** hold one program set per style, compiled lazily on first
  use from the same sources: `world`, `limb`, `sky` and `glow` per style, and for a style in
  `INK` the two ink programs. The shadow programs and `flat` are not style-dependent and live in
  `PRG`, shared by every set. `initGL()` builds realistic's set only, so boot cost did not grow
  and toon and neon compile on their first frame. In GLSL every difference is an `#if STYLE == 1` block
  with the old code in the `#else`, so realistic compiles from exactly the code it always had;
  that is what the one-off pixel proof relied on (the same sha256 before and after both steps,
  `2ddf4aa3...935729be`).
- **Only `render()` reads the style**, once, at its top (`const look = SETTINGS.style, P =
  progsFor(look)`), then uses `P.*` and `look` for everything it draws. Not the engine, not
  `update()`, not `stepEffects()`, not the HUD.
- **Toon's light** is `shadeToon()` in `GLSL_COMMON`: N.L times the shadow map, cut into
  three bands (0.7, 0.4, 0) with a hard terminator, a flat floored ambient, the lanterns in two
  steps, no specular and no sky reflection, no cool rim. The one exception is the blade (one
  hard highlight). The albedo is the flat material colour pushed in saturation (`satp`, 1.6
  before shading and 1.15 after the tonemap), the flagstones keeping their joints as a flat
  darker line and the gravel its furrows as two tones. Fighters keep each opponent's gi and
  hakama hue. Measured on the opponent's torso (a 12 x 40 CSS px box, luminance quantised to
  64, levels holding at least 3 px): realistic 34-38, toon 14-17 (13 with ink), the same scene
  with toon's `shade()` put back 24-36.
- **The sky** (`FS_SKY`) under toon is two colours taken from `skyCol()`'s zenith and horizon,
  a hard threshold of the same cloud noise in one tint, a flat sun disc, flat mountain
  silhouettes in two tones; fog mixes toward the horizon colour. See the assumed rows for the
  numbers.
- **Effects.** Toon's trail is a solid white crescent: every vertex white at alpha 0.9, drawn
  with `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)` as its own `drawArrays`, ahead of the additive
  rings. That needed **`FS_FLAT` to write its alpha** (`vC.a`) instead of `1.0`: harmless for
  the additive styles, since with `ONE, ONE` and `alpha: false` source alpha is never read
  (the realistic hash proves it). Sparks (`FS_GLOW`) under toon are **star bursts**: a solid
  five-point star at full strength with a crisp edge.
- **The ink is an inverted hull drawn by discarding by normal, not by culling.** Each shell
  is pushed out by the ink width and `FS_INK` discards every fragment whose outward normal
  faces the eye (`dot(vN, uEye - vW) > 0`), leaving the far shell, which depth-tests behind
  the body except in a thin band at the silhouette. Culling is off everywhere in this renderer
  and the winding was never checked; by derivation `VS_LIMB`'s frame `(u, ax, v)` is
  **left-handed**, so the capsules' outward faces wind clockwise. Step 2 measured it: with
  `gl.cullFace(gl.FRONT)` and the discard taken out, **99% of the opponent's torso box came out
  near-black** (475 of 480 pixels, 4,760 in the whole opponent box, against 27 and 734 with the
  discard). That confirms the left-handed frame; `gl.cullFace(gl.BACK)` would be the culling
  that works, but the discard does not depend on winding, so it stays. A rise-only check of
  the black pixels would have passed that wrong way round, so row 1 also caps the torso at 25%
  near-black (measured 5.6%).
- **Width is screen-constant**: the shell moves by `uInk * |uEye - base|`, with `uInk =
  px * 2 * tan(CAM.fov / 2) / (ph / dpr)`, so a line is 1.5 CSS px on the wall 17 m away
  and on a fighter alike.
- **`aExt` and the 13-float vertex.** The arena's per-vertex attribute `aExt` (location 4, vec3,
  at byte offset 40) is the direction a vertex moves for one unit of ink, **a function of the
  corner alone** so the shell closes. The mesh builder went from 10 floats a vertex to 13
  (**stride 40 to 52**): `vert(mb, p, nr, c, m, e)` takes `e`, default `NOEXT = [0, 0, 0]`, and
  `initGL()` has five `vertexAttribPointer` calls. `box()` walks a `BOXC` sign table, a corner's
  `e` being `sx X + sy Y + sz Z` in the box's own axes (the corner positions are computed
  exactly as before, so the old vertex values are bit-identical); `cyl()` gives a side vertex
  `[c, -1, s]` on the bottom ring and `[c, 1, s]` on the top, a cap centre `[0, 1, 0]` and a
  cap ring `[c, 1, s]`. The floor disc and both annuli keep 0 and grow no shell. A missed
  pointer would draw garbage with no GL error; the realistic hash covers the shadow pass,
  which reads the same VAO. The shadow program reads location 0 only.
- **The `INK` table** (`{ toon: { px: 1.5, col }, neon: { px: 2, col: NEON.purple, side: SIDE } }`)
  lists the styles that draw ink, their width in CSS px and colour; `side` marks the style that
  draws the fighters' hull per fighter, in the side's colour. `progsFor()` compiles `inkWorld` and `inkLimb` for a style in
  it, and `render()` computes `const ink = FX.ink && INK[look]`. Two passes, both through
  `inkSet()`: the arena shell straight after the arena draw (one `drawElements`), and one
  instanced draw of all the capsules after the fighters' colour draws (neon draws that hull once
  per fighter, so each has its own colour).
- **Hooks** on `window.__CS`: `STYLES`; `setStyle(s)` (sets `SETTINGS.style` and the
  select's value, does not save, so rows that test saving go through the select's `change`);
  `draw()` (renders one frame now, synchronously, with `FRAME_DT` 0, the camera snapped and
  `CAM.shake` 0, so two draws of a state are one picture; it restores `FRAME_DT`);
  `pixels(x, y, w, h)` (`draw()`, then `readPixels` in the same task, because the context keeps
  no drawing buffer; CSS px from the top left, rows come back bottom-up in device px);
  `glError()`; `PARTS` (the spark list); and `FX = { ink: true, bloom: true, only: null }`, test-only
  switches so a row can toggle a pass in the live page. `render()` reads `FX.ink` and `FX.bloom`
  (the bloom is neon's alone). `FX.only` (`'p'`, `'e'`, `'none'` or `null`) makes neon draw only
  that fighter's colour, edges and ground glow, so a row can find one fighter's own pixels by
  difference. `NEON`, `SHADOW` (a getter), `BLOOM` (a getter) and `BLOOM_K` are exposed too. A comparison renders all its variants inside one
  `page.evaluate`, because the rAF loop keeps drawing between evaluates. `__CS.tick()` never
  renders, so a paint-invariance row calls `draw()` between ticks. `dprNow()` is the one place
  the device pixel ratio is read.
- **Draw calls per frame** (`PERF.calls` for one `draw()`, the rank-4 scene): an idle frame (sky,
  arena, two fighters, two shadow draws) is 6 in realistic and 8 in toon (the two ink passes). With
  a trail, a power ring and sparks, 8 in realistic and 11 in toon (9 with `FX.ink` off). Neon has
  no shadow pass: 8 idle and 9 with effects with the bloom off (sky, arena, arena edges, two
  fighters, their two edges, one flat draw), 19 and 21 with it on. See the bloom's assumed row.

### Neon

- **Palette.** `NEON` is one table of the site's Neon Arcade colours (the hex values in
  `games/CLAUDE.md` as 0-1 RGB: `bg`, green, red, blue, purple, gold). It feeds the JS and, as
  `NEON_GLSL` (`const vec3 N_<NAME>`), the shaders: in `GLSL_COMMON` under `#elif STYLE == 2` and
  in `FS_INK`'s neon branch. `SIDE = { p: green, e: red }`.
- **Display space.** `FS_WORLD` (`STYLE == 2`) has no tonemap and no `uExposure`; fog mixes toward
  `N_BG`. The sky, bodies, joints and lanterns are in the assumed rows; the blade and limbs are in
  `FS_LIMB` with the **`uRim`** uniform, set per fighter in the colour loop from `SIDE`, so the
  rim is green on you and red on them.
- **Emissive edges per material.** `VS_INK_WORLD` under `STYLE == 2` reads `aMat` (location 3) into
  `flat out int vMat`, and `FS_INK`'s neon branch colours by it (9, 7 and 2 purple, 8 and 4 gold,
  3 and 6 `N_BLUE * 0.4`, anything else purple). `VS_INK_LIMB` writes `vMat = -1`, which takes
  `uInkCol`. The fighters' hull is drawn **per fighter** (`ink.side`), `uInkCol` from `SIDE`,
  through the same per-fighter attribute offsets as the colour loop.
- **No shadow pass, a ground glow.** `render()` sets `SHADOWS_ON = look === 'neon' ? 0 : 1`,
  skips the shadow pass's two draws when it is 0 (it still computes `shVP`, which the shaders
  take), and then sets the depth, blend and cull state the pass used to leave behind for the main
  pass (nothing else enables `DEPTH_TEST` before it, which the bloom's target needs too).
  `setCommon` hands `uShadowOn` the flag. A `flatRing` under each fighter joins the additive flat
  draw.
- **`drawScene(look, P, R)`** is everything from the sky to the sparks, the per-fighter ink and the
  ground glow included; the shadow pass stays outside it. `R = { shVP, ph, dpr, caps, nCaps }`
  carries the frame's locals the body reads. It was cut out of `render()` verbatim as its own
  commit, with the three frozen-frame hashes unchanged, before any bloom code existed, because the
  bloom draws the same scene a second time.
- **The bloom.** `render()` ends with `drawScene(look, P, R)` and then, for neon with `FX.bloom`,
  `bloom(look, P, R, pw, ph)`. `BLOOM = { w, h, texA, fbA, rbDepth, texB, fbB, ok, made }` comes
  from `makeBloom(w, h)`: two RGBA8 textures, `fbA` with a depth renderbuffer and `fbB` without,
  `ok` the two framebuffers' completeness (an incomplete target skips the bloom rather than
  drawing garbage), `made` counting builds; it is re-made, deleting the old, whenever
  `ceil(pw / 4)` or `ceil(ph / 4)` changes. `BLOOM_K = { div: 4, thresh: 0.45, gain: 0.9 }` holds
  the three numbers. `bloom()` draws the scene into `fbA` at the quarter size, blurs `texA -> fbB`
  across with the bright-pass (`max(c - 0.45, 0) / 0.55` per tap), blurs `texB -> fbA` down without
  it, then adds `texA * 0.9` onto the screen with `ONE, ONE` blending. `VS_POST` is `VS_SKY`'s
  triangle at the far depth (`z 0.9999`) on purpose: with the depth test left on, the halo would
  hide behind everything the scene drew, which makes "the composite disables `DEPTH_TEST`" a
  load-bearing line a break can remove. The blur and post programs read no `STYLE`, so they are
  compiled once, on the first neon frame, with the target.
- **The state the bloom restores.** Afterwards: `DEPTH_TEST` on, `depthMask(true)`, `BLEND` off,
  the viewport and framebuffer back, the active unit and **unit 0's texture the shadow map** (what
  `setCommon` left there), the VAO null. No sampled texture is ever attached to the framebuffer
  being drawn: the scene pass binds the shadow map, each blur reads the other target, the
  composite reads `texA` into the screen.
- **Why `bloom-state-leak` needs a GL-state row, not a picture.** Every frame starts by setting the
  state it draws with (realistic and toon through the shadow pass's own enables, neon through the
  `if (!SHADOWS_ON)` reset), so a blend left on is undone before anything is drawn and a realistic
  frame after a neon one still matches. The row reads the state directly (blend, depth test,
  depth mask, cull, blend func, viewport, framebuffer, active unit, unit 0's texture, VAO) and
  keeps the pictures for the leaks the resets do not cover.
- **The palette and green/red rows were restated for the bloom.** The halo blends the palette's
  hues, which drops the brightest 2%'s hue share from 99.2% to 96.8% and lifts the red in the
  opponent's brightest pixels past 1.5x even with a green rim, so those clauses read the frame with
  `FX.bloom` off (the colours as drawn) and a second clause holds the shipped frame, bloom on,
  under the same mean ceiling (0.096 < 0.12). `neon-rims-same` came back MISSED before this
  restatement.

## The ladder, measured

`rankParams(rank)` interpolates rank 1 to 10: opponent HP 80-150, damage x0.7-1.15,
wind-up x1.9-1.05, reaction 0.40-0.09 s, parry chance 8-55%, longest chain 2-5. Two
scripted players over 16-20 seeds a rank (`.claude/tests/drive-combat-simulator.cjs`
part 1, and the scratch sim this was tuned with):

| Player | Rank 1 | 3 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|
| Masher (walk in, tap attack every frame) | 100% | 80% | 65% | 20% | 5% | 0% | 0% | 0% |
| Counter (parries every cut 0.13 s before it lands, dodges power, punishes the stagger) | 100% | 100% | 100% | 100% | 100% | 100% | 85% | 60-95% (ends on half health) |

**Re-measured with CS-3 (2026-11-03)**, part 1's ladder line: `masher rank 1 1, rank 10 0;
counter rank 5 1, rank 10 1`, against `1, 0; 1, 0.875` before. The counter persona's rank-10 rate
rose from 0.875 to 1 because the opponent can no longer parry the persona's stagger punish straight
out of a flinch. No ladder row was edited.

**Re-measured with CS-4 step 3 (2026-11-03)**: the same line, `masher rank 1 1, rank 10 0; counter rank 5 1,
rank 10 1`, with the `counter` persona restated to read the row's own window and the opponent throwing all
three kinds. No tuning was needed, and no shipped `rankParams` field or `RULES` timing moved. **The
opponent's measured kind shares** (the suite's row 4 scenario, AI v counter, four seeds, 60 s, the
opponent's swings): rank 1 quick 0.054 / heavy 0.214 (56 swings), rank 5 0.225 / 0.188 (80), rank 10 0.104 /
0.041 (193). Rank 10's quick share is below `quickP` (0.30) because about half its swings there are the
stagger punish, which stays normal (**the CD, 2026-11-04: leave it as built**; rank 10 does not need to
jab more). At rank 5 the opponent parried 10 of 40 heavies and 0 of 40 quicks
thrown as first cuts from free (a quick winds up before a rank-5 mind can answer).

So mashing gets you through the first few, parrying is the skill the ladder teaches, and
the last two cost even a frame-perfect parrier.

## Open questions for the CD

All four answered by the CD on 2026-11-03 (backlog refinement), none spawning work:

1. The ladder's pace: **playtested and signed off** (rank 1 falls to anyone, rank 10 needs
   parries). `rankParams()` stays as is.
2. The combo: **keep one five-cut chain**; no branching on a held tap or stick direction.
3. Other weapons, a choice of fighter, a second human on the phone: **none for now**.
4. The opponent's power attack: **keep the mirrored meter**, not a timer. Its row in
   Assumed is now decided.

## Backlog (the CD's answer on the look), specified for plan-gen

The CD, verbatim: "All three with selector in settings menu. Default to realistic webgl.
Its a lot so put items in backlog in a combat simulator section and i can run
"backlog-plan-gen" for them later."

**Planned 2026-11-01** as one six-step arc, CS-1 landing on its own at step 3:
`.claude/plans/DONE/csstyles.selector-toon-neon.md` (the design decided there: one program set
per style compiled under a `#define STYLE`, ink by inverted hulls that discard by normal
rather than cull, a per-vertex `aExt` on the arena, neon in display space with a
quarter-resolution bloom).

Shared rule for both items: **a style is paint.** `STYLE` is read only by the renderer
and the HUD; the engine block never sees it (the suite's DOM-free check already holds the
engine; add a check that a fixed-seed duel steps to byte-identical fighters under every
style). Fighters, arena and effects keep their geometry; only shaders, colours and
post-passes change. The HUD controls keep their layout in every style.

### CS-1 - a Graphics style selector, and the toon style

**Shipped 2026-11-02**, landed with step 3 of the csstyles arc (steps 1 and 2 were `ade4d81`
and `63d0c2e`). What was built, and the look choices made along the way, are in Graphics
styles above and the assumed rows. The spec below is kept as written. One thing differs: it
said each capsule is redrawn at r + 0.012 m; the ink's width is screen-constant (1.5 CSS px)
instead.

- **Selector**: a `Graphics style` select at the top of PICTURE in the settings,
  options `realistic` (default), `toon`; `neon` appears with CS-2. Saved in
  `SETTINGS.style`; an old save without it reads `realistic`. Switching takes effect on
  the next frame with no reload and no new duel.
- **Toon** (cel-shaded, ink outlines, a bright stylised courtyard):
  - lighting quantised to 3 bands (shadow, mid, lit) with a hard terminator, no
    specular except a single hard highlight on the blade, no sky reflection;
  - **ink outlines** on the fighters by an inverted-hull pass (each capsule redrawn
    back-faces only at r + 0.012 m, flat near-black), and on the arena by a depth/normal
    edge pass or by inverted hulls on the walls, torii, lanterns and trees;
  - saturated flat palette per material (keep each opponent's gi/hakama hue, push
    saturation), a two-colour gradient sky with flat cloud shapes, shadows as one flat
    darker band;
  - effects: blade trail as a solid white crescent, hit sparks as star bursts.
- **Checks**: the default is realistic with nothing stored; the dropdown offers exactly
  the shipped styles; the pick persists and applies live; the toon frame has fewer
  distinct luminance levels on a fighter than realistic (band count) and dark outline
  pixels around a fighter's silhouette; a style switch mid-duel leaves the duel state
  unchanged; each style renders every element at once (both fighters, a power ring, a
  trail, sparks) without a GL error.

### CS-2 - the neon style

**Shipped 2026-11-04**, landed by the csstyles run (its steps 4 to 6; steps 1 to 3 were
CS-1). What was built is in Graphics styles above (the Neon part) and its look choices are in
the assumed rows. The spec below is kept as written.

- Added to the selector as `neon`.
- The site's Neon Arcade palette (`--bg #06060e`, green `#39ff14`, red `#ff2244`,
  gold, blue) in 3D: a dark arena whose flagstone joints are glowing grid lines, walls and
  torii as emissive edge lines, no sun shadows (a faint ground glow under each fighter
  instead), fighters as dark bodies with glowing rims and edges (you green, the
  opponent red, the blade white-hot), stronger additive trails and sparks, a cheap bloom
  (downsampled blur of the emissive pass added back).
- **Checks**: as CS-1's, plus: the neon frame's mean luminance is low and its
  brightest pixels are in the palette hues; the player's rim reads green and the
  opponent's red.

## Backlog (parry timing and strike kinds), specified for plan-gen

The CD, 2026-11-03, verbatim: "fix the parry timing so that I (or enemy) can only parry
prior to the opponents Sword making contact and dealing damage. Currently, I can parry
successfully during a small time Window after opponent Sword makes contact and deals
damage. This needs to be implemented in a way that will work for future attacks i might
add that have different attack telegraph timing; for example, a quick strike or heavy
strike could be added to my current “normal” strike, where quick strike does lower
damage but has much shorter telegraph Window like a jab in boxing, and heavy strike deals
more damage, but has a longer telegraph window. For testing purposes it makes sense to go
ahead and add this (quick and heavy strike buttons) to the backlog either as a sibling
feature or together with the parry timing debug & fix item."

Taken as two siblings planned as one arc: CS-3 (the fix, and parry judged against each
attack's own timing) lands first; CS-4 (quick and heavy strikes) builds on it and is the
test of it. **Planned 2026-11-03:** `.claude/plans/DONE/csparry.parry-timing-strike-kinds.md` (implemented 2026-11-04)
(one attack table `ATTACKS` built from `RULES.chain` and `RULES.power`, the parry judged
against the attacker's row, CS-3 landing on its own at step 2).

### CS-3 - a parry only counts before the blade lands

**Shipped 2026-11-03** (commit `d81704a` on the arc branch `cs-parry`; the overseer lands it on
`main`; badge `build 2026-11-03 20:43 UTC`). The cause below was traced, and the fix is the rule
below: one attack table, the parry judged against it, a parry from a flinch dropped. What was
measured and decided while building it is under Assumed, not decided (parry rows), Tests and
"CS-3 as built" at the end of this section.

**Traced 2026-11-03** (engine lifted into node, the opponent chaining cuts at the player at
ranks 1, 5 and 10, the player pressing parry 0.03-0.25 s after the first cut's `hit`
event): the cut that dealt damage is never parried, since `tryHit()` resolves each swing
once (`a.resolved`). What the trace showed is that the parry still **succeeds, against the
next cut of the chain**, in every case but one (rank 10, pressed 0.25 s after the hit).
Three rules add up to it:
- a hit **flinches** the defender for 0.22 s (`RULES.flinch`), and a parry pressed then is
  not dropped but **buffered** for 0.22 s (`RULES.buffer`, `f.buf`), so it fires the
  moment the flinch ends, with nothing on screen to say so;
- a queued chain cut **skips its recovery**, so the next cut swings about 0.10 s after
  the last one's contact, and lands 0.25-0.37 s after it (0.25 at rank 10, 0.37 at
  rank 1);
- the parry's 0.24 s window (`RULES.parry.win`) opens when the parry starts, so a parry
  started at the end of the flinch covers that next contact.

So a parry pressed in answer to a cut that has already hurt you gets the "PARRY" and the
stagger, before the cut it caught has even started its wind-up. Inferred, not confirmed by
the CD: this is the "small window after contact" in the brief.

To check in the same step (not traced): `tryHit()` runs on the first in-reach tick of
the active window, at the start of the sweep pose, so damage may show before the blade
visibly reaches the body. If it does, a parry pressed as the blade *looks* about to land
is already late. Measure the blade-to-body distance at the `hit` event.

- **The rule** (both fighters): a parry turns a cut aside only if it was raised before
  that cut's contact and within `RULES.parry.win` of it. A parry pressed while flinching
  or staggered is **dropped**, never buffered. The buffer stays for attack, dodge and
  power.
- **Built for more attack kinds**: every attack's timing (telegraph, which is its wind-up,
  then active, then recovery), damage, reach, arc, whether it can be parried and whether
  it flinches come from **one attack table**, and the parry is judged against the
  attacker's own contact time. Adding an attack is then one row and adds no parry code.
  The AI's answer (`aiIntent()`, which reads a swing once when it starts) schedules
  against the same row's telegraph.
- **Checks**: the engine probe above as a suite row. Pressed during the flinch after a
  hit, no parry of any later cut. Pressed after the flinch and before the next cut's
  contact, still a parry. A swing that dealt damage is never parried. The same holds with
  the roles reversed (the opponent's parry). A parry is judged per attack row; the
  shipped chain's parries and its measured ladder win rates are unchanged except where
  they relied on the buffered parry (report any change rather than retune silently). Each
  rule gets a negative test.

#### CS-3 as built (2026-11-03)

Engine only (the `ENGINE` block): `ATTACKS`, `specOf()`, `startHit(..., kind)`, the parry test in
`tryHit()`, the drop in `stepFighter()`'s input loop, the clear on flinch and stagger, and the AI's
parry lead. The page gained one sentence in HOW TO FIGHT, under Parry: a parry pressed while you
reel from a hit does nothing.

**Blade at contact** (one-off measure, not a suite row; the opponent cutting the player from 1.2 m,
`__CS.draw()` on the tick the player's `hp` drops; distance from the opponent's blade segment to the
player's body axis, minus `RULES.body` 0.32 m; negative means the blade is already inside the body's
radius):

| cut | rank 1 | rank 10 |
|---|---|---|
| 1 kesa | -0.105 m | -0.113 m |
| 2 gyaku | 0.193 m | 0.170 m |
| 3 yoko | **0.255 m** | 0.226 m |
| 4 tsuki | -0.243 m | -0.241 m |
| 5 shomen | **0.290 m** | **0.327 m** |

**Follow-up for the CD:** three of the ten cuts (yoko at rank 1, shomen at both ranks) deal damage
while the blade is still more than 0.25 m from the body; shomen's tip is still overhead (y 2.34-2.38
m) when it does. Contact was **not moved**: it changes every timing the ladder was measured on, so
it is the CD's call. Inferred, not confirmed: a parry pressed as such a cut looks about to land is
already late, which the CD may feel as the same complaint. **Decided 2026-11-04 (backlog
refinement): land on the blade**, specified below as CS-5.

### CS-4 - quick and heavy strikes

**Shipped 2026-11-03** (csparry steps 3-5, commits `d2606b5` engine and `728de4b` page; the docs and break
run in step 5; badge in `DONE.md`). All three of the CD's answers below are built. What was built and the
numbers picked are the Assumed rows (strike kinds ... the help wording), Architecture (`ATTACKS`, `STRIKE`,
`F.krng`) and Tests. **Playtested and signed off by the CD 2026-11-04** (backlog refinement), with the
rank-10 kind shares left as built. The spec below is kept as written.

Two new attack buttons beside the normal attack, each a row in CS-3's table:
- **Quick strike**: a jab. Lower damage and a much shorter telegraph, so it is hard to
  parry on reaction.
- **Heavy strike**: more damage and a longer telegraph, so it is easy to read and parry.
- The normal strike, its five-cut chain and the power attack stay as they are.
- **The opponent throws them too**, so the parry can be tested against all three
  telegraphs from both sides.

**The CD's answers at plan time (2026-11-03):**

| Question | CD's answer (all three built) |
|---|---|
| Does the parry window stay 0.24 s for every kind, or scale with the telegraph? | **Scale with the telegraph**: each kind's window is a share of its wind-up. Planned as 0.24 s times the kind's wind-up factor: quick 0.12 s, heavy 0.40 s (0.48 capped so a parry always ends with 0.10 s open); the normal chain keeps 0.24 s at every rank. |
| Do quick and heavy break, continue or start the chain? | **Mix into the chain**: each counts as the chain's next cut and keeps the 3rd/5th-hit energy. |
| Who throws them? | **You and the opponent**: the opponent mixes them in by rank. |

Assumed in the plan (any can be overruled at plan review or after the playtest): quick 0.5x
wind-up, 0.8x recovery, 0.6x damage; heavy 2.0x, 1.3x, 1.6x; the opponent's quick share
rising from 5% at rank 1 to 30% at rank 10 and its heavy share falling from 25% to 15%; keys
U and O; the two buttons on an outer arc round attack at 3.4 R (quick at 22.5 deg, heavy at
67.5 deg), the four existing buttons unmoved; a short backswing for quick and a big one for
heavy, and a higher or lower swing tell.

- **Checks**: each kind's damage, telegraph and parry outcome off its table row; a quick
  strike parried only by a parry raised before its contact; a heavy strike's longer
  telegraph gives the opponent's mind time to answer at ranks where it cannot answer a
  quick one; the new buttons inside the viewport and overlapping nothing at every swept
  size; a style is still paint with the new swings on screen.

## Backlog (blade at contact), specified for plan-gen

The CD's call, 2026-11-04 (backlog refinement), on the csparry follow-up's one open decision: the
three cuts that deal damage with the blade still well clear of the body should **land on the
blade**, i.e. damage waits until the blade actually reaches the body. Queued in `TODO.md` § Next
(CS-2 has landed). Not yet planned: run `/zmh-producer:backlog-plan-gen` for it.

### CS-5 - a cut lands when the blade reaches the body

- **What is wrong, measured** (the "Blade at contact" table under "CS-3 as built"; the opponent
  cutting the player from 1.2 m): `tryHit()` resolves a swing on the **first tick of its active
  window** where the defender is within `reach + RULES.body` and inside the cut's arc. That tests
  the two fighters' distance and angle and never looks at the blade, so yoko at rank 1 (0.255 m),
  shomen at rank 1 (0.290 m) and shomen at rank 10 (0.327 m, the tip still overhead at y
  2.34-2.38 m) deal damage before the blade gets there.
- **The rule** (every row of `ATTACKS`: the five normal cuts, quick, heavy and power; both
  fighters): a swing resolves (dodge, parry or hit) on the first tick at which its blade has
  reached the defender's body, and not before. It still resolves once (`a.resolved`) and only
  inside its active window. A swing whose blade never reaches the body is a whiff, as now.
- **The design question for the plan** (the CD did not decide it): the engine is DOM-free and does
  not know where the blade is. Poses live on the page side (`poseOf()`, `rigFighter()`, after
  `/*ENGINE:END*/`). Two ways to resolve it, inferred and not chosen: **(a)** give each `ATTACKS`
  row a contact moment inside its active window, measured once from the rig and kept in the
  table, so the engine stays DOM-free and a new attack is still one row; or **(b)** move enough of
  the pose maths into the engine to test the blade segment against the body every tick. Lean
  (a), because it keeps the one-table rule CS-3 set up. Under (a) the contact moment also depends
  on range (the CS-3 measure is from 1.2 m only), so measure across the reach, not at one distance.
- **What follows contact and must move with it**: the parry is judged against the new contact
  moment (`parryWin` counts back from it; the CS-3 rule that a parry only counts before contact
  stands); the opponent's parry lead (`min(0.10, 0.8 * parryWin)` before contact) and the
  `counter` persona both read it. The swish still starts on the first active frame; whether it
  should move too is for the plan to check by ear, not assumed here.
- **The ladder**: moving contact later shifts timings the ladder's pace was signed off on
  (2026-11-03). Re-measure part 1's ladder line. If it moves, report the change rather than
  retune silently (the CS-3 rule); the plan says whether to restore it in `rankParams()`.
- **Checks**: the CS-3 one-off blade-at-contact measure becomes a suite row. For every `ATTACKS`
  row at ranks 1 and 10, the blade-to-body gap at the `hit` event is at or below a bound the plan
  sets from measurement (today's worst is 0.327 m). A parry raised before the new contact still
  turns the cut aside, and one raised after it does not. A style is still paint. Each rule gets a
  negative test.
- **Sequencing**: CS-2 has landed (2026-11-04), so the suite is 96 checks and the break lists are
  32 and 24: re-derive any count from those.

## Tests

`.claude/tests/drive-combat-simulator.cjs`, 96 checks (44 in part 1, 52 in part 2). It runs on a Windows box too, given `SMOKE_CHROMIUM` (a Chromium executable) and a `NODE_PATH` holding `playwright-core`. Part 1 (node, the engine): the
chain cycles 1-5-1, a pause ends it, a whiff breaks the energy count, a full chain pays
exactly +2; a timed parry staggers with no damage and pays +1, an early parry fails; +10%
on a staggered target exactly, a staggered fighter cannot parry or dodge, five cuts fit in
one stagger; a timed dodge slips the cut and pays +1, an early one does not; no power at
9, power costs 10, 20 throws two back to back, the cap is 20; power cannot be parried,
can be dodged, and its wind-up does not flinch; the opponent spends its meter; a knockout
ends the duel; the ladder claims above. **Seven rows since CS-3** ("a parry only counts before the blade lands"):
a parry pressed while reeling from a hit does nothing (ranks 1, 5, 10; 0.03-0.21 s after the hit);
a parry on the first free tick after the flinch turns the next chained cut aside; a parry held in the
buffer is cleared by the hit that flinches it (also with `RULES.buffer` raised to 0.6 s, since today's
buffer always times out first); the same two for the opponent; every parryable row of `ATTACKS` is
judged by its own window (`parryWin` minus 2 ticks turns it, plus 2 does not; iterates the table, so a
new row joins unedited); no swing both hurts and is parried or lands twice (AI v counter, ranks 1, 5,
10, four seeds); and the normal rows equal a literal copy of the old chain with `parryWin` 0.24, the
power row not parryable. **Five rows since CS-4 step 3** ("quick and heavy strikes", part 1): the quick and heavy rows
are the chain with `wind`, `rec` and `dmg` x0.5/0.8/0.6 and x2.0/1.3/1.6 and parryable for 0.12 s
and 0.40 s; `atk`, `quick` and `heavy` each start a cut whose `swing` carries its kind, quick
dealing 0.6x and heavy 1.6x on the same cut; the kinds mix into one chain (`atk, quick, heavy,
atk, quick` are cuts 1-5 and the combo pays at 3 and 5); the opponent throws all three (rank 5; quick
more at rank 10 than rank 1, heavy more at rank 1 than rank 10; seeds `s * 104729 + rank`, both hp
1e6 so every duel runs 60 s); and the opponent parries more of 40 heavies than of 40 quicks at rank 5
(seeds `7000 + s`, a trial ends at the first hit, parry, dodge or whiff). The parry-window row
(row 5 above) was restated to cover 15 rows (normal, quick, heavy x the five cuts) and the `counter`
persona restated to read the row. Part 2 (Chromium, SwiftShader): boot and badge,
the intro (stepped, not waited for), real multi-touch over CDP (stick held while a second
thumb cuts; dodge, parry, power buttons), the power ring filling, closing at 10 (the ten
gaps between its segments turn gold), the second ring past 10 and the flash, the
controls' layout at seven sizes (since CS-4, six buttons: atk, dodge, parry, power, quick, heavy),
**three rows since CS-4 step 4** (a touch on the quick button and on the heavy button each starts a cut of that
kind; `KeyU` and `KeyO` do the same; half way through the wind-up the hand key's distance from `POSE.guard` is
smallest for quick, then normal, then heavy, on all five cuts), the settings pausing the duel (waits on frames), victory
-> next rank saved, defeat -> retry, light by rank, the FPS counter on/off, no errors.
**Twenty of the 96 are the style rows** (one in part 1; thirteen from CS-1, three from the neon look and four from the bloom): the engine text never mentions a
style; with nothing stored the style and the select read realistic; the select offers exactly
realistic, toon and neon in that order; choosing toon through the select sets, saves and changes the
next draw by more than 2,000 px with the same `F` and the same `F.t`; the pick survives a
reload; a stored object with no style, or with `chalk`, loads realistic; **a skin is paint**
(1,200 ticks of 1/120 with a cut every 30 and a `draw()` every 4, snapshots byte-identical
across styles) and **a switch mid-duel changes nothing** (at tick 600); **toon is banded**
(at most half of realistic's luminance levels on the opponent's torso); **toon inks round a
fighter** (near-black rises by at least 300 and stays under 25% of the torso box), **round the
courtyard** (rises by at least 1,500 outside both fighters) and **realistic is untouched by the
ink** (frames byte-identical with `FX.ink` on and off); and every element at once (power ring,
trail, 40 sparks) draws in each style with no GL error and a real picture. **Neon (3 rows, CS-2):**
it is dark and its light is the palette (mean luminance under 0.12, and at least 96% of the
brightest 2% within 25 degrees of the green, red, blue, purple or gold hue or near-white, both
read with the bloom off; the shipped frame, bloom on, under the same mean ceiling); you are green
and they are red (the brightest tenth of each fighter's own pixels, found with `FX.only`, over 1.5x
both other channels, with the bloom off and on); and it draws no shadow pass (the draws made while
the shadow target is bound: 2 in realistic and toon, 0 in neon). **The bloom (4 rows, CS-2):** it
adds a halo (summed luminance up 5%, and mid-bright pixels in a 6 px ring round the brightest 2%
up by half); realistic and toon frames are byte-identical with `FX.bloom` on and off; the target
follows the screen (211 x 98, 98 x 211, 211 x 98 through 844x390 -> 390x844 -> back, no GL error);
and the GL state after a neon `draw()` is the same with the bloom on as off, with realistic after
neon matching realistic after realistic.

**Negative controls** (`negtest-copies.py`, `CS_PAGE` env var points the suite at a
copy). Two lists. **`.claude/tests/negtests/combat-simulator-styles.json`** (24 breaks, all
caught by their own rows, none by a crash): `style-engine`, `style-render-writes-fighter`,
`style-default-toon`, `style-option-missing`, `style-not-saved`, `style-needs-reload`,
`style-junk-kept`, `style-toon-unbanded`, `style-switch-new-duel`, then the ink's
`ink-off-fighters`, `ink-off-arena`, `ink-in-realistic`, `ink-ext-zero` and
`ink-cull-not-discard`, then neon's `neon-tonemapped`, `neon-rims-same`, `neon-bright-arena`,
`neon-option-missing` and `neon-shadows-on`, then the bloom's `bloom-off`, `bloom-everywhere`,
`bloom-no-resize`, `bloom-depth-on` and `bloom-state-leak`. Three lessons: a rise-only ink check passes the culled hull that paints
the fighter black, so it also caps the fill; and a break that reads a copy of the style taken
on the first frame (`style-needs-reload`) is the only way to prove "applies live"; and a state leak the next frame resets before it draws (`bloom-state-leak`) can only be seen by reading the state. The list
for the game itself is `.claude/tests/negtests/combat-simulator.json`: 32 breaks (all 32 run and caught at CS-4 step 5, 2026-11-03), every one caught by its own check: stagger bonus 1.0, no i-frames,
power parryable (re-pointed in CS-3 to the `ATTACKS.power` row), combo pays at 3 only, power at 9, no cap, a chain of three, a staggered
fighter that can act, a 1.2 s stagger, no armour, parry/dodge paying nothing, a ring that
never closes, a ring that does not flash, a menu that does not pause, crowded buttons, a
ladder that does not advance, an opponent slower at the top, a second thumb ignored while
the stick is held, and the five CS-3 breaks: `parry-buffered-through-flinch` (rows 1 and 4), `flinch-keeps-buffered-parry` (row 3), `drop-only-player` (row 4), `parry-window-wide` (row 7 only: row 5 judges a row by its own `parryWin`, so widening it moves both; it is the row that will catch a window shared by every kind) and `swing-resolves-twice` (row 6), then the four CS-4 engine breaks `parry-window-global` (`tryHit()` reads the shared window again: row 5 on the quick rows), `quick-not-quick` (rows 1 and 2), `kinds-break-chain` (row 3) and `ai-never-quick` (row 4), and the four CS-4 page breaks `quick-button-missing` (the touch row, and a crash in `drawHUD`), `keys-no-heavy` (the key row), `heavy-overlaps-power` (heavy at 45 deg: the layout row and the power ring row) and `kind-pose-ignored` (the pose row); `chain-of-three` was re-pointed in step 3 to the line that now passes `f.queued`. Three of them first "passed" for the wrong reason and were fixed in
the suite: the ring check counted gold that the lit icon supplied (it now samples the
gaps between segments); the pause and FPS checks read stale frames because SwiftShader
under parallel load draws a frame every few hundred ms (they now wait on `APP.frames` or
draw the HUD synchronously through `__CS.hud()`).

## How to add

- **A cut**: a row in `RULES.chain` (timings, reach, arc, lunge) and a matching
  `POSE.cuts` entry (wind, sweep keys, follow). Keep consecutive sweep keys under 90
  degrees apart: directions are lerped and normalised.
- **An attack kind** (a quick or heavy strike, a feint...): one `RULES.kinds` entry
  (`wind`, `rec`, `dmg` factors; the loop after `RULES` builds its five `ATTACKS` rows with the
  parry window `min(0.24 * wind, 0.40)`), an action in `ACTIONS` and `STRIKE`, a button in
  `layout()` and `drawHUD()`, a key in `KEYMAP` and `playerIntent()`, an icon in `icon()`, a
  backswing in `poseOf()` and a tell in `SND.tell()`; the opponent's share is a `rankParams()`
  field read by `aiStrike()`. The parry code, the queue and the AI's answer need nothing, and the
  suite's window row iterates the table so the new rows join it unedited. **Layout limit: the
  six-button cluster has no room for a seventh at 360 x 640 without a new layout** (3.4 R was the
  tightest arc that cleared the power ring at all seven sizes).
- **An opponent**: a row in `LADDER` (name, title, colours); tuning stays in
  `rankParams()`.
- **A move**: a state in `stepFighter`, its buffer rules in `begin()`, its pose in
  `poseOf()`, and if it touches a blade, its branch in `tryHit()`.
