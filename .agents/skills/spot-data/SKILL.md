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
python3 parkruns.py 42.52,1.45,42.60,1.56     # bike park: group name-fragments into runs
python3 relruns.py  45.14,6.63,45.19,6.68     # French park: route=mtb relations with a colour
python3 napark.py 47.48,-116.18,47.56,-116.08 --poly way/1263732068   # NA park: no bike tags
python3 napark.py 46.96,-71.44,47.00,-71.39 --poly way/1539135188 \
    --grades "Nosferatu=orange,Valkyrie=black"   # grades from the operator's map, not OSM
python3 gpximport.py ../../../../tmp/himalaya --pin 83.7305,28.78381  # supplied gpx.studio traces
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

### The worklist - `TRACES-TODO.md`

`TRACES-TODO.md`, beside this file, is the tracking table of **every spot that still has 0 or 1 line**, split into Europe / North America / Rest of the world and ordered by rough priority. Read it before starting a trace hunt: it says which spots have already been searched in OSM, which have had their operator site checked, and what came back empty and why (name-only chains, ski pistes tagged `bicycle=no`, Trailforks-only networks, duplicate pins).

Keep it current in the same edit as the KML:

- Tick **OSM search** or **Web search** with `✅` only for a search actually run that found nothing usable. Anything found goes into the KML, not into a tick.
- Fill the **Comments** cell with the negative result and the reason - the URL that 403s, the tag that turned out to be a ski piste, the name match that was a different valley. A comment saying what _not_ to retry saves a whole sweep.
- Update **Traces** when lines are added, and **delete the row once most of the network is drawn** - judge by the network size, not a threshold (8 signed trails and 7 lines is done, a 40-trail park with 6 lines is not).
- New spots added to the KML without geometry get a new row.
- The file was generated by counting `<spot base name>: <trail>` line placemarks per pin, so it can be regenerated the same way if it drifts.

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
  <ExtendedData xmlns:mwm="https://comaps.app">
    <mwm:properties>
      <mwm:value key="spot">somewhere</mwm:value>
      <mwm:value key="tags">expert</mwm:value>
    </mwm:properties>
  </ExtendedData>
</Placemark>
```

Trail lines get no `mwm:icon` block - only points do.

**The facets are `mwm:properties`, never plain KML `<Data>`.** CoMaps' parser has no handler for `<Data name="...">` at all - its only match is `mwm:value` with a `key` attribute, nested exactly `Placemark > ExtendedData > mwm:properties` (`libs/kml/serdes.cpp`). A facet written as `<Data>` is silently dropped the moment a reader imports the file into CoMaps or Organic Maps and exports it again. `<ExtendedData>` therefore always carries `xmlns:mwm="https://comaps.app"`, including on trail lines. `togeojson` is the other way round - it understands `<Data>` and not `mwm:properties` - so `toGeoJson` in `src/lib/kml-export.ts` lifts the facets into the GeoJSON by hand.

### When it refuses

```
relation 7648377 ("Piste des Biquettes") does not chain into one line:
649 m gap between members.
```

Relation members arrive in no order and no consistent direction. The script chains them nearest-end-first and tries both orientations of the first segment, but a **circuit or a branching network cannot become one line** - forcing it draws a straight bar across the mountain. That is what the refusal prevents.

When you hit it: pick a single `way` instead, find a relation that is one genuine descent (`Alpages Respect`, relation 17656035, chains cleanly), or pass `--force` and delete the bad segment by hand. Always re-check the drawn line in `vp dev` afterwards.

### At a bike park, group the name-fragments before concluding anything

`trails.py` lists one row per OSM object, and a bike park is almost never mapped one object per run: a signed trail arrives as three to five short ways that all carry the same `name`. The listing then reads `0.4 km Furious`, `0.2 km Route 66`, `0.5 km Wood Park` and the park looks unmapped. It is not.

**Pal Arinsal is the case that proves it.** `TRACES-TODO.md` had it at one line. The bbox holds 84 bike-tagged ways, which group into **24 named runs, 22 of which pass the drop test** - Commençal Inferior 3.7 km / 514 m, Cubil 1.8 km / 268 m, 2008 (black) 1.3 km / 260 m. Nothing new had to be mapped; nobody had grouped by name.

```bash
python3 parkruns.py 42.52,1.45,42.60,1.56 --all      # the runs, with the rejects
python3 parkruns.py 42.52,1.45,42.60,1.56 --emit \
    --spot pal-arinsal-bike-park --prefix "Pal Arinsal" \
    --tags "bike-park dh enduro freeride gondola" --skip 225328888
