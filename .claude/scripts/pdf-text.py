#!/usr/bin/env python3
"""pdf-text.py — pull the text out of a PDF the CD attached.

The agent proxy 403s most of the open web from a remote session, so when a
reference page is needed the working intake is: the CD opens it, prints to PDF,
and attaches the file. That arrives as a print rendering of a web page, which
means the text is interleaved with nav, ad blocks and repeated call-to-action
strips — `--split` and `--strip` exist for exactly that.

Two container gotchas this handles so they are not re-derived:

  * `import pypdf` dies with a `pyo3_runtime.PanicException` out of
    cryptography's rust bindings. pypdf only wants cryptography for encrypted
    files, so stubbing the module out before the import is enough.
  * pypdf is not installed by default; `pip install pypdf` works (pypi is in
    the proxy's noProxy list) and this prints the one-line fix if it is absent.

Usage
-----
  python3 .claude/scripts/pdf-text.py doc.pdf                    # all text to stdout
  python3 .claude/scripts/pdf-text.py doc.pdf --out raw.txt      # ... to a file
  python3 .claude/scripts/pdf-text.py doc.pdf --split '^Chapter \\d+\\s*\\|\\s*$'
  python3 .claude/scripts/pdf-text.py doc.pdf --split '...' --section 12
  python3 .claude/scripts/pdf-text.py doc.pdf --strip 'Quote Q&A Quiz' --strip 'Install .* App'

Prints `PDF-TEXT: GREEN pages=<n> chars=<n>` (or RED + exit 1).
"""
import argparse, re, sys

sys.modules.setdefault('cryptography', None)   # see module docstring
try:
    import pypdf
except BaseException as e:   # BaseException: the cryptography failure is a rust panic
    print(f"PDF-TEXT: RED  cannot import pypdf ({e.__class__.__name__}: {e})", file=sys.stderr)
    print("  fix: pip install pypdf", file=sys.stderr)
    raise SystemExit(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf')
    ap.add_argument('--out')
    ap.add_argument('--split', help='regex (MULTILINE) marking the start of each section')
    ap.add_argument('--section', type=int, help='with --split: print only this 1-based section')
    ap.add_argument('--strip', action='append', default=[],
                    help='regex of boilerplate to delete; repeatable')
    a = ap.parse_args()

    try:
        reader = pypdf.PdfReader(a.pdf)
    except Exception as e:
        print(f"PDF-TEXT: RED  cannot open {a.pdf} ({e})", file=sys.stderr)
        raise SystemExit(1)

    pages = [p.extract_text() or '' for p in reader.pages]
    text = '\n'.join(pages)

    # Strip AFTER splitting, never before: boilerplate often shares a line with
    # a section marker, so removing it first joins lines and the ^anchor in
    # --split stops matching. Cost two whole sections the first time.
    def clean(t):
        for pat in a.strip:
            t = re.sub(pat, ' ', t)
        return re.sub(r'[ \t]+', ' ', t).strip()

    if a.split:
        marks = [m.start() for m in re.finditer(a.split, text, re.M)]
        if not marks:
            print(f"PDF-TEXT: RED  --split matched nothing", file=sys.stderr)
            raise SystemExit(1)
        bounds = marks + [len(text)]
        sections = [clean(text[bounds[i]:bounds[i + 1]]) for i in range(len(marks))]
        if a.section is not None:
            if not 1 <= a.section <= len(sections):
                print(f"PDF-TEXT: RED  --section {a.section} outside 1..{len(sections)}", file=sys.stderr)
                raise SystemExit(1)
            out = sections[a.section - 1]
        else:
            out = '\n\n'.join(f'----- section {i + 1} -----\n{s}' for i, s in enumerate(sections))
        print(f"sections={len(sections)}", file=sys.stderr)
    else:
        out = clean(text)

    if a.out:
        open(a.out, 'w').write(out)
        print(f"wrote {a.out}", file=sys.stderr)
    else:
        print(out)
    print(f"PDF-TEXT: GREEN pages={len(pages)} chars={len(text)}", file=sys.stderr)


if __name__ == '__main__':
    main()
