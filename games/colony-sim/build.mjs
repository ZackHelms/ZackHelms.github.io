#!/usr/bin/env node
/**
 * build.mjs — bundles src/ into the single self-contained games/colony-sim/index.html
 * (the repo's one-file-per-game convention; the Interlock pattern without a vendored lib).
 *
 *   node games/colony-sim/build.mjs
 *
 * Edit src/*, never index.html. The sim modules stay plain ES modules so Node can import
 * them directly (tools/test-sim.mjs, tools/run.mjs); here their import/export statements
 * are stripped and every module is concatenated, in dependency order, inside one IIFE.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ORDER = ['rng.js', 'island.js', 'nav.js', 'data.js', 'sim.js', 'rig.js', 'render.js', 'audio.js', 'ui.js', 'main.js'];
const src = (f) => readFileSync(join(here, 'src', f), 'utf8');

const strip = (f) => src(f)
  .replace(/^\s*import\s+[^;]*?\s+from\s*(['"])[^'"]*\1\s*;?/gm, '')
  .replace(/\bexport\s+(?=(?:const|let|var|function|class|async)\b)/g, '');
const missing = ORDER.filter((f) => !existsSync(join(here, 'src', f)));
if (missing.length) throw new Error('missing modules: ' + missing.join(', '));
const js = ORDER.map((f) => '/* ===== ' + f + ' ===== */\n' + strip(f)).join('\n');
for (const bad of [/^\s*import\b.*from/m, /^\s*export\b/m]) {
  if (bad.test(js)) throw new Error('a module statement survived stripping: ' + bad);
}
if (js.includes('</script')) throw new Error('bundle contains a </script — it would close its own tag');

let html = src('page.html');
const once = (needle, replacement) => {
  const i = html.indexOf(needle);
  if (i < 0) throw new Error('page.html: could not find ' + needle);
  if (html.indexOf(needle, i + 1) >= 0) throw new Error('page.html: ambiguous ' + needle);
  html = html.slice(0, i) + replacement + html.slice(i + needle.length);
};
once('<link rel="stylesheet" href="style.css">', '<style>' + src('style.css').trim() + '</style>');
once('<script type="module" src="main.js"></script>', '<script>\n(function(){\n"use strict";\n' + js + '\n})();\n</script>');
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
html = html.replace(/(<div id="build-badge"[^>]*>)[^<]*/, '$1build ' + stamp);
writeFileSync(join(here, 'index.html'), html);
console.log('wrote index.html (' + (html.length / 1024).toFixed(0) + ' KB), badge: build ' + stamp);
