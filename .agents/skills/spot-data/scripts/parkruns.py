"""Turn a bike park's OSM name-fragments into one KML line per signed run.

    python3 parkruns.py 42.52,1.45,42.60,1.56                       # list the runs
    python3 parkruns.py 42.52,1.45,42.60,1.56 --emit \
        --spot pal-arinsal-bike-park --prefix "Pal Arinsal" \
        --tags "bike-park dh enduro freeride gondola" --skip 225328888

Why this exists: `trails.py` lists what is mapped, one OSM object per row. Bike
parks are almost never mapped as one object per run - a single signed trail
arrives as three to five short ways that all carry the same `name`, so the
listing shows "0.4 km Furious" and the run looks too small to bother with. This
script groups by name instead, and the same park reads as 22 real descents.

What it selects: `name` + `bicycle=designated` (or `destination`). That pair is
the bike-park signature - operators' runs carry it even when `mtb:scale` and
`colour` are missing, and hiking paths in the same bbox do not (they are
`bicycle=yes` or nothing, and rarely `oneway`). Names starting Cami/Camino are
dropped: they are the hiking network.

Three traps this handles, all of which bit before it existed:

- **Accents split a run.** `Commençal Superior` and `Commencal Superior` are the
  same trail. Grouping is on the accent-stripped casefold.
- **`trails.py`'s chain only appends at the tail.** A fragment that joins at the
  HEAD of what is already chained gets deferred to the end and reports a
  kilometre-scale gap - Commençal Superior read 6.2 km with a 1583 m gap and
  looked unusable. `chain_both_ends` fixes that: 3.9 km, no gap.
- **A name can be two disconnected halves.** Fragments are clustered on a 150 m
  endpoint threshold and each cluster becomes its own line, labelled
  `(section N)` top-down, rather than one line with a bar across the mountain.

Then every line is oriented downhill from the DEM, and kept only if
`drop >= 60 m and >= 3%` or `drop >= 25 m and >= 4%` - the geography-free pair of
branches from the 2026-08-09 sweep. Elevations come from opentopodata's mapzen
model via `descents.elevations`, cached per bbox on disk.

Colour handling follows the map's convention: green/blue -> beginner,
red -> intermediate, black -> expert, no colour -> `#line-trail` and no level
tag. `mtb:scale` is NEVER read as a colour - it is a technical scale, not a
signed grade.

Licence: ODbL, credited per line as the KML already does.
"""

import argparse
import collections
import json
import unicodedata

from descents import elevations
from overpass import fetch
from trails import haversine, length, simplify

CLUSTER_GAP_M = 150.0
STYLE = {"green": "#line-green", "blue": "#line-blue", "red": "#line-red", "black": "#line-black"}
LEVEL = {"green": "beginner", "blue": "beginner", "red": "intermediate", "black": "expert"}


def norm(name):
    s = unicodedata.normalize("NFKD", name)
    return "".join(c for c in s if not unicodedata.combining(c)).casefold().strip()


def collect(bbox, skip):
    """Named, bike-designated ways in the bbox, grouped by accent-stripped name."""
    query = f"""[out:json][timeout:180];
(
 way["bicycle"="designated"]["name"]({bbox});
 way["bicycle"="destination"]["name"]({bbox});
);
out tags geom;"""
    groups = collections.defaultdict(list)
    for el in fetch(query, timeout=180)["elements"]:
        tags = el.get("tags", {})
        if el["id"] in skip or len(el.get("geometry") or []) < 2:
            continue
        if norm(tags["name"]).startswith(("cami", "camino")):
            continue
        groups[norm(tags["name"])].append(el)
    return groups


