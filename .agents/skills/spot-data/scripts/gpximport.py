"""Turn a folder of supplied gpx.studio traces into ready-to-paste KML placemarks.

    python3 gpximport.py ../../../../tmp/himalaya --pin 83.7305,28.78381   # profile table
    python3 gpximport.py ../../../../tmp/himalaya \
        --spot lower-mustang-enduro --prefix "Lower Mustang" --area "Lower Mustang" \
        --tags "expert natural no-lift enduro freeride" --no-level \
        --caveat "These are remote, unsigned high-altitude routes ..."

Files the user drops in `tmp/<spot>/` are named `<Trail> (<colour>).gpx` and were
**hand-drawn in gpx.studio**, never downloaded from an operator. This asserts on
the `creator` attribute and credits them accordingly: "drawn in gpx.studio and
supplied for this map". Reserve "official GPX" for genuine resort downloads.

**The profile decides the sentence, not the filename.** A supplied trace is not
always a descent. In the 2026-08-21 Lower Mustang batch `Base Camp Thorong Pass`
climbed 394 m with 4 m of descent (it is the approach leg), `Under The Temple`
netted 5 m over 653 m, and `Thorong Pass` crossed a 5406 m col with 2180 m down
against 1661 m up. So there are four sentence shapes - drop, climb, rolling link,
pass crossing - and writing "dropping N m" for any of the last three is a false
claim.

**The supplied colour is a hint on natural terrain and signage at a park.** On
this map orange means *harder than black*, so a batch labelled orange that
measures gentle is mislabelled - check it against the profile printed by `--pin`
before mapping it through. Do not mention any reassignment in the text.

Run with `--pin lon,lat` first and read the table: it prints each file's profile
and its distance from the spot pin, which is what tells you whether a folder is
one hillside or a whole riding area.
"""

import argparse
import glob
import os
import re
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from trails import haversine, length, simplify

STYLE = {"green": "#line-green", "blue": "#line-blue", "red": "#line-red",
         "black": "#line-black", "orange": "#line-orange"}
ADJ = {"green": "easy", "blue": "moderate", "red": "difficult",
       "black": "extremely difficult", "orange": "extreme"}
LEVEL = {"green": "beginner", "blue": "beginner", "red": "intermediate",
         "black": "expert", "orange": "expert"}


def read(path):
    """Every trkpt/rtept with its elevation, plus the creator attribute."""
    root = ET.parse(path).getroot()
    pts = []
    for p in root.iter():
        if p.tag.endswith("trkpt") or p.tag.endswith("rtept"):
            ele = None
            for c in p:
                if c.tag.endswith("ele") and c.text:
                    ele = float(c.text)
            pts.append({"lat": float(p.get("lat")), "lon": float(p.get("lon")), "ele": ele})
    return pts, root.get("creator")


def profile(geom):
    e = [p["ele"] for p in geom if p["ele"] is not None]
    up = sum(max(0, e[i + 1] - e[i]) for i in range(len(e) - 1))
    down = sum(max(0, e[i] - e[i + 1]) for i in range(len(e) - 1))
    return {"top": e[0], "bot": e[-1], "hi": max(e), "lo": min(e),
            "net": e[0] - e[-1], "up": up, "down": down, "n": len(e)}


def phrase(metres, pr):
    """Say what the line actually does. Four shapes, chosen by measurement."""
    top, bot, net = pr["top"], pr["bot"], pr["net"]
    if pr["hi"] - max(top, bot) > 300:
        return ("crossing from %d m to %d m over a %d m high point, with %d m of descent and %d m"
                " of climbing - a pass crossing with hike-a-bike, not a run") % (
            round(top), round(bot), round(pr["hi"]), round(pr["down"]), round(pr["up"]))
    if net >= 25 and pr["down"] >= 2 * pr["up"]:
        return "dropping %d m from %d m to %d m at an average %d%%" % (
            round(net), round(top), round(bot), round(100 * net / metres))
    if net <= -25 and pr["up"] >= 2 * pr["down"]:
        return ("climbing %d m from %d m to %d m at an average %d%% - drawn as the approach,"
                " not a descent") % (
            round(-net), round(top), round(bot), round(100 * -net / metres))
    return ("running from %d m to %d m over %d m of descent and %d m of climbing, so it rides as a"
            " rolling link rather than a descent") % (
        round(top), round(bot), round(pr["down"]), round(pr["up"]))



