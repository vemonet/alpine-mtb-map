"""Find mountain-bike descents in OpenStreetMap and turn one into KML.

    python3 trails.py 46.13,6.65,46.18,6.72               # list what is mapped
    python3 trails.py 46.13,6.65,46.18,6.72 --id 1234567  # emit KML coordinates
    python3 trails.py ... --id 1234567 --force            # emit despite gaps

Listing shows OSM id, grade, length and name, longest first. The --id form
prints a ready-to-paste <coordinates> block, simplified to a ~8 m tolerance so
a 3 km descent lands around 40 points instead of 400. It refuses on relations
that do not chain into a single line (circuits, branching networks) unless you
pass --force, because those draw a straight bar across the mountain.

Everything this returns is ODbL. Keep the attribution line the KML already
uses: "Geometry simplified from OpenStreetMap <type> <id> (ODbL)".
"""

import math
import sys

from overpass import fetch

# mtb:scale is the single-track difficulty scale; imba is what bike parks use.
# route=mtb relations catch the named descents that span several ways.
SELECTORS = [
    'relation["route"="mtb"]({bbox})',
    'way["mtb:scale"]({bbox})',
    'way["mtb:scale:imba"]({bbox})',
    'way["highway"="path"]["mtb"="designated"]({bbox})',
]


def haversine(a, b):
    r = 6371000
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dp = p2 - p1
    dl = math.radians(b["lon"] - a["lon"])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def length(geom):
    return sum(haversine(geom[i], geom[i + 1]) for i in range(len(geom) - 1))


def simplify(geom, tol=8.0):
    """Douglas-Peucker in metres, using a local flat-earth projection."""
    if len(geom) < 3:
        return geom
    lat0 = math.radians(geom[0]["lat"])
    mx, my = 111320 * math.cos(lat0), 110540

    def xy(p):
        return (p["lon"] * mx, p["lat"] * my)

    def rdp(pts):
        if len(pts) < 3:
            return pts
        (x1, y1), (x2, y2) = xy(pts[0]), xy(pts[-1])
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy) or 1e-9
        worst, idx = 0.0, 0
        for i, p in enumerate(pts[1:-1], 1):
            px, py = xy(p)
            d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm
            if d > worst:
                worst, idx = d, i
        if worst <= tol:
            return [pts[0], pts[-1]]
        return rdp(pts[: idx + 1])[:-1] + rdp(pts[idx:])

    return rdp(geom)


def chain(segs):
    """Greedily join segments end-to-end. Returns (points, worst gap in m)."""
    segs = [list(s) for s in segs]
    out, worst = list(segs.pop(0)), 0.0
    while segs:
        gap, i = min(
            (min(haversine(out[-1], s[0]), haversine(out[-1], s[-1])), i)
            for i, s in enumerate(segs)
        )
        s = segs.pop(i)
        if haversine(out[-1], s[-1]) < haversine(out[-1], s[0]):
            s.reverse()
        worst = max(worst, gap)
        out += s
    return out, worst


def geometry(el):
    """Flatten a way or a relation into (points, worst join gap in metres).

    A way's nodes are connected by definition, so its gap is always 0 - long
    straight segments between two nodes are real trail, not a discontinuity.
    Relation members come in no reliable order or direction, so the segments
    are chained greedily. The direction of the *first* segment decides the
    whole chain, and getting it wrong strands a member at the far end, so both
    orientations are tried and the one with the smaller worst gap wins.
    """
    if el["type"] == "way":
        return el.get("geometry") or [], 0.0
    segs = [m["geometry"] for m in el.get("members", []) if m.get("geometry")]
    if not segs:
        return [], 0.0
    if len(segs) == 1:
        return segs[0], 0.0
    forward, gap_f = chain(segs)
    backward, gap_b = chain([list(reversed(segs[0]))] + segs[1:])
    return (forward, gap_f) if gap_f <= gap_b else (backward, gap_b)


def collect(bbox):
    parts = "".join(s.format(bbox=bbox) + ";" for s in SELECTORS)
    query = f"[out:json][timeout:180];({parts});out geom;"
    found = []
    for el in fetch(query)["elements"]:
        geom, gap = geometry(el)
        if len(geom) < 2:
            continue
        tags = el.get("tags", {})
        found.append(
            {
                "el": el,
                "geom": geom,
                "gap": gap,
                "name": tags.get("name", "(unnamed)"),
                "grade": tags.get("mtb:scale:imba") or tags.get("mtb:scale") or "-",
                "len": length(geom),
            }
        )
    return found


def emit(t, force):
    el = t["el"]
    # A gap left by chaining means the relation is a loop or a branching
    # network rather than one descent, and the line will draw a straight bar
    # across the mountain. Do not let that reach the KML. This is measured on
    # the raw members, not after simplifying: Douglas-Peucker legitimately
    # leaves consecutive points far apart on a straight section.
    if t["gap"] > 200 and not force:
        raise SystemExit(
            f'{el["type"]} {el["id"]} ("{t["name"]}") does not chain into one '
            f'line: {t["gap"]:.0f} m gap between members. It is probably a '
            f"circuit or a branching network. Pick a single-way trail instead, "
            f"or pass --force and trim the result by hand."
        )
    pts = simplify(t["geom"])
    coords = " ".join(f'{p["lon"]:.6f},{p["lat"]:.6f},0' for p in pts)
    print(f'<!-- {t["name"]}: {t["len"] / 1000:.1f} km, '
          f'{len(t["geom"])} pts -> {len(pts)}. Source: OSM {el["type"]} '
          f'{el["id"]} (ODbL) -->')
    print(f"<coordinates>{coords}</coordinates>")


def main(bbox, want_id, force):
    found = sorted(collect(bbox), key=lambda t: -t["len"])
    if want_id:
        for t in found:
            if str(t["el"]["id"]) == want_id:
                return emit(t, force)
        raise SystemExit(f"no trail with id {want_id} in that bbox")
    for t in found:
        el = t["el"]
        print(f'{el["type"]:8} {el["id"]:>12}  grade {t["grade"]:>4}  '
              f'{t["len"] / 1000:5.1f} km  {t["name"][:44]}')


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        raise SystemExit(__doc__)
    wanted = args[args.index("--id") + 1] if "--id" in args else None
    main(args[0], wanted, "--force" in args)
