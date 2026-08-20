"""Infer rideable descents from the plain hiking-path network, where OSM has no MTB tagging at all.

    python3 descents.py 35.08,-5.40,35.32,-5.08                        # rank candidate descents
    python3 descents.py 35.08,-5.40,35.32,-5.08 --town -5.264,35.169   # strip the medina/old town
    python3 descents.py 35.08,-5.40,35.32,-5.08 --emit 235450022       # <coordinates> block
    python3 descents.py 35.08,-5.40,35.32,-5.08 --emit 12,34,56        # chained, in that order

This is the LAST RESORT, and it is only legitimate where **riding on hiking paths is
authorised**. It does not find trails. It finds mapped footpaths whose elevation profile
descends steadily at a gradient a bike could hold, which is a plausibility argument and
nothing more. Nobody has recorded riding what this returns. Anything it produces has to be
labelled as inferred - see SKILL.md for the wording, which is not optional.

Bounding boxes are S,W,N,E like the other scripts here. Elevations come from opentopodata's
mapzen model, 100 points per request at ~1.1 s apart, cached in ele-cache-<bbox>.json because
that is by far the slow step - a 5000-point region takes about a minute of pure waiting.

Licence: path geometry is ODbL like the rest of OSM. Credit it as
"Geometry from OpenStreetMap way <id> (ODbL)" - never as a trail anyone has ridden.
"""

import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

from overpass import fetch
from trails import simplify

# Surfaces that mean "street", not "mountain path". The old towns these regions are famous for
# are paved in sett, and they generate hundreds of short footway ways that swamp the ranking.
URBAN_SURFACE = {"sett", "paving_stones", "concrete", "asphalt", "paved", "cobblestone"}
TOWN_RADIUS_KM = 1.5

# The rideable band, measured as the MEDIAN of 200 m windows. DEM noise makes a window median read
# a few points lower than the same line's end-to-end average, so judge against these numbers, not
# against the headline gradient. Below the band it is a valley track, above it a scramble.
MIN_LENGTH_M = 1500
MIN_DESCENT_M = 200
GRADIENT_BAND = (10.0, 22.0)
# Above the band is NOT an automatic reject - it is the map's orange "harder than black" slot, where
# Verbier sits at 25% and Whistler at 29%. What separates an extreme line from a scramble is whether
# the steepness is SUSTAINED or STEPPED, so above the band the verdict asks for a look, not a bin.
EXTREME_STEP_FRACTION = 0.30
MAX_WINDOW_GRADIENT = 35.0
MAX_CHAIN_DEPTH = 7

CACHE_DIR = os.path.dirname(os.path.abspath(__file__))


def haversine(a, b):
    r = 6371000
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dp = p2 - p1
    dl = math.radians(b["lon"] - a["lon"])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def length(geom):
    return sum(haversine(geom[i], geom[i + 1]) for i in range(len(geom) - 1))


def paths(bbox, town=None):
    """Every non-urban path and footway in the bbox, with geometry."""
    query = (
        "[out:json][timeout:240];("
        'way["highway"="path"](%s);'
        'way["highway"="footway"](%s);'
        ");out geom tags;" % (bbox, bbox)
    )
    ways = fetch(query, timeout=240)["elements"]
    keep = []
    for w in ways:
        tags = w.get("tags", {})
        geom = w.get("geometry") or []
        if len(geom) < 2:
            continue
        if tags.get("surface") in URBAN_SURFACE:
            continue
        # An unsurfaced footway near the town centre is a street, not a mule path.
        if town and tags.get("highway") == "footway" and tags.get("surface") is None:
            lat = sum(p["lat"] for p in geom) / len(geom)
            lon = sum(p["lon"] for p in geom) / len(geom)
            d = math.hypot((lat - town[1]) * 111, (lon - town[0]) * 111 * math.cos(math.radians(lat)))
            if d < TOWN_RADIUS_KM:
                continue
        keep.append(w)
    return keep


def _key(p):
    return "%.5f,%.5f" % (round(p["lat"], 5), round(p["lon"], 5))


