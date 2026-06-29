"""TradeLens API proxy (Vercel Python serverless function).

Proxies the Financial Modeling Prep (FMP) free-tier API using ONLY the Python
standard library so there is no requirements.txt / dependency risk.

Routing is driven by query params:
    ?endpoint=quote|profile|history|news|chart1h|chart4h|chart1d&symbol=SYMBOL

Robust fallback: if FMP_API_KEY is missing, or the upstream call fails / is
rate-limited / returns nothing usable, we serve a bundled realistic SAMPLE
dataset and tag the response with {"source": "demo"} so the UI can show a
"Demo data" badge. A recruiter clicking the live link never sees a blank page.

Intraday endpoints (chart1h / chart4h / chart1d) are special: many FMP free
tiers do NOT include intraday history. When a live key IS configured but the
intraday call returns empty / unauthorized, we respond with
{"source": "unavailable", "data": null} so the frontend can gracefully DISABLE
the matching timeframe toggle rather than silently mixing demo intraday into an
otherwise-live chart. With NO key at all we still serve demo intraday so every
toggle works in the demo.
"""

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, quote
import urllib.request
import urllib.error
import json
import os

from sample import SAMPLE  # bundled fallback dataset (api/sample.py)

FMP_BASE = "https://financialmodelingprep.com/api/v3"
# Daily/static endpoints fall back to bundled demo data on any failure.
CORE_ENDPOINTS = ("quote", "profile", "history", "news")
# Intraday endpoints disable their toggle (return null) when tier-restricted.
INTRADAY_ENDPOINTS = ("chart1h", "chart4h", "chart1d")
VALID_ENDPOINTS = CORE_ENDPOINTS + INTRADAY_ENDPOINTS
UPSTREAM_TIMEOUT = 8  # seconds


def _fmp_url(endpoint, symbol, api_key):
    """Build the upstream FMP URL for a given endpoint."""
    s = quote(symbol)
    if endpoint == "quote":
        return f"{FMP_BASE}/quote/{s}?apikey={api_key}"
    if endpoint == "profile":
        return f"{FMP_BASE}/profile/{s}?apikey={api_key}"
    if endpoint == "history":
        # ~1 year of daily candles; the frontend slices to 1M..1Y / 1W.
        return (
            f"{FMP_BASE}/historical-price-full/{s}"
            f"?serietype=line&timeseries=365&apikey={api_key}"
        )
    if endpoint == "news":
        return f"{FMP_BASE}/stock_news?tickers={s}&limit=12&apikey={api_key}"
    if endpoint == "chart1h":
        return f"{FMP_BASE}/historical-chart/1hour/{s}?apikey={api_key}"
    if endpoint == "chart4h":
        return f"{FMP_BASE}/historical-chart/4hour/{s}?apikey={api_key}"
    if endpoint == "chart1d":
        # Finer intraday bars for the single-day (1D) view.
        return f"{FMP_BASE}/historical-chart/15min/{s}?apikey={api_key}"
    return None


def _fetch_upstream(url):
    """Fetch + parse JSON from FMP. Returns parsed data or raises."""
    req = urllib.request.Request(url, headers={"User-Agent": "TradeLens/1.0"})
    with urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT) as resp:
        raw = resp.read().decode("utf-8")
    return json.loads(raw)


def _is_usable(endpoint, data):
    """Decide whether the upstream payload is real data (not empty / an error)."""
    if data is None:
        return False
    # FMP returns {"Error Message": ...} on bad key / rate limit.
    if isinstance(data, dict) and ("Error Message" in data or "error" in data):
        return False
    if endpoint == "history":
        return bool(isinstance(data, dict) and data.get("historical"))
    # quote / profile / news / intraday charts are lists; empty => unusable.
    return bool(isinstance(data, list) and len(data) > 0)


def _demo_payload(endpoint, symbol):
    """Return bundled sample data for the requested endpoint + symbol."""
    sym = (symbol or "AAPL").upper()
    record = SAMPLE.get(sym) or SAMPLE.get("AAPL")
    body = {"source": "demo", "symbol": sym, "endpoint": endpoint}
    if endpoint == "history":
        body["data"] = {"symbol": sym, "historical": record["history"]}
    else:
        body["data"] = record.get(endpoint)
    return body


def _unavailable_payload(endpoint, symbol):
    """Signal that an intraday endpoint is not available on this key's tier.

    The frontend uses {"source": "unavailable", "data": null} to gracefully
    disable the matching timeframe toggle instead of showing a broken chart.
    """
    return {
        "source": "unavailable",
        "symbol": (symbol or "AAPL").upper(),
        "endpoint": endpoint,
        "data": None,
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)
        endpoint = (params.get("endpoint", ["quote"])[0] or "quote").lower()
        symbol = (params.get("symbol", ["AAPL"])[0] or "AAPL").upper().strip()

        # Validate at the boundary; fail fast with a clear message.
        if endpoint not in VALID_ENDPOINTS:
            self._send_json(
                400,
                {
                    "source": "error",
                    "error": (
                        f"Invalid endpoint '{endpoint}'. "
                        f"Use one of: {', '.join(VALID_ENDPOINTS)}."
                    ),
                },
            )
            return

        api_key = os.environ.get("FMP_API_KEY")

        # No key configured -> serve bundled demo data (never a hard error).
        if not api_key:
            self._send_json(200, _demo_payload(endpoint, symbol))
            return

        url = _fmp_url(endpoint, symbol, api_key)
        try:
            data = _fetch_upstream(url)
            if _is_usable(endpoint, data):
                payload = {
                    "source": "live",
                    "symbol": symbol,
                    "endpoint": endpoint,
                    "data": data,
                }
                self._send_json(200, payload)
                return
            # Upstream returned an error/empty. Intraday endpoints are often
            # tier-restricted -> tell the UI to disable that toggle. Core
            # endpoints fall back to demo so the page never goes blank.
            if endpoint in INTRADAY_ENDPOINTS:
                self._send_json(200, _unavailable_payload(endpoint, symbol))
            else:
                self._send_json(200, _demo_payload(endpoint, symbol))
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError,
                TimeoutError, OSError):
            # Network failure / rate limit / bad JSON. For intraday we disable
            # the toggle (avoid mixing demo intraday into a live chart);
            # core endpoints fall back to demo.
            if endpoint in INTRADAY_ENDPOINTS:
                self._send_json(200, _unavailable_payload(endpoint, symbol))
            else:
                self._send_json(200, _demo_payload(endpoint, symbol))

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status, body):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self._cors_headers()
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
