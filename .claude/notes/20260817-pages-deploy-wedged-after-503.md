# A Pages deploy can wedge after a 503 — and then refuse both cancel and re-run

From the 2026-08-17 session that shipped the Turret Builder redesign
(`08a9719`). The producer config already says verification is mandatory
because "`git push` ≠ live"; this records the failure mode that rule exists
for, and the one recovery that actually works when the obvious ones don't.

## What happened

`git push` to `main` succeeded. The "pages build and deployment" run started
normally and its **build** job passed — checkout and artifact upload both
green. The **deploy** job then failed in under two seconds:

```
##[error]Creating Pages deployment failed
##[error]HttpError: No server is currently available to service your request.
##[error]Error: Failed to create deployment (status: 503) with build version 08a9719…
  Server error, is githubstatus.com reporting a Pages outage?
  Please re-run the deployment at a later time.
```

So the artifact was fine and only the deployment-creation API call was
refused. **The site kept serving the previous deploy**, which is exactly the
silent-staleness the verification rule guards against: nothing in the repo,
the build, or the push was wrong, and a session that stopped at "push OK"
would have reported a live site that was an hour out of date.

## The trap: `rerun_failed_jobs` can wedge the run

Calling `rerun_failed_jobs` returned `201 Created` and flipped the run's
top-level status from `completed/failure` to `queued`. It then sat there for
**59 minutes** without starting, with `run_attempt` still `1` and all three
jobs still showing their original attempt-1 results.

In that state GitHub refuses every other lever:

| attempt | response |
| --- | --- |
| `rerun_workflow_run` | `403 This workflow is already running` |
| `cancel_workflow_run` | `409 Cannot cancel a workflow re-run that has not yet queued` |

A `201` from `rerun_failed_jobs` is therefore **not** evidence that a re-run
started. Check `run_attempt` and the per-job `status`/`conclusion`
(`list_workflow_jobs` with `filter: all`), not just the run-level `status` —
the run-level `queued` was actively misleading here.

## What actually works: push again

A new commit to `main` creates a **fresh run id**, independent of the wedged
one, so it is the only recovery available from a session that cannot click
around the Actions tab. Prefer pushing something real over an empty commit —
this note was that something.

Order of escalation, cheapest first:

1. Wait a few minutes and re-check. Genuine transients clear on their own.
2. `rerun_failed_jobs` **once**, then verify `run_attempt` actually advanced.
3. If it wedges: do **not** keep hammering cancel/re-run, both will 4xx.
   Push a new commit to `main` and verify the new run instead.

## Reporting rule this reinforces

Never say a page is live off a successful `git push`, and never off a `201`
from a re-run call either. The only sufficient evidence is a
"pages build and deployment" run **for that SHA** concluding `success`. In
this environment the live page cannot be fetched to double-check — the agent
proxy denies `tythos.com` (403 on CONNECT) — so the workflow conclusion is
the whole verification, which is why it has to be read carefully.

## Reading the run at all

`mcp__github__actions_list` returns ~410 KB for this repo and blows the tool
result limit every time. The result is saved to a file whose lines are too
long for `Read`'s offset/limit chunking, so parse it in a shell instead:

```bash
python3 -c "
import json
d=json.load(open('<saved-result-path>'))
for r in (d.get('workflow_runs') or [])[:3]:
    print(r.get('head_sha','')[:7], r.get('status'), r.get('conclusion'),
          'attempt', r.get('run_attempt'), 'id', r.get('id'))
"
```

`mcp__github__get_job_logs` with `failed_only: true`, `return_content: true`
and a small `tail_lines` is compact enough to read directly, and is how the
503 above was identified.

**Status lags — at BOTH levels. The job log is the ground truth.**
Two stale readings on 2026-08-23, an hour apart:

- `actions_get` on run `32652317671` kept reporting `status: in_progress`
  while `list_workflow_jobs` showed all three jobs `completed` / `success`.
  So far so good: read the jobs, not the run.
- Then run `32653410491` showed its **deploy job** as `in_progress` for about
  **nine minutes after it had actually finished**. Its log ended
  `17:01:39 Reported success!` / `Evaluated environment url: https://tythos.com/`
  and `list_workflow_jobs` was still saying `in_progress` at ~17:11. A deploy
  that normally takes 21 seconds appearing to hang for nine minutes looks
  exactly like the 503 wedge above — and the note's own advice for a wedge is
  "push again", which here would have been a pointless commit chasing a
  reporting lag.

So the escalation order is: parse the saved run listing → find the run for
your SHA → `list_workflow_jobs` → **and the moment a job looks stuck, read
that job's log before concluding anything.**

```
mcp__github__get_job_logs  job_id=<deploy job>  return_content=true  tail_lines=25
```

is ~1 KB and ends with `Reported success!` when the deploy is genuinely done.
Never diagnose a wedge, and never re-push, off a status field alone.
`list_workflow_jobs` with a run ID is small enough to come back in a tool
result, unlike the repo-wide run listing.
