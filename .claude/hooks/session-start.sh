#!/bin/bash
# zmh remote-session bootstrap — canonical copy:
#   zmhstudio/plugins/zmh-producer/templates/session-start-remote.sh
#
# Remote (Claude Code on the web/mobile) containers never fetch the zmhstudio
# marketplace declared in a host repo's .claude/settings.json, so /zmh-*
# commands fail to resolve there. This SessionStart hook fixes that.
#
# LIMIT — multi-repo remote sessions: the harness loads SessionStart hooks
# only from the session's project dir. When a remote session spans several
# repos, the project dir is the parent workspace (e.g. /home/user), not any
# repo root, so per-repo hooks like this one NEVER fire (verified
# 2026-07-12: the session diagnostics log showed only the platform's
# git-identity hook spawning). Repo-local slash commands still resolve from
# additional directories, so /load-plugins is the expected bootstrap there —
# once per fresh container (plugin installs land at user scope inside the
# ephemeral container and do not survive to the next session).
#
# Install into a host repo (see the plugin README § Remote sessions):
#   1. copy to <host>/.claude/hooks/session-start.sh and chmod +x
#   2. register it under hooks.SessionStart in <host>/.claude/settings.json
#   3. copy templates/load-plugins-command.md to
#      <host>/.claude/commands/load-plugins.md (manual fallback: /load-plugins)
#   4. add repo-specific dependency setup below the marked line
#
# Everything ABOVE the "repo-specific" marker is generic and settings-driven
# (it installs whatever @zmhstudio plugins the host repo enables). Update it
# by re-copying from zmhstudio — never by hand-editing one repo's copy.
set -euo pipefail

# Repo root: the hook harness provides CLAUDE_PROJECT_DIR; derive it from
# this script's location (<repo>/.claude/hooks/) when invoked manually
# (e.g. by the /load-plugins command).
CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# Local sessions register the marketplace interactively via settings.json.
# Remote containers set the remote env signals inconsistently (observed
# 2026-07-12 on two web/mobile containers: one had only
# CLAUDE_CODE_REMOTE_SESSION_ID + CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE, the
# other also CLAUDE_CODE_REMOTE=true), so accept any of the three signals
# as "remote".
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] \
   && [ -z "${CLAUDE_CODE_REMOTE_SESSION_ID:-}" ] \
   && [ -z "${CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE:-}" ]; then
  exit 0
fi

# Register the zmhstudio marketplace: prefer a sibling clone (present when
# the session includes ZackHelms/zmhstudio), else fall back to GitHub.
if ! claude plugin marketplace list 2>/dev/null | grep -q '^  > zmhstudio$'; then
  sibling="$(dirname "$CLAUDE_PROJECT_DIR")/zmhstudio"
  if [ -f "$sibling/.claude-plugin/marketplace.json" ]; then
    claude plugin marketplace add "$sibling"
  else
    claude plugin marketplace add ZackHelms/zmhstudio
  fi
fi

# Install every zmhstudio plugin this repo enables in .claude/settings.json
# ("<plugin>@zmhstudio": true under enabledPlugins). Idempotent; exits 0
# fast when everything is already installed.
{ grep -oE '"[a-z0-9-]+@zmhstudio"[[:space:]]*:[[:space:]]*true' \
    "$CLAUDE_PROJECT_DIR/.claude/settings.json" 2>/dev/null || true; } \
  | cut -d'"' -f2 \
  | while read -r plugin; do
      claude plugin install "$plugin"
    done

# --- repo-specific setup below this line (dependency installs etc.) --------
cd "$CLAUDE_PROJECT_DIR"

# Nothing to install. This is a static site: no build system, no package.json,
# no dependencies (games/CLAUDE.md § Shared Conventions — "zero external JS
# libs; Google Fonts is the only external resource").
#
# The two validation gates named in .claude/zmh/producer.md § Validation need
# no setup either:
#   .claude/scripts/check-games-sync.cjs  — pure node, no deps, no Chromium
#   .claude/scripts/smoke-mobile.cjs      — needs Chromium + playwright-core,
#     both already present in a remote container. Chromium ships at
#     /opt/pw-browsers/chromium, and playwright-core is nested inside the
#     globally-installed playwright, so no npm install is required:
#
#       NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules \
#         node .claude/scripts/smoke-mobile.cjs <pages...>
#
#     (A bare NODE_PATH=/opt/node22/lib/node_modules does NOT work — there is
#     no top-level playwright-core there. See .claude/scripts/README.md.)
#
# Keep this section a no-op: an npm install here would only slow every session
# start and dirty the tree for nothing.
