/* Watchlist persisted in localStorage. Click a row to load that symbol.
 * Rendered as the design-system table: symbol over company, 64x24 sparkline
 * colored by net direction, right-aligned price, and a colored % pill. */
(function () {
  "use strict";

  var STORAGE_KEY = "marketlens.watchlist.v1";
  var DEFAULTS = ["AAPL", "NVDA"];
  var SUGGESTIONS = ["AAPL", "TSLA", "NVDA", "MSFT"];
  var UP = "#16C784", DOWN = "#F23645";
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

  function emptyHtml() {
    var chips = SUGGESTIONS.map(function (s) {
      return '<button type="button" data-suggest="' + F.escapeHtml(s) + '">' +
        F.escapeHtml(s) + "</button>";
    }).join("");
    return '<li class="wl-empty">' +
      '<div class="wl-empty__title">Add your first symbol</div>' +
      '<div class="wl-empty__sub">Track tickers you care about here.</div>' +
      '<div class="wl-suggest">' + chips + "</div></li>";
  }

  // Render rows. Price / change / sparkline are filled in asynchronously.
  function renderList(activeSym) {
    var ul = document.getElementById("watchlist");
    if (!ul) return;
    var list = load();
    if (!list.length) {
      ul.innerHTML = emptyHtml();
      return;
    }
    ul.innerHTML = list.map(function (sym) {
      var active = sym === activeSym ? " is-active" : "";
      var s = F.escapeHtml(sym);
      return '<li class="wl-row' + active + '" data-sym="' + s + '">' +
        '<span class="wl-id"><span class="wl-sym">' + s + "</span>" +
        '<span class="wl-co" data-co="' + s + '">—</span></span>' +
        '<span class="wl-spark" data-spark="' + s + '"></span>' +
        '<span class="wl-price num" data-price="' + s + '">—</span>' +
        '<span class="wl-pill num" data-chg="' + s + '">…</span>' +
        '<button class="wl-remove" data-remove="' + s +
        '" aria-label="Remove ' + s + '"><i data-lucide="x"></i></button></li>';
    }).join("");

    if (window.lucide) window.lucide.createIcons();
    list.forEach(function (sym) { fillRow(sym); });
  }

  // Build a tiny inline SVG sparkline from a closes series.
  function sparkSvg(closes, up) {
    if (!closes || closes.length < 2) return "";
    var w = 64, h = 24, pad = 2;
    var min = Math.min.apply(null, closes), max = Math.max.apply(null, closes);
    var span = max - min || 1;
    var step = (w - pad * 2) / (closes.length - 1);
    var pts = closes.map(function (c, i) {
      var x = pad + i * step;
      var y = pad + (h - pad * 2) * (1 - (c - min) / span);
      return x.toFixed(1) + "," + y.toFixed(1);
    });
    var color = up ? UP : DOWN;
    var last = pts[pts.length - 1].split(",");
    return '<svg viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h +
      '" fill="none"><polyline points="' + pts.join(" ") +
      '" stroke="' + color + '" stroke-width="1.5" stroke-linejoin="round" ' +
      'stroke-linecap="round"/><circle cx="' + last[0] + '" cy="' + last[1] +
      '" r="1.8" fill="' + color + '"/></svg>';
  }

  function cssEscape(s) { return String(s).replace(/"/g, '\\"'); }

  function fillRow(sym) {
    if (!window.MLApi) return;
    var sel = cssEscape(sym);

    window.MLApi.fetchEndpoint("quote", sym).then(function (res) {
      var q = Array.isArray(res.data) ? res.data[0] : res.data;
      if (!q) return;
      var pct = Number(q.changesPercentage);
      var up = pct >= 0;

      var co = document.querySelector('[data-co="' + sel + '"]');
      if (co && q.name) co.textContent = q.name;

      var price = document.querySelector('[data-price="' + sel + '"]');
      if (price && q.price != null) price.textContent = F.formatPrice(q.price);

      var pill = document.querySelector('[data-chg="' + sel + '"]');
      if (pill && !isNaN(pct)) {
        pill.classList.add(up ? "is-up" : "is-down");
        pill.innerHTML = '<span aria-hidden="true">' + (up ? "▲" : "▼") +
          "</span>" + F.escapeHtml(F.formatPercent(pct));
      }
    });

    window.MLApi.fetchEndpoint("history", sym).then(function (res) {
      var hist = res.data && res.data.historical;
      var spark = document.querySelector('[data-spark="' + sel + '"]');
      if (!spark || !Array.isArray(hist) || !hist.length) return;
      // FMP history is newest-first; take last ~24 trading days ascending.
      var closes = hist.slice(0, 24).map(function (h) { return Number(h.close); })
        .filter(function (n) { return !isNaN(n); }).reverse();
      var up = closes.length >= 2 ? closes[closes.length - 1] >= closes[0] : true;
      spark.innerHTML = sparkSvg(closes, up);
    });
  }

  function setActive(sym) {
    var rows = document.querySelectorAll(".wl-row");
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
      var suggest = e.target.closest("[data-suggest]");
      if (suggest) { add(suggest.getAttribute("data-suggest")); return; }
      var removeBtn = e.target.closest("[data-remove]");
      if (removeBtn) {
        e.stopPropagation();
        remove(removeBtn.getAttribute("data-remove"));
        return;
      }
      var row = e.target.closest(".wl-row");
      if (row) onSelect(row.getAttribute("data-sym"));
    });

    renderList();
  }

  window.MLWatchlist = {
    init: init, add: add, remove: remove, getList: getList,
    setActive: setActive, render: renderList
  };
})();
