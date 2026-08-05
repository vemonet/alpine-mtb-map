---
name: spot-data
description: Find the exact coordinates for a new spot in alpine-mtb-map.kml (lift valley and top stations, verified by altitude) and pull downhill trail geometry out of OpenStreetMap as ready-to-paste KML. Use when adding or correcting a spot, a waypoint or a trail line.
---

# Getting spot coordinates and trail traces

Everything on this map is placed from OpenStreetMap data and checked against an elevation service. Never take a coordinate from a resort website, a screenshot or memory: resorts publish the village, and the pin belongs on the lift.

These scripts do the work. They need no dependencies beyond the standard library.

```bash
cd .github/skills/spot-data/scripts
python3 lifts.py  46.74,6.31,46.79,6.40 --ele
python3 trails.py 46.14,6.65,46.18,6.71
python3 find_named.py candidates.json      # rung 1: what is OSM calling it, near here?
python3 verify_mtb.py candidates.json      # rung 2: is there riding near this coordinate?
```

## 1. Coordinates for a spot

**The rule this map follows:** the main pin marks the **bottom of the lift you ride up** (main valley station). If no lift, then pin where the descent starts. Mid-stations and the tops of lifts become grey `#placemark-gray` waypoints on the same `spot` id.

### Step 1 - bounding box

Get a rough box around the resort, `S,W,N,E`. Two decimal places is plenty; err on the wide side, it costs nothing.

### Step 2 - list the lifts with altitudes

```bash
python3 lifts.py 46.74,6.31,46.79,6.40 --ele
```

```
chair_lift  Morond    A 46.76762,6.35656 (1021 m)  B 46.75137,6.35364 (1411 m)
```

Each lift prints both endpoints. **The lower one is the valley station** - that is where the main pin goes, and the higher one becomes a grey waypoint. This is the whole point of `--ele`: which end is which is not guessable from the map, and getting it backwards is the single most common error. Gondolas built in sections appear as separate ways (`Asitzbahn I`, `Asitzbahn II`) - chain them mentally, the bottom of the first section is the valley station.

Without `--ele` the query is much faster; use it to see what exists, then re-run with `--ele` once you know which lifts matter.

### Step 3 - write the placemark

KML is **`longitude,latitude,0`** - the opposite order from everything the script prints and from every map UI. Getting it wrong drops the pin in Somalia.

```xml
<Point><coordinates>6.353640,46.751370,0</coordinates></Point>
```

Quote the altitude you measured in the description's bold first line (`Metabief 1021 m - valley station of the Morond chairlift`), rounded to 5 or 10 m. Use the same wording on the grey waypoint for the other end (`Morond 1410 m - top of the Morond chairlift`). Do not copy an altitude off the resort's marketing page; they round up.

### Step 4 - look at it

Run `vp dev`, click the spot in the sidebar, and check the pin lands on the dashed aerialway line where the lift starts, next to the road or the parking. A pin floating in a blank hillside means you took a mid-cable node, and a pin on the ridge means you took the wrong endpoint.

### If the lift is not an aerialway

Funiculars and cog railways are `railway=funicular`, not `aerialway`. Swap the selector in `lifts.py`, or query directly:

```
[out:json];way["railway"="funicular"](BBOX);node["railway"="station"](BBOX);out geom;
```

### If no lift comes back at all

**An empty lift query is not evidence that the spot is not worth adding.** Shuttle parks, pedal parks and van-uplift parks are real spots; so is a lift-served park whose lift simply is not in OSM yet. Widen the box once, and if it is still empty, switch to locating the _park_ rather than the lift. Work down this ladder and stop at the first rung that gives a coordinate you can defend.

**Rung 0 - build a gazetteer once, then match offline.** If you are placing more than a handful of parks, do this first. Bike-park tags are _value_-indexed, so Overpass will hand you every one on the planet in seconds - no bbox, no per-candidate query:

```
[out:json][timeout:300];nwr["leisure"="bike_park"];out center tags;      #    118 objects,   4 s
[out:json][timeout:300];nwr["sport"="mtb"];out center tags;              #    907 objects, 117 s
[out:json][timeout:300];nwr["sport"="cycling"]["leisure"];out center tags;#  11234 objects, 317 s
[out:json][timeout:300];nwr["piste:type"="downhill"]["bicycle"];out center tags;
```

Four queries, about eight minutes, ~13 000 objects of which ~5 400 are named. After that every candidate is matched **locally** - proximity to its geocode plus name similarity - with no further network calls at all. A cached copy lives at `bikepark-import/world_bikeparks.json` in the project memory directory.

This is dramatically better than querying per candidate when Overpass is loaded: a per-candidate sweep of 57 parks was managing about one every two minutes, while the gazetteer matched all 143 remaining candidates instantly and found seven that the sweep had not reached yet. It also caught **La Fenasosa** at a name score of 1.00, **19.7 km** from the coordinate I had been querying.

