/* Small formatting helpers shared across the app. */
(function () {
  "use strict";

  function formatPrice(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return "$" + Number(n).toLocaleString("en-US", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  function formatNumber(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Number(n).toLocaleString("en-US");
  }

  // Compact market-cap / volume style: 3.25T, 786.0B, 48.2M, 12.3K.
  function formatCompact(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    var abs = Math.abs(n);
    if (abs >= 1e12) return (n / 1e12).toFixed(2) + "T";
    if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (abs >= 1e3) return (n / 1e3).toFixed(2) + "K";
    return String(n);
  }

  function formatPercent(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    var sign = n >= 0 ? "+" : "";
    return sign + Number(n).toFixed(2) + "%";
  }

  function formatSignedPrice(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    var sign = n >= 0 ? "+" : "-";
    return sign + "$" + Math.abs(Number(n)).toFixed(2);
  }

  function formatDate(raw) {
    if (!raw) return "";
    var s = String(raw).replace(" ", "T");
    // Date-only strings ("2026-07-01") parse as UTC midnight and render a day
    // early in US timezones — anchor them to local midnight instead.
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += "T00:00:00";
    var d = new Date(s);
    if (isNaN(d.getTime())) return String(raw).slice(0, 10);
    return d.toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric"
    });
  }

  // Basic HTML escaping for any text that comes from an API response.
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.MLFormat = {
    formatPrice: formatPrice,
    formatNumber: formatNumber,
    formatCompact: formatCompact,
    formatPercent: formatPercent,
    formatSignedPrice: formatSignedPrice,
    formatDate: formatDate,
    escapeHtml: escapeHtml
  };
})();
