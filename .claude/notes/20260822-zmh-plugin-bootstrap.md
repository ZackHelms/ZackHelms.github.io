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

## 2026-08-27 — an installed plugin is PINNED to a marketplace SHA

Reported as "the sprite-prerender skill isn't in zmhstudio remote main". It
was: `git ls-tree origin/main plugins/zmh-3d/skills/` on the sibling clone
lists `sprite-prerender`, in commit `0f26807`, pushed 21:32 UTC. Nothing was
wrong with the push at all.

What was actually wrong is the **cache layout**:

```
~/.claude/plugins/cache/zmhstudio/zmh-3d/0f26807400c6/skills/sprite-prerender/
                                         ^^^^^^^^^^^^ the marketplace commit
```

A plugin is unpacked under the marketplace commit it was installed from, and
`claude plugin install` — which is what `session-start.sh` runs for every
enabled plugin — **exits fast when the plugin is already present**. Nothing in
the bootstrap path ever re-resolves an installed plugin against a newer
upstream. So a container that installed `zmh-3d` before 21:32 keeps the older
tree for its entire life, `/load-plugins` included, and anything added
upstream afterwards is invisible in it. This session's own container installed
at 21:33 — one minute after the push — which is the only reason the skill
showed up here and made the report look like a push failure.

Recovery, in the stale container:

```bash
claude plugin marketplace update zmhstudio
claude plugin update zmh-3d@zmhstudio     # restart required to apply
```

Both the diagnosis and those two commands are now step 5 of the canonical
`load-plugins` template in zmhstudio, re-copied into this repo's
`.claude/commands/load-plugins.md` (never hand-edit that copy — see CLAUDE.md).

**The rule this leaves behind:** before reporting anything missing from a
remote, check the remote, not the local install — `git ls-tree origin/main
<path>`. A pinned cache and a failed push look identical from inside a
session, and only one of them is a real problem.

## The second staleness case: the marketplace WORKING TREE (2026-08-28)

The rule above is about the plugin **cache** being pinned to a marketplace SHA.
There is a second, independent way to reach the same wrong conclusion, and a
neon-clash session hit it a few hours later.

This repo declares its marketplace as a **directory source**
(`~/.claude/plugins/known_marketplaces.json` → `{"source":"directory","path":
"/home/user/zmhstudio"}`), so `/home/user/zmhstudio` is an ordinary git clone
made when the container was built. **It is never fetched by anything.** Asked
to load `zmh-3d:sprite-prerender`, that session ran `ls
/home/user/zmhstudio/plugins/zmh-3d/skills/`, saw six skills and no
`sprite-prerender`, cross-checked the plugin README (whose "roadmap" section
also predated the skill), and reported to the CD that the skill did not exist.

It did. The clone was from **2026-08-20**; the skill landed at 21:32 on the
27th. The tell was there and unread: the clone had **no `.git/FETCH_HEAD` at
all**. One `git -C /home/user/zmhstudio fetch origin main` produced it — along
with a HEAD commit literally titled *"pin the bake-size and byte-budget rules in
sprite-prerender"*.

**Listing a directory is not checking a remote.** Both cases collapse to one
habit, so make it reflexive before saying a skill, plugin or file is missing:

```bash
git -C /home/user/zmhstudio fetch origin main -q
git -C /home/user/zmhstudio ls-tree origin/main --name-only -r | grep <thing>
```

Cost of not doing it: the session designed and shipped a whole pipeline before
the CD pointed at the skill, and the skill turned out to carry a rule the
pipeline had broken (art baked at 1x and blitted at 1.5x — see
`.claude/notes/20260827-offline-prerender-pipeline.md`). The skill would not
have changed the architecture, which was the right one for that request, but it
would have caught a shipped defect a day earlier.

Related and worth knowing together: `1d67ef4` enabled `zmh-3d@zmhstudio` in
`.claude/settings.json` for exactly this reason, so its skills now load in a
fresh container without `/load-plugins`. That fixes *resolution*; it does not
fix a stale clone, because the SessionStart install reads the same directory.
