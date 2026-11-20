# ~/.claude/statusline-command.ps1  (PowerShell 7)
# Windows port of ~/.claude/statusline-command.sh
# Reproduces the two-line Claude Code statusline: model/effort, context %,
# 5h & 7d rate-limit bars, cost, dir, worktree, git branch.

$ErrorActionPreference = 'SilentlyContinue'

# Emit UTF-8 so emoji and box-drawing bars render (not the console code page).
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

# --- Read JSON payload from stdin -------------------------------------------
$raw = [Console]::In.ReadToEnd()
try { $j = $raw | ConvertFrom-Json } catch { $j = $null }

# --- Extract fields ----------------------------------------------------------
$model       = if ($j.model.display_name) { $j.model.display_name } else { 'Unknown Model' }
$model_id    = if ($j.model.id)            { $j.model.id }            else { 'unknown' }

# --- Effort level (settings.json, overridable by env) -----------------------
# effort is stored per-model under modelSettings.<model_id>.effortLevel since
# /effort and /model save the current model's override there; the top-level
# effortLevel field is a stale legacy fallback and does not update per-model.
$settingsPath = Join-Path $HOME '.claude\settings.json'
$effort = 'uNdEfInEd'
if (Test-Path $settingsPath) {
    try {
        $settings = Get-Content -Raw $settingsPath | ConvertFrom-Json
        $modelEffort = $settings.modelSettings.$model_id.effortLevel
        if ($modelEffort) { $effort = $modelEffort }
        elseif ($settings.effortLevel) { $effort = $settings.effortLevel }
    } catch {}
}
if (-not $effort) { $effort = 'uNdEfInEd' }
if ($env:CLAUDE_CODE_EFFORT_LEVEL) { $effort = $env:CLAUDE_CODE_EFFORT_LEVEL }
$used        = $j.context_window.used_percentage
$worktree    = $j.worktree.name
$total_cost  = $j.cost.total_cost_usd
$current_dir = $j.worktree.original_cwd
$rl_5h_pct   = $j.rate_limits.five_hour.used_percentage
$rl_5h_reset = $j.rate_limits.five_hour.resets_at
$rl_7d_pct   = $j.rate_limits.seven_day.used_percentage
$rl_7d_reset = $j.rate_limits.seven_day.resets_at

# --- ANSI colors -------------------------------------------------------------
$ESC    = [char]27
$GREEN  = "$ESC[32m"
$YELLOW = "$ESC[33m"
$RED    = "$ESC[31m"
$RESET  = "$ESC[0m"

function Color-For([double]$pct) {
    if     ($pct -ge 90) { $RED }
    elseif ($pct -ge 70) { $YELLOW }
    else                 { $GREEN }
}

# --- Context usage -----------------------------------------------------------
if ($null -ne $used -and $used -ne '') {
    $usage_str = ('{0,3}%' -f [int][math]::Round([double]$used))
} else {
    $usage_str = '  0%'
}

# --- Worktree ----------------------------------------------------------------
$worktree_str = if ($worktree) { "$worktree" } else { 'no worktree' }

# --- Cost --------------------------------------------------------------------
if ($null -ne $total_cost -and $total_cost -ne '') {
    $block_str = '${0,6:F2}' -f [double]$total_cost
} else {
    $block_str = '$  0.00'
}

# --- 12-hour time helpers (mirror %_I:%M%p and %_d%b) ------------------------
function Format-Clock([datetime]$dt) {
    $h = $dt.Hour % 12; if ($h -eq 0) { $h = 12 }
    $ampm = if ($dt.Hour -ge 12) { 'PM' } else { 'AM' }
    '{0,2}:{1:00}{2}' -f $h, $dt.Minute, $ampm
}
function Format-Reset([long]$ts, [bool]$showDate) {
    if (-not $ts) { return '' }
    $dt = [DateTimeOffset]::FromUnixTimeSeconds($ts).LocalDateTime
    $out = Format-Clock $dt
    if ($showDate) { $out += (' {0,2}{1}' -f $dt.Day, $dt.ToString('MMM')) }
    $out
}

# --- Bar ---------------------------------------------------------------------
function Make-Bar([int]$pct) {
    $width  = 10
    $filled = [math]::Floor($pct * $width / 100)
    if ($filled -gt $width) { $filled = $width }
    if ($filled -lt 0)      { $filled = 0 }
    ('█' * $filled) + ('░' * ($width - $filled))
}

