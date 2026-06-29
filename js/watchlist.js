/* Watchlist persisted in localStorage. Click a row to load that symbol. */
(function () {
  "use strict";

  var STORAGE_KEY = "marketlens.watchlist.v1";
  var DEFAULTS = ["AAPL", "NVDA"];
  var F = window.MLFormat;
  var onSelect = function () {};

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULTS.slice();
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { /* ignore corrupt storage */ }
    return DEFAULTS.slice();
  }

  function save(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
    catch (e) { /* storage may be unavailable; ignore */ }
  }

  function getList() { return load(); }

  function add(symbol) {
    var sym = String(symbol || "").trim().toUpperCase();
    if (!sym || !/^[A-Z.\-]{1,8}$/.test(sym)) return false;
    var list = load();
    if (list.indexOf(sym) === -1) {
      list.push(sym);
      save(list);
      renderList(sym);
    }
    return true;
  }

  function remove(symbol) {
    var list = load().filter(function (s) { return s !== symbol; });
    save(list);
    renderList();
  }

  // Render rows. Quote chips are filled in lazily/asynchronously.
  function renderList(activeSym) {
    var ul = document.getElementById("watchlist");
    var list = load();
    if (!list.length) {
      ul.innerHTML = '<li class="watchlist__empty">No tickers yet. Add one above.</li>';
      return;
    }
    ul.innerHTML = list.map(function (sym) {
      var active = sym === activeSym ? " is-active" : "";
      return '<li class="watchlist__row' + active + '" data-sym="' +
        F.escapeHtml(sym) + '">' +
        '<span class="watchlist__sym">' + F.escapeHtml(sym) + "</span>" +
        '<span class="watchlist__chg" data-chg="' + F.escapeHtml(sym) +
        '">…</span>' +
        '<button class="watchlist__remove" data-remove="' + F.escapeHtml(sym) +
        '" aria-label="Remove ' + F.escapeHtml(sym) + '">×</button></li>';
    }).join("");

    // Lazily fetch a quote for each row to show its % change.
    list.forEach(function (sym) { fillChange(sym); });
  }

  function fillChange(sym) {
    if (!window.MLApi) return;
    window.MLApi.fetchEndpoint("quote", sym).then(function (res) {
      var q = Array.isArray(res.data) ? res.data[0] : res.data;
      var el = document.querySelector('[data-chg="' + cssEscape(sym) + '"]');
      if (!el || !q) { if (el) el.textContent = "—"; return; }
      var pct = Number(q.changesPercentage);
      el.textContent = F.formatPercent(pct);
      el.classList.add(pct >= 0 ? "is-up" : "is-down");
    });
  }

  function cssEscape(s) { return String(s).replace(/"/g, '\\"'); }

  function setActive(sym) {
    var rows = document.querySelectorAll(".watchlist__row");
    rows.forEach(function (row) {
      row.classList.toggle("is-active", row.getAttribute("data-sym") === sym);
    });
  }

  function init(selectCallback) {
    onSelect = selectCallback || onSelect;

    document.getElementById("watchForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("watchInput");
      if (add(input.value)) input.value = "";
    });

    document.getElementById("watchlist").addEventListener("click", function (e) {
      var removeBtn = e.target.closest("[data-remove]");
      if (removeBtn) {
        e.stopPropagation();
        remove(removeBtn.getAttribute("data-remove"));
        return;
      }
      var row = e.target.closest(".watchlist__row");
      if (row) onSelect(row.getAttribute("data-sym"));
    });

    renderList();
  }

  window.MLWatchlist = {
    init: init, add: add, remove: remove, getList: getList,
    setActive: setActive, render: renderList
  };
})();