Read the matches by score and distance together. A 1.00 name match at 20 km is still the right park with a bad geocode; a 0.30 match at 25 km is a different park entirely (`Ragged Mountain` matched `Highland Mountain Bike Park` 25 km away - two unrelated places).

**Rung 1 - ask OSM what is called that, inside a bbox.** For a single park, or when the gazetteer has no match. The park usually exists in OSM as something, even when its lift does not. Search its own name in a ~15 km box around any rough coordinate you have, even a bad geocode:

```
[out:json][timeout:90][bbox:S,W,N,E];
nwr["name"~"Freeman",i];
out center tags 60;
```

Strip the noise words first - `bike`, `bikepark`, `park`, `trail`, `area`, `resort`, `mountain`, `gravity`, `downhill` and their translations appear in half the names in any directory and only make the regex miss. Match on the distinctive word: `Beerfelden`, not `Bikepark Beerfelden`; `Freeman`, not `Freeman Ridge Bike Park`. `scripts/find_named.py` does this, sorts the hits by distance from your rough coordinate, and measures the altitude of the closest few.

Sort by distance and read the names: `Freeman Ridge Bike Park` at 0.1 km with `leisure=park` is the answer; `Bailey Mountain Residential Apartments` at 1.8 km is not.

**Do not** run this against a whole country (`area["ISO3166-1"="DE"]`). It reads fine and times out - Overpass has to scan every named object in the area. The bbox form goes through the spatial index and answers in a second or two. (`scripts/locate.py` is the country-wide version; it is kept only for the rare case where you have no coordinate at all, and it is slow.)

**This rung matters most outside Europe.** In the United States it is effectively the _only_ rung that works: American trails are mapped in Trailforks and MTB Project rather than OSM, so rung 2 returns zero for real, operating bike parks. Freeman Ridge, Louisville Mega Cavern and Kelly Canyon were all found this way after rung 2 found nothing at all.

It also catches your own bad coordinates. Kelly Canyon came back 8.8 km from where two rounds of lift queries had been looking, which is why those queries had found nothing; Ober Mountain turned out to be lift-served by an aerial tramway whose valley station is in downtown Gatlinburg, 3 km from the resort. When a name search puts the park somewhere other than where you were querying, believe the name search and re-run the lift query there.

**Rung 2 - look for the riding, not the name.** This is the rung that actually works. `scripts/verify_mtb.py` asks what mountain-bike infrastructure sits near a candidate coordinate, one small bbox per candidate:

```
[out:json][timeout:120][bbox:S,W,N,E];
(
  way["mtb:scale"];
  way["mtb:scale:imba"];
  relation["route"="mtb"];
  nwr["piste:type"="downhill"];
  nwr["name"~"bike.?park|freeride",i];
);
out center tags 800;
```

**Use a bbox here, not the `around:` coordinate-list trick.** That trick is what makes `lifts_batch.py` cheap, but it does not transfer: `way["mtb:scale"]` filters a key with _no value_, so Overpass cannot use the value index and falls back to scanning. Batched over a dozen points it times out at 120 s every single time - and Overpass reports that timeout as HTTP 200 with an empty element list, which reads exactly like "there is no bike park here". A per-candidate bbox stays in the spatial index and answers in seconds.

**Then read the result properly, because this rung produces false positives.** A big feature count near your coordinate does not mean you have found the park - it may just mean the region is well mapped. Judge it by what the features are _called_:

- **Trust it** when a feature carries the park's own name: `Bikepark Beerfelden`, `Heidenloch-Bikepark`, `DAV-Bikepark Skillup`, `Molini Freeriders`, `4 Riders Bike Park`. Pin that feature. This is the only really solid outcome.
- **Trust it** when the names are obviously a park's line-up: `Blue Line`, `Downhill`, `Freeride`, `3. Jumpline rot`, `No Jokes Trail`.
- **Do not trust it** when the names are the general local network. Pierron returned 309 features - all the Côte d'Azur, centred on Mougins. Ciocco returned 284 - the Serchio valley. bikeparkOE returned 418 - generic Sauerland trails. Flyup 417 returned 89 - the Forest of Dean's `Adit` trails at Cannop, which is a different site. Every one of those would have produced a confident-looking pin in the wrong place.

When the evidence is regional rather than site-specific, that is a rung-2 failure, not a rung-2 success. Drop to rung 3 or 4.

**Rung 3 - geocode, then verify.** Only now fall back to a geocoder, and never trust it on its own - see the warning below. Take the candidate coordinate and run rung 2 against it. A geocode with MTB features around it is usable; a geocode with nothing around it is a guess and must not become a pin.

```bash
curl -s -H 'User-Agent: alpine-mtb-map/1.0' \
  'https://photon.komoot.io/api?q=Bikepark+Osternohe&limit=5'
```

