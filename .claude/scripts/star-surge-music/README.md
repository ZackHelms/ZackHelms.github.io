# star-surge-music — soundtrack authoring tool

Offline generator for Star Surge's 20-track soundtrack (`MUSIC_TRACKS` in
`games/star-surge/index.html`). Not shipped to the browser — this is a
Node authoring tool, run once per refinement pass, whose output gets
hand-embedded into the game file.

- `compiler.js` — the webaudio-score/v1 compiler (score → flat time-sorted
  note events) plus `validateScore()`. Kept byte-for-byte in sync with the
  copy embedded in `games/star-surge/index.html`'s MUSIC ENGINE section —
  when one changes, copy the change to the other by hand.
- `gen.cjs` — procedural drum-grid + scale-walk track builder. Defines all
  20 tracks (menu/calm/combat/boss tiers), validates every one against
  `compileScore`, and writes `tracks.json`.

Format and instrument recipes: zmhstudio's `zmh-synth` `score-authoring`
skill (`plugins/zmh-synth/skills/score-authoring/SKILL.md`) — genre grids,
BPM ranges, drum/melodic pattern grammar, per-instrument synthesis
starting points. Read that before changing a track's genre/instrumentation
here so a "refine track N" request stays consistent with the rest of the
album.

## Regenerating a track

1. Edit the relevant block in `gen.cjs` (root/scale/BPM/instrument choices,
   or the shared drum-pattern helpers used across a genre family).
2. `node gen.cjs` — fails loudly (via `validateScore`) on any malformed
   pattern before writing `tracks.json`.
3. Copy the regenerated track's JSON object (one per line in `tracks.json`)
   into the matching entry of `MUSIC_TRACKS` in
   `games/star-surge/index.html`, keeping the same `id` (the selection
   director's `CALM_TRACK_IDS`/`COMBAT_TRACK_IDS`/`BOSS_TRACK_IDS`/
   `MENU_TRACK_ID` tables reference tracks by id).
4. Re-run the mobile smoke gate on the game page before committing.

`tracks.json` is a build artifact — don't commit it; the game file is the
source of truth once a track has been embedded.
