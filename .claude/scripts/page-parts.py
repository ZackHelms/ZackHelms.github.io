#!/usr/bin/env python3
"""page-parts.py - split a big single-file page into parts at its section banners, and
join them back BYTE FOR BYTE.

The games here ship as one self-contained HTML file, and the big ones are past 5,000
lines (games/cyoa2/index.html: 5,492 lines, 420 KB). Working on one as a dozen files is
easier on every tool, but parts kept in a session scratchpad have two problems, both met
building CYOA2 (2026-10-09/10): the scratchpad is gone when the container is, and
anything that edits the shipped page directly (stamp-badge.sh does) leaves the parts
behind without a word. So the SHIPPED PAGE stays the source of truth and the parts are a
view of it: split fresh, edit, join, and `check` says whether the two still agree.

    python3 .claude/scripts/page-parts.py split games/cyoa2/index.html <dir> [--at REGEX] [--force]
    python3 .claude/scripts/page-parts.py join  <dir> [--to other.html]
    python3 .claude/scripts/page-parts.py check <dir>

  split   cut the page at every line matching REGEX (default: a banner comment such as
          `/* ============================== ENGINE`, i.e. ^/\\* ={20,}) and at the last
          `</script>` line; write NN-<name>.html|.js into <dir> with a parts.txt manifest
          (the page's path, then one part per line). Refuses a non-empty <dir> without
          --force. Proves the parts join back to the page byte for byte before reporting.
  join    concatenate the parts in manifest order over the page (or --to another path),
          then run check-inline-js.cjs on the result.
  check   do the parts still join to the page? Run it before editing parts that have
          been lying around, and after stamp-badge.sh.

Output is KEY=value, one line:
    SPLIT=games/cyoa2/index.html PARTS=22 DIR=<dir> ROUNDTRIP=identical
    JOINED=games/cyoa2/index.html PARTS=22 BYTES=419934        (then check-inline-js's line)
    PARTS=in-sync PAGE=games/cyoa2/index.html                  (exit 0)
    PARTS=DRIFTED PAGE=... FIRST=<part>:<line>                 (exit 1: the page was edited
                                                                behind the parts, or the
                                                                parts were edited and not
                                                                joined; split --force to
                                                                take the page, join to take
                                                                the parts)
The parts directory is scratch: keep it out of the repo (the session scratchpad).
"""
import os, re, subprocess, sys

ROOT = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True).stdout.strip() or os.getcwd()
DEFAULT_AT = r'^/\* ={20,}'


def die(msg):
    print('PAGE-PARTS=error ' + msg); sys.exit(1)


def manifest(d):
    p = os.path.join(d, 'parts.txt')
    if not os.path.exists(p): die('no parts.txt in ' + d + ' (split first)')
    rows = [l.rstrip('\n') for l in open(p) if l.strip() and not l.startswith('#')]
    return rows[0], rows[1:]


def joined(d, names):
    return b''.join(open(os.path.join(d, n), 'rb').read() for n in names)


def split(page, d, at, force):
    src = open(page, 'rb').read()
    lines = src.splitlines(keepends=True)
    rx = re.compile(at.encode())
    cuts = [k for k, l in enumerate(lines) if rx.search(l)]
    tail = max((k for k, l in enumerate(lines) if l.strip() == b'</script>'), default=None)
    if not cuts: die('no line of ' + page + ' matches ' + at + ' (pass --at REGEX for this page\'s banners)')
    if tail is not None and tail > cuts[-1]: cuts.append(tail)
    if cuts[0] != 0: cuts.insert(0, 0)
    if os.path.isdir(d) and os.listdir(d) and not force: die(d + ' is not empty (--force to replace its parts)')
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        if re.match(r'\d\d-.*\.(html|js)$', f) or f == 'parts.txt': os.remove(os.path.join(d, f))
    names = []
    for n, a in enumerate(cuts):
        b = cuts[n + 1] if n + 1 < len(cuts) else len(lines)
        first = lines[a].decode('utf-8', 'replace')
        if n == 0: name, ext = 'head', 'html'
        elif a == tail: name, ext = 'tail', 'html'
        else:
            # the banner's own words, or the next line's when the banner is a bare rule
            words = re.sub(r'[^A-Za-z0-9]+', ' ', first).strip() or re.sub(r'[^A-Za-z0-9]+', ' ', lines[a + 1].decode('utf-8', 'replace')).strip()
            name, ext = '-'.join(words.lower().split()[:4]) or 'part', 'js'
        fn = '%02d-%s.%s' % (n, name, ext); names.append(fn)
        open(os.path.join(d, fn), 'wb').write(b''.join(lines[a:b]))
    rel = os.path.relpath(os.path.abspath(page), ROOT)
    open(os.path.join(d, 'parts.txt'), 'w').write('# page-parts.py manifest: the page, then its parts in order\n' + rel + '\n' + '\n'.join(names) + '\n')
    if joined(d, names) != src: die('the parts do not join back to the page (a bug in this script: nothing else was touched)')
    print('SPLIT=%s PARTS=%d DIR=%s ROUNDTRIP=identical' % (rel, len(names), d))


def first_difference(d, names, page_bytes):
    want = page_bytes.splitlines(keepends=True); at = 0
    for n in names:
        got = open(os.path.join(d, n), 'rb').read().splitlines(keepends=True)
        for k, l in enumerate(got):
            if at + k >= len(want) or want[at + k] != l: return '%s:%d' % (n, k + 1)
        at += len(got)
    return 'end-of-page:%d' % (at + 1)


def main():
    a = sys.argv[1:]
    force = '--force' in a
    if force: a.remove('--force')
    at, to = DEFAULT_AT, None
    if '--at' in a: k = a.index('--at'); at = a[k + 1]; del a[k:k + 2]
    if '--to' in a: k = a.index('--to'); to = a[k + 1]; del a[k:k + 2]
    if len(a) == 3 and a[0] == 'split': return split(a[1], a[2], at, force)
    if len(a) == 2 and a[0] in ('join', 'check'):
        rel, names = manifest(a[1]); page = to or os.path.join(ROOT, rel); data = joined(a[1], names)
        if a[0] == 'check':
            cur = open(page, 'rb').read()
            if cur == data: print('PARTS=in-sync PAGE=' + rel); return
            print('PARTS=DRIFTED PAGE=%s FIRST=%s' % (rel, first_difference(a[1], names, cur))); sys.exit(1)
        open(page, 'wb').write(data)
        print('JOINED=%s PARTS=%d BYTES=%d' % (to or rel, len(names), len(data)))
        chk = os.path.join(ROOT, '.claude', 'scripts', 'check-inline-js.cjs')
        if os.path.exists(chk):
            r = subprocess.run(['node', chk, page], capture_output=True, text=True)
            print((r.stdout + r.stderr).strip().splitlines()[-1] if (r.stdout + r.stderr).strip() else 'INLINE-JS=no-output')
            sys.exit(r.returncode)
        return
    die('usage: page-parts.py split <page> <dir> [--at REGEX] [--force] | join <dir> [--to path] | check <dir>')


if __name__ == '__main__':
    main()
