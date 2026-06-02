Audit the Sorcery game file at games/sorcery.html and report:

1. **File health** — line count, confirm single `<script>` block, no unclosed tags or obvious JS syntax issues (look for mismatched braces at the section level).

2. **Data tables** — list all entries in `RAY_DEFS`, `WALL_DEFS`, `UPGRADE_DEFS`, and `ENEMY_TYPES` with their key numeric stats in compact form.

3. **Spell instances tracked** — note the initial spell given at `startGame()` and what `G.raySpells`/`G.wallSpells` start with.

4. **Upgrade balance snapshot** — for each upgrade in `UPGRADE_DEFS`, show the multiplier and whether a stack limit is enforced.

5. **Pause depth sources** — list every `pushPause()` call site and its matching `popPause()`, confirm they are paired.

6. **Draw call order** — list the sequence of draw functions called in `draw()`.

7. **Any obvious issues** — missing `enemySeenOrder` reset in `startGame`, orphaned DOM ids referenced in JS but not in HTML, or vice versa.

Keep the report concise — use inline code and short tables. Read the file fresh before reporting.
