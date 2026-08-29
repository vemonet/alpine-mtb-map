<div align="center">
  <img src="public/icon.png" width="96" height="96" alt="Alpine MTB Map logo">
  <h1>Alpine MTB Map</h1>
  <p>An open map for gravity mountain biking: downhill bike parks, enduro trails and freeride spots worldwide.</p>
<a href="https://github.com/vemonet/alpine-mtb-map/actions/workflows/deploy.yml"><img src="https://github.com/vemonet/alpine-mtb-map/actions/workflows/deploy.yml/badge.svg" alt="Deploy to GitHub Pages"></a> <a href="https://github.com/vemonet/alpine-mtb-map/actions/workflows/release.yml"><img src="https://github.com/vemonet/alpine-mtb-map/actions/workflows/release.yml/badge.svg" alt="Release"></a>
</div>

- **Map:** [vemonet.github.io/alpine-mtb-map](https://vemonet.github.io/alpine-mtb-map)
- **Data:** [`alpine-mtb-map.kml`](alpine-mtb-map.kml) · the single source of truth
- **Direct downloads:** [KML](https://github.com/vemonet/alpine-mtb-map/releases/latest/download/alpine-mtb-map.kml) · [GPX](https://github.com/vemonet/alpine-mtb-map/releases/latest/download/alpine-mtb-map.gpx) · [GeoJSON](https://github.com/vemonet/alpine-mtb-map/releases/latest/download/alpine-mtb-map.geojson)

## Why

Picking a mountain biking spot means opening a dozen sites, and no single one of them tells you what the trails are like, how the lift works and what a day costs. Then, once you have picked one, hunting down a KML or GPX to load into your GPS app is a second evening gone.

So everything here is in one KML. Download it, open it in [CoMaps](https://www.comaps.app/), [Organic Maps](https://organicmaps.app/) or OsmAnd, and you are done. The website reads the same file, which is handy for browsing and filtering from a laptop, but it is not required.

What a spot entry contains:

- what the **trails** are like, and how many there are
- how you **get up** and what the day pass costs, plus season dates and whether the [Magic Pass](https://www.magicpass.ch) covers it
- an **Access** table: travel time from the city a rider would realistically start from
- **tags** you can filter on: difficulty, style, opening season, Magic Pass, price
- **trail lines** from [OpenStreetMap](https://openstreetmap.org), the operator's own site, or traces sent in by contributors, plus **extra waypoints** where they help: valley stations, mid-stations, trailheads, lift hubs
- a 16-day **[Open-Meteo](https://open-meteo.com/) weather forecast**, with wet-condition warning based on predicted rain, the previous day's precipitation, and known spot resilience to rain.

To be on the map, a spot needs at least one singletrack where mountain biking is actually allowed. Most also have some way up that is not your legs: funicular, cog railway, gondola, cable car, train. Purpose-built bike parks are blue, lift-served natural spots dark green, pedal-up spots brown.

## Install it on your phone

The site is a PWA: open it in your phone browser and use "Add to Home Screen" (Share menu on iOS, three-dot menu on Android). It then launches full screen and works offline. The spot data ships inside the app bundle, and tiles you have already looked at are cached, up to 800 of them for 30 days. Tiles for places you never opened stay blank until you are back online.

For actual backcountry use, put the KML into CoMaps, Organic Maps or OsmAnd anyway. They hold whole-country offline maps, which a browser cache will never match.

## Using it offline

Download [`alpine-mtb-map.kml`](alpine-mtb-map.kml) and open it on your phone. Organic Maps imports it as a new bookmark category (Bookmarks -> the import button -> pick the file). It works in OsmAnd, Google Earth and Maps.me too.

## Privacy

Map tiles come from OpenStreetMap, OpenTopoMap and CyclOSM, and forecasts from Open-Meteo when weather is on. Those servers see your IP, like any web map. Forecast requests carry the public coordinates of the map's spots, never yours. This project itself collects nothing: no analytics, no cookies, no accounts. `localStorage` holds your light/dark choice and a six-hour cache of spot forecasts, and that is all.

**Geolocation is opt-in.** The page never touches the Geolocation API on load, so no permission prompt appears unless you press "Show my location" in the sidebar. Press it again to stop. Your position stays in the browser: drawn on the map, sent nowhere.

## Credits and licence

Three different things live in this repo, so three licences. All three are in [`LICENSE`](LICENSE), one section each.

| What | Licence | Why |
| --- | --- | --- |
| Map data (`.kml`) | ODbL 1.0 | Contains geometry derived from OpenStreetMap |
| Website and tooling (`src/`, `scripts/`, `index.html`, `vite.config.ts`, `.github/`) | MIT | Ordinary code, no OSM data in it |

The data files are ODbL rather than Creative Commons, and that is not really a choice. The trail lines come out of OpenStreetMap relations, which makes the file a derivative database, and ODbL is share-alike, so the whole database inherits it. ODbL and CC BY-SA are incompatible in both directions, so mixing them in one file would be a conflict, not a dual licence. The individual contents (descriptions, prices, travel times) are also available under [DbCL 1.0](https://opendatacommons.org/licenses/dbcl/1-0/), the same split OpenStreetMap uses.

If you redistribute the KML, GPX or GeoJSON, or anything built from them, keep this notice:

> Data: OpenStreetMap contributors, available under the [ODbL](https://www.openstreetmap.org/copyright).

Base map tiles are served by [OpenStreetMap](https://www.openstreetmap.org/copyright), [OpenTopoMap](https://opentopomap.org/) (CC BY-SA) and [CyclOSM](https://www.cyclosm.org/); they are not redistributed here.

Prices and timetables were compiled in July 2026 from the operators' own sites. They are indications, not quotes. Check before you travel.

## Contributing

Contributions are welcome, especially new spots and price corrections. See [CONTRIBUTING.md](CONTRIBUTING.md) to understand the map data, add a spot or trail, regenerate exports, and run the project checks.
