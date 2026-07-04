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
      volume: 48213400, avgVolume: 56800000, open: 210.30, prevClose: 209.97, dayLow: 209.55,
      dayHigh: 213.88, exchange: "NASDAQ", sector: "Technology",
      industry: "Consumer Electronics", seed: 11 },
    TSLA: { name: "Tesla, Inc.", price: 246.83, chgPct: -2.04, chg: -5.14,
      marketCap: 786e9, pe: 70.1, yearHigh: 299.29, yearLow: 138.80,
      volume: 92140500, avgVolume: 101200000, open: 251.10, prevClose: 251.97, dayLow: 244.20,
      dayHigh: 252.66, exchange: "NASDAQ", sector: "Consumer Cyclical",
      industry: "Auto Manufacturers", seed: 22 },
    NVDA: { name: "NVIDIA Corporation", price: 131.26, chgPct: 3.41, chg: 4.33,
      marketCap: 3.22e12, pe: 64.8, yearHigh: 140.76, yearLow: 66.25,
      volume: 235600000, avgVolume: 248900000, open: 127.55, prevClose: 126.93, dayLow: 127.01,
      dayHigh: 132.40, exchange: "NASDAQ", sector: "Technology",
      industry: "Semiconductors", seed: 33 },
    MSFT: { name: "Microsoft Corporation", price: 449.78, chgPct: 0.62, chg: 2.77,
      marketCap: 3.34e12, pe: 38.4, yearHigh: 468.35, yearLow: 362.90,
      volume: 18420300, avgVolume: 21100000, open: 447.20, prevClose: 447.01, dayLow: 446.10,
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

  // "YYYY-MM-DD HH:MM:SS" for a Date (intraday rows, FMP-style).
  function dateTimeStr(d) {
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":00";
  }

  // Seeded intraday random walk, newest-first like FMP /historical-chart.
  function buildIntraday(anchor, seed, bars, stepMinutes, vol) {
    var rand = rng(seed);
    var closes = [];
    var price = anchor;
    for (var i = 0; i < bars; i++) {
      closes.push(Math.round(price * 100) / 100);
      var drift = (rand() - 0.5) * 2 * vol;
      price = price / (1 + drift);
    }
    var now = new Date();
    now.setSeconds(0, 0);
    var series = [];
    for (var k = 0; k < closes.length; k++) {
      var ts = new Date(now.getTime() - stepMinutes * 60000 * k);
      var close = closes[k];
      var prev = k + 1 < closes.length ? closes[k + 1] : close;
      series.push({
        date: dateTimeStr(ts),
        open: Math.round(prev * 100) / 100,
        high: Math.round(Math.max(prev, close) * (1 + rand() * vol) * 100) / 100,
        low: Math.round(Math.min(prev, close) * (1 - rand() * vol) * 100) / 100,
        close: close,
        volume: Math.floor(80000 + rand() * 820000)
      });
    }
    return series;
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
        volume: t.volume, avgVolume: t.avgVolume,
        open: t.open, previousClose: t.prevClose,
        pe: t.pe, eps: Math.round((t.price / t.pe) * 100) / 100
      }],
      profile: [{
        symbol: sym, companyName: t.name, price: t.price, mktCap: t.marketCap,
        exchangeShortName: t.exchange, industry: t.industry, sector: t.sector,
        range: t.yearLow + "-" + t.yearHigh
      }],
      news: buildNews(sym, t),
      history: buildHistory(t.price, t.seed),
      // Intraday demo series so 1D / 1H / 4H toggles work with no backend.
      chart1d: buildIntraday(t.price, t.seed + 1, 26, 15, 0.0015),
      chart1h: buildIntraday(t.price, t.seed + 2, 56, 60, 0.0035),
      chart4h: buildIntraday(t.price, t.seed + 3, 60, 240, 0.006)
    };
  });

  // Major market indices for the dashboard "Markets" overview panel. These are
  // not symbol-specific and need no API key — plausible, clearly-demo values.
  var MARKETS = [
    { symbol: "SPX",  name: "S&P 500",     value: 5431.60,  change: 22.78,  chgPct: 0.42 },
    { symbol: "IXIC", name: "Nasdaq Comp", value: 17689.36, change: 141.85, chgPct: 0.81 },
    { symbol: "DJI",  name: "Dow Jones",   value: 38778.10, change: -50.42, chgPct: -0.13 },
    { symbol: "VIX",  name: "Volatility",  value: 13.24,    change: -0.36,  chgPct: -2.65, decimals: 2 },
    { symbol: "TNX",  name: "10-Yr Yield", value: 4.28,     change: 0.02,   chgPct: 0.47,  unit: "%", decimals: 2 }
  ];

  // Expose globally for the rest of the app.
  window.MARKETLENS_SAMPLE = SAMPLE;
  window.MARKETLENS_SAMPLE_SYMBOLS = Object.keys(TICKERS);
  window.MARKETLENS_MARKETS = MARKETS;
})();
