// Tabella build: markdown library -> static offline-first PWA in dist/.
// Run from anywhere: node app/build.mjs

import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { docPage, shelfPage, drillsPage, offlinePage } from './src/template.mjs';

const APP = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(APP, '..');
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(APP, 'src');

const CONTENT_DIRS = ['LatinLessons', 'vignettes'];
const ROOT_FILES = ['latin-learning-preferences.md'];
const EXCLUDE = new Set(['Test']);

const SECTIONS = {
  reference: { label: 'I · The Reference Spine', order: 1 },
  lectio: { label: 'II · Lectiōnēs', order: 2 },
  vignette: { label: 'III · Vignettes', order: 3 },
  colophon: { label: 'Colophon', order: 4 },
};

const overrides = JSON.parse(await readFile(path.join(APP, 'order-overrides.json'), 'utf8'));

// ---------- enumerate ----------

const files = [];
for (const dir of CONTENT_DIRS) {
  for (const name of await readdir(path.join(ROOT, dir))) {
    if (EXCLUDE.has(name) || !name.endsWith('.md')) continue;
    files.push({ name, filePath: path.join(ROOT, dir, name) });
  }
}
for (const name of ROOT_FILES) {
  files.push({ name, filePath: path.join(ROOT, name) });
}

// ---------- classify + order ----------

function classify(name) {
  let m = /^latin-vol(\d+)([a-z]?)-/.exec(name);
  if (m) {
    return {
      section: 'reference',
      sort: Number(m[1]) * 100 + (m[2] ? m[2].charCodeAt(0) - 96 : 0),
    };
  }
  if (/^lectio/i.test(name)) {
    const n = /\d+/.exec(name);
    return { section: 'lectio', sort: n ? Number(n[0]) : 9999 };
  }
  if (ROOT_FILES.includes(name)) return { section: 'colophon', sort: 0 };
  return { section: 'vignette', sort: null }; // alphabetical within vignettes
}

for (const f of files) {
  const derived = classify(f.name);
  const o = overrides[f.name] ?? {};
  f.section = o.section ?? derived.section;
  f.sort = o.sort ?? derived.sort;
  f.slug = f.name.replace(/\.md$/, '');
}

// vignettes without an explicit sort fall back to filename order
for (const f of files) {
  if (f.sort === null) f.sort = f.name;
}

files.sort((a, b) => {
  const s = SECTIONS[a.section].order - SECTIONS[b.section].order;
  if (s !== 0) return s;
  if (a.sort < b.sort) return -1;
  if (a.sort > b.sort) return 1;
  return 0;
});

// fail loudly on ordering collisions within a section
for (let i = 1; i < files.length; i++) {
  const a = files[i - 1];
  const b = files[i];
  if (a.section === b.section && a.sort === b.sort) {
    throw new Error(
      `Ordering collision in section "${a.section}": ${a.name} and ${b.name} both sort as ${JSON.stringify(
        a.sort
      )}. Add an entry to app/order-overrides.json.`
    );
  }
}

// ---------- markdown ----------

const md = new MarkdownIt({ html: true, linkify: false, typographer: false });

md.renderer.rules.table_open = () => '<div class="table-scroll">\n<table>\n';
md.renderer.rules.table_close = () => '</table>\n</div>\n';

const stripTags = (s) => s.replace(/<[^>]*>/g, '');
const decodeEntities = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

