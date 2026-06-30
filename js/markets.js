/* Markets overview + Movers panels for the dashboard right rail.
 *
 * Both render from the bundled client sample so the rail is always filled even
 * with no API key. Markets shows the major indices; Movers ranks the demo
 * universe by absolute % change and lets you load one into the dashboard.
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

  function renderMovers() {
    var list = document.getElementById("moversList");
    if (!list) return;
    var sample = window.MARKETLENS_SAMPLE || {};
    var rows = Object.keys(sample).map(function (sym) {
      var q = (sample[sym].quote && sample[sym].quote[0]) || {};
      return { sym: sym, name: q.name || "", price: q.price,
        chgPct: Number(q.changesPercentage) };
    }).sort(function (a, b) {
      return Math.abs(b.chgPct) - Math.abs(a.chgPct);
    });

    list.innerHTML = rows.map(function (r) {
      var up = r.chgPct >= 0;
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
