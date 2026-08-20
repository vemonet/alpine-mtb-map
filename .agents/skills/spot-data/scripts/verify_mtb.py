"""Confirm a candidate coordinate really is a bike park, using OSM riding evidence.

Rung 2 of the no-lift ladder in the spot-data skill. Feed it candidate
coordinates - from a geocoder, from local knowledge, from anywhere - and it asks
Overpass what mountain-bike infrastructure sits near each. A cluster of
mtb:scale ways or a downhill piste is the evidence that makes a coordinate
defensible; nothing around it means the candidate is a guess, and a guess must
not become a pin.

    python3 verify_mtb.py candidates.json

candidates.json: [{slug, lat, lon}, ...]

NB one small bbox per candidate, not one `around:` over all of them. The
`around:` list trick that makes lifts_batch.py cheap does NOT work here:
`way["mtb:scale"]` filters on a key with no value, so Overpass cannot use the
value index and scans instead - the batched form times out at 120 s every time.
A per-candidate bbox keeps each query in the spatial index and finishes fast.
"""

import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
try:
    from overpass import elevations, fetch as _ovp
except ImportError:
    sys.path.insert(0, "/Users/vemonet/dev/perso/alpine-mtb-map/.github/skills/spot-data/scripts")
    from overpass import elevations, fetch as _ovp

UA = "alpine-mtb-map/1.0 (https://github.com/vemonet/alpine-mtb-map)"
HALF = 0.020  # degrees; ~2.2 km - keeps dense networks (UK, Sauerland) inside the timeout
ELE_CACHE = f"{HERE}/ele-cache.json"

places = json.load(open(sys.argv[1]))
ele = json.load(open(ELE_CACHE)) if os.path.exists(ELE_CACHE) else {}


def km(a, b):
    lat = math.radians((a[0] + b[0]) / 2)
    return math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * math.cos(lat))


def pos(el):
    c = el.get("center") or el
    if "lat" in c:
        return (c["lat"], c["lon"])
    g = el.get("geometry") or []
    return (g[0]["lat"], g[0]["lon"]) if g else None


def fetch(q):
    try:
        return _ovp(q).get("elements", [])
    except SystemExit as exc:
        print(f"  {exc}", flush=True)
        return []


report = {}
for p in places:
    s, w = p["lat"] - HALF, p["lon"] - HALF * 1.5
    n, e = p["lat"] + HALF, p["lon"] + HALF * 1.5
    q = (
        f"[out:json][timeout:120][bbox:{s:.4f},{w:.4f},{n:.4f},{e:.4f}];("
        'way["mtb:scale"];'
        'way["mtb:scale:imba"];'
        'relation["route"="mtb"];'
        'nwr["piste:type"="downhill"];'
        'nwr["name"~"bike.?park|freeride",i];'
        ");out center tags 800;"
    )
    els = fetch(q)
    home = (p["lat"], p["lon"])
    near, kinds = [], {}
    for el in els:
        c = pos(el)
        if not c or km(home, c) > 6:
            continue
        t = el.get("tags") or {}
        kind = ("mtb:scale" if "mtb:scale" in t else
                "imba" if "mtb:scale:imba" in t else
                "route=mtb" if t.get("route") == "mtb" else
                "piste" if "piste:type" in t else "named")
        kinds[kind] = kinds.get(kind, 0) + 1
        near.append((kind, t.get("name", ""), c))
    r = {"count": len(near), "kinds": kinds,
         "names": sorted({n for _, n, _ in near if n})[:8]}
    if near:
        r["centre"] = [round(sum(c[0] for _, _, c in near) / len(near), 5),
                       round(sum(c[1] for _, _, c in near) / len(near), 5)]
    report[p["slug"]] = r
    verdict = "OK  " if len(near) >= 3 else ("weak" if near else "NONE")
    print(f"{verdict} {p['slug']:24s} {len(near):>4} features  {kinds}", flush=True)
    if r["names"]:
        print(f"       {', '.join(r['names'])[:110]}", flush=True)
    time.sleep(2)

need = [f"{r['centre'][0]:.5f},{r['centre'][1]:.5f}" for r in report.values()
        if r.get("centre") and f"{r['centre'][0]:.5f},{r['centre'][1]:.5f}" not in ele]
for i in range(0, len(need), 25):
    chunk = need[i:i + 25]
    for _, la, lo, m in elevations([("", float(k.split(",")[0]), float(k.split(",")[1])) for k in chunk]):
        ele[f"{la:.5f},{lo:.5f}"] = m
    json.dump(ele, open(ELE_CACHE, "w"))
    time.sleep(1)

print()
for p in places:
    r = report[p["slug"]]
    c = r.get("centre")
    alt = ele.get(f"{c[0]:.5f},{c[1]:.5f}") if c else None
    loc = f"{c[0]:.5f},{c[1]:.5f} ({round(alt)} m)" if c and alt is not None else "-"
    print(f"{p['slug']:24s} {r['count']:>4}  {loc}")

json.dump(report, open(f"{HERE}/mtb_evidence.json", "w"), indent=1, ensure_ascii=False)
