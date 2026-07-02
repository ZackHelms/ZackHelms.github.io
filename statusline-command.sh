#!/bin/sh
# ~/.claude/statusline-command.sh
# ~/.claude/settings.json

input=$(cat)

# ALL=$( echo "$input" | jq )
# {
#   "session_id": "0dbab39d-85d0-4587-9518-3bb727355956",
#   "transcript_path": "/home/zmhel/.claude/projects/-home-zmhel-gitrepos-dolmenwood/0dbab39d-85d0-4587-9518-3bb727355956.jsonl",
#   "cwd": "/home/zmhel/gitrepos/dolmenwood",
#   "model": {
#     "id": "claude-sonnet-4-6",
#     "display_name": "Sonnet 4.6"
#   },
#   "workspace": {
#     "current_dir": "/home/zmhel/gitrepos/dolmenwood",
#     "project_dir": "/home/zmhel/gitrepos/dolmenwood",
#     "added_dirs": []
#   },
#   "version": "2.1.114",
#   "output_style": {
#     "name": "default"
#   },
#   "cost": {
#     "total_cost_usd": 0,
#     "total_duration_ms": 63171,
#     "total_api_duration_ms": 0,
#     "total_lines_added": 0,
#     "total_lines_removed": 0
#   },
#   "context_window": {
#     "total_input_tokens": 0,
#     "total_output_tokens": 0,
#     "context_window_size": 200000,
#     "current_usage": null,
#     "used_percentage": null,
#     "remaining_percentage": null
#   },
#   "exceeds_200k_tokens": false,
#   "rate_limits": {
#     "five_hour": {
#       "used_percentage": 111.00000000000001,
#       "resets_at": 1776718800
#     },
#     "seven_day": {
#       "used_percentage": 76,
#       "resets_at": 1776970800
#     }
#   }
# }

effort=$( jq -r '.effortLevel // "uNdEfInEd"' ~/.claude/settings.json ); effort="${CLAUDE_CODE_EFFORT_LEVEL:-$effort}"

model=$(        echo "$input" | jq -r '.model.display_name                      // "Unknown Model"')
model_id=$(     echo "$input" | jq -r '.model.id                                 // "unknown"')
used=$(         echo "$input" | jq -r '.context_window.used_percentage          // empty')
worktree=$(     echo "$input" | jq -r '.worktree.name                           // empty')
total_cost=$(   echo "$input" | jq -r '.cost.total_cost_usd                     // empty')
current_dir=$(  echo "$input" | jq -r '.worktree.original_cwd                   // empty')
rl_5h_pct=$(    echo "$input" | jq -r '.rate_limits.five_hour.used_percentage   // empty' | awk '{printf "%.0f", $1}')
rl_5h_reset=$(  echo "$input" | jq -r '.rate_limits.five_hour.resets_at         // empty')
rl_7d_pct=$(    echo "$input" | jq -r '.rate_limits.seven_day.used_percentage   // empty' | awk '{printf "%.0f", $1}')
rl_7d_reset=$(  echo "$input" | jq -r '.rate_limits.seven_day.resets_at         // empty')

if [ -n "$used" ]; then
  used_display=$(printf "%3.0f" "$used")
  usage_str="${used_display}%"
else
  usage_str="  0%"
fi

if [ -n "$worktree" ]; then
  worktree_str="${worktree}"
else
  worktree_str="no worktree"
fi

ESC=$(printf '\033')
GREEN="${ESC}[32m"
YELLOW="${ESC}[33m"
RED="${ESC}[31m"
RESET="${ESC}[0m"

git_str=""
if git rev-parse --git-dir > /dev/null 2>&1; then
  branch=$(git branch --show-current 2>/dev/null)
  [ -z "$branch" ] && branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  staged=$(git diff --cached --numstat 2>/dev/null | wc -l | tr -d ' ')
  modified=$(git diff --numstat 2>/dev/null | wc -l | tr -d ' ')

  git_str="$branch"
  [ "$staged" -gt 0 ] && git_str="${git_str} $(printf "${GREEN}+${staged}${RESET}")"
  [ "$modified" -gt 0 ] && git_str="${git_str} $(printf "${YELLOW}~${modified}${RESET}")"
else
  git_str="no branch"
fi


if [ -n "$total_cost" ]; then
  cost_display=$(awk "BEGIN { printf \"%6.2f\", $total_cost }")
  block_str="\$${cost_display}"
else
  block_str="\$  0.00"
fi

make_bar() {
  pct="$1"
  width=10
  filled=$(( pct * width / 100 ))
  empty=$(( width - filled ))
  bar=""
  i=0
  while [ $i -lt $filled ]; do bar="${bar}█"; i=$(( i + 1 )); done
  while [ $i -lt $width ];  do bar="${bar}░"; i=$(( i + 1 )); done
  printf "%s" "$bar"
}

tt() {
  # Wraps visible text with an OSC 8 tooltip: tt "tooltip text" "visible text"
  # NOTE: Claude Code does not render OSC 8 tooltips on mouseover (only supports
  # OSC 8 as clickable hyperlinks). Tooltips are a no-op in practice — the visible
  # text displays normally and the tooltip string is silently ignored. The tooltip
  # text is kept here as inline documentation for anyone reading this script.
  printf "\033]8;tooltip=%s;\007%s\033]8;;\007" "$1" "$2"
}

