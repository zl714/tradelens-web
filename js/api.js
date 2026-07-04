/* Data access layer.
 *
 * fetchEndpoint() calls the Vercel serverless proxy at /api/data. If that call
 * fails for ANY reason (no server when opened as a local file, network error,
 * non-OK status, bad JSON), it falls back to the bundled client-side SAMPLE so
 * the UI is never blank. Returns a normalized { source, data } envelope where
 * source is "live" or "demo".
 */
(function () {
  "use strict";

  var API_BASE = "/api/data";

  function clientSample(endpoint, symbol) {
    var sample = window.MARKETLENS_SAMPLE || {};
    var sym = (symbol || "AAPL").toUpperCase();
    // Only symbols actually bundled in the sample have demo data. Unknown
    // tickers return null so the UI shows its "No data found" error instead
    // of silently rendering the wrong company.
    var record = sample[sym];
    if (!record) return { source: "demo", data: null };
    var data;
    if (endpoint === "history") {
      data = { symbol: sym, historical: record.history };
    } else {
      // quote / profile / news / chart1h / chart4h / chart1d
      data = record[endpoint];
    }
    return { source: "demo", data: data == null ? null : data };
  }

  function fetchEndpoint(endpoint, symbol) {
    var url = API_BASE + "?endpoint=" + encodeURIComponent(endpoint) +
      "&symbol=" + encodeURIComponent(symbol);

    return fetch(url, { headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        // Backend explicitly reports an intraday endpoint is tier-restricted.
        // Propagate the null so the UI can DISABLE that toggle (do NOT fall
        // back to client demo here — that would show demo intraday on a live
        // chart).
        if (json && json.source === "unavailable") {
          return { source: "unavailable", data: null };
        }
        if (!json || json.source === "error" || json.data == null) {
          // Backend reported an error or empty payload -> client demo.
          return clientSample(endpoint, symbol);
        }
        return { source: json.source || "live", data: json.data };
      })
      .catch(function () {
        // No backend / network failure -> client demo (never throws upward).
        return clientSample(endpoint, symbol);
      });
  }

  // Load every endpoint for a symbol at once: the 4 core endpoints plus the
  // 3 intraday chart endpoints (1D / 1H / 4H).
  function fetchSymbol(symbol) {
    return Promise.all([
      fetchEndpoint("quote", symbol),
      fetchEndpoint("profile", symbol),
      fetchEndpoint("history", symbol),
      fetchEndpoint("news", symbol),
      fetchEndpoint("chart1d", symbol),
      fetchEndpoint("chart1h", symbol),
      fetchEndpoint("chart4h", symbol)
    ]).then(function (results) {
      // Badge reflects quote/profile/history ONLY. News is demo-tier on the
      // free key, and an unavailable intraday tier should not flip an
      // otherwise-live dashboard into "Demo data" either.
      var core = results.slice(0, 3);
      var anyDemo = core.some(function (r) { return r.source === "demo"; });
      return {
        source: anyDemo ? "demo" : "live",
        quote: results[0].data,
        profile: results[1].data,
        history: results[2].data,
        news: results[3].data,
        newsSource: results[3].source,
        charts: {
          d1: results[4].data,
          h1: results[5].data,
          h4: results[6].data,
          d1Source: results[4].source,
          h1Source: results[5].source,
          h4Source: results[6].source
        }
      };
    });
  }

  window.MLApi = { fetchEndpoint: fetchEndpoint, fetchSymbol: fetchSymbol };
})();
