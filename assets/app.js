// Tabella client: theme, reveals, reading position, read marks, service worker.
(function () {
  'use strict';

  var rootMeta = document.querySelector('meta[name="tabella-root"]');
  var root = rootMeta ? rootMeta.content : './';

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  // ---- theme ----
  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      if (!cur) cur = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      store.set('tabella:theme', next);
    });
  }

  // ---- reveal all / hide all ----
  function allDetails() {
    return Array.prototype.slice.call(document.querySelectorAll('article details'));
  }
  var revealBtn = document.getElementById('reveal-toggle');
  function updateRevealLabel() {
    var anyClosed = allDetails().some(function (d) { return !d.open; });
    revealBtn.textContent = anyClosed ? 'Reveal all' : 'Hide all';
    revealBtn.setAttribute('aria-pressed', String(!anyClosed));
  }
  if (revealBtn) {
    revealBtn.addEventListener('click', function () {
      var list = allDetails();
      var anyClosed = list.some(function (d) { return !d.open; });
      list.forEach(function (d) { d.open = anyClosed; });
      updateRevealLabel();
    });
    // 'toggle' does not bubble; listen in capture to keep the label honest
    document.addEventListener('toggle', updateRevealLabel, true);
    updateRevealLabel();
  }

  // ---- last-read + scroll restore (doc pages carry data-slug) ----
  var slug = document.body.getAttribute('data-slug');
  if (slug) {
    var h1 = document.querySelector('article h1');
    store.set('tabella:last', JSON.stringify({ slug: slug, title: h1 ? h1.textContent.trim() : slug }));
    var saved = parseInt(store.get('tabella:pos:' + slug) || '0', 10);
    if (saved > 0) window.scrollTo(0, saved);
    var pending = false;
    window.addEventListener('scroll', function () {
      if (pending) return;
      pending = true;
      setTimeout(function () {
        pending = false;
        store.set('tabella:pos:' + slug, String(Math.round(window.scrollY)));
      }, 400);
    }, { passive: true });
    window.addEventListener('pagehide', function () {
      store.set('tabella:pos:' + slug, String(Math.round(window.scrollY)));
    });
  }

  // ---- read marks ----
  function readKey(s) { return 'tabella:read:' + s; }
  function toggleRead(s) {
    if (store.get(readKey(s)) === '1') store.del(readKey(s));
    else store.set(readKey(s), '1');
  }

  var readToggle = document.getElementById('read-toggle');
  if (readToggle && slug) {
    var paintReadToggle = function () {
      var isRead = store.get(readKey(slug)) === '1';
      readToggle.textContent = isRead ? 'Read ✓' : 'Mark as read';
      readToggle.classList.toggle('read', isRead);
    };
    paintReadToggle();
    readToggle.addEventListener('click', function () {
      toggleRead(slug);
      paintReadToggle();
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('.read-mark'), function (btn) {
    var s = btn.getAttribute('data-slug');
    var paint = function () { btn.classList.toggle('read', store.get(readKey(s)) === '1'); };
    paint();
    btn.addEventListener('click', function () {
      toggleRead(s);
      paint();
    });
  });

  // ---- continue-reading card (shelf) ----
  var card = document.getElementById('continue-card');
  if (card) {
    var last = null;
    try { last = JSON.parse(store.get('tabella:last') || 'null'); } catch (e) {}
    if (last && last.slug) {
      card.href = 'docs/' + last.slug + '.html';
      document.getElementById('continue-title').textContent = last.title || last.slug;
      card.hidden = false;
    }
  }

  // ---- print: open every reveal, restore after ----
  var printState = null;
  window.addEventListener('beforeprint', function () {
    var list = allDetails();
    printState = list.map(function (d) { return d.open; });
    list.forEach(function (d) { d.open = true; });
  });
  window.addEventListener('afterprint', function () {
    if (!printState) return;
    allDetails().forEach(function (d, i) { d.open = printState[i]; });
    printState = null;
  });

  // ---- service worker: register, detect updates, offer reload ----
  var toastEl = document.getElementById('toast');
  function showToast(msg, onTap) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    if (onTap) toastEl.addEventListener('click', onTap, { once: true });
  }
  function promptUpdate(worker) {
    showToast('Tabella has been updated — tap to reload', function () {
      worker.postMessage({ type: 'SKIP_WAITING' });
      toastEl.hidden = true;
    });
  }

  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; } // first install, no reload needed
      location.reload();
    });
    navigator.serviceWorker.register(root + 'sw.js').then(function (reg) {
      if (reg.waiting && navigator.serviceWorker.controller) {
        promptUpdate(reg.waiting);
        return;
      }
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', function () {
          if (w.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(w);
        });
      });
      reg.update().catch(function () {});
    }).catch(function () {});
  }
})();
