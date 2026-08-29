"""North-American variant of `parkruns.py`: find a bike park's runs when the ways
carry no bike tag, and fence them against the resort polygon.

    python3 napark.py 47.48,-116.18,47.56,-116.08 --poly way/1263732068 --pin -116.13342,47.54077
    python3 napark.py ... --pistes                     # include piste:type=downhill
    python3 napark.py ... --emit --spot ID --prefix "Name" --tags "..." --only "A,B,C"

Why this exists: `parkruns.py` selects `name` + `bicycle=designated`, which is the
bike-park signature across Europe and Andorra and returns **zero** at most North
American resorts. Two other conventions are used there, and each needs its own run:

1. **Bare `highway=path` + `name`** - SilverStar, Silver Mountain. This is the
   default selection here: every named path-like way, minus `bicycle=no`.
2. **`piste:type=downhill`** - Sugarbush and Fernie sign bike runs down their ski
   trails, so OSM holds them only as ski pistes. Those are excluded by default,
   because a bike map does not want the winter runs; pass `--pistes` to include
   them, and then classify by name against the operator's own trail list. Missing
   this is how Sugarbush reads as an unmapped resort when its park is fully there.

Nothing here decides what is a bike run - only the operator's trail list can. Use
`--only` to admit the names that list confirms, or `--grades "Name=blue,Other=orange"`
when the operator's map also supplies the difficulty OSM is missing (that implies
`--only` and replaces the "records no grade" sentence with `--grade-note`). What the table gives you is the
evidence: chained length, drop, gradient, the fraction of the line inside the
resort polygon, and the distance from the spot pin.

**Read the polygon fraction and the pin distance together.** The
`landuse=winter_sports` polygon is decisive at Fernie (park runs 100% in, the
valley XC networks 0% in and 2-4 km out) and useless at Silver Mountain, where it
covers only the upper mountain and half the park reads 0%.

Licence: ODbL, credited per line as the KML already does.
"""

import argparse
import collections
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import parkruns
from overpass import fetch
from trails import haversine

# Ski and nordic pistes are excluded unless --pistes: a bike map does not want the
# winter runs. But see the module docstring - at some resorts they ARE the runs.
SKI = ("nordic", "downhill", "skitour", "sled")


def collector(with_pistes):
    def collect(bbox, skip):
        # `--pistes` needs its own selector, not just a relaxed filter: at Sunrise Park
        # (Arizona) every ski run is `piste:type=downhill` with NO highway tag at all, so
        # the highway selector alone returns nothing but Forest Service roads.
        piste_sel = ' way["piste:type"="downhill"]["name"]({bbox});'.format(bbox=bbox) if with_pistes else ""
        query = f"""[out:json][timeout:180];
(
 way["highway"~"^(path|track|cycleway|footway|bridleway)$"]["name"]({bbox});
{piste_sel}
);
out tags geom;"""
        groups = collections.defaultdict(list)
        for el in fetch(query, timeout=180)["elements"]:
            tags = el.get("tags", {})
            if el["id"] in skip or len(el.get("geometry") or []) < 2:
                continue
            if tags.get("bicycle") == "no" or tags.get("highway") == "steps":
                continue
            piste = tags.get("piste:type")
            if piste in SKI and not (with_pistes and piste == "downhill"):
                continue
            groups[parkruns.norm(tags["name"])].append(el)
        return groups

    return collect


def ring(spec):
    """Every point of a way or relation, flattened - enough for point-in-polygon."""
    typ, oid = spec.split("/")
    els = fetch("[out:json][timeout:120];%s(%s);out geom;" % (typ, oid), timeout=120)["elements"]
    pts = []
    for el in els:
        if el.get("geometry"):
            pts += [(p["lon"], p["lat"]) for p in el["geometry"]]
        for m in el.get("members", []):
            if m.get("geometry"):
                pts += [(p["lon"], p["lat"]) for p in m["geometry"]]
    return pts


def inside(pts, lon, lat):
    n, c = len(pts), False
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > lat) != (y2 > lat) and lon < x1 + (lat - y1) * (x2 - x1) / (y2 - y1 + 1e-15):
            c = not c
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("bbox", help="S,W,N,E")
    ap.add_argument("--poly", help="landuse=winter_sports fence, as way/123 or relation/123")
    ap.add_argument("--pin", help="lon,lat of the spot pin, to report distance from")
    ap.add_argument("--pistes", action="store_true", help="include piste:type=downhill ways")
    ap.add_argument("--emit", action="store_true", help="print KML placemarks instead of a table")
    ap.add_argument("--spot", default="SPOT-ID")
    ap.add_argument("--prefix", default="SPOT")
    ap.add_argument("--tags", default="bike-park dh")
    ap.add_argument("--only", default="", help="comma-separated names to keep (the operator's list)")
    ap.add_argument(
        "--grades",
        default="",
        help="operator grades, 'Name=blue,Other=orange'. Sets the colour where OSM has none,"
        " implies --only, and replaces the 'records no grade' sentence with --grade-note",
    )
    ap.add_argument(
        "--grade-note",
        default="Difficulty from the operator's own trail map.",
        help="sentence crediting where the --grades came from",
    )
    ap.add_argument("--skip", default="", help="comma-separated OSM way ids already in the KML")
    ap.add_argument("--all", action="store_true", help="show the runs the drop test rejects too")
    args = ap.parse_args()

    parkruns.collect = collector(args.pistes)
    runs = parkruns.build(args.bbox, {int(x) for x in args.skip.split(",") if x.strip()})
    fence = ring(args.poly) if args.poly else None
    pin = tuple(float(v) for v in args.pin.split(",")) if args.pin else None
    for r in runs:
        r["in"] = (
            sum(inside(fence, p["lon"], p["lat"]) for p in r["geom"]) / len(r["geom"])
            if fence
            else -0.01
        )
        r["d"] = (
            min(haversine(p, {"lat": pin[1], "lon": pin[0]}) for p in r["geom"]) if pin else -1
        )

    grades = {}
    for item in args.grades.split(","):
        if item.strip():
            name, _, colour = item.rpartition("=")
            grades[parkruns.norm(name)] = colour.strip()
    for r in runs:
        colour = grades.get(parkruns.norm(r["name"]))
        if colour:
            r["colour"], r["grade_note"] = colour, args.grade_note

    only = [parkruns.norm(x) for x in args.only.split(",") if x.strip()] or sorted(grades)
    if args.emit:
        sel = [r for r in runs if parkruns.keep(r) and (not only or parkruns.norm(r["name"]) in only)]
        print("\n".join(parkruns.placemark(r, args.spot, args.prefix, args.tags) for r in sel))
        return
    for r in runs:
        if not parkruns.keep(r) and not args.all:
            continue
        print(
            "%-32s %5dm gap%4d %4d->%4d drop%5d %5.1f%% in%4.0f%% pin%6dm %s %s"
            % (
                r["label"][:32], r["len"], r["gap"], r["top"], r["bot"], r["drop"], r["pct"],
                100 * r["in"], r["d"], "keep" if parkruns.keep(r) else "DROP", r["ids"],
            )
        )
    print("%d runs, %d pass the drop test" % (len(runs), sum(1 for r in runs if parkruns.keep(r))))


if __name__ == "__main__":
    main()
