"""Find a coordinate for a park that has no mapped lift.

lifts_batch.py answers "where is the valley station?" and returns nothing when
the park has no aerialway. That is not the same as "this park does not exist" -
shuttle and pedal parks are still real spots. This script answers the weaker but
still sourced question: "where is the thing actually called this?"

Stage A (this script): ask Overpass for any named OSM object matching the park
name, restricted to the listing's country, and print it with its distance from
the listing geocode. Names are matched case-insensitively on a loosened form of
the park name, because OSM rarely spells it exactly as a directory does.

    python3 locate.py candidates.json

candidates.json: [{slug, name, country, geo:{lat,lon}}, ...]

Stage B is a human read of the output, then verify.py to confirm the hit really
is a bike park (MTB evidence within 2 km) and to measure its altitude.
"""

import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UA = "alpine-mtb-map/1.0 (https://github.com/vemonet/alpine-mtb-map)"

ISO = {
    "Germany": "DE", "Italy": "IT", "Spain": "ES", "France": "FR", "Slovenia": "SI",
    "Austria": "AT", "Czech Republic": "CZ", "Slovakia": "SK", "Poland": "PL",
    "Sweden": "SE", "Finland": "FI", "Norway": "NO", "Russia": "RU",
    "United States": "US", "Canada": "CA", "United Kingdom": "GB", "México": "MX",
    "China": "CN", "Chile": "CL", "Australia": "AU", "New Zealand": "NZ",
    "Portugal": "PT", "Belgium": "BE", "South Africa": "ZA", "Brazil": "BR",
    "Indonesia": "ID", "Israel": "IL", "Ukraine": "UA", "Romania": "RO",
    "Serbia": "RS", "Bulgaria": "BG", "Iceland": "IS", "South Korea": "KR",
    "Switzerland": "CH", "Netherlands": "NL", "Denmark": "DK", "Andorra": "AD",
}

# Words that carry no signal and only make the regex miss.
NOISE = re.compile(
    r"\b(bike|bikepark|park|parc|mtb|trail|trails|area|arena|center|centre|"
    r"resort|mountain|ski|gravity|freeride|downhill|dh|racepark|flowtrail|"
    r"circle|camp|zone|the|de|la|le|du|des|di|del)\b",
    re.I,
)


def core(name):
    """The distinctive part of a park name - what OSM is likely to call it."""
    s = re.sub(r"[^\w\sÀ-ɏ-]", " ", name)
    s = NOISE.sub(" ", s)
    words = [w for w in s.split() if len(w) >= 4]
    return max(words, key=len) if words else name.strip().split()[0]


def km(a, b):
    lat = math.radians((a[0] + b[0]) / 2)
    return math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * math.cos(lat))


def fetch(q):
    url = "https://overpass-api.de/api/interpreter?" + urllib.parse.urlencode({"data": q})
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=240) as r:
                return json.load(r)["elements"]
        except Exception as exc:  # noqa: BLE001
            print(f"  retry {attempt + 1}: {exc}", flush=True)
            time.sleep(15 * (attempt + 1))
    return []


cands = json.load(open(sys.argv[1]))
by_country = {}
for c in cands:
    by_country.setdefault(c["country"], []).append(c)

out = {}
for country, group in by_country.items():
    iso = ISO.get(country)
    if not iso:
        print(f"!! no ISO code for {country}, skipping {len(group)}")
        continue
    clauses = "".join(f'nwr["name"~"{core(c["name"])}",i](area.a);' for c in group)
    q = f'[out:json][timeout:240];area["ISO3166-1"="{iso}"]->.a;({clauses});out center tags;'
    els = fetch(q)
    print(f"\n##### {country}: {len(els)} named matches for {len(group)} parks", flush=True)
    for c in group:
        pat = re.compile(re.escape(core(c["name"])), re.I)
        home = (c["geo"]["lat"], c["geo"]["lon"]) if c.get("geo") else None
        hits = []
        for el in els:
            nm = (el.get("tags") or {}).get("name", "")
            if not pat.search(nm):
                continue
            ctr = el.get("center") or el
            if "lat" not in ctr:
                continue
            hits.append((nm, round(ctr["lat"], 5), round(ctr["lon"], 5), el.get("tags", {})))
        print(f"\n=== {c['slug']}  ({c['name']})")
        seen = set()
        for nm, la, lo, tags in hits[:14]:
            key = (round(la, 2), round(lo, 2))
            if key in seen:
                continue
            seen.add(key)
            d = f"{km(home, (la, lo)):.0f} km" if home else "-"
            kind = tags.get("piste:type") or tags.get("sport") or tags.get("leisure") or tags.get("landuse") or tags.get("natural") or tags.get("place") or ""
            print(f"  {nm[:38]:40s} {la:.5f},{lo:.5f}  {d:>7s} from geocode  {kind}")
        if not hits:
            print("  (nothing named like this in the country)")
        out[c["slug"]] = hits[:14]
    time.sleep(5)

json.dump(out, open(f"{HERE}/located.json", "w"), indent=1, ensure_ascii=False)
print(f"\nwrote located.json ({len(out)} parks)")
