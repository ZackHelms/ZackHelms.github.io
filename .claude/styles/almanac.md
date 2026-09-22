# Almanac

A plain, skeptical reference-page style: paper-grey page, white cards, dark ink rules,
a condensed sans for anything you scan and a text serif for anything you read. Every
number wears a small outlined tag saying where it came from. Light by default, with a
full dark mode that follows the OS.

Origin: the carbon-footprint pages (`carbon-footprint/`), built in a Claude chat session
on 2026-09-22 and adopted as a named site style the same day. Those two pages are the
reference implementation; copy from them.

## Fonts

One Google Fonts request, with fallbacks that keep the layout intact if it fails:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
```

- **Barlow Semi Condensed** 500/600/700 (`"Arial Narrow", Arial, sans-serif`): h1-h3,
  big numbers, tables, controls, chips, summaries, tags, the kicker.
- **Source Serif 4** 400/600 (`Georgia, "Times New Roman", serif`): body prose, notes,
  result sentences. Body at 1.0625rem / 1.55-1.6.

## Tokens

Neutral tokens are the style. The semantic series tokens below them are how the carbon
pages name their colours; a new page renames them for its own quantities but keeps each
light/dark pair together.

```css
:root{
  --bg:#F1F4F3; --card:#FFFFFF; --ink:#14202A; --muted:#55626C; --rule:#D2D9D8;
  --soft:#E4EAE9; --track:#E2E8E7;
  --kwh:#2C58B5; --h2o:#0E7C83; --heat:#9A4A12; --co2:#3F4750; --ai:#A8326B;
  --min:#3A7536; --max:#A3372A;
  --src:#2C58B5; --inf:#8F5500; --asm:#74399A;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#0F161C; --card:#162028; --ink:#E4EAEE; --muted:#9AA6AF; --rule:#27343D;
    --soft:#1D2A33; --track:#22303A;
    --kwh:#86A8F2; --h2o:#52C4CA; --heat:#EFA46B; --co2:#C3C9CF; --ai:#EE86B6;
    --min:#86C981; --max:#F0907E;
    --src:#86A8F2; --inf:#E2AA5E; --asm:#C79BE3;
  }
}
:root[data-theme="dark"]{ /* same values as the media block */ }
```

| Token | Role |
|---|---|
| `--kwh` (blue) | the accent: links, focus rings, the primary series |
| `--src` / `--inf` / `--asm` | the three provenance tags: sourced, inferred, assumed |
| `--min` / `--max` | a good-end / bad-end pair (green / red) |
| `--h2o`, `--heat`, `--co2`, `--ai` | extra series hues |
| `--soft` / `--track` | chip fill, result panel, empty bar track, table header |

Dark mode is the triple above: the `prefers-color-scheme` block guarded by
`:not([data-theme="light"])`, repeated under `:root[data-theme="dark"]`, so a future
toggle only has to set `data-theme` on `<html>`. Add
`<meta name="color-scheme" content="light dark">` so native controls follow.

## Components

- **Kicker** (`nav.kicker`): small uppercase Barlow row above the h1, muted, links in
  inherited colour. Site link first, then sibling pages.
- **h2**: 3px `--ink` rule on top, generous space above. This rule is the style's
  section break; do not add others.
- **Cards** (`.day`, `.fact`, `.tool`, `.calc`, `details`): `--card` fill, 1px `--rule`
  border, 8-10px radius. A card may carry a 6px coloured top border to mark a series.
- **Provenance tags** (`.t.s`, `.t.i`, `.t.a`): Barlow .78-.8rem 600, 1px
  `currentColor` border, 3px radius, `white-space:nowrap` - except inside narrow cards
  (`.fact .t{white-space:normal}`), where a long tag otherwise pushes the page wide at 320px.
- **Tables** always inside `.tbl { overflow-x:auto }` with a `min-width` on the table,
  tabular numerals in numeric cells (`td.n`), `--track` header row.
- **Chips**: pill buttons, `--soft` fill; the pressed one inverts to `--ink` fill and
  sets `aria-pressed="true"`.
- **Bars**: 9-10px `--track` rail, 2px radius, fill in the series colour; width animates
  unless `prefers-reduced-motion`.
- **Result panel** (`.say`): serif sentence on `--soft`, then label/value rows split by
  1px `--rule` lines.

## Rules a page in this style keeps

1. **ASCII copy**: straight quotes, plain hyphens, `350F` rather than a degree sign.
2. **Every number is labelled** `source: X`, `inferred` or `assumed`. A number without a
   tag does not ship.
3. Focus: `:focus-visible { outline:3px solid var(--kwh); outline-offset:2px }`.
4. Mobile first: single column under ~380px, no horizontal page scroll at 320px.
5. No storage, analytics or runtime network calls beyond the font stylesheet.
6. Tone: plain and skeptical. Ranges over single numbers; say what is not counted.

## Changes from the chat artifact (v1, 2026-09-22)

The artifact's styling was kept as-is. Additions only: the kicker nav (site link and
cross-links, which the artifact lacked), the `color-scheme` meta, and letting tags wrap
inside fact cards (the artifact overflowed to 387px on a 320px screen).
