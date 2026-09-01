# 🛠️ Contributing

[![Deploy to GitHub Pages](https://github.com/vemonet/alpine-mtb-map/actions/workflows/deploy.yml/badge.svg)](https://github.com/vemonet/alpine-mtb-map/actions/workflows/deploy.yml) [![Release](https://github.com/vemonet/alpine-mtb-map/actions/workflows/release.yml/badge.svg)](https://github.com/vemonet/alpine-mtb-map/actions/workflows/release.yml)

Contributions are welcome, especially new spots and price corrections.

Add yours to [`alpine-mtb-map.kml`](alpine-mtb-map.kml) following [Adding a point](#adding-a-point) below, then check it renders:

```bash
vp i && vp dev
```

Then open a pull request. The KML is the only data file in the repository; the GPX, GeoJSON and KMZ are generated at release time, so the KML is the only thing you ever edit. [Development](#development) covers the rest.

## 🗺️ What is on the map

A main pin's description says what the trails are like, what it costs to get up, when the spot opens and closes, and how long it takes to get there from each origin in the Access table.

Origins are whichever city a rider would realistically leave from: **Lausanne by train** for Switzerland, **Nice by car** for the Mercantour, the obvious local city elsewhere.

| Colour       | Meaning                                             |
| ------------ | --------------------------------------------------- |
| Blue         | purpose-built, operator-maintained bike park        |
| Dark green   | natural or lightly developed spot with uplift       |
| Brown        | any spot with no lift - pedal up                    |
| Grey         | secondary points: stations, mid-stations, lift hubs |
| Orange lines | trails                                              |

### Filters

Filters combine. See [the tags](#6-the-tags) for how to classify a spot.

The **Show** menu holds the spot type, access, riding style and difficulty checkboxes. They start checked, match with OR inside each section, and can be flipped all at once with **Show all** or **Hide all**. Spot type and lift access are independent of each other:

| Filter        | Shows                                         |
| ------------- | --------------------------------------------- |
| **Bike park** | purpose-built and maintained bike parks       |
| **Natural**   | natural or lightly developed riding           |
| **No lift**   | spots where the climb is under your own power |

Every spot carries exactly one of `bike-park` or `natural`, and `no-lift` on top of that whenever there is no mechanical uplift, so `bike-park no-lift` is a legitimate combination. For the pin colour, no-lift wins: both `bike-park no-lift` and `natural no-lift` are brown. With uplift, a bike park is blue and a natural spot dark green.

The **Only show** menu holds optional requirements. They start unchecked; checking one hides everything that does _not_ carry its tag:

| Filter | On means |
| --- | --- |
| 🎫 **Magic Pass** | only resorts in the [Magic Pass](https://www.magicpass.ch/) network (10 today) |
| 🎟️ **Season pass** | only spots with a published season pass price (13 today) |
| **Mass start venue** | only venues that host a documented mass-start gravity race |

Riding style and difficulty match on _any_, so a spot stays visible as long as one of its tags in each section is still checked. Spots often carry several of both.

| Group        | Filters                          |
| ------------ | -------------------------------- |
| Difficulty   | 🟢 **Beginner**, 💀 **Expert**   |
| Riding style | **DH**, **Enduro**, **Freeride** |

A spot tagged both beginner and expert therefore survives turning either one off, and a `dh freeride` park survives while either chip is on. Turn every chip in a group off and the map goes empty.

**Day pass up to** is the only numeric filter: a slider that hides spots priced above the cap. At its far right it reads _any_ and hides nothing. Comparison happens in Swiss francs, with EUR, CAD and JPY converted at fixed rough rates, so treat it as sorting spots into brackets rather than quoting a figure. Spots with no verified price are **never** hidden by it, because filtering on data we do not have would be worse than showing them, and a currency the table does not know is treated the same way.

**Open & weather on** is a single date picker, defaulting to **Any date**. Pick a date and it hides every spot whose recurring season does not cover that month and day, and uses the same date for the forecast when it falls inside the available window. Published 2026 dates are used where the operator has them; otherwise the description labels a regional average as a typical window. Maintenance days and partial lift schedules can still close a spot that the filter says is open, so check the operator.

Seasons crossing New Year need no special handling: the southern-hemisphere spots (Thredbo, Nevados de Chillan, Cerro Catedral, La Parva) run December to April, so a July date hides them and a January one leaves little else.

With the date on **Any**, weather uses today before 16:00 and tomorrow after. It is on by default and can be turned off with the cloud-and-rain button left of the location button. A rain icon appears inside a spot's coloured dot when the forecast for the effective date gives at least 1 mm of precipitation or a 50% probability, or when at least 5 mm fell the day before. Click a spot and you get that day plus three days either side. Dates outside Open-Meteo's range say so instead of guessing. Forecasts are cached in the browser for six hours to keep the request count down.

## 📍 Adding a point

Everything lives in `alpine-mtb-map.kml`. It is plain XML, so any text editor will do and the data needs no build step. Paste a new `<Placemark>` anywhere between `<Document>` and `</Document>`.

### 1. Get the coordinates

Right-click the spot on [openstreetmap.org](https://www.openstreetmap.org/) and choose "Show address", or long-press it in Organic Maps and copy the coordinates. Careful: **KML is `longitude,latitude`**, the opposite order to what almost every tool shows you. Getting it wrong drops your pin in Somalia.

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
  <ExtendedData xmlns:mwm="https://comaps.app">
    <mwm:properties>
      <mwm:value key="spot">somewhere</mwm:value>
      <mwm:value key="tags">beginner expert bike-park dh enduro freeride magicpass</mwm:value>
      <mwm:value key="open_from">06-20</mwm:value>
      <mwm:value key="closed_from">08-24</mwm:value>
      <mwm:value key="price_day">30 CHF</mwm:value>
    </mwm:properties>
  </ExtendedData>
</Placemark>
```

### 3. The name

`Somewhere Nice [30 CHF]`. The square brackets are what the sidebar shows under the name, and they are also how the website recognises a main spot pin at all. Put the **price** in there, never the travel time (that belongs in the Access table). Write `no lift` for a pedal-up spot, or something like `train fare only` where there is no pass to buy.

Without the brackets the pin still shows on the map, but it gets no sidebar row and no filtering.

### 4. The description

Keep the five sections in this order. The content is HTML inside `<![CDATA[ ... ]]>`, so write `&gt;` rather than a bare `>` for an arrow.

1. **Bold first line**: what the pin actually marks. The main pin sits at the bottom of the main lift, so it reads `Leysin 1263 m - valley station of the Berneuse gondola`, while the grey waypoint at the other end reads `Berneuse 2048 m - top of the gondola`.
2. **Trails**: what the riding is like. It comes first because it is the reason to go, and it is the part worth writing well.
3. **Getting up / price**: the pass, what it costs, season dates, whether the Magic Pass covers it.
4. **Open season**: when the spot opens and the first day it is closed, and whether those are published dates or an estimate. For every bike park and every mechanical uplift, add a non-bold `Daily opening hours: 09:00-17:00` line, then a small note saying whether the hours are published or estimated.
5. **Access**: the table, and nothing else. One row per origin city, nearest first. Use whichever origin a rider would actually start from: Lausanne by train for Switzerland and the Chablais, Grenoble by car for the Isère. Add a second row when both are useful. The Transport column is free text: `Train`, `Train + bus`, `Train + funicular`, `Boat + bus`, `Car`.

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

Pin colour reads lift access first, category second: no lift is always brown, and among lift-served spots, bike parks are blue and natural spots dark green. Nothing else is colour coded, so do not invent new styles.

### 6. The tags

This is the `<ExtendedData>` block. It exists to drive the website's filters and grouping; CoMaps and Organic Maps carry it through an import and export untouched but do not act on it.

Facets go in as `mwm:properties`, never as plain KML `<Data name="...">`:

```xml
<ExtendedData xmlns:mwm="https://comaps.app">
  <mwm:properties>
    <mwm:value key="spot">somewhere</mwm:value>
  </mwm:properties>
</ExtendedData>
```

CoMaps' parser has no handler for `<Data>` at all - its only match is `mwm:value` with a `key` attribute, nested exactly `Placemark > ExtendedData > mwm:properties` ([`libs/kml/serdes.cpp`](https://github.com/comaps/comaps/blob/main/libs/kml/serdes.cpp)). Written as `<Data>`, every facet was silently dropped the moment a reader imported the file into CoMaps and exported it again. So `<ExtendedData>` always declares `xmlns:mwm="https://comaps.app"`, on trail lines as well as pins.

| Field | Required? | Value |
| --- | --- | --- |
| `spot` | recommended | A short lowercase id, unique per spot (`leysin`, `verbier`). Give the main pin, its secondary pins and all its trail lines the **same** id, and they show and hide together. Omit it and the pin becomes its own island. |
| `tags` | required | Space-separated, from the list below. Must contain `beginner` and/or `expert`, exactly one of `bike-park` or `natural`, and at least one of `dh`, `enduro` or `freeride`. Multiple riding-style tags are encouraged where accurate. |
| `open_from` | required | First open day as `MM-DD`, on the main pin only. |
| `closed_from` | required | First closed day as `MM-DD`, on the main pin only. This date is excluded by the filter. Use the same value as `open_from` for a normally year-round spot. |
| `price_day` | optional | Day access to the resort or mandatory lift, as `30 CHF`, `25 EUR`, `5500 JPY`. Main pin only. |
| `price_season` | optional | Season pass for the same, same format. Main pin only. |

Season fields are month-day values with no year, because the picker is for planning trips across years. Use the operator's published dates when they exist, and a conservative regional average labelled as a typical window when they do not. Daily opening hours go in the Open season description of every bike park and every spot that depends on a gondola, cable car, chairlift or funicular, again published if possible and flagged as an estimate otherwise. Leave season fields off secondary pins and trail lines: they inherit visibility from the main spot through the shared `spot` id.

Tags are unioned across a spot's placemarks, so in practice give the pin and its trail lines the same set. Available tags:

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

Plenty of spots deserve both `beginner` and `expert`. A spot with neither never shows at all, since the difficulty filters have nothing to match on. It must be `bike-park` or `natural`, never both. Lift access and riding style are independent of that: a pedal-up park can be `bike-park no-lift dh freeride`, a pedal-up natural network `natural no-lift enduro`, a lift-served big-mountain zone `natural freeride`.

Tagging examples:

```xml
<mwm:value key="tags">beginner natural enduro</mwm:value>
<mwm:value key="tags">expert bike-park dh</mwm:value>
<mwm:value key="tags">beginner expert bike-park no-lift enduro freeride</mwm:value>
<mwm:value key="tags">beginner expert bike-park dh freeride</mwm:value>
<mwm:value key="tags">expert natural enduro freeride winter</mwm:value>
<mwm:value key="tags">beginner expert bike-park dh enduro freeride magicpass</mwm:value>
```

`no-lift` is also inferred from a `#placemark-brown` style, for older entries, but write it explicitly. The `season` tag comes from the presence of `price_season` and is never written by hand.

#### Prices

`price_day` is a day's access to the resort, or the lift you cannot avoid. It is not the travel cost: a train fare belongs in the Access table, a mandatory funicular belongs here. Use whatever currency the operator actually charges in.

```xml
<mwm:value key="price_day">36 CHF</mwm:value>
<mwm:value key="price_day">23.50 EUR</mwm:value>
<mwm:value key="price_day">5500 JPY</mwm:value>
<mwm:value key="price_season">320 EUR</mwm:value>
```

The price slider knows `CHF`, `EUR`, `CAD` and `JPY` (rates live in `CHF_PER` in [`src/main.ts`](src/main.ts)). Any other currency still displays, it just never gets filtered.

**Leave the field out rather than guess.** An omitted price is never hidden by the slider, which is what you want for a spot nobody could verify. An invented one sends someone to a resort on a number that was never real. Say so in the description instead: "price not verified, check operator.ch".

Adding a whole new filter takes two steps and no new filtering logic: put the tag in the KML, and add a chip to `<nav id="filters">` in [`index.html`](index.html) with `data-tag`, plus `data-mode="only"` for an inclusion filter or no mode at all for an exclusion one.

### Finding coordinates and traces

There is a skill for this: [`.agents/skills/spot-data/`](.agents/skills/spot-data/SKILL.md). It carries the rules plus a set of dependency-free scripts.

```bash
cd .agents/skills/spot-data/scripts
python3 lifts.py  46.74,6.31,46.79,6.40 --ele   # every lift, both ends, altitudes
python3 trails.py 46.14,6.65,46.18,6.71         # mapped MTB descents
python3 trails.py 46.14,6.65,46.18,6.71 --id 220753196   # one, as KML
```

`lifts.py --ele` is what tells you which end of a lift is the valley station, and that is where the main pin goes. Top stations, mid-stations and secondary lift stations become grey waypoints. `trails.py` pulls geometry from OpenStreetMap, simplifies it, and refuses to emit a relation that turns out to be a circuit rather than a single descent.

> [!TIP]
>
> To use them with claude code:
>
> ```sh
> mkdir -p .claude/skills && ln -sfn ../../.agents/skills/spot-data .claude/skills/spot-data
> ```

### 7. Adding a trail line

Same idea with a `<LineString>` instead of a `<Point>`. Coordinates are space-separated `lon,lat,0` triples. Give the line the same `spot` and `tags` as the pin it belongs to and it will hide and show with it.

```xml
<Placemark>
  <name>Somewhere: Red descent</name>
  <description><![CDATA[2.4 km, steep and rocky.]]></description>
  <styleUrl>#line-trail</styleUrl>
  <LineString><tessellate>1</tessellate>
    <coordinates>6.9123,46.5123,0 6.9130,46.5110,0 6.9145,46.5098,0</coordinates>
  </LineString>
  <ExtendedData xmlns:mwm="https://comaps.app">
    <mwm:properties>
      <mwm:value key="spot">somewhere</mwm:value>
      <mwm:value key="tags">expert natural enduro</mwm:value>
    </mwm:properties>
  </ExtendedData>
</Placemark>
```

Rather than typing coordinates, draw the trail on [umap.openstreetmap.fr](https://umap.openstreetmap.fr/), export as KML and paste the `<coordinates>` across. The existing lines were pulled from OpenStreetMap relations via [Overpass](https://overpass-turbo.eu/); do the same and the result stays ODbL, which the data files already are.

### 8. Check it

```bash
vp dev
```

Open the printed URL. A blank map means malformed KML, and the browser console will say where. Then commit the KML, and only the KML: the GPX, GeoJSON and KMZ are generated at release time.

## 🗂️ Other formats

```bash
vp run export
```

Regenerates `alpine-mtb-map.geojson`, `alpine-mtb-map.gpx` and `alpine-mtb-map.kmz` from `alpine-mtb-map.kml`. Points become GPX waypoints and GeoJSON `Point` features, trails become GPX tracks and `LineString` features, and HTML descriptions are flattened to plain text for GPX. The `kind` (`bike-park` / `natural` / `no-lift` / `minor` / `trail`) and every `<ExtendedData>` facet (`spot`, `tags`, `open_from`, `closed_from`, `price_day`, `price_season`) become GeoJSON properties.

**Never edit the generated files by hand.** The KML is the source of truth and `vp run export` overwrites them. All three exports are gitignored; [releasing](#releasing) rebuilds them and attaches them to the GitHub release, which is where the download links point.

## 🔧 Development

The toolchain is [Vite+](https://viteplus.dev/) (`vp`):

```bash
vp i               # install dependencies and git hooks
```

```bash
vp dev             # local dev server
vp build           # static site into dist/
vp preview         # serve the built site - use this to test the PWA, not dev
vp check           # format + lint (add --fix to apply)
vp run export     # regenerate the GPX, GeoJSON and KMZ exports
vp run icons       # regenerate the PWA icons from public/icon.png
vp run ready       # everything CI runs, before you open a pull request
vp run release     # cut a release (maintainers)
```

> Everything the tooling needs lives in [`vite.config.ts`](vite.config.ts).

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs `vp check` and `vp run export`. The export doubles as KML validation, since the conversion refuses a spot that is missing a required tag axis. On `main` it then builds and publishes to GitHub Pages. Pull requests get the checks only.

## 🏷️ Releasing

Maintainers only. No GitHub token is needed locally, because the local half only writes to git.

```bash
vp run release
```

[release-it](https://github.com/release-it/release-it) prompts for the new version, then bumps `package.json`, rewrites `CHANGELOG.md` with git-cliff, commits, tags `vX.Y.Z` and pushes. Add `--dry-run` to see every step without performing any of them, or pass a version to skip the prompt:

```bash
vp run release minor --dry-run
```

Pushing the tag triggers [`.github/workflows/release.yml`](.github/workflows/release.yml), which does the half that needs credentials with the workflow's own token: rebuild the exports from the tagged KML with `vp run export`, render the notes, and create the GitHub release with the KML, KMZ, GPX and GeoJSON attached. That way the assets cannot drift from the data they were tagged with, and the download links keep resolving to the newest release.

The notes come from [git-cliff](https://git-cliff.org/) via [`cliff.toml`](cliff.toml), configured to reproduce GitHub's own format: a flat "What's Changed" list crediting each author, then a "New Contributors" section for first pull requests. That last part only works because `cliff.toml` names the GitHub remote, as first-time status comes from the API rather than the git history. The same config writes `CHANGELOG.md`, so the file and the release notes never disagree.
