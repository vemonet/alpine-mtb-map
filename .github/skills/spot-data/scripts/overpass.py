"""Shared Overpass helper: GET, mirror rotation, retry, tolerant JSON load.

POST to overpass-api.de gets 504s often enough to be useless; GET works.
Every public instance rate-limits, so a retry that hammers the same host just
earns a longer ban. Instead each attempt moves to the next mirror, and only the
backoff grows - a 429 from one server says nothing about the others.
"""

import itertools
import json
import sys
import time
import urllib.parse
import urllib.request

# Full-planet public instances, fastest first as measured 2026-08-05 on a small
# bbox query: de 1.0 s, mail.ru 8.7 s, private.coffee 33 s, kumi timed out at 45 s.
# Order matters less than having somewhere to go when the first one 429s.
# NOT here on purpose:
#   overpass.osm.jp  - TLS certificate does not match the hostname
#   overpass.osm.ch  - Switzerland extract only; silently empty for everywhere else
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
ENDPOINT = MIRRORS[0]  # kept for callers that import it directly
UA = "alpine-mtb-map/1.0 (+https://github.com/vemonet/alpine-mtb-map)"
# Short, so one wedged mirror costs seconds rather than minutes. Raise it per
# call for genuinely heavy queries.
TIMEOUT = 60

# Rotates across calls too, so a batch of queries spreads over the mirrors
# instead of every one of them opening on the same overloaded host.
_cycle = itertools.cycle(range(len(MIRRORS)))


def fetch(query, tries=None, timeout=TIMEOUT):
    """Run an Overpass QL query and return the parsed JSON.

    Each try uses a different mirror. `tries` defaults to one pass over every
    mirror plus one, so a transient failure everywhere still gets a second look
    at the first host.
    """
    tries = tries or len(MIRRORS) + 1
    start = next(_cycle)
    data = urllib.parse.urlencode({"data": query})
    last = None
    for i in range(tries):
        host = MIRRORS[(start + i) % len(MIRRORS)]
        try:
            req = urllib.request.Request(host + "?" + data, headers={"User-Agent": UA})
            body = json.load(urllib.request.urlopen(req, timeout=timeout))
            if "remark" in body and not body.get("elements"):
                # Overpass reports timeouts and memory errors in-band, with HTTP 200.
                raise RuntimeError(body["remark"].strip())
            return body
        except Exception as exc:  # 429 and 504 are both routine here
            last = exc
            name = host.split("/")[2]
            print(f"  overpass {name} failed ({i + 1}/{tries}): {exc}", file=sys.stderr)
            time.sleep(3 * (i + 1))
    raise SystemExit(f"overpass failed on every mirror: {last}")


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
