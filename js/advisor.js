/* Advisor / "Find Stocks" view.
 *
 * A transparent, rule-based matcher: the user answers a short onboarding form
 * (horizon, risk, sectors, goal), which is persisted in localStorage, and we
 * rank a bundled universe of real tickers by how well each matches. Every
 * recommendation shows a plain-English "Why it matches" built from the exact
 * criteria that scored. With a live FMP key, displayed tickers are enriched
 * with real price / P/E; in demo mode bundled fundamentals are used.
 *
 * This module is EDUCATIONAL ONLY — the not-financial-advice notice lives
 * exclusively inside this view (see index.html #view-advisor).
 */
(function () {
  "use strict";

  var STORAGE_KEY = "marketlens.advisor.profile.v1";
  var F = window.MLFormat;
  var DATA = window.MLAdvisorUniverse || { UNIVERSE: [], SECTORS: [] };
  var onPickTicker = function () {};
  var RESULT_LIMIT = 9;

  var RISK_ORDER = { conservative: 0, moderate: 1, aggressive: 2 };

  // ---------- persistence ----------
  function loadProfile() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (p && typeof p === "object" && Array.isArray(p.sectors)) return p;
    } catch (e) { /* ignore corrupt storage */ }
    return null;
  }

  function saveProfile(profile) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); }
    catch (e) { /* storage may be unavailable */ }
  }

  // ---------- scoring (transparent, rule-based) ----------
  function scoreItem(item, profile) {
    var score = 0;
    var reasons = [];

    // Sector interest.
    if (profile.sectors.length && profile.sectors.indexOf(item.sector) !== -1) {
      score += 30;
      reasons.push("In a sector you chose: " + item.sector);
    }

    // Risk tolerance.
    var dist = Math.abs(RISK_ORDER[item.risk] - RISK_ORDER[profile.risk]);
    if (dist === 0) {
      score += 25;
      reasons.push("Matches your " + profile.risk + " risk tolerance");
    } else if (dist === 1) {
      score += 10;
      reasons.push("Risk level is close to your " + profile.risk + " preference");
    } else {
      score -= 8;
    }

    // Primary goal.
    var traits = item.traits || [];
    if (profile.goal === "income") {
      if (traits.indexOf("dividend") !== -1) {
        score += 25;
        reasons.push("Pays dividends — fits your income goal (" +
          item.divYield.toFixed(2) + "% yield)");
        if (item.divYield >= 3) {
          score += 6;
          reasons.push("Above-average dividend yield");
        }
      }
    } else { // growth
      if (traits.indexOf("growth") !== -1) {
        score += 25;
        reasons.push("Growth-oriented — fits your growth goal");
      } else if (traits.indexOf("broad-index") !== -1) {
        score += 12;
        reasons.push("Broad-market exposure with growth potential");
      }
    }

    // Horizon.
    if (profile.horizon === "long") {
      if (traits.indexOf("broad-index") !== -1 ||
          traits.indexOf("dividend") !== -1 ||
          traits.indexOf("value") !== -1) {
        score += 12;
        reasons.push("Well-suited to long-term holding");
      } else if (traits.indexOf("growth") !== -1) {
        score += 6;
      }
    } else { // short
      if (item.risk === "aggressive" || traits.indexOf("growth") !== -1) {
        score += 12;
        reasons.push("More active profile that fits a shorter-term horizon");
      } else {
        score += 3;
      }
    }

    // Gentle nudge toward diversified funds for everyone.
    if (traits.indexOf("broad-index") !== -1) {
      score += 4;
      if (reasons.indexOf("Broad-market exposure with growth potential") === -1 &&
          profile.goal !== "income") {
        reasons.push("Diversified fund — lowers single-stock risk");
      }
    }

    return { score: score, reasons: reasons };
  }

  function rank(profile) {
    return DATA.UNIVERSE.map(function (item, idx) {
      var s = scoreItem(item, profile);
      return { item: item, score: s.score, reasons: s.reasons, idx: idx };
    }).filter(function (r) {
      return r.score > 0; // drop poor matches (e.g. opposite risk only)
    }).sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.idx - b.idx; // stable, deterministic tiebreak
    }).slice(0, RESULT_LIMIT);
  }

  // ---------- form rendering ----------
  function radioGroup(name, options) {
    return options.map(function (o) {
      return '<label class="adv-opt">' +
        '<input type="radio" name="' + name + '" value="' + o.value + '"' +
        (o.checked ? " checked" : "") + " /> " +
        F.escapeHtml(o.label) + "</label>";
    }).join("");
  }

  function checkGroup(name, values, selected) {
    return values.map(function (v) {
      var on = selected.indexOf(v) !== -1;
      return '<label class="adv-opt">' +
        '<input type="checkbox" name="' + name + '" value="' +
        F.escapeHtml(v) + '"' + (on ? " checked" : "") + " /> " +
        F.escapeHtml(v) + "</label>";
    }).join("");
  }

  function renderForm(profile) {
    var p = profile || { horizon: "long", risk: "moderate", sectors: [], goal: "growth" };
    var host = document.getElementById("advisorFormHost");
    if (!host) return;
    host.innerHTML =
      '<form id="advForm" class="adv-form">' +
        '<div class="adv-field">' +
          '<span class="adv-label">Time horizon</span>' +
          '<div class="adv-opts">' + radioGroup("horizon", [
            { value: "long", label: "Long-term", checked: p.horizon === "long" },
            { value: "short", label: "Short-term", checked: p.horizon === "short" }
          ]) + '</div>' +
        '</div>' +
        '<div class="adv-field">' +
          '<span class="adv-label">Risk tolerance</span>' +
          '<div class="adv-opts">' + radioGroup("risk", [
            { value: "conservative", label: "Conservative", checked: p.risk === "conservative" },
            { value: "moderate", label: "Moderate", checked: p.risk === "moderate" },
            { value: "aggressive", label: "Aggressive", checked: p.risk === "aggressive" }
          ]) + '</div>' +
        '</div>' +
        '<div class="adv-field">' +
          '<span class="adv-label">Sectors of interest</span>' +
          '<div class="adv-opts adv-opts--wrap">' +
            checkGroup("sectors", DATA.SECTORS, p.sectors) + '</div>' +
        '</div>' +
        '<div class="adv-field">' +
          '<span class="adv-label">Primary goal</span>' +
          '<div class="adv-opts">' + radioGroup("goal", [
            { value: "growth", label: "Growth", checked: p.goal === "growth" },
            { value: "income", label: "Income & Dividends", checked: p.goal === "income" }
          ]) + '</div>' +
        '</div>' +
        '<button type="submit" class="adv-submit">Find matches</button>' +
      '</form>';

    document.getElementById("advForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var sectors = fd.getAll("sectors");
      var next = {
        horizon: fd.get("horizon") || "long",
        risk: fd.get("risk") || "moderate",
        sectors: sectors,
        goal: fd.get("goal") || "growth"
      };
      saveProfile(next);
      showResults(next);
    });
  }

  // ---------- results rendering ----------
  function statChip(label, value) {
    return '<span class="adv-stat"><span class="adv-stat__label">' +
      F.escapeHtml(label) + '</span> ' + value + "</span>";
  }

  function cardHtml(rec) {
    var it = rec.item;
    var pe = it.pe ? Number(it.pe).toFixed(1) : "—";
    var dy = it.divYield ? it.divYield.toFixed(2) + "%" : "—";
    var why = rec.reasons.map(function (r) {
      return "<li>" + F.escapeHtml(r) + "</li>";
    }).join("");
    return '<article class="adv-card" data-ticker="' + F.escapeHtml(it.ticker) + '" ' +
      'role="button" tabindex="0" aria-label="Open ' + F.escapeHtml(it.ticker) +
      ' in dashboard">' +
      '<div class="adv-card__head">' +
        '<div><span class="adv-card__ticker">' + F.escapeHtml(it.ticker) +
        '</span><span class="adv-card__name">' + F.escapeHtml(it.name) + '</span></div>' +
        '<span class="adv-card__sector">' + F.escapeHtml(it.sector) + '</span>' +
      '</div>' +
      '<div class="adv-card__stats">' +
        statChip("Price", '<span data-cell="price">' + F.formatPrice(it.price) + '</span>') +
        statChip("P/E", '<span data-cell="pe">' + pe + '</span>') +
        statChip("Yield", '<span data-cell="dy">' + dy + '</span>') +
      '</div>' +
      '<div class="adv-card__why"><span class="adv-card__why-label">Why it matches</span>' +
        '<ul>' + why + '</ul></div>' +
      '<span class="adv-card__open">Open in dashboard →</span>' +
    '</article>';
  }

  function buildResults(profile) {
    var host = document.getElementById("advisorResults");
    if (!host) return;
    var recs = rank(profile);
    if (!recs.length) {
      host.innerHTML = '<p class="adv-empty">No strong matches — try selecting ' +
        'more sectors or a broader risk tolerance.</p>';
      return;
    }
    var summary = 'Showing ' + recs.length + ' matches for a <strong>' +
      F.escapeHtml(profile.horizon === "long" ? "long-term" : "short-term") +
      '</strong>, <strong>' + F.escapeHtml(profile.risk) +
      '</strong>-risk, <strong>' +
      F.escapeHtml(profile.goal === "income" ? "income" : "growth") +
      '</strong> profile.';

    host.innerHTML =
      '<div class="adv-results__bar">' +
        '<p class="adv-results__summary">' + summary + '</p>' +
        '<button type="button" id="advRetake" class="adv-retake">Retake quiz</button>' +
      '</div>' +
      '<div class="adv-grid">' + recs.map(cardHtml).join("") + '</div>';

    document.getElementById("advRetake").addEventListener("click", function () {
      showForm(profile);
    });

    host.querySelectorAll(".adv-card").forEach(function (card) {
      function open() { onPickTicker(card.getAttribute("data-ticker")); }
      card.addEventListener("click", open);
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });

    enrich(recs);
  }

  // Toggle between the form and results panes, then render the active one.
  function showForm(profile) {
    document.getElementById("advisorFormPane").classList.remove("view--hidden");
    document.getElementById("advisorResultsPane").classList.add("view--hidden");
    renderForm(profile);
  }

  function showResults(profile) {
    document.getElementById("advisorFormPane").classList.add("view--hidden");
    document.getElementById("advisorResultsPane").classList.remove("view--hidden");
    buildResults(profile);
  }

  // ---------- live enrichment ----------
  function enrich(recs) {
    if (!window.MLApi) return;
    recs.forEach(function (rec) {
      var ticker = rec.item.ticker;
      window.MLApi.fetchEndpoint("quote", ticker).then(function (res) {
        if (res.source !== "live") return; // demo: keep bundled fundamentals
        var q = Array.isArray(res.data) ? res.data[0] : res.data;
        if (!q) return;
        var card = document.querySelector('.adv-card[data-ticker="' +
          cssEscape(ticker) + '"]');
        if (!card) return;
        if (q.price != null) {
          var pc = card.querySelector('[data-cell="price"]');
          if (pc) pc.textContent = F.formatPrice(q.price);
        }
        if (q.pe != null) {
          var pec = card.querySelector('[data-cell="pe"]');
          if (pec) pec.textContent = Number(q.pe).toFixed(1);
        }
      }).catch(function () { /* keep bundled values on any failure */ });
    });
  }

  function cssEscape(s) { return String(s).replace(/"/g, '\\"'); }

  // ---------- lifecycle ----------
  function init(pickTickerCallback) {
    onPickTicker = pickTickerCallback || onPickTicker;
  }

  // Called when the advisor view becomes visible: show saved results if the
  // user already onboarded, otherwise show the form.
  function onShow() {
    var profile = loadProfile();
    if (profile) showResults(profile);
    else showForm(null);
  }

  window.MLAdvisor = { init: init, onShow: onShow };
})();
