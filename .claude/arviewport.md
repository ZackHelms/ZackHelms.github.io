# ARViewport (`experiments/rain-on-glass/index.html`, ~1400 lines)

Orientation-tracked "pane of glass into another reality": 4 scenes × 3 times
of day × 6 weathers × beings, with a physically-motivated dirty-glass layer
you wipe with a finger. Read `.claude/experiments.md` first.

## One matrix drives everything

`orientMatrix()` builds `R = RZ(α)·RX(β)·RY(γ)·RZ(screenAngle)` from
`deviceorientation` (virtual α/β from drag when no sensor). It is low-pass
smoothed + Gram-Schmidt re-orthonormalized per frame (`Rsm`), then:
- per-pixel **view rays**: `uOrient * (ndc·tanFov, −1)` in the shader;
- **gravity** for the droplet sim: screen-frame g = −(row 3 of Rsm), so what
  you see and how drops run can never disagree. A near-horizontal pane
  (|g.z| high, either sign) = splatter mode.
Keep both consumers reading `Rsm`; a second orientation source will
desynchronize view and physics.

World frame: X east, Y north, Z up. View azimuth = −α. iOS α is relative to
page-load heading, not north (in the ⓘ limitations).

## The world = pano band + procedural zones + overlays

- **Band**: `paintPano(ctx, w, h, scene, time)` paints a 2048×896 equirect
  band covering elevations −28.6°…+60.2° (`EL0=−0.5, EL1=1.05` rad). Az↔u
  has **no offset** (`u = atan(x,y)/2π`, canvas x = az/360·w — an early +0.5
  mismatch faced the camera at the wrong district). Content draws 3× (x,
  x±w) for the wrap seam; the seam azimuth (0°) is kept low-contrast so the
  blurred variants don't show it. Scenes: `city`, `prairie`, `desert`,
  `harbor`; `TIME_PAL` (day/dusk/night) supplies sky stops, silhouette
  colors, `lightF` (windows/lamps/neon scale), band-star alpha.
- **Blur variants**: `blurInto` box-blurs by progressive down- AND
  up-scaling through intermediate sizes (direct small→big stretch makes
  glowing blobs square). Sharp/light/heavy = lens/wiped/fogged samples.
- **Procedural zones** (shader): above the band — `skyHigh` (night↔day mix by
  `uDayMix`), octahedral-mapped hash stars (× `uStarGain`; **3×3 neighbor
  cell loop is mandatory** — single-cell gaussians truncate at cell borders
  into visible squares), analytic moon (night) / sun (day); below —
  `groundCol` day/night mix. Band edges cross-fade into these zones.
- **Weather** (`uWeather`): dust/fog = elevation-graded color mixes; snow /
  embers = `flakes()` hash fields in az/el space falling (or rising, near
  `uFireAz`) in world coordinates; wildfire adds a flickering horizon glow +
  smoke pall. Weather also picks the audio bed; embers add crackle pops.
- **Beings** (`uRoam`): a 1024×448 overlay canvas with the *same band
  mapping*, redrawn every other frame with painted silhouettes (people,
  deer, birds, monster with glowing eyes + stop-and-stare state, dragon with
  fire breath). Because it shares the mapping, beings hold compass positions
  and blur with the glass levels for free.

## The glass has three state maps (all sim-resolution canvases)

1. **Height field** (`dropC`): droplet blobs, rain only. Sim details
   (stick-slip stiction, runner budget, coalescence, trail beads, splats)
   are from the original build; drops dry (`r *= 1−dt·0.045`) when weather
   isn't rain.
2. **Wet/condensation map** (`wetC`) — **inverted semantics: white = clean.**
   Initialized white ("freshly wiped"); `destination-out` fade re-fogs it at
   a weather+time rate (fog 0.055 … clear 0.017, ×1.25 night / ×0.7 day),
   so steam builds until wiped. Runner tracks also paint white. Shader:
   `base = mix(fogged, wiped, wet)` where wiped blends 55% toward the
   *sharp* pano — clean glass must look nearly transparent or wiping feels
   pointless (shipped too-subtle once).
3. **Grime map** (`grimeC`): colored speckles by weather (dust brown, frost
   white — edge/bottom-biased, ash gray) + a slow ambient dust rate even in
   fair weather; rain washes it (`destination-out` trickle). Rendered as a
   straight color mix over the base.

**Wipe**: pressed finger stamps along the stroke (segment-subdivided so fast
swipes leave continuous tracks) → white into `wetC`, `destination-out` into
`grimeC`, deletes drops in radius. On sensor devices any touch wipes (view
is head-driven); desktop toggles wipe vs look-drag via the 🧹 button. A
no-wipe-for-90 s hint nudges the user.

## Gotchas that cost time

- Texture units: 0 height, 1 wet, 2–4 pano sharp/blur/fog, 5 roam, 6 grime.
  Uploads are throttled (wet every 2nd frame, grime every 4th, roam every
  2nd).
- Scene/time changes repaint + re-blur + re-upload the pano
  (`rebuildWorld()`, ~150 ms hitch — accepted, in ⓘ).
- Weather/scene/time/beings persist in localStorage under `arv-*` keys.
- GLSL: a `vec4 gr` collided with the existing grain float `gr` — the FS is
  long; grep before adding globals.
