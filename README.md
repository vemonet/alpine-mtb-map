<div align="center">
  <img src="public/icon.png" width="96" height="96" alt="Alpine MTB Map logo">
  <h1>Alpine MTB Map</h1>
  <p>A curated open map for gravity mountain biking. Discover top downhill bike parks, enduro trails, and freeride spots worldwide.</p>
</div>

- **Map:** [vemonet.github.io/alpine-mtb-map](https://vemonet.github.io/alpine-mtb-map)
- **Data:** [`public/alpine-mtb-map.kml`](public/alpine-mtb-map.kml) · the single source of truth
- **Direct downloads:** [KML](https://vemonet.github.io/alpine-mtb-map/alpine-mtb-map.kml) · [GPX](https://vemonet.github.io/alpine-mtb-map/alpine-mtb-map.gpx) · [GeoJSON](https://vemonet.github.io/alpine-mtb-map/alpine-mtb-map.geojson)

## Why

This project comes out of the frustration of trying to find a good mountain biking spot. You end up going through a dozen different sites, and none of them give you the whole picture: what the trails are actually like, what the lift costs, how long it takes to get there. There is no decent overall map with the information you need to plan a trip. And once you have finally settled on a spot, finding a KML or GPX to load into your GPS app is its own hunt.

Alpine MTB Map fixes that. The spots live in one KML you download and open in [CoMaps](https://www.comaps.app/), [Organic Maps](https://organicmaps.app/) or OsmAnd, and the website is a convenience layer on top: browse and filter the same file from the web, no app required.

For each spot you get:

- what the **trails** are like, and how many there are
- how you **get up** and what the day pass costs, plus season dates and whether the [Magic Pass](https://www.magicpass.ch) covers it
- an **Access** table: travel time from the city a rider would realistically start from
- **tags** you can filter on: difficulty, winter riding, Magic Pass, price
- **trail lines** where [OpenStreetMap](https://openstreetmap.org) has the geometry, and **extra waypoints** where they help: valley stations, mid-stations, trailheads, lift hubs
- a 16-day **[Open-Meteo](https://open-meteo.com/) weather forecast**, with wet-condition warning based on predicted rain and the previous day's precipitation

A good spot here means at least one singletrack where mountain biking is allowed. Many also have a way to get from the bottom to the top that is not your legs (funicular, cog railway, gondola, cable car). Purpose-built bike parks are blue, natural lift-served spots are dark green, and no-lift spots are in brown.

## Contributing

Contributions are very welcome, especially new spots and price corrections. See [CONTRIBUTING.md](CONTRIBUTING.md) to understand the map data, add a spot or trail, regenerate exports, and run the project checks.

## Install it on your phone

The site is a PWA: open it in your phone browser and use "Add to Home Screen" (Share menu on iOS, the three-dot menu on Android). It then launches full screen and works offline - the spot data ships inside the app bundle, and map tiles you have already looked at are cached (up to 800 of them, for 30 days). Tiles for places you have never opened will be blank until you are back online.

For real backcountry use, still put the KML into CoMaps, Organic Maps or OsmAnd: they hold whole-country offline maps, which a browser cache cannot match.

## Using it offline

Download [`public/alpine-mtb-map.kml`](public/alpine-mtb-map.kml) and open it on your phone. Organic Maps imports it as a new bookmark category (Bookmarks -> the import button -> pick the file). It works in OsmAnd, Google Earth and Maps.me too.

The website has KML / GPX / GeoJSON buttons in the sidebar that use the deployed GitHub Pages files. The same stable URLs can be shared directly:

- `https://vemonet.github.io/alpine-mtb-map/alpine-mtb-map.kml`
- `https://vemonet.github.io/alpine-mtb-map/alpine-mtb-map.gpx`
- `https://vemonet.github.io/alpine-mtb-map/alpine-mtb-map.geojson`

## Privacy

The site loads map tiles from OpenStreetMap, OpenTopoMap and CyclOSM, and weather forecasts from Open-Meteo when weather is enabled. Those servers see your IP, as with any web map. Forecast requests contain the public coordinates of the map's spots, never your location. Nothing is collected by this project: no analytics, no cookies, no accounts. Your light/dark choice and a six-hour cache of public spot forecasts are stored in `localStorage`.

**Geolocation is strictly opt-in.** The page never touches the Geolocation API on load, so you get no browser permission prompt unless you press "Show my location" in the sidebar. Press it again to stop. Your position stays in the browser - it is drawn on the map and sent nowhere.

## Credits and licence

Three different things live in this repo, so three licences. All three are in [`LICENSE`](LICENSE), one section each.

| What | Licence | Why |
| --- | --- | --- |
| Map data (`.kml`, `.gpx`, `.geojson`) | ODbL 1.0 | Contains geometry derived from OpenStreetMap |
| Website and tooling (`src/`, `scripts/`, `index.html`, `vite.config.js`, `.github/`) | MIT | Ordinary code, no OSM data in it |

**The data files are ODbL, not Creative Commons, and that is not a free choice.** The trail lines were extracted from OpenStreetMap relations, which makes the file a derivative database. ODbL is share-alike, so the whole database inherits it - and ODbL and CC BY-SA are not compatible in either direction, so mixing them in one file would be a licence conflict rather than a dual licence. Individual contents (the descriptions, prices, travel times) are additionally available under [DbCL 1.0](https://opendatacommons.org/licenses/dbcl/1-0/), which is the same split OpenStreetMap itself uses.

If you redistribute the KML, GPX or GeoJSON - or anything built from them - keep this notice:

> Data &copy; OpenStreetMap contributors, available under the [ODbL](https://www.openstreetmap.org/copyright).

Base map tiles are served by [OpenStreetMap](https://www.openstreetmap.org/copyright), [OpenTopoMap](https://opentopomap.org/) (CC BY-SA) and [CyclOSM](https://www.cyclosm.org/); they are not redistributed here.

Prices and timetables were compiled in July 2026 from the operators' own sites (TVGD, TLML, Moléson, MyCMA, Verbier 4Vallées, Portes du Soleil, Châtel, Charmey, Téléphérique du Salève, Les 2 Alpes, Magic Pass, Métabief, Pila, Chamonix Mont-Blanc, Les Arcs, Auron, Isola 2000, Valberg, La Colmiane, Val di Sole Bikeland, Whistler Blackcomb, Mont-Sainte-Anne, Fujimi Panorama, Saalfelden Leogang, Saalbach Hinterglemm, Planai, Serfaus-Fiss-Ladis, Sölden, Muttereralm, MTB Zone Petzen, Flims Laax, Davos Klosters, Bergbahnen Scuol, Engelberg-Titlis, Flumserberg, Engadin St. Moritz, Les Gets, Morzine, La Clusaz, Grand Massif, Tignes, Serre Chevalier, SilverStar, Sun Peaks, Fernie, Tremblant, Bromont, Hakuba Iwatake, Fujiten, Thredbo, Nevados de Chillan, Catedral Alta Patagonia, La Parva, Buen Camino, Old Town Outfitters, Kronplatz, Dolomiti Paganella, Moviment Alta Badia, Eggental Carezza, Bikepark Spicak, SKI Kranjska Gora, Silvretta Montafon, Bikepark Brandnertal, Mayrhofner Bergbahnen, Kitzsteinhorn, Les Menuires, Antur Stiniog, Revolution Bike Park, Bike Park Ireland, Big White, Cerro Chapelco, Bike Glendhu, Elevation Mystic) and are indications, not quotes. Check before you travel.
