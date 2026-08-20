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
python3 gpstraces.py 47.815,7.94,47.83,7.96   # public GPS traces, when nothing is mapped
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

### The Overpass-free path - when every mirror is down

Every rung above needs Overpass. Some days it is simply not available: on 2026-08-17 a 17-box worldwide sweep returned **2 boxes in 15 minutes**, everything else 504/429/timeout, and `find_named.py` was managing about one candidate every five minutes. Do not sit and retry. Switch to this pipeline, which touches Overpass **not at all**:

**1. Web-search the park first.** This replaces rung 2 - it is what establishes the place is real, is gravity or trail-centre riding rather than XC, and is still operating. Do this _before_ geocoding, so you never spend a lookup on a park that does not qualify. It is also the step that does the most work: it killed **Meran 2000** (the resort states downhill riding is not possible), **Filthy Trails** (closed by the Flemish nature agency), **Snowbird** (no lift-served bike operation that season) and **Berkshire East** (which _is_ the already-present Thunder Mountain Bike Park). Keep the source URL - it becomes the `<i>Source:</i>` line in the description.

**2. Nominatim for the coordinate.**

```bash
curl -s -H 'User-Agent: alpine-mtb-map/1.0' \
  'https://nominatim.openstreetmap.org/search?q=Birches+Valley+Forest+Centre&format=jsonv2&countrycodes=gb&limit=3'
```

`jsonv2` returns **`osm_type` and `osm_id`**, so the result is a real OSM object - which is what keeps the "traceable to an OSM object" rule intact even though no Overpass query ran. Rate-limit yourself to one request per second; it is a free service with a strict policy.

**3. `api.opentopodata.org` for the altitude**, which is a separate service and stays up when Overpass does not. The `mapzen` dataset takes **90 points per request** when you pipe-join them, far more than the 25 the elevation helper uses:

```
https://api.opentopodata.org/v1/mapzen?locations=52.7522,-1.9738|54.2785,-0.6883|...
```

#### Reading the Nominatim result, because it fails silently

The warning above still applies in full - **Nominatim returns the wrong place rather than nothing.** Two checks catch it, and both are mandatory:

- **Read `display_name`.** `Mechi Chal` resolved to a Varna suburb 300 km from Chepelare; `Woodys Bike Park, Lanivet` resolved to the **Lanivet Inn**, a pub. That one was dropped rather than pinned.
- **Read the altitude from step 3.** It is the same sanity check the lift queries get. A Scottish trail centre at 9 m or an Australian park at 22 m means the geocoder found a car park in the wrong valley.

When the query misses, retry with a **nearby named feature instead of the park name** - the village, the trailhead, the visitor centre, the access road. `Aston Hill Bike Park` missed three times and `Wendover Woods` hit; `Mystic Mountain Bike Park` missed and `Bright, Victoria` hit. A village-centre or resort-centre proxy is acceptable, but then say so: give the spot the same `<small>` caveat the gazetteer-sourced spots carry, rather than implying you pinned the trailhead.

Finally, **write each batch to its own file.** A geocode script that overwrites one output path will silently destroy the previous batch when you re-run it for the misses; a 31-row batch had to be re-fetched for exactly this reason.

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

### The public GPS trace archive - use it at natural spots, skip it at bike parks

`trails.py` queries tagged **map objects**. OSM also holds a second, quite separate database - the **GPS traces** people upload, raw and uncurated. `gpstraces.py` reads it.

**The verdict, from testing five spots, is a clean split:**

- **Natural, pedal-access, locally-built terrain: try it.** At Cousimbert two traces between them covered **Sur Martou, La Joux de Treyvaux and Belle Cierne** - three of the five lines on that spot - to within 25 m. Everything this map wants was sitting in the archive.
- **Lift-served bike parks: do not bother.** Todtnau, Les Gets, Morzine-Pleney and Châtel returned nothing usable between them. Gravity riders upload to Strava and to the platforms this project does not cite; they have not uploaded to OSM in fifteen years.

The reason is who uses the archive. It skews old, and towards hikers, ski-tourers, trail runners and cyclotourists - exactly the people who also walk and ride the unsigned local trails that no park operator publishes a GPX for. So it fills in precisely the gap the Sugarloaf precedent otherwise leaves bare.

```bash
python3 gpstraces.py 47.815,7.940,47.832,7.960                     # what has been ridden here
python3 gpstraces.py 47.815,7.940,47.832,7.960 --near 7.952,47.821 # sort by distance from the lift top
python3 gpstraces.py --trace 12004364                              # length and profile
python3 gpstraces.py --trace 12004364 --emit                       # <coordinates> block
```

**Two endpoints, and the difference is the whole trick.**

`api/0.6/trackpoints?bbox=W,S,E,N&page=N` is the search. Public, no auth, 5000 points per page - keep paging until a page repeats. It hands back `lat`/`lon`/`time` and **strips the elevation**, so it is only ever a way to find out _which_ traces exist.

