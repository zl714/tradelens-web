/* Bundled advisor universe — ~45 well-known real tickers (stocks + ETFs).
 *
 * Each entry is tagged with the metadata the rule-based advisor scores against:
 *   sector  : one of the onboarding sector options
 *   traits  : any of "growth" | "value" | "dividend" | "broad-index"
 *   risk    : "conservative" | "moderate" | "aggressive" (volatility bucket)
 *   horizon : "long" | "short" | "any"  (best-fit holding horizon)
 *   price/pe/divYield : illustrative demo fundamentals (used in demo mode and
 *                       as a fallback before/instead of live enrichment)
 *
 * These numbers are clearly-labelled DEMO fundamentals, not live quotes. When a
 * live FMP key is present, the advisor enriches price/P/E from real quotes.
 */
(function () {
  "use strict";

  var SECTORS = [
    "Technology",
    "Defense/Aerospace",
    "Healthcare",
    "Energy",
    "Financials",
    "Consumer",
    "Index Funds/ETFs"
  ];

  var GOALS = ["growth", "income"];
  var HORIZONS = ["long", "short"];
  var RISKS = ["conservative", "moderate", "aggressive"];

  // ticker, name, sector, traits, risk, horizon, price, pe, divYield(%)
  var U = [
    // ---- Technology ----
    ["AAPL", "Apple Inc.", "Technology", ["growth"], "moderate", "long", 212.45, 32.6, 0.45],
    ["MSFT", "Microsoft Corporation", "Technology", ["growth", "dividend"], "moderate", "long", 449.78, 38.4, 0.72],
    ["NVDA", "NVIDIA Corporation", "Technology", ["growth"], "aggressive", "long", 131.26, 64.8, 0.03],
    ["GOOGL", "Alphabet Inc.", "Technology", ["growth"], "moderate", "long", 178.40, 27.1, 0.0],
    ["META", "Meta Platforms, Inc.", "Technology", ["growth"], "aggressive", "long", 504.20, 28.5, 0.40],
    ["AVGO", "Broadcom Inc.", "Technology", ["growth", "dividend"], "aggressive", "long", 168.90, 35.2, 1.25],
    ["CRM", "Salesforce, Inc.", "Technology", ["growth"], "aggressive", "long", 246.10, 45.6, 0.0],
    ["ADBE", "Adobe Inc.", "Technology", ["growth"], "moderate", "long", 472.30, 33.8, 0.0],
    ["AMD", "Advanced Micro Devices, Inc.", "Technology", ["growth"], "aggressive", "long", 158.70, 88.4, 0.0],
    ["IBM", "International Business Machines", "Technology", ["value", "dividend"], "conservative", "long", 175.20, 21.5, 3.40],

    // ---- Defense / Aerospace ----
    ["LMT", "Lockheed Martin Corporation", "Defense/Aerospace", ["value", "dividend"], "conservative", "long", 462.80, 17.9, 2.70],
    ["RTX", "RTX Corporation", "Defense/Aerospace", ["dividend", "value"], "conservative", "long", 102.40, 23.6, 2.30],
    ["NOC", "Northrop Grumman Corporation", "Defense/Aerospace", ["value", "dividend"], "conservative", "long", 478.90, 18.4, 1.70],
    ["GD", "General Dynamics Corporation", "Defense/Aerospace", ["value", "dividend"], "conservative", "long", 289.50, 20.1, 1.95],
    ["BA", "The Boeing Company", "Defense/Aerospace", ["value"], "aggressive", "long", 181.30, 0.0, 0.0],

    // ---- Healthcare ----
    ["JNJ", "Johnson & Johnson", "Healthcare", ["dividend", "value"], "conservative", "long", 152.10, 22.0, 3.20],
    ["UNH", "UnitedHealth Group Incorporated", "Healthcare", ["growth", "dividend"], "moderate", "long", 492.60, 19.8, 1.55],
    ["LLY", "Eli Lilly and Company", "Healthcare", ["growth"], "aggressive", "long", 812.40, 78.5, 0.65],
    ["ABBV", "AbbVie Inc.", "Healthcare", ["dividend", "value"], "moderate", "long", 168.20, 16.7, 3.60],
    ["PFE", "Pfizer Inc.", "Healthcare", ["dividend", "value"], "conservative", "long", 28.40, 12.9, 5.90],
    ["MRK", "Merck & Co., Inc.", "Healthcare", ["dividend", "value"], "conservative", "long", 124.70, 21.3, 2.55],

    // ---- Energy ----
    ["XOM", "Exxon Mobil Corporation", "Energy", ["dividend", "value"], "moderate", "long", 113.80, 13.4, 3.30],
    ["CVX", "Chevron Corporation", "Energy", ["dividend", "value"], "moderate", "long", 156.90, 14.1, 4.05],
    ["COP", "ConocoPhillips", "Energy", ["value", "dividend"], "aggressive", "long", 109.20, 13.0, 2.10],
    ["NEE", "NextEra Energy, Inc.", "Energy", ["dividend", "growth"], "moderate", "long", 72.60, 20.7, 2.90],
    ["ENB", "Enbridge Inc.", "Energy", ["dividend", "value"], "conservative", "long", 38.10, 18.9, 7.10],

    // ---- Financials ----
    ["JPM", "JPMorgan Chase & Co.", "Financials", ["value", "dividend"], "moderate", "long", 198.40, 11.8, 2.25],
    ["BAC", "Bank of America Corporation", "Financials", ["value", "dividend"], "moderate", "long", 39.80, 12.4, 2.55],
    ["V", "Visa Inc.", "Financials", ["growth", "dividend"], "moderate", "long", 272.10, 30.6, 0.78],
    ["MA", "Mastercard Incorporated", "Financials", ["growth", "dividend"], "moderate", "long", 458.30, 36.0, 0.55],
    ["GS", "The Goldman Sachs Group, Inc.", "Financials", ["value", "dividend"], "aggressive", "long", 462.70, 14.9, 2.40],
    ["BRK.B", "Berkshire Hathaway Inc.", "Financials", ["value"], "conservative", "long", 412.60, 21.2, 0.0],

    // ---- Consumer ----
    ["KO", "The Coca-Cola Company", "Consumer", ["dividend", "value"], "conservative", "long", 62.30, 24.1, 3.05],
    ["PG", "The Procter & Gamble Company", "Consumer", ["dividend", "value"], "conservative", "long", 167.40, 26.3, 2.40],
    ["PEP", "PepsiCo, Inc.", "Consumer", ["dividend", "value"], "conservative", "long", 168.90, 23.7, 3.10],
    ["WMT", "Walmart Inc.", "Consumer", ["dividend", "growth"], "conservative", "long", 67.20, 28.9, 1.30],
    ["COST", "Costco Wholesale Corporation", "Consumer", ["growth", "dividend"], "moderate", "long", 842.10, 49.5, 0.55],
    ["MCD", "McDonald's Corporation", "Consumer", ["dividend", "value"], "conservative", "long", 258.60, 23.4, 2.45],
    ["HD", "The Home Depot, Inc.", "Consumer", ["dividend", "growth"], "moderate", "long", 342.80, 23.0, 2.50],
    ["AMZN", "Amazon.com, Inc.", "Consumer", ["growth"], "aggressive", "long", 186.40, 41.2, 0.0],
    ["NKE", "NIKE, Inc.", "Consumer", ["growth", "dividend"], "moderate", "long", 74.90, 21.6, 2.00],

    // ---- Index Funds / ETFs ----
    ["SPY", "SPDR S&P 500 ETF Trust", "Index Funds/ETFs", ["broad-index", "growth"], "moderate", "long", 545.20, 0.0, 1.25],
    ["VOO", "Vanguard S&P 500 ETF", "Index Funds/ETFs", ["broad-index", "growth"], "moderate", "long", 501.30, 0.0, 1.30],
    ["VTI", "Vanguard Total Stock Market ETF", "Index Funds/ETFs", ["broad-index", "growth"], "moderate", "long", 272.80, 0.0, 1.35],
    ["QQQ", "Invesco QQQ Trust", "Index Funds/ETFs", ["broad-index", "growth"], "aggressive", "long", 478.60, 0.0, 0.55],
    ["SCHD", "Schwab US Dividend Equity ETF", "Index Funds/ETFs", ["broad-index", "dividend"], "conservative", "long", 81.40, 0.0, 3.45],
    ["VYM", "Vanguard High Dividend Yield ETF", "Index Funds/ETFs", ["broad-index", "dividend"], "conservative", "long", 120.10, 0.0, 2.85],
    ["DIA", "SPDR Dow Jones Industrial Average ETF", "Index Funds/ETFs", ["broad-index", "dividend"], "conservative", "long", 392.50, 0.0, 1.75],
    ["IWM", "iShares Russell 2000 ETF", "Index Funds/ETFs", ["broad-index"], "aggressive", "short", 214.30, 0.0, 1.10],
    ["BND", "Vanguard Total Bond Market ETF", "Index Funds/ETFs", ["broad-index", "dividend"], "conservative", "long", 72.80, 0.0, 3.80]
  ];

  var UNIVERSE = U.map(function (r) {
    return {
      ticker: r[0],
      name: r[1],
      sector: r[2],
      traits: r[3],
      risk: r[4],
      horizon: r[5],
      price: r[6],
      pe: r[7],
      divYield: r[8]
    };
  });

  window.MLAdvisorUniverse = {
    UNIVERSE: UNIVERSE,
    SECTORS: SECTORS,
    GOALS: GOALS,
    HORIZONS: HORIZONS,
    RISKS: RISKS
  };
})();
