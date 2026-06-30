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
      window.MLRender.renderQuote(bundle.quote, bundle.profile, bundle.history);
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

  // View switcher driven by [data-view] + hash routing (#/journal, #/rules, …).
  var VIEWS = ["dashboard", "advisor", "journal", "rules"];

  function showView(view) {
    if (VIEWS.indexOf(view) === -1) view = "dashboard";
    VIEWS.forEach(function (v) {
      var el = document.getElementById("view-" + v);
      if (el) el.classList.toggle("view--hidden", v !== view);
    });
    document.querySelectorAll("[data-view]").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-view") === view);
    });
    if (view === "advisor" && window.MLAdvisor) window.MLAdvisor.onShow();
    if (view === "journal" && window.MLJournal) window.MLJournal.onShow();
    if (view === "rules" && window.MLRules) window.MLRules.onShow();

    // Keep the hash in sync without triggering a second hashchange render.
    var target = "#/" + view;
    if (location.hash !== target) {
      if (history.replaceState) history.replaceState(null, "", target);
      else location.hash = target;
    }
    window.scrollTo(0, 0);
  }

  // Map a URL hash to a known view. Accepts #/journal, #journal, #/playbook, etc.
  function viewFromHash() {
    var h = (location.hash || "").replace(/^#\/?/, "").toLowerCase();
    if (h === "rules" || h === "playbook") return "rules";
    if (h === "journal") return "journal";
    if (h === "advisor" || h === "find") return "advisor";
    if (h === "dashboard") return "dashboard";
    return null;
  }

  function initViewNav() {
    document.querySelectorAll("[data-view]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        showView(el.getAttribute("data-view"));
      });
    });
    // Respond to back/forward and manual hash edits.
    window.addEventListener("hashchange", function () {
      showView(viewFromHash() || "dashboard");
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
    if (window.MLJournal) window.MLJournal.init();
    if (window.MLRules) window.MLRules.init();

    // Load the first watchlist symbol (or default) on startup. The dashboard
    // data still loads even if another view is showing — it's just hidden.
    var list = window.MLWatchlist.getList();
    loadSymbol(list[0] || DEFAULT_SYMBOL);

    // Honor a deep-link hash on first load (e.g. #/journal, #/rules).
    var initialView = viewFromHash();
    if (initialView) showView(initialView);
  }

  // Exposed so other modules (advisor) can drive navigation/data loading.
  window.MLApp = { loadSymbol: loadSymbolInDashboard, showView: showView };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
