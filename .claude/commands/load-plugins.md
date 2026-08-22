---
description: Bootstrap the zmhstudio plugins into this session's container (remote-session recovery when /zmh-* commands fail to resolve)
allowed-tools: Bash(bash .claude/hooks/session-start.sh:*), Bash(CLAUDE_CODE_REMOTE=true bash .claude/hooks/session-start.sh:*), Bash(claude plugin:*)
---

<!--
zmh manual plugin bootstrap — canonical copy:
  zmhstudio/plugins/zmh-producer/templates/load-plugins-command.md
Install into a host repo as <host>/.claude/commands/load-plugins.md
(see the plugin README § Remote sessions). Generic and settings-driven —
update by re-copying from zmhstudio, never by hand-editing one repo's copy.
-->

Bootstrap the zmhstudio plugin set (marketplace + every plugin enabled under
`enabledPlugins` in this repo's `.claude/settings.json`). This is the manual
fallback for remote sessions where the SessionStart hook did not fire (or was
denied) and `/zmh-*` commands fail to resolve. It is idempotent — safe to run
when unsure.

In **multi-repo remote sessions** the hook never fires at all: the harness
loads SessionStart hooks only from the session's project dir, which is the
multi-repo parent workspace, not a repo root (verified 2026-07-12). There
this command is the *expected* bootstrap, not a rare recovery — run it once
per fresh container (plugin installs are user-scoped inside the ephemeral
container and don't carry to the next session).

Steps:

1. From the root of the repo this command file belongs to (`cd` there first
   in a multi-root session), run the same script the SessionStart hook runs:

   ```bash
   CLAUDE_CODE_REMOTE=true bash .claude/hooks/session-start.sh
   ```

   It registers the zmhstudio marketplace (sibling clone preferred, GitHub
   fallback), installs every enabled `@zmhstudio` plugin, then runs the
   repo-specific setup below the script's marker (e.g. `npm install`).

2. Verify and report: run `claude plugin list` and tell the CD exactly which
   plugins are now installed, plus this caveat — **mid-session installs may
   not resolve immediately**: the harness picks the new `/zmh-*` commands up
   on its next skill rescan (observed to arrive after a short delay on
   web/mobile), and always by the next session in the same container. Fresh
   **single-repo** remote sessions self-bootstrap via the SessionStart hook;
   fresh **multi-repo** sessions need this command once each (see above).

3. If the CD wants to run a plugin command in THIS session anyway: read the
   command's markdown source directly from the marketplace clone and follow
   it as the instruction source — sibling clone
   `../zmhstudio/plugins/<plugin>/commands/<name>.md` when present, else the
   path shown under `claude plugin marketplace list`. Producer commands also
   require the host repo's `.claude/zmh/producer.md` config, per the plugin
   README.

4. If step 1 failed, report the exact error and hand the CD the verbatim
   command to run themselves; do not silently continue.
