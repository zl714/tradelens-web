/* Chart.js price-history rendering with 1M / 3M / 1Y range slicing. */
(function () {
  "use strict";

  var ACCENT = "#7FFF00";
  var chartInstance = null;
  var fullSeries = []; // [{ date, close }] ascending by date
  var currentRange = "3M";

  var RANGE_DAYS = { "1M": 22, "3M": 66, "1Y": 365 };

  function sliceRange(series, range) {
    var n = RANGE_DAYS[range] || series.length;
    if (series.length <= n) return series.slice();
    return series.slice(series.length - n);
  }

  function buildGradient(ctx, area) {
    var g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, "rgba(127, 255, 0, 0.35)");
    g.addColorStop(1, "rgba(127, 255, 0, 0.02)");
    return g;
  }

  function render(range) {
    currentRange = range || currentRange;
    var canvas = document.getElementById("priceChart");
    if (!canvas || typeof Chart === "undefined") return;

    var data = sliceRange(fullSeries, currentRange);
    var labels = data.map(function (d) { return d.date; });
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
                var label = labels[idx] || "";
                return label.slice(5); // MM-DD
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

  function setSeries(historyPayload) {
    var hist = (historyPayload && historyPayload.historical) || [];
    // FMP returns newest-first; normalize to ascending by date.
    var series = hist.slice().map(function (h) {
      return { date: String(h.date).slice(0, 10), close: Number(h.close) };
    }).filter(function (h) { return !isNaN(h.close); });
    series.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    fullSeries = series;
    render(currentRange);
  }

  window.MLChart = { setSeries: setSeries, render: render };
})();
