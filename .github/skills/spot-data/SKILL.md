---
name: spot-data
description: Find the exact coordinates for a new spot in alpine-mtb-map.kml (lift top and valley stations, verified by altitude) and pull downhill trail geometry out of OpenStreetMap as ready-to-paste KML. Use when adding or correcting a spot, a waypoint or a trail line.
---

# Getting spot coordinates and trail traces

Everything on this map is placed from OpenStreetMap data and checked against an elevation service. Never take a coordinate from a resort website, a screenshot or memory: resorts publish the village, and the pin belongs on the lift.

Two scripts do the work. They need no dependencies beyond the standard library.

```bash
cd .claude/skills/spot-data/scripts
python3 lifts.py  46.74,6.31,46.79,6.40 --ele
python3 trails.py 46.14,6.65,46.18,6.71
```

## 1. Coordinates for a spot

**The rule this map follows:** the main pin marks the **top station of the lift you ride up** - where the descent starts - not the resort, not the village, not the ticket office. Valley stations, mid-stations and the tops of secondary lifts become grey `#placemark-gray` waypoints on the same `spot` id.

### Step 1 - bounding box

Get a rough box around the resort, `S,W,N,E`. Two decimal places is plenty; err on the wide side, it costs nothing.

### Step 2 - list the lifts with altitudes

```bash
python3 lifts.py 46.74,6.31,46.79,6.40 --ele
```

```
chair_lift  Morond    A 46.76762,6.35656 (1021 m)  B 46.75137,6.35364 (1411 m)
```

Each lift prints both endpoints. **The higher one is the top station.** This is the whole point of `--ele`: which end is the top is not guessable from the map, and getting it backwards is the single most common error. Gondolas built in sections appear as separate ways (`Asitzbahn I`, `Asitzbahn II`) - chain them mentally, the top of the last section is the summit.

Without `--ele` the query is much faster; use it to see what exists, then re-run with `--ele` once you know which lifts matter.

### Step 3 - write the placemark

KML is **`longitude,latitude,0`** - the opposite order from everything the script prints and from every map UI. Getting it wrong drops the pin in Somalia.

```xml
<Point><coordinates>6.353640,46.751370,0</coordinates></Point>
```

Quote the altitude you measured in the description's bold first line (`Morond 1410 m - top of the Morond chairlift`), rounded to 5 or 10 m. Do not copy an altitude off the resort's marketing page; they round up.

### Step 4 - look at it

Run `vp dev`, click the spot in the sidebar, and check the pin lands on the dashed aerialway line at the point where the lift ends. A pin floating in a blank hillside means you took a mid-cable node.

### If the lift is not an aerialway

Funiculars and cog railways are `railway=funicular`, not `aerialway`. Swap the selector in `lifts.py`, or query directly:

```
[out:json];way["railway"="funicular"](BBOX);node["railway"="station"](BBOX);out geom;
```

For a pedal-up spot with no lift at all, geocode the pass or trailhead by name and confirm the altitude:

```bash
curl -s -H 'User-Agent: alpine-mtb-map/1.0' \
  'https://nominatim.openstreetmap.org/search?q=Col+de+la+Madone&format=json&limit=5'
```

## 2. Trail traces for downhill runs

### Step 1 - see what is mapped

```bash
python3 trails.py 46.14,6.65,46.18,6.71
```

```
relation      7648377  grade    1    5.4 km  Piste des Biquettes
way         220753196  grade    0    2.1 km  (unnamed)
```

The script looks for the four ways OSM records mountain-bike descents: `route=mtb` relations, `mtb:scale`, `mtb:scale:imba` (what bike parks use), and `highway=path` + `mtb=designated`. Results are longest-first.

### Step 2 - emit the geometry

```bash
python3 trails.py 46.14,6.65,46.18,6.71 --id 220753196
```

```xml
<!-- (unnamed): 2.1 km, 129 pts -> 23. Source: OSM way 220753196 (ODbL) -->
<coordinates>6.671407,46.177498,0 6.670576,46.177363,0 ...</coordinates>
```

Points are simplified with Douglas-Peucker at an 8 m tolerance, which takes a typical descent from several hundred points to a few dozen. That is the right trade for this map: the lines are explicitly indicative, and the KML ships inside the page bundle.

### Step 3 - wrap it in a placemark

Give the line the **same `spot` and `tags`** as the pin it belongs to, so the filters show and hide them together.

```xml
<Placemark>
  <name>Somewhere: Red descent</name>
  <description><![CDATA[2.1 km red downhill trail. Geometry simplified from
    OpenStreetMap way 220753196 (ODbL) - indicative only, follow the signs on
    the ground.]]></description>
  <styleUrl>#line-trail</styleUrl>
  <LineString><tessellate>1</tessellate>
    <coordinates>...</coordinates>
  </LineString>
  <ExtendedData>
    <Data name="spot"><value>somewhere</value></Data>
    <Data name="tags"><value>expert</value></Data>
  </ExtendedData>
</Placemark>
```

Trail lines get no `mwm:icon` block - only points do.

### When it refuses

```
relation 7648377 ("Piste des Biquettes") does not chain into one line:
649 m gap between members.
```

Relation members arrive in no order and no consistent direction. The script chains them nearest-end-first and tries both orientations of the first segment, but a **circuit or a branching network cannot become one line** - forcing it draws a straight bar across the mountain. That is what the refusal prevents.

When you hit it: pick a single `way` instead, find a relation that is one genuine descent (`Alpages Respect`, relation 17656035, chains cleanly), or pass `--force` and delete the bad segment by hand. Always re-check the drawn line in `vp dev` afterwards.

## Licence - not optional

Everything both scripts return is **OpenStreetMap data under ODbL**. That is why `alpine-mtb-map.kml`, `.gpx` and `.geojson` are ODbL rather than Creative Commons, and why the licence cannot be changed. Keep the source in the trail description (`from OpenStreetMap way 220753196 (ODbL)`), as every existing trail line does.

## Overpass notes

- **Use GET, not POST.** POST to `overpass-api.de` returns 504 far too often. `overpass.py` already does this.
- **Expect 429s.** The public endpoint rate-limits hard. `fetch()` retries five times with a growing backoff; when querying several resorts in a row, sleep a few seconds between them.
- **A 406 means no User-Agent.** Always send one.
- **Empty result is usually the bbox**, not missing data. Widen it before concluding a resort has no lifts mapped.
- Elevations come from `api.opentopodata.org` (mapzen dataset), 25 points per request. It is a free service - do not hammer it.
