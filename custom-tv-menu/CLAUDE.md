# custom-tv-menu — Claude Instructions

A personal "TV menu" web app: a unified home screen for your streaming favorites,
designed to be driven by a **TV remote** (D-pad), keyboard, or mouse, and deployed as a
**static** site (eventually into a `custom-tv-menu/` subfolder of `ZackHelms.github.io`).

## Hard constraints (read before changing architecture)

- **Static hosting only.** No backend, no server-side process, no build step. Everything
  runs in the browser. Background work must be client-side (fetch-on-load + cache,
  optionally a service worker later).
- **Streaming services have no public login/search API.** The app does **not** and cannot
  log into Netflix/Hulu/etc. or store service credentials. "Register" = choosing which
  services *you* subscribe to (local only). "Play" **deep-links out** to the service's own
  app/site. Do not add credential storage or scraping.
- **Metadata comes from TMDB** (`api.themoviedb.org`), which is browser-CORS-friendly.
  The user supplies a free API key in Settings; it's stored in localStorage only.
- **Performance first.** Render cached state instantly, lazy-load images, cache API
  responses, and keep focus animations on the compositor (box-shadow only — no JS-driven
  layout animation). Target: a Raspberry Pi on a TV.

## Run locally

ES modules + fetch require http (not `file://`):

```bash
cd custom-tv-menu
python3 -m http.server 8000
# open http://localhost:8000
```

## Project structure

```
index.html            App shell: left nav (#nav) + view container (#view)
css/styles.css         Theme vars + layout + the pulsing-yellow .focused highlight
js/app.js              Bootstrap + hash router (#/home, #/search, #/register, #/settings, #/title/<type>/<id>)
js/nav.js              Spatial D-pad focus engine (arrows move, Enter activates, Esc/Backspace = back)
js/store.js            localStorage state: settings, services, favorites, watched (keys are ctm.*)
js/services.js         Loads data/services.json; service lookups + deep-link builder
js/tmdb.js             TMDB client + 24h localStorage cache (search/details/watch-providers/images)
js/ui.js               DOM helpers: el(), poster() with placeholder, service badges
js/views/home.js       Favorites (sort: alpha|recent|added; group: none|service|genre) + watched list
js/views/search.js     TMDB multi-search; opens results into the title view
js/views/register.js   Toggle subscribed services
js/views/settings.js   Theme (bg, focus color, pulse speed), home defaults, TMDB key + region
js/views/title.js      Title detail: services offering it, add-to-favorites, Play deep link
data/services.json     Service catalog: TMDB provider ids, badge color/short, deep-link templates
data/mock.json         Seed favorites/watched (used on first run / before a TMDB key)
```

## State model (`js/store.js`, all keys prefixed `ctm.`)

- `settings` — `{ tmdbApiKey, region, theme:{bg,focusColor,pulseSpeed}, defaultSort, defaultGroup }`
- `services` — array of subscribed service ids (match `data/services.json` ids)
- `favorites` — `[{ id, mediaType, title, poster, genres[], service, addedAt, lastWatchedAt }]`
- `watched` — non-favorite titles opened via the app `[{ id, mediaType, title, poster, service, lastWatchedAt }]`

Always read/write through the `store` object — don't touch localStorage directly elsewhere.

## TV-remote / focus conventions

- Make anything selectable with the `data-focusable` attribute. `nav.js` finds it
  automatically; the `.focused` class draws the pulsing highlight.
- Key map lives in `KEYMAP` in `js/nav.js` — add remote keycodes there, don't scatter
  key handling across views.
- After (re)rendering a view, call `focusFirst()` so the remote always has a target.

## Conventions

- Vanilla ES modules, no framework, no build. Match the existing terse style; build DOM
  with `el()` from `ui.js`.
- Hash-based routing only (works on static hosts). Navigate by setting `location.hash`.
- New view → add a `mountX(container, opts)` in `js/views/` and a case in `app.js`.
- New streaming service → add an entry to `data/services.json` (include the TMDB
  `providerId` so availability matching works).

## Adding live data (Phase 2 status)

`tmdb.js` is fully wired; Search and Title detail already use it when a key is present.
When extending: respect the cache TTL, keep calls keyed off `store.getSettings()`, and
degrade gracefully when `tmdb.hasKey()` is false (the app must stay usable on mock data).

## Publishing to ZackHelms.github.io

Use `publish.py` (mirrors the FFL1 `publish.sh` pattern). It exports this repo's
committed **HEAD** tree via `git archive` and replaces `ZackHelms.github.io/custom-tv-menu/`
wholesale, so the publish is deterministic and removals propagate. It refuses to run on a
dirty working tree (HEAD is what ships). Routing is hash-based and all paths are relative
(`./js/...`), so it works unchanged from the subfolder. Served by direct URL only — no link
from the site homepage. Publish only when asked.

```bash
python3 publish.py --dry-run            # preview the file list
python3 publish.py                      # sync files, leave the site repo staged/uncommitted
python3 publish.py --commit --push      # sync, commit, and push the site repo's main
# --target PATH or $CTM_SITE_REPO overrides the default ../ZackHelms.github.io
```

## Standing rule

If a feature's design is unclear or conflicts with the static-hosting / no-streaming-API
constraints above, ask before building.
