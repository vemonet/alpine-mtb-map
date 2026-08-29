// GeoJSON and GPX generation, shared by the Node export script and the in-page
// downloads so a file built in the browser is the same file the release ships.
//
// Everything here works on an already-parsed KML Document: the caller brings its
// own parser (@xmldom/xmldom under Node, the native DOMParser in the page) and
// nothing here touches the filesystem or a global.

import { kml } from "@tmcw/togeojson";
import type { FeatureCollection, Geometry, Position } from "geojson";

/** Either DOM implementation togeojson accepts: the browser's or @xmldom/xmldom's. */
export type KmlDocument = Parameters<typeof kml>[0];

const KML_NS = "http://www.opengis.net/kml/2.2";

// The KML says all of this in its own <Document>, so a downloaded .kml is
// self-describing. GPX and GeoJSON each have their own slot for it and this is
// where those get filled, so that no export can be redistributed without the
// notice ODbL section 4.2 requires. Keep in step with LICENSE section 1.
export const LICENCE = {
  id: "ODbL-1.0",
  url: "https://opendatacommons.org/licenses/odbl/1-0/",
  attribution: "Data (c) OpenStreetMap contributors and Vincent Emonet, ODbL 1.0",
  holder: "OpenStreetMap contributors and Vincent Emonet",
  source: "https://github.com/vemonet/alpine-mtb-map",
  author: "Vincent Emonet and contributors",
  year: "2026",
} as const;

/** A feature collection carrying the licence as GeoJSON foreign members. */
export type LicensedFeatureCollection = FeatureCollection<Geometry | null> & {
  name?: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  source: string;
};

/**
 * The <name> of the KML <Document>, which the in-page download rewrites when a
 * reader takes a single trail. Walks direct children rather than using
 * getElementsByTagName, so a Placemark name can never be picked up by mistake.
 */
function documentTitle(doc: KmlDocument): string | undefined {
  const document_ = (doc as Document).getElementsByTagNameNS(KML_NS, "Document")[0];
  for (const child of [...(document_?.childNodes ?? [])]) {
    const el = child as Element;
    if (el.nodeType === 1 && el.localName === "name" && el.namespaceURI === KML_NS) {
      return el.textContent?.trim() || undefined;
    }
  }
  return undefined;
}

/** The readable category carried into the exports. */
export type Kind = "bike-park" | "natural" | "no-lift" | "minor" | "trail";

// styleUrl -> the readable category carried into the exports, so a consumer
// keeps the displayed category without having to parse KML styles. Every line-*
// style is a trail; they differ only by the difficulty colour, which stays
// readable on the styleUrl itself.
export const KINDS: Record<string, Kind> = {
  "placemark-blue": "bike-park",
  "placemark-green": "natural",
  "placemark-brown": "no-lift",
  "placemark-gray": "minor",
  "line-green": "trail",
  "line-blue": "trail",
  "line-red": "trail",
  "line-black": "trail",
  "line-orange": "trail",
  "line-trail": "trail",
};

/** Category for a raw styleUrl, with or without its leading "#". */
export const kindOf = (styleUrl = ""): Kind => KINDS[styleUrl.trim().replace(/^#/, "")] ?? "minor";

/**
 * GeoJSON for a KML document, with each styleUrl resolved into properties.kind.
 * togeojson emits one feature per placemark in document order, which is what
 * lets the two lists be zipped by index.
 */
export function toGeoJson(doc: KmlDocument): LicensedFeatureCollection {
  const geojson = kml(doc);
  // The two DOM implementations declare incompatible Element types, but only
  // the shared getElementsByTagName/textContent surface is used here.
  const placemarks = [...(doc as Document).getElementsByTagName("Placemark")];
  geojson.features.forEach((feature, index) => {
    const style = placemarks[index]?.getElementsByTagName("styleUrl")[0];
    feature.properties ??= {};
    feature.properties.kind = kindOf(style?.textContent ?? "");
  });
  // Foreign members, which RFC 7946 section 6.1 allows on a FeatureCollection.
  // Rebuilt rather than assigned so they serialise before the huge features
  // array and a reader meets the licence at the top of the file.
  const { features, ...rest } = geojson;
  return {
    ...rest,
    name: documentTitle(doc),
    license: LICENCE.id,
    licenseUrl: LICENCE.url,
    attribution: LICENCE.attribution,
    source: LICENCE.source,
    features,
  };
}

// --------------------------------------------------------------------- gpx ---
const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

const esc = (s: unknown = "") => String(s).replace(/[&<>]/g, (c) => ENTITIES[c] ?? c);

// togeojson wraps HTML descriptions as {'@type': 'html', value}. GPX has no
// HTML, so flatten the markup to readable plain text.
const plain = (d: string | { value?: string } | null | undefined) => {
  const html = typeof d === "object" && d ? d.value : d;
  if (!html) return "";
  return html
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

const pt = (tag: string, [lon, lat, ele]: Position, name: string, desc: string) =>
  `  <${tag} lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">\n` +
  (ele ? `    <ele>${Math.round(ele)}</ele>\n` : "") +
  `    <name>${esc(name)}</name>\n` +
  (desc ? `    <desc>${esc(desc)}</desc>\n` : "") +
  `  </${tag}>`;

const GPX_DESC =
  "Mountain-bike spots worldwide: downhill bike parks, enduro trails and freeride spots, " +
  "with lift prices, season dates and travel times. Trail geometries from OpenStreetMap (ODbL).";

// GPX 1.1 fixes the order of <metadata>'s children (name, desc, author,
// copyright, link), and a validator rejects any other arrangement - so this
// block is a literal rather than something assembled per field.
const GPX_METADATA =
  `    <author>\n` +
  `      <name>${esc(LICENCE.author)}</name>\n` +
  `      <link href="${esc(LICENCE.source)}"><text>Alpine MTB Map</text></link>\n` +
  `    </author>\n` +
  `    <copyright author="${esc(LICENCE.holder)}">\n` +
  `      <year>${esc(LICENCE.year)}</year>\n` +
  `      <license>${esc(LICENCE.url)}</license>\n` +
  `    </copyright>\n` +
  `    <link href="${esc(LICENCE.source)}"><text>Alpine MTB Map</text></link>\n`;

/** GPX 1.1 for a GeoJSON feature collection: points as waypoints, lines as tracks. */
export function toGpx(
  geojson: FeatureCollection<Geometry | null> & { name?: string },
  {
    name = geojson.name ?? "Alpine MTB Map",
    desc = GPX_DESC,
  }: { name?: string; desc?: string } = {},
) {
  const parts = [];
  for (const f of geojson.features) {
    const title = String(f.properties?.name ?? "");
    const description = plain(f.properties?.description);
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
${GPX_METADATA}  </metadata>
${parts.join("\n")}
</gpx>
`;
}
