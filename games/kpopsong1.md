# KPOP SONG 1 — Tap Template Reference

**File:** `games/kpopsong1.mp3`  
**BPM:** 150  
**Time Signature:** 4/4  
**Bar duration:** 1.6s  |  **Quarter note:** 0.4s  |  **8th note:** 0.2s  |  **16th note:** 0.1s

---

## Song Structure

| Section    | Time (s)       | Bars  | Description |
|------------|----------------|-------|-------------|
| Intro      | 0.0 – 3.2      | 1–2   | Menacing industrial synth bass riff + group vocal shout on each bar downbeat |
| Verse      | 3.2 – 12.8     | 3–8   | Rapid-fire 16th-note hi-hats, tight punchy electronic kick, sharp syncopated vocals |
| Pre-Chorus | 12.8 – 16.0    | 9–10  | Drums drop out; rising synth swell + sharp vocal ad-libs; maximum tension build |
| Chorus     | 16.0 – 25.6    | 11–16 | Massive wall of sound; side-chained supersaw chords; heavy driving beat; layered group harmonies |

**Main downbeats (bar 1 of each bar, every 1.6s):**
`0.0, 1.6, 3.2, 4.8, 6.4, 8.0, 9.6, 11.2, 12.8, 14.4, 16.0, 17.6, 19.2, 20.8, 22.4, 24.0`

---

## Tap Track Design Rules

| Difficulty | Intro          | Verse                              | Pre-Chorus     | Chorus                          |
|------------|----------------|------------------------------------|----------------|---------------------------------|
| **Easy**   | Half notes (0.8s) | Half notes (0.8s)               | 2 sparse hits  | Quarter notes (0.4s)            |
| **Medium** | Quarter notes  | Quarter notes + 8th syncopation    | Quarter notes  | 8th notes + 2-lane on downbeats |
| **Hard**   | 8th notes      | 16th-note burst (4) + 8th fill     | 8th notes      | 8th notes + 16th pairs + 2-lane |

- **2-lane** entries `[time, [lane1, lane2]]` = two simultaneous tiles the player must tap at once
- Lanes are numbered 0–3 (left to right)
- Easy: single taps only
- Medium: one 2-lane per bar in chorus
- Hard: 2-lane on every bar downbeat in chorus + dense fills

---

## Tap Track Summary (approximate tap counts per difficulty)

| Difficulty | Intro | Verse | Pre-Chorus | Chorus | **Total** |
|------------|-------|-------|------------|--------|-----------|
| Easy       | 4     | 12    | 2          | 24     | **~42**   |
| Medium     | 8     | 24    | 8          | ~52†   | **~92**   |
| Hard       | 16    | 72    | 16         | ~80†   | **~184**  |

† Medium/Hard counts include the extra tiles created by 2-lane entries (each `[lane1,lane2]` spawns 2 tiles).

---

## Fine-Tuning Notes

- **If Easy feels too fast in chorus:** Change quarter notes (0.4s) to half notes (0.8s) — edit the `easy` array in `KPOPSONG1` inside `piano-tiles.html`.
- **If Medium verse syncopation is off:** The syncopated 8th note is always 0.2s after the preceding quarter note hit. Adjust those `+0.2` entries to match the actual audio accents.
- **If Hard verse is too dense:** Replace the 16th-note bursts `[t, t+0.1, t+0.2, t+0.3]` with 8th-note pairs `[t, t+0.2]` at the burst start.
- **Pre-Chorus (12.8–16.0s)** is intentionally sparse in all difficulties to mirror the real drop in the audio.
- **Song ends** at ~25.6s (16 bars); `songEndTime` is set to `lastTile.audioTime + 2.5s` so the game ends cleanly after the last note.
