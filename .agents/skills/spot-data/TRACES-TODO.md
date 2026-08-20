# Spots that still need trail traces

Working list of the spots in `alpine-mtb-map.kml` that have a pin but no usable geometry: **every spot with 0 or 1 line**. Generated 2026-08-20 from the KML (650 spots: 569 with no line at all, 81 with a single line). Pal Arinsal and SilverStar have since been traced and removed, leaving 648.

## How to use this file

| Column | Meaning |
| :-- | :-- |
| **Spot** | the `<name>` of the spot placemark in `alpine-mtb-map.kml`, verbatim - grep it to find the pin |
| **Traces** | lines currently attached to that spot (a line is named `<spot base name>: <trail>`) |
| **OSM search** | empty = not searched yet · ✅ = searched (`scripts/trails.py`, name search, GPS trace archive) and nothing usable found |
| **Web search** | empty = not searched yet · ✅ = operator site / official map checked, no GPX, KML or Google My Maps `mid` |
| **Comments** | what was tried, what to try next, and the regional convention that usually decides it |

Rules for keeping it honest:

- Mark ✅ only for a search that was actually run and came back empty. A spot where geometry _was_ found gets its row deleted, not a tick.
- **When a spot ends up with most of its runs drawn, delete its row.** Judge by the network, not by a number: a park with 8 signed trails and 7 lines is done, a 40-trail park with 6 lines is not. Leave the row and update the comment when only a fraction is covered.
- A row with both columns ✅ is not dead - it means the two cheap sources are exhausted and it needs a new one (see the fallbacks in `SKILL.md`).
- Order inside each section is a rough priority: lift-served size, signed trail count and how well known the place is. It is a hint, not a ranking - take whatever you can actually find a source for.
- A "1 trace" spot is not automatically under-mapped. For several Swiss hills the single line is all OpenStreetMap holds; those rows say so.

**An empty OSM column is not evidence that OSM holds nothing.** Pal Arinsal sat here with one line while OpenStreetMap held 24 named runs - mapped as short `name` + `bicycle=designated` fragments that `trails.py` lists individually and that therefore look too small to be trails. At any bike-park row, run `scripts/parkruns.py <bbox>` before believing the OSM column; it groups fragments by name, chains them at both ends and drop-tests the result. That is how the 22 Pal Arinsal lines were added on 2026-08-20.

**At a North American resort, the operator's own PDFs are the classifier.** SilverStar also sat here at one line, and its 60 park runs are mapped as bare `highway=path` + `name` - no `bicycle`, no `mtb:scale`, nothing a tag filter can key on. What separates them from the XC and hiking networks sharing the same hillside is the resort's map set: `cms.skisilverstar.com` publishes the DH bike, cross-country and hiking maps as PDFs, and the cross-country map carries a complete trail-length table. A name in that table is XC, not a park run - that is what removed Brian's, Eric's, Cabin Trail, Silver Shack, Corkscrew, Chakra, Crack of Dawn, Grizzly Adams, Snake Pit and Paradise from the shortlist. 16 lines added on 2026-08-20. Look for the resort CDN's PDFs before trusting names.

Blanket sweeps already done, so do not redo them wholesale:

- **2026-08-09** - every then-traceless spot was swept for OSM geometry (`trails.py`-style mtb tag query, nearest-pin assignment, drop test). Rows here that are not ticked either postdate that sweep or need a _different_ query than the mtb-tag one (name-only chains, `bicycle=designated`, `marked_trail`).
- **2026-08-08** Swiss/border thin-trace sweep, **2026-08-19** tier-2 lift-served sweep, **2026-08-20** tier-3 Central/Eastern sweep. Their negative results are in the comments below.

Three duplicate pins turned up while counting and are flagged in the tables: Peyragudes (two pins, same coordinates), Mystic Bright (two pins 2 km apart, one carrying all 22 lines) and Manzherok (two pins 2.3 km apart). Merge those rather than tracing them twice.

## Europe

