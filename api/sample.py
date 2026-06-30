"""Bundled realistic SAMPLE dataset for TradeLens.

Used as a robust fallback when no FMP_API_KEY is configured or the upstream
call fails / is rate-limited. The numbers are plausible, clearly-labelled
"demo" data -- NOT live quotes -- so the UI always renders something real-
looking without ever claiming false precision.

History series are generated with a seeded random walk at import time so the
chart looks organic across 1M / 3M / 1Y ranges. Standard library only.
"""

import random
from datetime import date, datetime, timedelta

# Anchor figures per ticker (price, name, sector, etc.). Plausible, static.
_TICKERS = {
    "AAPL": {
        "name": "Apple Inc.",
        "price": 212.45,
        "changesPercentage": 1.18,
        "change": 2.48,
        "marketCap": 3250000000000,
        "pe": 32.6,
        "yearHigh": 237.49,
        "yearLow": 164.08,
        "volume": 48213400,
        "avgVolume": 56800000,
        "open": 210.30,
        "previousClose": 209.97,
        "dayLow": 209.55,
        "dayHigh": 213.88,
        "exchange": "NASDAQ",
        "sector": "Technology",
        "industry": "Consumer Electronics",
        "ceo": "Timothy D. Cook",
        "description": (
            "Apple Inc. designs, manufactures, and markets smartphones, "
            "personal computers, tablets, wearables, and accessories "
            "worldwide, alongside a growing services business."
        ),
        "website": "https://www.apple.com",
        "seed": 11,
    },
    "TSLA": {
        "name": "Tesla, Inc.",
        "price": 246.83,
        "changesPercentage": -2.04,
        "change": -5.14,
        "marketCap": 786000000000,
        "pe": 70.1,
        "yearHigh": 299.29,
        "yearLow": 138.80,
        "volume": 92140500,
        "avgVolume": 101200000,
        "open": 251.10,
        "previousClose": 251.97,
        "dayLow": 244.20,
        "dayHigh": 252.66,
        "exchange": "NASDAQ",
        "sector": "Consumer Cyclical",
        "industry": "Auto Manufacturers",
        "ceo": "Elon R. Musk",
        "description": (
            "Tesla, Inc. designs, develops, manufactures, and sells electric "
            "vehicles and energy generation and storage systems globally."
        ),
        "website": "https://www.tesla.com",
        "seed": 22,
    },
    "NVDA": {
        "name": "NVIDIA Corporation",
        "price": 131.26,
        "changesPercentage": 3.41,
        "change": 4.33,
        "marketCap": 3220000000000,
        "pe": 64.8,
        "yearHigh": 140.76,
        "yearLow": 66.25,
        "volume": 235600000,
        "avgVolume": 248900000,
        "open": 127.55,
        "previousClose": 126.93,
        "dayLow": 127.01,
        "dayHigh": 132.40,
        "exchange": "NASDAQ",
        "sector": "Technology",
        "industry": "Semiconductors",
        "ceo": "Jensen Huang",
        "description": (
            "NVIDIA Corporation provides graphics, compute, and networking "
            "solutions, and is a leading supplier of accelerated computing "
            "platforms for AI and data centers."
        ),
        "website": "https://www.nvidia.com",
        "seed": 33,
    },
    "MSFT": {
        "name": "Microsoft Corporation",
        "price": 449.78,
        "changesPercentage": 0.62,
        "change": 2.77,
        "marketCap": 3340000000000,
        "pe": 38.4,
        "yearHigh": 468.35,
        "yearLow": 362.90,
        "volume": 18420300,
        "avgVolume": 21100000,
        "open": 447.20,
        "previousClose": 447.01,
        "dayLow": 446.10,
        "dayHigh": 451.55,
        "exchange": "NASDAQ",
        "sector": "Technology",
        "industry": "Software - Infrastructure",
        "ceo": "Satya Nadella",
        "description": (
            "Microsoft Corporation develops and supports software, services, "
            "devices, and solutions worldwide, including the Azure cloud "
            "platform, Windows, Office, and gaming."
        ),
        "website": "https://www.microsoft.com",
        "seed": 44,
    },
}

# Generic demo headlines (clearly illustrative, not real reporting).
_NEWS_TEMPLATES = [
    ("{name} holds steady as broader market digests rate outlook",
     "Demo Newswire"),
    ("Analysts weigh {sym} valuation ahead of next earnings report",
     "Market Demo Daily"),
    ("{name} in focus as sector rotation continues", "Sample Financial"),
    ("What to watch for {sym} this week: levels and catalysts",
     "Demo Markets"),
    ("{name} options activity picks up amid volatility", "Sample Street"),
]


def _build_history(anchor_price, seed):
    """Seeded random walk -> ~365 daily close points ending at anchor_price."""
    rng = random.Random(seed)
    days = 365
    closes = []
    price = anchor_price
    # Walk backwards from today's anchor so the latest point matches the quote.
    for _ in range(days):
        closes.append(round(price, 2))
        drift = rng.uniform(-0.012, 0.012)
        price = price / (1 + drift)
    closes.reverse()
    today = date.today()
    history = []
    for i, close in enumerate(closes):
        d = today - timedelta(days=(days - 1 - i))
        history.append({"date": d.isoformat(), "close": close})
    return history