def elevations(ways, bbox):
    """DEM elevation for every node, cached on disk - this is the slow step."""
    cache_path = os.path.join(CACHE_DIR, "ele-cache-%s.json" % bbox.replace(",", "_"))
    cache = {}
    if os.path.exists(cache_path):
        cache = json.load(open(cache_path))
    wanted = {_key(p) for w in ways for p in w["geometry"]}
    missing = sorted(wanted - set(cache))
    for i in range(0, len(missing), 100):
        chunk = missing[i : i + 100]
        url = "https://api.opentopodata.org/v1/mapzen?locations=" + urllib.parse.quote("|".join(chunk))
        for attempt in range(4):
            try:
                results = json.load(urllib.request.urlopen(url, timeout=90))["results"]
                break
            except Exception as exc:
                print("  elevation retry at %d: %s" % (i, exc), file=sys.stderr)
                time.sleep(4)
        else:
            raise RuntimeError("elevation fetch failed at offset %d" % i)
        for k, res in zip(chunk, results):
            cache[k] = res["elevation"]
        time.sleep(1.1)
    json.dump(cache, open(cache_path, "w"))
    return cache


def profile(geom, ele):
    """Total climb and descent along a geometry, in metres."""
    up = down = 0.0
    for i in range(len(geom) - 1):
        d = ele[_key(geom[i + 1])] - ele[_key(geom[i])]
        if d > 0:
            up += d
        else:
            down -= d
    return up, down


def window_gradients(geom, ele, window=200.0):
    """Gradient in percent over rolling `window` metre stretches, signed positive downhill."""
    out = []
    acc = 0.0
    start = 0
    for i in range(len(geom) - 1):
        acc += haversine(geom[i], geom[i + 1])
        if acc >= window:
            out.append(100 * (ele[_key(geom[start])] - ele[_key(geom[i + 1])]) / acc)
            acc = 0.0
            start = i + 1
    return out


def chain(ways, order, ele=None):
    """Join ways head to tail, orienting the FIRST one against the second.

    Orienting each way against the previous chain end silently fails on way one, because
    there is no previous end to test - it draws a straight bar across the mountain instead.
    """
    geoms = [list(w["geometry"]) for w in (ways[i] for i in order)]
    if len(geoms) > 1:
        a, b = geoms[0], geoms[1]
        if min(haversine(a[0], b[0]), haversine(a[0], b[-1])) < min(
            haversine(a[-1], b[0]), haversine(a[-1], b[-1])
        ):
            geoms[0] = a[::-1]
    out = geoms[0]
    for seg in geoms[1:]:
        if haversine(seg[-1], out[-1]) < haversine(seg[0], out[-1]):
            seg = seg[::-1]
        out += seg[1:]
    if ele and ele[_key(out[0])] < ele[_key(out[-1])]:
        out = out[::-1]
    return out


