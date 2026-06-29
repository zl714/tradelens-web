/* Rules / Playbook view.
 *
 * A plain place to WRITE DOWN trading rules — no AI, no grading. Each rule is a
 * title + body + category (Entry / Exit / Risk / Mindset / General). Rules can be
 * added, edited, deleted, and reordered (within their category), and are grouped
 * into category sections. A separate free-form, auto-saving Notes textarea holds
 * everything that does not fit a discrete rule. Both the rules list and the notes
 * persist in localStorage under their own keys, with JSON export / import.
 */
(function () {
  "use strict";

  var RULES_KEY = "marketlens.playbook.rules.v1";
  var NOTES_KEY = "marketlens.playbook.notes.v1";
  var F = window.MLFormat;
  var CATEGORIES = ["Entry", "Exit", "Risk", "Mindset", "General"];
  var editingId = null;
  var notesTimer = null;

  // ---------- demo seed (clearly-editable starter rules) ----------
  function seedRules() {
    return [
      mk("Entry", "Enter on the reclaim, not the touch",
        "Only enter within ~5pt of a marked level once price reclaims / rejects it. The level alarm is the alarm clock; the reclaim is the trade. No reclaim = no entry."),
      mk("Entry", "One clean setup at a time",
        "Wait for sweep + reclaim or touch + bounce. If you cannot name the setup in one sentence, it is not a setup."),
      mk("Exit", "Stop below the sweep extreme, not the level",
        "After a sweep + reclaim, place the stop beyond the sweep wick — not just under the level. Close-to-level chop is normal and is not a reason to bail."),
      mk("Exit", "Take partials at the first target, trail the runner",
        "Bank some risk at the first logical target. Trail the remainder under the last higher low (longs) / lower high (shorts)."),
      mk("Risk", "Risk 1–2% per trade, hard cap",
        "Size every position so a full stop loses no more than 1–2% of the account. Position size is an output of the stop distance, never a feeling."),
      mk("Risk", "Two losers in a row = step away",
        "After two consecutive losing trades, stop for the session (or take a real break). Tilt is the most expensive setup on the board."),
      mk("Mindset", "Max ~1 trade/hour in chop",
        "In chop the default is SKIP. Cap yourself near one trade per hour and only take it when the chart screams. Boredom is not a signal."),
      mk("General", "Only trade 9:30am–5pm ET",
        "Trade the liquid window (9:30am–5pm ET) and skip the 12–4am dead hours. Best setups live in the active session, not the overnight grind.")
    ];
  }

  function mk(category, title, body) {
    return { id: uid(), category: category, title: title, body: body };
  }
  function uid() {
    return "r_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  // ---------- persistence ----------
  function loadRules() {
    try {
      var raw = localStorage.getItem(RULES_KEY);
      if (raw === null) { var s = seedRules(); saveRules(s); return s; }
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { /* corrupt — reseed */ }
    var seed = seedRules();
    saveRules(seed);
    return seed;
  }
  function saveRules(list) {
    try { localStorage.setItem(RULES_KEY, JSON.stringify(list)); }
    catch (e) { /* ignore */ }
  }
  function loadNotes() {
    try { return localStorage.getItem(NOTES_KEY) || ""; }
    catch (e) { return ""; }
  }
  function saveNotes(text) {
    try { localStorage.setItem(NOTES_KEY, text); }
    catch (e) { /* ignore */ }
  }

  // ---------- add / edit form ----------
  function categoryOptions(selected) {
    return CATEGORIES.map(function (c) {
      return '<option value="' + c + '"' + (c === selected ? " selected" : "") + ">" + c + "</option>";
    }).join("");
  }

  function renderForm(rule) {
    var host = document.getElementById("rulesForm");
    if (!host) return;
    var r = rule || {};
    var isEdit = !!rule;
    host.innerHTML =
      '<article class="card pb-form-card">' +
        '<div class="card__header">' +
          '<h3 class="card__title">' + (isEdit ? "Edit rule" : "Add a rule") + "</h3>" +
          (isEdit ? '<button type="button" class="btn btn--ghost btn--sm" id="pbCancelEdit">Cancel</button>' : "") +
        "</div>" +
        '<form id="pbForm" class="pb-form" autocomplete="off">' +
          '<div class="pb-form__top">' +
            '<div class="field">' +
              '<label class="field__label" for="pf_title">Rule title</label>' +
              '<input class="input" id="pf_title" name="title" required ' +
                'placeholder="e.g. Risk 1–2% per trade" value="' + F.escapeHtml(r.title || "") + '" /></div>' +
            '<div class="field field--cat">' +
              '<label class="field__label" for="pf_category">Category</label>' +
              '<select class="input select" id="pf_category" name="category">' +
                categoryOptions(r.category || "General") + "</select></div>" +
          "</div>" +
          '<div class="field field--full">' +
            '<label class="field__label" for="pf_body">Detail</label>' +
            '<textarea class="input textarea" id="pf_body" name="body" rows="3" ' +
              'placeholder="Spell out exactly what the rule means and when it applies.">' +
              F.escapeHtml(r.body || "") + "</textarea></div>" +
          '<div class="pb-form__actions">' +
            '<button type="submit" class="btn btn--primary">' +
              (isEdit ? "Save changes" : "Add rule") + "</button>" +
            (isEdit ? "" : '<button type="reset" class="btn btn--ghost">Clear</button>') +
          "</div>" +
        "</form>" +
      "</article>";

    document.getElementById("pbForm").addEventListener("submit", onSubmit);
    var cancel = document.getElementById("pbCancelEdit");
    if (cancel) cancel.addEventListener("click", function () { editingId = null; renderForm(null); });
  }

  function onSubmit(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var title = String(fd.get("title") || "").trim();
    if (!title) return;
    var category = CATEGORIES.indexOf(fd.get("category")) !== -1 ? fd.get("category") : "General";
    var body = String(fd.get("body") || "").trim();

    var list = loadRules();
    if (editingId) {
      list = list.map(function (r) {
        if (r.id !== editingId) return r;
        return Object.assign({}, r, { title: title, category: category, body: body });
      });
      editingId = null;
    } else {
      list = list.concat([{ id: uid(), category: category, title: title, body: body }]);
    }
    saveRules(list);
    renderForm(null);
    renderRules(list);
  }

  // ---------- rules list (grouped by category) ----------
  function ruleHtml(r, idx, count) {
    return '<li class="pb-rule" data-id="' + F.escapeHtml(r.id) + '">' +
      '<div class="pb-rule__main">' +
        '<div class="pb-rule__title">' + F.escapeHtml(r.title) + "</div>" +
        (r.body ? '<div class="pb-rule__body">' + F.escapeHtml(r.body) + "</div>" : "") +
      "</div>" +
      '<div class="pb-rule__actions">' +
        '<button type="button" class="pb-icon" data-move="up" data-id="' + F.escapeHtml(r.id) +
          '"' + (idx === 0 ? " disabled" : "") + ' aria-label="Move up"><i data-lucide="chevron-up"></i></button>' +
        '<button type="button" class="pb-icon" data-move="down" data-id="' + F.escapeHtml(r.id) +
          '"' + (idx === count - 1 ? " disabled" : "") + ' aria-label="Move down"><i data-lucide="chevron-down"></i></button>' +
        '<button type="button" class="pb-icon" data-edit="' + F.escapeHtml(r.id) +
          '" aria-label="Edit rule"><i data-lucide="pencil"></i></button>' +
        '<button type="button" class="pb-icon pb-icon--del" data-del="' + F.escapeHtml(r.id) +
          '" aria-label="Delete rule"><i data-lucide="trash-2"></i></button>' +
      "</div>" +
    "</li>";
  }

  function renderRules(list) {
    var host = document.getElementById("rulesList");
    if (!host) return;

    if (!list.length) {
      host.innerHTML =
        '<div class="pb-empty card">' +
          '<div class="pb-empty__icon"><i data-lucide="list-checks"></i></div>' +
          '<div class="pb-empty__title">Write your first rule</div>' +
          '<div class="pb-empty__sub">Your playbook is empty. Add the rules you actually trade by ' +
            "— entries, exits, risk, mindset — or restore the starter set.</div>" +
          '<div class="pb-empty__actions">' +
            '<button type="button" class="btn btn--primary btn--sm" id="pbEmptyAdd">Add a rule</button>' +
            '<button type="button" class="btn btn--secondary btn--sm" id="pbEmptyDemo">Restore starters</button>' +
          "</div>" +
        "</div>";
      var add = document.getElementById("pbEmptyAdd");
      if (add) add.addEventListener("click", function () {
        document.getElementById("pf_title").focus();
        document.getElementById("rulesForm").scrollIntoView({ block: "center" });
      });
      var demo = document.getElementById("pbEmptyDemo");
      if (demo) demo.addEventListener("click", resetDemo);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Group preserving each rule's position within its category.
    var sections = CATEGORIES.map(function (cat) {
      var inCat = list.filter(function (r) { return r.category === cat; });
      if (!inCat.length) return "";
      var items = inCat.map(function (r, i) { return ruleHtml(r, i, inCat.length); }).join("");
      return '<section class="pb-section">' +
        '<div class="pb-section__head">' +
          '<h3 class="pb-section__title">' + F.escapeHtml(cat) + "</h3>" +
          '<span class="pb-section__count num">' + inCat.length + "</span>" +
        "</div>" +
        '<ul class="pb-rules">' + items + "</ul>" +
      "</section>";
    }).join("");

    host.innerHTML = sections;
    if (window.lucide) window.lucide.createIcons();
  }

  // ---------- list interactions ----------
  function onListClick(e) {
    var move = e.target.closest("[data-move]");
    if (move && !move.disabled) {
      reorder(move.getAttribute("data-id"), move.getAttribute("data-move"));
      return;
    }
    var edit = e.target.closest("[data-edit]");
    if (edit) {
      var r = loadRules().filter(function (x) { return x.id === edit.getAttribute("data-edit"); })[0];
      if (r) {
        editingId = r.id;
        renderForm(r);
        document.getElementById("rulesForm").scrollIntoView({ block: "start", behavior: "smooth" });
      }
      return;
    }
    var del = e.target.closest("[data-del]");
    if (del) {
      var id = del.getAttribute("data-del");
      if (window.confirm("Delete this rule?")) {
        var list = loadRules().filter(function (x) { return x.id !== id; });
        saveRules(list);
        if (editingId === id) { editingId = null; renderForm(null); }
        renderRules(list);
      }
    }
  }

  // Swap a rule with its neighbour in the SAME category (visual reorder).
  function reorder(id, dir) {
    var list = loadRules();
    var rule = list.filter(function (r) { return r.id === id; })[0];
    if (!rule) return;
    var sameCat = list.filter(function (r) { return r.category === rule.category; });
    var pos = sameCat.indexOf(rule);
    var swapWith = dir === "up" ? sameCat[pos - 1] : sameCat[pos + 1];
    if (!swapWith) return;
    var iA = list.indexOf(rule), iB = list.indexOf(swapWith);
    var next = list.slice();
    next[iA] = swapWith;
    next[iB] = rule;
    saveRules(next);
    renderRules(next);
  }

  // ---------- free-form notes (auto-save) ----------
  function renderNotes() {
    var host = document.getElementById("rulesNotes");
    if (!host) return;
    host.innerHTML =
      '<article class="card pb-notes-card">' +
        '<div class="card__header">' +
          '<h3 class="card__title">Playbook notes</h3>' +
          '<span class="pb-save" id="pbSaveState"></span>' +
        "</div>" +
        '<textarea class="input textarea pb-notes" id="pbNotes" rows="6" ' +
          'placeholder="Free-form notes — market context, recurring mistakes, reminders. Saves automatically.">' +
          F.escapeHtml(loadNotes()) + "</textarea>" +
      "</article>";

    var ta = document.getElementById("pbNotes");
    ta.addEventListener("input", function () {
      var state = document.getElementById("pbSaveState");
      if (state) { state.textContent = "Saving…"; state.className = "pb-save pb-save--pending"; }
      if (notesTimer) clearTimeout(notesTimer);
      notesTimer = setTimeout(function () {
        saveNotes(ta.value);
        if (state) { state.textContent = "Saved"; state.className = "pb-save pb-save--done"; }
      }, 500);
    });
    ta.addEventListener("blur", function () {
      if (notesTimer) clearTimeout(notesTimer);
      saveNotes(ta.value);
      var state = document.getElementById("pbSaveState");
      if (state) { state.textContent = "Saved"; state.className = "pb-save pb-save--done"; }
    });
  }

  // ---------- export / import / reset ----------
  function exportJson() {
    var payload = { rules: loadRules(), notes: loadNotes() };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "marketlens-playbook-" + new Date().toISOString().slice(0, 10) + ".json";
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
        // Accept either { rules, notes } or a bare rules array.
        var rules = Array.isArray(parsed) ? parsed : parsed.rules;
        if (!Array.isArray(rules)) throw new Error("No rules array found");
        var clean = rules.filter(function (r) { return r && typeof r === "object" && r.title; })
          .map(function (r) {
            return {
              id: r.id || uid(),
              category: CATEGORIES.indexOf(r.category) !== -1 ? r.category : "General",
              title: String(r.title),
              body: String(r.body || "")
            };
          });
        saveRules(clean);
        if (!Array.isArray(parsed) && typeof parsed.notes === "string") saveNotes(parsed.notes);
        editingId = null;
        renderForm(null);
        renderRules(clean);
        renderNotes();
      } catch (err) {
        window.alert("Could not import: " + (err && err.message ? err.message : "invalid JSON file."));
      }
    };
    reader.readAsText(file);
  }

  function resetDemo() {
    if (!window.confirm("Reset the playbook to the starter rules? Your current rules will be replaced.")) return;
    var seed = seedRules();
    saveRules(seed);
    editingId = null;
    renderForm(null);
    renderRules(seed);
  }

  // ---------- orchestration ----------
  var wired = false;
  function wireToolbar() {
    if (wired) return;
    wired = true;
    var exp = document.getElementById("pbExport");
    var imp = document.getElementById("pbImport");
    var reset = document.getElementById("pbReset");
    var fileInput = document.getElementById("pbFile");
    var listHost = document.getElementById("rulesList");
    if (exp) exp.addEventListener("click", exportJson);
    if (imp && fileInput) imp.addEventListener("click", function () { fileInput.click(); });
    if (fileInput) fileInput.addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importJson(f);
      e.target.value = "";
    });
    if (reset) reset.addEventListener("click", resetDemo);
    if (listHost) listHost.addEventListener("click", onListClick);
  }

  function init() { /* lazy — first onShow renders */ }

  function onShow() {
    wireToolbar();
    if (!editingId) renderForm(null);
    renderRules(loadRules());
    renderNotes();
  }

  window.MLRules = { init: init, onShow: onShow };
})();