| Spot | Traces | OSM search | Web search | Comments |
| :-- | :-: | :-: | :-: | :-- |
| Peyragudes-Loudenvielle Bike Park (Pyrenees) [33 EUR] | 0 |  |  | DUPLICATE PIN of "Peyragudes Bike Park", same coordinates. Merge, then trace once. |
| La Molina Bike Park (Catalonia, ES) [31 EUR] | 0 | ✅ | ✅ | 13 signed descents, none in OSM under any name; pirineu365.cat 403s WebFetch, no gpx/kml/mid. Needs a new source. |
| Bike Park Bovec (Soca valley, Slovenia) [5 EUR per shuttle run] | 0 |  |  | SI: grade can live in marked_trail rather than colour. |
| Bike Park Ferme Libert (Malmedy, Belgium) [10 EUR / 10 lifts] | 0 |  |  | BE/NL: small hills, watch the drop test (25 m / 4% branch). |
| Bardonecchia Bike Park (Piedmont) [lift pass] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Hovden Bike Park (Setesdal, Norway) [140 NOK] | 1 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Sherwood Pines (Nottinghamshire, UK) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Saint-Lary Bike Park (Pyrenees) [26 EUR] | 1 |  |  | FR: OSM runs are route=mtb relations carrying colour. |
| Thredbo (New South Wales, AU) [season 759 AUD; day rate unverified] | 0 | ✅ | ✅ | Cannonball and Kosciuszko Flow are Trailforks-only; the TVT relation is XC and does not chain. |
| Bike Park Tajare (Valle Stura) [free, no lift] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. No lift: try the OSM GPS trace archive. |
| Sierra Nevada Bike Park (Granada, ES) [lift price unverified] | 1 | ✅ | ✅ | 7 named DH circuits, none mapped; the one line is the operator XC loop (zero net drop), not a gravity run. |
| Rincine Trail Area (Tuscany, Italy) [shuttle, book ahead] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. No lift: try the OSM GPS trace archive. |
| Carezza - Val d'Ega / Eggental (South Tyrol) [lift pass, price unverified] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Civetta - Val Fiorentina / Pescul (Dolomites) [34 EUR] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Coed y Brenin (Wales) [free, parking charge] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Divcibare Bike Park (Serbia) [2400 RSD] | 0 |  |  | Balkans: OSM patchy, check the operator site. |
| Les Angles Bike Park (Pyrenees) [24.50 EUR] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. |
| Val d'Allos - Le Seignus Bike Park (Haut-Verdon) [lift pass] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. |
| Afan Forest Park (Wales) [free, parking charge] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Revolution Bike Park (Llangynog, Wales) [50 GBP] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. |
| Peyragudes Bike Park (Hautes-Pyrenees, France) [gondola] | 0 |  |  | Duplicated by "Peyragudes-Loudenvielle Bike Park" at the same coordinates - merge first. |
| Borovets Bike Park (Bulgaria) [29 EUR] | 0 | ✅ | ✅ | Nothing mapped: the only hit, Rotata, is a ski piste tagged bicycle=no. Site and 3D map carry no gpx/kml. |
| Ciocco Bike Circle (Barga, Tuscany) [free access] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Prali Bike Arena (Val Germanasca, Piedmont) [15 EUR] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Antur Stiniog (Eryri / Snowdonia, Wales) [44 GBP] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. |
| Arena Platos Bike Park (Paltinis, Romania) [54 RON] | 0 |  |  | RO: some route=mtb relations exist, otherwise operator site. |
| Bike Park dell'Angelo - Tarvisio (Friuli) [chairlift fare] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Mechi Chal (Chepelare, Bulgaria) [chairlift] | 0 |  |  | BG: little bike tagging, ski pistes tagged bicycle=no are not runs. |
| Slotwiny Arena Bike Park (Krynica-Zdroj, Poland) [125 PLN] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Glenshee Bike Park (Cairngorms, Scotland) [15 GBP] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. |
| Frontignano Bike Park (Sibillini, Marche) [15 EUR] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Bike Resort Sinaia (Romania) [gondola] | 0 |  |  | RO: some route=mtb relations exist, otherwise operator site. |
| Bike Park Kope (Pohorje, Slovenia) [30 EUR] | 0 |  |  | SI: grade can live in marked_trail rather than colour. |
| Postavaru Bike Park (Poiana Brasov, RO) [gondola] | 0 |  |  | RO: some route=mtb relations exist, otherwise operator site. |
| Oppdal Bike Park (Trondelag, Norway) [check operator] | 1 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Bike Park Rogla (Pohorje, Slovenia) [25 EUR] | 0 |  |  | SI: grade can live in marked_trail rather than colour. |
| PKL Bike Park Palenica (Szczawnica, Poland) [69 PLN] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Sestriere Bike Park (Via Lattea, IT) [chairlift] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| The Mother Bikepark Winterberg (Germany) [lift pass] | 1 |  |  | DE: densely tagged in OSM, colour on the ways. |
| Bad Kleinkirchheim (Carinthia, Austria) [check operator] | 1 |  |  | AT: way tags plus route=mtb colours. |
| Kopaonik Bike Park (RS) [lift] | 0 |  |  | Balkans: OSM patchy, check the operator site. |
| La Pinilla Bike Park (Segovia, ES) [chairlift] | 0 |  |  | ES: operators publish paper maps only, OSM coverage thin. |
| Wagrain Bike Park (Salzburg, AT) [chairlift] | 0 |  |  | AT: way tags plus route=mtb colours. |
| Monts Jura Bike Park - Crozet / Lélex (Ain) [27 EUR] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. |
| Manzherok Bike Park (Altai, Russia) [1000 RUB] | 0 |  |  | DUPLICATE PIN of the other Manzherok entry 2.3 km away. Merge the pins. |
| Andermatt - Gemsstock / Gutsch [bike pass, price unverified] | 0 |  |  | CH: operator sites sometimes ship SchweizMobil GPX (airolo.ch does); OSM mixes way tags and route=mtb. |
| Uludag Sarialan (Bursa, Turkey) [cable car carries bikes] | 0 |  |  | TR: no MTB tagging to speak of; hiking-path DEM profiling may be the only route. |
| Straja Bike Park (Lupeni, Romania) [30 RON] | 0 |  |  | RO: some route=mtb relations exist, otherwise operator site. |
| Nassfeld (Carinthia, Austria) [check operator] | 0 |  |  | AT: way tags plus route=mtb colours. |
| Narvikfjellet (Norway) [check operator] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Pilat Enduro Trails (near Lyon, FR) [no lift, free trails] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. No lift: try the OSM GPS trace archive. |
| Gurten (Bern) [city fare + 3.50 CHF bike] | 1 | ✅ |  | The single line IS all OSM has for this hill; do not re-sweep. Needs a non-OSM source. |
| Jahorina Bike Park (Bosnia and Herzegovina) [lift pass] | 0 |  |  | Balkans: OSM patchy, check the operator site. |
| Prato Nevoso Bike Park (Piedmont) [lift pass] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| St-Cergue / La Dôle (Jura vaudois) [train fare only] | 0 | ✅ |  | Swept; Passage de l ecureuil is Arzier, not St-Cergue - do not re-add. Natural spot: try the GPS trace archive. |
| Valle Cervo Freeride (Campiglia Cervo) [no lift] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. No lift: try the OSM GPS trace archive. |
| Hamsterley Forest (England) [free, bike park extra] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Les Pléiades (above Vevey) [train fare only] | 1 | ✅ |  | Swept; Sentier des Chevres is Caux, not Les Pleiades - do not re-add. |
| Mogo Trails (New South Wales, Australia) [free, no lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| BSFZ Bike Trail Area Obertraun (Upper Austria, Austria) [no-lift] | 0 |  |  | AT: way tags plus route=mtb colours. No lift: try the OSM GPS trace archive. |
| Bike Park des Lacs de l'Eau d'Heure (Belgium) [day access] | 0 |  |  | BE/NL: small hills, watch the drop test (25 m / 4% branch). |
| Bikepark Ochsenkopf (Fichtelgebirge, Germany) [22 EUR] | 1 |  |  | DE: densely tagged in OSM, colour on the ways. |
| Mountainbike Trail Area Gleisdorf (Austria) [free, no lift] | 0 |  |  | AT: way tags plus route=mtb colours. No lift: try the OSM GPS trace archive. |
| Villard-de-Lans / Correncon (Vercors) [see operator] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. |
| Tahko Bike Park (Nilsia, Finland) [15 EUR] | 1 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Bikepark Braunlage - Wurmberg (Harz, Germany) [38 EUR] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. |
| Sando Bikepark (San Domenico di Varzo, Piedmont) [22 EUR] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Gerlitzen Alpe (Carinthia, Austria) [check operator] | 0 |  |  | AT: way tags plus route=mtb colours. |
| Bike Park Nowa Osada (Wisla, Poland) [100 PLN] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Hoch-Ybrig (Schwyz) [38 CHF] | 0 | ✅ | ✅ | Swept 2026-08-08: nothing in OSM, no GPX on the operator site. |
| Laggan Wolftrax (Scotland) [free, parking charge] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Melchsee-Frutt (Obwalden) [gondola] | 0 | ✅ | ✅ | Swept 2026-08-08: nothing in OSM, no GPX on the operator site. |
| Stoos - Fronalpstock (Schwyz) [funicular + chairlift] | 0 | ✅ |  | Swept; Le plus beau is Morschach, not Stoos - do not re-add. |
| Bike Park Donovaly (Low Tatras, Slovakia) [15 EUR] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| La Fenasosa Bike Park (Alicante, Spain) [18 EUR] | 0 |  |  | ES: operators publish paper maps only, OSM coverage thin. No lift: try the OSM GPS trace archive. |
| CK Ornen Downhill Park (Ornskoldsvik, Sweden) [check operator] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Alpen Bikepark Schneeberg - Losenheim (Austria) [check operator] | 1 |  |  | AT: way tags plus route=mtb colours. |
| Bike Park Bachledova Dolina (Zdiar, Slovakia) [17 EUR] | 1 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Bikepark Jested (Liberec, Czech Republic) [450 CZK] | 1 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Family Bike Park Zieleniec (PL) [cable car] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Golte (Savinja valley, Slovenia) [check operator] | 0 |  |  | SI: grade can live in marked_trail rather than colour. |
| Gorny Vozdukh Bike Park (Yuzhno-Sakhalinsk, Russia) [840 RUB] | 0 |  |  | RU: nothing mtb-tagged near most pins; operator sites are the only source. |
| Moléson-sur-Gruyères [38 CHF / Magic Pass] | 0 | ✅ | ✅ | Swept 2026-08-08: no OSM runs, no GPX on moleson.ch. Magic Pass lift, signed trails exist on the ground. |
| Nant Gwrtheyrn (Llithfaen, Wales) [26 GBP] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. |
| Ponte di Legno - Tonale Bike Park (Lombardy/Trentino) [lift pass] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Rocky Mountain Bikepark Samerberg (Bavaria) [22 EUR] | 1 |  |  | DE: densely tagged in OSM, colour on the ways. |
| Yllas Bike Park (Finland) [gondola] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Zahar Berkut Bike Park (Volosianka, Ukraine) [300 UAH] | 1 |  |  | Little bike tagging, check the operator site. |
| Ballyhoura MTB Trails (IE) [no lift, parking fee] | 0 |  |  | IE: OSM thin, trace archive worth a try. No lift: try the OSM GPS trace archive. |
| Coed Llandegla (Wales) [free, parking charge] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Manzherok Bike Park (Altai, Russia) | 0 |  |  | RU: nothing mtb-tagged near most pins; operator sites are the only source. |
| Montclar Bike Park (Alpes-de-Haute-Provence) [18.50 EUR] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. |
| Rold Skov Trailcenter (Denmark) [free, no lift] | 0 |  |  | Nordics: flat, expect the 25 m / 4% branch of the drop test to decide. No lift: try the OSM GPS trace archive. |
| Valgehobusemae Bike Trail (Estonia) [no lift] | 0 |  |  | Baltics: flat, small networks, OSM patchy. No lift: try the OSM GPS trace archive. |
| Bikepark Hindelang - Hornbahn (Allgaeu) [32 EUR] | 1 |  |  | DE: densely tagged in OSM, colour on the ways. |
| Manzaneda Bike Park (Galicia, Spain) [check operator] | 0 |  |  | ES: operators publish paper maps only, OSM coverage thin. |
| Velka Raca Bike Park (Oscadnica, Slovakia) [chairlift] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Wierchomla Bike Park (PL) [chairlift] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Laajis Bikepark (Jyvaskyla, Finland) [25 EUR] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Machairas - Lythrodontas (Cyprus) [no lift] | 0 |  |  | Little bike tagging. No lift: try the OSM GPS trace archive. |
| Saben Trail Area (Borgo San Dalmazzo) [pedal / shuttle] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. No lift: try the OSM GPS trace archive. |
| Trailpark Bukovka - Bukova Hora (Czechia) [check operator] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Alta Badia - Bike Beats (South Tyrol) [28 EUR] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Iso-Syote Bike Park (Pudasjarvi, Finland) [t-bar] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Bikepark Beerfelden (Odenwald, Germany) [28.50 EUR] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Montemale Bike Park (Cuneo) [free, no lift] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. No lift: try the OSM GPS trace archive. |
| Abetone Gravity Park (Tuscany) [lift pass] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Azuga Mountain Bike Resort (Prahova valley, Romania) [60 RON] | 0 |  |  | RO: some route=mtb relations exist, otherwise operator site. |
| Bannoye Bike Park (Bashkortostan, Russia) [1200 RUB] | 0 |  |  | RU: nothing mtb-tagged near most pins; operator sites are the only source. |
| Bike Park Gruniky (Namestovo, Slovakia) [10 EUR] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Bike Park d'Artouste - Vallee d'Ossau (Pyrenees) [17 EUR] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. |
| BikeAlps Mariazell - Buergeralpe (Styria) [34 EUR, closure reported] | 0 |  |  | AT: way tags plus route=mtb colours. |
| Bormio Bike Park (Valtellina) [lift pass] | 1 | ✅ |  | The one line is the whole mapped park (9 name-only ways chained, 1045 m drop). Nothing else in OSM. |
| Campo Imperatore Gravity (Gran Sasso, Italy) [10 EUR] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Courmayeur Bike Park (Aosta Valley, IT) [cable car] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Erciyes Bike Park (Kayseri, Turkey) [uplift status unverified] | 0 |  |  | TR: no MTB tagging to speak of; hiking-path DEM profiling may be the only route. |
| Kaprun - Maiskogel and Kitzsteinhorn (Salzburg, AT) [35 EUR] | 1 |  |  | AT: way tags plus route=mtb colours. |
| Lago-Naki Bike Park - Dakhovskaya (Adygea, Russia) [1200 RUB] | 0 |  |  | RU: nothing mtb-tagged near most pins; operator sites are the only source. |
| Luchon-Superbagneres (Haute-Garonne, France) [gondola] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. |
| Mayrhofen - Penken (Zillertal, AT) [72.50 EUR] | 1 |  |  | AT: way tags plus route=mtb colours. |
| Roccaraso Bike Park (Abruzzo) [lift pass] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Ruka Bike Park (Finland) [gondola] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Voss Bike Park (Norway) [gondola] | 1 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Viola St Gree Bike Park (Piedmont) [20 EUR] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| La Robella Bike Park [magic pass, from 27 CHF] | 1 |  |  | CH: operator sites sometimes ship SchweizMobil GPX (airolo.ch does); OSM mixes way tags and route=mtb. |
| Vogel - Bohinj (Julian Alps, SI) [33 EUR + 4 EUR per bike] | 1 |  |  | SI: grade can live in marked_trail rather than colour. |
| Vratna Paseky Bike Park (Slovakia) [chairlift] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Bike Park Kluszkowce (PL) [chairlift] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Bike Park Lavarone - Alpe Cimbra (Trentino) [15 EUR] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Uuperi Bike Park (Hamina, Finland) [20 EUR] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Bikepark Kosutka (Slovakia) [25 EUR] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Kalpalinna Bike Park (Janakkala, Finland) [check operator] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Armkhi Bike Park (Ingushetia, Russia) [1000 RUB] | 0 |  |  | RU: nothing mtb-tagged near most pins; operator sites are the only source. |
| Bike Park Kasina (PL) [169 PLN] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Bike Park Palenica (Ustron, Poland) [99 PLN] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Bikepark Spicak (Sumava, CZ) [940 CZK] | 1 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Bobrovy Log Bike Park (Krasnoyarsk, Russia) | 0 |  |  | RU: nothing mtb-tagged near most pins; operator sites are the only source. |
| Branas Bike Park (Varmland, Sweden) [chairlift] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Caldirola Bike Park (Piedmont Apennines) [lift pass] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Cerkno Bike Park (Slovenia) [check operator] | 1 |  |  | SI: grade can live in marked_trail rather than colour. |
| Cerler Bike Park (Pyrenees, ES) [chairlift] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. |
| Cheile Gradistei Bikepark (Fundata, Romania) [ski lift] | 0 |  |  | RO: some route=mtb relations exist, otherwise operator site. |
| Cimone Bike Park (Sestola, Emilia-Romagna) [lift pass] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Gerardmer Bike Park (Vosges) [lift pass] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. |
| Glencoe Mountain Bike Park (Scotland) [35 GBP] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. |
| Gravity Park Kotelnica (Bialka Tatrzanska, Poland) [120 PLN] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Gressoney - Weissmatten (Monterosa, Aosta Valley) [check operator] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Hemsedal Rides (Norway) [chairlift] | 1 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Hlíðarfjall Bike Park (Iceland) [chairlifts] | 0 |  |  | Nordics: OSM thin. |
| Koninki Gravity Park (Gorce, Poland) [80 PLN] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| La Colmiane (Valdeblore, Mercantour) [15 EUR] | 1 |  |  | FR: OSM runs are route=mtb relations carrying colour. |
| La Pierre Saint-Martin (Pyrenees-Atlantiques, France) [chairlift] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. |
| Monte Alpet Bike Park - San Giacomo di Roburent (Piedmont) [18 EUR] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Monte Pora - Cima Pora (Val Seriana, Lombardy) [check operator] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Munaka Bike and Hike Park (Estonia) [chairlift price unverified] | 0 |  |  | Baltics: flat, small networks, OSM patchy. |
| Nara Bike Park - Leontica (Ticino) [39 CHF] | 1 |  |  | CH: operator sites sometimes ship SchweizMobil GPX (airolo.ch does); OSM mixes way tags and route=mtb. |
| Pamporovo Bike Park (Bulgaria) [chairlift] | 1 |  |  | BG: little bike tagging, ski pistes tagged bicycle=no are not runs. |
| Spiazzi di Gromo Bike Park (Val Seriana) [18 EUR] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Tjorhomfjellet Bike Park (Sirdal, Norway) [check operator] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Trail Park Dolni Morava (CZ) [lift price unverified] | 1 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Vall de Nuria Bike Park (Catalonia, ES) [rack railway] | 0 |  |  | ES: operators publish paper maps only, OSM coverage thin. |
| Vatra Dornei Bike Park (Suceava, RO) [ski lift] | 0 |  |  | RO: some route=mtb relations exist, otherwise operator site. |
| Vitosha Mountain Bike Park (Bulgaria) [chairlift] | 1 |  |  | BG: little bike tagging, ski pistes tagged bicycle=no are not runs. |
| Yxbacken Cykelpark (Norrkoping, Sweden) [200 SEK] | 1 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Wexl Trails (St. Corona am Wechsel, Austria) [t-bar] | 0 |  |  | AT: way tags plus route=mtb colours. |
| Bikepark Koenigsberg - Hollenstein an der Ybbs (Austria) [check operator] | 0 |  |  | AT: way tags plus route=mtb colours. |
| Cwmcarn Forest (Wales) [uplift extra] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Dajti Mountain Enduro (Tirana, AL) [gondola] | 0 |  |  | Balkans: OSM patchy, check the operator site. |
| Kirroughtree - 7stanes (Scotland) [free, parking charge] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Meiringen-Hasliberg Trail (Bernese Oberland, Switzerland) [gondola] | 0 |  |  | CH: operator sites sometimes ship SchweizMobil GPX (airolo.ch does); OSM mixes way tags and route=mtb. |
| Moray Monster Trails (Moray, Scotland) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Mount Parnitha Enduro (Athens, GR) [no lift] | 0 |  |  | Little bike tagging; natural spot methods apply. No lift: try the OSM GPS trace archive. |
| Vodno - Skopje (North Macedonia) [gondola normally carries bikes] | 0 |  |  | Balkans: OSM patchy, check the operator site. |
| Bike Park Valbirse [from 15 CHF] | 0 |  |  | CH: operator sites sometimes ship SchweizMobil GPX (airolo.ch does); OSM mixes way tags and route=mtb. |
| Bikepark Tres Cantos (Madrid, Spain) [5 EUR] | 0 |  |  | ES: operators publish paper maps only, OSM coverage thin. No lift: try the OSM GPS trace archive. |
| TrailGround Brilon (Sauerland, Germany) [free, no lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| 417 Bike Park (Gloucestershire, England) [43 GBP uplift] | 1 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. |
| Ale Bikepark (Sweden) [180 SEK] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Bike Park Kernow (Cornwall, UK) [shuttle] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. |
| Bike Park Kurza Gora (Kurzetnik, Poland) [79 PLN] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. |
| Bikepark Albstadt (Swabian Alb, Germany) [24 EUR] | 1 |  |  | DE: densely tagged in OSM, colour on the ways. |
| Bikepark Burladingen (Swabian Alb, Germany) [25 EUR] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. |
| Bjelasnica Bike Park (Bosnia and Herzegovina) [lift pass] | 0 |  |  | Balkans: OSM patchy, check the operator site. |
| Funbase Holzmeisterlift (Styria) [34 EUR] | 0 |  |  | AT: way tags plus route=mtb colours. |
| Green Hill Bikepark (Schmallenberg, Germany) [lift pass] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. |
| Hammarbybacken Bike Park (Stockholm, Sweden) [150 SEK] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Havok Bike Park - Calder Valley (England) [45 GBP uplift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. |
| Kokonniemi Bike Park (Porvoo, Finland) [25 EUR] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Nordfjord Stisenter (Stryn, Norway) [check operator] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Okeford Hill Bike Park (Dorset, England) [25 GBP uplift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. |
| Rayder Bike Park (Miass, Russia) [350 RUB] | 0 |  |  | RU: nothing mtb-tagged near most pins; operator sites are the only source. |
| Ski Bike Hike Ulricehamn (Sweden) [340 SEK] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| Sodra Berget Bikepark (Sundsvall, Sweden) [check operator] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. |
| The GAP Bikepark (Dublin, IE) [shuttle price unverified] | 0 |  |  | IE: OSM thin, trace archive worth a try. |
| Trailpark Erbeskopf (Hunsrueck, Germany) [25 EUR] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. |
| Highland Wildcat - Golspie (Scotland) [free] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Rostrevor - Kilbroney (Northern Ireland) [free, uplift extra] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| 7stanes Dalbeattie (Dumfries and Galloway, Scotland) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Brechfa Forest (Carmarthenshire, Wales) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Kangerlussuaq Arctic MTB (Greenland) [no lift] | 0 |  |  | Remote, expect nothing mapped. No lift: try the OSM GPS trace archive. |
| Mont Ventoux (Vaucluse, France) [no-lift] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. No lift: try the OSM GPS trace archive. |
| Bike Park Janov (Presov, Slovakia) [free] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. No lift: try the OSM GPS trace archive. |
| Swinley Forest (Berkshire, England) [free, parking charge] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Akersjon Bikepark (Jamtland, Sweden) [150 SEK] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. No lift: try the OSM GPS trace archive. |
| Bareges - Grand Tourmalet Bike Park (Hautes-Pyrenees) [24 EUR, closed 2026] | 0 |  |  | Marked closed for 2026 - deprioritise. |
| Dirtpark Boppard (Rhineland-Palatinate, Germany) [no-lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Dirtpark Leinfelden (Germany) [free, no lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Dirtpark Traintrails (Bavaria, Germany) [no-lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Isle of Wight Mountain Bike Centre (England) [day permit] | 1 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Massif du Garlaban (Bouches-du-Rhone, France) [no-lift] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. No lift: try the OSM GPS trace archive. |
| Bike Park de Cormaranche-en-Bugey (Ain) [free] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. No lift: try the OSM GPS trace archive. |
| 7stanes Glentrool (Galloway Forest Park, Scotland) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| 7stanes Mabie (Dumfries and Galloway, Scotland) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Whinlatter Forest (Lake District, England) [free, parking charge] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Monte Sao Marcos Bikepark (Caramulo, Portugal) [no lift] | 0 |  |  | PT: OSM thin, check the operator site. No lift: try the OSM GPS trace archive. |
| Bikepark Osternohe (Franconia, Germany) [23 EUR] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Nesbyen MTB (Norway) [shuttle] | 1 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. No lift: try the OSM GPS trace archive. |
| Grizedale Forest (Lake District, England) [free, parking charge] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Slavex Trails (Zlin, Czech Republic) [free] | 1 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. No lift: try the OSM GPS trace archive. |
| Bikepark Trippstadt (Palatinate, Germany) [no lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Brattbakken Sykkelpark (Trondelag, Norway) [100 NOK] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. No lift: try the OSM GPS trace archive. |
| Monte Amiata Freeride (Tuscany) [uplift days] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Riekstukalns DH Trails (Latvia) [no public uplift verified] | 0 |  |  | Baltics: flat, small networks, OSM patchy. |
| Sanremo - Monte Bignone Enduro (Liguria) [shuttle, natural] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. |
| Sigulda DH Trails (Latvia) [no public uplift verified] | 0 |  |  | Baltics: flat, small networks, OSM patchy. |
| Traktor Bike Park (Gjovik, Norway) [shuttle] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. No lift: try the OSM GPS trace archive. |
| Trans Madeira (Portugal) [six-day enduro, shuttle event] | 0 |  |  | PT: OSM thin, check the operator site. |
| ABC Bike Park (Hautes-Alpes, France) [check operator] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. No lift: try the OSM GPS trace archive. |
| Awaba Mountain Bike Park (New South Wales, Australia) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| B-trails (Belgium) [free, no lift] | 0 |  |  | BE/NL: small hills, watch the drop test (25 m / 4% branch). No lift: try the OSM GPS trace archive. |
| Bike Park Barbieri (Lombardy, Italy) [no-lift] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. No lift: try the OSM GPS trace archive. |
| Bike Park Olomouc (Moravia, Czech Republic) [free] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. No lift: try the OSM GPS trace archive. |
| Bike Park de Communay (Rhone, France) [check operator] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. No lift: try the OSM GPS trace archive. |
| Bike Saloon Skillpark (Austria) [free, no lift] | 0 |  |  | AT: way tags plus route=mtb colours. No lift: try the OSM GPS trace archive. |
| Bike park Ljubljana (Ljubljana, Slovenia) [no-lift] | 0 |  |  | SI: grade can live in marked_trail rather than colour. No lift: try the OSM GPS trace archive. |
| Bike-Park Bollenbach (Black Forest, Germany) [check operator] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Bike-Park Burglauer (Germany) [free, no lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| BikeParkRotterdam (South Holland, Netherlands) [no-lift] | 0 |  |  | BE/NL: small hills, watch the drop test (25 m / 4% branch). No lift: try the OSM GPS trace archive. |
| Bikepark Attendorn (Sauerland, Germany) [no lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Bikepark Bad Saulgau (Baden-Wurttemberg, Germany) [free] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Bikepark Birchi (Switzerland) [free, no lift] | 0 |  |  | CH: operator sites sometimes ship SchweizMobil GPX (airolo.ch does); OSM mixes way tags and route=mtb. No lift: try the OSM GPS trace archive. |
| Bikepark Eisingen (Bavaria, Germany) [no-lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Bikepark Hostivař (Prague, Czech Republic) [no-lift] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. No lift: try the OSM GPS trace archive. |
| Bikepark Jumpzone Zilina - Solinky (Zilina, Slovakia) [free] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. No lift: try the OSM GPS trace archive. |
| Bikepark Leibstadt (Aargau, Switzerland) [free] | 1 |  |  | CH: operator sites sometimes ship SchweizMobil GPX (airolo.ch does); OSM mixes way tags and route=mtb. No lift: try the OSM GPS trace archive. |
| Bikepark Memmingen (Bavaria, Germany) [free] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Bikepark Mook (Netherlands) [free, no lift] | 0 |  |  | BE/NL: small hills, watch the drop test (25 m / 4% branch). No lift: try the OSM GPS trace archive. |
| Bikepark Okarben (Germany) [free, no lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Bikepark Pfäffikon ZH (Zurich, Switzerland) [free] | 0 |  |  | CH: operator sites sometimes ship SchweizMobil GPX (airolo.ch does); OSM mixes way tags and route=mtb. No lift: try the OSM GPS trace archive. |
| Bikepark Rennacker - Insul (Eifel, Germany) [free] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Bikepark Schmausenbuck (Nuremberg, Germany) [no-lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Bikepark Siegbach (Hessen, Germany) [no-lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Bikepark Sint-Denijs (West Flanders, Belgium) [no-lift] | 0 |  |  | BE/NL: small hills, watch the drop test (25 m / 4% branch). No lift: try the OSM GPS trace archive. |
| Bikepark Spaarnwoude (Netherlands) [free, no lift] | 0 |  |  | BE/NL: small hills, watch the drop test (25 m / 4% branch). No lift: try the OSM GPS trace archive. |
| Bikepark WSV Eppenschlag (Germany) [free, no lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Bikeplace Rot an der Rot (Baden-Wurttemberg, Germany) [no-lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Bittola Bike Park (Basque Country, Spain) [no-lift] | 0 |  |  | ES: operators publish paper maps only, OSM coverage thin. No lift: try the OSM GPS trace archive. |
| Boy Konen Bike Park (Luxembourg City) [free, no lift] | 0 |  |  | Small hill, watch the drop test. No lift: try the OSM GPS trace archive. |
| Bronx MTB (Central Jutland, Denmark) [no-lift] | 0 |  |  | Nordics: flat, expect the 25 m / 4% branch of the drop test to decide. No lift: try the OSM GPS trace archive. |
| Caceira Bike Park (Coimbra, Portugal) [no-lift] | 0 |  |  | PT: OSM thin, check the operator site. No lift: try the OSM GPS trace archive. |
| Cerveny breh (Slovakia) [free, no lift] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. No lift: try the OSM GPS trace archive. |
| Cjampagnatis BND BikePark (Friuli-Venezia Giulia, Italy) [no-lift] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. No lift: try the OSM GPS trace archive. |
| DAV Bikepark Skillup - Augsburg (Germany) [free for DAV members] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| DAV Bikepark Wetzlar (Hesse, Germany) [free] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Dirtcore-Zone (Saxony, Germany) [no-lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| E-Bike Park Oetz (Oetz, Tyrol, Austria) [no-lift] | 0 |  |  | AT: way tags plus route=mtb colours. No lift: try the OSM GPS trace archive. |
| Espace VTT du Parc de Figuerolles (Martigues, France) [no-lift] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. No lift: try the OSM GPS trace archive. |
| Farmer Johns MTB Park (Stockport, England) [12 GBP] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Flowtrail Bad Endbach (Hessen, Germany) [no-lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| GKUC gorsko kolesarski učni center Pristava (Upper Carniola, Slovenia) [no-lift] | 0 |  |  | SI: grade can live in marked_trail rather than colour. No lift: try the OSM GPS trace archive. |
| Green Zone MTB (Moselle, France) [no-lift] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. No lift: try the OSM GPS trace archive. |
| Harstad Sykkelpark (Troms, Norway) [no-lift] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. No lift: try the OSM GPS trace archive. |
| Heidenloch Bikepark (Braunlingen, Black Forest) [no lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Hemlock Stone Mountainbiking Trails (Nottinghamshire, UK) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Ironracing Bikepark (Burgenland, Austria) [no-lift] | 0 |  |  | AT: way tags plus route=mtb colours. No lift: try the OSM GPS trace archive. |
| Juraflow (Germany) [free, no lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| La Poma Bike Park (Barcelona, Spain) [day pass] | 1 |  |  | ES: operators publish paper maps only, OSM coverage thin. No lift: try the OSM GPS trace archive. |
| MTB Traily Bikos (Slovakia) [free, no lift] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. No lift: try the OSM GPS trace archive. |
| Matarranya Dirt Park (Spain) [free, no lift] | 0 |  |  | ES: operators publish paper maps only, OSM coverage thin. No lift: try the OSM GPS trace archive. |
| Molyne Bike Park (Vilnius, LT) [no lift] | 0 |  |  | Baltics: flat, small networks, OSM patchy. No lift: try the OSM GPS trace archive. |
| Mountainbikeclub Bar End Apeldoorn (Gelderland, Netherlands) [no-lift] | 0 |  |  | BE/NL: small hills, watch the drop test (25 m / 4% branch). No lift: try the OSM GPS trace archive. |
| Mountainbikepark (Mecklenburg-Vorpommern, Germany) [no-lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| OD Trails - Bikepark Oberndorf (Austria) [free, no lift] | 0 |  |  | AT: way tags plus route=mtb colours. No lift: try the OSM GPS trace archive. |
| Oaza Trail Park (Slovakia) [free, no lift] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. No lift: try the OSM GPS trace archive. |
| Park4All (Switzerland) [free, no lift] | 0 |  |  | CH: operator sites sometimes ship SchweizMobil GPX (airolo.ch does); OSM mixes way tags and route=mtb. No lift: try the OSM GPS trace archive. |
| Ponte de Lima Bike Park (Portugal) [no lift] | 1 |  |  | PT: OSM thin, check the operator site. No lift: try the OSM GPS trace archive. |
| Shredhill Bike Park (Gloucestershire, England) [check operator] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Silkeborg BikePark (Denmark) [free, no lift] | 0 |  |  | Nordics: flat, expect the 25 m / 4% branch of the drop test to decide. No lift: try the OSM GPS trace archive. |
| Skillpark v Díře (Hradec Kralove, Czech Republic) [no-lift] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. No lift: try the OSM GPS trace archive. |
| Swiss Bike Park Oberried (Bern, Switzerland) [free] | 0 |  |  | CH: operator sites sometimes ship SchweizMobil GPX (airolo.ch does); OSM mixes way tags and route=mtb. No lift: try the OSM GPS trace archive. |
| Tesa Bike Park (Veneto, Italy) [no-lift] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. No lift: try the OSM GPS trace archive. |
| Thy MTB Park (Denmark) [free, no lift] | 0 |  |  | Nordics: flat, expect the 25 m / 4% branch of the drop test to decide. No lift: try the OSM GPS trace archive. |
| Trail Park Saporo (Karlovy Vary, Czech Republic) [no-lift] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. No lift: try the OSM GPS trace archive. |
| Trail-Park Werlte (Lower Saxony, Germany) [no-lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Trailcenter Aesch (Basel-Landschaft, Switzerland) [no-lift] | 0 |  |  | CH: operator sites sometimes ship SchweizMobil GPX (airolo.ch does); OSM mixes way tags and route=mtb. No lift: try the OSM GPS trace archive. |
| Trailpark Mehring (Rhineland-Palatinate, Germany) [no-lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Twisted Oaks Bike Park (Ipswich, England) [11 GBP] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Ulsteinvik MTB Park (More og Romsdal, Norway) [no-lift] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. No lift: try the OSM GPS trace archive. |
| Vangaberget Trailcenter (Kristianstad, Sweden) [check operator] | 0 |  |  | Nordics: OSM coverage is decent and operators publish trail maps. No lift: try the OSM GPS trace archive. |
| Velorium Bikepark (Limburg, Netherlands) [check operator] | 0 |  |  | BE/NL: small hills, watch the drop test (25 m / 4% branch). No lift: try the OSM GPS trace archive. |
| Wadowice Trails (Lesser Poland, Poland) [no-lift] | 0 |  |  | CEE: the community maps its runs into OSM, often as network=lcn with a signed colour. No lift: try the OSM GPS trace archive. |
| Warsteiner Bikepark (Ruthen, Germany) [no-lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Wind Hill Bike Park (Wiltshire, England) [paid entry] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| X-Trail Schwarzenbruck (Germany) [free, no lift] | 0 |  |  | DE: densely tagged in OSM, colour on the ways. No lift: try the OSM GPS trace archive. |
| Forest of Dean - Cannop (England) [free, uplift extra] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| 7stanes Ae (Dumfries and Galloway, Scotland) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| 7stanes Newcastleton (Scottish Borders, Scotland) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Altai Tavan Bogd Downhill Expedition (Mongolia) [4x4 supported, no lift] | 0 |  |  | RU: nothing mtb-tagged near most pins; operator sites are the only source. No lift: try the OSM GPS trace archive. |
| Aston Hill Bike Park (Buckinghamshire, UK) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Bedgebury Forest (Kent, UK) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Cannock Chase (Staffordshire, UK) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Comrie Croft (Perth and Kinross, Scotland) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Cote Bleue - Chaine de l'Estaque (Bouches-du-Rhone, France) [no-lift] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. No lift: try the OSM GPS trace archive. |
| Dalby Forest (North Yorkshire, UK) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Durmitor - Zabljak (Montenegro) [no lift] | 1 |  |  | Balkans: OSM patchy, check the operator site. No lift: try the OSM GPS trace archive. |
| Elvo Natural Trail (Graglia) [no lift] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. No lift: try the OSM GPS trace archive. |
| Foret de Janas - Cap Sicie (Var, France) [no-lift] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. No lift: try the OSM GPS trace archive. |
| Gisburn Forest (England) [free, parking charge] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Grand Cunay / Col du Marchairuz [no lift] | 0 | ✅ |  | Coeur rouge and Descente du Mont Bailly are Biere, not Grand Cunay - do not re-add. |
| Kolasin - Bjelasica and Sinjajevina (Montenegro) [no bike lift documented] | 0 |  |  | Balkans: OSM patchy, check the operator site. No lift: try the OSM GPS trace archive. |
| Lanzo Valley Enduro [no lift] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. No lift: try the OSM GPS trace archive. |
| Le Suchet (Jura vaudois) [no lift] | 1 |  |  | CH: operator sites sometimes ship SchweizMobil GPX (airolo.ch does); OSM mixes way tags and route=mtb. No lift: try the OSM GPS trace archive. |
| Learnie Red Rocks (Black Isle, Scotland) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Lee Quarry (Lancashire, UK) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Mavrovo National Park (North Macedonia) [no bike lift documented] | 0 |  |  | Balkans: OSM patchy, check the operator site. No lift: try the OSM GPS trace archive. |
| Parc naturel regional de la Sainte-Baume (Var, France) [no-lift] | 0 |  |  | FR: OSM runs are route=mtb relations carrying colour. No lift: try the OSM GPS trace archive. |
| Peja - Rugova and Accursed Mountains (Kosovo) [no lift] | 0 |  |  | Balkans: OSM patchy, check the operator site. No lift: try the OSM GPS trace archive. |
| Punta Ala Trail Center (Tuscany, Italy) [shuttle extra] | 0 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. No lift: try the OSM GPS trace archive. |
| Sisimiut Backcountry Trails (Greenland) [no lift] | 0 |  |  | Remote, expect nothing mapped. No lift: try the OSM GPS trace archive. |
| Stainburn Forest (North Yorkshire, UK) [no-lift] | 0 |  |  | UK: OSM and the GPS trace archive are both dense; some networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Suior Bike Park (Baia Sprie, Romania) [chairlift] | 0 |  |  | RO: some route=mtb relations exist, otherwise operator site. No lift: try the OSM GPS trace archive. |
| Val d'Angrogna (Val Pellice) [no lift] | 1 |  |  | IT: way tags and route=mtb both used; check for a Google My Maps mid on the operator page. No lift: try the OSM GPS trace archive. |

## North America

| Spot | Traces | OSM search | Web search | Comments |
| :-- | :-: | :-: | :-: | :-- |
| Boyne Mountain Bike Park (Michigan) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Sunlight Mountain (Colorado) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Sugarbush Bike Park (Vermont) [60 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Plattekill Bike Park (Catskills, New York) [35 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Highland Mountain Bike Park (New Hampshire) [68-82 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Silver Mountain Bike Park - Kellogg (Idaho) [50 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Sir Sam's Bike Park (Haliburton, Ontario) [check operator] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Fernie Alpine Resort (British Columbia) [lift ticket, price unverified] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| 49 Degrees North (Chewelah, Washington) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Red River (New Mexico) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Big White Bike Park (British Columbia, CA) [59 CAD] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Sunrise Bike Park (Arizona) [63 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Sentiers du Moulin (Quebec) [17 CAD] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Panorama Bike Park (Invermere, BC, CA) [chairlift] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Mount Snow Bike Park (Vermont) [55 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Wentworth Bike Park (Nova Scotia, Canada) [chairlift] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Valmont Bike Park (Colorado, USA) [free, no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| HoliMont Bike Park - Ellicottville (New York) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Valemount Bike Park (British Columbia) [free, membership encouraged] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Mount Kato Bike Park (Mankato, Minnesota) [5 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Blue Mountain Bike Park (Ontario) [59 CAD] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Greek Peak Bike Park - Cortland (New York) [35-38 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Purgatory Bike Park - Durango (Colorado) [49 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Parc du Mont-Comi Bike Park (Quebec) [25 CAD] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Beech Mountain Bike Park (North Carolina) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Granite Gorge Mountain Park (New Hampshire) [30 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Canmore Nordic Centre (Alberta, Canada) [park pass] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Coldwater Mountain (Alabama, USA) [free, no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| DuPont State Recreational Forest [no lift] | 1 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Phil's Trail Complex - Bend (Oregon, USA) [free, no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Vallee Bras-du-Nord (Quebec) [trail pass, no lift] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Kincaid Park Singletrack (Alaska) [no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Sugar Mountain Bike Park (North Carolina) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Swasey Recreation Area (Redding, California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Pomerelle Mountain Resort (Idaho, USA) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Coast Gravity Park (Sechelt, BC, Canada) [shuttle] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Windrock Bike Park (Tennessee) [150 USD 3-day shuttle] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Parc du Mont St-Mathieu (Quebec) [check operator] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Western Slope Trails - Massanutten (Virginia) [10 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| La Fragua Bike Park (Guanajuato) [50 MXN] | 0 |  |  | Little OSM tagging; check the operator site or a Google My Maps mid. |
| Yuca Xtreme Bike Park (Aguascalientes) [100 MXN] | 0 |  |  | Little OSM tagging; check the operator site or a Google My Maps mid. |
| Loon Mountain Bike Park (New Hampshire) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Mont Sainte-Cecile (Quebec) [paid access, no lift] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Murciélagos Bike Park (Puebla) [check operator] | 0 |  |  | Little OSM tagging; check the operator site or a Google My Maps mid. |
| Ober Mountain Bike Park (Gatlinburg, Tennessee) [49 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Punta Venado Bike Park (Playa del Carmen) [510 MXN] | 0 |  |  | Little OSM tagging; check the operator site or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Ski Apache (Ruidoso, New Mexico) [25 USD gondola] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Whiteface Mountain Bike Park (New York) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Smugglers' Notch Bike Park (Vermont, USA) [15 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Alyeska Bike Park - Girdwood (Alaska) [35 USD] | 1 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Attitash Bike Park (New Hampshire, US) [chairlift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Disco Bike Park - Discovery (Montana) [20 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| El Colorado Bike Park (Chile) [chairlift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Giants Ridge Bike Park (Minnesota) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Hatley Pointe Bike Park (North Carolina) [48 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Hilltop Bike Park (Alaska) [chairlift, season pass] | 1 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Jay Peak Bike Park (Vermont, US) [tram/chairlift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Lee Canyon Bike Park [lift pass] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Mount Baldy (California) [summer lift ticket] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Mount Hood Skibowl Bike Park (Oregon, USA) [chairlift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Mount Sima Bike Park (Yukon, CA) [40 CAD] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Mount Sunapee Bike Park (New Hampshire) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Mt. Abram Bike Park (Maine) [42 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Nitehawk Bike Park (Alberta, CA) [28 CAD] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Okemo Bike Park (Vermont, US) [chairlift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Powder Ridge Bike Park (Connecticut) [14-28 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Seven Springs Bike Park (Pennsylvania, USA) [chairlift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Taos Bike Park (New Mexico) [25 USD] | 1 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| The Summit Bike Park - Snoqualmie (Washington) [from 46 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Val Saint-Come Bike Park (Quebec) [check operator] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Waterville Valley Bike Park (New Hampshire) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Woodward Tahoe at Boreal (California) [25 USD] | 1 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Gooseberry Mesa (Utah, USA) [free, no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Keppoch Mountain (Nova Scotia, Canada) [shuttle] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Bailey Mountain Bike Park (North Carolina, USA) [paid entry] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Bike Park KRB (Hidalgo) [290 MXN] | 0 |  |  | Little OSM tagging; check the operator site or a Google My Maps mid. |
| Kelly Canyon Bike Park (Idaho) [30 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Wisp Resort Bike Park (Maryland) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Downieville Downhill (California) [25-40 USD shuttle] | 1 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Oakridge Alpine Trail Network [commercial shuttle] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Sedona Trail Network [no lift] | 1 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Duthie Hill Bike Park (Washington, USA) [free, no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Kolo Bike Park (North Carolina, USA) [19 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Kahakapao / Makawao Forest Reserve (Maui, US) [no lift, free] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Cypress Mountain Hardline venue (British Columbia) [event course, no public riding] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Retallack (British Columbia) [lodge package] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. |
| Shepherd Mountain Bike Park (Missouri) [free to ride, shuttle extra] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| ALTIBIKE (Mexico) [free, no lift] | 0 |  |  | Little OSM tagging; check the operator site or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Afton Alps (Minnesota) [9 USD trail fee] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Arkytox Bike Park (Aguascalientes) [no lift] | 0 |  |  | Little OSM tagging; check the operator site or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| BOC Ponca Downhill (Arkansas) [40 USD shuttle] | 1 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Bike Park of Santa Clarita (USA) [free, no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Capital Flow Norte (Mexico) [free, no lift] | 0 |  |  | Little OSM tagging; check the operator site or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Cookie Cutter Trail System (Washington, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Eaglecrest Flow Trail (Alaska) [no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Fraser Bike Park (USA) [free, no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Freeman Ridge Bike Park (Kingfield, Maine) [10 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Gem Lake Bike Park (USA) [free, no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Horns Hill Bike Park (Ohio) [free, shuttles vary] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Howler Bike Park (Missouri) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Kamloops Bike Ranch (British Columbia) [free, no lift] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Kelly Family Farms Bike Trails (Oklahoma, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Legacy Bike Park (Montana) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Lincoln Bike Park (USA) [free, no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Meteoro Bike Park (Querétaro) [40 MXN parking] | 0 |  |  | Little OSM tagging; check the operator site or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Millennium Cycle Bike Park (New Brunswick, Canada) [no-lift] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Mont du Lac Resort (Superior, Wisconsin) [free trails] | 1 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Phoenixville Bike Park (Pennsylvania, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Proctor Bike Park (Canada) [free, no lift] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Ride Kanuga (North Carolina, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Ride Rock Creek (North Carolina) [50-55 USD] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Shady Grove (Canada) [free, no lift] | 0 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Skypark (Lake Arrowhead, California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Tahoe Donner Bikeworks (Truckee, California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| The Summit Bechtel Reserve (West Virginia, USA) [free, check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Wilderness Camp Mountain Bike Trails (USA) [free, no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Pisgah National Forest [no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Virgin Freeride / Red Bull Rampage Zone [no lift] | 1 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Flagstaff MTB Network (Arizona) [no lift] | 1 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Alafia River State Park MTB [no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Briones Regional Park (California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| DeLaveaga Park (Santa Cruz, California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Homewood Mountain Resort (Lake Tahoe, California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Limerock Peak (Sylmar, California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Magic Mountain (Vermont) [check operator] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Markham Park MTB Trails (Florida) [no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Mission Ridge (Wenatchee, Washington) [check operator] | 1 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Mount Diablo State Park (California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Mount Seymour - North Shore (British Columbia) [free, no lift] | 1 |  |  | CA: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Oaxaca - Sierra Norte / Ixtepeji (MX) [shuttle, no lift] | 0 |  |  | Little OSM tagging; check the operator site or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Palisades Tahoe - Olympic Valley (Lake Tahoe, California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Parque Barrancas Trail Network (San Rafael) [no lift] | 0 |  |  | Little OSM tagging; check the operator site or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Peacock Flats / Kuaokala (Oahu, US) [permit access, no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Santos Trailhead / Cross Florida Greenway [no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Simas Peak - Toro Park (Monterey County, California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Skyline Wilderness Park (Napa, California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Sonoma Coast State Park - Willow Creek (California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| St Louis Heights / Waahila Ridge (Oahu, US) [access must be checked, no lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Towsley Canyon - Santa Clarita Woodlands (California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Waterdog Lake and Sugarloaf (Belmont, California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| Wilder Ranch State Park (Santa Cruz, California, USA) [no-lift] | 0 |  |  | US: runs are way tags fenced by the winter_sports polygon; many networks are Trailforks-only. No lift: try the OSM GPS trace archive. |
| West Mountain Bike Park (New York) [30 USD, suspended for 2026] | 0 |  |  | Suspended for 2026 - deprioritise. |

## Rest of the world

| Spot | Traces | OSM search | Web search | Comments |
| :-- | :-: | :-: | :-: | :-- |
| Smithfield Mountain Bike Park (Cairns, Australia) [free, shuttle extra] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. |
| Mystic Bike Park (Bright, Victoria, Australia) [shuttle] | 0 |  |  | DUPLICATE PIN of "Mystic Bike Park - Bright" (22 traces, 2 km away). Merge the pins instead of tracing. |
| Sorata MTB (Bolivia) [jeep shuttle] | 1 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Kaiteriteri Mountain Bike Park (Nelson, New Zealand) [free, donation] | 0 |  |  | NZ: OSM is well filled around Rotorua, Nelson and Queenstown - query OSM before the operator site. No lift: try the OSM GPS trace archive. |
| Bike Glendhu (Wanaka, NZ) [38 NZD] | 0 |  |  | NZ: OSM is well filled around Rotorua, Nelson and Queenstown - query OSM before the operator site. |
| The Gorge Mountain Bike Park (Nelson, New Zealand) [shuttle] | 0 |  |  | NZ: OSM is well filled around Rotorua, Nelson and Queenstown - query OSM before the operator site. |
| Cardrona Bike Park (New Zealand) [184 NZD] | 0 |  |  | NZ: OSM is well filled around Rotorua, Nelson and Queenstown - query OSM before the operator site. |
| Linga Longa Bike Park (Western Australia) [shuttle access] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. |
| Manara Cliff Bike Park (Upper Galilee, Israel) [cable-car fare] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Bakuriani Bike Park (Georgia) [gondola, price unverified] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Hakuba Iwatake Bike Park (Nagano) [4800 JPY] | 0 |  |  | JP: some resort runs are in OSM; watch pins shared with the adjacent resort. |
| Cerro Catedral (Bariloche, AR) [lift pass, price unverified] | 1 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. |
| Mona YongPyong MTB Park (Pyeongchang, KR) [gondola, public price unverified] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Niseko Hanazono Mountain Bike Park (Hokkaido) [3800 JPY] | 1 |  |  | JP: some resort runs are in OSM; watch pins shared with the adjacent resort. |
| Valle Nevado Bike Park (Chile) [chairlift] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. |
| Signal Hill (Dunedin, New Zealand) [no-lift] | 0 |  |  | NZ: OSM is well filled around Rotorua, Nelson and Queenstown - query OSM before the operator site. No lift: try the OSM GPS trace archive. |
| Terra na Veia Bike Park (Ceará) [30 BRL] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Blue River Provincial Park MTB (Yate, NC) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Chapelco Bike Park (Neuquen, AR) [summer rate unverified] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. |
| Fox Creek Bike Park (South Australia) [free, no lift] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. No lift: try the OSM GPS trace archive. |
| Genting Secret Garden MTB (Chongli, CN) [summer status unverified] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Thaiwoo Bike Park (Chongli, CN) [gondola price unverified] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Congo Nile Trail (Rwanda) [multi-day, no lift] | 0 |  |  | Little MTB tagging; guide or club site, else DEM-profile the paths. No lift: try the OSM GPS trace archive. |
| Karkloof Country Club MTB (South Africa) [permit, no lift] | 0 |  |  | ZA: estate trails are bicycle=designated and invisible to the mtb-tag query - search by name instead. No lift: try the OSM GPS trace archive. |
| St Helens and Bay of Fires (Tasmania, Australia) [free, shuttle extra] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. No lift: try the OSM GPS trace archive. |
| Thaba Trails (Johannesburg, South Africa) [R80, no lift] | 0 |  |  | ZA: estate trails are bicycle=designated and invisible to the mtb-tag query - search by name instead. No lift: try the OSM GPS trace archive. |
| Yungas Road - Death Road (Bolivia) [80-130 USD guided] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Duolemeidi Bike Park (Chongli, CN) [lift status unverified] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Giba Gorge MTB Park (Durban, South Africa) [from R70, no lift] | 0 |  |  | ZA: estate trails are bicycle=designated and invisible to the mtb-tag query - search by name instead. No lift: try the OSM GPS trace archive. |
| Nevados de Chillan (Nuble, CL) [lift pass, price unverified] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. |
| Mo'Bike Chamouny (Mauritius) [4x4 shuttle] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Nozawa Onsen MTB Park (Nagano) [gondola, price varies] | 0 |  |  | JP: some resort runs are in OSM; watch pins shared with the adjacent resort. |
| Makara Peak Mountain Bike Park (Wellington, New Zealand) [no-lift] | 0 |  |  | NZ: OSM is well filled around Rotorua, Nelson and Queenstown - query OSM before the operator site. No lift: try the OSM GPS trace archive. |
| You Yangs Regional Park (Victoria, Australia) [free, park entry] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. No lift: try the OSM GPS trace archive. |
| Hakuba 47 Mountain Bike Park (Nagano) [1200 JPY, no lift] | 0 |  |  | JP: some resort runs are in OSM; watch pins shared with the adjacent resort. No lift: try the OSM GPS trace archive. |
| La Parva (Santiago, CL) [lift pass, price unverified] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. |
| Fatikchhari Enduro Area (Bangladesh) [historic race, access unverified] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Foret de Montravail MTB (Martinique, MQ) [shared trails, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Kok-Zhailau MTB (Almaty, KZ) [shared trails, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Moorea Pineapple Route / Opunohu (PF) [shared tracks, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Morne Gommier MTB (Martinique, MQ) [shared tracks, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Trace des Jesuites (Martinique, MQ) [shared rainforest trail, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| High1 Resort Bike Park (Gangwon-do, KR) [gondola] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Lake Mountain Bike Park (Victoria, Australia) [free entry, 38 AUD shuttle] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. No lift: try the OSM GPS trace archive. |
| Myoko Suginohara MTB (Niigata) [gondola, details unverified] | 0 |  |  | JP: some resort runs are in OSM; watch pins shared with the adjacent resort. |
| Quanlin Daray Bike Park (Zhongshan, CN) [cable-car price unverified] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Shymbulak Bike Park (Almaty, KZ) [uplift status unverified] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Cerro Aspero MTB (Uruguay) [no lift] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| El Zur (Volcan de Agua, GT) [guided only, 90-199 USD] | 0 |  |  | Central America: nothing mtb-tagged; operator or guide site. |
| Cerro Bayo Bike Park (Villa La Angostura, AR) [chairlift] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. |
| Coronet Peak Bike Park (New Zealand) [chairlift] | 1 |  |  | NZ: OSM is well filled around Rotorua, Nelson and Queenstown - query OSM before the operator site. |
| Fujiten Resort (Yamanashi) [lift pass, price unverified] | 0 |  |  | JP: some resort runs are in OSM; watch pins shared with the adjacent resort. |
| Oukaimeden High Atlas Enduro (MA) [no lift] | 0 |  |  | Little MTB tagging; DEM-profiling the mule/hiking paths, as done for the High Atlas. No lift: try the OSM GPS trace archive. |
| Luang Prabang Jungle MTB (Laos) [guided, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Yetopia MTB Park (Yilan, TW) [shuttle, NT$300] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Huagal Bike Park (Oxapampa, Peru) [booking required] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Iron Throne Bike Park (Hartbeespoort, South Africa) [R50 trails + R250 cableway] | 0 |  |  | ZA: estate trails are bicycle=designated and invisible to the mtb-tag query - search by name instead. |
| Mount Tochal / Tehran Foothills (IR) [gondola bike access unverified] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Quito TeleferiQo / Cruz Loma (Ecuador) [gondola DH, from 5.25 USD] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. |
| Wadi Degla Protectorate MTB (Egypt) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Cikole Gravity Trails (Lembang, ID) [shuttle, price unverified] | 1 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Downhill MTB Kitulgala (Sri Lanka) [truck shuttle] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Fourforty MTB Park (Waikato, New Zealand) [shuttle] | 0 |  |  | NZ: OSM is well filled around Rotorua, Nelson and Queenstown - query OSM before the operator site. |
| Gochang MTB Park (Jeonbuk, KR) [no public uplift verified] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Mangsang Bike Park (Batam, ID) [uplift price unverified] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Timberland Mountain Bike Park (Rizal, PH) [250-550 PHP] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Zoom Bike Park (Campos do Jordao, BR) [price unverified] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. |
| Domaine de Deva MTB (Bourail, NC) [no lift, free] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Mabira Forest MTB Trail (Uganda) [no lift] | 0 |  |  | Little MTB tagging; guide or club site, else DEM-profile the paths. No lift: try the OSM GPS trace archive. |
| Cerduo Bike Park (Pucon, Chile) [3000-10000 CLP] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Bagofit MTB Circuit (Cameroon) [race venue, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Banco Forest MTB Loop (Côte d'Ivoire) [no lift, verify park access] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Bukit Timah MTB Trail (Singapore) [no lift, free] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Kilimanjaro Kilema MTB Route (Tanzania) [permit and guide required] | 0 |  |  | Little MTB tagging; guide or club site, else DEM-profile the paths. No lift: try the OSM GPS trace archive. |
| Vallée de Ferney MTB (Mauritius) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Abaga Forest MTB Loop (Gabon) [community route, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| El Santisimo Downhill (Urubamba, Peru) [race course, access unverified] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. |
| Nore Bike Park (Itu, Brazil) [50 BRL] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Twin Lakes MTB Trail (Tagaytay, PH) [access status unverified] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Antongona Highlands MTB (Madagascar) [guide recommended] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Jyrgalan Valley MTB (Kyrgyzstan) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Panteon Bikepark (Guayaquil, Ecuador) [registration required] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Afriski Mountain MTB (Lesotho) [no summer lift confirmed] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Darjeeling / Senchal MTB (West Bengal, IN) [guided, no lift] | 0 |  |  | Little MTB tagging; DEM-profiling the hiking-path network may be the only route. No lift: try the OSM GPS trace archive. |
| Dizin / Shemshak Alborz Enduro (IR) [no verified bike lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Hellsend Dirt Compound (South Africa) [DarkFest venue, private] | 0 |  |  | ZA: estate trails are bicycle=designated and invisible to the mtb-tag query - search by name instead. |
| Kintamani / Mount Batur MTB (Bali, ID) [guided shuttle] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Manizales / Neira Coffee Trails (CO) [shuttle, price unverified] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. |
| Rosso Cup MTB Course (Lae, Papua New Guinea) [annual event] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. |
| Santa Elena / Medellin Enduro (CO) [shuttle, price unverified] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. |
| Spirit Mountain / Manabao (Dominican Republic) [access unverified] | 0 |  |  | Nothing mtb-tagged; guide or club site. |
| Valparaiso Cerro Abajo (Chile) [urban DH event course] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. |
| Jarrod's Place Bike Park (Georgia) [check operator] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Buen Camino Bike Park (San Mateo, CR) [25 USD, no lift] | 0 |  |  | Central America: nothing mtb-tagged; operator or guide site. No lift: try the OSM GPS trace archive. |
| Canal Aventura Bike Park (Paraná) [20-40 BRL] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Chestnut Nature Park MTB Trails (Singapore) [no lift, free] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Chiche Trails (Tumbaco, Ecuador) [check operator] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Craters MTB Park (Taupo, New Zealand) [no-lift] | 0 |  |  | NZ: OSM is well filled around Rotorua, Nelson and Queenstown - query OSM before the operator site. No lift: try the OSM GPS trace archive. |
| Glenorchy Mountain Bike Park (Hobart, Tasmania, Australia) [no-lift] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. No lift: try the OSM GPS trace archive. |
| Guagualzhumi Bike Park (Paccha, Ecuador) [check operator] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Jebel Sifah MTB Trails (Oman) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Kereita Forest MTB Park (Kenya) [no lift, shuttle days] | 0 |  |  | Little MTB tagging; guide or club site, else DEM-profile the paths. No lift: try the OSM GPS trace archive. |
| Klangon Merapi DH (Yogyakarta, ID) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Nanji Hangang Extreme Bike Park (Seoul, KR) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Penguin Mountain Bike Park (Tasmania, Australia) [no-lift] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. No lift: try the OSM GPS trace archive. |
| Promisedland Mountain Bike Trails (Queensland, Australia) [no-lift] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. No lift: try the OSM GPS trace archive. |
| Railton - Wild Mersey Mountain Bike Trails (Tasmania, Australia) [no-lift] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. No lift: try the OSM GPS trace archive. |
| Shahdag Mountain Cycling (Azerbaijan) [no bike lift documented] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Vista Alegre Bike Park (Curitiba) [free, no lift] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Wellington Trailhead - Wellington Mountain Bike Trails (Western Australia, Australia) [no-lift] | 0 |  |  | NZ: OSM is well filled around Rotorua, Nelson and Queenstown - query OSM before the operator site. No lift: try the OSM GPS trace archive. |
| Woodhill Mountain Bike Park (Auckland, New Zealand) [no-lift] | 0 |  |  | NZ: OSM is well filled around Rotorua, Nelson and Queenstown - query OSM before the operator site. No lift: try the OSM GPS trace archive. |
| Águas da Serra Bike Park (Paraná) [20-30 BRL] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Nerang National Park (Gold Coast, Australia) [no-lift] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. No lift: try the OSM GPS trace archive. |
| Phnom Kulen MTB (Cambodia) [guided, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Atherton Forest Mountain Bike Park (Queensland, Australia) [free, no lift] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. No lift: try the OSM GPS trace archive. |
| Ourimbah State Forest (NSW, Australia) [no-lift] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. No lift: try the OSM GPS trace archive. |
| Djibloho / Oyala MTB Loop (Equatorial Guinea) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Fenghuang Mountain Greenway (Shenzhen, CN) [no lift, free] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Gudauri Bike Trails (Georgia) [summer lifts] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Shenzhen Wutong Mountain MTB Trails (CN) [no lift] | 1 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Pic Paradis (Saint Martin, MF) [access must be checked, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Aburi / Akuapem MTB Trails (Ghana) [guided, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Baegyangsan MTB Trails (Busan, KR) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Beijing Xishan / Xiangshan MTB Trails (CN) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Bisdary Downhill Track (Guadeloupe, GP) [no lift, free] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Bogd Khan Mountain Trails (Mongolia) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Borana / Mount Kenya Enduro (Kenya) [no lift, access by event or guide] | 0 |  |  | Little MTB tagging; guide or club site, else DEM-profile the paths. No lift: try the OSM GPS trace archive. |
| Chimgan - Ugam-Chatkal (Uzbekistan) [no bike lift documented] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Chinguetti / Adrar Desert MTB (Mauritania) [expedition, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Chouf - Barouk Cedar Reserve MTB (Lebanon) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Craigieburn Trails (Canterbury, New Zealand) [free, no lift] | 0 |  |  | NZ: OSM is well filled around Rotorua, Nelson and Queenstown - query OSM before the operator site. No lift: try the OSM GPS trace archive. |
| Da Lat Pine Forest MTB (Vietnam) [guided, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Dali / Shaxi Tea-Horse Trails (Yunnan, CN) [guided, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Dogon Escarpment Cycling (Mali) [do not travel] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| East Nimba Mountain Trail (Liberia) [reserve guide, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Forrest Mountain Bike Trails (Victoria, Australia) [no-lift] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. No lift: try the OSM GPS trace archive. |
| Fort Mountain State Park (Georgia) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Freetown Peninsula Mountains (Sierra Leone) [scouting only, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Gap Creek Reserve (Brisbane, Australia) [no-lift] | 0 |  |  | AU: many networks are Trailforks-only, but the 2026-08-09 sweep did find OSM geometry at Blue Derby, Mt Buller and Mystic - one OSM query is worth it. No lift: try the OSM GPS trace archive. |
| Hanmer Springs Forest Park (Canterbury, New Zealand) [no-lift] | 0 |  |  | NZ: OSM is well filled around Rotorua, Nelson and Queenstown - query OSM before the operator site. No lift: try the OSM GPS trace archive. |
| Kalaw to Inle Highlands (Myanmar) [travel warning, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Karakol - Jeti-Oguz MTB (Kyrgyzstan) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Kenting MTB Trails (Pingtung, TW) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Khardung La / Nubra MTB (Ladakh, IN) [vehicle drop, no lift] | 0 |  |  | Little MTB tagging; DEM-profiling the hiking-path network may be the only route. No lift: try the OSM GPS trace archive. |
| Khorog - Pamir Highway and Wakhan (Tajikistan) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Knuckles Mountain Range - Riverston (Sri Lanka) [guided, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Kédougou / Dindefelo MTB (Senegal) [guided, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Lafur / Mazandaran Forest MTB (IR) [guided, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Lao Wai Trails / Dadu Trail House (Taichung, TW) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Lar National Park / Damavand MTB (IR) [guided, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Longjing Tea Hills MTB (Hangzhou, CN) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Lower Mustang Enduro (Nepal) [expedition, no lift] | 0 |  |  | Little MTB tagging; DEM-profiling the hiking-path network may be the only route. No lift: try the OSM GPS trace archive. |
| Manali / Solang Valley MTB (Himachal Pradesh, IN) [shuttle, no lift] | 0 |  |  | Little MTB tagging; DEM-profiling the hiking-path network may be the only route. No lift: try the OSM GPS trace archive. |
| Margalla Second Ridge MTB (Pakistan) [organized transport] | 0 |  |  | Little MTB tagging; DEM-profiling the hiking-path network may be the only route. No lift: try the OSM GPS trace archive. |
| Mount Kinabalu Foothills Adventure MTB (Sabah, MY) [guided, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Mount Maarat / Patiis Trails (Rizal, PH) [no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Mount Mangengenge (DR Congo) [scouting only, access unverified] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Mukura Forest Bike Trail (Rwanda) [guide required, no lift] | 0 |  |  | Little MTB tagging; guide or club site, else DEM-profile the paths. No lift: try the OSM GPS trace archive. |
| Mzaar Mountain Resort MTB (Lebanon) [no bike lift documented] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Nagarkot Enduro Trails (Nepal) [shuttle supported, no lift] | 0 |  |  | Little MTB tagging; DEM-profiling the hiking-path network may be the only route. No lift: try the OSM GPS trace archive. |
| North Basse-Terre MTB (Sainte-Rose, GP) [guided, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Obudu Plateau MTB (Nigeria) [no bike lift documented] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Pachacamac / Pacha Trails (Lima, Peru) [no lift] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Papenoo Valley (Tahiti, PF) [backcountry, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Pomeranos DH Trails (Pomerode, BR) [no lift] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| San Gil / Chicamocha Mule Trails (CO) [no lift] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Sapa Valley MTB (Vietnam) [guided, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Sarangkot / Pokhara Enduro Trails (Nepal) [guided, no lift] | 0 |  |  | Little MTB tagging; DEM-profiling the hiking-path network may be the only route. No lift: try the OSM GPS trace archive. |
| Serra da Canastra Adventure MTB (Minas Gerais, BR) [no lift] | 0 |  |  | South America: almost nothing mtb-tagged; club or operator site, or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Temi / South Sikkim MTB (IN) [guided, no lift] | 0 |  |  | Little MTB tagging; DEM-profiling the hiking-path network may be the only route. No lift: try the OSM GPS trace archive. |
| Tokai - Table Mountain (Cape Town, South Africa) [activity permit] | 0 |  |  | ZA: estate trails are bicycle=designated and invisible to the mtb-tag query - search by name instead. No lift: try the OSM GPS trace archive. |
| Vinales Valley (Cuba) [no lift, guide recommended] | 0 |  |  | Nothing mtb-tagged; guide or club site. No lift: try the OSM GPS trace archive. |
| Wakan Titan of the Hill (Oman) [historic race, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
| Western Sichuan / Four Sisters MTB (CN) [guided, no lift] | 0 |  |  | Thin OSM coverage: check the operator site for GPX or a Google My Maps mid. No lift: try the OSM GPS trace archive. |
