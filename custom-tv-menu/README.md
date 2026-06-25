# custom-tv-menu

A personal, remote-friendly home screen for your streaming favorites. Black-screen TV UI
with a unified **Favorites** list (sortable & groupable), a **Recently watched** list,
cross-service **Search**, and per-service **Register**/**Settings** — all running as a
static web app (no backend, no build step).

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(ES modules + fetch need http, so opening `index.html` directly via `file://` won't work.)

## Features

- **Favorites** — sort by A–Z / recently watched / date added; group by service / genre / none.
- **Recently watched** — most-recent first, with thumbnail, title, and service.
- **Search** — across services via TMDB; results show which of your services carry a title.
- **Register** — pick the services you subscribe to (local only — no login).
- **Settings** — black background, a pulsing-yellow focus highlight (color + speed
  adjustable), home defaults, and your TMDB API key + region.
- **Remote / keyboard / mouse** — D-pad arrows move a highly visible pulsing focus border;
  Enter selects; Esc/Backspace goes back.

## How it works (and what it can't do)

Streaming services don't offer public APIs to log in or search their catalogs, and this is
a static site — so the app **can't** authenticate into Netflix/Hulu/etc. Instead it uses
[TMDB](https://www.themoviedb.org/) for search, artwork, genres, and which services carry a
title, stores your favorites/history locally, and **deep-links out** to each service to
actually play. Add a free TMDB API key in **Settings** to enable Search and live
availability.

See [`CLAUDE.md`](./CLAUDE.md) for architecture and contributor notes.
