"""Shared Overpass helper: GET, retry, and a tolerant JSON load.

POST to overpass-api.de gets 504s often enough to be useless; GET works.
The public instance rate-limits hard, so every call retries with a backoff.
"""

import json
import sys
import time
import urllib.parse
import urllib.request

ENDPOINT = "https://overpass-api.de/api/interpreter"
UA = "alpine-mtb-map/1.0 (+https://github.com/vemonet/alpine-mtb-map)"


def fetch(query, tries=5):
    """Run an Overpass QL query and return the parsed JSON."""
    url = ENDPOINT + "?" + urllib.parse.urlencode({"data": query})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for i in range(tries):
        try:
            return json.load(urllib.request.urlopen(req, timeout=180))
        except Exception as exc:  # 429 and 504 are both routine here
            print(f"  overpass retry {i + 1}/{tries}: {exc}", file=sys.stderr)
            time.sleep(8 * (i + 1))
    raise SystemExit("overpass failed after retries")


def elevations(points):
    """[(label, lat, lon)] -> [(label, lat, lon, metres)], 25 at a time."""
    out = []
    for i in range(0, len(points), 25):
        chunk = points[i : i + 25]
        locs = "|".join(f"{lat},{lon}" for _, lat, lon in chunk)
        url = f"https://api.opentopodata.org/v1/mapzen?locations={locs}"
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        res = json.load(urllib.request.urlopen(req, timeout=90))["results"]
        out += [(p[0], p[1], p[2], r["elevation"]) for p, r in zip(chunk, res)]
    return out
