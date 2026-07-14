// Page templates for Tabella. Plain template strings, no engine.

export const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// `root` is the relative path from the page back to the site root ('./' or '../').
function head({ titleText, root }) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titleText)}</title>
<meta name="tabella-root" content="${root}">
<link rel="manifest" href="${root}manifest.webmanifest">
<link rel="icon" href="${root}icons/favicon.png">
<link rel="apple-touch-icon" href="${root}icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Tabella">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#f5eeda" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1c2127" media="(prefers-color-scheme: dark)">
<script>(function(){try{var t=localStorage.getItem('tabella:theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
<link rel="stylesheet" href="${root}assets/styles.css">
<script defer src="${root}assets/app.js"></script>`;
}

function chrome({ root, hasDetails }) {
  return `<header class="chrome">
<a class="wordmark" href="${root}index.html">TABELLA</a>
<div class="controls">${
    hasDetails
      ? `<button id="reveal-toggle" type="button" aria-pressed="false">Reveal all</button>`
      : ''
  }<button id="theme-toggle" type="button" aria-label="Toggle light and dark theme">◐</button></div>
</header>`;
}

const toast = `<div id="toast" class="toast" role="status" hidden></div>`;

function pagerLink(entry, dir) {
  if (!entry) return '<span class="pager-gap"></span>';
  const arrow = dir === 'prev' ? '‹' : '›';
  const label = dir === 'prev' ? `${arrow} prior` : `next ${arrow}`;
  return `<a class="pager-${dir}" href="./${entry.slug}.html"><span class="pager-label">${label}</span>${esc(
    entry.shortTitle
  )}</a>`;
}

export function docPage({ slug, titleText, sectionLabel, bodyHtml, hasDetails, prev, next }) {
  const root = '../';
  return `<!DOCTYPE html>
<html lang="en">
<head>
${head({ titleText: `${titleText} · Tabella`, root })}
</head>
<body class="doc" data-slug="${esc(slug)}">
${chrome({ root, hasDetails })}
<main>
<div class="eyebrow">${esc(sectionLabel)}</div>
<article>
${bodyHtml}
</article>
</main>
<footer class="doc-footer">
<nav class="pager">${pagerLink(prev, 'prev')}${pagerLink(next, 'next')}</nav>
<div class="doc-footer-row">
<button id="read-toggle" type="button" data-slug="${esc(slug)}">Mark as read</button>
</div>
</footer>
${toast}
</body>
</html>
`;
}

export function shelfPage({ sections, colophon }) {
  const root = './';
  const sectionHtml = sections
    .filter((s) => s.items.length)
    .map(
      (s) => `<section class="shelf-section">
<h2>${esc(s.label)}</h2>
<ol class="shelf-list">
${s.items
  .map(
    (it) => `<li><a href="docs/${esc(it.slug)}.html" data-slug="${esc(it.slug)}">${
      it.shortTitleHtml
    }</a><button class="read-mark" type="button" data-slug="${esc(
      it.slug
    )}" aria-label="Toggle read mark"></button></li>`
  )
  .join('\n')}
</ol>
</section>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
${head({ titleText: 'Tabella · a Latin library', root })}
<script defer src="${root}assets/search.js"></script>
</head>
<body class="shelf">
${chrome({ root, hasDetails: false })}
<main>
<header class="frontis">
<h1>TABELLA</h1>
<div class="gloss-title">a Latin library, carried in the hand</div>
<div class="seam" aria-hidden="true"></div>
</header>
<a id="continue-card" class="continue-card" href="#" hidden>
<span class="continue-label">Continue reading</span>
<span id="continue-title" class="continue-title"></span>
</a>
<div class="search">
<input id="search-input" type="search" placeholder="Quaere in bibliothēcā…" aria-label="Search the library" autocomplete="off">
<ol id="search-results" class="search-results" hidden></ol>
</div>
${sectionHtml}
</main>
<footer class="shelf-footer">
<a href="drills.html">The Drills</a>
<span class="dot">·</span>
${colophon ? `<a href="docs/${esc(colophon.slug)}.html">${esc(colophon.shortTitle)}</a>` : ''}
</footer>
${toast}
</body>
</html>
`;
}

export function drillsPage({ entries, hasDetails }) {
  const root = './';
  const body = entries
    .map(
      (e) => `<section class="drill-entry">
<h2><a href="docs/${esc(e.slug)}.html">${e.shortTitleHtml}</a></h2>
${e.drillHtml}
</section>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
${head({ titleText: 'The Drills · Tabella', root })}
</head>
<body class="doc drills">
${chrome({ root, hasDetails })}
<main>
<div class="eyebrow">Tabella</div>
<article>
<h1>The Drills</h1>
<p class="drills-note"><em>Every volume's closing drill, gathered in shelf order. Tap a heading to return to its volume.</em></p>
${body}
</article>
</main>
${toast}
</body>
</html>
`;
}

// Fully self-contained: the service worker may serve this at ANY url when
// offline, so relative links to assets would break. Everything is inline.
export function offlinePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Offline · Tabella</title>
<style>
:root { --bg: #f5eeda; --text: #3a2f22; --soft: #7a6a52; --accent: #8c2f1b; --rule: #d8cdb4; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #242a31; --text: #e9e1cb; --soft: #b3aa93; --accent: #c2a15a; --rule: #454d56; }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: Georgia, 'Times New Roman', serif;
  background: var(--bg);
  color: var(--text);
  text-align: center;
  padding: 5rem 1.5rem;
  line-height: 1.7;
}
h1 { font-weight: 600; font-size: 2rem; letter-spacing: 0.28em; text-indent: 0.28em; }
.seam { color: var(--soft); font-size: 0.65rem; letter-spacing: 0.9em; text-indent: 0.9em; margin: 1.4rem 0 2.4rem; }
p { max-width: 34rem; margin: 0 auto 1rem; color: var(--soft); }
button {
  font: inherit;
  margin-top: 1rem;
  color: var(--accent);
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 0.35rem 1.3rem;
  cursor: pointer;
}
</style>
</head>
<body>
<h1>TABELLA</h1>
<div class="seam" aria-hidden="true">◆ ◆ ◆ ◆ ◆</div>
<p>You're offline, and this page isn't in the library's cache — iOS may have cleared it after long disuse.</p>
<p>Reconnect to the internet, then reopen Tabella; the whole library will be fetched afresh and reading can carry on without signal.</p>
<button type="button" onclick="location.reload()">Try again</button>
</body>
</html>
`;
}