def xml_escape(text):
    """Escape a trail name for a KML text node.

    OSM names contain `&` (`Nani & Mariedl MTB Trail` at Hochkonig) and the odd
    `<`. Emitted raw they make the whole KML fail to parse, which is a silent
    trap: the file looks fine until the app refuses to load it.
    """
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def placemark(name, colour, geom, pr, metres, a):
    prof = phrase(metres, pr)
    extra = ""
    if pr["hi"] - max(pr["top"], pr["bot"]) > 100 and "high point" not in prof:
        extra = " It tops out at %d m." % round(pr["hi"])
    desc = ("%.1f km %s, %s route in %s, %s.%s <i>Trace drawn in gpx.studio and supplied for this"
            " map, simplified to ~8 m - indicative only.%s</i>") % (
        metres / 1000.0, colour, ADJ[colour], a.area, prof, extra,
        " " + a.caveat if a.caveat else "")
    coords = " ".join("%.6f,%.6f,0" % (p["lon"], p["lat"]) for p in simplify(geom))
    tags = a.tags if a.no_level else (LEVEL[colour] + " " + a.tags)
    return """  <Placemark>
    <name>%s: %s</name>
    <description><![CDATA[%s]]></description>
    <styleUrl>%s</styleUrl>
    <LineString><tessellate>1</tessellate><coordinates>%s</coordinates></LineString>
    <ExtendedData><Data name="spot"><value>%s</value></Data><Data name="tags"><value>%s</value></Data></ExtendedData>
  </Placemark>""" % (xml_escape(a.prefix), xml_escape(name), desc, STYLE[colour], coords, a.spot, tags)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", help="a tmp/<spot>/ directory of <Trail> (<colour>).gpx files")
    ap.add_argument("--pin", help="lon,lat - print the profile table instead of KML")
    ap.add_argument("--spot", default="SPOT-ID")
    ap.add_argument("--prefix", default="SPOT", help="line name prefix, e.g. 'Lower Mustang'")
    ap.add_argument("--area", default="the area", help="how the description names the area")
    ap.add_argument("--tags", default="natural no-lift enduro")
    ap.add_argument("--caveat", default="", help="local access/hazard sentence for the description")
    ap.add_argument("--no-level", action="store_true",
                    help="do not derive a difficulty tag from the colour - use where a blue line "
                         "would wrongly make an expedition spot read as beginner-friendly")
    a = ap.parse_args()

    rows = []
    for path in sorted(glob.glob(os.path.join(a.folder, "*.gpx"))):
        base = os.path.basename(path)[:-4]
        m = re.match(r"^(.*?)\s*\((green|blue|red|black|orange)\)$", base)
        if not m:
            sys.exit("filename is not '<Trail> (<colour>).gpx': " + base)
        geom, creator = read(path)
        if not creator or "gpx.studio" not in creator:
            sys.exit("%s: creator is %r, not gpx.studio - do not credit it as supplied"
                     % (base, creator))
        pr = profile(geom)
        if pr["n"] != len(geom):
            sys.exit("%s: %d of %d points carry no elevation"
                     % (base, len(geom) - pr["n"], len(geom)))
        rows.append((m.group(1), m.group(2), geom, pr, length(geom)))

    if a.pin:
        lon, lat = (float(v) for v in a.pin.split(","))
        for name, colour, geom, pr, metres in rows:
            d0 = haversine(geom[0], {"lat": lat, "lon": lon})
            d1 = haversine(geom[-1], {"lat": lat, "lon": lon})
            print("%-32s %-6s %6.0fm  %4.0f->%4.0f hi %4.0f  net %+5.0f  down %4.0f up %4.0f"
                  "  avg %5.1f%%  pin %4.1f-%4.1fkm"
                  % (name[:32], colour, metres, pr["top"], pr["bot"], pr["hi"], pr["net"],
                     pr["down"], pr["up"], 100 * pr["net"] / max(metres, 1),
                     d0 / 1000, d1 / 1000))
        return
    print("\n".join(placemark(n, c, g, p, m, a) for n, c, g, p, m in rows))


if __name__ == "__main__":
    main()
