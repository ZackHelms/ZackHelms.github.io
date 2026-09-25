# Grimoire

An illuminated-manuscript style: warm vellum, iron-gall ink, vermilion rubrics and gold
leaf, with woodcut-style pictures. Text is set like a book and read like one, so the
body face is a real old-style serif and the capitals are Roman inscriptional letters.
Parchment by default, with a "night reading" mode (candlelit dark vellum) that follows
the OS and can be overridden per page.

Origin: `games/cyoa/` (2026-09-25), commissioned by the CD as a deliberately distinct
look from Neon Arcade. That page is the reference implementation; copy from it.

## Fonts

One Google Fonts request, with fallbacks that keep the layout intact if it fails:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@700&family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
```

- **Cinzel** 400/600/700 (`"Trajan Pro", "Times New Roman", serif`): headings, button
  labels, ribbons, small caps labels. Always with `letter-spacing: .06em` or more.
- **IM Fell English** regular + italic (`"Iowan Old Style", Palatino, Georgia, serif`):
  all running prose. Body at 1.125rem / 1.55. Italic marks a different voice (a
  player's line, a quotation, an aside), never emphasis inside the narrator's voice.
- **Cinzel Decorative** 700: the page title and illuminated drop caps only.

## Tokens

```css
:root {
  --vellum:   #efe3c8;  /* page ground */
  --vellum-2: #e6d6b2;  /* panels, inputs */
  --vellum-3: #d9c59a;  /* deckle edges, plate mounts, pressed states */
  --ink:      #2a1d12;  /* body text, rules, woodcut ink      12.9:1 on vellum */
  --ink-2:    #5a4632;  /* secondary text                      7.0:1 */
  --ink-3:    #8a7458;  /* hairlines, disabled (never body)    3.5:1 */
  --rubric:   #a5301f;  /* rubricated headings, names, alerts  5.4:1 */
  --gold:     #b8892b;  /* gilding fills (not text) */
  --gold-hi:  #e2c068;  /* gilding highlight */
  --gold-lo:  #7d5a17;  /* gilding shadow; gold TEXT uses this 4.9:1 */
  --lapis:    #27456e;  /* links, focus ring                   7.6:1 */
  --verdigris:#3f6f5f;  /* success / healing                   4.5:1 */
  --shadow:   rgba(42, 29, 18, .28);
}
/* night reading: candlelit dark vellum. Same roles, re-balanced for a dark ground. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* night tokens below */ }
}
:root[data-theme="dark"] {
  --vellum:   #1b140d;
  --vellum-2: #251b12;
  --vellum-3: #3a2b1c;
  --ink:      #ecdcb9;  /* 13.5:1 */
  --ink-2:    #bba580;  /*  7.6:1 */
  --ink-3:    #7d6a50;  /*  3.5:1, hairlines only */
  --rubric:   #e0664c;  /*  5.4:1 */
  --gold:     #d4a64a;
  --gold-hi:  #f0d488;
  --gold-lo:  #d4a64a;  /* gold text on dark: 8.1:1 */
  --lapis:    #8fb0e0;  /*  8.2:1 */
  --verdigris:#79ad99;
  --shadow:   rgba(0, 0, 0, .5);
}
```

Write the night block twice, once under the media query guarded by
`:root:not([data-theme="light"])` and once under `:root[data-theme="dark"]`, so the OS
setting and an explicit override both work. `body` always sets an explicit
`background: var(--vellum)` and `color: var(--ink)`.

## Components

- **Vellum ground.** A flat `--vellum` fill plus two cheap layers: a radial vignette
  toward `--vellum-3` at the edges, and a faint fibre texture (an inline SVG
  `feTurbulence` at ~6% opacity, or none). Never a photographic texture.
- **Rubric plaque** (the button). Cinzel 600, uppercase, `letter-spacing: .14em`; a 2px
  `--ink` border inside a 1px `--gold` outer rule (double frame), `--vellum-2` fill,
  square corners (radius <= 3px). Hover/focus: a gilded underline grows under the label
  and the focus ring is `--lapis`. Pressed: fill `--vellum-3`, translateY(1px). Disabled:
  `--ink-3` text and border, no gilding.
- **Illuminated drop cap.** The first letter of each narrator passage: Cinzel Decorative,
  ~3.1 lines tall, `--rubric` on a gilded square (`--gold` with a `--gold-hi` inner
  highlight) with a 1px `--ink` frame, floated left.
- **Rubricated heading.** Cinzel 700, `--rubric`, small caps, with a thin `--ink-3` rule
  and a centred fleuron (❦) when it opens a section.
- **Speaker name.** Cinzel 600 small caps in `--rubric`, followed by the line in IM Fell
  italic.
- **Plate.** A woodcut picture (Canvas 2D, ink on a parchment ground, one accent colour
  at most) mounted in a double ink frame with gold corner blocks. Plates keep their
  parchment palette in night mode and are dimmed with `filter: brightness(.86)
  sepia(.15)` instead of being re-inked.
- **Ribbon.** A vertical bookmark ribbon (`--rubric`, V-notched tail) hanging from the
  top edge; used as a menu handle.
- **Result chip.** An inline rounded-square d20 glyph plus Cinzel numerals; success
  `--verdigris`, failure `--rubric`, critical in gilding.
- **Page turn.** Screen changes crossfade (opacity, ~1.2s ease-in-out) through a flat
  `--vellum` veil. No sliding, no zooming.

## Rules a page in this style keeps

- No neon, no glow, no blur shadows larger than 12px, no monospace, no pill buttons, no
  numbered "01 / 02" labels, no gradients except the gilding.
- One accent colour per picture; the page itself may use rubric and gold together.
- Body text is never `--ink-3` and never gold on vellum (gold text uses `--gold-lo`).
- Text set on a plate always sits on a ribbon or a vellum label, never directly on the
  picture.
- Minimum touch target 44px; plaque labels never below 13px.
- A style is paint: switching parchment/night never changes what the page does.
