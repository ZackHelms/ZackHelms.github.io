# Combat Simulator (`games/combat-simulator/`)

A third-person katana duel in WebGL2: you against one AI swordsman at a time, up a
ladder of ten named masters, in a walled stone courtyard whose light runs from
mid-morning at rank 1 to a lantern-lit dusk at rank 10. CD commission, 2026-11-01,
placed on the hub straight after Driving Simulator. Open licence (MIT, the default).
One self-contained file (~1,800 lines). Suite: `.claude/tests/drive-combat-simulator.cjs`
(61 checks, 19 negative controls all caught).

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
| The opponent's power attack | It fills the **same meter by the same rules** (its parries, its slipped dodges, its 3rd/5th landed cuts) and spends 10 on a telegraphed spin: a red ring on the ground and a glowing blade through a long wind-up | Offered as the recommended option; the CD answered the other half of that question only |
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
  place a blade meets a body**: in reach and arc, then dodge (i-frames), parry (window,
  not a power attack), else hit (+10% on a staggered target, flinch unless staggered or
  armoured, the combo count, the knockout).
- **Input is buffered** (`buf`, 0.22 s): a press made while busy fires when the fighter
  can act. A tap during a cut's second half of wind-up or later **queues** the next cut;
  a tap within `RULES.grace` after a cut's recovery still continues the chain.
- **The opponent** (`aiIntent`) reads each of your swings **once, when it starts**, and
  decides then to parry or dodge it, answering no sooner than its `react` time; so a slow
  mind cannot parry your fast first cut and a fast one can. It punishes your stagger with
  a full chain, throws a power attack when it has 10, otherwise circles at 2.5-3.3 m and
  steps in for chains of up to its rank's `maxChain`.
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
  trails, ground rings and sparks. About 12 draw calls a frame.
- **HUD** is a 2D canvas over the GL one: the bars and energy ticks, the four buttons
  and their icons, the power ring (inner ring 0-10, closes and flashes at 10; outer ring
  10-20), the floating numbers, the combo count, banners. `LAY` holds the layout.
- **Sound** (`SND`): WebAudio only; three buses (music, ambient, sfx) under a master,
  a slider each. Karplus-Strong koto baked per pitch. The opponent's wind-up has a quiet
  scrape (`tell`) and every cut's swish starts on its first active frame: both are
  timing cues for parrying.
- **Test hook** `window.__CS`: `setPaused`, `tick(dt, n)`, `press(k)`, `stick(x, y)`,
  `startDuel(rank, seed)`, `hud()` (draw the HUD now), `F`, `LAY`, `SKY`, `APP` (with a
  `frames` counter: wait on frames, never wall time, under SwiftShader).

## The ladder, measured

`rankParams(rank)` interpolates rank 1 to 10: opponent HP 80-150, damage x0.7-1.15,
wind-up x1.9-1.05, reaction 0.40-0.09 s, parry chance 8-55%, longest chain 2-5. Two
scripted players over 16-20 seeds a rank (`.claude/tests/drive-combat-simulator.cjs`
part 1, and the scratch sim this was tuned with):

| Player | Rank 1 | 3 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|
| Masher (walk in, tap attack every frame) | 100% | 80% | 65% | 20% | 5% | 0% | 0% | 0% |
| Counter (parries every cut 0.13 s before it lands, dodges power, punishes the stagger) | 100% | 100% | 100% | 100% | 100% | 100% | 85% | 60-95% (ends on half health) |

So mashing gets you through the first few, parrying is the skill the ladder teaches, and
the last two cost even a frame-perfect parrier.

## Open questions for the CD

1. Does the ladder's pace feel right? Rank 1 should fall to anyone; rank 10 should need
   parries. All of it is `rankParams()`.
2. Should the combo branch (a held tap, a stick direction) or stay one chain?
3. Other weapons or a choice of fighter? A second human on the same phone?
4. Is the opponent's mirrored power attack right, or should it be on a timer?

## Backlog (the CD's answer on the look), specified for plan-gen

The CD, verbatim: "All three with selector in settings menu. Default to realistic webgl.
Its a lot so put items in backlog in a combat simulator section and i can run
"backlog-plan-gen" for them later."

Shared rule for both items: **a style is paint.** `STYLE` is read only by the renderer
and the HUD; the engine block never sees it (the suite's DOM-free check already holds the
engine; add a check that a fixed-seed duel steps to byte-identical fighters under every
style). Fighters, arena and effects keep their geometry; only shaders, colours and
post-passes change. The HUD controls keep their layout in every style.

### CS-1 - a Graphics style selector, and the toon style

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

## Tests

`.claude/tests/drive-combat-simulator.cjs`, 61 checks. Part 1 (node, the engine): the
chain cycles 1-5-1, a pause ends it, a whiff breaks the energy count, a full chain pays
exactly +2; a timed parry staggers with no damage and pays +1, an early parry fails; +10%
on a staggered target exactly, a staggered fighter cannot parry or dodge, five cuts fit in
one stagger; a timed dodge slips the cut and pays +1, an early one does not; no power at
9, power costs 10, 20 throws two back to back, the cap is 20; power cannot be parried,
can be dodged, and its wind-up does not flinch; the opponent spends its meter; a knockout
ends the duel; the ladder claims above. Part 2 (Chromium, SwiftShader): boot and badge,
the intro (stepped, not waited for), real multi-touch over CDP (stick held while a second
thumb cuts; dodge, parry, power buttons), the power ring filling, closing at 10 (the ten
gaps between its segments turn gold), the second ring past 10 and the flash, the
controls' layout at seven sizes, the settings pausing the duel (waits on frames), victory
-> next rank saved, defeat -> retry, light by rank, the FPS counter on/off, no errors.

**Negative controls** (`negtest-copies.py`, `CS_PAGE` env var points the suite at a
copy): 19 breaks, every one caught by its own check: stagger bonus 1.0, no i-frames,
power parryable, combo pays at 3 only, power at 9, no cap, a chain of three, a staggered
fighter that can act, a 1.2 s stagger, no armour, parry/dodge paying nothing, a ring that
never closes, a ring that does not flash, a menu that does not pause, crowded buttons, a
ladder that does not advance, an opponent slower at the top, a second thumb ignored while
the stick is held. Three of them first "passed" for the wrong reason and were fixed in
the suite: the ring check counted gold that the lit icon supplied (it now samples the
gaps between segments); the pause and FPS checks read stale frames because SwiftShader
under parallel load draws a frame every few hundred ms (they now wait on `APP.frames` or
draw the HUD synchronously through `__CS.hud()`).

## How to add

- **A cut**: a row in `RULES.chain` (timings, reach, arc, lunge) and a matching
  `POSE.cuts` entry (wind, sweep keys, follow). Keep consecutive sweep keys under 90
  degrees apart: directions are lerped and normalised.
- **An opponent**: a row in `LADDER` (name, title, colours); tuning stays in
  `rankParams()`.
- **A move**: a state in `stepFighter`, its buffer rules in `begin()`, its pose in
  `poseOf()`, and if it touches a blade, its branch in `tryHit()`.
