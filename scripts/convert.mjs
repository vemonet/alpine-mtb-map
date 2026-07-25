#!/usr/bin/env node
// Regenerate public/alpine-mtb-map.geojson and public/alpine-mtb-map.gpx.
//   npm run convert
// The KML stays the source of truth - never edit the generated files by hand.

import { readFileSync, writeFileSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { kml } from "@tmcw/togeojson";

const SRC = "public/alpine-mtb-map.kml";
const BASE = SRC.replace(/\.kml$/, "");

const doc = new DOMParser().parseFromString(readFileSync(SRC, "utf8"), "text/xml");
const geojson = kml(doc);

// Carry the styleUrl across explicitly as a readable kind, so consumers keep
// the displayed spot category without having to parse KML styles.
const KINDS = {
  "placemark-blue": "bikepark",
  "placemark-green": "natural",
  "placemark-brown": "nolift",
  "placemark-gray": "minor",
  "line-trail": "trail",
};
const kinds = [...doc.getElementsByTagName("Placemark")].map((pm) => {
  const el = pm.getElementsByTagName("styleUrl")[0];
  return KINDS[el ? el.textContent.trim().replace(/^#/, "") : ""] ?? "minor";
});
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

const pt = (tag, [lon, lat], name, desc) =>
  `  <${tag} lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">\n` +
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

const wpts = geojson.features.filter((f) => f.geometry?.type === "Point").length;
console.log(
  `${BASE}.geojson + ${BASE}.gpx: ${wpts} waypoints, ${geojson.features.length - wpts} tracks`,
);
