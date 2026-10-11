#!/usr/bin/env python3
"""negtest-copies.py - NEGATIVE TESTS against COPIES of a page, several at a time.

negtest-batch.py breaks the shipping file in place, one break at a time. That is the
right tool for a dozen breaks. For a few hundred it has three costs, all met on
2026-10-10 (CYOA2 step 3, 340 breaks):
  - a run that is interrupted leaves its break LIVE in the shipping file;
  - the suite cannot be edited while a run is going (a half-saved suite fails, and a
    failed run reads as "caught");
  - it is serial: 90 breaks at 25 s each is most of an hour.
This runner never touches the shipping file. Each break is applied to a fresh copy in a
scratch directory, and the suite is pointed at the copy through an environment variable
the suite itself reads.

    python3 .claude/scripts/negtest-copies.py breaks.json --page-env CYOA2_PAGE \\
        [--jobs 2] [--only name,name] [--freeze .claude/tests/drive-cyoa2.cjs] [--log out.log] \\
        -- node .claude/tests/drive-cyoa2.cjs

breaks.json is negtest-batch.py's format: a list of {"name", "file", "old", "new"}, with
"old" found EXACTLY ONCE in "file" and "new" carrying the @negtest marker. Every break in
one run must name the same file.

  --page-env NAME   the variable through which the suite accepts the path of a copy. The
                    suite must support it, and must never print its GREEN line when it
                    is set (drive-cyoa2.cjs: CYOA2_PAGE).
  --jobs N          how many breaks at once (default 2). More than the machine has cores
                    makes timing rows flaky, and a flaky row "catches" breaks it has
                    nothing to do with.
  --freeze PATH     run the suite from a copy of this file (placed beside the original,
                    so its own relative paths still hold) so the original can be edited
                    during the run. PATH must appear in the suite command.
  --only a,b        run just these breaks (re-running the ones that came back MISSED).

Pass the suite's own environment through the caller (CYOA2_ONLY=QS NODE_PATH=... python3 ...).

Output, one line per break as it finishes, then a verdict:
    NEG=<name> VERDICT=caught|CAUGHT-BY-CRASH|MISSED EXIT=<code> fails=<n>
        FAIL <first failing rows>
    NEGCOPIES: GREEN caught=40/40          (exit 0)
    NEGCOPIES: RED missed=<names>          (exit 1)
MISSED means the suite cannot see that failure: write the row that can, then re-run with
--only. CAUGHT-BY-CRASH means the only failure was a timeout or an exception in the suite
itself, not a named row: usually real (the break made something never happen), but read
it, and if the same row "catches" unrelated breaks, the row is flaky, not the code.
A break that no row can ever see may be an EQUIVALENT change (the code it removes is
covered by another guard); say so in the game's context file instead of forcing a row.
"""
import json, os, re, shutil, subprocess, sys, tempfile, threading
from concurrent.futures import ThreadPoolExecutor

ROOT = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True).stdout.strip()
NEGTEST = os.path.join(ROOT, '.claude', 'scripts', 'negtest.sh')


def opt(args, name, default=None):
    if name in args:
        k = args.index(name); v = args[k + 1]; del args[k:k + 2]; return v
    return default


