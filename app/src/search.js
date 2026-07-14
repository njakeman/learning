// Tabella search: substring match over a folded (macron-insensitive) corpus.
(function () {
  'use strict';

  var input = document.getElementById('search-input');
  var resultsEl = document.getElementById('search-results');
  if (!input || !resultsEl) return;

  var rootMeta = document.querySelector('meta[name="tabella-root"]');
  var root = rootMeta ? rootMeta.content : './';

  var index = null;
  var loading = null;

  // "puella" must find "puellā": strip combining marks, lowercase
  function fold(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Folding can change string length, so build a folded-index -> original-index map
  function prepare(docs) {
    return docs.map(function (d) {
      var text = d.title + '. ' + d.text;
      var folded = [];
      var map = [];
      for (var i = 0; i < text.length; i++) {
        var f = fold(text[i]);
        for (var j = 0; j < f.length; j++) {
          folded.push(f[j]);
          map.push(i);
        }
      }
      return {
        slug: d.slug,
        title: d.title,
        section: d.section,
        text: text,
        folded: folded.join(''),
        map: map,
        titleFolded: fold(d.title)
      };
    });
  }

  function load() {
    if (!loading) {
      loading = fetch(root + 'search-index.json')
        .then(function (r) { return r.json(); })
        .then(function (docs) { index = prepare(docs); });
    }
    return loading;
  }

  input.addEventListener('focus', function () { load(); }, { once: true });

  var timer = null;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(run, 160);
  });

  function run() {
    var q = fold(input.value.trim());
    if (q.length < 2) {
      resultsEl.hidden = true;
      resultsEl.innerHTML = '';
      return;
    }
    load().then(function () {
      var hits = [];
      index.forEach(function (d) {
        var at = d.folded.indexOf(q);
        if (at === -1) return;
        var s0 = d.map[at];
        var s1 = d.map[Math.min(at + q.length - 1, d.map.length - 1)] + 1;
        var from = Math.max(0, s0 - 60);
        var to = Math.min(d.text.length, s1 + 60);
        var snippet =
          (from > 0 ? '…' : '') +
          esc(d.text.slice(from, s0)) +
          '<mark>' + esc(d.text.slice(s0, s1)) + '</mark>' +
          esc(d.text.slice(s1, to)) +
          (to < d.text.length ? '…' : '');
        hits.push({ d: d, inTitle: d.titleFolded.indexOf(q) !== -1, snippet: snippet });
      });
      hits.sort(function (a, b) { return (b.inTitle ? 1 : 0) - (a.inTitle ? 1 : 0); });
      resultsEl.innerHTML = hits.length
        ? hits.slice(0, 30).map(function (h) {
            return '<li><a href="docs/' + h.d.slug + '.html">' + esc(h.d.title) + '</a>' +
              '<span class="result-section">' + esc(h.d.section) + '</span>' +
              '<span class="snippet">' + h.snippet + '</span></li>';
          }).join('')
        : '<li class="no-results">Nihil inventum — nothing found.</li>';
      resultsEl.hidden = false;
    });
  }
})();
