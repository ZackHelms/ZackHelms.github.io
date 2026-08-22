# zmh-producer bootstrap in this repo — install, verification, and one landmine

From the 2026-08-22 session. Until now this repo had **no** plugin bootstrap
at all: no `.claude/settings.json`, no `.claude/hooks/session-start.sh`, no
`.claude/commands/load-plugins.md`. That — not a misfiring hook — is why
`/zmh-producer:*` had never resolved here. The three files are now installed
per `zmhstudio/plugins/zmh-producer/README.md` § Remote sessions.

## What is installed

| File | Source | Hand-edit? |
|---|---|---|
| `.claude/settings.json` | README § Remote sessions | yes — repo-owned |
| `.claude/hooks/session-start.sh` | `templates/session-start-remote.sh` | **only below the repo-specific marker** |
| `.claude/commands/load-plugins.md` | `templates/load-plugins-command.md` | **no — verbatim copy** |

Everything above the hook's `repo-specific` marker and all of
`load-plugins.md` are generic and settings-driven. Update them by
**re-copying from zmhstudio**, never by editing this repo's copy — that drift
is the thing zmhstudio exists to prevent. Adopting another plugin later needs
no hook change, just another `"<plugin>@zmhstudio": true` in
`enabledPlugins`.

This repo's section below the marker is deliberately a **no-op**: a static
site with no package.json, and both gates already run with what a remote
container ships (Chromium at `/opt/pw-browsers/chromium`, `playwright-core`
nested inside the global `playwright`). An `npm install` there would slow
every session start and dirty the tree for nothing.

## The landmine: `claude plugin uninstall` rewrites the repo's settings.json

While testing the hook from a clean registry, `claude plugin uninstall
zmh-producer@zmhstudio` and `claude plugin marketplace remove zmhstudio`
**silently rewrote the tracked `.claude/settings.json`**, leaving:

```json
{ "hooks": {...}, "enabledPlugins": {}, "extraKnownMarketplaces": {} }
```

Both keys emptied, key order reshuffled. The next hook run then found nothing
to install and "succeeded" while installing nothing — a green exit that had
quietly disabled the repo's own config. If you ever uninstall/remove to test,
**back the file up first and restore it after**, and diff before committing.

`claude plugin install` does **not** do this: it installs at *user* scope
inside the container and leaves the repo file byte-identical (verified by
sha256 before/after). So a normal session start never dirties the tree — only
teardown commands do.

## Verified paths (all four, this session)

1. **Local session** (no `CLAUDE_CODE_REMOTE*` signals) — silent no-op, exit 0.
2. **Remote, sibling clone present** (`/home/user/zmhstudio`) — registers the
   marketplace from the directory, installs the plugin.
3. **Remote, no sibling clone** — falls back to `marketplace add
   ZackHelms/zmhstudio` and clones from GitHub. This is the path a normal
   single-repo session on this repo takes, so it is the one that matters most.
4. **Idempotent rerun** — reports "already installed", exit 0.

In all four the repo's `settings.json` stayed byte-identical.

## Caveats that will bite again

- Plugin installs are **user scope inside the ephemeral container** — they do
  not survive to the next session's container. The hook re-runs every start,
  which is the point.
- **Multi-repo remote sessions: the hook never fires.** The harness loads
  SessionStart hooks only from the session's project dir, which in that shape
  is the parent workspace (`/home/user`), not a repo root. Repo-local slash
  commands still resolve, so `/load-plugins` is the expected bootstrap there —
  once per fresh container.
- **Mid-session installs do not resolve immediately.** The harness picks new
  `/zmh-*` commands up on its next skill rescan (a short delay on web/mobile),
  and always by the next session. Until then, read the command markdown
  straight from the marketplace clone and follow it as the instruction source
  (`/load-plugins` step 3).
- Producer commands additionally require `.claude/zmh/producer.md` at the repo
  root. This repo has one. Read it fresh rather than from memory — it drifts:
  the same day this note was written, a parallel session corrected its
  §Backlog/§Plans, which had still claimed `TODO.md`, `DONE.md` and
  `.claude/templates/plan.md` did not exist. All three do, and `TODO.md` is
  currently scoped to Phasic only.
