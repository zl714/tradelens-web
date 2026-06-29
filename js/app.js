/* App orchestration: wires search, watchlist, range toggle, and data loading. */
(function () {
  "use strict";

  var DEFAULT_SYMBOL = "AAPL";
  var currentSymbol = DEFAULT_SYMBOL;

  function setStatus(message, kind) {
    var el = document.getElementById("status");
    el.className = "status" + (kind ? " status--" + kind : "");
    if (!message) { el.textContent = ""; return; }
    el.textContent = message;
    if (kind === "error") {
      var retry = document.createElement("button");
      retry.type = "button";
      retry.className = "status__retry";
      retry.textContent = "Retry";
      retry.addEventListener("click", function () { loadSymbol(currentSymbol); });
      el.appendChild(retry);
    }
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
      window.MLChart.setData(bundle);
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
      if (!btn || btn.disabled) return; // ignore disabled (unavailable) toggles
      toggle.querySelectorAll(".range-btn").forEach(function (b) {
        b.classList.remove("is-active");
      });
      btn.classList.add("is-active");
      window.MLChart.render(btn.getAttribute("data-range"));
    });
  }

  // Simple two-view switcher (Dashboard <-> Advisor) driven by [data-view].
  function showView(view) {
    var dash = document.getElementById("view-dashboard");
    var adv = document.getElementById("view-advisor");
    var isAdvisor = view === "advisor";
    if (dash) dash.classList.toggle("view--hidden", isAdvisor);
    if (adv) adv.classList.toggle("view--hidden", !isAdvisor);
    document.querySelectorAll("[data-view]").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-view") === view);
    });
    if (isAdvisor && window.MLAdvisor) window.MLAdvisor.onShow();
    window.scrollTo(0, 0);
  }

  function initViewNav() {
    document.querySelectorAll("[data-view]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        showView(el.getAttribute("data-view"));
      });
    });
  }

  // Load a symbol AND switch back to the dashboard view (used by the advisor
  // when a recommended ticker is clicked).
  function loadSymbolInDashboard(symbol) {
    showView("dashboard");
    loadSymbol(symbol);
  }

  // Mobile bottom-tab primary action: jump to the watchlist add input.
  function initTabAdd() {
    var btn = document.getElementById("tabAdd");
    if (!btn) return;
    btn.addEventListener("click", function () {
      showView("dashboard");
      var input = document.getElementById("watchInput");
      if (input) { input.scrollIntoView({ block: "center" }); input.focus(); }
    });
  }

  function init() {
    initSearch();
    initRangeToggle();
    initViewNav();
    initTabAdd();
    window.MLWatchlist.init(loadSymbol);
    if (window.MLAdvisor) window.MLAdvisor.init(loadSymbolInDashboard);

    // Load the first watchlist symbol (or default) on startup.
    var list = window.MLWatchlist.getList();
    loadSymbol(list[0] || DEFAULT_SYMBOL);
  }

  // Exposed so other modules (advisor) can drive navigation/data loading.
  window.MLApp = { loadSymbol: loadSymbolInDashboard, showView: showView };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
