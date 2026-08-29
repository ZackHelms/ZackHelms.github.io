#!/usr/bin/env node
/**
 * check-inline-js.cjs — parse-check the inline <script> of a single-file game.
 *
 * These games keep 600-4000 lines of JS inside one <script> in the HTML, so a
 * syntax error is invisible to every text tool and only shows up when a browser
 * refuses to run the page. The smoke gate catches it, but it costs a Chromium
 * launch (~2 s per page) and reports it as a page error rather than a line
 * number. This costs ~100 ms and points at the line.
 *
 * Use it as the inner loop after every block edit; the smoke gate stays the
 * hard gate before committing (a page can parse fine and still throw on load).
 *
 * Usage:
 *   node .claude/scripts/check-inline-js.cjs games/fire-clicker/index.html [more.html ...]
 *
 * Prints one `OK=<file>` / `FAIL=<file>` line per page and a final
 * `INLINE-JS: GREEN|RED`; exits 0/1.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node .claude/scripts/check-inline-js.cjs <page.html> [...]');
  process.exit(2);
}

let bad = 0;
for (const f of files) {
  if (!fs.existsSync(f)) { console.log('FAIL=' + f + ' reason=missing'); bad++; continue; }
  const html = fs.readFileSync(f, 'utf8');
  /* Only inline blocks: a `src=` script has no body to check, and skipping it
     keeps this honest about what it covered. */
  const blocks = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!blocks.length) { console.log('OK=' + f + ' blocks=0 (no inline script)'); continue; }
  let ok = true;
  blocks.forEach((m, i) => {
    /* Line offset so the reported line matches the HTML file, not the extracted
       fragment — the whole point is to be able to jump straight to it. */
    const before = html.slice(0, m.index + m[0].indexOf(m[1]));
    const lineOffset = before.split('\n').length - 1;
    try {
      // Parse only; nothing is executed. `new vm.Script` throws on bad syntax.
      new vm.Script(m[1], { filename: f, lineOffset });
    } catch (e) {
      ok = false;
      const where = (e.stack || '').split('\n').slice(0, 3).join(' | ');
      console.log('FAIL=' + f + ' block=' + i + ' ' + e.message);
      if (where) console.log('   ' + where);
    }
  });
  if (ok) console.log('OK=' + f + ' blocks=' + blocks.length);
  else bad++;
}
console.log('INLINE-JS: ' + (bad ? 'RED' : 'GREEN'));
process.exit(bad ? 1 : 0);
