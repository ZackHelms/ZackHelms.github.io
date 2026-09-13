#!/usr/bin/env node
/* Fetch freely-licensed pictures for character-lists entries.
 *
 *   node tools/fetch-images.mjs --dry-run   # no network: validate the manifest
 *   node tools/fetch-images.mjs             # fetch, write files, patch data
 *
 * Needs egress to en.wikipedia.org, commons.wikimedia.org and
 * upload.wikimedia.org. Reads tools/image-sources.json, resolves each article's
 * lead image, REFUSES anything that is not public domain or CC, saves the
 * pre-scaled thumbnail into data/img/<slug>/, records attribution in that
 * folder's CREDITS.md, and writes `img:` into the data file.
 *
 * Safe to re-run: entries that already carry an `img:` are skipped, and any
 * entry that fails for any reason is simply left as a monogram tile.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const WIDTH = 480;
const UA = 'tythos.com-character-lists/1.0 (https://tythos.com/character-lists/)';
const FREE = /^(public domain|pd|cc0|cc by|cc-by|attribution)/i;

const api = async (host, params) => {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ ...params, format: 'json', formatversion: '2' })}`;
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`${host} HTTP ${r.status}`);
  return r.json();
};

/** Escape a name the way the data files quote it inside '...' literals. */
const jsQuote = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function main() {
  const manifest = JSON.parse(await readFile(join(ROOT, 'tools/image-sources.json'), 'utf8'));
  const slugs = Object.keys(manifest).filter(k => !k.startsWith('_'));
  const report = { patched: 0, skipped: 0, missing: 0, unfree: 0, noimage: 0, failed: 0 };

  for (const slug of slugs) {
    const dataPath = join(ROOT, 'data', `${slug}.js`);
    let src = await readFile(dataPath, 'utf8');
    const credits = [];
    let touched = false;

    for (const [name, article] of Object.entries(manifest[slug])) {
      const anchor = `name: '${jsQuote(name)}',`;
      const at = src.indexOf(anchor);
      if (at === -1) { console.log(`  MISSING  ${slug} :: ${name} — no such entry name`); report.missing++; continue; }

      // already has a picture? the img line sits directly under the name line
      const after = src.slice(at + anchor.length, at + anchor.length + 220);
      if (/^\s*(aka:[^\n]*\n)?\s*img:/.test(after)) { report.skipped++; continue; }
      if (DRY) { console.log(`  ready    ${slug} :: ${name}  <- ${article}`); continue; }

      try {
        const page = (await api('en.wikipedia.org', {
          action: 'query', titles: article, prop: 'pageimages',
          piprop: 'thumbnail|name', pithumbsize: String(WIDTH), redirects: '1',
        })).query?.pages?.[0];
        if (!page?.thumbnail?.source || !page?.pageimage) {
          console.log(`  no image ${slug} :: ${name} (${article})`); report.noimage++; continue;
        }

        const info = (await api('commons.wikimedia.org', {
          action: 'query', titles: `File:${page.pageimage}`,
          prop: 'imageinfo', iiprop: 'extmetadata|url',
        })).query?.pages?.[0]?.imageinfo?.[0]?.extmetadata || {};
        const license = (info.LicenseShortName?.value || '').replace(/<[^>]+>/g, '').trim();
        if (!FREE.test(license)) {
          console.log(`  UNFREE   ${slug} :: ${name} — "${license || 'unknown'}" — left as monogram`);
          report.unfree++; continue;
        }

        const ext = (page.thumbnail.source.match(/\.(jpe?g|png|gif|webp)$/i) || ['.jpg'])[0].toLowerCase();
        const id = name.toLowerCase().replace(/["'’“”]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const rel = `data/img/${slug}/${id}${ext}`;
        const bytes = Buffer.from(await (await fetch(page.thumbnail.source, { headers: { 'user-agent': UA } })).arrayBuffer());
        await mkdir(join(ROOT, 'data/img', slug), { recursive: true });
        await writeFile(join(ROOT, rel), bytes);

        const indent = (src.slice(0, at).match(/\n([ \t]*)$/) || [, '      '])[1];
        src = src.slice(0, at + anchor.length) + `\n${indent}img: '${rel}',` + src.slice(at + anchor.length);
        touched = true; report.patched++;

        const author = (info.Artist?.value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        credits.push(`- **${name}** — \`${rel}\`\n  - ${page.pageimage}\n  - ${author || 'author not stated'} · ${license}\n  - https://commons.wikimedia.org/wiki/File:${encodeURIComponent(page.pageimage)}`);
        console.log(`  ok       ${slug} :: ${name}  (${license}, ${(bytes.length / 1024).toFixed(0)} KB)`);
      } catch (e) {
        console.log(`  FAILED   ${slug} :: ${name} — ${e.message}`); report.failed++;
      }
    }

    if (touched) {
      await writeFile(dataPath, src);
      const cp = join(ROOT, 'data/img', slug, 'CREDITS.md');
      const head = `# Image credits — ${slug}\n\nEvery file here is public domain or CC, fetched from Wikimedia Commons\nby \`tools/fetch-images.mjs\`. Attribution is required for the CC ones.\n\n`;
      const prev = existsSync(cp) ? (await readFile(cp, 'utf8')).slice(head.length) : '';
      await writeFile(cp, head + prev + credits.join('\n') + '\n');
    }
  }

  console.log('\n' + (DRY ? 'DRY RUN — ' : '') + Object.entries(report).map(([k, v]) => `${k}=${v}`).join(' '));
  if (report.missing) { console.error('\nmanifest names that match no entry — fix image-sources.json'); process.exit(1); }
}

main().catch(e => { console.error(e); process.exit(1); });
