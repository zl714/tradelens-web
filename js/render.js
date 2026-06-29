/* DOM rendering for the quote header, key stats, and news list. */
(function () {
  "use strict";

  var F = window.MLFormat;

  function changeClass(n) { return Number(n) >= 0 ? "is-up" : "is-down"; }

  // Split "$212.45" so the cents render one step smaller/lighter (spec anatomy).
  function renderHeroPrice(el, price) {
    if (price === null || price === undefined || isNaN(price)) {
      el.textContent = "—";
      return;
    }
    var full = Number(price).toLocaleString("en-US", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    var parts = full.split(".");
    el.innerHTML = "$" + F.escapeHtml(parts[0]) +
      '<span class="quote__cents">.' + F.escapeHtml(parts[1] || "00") + "</span>";
  }

  function renderQuote(quote, profile) {
    var q = Array.isArray(quote) ? quote[0] : quote;
    var p = Array.isArray(profile) ? profile[0] : profile;
    if (!q) return;

    var name = (p && (p.companyName || p.name)) || q.name || "";
    var exch = q.exchange || (p && p.exchangeShortName) || "";

    document.getElementById("quoteSymbol").textContent = q.symbol || "—";
    document.getElementById("quoteCompany").textContent = name;
    var exEl = document.getElementById("quoteExchange");
    exEl.textContent = exch;
    exEl.style.display = exch ? "" : "none";

    renderHeroPrice(document.getElementById("quotePrice"), q.price);

    var chgEl = document.getElementById("quoteChange");
    var up = Number(q.change) >= 0;
    chgEl.className = "quote__change num " + changeClass(q.change);
    chgEl.innerHTML =
      '<span class="quote__change-glyph">' + (up ? "▲" : "▼") + "</span>" +
      F.escapeHtml(F.formatSignedPrice(q.change)) + " (" +
      F.escapeHtml(F.formatPercent(q.changesPercentage)) + ")";
  }

  function statCell(label, value) {
    return '<div class="stat"><span class="stat__label">' +
      F.escapeHtml(label) + '</span><span class="stat__value num">' +
      value + "</span></div>";
  }

  function renderStats(quote) {
    var q = Array.isArray(quote) ? quote[0] : quote;
    var grid = document.getElementById("statsGrid");
    var host = document.getElementById("range52Host");
    if (!q) { grid.innerHTML = ""; if (host) host.innerHTML = ""; return; }

    var dayRange = (q.dayLow != null && q.dayHigh != null)
      ? F.formatPrice(q.dayLow) + " – " + F.formatPrice(q.dayHigh) : "—";

    grid.innerHTML = [
      statCell("Market Cap", F.formatCompact(q.marketCap)),
      statCell("P/E Ratio", q.pe != null ? Number(q.pe).toFixed(2) : "—"),
      statCell("Volume", F.formatCompact(q.volume)),
      statCell("EPS", q.eps != null ? F.formatPrice(q.eps) : "—"),
      statCell("Open", F.formatPrice(q.open)),
      statCell("Prev Close", F.formatPrice(q.previousClose)),
      statCell("Day Range", dayRange),
      statCell("Avg Vol", F.formatCompact(q.avgVolume != null ? q.avgVolume : q.volume))
    ].join("");

    renderRange52(host, q);
  }

  // 52-week range as a thin track with a current-position marker.
  function renderRange52(host, q) {
    if (!host) return;
    if (q.yearLow == null || q.yearHigh == null || q.price == null) {
      host.innerHTML = "";
      return;
    }
    var lo = Number(q.yearLow), hi = Number(q.yearHigh), px = Number(q.price);
    var pct = hi > lo ? ((px - lo) / (hi - lo)) * 100 : 50;
    pct = Math.max(0, Math.min(100, pct));
    host.innerHTML =
      '<div class="range52">' +
        '<div class="range52__label">52-Week Range</div>' +
        '<div class="range52__track">' +
          '<span class="range52__marker" style="left:' + pct.toFixed(1) + '%"></span>' +
        '</div>' +
        '<div class="range52__ends num">' +
          "<span>" + F.escapeHtml(F.formatPrice(lo)) + "</span>" +
          "<span>" + F.escapeHtml(F.formatPrice(hi)) + "</span>" +
        '</div>' +
      '</div>';
  }

  function renderNews(news) {
    var list = document.getElementById("newsList");
    var items = Array.isArray(news) ? news : [];
    if (!items.length) {
      list.innerHTML = '<li class="news__item"><span class="news__title">' +
        "No recent news available.</span></li>";
      return;
    }
    list.innerHTML = items.slice(0, 8).map(function (n) {
      var url = n.url || "#";
      var safeUrl = /^https?:\/\//i.test(url) ? url : "#";
      var titleHtml = F.escapeHtml(n.title || "Untitled");
      var title = safeUrl === "#"
        ? '<span class="news__title">' + titleHtml + "</span>"
        : '<a class="news__title" href="' + F.escapeHtml(safeUrl) +
          '" target="_blank" rel="noopener noreferrer">' + titleHtml + "</a>";
      var meta = '<div class="news__meta">' +
        '<span class="news__source">' + F.escapeHtml(n.site || "News") + "</span>" +
        "<span aria-hidden=\"true\">·</span>" +
        "<span>" + F.escapeHtml(F.formatDate(n.publishedDate)) + "</span></div>";
      return '<li class="news__item">' + meta + title + "</li>";
    }).join("");
  }

  window.MLRender = {
    renderQuote: renderQuote,
    renderStats: renderStats,
    renderNews: renderNews
  };
})();
