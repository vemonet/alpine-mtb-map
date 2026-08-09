"""Kept as the record of one experiment: can the OSM GPS trace archive be
filtered down to actual downhill runs? The answer was no - see SKILL.md.

Re-run it before believing that again; it takes about 15 minutes and hits the
OSM website once per trace.

Todtnau said no, but Todtnau is a quiet German park. This tests the strongest
filter I can build against three busy Alpine parks where, if riders upload to
OSM at all, they upload here.

The filter looks for the physical signature of a gravity run inside each full
downloaded trace (the bbox endpoint has no elevation, so the profile test can
only run after a download):

  - a descent window of at least 250 m of drop
  - averaging at least 6 % gradient
  - ridden at 8-45 km/h  (walking is under 6, cars on hairpins exceed 45)
  - at least 1 km long

Anything matching gets reported with its speed and gradient so I can look at it
by hand. Nothing matching, across three parks, means the archive is noise.
"""

import math
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET

sys.path.insert(0, "/Users/vemonet/dev/perso/alpine-mtb-map/.claude/skills/spot-data/scripts")
from gpstraces import TRACE_URL, get, parse_full, scan  # noqa: E402

PARKS = {
    # bbox S,W,N,E                         lift top (lon, lat)
    "les-gets": ("46.140,6.640,46.180,6.700", (6.6660, 46.1560)),
    "morzine-pleney": ("46.170,6.690,46.200,6.730", (6.7050, 46.1830)),
    "chatel": ("46.245,6.810,46.285,6.860", (6.8360, 46.2600)),
}


def hav(a, b):
    r = 6371000
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    h = (
        math.sin((p2 - p1) / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(math.radians(b["lon"] - a["lon"]) / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(h))


CLIMB_TOL = 30.0  # metres of counter-climb that ends a descent window


def best_descent(pts):
    """Biggest sustained descent, as (drop_m, dist_m, gradient, kmh) or None.

    One forward pass. `hi` is the highest point since the window opened, `lo`
    the lowest since `hi`. Climbing more than CLIMB_TOL above `lo` means the
    rider is going back up, so the window closes at `lo` and reopens.

    The earlier version had no such close and simply tracked the running
    maximum drop, so it happily reported a 468 km window at 0.6 % - the whole
    Route des Grandes Alpes counted as one descent. Any filter built on that
    was measuring nothing.
    """
    ele = [p.get("ele") for p in pts]
    if any(e is None for e in ele):
        return None
    cum = [0.0]
    for i in range(len(pts) - 1):
        cum.append(cum[-1] + hav(pts[i], pts[i + 1]))

    best, hi, lo = None, 0, 0

    def close(hi, lo):
        nonlocal best
        drop, run = ele[hi] - ele[lo], cum[lo] - cum[hi]
        if run < 200 or drop <= 0:
            return
        t0, t1 = pts[hi].get("t"), pts[lo].get("t")
        kmh = (run / 1000) / ((t1 - t0) / 3600) if t0 and t1 and t1 > t0 else None
        if best is None or drop > best[0]:
            best = (drop, run, drop / run, kmh)

    for k in range(1, len(pts)):
        if ele[k] > ele[lo] + CLIMB_TOL:
            close(hi, lo)
            hi = lo = k
        elif ele[k] < ele[lo]:
            lo = k
        elif lo == hi and ele[k] > ele[hi]:
            hi = lo = k
    close(hi, lo)
    return best


def full_with_time(tid):
    from gpstraces import decompress
    body = decompress(get(TRACE_URL.format(id=tid)))
    root = ET.fromstring(body.lstrip(b"\xef\xbb\xbf"))
    ns = root.tag[: root.tag.index("}") + 1]
    import datetime as dt

    pts = []
    for t in root.iter(ns + "trkpt"):
        e = t.findtext(ns + "ele")
        ts = t.findtext(ns + "time")
        pts.append(
            {
                "lat": float(t.get("lat")),
                "lon": float(t.get("lon")),
                "ele": float(e) if e else None,
                "t": dt.datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp() if ts else None,
            }
        )
    return pts


if __name__ == "__main__":
    for park, (bbox, top) in PARKS.items():
        trks = scan(bbox)
        ids, near = set(), {}
        tp = {"lon": top[0], "lat": top[1]}
        for t in trks:
            if not t["id"] or not t["ordered"]:
                continue
            d = min(hav(tp, p) for p in t["pts"])
            if d < 300 and t["id"] not in ids:
                ids.add(t["id"])
                near[t["id"]] = (d, t["name"])
        print(f"\n=== {park}: {len(trks)} segments, {len(ids)} downloadable within 300 m of the lift top")
        hits = 0
        for tid, (d, name) in sorted(near.items(), key=lambda x: x[1][0])[:25]:
            try:
                pts = full_with_time(tid)
            except Exception as exc:  # noqa: BLE001
                print(f"  {tid}: {exc}")
                continue
            time.sleep(1.0)
            b = best_descent(pts)
            if not b:
                print(f"  {tid:>10} {d:4.0f}m  no elevation           {name[:40]}")
                continue
            drop, run, grad, kmh = b
            v = f"{kmh:5.1f}" if kmh else "    ?"
            flag = ""
            if drop >= 250 and grad >= 0.06 and run >= 1000 and kmh and 8 <= kmh <= 45:
                flag = "  <== GRAVITY RUN"
                hits += 1
            print(
                f"  {tid:>10} {d:4.0f}m  drop {drop:4.0f} m / {run / 1000:5.2f} km "
                f"= {grad * 100:4.1f}%  {v} km/h  {name[:34]}{flag}"
            )
        print(f"  -> {hits} candidate gravity runs")