apply_color() {
  pct="${1}"
  [ -z "$pct" ] && return
  if   [ "$pct" -ge 90 ]; then color="$RED"
  elif [ "$pct" -ge 70 ]; then color="$YELLOW"
  else                         color="$GREEN"
  fi
  inner="${color}${pct}%${RESET}"
  printf "%s" "$inner"
}

format_rl() {
  pct="$1"
  reset_ts="$2"
  label="$3"
  show_date="$4"
  tooltip="$5"
  [ -z "$pct" ] && return
  if [ "$pct" -ge 90 ]; then color="$RED"
  elif [ "$pct" -ge 70 ]; then color="$YELLOW"
  else color="$GREEN"
  fi
  if [ "$show_date" = "1" ]; then
    reset_time=$(date -r "$reset_ts" "+%_I:%M%p %_d%b" 2>/dev/null || date -d "@$reset_ts" "+%_I:%M%p %_d%b" 2>/dev/null)
  else
    reset_time=$(date -r "$reset_ts" "+%_I:%M%p" 2>/dev/null || date -d "@$reset_ts" "+%_I:%M%p" 2>/dev/null)
  fi
  bar=$(make_bar "$pct")
  pct_display=$(printf "%3d" "$pct")
  # inner="${color}${label}  ${bar} ${pct}% resets ${reset_time}${RESET}"
  inner="${color}${label} ${bar} ${pct_display}% ${reset_time}${RESET}"
  printf "%s" "$(tt "$tooltip" "$inner")"
}

rate_limit_str=""
rl_5h_out=$(format_rl "$rl_5h_pct" "$rl_5h_reset" "⏱️ 5h" "0" "5-hour session usage limit: percentage of your Claude.ai subscription quota used in the current 5-hour rolling window")
rl_7d_out=$(format_rl "$rl_7d_pct" "$rl_7d_reset" "⏱️ 7d" "1" "7-day weekly usage limit: percentage of your Claude.ai subscription quota used in the current 7-day rolling window")
[ -n "$rl_5h_out" ] && rate_limit_str="$rl_5h_out"
[ -n "$rl_7d_out" ] && rate_limit_str="${rate_limit_str} | ${rl_7d_out}"

repo_root=$(cd "$current_dir" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null || echo "$current_dir")
dir_display=$(basename "$repo_root")

model_tt=$(tt   "AI model currently in use"                                              "🤖 $model")
usage_tt=$(tt   "Context window usage: percentage of the model's token limit consumed"   "🧠 $usage_str")
cost_tt=$(tt    "Estimated total session cost in USD"                                    "💰 $block_str")
dir_tt=$(tt     "Project root directory name"                                            "📁 $dir_display")
wt_tt=$(tt      "Active git worktree name (or 'no worktree' if none)"                   "🌳 $worktree_str")
git_tt=$(tt     "Current git branch with staged (+) and modified (~) file counts"       "🌿 $git_str")

datetime_str=$(date "+%H:%M %-d%b")

line2="${datetime_str}"
[ -n "$rate_limit_str" ] && line2="${line2} | ${rate_limit_str}"

# 🤖 Sonnet 4.6 (medium) | 🧠 17% | 💰 $0.19 | 📁 dolmenwood | 🌳 no worktree | 🌿 main +2 ~2
# 22:44 20Apr | ⏱️  5h  ██░░░░░░░░ 28% resets 3:00AM | ⏱️  7d  █████████░ 91% resets 3:00PM 23Apr
#printf "%s | %s | %s | %s | %s | %s\n%s" "$model_tt ($effort)" "$usage_tt" "$cost_tt" "$dir_tt" "$wt_tt" "$git_tt" "$line2"


# 🤖 Sonnet 4.6 (medium) | 🧠 0% | ⏱️  5h  ██░░░░░░░░ 28% resets 3:00AM | ⏱️  7d  █████████░ 91% resets 3:00PM 23Apr
# 22:59 20Apr | 💰 $0.00 | 📁 dolmenwood | 🌳 no worktree | 🌿 main +2 ~2
                        printf "   %s" "$datetime_str"
                        effort_field=$(printf '%-10s' "($effort)")
                        printf " | %s" "$model_tt $effort_field"
                        printf " | %s" "$usage_tt"
[ -n "$rl_5h_out" ] &&  printf " | %s" "$rl_5h_out"
[ -n "$rl_7d_out" ] &&  printf " | %s" "$rl_7d_out"
                        printf " | %s" "$cost_tt"
                        printf "\n"
                        printf "   %s" "$dir_tt"
                        printf " | %s" "$wt_tt"
                        printf " | %s" "$git_tt"



# Write rate limit JSON for ccmonitor poller
if [ -n "$rl_5h_pct" ] && [ -n "$rl_7d_pct" ]; then
  printf '{"ts":%s,"five_hour_pct":%s,"five_hour_resets_at":%s,"seven_day_pct":%s,"seven_day_resets_at":%s,"model":"%s"}\n' \
    "$(date +%s)" "$rl_5h_pct" "${rl_5h_reset:-0}" "$rl_7d_pct" "${rl_7d_reset:-0}" "$model_id" \
    > /tmp/claude_rate_limits.json
fi

# Output to file so I can get some info in .bashrc PS1 variable
echo "export claudecodestring='claude $(apply_color $rl_5h_pct)/5h $(apply_color $rl_7d_pct)/7d @$datetime_str'"  > /tmp/claude_status
# get_claude_info() {  # in ~/.bashrc
#     if [ -f /tmp/claude_status ]; then
#         source /tmp/claude_status
#         echo "($claudecodestring) "
#     fi
# }
# export PS1="\$(get_claude_info)$PS1"