# --- Rate-limit formatter ----------------------------------------------------
function Format-RL($pct, $resetTs, [string]$label, [bool]$showDate) {
    if ($null -eq $pct -or $pct -eq '') { return '' }
    $p = [int][math]::Round([double]$pct)
    $color = Color-For $p
    $bar = Make-Bar $p
    $reset_time = Format-Reset ([long]$resetTs) $showDate
    '{0}{1} {2} {3,3}% {4}{5}' -f $color, $label, $bar, $p, $reset_time, $RESET
}

$rl_5h_out = Format-RL $rl_5h_pct $rl_5h_reset "$([char]0x23F1)$([char]0xFE0F) 5h" $false
$rl_7d_out = Format-RL $rl_7d_pct $rl_7d_reset "$([char]0x23F1)$([char]0xFE0F) 7d" $true

# --- Directory (repo root basename) -----------------------------------------
$repo_root = $current_dir
if ($current_dir -and (Test-Path $current_dir)) {
    Push-Location $current_dir
    $top = git rev-parse --show-toplevel 2>$null
    if ($top) { $repo_root = $top }
    Pop-Location
}
$dir_display = if ($repo_root) { Split-Path -Leaf $repo_root } else { '' }

# --- Git branch + staged/modified counts ------------------------------------
$git_str = 'no branch'
if ($current_dir -and (Test-Path $current_dir)) {
    Push-Location $current_dir
    if (git rev-parse --git-dir 2>$null) {
        $branch = git branch --show-current 2>$null
        if (-not $branch) { $branch = git rev-parse --abbrev-ref HEAD 2>$null }
        $staged   = @(git diff --cached --numstat 2>$null).Count
        $modified = @(git diff --numstat 2>$null).Count
        $git_str = "$branch"
        if ($staged   -gt 0) { $git_str += " ${GREEN}+$staged${RESET}" }
        if ($modified -gt 0) { $git_str += " ${YELLOW}~$modified${RESET}" }
    }
    Pop-Location
}

# --- Assemble emoji-tagged fields -------------------------------------------
$model_tt = "$([char]0xD83E)$([char]0xDD16) $model"        # 🤖
$usage_tt = "$([char]0xD83E)$([char]0xDDE0) $usage_str"    # 🧠
$cost_tt  = "$([char]0xD83D)$([char]0xDCB0) $block_str"    # 💰
$dir_tt   = "$([char]0xD83D)$([char]0xDCC1) $dir_display"  # 📁
$wt_tt    = "$([char]0xD83C)$([char]0xDF33) $worktree_str" # 🌳
$git_tt   = "$([char]0xD83C)$([char]0xDF3F) $git_str"      # 🌿

$now = Get-Date
$datetime_str = '{0:HH:mm} {1}{2}' -f $now, $now.Day, $now.ToString('MMM')

$effort_field = '{0,-10}' -f "($effort)"

# --- Line 1 ------------------------------------------------------------------
$line1 = "   $datetime_str"
$line1 += " | $model_tt $effort_field"
$line1 += " | $usage_tt"
if ($rl_5h_out) { $line1 += " | $rl_5h_out" }
if ($rl_7d_out) { $line1 += " | $rl_7d_out" }
$line1 += " | $cost_tt"

# --- Line 2 ------------------------------------------------------------------
$line2 = "   $dir_tt | $wt_tt | $git_tt"

Write-Output $line1
Write-Output $line2

# --- Rate-limit JSON for external pollers (optional parity) ------------------
if (($null -ne $rl_5h_pct) -and ($null -ne $rl_7d_pct)) {
    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $p5 = [int][math]::Round([double]$rl_5h_pct)
    $p7 = [int][math]::Round([double]$rl_7d_pct)
    $r5 = if ($rl_5h_reset) { $rl_5h_reset } else { 0 }
    $r7 = if ($rl_7d_reset) { $rl_7d_reset } else { 0 }
    $jsonOut = '{{"ts":{0},"five_hour_pct":{1},"five_hour_resets_at":{2},"seven_day_pct":{3},"seven_day_resets_at":{4},"model":"{5}"}}' -f $ts, $p5, $r5, $p7, $r7, $model_id
    try { Set-Content -Path (Join-Path $env:TEMP 'claude_rate_limits.json') -Value $jsonOut -Encoding utf8 } catch {}
}