def search(ways, ele):
    """Rank descending chains, best first, deduplicated by way overlap."""
    edges = []
    for w in ways:
        geom = w["geometry"]
        if any(_key(p) not in ele for p in geom):
            continue
        if length(geom) < 40:
            continue
        edges.append(w)

    adj = {}
    for i, e in enumerate(edges):
        adj.setdefault(_key(e["geometry"][0]), []).append((i, False))
        adj.setdefault(_key(e["geometry"][-1]), []).append((i, True))

    best = {}

    def walk(node, path, used, depth):
        geom = []
        for i, rev in path:
            seg = edges[i]["geometry"][::-1] if rev else edges[i]["geometry"]
            geom += seg if not geom else seg[1:]
        up, down = profile(geom, ele)
        total = length(geom)
        if total > MIN_LENGTH_M * 0.5 and down > MIN_DESCENT_M * 0.6:
            key = tuple(sorted(i for i, _ in path))
            score = down - 2.5 * up
            if score > best.get(key, (-1e9,))[0]:
                best[key] = (score, list(path), total, up, down)
        if depth >= MAX_CHAIN_DEPTH:
            return
        for j, rev in adj.get(node, []):
            if j in used:
                continue
            seg = edges[j]["geometry"][::-1] if rev else edges[j]["geometry"]
            u, d = profile(seg, ele)
            if d <= u:  # only ever extend downhill
                continue
            used.add(j)
            path.append((j, rev))
            walk(_key(seg[-1]), path, used, depth + 1)
            path.pop()
            used.discard(j)

    for i, e in enumerate(edges):
        for rev in (False, True):
            seg = e["geometry"][::-1] if rev else e["geometry"]
            u, d = profile(seg, ele)
            if d <= u:
                continue
            walk(_key(seg[-1]), [(i, rev)], {i}, 1)

    rows = []
    seen = set()
    for score, path, total, up, down in sorted(best.values(), key=lambda x: -x[0]):
        ids = {i for i, _ in path}
        if len(ids & seen) > len(ids) * 0.4:
            continue
        geom = []
        for i, rev in path:
            seg = edges[i]["geometry"][::-1] if rev else edges[i]["geometry"]
            geom += seg if not geom else seg[1:]
        top, bottom = ele[_key(geom[0])], ele[_key(geom[-1])]
        grads = window_gradients(geom, ele, 200.0)
        if not grads:
            continue
        median = sorted(grads)[len(grads) // 2]
        spacing = total / max(1, len(geom) - 1)
        rows.append(
            {
                "ids": [edges[i]["id"] for i, _ in path],
                "km": total / 1000,
                "up": up,
                "down": down,
                "top": top,
                "bottom": bottom,
                "median_gradient": median,
                "max_window": max(grads),
                "steep_fraction": sum(1 for g in grads if g > MAX_WINDOW_GRADIENT) / len(grads),
                "spacing_m": spacing,
                "geom": geom,
                "verdict": verdict(
                    total, down, median, max(grads), spacing,
                    sum(1 for g in grads if g > MAX_WINDOW_GRADIENT) / len(grads),
                ),
            }
        )
        seen |= ids
    return rows


def verdict(total, down, median, max_window, spacing, steep_fraction):
    """Why a candidate is or is not worth drawing. Rejects are as useful as the keeps.

    A steep median is a question, not a disqualification. Check whether a road or track reaches the
    top before drawing an ORANGE line - a 1300 m descent you have to push 1300 m to reach is a
    different proposition from one with a shuttle, and the spot text has to say which it is.
    """
    if total < MIN_LENGTH_M:
        return "reject: too short"
    if down < MIN_DESCENT_M:
        return "reject: not enough descent"
    if median > GRADIENT_BAND[1]:
        if steep_fraction > EXTREME_STEP_FRACTION:
            return "reject: %.0f%% median, %.0f%% of windows over %.0f%% - stepped, a scramble" % (
                median, 100 * steep_fraction, MAX_WINDOW_GRADIENT
            )
        return "ORANGE, check access: %.0f%% median but sustained - extreme line, not a scramble" % median
    if median < GRADIENT_BAND[0]:
        return "reject: %.0f%% average - valley track, not gravity" % median
    if max_window > MAX_WINDOW_GRADIENT * 1.5:
        return "check: a %.0f%% window suggests steps or a scramble" % max_window
    if spacing > 50:
        return "keep, coarse: %.0f m between points, traced not walked" % spacing
    return "keep"


def main():
    args = [a for a in sys.argv[1:]]
    if not args:
        print(__doc__)
        return
    bbox = args[0]
    town = None
    emit = None
    for i, a in enumerate(args):
        if a == "--town":
            lon, lat = args[i + 1].split(",")
            town = (float(lon), float(lat))
        if a == "--emit":
            emit = [int(x) for x in args[i + 1].split(",")]

    ways = paths(bbox, town)
    print("%d non-urban path ways, %d points" % (len(ways), sum(len(w["geometry"]) for w in ways)), file=sys.stderr)
    ele = elevations(ways, bbox)

    if emit:
        by_id = {w["id"]: w for w in ways}
        missing = [i for i in emit if i not in by_id]
        if missing:
            raise SystemExit("not in this bbox: %s" % missing)
        geom = chain([by_id[i] for i in emit], range(len(emit)), ele)
        up, down = profile(geom, ele)
        total = length(geom)
        simplified = simplify(geom, 10.0)
        print(
            "%.2f km, %.0f m down / %.0f m up, %.0f -> %.0f m, %d points"
            % (total / 1000, down, up, ele[_key(geom[0])], ele[_key(geom[-1])], len(simplified)),
            file=sys.stderr,
        )
        print(" ".join("%.6f,%.6f,0" % (p["lon"], p["lat"]) for p in simplified))
        return

    for row in search(ways, ele):
        print(
            "%5.2f km  %4.0f m down /%4.0f up  %4.0f -> %4.0f  %2.0f%% med  %2.0f m spacing  %-52s %s"
            % (
                row["km"],
                row["down"],
                row["up"],
                row["top"],
                row["bottom"],
                row["median_gradient"],
                row["spacing_m"],
                row["verdict"],
                ",".join(str(i) for i in row["ids"]),
            )
        )


if __name__ == "__main__":
    main()
