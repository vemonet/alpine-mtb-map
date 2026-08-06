# Bike-park research: skipped candidates

Every candidate below was looked at and **not** added, with the reason. Nothing here is a final judgement - it is a review list. Correct anything you know better and it can go straight in.

Scope in force, after two widenings on 2026-08-05:

1. Drag lifts (t-bar / platter) **count** as uplift. The parks held back on that basis are now in.
2. **A park with no lift at all is still a spot.** Shuttle and pedal parks get a pin like anything else, marked `no-lift` with a brown placemark. "No lift found" is therefore no longer a reason to skip anything - it only changes how the coordinate is found and how the spot is described.

How pins are found now, in order (the ladder is written up in `.github/skills/spot-data/SKILL.md`):

- **Lift present** - one Overpass `around` query per batch over hand-checked village coordinates, returning both endpoints of every nearby lift measured against opentopodata. Pin the valley station.
- **No lift** - `scripts/verify_mtb.py` asks OSM what mountain-bike infrastructure sits near a candidate coordinate. A cluster of `mtb:scale` ways, a `route=mtb` relation or a feature actually named after the park is the evidence; the pin goes on that, and the description says the uplift is a shuttle rather than pretending there is a station.
- **Neither** - the spot lands in this file. That is now the only reason to be here.

A coordinate a few km off is still the single most common cause of an empty result, so a retry with a better coordinate is cheap and has already rescued several parks from this list.

---

## Traces to add to OSM

- [ ] Menton
- [ ] Le Mouret
- [ ] 1 in Biel ?

## 0. Re-check pass, 2026-08-06

**Nordic altitudes need `eudem25m`, not mapzen.** Near the Baltic, mapzen read Meri-Teijo's valley station at 24 m against EU-DEM's 10 m and its top at 62 m against 74 m - enough to make a 64 m hill look like a 38 m one. Cross-check any sub-100 m spot against a second dataset before quoting a figure.

**Resolved as "do not add":**

- **Bailey Mountain Bike Park** (NC) - **permanently closed**, announced as the end of a six-year run. It was the top-priced entry in the unplaced US list in section 1b; that entry is closed, not missing.
- **Kungsbygget** (SE) - section 4 asked why its own lifts never came back. They never came back because it has none for biking: it is a natural-trail, flowtrail and pumptrack site, and the lift-served riding on Hallandsasen is **Vallasen, 6 km away and already on the map**.

**Newly unblocked by this sweep, not yet checked for summer bike operation.** Each of these returned lifts once geocoded by name rather than by the directory's coordinate, so the "no lift returned" rows in section 3 are stale for them. This is the next batch of work:

| Park | Lifts now found | Note |
| --- | --- | --- |
| Mount Abram (Maine) | 5, incl. the Skyline Double chairlift | Section 3 called it the best candidate for a third try; the third try worked |
| Canaan Valley (West Virginia) | 10, incl. a 6-person chair |  |
| bikeparkOE / Fahlenscheid (Olpe) | 3, Steinbrink I and II drag lifts | Section 1 could not tie the Sauerland trails to the park; the hill itself is now placed |
| Bike park Bovec / Kanin (Slovenia) | 9, incl. the Kanin cable car | Section 1 noted the cable car was mapped as a closed loop; the endpoints resolve from Bovec |
| Calabria Bike Resort / Lorica (Italy) | 4, incl. the Funivia Lorica | Section 1 found "1 feature, then nothing" - at the wrong place |
| San Domenico (Italy) | 7, incl. the Ciamporino cable car |  |
| Bygdsiljumbacken (Sweden) | 5 drag lifts |  |
| Akersjon (Sweden) | 1 drag lift | Already on the map as `no-lift` with an explicit "unconfirmed" note - the lift exists |
| Drozdovo (Slovakia) | 10 - but they are **Malino Brdo**, already on the map | The geocode resolves to a different Drozdovo; treat as unresolved, not as a match |

Still returning nothing after a name-based geocode: **Kotecnik** (SI), **Taburno** (IT), **Muszyna** (PL), **Alfta** (SE). Nominatim has no entry at all for **Hanaslov**, **Kjerringasen**, **Bollekollen**, **Mount Shasta Ski Park** or **Murray Ridge** under those names, though Hanaslov is a real lift-served park with its own site (hanaslov.se) and is already on the map.

---

## 1. Shuttle or pedal parks - IN SCOPE as of 2026-08-05, being worked through

Genuine bike parks with no lift. These are no longer skipped; each needs an OSM-evidence pin via `verify_mtb.py` and then a `no-lift` spot.

