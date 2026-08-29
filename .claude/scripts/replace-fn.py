#!/usr/bin/env python3
"""replace-fn.py — replace ONE whole JS function in a single-file game, safely.

These games are 600-4000-line single files, so the standard edit is a span
replacement between two anchors — and `games/CLAUDE.md` records what that costs:
anything that happens to sit *between* the anchors is silently deleted, which
has swallowed a whole painter twice and surfaced only as a `ReferenceError` on
the next test run. The stated rule is "anchor on the start and end of ONE
function". This does that by brace-counting instead of by a pair of anchors you
picked by hand, so the span cannot include a neighbour.

It also sidesteps the second trap these files carry: they mix literal Unicode
(-> and em dashes) with escaped forms (\\u2192, \\u2014), often on adjacent
lines, so a text match typed from memory fails with a zero-count assertion on a
line that looks identical in the terminal. Addressing a function by NAME never
touches that.

Usage
-----
  # read the current function first (always do this before replacing)
  python3 .claude/scripts/replace-fn.py --show games/x/index.html drawHouse

  # replace it with the contents of a file
  python3 .claude/scripts/replace-fn.py games/x/index.html drawHouse new.js

  # or from a python edit script
  import sys; sys.path.insert(0, '.claude/scripts')
  from importlib import import_module
  replace_fn = import_module('replace-fn').replace_fn
  replace_fn('games/x/index.html', 'drawHouse', NEW_SOURCE)

Prints KEY=value and exits non-zero on any failure (function not found, more
than one definition, unbalanced braces). Run
`node .claude/scripts/check-inline-js.cjs <file>` afterwards — this tool
guarantees the SPAN is right, not that what you put in it parses.
"""
import io
import sys


def find_fn(src, name):
    """Return (start, end) byte offsets of `function <name>(...) { ... }`.

    Anchored to a declaration at the start of a line so a call site, a nested
    definition or a mention inside a comment cannot match.
    """
    key = '\nfunction ' + name + '('
    hits = []
    i = src.find(key)
    while i != -1:
        hits.append(i + 1)
        i = src.find(key, i + 1)
    if not hits:
        raise SystemExit('FOUND=0 ERROR=no top-level `function %s(` in the file' % name)
    if len(hits) > 1:
        raise SystemExit('FOUND=%d ERROR=`%s` is defined more than once; disambiguate by hand'
                         % (len(hits), name))
    start = hits[0]
    j, depth, opened = start, 0, False
    while j < len(src):
        c = src[j]
        if c == '{':
            depth += 1
            opened = True
        elif c == '}':
            depth -= 1
            if opened and depth == 0:
                return start, j + 1
        j += 1
    raise SystemExit('ERROR=unbalanced braces after `function %s(` — refusing to write' % name)


def replace_fn(path, name, new_src):
    """Swap one whole function for `new_src`. Returns (old_lines, new_lines)."""
    src = io.open(path, encoding='utf-8').read()
    a, b = find_fn(src, name)
    old = src[a:b]
    if not (old.startswith('function ' + name + '(') and old.endswith('}')):
        raise SystemExit('ERROR=extracted span is not the whole function; refusing to write')
    new_src = new_src.rstrip('\n')
    if not new_src.startswith('function ' + name + '('):
        raise SystemExit('ERROR=replacement does not start with `function %s(` — a rename here '
                         'would leave every call site pointing at nothing' % name)
    io.open(path, 'w', encoding='utf-8').write(src[:a] + new_src + src[b:])
    return len(old.split('\n')), len(new_src.split('\n'))


def main(argv):
    if len(argv) >= 3 and argv[0] == '--show':
        src = io.open(argv[1], encoding='utf-8').read()
        a, b = find_fn(src, argv[2])
        body = src[a:b]
        sys.stdout.write(body + '\n')
        print('FUNCTION=%s LINES=%d LINE_NO=%d'
              % (argv[2], len(body.split('\n')), src[:a].count('\n') + 1), file=sys.stderr)
        return 0
    if len(argv) != 3:
        print(__doc__)
        raise SystemExit('ERROR=usage: replace-fn.py [--show] <file> <fnName> [<new-src-file>]')
    path, name, srcfile = argv
    old_n, new_n = replace_fn(path, name, io.open(srcfile, encoding='utf-8').read())
    print('REPLACED=%s FILE=%s OLD_LINES=%d NEW_LINES=%d' % (name, path, old_n, new_n))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
