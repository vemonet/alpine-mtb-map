"""List every lift in a bounding box with both endpoints and their altitude.

    python3 lifts.py 46.79,9.19,46.90,9.32            # bbox: S,W,N,E
    python3 lifts.py 46.79,9.19,46.90,9.32 --ele      # add elevations (slower)

The higher endpoint is the top station, which is where a main spot pin goes.
Never guess which end that is from the map: query it.
"""

import sys

from overpass import elevations, fetch

LIFTS = "gondola|cable_car|chair_lift|mixed_lift|funicular"


def main(bbox, want_ele):
    query = (
        f"[out:json][timeout:180];"
        f'way["aerialway"~"{LIFTS}"]({bbox});'
        f"out geom;"
    )
    rows = []
    for el in fetch(query)["elements"]:
        tags = el.get("tags", {})
        geom = el.get("geometry") or []
        if len(geom) < 2:
            continue
        rows.append((tags.get("aerialway", ""), tags.get("name", "?"), geom[0], geom[-1]))

    if want_ele:
        pts = []
        for _, name, a, b in rows:
            pts += [(f"{name} A", a["lat"], a["lon"]), (f"{name} B", b["lat"], b["lon"])]
        ele = {(round(la, 5), round(lo, 5)): m for _, la, lo, m in elevations(pts)}
    else:
        ele = {}

    for kind, name, a, b in rows:
        def show(p):
            m = ele.get((round(p["lat"], 5), round(p["lon"], 5)))
            tail = f" ({m:.0f} m)" if m is not None else ""
            return f'{p["lat"]:.5f},{p["lon"]:.5f}{tail}'

        print(f"{kind:11} {name[:32]:32} A {show(a)}  B {show(b)}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        raise SystemExit(__doc__)
    main(args[0], "--ele" in args)
