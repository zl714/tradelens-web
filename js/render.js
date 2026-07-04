/* DOM rendering for the quote header, key stats, and news list. */
(function () {
  "use strict";

  var F = window.MLFormat;

  var UP = "#16C784", DOWN = "#F23645";

  function changeClass(n) { return Number(n) >= 0 ? "is-up" : "is-down"; }

  // Inline hero sparkline from a closes series, colored by net direction with a
  // matching faint area fill and an end dot (Robinhood signature, in miniature).
  function heroSpark(closes) {
    if (!closes || closes.length < 2) return "";
    var w = 132, h = 44, pad = 3;
    var min = Math.min.apply(null, closes), max = Math.max.apply(null, closes);
    var span = max - min || 1;
    var step = (w - pad * 2) / (closes.length - 1);
    var pts = closes.map(function (c, i) {
      var x = pad + i * step;
      var y = pad + (h - pad * 2) * (1 - (c - min) / span);
      return x.toFixed(1) + "," + y.toFixed(1);
    });
    var up = closes[closes.length - 1] >= closes[0];
    var color = up ? UP : DOWN;
    var last = pts[pts.length - 1].split(",");
    var area = pts.join(" ") + " " + (w - pad).toFixed(1) + "," + (h - pad) +
      " " + pad + "," + (h - pad);
    var gid = "hg" + (up ? "u" : "d");
    return '<svg viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h +
      '" fill="none" preserveAspectRatio="none">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + color + '" stop-opacity="0.14"/>' +
      '<stop offset="1" stop-color="' + color + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<polygon points="' + area + '" fill="url(#' + gid + ')"/>' +
      '<polyline points="' + pts.join(" ") + '" stroke="' + color +
      '" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.2" fill="' + color + '"/></svg>';
  }

  function microCell(label, value) {
    return '<div class="quote__micro-cell"><dt class="quote__micro-label">' +
      F.escapeHtml(label) + '</dt><dd class="quote__micro-value num">' +
      value + "</dd></div>";
  }

  function renderHeroExtras(q, history) {
    var spark = document.getElementById("quoteSpark");
    var micro = document.getElementById("quoteMicro");
    if (spark) {
      var hist = (history && history.historical) || [];
      var closes = hist.slice(0, 30).map(function (h) { return Number(h.close); })
        .filter(function (n) { return !isNaN(n); }).reverse();
      spark.innerHTML = heroSpark(closes);
    }
    if (micro) {
      micro.innerHTML =
        microCell("Open", F.formatPrice(q.open)) +
        microCell("High", F.formatPrice(q.dayHigh)) +
        microCell("Low", F.formatPrice(q.dayLow)) +
        microCell("Vol", F.formatCompact(q.volume));
    }
  }

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

  function renderQuote(quote, profile, history) {
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

    renderHeroExtras(q, history);
  }

  function statCell(label, value) {
    return '<div class="stat"><span class="stat__label">' +
      F.escapeHtml(label) + '</span><span class="stat__value num">' +
      value + "</span></div>";
  }

  function renderStats(quote, profile) {
    var q = Array.isArray(quote) ? quote[0] : quote;
    var p = Array.isArray(profile) ? profile[0] : profile;
    p = p || {};
    var grid = document.getElementById("statsGrid");
    var host = document.getElementById("range52Host");
    if (!q) { grid.innerHTML = ""; if (host) host.innerHTML = ""; return; }

    var dayRange = (q.dayLow != null && q.dayHigh != null)
      ? F.formatPrice(q.dayLow) + " – " + F.formatPrice(q.dayHigh) : "—";

    // Live quotes carry no pe/eps/avgVolume; take what the profile endpoint
    // has (averageVolume, beta, lastDividend) and swap in Beta / Div per Share
    // when P/E and EPS are unavailable rather than showing dead "—" cells.
    var avgVol = q.avgVolume != null ? q.avgVolume : p.averageVolume;
    var peCell = q.pe != null
      ? statCell("P/E Ratio", Number(q.pe).toFixed(2))
      : statCell("Beta", p.beta != null ? Number(p.beta).toFixed(2) : "—");
    var epsCell = q.eps != null
      ? statCell("EPS", F.formatPrice(q.eps))
      : statCell("Div / Share", p.lastDividend != null ? F.formatPrice(p.lastDividend) : "—");

    grid.innerHTML = [
      statCell("Market Cap", F.formatCompact(q.marketCap)),
      peCell,
      statCell("Volume", F.formatCompact(q.volume)),
      epsCell,
      statCell("Open", F.formatPrice(q.open)),
      statCell("Prev Close", F.formatPrice(q.previousClose)),
      statCell("Day Range", dayRange),
      statCell("Avg Vol", avgVol != null ? F.formatCompact(avgVol) : "—")
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
