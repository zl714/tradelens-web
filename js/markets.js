/* Markets overview + Movers panels for the dashboard right rail.
 *
 * Markets shows the major indices from the bundled client sample. Movers ranks
 * the demo universe by absolute % change using live quotes when the backend
 * has them, and the bundled sample otherwise, so the rail is always filled.
 */
(function () {
  "use strict";

  var F = window.MLFormat;

  function dirClass(n) { return Number(n) >= 0 ? "is-up" : "is-down"; }
  function glyph(n) { return Number(n) >= 0 ? "▲" : "▼"; }

  // 5,431.60 / 13.24 / 4.28 — grouped, fixed decimals, tabular.
  function formatValue(v, decimals) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    var d = decimals == null ? 2 : decimals;
    return Number(v).toLocaleString("en-US", {
      minimumFractionDigits: d, maximumFractionDigits: d
    });
  }

  function renderMarkets() {
    var list = document.getElementById("marketsList");
    if (!list) return;
    var rows = window.MARKETLENS_MARKETS || [];
    list.innerHTML = rows.map(function (m) {
      var up = Number(m.chgPct) >= 0;
      var unit = m.unit ? F.escapeHtml(m.unit) : "";
      return '<li class="mkt-row">' +
        '<span class="mkt-name">' + F.escapeHtml(m.name) + "</span>" +
        '<span class="mkt-vals">' +
          '<span class="mkt-value num">' + formatValue(m.value, m.decimals) + unit + "</span>" +
          '<span class="mkt-chg num ' + dirClass(m.chgPct) + '">' +
            '<span aria-hidden="true">' + glyph(m.chgPct) + "</span>" +
            F.escapeHtml(F.formatPercent(m.chgPct)) +
          "</span>" +
        "</span>" +
        "</li>";
    }).join("");
  }

  // Sample rows for the bundled demo universe (always available offline).
  function sampleMoverRows() {
    var sample = window.MARKETLENS_SAMPLE || {};
    return Object.keys(sample).map(function (sym) {
      var q = (sample[sym].quote && sample[sym].quote[0]) || {};
      return { sym: sym, name: q.name || "", price: q.price,
        chgPct: Number(q.changesPercentage) };
    });
  }

  function paintMovers(rows, isLive) {
    var list = document.getElementById("moversList");
    if (!list) return;
    var chip = document.getElementById("moversChip");
    if (chip) chip.hidden = !!isLive;

    rows = rows.slice().sort(function (a, b) {
      return Math.abs(b.chgPct) - Math.abs(a.chgPct);
    });

    list.innerHTML = rows.map(function (r) {
      return '<li><button class="mover-row" type="button" data-sym="' +
        F.escapeHtml(r.sym) + '">' +
        '<span class="mover-id">' +
          '<span class="mover-sym">' + F.escapeHtml(r.sym) + "</span>" +
          '<span class="mover-co">' + F.escapeHtml(r.name) + "</span>" +
        "</span>" +
        '<span class="mover-vals">' +
          '<span class="mover-price num">' + F.escapeHtml(F.formatPrice(r.price)) + "</span>" +
          '<span class="mover-pill num ' + dirClass(r.chgPct) + '">' +
            '<span aria-hidden="true">' + glyph(r.chgPct) + "</span>" +
            F.escapeHtml(F.formatPercent(r.chgPct)) +
          "</span>" +
        "</span>" +
        "</button></li>";
    }).join("");
  }

  // Paint the bundled sample immediately, then swap in live quotes so Movers
  // never disagrees with the live quote card and watchlist. All-or-nothing:
  // if any symbol comes back as demo data, the whole panel stays on the
  // sample (and keeps its "Sample" chip) rather than mixing the two.
  function renderMovers() {
    var rows = sampleMoverRows();
    paintMovers(rows, false);
    if (!window.MLApi || !rows.length) return;

    Promise.all(rows.map(function (r) {
      return window.MLApi.fetchEndpoint("quote", r.sym);
    })).then(function (results) {
      var live = [];
      for (var i = 0; i < results.length; i++) {
        var res = results[i];
        var q = Array.isArray(res.data) ? res.data[0] : res.data;
        var pct = q ? Number(q.changesPercentage) : NaN;
        if (res.source !== "live" || !q || q.price == null || isNaN(pct)) return;
        live.push({ sym: rows[i].sym, name: q.name || rows[i].name,
          price: q.price, chgPct: pct });
      }
      paintMovers(live, true);
    }).catch(function () { /* keep the sample rows */ });
  }

  function init() {
    renderMarkets();
    renderMovers();
    var movers = document.getElementById("moversList");
    if (movers) {
      movers.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-sym]");
        if (btn && window.MLApp) window.MLApp.loadSymbol(btn.getAttribute("data-sym"));
      });
    }
  }

  window.MLMarkets = { init: init, renderMarkets: renderMarkets, renderMovers: renderMovers };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