```

What it does differently, each point learned the hard way at Pal Arinsal:

- **Selects on `name` + `bicycle=designated`** (or `destination`), not on mtb tags. That pair is the bike-park signature; operators' runs carry it even where `mtb:scale` and `colour` are absent, and the hiking network in the same bbox does not. Boschendal's estate trails were found the same way, so this query is now the default for parks.
- **Groups on the accent-stripped casefold.** `Commençal Superior` and `Commencal Superior` are one trail in OSM and were two rows before.
- **Chains at both ends.** `trails.py`'s `chain()` only appends to the tail, so a fragment belonging _before_ the current start is deferred and reported as a kilometre-scale gap: Commençal Superior read 6.2 km with a 1583 m gap and looked unusable, when it is 3.9 km with none. `chain_both_ends()` is in `parkruns.py`; `trails.py` is untouched.
- **Clusters at 150 m and emits `(section N)` top-down** rather than forcing one line, which is the Rychleby SuperFlow pattern.
- **Orients downhill from the DEM** before the drop test, so a fragment mapped uphill does not read as a climb.
- Colour maps to the map's styles and levels; `mtb:scale` is never read as a colour. Ungraded runs go out on `#line-trail` with the scale stated in the text.

Always re-check the drawn lines in `vp dev` afterwards, and grep the KML for each incoming name first - a spot with one line already has a name to collide with.

**When the ways carry no bike tag at all, the operator's PDF map set is the classifier.** SilverStar's 60 park runs are bare `highway=path` + `name`; so are its XC trails and its hiking trails, on the same hillside. No tag filter separates them. What does: `cms.skisilverstar.com` publishes the downhill, cross-country and hiking maps as PDFs, and the **cross-country map carries a complete trail-length table** - a name in that table is XC, and Brian's, Eric's, Cabin Trail, Silver Shack, Corkscrew, Chakra, Crack of Dawn, Grizzly Adams, Snake Pit and Paradise all left the shortlist that way. The resort website itself is JS-gated and returns nothing to WebFetch; the PDFs on its CDN are static. Find them by loading the summer/winter maps page in the browser pane and reading the `href`s:

```bash
# in the browser pane, on the resort's maps page
[...document.querySelectorAll('a')].map(a => a.href).filter(h => /pdf/i.test(h))
```

PDF text extraction needs no tooling: the label text is in the content streams, so zlib-inflate each stream and pull the `(...)` strings. Two traps - the type is letter-spaced (`W orld Cup`), so **strip all whitespace before matching a name**, and a legend that only names trails inside "Access to ..." labels is not the full trail list, so absence from it proves nothing.

### "Freeride" in a name is not evidence of mountain biking

Twice in the 2026-08-25 sweeps a `name~freeride` selector returned **winter ski** features that would have gone onto a bike map as gravity runs:

- `Freeride du Roc Blanc 1` and `2` at Areches-Beaufort - `piste:type=downhill` + `piste:difficulty=freeride`, i.e. off-piste skiing.
- `Freeridecross` x8 and `Freeride 2` at Sudelfeld (Bayrischzell) - `piste:type=downhill` and `piste:type=snow_park`. The resort's own page calls it a "freeride cross course" in the Actionwelt, next to the snow park. It is boardercross. The whole candidate spot was dropped on this.

**How to apply:** a name-regex hit is a lead, never a line. Before drawing anything found by name, fetch its tags and require a bicycle signature - `bicycle=designated`, `highway=path|cycleway`, `mtb:scale`, `mtb:type`, `oneway=yes`. Bikepark Katzenkopf passed that test on the same day (`bicycle=designated highway=path oneway=yes mtb:scale=1`) and is real. `piste:type` with no bicycle tag is the winter mountain.

Note this cuts the opposite way in North America, where operators sign bike runs down their ski pistes - see `napark.py --pistes` below. The rule is the same in both directions: read the tags, do not read the name.

### In the French Alps the runs are relations, so use `relruns.py`

`parkruns.py` groups **named `bicycle=designated` ways**. French Alpine resorts do not tag that way: each signed run is a **`route=mtb` relation carrying a `colour`**. Running the way script on Valfrejus, La Norma or Aussois returns nothing at all, and the resort reads as unmapped when it has a fully signed, fully coloured network. `scripts/relruns.py` is the relation-side twin - same clustering, both-ends chaining, DEM orientation, drop test, colour-to-level map and output shape, sourced to the relation id.

```bash
python3 relruns.py 45.14,6.63,45.19,6.68 --all         # the runs, with the rejects
python3 relruns.py 45.14,6.63,45.19,6.68 --emit \
    --spot valfrejus --prefix "Valfrejus" \
    --tags "enduro dh chairlift gondola" --skip 19421483
```

