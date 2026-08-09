// GeoJSON and GPX generation, shared by the Node export script and the in-page
// downloads so a file built in the browser is the same file the release ships.
//
// Everything here works on an already-parsed KML Document: the caller brings its
// own parser (@xmldom/xmldom under Node, the native DOMParser in the page) and
// nothing here touches the filesystem or a global.

import { kml } from "@tmcw/togeojson";

// styleUrl -> the readable category carried into the exports, so a consumer
// keeps the displayed category without having to parse KML styles. Every line-*
// style is a trail; they differ only by the difficulty colour, which stays
// readable on the styleUrl itself.
export const KINDS = {
  "placemark-blue": "bike-park",
  "placemark-green": "natural",
  "placemark-brown": "no-lift",
  "placemark-gray": "minor",
  "line-green": "trail",
  "line-blue": "trail",
  "line-red": "trail",
  "line-black": "trail",
  "line-trail": "trail",
};

/** Category for a raw styleUrl, with or without its leading "#". */
export const kindOf = (styleUrl = "") => KINDS[styleUrl.trim().replace(/^#/, "")] ?? "minor";

/**
 * GeoJSON for a KML document, with each styleUrl resolved into properties.kind.
 * togeojson emits one feature per placemark in document order, which is what
 * lets the two lists be zipped by index.
 */
export function toGeoJson(doc) {
  const geojson = kml(doc);
  const placemarks = [...doc.getElementsByTagName("Placemark")];
  geojson.features.forEach((feature, index) => {
    const style = placemarks[index]?.getElementsByTagName("styleUrl")[0];
    feature.properties.kind = kindOf(style?.textContent ?? "");
  });
  return geojson;
}

// --------------------------------------------------------------------- gpx ---
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

const GPX_DESC =
  "Lift-served mountain-bike spots in the western Alps and Jura. Trail geometries from OpenStreetMap (ODbL).";

/** GPX 1.1 for a GeoJSON feature collection: points as waypoints, lines as tracks. */
export function toGpx(geojson, { name = "Alpine MTB Map", desc = GPX_DESC } = {}) {
  const parts = [];
  for (const f of geojson.features) {
    const title = f.properties.name;
    const description = plain(f.properties.description);
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Point") {
      parts.push(pt("wpt", g.coordinates, title, description));
    } else if (g.type === "LineString") {
      const seg = g.coordinates
        .map(([lon, lat]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"/>`)
        .join("\n");
      parts.push(
        `  <trk>\n    <name>${esc(title)}</name>\n` +
          (description ? `    <desc>${esc(description)}</desc>\n` : "") +
          `    <trkseg>\n${seg}\n    </trkseg>\n  </trk>`,
      );
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="alpine-mtb-map" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${esc(name)}</name>
    <desc>${esc(desc)}</desc>
  </metadata>
${parts.join("\n")}
</gpx>
`;
}
