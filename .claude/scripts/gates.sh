#!/usr/bin/env bash
# gates.sh — run this repo's validation gates in one command.
#
# Usage:
#   .claude/scripts/gates.sh                    # derive targets from git
#   .claude/scripts/gates.sh <page.html> [...]  # explicit pages
#   .claude/scripts/gates.sh --no-drive [...]   # skip the drive suites
#
# With no arguments it reads the working tree + the commits since origin/main
# for changed pages, smokes those, and runs any `.claude/tests/drive-<slug>.cjs`
# whose game those pages belong to. That is the common case mid-session.
#
# Always runs check-games-sync.cjs — it is pure node, costs nothing, and the
# three files it compares drift independently.
#
# Prints one parseable line per gate plus a final `GATES: GREEN|RED`; exit 0/1.
# Existing to stop sessions hand-retyping the NODE_PATH incantation, which is
# non-obvious enough that .claude/scripts/README.md documents it twice: remote
# containers have no top-level `playwright-core`, only one nested inside the
# global `playwright`.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 1

DRIVE=1
PAGES=()
for a in "$@"; do
  case "$a" in
    --no-drive) DRIVE=0 ;;
    -*) echo "unknown flag: $a" >&2; exit 1 ;;
    *) PAGES+=("$a") ;;
  esac
done

# --- resolve a NODE_PATH that can see playwright-core -----------------------
if [ -z "${NODE_PATH:-}" ] || ! NODE_PATH="$NODE_PATH" node -e 'require("playwright-core")' 2>/dev/null; then
  for c in /opt/node22/lib/node_modules/playwright/node_modules \
           "$HOME/node_modules" ./node_modules; do
    if [ -d "$c" ] && NODE_PATH="$c" node -e 'require("playwright-core")' 2>/dev/null; then
      export NODE_PATH="$c"; break
    fi
  done
fi
if ! node -e 'require("playwright-core")' 2>/dev/null; then
  echo "NO-PLAYWRIGHT (set NODE_PATH, or npm install playwright-core)"
  HAVE_PW=0
else
  HAVE_PW=1
fi

# --- work out what changed --------------------------------------------------
if [ ${#PAGES[@]} -eq 0 ]; then
  base=origin/main
  git rev-parse --verify -q "$base" >/dev/null || base=HEAD
  while IFS= read -r f; do
    [ -n "$f" ] && [ -f "$f" ] && PAGES+=("$f")
  done < <( { git diff --name-only; git diff --cached --name-only;
              git diff --name-only "$base"...HEAD 2>/dev/null; } \
            | grep -E '\.html$' | sort -u )
fi
echo "PAGES=${#PAGES[@]}${PAGES[*]+ ${PAGES[*]}}"

rc=0
run() {  # run <label> <cmd...>; echo its final line, surface its failures
  local label=$1; shift
  local out ok=0
  out=$("$@" 2>&1) || ok=1
  printf '%s\n' "$out" | tail -1 | sed "s|^|$label |"
  if [ $ok -ne 0 ]; then
    rc=1
    printf '%s\n' "$out" | grep -E '^(FAIL|RED|NO-|PROBLEM|.*Error)' | head -12
  fi
}

# --- gate 1: smoke every changed page ---------------------------------------
if [ ${#PAGES[@]} -eq 0 ]; then
  echo "SMOKE skipped (no changed pages)"
elif [ "$HAVE_PW" = 0 ]; then
  echo "SMOKE skipped (no playwright-core) — state this in the report, never silently"
  rc=1
else
  run SMOKE node .claude/scripts/smoke-mobile.cjs "${PAGES[@]}"
fi

# --- gate 2: the catalog three-way sync (free, always) ----------------------
run SYNC node .claude/scripts/check-games-sync.cjs

# --- gate 3: kept drive suites for the games touched ------------------------
if [ "$DRIVE" = 1 ] && [ "$HAVE_PW" = 1 ]; then
  suites=()
  for p in ${PAGES[*]+"${PAGES[@]}"}; do
    case "$p" in
      games/*/index.html) slug=$(basename "$(dirname "$p")") ;;
      games/*.html)       slug=$(basename "$p" .html) ;;
      *) continue ;;
    esac
    s=".claude/tests/drive-$slug.cjs"
    [ -f "$s" ] && case " ${suites[*]-} " in *" $s "*) ;; *) suites+=("$s") ;; esac
  done
  if [ ${#suites[@]} -eq 0 ]; then
    echo "DRIVE none (no kept suite for the pages changed)"
  else
    for s in "${suites[@]}"; do run "DRIVE $(basename "$s")" node "$s"; done
  fi
elif [ "$DRIVE" = 1 ]; then
  echo "DRIVE skipped (no playwright-core)"
fi

[ $rc -eq 0 ] && echo "GATES: GREEN" || echo "GATES: RED"
exit $rc