def _build_intraday(anchor_price, seed, bars, step_minutes, vol):
    """Seeded random walk -> intraday OHLC-ish bars, newest-first like FMP.

    Each bar mimics FMP's /historical-chart shape:
    {"date": "YYYY-MM-DD HH:MM:SS", "open", "low", "high", "close", "volume"}.
    The most recent bar's close matches anchor_price so the intraday view lines
    up with the live quote. Bars step backwards in time by step_minutes.
    """
    rng = random.Random(seed)
    closes = []
    price = anchor_price
    for _ in range(bars):
        closes.append(round(price, 2))
        drift = rng.uniform(-vol, vol)
        price = price / (1 + drift)
    # closes[0] is the newest (== anchor); keep newest-first ordering.
    now = datetime.now().replace(second=0, microsecond=0)
    series = []
    for i, close in enumerate(closes):
        ts = now - timedelta(minutes=step_minutes * i)
        prev = closes[i + 1] if i + 1 < len(closes) else close
        opn = round(prev, 2)
        high = round(max(opn, close) * (1 + rng.uniform(0, vol)), 2)
        low = round(min(opn, close) * (1 - rng.uniform(0, vol)), 2)
        series.append({
            "date": ts.strftime("%Y-%m-%d %H:%M:%S"),
            "open": opn,
            "low": low,
            "high": high,
            "close": close,
            "volume": rng.randint(80000, 900000),
        })
    return series


def _build_quote(sym, t):
    return [{
        "symbol": sym,
        "name": t["name"],
        "price": t["price"],
        "changesPercentage": t["changesPercentage"],
        "change": t["change"],
        "dayLow": t["dayLow"],
        "dayHigh": t["dayHigh"],
        "yearHigh": t["yearHigh"],
        "yearLow": t["yearLow"],
        "marketCap": t["marketCap"],
        "priceAvg50": round(t["price"] * 0.97, 2),
        "priceAvg200": round(t["price"] * 0.9, 2),
        "exchange": t["exchange"],
        "volume": t["volume"],
        "avgVolume": t["avgVolume"],
        "open": t["open"],
        "previousClose": t["previousClose"],
        "pe": t["pe"],
        "eps": round(t["price"] / t["pe"], 2),
    }]


def _build_profile(sym, t):
    return [{
        "symbol": sym,
        "companyName": t["name"],
        "price": t["price"],
        "mktCap": t["marketCap"],
        "exchange": t["exchange"],
        "exchangeShortName": t["exchange"],
        "industry": t["industry"],
        "sector": t["sector"],
        "ceo": t["ceo"],
        "website": t["website"],
        "description": t["description"],
        "range": f"{t['yearLow']}-{t['yearHigh']}",
    }]


def _build_news(sym, t):
    today = date.today()
    items = []
    for i, (title_tpl, source) in enumerate(_NEWS_TEMPLATES):
        d = today - timedelta(days=i)
        items.append({
            "symbol": sym,
            "title": title_tpl.format(name=t["name"], sym=sym),
            "publishedDate": f"{d.isoformat()} 13:30:00",
            "site": source,
            "url": t["website"],
            "text": (
                f"Illustrative demo summary for {t['name']} ({sym}). "
                "Connect a free FMP API key to see live headlines."
            ),
        })
    return items


def _build_dataset():
    data = {}
    for sym, t in _TICKERS.items():
        anchor = t["price"]
        seed = t["seed"]
        data[sym] = {
            "quote": _build_quote(sym, t),
            "profile": _build_profile(sym, t),
            "news": _build_news(sym, t),
            "history": _build_history(anchor, seed),
            # Intraday demo series so 1D / 1H / 4H toggles work with no key.
            "chart1d": _build_intraday(anchor, seed + 1, 26, 15, 0.0015),
            "chart1h": _build_intraday(anchor, seed + 2, 56, 60, 0.0035),
            "chart4h": _build_intraday(anchor, seed + 3, 60, 240, 0.006),
        }
    return data


SAMPLE = _build_dataset()

# Major market indices for the dashboard "Markets" overview panel. Not tied to
# any single symbol and require no API key -- plausible, clearly-demo values so
# the panel always populates in the demo fallback.
MARKETS = [
    {"symbol": "SPX", "name": "S&P 500", "value": 5431.60,
     "change": 22.78, "changesPercentage": 0.42},
    {"symbol": "IXIC", "name": "Nasdaq Comp", "value": 17689.36,
     "change": 141.85, "changesPercentage": 0.81},
    {"symbol": "DJI", "name": "Dow Jones", "value": 38778.10,
     "change": -50.42, "changesPercentage": -0.13},
    {"symbol": "VIX", "name": "Volatility", "value": 13.24,
     "change": -0.36, "changesPercentage": -2.65, "decimals": 2},
    {"symbol": "TNX", "name": "10-Yr Yield", "value": 4.28,
     "change": 0.02, "changesPercentage": 0.47, "unit": "%", "decimals": 2},
]