- **`out tags geom;` on a relation returns tags and an EMPTY member list** - the geometry modifier is silently dropped. It has to be two passes: `out tags;` to pick the ids, then `relation(id:a,b,c); out geom;` in batches of 60. Filtering by name and colour in between also keeps the geometry pass small, because the touring loops are far longer than the park runs.
- **`colour=purple` is a climb.** French resorts sign the pedal-up links purple (`Montee enduro d'Aussois`, `Montee Enduro - La Norma`). Dropped before the DEM is queried.
- **`route=mtb` covers the whole marked network, not just the park.** `Le Tour de la Setaz`, `Boucle des Tourbieres`, `Liaison Woodstock`, `Les Trois Croix depuis Valmeinier` all come back beside the runs. Names starting Tour/Boucle/Liaison/Circuit/Sentier/Itineraire/Rando/Montee/Traversee are skipped, and what survives still has to clear the drop test. At Valloire that is 14 relations down to 5.
- **A resort can use both conventions at once.** Valloire's marked itineraries are relations, but its actual DH runs - `DH 28 The Wood`, `Mickael Pascal`, `Copies`, `Piste des Buissonets` - are named ways, and Pralognan's `DH du Genepi` and Areches' `Freeride du Roc Blanc 1/2` are too. Run **both** scripts on a French park and dedup, or you will ship the blue tour and miss the black.

**The elevation cache is shared across bboxes now, and flushed every chunk.** It used to be keyed on the bbox string and written only at the end, which meant neighbouring resorts re-paid opentopodata's rate limit for the same points - Valloire and Valmeinier share a ridge, and La Norma, Valfrejus and Aussois sit in one 20 km stretch of the Maurienne - and a run that 429'd at chunk 120 threw away all 120. `descents.elevations` now reads `ele-cache-shared.json` plus any legacy per-bbox file and writes the shared one after every chunk, so a killed sweep resumes where it stopped.

### `mtb:scale:imba` IS a grade - and other lessons from the second North American ten

**`mtb:scale:imba` is a difficulty scale; `mtb:scale` is a technical-terrain scale. Read the first as a colour, never the second.** Coldwater Mountain (Alabama) is the case that makes it worth stating: every trail in that Forever Wild system carries `bicycle=designated` + `mtb=designated` + `mtb:scale:imba`, most also `oneway=yes`, and the IMBA numbers map straight onto this map's styles - 1 green, 2 blue, 3 black. That gave eight fully graded lines with no operator PDF involved. Canmore's Top Gun and Bend's Mrazek were graded the same way. `mtb:scale` stays out of the colour decision.

**Filter the dump to bike-designated ways before the DEM pass.** Canmore's bbox returns **659 named ways** and Phil's Trail 213; the elevation lookup for that many groups takes minutes and times out a foreground call. Filtering to `bicycle=designated` / `mtb=designated` first cut Canmore to 26 runs and Phil's to 32, and nothing that could legitimately be a bike line was lost. At a big XC venue this is the difference between a tractable analysis and none.

**A `description` tag can settle a name the tags otherwise cannot.** Blue Mountain (Ontario) has 193 named ways across four stacked ski clubs. Three of the operator's bike names exist in OSM as `route=hiking` + `sac_scale=hiking`, and one - Roller Derby - carries `description=Downhill Bike Trail`, `bicycle=yes`, `foot=no`, `access=permit`. That single free-text tag was the whole classifier.

**The shared naming theme is a trap, and the import batch breaks it.** Greek Peak names its ski runs _and_ its bike trails from Greek mythology: Castor, Olympian, Iliad, Alcmene, Odyssey, Trojan, Poseidon, Hercules, Marathon, Mars Hill are winter; Nemesis, Spartan, Medusa, Thanatos, Trident, Labyrinth are the bike park. Nothing in the tags separates them - both sets are `piste:type=downhill`. The OSM import batch does: the bike trails are all `1465226xxx`/`1465241xxx`, the ski runs are older ids. Same signal that worked at Silver Mountain and Big White.

**`area=yes` on a piste means it is a polygon, not a line.** Beech Mountain has each ski run mapped twice, once as a way and once as an `area=yes` face. A polygon chained as a run draws a closed blob. Worth excluding explicitly when a resort's piste count looks suspiciously doubled.

**`man_made=cutline` + `cutline=piste` is a ski clearing, not a path.** Five of Mont-Comi's nineteen named ways are tagged this way, with gradients up to 37% that make them look like prime gravity lines. They are the cut swathes through the forest.

**Two networks in one bbox: name the one the pin belongs to.** Beech Mountain returns the resort's lift-served ski runs _and_ the Town of Beech Mountain's Emerald Outback, which is genuinely `bicycle=yes` + `highway=path`. The Emerald Outback is real riding and it is not the bike park the pin marks; drawing it there is the Highland Mountain fabrication error with extra steps. Say which network OSM actually holds in the row.

