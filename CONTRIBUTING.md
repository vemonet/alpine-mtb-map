# Contributing

Contributions are very welcome, especially new spots and price corrections.

Add yours to [`alpine-mtb-map.kml`](alpine-mtb-map.kml) following [Adding a point](#adding-a-point) below, check it renders:

```bash
vp i && vp dev
```

Then open a pull request. The pre-commit hook regenerates the GPX and GeoJSON, so you only ever touch the KML. See [Development](#development) for the rest.

## What is on the map

Each main pin carries, in its description: what the trails are like, what it costs to get up, its open and closed dates, and an Access table giving the travel time from each origin.

Travel times are given from reference cities that actually makes sense for each spot: **Lausanne by train** for the Swiss, **Nice by car** for the Mercantour, and the obvious local city everywhere.

| Colour       | Meaning                                             |
| ------------ | --------------------------------------------------- |
| Blue         | purpose-built, operator-maintained bike park        |
| Dark green   | natural or lightly developed spot with uplift       |
| Brown        | any spot with no lift - pedal up                    |
| Grey         | secondary points: stations, mid-stations, lift hubs |
| Orange lines | trails                                              |

### Filters

Every filter combines with the others. See [the tags](#6-the-tags) for how to classify a spot.

The **Show** menu contains spot type, access, riding style and difficulty checkboxes. They start checked, use OR matching inside each applicable section and can be reset together with **Show all** or **Hide all**. Spot type and lift access are independent:

| Filter        | Shows                                         |
| ------------- | --------------------------------------------- |
| **Bike park** | purpose-built and maintained bike parks       |
| **Natural**   | natural or lightly developed riding           |
| **No lift**   | spots where the climb is under your own power |

Every spot must carry exactly one of `bike-park` or `natural`. Add `no-lift` independently whenever there is no mechanical uplift. A purpose-built bike park can therefore be `bike-park no-lift`. No-lift takes visual priority, so both `bike-park no-lift` and `natural no-lift` use a brown pin. A bike park with uplift uses blue, while a natural spot with uplift uses dark green.

The **Only show** menu contains optional requirements. They start unchecked, and selecting one hides everything that does _not_ carry its tag:

| Filter | On means |
| --- | --- |
| 🎫 **Magic Pass** | only resorts in the [Magic Pass](https://www.magicpass.ch/) network (10 today) |
| 🎟️ **Season pass** | only spots with a published season pass price (13 today) |
| **Mass start venue** | only venues that host a documented mass-start gravity race |

Riding style and difficulty match on _any_: a spot shows while at least one of its tags in each section remains checked. A spot may carry several difficulty and riding-style tags.

| Group        | Filters                          |
| ------------ | -------------------------------- |
| Difficulty   | 🟢 **Beginner**, 💀 **Expert**   |
| Riding style | **DH**, **Enduro**, **Freeride** |

That is why somewhere tagged both beginner and expert survives turning either one off, and a park tagged `dh freeride` survives while either riding-style chip remains on. Turning every chip in a group off empties the map.

**Day pass up to** is the one numeric filter: a slider that hides spots whose day price is above the cap. At its far right it reads _any_ and hides nothing. Prices are compared in Swiss francs, with the other currencies converted at fixed rough rates (CHF, EUR, CAD, JPY are recognised), so it sorts spots into brackets rather than quoting you a figure. **Spots with no verified price are never hidden by it** - we do not filter on data we do not have, and a currency the table does not know reads the same way.

**Open & weather on** is one shared date picker that defaults to **Any date**. Choosing a date hides every spot whose recurring season does not include the selected month and day and uses that date for weather when it is inside the available forecast window. Published 2026 dates are used where available; otherwise the KML description labels the regional average as a typical window. Weather, maintenance and partial-season lift schedules can still change actual access, so always check the operator.

Seasons that run across New Year work the same way: the four southern-hemisphere spots (Thredbo, Nevados de Chillan, Cerro Catedral, La Parva) are open from December to April, so on a July date they are correctly hidden and on a January one they are most of what is left.

When the shared date is **Any**, weather uses today before 16:00 and tomorrow from 16:00 onward. Weather is enabled by default and can be turned off with the cloud-and-rain button left of the location button. A rain icon appears inside a spot's original coloured dot when at least 1 mm of precipitation or a 50% precipitation probability is forecast for the effective weather date, or at least 5 mm fell the day before. Clicking a spot shows that day, the three days before it and the three days after it. Dates outside Open-Meteo's available range show a clear unavailable message. Forecasts are cached in the browser for six hours to limit Open-Meteo requests.

## Adding a point

Everything lives in `alpine-mtb-map.kml`. It is plain XML, so edit it in any text editor - no build step is needed for the data itself. Paste a new `<Placemark>` anywhere between `<Document>` and `</Document>`.

### 1. Get the coordinates

Right-click the spot on [openstreetmap.org](https://www.openstreetmap.org/) and choose "Show address", or long-press it in Organic Maps and copy the coordinates. Careful: **KML is `longitude,latitude`**, the opposite order from what almost every tool shows you. Getting this wrong drops your pin in Somalia.

### 2. Copy this template

```xml
<Placemark>
  <name>Somewhere Nice [30 CHF]</name>
  <description><![CDATA[<b>Somewhere 1200 m - valley station of the gondola</b><br/><br/>
    <b>Trails</b><br/>Two red descents and a blue flow line.<br/><br/>
    <b>Getting up / price</b><br/>Day pass 30 CHF, free with the Magic
    Pass.<br/><br/>
    <b>Open season</b><br/>Open from 20 June; closed from 24 August
    (published 2026 dates).<br/>Daily opening hours: 09:00-17:00<br/>
    <small>Published operating hours; check the operator schedule.</small><br/><br/>
    <b>Access</b><table class="access">
      <tr><th>From</th><th>Transport</th><th>Duration</th></tr>
      <tr><td>Lausanne</td><td>Train</td><td>~1h20</td></tr>
    </table><br/>
    <i>Source: <a href="https://operator.example/trails">official trail and
    lift information</a>. Prices, schedules, trail status and access can
    change; verify before travel.</i>]]></description>
  <styleUrl>#placemark-blue</styleUrl>
  <Point><coordinates>6.912345,46.512345,0</coordinates></Point>
  <ExtendedData>
    <Data name="spot"><value>somewhere</value></Data>
    <Data name="tags"><value>beginner expert bike-park dh enduro freeride magicpass</value></Data>
    <Data name="open_from"><value>06-20</value></Data>
    <Data name="closed_from"><value>08-24</value></Data>
    <Data name="price_day"><value>30 CHF</value></Data>
  </ExtendedData>
</Placemark>
```

### 3. The name

`Somewhere Nice [30 CHF]` - the part in square brackets is what the sidebar shows underneath the name, and it is how the website recognises a main spot pin in the first place. Put the **price** there, never the travel time (that lives in the Access table). Use `no lift` for a pedal-up spot, or something like `train fare only` where there is no pass to buy.

Drop the brackets and the pin still appears on the map, but it will not get a sidebar row and it will not be filterable.

### 4. The description

Keep the five sections in this order. It is HTML inside `<![CDATA[ ... ]]>`, so write `&gt;` rather than a bare `>` if you want an arrow.

1. **Bold first line** - what the pin actually marks. The main pin sits at the bottom of the main lift, so it reads `Leysin 1263 m - valley station of the Berneuse gondola`; the grey waypoint at the other end reads `Berneuse 2048 m - top of the gondola`.
2. **Trails** - what the riding is like. This comes first because it is the reason to go; it is the part worth writing well.
3. **Getting up / price** - the pass, what it costs, season dates, whether the Magic Pass covers it.
4. **Open season** - explicitly state when the spot opens and the first date it is closed. Say whether these are published dates or a typical estimate. For every bike park or mechanical uplift, add a non-bold `Daily opening hours: 09:00-17:00` line followed by a small note saying whether the hours are published or estimated.
5. **Access** - the table, and nothing else. One row per origin city, nearest first. Use whichever origin a rider would actually start from: Lausanne by train for Switzerland and the Chablais, Grenoble by car for the Isère. Add a second row when both are useful. The Transport column is free text: `Train`, `Train + bus`, `Train + funicular`, `Boat + bus`, `Car`.

To flag a local access rule or a hazard, add a warning box between "Getting up / price" and Access:

```html
<p class="warn">&#9888;&#65039; Only ride on single tracks that are marked for biking.</p>
```

It renders as a highlighted box on the site and as its own line in the GPX export.

### 5. The style

| `styleUrl`         | Use for                                                      |
| ------------------ | ------------------------------------------------------------ |
| `#placemark-blue`  | a purpose-built, maintained bike park                        |
| `#placemark-green` | a natural or lightly developed spot with mechanical uplift   |
| `#placemark-brown` | any no-lift spot where you pedal up                          |
| `#placemark-gray`  | a secondary point: station, mid-station, lift hub, trailhead |
| `#line-trail`      | a trail line                                                 |

Pin colour encodes lift access first, then spot category. No lift always takes visual priority and uses brown. Among spots with uplift, bike parks use blue and natural spots use dark green. Nothing else is colour coded, so do not invent new styles.

### 6. The tags

This is the `<ExtendedData>` block. Organic Maps ignores it entirely; it exists to drive the website's filters and grouping.

| Field | Required? | Value |
| --- | --- | --- |
| `spot` | recommended | A short lowercase id, unique per spot (`leysin`, `verbier`). Give the main pin, its secondary pins and all its trail lines the **same** id, and they show and hide together. Omit it and the pin becomes its own island. |
| `tags` | required | Space-separated, from the list below. Must contain `beginner` and/or `expert`, exactly one of `bike-park` or `natural`, and at least one of `dh`, `enduro` or `freeride`. Multiple riding-style tags are encouraged where accurate. |
| `open_from` | required | First open day as `MM-DD`, on the main pin only. |
| `closed_from` | required | First closed day as `MM-DD`, on the main pin only. This date is excluded by the filter. Use the same value as `open_from` for a normally year-round spot. |
| `price_day` | optional | Day access to the resort or mandatory lift, as `30 CHF`, `25 EUR`, `5500 JPY`. Main pin only. |
| `price_season` | optional | Season pass for the same, same format. Main pin only. |

Season fields are recurring month-day values because the picker is for trip planning across years. Prefer the operator's published dates. When those are not available, use a conservative regional average and label it as a typical window in the description. Put daily opening hours directly in the Open season description for every bike park and every spot relying on a gondola, cable car, chairlift or funicular. Prefer published hours; otherwise use a conservative regional estimate and say so in the following small-text note. Do not put season fields on secondary pins or trail lines; they inherit visibility from the main spot through the shared `spot` id.

The `tags` value is a union across a spot's placemarks, so in practice put the same tags on the pin and its trail lines. Available tags:

| Tag | Meaning |
| --- | --- |
| `beginner` | Trails a newcomer can enjoy: green or blue flow, wide tracks, escape routes. |
| `expert` | Hard trails worth travelling for: steep, technical, black-graded. |
| `bike-park` | Purpose-built trails maintained and operated as a bike park. |
| `natural` | Natural or lightly developed trails, with or without uplift. |
| `no-lift` | No mechanical uplift. Independent of `bike-park` or `natural`. |
| `dh` | Downhill riding: predominantly descending trails, usually gravity or uplift focused. |
| `enduro` | Enduro riding: technical singletrack or trail networks combining climbs, traverses and descents. |
| `freeride` | Freeride terrain: jumps, drops, sculpted features, big-mountain lines or creative unsanctioned-style riding. |
| `winter` | Informational metadata for spots usually ridable through the cold months. |
| `magicpass` | The resort is in the [Magic Pass](https://www.magicpass.ch/) network. |
| `mass-start` | The spot hosts a documented mass-start gravity race. Mention the race by name in the description and link its source. |

Plenty of spots deserve both `beginner` and `expert`; a spot with neither will never show, since the difficulty filters have nothing to match. A spot must also be either `bike-park` or `natural`, never both. Lift access and riding styles are independent: a pedal-up park can be `bike-park no-lift dh freeride`, a natural pedal-up network might be `natural no-lift enduro`, and a lift-served big-mountain zone might be `natural freeride`.

Tagging examples:

```xml
<Data name="tags"><value>beginner natural enduro</value></Data>
<Data name="tags"><value>expert bike-park dh</value></Data>
<Data name="tags"><value>beginner expert bike-park no-lift enduro freeride</value></Data>
<Data name="tags"><value>beginner expert bike-park dh freeride</value></Data>
<Data name="tags"><value>expert natural enduro freeride winter</value></Data>
<Data name="tags"><value>beginner expert bike-park dh enduro freeride magicpass</value></Data>
```

For backward compatibility, `no-lift` is also derived from a `#placemark-brown` style, but contributors should write it explicitly. The `season` tag is derived from the presence of `price_season` and is never written by hand.

#### Prices

`price_day` is the cost of a day's access to the resort, or of the lift you cannot avoid. It is not the travel cost: a train fare belongs in the Access table, a mandatory funicular belongs here. Write the currency the operator actually charges in.

```xml
<Data name="price_day"><value>36 CHF</value></Data>
<Data name="price_day"><value>23.50 EUR</value></Data>
<Data name="price_day"><value>5500 JPY</value></Data>
<Data name="price_season"><value>320 EUR</value></Data>
```

The price slider knows `CHF`, `EUR`, `CAD` and `JPY` (the rates live in `CHF_PER` in [`src/main.js`](src/main.js)). Any other currency still displays, it just never gets filtered.

**Leave them out rather than guess.** An omitted price is never hidden by the price slider, which is the right outcome for a spot we could not verify; an invented one sends someone to a resort on a number that was never real. Say so in the description instead ("price not verified here, check operator.ch").

Adding a whole new filter is two steps and no new filtering logic: put the tag in the KML, and add a chip to `<nav id="filters">` in [`index.html`](index.html) with `data-tag` plus `data-mode="only"` (inclusion) or no mode at all (exclusion).

### Finding coordinates and traces

There is a skill for this: [`.github/skills/spot-data/`](.github/skills/spot-data/SKILL.md). It has two dependency-free scripts and the rules they encode.

```bash
cd .claude/skills/spot-data/scripts
python3 lifts.py  46.74,6.31,46.79,6.40 --ele   # every lift, both ends, altitudes
python3 trails.py 46.14,6.65,46.18,6.71         # mapped MTB descents
python3 trails.py 46.14,6.65,46.18,6.71 --id 220753196   # one, as KML
```

`lifts.py --ele` is what tells you which end of a lift is the valley station - that is where the main pin goes. Top stations, mid-stations and secondary lift stations are grey waypoints. `trails.py` pulls geometry from OpenStreetMap, simplifies it and refuses to emit a relation that is a circuit rather than one descent.

> [!TIP]
>
> To use them with other coding agents:
>
> ```sh
> mkdir -p .agents/skills && ln -sfn ../../.github/skills/spot-data .agents/skills/spot-data
> mkdir -p .claude/skills && ln -sfn ../../.github/skills/spot-data .claude/skills/spot-data
> ```

### 7. Adding a trail line

Same idea with a `<LineString>` instead of a `<Point>`. Coordinates are `lon,lat,0` triples separated by spaces. Give it the same `spot` and `tags` as the pin it belongs to, so it hides and shows with it.

```xml
<Placemark>
  <name>Somewhere: Red descent</name>
  <description><![CDATA[2.4 km, steep and rocky.]]></description>
  <styleUrl>#line-trail</styleUrl>
  <LineString><tessellate>1</tessellate>
    <coordinates>6.9123,46.5123,0 6.9130,46.5110,0 6.9145,46.5098,0</coordinates>
  </LineString>
  <ExtendedData>
    <Data name="spot"><value>somewhere</value></Data>
    <Data name="tags"><value>expert natural enduro</value></Data>
  </ExtendedData>
</Placemark>
```

To trace a real trail rather than typing coordinates, draw it on [umap.openstreetmap.fr](https://umap.openstreetmap.fr/), export as KML and paste the `<coordinates>` across. The existing lines were pulled from OpenStreetMap relations via [Overpass](https://overpass-turbo.eu/) - if you do the same, the result stays ODbL, which the data files already are.

### 8. Check it

```bash
vp dev
```

Open the printed URL. If the map is blank, the KML is malformed and the browser console will say where. Then commit the KML - it is the only data file in the repository, and the GPX, GeoJSON and KMZ are generated at release time.

## Other formats

```bash
vp run convert
```

Regenerates `alpine-mtb-map.geojson`, `alpine-mtb-map.gpx` and `alpine-mtb-map.kmz` from `alpine-mtb-map.kml`. Points become GPX waypoints and GeoJSON `Point` features, trails become GPX tracks and `LineString` features; HTML descriptions are flattened to plain text for GPX. The `kind` (`bike-park` / `natural` / `no-lift` / `minor` / `trail`) plus every `<ExtendedData>` facet (`spot`, `tags`, `open_from`, `closed_from`, `price_day`, `price_season`) is carried into GeoJSON as a property.

**Never edit the generated files by hand** - the KML is the source of truth and `vp run convert` overwrites them. The three exports are gitignored: [releasing](#releasing) rebuilds them and attaches them to the GitHub release, which is where the download links point.

## Development

The toolchain is [Vite+](https://viteplus.dev/) (`vp`):

```bash
vp i               # install dependencies and git hooks
```

```bash
vp dev             # local dev server
vp build           # static site into dist/
vp preview         # serve the built site - use this to test the PWA, not dev
vp check           # format + lint (add --fix to apply)
vp run convert     # regenerate the GPX, GeoJSON and KMZ exports
vp run icons       # regenerate the PWA icons from public/icon.png
vp run ready       # everything CI runs, before you open a pull request
vp run release     # cut a release (maintainers)
```

> Everything the tooling needs lives in [`vite.config.js`](vite.config.js).

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs `vp check` and `vp run convert`, which validates the KML: the conversion refuses a spot that is missing a required tag axis. On `main` it then builds and publishes to GitHub Pages; pull requests get the checks only.

## Releasing

Maintainers only, and it all happens locally - there is no release workflow.

```bash
GITHUB_TOKEN=... vp run release
```

`release` [depends on](vite.config.js) `convert`, so the exports are always rebuilt from the KML being released before anything is uploaded. Then [release-it](https://github.com/release-it/release-it) prompts for the new version and takes it from there: bump `package.json`, rewrite `CHANGELOG.md`, commit, tag, push, and create the GitHub release with the KML, KMZ, GPX and GeoJSON attached. Add `--dry-run` to see every step without performing any of them, or pass a version to skip the prompt:

```bash
vp run release minor --dry-run
```

The token needs `repo` scope. Both tools use it: release-it to create the release, git-cliff to look up pull request titles and authors.

The notes come from [git-cliff](https://git-cliff.org/) via [`cliff.toml`](cliff.toml), configured to reproduce GitHub's own format - a flat "What's Changed" list crediting each author, then a "New Contributors" section for anyone whose first pull request this is. That last part is only correct because `cliff.toml` names the GitHub remote; first-time status comes from the API, not from the git history.
