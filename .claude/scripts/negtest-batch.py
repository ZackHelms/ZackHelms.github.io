#!/usr/bin/env python3
"""negtest-batch.py - run a list of NEGATIVE TESTS against a suite, one break at a time.

A negative test breaks a shipping file on purpose and proves the suite goes red.
Doing a dozen by hand is where breaks survive: this wraps negtest.sh so every
break is saved, applied, run, and restored-and-verified before the next starts.

    python3 .claude/scripts/negtest-batch.py breaks.json -- node .claude/tests/drive-cyoa.cjs

breaks.json is a list of {"name", "file", "old", "new"}:
  - "old" must occur EXACTLY ONCE in "file" (checked for every break before any runs)
  - "new" must carry the @negtest marker, so negtest.sh scan can find a survivor
Pass the suite's environment through the caller (e.g. NODE_PATH=... python3 ...).

Output, one line per break, then a verdict:
    NEG=<name> VERDICT=caught|MISSED EXIT=<code> <the suite's CHECKS= line>
        FAIL <first failing rows>
    NEGBATCH: GREEN caught=15/15      (exit 0)
    NEGBATCH: RED missed=<names>      (exit 1)
A MISSED break means the suite cannot see that failure: write the row that can,
then re-run just that break. Exit 2 = a restore could not be verified: STOP and
look at the file, the break may still be live.

Written 2026-09-26 after the CYOA session hand-rolled this loop in the scratchpad
four times (9, 4, 1 and 15 breaks). Three of its breaks came back MISSED, and each
was a real hole in the suite, not in the code (see .claude/tests/README.md).
"""
import json, os, re, subprocess, sys

ROOT = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True).stdout.strip()
NEGTEST = os.path.join(ROOT, '.claude', 'scripts', 'negtest.sh')


def sh(*args):
    r = subprocess.run([NEGTEST, *args], capture_output=True, text=True, cwd=ROOT)
    return r.returncode, (r.stdout + r.stderr).strip()


def main():
    if '--' not in sys.argv or sys.argv.index('--') != 2:
        print('NEGBATCH=usage: negtest-batch.py <breaks.json> -- <suite command ...>'); return 1
    breaks, cmd = json.load(open(sys.argv[1])), sys.argv[3:]
    timeout = int(os.environ.get('NEGBATCH_TIMEOUT', '900'))
    bad = []
    for b in breaks:
        path = os.path.join(ROOT, b['file'])
        n = open(path).read().count(b['old']) if os.path.isfile(path) else -1
        if n != 1: bad.append('%s: "old" found %d times in %s' % (b['name'], n, b['file']))
        if '@negtest' not in b['new']: bad.append('%s: "new" lacks the @negtest marker' % b['name'])
    if bad:
        for m in bad: print('NEGBATCH=invalid ' + m)
        return 1
    files = sorted({b['file'] for b in breaks})
    rc, out = sh('scan', *files)
    if rc: print(out); print('NEGBATCH=dirty: a break is already live, restore it first'); return 1
    missed = []
    for b in breaks:
        path = os.path.join(ROOT, b['file'])
        rc, out = sh('save', b['file'])
        if rc: print(out); return 2
        try:
            src = open(path).read()
            open(path, 'w').write(src.replace(b['old'], b['new'], 1))
            try:
                r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT, timeout=timeout)
                code, log = r.returncode, r.stdout + r.stderr
            except subprocess.TimeoutExpired:
                code, log = 124, 'timed out after %ds' % timeout
        finally:
            rc, out = sh('restore', b['file'])
            if rc: print(out); print('NEGBATCH=restore-failed ' + b['name'] + ' - the break may still be live'); return 2
        summary = ([l for l in log.splitlines() if 'CHECKS=' in l] or [log.strip().splitlines()[-1] if log.strip() else ''])[-1]
        caught = code != 0
        if not caught: missed.append(b['name'])
        print('NEG=%s VERDICT=%s EXIT=%d %s' % (b['name'], 'caught' if caught else 'MISSED', code, summary), flush=True)
        for l in [l.strip() for l in log.splitlines() if re.match(r'\s*FAIL\b', l)][:3]:
            print('    ' + l[:160], flush=True)
    rc, out = sh('scan', *files)
    if rc: print(out); return 2
    if missed: print('NEGBATCH: RED missed=' + ','.join(missed)); return 1
    print('NEGBATCH: GREEN caught=%d/%d' % (len(breaks), len(breaks))); return 0


if __name__ == '__main__':
    sys.exit(main())