**Closing a row on terrain is a legitimate outcome, and it reads differently from closing it on sources.** Phil's Trail Complex is _fully_ mapped and properly bike-tagged - 44 bike-designated ways, 28 with IMBA grades, every classic name present - and only two of 32 runs clear the drop test, because the Bend pine flats sit at 1-3%. DuPont is the same shape on a waterfall plateau. Write "closed on terrain, not on sources" so the next pass does not re-sweep looking for a better source that does not exist.

**When two spots share a name, check the line prefix.** Blue Mountain (Ontario) and Blue Mountain (Pennsylvania) are both on this map, and the Ontario grey waypoint was called `Blue Mountain Bike Park: top of the Comet chairlift` - the same prefix as Pennsylvania's 22 lines. Renamed to `Blue Mountain Ontario:`. Grep the prefix before emitting at any spot whose name is not unique.

**Duplicate coordinates are worth a periodic sweep, and not every one is a duplicate pin.** A `Counter` over every `<Point><coordinates>` found three grey waypoints sitting on their own spot's blue pin. One (`7 Laux: Prapoutel 1350`) was a pure copy and was deleted; the other two were placeholders whose **own bold header named a different place** than their coordinate - `Lenzerheide: Lai Canols` described "Parpaner Rothorn 2861 m - top of the Rothorn gondola" while sitting at the 1500 m valley station, and the Les 2 Alpes one claimed the Venosc side bottom while sitting in the village. Both got their real coordinates (Rothorn 2 top at 2837 m; Venosc gondola base at 963 m) rather than deletion. **Read the header against the coordinate, not just coordinate against coordinate.**

### The top ten European rows: what an honest zero looks like

The 2026-08-21 sweep of the first ten Europe rows produced **no new lines at all**, and that is the result, not a failure to try. Nine of the ten are genuinely absent from OpenStreetMap; the value was in two corrections, one merge and two pins. Recognise these shapes so the next pass does not re-spend the queries.

**`bicycle=designated` is not the European signature everywhere.** `parkruns.py` returned 0 usable runs at Bovec, Ferme Libert, Hovden, Sherwood Pines, Saint-Lary, Peyragudes and Tajare. It is the Andorra/Alps park signature, not a continent-wide one. Reach straight for the named-way sweep and the `route=mtb` relations outside those regions.

**Cache the Overpass response, not the summary.** Overpass was returning 429/500/502/504 from all four mirrors for most of this session, and `fetch()` costs up to ten minutes per query when it has to walk the whole mirror list twice. One query per spot, dumped to JSON on disk, then every grouping, chaining, drop test and re-think runs offline. This is what makes it affordable to change your mind about a bbox or a filter. `parkruns.collect` is a module-level hook, so pointing it at a cached element list instead of the network is a three-line monkeypatch.

**Buffered stdout hides a background job's progress.** A backgrounded `python3` writing to a file shows its stderr immediately and its `print()` output only at exit, so a long sweep looks stalled while it is actually working. Run it as `python3 -u`, or the monitor watching the output file will fire nothing for ten minutes.

**Check the north (or high) edge of the bbox at any resort whose lifts reach far above the pin.** Bardonecchia's first bbox stopped at 45.10 and cut off Jafferau at 2800 m; Saint-Lary's stopped at lon 0.27 and cut off the 1700-2215 m park zone west of the village. Both had to be re-run. Cheap fix: get the lifts first and let their endpoints set the box.

**A `colour`-tagged `route=mtb` relation is not proof - fetch its members.** This is the sharpest trap of the batch. Bardonecchia's bbox returns `La Dejantee` (`colour=red`, `mtb:scale=3`) and `Montee enduro Arrondaz` (`colour=purple`), which is exactly the French convention working. Their member ways are **Place des Bergers** and **Rue des Bettets** - village streets in Valfrejus/Modane, on the other side of the border. The four `network=lcn` relations in the same box are French cycle-touring loops. `Montee` is a climb besides.

**`out tags geom` on a relation returns neither members nor member geometry.** It gives you the tags and an empty `members` list, which reads like an empty relation. `relation(ID); out; way(r); out tags geom;` is the form that carries the ordered member list _and_ the geometry.

