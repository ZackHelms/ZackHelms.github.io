# carbon-footprint

Two self-contained pages about household energy, carbon and water, and how AI use
compares. Built in a Claude chat session on 2026-09-22 and published here the same day.

| Page | URL | What it is |
|---|---|---|
| `index.html` | [tythos.com/carbon-footprint](https://tythos.com/carbon-footprint/) | PRIMARY: the household's low-end and high-end day, plus a compare-anything tool (~50 items) |
| `baseline/index.html` | [tythos.com/carbon-footprint/baseline](https://tythos.com/carbon-footprint/baseline/) | Reference: conversion factors, per-item household table, AI tables, outside benchmarks, log-scale carbon ladder |
| `METHODOLOGY.md` | - | Every number, factor, assumption and source, with the weak spots ranked |

Not a game: no hub card, no build badge, no games-index row. Style is **Almanac**
(`.claude/styles/almanac.md`), not the neon arcade look. Standing rules for editing
are in `CLAUDE.md` here.

## Privacy

The household is described only as two adults and a child. Never add real names, who is
whose parent, the child's gender or age, the school, what a trip is for, the home
location or employers, in these files or their commit messages: the repo is public, so
anything committed stays in git history even after a later edit removes it. The site's
`2026election/` page already names a ZIP code, which is why trip purposes and drive
times are left out too. Driving is described as generic short and long daily round
trips.

## How to change the numbers

All data is in the `<script>` block at the bottom of `index.html`:

- `var F = { ... }` - conversion factors (grid CO2 per kWh, gasoline CO2 per gallon,
  water per kWh, source-to-site ratios, etc.).
- `var G = [ ... ]` - the item list, grouped. Item fields: `grid`, `dc`, `solar` (kWh),
  `gal` (gasoline gallons), `ng` (MMBtu natural gas), `other` (site kWh with no CO2
  factor), `kg` (extra CO2 added directly), `L` (direct water), `lo`/`hi` (range
  multipliers), `noE`/`noL` (not estimated), `lab` (the transparency label).
- The two family-day cards are the items with ids `fmin` and `fmax`. Changing the
  household means editing those two objects AND the matching bullets in the "What goes
  into these two numbers" details block.

The reference page's tables are static HTML; its ladder and two-item comparator read the
`ladder` and `items` arrays in its own `<script>`. The two pages do not share code, so a
factor changed in one must be changed in the other. Update `METHODOLOGY.md` in the same
change.

## Verification checklist

Run after any edit. These values are computed at runtime, so they catch broken math.

| Check | Expected |
|---|---|
| Low-end family day | 8.1 kg CO2, 58.4 kWh, ~1,150 L, 2.9 t/yr |
| High-end family day | 31 kg CO2, 126 kWh, ~1,250 L, 11 t/yr |
| 30-min Claude Opus extra-high session (default selection) | 210 g CO2, 600 Wh, 2.8 L |
| McDonald's-size restaurant, 1 day | 460 kg CO2, 15x the high-end day |
| Shortcut chips | selecting one updates the dropdown and the result card |
| Quantity field | non-numeric or negative input shows a message, not NaN |
| Reference page comparator (default) | 1 week of Max 20x maxed = about 2.2 long round trips (30 mi) |

Also: no horizontal scroll at 320 px, dark mode, keyboard focus rings, no console errors
on either page. `.claude/scripts/smoke-mobile.cjs carbon-footprint/index.html
carbon-footprint/baseline/index.html` covers the last one.

## Caveats the pages must keep visible

- Anthropic publishes no per-token or per-prompt energy data, so every Claude number is
  an outside estimate with a wide range. The pages say so; keep that sentence.
- Carbon uses the US-average grid. A local grid factor changes everything
  electricity-related, in either direction.
- Water counts home use plus power plants and fuel production. Food and goods are
  excluded, and they are large.
- The household baselines are national averages (EIA RECS), not this house.
