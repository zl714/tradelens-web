/* Trade Journal view.
 *
 * A clean, no-AI, no-grading trade log. The user records each trade (ticker,
 * direction, entry/exit/stop/target, size, dates, setup tag, notes). On save we
 * auto-compute P&L $, R-multiple, and Win/Loss/Open outcome from the raw inputs
 * only — no opinions, no scoring. Everything persists in localStorage under its
 * own key, with JSON export / import and a reset-to-demo affordance.
 *
 * P&L $  = (exit - entry) * size * (Long ? 1 : -1)        [closed trades only]
 * R-mult = (exit - entry) / (entry - stop)                [sign falls out of the
 *          maths for both directions; needs a stop and an exit]
 */
(function () {
  "use strict";

  var STORAGE_KEY = "marketlens.journal.trades.v1";
  var F = window.MLFormat;
  var sortDir = "desc"; // newest first by default
  var editingId = null;

  // ---------- demo seed (clearly illustrative, mix of W/L/open) ----------
  function seedTrades() {
    return [
      mk("NVDA", "Long", 118.50, 123.80, 116.00, 124.00, 100,
        "2026-06-10", "2026-06-11", "Breakout retest",
        "Reclaimed the prior-day high on volume, entered the first pullback to the breakout level."),
      mk("AAPL", "Short", 214.20, 209.50, 217.00, 208.00, 80,
        "2026-06-12", "2026-06-13", "Failed breakout / lower high",
        "Swept the level then closed back inside — short the rejection, stop above the sweep extreme."),
      mk("TSLA", "Long", 248.00, 244.10, 243.00, 256.00, 50,
        "2026-06-16", "2026-06-16", "Pullback to 9 EMA",
        "Entry was early — price had not actually reclaimed. Took the stop, small loss, fine."),
      mk("MSFT", "Long", 441.00, 437.40, 436.50, 449.00, 60,
        "2026-06-18", "2026-06-18", "Range low bounce",
        "Chop day. Should have skipped — no clean reclaim, just chased the bounce."),
      mk("AMD", "Long", 162.30, 168.90, 159.80, 169.00, 120,
        "2026-06-23", "2026-06-24", "Sweep + reclaim of PDL",
        "Textbook: swept prior-day low, reclaimed, entered within ~1pt of the level. Let the runner work."),
      mk("SPY", "Long", 612.40, null, 609.00, 620.00, 40,
        "2026-06-27", null, "Trend continuation",
        "Still open — above the breakout level, trailing the stop under the last higher low.")
    ];
  }

  function mk(ticker, dir, entry, exit, stop, target, size, eDate, xDate, setup, notes) {
    return {
      id: uid(), ticker: ticker, direction: dir,
      entry: entry, exit: exit, stop: stop, target: target, size: size,
      entryDate: eDate, exitDate: xDate, setup: setup, notes: notes,
      createdAt: eDate + "T12:00:00"
    };
  }

  function uid() {
    return "t_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  // ---------- persistence ----------
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) { var s = seedTrades(); save(s); return s; }
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { /* corrupt storage — fall back to seed */ }
    var seed = seedTrades();
    save(seed);
    return seed;
  }

  function save(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
    catch (e) { /* storage may be unavailable; ignore */ }
  }

  // ---------- computation (raw maths only — no grading) ----------
  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

  function compute(t) {
    var entry = num(t.entry), exit = num(t.exit), stop = num(t.stop), size = num(t.size);
    var mult = t.direction === "Short" ? -1 : 1;
    var closed = exit !== null;
    var pnl = null, r = null, outcome = "Open";

    if (closed && entry !== null && size !== null) {
      pnl = (exit - entry) * size * mult;
      outcome = pnl > 0 ? "Win" : (pnl < 0 ? "Loss" : "Flat");
    }
    if (closed && entry !== null && stop !== null && (entry - stop) !== 0) {
      r = (exit - entry) / (entry - stop);
    }
    return { pnl: pnl, r: r, outcome: outcome, closed: closed };
  }

  // ---------- summary stats ----------
  function summarize(list) {
    var wins = 0, losses = 0, closedCount = 0, totalPnl = 0;
    var rSum = 0, rCount = 0, best = null, worst = null;
    list.forEach(function (t) {
      var c = compute(t);
      if (!c.closed) return;
      closedCount++;
      if (c.pnl !== null) {
        totalPnl += c.pnl;
        if (best === null || c.pnl > best) best = c.pnl;
        if (worst === null || c.pnl < worst) worst = c.pnl;
        if (c.outcome === "Win") wins++;
        else if (c.outcome === "Loss") losses++;
      }
      if (c.r !== null) { rSum += c.r; rCount++; }
    });
    var decided = wins + losses;
    return {
      total: list.length,
      closedCount: closedCount,
      winRate: decided ? (wins / decided) * 100 : null,
      avgR: rCount ? rSum / rCount : null,
      totalPnl: closedCount ? totalPnl : null,
      best: best, worst: worst
    };
  }

  // ---------- formatting helpers ----------
  function signedR(r) {
    if (r === null) return "—";
    var sign = r >= 0 ? "+" : "−"; // real minus sign
    return sign + Math.abs(r).toFixed(2) + "R";
  }
  function signedPnl(n) {
    if (n === null) return "—";
    var sign = n >= 0 ? "+" : "−";
    return sign + "$" + Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }
  function upDown(n) { return n >= 0 ? "is-up" : "is-down"; }

  // ---------- KPI tiles ----------
  function renderKpis(list) {
    var host = document.getElementById("journalKpis");
    if (!host) return;
    var s = summarize(list);

    function tile(label, valueHtml, meta, cls) {
      return '<div class="kpi ' + (cls || "") + '">' +
        '<div class="kpi__label">' + F.escapeHtml(label) + "</div>" +
        '<div class="kpi__value num">' + valueHtml + "</div>" +
        (meta ? '<div class="kpi__meta">' + meta + "</div>" : "") +
        "</div>";
    }

    var pnlCls = s.totalPnl === null ? "" : upDown(s.totalPnl);
    var bestHtml = s.best === null ? "—" :
      '<span class="' + upDown(s.best) + '">' + F.escapeHtml(signedPnl(s.best)) + "</span>";
    var worstHtml = s.worst === null ? "—" :
      '<span class="' + upDown(s.worst) + '">' + F.escapeHtml(signedPnl(s.worst)) + "</span>";

    var sampleNote = (s.closedCount > 0 && s.closedCount < 30)
      ? '<div class="jr-note"><i data-lucide="info"></i>' +
        " Only " + s.closedCount + " closed trade" + (s.closedCount === 1 ? "" : "s") +
        " — small sample. Treat these stats as directional, not conclusive (aim for 30+)." +
        "</div>"
      : "";

    host.innerHTML =
      '<div class="kpi-grid">' +
        tile("Total Trades", String(s.total),
          s.closedCount + " closed · " + (s.total - s.closedCount) + " open") +
        tile("Win Rate", s.winRate === null ? "—" : s.winRate.toFixed(1) + "%",
          "of closed trades") +
        tile("Avg R", s.avgR === null ? "—" :
          '<span class="' + upDown(s.avgR) + '">' + F.escapeHtml(signedR(s.avgR)) + "</span>",
          "per trade with a stop") +
        tile("Total P&L", '<span class="' + pnlCls + '">' +
          F.escapeHtml(s.totalPnl === null ? "—" : signedPnl(s.totalPnl)) + "</span>",
          "realized", "kpi--hero") +
        tile("Best Trade", bestHtml, "largest winner") +
        tile("Worst Trade", worstHtml, "largest loser") +
      "</div>" + sampleNote;

    if (window.lucide) window.lucide.createIcons();
  }

  // ---------- add / edit form ----------
  function inputRow(name, label, value, opts) {
    opts = opts || {};
    var attrs = 'type="' + (opts.type || "text") + '"';
    if (opts.step) attrs += ' step="' + opts.step + '"';
    if (opts.min) attrs += ' min="' + opts.min + '"';
    if (opts.placeholder) attrs += ' placeholder="' + F.escapeHtml(opts.placeholder) + '"';
    return '<div class="field">' +
      '<label class="field__label" for="jf_' + name + '">' + F.escapeHtml(label) + "</label>" +
      '<input class="input num" id="jf_' + name + '" name="' + name + '" ' + attrs +
      ' value="' + F.escapeHtml(value == null ? "" : String(value)) + '" /></div>';
  }

  function renderForm(trade) {
    var host = document.getElementById("journalForm");
    if (!host) return;
    var t = trade || {};
    var isEdit = !!trade;
    var dir = t.direction || "Long";

    host.innerHTML =
      '<article class="card jr-form-card">' +
        '<div class="card__header">' +
          '<h3 class="card__title">' + (isEdit ? "Edit trade" : "Log a trade") + "</h3>" +
          (isEdit ? '<button type="button" class="btn btn--ghost btn--sm" id="jrCancelEdit">Cancel</button>' : "") +
        "</div>" +
        '<form id="jrForm" class="jr-form" autocomplete="off">' +
          '<div class="jr-form__grid">' +
            '<div class="field">' +
              '<label class="field__label" for="jf_ticker">Ticker</label>' +
              '<input class="input" id="jf_ticker" name="ticker" required placeholder="e.g. AAPL" ' +
                'value="' + F.escapeHtml(t.ticker || "") + '" /></div>' +
            '<div class="field">' +
              '<label class="field__label" for="jf_direction">Direction</label>' +
              '<select class="input select" id="jf_direction" name="direction">' +
                '<option value="Long"' + (dir === "Long" ? " selected" : "") + ">Long</option>" +
                '<option value="Short"' + (dir === "Short" ? " selected" : "") + ">Short</option>" +
              "</select></div>" +
            inputRow("size", "Size (shares / contracts)", t.size, { type: "number", step: "any", min: "0", placeholder: "100" }) +
            inputRow("entry", "Entry price", t.entry, { type: "number", step: "any", placeholder: "0.00" }) +
            inputRow("exit", "Exit price (blank = open)", t.exit, { type: "number", step: "any", placeholder: "0.00" }) +
            inputRow("stop", "Stop (optional)", t.stop, { type: "number", step: "any", placeholder: "0.00" }) +
            inputRow("target", "Target (optional)", t.target, { type: "number", step: "any", placeholder: "0.00" }) +
            inputRow("entryDate", "Entry date", t.entryDate, { type: "date" }) +
            inputRow("exitDate", "Exit date (blank = open)", t.exitDate, { type: "date" }) +
            '<div class="field">' +
              '<label class="field__label" for="jf_setup">Setup / strategy tag</label>' +
              '<input class="input" id="jf_setup" name="setup" placeholder="e.g. Sweep + reclaim" ' +
                'value="' + F.escapeHtml(t.setup || "") + '" /></div>' +
          "</div>" +
          '<div class="field field--full">' +
            '<label class="field__label" for="jf_notes">Notes / reason</label>' +
            '<textarea class="input textarea" id="jf_notes" name="notes" rows="3" ' +
              'placeholder="Why you took it, how it played out, what you would do again">' +
              F.escapeHtml(t.notes || "") + "</textarea></div>" +
          '<div class="jr-form__actions">' +
            '<button type="submit" class="btn btn--primary">' +
              (isEdit ? "Save changes" : "Add trade") + "</button>" +
            (isEdit ? "" : '<button type="reset" class="btn btn--ghost">Clear</button>') +
          "</div>" +
        "</form>" +
      "</article>";

    document.getElementById("jrForm").addEventListener("submit", onSubmit);
    var cancel = document.getElementById("jrCancelEdit");
    if (cancel) cancel.addEventListener("click", function () { editingId = null; renderForm(null); });
  }

  function onSubmit(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var ticker = String(fd.get("ticker") || "").trim().toUpperCase();
    if (!ticker) return;

    var record = {
      ticker: ticker,
      direction: fd.get("direction") === "Short" ? "Short" : "Long",
      size: emptyToNull(fd.get("size")),
      entry: emptyToNull(fd.get("entry")),
      exit: emptyToNull(fd.get("exit")),
      stop: emptyToNull(fd.get("stop")),
      target: emptyToNull(fd.get("target")),
      entryDate: String(fd.get("entryDate") || "").trim() || todayISO(),
      exitDate: String(fd.get("exitDate") || "").trim() || null,
      setup: String(fd.get("setup") || "").trim(),
      notes: String(fd.get("notes") || "").trim()
    };

    var list = load();
    if (editingId) {
      list = list.map(function (t) {
        if (t.id !== editingId) return t;
        return Object.assign({}, t, record);
      });
      editingId = null;
    } else {
      record.id = uid();
      record.createdAt = new Date().toISOString();
      list = [record].concat(list);
    }
    save(list);
    renderForm(null);
    renderAll(list);
    scrollToTable();
  }

  function emptyToNull(v) {
    var s = String(v == null ? "" : v).trim();
    if (s === "") return null;
    var n = Number(s);
    return isNaN(n) ? null : n;
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  // ---------- trades table ----------
  function pill(outcome) {
    var cls = outcome === "Win" ? "pill--win"
      : outcome === "Loss" ? "pill--loss"
      : outcome === "Flat" ? "pill--flat" : "pill--open";
    var glyph = outcome === "Win" ? "▲" : outcome === "Loss" ? "▼" : outcome === "Open" ? "○" : "—";
    return '<span class="pill ' + cls + '"><span aria-hidden="true">' + glyph +
      "</span>" + F.escapeHtml(outcome) + "</span>";
  }

  function renderTable(list) {
    var host = document.getElementById("journalTable");
    if (!host) return;

    if (!list.length) {
      host.innerHTML =
        '<div class="jr-empty card">' +
          '<div class="jr-empty__icon"><i data-lucide="notebook-pen"></i></div>' +
          '<div class="jr-empty__title">Log your first trade</div>' +
          '<div class="jr-empty__sub">Your journal is empty. Record a trade above to start ' +
            "tracking P&amp;L, R-multiple, and your win rate — or restore the demo set.</div>" +
          '<div class="jr-empty__actions">' +
            '<button type="button" class="btn btn--primary btn--sm" id="jrEmptyAdd">Log a trade</button>' +
            '<button type="button" class="btn btn--secondary btn--sm" id="jrEmptyDemo">Restore demo</button>' +
          "</div>" +
        "</div>";
      var add = document.getElementById("jrEmptyAdd");
      if (add) add.addEventListener("click", function () {
        document.getElementById("jf_ticker").focus();
        document.getElementById("journalForm").scrollIntoView({ block: "center" });
      });
      var demo = document.getElementById("jrEmptyDemo");
      if (demo) demo.addEventListener("click", resetDemo);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    var sorted = list.slice().sort(function (a, b) {
      var da = a.entryDate || "", db = b.entryDate || "";
      if (da === db) {
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      }
      return sortDir === "desc" ? db.localeCompare(da) : da.localeCompare(db);
    });

    var rows = sorted.map(function (t) {
      var c = compute(t);
      var pnlHtml = c.pnl === null ? "—"
        : '<span class="' + upDown(c.pnl) + '">' + F.escapeHtml(signedPnl(c.pnl)) + "</span>";
      var rHtml = c.r === null ? "—"
        : '<span class="' + upDown(c.r) + '">' + F.escapeHtml(signedR(c.r)) + "</span>";
      var dirCls = t.direction === "Short" ? "jr-dir--short" : "jr-dir--long";
      return '<tr class="jr-row" data-id="' + F.escapeHtml(t.id) + '" tabindex="0">' +
        '<td class="jr-date">' + F.escapeHtml(F.formatDate(t.entryDate)) + "</td>" +
        '<td class="jr-ticker">' + F.escapeHtml(t.ticker) +
          (t.setup ? '<span class="jr-setup">' + F.escapeHtml(t.setup) + "</span>" : "") + "</td>" +
        '<td><span class="jr-dir ' + dirCls + '">' + F.escapeHtml(t.direction) + "</span></td>" +
        '<td class="num jr-r-align">' + F.escapeHtml(F.formatPrice(t.entry)) + "</td>" +
        '<td class="num jr-r-align">' + (t.exit == null ? "—" : F.escapeHtml(F.formatPrice(t.exit))) + "</td>" +
        '<td class="num jr-r-align">' + (t.size == null ? "—" : F.escapeHtml(F.formatNumber(t.size))) + "</td>" +
        '<td class="num jr-r-align jr-pnl">' + pnlHtml + "</td>" +
        '<td class="num jr-r-align">' + rHtml + "</td>" +
        '<td>' + pill(c.outcome) + "</td>" +
        '<td class="jr-actions-cell">' +
          '<button type="button" class="jr-del" data-del="' + F.escapeHtml(t.id) +
          '" aria-label="Delete trade"><i data-lucide="trash-2"></i></button></td>' +
        "</tr>";
    }).join("");

    var arrow = sortDir === "desc" ? "▼" : "▲";
    host.innerHTML =
      '<article class="card jr-table-card">' +
        '<div class="card__header">' +
          '<h3 class="card__title">Trades</h3>' +
          '<span class="jr-table-hint">Click a row to edit</span>' +
        "</div>" +
        '<div class="jr-table-scroll">' +
          '<table class="jr-table">' +
            "<thead><tr>" +
              '<th class="jr-sort" id="jrSortDate" role="button" tabindex="0">Date ' +
                '<span class="jr-sort__arrow">' + arrow + "</span></th>" +
              "<th>Ticker</th><th>Dir</th>" +
              '<th class="jr-r-align">Entry</th>' +
              '<th class="jr-r-align">Exit</th>' +
              '<th class="jr-r-align">Size</th>' +
              '<th class="jr-r-align">P&amp;L</th>' +
              '<th class="jr-r-align">R</th>' +
              "<th>Outcome</th><th></th>" +
            "</tr></thead>" +
            "<tbody>" + rows + "</tbody>" +
          "</table>" +
        "</div>" +
      "</article>";

    if (window.lucide) window.lucide.createIcons();
  }

  // ---------- table interactions ----------
  function onTableClick(e) {
    var del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      var id = del.getAttribute("data-del");
      if (window.confirm("Delete this trade? This cannot be undone.")) {
        var list = load().filter(function (t) { return t.id !== id; });
        save(list);
        if (editingId === id) { editingId = null; renderForm(null); }
        renderAll(list);
      }
      return;
    }
    var sortBtn = e.target.closest("#jrSortDate");
    if (sortBtn) {
      sortDir = sortDir === "desc" ? "asc" : "desc";
      renderTable(load());
      return;
    }
    var row = e.target.closest(".jr-row");
    if (row) startEdit(row.getAttribute("data-id"));
  }

  function startEdit(id) {
    var trade = load().filter(function (t) { return t.id === id; })[0];
    if (!trade) return;
    editingId = id;
    renderForm(trade);
    document.getElementById("journalForm").scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function scrollToTable() {
    var el = document.getElementById("journalTable");
    if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  // ---------- export / import / reset ----------
  function exportJson() {
    var blob = new Blob([JSON.stringify(load(), null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "marketlens-journal-" + todayISO() + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error("Expected an array of trades");
        var clean = parsed.filter(function (t) { return t && typeof t === "object"; })
          .map(function (t) {
            if (!t.id) t.id = uid();
            return t;
          });
        save(clean);
        editingId = null;
        renderForm(null);
        renderAll(clean);
      } catch (err) {
        window.alert("Could not import: " + (err && err.message ? err.message : "invalid JSON file."));
      }
    };
    reader.readAsText(file);
  }

  function resetDemo() {
    if (!window.confirm("Reset the journal to the demo trades? Your current entries will be replaced.")) return;
    var seed = seedTrades();
    save(seed);
    editingId = null;
    renderForm(null);
    renderAll(seed);
  }

  // ---------- orchestration ----------
  function renderAll(list) {
    renderKpis(list);
    renderTable(list);
  }

  var wired = false;
  function wireToolbar() {
    if (wired) return;
    wired = true;
    var exp = document.getElementById("jrExport");
    var imp = document.getElementById("jrImport");
    var reset = document.getElementById("jrReset");
    var fileInput = document.getElementById("jrFile");
    var table = document.getElementById("journalTable");
    if (exp) exp.addEventListener("click", exportJson);
    if (imp && fileInput) imp.addEventListener("click", function () { fileInput.click(); });
    if (fileInput) fileInput.addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importJson(f);
      e.target.value = "";
    });
    if (reset) reset.addEventListener("click", resetDemo);
    if (table) table.addEventListener("click", onTableClick);
  }

  function init() { /* lazy — work happens on first onShow */ }

  function onShow() {
    wireToolbar();
    if (!editingId) renderForm(null);
    renderAll(load());
  }

  window.MLJournal = { init: init, onShow: onShow };
})();