**A route relation that exists, is named and carries a colour can still be undrawable.** Sherwood Pines has all four of its routes as `route=mtb` relations - Outlaw Trail `colour=red` `ref=Red Route`, Viking Trail `ref=Blue Route`, Family Cycle Route `ref=Green Route`, Bike Park & Downhill Route `mtb:type=downhill`. Chained in member order the red route measures **26.3 km against the operator's 13.5 km, with 13 gaps over 150 m and a 2.2 km maximum**: a branching network with shared and alternate sections, not one line. The length disagreeing with the operator's published figure by ~2x is the tell - check it before you emit. Sherwood is also flat (51-116 m over the whole forest), so it is a Valmont-style not-applicable as well.

**Read the tags before you trust an inherited line - `incline=up` is the giveaway.** `Saint-Lary Bike Park: Pales` had been on the map as a park run. Way 325084989 carries `incline=up`, `mtb:scale:uphill=2`, `sac_scale=mountain_hiking` and `horse_scale=demanding`, and runs 868-916 m in the village, while the park is 1700-2215 m. Deleted. A line whose altitude band does not overlap the park's is wrong no matter how plausible the name looks.

**A grade nothing supports is worse than no grade.** Hovden's single line was `#line-red` with no grade sentence at all. OSM gives it only `mtb:scale=2` (never a colour here), the OSM name is literally `Downhill Easy`, and the operator signs three trails all of which are blue. Re-graded blue, operator cited, level tag corrected from `intermediate` to `beginner`.

**Merge a duplicate pin before tracing, and keep the better-sourced one.** Peyragudes and Peyragudes-Loudenvielle sat on the identical coordinate. The Loudenvielle placemark had the 2026 N'PY dates and prices, so it survived and absorbed the other's content; the duplicate was deleted after checking no line referenced its spot id. Its pin was on the ridge at 2156 m and moved to the Skyvall gondola valley station at 963 m, with grey waypoints at the Skyvall top (1601 m) and the Privilege top (2228 m).

**Waymarking colours are not difficulty grades.** Tajare publishes six routes as "Percorso VIOLA / AZZURRO / VERDE / GIALLO / BLU / ARANCIONE". Those are trail-marker colours on XC loops; the park's gravity trails are named separately (ROCHASUN, YETI, DAHU, MASCA, DH FUNSE). Mapping VIOLA onto a purple expert grade would invent a difficulty the operator never claimed.

**An unextractable operator asset ends the row; a text-extractable one banks the classifier for later.** Bardonecchia publishes a raster JPG, Bike Park Bovec nothing, Ferme Libert describes its lines by type ("Downhill-Hauptstrecke", "Freeride-/Jump-Line") and says exact names are on-site only. Against that, Peyragudes' 2026 PDF is fully text-extractable and yielded all 21 trail names, and Forestry England's Sherwood map yielded Maid Marion / Robin Hood / Outlaw. Write those name lists into the row even when there is no geometry - the day somebody maps it, the hard half is done.

### At a North American resort, look for the runs among the ski pistes

The 2026-08-21 sweep of the top ten North American rows found that `parkruns.py` returns **zero** at most of them: the `bicycle=designated` signature that works across Europe and in Andorra is simply not how the continent is tagged. Two conventions replace it, and both need a different query.

**Convention one - bare `highway=path` + `name`.** SilverStar and Silver Mountain are mapped this way. `scripts/napark.py` does this: it selects every named path-like way in the bbox (`path|track|cycleway|footway|bridleway`), rejects `bicycle=no`, then groups and chains with the `parkruns` machinery. Silver Mountain gave **34 runs** from a row that read "0 traces": Wildcat 3.3 km, War Gerbil 2.9 km, Crescent 2.2 km, Snake Pit 239 m of drop in 1.4 km.

**Convention two - `piste:type=downhill`.** This is the one that will bite you, because the obvious filter is wrong. Sugarbush signs its bike park down its **ski trails**, and OSM holds them only as ski pistes; a sweep that excludes `piste:type` - the sensible default, to keep winter runs off a bike map - throws the entire park away and reports the resort as unmapped. Fernie does the same for Summer Road and Cedar Trail. Pass `napark.py --pistes` to include them, then classify by name, and **say so in the description**: the line is the ski corridor the operator signs as a bike run, not a separately mapped trail.

**The operator's own trail list is what classifies them, and a live trail report beats a map PDF.**

- `skifernie.com/conditions/trail-report/` renders all 39 Fernie bike trails as plain text, grouped **Elk side / Timber side / base-area XC**. That grouping is a better fence than any legend, because it is the operator separating the park from the XC network. Its bike map PDF 404s and its summer page carries no names at all.
- Sugarbush's summer map PDF is text-extractable and carries the full **numbered** list (1 Valley House Traverse, 2 Reverse Traverse, 3 Lower Jester ...). That list admitted seven lines and rejected Jester, Castlerock Runout, Racer's Edge and Out to Lunch, which are ski-only. It also carries `NO BIKE ACCESS ABOVE THIS POINT` over Castlerock - read the map's own prohibitions.
- Boyne Mountain's two PDFs are **raster**. No text, so no classifier, so nothing was drawn even though three ways clear the drop test. A hill with no published name list is a stop, not a guess.

