#!/usr/bin/env bash
# marketplace-status.sh — is the local plugin marketplace clone current, and
# does a given skill actually exist on its remote?
#
# WHY THIS EXISTS. This repo declares its marketplace as a *directory source*,
# so the clone at /home/user/zmhstudio is made when the container is built and
# then never fetched by anything. Listing its skills is therefore not evidence
# that a skill is missing — only that it did not exist on the day the container
# was built. That mistake was made twice on 2026-08-27/28 (once as a pinned
# plugin cache, once as a stale clone), the second time costing a whole session
# that shipped a pipeline the missing skill would have corrected. See
# .claude/notes/20260822-zmh-plugin-bootstrap.md.
#
# Usage:
#   .claude/scripts/marketplace-status.sh                 # freshness + skill list
#   .claude/scripts/marketplace-status.sh sprite-prerender  # does this skill exist?
#
# Prints KEY=value lines. Exits 0 if fresh (and, when asked, the skill exists);
# 1 if the clone is behind or the named skill is absent from the remote.
set -u

MP="${ZMH_MARKETPLACE:-}"
if [ -z "$MP" ]; then
  MP=$(python3 - <<'PY' 2>/dev/null
import json, os
p = os.path.expanduser('~/.claude/plugins/known_marketplaces.json')
try:
    d = json.load(open(p))
except Exception:
    raise SystemExit
for v in d.values():
    src = v.get('source') or {}
    if src.get('source') == 'directory' and src.get('path'):
        print(src['path']); break
    if v.get('installLocation'):
        print(v['installLocation']); break
PY
)
fi

if [ -z "${MP:-}" ] || [ ! -d "$MP/.git" ]; then
  echo "MARKETPLACE=none"
  echo "ERROR=no directory-source marketplace clone found (set ZMH_MARKETPLACE)"
  exit 1
fi

echo "MARKETPLACE=$MP"
git -C "$MP" fetch origin main -q 2>/dev/null || { echo "ERROR=fetch failed"; exit 1; }

LOCAL=$(git -C "$MP" rev-parse --short HEAD)
REMOTE=$(git -C "$MP" rev-parse --short origin/main)
BEHIND=$(git -C "$MP" rev-list --count HEAD..origin/main)
echo "LOCAL=$LOCAL"
echo "REMOTE=$REMOTE"
echo "BEHIND=$BEHIND"

# Skills are read from origin/main, never from the working tree — that is the
# whole point of this script.
SKILLS=$(git -C "$MP" ls-tree -r origin/main --name-only \
         | sed -n 's#^plugins/\([^/]*\)/skills/\([^/]*\)/SKILL.md$#\1:\2#p' | sort)

if [ "$#" -ge 1 ]; then
  WANT="$1"
  HIT=$(printf '%s\n' "$SKILLS" | grep -i -- "$WANT" || true)
  if [ -n "$HIT" ]; then
    echo "SKILL_FOUND=$(printf '%s' "$HIT" | tr '\n' ',')"
    [ "$BEHIND" != "0" ] && echo "NOTE=clone is $BEHIND commits behind; run: claude plugin marketplace update <name>"
    exit 0
  fi
  echo "SKILL_FOUND=none"
  echo "SKILLS=$(printf '%s' "$SKILLS" | tr '\n' ' ')"
  exit 1
fi

echo "SKILLS=$(printf '%s' "$SKILLS" | tr '\n' ' ')"
[ "$BEHIND" = "0" ] || exit 1
exit 0
