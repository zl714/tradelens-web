/* DOM rendering for the quote card, key stats, and news list. */
(function () {
  "use strict";

  var F = window.MLFormat;

  function changeClass(n) { return Number(n) >= 0 ? "is-up" : "is-down"; }

  function renderQuote(quote, profile) {
    var q = Array.isArray(quote) ? quote[0] : quote;
    var p = Array.isArray(profile) ? profile[0] : profile;
    if (!q) return;

    var name = (p && (p.companyName || p.name)) || q.name || q.symbol;
    var exch = q.exchange || (p && p.exchangeShortName) || "";
    var sector = (p && p.sector) || "";

    document.getElementById("quoteName").textContent =
      name + " (" + q.symbol + ")";
    document.getElementById("quoteMeta").textContent =
      [exch, sector].filter(Boolean).join(" • ");

    document.getElementById("quotePrice").textContent = F.formatPrice(q.price);

    var chgEl = document.getElementById("quoteChange");
    var cls = changeClass(q.change);
    var arrow = Number(q.change) >= 0 ? "▲" : "▼";
    chgEl.className = "quote__change " + cls;
    chgEl.textContent = arrow + " " + F.formatSignedPrice(q.change) +
      " (" + F.formatPercent(q.changesPercentage) + ")";
  }

  function statCell(label, value) {
    return '<div class="stat"><span class="stat__label">' +
      F.escapeHtml(label) + '</span><span class="stat__value">' +
      value + "</span></div>";
  }

  function renderStats(quote) {
    var q = Array.isArray(quote) ? quote[0] : quote;
    var grid = document.getElementById("statsGrid");
    if (!q) { grid.innerHTML = ""; return; }

    var dayRange = (q.dayLow != null && q.dayHigh != null)
      ? F.formatPrice(q.dayLow) + " – " + F.formatPrice(q.dayHigh) : "—";
    var range52 = (q.yearLow != null && q.yearHigh != null)
      ? F.formatPrice(q.yearLow) + " – " + F.formatPrice(q.yearHigh) : "—";

    grid.innerHTML = [
      statCell("Market Cap", F.formatCompact(q.marketCap)),
      statCell("P/E Ratio", q.pe != null ? Number(q.pe).toFixed(2) : "—"),
      statCell("Volume", F.formatCompact(q.volume)),
      statCell("52-Week Range", range52),
      statCell("Day Range", dayRange),
      statCell("Prev Close", F.formatPrice(q.previousClose)),
      statCell("Open", F.formatPrice(q.open)),
      statCell("EPS", q.eps != null ? F.formatPrice(q.eps) : "—")
    ].join("");
  }

  function renderNews(news) {
    var list = document.getElementById("newsList");
    var items = Array.isArray(news) ? news : [];
    if (!items.length) {
      list.innerHTML = '<li class="news__item">No recent news available.</li>';
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
      return '<li class="news__item">' + title +
        '<div class="news__meta"><span class="news__source">' +
        F.escapeHtml(n.site || "News") + "</span>" +
        F.formatDate(n.publishedDate) + "</div></li>";
    }).join("");
  }

  window.MLRender = {
    renderQuote: renderQuote,
    renderStats: renderStats,
    renderNews: renderNews
  };
})();