**The `winter_sports` polygon is a strong fence at some resorts and a useless one at others - check before you trust it.** At Fernie (way 1388612283) it is decisive: every Montane, Ridgemont and Mt Fernie name reads 0% inside and 2-4 km out, and every park run reads 100%. At Silver Mountain (way 1263732068) it covers only the upper mountain, so half the park reads 0% inside and the fence would have cut the run count in half. Report the inside-fraction **and** the distance from the pin, and read them together.

**When OSM has the geometry but not the grades, the operator's legend supplies them - and then the "no grade" sentence has to go.** Empire 47 (Lac-Delage, Quebec) is the clean case: `leisure=sports_centre` way 1539135188 fences the whole site, every one of the 55 named groups inside it reads **100% in**, and 20 clear the drop test - but not one carries `colour` or `mtb:scale`. The grades are only on the operator's summer map PDF, whose legend is text-extractable and lists each trail under its category. Pass them in with `napark.py --grades "Name=blue,Other=orange"`: that sets the colour, implies `--only` (so the graded names are exactly what gets drawn), and replaces `OpenStreetMap records no grade for it` with `--grade-note`. Never leave that sentence on a line whose colour you assigned yourself - a coloured line that also claims OSM has no grade is self-contradicting, and it is the one defect a reader will spot.

**Read the legend's category labels as trailing, not leading, and prove it before you believe it.** In the Empire 47 PDF the content stream is `[numbers][lengths][names][category label]`, so each label belongs to the block **above** it. Three independent checks agreed, and any one alone would have been a guess: the last label is `Zone Evolution 47` followed by `LEGENDE / MAP KEY`, which is only coherent if labels trail; the measured gradients come out monotone by category (Intermediaire 4-7%, Avance 4-11%, Expert 14-20%, Extreme 15-19%) and scrambled the other way round; and the beginner and intermediate counts then match the operator's published totals. A six-step French-Canadian scale maps onto this map as facile/debutant -> green, intermediaire -> blue, avance -> red, expert -> black, extreme -> orange.

**`--pistes` needs its own selector, not a relaxed filter.** The original `napark.py` only ever asked for `way[highway~path|track|cycleway|footway|bridleway][name]` and filtered `piste:type` out of the result. That works at Sugarbush and Fernie, whose pistes carry a `highway` tag too - and returns **nothing but Forest Service roads** at Sunrise Park (Arizona), HoliMont and Mount Kato, where every ski run is `piste:type=downhill` with no `highway` tag at all. `--pistes` now adds `way["piste:type"="downhill"]["name"]` to the union. That one-line change turned HoliMont from 4 named ways into 114 and Mount Kato from 7 into 30, and it is what found Sunrise's two drawable runs.

**A live trail report is the best classifier there is, and three of these ten had one.** Better than any PDF, because the operator is grouping its own trails for its own customers:

- Panorama's `panorama-today/summer-report` groups every trail as **DH Biking** (each labelled Freeride or Technical), **Enduro Biking**, **Fire Hall Trails**, **XC Biking**, **Mountain Hiking** or **Valley Hiking**. That grouping admitted 17 lines and rejected Cox Creek Trail and Lynx Loop (hiking), Alder (XC), Outback Ridge and the Bruce Creek FSR in one read.
- HoliMont's `resources/bike-park-trail-report/` lists 25 bike trails by grade, and settles the row **against** drawing anything: not one of those names is in OSM. Its map PDF is text-extractable but labels bike trails and ski slopes in the same style, so Razorback, Downspout, Twisty Christy, Riley's Cut, Highland Fling, Slow Poke, Early Bird and Grasshopper all read like bike candidates and all exist in OSM - and the report proves they are ski slopes labelled for orientation. **When a map and a report disagree about what a name is, the report wins.**
- Bike Wentworth's trail map splits Climb Zone / Lift Zone / hiking, which is why GUT Trail, Ridge Trail and High Head Trail were not drawn even though High Head clears the drop test at 230 m.

**"Freeride / Technical" and "advanced downhill" are categories, not colours - do not force them onto the colour scale.** Panorama and Valemount both classify their trails in prose, not on a green/blue/black scale. Half of Valemount's descriptions carry a grade word ("intermediate downhill", "beginner-friendly") and half do not ("feature-rich jump line", "all-mountain trail"), so colouring the ones that do produces a spot where half the lines are graded for no visible reason. Emit ungraded on `#line-trail` and quote the operator's own wording in the text instead. `--grades` is for a real legend, the way Empire 47 and Sunrise have one.

