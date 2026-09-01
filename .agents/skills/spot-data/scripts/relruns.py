"""Turn a French bike park's route=mtb relations into one KML line per signed run.

    python3 relruns.py 45.14,6.41,45.20,6.48                      # list the runs
    python3 relruns.py 45.14,6.41,45.20,6.48 --emit \
        --spot valloire --prefix "Valloire" \
        --tags "bike-park dh enduro freeride chairlift" --skip 12719238

Why this exists alongside `parkruns.py`: the two conventions are different data.
`parkruns.py` groups `name` + `bicycle=designated` **ways**, which is how North
American and Andorran parks are mapped. French Alpine resorts instead map each
signed run as a **`route=mtb` relation carrying a `colour` tag** - the way-level
query finds almost nothing there. Running the way script on Valfrejus returns
zero; this one returns its six signed runs including the black `La Diabolique`.

`trails.py` also lists these relations, but one `--id` at a time and with no
grade or DEM orientation - fine for picking a single line out of a natural spot,
hopeless for emitting a whole park.

Two filters that matter, both learnt the hard way:

- **`colour=purple` is a climb, not a run.** French resorts sign their
  uplift/pedal-up links purple (`Montee enduro d'Aussois`, `Montee Enduro - La
  Norma`). They pass no descent test anyway, but naming them as runs is wrong,
  so they are dropped before the DEM is even queried.
- **Touring loops share the tag.** `route=mtb` covers the whole marked network,
  so `Le Tour de la Setaz`, `Boucle des Tourbieres` and `Liaison Woodstock` come
  back next to the park runs. Names starting Tour/Boucle/Liaison/Circuit/
  Sentier/Itineraire/Rando/Montee/Traversee are skipped by name, and whatever
  survives still has to clear the drop test.

Everything else - endpoint clustering, both-ends chaining, DEM orientation, the
`drop >= 60 m and >= 3%` / `drop >= 25 m and >= 4%` pair, the colour-to-level
map, `mtb:scale` never read as a colour - is shared with `parkruns.py`.

Licence: ODbL, credited per line by relation id.
"""

import argparse
import collections
import re

from descents import elevations
from overpass import fetch
from parkruns import LEVEL, STYLE, chain_both_ends, clusters, keep, norm
from trails import length, simplify

# Signed uplift links, not descents. Dropped before the DEM query.
CLIMB_COLOURS = {"purple", "violet"}

# French mappers write the colour in French about a tenth of the time
# (`colour=bleu` on Cuvy - Bonnets Rouges at Areches). Unmapped, those lines
# silently fall through to #line-trail and lose their grade.
COLOUR_FR = {"vert": "green", "bleu": "blue", "rouge": "red", "noir": "black"}

SKIP_NAME = re.compile(
    r"^(le\s+tour|la\s+tour|tour\s+d|tour\s+de|boucle|liaison|circuit|sentier|"
    r"itin|rando|montee|traversee|via\s|voie\s|grand\s+tour)",
)


def collect(bbox, skip):
    """route=mtb relations in the bbox, as (id, name, tags, [member geometries]).

    Two passes on purpose. `out tags geom;` returns the tags and an EMPTY member
    list - the geometry modifier is silently dropped - so the id list has to come
    from a tags-only pass and the geometry from a second `out geom;` on those ids.
    Filtering by name and colour in between also keeps the geometry pass small:
    on a resort bbox the touring loops are far longer than the park runs.
    """
    listing = fetch(f'[out:json][timeout:300];relation["route"="mtb"]({bbox});out tags;',
                    timeout=300)["elements"]
    wanted = {}
    for el in listing:
        tags = el.get("tags", {})
        name = tags.get("name")
        if el["id"] in skip or not name:
            continue
        colour = tags.get("colour")
        if colour in CLIMB_COLOURS or SKIP_NAME.match(norm(name)):
            continue
        if colour in COLOUR_FR:
            tags = dict(tags, colour=COLOUR_FR[colour])
        wanted[el["id"]] = (name, tags)
    if not wanted:
        return []
    out = []
    ids = sorted(wanted)
    for i in range(0, len(ids), 60):
        batch = ",".join(str(x) for x in ids[i:i + 60])
        for el in fetch("[out:json][timeout:300];relation(id:%s);out geom;" % batch,
                        timeout=300)["elements"]:
            if el["id"] not in wanted:
                continue
            segs = [m["geometry"] for m in el.get("members", [])
                    if m.get("type") == "way" and len(m.get("geometry") or []) >= 2]
            if segs:
                name, tags = wanted[el["id"]]
                out.append((el["id"], name, tags, segs))
    return out


