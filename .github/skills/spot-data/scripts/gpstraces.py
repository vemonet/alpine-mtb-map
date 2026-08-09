"""Search the OpenStreetMap public GPS trace archive, and turn one trace into KML.

    python3 gpstraces.py 47.815,7.940,47.832,7.960              # what has been ridden here
    python3 gpstraces.py 47.815,7.940,47.832,7.960 --near 7.95,47.82   # sort by distance
    python3 gpstraces.py --trace 12004364                       # profile one trace
    python3 gpstraces.py --trace 12004364 --emit                # <coordinates> block

This is the fallback for when OSM has no mapped trail geometry: real riders'
GPS logs. It is a different database from the one `trails.py` queries - traces
are uploaded files, not tagged map objects, and nobody has curated them.

Two endpoints, and the difference between them matters:

  api/0.6/trackpoints?bbox=W,S,E,N&page=N   (the listing form, used here)
      Public, no auth. 5000 points per page, so page until a page repeats.
      Returns lat/lon/time only - the elevation is stripped. Traces whose
      owner chose "identifiable" or "trackable" carry <name> and <url>;
      the rest arrive as anonymous <trk> blocks with no owner and no id.

  /trace/<id>/data                          (the download form, used by --trace)
      Also public and unauthenticated, on www.openstreetmap.org rather than
      api.openstreetmap.org. Returns the ORIGINAL uploaded file: full
      precision, full point count, and <ele> on every point. This is the one
      you actually build a line from.

      api/0.6/gpx/<id>/data is the documented equivalent and returns 401
      without OAuth. Use the /trace/ URL.

Bounding boxes are given here as S,W,N,E, like the other scripts. The API
wants W,S,E,N; this converts. The API caps a bbox at 0.25 square degrees.

Licence: traces are ODbL like the rest of OSM. Credit them as
"Geometry simplified from OpenStreetMap GPS trace <id> (ODbL)".
"""

import bz2
import gzip
import io
import math
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

from trails import length, simplify

UA = "alpine-mtb-map/1.0 (+https://github.com/vemonet/alpine-mtb-map)"
BBOX_URL = "https://api.openstreetmap.org/api/0.6/trackpoints?bbox={w},{s},{e},{n}&page={p}"
TRACE_URL = "https://www.openstreetmap.org/trace/{id}/data"
GPX0 = "{http://www.topografix.com/GPX/1/0}"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def scan(bbox, max_pages=20):
    """Page the bbox endpoint until it stops giving new data.

    Each <trk> element is kept separately rather than merged by name: one
    upload can cross the bbox several times, and merging the visits draws a
    straight bar between them. Anonymous traces have no url and cannot be
    downloaded in full - their bbox points are all you will ever get.
    """
    s, w, n, e = (float(x) for x in bbox.split(","))
    out, seen = [], set()
    for p in range(max_pages):
        body = get(BBOX_URL.format(w=w, s=s, e=e, n=n, p=p))
        if body in seen:
            break
        seen.add(body)
        trks = ET.fromstring(body).findall(GPX0 + "trk")
        if not trks:
            break
        for trk in trks:
            pts = [
                {"lat": float(t.get("lat")), "lon": float(t.get("lon"))}
                for t in trk.iter(GPX0 + "trkpt")
            ]
            if len(pts) < 2:
                continue
            url = trk.findtext(GPX0 + "url") or ""
            # No timestamps means this is the unordered pool, not a path. The
            # API dumps every trace marked merely "public" into anonymous
            # blocks of 5000 points in no order at all, at the tail of the
            # pagination. Chain them and you get a 1800 km scribble.
            ordered = trk.find(f".//{GPX0}trkpt/{GPX0}time") is not None
            out.append(
                {
                    "name": trk.findtext(GPX0 + "name") or "(anonymous)",
                    "id": url.rsplit("/", 1)[-1] if url else "",
                    "user": url.split("/user/")[-1].split("/")[0] if url else "",
                    "pts": pts,
                    "ordered": ordered,
                    "km": length(pts) / 1000 if ordered else 0.0,
                }
            )
    return out