**An operator prose guide can classify direction, which no tag and no DEM can.** Valemount is the case: VARDA's guide names 56 trails and says what each one is, and that is the only thing separating a descent from a climb or a two-way link there. It rejected `CBT's Munday Grind` and `CBT Monday Grind` ("climbing trail", 364 m and 178 m of drop - both would have been emitted backwards), `Truck Yeah` and `Rosie Cheeks` (connectors), `Plaid Shirt` and `Casually Cool` ("dual-direction pedal trail"), `M&M (Miserable and Magical)` and `Confused and Lonely` ("climb/descent option") and `Hit the Brakes` ("early exit"). The `Montee` heuristic from Empire 47 would have caught none of them.

**An OSM name that is not on the operator's list is a stop, not a bonus.** Panorama has Upper and Lower No Way Jose in the DH import batch at 542 m and 459 m of drop; Valemount has Green Downhill at 166 m. Neither appears on its operator's current list. They are probably retired names, and they were left undrawn and written into `TRACES-TODO.md` as things to re-check rather than emitted on the strength of the geometry.

**At a park with no operator list at all, `#line-trail` is the honest output, not a reason to skip the park.** Big White's own bike-park and trail-map pages both hand you off to Trailforks, its only artefact is a raster progression chart, and there is no PDF on the site. But its 19 park ways are cleanly separated from the snowshoe network by `piste:type=hike` and by the import batch (`651428xxx` / `977095xxx`), so 16 runs went in ungraded with the missing-grade sentence intact. Say in the **spot** description that the operator publishes no list, so the ungraded lines are explained.

**When a maintainer colours the lines afterwards, the "no grade" sentence has to go with them.** Sentiers du Moulin went in ungraded and was hand-graded in a later pass. 28 of the 31 lines then read `0.9 km trail ... OpenStreetMap records no grade for it` while rendering black - the exact self-contradiction the Empire 47 note warns about. Three things have to change together, and the second is the one that gets forgotten: the length phrase gains the colour word (`0.9 km black trail`), the OSM sentence is replaced by one saying where the grade came from, and **the tags gain the level** (`green`/`blue` -> `beginner`, `red` -> `intermediate`, `black`/`orange` -> `expert`), because the sidebar filters on that word and a coloured line with no level is invisible to the beginner/expert filter. `parkruns.placemark()` does all three; a hand edit of `styleUrl` alone does none of them.

**Do not credit a grade to a source you have not read.** Sentiers du Moulin does publish its grading - `map_SDM_2026.pdf`, `map_Maelstrom_2026.pdf` and `charte-progression-resume_2026-1.pdf`, all linked from `/pistes-et-conditions/` - and none of the three is readable. The two smaller ones declare **no fonts at all**, so they are pure raster; the 36 MB sector map has one font, a `Mont-Heavy` subset with no `ToUnicode` CMap, so its content streams inflate to subset byte codes rather than text (the one legible token in the whole file is `BOOGIE`). `/pistes-et-conditions/` itself renders its trail table from a JS widget. So the note says the grade was added by hand and that the operator grades only on printed maps - both checkable - rather than naming a PDF nobody extracted. **A PDF with no `/BaseFont` is raster; check that before planning to read it.**

**A route relation can be the fence when the polygon is not.** Sentiers du Moulin (Quebec) has both: `way/1512759067` (`leisure=sports_centre`, 99 chemin du Moulin) and `relation/8058444` (`route=mtb`, "MTB Sentiers du Moulin", 112 member ways / 59 names). The polygon is useless - Wolverine, Professeur X, Slab City, Granitosaur, Magneto, Klondike, Maelstrom, Tourbillon, Vortex, Saga, Gold City and Vélo-Ciraptor all read **0% inside** and 1.4-2.9 km out, and every one is a member of the relation. The relation is decisive in both directions: it also excluded Sim's Trail, `sentier_poulin`, Chemin de la Traverse, Chemin Fleming and P'tit lac, which sit in the same bbox and belong to the neighbouring network. 31 lines out of it. Membership of a named `route=mtb` relation is worth citing in the line text.

**A wrong pin makes the bbox lie, and the name search is what catches it.** Three of these ten were mispinned, and Sentiers du Moulin was the expensive one: its pin sat 4 km from the site, so the first sweep of that bbox returned the neighbouring Montagne a Tremblay network (Sentier du Montagnard, Boucle de la Montagne a Tremblay) as if it were the park, and the real 59-trail network read as "2.4-3.9 km from the pin" noise. One `nwr["name"~"Moulin",i]` query found the sports_centre and the route relation and moved the pin to 46.98336,-71.27006 at 347 m. Panorama's pin was 3-decimal and 280 m off the lift its own description named (moved to the Mile 1 Express valley station, 1184 m, with a new grey waypoint at the 1558 m top). **Run the name search on any spot whose trail table reads as a scatter of kilometre distances** - that pattern is the fingerprint of a bad pin, not of a spread-out park.

