#!/usr/bin/env bash
# negtest.sh — safe scaffolding for NEGATIVE TESTS (deliberately breaking a
# shipping file to prove a check discriminates).
#
# The hazard this exists for is not a red gate. It is a GREEN gate on a file
# you broke on purpose and failed to restore: on 2026-08-23 a stubbed
# frameRot() stayed in the working tree because the restoring `cp` ran from a
# drifted working directory and reported success against the wrong path.
#
# Usage:
#   .claude/scripts/negtest.sh save    <file>   # snapshot before breaking it
#   .claude/scripts/negtest.sh restore <file>   # restore, then PROVE it worked
#   .claude/scripts/negtest.sh scan    [file…]  # any break left behind?
#
# Prints one parseable KEY=value line per action; exits non-zero on any failure.
# Snapshots live in .git/negtest/ (inside .git, so they can never be committed
# and never show up in `git status`).
#
# Convention: mark every deliberate break with the token @negtest in a comment,
# so `scan` can find one that outlived its test. gates.sh runs `scan` over the
# changed files on every invocation.
#
# `scan` ALSO fails on an OUTSTANDING SNAPSHOT — a file that was `save`d and
# never `restore`d. That closes the marker convention's hole, which is that it
# only protects a break you remembered to mark: on 2026-09-20 an interlock
# session hand-rolled `cp` backups instead of using this script, left an
# unmarked sabotage line live in world.js, and NEGTEST-SCAN reported GREEN
# through several gate runs while the night sky was being overwritten with
# daytime blue on every frame. The restoring `cp` had failed for the very
# reason in the note above — it ran from a drifted working directory — which
# `restore` would have caught on the spot, because it cmp-verifies and exits
# non-zero.
#
# So an outstanding snapshot now means "a negative test is in flight, you are
# not done", and the gate says so until it is restored. That is deterministic
# where the marker is discipline; it protects anyone who runs `save`, which is
# the workflow this file exists to make the easy one.
#
# ONE SNAPSHOT PER BREAK: `restore` CONSUMES the snapshot (it is deleted once
# the bytes are verified), so a second break needs a second `save`. Running two
# controls back to back without re-saving is how a break survives its test:
# the second restore reports NEGTEST=no-snapshot, which reads like a usage
# error rather than "your file is still broken" (2026-08-27, a hue-blind cache
# key left in the working tree that way). `scan` and gates.sh are the backstop,
# but only for a break you remembered to mark.
set -u
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "NEGTEST=not-a-git-repo"; exit 1; }
cd "$ROOT" || exit 1
STORE=.git/negtest

cmd=${1:-}; shift 2>/dev/null || true

abs() { case $1 in /*) printf '%s' "$1";; *) printf '%s/%s' "$ROOT" "$1";; esac; }
slot() { printf '%s/%s' "$STORE" "$(printf '%s' "$1" | tr '/' '_')"; }

case "$cmd" in
save)
  f=${1:-}; [ -n "$f" ] || { echo "NEGTEST=usage: save <file>"; exit 1; }
  [ -f "$(abs "$f")" ] || { echo "NEGTEST=missing FILE=$f"; exit 1; }
  mkdir -p "$STORE" || exit 1
  cp "$(abs "$f")" "$(slot "$f")" || { echo "NEGTEST=save-failed FILE=$f"; exit 1; }
  echo "SAVED=$f BYTES=$(wc -c < "$(slot "$f")" | tr -d ' ')"
  ;;
restore)
  f=${1:-}; [ -n "$f" ] || { echo "NEGTEST=usage: restore <file>"; exit 1; }
  s=$(slot "$f")
  [ -f "$s" ] || { echo "NEGTEST=no-snapshot FILE=$f — NOT RESTORED, the break (if any) is STILL LIVE. A previous restore consumed the snapshot: 'save' again before each break. Revert by hand, then run: $0 scan $f"; exit 1; }
  cp "$s" "$(abs "$f")" || { echo "NEGTEST=restore-failed FILE=$f"; exit 1; }
  # the restore is not believed until the bytes match — `cp` is happy to
  # succeed against a path that is not the one you meant
  if cmp -s "$s" "$(abs "$f")"; then
    rm -f "$s"
    echo "RESTORED=$f VERIFIED=yes"
  else
    echo "NEGTEST=restore-unverified FILE=$f"; exit 1
  fi
  ;;
scan)
  files=("$@")
  # An unrestored snapshot is a live break, whether or not it was marked.
  outstanding=0
  if [ -d "$STORE" ]; then
    for s in "$STORE"/*; do
      [ -e "$s" ] || continue
      echo "OUTSTANDING $(basename "$s" | tr '_' '/') — saved but never restored"
      outstanding=$((outstanding+1))
    done
  fi
  if [ "$outstanding" -gt 0 ]; then
    echo "NEGTEST-SCAN: RED ($outstanding negative test(s) still in flight — run: $0 restore <file>, or delete .git/negtest/ if the break is already reverted)"
    exit 1
  fi
  if [ ${#files[@]} -eq 0 ]; then
    while IFS= read -r f; do
      [ -n "$f" ] && [ -f "$f" ] && files+=("$f")
    done < <( { git diff --name-only; git diff --cached --name-only; } | sort -u )
  fi
  if [ ${#files[@]} -eq 0 ]; then echo "NEGTEST-SCAN: GREEN (nothing changed)"; exit 0; fi
  hits=0
  for f in "${files[@]}"; do
    # .claude/ is context and tooling, never deployed content — and the files
    # that DOCUMENT this convention naturally contain the marker. Scan what
    # ships. (Skipping this exclusion once made gates.sh flag its own comment.)
    #
    # CLAUDE.md at ANY depth is context too, and the same trap bit a second way
    # on 2026-09-20: writing the negative-test rule into games/CLAUDE.md put the
    # marker in a file the exclusion did not cover, and the scan went red on its
    # own documentation. A gate that cries wolf is worse than no gate, so the
    # exclusion follows the convention rather than one directory.
    case "$f" in .claude/*) continue;; esac
    case "$f" in CLAUDE.md|*/CLAUDE.md) continue;; esac
    [ -f "$f" ] || continue
    while IFS= read -r line; do
      echo "LEFTOVER $f:$line"; hits=$((hits+1))
    done < <(grep -n '@negtest' "$f" 2>/dev/null)
  done
  if [ "$hits" -gt 0 ]; then echo "NEGTEST-SCAN: RED ($hits left behind)"; exit 1; fi
  echo "NEGTEST-SCAN: GREEN"
  ;;
*)
  echo "NEGTEST=usage: negtest.sh save|restore|scan <file...>"; exit 1;;
esac