**Added so far:** Rincine, Molini Freeride, Racepark Schulenberg, Bike Park de la Mouliere, La Sorrera, Bikepark Tres Cantos, Robidisce Trail Center, 4 Riders Bike Park, Bikepark Beerfelden, Bikepark Osternohe, Bikepark Trippstadt, Bikepark Attendorn, Heidenloch, DAV Bikepark Skillup, Flowtrail Stromberg, Campo Imperatore Gravity.

**Three "shuttle parks" turned out to be lift-served** once the coordinate was corrected, and were added as normal lift spots: **Bikepark Burladingen** (Skilift Burladingen, 160 m), **Alpen Bikepark Schneeberg** (Losenheim chairlift, 320 m - the original Puchberg coordinate was ~2 km off) and **Blackmountain Bikepark** (Blombergbahn, 525 m). Worth remembering before writing anything off as lift-free: the lift query was answering about the wrong place, not about the park.

**Still to do** - each has a strong or plausible candidate coordinate, they just have not been run yet:

| Park | Country | Evidence status |
| --- | --- | --- |
| bikeparkOE (Olpe) | Germany | 418 mtb ways nearby, but all generic Sauerland trails - nothing ties them to the park |
| Alkornoke Bike Park | Spain | **nothing** at 36.19,-5.50 |
| Bike Park de La Grand-Combe | France | 1-2 mtb ways only across two tries |
| Taburno Bike Arena | Italy | 3 tries (41.073/41.050/41.100, 14.55-14.63). Never more than 2 mtb ways. The listing geocode (Vecchiano, Tuscany) is wrong - the place is Monte Taburno in Campania - but no OSM evidence found there either |
| Calabria Bike Resort | Italy | 2 tries. 1 feature, then **nothing** |
| Kotecnik Bike Gverk | Slovenia | verify_mtb found **nothing** at 46.24,15.12 |
| Bike park Bovec | Slovenia | 84 features nearby but they are the Soca valley network; the park is on Kanin, whose cable car is mapped as a closed loop |
| MyFlyZone BikePark | Italy | 51 features near Castel Gandolfo, all generic numbered trails - cannot be tied to the park |
| Ronco | Italy | 11 unnamed mtb ways; too little to place |
| RIDER'S CAMP | France | 2 tries. 3 mtb ways at 45.530,3.235; too little to place |

Plus the van-uplift UK parks, which were never separately listed and belong here too: Flyup 417, Dare Valley Gravity Park, Descend, Okeford Hill, Isle of Wight, Twisted Oak, Farmer Johns, Wind Hill, Nant Gwrtheyrn, Deers Leap (closed).

---

## 1b. United States: OSM has almost no trail data, so rung 2 is useless there

An important correction to how this file was being read. American trails are mapped in Trailforks and MTB Project, **not** OpenStreetMap, so `verify_mtb.py` returns **zero features** for real, operating US bike parks. Fifteen US gravity parks were run through it on 2026-08-05 and thirteen came back empty - which says nothing at all about whether they exist.

`find_named.py` (rung 1, bbox-scoped name search) is the rung that works there. It found:

- **Freeman Ridge Bike Park** (Maine) - mapped as `leisure=park` under its exact name. Added.
- **Louisville Mega Cavern** (Kentucky) - mapped with `sport=cycling;climbing_adventure;hiking`. Added; the only underground bike park on the map.
- **Kelly Canyon** (Idaho) - found **8.8 km** from where two rounds of lift queries had been looking, which is why they found nothing. Re-running the lift query at the real location returned three chairlifts. Added.
- **Ober Mountain** (Tennessee) - lift-served after all, by an aerial tramway whose valley station is in downtown Gatlinburg, 3 km from the resort. Added, and removed from section 4.

Still unplaced after both rungs, but **believed real** (each has a price in the listing, which is decent evidence a park takes money from riders): Bailey Mountain Bike Park ($40), Luiseno ($60), Panhandle Bike Ranch ($55), Redhawk Ridge ($59), Saddleback Bike Park ($35), Kolo ($21), Fiddlehead Farm & Forest ($25), Shredwoods, Squonk Bike Park, Big Bear Lake Trail Center ($10), Mount Abram ($25). These need a coordinate from a source other than OSM - the operator's own site, or a map the user trusts. They are the highest-value unfinished work in this file.

---

## 1c. Excluded as cross-country, not gravity

The user's scope is gravity riding: "i dont want full XC boring trails". These are real, mapped and placeable, but they are cross-country or nordic networks, so they stay off the map on purpose rather than for want of a coordinate:

**Bruket MTB Arena** (Sweden) - matched cleanly at 0.1 km, but its OSM trails are named `Bruket XCO - Rod Loop` and `Bruket XCO - Bla Loop`: an XCO race arena.

