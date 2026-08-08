#!/usr/bin/env node
// Regenerate alpine-mtb-map.geojson, alpine-mtb-map.gpx, and alpine-mtb-map.kmz.
//   vp run convert
// The KML stays the source of truth - never edit the generated files by hand.
// The three exports are gitignored: the release workflow builds them from the
// tagged KML and attaches them to the GitHub release.

import { readFileSync, writeFileSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { kml } from "@tmcw/togeojson";
import { zipSync, strToU8 } from "fflate";

const SRC = "alpine-mtb-map.kml";
const BASE = SRC.replace(/\.kml$/, "");

const doc = new DOMParser().parseFromString(readFileSync(SRC, "utf8"), "text/xml");
const geojson = kml(doc);

// Carry the styleUrl across explicitly as a readable kind, so consumers keep
// the displayed spot category without having to parse KML styles.
const KINDS = {
  "placemark-blue": "bike-park",
  "placemark-green": "natural",
  "placemark-brown": "no-lift",
  "placemark-gray": "minor",
  "line-trail": "trail",
};
const kinds = [...doc.getElementsByTagName("Placemark")].map((pm) => {
  const el = pm.getElementsByTagName("styleUrl")[0];
  return KINDS[el ? el.textContent.trim().replace(/^#/, "") : ""] ?? "minor";
});

// Fail export generation when a main spot is missing one of the required tag
// axes. This keeps new contributions filterable instead of silently producing
// spots that disappear when a whole filter group is enabled.
const requiredGroups = [
  ["beginner", "expert"],
  ["dh", "enduro", "freeride"],
];
const spotTypes = ["bike-park", "natural"];
const spotTags = new Map();
const mainSpots = new Map();
for (const [index, pm] of [...doc.getElementsByTagName("Placemark")].entries()) {
  const data = [...pm.getElementsByTagName("Data")];
  const facet = (name) =>
    data.find((item) => item.getAttribute("name") === name)?.textContent.trim() ?? "";
  const name = pm.getElementsByTagName("name")[0]?.textContent.trim() ?? "";
  const spot = facet("spot") || name;
  const tags = spotTags.get(spot) ?? new Set();
  for (const tag of facet("tags").split(/\s+/).filter(Boolean)) tags.add(tag);
  spotTags.set(spot, tags);
  if (kinds[index] !== "minor" && kinds[index] !== "trail" && /\[.+\]$/.test(name)) {
    mainSpots.set(spot, name);
  }
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
geojson.features.forEach((f, i) => {
  f.properties.kind = kinds[i];
});

writeFileSync(`${BASE}.geojson`, `${JSON.stringify(geojson, null, 2)}\n`);

// ------------------------------------------------------------------- gpx ---
const esc = (s = "") =>
  String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

// togeojson wraps HTML descriptions as {'@type': 'html', value}. GPX has no
// HTML, so flatten the markup to readable plain text.
const plain = (d) => {
  const html = typeof d === "object" && d ? d.value : d;
  if (!html) return "";
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<table/gi, "\n<table")
    .replace(/<\/(p|tr|table|div)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .split("\n")
    .map((l) => l.replace(/\s*\|\s*$/, "").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const pt = (tag, [lon, lat, ele], name, desc) =>
  `  <${tag} lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">\n` +
  (ele ? `    <ele>${Math.round(ele)}</ele>\n` : "") +
  `    <name>${esc(name)}</name>\n` +
  (desc ? `    <desc>${esc(desc)}</desc>\n` : "") +
  `  </${tag}>`;

const parts = [];
for (const f of geojson.features) {
  const name = f.properties.name;
  const description = plain(f.properties.description);
  const g = f.geometry;
  if (!g) continue;
  if (g.type === "Point") {
    parts.push(pt("wpt", g.coordinates, name, description));
  } else if (g.type === "LineString") {
    const seg = g.coordinates
      .map(([lon, lat]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"/>`)
      .join("\n");
    parts.push(
      `  <trk>\n    <name>${esc(name)}</name>\n` +
        (description ? `    <desc>${esc(description)}</desc>\n` : "") +
        `    <trkseg>\n${seg}\n    </trkseg>\n  </trk>`,
    );
  }
}

writeFileSync(
  `${BASE}.gpx`,
  `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="alpine-mtb-map" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Alpine MTB Map</name>
    <desc>Lift-served mountain-bike spots in the western Alps and Jura. Trail geometries from OpenStreetMap (ODbL).</desc>
  </metadata>
${parts.join("\n")}
</gpx>
`,
);

// ------------------------------------------------------------------- kmz ---
// KMZ is a ZIP archive containing doc.kml. Garmin, Google Earth, etc. prefer
// it over raw KML because it is a single smaller file.
const kmlBytes = strToU8(readFileSync(SRC, "utf8"));
writeFileSync(`${BASE}.kmz`, zipSync({ "doc.kml": kmlBytes }, { level: 6 }));

const wpts = geojson.features.filter((f) => f.geometry?.type === "Point").length;
console.log(
  `${BASE}.geojson + ${BASE}.gpx + ${BASE}.kmz: ${wpts} waypoints, ${geojson.features.length - wpts} tracks`,
);
