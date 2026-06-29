/* Chart.js price-history rendering.
 *
 * Timeframe toggles:
 *   Daily-derived (always available): 1W, 1M, 3M, 6M, 1Y
 *   Intraday (available only when the matching series has data): 1D, 1H, 4H
 *
 * Daily ranges slice the daily history series. Intraday ranges (and 1W) use the
 * finer intraday series fetched from FMP's /historical-chart endpoints. When an
 * intraday series is empty (tier-restricted live key), its toggle is DISABLED
 * rather than rendering a broken/empty chart. In demo mode every series is
 * populated, so every toggle works.
 */
(function () {
  "use strict";

  var ACCENT = "#7FFF00";
  var chartInstance = null;
  var currentRange = "3M";

  // Normalized ascending series. Each point: { label, close }.
  var series = { daily: [], h1: [], h4: [], d1: [] };

  // How many trailing points each daily range shows (~trading days).
  var DAILY_DAYS = { "1M": 22, "3M": 66, "6M": 132, "1Y": 365 };
  // Trailing intraday bars to show per intraday range.
  var INTRADAY_BARS = { "1D": 26, "1H": 16, "4H": 30, "1W": 40 };
  var DAILY_RANGES = ["1W", "1M", "3M", "6M", "1Y"];

  function tail(arr, n) {
    if (!arr || arr.length <= n) return (arr || []).slice();
    return arr.slice(arr.length - n);
  }

  // Returns { points: [{label,close}], intraday: bool } for a range.
  function resolveRange(range) {
    if (DAILY_DAYS[range]) {
      return { points: tail(series.daily, DAILY_DAYS[range]), intraday: false };
    }
    if (range === "1W") {
      // Prefer hourly bars over the last week; fall back to ~5 daily closes.
      if (series.h1.length) {
        return { points: tail(series.h1, INTRADAY_BARS["1W"]), intraday: true };
      }
      return { points: tail(series.daily, 5), intraday: false };
    }
    if (range === "1D") {
      return { points: tail(series.d1, INTRADAY_BARS["1D"]), intraday: true };
    }
    if (range === "1H") {
      return { points: tail(series.h1, INTRADAY_BARS["1H"]), intraday: true };
    }
    if (range === "4H") {
      return { points: tail(series.h4, INTRADAY_BARS["4H"]), intraday: true };
    }
    return { points: tail(series.daily, DAILY_DAYS["3M"]), intraday: false };
  }

  // Which ranges currently have data to render.
  function isAvailable(range) {
    if (DAILY_RANGES.indexOf(range) !== -1) return series.daily.length > 0;
    if (range === "1D") return series.d1.length > 0;
    if (range === "1H") return series.h1.length > 0;
    if (range === "4H") return series.h4.length > 0;
    return false;
  }

  function buildGradient(ctx, area) {
    var g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, "rgba(127, 255, 0, 0.35)");
    g.addColorStop(1, "rgba(127, 255, 0, 0.02)");
    return g;
  }

  // X-axis tick: date for daily ranges, time-of-day for intraday ranges.
  function formatTick(label, intraday, range) {
    if (!label) return "";
    if (!intraday) return String(label).slice(5); // MM-DD
    var s = String(label);
    var time = s.length >= 16 ? s.slice(11, 16) : s; // HH:MM
    // For multi-day intraday windows, prefix the day so ticks read clearly.
    if (range === "1H" || range === "4H" || range === "1W") {
      return s.slice(5, 10) + " " + time; // MM-DD HH:MM
    }
    return time;
  }

  function render(range) {
    currentRange = range || currentRange;
    if (!isAvailable(currentRange)) {
      // Requested range has no data -> fall back to a safe daily range.
      currentRange = "3M";
    }
    var canvas = document.getElementById("priceChart");
    if (!canvas || typeof Chart === "undefined") return;

    var resolved = resolveRange(currentRange);
    var data = resolved.points;
    var intraday = resolved.intraday;
    var rangeForTicks = currentRange;
    var labels = data.map(function (d) { return d.label; });
    var values = data.map(function (d) { return d.close; });

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Close",
          data: values,
          borderColor: ACCENT,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: ACCENT,
          tension: 0.25,
          fill: true,
          backgroundColor: function (context) {
            var chart = context.chart;
            if (!chart.chartArea) return "rgba(127,255,0,0.1)";
            return buildGradient(chart.ctx, chart.chartArea);
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#162d1a",
            borderColor: "rgba(127,255,0,0.3)",
            borderWidth: 1,
            titleColor: "#f1f5f9",
            bodyColor: "#b8e6b8",
            callbacks: {
              title: function (items) {
                return items && items.length ? String(items[0].label) : "";
              },
              label: function (ctx) {
                return "$" + Number(ctx.parsed.y).toFixed(2);
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: "#90c890", maxTicksLimit: 6, maxRotation: 0,
              callback: function (val, idx) {
                return formatTick(labels[idx], intraday, rangeForTicks);
              }
            }
          },
          y: {
            grid: { color: "rgba(127,255,0,0.08)" },
            ticks: {
              color: "#90c890",
              callback: function (v) { return "$" + v; }
            }
          }
        }
      }
    });
  }

  // Normalize an FMP-style list ([{date, close}], newest-first) to ascending
  // [{label, close}] with the original date/datetime string preserved.
  function normalize(list) {
    var arr = Array.isArray(list) ? list : [];
    var out = arr.map(function (h) {
      return { label: String(h.date), close: Number(h.close) };
    }).filter(function (h) { return !isNaN(h.close); });
    out.sort(function (a, b) { return a.label < b.label ? -1 : 1; });
    return out;
  }

  // Enable/disable each toggle button to match data availability, and reflect
  // the active range. Unavailable intraday toggles become disabled + dimmed.
  function syncToggles() {
    var toggle = document.getElementById("rangeToggle");
    if (!toggle) return;
    toggle.querySelectorAll(".range-btn").forEach(function (btn) {
      var range = btn.getAttribute("data-range");
      var available = isAvailable(range);
      btn.disabled = !available;
      btn.classList.toggle("is-disabled", !available);
      btn.title = available ? "" : "Not available on this data tier";
      btn.classList.toggle("is-active", available && range === currentRange);
    });
  }

  // Accept the full bundle from app.js: daily history + intraday charts.
  function setData(bundle) {
    bundle = bundle || {};
    var hist = (bundle.history && bundle.history.historical) || [];
    var charts = bundle.charts || {};
    series = {
      daily: normalize(hist),
      d1: normalize(charts.d1),
      h1: normalize(charts.h1),
      h4: normalize(charts.h4)
    };
    if (!isAvailable(currentRange)) currentRange = "3M";
    render(currentRange);
    syncToggles();
  }

  window.MLChart = {
    setData: setData,
    render: function (range) { render(range); syncToggles(); },
    isAvailable: isAvailable
  };
})();