**Check which end of the spot the text is on.** Big White's grey waypoint was named `Big White: village base` while its own bold header described the Bullet Express **top**, and the full spot description - trails, prices, season, access - sat on that waypoint while the main pin held a one-line caption. The convention is the reverse (see Wentworth): body on the blue pin, one paragraph on the grey waypoint. Worth a glance whenever you touch a spot.

**Not-found and not-applicable are different rows.** Valmont Bike Park is mapped in OSM in complete detail - Mesa Flow, Dual Slalom, XL/L/S Slopestyle, Skillz Loop, Corkscrew, Espresso, Dirt 101, Hot Lap - and **nothing has more than 13 m of drop**, because it is a flat municipal dirt-jump and slopestyle complex inside Boulder. There is no descent to trace and never will be; `X km trail, dropping N m` would be nonsense. Write that into the row and tell the next pass not to re-sweep it. Mount Snow is the opposite kind of dead end: 119 ski pistes fully mapped with `piste:difficulty`, no bike names at all, and a Vail bot-gate that returns `The system cannot process your request` to every client - the status page, the biking page and the CDN summer-map PDF alike. That one needs a browser session, not another Overpass query.

**A dedicated climbing trail must not be drawn.** `parkruns` orients every run downhill from the DEM, which is right for a mis-mapped descent and wrong for a trail built to be ridden up. Empire 47 names its climbs `Montee de la Soif`, `Montee de Lait`, `Montee de l'Estra` - all three pass the drop test, and all three would have been emitted as descents with the direction arrows pointing the wrong way. The name is the signal; so is `Chemin de Service` / `Chemin d'acces` for a service road. Check the shortlist for climbs before emitting, because nothing in the geometry can tell you.

**A secondary signal, when the operator gives you nothing: the OSM import batch.** Silver Mountain's whole park arrived as one upload, ways `14809xxxxx`-`14810xxxxx`. Holmes Trail (`13915018`) and Highland Creek Road (`13916483`) are older IDs and are a hiking trail and a forest road. This narrows a shortlist; it does not decide it - Moose Knuckle is inside the batch and is a hiking trail, which only the operator's hiking page says.

**What "nothing found" looks like when it is real.** Seven of the ten had no drawable geometry, and the reasons are worth recognising: 49 Degrees North holds 30 named ways and every one is a National Forest Development Road; Sunlight has five, all forest roads; Plattekill has three, none on the hill; Sir Sam's has one. Highland Mountain has 28 named ways and they are all the _adjacent_ XC network - none of its own signed runs exists in OSM under any tagging. At Red River the only winter_sports polygon is the Nordic centre 3-4 km away, which is what Yo Yo Mas, Big Foot, Yeti and Sven Wiik belong to, all at 1-2% gradient. Write the reason into `TRACES-TODO.md`; a bare tick tells the next pass nothing.

### Importing a `tmp/<batch>/` folder of supplied GPX

Files the user drops in `tmp/<spot>/` or `tmp/<batch>/`, named `<Trail> (<colour>).gpx`, are **hand-drawn in gpx.studio** - confirm it from the `creator` attribute and assert on it. Credit them as "drawn in gpx.studio and supplied for this map, simplified to ~8 m", never as an official export.

**Read the profile before you write "dropping N m".** The 2026-08-21 `tmp/himalaya` batch (Lower Mustang, Nepal) contained three lines that are not descents at all: `Base Camp Thorong Pass` climbs 394 m with 4 m of descent - it is the approach leg; `Under The Temple` nets 5 m over 653 m; `Thorong Pass` crosses a **5406 m** col with 2180 m of descent against 1661 m of climbing. Emitting "dropping N m from T to B" for any of those would have been a false claim, so branch on the measured profile: a drop, a climb, a rolling link, or a pass crossing. `scripts/gpximport.py` does that, asserts on the `creator` attribute, and prints the whole batch's profiles and pin distances with `--pin lon,lat` before it emits anything.

**A batch folder is a riding base, not a bounding box.** Those nine traces spread 6-30 km from the Jomsom pin, across Lupra, Muktinath and the Thorong La crossing, because Jomsom is the town you fly into. They still belong to one spot - but put the distances in the spot text so nobody expects one hillside. Cluster by track midpoint against every `Point` placemark before assuming a folder name is a place (`tmp/swiss2` split four ways, 9 of its files in Italy).

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