// Mark asides/notes/envoi verse and the opening drop cap on the parsed tokens,
// so the styling survives with client JS disabled.
function classifyTokens(tokens) {
  let currentH2 = '';
  let dropcapPending = false;
  let dropcapDone = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'heading_open') {
      const inline = tokens[i + 1];
      const text = inline && inline.type === 'inline' ? inline.content.trim() : '';
      if (t.tag === 'h1') dropcapPending = true;
      if (t.tag === 'h2') currentH2 = text;
      continue;
    }
    if (dropcapPending && !dropcapDone && t.type === 'paragraph_open' && t.level === 0) {
      const inline = tokens[i + 1];
      const c = inline && inline.type === 'inline' ? inline.content : '';
      // skip italic datelines and anything starting with markup
      if (c && !/^[*_<>`[]/.test(c)) t.attrJoin('class', 'dropcap');
      dropcapDone = true;
    }
    if (t.type === 'blockquote_open' && t.level === 0) {
      let j = i + 1;
      let depth = 1;
      let firstInline = null;
      while (j < tokens.length && depth > 0) {
        if (tokens[j].type === 'blockquote_open') depth++;
        else if (tokens[j].type === 'blockquote_close') depth--;
        else if (!firstInline && tokens[j].type === 'inline') firstInline = tokens[j];
        j++;
      }
      const c = firstInline ? firstInline.content : '';
      if (/^\*\*Aside\b/.test(c)) t.attrJoin('class', 'callout aside');
      else if (/^\*\*[^*\n]{1,60}?[.—:]\s*\*\*/.test(c)) t.attrJoin('class', 'callout note');
      else if (/^envoi$/i.test(currentH2)) {
        t.attrJoin('class', 'envoi');
        // verse: each "> line" of the source keeps its own line
        for (let k = i + 1; k < j; k++) {
          if (tokens[k].type === 'inline' && tokens[k].children) {
            for (const ch of tokens[k].children) {
              if (ch.type === 'softbreak') ch.type = 'hardbreak';
            }
          }
        }
      }
    }
  }
}

function plainText(tokens) {
  const out = [];
  for (const t of tokens) {
    if (t.type === 'inline') {
      for (const ch of t.children) {
        if (ch.type === 'text' || ch.type === 'code_inline') out.push(ch.content);
        else if (ch.type === 'softbreak' || ch.type === 'hardbreak') out.push(' ');
      }
      out.push(' ');
    } else if (t.type === 'html_block') {
      out.push(stripTags(t.content), ' ');
    } else if (t.type === 'fence' || t.type === 'code_block') {
      out.push(t.content, ' ');
    }
  }
  return decodeEntities(out.join('')).replace(/\s+/g, ' ').trim();
}

function extractDrill(tokens) {
  let start = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (
      tokens[i].type === 'heading_open' &&
      tokens[i].tag === 'h2' &&
      tokens[i + 1] &&
      tokens[i + 1].content.trim().toLowerCase() === 'the drill'
    ) {
      start = i + 3; // skip heading_open, inline, heading_close
      break;
    }
  }
  if (start === -1) return null;
  let end = tokens.length;
  for (let i = start; i < tokens.length; i++) {
    if (tokens[i].type === 'heading_open' && (tokens[i].tag === 'h1' || tokens[i].tag === 'h2')) {
      end = i;
      break;
    }
  }
  return tokens.slice(start, end);
}

// ---------- parse and render every document ----------

for (const f of files) {
  const src = await readFile(f.filePath, 'utf8');
  const h1 = /^# (.+)$/m.exec(src);
  if (!h1) throw new Error(`${f.name}: no H1 found — every document needs a "# Title" first line.`);
  f.titleHtml = md.renderInline(h1[1].trim());
  f.titleText = decodeEntities(stripTags(f.titleHtml));
  f.shortTitle = f.titleText.replace(/^Latin Reference\s*—\s*/, '').replace(/^Latin Library\s*—\s*/, '');
  f.shortTitleHtml = f.titleHtml
    .replace(/^Latin Reference\s*—\s*/, '')
    .replace(/^Latin Library\s*—\s*/, '');

  const tokens = md.parse(src, {});
  classifyTokens(tokens);
  f.bodyHtml = md.renderer.render(tokens, md.options, {});
  f.searchText = plainText(tokens);
  f.hasDetails = /<details[\s>]/.test(f.bodyHtml);

  const opens = (f.bodyHtml.match(/<details[\s>]/g) || []).length;
  const closes = (f.bodyHtml.match(/<\/details>/g) || []).length;
  if (opens !== closes) {
    throw new Error(`${f.name}: unbalanced <details> after render (${opens} open, ${closes} close).`);
  }

  const drillTokens = extractDrill(tokens);
  f.drillHtml = drillTokens ? md.renderer.render(drillTokens, md.options, {}) : null;
}

// ---------- write output ----------

await rm(DIST, { recursive: true, force: true });
await mkdir(path.join(DIST, 'docs'), { recursive: true });

const readable = files.filter((f) => f.section !== 'colophon');
const colophon = files.find((f) => f.section === 'colophon') ?? null;
const pagerOrder = colophon ? [...readable, colophon] : readable;

for (let i = 0; i < pagerOrder.length; i++) {
  const f = pagerOrder[i];
  const html = docPage({
    slug: f.slug,
    titleText: f.shortTitle,
    sectionLabel: `Tabella · ${SECTIONS[f.section].label.replace(/^[IVX]+ · /, '')}`,
    bodyHtml: f.bodyHtml,
    hasDetails: f.hasDetails,
    prev: i > 0 ? pagerOrder[i - 1] : null,
    next: i < pagerOrder.length - 1 ? pagerOrder[i + 1] : null,
  });
  await writeFile(path.join(DIST, 'docs', `${f.slug}.html`), html);
}

const sections = ['reference', 'lectio', 'vignette'].map((key) => ({
  label: SECTIONS[key].label,
  items: files.filter((f) => f.section === key),
}));
await writeFile(path.join(DIST, 'index.html'), shelfPage({ sections, colophon }));

const drillEntries = readable.filter((f) => f.drillHtml);
await writeFile(
  path.join(DIST, 'drills.html'),
  drillsPage({ entries: drillEntries, hasDetails: drillEntries.some((e) => /<details[\s>]/.test(e.drillHtml)) })
);

await writeFile(path.join(DIST, 'offline.html'), offlinePage());

const searchIndex = pagerOrder.map((f) => ({
  slug: f.slug,
  title: f.shortTitle,
  section: SECTIONS[f.section].label,
  text: f.searchText,
}));
await writeFile(path.join(DIST, 'search-index.json'), JSON.stringify(searchIndex));

await mkdir(path.join(DIST, 'assets'), { recursive: true });
for (const asset of ['styles.css', 'app.js', 'search.js']) {
  await cp(path.join(SRC, asset), path.join(DIST, 'assets', asset));
}
await cp(path.join(SRC, 'fonts'), path.join(DIST, 'assets', 'fonts'), { recursive: true });
await cp(path.join(SRC, 'icons'), path.join(DIST, 'icons'), { recursive: true });
await cp(path.join(SRC, 'manifest.webmanifest'), path.join(DIST, 'manifest.webmanifest'));
await writeFile(path.join(DIST, '.nojekyll'), '');

// ---------- service worker: version hash + precache list ----------

async function walk(dir, base = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await walk(path.join(dir, entry.name), rel)));
    else out.push(rel);
  }
  return out.sort();
}

const outputFiles = (await walk(DIST)).filter((p) => p !== 'sw.js');
const hash = createHash('sha256');
for (const rel of outputFiles) {
  hash.update(rel);
  hash.update('\0');
  hash.update(await readFile(path.join(DIST, rel)));
}
const version = `tabella-${hash.digest('hex').slice(0, 12)}`;

const precache = ['./', ...outputFiles.filter((p) => p !== '.nojekyll').map((p) => `./${p}`)];
const swTemplate = await readFile(path.join(SRC, 'sw.js'), 'utf8');
const sw = swTemplate
  .replace('__VERSION__', version)
  .replace('__PRECACHE__', JSON.stringify(precache, null, 1));
await writeFile(path.join(DIST, 'sw.js'), sw);

console.log(`Tabella built: ${pagerOrder.length} documents, ${outputFiles.length + 1} files, ${version}`);
console.log('Shelf order:');
for (const f of files) console.log(`  [${f.section}] ${f.slug} — ${f.shortTitle}`);
