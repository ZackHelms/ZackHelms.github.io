#!/usr/bin/env bash
# eol-guard.sh - catch line-ending churn before it lands.
#
# Usage:
#   .claude/scripts/eol-guard.sh [base]          # check (default base: origin/main)
#   .claude/scripts/eol-guard.sh [base] --fix    # rewrite each flagged file to its base's style
#
# Compares every file changed between <base> and the working tree. A file that
# exists in <base> must keep <base>'s line endings (LF or CRLF); a new file must
# be LF. Anything else is flagged, because a whole-file line-ending flip shows as
# every line changed: the real edit disappears in the diff and a concurrent
# session's merge conflicts on every line.
#
# Written 2026-11-26 (colony-sim): editing with Python on Windows, where
# open(p, 'w') writes '\n' as '\r\n', turned CLAUDE.md, games/CLAUDE.md, DONE.md
# and .claude/games-index.md from LF into CRLF (2,501 changed lines in one file
# for a 15-line edit). Only `git diff --stat` before landing caught it.
#
# Prints one line per flagged file, then:
#   EOL: GREEN files=<n>        nothing flagged
#   EOL: FIXED files=<n>        --fix rewrote <n> files (re-run the gates)
#   EOL: RED files=<n>          <n> files flagged (exit 1)
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 1
base="origin/main"; fix=0
for a in "$@"; do case "$a" in --fix) fix=1 ;; *) base="$a" ;; esac; done
git rev-parse --verify -q "$base^{commit}" >/dev/null || { echo "EOL: RED unknown-base $base"; exit 1; }

# count CR bytes directly: Git Bash's grep hides a CR at the end of a line on Windows
style() { if [ -n "$(head -c 262144 "$1" | tr -dc '\r' | head -c 1)" ]; then echo CRLF; else echo LF; fi; }
binary() { ! grep -Iq . "$1" 2>/dev/null; }

files=$( { git diff --name-only "$base" -- ; git ls-files --others --exclude-standard; } | sort -u )
n=0; bad=0
for f in $files; do
  [ -f "$f" ] || continue
  binary "$f" && continue
  n=$((n + 1))
  if git cat-file -e "$base:$f" 2>/dev/null; then
    tmp=$(mktemp); git show "$base:$f" > "$tmp"; want=$(style "$tmp"); rm -f "$tmp"
  else want=LF; fi
  have=$(style "$f")
  [ "$want" = "$have" ] && continue
  bad=$((bad + 1))
  if [ "$fix" = 1 ]; then
    if [ "$want" = LF ]; then sed -i 's/\r$//' "$f"; else sed -i 's/\r*$/\r/' "$f"; fi
    echo "fixed $f ($have -> $want)"
  else
    echo "flag  $f is $have, base is $want"
  fi
done
if [ "$bad" = 0 ]; then echo "EOL: GREEN files=$n"; exit 0; fi
if [ "$fix" = 1 ]; then echo "EOL: FIXED files=$bad"; exit 0; fi
echo "EOL: RED files=$bad"; exit 1
