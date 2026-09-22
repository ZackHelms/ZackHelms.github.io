# carbon-footprint - Claude instructions

Scoped to this directory. Read `README.md` first, and `METHODOLOGY.md` before touching
any number.

1. **Single file per page.** `index.html` and `baseline/index.html` keep all CSS and JS
   inline. No split-out files, no build step, no framework, no npm dependency.
2. **No PII, ever.** The household is "two adults and a child", nothing more specific.
   Never add real names, family roles, the child's gender or age, the school, what a
   trip is for, drive times, the town or neighbourhood, employers or routes, in page
   copy, element ids, docs or commit messages. The repo is public and git history is
   permanent.
3. **ASCII only** in markup and copy: straight quotes, plain hyphens, no em dashes, no
   curly quotes, no degree symbols (write `350F`).
4. **Labels are load bearing.** Every displayed number keeps its `source: X` /
   `inferred` / `assumed` tag. Never add a figure without one; never strip one to tidy.
5. **Numbers move with the methodology.** A changed factor or estimate updates
   `METHODOLOGY.md` in the same commit, including where the new value came from.
6. **No runtime network calls,** no storage APIs, no analytics, no tracking. The only
   external request is the Google Fonts stylesheet.
7. **Style is Almanac** (`.claude/styles/almanac.md`). Do not convert these pages to the
   neon arcade look. Preserve dark mode (`prefers-color-scheme` plus
   `:root[data-theme]`), the `overflow-x: auto` table wrappers, and layout down to 320 px.
8. **Tone** is plain and skeptical: ranges over single numbers, labels over confidence.

Before finishing any change, run the verification checklist in `README.md`.
