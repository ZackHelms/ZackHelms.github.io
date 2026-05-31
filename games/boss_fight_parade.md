# BOSS FIGHT PARADE — Tap Template Reference

**File:** `games/boss_fight_parade.mp3`  
**BPM:** 110  
**Time Signature:** 4/4  
**Bar duration:** 2.18s  |  **Quarter note:** 0.545s  |  **8th note:** 0.273s  |  **16th note:** 0.136s

---

## Song Structure

| Section         | Time (s)      | Approx. Bars | Description |
|-----------------|---------------|--------------|-------------|
| Intro / Drop    | 0.0 – 2.0     | ~1 bar       | Full energy from beat 1; stuttering synth lead, punchy kick, arcade-style vocal chops set the main theme |
| Main Section    | 2.0 – 11.0    | 4 bars       | Driving chiptune lead, syncopated over steady bassline and a classic 8-bit drum pattern |
| Melodic Variation | 11.0 – 20.0 | 4 bars       | Melody climbs higher; vocal textures become more rhythmic, building intensity |
| Peak Energy     | 20.0 – 28.0   | ~4 bars      | Densest mix; rapid-fire arpeggios underneath main melody; frantic high-score arcade finish |
| Tail            | 28.0 – 30.0   | —            | Beat cuts; synth delay echo fades — **no tap tiles** |

**Main downbeats (bar 1 of each bar at 110 BPM):**  
`0.00, 2.18, 4.36, 6.55, 8.73, 10.91, 13.09, 15.27, 17.45, 19.64, 21.82, 24.00, 26.18`

---

## Tap Track Design Rules

| Difficulty | Intro       | Main Section                         | Variation                         | Peak                                    |
|------------|-------------|--------------------------------------|-----------------------------------|-----------------------------------------|
| **Easy**   | Quarter notes (0.545s) | Half notes (1.09s)    | Half notes (1.09s)                | Quarter notes (0.545s)                  |
| **Medium** | 8th notes   | Quarter + syncopated 8ths            | Quarter + 8ths, building density  | 8th notes + 2-lane on bar downbeats     |
| **Hard**   | 8th notes   | 16th burst (4 notes) + 8th fill      | 8th notes (full density)          | Rapid 16th arpeggios + heavy 2-lane     |

- **2-lane** entries `[time, [lane1, lane2]]` = two simultaneous tiles  
- Easy: single taps only  
- Medium: 2-lane only in peak section (one per bar)  
- Hard: 2-lane every ~0.6–0.7s in peak section, plus 16th-note runs  

---

## Tap Track Summary (approximate tap counts)

| Difficulty | Intro | Main | Variation | Peak | **Total** |
|------------|-------|------|-----------|------|-----------|
| Easy       | 4     | 8    | 8         | 15   | **~35**   |
| Medium     | 8     | 24   | 24        | ~32† | **~88**   |
| Hard       | 8     | 40   | 32        | ~58† | **~138**  |

† Medium/Hard counts include extra tiles from 2-lane entries.

---

## Structural Notes

- **Intro/Drop is only ~2 seconds** — tile density must be low even in hard or they'll all spawn at once. The 8-note hard intro uses 8th-note spacing (0.27s), which is manageable.
- **Peak (20–28s) carries the difficulty spike** — this is where the "rapid-fire arpeggios" translate into 16th-note runs for hard. Medium gets 8th notes + 2-lane here.
- **Tail (28–30s) has no taps by design** — the `songEndTime` buffer (lastTile + 2.5s) gives the beat cut-out and echo fade before the game ends.

---

## Fine-Tuning Notes

- **If Easy main/variation feels too sparse:** Switch from half notes (1.09s) to quarter notes (0.545s) — edit every other entry in those sections of `easy` array.
- **If Medium syncopations land wrong:** The syncopated 8th note is always 0.27s after the preceding quarter note beat. Slide those entries by ±0.05s to match the actual audio accent.
- **If Hard peak 16th notes are too dense:** Replace the 0.14s-spaced runs with 0.27s (8th-note) pairs — keep the 2-lane entries and remove every other 16th between them.
- **If the intro feels too easy in medium/hard:** Add more 8th-note hits or include a 2-lane entry on the very first beat `[0.00, [1,3]]`.
- **Section boundaries at 110 BPM** are slightly offset from the given timestamps (e.g., bar 6 = 10.91s, not exactly 11.0s). Tap entries are anchored to the given timestamps (2.0, 11.0, 20.0, 28.0) for simplicity — adjust if the actual audio downbeat lands differently.