def decompress(body):
    """/trace/<id>/data serves the file exactly as uploaded, not as GPX.

    Most of the archive predates the web upload form, so a large share of it is
    .gpx.bz2, .gpx.gz or .zip. At Les Gets 9 of 16 downloads were bzip2. Feed
    those to an XML parser and you get "not well-formed: line 1, column 7",
    which reads like a corrupt trace rather than a compressed one.
    """
    if body[:3] == b"BZh":
        return bz2.decompress(body)
    if body[:2] == b"\x1f\x8b":
        return gzip.decompress(body)
    if body[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(body)) as z:
            names = [n for n in z.namelist() if n.lower().endswith(".gpx")]
            return z.read(names[0] if names else z.namelist()[0])
    return body


def parse_full(body):
    """Read a downloaded trace. GPX 1.0 and 1.1 differ only in namespace."""
    root = ET.fromstring(decompress(body).lstrip(b"\xef\xbb\xbf"))
    ns = root.tag[: root.tag.index("}") + 1]
    pts = []
    for t in root.iter(ns + "trkpt"):
        ele = t.findtext(ns + "ele")
        pts.append(
            {
                "lat": float(t.get("lat")),
                "lon": float(t.get("lon")),
                "ele": float(ele) if ele else None,
            }
        )
    return pts


def main(argv):
    if "--trace" in argv:
        tid = argv[argv.index("--trace") + 1]
        pts = parse_full(get(TRACE_URL.format(id=tid)))
        ele = [p["ele"] for p in pts if p["ele"] is not None]
        km = length(pts) / 1000
        if ele:
            drop = ele[0] - ele[-1]
            print(
                f"trace {tid}: {km:.1f} km, {len(pts)} pts, "
                f"{max(ele):.0f} -> {min(ele):.0f} m, net drop {drop:.0f} m"
                f"{'  (STORED UPHILL - reverse it)' if drop < 0 else ''}"
            )
        else:
            print(f"trace {tid}: {km:.1f} km, {len(pts)} pts, no elevation in the file")
        if "--emit" in argv:
            simp = simplify(pts)
            print(
                f"\n<!-- GPS trace {tid}: {km:.1f} km, {len(pts)} pts -> {len(simp)}. "
                f"Source: OSM GPS trace {tid} (ODbL) -->"
            )
            coords = " ".join(f"{p['lon']:.6f},{p['lat']:.6f},0" for p in simp)
            print(f"<coordinates>{coords}</coordinates>")
        return

    bbox = argv[1]
    near = None
    if "--near" in argv:
        lon, lat = (float(x) for x in argv[argv.index("--near") + 1].split(","))
        near = {"lon": lon, "lat": lat}
    trks = scan(bbox)
    if not trks:
        print("no public GPS traces in this bbox")
        return

    def hav(a, b):
        r = 6371000
        p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
        h = (
            math.sin((p2 - p1) / 2) ** 2
            + math.cos(p1) * math.cos(p2) * math.sin(math.radians(b["lon"] - a["lon"]) / 2) ** 2
        )
        return 2 * r * math.asin(math.sqrt(h))

    if near:
        for t in trks:
            t["d"] = min(hav(near, p) for p in t["pts"])
        trks.sort(key=lambda t: t["d"])
    else:
        trks.sort(key=lambda t: -t["km"])

    named = sum(1 for t in trks if t["id"])
    pool = sum(1 for t in trks if not t["ordered"])
    print(
        f"{len(trks)} track segments, {named} downloadable, "
        f"{len(trks) - named - pool} anonymous but ordered, {pool} unordered pool (unusable)\n"
    )
    for t in trks[:40]:
        if not t["ordered"]:
            continue
        d = f"{t['d']:5.0f} m  " if near else ""
        who = f"{t['id']:>10} {t['user'][:16]:16s}" if t["id"] else f"{'-':>10} {'':16s}"
        print(f"{d}{t['km']:7.2f} km {len(t['pts']):6d} pts  {who}  {t['name'][:44]}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv)
