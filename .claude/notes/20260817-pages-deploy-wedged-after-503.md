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
proxy denies **both** hostnames on CONNECT (403): `tythos.com`, which is the
site's **custom domain** (repo-root `CNAME`) and therefore what the deploy
job's `Evaluated environment url` reports, and `zackhelms.github.io`. Both
re-verified 2026-08-23. So the workflow conclusion is the whole verification,
which is why it has to be read carefully.

`tythos.com` reads like a stray hostname if you have not seen the `CNAME` —
a 2026-08-23 session assumed it was a typo for `zackhelms.github.io` and
started "correcting" it. It is not. The repo publishes to a custom domain.

## Reading the run at all

`mcp__github__actions_list` returns ~410 KB for this repo and blows the tool
result limit every time. The result is saved to a file whose lines are too
long for `Read`'s offset/limit chunking, so parse it in a shell instead:

Use the script rather than retyping a parser — passing a SHA gives a verdict
and a non-zero exit, so the check cannot be misread:

```bash
node .claude/scripts/pages-status.cjs <saved-result-path>          # newest 5 runs
node .claude/scripts/pages-status.cjs <saved-result-path> <sha>    # PAGES=... + exit code
```

Re-deriving it by hand is a trap worth naming: `r['conclusion']` throws on a
run that is still in flight, which is the exact state the check exists to
observe (hit again 2026-08-23, which is why the script exists).

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

---

# The opposite failure: a finished deploy reported `in_progress` for ~25 minutes

Added 2026-09-19, from the character-lists session. The note above is about a
deploy that really was broken. This is the far more common case, and the rule
it produces is the reverse: **do not keep polling.**

## What was seen

Two pushes in one session, both fine, both looking wedged:

| | run 702 (`3c341ee`) | run 703 (`4b333e0`) |
|---|---|---|
| created | 15:02:27 | — |
| build job actually completed | 15:03:49 | — |
| still reporting `in_progress` | for ~25 min of polling | same |
| appeared as `completed / success` | on the next turn, `updated_at` **15:03:49** | later |

The `updated_at` on the returned run was **frozen at 15:02:33** for the whole
polling window and then jumped straight to the true completion time. So the
deploy had finished in about eighty seconds and the API simply kept serving a
stale snapshot for twenty-five.

## What does not help

* **Reading the jobs instead of the run.** § Publish says to prefer
  `list_workflow_jobs`, and for the 2026-08-23 case that was right. Here the
  jobs endpoint lagged too, reporting `Checkout` still running long after it
  had finished.
* **Filtering to `status: 'completed'`.** The obvious workaround — ask only for
  finished runs — was tried and is **not** a fix: the finished run did not show
  up in that listing either until the same lag expired. An earlier session note
  of mine claiming this endpoint "stayed accurate" was wrong and is corrected
  here.
* **Polling harder.** Roughly a dozen calls and forty minutes of wall clock
  across two turns produced no information that waiting would not have.

## The tell, and the rule

The signature of staleness rather than a wedge is a **frozen `updated_at`**: a
genuinely running job advances it every few seconds. A run whose `updated_at`
has not moved in several minutes while `status` stays `in_progress` is a cached
response, not a stuck deploy.

Practical budget: make the narrow `perPage: 1` check once, and if it is still
`in_progress` after **two** checks a few minutes apart, stop. Say in the report
that the push landed and the run had not yet reported green, and name the run
URL. That is an honest and complete report — the 2026-08-23 case above is real,
so "it is probably fine" is not something to assert, but neither is burning the
session's wall clock on an endpoint that is not going to answer.
