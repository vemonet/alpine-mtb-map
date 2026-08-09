// Building download files in the page, so a reader can hide what they do not
// want and take the rest with them.
//
// The KML is pruned rather than rebuilt: the source document is re-parsed, the
// unwanted placemarks are removed, and what is left is serialised as-is. That
// keeps styles, ExtendedData, the mwm: namespace and the CDATA description HTML
// byte-for-byte, and means a field added to the KML later needs no change here.
// The GPX and GeoJSON then come off that pruned document through the same code
// the release build uses.

import { strToU8, zipSync } from "fflate";
import { toGeoJson, toGpx } from "./kml-export.ts";

const KML_NS = "http://www.opengis.net/kml/2.2";

const FORMATS = {
  kml: { ext: "kml", type: "application/vnd.google-earth.kml+xml" },
  kmz: { ext: "kmz", type: "application/vnd.google-earth.kmz" },
  gpx: { ext: "gpx", type: "application/gpx+xml" },
  geojson: { ext: "geojson", type: "application/geo+json" },
};

export type DownloadFormat = keyof typeof FORMATS;

export const DOWNLOAD_FORMATS = Object.keys(FORMATS) as DownloadFormat[];

/** The source KML with every placemark whose index is not kept removed. */
function prunedDoc(kmlText: string, keep: Set<number>, title?: string) {
  const doc = new DOMParser().parseFromString(kmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("alpine-mtb-map.kml is not valid XML");

  for (const [index, placemark] of [...doc.getElementsByTagNameNS(KML_NS, "Placemark")].entries()) {
    if (keep.has(index)) continue;
    // Take the indentation in front of it too, otherwise a pruned file is a
    // ladder of blank lines.
    const before = placemark.previousSibling;
    if (before?.nodeType === Node.TEXT_NODE && !before.nodeValue?.trim()) before.remove();
    placemark.remove();
  }

  // A single-trail file that says which trail it is, rather than "Document",
  // in whatever app opens it.
  const document_ = doc.getElementsByTagNameNS(KML_NS, "Document")[0];
  if (title && document_) {
    const name = doc.createElementNS(KML_NS, "name");
    name.textContent = title;
    document_.prepend(doc.createTextNode("\n  "), name);
  }
  return doc;
}

// Whether XMLSerializer keeps the prolog is engine-dependent, and Organic Maps
// wants the encoding declared, so put one back only when it is missing.
const serialize = (doc: Document) => {
  const xml = new XMLSerializer().serializeToString(doc);
  return `${xml.startsWith("<?xml") ? "" : '<?xml version="1.0" encoding="UTF-8"?>\n'}${xml}\n`;
};

export interface BuildFileOptions {
  /** The source KML, unmodified. */
  kmlText: string;
  /** Placemark indices to keep, in source document order. */
  keep: Set<number>;
  /** Human title for the file's metadata. */
  name?: string;
  /** Filename without extension. */
  basename: string;
}

/** Build one downloadable file. */
export function buildFile(
  format: DownloadFormat,
  { kmlText, keep, name, basename }: BuildFileOptions,
) {
  const spec = FORMATS[format];
  if (!spec) throw new Error(`Unknown download format: ${format}`);
  const doc = prunedDoc(kmlText, keep, name);

  let body: string | Uint8Array;
  if (format === "kml") {
    body = serialize(doc);
  } else if (format === "kmz") {
    body = zipSync({ "doc.kml": strToU8(serialize(doc)) }, { level: 6 });
  } else if (format === "geojson") {
    body = `${JSON.stringify(toGeoJson(doc), null, 2)}\n`;
  } else {
    body = toGpx(toGeoJson(doc), name ? { name } : undefined);
  }

  return {
    // fflate hands back a Uint8Array over a plain ArrayBuffer, which is a valid
    // BlobPart; only the SharedArrayBuffer half of the union TS infers is not.
    blob: new Blob([body as BlobPart], { type: spec.type }),
    filename: `${basename}.${spec.ext}`,
  };
}

/** Hand a built file to the browser's downloader. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  // Revoking in the same tick cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A filename-safe stem for a trail or spot name. */
export const slug = (text: string) =>
  text
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 80) || "alpine-mtb-map";
