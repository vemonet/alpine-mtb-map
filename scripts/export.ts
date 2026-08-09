#!/usr/bin/env node
// Regenerate alpine-mtb-map.geojson, alpine-mtb-map.gpx, and alpine-mtb-map.kmz.
//   vp run export
// The KML stays the source of truth - never edit the generated files by hand.
// The three exports are gitignored: the release workflow builds them from the
// tagged KML and attaches them to the GitHub release.
//
// The GeoJSON and GPX generation itself lives in src/lib/kml-export.ts, shared
// with the page so a download built in the browser matches the released file.
//
// Node 22.18+ strips the types on the fly, so this runs as a plain `node` script.

import { readFileSync, writeFileSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { zipSync, strToU8 } from "fflate";
import { kindOf, toGeoJson, toGpx } from "../src/lib/kml-export.ts";

const SRC = "alpine-mtb-map.kml";
const BASE = SRC.replace(/\.kml$/, "");

const doc = new DOMParser().parseFromString(readFileSync(SRC, "utf8"), "text/xml");

// Fail export generation when a main spot is missing one of the required tag
// axes. This keeps new contributions filterable instead of silently producing
// spots that disappear when a whole filter group is enabled.
const requiredGroups = [
  ["beginner", "expert"],
  ["dh", "enduro", "freeride"],
];
const spotTypes = ["bike-park", "natural"];
// The pin colours that mark a spot in its own right, as opposed to a secondary
// grey waypoint or a trail line.
const mainKinds = new Set(["bike-park", "natural", "no-lift"]);
const spotTags = new Map<string, Set<string>>();
const mainSpots = new Map<string, string>();
for (const pm of doc.getElementsByTagName("Placemark")) {
  const data = [...pm.getElementsByTagName("Data")];
  const facet = (name: string) =>
    data.find((item) => item.getAttribute("name") === name)?.textContent?.trim() ?? "";
  const name = pm.getElementsByTagName("name")[0]?.textContent?.trim() ?? "";
  const kind = kindOf(pm.getElementsByTagName("styleUrl")[0]?.textContent ?? "");
  const spot = facet("spot") || name;
  const tags = spotTags.get(spot) ?? new Set();
  for (const tag of facet("tags").split(/\s+/).filter(Boolean)) tags.add(tag);
  spotTags.set(spot, tags);
  if (mainKinds.has(kind) && /\[.+\]$/.test(name)) mainSpots.set(spot, name);
}
for (const [spot, name] of mainSpots) {
  const tags = spotTags.get(spot);
  if (spotTypes.filter((tag) => tags?.has(tag)).length !== 1) {
    throw new Error(`${name} needs exactly one of: ${spotTypes.join(", ")}`);
  }
  for (const group of requiredGroups) {
    if (!group.some((tag) => tags?.has(tag))) {
      throw new Error(`${name} needs at least one of: ${group.join(", ")}`);
    }
  }
}

const geojson = toGeoJson(doc);
writeFileSync(`${BASE}.geojson`, `${JSON.stringify(geojson, null, 2)}\n`);
writeFileSync(`${BASE}.gpx`, toGpx(geojson));

// ------------------------------------------------------------------- kmz ---
// KMZ is a ZIP archive containing doc.kml. Garmin, Google Earth, etc. prefer
// it over raw KML because it is a single smaller file.
const kmlBytes = strToU8(readFileSync(SRC, "utf8"));
writeFileSync(`${BASE}.kmz`, zipSync({ "doc.kml": kmlBytes }, { level: 6 }));

const wpts = geojson.features.filter((f) => f.geometry?.type === "Point").length;
const trails = geojson.features.filter((f) => f.properties?.kind === "trail").length;
console.log(
  `${BASE}.geojson + ${BASE}.gpx + ${BASE}.kmz: ${wpts} waypoints, ` +
    `${geojson.features.length - wpts} tracks (${trails} tagged as trails)`,
);
