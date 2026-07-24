#!/usr/bin/env bash
# stamp-badge.sh — set each given page's #build-badge to the current UTC time.
#
# Usage: .claude/scripts/stamp-badge.sh <page.html> [...]
#
# Replaces whatever "build YYYY-MM-DD HH:MM UTC" string the badge currently
# holds (placeholder or old stamp — no need to know it) and prints one
# parseable line per file: STAMPED <file> <timestamp> | NO-BADGE <file>.
# Exits 1 if any file is missing or has no badge, so gates fail loudly.
# Every file in one invocation gets the identical timestamp (badge SOP:
# games/CLAUDE.md § Build Timestamp Badge — quote this string in the report).
set -u
TS="build $(date -u '+%Y-%m-%d %H:%M UTC')"
rc=0
for f in "$@"; do
  if [ ! -f "$f" ]; then echo "NO-FILE $f"; rc=1; continue; fi
  if ! grep -q 'id="build-badge"' "$f"; then echo "NO-BADGE $f"; rc=1; continue; fi
  sed -i -E "s/build [0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2} UTC/$TS/" "$f"
  echo "STAMPED $f $TS"
done
[ $# -eq 0 ] && { echo "usage: stamp-badge.sh <page.html> [...]"; rc=1; }
exit $rc
