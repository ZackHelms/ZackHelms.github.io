# character-lists — Claude instructions

Scoped to this directory on purpose — these rules apply to the character-lists
app only, not to the rest of the repo.

The full field contract lives in `README.md` here. The rules below are the
standing instructions the CD has asked for:

- **Never edit `index.html` to add content.** A new title is a
  `data/<slug>.js` file (one `CL.add({...})` call) plus a slug entry in
  `data/manifest.js`, currently-being-read/watched titles nearest the top.

- **Multi-season titles need per-season summaries.** The blurb at the top of a
  title page swaps with the selected chip: ALL shows the title's own `blurb`;
  selecting a season chip shows that filter's `blurb`. So every filter entry
  of a multi-season show must carry its own `blurb` — a one-paragraph,
  spoiler-safe summary of that season. Don't ship a season chip without one
  (a chip for an unaired season may carry a short placeholder blurb saying
  when it premieres and that entries will be tagged as it airs).

- **Spoilers only in `spoiler` fields.** `role`, `detail`, `facts`, blurbs
  (top-level and per-filter) and footnotes must all be safe to read while
  mid-book / mid-season — that is the entire point of the app.

- **Don't make `data/manifest.js` a static `<script src>` tag again.** It is
  injected by `boot()` along with the title data so the ⟳ refresh button's
  cache-busting token reaches it; a static tag is fetched before any JS runs
  and would silently pin the app to a stale list of titles. Same rule for any
  future data file — load it through `boot()`'s `loadScript`, which appends
  the token. See README § Refreshing.

- **Hub cards are two lines** (kind badge + title; ellipsized byline +
  `N CH · M PL` counts), no chevron. Keep them that compact if you touch the
  hub. Note the hub card rows use the class `.crow` — the bare `.row` class
  belongs to the title-page entry lists.
