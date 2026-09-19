#!/usr/bin/env node
/**
 * build.mjs — bundles src/ into the single self-contained games/interlock/index.html
 * that this repo's game convention (games/CLAUDE.md § Adding a New Game) asks for.
 *
 *   cd games/interlock && node build.mjs
 *
 * Edit src/*, never index.html. Three.js ships as an ES module whose ~450 top-level
 * minified identifiers (t, e, n, i, r, s ...) collide with the game's own, so the
 * two cannot simply be concatenated: three stays at module top level with its
 * `export{...}` rewritten into one namespace object, and the game's four modules go
 * inside an IIFE that closes over it. Nested scope means the game's `s`, `t` and
 * friends shadow three's rather than redeclaring them.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(here, 'src', f), 'utf8');
const NS = 'THREE_NS';

/* ---- three.js: export{a as B,...} -> const THREE_NS={B:a,...} ---- */
const three = src('vendor/three.module.min.js');
const at = three.lastIndexOf('export{');
if (at < 0) throw new Error('three.module.min.js: no export statement found');
if (three.slice(0, at).includes('export')) throw new Error('three.module.min.js: unexpected extra export');
const list = three.slice(at + 'export{'.length, three.lastIndexOf('}'));
const pairs = list.split(',').map((entry) => {
  const m = /^\s*([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*$/.exec(entry);
  if (!m) throw new Error('three.module.min.js: unparsable export entry ' + JSON.stringify(entry));
  return (m[2] || m[1]) + ':' + m[1];
});
const threeJs = three.slice(0, at) + 'const ' + NS + '={' + pairs.join(',') + '};';

/* ---- the game's own modules, import/export statements stripped ---- */
const strip = (f) => src(f)
  .replace(/import\s+[^;\n]*?\s+from\s*(['"])[^'"]*\1\s*;?/g, '')
  .replace(/\bexport\s+(?=(?:const|let|var|function|class)\b)/g, '');
const gameJs = ['puzzle.js', 'world.js', 'audio.js', 'game.js'].map(strip).join('\n');
for (const bad of [/^\s*import\b/m, /^\s*export\b/m]) {
  if (bad.test(gameJs)) throw new Error('a module statement survived stripping: ' + bad);
}

const bundle = threeJs + '\n(function(){\nconst T=' + NS + ';\n' + gameJs + '\n})();\n';
if (bundle.includes('</script')) throw new Error('bundle contains a </script — it would close its own tag');

/* ---- page ---- */
let html = src('page.html');
const once = (needle, replacement) => {
  const i = html.indexOf(needle);
  if (i < 0) throw new Error('page.html: could not find ' + needle);
  if (html.indexOf(needle, i + 1) >= 0) throw new Error('page.html: ambiguous ' + needle);
  html = html.slice(0, i) + replacement + html.slice(i + needle.length);
};
once('<link rel="stylesheet" href="style.css">', '<style>' + src('style.css').trim() + '</style>');
once('<script type="module" src="game.js"></script>', '<script type="module">\n' + bundle + '</script>');

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
once('>build PENDING<', '>build ' + stamp + '<');

writeFileSync(join(here, 'index.html'), html);
console.log('wrote index.html (' + (html.length / 1024).toFixed(0) + ' KB), badge: build ' + stamp);