**Rung 4 - leave it, and write it down.** If all three rungs fail, the spot does not get a pin, but it does get a line in `bikepark-import-skipped.md` with what was tried. That file is the review list; a silent drop is the one outcome to avoid.

#### Geocoders lie, and they lie plausibly

Photon and Nominatim resolve a park name to _a_ place with that name, which is very often the wrong one. Real results from this project: Bike Park d'Artouste placed in Paris, Sjusjøen in Pennsylvania, Bikepark Lipno in Český Krumlov, Hovden ski centre near Oslo (~900 km out), Skillup Augsburg at Arlberg. Filtering by country does not save you - Swiss results come back as `Schweiz`, `Suisse`, `Svizzera` and `Svizra`.

So: **a geocode is a search hint, never a pin.** Every coordinate that reaches the KML must be traceable to an OSM object you looked at - a lift endpoint, a named feature, or a trail cluster.

#### What the pin means when there is no lift

Pin where the descent starts, and say so in the bold first line rather than implying a lift:

```
Beerfelden 320 m - shuttle drop-off at the top of the park
Rincine 950 m - trailhead car park
```

If the uplift arrangement is unknown, say that too. Do not write "valley station" for a park that has no station.

## 2. Trail traces for downhill runs

Checkout the official spots websites for available GPX/KML traces. Try to avoid hammering overpass.

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

## 3. Additional information

When creating or updating a spot or trace add the following information, when possible based on retrieved sources:

- Description of trails (if possible with how many trails of each color)
- Season opening period (open and close dates)
- Impact of rain on the spot: sensitive, regular (no tag), resilient

## Licence - not optional

Everything both scripts return is **OpenStreetMap data under ODbL**. That is why `alpine-mtb-map.kml`, `.gpx` and `.geojson` are ODbL rather than Creative Commons, and why the licence cannot be changed. Keep the source in the trail description (`from OpenStreetMap way 220753196 (ODbL)`), as every existing trail line does.

## Overpass notes

- **Use GET, not POST.** POST to `overpass-api.de` returns 504 far too often. `overpass.py` already does this.
- **Rotate mirrors instead of hammering one host.** A 429 from one instance says nothing about the others, so retrying the same URL only earns a longer ban. `overpass.py` keeps a list of full-planet public instances and moves to the next one on every attempt, rotating across calls as well so a batch spreads out:

  | Mirror | Measured on a small bbox, 2026-08-05 |
  | --- | --- |
  | `overpass-api.de` | 1.0 s. The main instance, and still the fastest when it is not rate-limiting you. |
  | `maps.mail.ru/osm/tools/overpass` | 8.7 s. VK Maps. Reliable. |
  | `overpass.private.coffee` | 33 s. Slow but answers. |
  | `overpass.kumi.systems` | timed out at 45 s that day. Often excellent, so worth keeping last rather than dropping. |

  Two instances are deliberately **not** in the rotation:

  - `overpass.osm.jp` - its TLS certificate does not match the hostname, so every request fails verification.
  - `overpass.osm.ch` - serves a **Switzerland extract**, not the planet. Query it about the Harz and it returns an empty element list with no error, which is indistinguishable from "there is nothing there". Never put a regional extract in a planet rotation.

  Keep the per-request timeout short (60 s in `overpass.py`) so one wedged mirror costs seconds rather than minutes: with a 180 s timeout and five mirrors, a single bad query can block for a quarter of an hour before it gives up.

- **Overpass reports failure with HTTP 200.** A timed-out or out-of-memory query comes back as a normal JSON body with an empty `elements` list and a `remark` field. Parse naively and it reads as "no lifts here". `fetch()` raises on a `remark` with no elements so this cannot pass silently.
- **Expect 429s.** Every public endpoint rate-limits. When querying several resorts in a row, sleep a couple of seconds between them even with rotation.
- **A 406 means no User-Agent.** Always send one.
- **Empty result is usually the bbox**, not missing data. Widen it before concluding a resort has no lifts mapped.
- **`around:` takes a coordinate list**, not just one point: `way["aerialway"](around:4000,LAT1,LON1,LAT2,LON2,...)`. One request then covers fifty resorts instead of fifty requests covering one each. This is the single biggest thing you can do to stay off the public endpoint's bad side, and it is how `lifts_batch.py` and `verify_mtb.py` work.
- **Do not regex names across a whole country.** `area["ISO3166-1"="DE"]->.a; nwr["name"~"Foo",i](area.a);` reads plausible and times out - it scans every named object in the country. Anchor the search to `around:` a candidate coordinate instead, or accept that this rung is slow and run it for a handful of names at most.
- Elevations come from `api.opentopodata.org` (mapzen dataset), 25 points per request. It is a free service - do not hammer it.
