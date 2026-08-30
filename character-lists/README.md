# Character Lists

Live at **https://tythos.com/character-lists/**

A personal cheat-sheet for books, TV shows and films: *who was that character again,
and what was that place called?* The hub lists titles; each title page lists its
**characters** and, in a second list, its **places** — name only, most important
first — and tapping a name opens a detail dialog over a shaded backdrop.

## Layout

```
character-lists/
  index.html            # the whole app — self-contained shell, no libraries
  data/
    manifest.js         # window.CL_TITLES = [...]  — hub order
    <slug>.js           # one file per title, calls CL.add({...})
  README.md             # this file
```

`index.html` is never edited to add content. Adding a title is two steps:

1. Write `data/<slug>.js`.
2. Add `'<slug>'` to `window.CL_TITLES` in `data/manifest.js` (put whatever is
   currently being read/watched near the top — the hub renders in array order).

Data files are loaded as plain `<script>` tags, not `fetch`, so the app also works
opened straight off disk with `file://`.

## Field contract

```js
CL.add({
  slug:    'the-pitt',          // required — must match the filename and manifest entry
  title:   'The Pitt',          // required — display name
  kind:    'show',              // 'book' | 'show' | 'film' — shown as a badge on the hub card
  accent:  '#4488ff',           // hex; themes the whole title page and its dialogs
  byline:  'HBO Max · created by …',   // one line under the title
  blurb:   'A real-time medical drama…',
  footnote:'…',                 // optional footer line on the title page

  // Optional. Renders filter chips (ALL + one per entry) on the title page and
  // labelled tags in the dialog. Match against each entry's `tags` array.
  // A filter's optional `blurb` REPLACES the title blurb while that chip is
  // selected (ALL shows the top-level blurb; a filter without one falls back
  // to it). Multi-season titles must provide one per season — see "Filter
  // summaries" below.
  filters: [
    { id: 's1', label: 'Season 1', blurb: 'Season 1 (2025): one 15-hour day shift…' },
    { id: 's2', label: 'Season 2', blurb: 'Season 2 (2026): ten months later…' }
  ],

  characters: [ /* entries — authored in importance order, NOT sorted */ ],
  places:     [ /* entries — same shape; omit or leave empty to hide the section */ ]
})
```

### Entry shape

Every field except `name` is optional.

| Field | Type | Notes |
|---|---|---|
| `name` | string | **Required.** The only thing shown in the list. |
| `id` | string | Overrides the URL slug, which is otherwise derived from `name`. Set it if you rename an entry and want old links to keep working. |
| `aka` | string | Alternate names / nickname line under the title in the dialog. |
| `role` | string | One-line "who they are", in the accent colour. Keep it **spoiler-free** — this is the line you read when you have just forgotten a name. |
| `actor` | string | Shows as "Played by …". Screen titles only. |
| `tags` | string[] | Filter ids from `filters`. An entry with no tags is hidden whenever a filter other than ALL is active. |
| `img` | string | Optional picture — any URL or `data:` URI. When absent, a deterministic monogram tile is generated from the name (same name → same colours, every time). |
| `detail` | string | Prose. Blank lines split it into paragraphs. |
| `facts` | string[] | Bulleted quick facts under the prose. |
| `spoiler` | string | Folded away behind a ⚠ tap. Blank lines split into paragraphs. |

### Filter summaries

The blurb at the top of a title page is filter-aware: selecting a chip whose
filter object carries a `blurb` swaps that text in; selecting ALL (or a chip
without one) shows the title's own `blurb`. **Every multi-season title must
give each season filter its own `blurb`** — a one-paragraph summary of that
season (when it aired/airs, its framing, its new arrivals) — so the page reads
correctly whichever season chip is selected. The top-level `blurb` should
summarise the whole show. Filter blurbs follow the same spoiler rule as
everything outside `spoiler` fields: safe to read mid-season.

### Spoilers

Anything that would ruin the plot goes in `spoiler`, never in `role` or `detail` —
the whole point of the app is to be safe to open halfway through a book. The
`SPOILERS ON/OFF` chip on the title page sets whether those blocks start open, and
the choice is remembered in `localStorage`.

### Pictures

`img` is left `null` in the current titles: hotlinking publicity stills from
third-party sites is both fragile and legally murky, so the app generates a
monogram tile instead. To add a real picture, drop the file next to the data files
(e.g. `data/img/<slug>/<name>.jpg`) and point `img` at it, or paste in a `data:` URI
to keep the app single-request.

## URLs

| Hash | Page |
|---|---|
| `#/` | hub |
| `#/<slug>` | title page |
| `#/<slug>/c/<entry-id>` | title page with a character dialog open |
| `#/<slug>/p/<entry-id>` | title page with a place dialog open |

Dialog URLs are shareable and deep-linkable. Closing a dialog — via the ✕, a tap
on the backdrop, `Esc`, or the browser/system back gesture — returns to the title
page with the list scroll position intact.

## Conventions

Same house style as the rest of the site: `Black Ops One` headings, `Share Tech Mono`
body, `#06060e` background, neon accents, no external JS libraries.
