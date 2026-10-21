#!/usr/bin/env bash
# land-on-main.sh - land a branch on main as ONE commit, by fast-forward.
#
# Usage:
#   .claude/scripts/land-on-main.sh <branch> <message-file> [--dry-run]
#
# Makes one new commit whose tree is <branch>'s last tree and whose parent is
# origin/main, and pushes it as a fast-forward of main. The branch's own
# per-step commits stay on the branch; main gets one commit and never a merge
# commit (CLAUDE.md section Git workflow: "Never author a merge commit on main").
# Works from any checkout of the repo, a worktree included: it moves no local
# branch and touches no working tree, so the primary checkout's main is left
# behind origin until someone pulls (`git pull --ff-only origin main`).
#
# Refuses (exit 1) unless origin/main is an ancestor of <branch>: when another
# session pushed in the meantime, merge origin/main INTO the branch, re-run
# the gates, then land again. It fetches twice, once to check and once right
# before the push, because concurrent sessions push to main (CLAUDE.md).
#
# Written 2026-10-21 after the taasgoals oversee run, whose command template
# said `merge --no-ff` on main; the arc landed by hand with commit-tree instead.
#
# Prints one parseable line per outcome:
#   LAND: GREEN sha=<sha> base=<sha>   (pushed)
#   LAND: DRY sha=<sha> base=<sha> files=<n>   (--dry-run: built, not pushed)
#   LAND: NOTHING   (the branch's tree is already main's)
#   LAND: RED <reason>
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 1

branch="${1:-}"; msg="${2:-}"; dry="${3:-}"
if [ -z "$branch" ] || [ -z "$msg" ]; then
  echo "usage: $0 <branch> <message-file> [--dry-run]"; echo "LAND: RED usage"; exit 1
fi
if [ -n "$dry" ] && [ "$dry" != "--dry-run" ]; then echo "LAND: RED unknown-arg $dry"; exit 1; fi
if [ ! -s "$msg" ]; then echo "LAND: RED no-message $msg"; exit 1; fi
if ! git rev-parse --verify -q "$branch^{commit}" >/dev/null; then echo "LAND: RED no-branch $branch"; exit 1; fi

if ! git fetch -q origin main; then echo "LAND: RED fetch-failed"; exit 1; fi
base=$(git rev-parse origin/main)
if ! git merge-base --is-ancestor "$base" "$branch"; then
  n=$(git rev-list --count "$branch..$base")
  echo "LAND: RED behind=$n (merge origin/main into $branch, re-run the gates, land again)"; exit 1
fi

tree=$(git rev-parse "$branch^{tree}")
if [ "$tree" = "$(git rev-parse "$base^{tree}")" ]; then echo "LAND: NOTHING"; exit 0; fi

sha=$(git commit-tree "$tree" -p "$base" -F "$msg") || { echo "LAND: RED commit-tree"; exit 1; }
# never report a commit whose tree is not the branch's (re-read, don't trust intent)
if ! git diff --quiet "$sha" "$branch"; then echo "LAND: RED tree-mismatch $sha"; exit 1; fi
files=$(git diff --name-only "$base" "$sha" | wc -l | tr -d ' ')

if [ "$dry" = "--dry-run" ]; then echo "LAND: DRY sha=$sha base=$base files=$files"; exit 0; fi

if ! git fetch -q origin main; then echo "LAND: RED fetch-failed"; exit 1; fi
if [ "$(git rev-parse origin/main)" != "$base" ]; then
  echo "LAND: RED moved (origin/main moved since the check: merge it into $branch, re-run the gates, land again)"; exit 1
fi
if ! git push -q origin "$sha:refs/heads/main"; then echo "LAND: RED push-failed $sha"; exit 1; fi
echo "LAND: GREEN sha=$sha base=$base"