def main():
    if '--' not in sys.argv:
        print('NEGCOPIES=usage: negtest-copies.py <breaks.json> --page-env NAME [--jobs N] [--only a,b] [--freeze PATH] [--log FILE] -- <suite command ...>'); return 1
    cut = sys.argv.index('--'); args, cmd = sys.argv[1:cut], sys.argv[cut + 1:]
    page_env, jobs, only = opt(args, '--page-env'), int(opt(args, '--jobs', '2')), opt(args, '--only')
    freeze, logp = opt(args, '--freeze'), opt(args, '--log')
    if len(args) != 1 or not page_env or not cmd:
        print('NEGCOPIES=usage: a breaks file, --page-env and a suite command are required'); return 1
    breaks = json.load(open(args[0]))
    if only:
        want = set(x for x in only.split(',') if x); unknown = want - {b['name'] for b in breaks}
        if unknown: print('NEGCOPIES=invalid --only names not in the list: ' + ','.join(sorted(unknown))); return 1
        breaks = [b for b in breaks if b['name'] in want]
    files = sorted({b['file'] for b in breaks})
    if len(files) != 1: print('NEGCOPIES=invalid every break in a run must name one file; got ' + ','.join(files)); return 1
    path = os.path.join(ROOT, files[0])
    r = subprocess.run([NEGTEST, 'scan', files[0]], capture_output=True, text=True, cwd=ROOT)
    if r.returncode: print((r.stdout + r.stderr).strip()); print('NEGCOPIES=dirty: a break is live in the shipping file, restore it first'); return 1
    src = open(path).read()
    bad = []
    for b in breaks:
        n = src.count(b['old'])
        if n != 1: bad.append('%s: "old" found %d times in %s' % (b['name'], n, b['file']))
        if '@negtest' not in b['new']: bad.append('%s: "new" lacks the @negtest marker' % b['name'])
    if bad:
        for m in bad: print('NEGCOPIES=invalid ' + m)
        return 1
    work = tempfile.mkdtemp(prefix='negcopies-')
    frozen = None
    if freeze:
        orig = os.path.join(ROOT, freeze) if not os.path.isabs(freeze) else freeze
        if not any(os.path.abspath(os.path.join(ROOT, c)) == os.path.abspath(orig) for c in cmd):
            print('NEGCOPIES=invalid --freeze path is not in the suite command'); return 1
        frozen = os.path.join(os.path.dirname(orig), '.negcopies-%d-%s' % (os.getpid(), os.path.basename(orig)))
        shutil.copy(orig, frozen)
        cmd = [frozen if os.path.abspath(os.path.join(ROOT, c)) == os.path.abspath(orig) else c for c in cmd]
    log = open(logp, 'w') if logp else None
    lock, missed, crashed = threading.Lock(), [], []
    timeout = int(os.environ.get('NEGBATCH_TIMEOUT', '900'))

    def say(s):
        with lock:
            print(s, flush=True)
            if log: log.write(s + '\n'); log.flush()

    def run(b):
        page = os.path.join(work, re.sub(r'[^A-Za-z0-9-]', '_', b['name']) + os.path.splitext(path)[1])
        open(page, 'w').write(src.replace(b['old'], b['new'], 1))
        try:
            p = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT, timeout=timeout, env=dict(os.environ, **{page_env: page}))
            code, out = p.returncode, p.stdout + p.stderr
        except subprocess.TimeoutExpired:
            code, out = 124, '  FAIL crashed: the suite timed out after %ds' % timeout
        os.remove(page)
        fails = [l.strip() for l in out.splitlines() if re.match(r'\s*FAIL\b', l)]
        named = [f for f in fails if not re.search(r'FAIL crashed|Timeout \d+ms exceeded', f)]
        verdict = 'MISSED' if code == 0 else 'caught' if named else 'CAUGHT-BY-CRASH'
        if code == 0: missed.append(b['name'])
        elif not named: crashed.append(b['name'])
        say('NEG=%s VERDICT=%s EXIT=%d fails=%d' % (b['name'], verdict, code, len(fails)) + ''.join('\n    ' + f[:170] for f in fails[:3]))

    try:
        with ThreadPoolExecutor(max(1, jobs)) as ex: list(ex.map(run, breaks))
    finally:
        shutil.rmtree(work, ignore_errors=True)
        if frozen and os.path.exists(frozen): os.remove(frozen)
    if open(path).read() != src: say('NEGCOPIES=changed: the shipping file changed during the run; the copies were of the file as it was at the start')
    if crashed: say('NEGCOPIES: caught only by a crash or a timeout (read these): ' + ','.join(crashed))
    if missed: say('NEGCOPIES: RED caught=%d/%d missed=%s' % (len(breaks) - len(missed), len(breaks), ','.join(missed))); return 1
    say('NEGCOPIES: GREEN caught=%d/%d' % (len(breaks), len(breaks))); return 0


if __name__ == '__main__':
    sys.exit(main())
