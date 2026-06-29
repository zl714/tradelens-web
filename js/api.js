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
    var record = sample[sym] || sample.AAPL;
    if (!record) return { source: "demo", data: null };
    var data;
    if (endpoint === "history") {
      data = { symbol: sym, historical: record.history };
    } else {
      data = record[endpoint];
    }
    return { source: "demo", data: data };
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

  // Load all four endpoints for a symbol at once.
  function fetchSymbol(symbol) {
    return Promise.all([
      fetchEndpoint("quote", symbol),
      fetchEndpoint("profile", symbol),
      fetchEndpoint("history", symbol),
      fetchEndpoint("news", symbol)
    ]).then(function (results) {
      var anyDemo = results.some(function (r) { return r.source === "demo"; });
      return {
        source: anyDemo ? "demo" : "live",
        quote: results[0].data,
        profile: results[1].data,
        history: results[2].data,
        news: results[3].data
      };
    });
  }

  window.MLApi = { fetchEndpoint: fetchEndpoint, fetchSymbol: fetchSymbol };
})();
