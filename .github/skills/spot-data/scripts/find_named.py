"""Find a park by its own name, inside a bbox around a candidate coordinate.

This is rung 1 done right. Searching a name across a whole country times out;
searching the same name inside a 15 km box answers in a second or two, because
the bbox goes through the spatial index first.

It exists because rung 2 (mtb:scale evidence) fails wholesale in the United
States: American trails are mapped in Trailforks and MTB Project, not OSM, so a
perfectly real bike park can have zero graded ways around it and still be
present in OSM as a named feature.

    python3 find_named.py candidates.json

candidates.json: [{slug, name, lat, lon}, ...]
"""

import json
import math
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from overpass import elevations, fetch  # noqa: E402

HALF = 0.14  # degrees; about 15 km north-south
ELE_CACHE = f"{HERE}/ele-cache.json"

NOISE = re.compile(
    r"\b(bike|bikepark|park|parc|mtb|trail|trails|area|arena|center|centre|"
    r"resort|mountain|mountian|ski|gravity|freeride|downhill|dh|racepark|"
    r"flowtrail|circle|camp|zone|the|and|of|de|la|le|du|des|di|del)\b",
    re.I,
)


def core(name):
    """The distinctive part of a park name - what OSM is likely to call it."""
    s = re.sub(r"[^\w\s'-]", " ", name)
    s = NOISE.sub(" ", s)
    words = [w for w in s.split() if len(w) >= 4]
    return max(words, key=len) if words else name.strip().split()[0]


def km(a, b):
    lat = math.radians((a[0] + b[0]) / 2)
    return math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * math.cos(lat))


places = json.load(open(sys.argv[1]))
ele = json.load(open(ELE_CACHE)) if os.path.exists(ELE_CACHE) else {}
out = {}

for p in places:
    key = core(p["name"])
    s, w = p["lat"] - HALF, p["lon"] - HALF * 1.4
    n, e = p["lat"] + HALF, p["lon"] + HALF * 1.4
    q = (
        f'[out:json][timeout:90][bbox:{s:.4f},{w:.4f},{n:.4f},{e:.4f}];'
        f'nwr["name"~"{key}",i];out center tags 60;'
    )
    try:
        els = fetch(q).get("elements", [])
    except SystemExit as exc:
        print(f"  {p['slug']}: {exc}", flush=True)
        els = []
    hits = []
    for el in els:
        c = el.get("center") or el
        if "lat" not in c:
            continue
        t = el.get("tags") or {}
        kind = (t.get("leisure") or t.get("sport") or t.get("landuse")
                or t.get("tourism") or t.get("natural") or t.get("place") or "")
        hits.append((t.get("name", ""), round(c["lat"], 5), round(c["lon"], 5), kind))
    hits.sort(key=lambda h: km((p["lat"], p["lon"]), (h[1], h[2])))
    out[p["slug"]] = hits[:8]
    print(f"\n=== {p['slug']}  (searching \"{key}\")", flush=True)
    for nm, la, lo, kind in hits[:6]:
        d = km((p["lat"], p["lon"]), (la, lo))
        print(f"  {nm[:40]:42s} {la:.5f},{lo:.5f}  {d:5.1f} km  {kind}", flush=True)
    if not hits:
        print("  (nothing named like this within 15 km)", flush=True)
    time.sleep(1)

need = []
for hits in out.values():
    for _, la, lo, _ in hits[:3]:
        k = f"{la:.5f},{lo:.5f}"
        if k not in ele and k not in need:
            need.append(k)
for i in range(0, len(need), 25):
    chunk = need[i:i + 25]
    for _, la, lo, m in elevations([("", float(k.split(",")[0]), float(k.split(",")[1])) for k in chunk]):
        ele[f"{la:.5f},{lo:.5f}"] = m
    json.dump(ele, open(ELE_CACHE, "w"))
    time.sleep(1)

print("\n--- best hit per park, with altitude")
for p in places:
    hits = out[p["slug"]]
    if not hits:
        print(f"{p['slug']:24s} -")
        continue
    nm, la, lo, kind = hits[0]
    m = ele.get(f"{la:.5f},{lo:.5f}")
    alt = f"{round(m)} m" if m is not None else "?"
    print(f"{p['slug']:24s} {nm[:34]:36s} {la:.5f},{lo:.5f}  {alt:>7s}  {kind}")

json.dump(out, open(f"{HERE}/named_hits.json", "w"), indent=1, ensure_ascii=False)