def build(bbox, skip):
    rels = collect(bbox, skip)
    if not rels:
        return []
    flat = [{"geometry": s} for _, _, _, segs in rels for s in segs]
    ele = elevations(flat, bbox)

    def z(p):
        return ele["%.5f,%.5f" % (round(p["lat"], 5), round(p["lon"], 5))]

    runs = []
    for rid, name, tags, segs in rels:
        for cluster in clusters(segs):
            geom, gap = chain_both_ends(cluster) if len(cluster) > 1 else (list(cluster[0]), 0.0)
            if z(geom[0]) < z(geom[-1]):
                geom.reverse()
            metres = length(geom)
            drop = z(geom[0]) - z(geom[-1])
            runs.append({
                "name": name, "label": name, "ids": [rid], "geom": geom,
                "gap": round(gap), "len": round(metres),
                "top": round(z(geom[0])), "bot": round(z(geom[-1])), "drop": round(drop),
                "pct": round(100 * drop / max(metres, 1), 1),
                "colour": tags.get("colour"), "scale": tags.get("mtb:scale"),
            })
    # A relation split into disconnected clusters is numbered from the top down.
    counts = collections.Counter(r["name"] for r in runs)
    seen = collections.Counter()
    for run in sorted(runs, key=lambda r: -r["top"]):
        if counts[run["name"]] > 1:
            seen[run["name"]] += 1
            run["label"] = "%s (section %d)" % (run["name"], seen[run["name"]])
    return sorted(runs, key=lambda r: -r["len"])



def xml_escape(text):
    """Escape a trail name for a KML text node.

    OSM names contain `&` (`Nani & Mariedl MTB Trail` at Hochkonig) and the odd
    `<`. Emitted raw they make the whole KML fail to parse, which is a silent
    trap: the file looks fine until the app refuses to load it.
    """
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def placemark(run, spot, prefix, tags):
    """Same shape as parkruns.placemark, but sourced to a relation."""
    colour = run["colour"]
    kind = "%s run" % colour if colour else "trail"
    desc = "%.1f km %s, dropping %d m from %d m to %d m at an average %d%%." % (
        run["len"] / 1000.0, kind, run["drop"], run["top"], run["bot"], round(run["pct"]))
    if colour:
        desc += (" Difficulty from OpenStreetMap's record of the resort's signed colour;"
                 " check the current trail map before riding, grades and closures change.")
    else:
        extra = " (mtb:scale %s)" % run["scale"] if run["scale"] else ""
        desc += " OpenStreetMap records no grade for it%s." % extra
    if "(section" in run["label"]:
        desc += (" The mapped members of this route fall into groups with an unmapped connector"
                 " between them, so they are drawn as separate sections rather than one line.")
    rid = run["ids"][0]
    desc += (" Geometry simplified from OpenStreetMap (ODbL) to approximately 8 m -"
             " indicative only, follow the signs on the ground."
             ' <i>Source: <a href="https://www.openstreetmap.org/relation/%d">'
             "relation %d</a>.</i>" % (rid, rid))
    level = LEVEL.get(colour)
    coords = " ".join("%.6f,%.6f,0" % (p["lon"], p["lat"]) for p in simplify(run["geom"]))
    return """  <Placemark>
    <name>%s: %s</name>
    <description><![CDATA[%s]]></description>
    <styleUrl>%s</styleUrl>
    <LineString><tessellate>1</tessellate><coordinates>%s</coordinates></LineString>
    <ExtendedData xmlns:mwm="https://comaps.app"><mwm:properties><mwm:value key="spot">%s</mwm:value><mwm:value key="tags">%s</mwm:value></mwm:properties></ExtendedData>
  </Placemark>""" % (
        xml_escape(prefix), xml_escape(run["label"]), desc, STYLE.get(colour, "#line-trail"), coords, spot,
        (level + " " if level else "") + tags)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("bbox", help="S,W,N,E")
    ap.add_argument("--emit", action="store_true", help="print KML placemarks instead of a table")
    ap.add_argument("--spot", default="SPOT-ID")
    ap.add_argument("--prefix", default="SPOT", help="line name prefix, e.g. 'Valloire'")
    ap.add_argument("--tags", default="bike-park dh enduro freeride")
    ap.add_argument("--skip", default="", help="comma-separated relation ids already in the KML")
    ap.add_argument("--all", action="store_true", help="show the runs the drop test rejects too")
    a = ap.parse_args()
    skip = {int(x) for x in a.skip.split(",") if x.strip()}
    runs = build(a.bbox, skip)
    if a.emit:
        print("\n".join(placemark(r, a.spot, a.prefix, a.tags) for r in runs if keep(r)))
        return
    for r in runs:
        if not keep(r) and not a.all:
            continue
        print("%-32s %5d m  gap %4d  %4d->%4d  drop %4d  %5.1f%%  col=%-6s scale=%-2s %s rel/%d"
              % (r["label"][:32], r["len"], r["gap"], r["top"], r["bot"], r["drop"], r["pct"],
                 r["colour"] or "-", r["scale"] or "-", "keep" if keep(r) else "DROP", r["ids"][0]))
    print("%d runs, %d pass the drop test" % (len(runs), sum(1 for r in runs if keep(r))))


if __name__ == "__main__":
    main()
