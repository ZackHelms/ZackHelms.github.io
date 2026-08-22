#!/usr/bin/env bash
# stamp-badge.sh — set each given page's #build-badge to the current UTC time.
#
# Usage: .claude/scripts/stamp-badge.sh <page.html> [...]
#
# Replaces whatever text the badge currently holds — an old stamp, or a
# placeholder of any shape — and prints one parseable line per file:
# STAMPED <file> <timestamp> | NO-BADGE <file> | NO-STAMP <file>.
# Exits 1 if any file is missing, has no badge, or did not actually change,
# so gates fail loudly.
#
# It rewrites the badge div's whole text rather than matching a timestamp:
# a regex that only matched "build YYYY-MM-DD HH:MM UTC" silently no-opped on
# a badge reading "build PENDING" while still printing STAMPED, and neon-clash
# shipped twice with an unstamped badge behind that false green (2026-08-22).
# Every file in one invocation gets the identical timestamp (badge SOP:
# games/CLAUDE.md § Build Timestamp Badge — quote this string in the report).
set -u
TS="build $(date -u '+%Y-%m-%d %H:%M UTC')"
rc=0
for f in "$@"; do
  if [ ! -f "$f" ]; then echo "NO-FILE $f"; rc=1; continue; fi
  if ! grep -q 'id="build-badge"' "$f"; then echo "NO-BADGE $f"; rc=1; continue; fi
  sed -i -E "s|(id=\"build-badge\"[^>]*>)[^<]*|\1$TS|" "$f"
  if grep -q "id=\"build-badge\"[^>]*>$TS<" "$f"; then
    echo "STAMPED $f $TS"
  else
    echo "NO-STAMP $f"; rc=1          # never report a stamp that did not land
  fi
done
[ $# -eq 0 ] && { echo "usage: stamp-badge.sh <page.html> [...]"; rc=1; }
exit $rc