Also excluded on the same grounds: Lapland Lake Cross Country Ski Center, Soldier Hollow Nordic Center, Cascade Cross Country Ski Center, Cross Country Ski HQ, Prospect Mountain (nordic), von Trapp Family Lodge, Flat Rock Ranch, Cane Creek Park, Rocky River, Tower Hill Trail Center, Northern Maine Community Trails, The Summit Bechtel Reserve, Arapuke Forest, Sjusjoen, Pe do Negro, Kristiansand Sykkelpark, Trailshare, Wilderness Tours, Big Bear Lake Trail Center.

---

## 2. Ski areas with no summer bike park

Large trail counts that reflect a nearby trail network, not a lift-served park at the resort.

Arapahoe Basin · Wolf Creek · Alta · Loveland · Ski Cooper · Ski Santa Fe · Saddleback · Bromley · Wildcat · Pat's Peak · Kirkwood · Heavenly · Mt. Rose · Homewood · Smugglers' Notch · von Trapp Family Lodge

**Worth re-checking:** several of these do run summer lift operations for sightseeing, and a bike park may have opened since. Sunlight, Ski Apache and Tenney Mountain were in this group and were promoted out of it once their lifts and vertical checked out - their descriptions carry an explicit "confirm summer bike operation" caveat rather than a bare claim.

---

## 3. No lift returned by Overpass

**These are no longer skips.** Since shuttle and pedal parks are in scope, every row here is a candidate for the `verify_mtb.py` route: find the OSM trail cluster, pin that, describe it as `no-lift`. They are kept in one place so the sweep can be done in a batch.

Retried at least once with a corrected coordinate unless marked otherwise.

| Park | Country | Note |
| --- | --- | --- |
| Mount Abram Ski Area & Bike Park | United States | Name says bike park; two coordinates tried, both empty. Best candidate for a third try. |
| Kelly Canyon Resort | United States | Two coordinates tried. |
| Canaan Valley Ski Resort | United States | One try. |
| Mount Shasta Ski Park | United States | One try. |
| Meri-Teijo Bike Park | Finland | Two tries. |
| Kokonniemi Bike Park | Finland | One try. |
| Vångaberget | Sweden | Two tries. |
| Hanaslöv Bike Park | Sweden | Two tries. |
| Åkersjön bikepark | Sweden | Two tries. |
| Alfta Bike Park | Sweden | Two tries. |
| Yxbacken cykelpark | Sweden | Two tries. |
| Kjerringåsen Alpinsenter | Norway | Two tries. |
| Bike park Drozdovo | Slovakia | One try. |
| Park Rowerowy Muszyna | Poland | One try. |
| Welli Hilli | South Korea | One try. |
| Sandomenico | Italy | One try. |
| Alpen Bikepark Schneeberg | Austria | One try. |
| Kotečnik Bike Gverk | Slovenia | One try. |
| Campo Imperatore Gravity | Italy | One try. |
| Bruket MTB Arena | Sweden | One try. |
| Bollekollen | Sweden | One try. |
| Bygdsiljumbacken bike park | Sweden | One try. |
| Novinki (Новинки) | Russia | One try. |
| Oksky "BROS" bike park | Russia | One try. |
| Spasskaya Guba (Спасская губа) | Russia | One try. |
| Ahoj GrasSki-Bike Park | Slovakia | One try; likely a grass-ski hill with no mapped lift. |
| Murray Ridge Ski Area & Terrain Park | Canada | One try. |
| Mount Pleasant of Edinboro | United States | One try. |
| Songkeng 竦坑 | China | One try. |
| Villa Alpina | México | One try. |
| Camaleon Bike Park | México | One try. |

---

## 4. Lift found, but not trustworthy enough to pin

| Park | Country | Why |
| --- | --- | --- |
| ~~Trailpark Buková Hora~~ | Czech Republic | **Resolved 2026-08-06 and added** - the Čenkovice–Buková hora chairlift is in OSM now. |
| ~~Pylypets Bike Park~~ | Ukraine | **Resolved 2026-08-06 and added** - the Borzhava chairlift is in OSM now. |
| ~~Kungsbygget~~ | Sweden | **Resolved 2026-08-06: it has no bike lift.** Natural trails, flowtrail and pumptrack only; the lift-served riding on Hallandsåsen is Vallåsen, already on the map. |
| Gora Dolgaya (Гора Долгая) | Russia | 77 m chairlift found, but no confidence a bike park operates - the site is primarily a ski-jumping complex. |
| Bike ToxoPark (Токсово) | Russia | Only three near-flat platters returned (~5 m of measured drop); Toksovo's real ski hill did not come back. |
| Sender Bike Park (Aviemore) | United Kingdom | 2 tries. The Cairngorm funicular and pomas came back at the ski area; at the Aviemore geocode only one mtb way ("Jules's"). Cannot be placed either way. |
| Cerduo Bike Park (Pucón) | Chile | The query returned the Villarrica volcano ski centre lifts; the park is believed to be a separate site in town, so pinning it there would likely be wrong. |

