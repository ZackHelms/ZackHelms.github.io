#!/usr/bin/env node
// pages-status.cjs — read the Pages deploy verdict out of an oversized
// `mcp__github__actions_list` result.
//
// That call returns ~410 KB for this repo and blows the tool-result limit
// every time, so the harness saves it to a file whose lines are too long for
// Read's offset/limit chunking. Parsing it by hand is a small, recurring,
// error-prone step in the mandatory publish check (.claude/zmh/producer.md
// § Publish): on 2026-08-23 it was re-derived four times in one session and
// the first attempt threw `KeyError: 'conclusion'`, because a run that is
// still going has no such key at all. This exists so nobody guesses the
// shape again.
//
// Usage:
//   node .claude/scripts/pages-status.cjs <saved-result.txt> [sha] [limit]
//
// Without <sha>: prints one RUN line per run, newest first (default 5).
// With <sha> (any prefix): prints that run plus a PAGES= verdict, and exits
// non-zero unless the verdict is `success` — so the publish check is one
// command that fails loudly rather than a snippet whose output you must read.
//
//   RUN sha=430b6472 status=completed conclusion=success updated=2026-08-23T22:22:44Z run=32787908031
//   PAGES=success SHA=430b6472
//
// Verdicts: success | pending (queued/in_progress, or conclusion not yet set)
//           | failed (any other conclusion) | absent (no run for that SHA yet).
// `pending` and `absent` both exit 1: neither is evidence the site is live.
// Status lags at both the run and the job level — a `pending` here is worth
// re-reading a minute later before concluding anything is wrong. See
// .claude/notes/20260817-pages-deploy-wedged-after-503.md.
//
// The `run=` field is the workflow run id, printed because the procedure for a
// run that looks stuck is to read its JOBS (the run object lags behind them),
// and that call needs the id. Without it here, every such check ends in a
// hand-rolled parse of the same file — which is the thing this script exists
// to stop (2026-08-25):
//   mcp__github__actions_list list_workflow_jobs resource_id=<run>
'use strict';
const fs = require('fs');

const [file, sha, limitArg] = process.argv.slice(2);
if (!file) {
  console.error('usage: pages-status.cjs <saved-result.txt> [sha] [limit]');
  process.exit(1);
}
let doc;
try {
  doc = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error('pages-status.cjs: cannot parse ' + file + ' as JSON — ' + e.message);
  process.exit(1);
}
// the MCP result is sometimes the envelope, sometimes the bare array
const runs = Array.isArray(doc) ? doc : (doc.workflow_runs || doc.runs || []);
if (!Array.isArray(runs) || runs.length === 0) {
  console.error('pages-status.cjs: no workflow runs found in ' + file);
  process.exit(1);
}

const line = r => 'RUN sha=' + String(r.head_sha || '').slice(0, 8) +
  ' status=' + (r.status || '?') +
  ' conclusion=' + (r.conclusion == null ? '-' : r.conclusion) +
  ' updated=' + (r.updated_at || '?') +
  ' run=' + (r.id == null ? '?' : r.id) +
  (r.name && !/pages build and deployment/i.test(r.name) ? ' name=' + JSON.stringify(r.name) : '');

if (!sha) {
  const n = Number(limitArg) || 5;
  for (const r of runs.slice(0, n)) console.log(line(r));
  process.exit(0);
}

const hit = runs.find(r => String(r.head_sha || '').startsWith(sha));
if (!hit) {
  console.log('PAGES=absent SHA=' + sha);
  console.error('no "pages build and deployment" run listed for ' + sha + ' — it may not have been queued yet');
  process.exit(1);
}
console.log(line(hit));
const done = hit.status === 'completed';
const verdict = !done || hit.conclusion == null ? 'pending'
  : hit.conclusion === 'success' ? 'success' : 'failed';
console.log('PAGES=' + verdict + ' SHA=' + String(hit.head_sha).slice(0, 8));
process.exit(verdict === 'success' ? 0 : 1);
