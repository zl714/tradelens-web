/* App orchestration: wires search, watchlist, range toggle, and data loading. */
(function () {
  "use strict";

  var DEFAULT_SYMBOL = "AAPL";
  var currentSymbol = DEFAULT_SYMBOL;

  function setStatus(message, kind) {
    var el = document.getElementById("status");
    el.className = "status" + (kind ? " status--" + kind : "");
    el.textContent = message || "";
  }

  function setBadge(isDemo) {
    var badge = document.getElementById("dataBadge");
    badge.classList.toggle("badge--hidden", !isDemo);
    badge.title = isDemo
      ? "Showing bundled sample data (no live API key configured or upstream unavailable)."
      : "";
  }

  function loadSymbol(symbol) {
    var sym = String(symbol || "").trim().toUpperCase();
    if (!sym) return;
    currentSymbol = sym;
    setStatus("Loading " + sym + "…", "loading");
    window.MLWatchlist.setActive(sym);

    window.MLApi.fetchSymbol(sym).then(function (bundle) {
      if (!bundle.quote || (Array.isArray(bundle.quote) && !bundle.quote.length)) {
        setStatus('No data found for "' + sym + '". Try AAPL, TSLA, NVDA, or MSFT.', "error");
        setBadge(bundle.source === "demo");
        return;
      }
      window.MLRender.renderQuote(bundle.quote, bundle.profile);
      window.MLRender.renderStats(bundle.quote);
      window.MLRender.renderNews(bundle.news);
      window.MLChart.setSeries(bundle.history);
      setBadge(bundle.source === "demo");
      setStatus("");
    }).catch(function () {
      setStatus("Something went wrong loading data. Showing demo data.", "error");
      setBadge(true);
    });
  }

  function initSearch() {
    document.getElementById("searchForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("searchInput");
      var val = input.value.trim().toUpperCase();
      if (val) { loadSymbol(val); input.value = ""; }
    });
  }

  function initRangeToggle() {
    var toggle = document.getElementById("rangeToggle");
    toggle.addEventListener("click", function (e) {
      var btn = e.target.closest(".range-btn");
      if (!btn) return;
      toggle.querySelectorAll(".range-btn").forEach(function (b) {
        b.classList.remove("is-active");
      });
      btn.classList.add("is-active");
      window.MLChart.render(btn.getAttribute("data-range"));
    });
  }

  function init() {
    initSearch();
    initRangeToggle();
    window.MLWatchlist.init(loadSymbol);

    // Load the first watchlist symbol (or default) on startup.
    var list = window.MLWatchlist.getList();
    loadSymbol(list[0] || DEFAULT_SYMBOL);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
