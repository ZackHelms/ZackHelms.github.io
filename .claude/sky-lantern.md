# Sky Lantern — architecture notes

`games/sky-lantern/index.html` (~830 lines). Breath-powered festival lantern
ascent. **The repo's first microphone game.**

## The idea

You blow into the phone to fire the burner of a paper sky lantern and climb a
night sky to the wish line. The lantern is slow to heat and slow to cool, so
the skill is *anticipation*, not reaction — you breathe before you need lift
and coast on stored heat. A thumb drag steers laterally.

## Input

Two modes, toggled by the `#mode-btn` chip in the top-left row (🎙 BREATH /
✋ HOLD), auto-selected at start:

- **mic** — `getUserMedia({audio})` → `AnalyserNode` (fftSize 1024) → per-frame
  RMS. `breathFromRms(rms, floor, sens)` is a **pure function** (drive-tested
  directly) mapping RMS above a noise floor onto 0..1. `micFloor` tracks the
  room: it falls fast toward quiet (k 0.5) and rises very slowly (k 0.02), so a
  sustained blow can't drag the floor up under itself. Three sensitivity
  presets (`SENS_SPAN`), persisted as `sky-lantern-sens`.
  The analyser is **never connected to `destination`** — that would feed back.
- **hold** — touch-and-hold anywhere burns at full. Automatic fallback when the
  mic is denied or absent (`micDenied` surfaces in the menu note).

Steering is a relative drag (house pattern): finger offset from touchdown
÷ `DRAG_SENS` → `steer` in −1..1. In mic mode the thumb *only* steers.

Humming or speaking works as well as blowing — same broadband energy — which
doubles as an accessibility path.

## Flight model

```
heat  += (breath - heat) * HEAT_RESP * dt        // balloon lag, tau ~0.29 s
fuel  -= (3.6*heat + 4.8*heat^3) * dt            // superlinear: max blast is not free
vy    += (LIFT*heat - GRAV) * dt ; vy -= vy*V_DAMP*dt
vx    += (STEER_ACC*steer + windAt(y)) * dt ; vx -= vx*H_DAMP*dt
```

`LIFT` 132, `GRAV` 46, `V_DAMP` 1.55 → hover at heat ≈ 0.35, terminal climb
≈ 55 u/s. World is 100 units wide; altitude uses the same units.

Fail states: 3 tears (`BURNED THROUGH`), or sinking `SINK_LIMIT` (250 u) below
your best altitude (`LOST THE SKY` — this is what running dry eventually
costs you). Tears give 1.6 s of i-frames so a hazard cluster can't chain.

## Level generation + the three fairness gates

`genLevel(L)` is seeded per level (`mulberry32(L.seed)`) — same ascent every
time, so par times mean something. Hazards: bamboo `pole` (one side, or a pair
with a guaranteed 30–42 u corridor), temple `roof` block, drifting `kite` on a
string, `bird` flocks. Plus `gust` bands that push laterally.

Three properties the drive proves, all in `templates`-free plain physics:

1. **Corridors exist** — `staticGapAt()` walked at 2 u steps over every level;
   min gap 30–40 u against a 10 u lantern.
2. **Corridors are reachable** — `enforceReach()` runs *inside the generator*.
   It solves the same lateral equation of motion `update()` uses
   (`lateralReach(t)`, closed form for `v' = STEER_ACC - H_DAMP·v`) and pushes
   consecutive wall rows apart until the widest move their corridors demand is
   ≤ `REACH_BUDGET` (0.55) of what is physically coverable at top climb speed.
   **This exists because the drive caught THE STARFALL asking for 92% of the
   available lateral travel** — a corridor you could technically reach with a
   frame-perfect input and no room for error.
3. **Movers never seal the sky** — altitude × time sweep including kite/bird
   positions; the tightest instantaneous gap across all six ascents is 13.9 u.

Embers ride **their own altitude ladder**, not one-per-hazard-row. Tying them
to rows starved the low-density ascents (the autopilot ran dry at 99% of THE
FLYWAY) because fewer hazards meant fewer refuels over a longer climb. Each
ember is nudged out of any solid it lands in.

## Rendering

Altitude-graded night sky (indigo → black), parallax stars, moon with parallax,
radial-gradient cloud puffs, drifting background lanterns, a silhouetted
festival town with lit windows at altitude 0, and the wish-line aurora band.
The lantern is a translucent paper dome lit from inside with a heat-scaled
flame, bamboo mouth ring, scorch marks per tear, and a tassel that trails with
lateral velocity.

Cloud puffs use **radial** gradients — a linear one leaves hard left/right
edges and the band reads as a grey slab.

## Persistence

`skyLantern` → `{u: unlocked count, t: {lvl: bestTime}, s: {lvl: stars}}`.
`sky-lantern-mute`, `sky-lantern-sens`.

## Gotchas for future work

- `applyMute()` sets the button icon **before** the `if(!AC) return` guard. On
  reload the muted flag is restored from localStorage long before any
  AudioContext exists; guarding first leaves a muted game showing 🔊.
  (Most other games in this repo still have that ordering — see the note in
  `.claude/notes/`.)
- The win overlay captures every value it needs at schedule time; the level
  dropdown can move `lvlIdx` during the 1.5 s animation.
- `winLevel()` / `killLantern()` are state-guarded — both are reachable twice
  in one frame.
- The burner rumble is a looping noise source created in `audioInit`, gated by
  `heat`. Shared `noiseBuf` is made there too, never lazily.