---

## 5. Duplicates removed from the work list

| Listing entry | Already on the map as |
| --- | --- |
| Hovden Ski senter (Norway) | Hovden Bike Park (Setesdal) - its geocode landed near Oslo, ~900 km out, which hid the duplicate from the distance filter |
| Plattekill Mountain Ski Resort | Plattekill Bike Park - listed twice, at 36 and 11 trails; added once |

---

## 6. Removed from the map during the source-checking pass

Checking each `needs-more-details` spot against its operator turned out to be a scope filter as much as a detail-gathering exercise. These five were on the map and are not: in each case the operator's own words say there is no lift-served gravity riding there.

| Spot | Why it was removed |
| --- | --- |
| Aspen Mountain Bike Park (Colorado) | Aspen Snowmass's biking pages cover Snowmass Bike Park only; nothing about bike haul on Ajax. **Snowmass Bike Park is already a separate pin**, so this was effectively a phantom duplicate. |
| Palisades Tahoe Bike Park (California) | The resort states plainly that "biking on the mountain is not lift-accessed and trails are difficult", and lists four designated cross-country trails. Not a bike park. |
| Seven Springs Bike Park (Pennsylvania) | The downhill park closed permanently; `7springs.com` has no bike-park page since the Vail Resorts acquisition. A closed park on the map is worse than a missing one. |
| Granite Peak Bike Park (Wisconsin) | The resort runs autumn scenic chairlift rides and no summer bike operation at all. No bike trails, bike haul, prices or season anywhere on its site. |
| Pierron Bike Park | The pin sat at 43.61N 6.99E in the **Var** - built on the Cote d'Azur mtb cluster that was already flagged as a false positive during the import. The Pierron brothers' park is at **Ferriere-Saint-Mary in the Cantal**, roughly 350 km away, and it is a private association site (access through the field is prohibited; contact pierron-downhill-association@outlook.fr). Nothing in OSM there to pin it to, so it was removed rather than moved to a guess. Worth re-adding if a checkable coordinate turns up. |
| Great Divide Bike Park (Montana) | Mountain biking at Great Divide is "in stasis" while the owners weigh up summer operations; the former trails have not been maintained in over a decade. |
| Louisville Mega Cavern (Kentucky) | The Mega Underground Bike Park - 45 trails in a limestone cavern 100 ft down - is **permanently closed**, with no plans to reopen. The cavern still runs zip lines and tram tours. |
| Lookout Pass Bike Park (Idaho/Montana) | The summer riding here is the Route of the Hiawatha: a 15-mile rail trail at a 1.5-2% grade through tunnels and over trestles. Scenic, and not gravity. |
| Montage Mountain Bike Park (Pennsylvania) | The resort's own site markets summer entirely as a waterpark - slides, lazy river, wavepool - with no mountain-biking infrastructure mentioned anywhere. |
| Sipapu Bike Park (New Mexico) | Sipapu's own summer page lists hiking, disc golf, fishing and geocaching, and no biking at all. The lift-served park in its group is Spider Mountain in Texas, a different place. |
| Boler Mountain Bike Park (Ontario) | The club's own trails page lists five trails - a 2 km beginner, a 5 km intermediate and two expert loops, plus a fitness trail - and mentions no lift-served biking at all. Loops on 120 acres: cross-country. |
| Espace VTT Chantelouve | The pin sat at Chantelouve in **Isere**, matched from the commune name. The real Espace VTT Chantelouve is at **Bessans in the Maurienne, Savoie** - and it is a 10 km pedal-powered trail centre with wooden and stone modules, open 15 June to 15 October, free, with no lift. Wrong place and out of scope. |
| Gunstock Bike Park (New Hampshire) | "No lift service is available to take bikes to the summit." Beginner-to-advanced single and double track across the ridge - a pedal network, and cross-country at that. |

Two more were kept but re-described rather than removed, because the terrain is real and only the access changed:

- **Windham Mountain (New York)** - a former UCI World Cup downhill venue, now a members-and-lodging-guests amenity rather than a ticketed public park.
- **Bikepark Koenigsberg / Hollenstein (Austria)** - the company operating the lifts filed for insolvency at the end of 2025 after a winter with three days of lift operation; `koenigsberg.at` is offline and the first creditors' meeting was in January 2026. The pin now carries that warning.
