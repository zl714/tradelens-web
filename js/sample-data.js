/* Client-side SAMPLE dataset.
 *
 * This is the last-resort fallback: if even the /api/data call fails (e.g. the
 * page is opened directly as a local file:// with no server, or the network is
 * down), the UI still renders fully-populated with a visible "Demo data" badge.
 * Mirrors the shape returned by the backend: { quote, profile, news, history }.
 * Numbers are plausible, clearly-labelled demo values — not live quotes.
 */
(function () {
  "use strict";

  var TICKERS = {
    AAPL: { name: "Apple Inc.", price: 212.45, chgPct: 1.18, chg: 2.48,
      marketCap: 3.25e12, pe: 32.6, yearHigh: 237.49, yearLow: 164.08,
      volume: 48213400, open: 210.30, prevClose: 209.97, dayLow: 209.55,
      dayHigh: 213.88, exchange: "NASDAQ", sector: "Technology",
      industry: "Consumer Electronics", seed: 11 },
    TSLA: { name: "Tesla, Inc.", price: 246.83, chgPct: -2.04, chg: -5.14,
      marketCap: 786e9, pe: 70.1, yearHigh: 299.29, yearLow: 138.80,
      volume: 92140500, open: 251.10, prevClose: 251.97, dayLow: 244.20,
      dayHigh: 252.66, exchange: "NASDAQ", sector: "Consumer Cyclical",
      industry: "Auto Manufacturers", seed: 22 },
    NVDA: { name: "NVIDIA Corporation", price: 131.26, chgPct: 3.41, chg: 4.33,
      marketCap: 3.22e12, pe: 64.8, yearHigh: 140.76, yearLow: 66.25,
      volume: 235600000, open: 127.55, prevClose: 126.93, dayLow: 127.01,
      dayHigh: 132.40, exchange: "NASDAQ", sector: "Technology",
      industry: "Semiconductors", seed: 33 },
    MSFT: { name: "Microsoft Corporation", price: 449.78, chgPct: 0.62, chg: 2.77,
      marketCap: 3.34e12, pe: 38.4, yearHigh: 468.35, yearLow: 362.90,
      volume: 18420300, open: 447.20, prevClose: 447.01, dayLow: 446.10,
      dayHigh: 451.55, exchange: "NASDAQ", sector: "Technology",
      industry: "Software - Infrastructure", seed: 44 }
  };

  // Deterministic seeded RNG (mulberry32) so charts look organic + stable.
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function isoDate(daysAgo) {
    var d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  }

  function buildHistory(anchor, seed) {
    var rand = rng(seed);
    var days = 365;
    var closes = [];
    var price = anchor;
    for (var i = 0; i < days; i++) {
      closes.push(Math.round(price * 100) / 100);
      var drift = (rand() - 0.5) * 0.024; // +/- 1.2%
      price = price / (1 + drift);
    }
    closes.reverse();
    var hist = [];
    for (var j = 0; j < days; j++) {
      hist.push({ date: isoDate(days - 1 - j), close: closes[j] });
    }
    return hist;
  }

  var NEWS = [
    ["{name} holds steady as broader market digests rate outlook", "Demo Newswire"],
    ["Analysts weigh {sym} valuation ahead of next earnings report", "Market Demo Daily"],
    ["{name} in focus as sector rotation continues", "Sample Financial"],
    ["What to watch for {sym} this week: levels and catalysts", "Demo Markets"],
    ["{name} options activity picks up amid volatility", "Sample Street"]
  ];

  function buildNews(sym, t) {
    return NEWS.map(function (n, i) {
      return {
        symbol: sym,
        title: n[0].replace("{name}", t.name).replace("{sym}", sym),
        publishedDate: isoDate(i) + " 13:30:00",
        site: n[1],
        url: "#",
        text: "Illustrative demo summary for " + t.name + " (" + sym +
          "). Connect a free FMP API key to see live headlines."
      };
    });
  }

  var SAMPLE = {};
  Object.keys(TICKERS).forEach(function (sym) {
    var t = TICKERS[sym];
    SAMPLE[sym] = {
      quote: [{
        symbol: sym, name: t.name, price: t.price,
        changesPercentage: t.chgPct, change: t.chg,
        dayLow: t.dayLow, dayHigh: t.dayHigh,
        yearHigh: t.yearHigh, yearLow: t.yearLow,
        marketCap: t.marketCap, exchange: t.exchange,
        volume: t.volume, open: t.open, previousClose: t.prevClose,
        pe: t.pe, eps: Math.round((t.price / t.pe) * 100) / 100
      }],
      profile: [{
        symbol: sym, companyName: t.name, price: t.price, mktCap: t.marketCap,
        exchangeShortName: t.exchange, industry: t.industry, sector: t.sector,
        range: t.yearLow + "-" + t.yearHigh
      }],
      news: buildNews(sym, t),
      history: buildHistory(t.price, t.seed)
    };
  });

  // Expose globally for the rest of the app.
  window.MARKETLENS_SAMPLE = SAMPLE;
  window.MARKETLENS_SAMPLE_SYMBOLS = Object.keys(TICKERS);
})();