def clusters(segs, gap=CLUSTER_GAP_M):
    """Split segments into groups whose endpoints connect within `gap` metres."""
    parent = list(range(len(segs)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for i in range(len(segs)):
        for j in range(i + 1, len(segs)):
            a, b = segs[i], segs[j]
            near = min(
                haversine(a[0], b[0]),
                haversine(a[0], b[-1]),
                haversine(a[-1], b[0]),
                haversine(a[-1], b[-1]),
            )
            if near <= gap:
                parent[find(i)] = find(j)
    out = collections.defaultdict(list)
    for i in range(len(segs)):
        out[find(i)].append(segs[i])
    return list(out.values())


def chain_both_ends(segs):
    """Join segments, extending at the head as well as the tail.

    `trails.py`'s chain only ever appends, so a fragment that belongs before the
    current start is pushed to the end and shows up as a huge gap. Returns
    (points, worst join gap in metres).
    """
    segs = [list(s) for s in segs]
    out, worst = segs.pop(0), 0.0
    while segs:
        best = None
        for i, seg in enumerate(segs):
            for end in ("tail", "head"):
                for rev in (False, True):
                    cand = list(reversed(seg)) if rev else seg
                    d = haversine(out[-1], cand[0]) if end == "tail" else haversine(out[0], cand[-1])
                    if best is None or d < best[0]:
                        best = (d, i, end, rev)
        d, i, end, rev = best
        seg = segs.pop(i)
        if rev:
            seg.reverse()
        out = out + seg if end == "tail" else seg + out
        worst = max(worst, d)
    return out, worst


def keep(run):
    """The geography-free drop test: small hills need the second branch."""
    return (run["drop"] >= 60 and run["pct"] >= 3) or (run["drop"] >= 25 and run["pct"] >= 4)


def build(bbox, skip):
    groups = collect(bbox, skip)
    ways = [el for els in groups.values() for el in els]
    if not ways:
        return []
    ele = elevations(ways, bbox)

    def z(p):
        return ele["%.5f,%.5f" % (round(p["lat"], 5), round(p["lon"], 5))]

    runs = []
    for els in groups.values():
        name = sorted((el["tags"]["name"] for el in els), key=len)[-1]
        tags = {}
        for el in els:
            tags.update({k: v for k, v in el["tags"].items() if k in ("colour", "mtb:scale")})
        by_geom = {id(el["geometry"]): el["id"] for el in els}
        for cluster in clusters([el["geometry"] for el in els]):
            ids = sorted(by_geom[id(s)] for s in cluster)
            geom, gap = chain_both_ends(cluster) if len(cluster) > 1 else (list(cluster[0]), 0.0)
            if z(geom[0]) < z(geom[-1]):
                geom.reverse()
            metres = length(geom)
            drop = z(geom[0]) - z(geom[-1])
            runs.append(
                {
                    "name": name,
                    "label": name,
                    "ids": ids,
                    "geom": geom,
                    "gap": round(gap),
                    "len": round(metres),
                    "top": round(z(geom[0])),
                    "bot": round(z(geom[-1])),
                    "drop": round(drop),
                    "pct": round(100 * drop / max(metres, 1), 1),
                    "colour": tags.get("colour"),
                    "scale": tags.get("mtb:scale"),
                }
            )
    # Sections of the same name are numbered from the top down.
    counts = collections.Counter(r["name"] for r in runs)
    seen = collections.Counter()
    for run in sorted(runs, key=lambda r: -r["top"]):
        if counts[run["name"]] > 1:
            seen[run["name"]] += 1
            run["label"] = "%s (section %d)" % (run["name"], seen[run["name"]])
    return sorted(runs, key=lambda r: -r["len"])


def source(ids):
    if len(ids) == 1:
        return '<i>Source: <a href="https://www.openstreetmap.org/way/%d">way %d</a>.</i>' % (ids[0], ids[0])
    links = ", ".join(
        '<a href="https://www.openstreetmap.org/way/%d">%d</a>' % (i, i) for i in ids
    )
    return "<i>Source: ways %s.</i>" % links


def placemark(run, spot, prefix, tags):
    colour = run["colour"]
    kind = "%s trail" % colour if colour else "trail"
    desc = "%.1f km %s, dropping %d m from %d m to %d m at an average %d%%." % (
        run["len"] / 1000.0, kind, run["drop"], run["top"], run["bot"], round(run["pct"])
    )
    if not colour:
        extra = " (mtb:scale %s)" % run["scale"] if run["scale"] else ""
        desc += " OpenStreetMap records no grade for it%s." % extra
    if "(section" in run["label"]:
        desc += (
            " The mapped fragments of this run fall into groups with an unmapped connector"
            " between them, so they are drawn as separate sections rather than chained into one line."
        )
    desc += (
        " Geometry simplified from OpenStreetMap (ODbL) to approximately 8 m -"
        " indicative only, follow the signs on the ground. " + source(run["ids"])
    )
    level = LEVEL.get(colour)
    coords = " ".join("%.6f,%.6f,0" % (p["lon"], p["lat"]) for p in simplify(run["geom"]))
    return """  <Placemark>
    <name>%s: %s</name>
    <description><![CDATA[%s]]></description>
    <styleUrl>%s</styleUrl>
    <LineString><tessellate>1</tessellate><coordinates>%s</coordinates></LineString>
    <ExtendedData><Data name="spot"><value>%s</value></Data><Data name="tags"><value>%s</value></Data></ExtendedData>
  </Placemark>""" % (
        prefix,
        run["label"],
        desc,
        STYLE.get(colour, "#line-trail"),
        coords,
        spot,
        (level + " " if level else "") + tags,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("bbox", help="S,W,N,E")
    ap.add_argument("--emit", action="store_true", help="print KML placemarks instead of a table")
    ap.add_argument("--spot", default="SPOT-ID", help="spot id for ExtendedData")
    ap.add_argument("--prefix", default="SPOT", help="name prefix, e.g. 'Pal Arinsal'")
    ap.add_argument("--tags", default="bike-park dh enduro freeride", help="activity tags, level is added")
    ap.add_argument("--skip", default="", help="comma-separated OSM way ids already in the KML")
    ap.add_argument("--all", action="store_true", help="show the runs the drop test rejects too")
    args = ap.parse_args()
    skip = {int(x) for x in args.skip.split(",") if x.strip()}
    runs = build(args.bbox, skip)
    if args.emit:
        print("\n".join(placemark(r, args.spot, args.prefix, args.tags) for r in runs if keep(r)))
        return
    for r in runs:
        if not keep(r) and not args.all:
            continue
        print(
            "%-30s %5d m  gap %4d  %4d->%4d  drop %4d  %5.1f%%  col=%-6s scale=%-2s %s %s"
            % (
                r["label"][:30], r["len"], r["gap"], r["top"], r["bot"], r["drop"], r["pct"],
                r["colour"] or "-", r["scale"] or "-", "keep" if keep(r) else "DROP", r["ids"],
            )
        )
    print("%d runs, %d pass the drop test" % (len(runs), sum(1 for r in runs if keep(r))))


if __name__ == "__main__":
    main()
