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
opened straight off disk with `file://`. `boot()` injects them at runtime —
**including `manifest.js`**, which is deliberately *not* a static `<script src>`
tag so that it can carry the cache-busting token (see Refreshing below).

## Refreshing

The ⟳ button at the top right of every page forces a genuinely fresh copy.

Mobile Chrome will serve this page and its data files from cache long after a
push, which is why a change can look undeployed in a normal tab but correct in
incognito. A plain reload only revalidates the HTML, so the stale `data/*.js`
files survive it. The button instead:

1. unregisters any service worker and deletes every Cache Storage entry, then
2. reloads on `?fresh=<timestamp>` — a URL nothing has cached yet.

`boot()` forwards that token to every injected script as `?v=<timestamp>`, so
the manifest and all title data are re-fetched too. The token is stripped from
the address bar once boot finishes, keeping shared links clean.

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
  places:     [ /* entries — same shape; omit or leave empty to hide the section */ ],
  chapters:   [ /* entries — same shape again; a per-chapter summary list */ ],

  // Optional. Reference blocks appended after the two lists — see "Notes" below.
  notes: [ { title: '1865 Boston…', hint: '…', sections: [ { heading: '…', items: ['…'] } ] } ]
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

### Chapters

`chapters` is a third entry list, rendered after `places` and behaving exactly
like the other two: one row each, tap for a dialog, and its own deep link at
`#/<slug>/x/<entry-id>`.

Name the entries plainly — `Chapter 1`, `Chapter 2` — so the **list itself
gives nothing away**; that is the spoiler gate for a book being read now, and
it is why the summaries are not folded behind the ⚠ tap. Put a short neutral
tag in `role` (it only shows inside the dialog) and the summary in `detail`.
**A chapter's summary covers only what happens in that chapter** — never
foreshadow a later reveal, or the gate stops working.

An entry name ending in a number is tiled with that number rather than its
initials, so `Chapter 12` reads `12` and not `C1`.

The three lists come from the `LISTS` table in `index.html`, keyed by the
letter used in dialog URLs (`c`, `p`, `x`). A fourth list is an entry there
plus a section in `renderTitle`.

### Notes

`notes` renders free-form reference blocks after the character and place lists,
for things that belong to the whole title rather than to one entry — period
context, a glossary, a family tree in prose. Each block is a `section` on the
page:

```js
notes: [{
  title: '1865 Boston: Frame-of-Mind Reference',  // becomes the section heading
  hint:  'The world the club actually lives in',  // optional small-caps line
  sections: [
    { heading: 'Medicine & Health',
      body:  'optional prose; blank lines split it into paragraphs',
      items: ['Doctor visits: No routine check-ups…', 'Germ theory: Not yet accepted…'] }
  ]
}]
```

An item written `Label: the rest` gets its label picked out automatically;
anything without that shape renders exactly as written. Notes sit **outside**
the search box and the filter chips — they are context, not entries, so they
never disappear when a season chip is active or a search matches nothing.

### Spoilers

Anything that would ruin the plot goes in `spoiler`, never in `role` or `detail` —
the whole point of the app is to be safe to open halfway through a book. The
`SPOILERS ON/OFF` chip on the title page sets whether those blocks start open, and
the choice is remembered in `localStorage`.

### Pictures

The monogram is always painted first and the picture is overlaid on it, so an
`img` that 404s or is mistyped falls back to the monogram tile rather than
leaving a blank circle — a missing picture always looks like no picture.

`img` is left `null` in the current titles: hotlinking publicity stills from
third-party sites is both fragile and legally murky, so the app generates a
monogram tile instead. To add a real picture, drop the file next to the data files
(e.g. `data/img/<slug>/<name>.jpg`) and point `img` at it, or paste in a `data:` URI
to keep the app single-request.

**Fetching the free ones.** `tools/fetch-images.mjs` fills in the entries that
depict a *real* person or place, from Wikimedia Commons:

```sh
node tools/fetch-images.mjs --dry-run   # offline: check the manifest still matches
node tools/fetch-images.mjs             # fetch, save, patch the data files
```

It reads `tools/image-sources.json` (entry name → Wikipedia article), takes each
article's lead image at 480px, **refuses anything not public domain or CC**,
saves it to `data/img/<slug>/`, records attribution in that folder's
`CREDITS.md`, and writes the `img:` field. Re-running skips entries that already
have one, and anything that fails is simply left as a monogram.

It needs egress to `en.wikipedia.org`, `commons.wikimedia.org` and
`upload.wikimedia.org`; remote sessions are usually blocked from all three.

Fictional characters are deliberately **not** in that manifest — the only
pictures of them are copyrighted publicity stills. Those stay monograms unless
a picture is added by hand.

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