`https://www.openstreetmap.org/trace/<id>/data` is the download, and it returns the **original uploaded file**: full precision, every point, and `<ele>` on all of them. Note the host - this is the website, not the API. The documented `api/0.6/gpx/<id>/data` returns **401 Couldn't authenticate you** without OAuth, so use the `/trace/` URL.

"Original uploaded file" is literal: much of the archive predates the web form, so a large share of it arrives **bzip2, gzip or zip compressed** - 9 of 16 downloads at Les Gets were bzip2, regardless of the `.gpx` in the URL. An XML parser reports those as `not well-formed: line 1, column 7`, which reads like a corrupt trace rather than a compressed one. `gpstraces.decompress()` sniffs the magic bytes and handles all three.

Bounding boxes go in as `S,W,N,E` like every other script here; the API wants `W,S,E,N` and `gpstraces.py` converts. The API caps a bbox at 0.25 square degrees.

**Read the privacy level before you read the geometry.** A trace's usefulness is decided entirely by what its owner chose on upload:

| Level | In the bbox response | Usable? |
| --- | --- | --- |
| identifiable / trackable | its own `<trk>`, with `<name>`, `<url>` and timestamps | yes - and `<url>` gives you the id to download in full |
| trackable, anonymised | its own `<trk>`, timestamps, but no name or url | geometry only, and no elevation, ever |
| public / private | dumped into shared anonymous `<trk>` blocks of 5000 points **in no order at all**, with no timestamps | no |

That last row is the trap. Those blocks look exactly like the others in the XML, and chaining one produces a plausible-looking `<coordinates>` list that is actually a scribble across the whole valley - at Todtnau it measured **1861 km inside a 2 km box**. `gpstraces.py` detects them (no `<time>` on any point), reports them as "unordered pool (unusable)" and hides them from the listing. Do not undo that.

#### How to pick the right trace: sort by distance, then read the filenames

**This is the whole method, and it is embarrassingly simple.** Point `--near` at the top of the descent, and read the first ten filenames.

```bash
python3 gpstraces.py 46.670,7.130,46.730,7.220 --near 7.1872,46.6971
```

```
    5 m     4.24 km    644 pts     2808981 x_fma_x     2018_09_20_Cousimbert.gpx
   14 m    11.44 km   1737 pts     3897510 fangly      2021_10_30_09_31_Sat_sur_martoux.gpx
   15 m     9.43 km   3237 pts     3320863 ch_de_75    20200530_Trail_Torryboden_LaBerra.gpx
```

`sur_martoux` is **Sur Martou**. Download those two and check them against what is already drawn:

```
trace 2808981:  covers 100% of  La Joux de Treyvaux
                covers  92% of  Belle Cierne
trace 3897510:  covers 100% of  Sur Martou
```

Filename and proximity did all the work. A person who names a file after a trail rode that trail.

#### Do not build a physics filter. It was tried, and it finds skiers.

The tempting idea is that a gravity run has a signature - big drop, steep gradient, riding speed - so `tracefilter.py` was built to look inside each **downloaded** trace for a descent window of **250 m or more of drop, at 6 % or steeper, over at least 1 km, at 8-45 km/h**, closing the window as soon as the rider climbs 30 m back above their low point.

It works mechanically and it is useless. **It fails in both directions.**

_False positives at bike parks_, because a skier and a downhill rider have the same signature - same lift, same 500-700 m drop, same 12-25 km/h, same gradient:

| Park | segments in bbox | downloadable near the lift top | passed the filter | actually MTB |
| --- | --- | --- | --- | --- |
| Todtnau | 80 | 18 | 0 | 0 |
| Les Gets | 62 | 16 | 3 | 0 |
| Morzine-Pleney | 75 | 13 | 5 | 0 |
| Châtel | 61 | 5 | 1 | 0 |

Every hit was February or March - `morzine20100314a1`, `2012_02_23 Skiing Portes du Soleil`, `2013_03_28_Chatel_ski`. The one summer hit was a road ride in from Lake Geneva. Add a month test to kill the skiing and all four parks return **nothing at all**.

_False negatives at natural spots_, which is worse, because that is where the archive actually delivers. **The filter rejects the Cousimbert traces that hold all three trails.** They average 7.5 km/h, well under the 8 km/h floor - because at a pedal-access spot the climb is in the same file as the descent. Filter on mean speed and you throw away the only good data in the archive.

Two more traps from the same experiment:

- **Speed does not identify riding.** At Todtnau 56 of 80 segments sustain over 15 km/h, because the B317 runs up the valley and cars are in the archive too.
- **Concatenated archives.** `alle_Wandertracks.gpx`, `Alle_Biketracks.gpx`, `activities.zip` - somebody's entire history in one upload, 170 km, jumping between valleys. Length is not a quality signal.

`tracefilter.py` is kept as the record of this, guarded under `__main__`; re-running it takes about fifteen minutes. Judge by **what the trace is**, the same test rung 2 uses, and verify by hand before anything becomes a line.

`--trace` prints `(STORED UPHILL - reverse it)` when the net drop is negative. Believe it - the renderer draws direction arrows from point order, and at natural spots this fires often: the Cousimbert file holding La Joux de Treyvaux and Belle Cierne is stored as the climb.

A trace that covers a descent usually contains the climb to it as well, so **slice before you simplify**. Cut at the high point, keep the descending half, and only then run it through the 8 m simplification.

Credit these as **`Geometry simplified from OpenStreetMap GPS trace <id> (ODbL)`**. They are ODbL like the rest of OSM. Never credit an anonymised trace to a user.

### Last resort - inferring descents from the hiking-path network

**Only where riding on hiking paths is authorised.** Check before you run it, and if the answer is no or unclear, stop - a line drawn across a footpath where bikes are banned is worse than a blank region.

Reach for this only when everything above has come back empty: no `leisure=bike_park`, no `sport=mtb`, no `route=mtb`, no `mtb:scale`, and a GPS-trace archive holding nothing but hiking, bus and touring logs.

```bash
python3 descents.py 35.08,-5.40,35.32,-5.08 --town -5.2636,35.1688   # rank candidates
python3 descents.py 35.08,-5.40,35.32,-5.08 --emit 235450022         # <coordinates> block
```

`descents.py` pulls every `highway=path` and `highway=footway`, drops the urban noise, samples **every node** against the mapzen DEM, chains what connects, and ranks chains that only ever descend. It prints a verdict per candidate, and the rejects matter as much as the keeps.

**The urban filter is not optional.** These regions are famous for their old towns, and a medina paved in `sett` generates hundreds of short footway ways that swamp the ranking. Dropping paved surfaces plus unsurfaced footways within 1.5 km of `--town` narrow down results.

#### The band, and the line that proves gradient is not the whole test

Judge on the **median gradient over 200 m windows**, not the average over the whole line. DEM noise makes a window median read a few points below the same line's end-to-end average, so compare against these numbers, not the headline figure.

| Median      | Read as                                      |
| ----------- | -------------------------------------------- |
| under 10 %  | valley track - not gravity                   |
| **10-22 %** | **a graded mule path. The band that works.** |
| over 22 %   | **a question, not a reject** - see below     |

Everything in the band at Chefchaouen had **zero** windows over 35 %, which is the signature of a path built for laden mules rather than a scramble.

**Above the band, the deciding test is sustained versus stepped, not the average.** Orange on this map is the "harder than black" slot and it already holds Verbier at 25 % and Whistler at 29 %, so a steep median puts a line in that slot rather than out of the map. Split it on the fraction of windows over 35 %:

- **sustained** - few very steep windows, and it never climbs - is an extreme line. Draw it orange.
- **stepped** - a third or more of the windows over 35 % - is a scramble. Bin it.

The **Jebel Tissouka** path is the worked example, and the first pass got it wrong. It drops **1316 m in 4.75 km at 28 %**, which read as an obvious hike-a-bike and was rejected. Looking properly at the distribution: 22 windows, median 28 %, quarter over 35 %, two over 40 %, and **zero that climb**. That is sustained fall-line steepness, which is exactly what orange is for. It is now the biggest descent on the Morocco side of the map.

**Then check access, because that is the real constraint on a steep line.** Query `way[highway~"track|unclassified|tertiary"]` around the top and get the elevation of the nearest track end. At Tissouka nothing drivable reaches the 2099 m start: the closest track dies at about 1295-1330 m near Azilane, 2.4 km north, leaving 770 m of pushing, and pushing up the descent itself would be the full 1316 m. That does not disqualify the line, but the spot text has to say it - a descent you earn is a different product from a shuttle lap.

Also read **point spacing**, which the script prints: 10-38 m means somebody walked it with a GPS, 70-80 m means it was traced off low-zoom imagery. Keep the coarse ones if the profile is clean, but say in the description that the exact course is approximate.

#### The wording is not optional either

These lines have **never been recorded as ridden by anybody**. This is a different provenance tier from every other spot on the map, and it must not blur into the normal "geometry from OpenStreetMap" phrasing. Every line gets, in bold, at the front:

> **Not a known bike trail:** this is a mapped mountain path, picked out of the OpenStreetMap path network because its profile descends steadily at a rideable gradient. Nobody has recorded riding it.

and the spot gets a `p.warn` block plus a `<small>` paragraph stating the method, the counts and what was rejected. A 30 m DEM cannot see steps, gates, cliffs, scree or a locked barrier. It only shows that the ground trends downhill at a plausible angle.

**Name the lines by reverse geocoding, never by guessing.** Nominatim `reverse?...&zoom=14` on each endpoint returns the real locality - Ain Tissimlane, Bab Aorgas, Izrafene, Oued Farda. An early guess that the best Chefchaouen line started on Jebel el-Kelaa was simply wrong; it starts at Ain Tissimlane, 2 km away.

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
