import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-leaflet";
import "./style.css";
import { KINDS } from "./lib/kml-export.js";
import { buildFile, saveBlob, slug } from "./lib/downloads.js";

// The KML is the single source of truth. Importing it as an asset lets the
// bundler fingerprint and precache it; the downloadable copies are published as
// GitHub release assets rather than served from here.
import kmlUrl from "../alpine-mtb-map.kml?url";

const kmlResponse = await fetch(kmlUrl);
if (!kmlResponse.ok) throw new Error(`Could not load ${kmlUrl}: ${kmlResponse.status}`);
const kmlText = await kmlResponse.text();

const KML_NS = "http://www.opengis.net/kml/2.2";

// Trail line styleUrl -> stroke colour, mirrors the KML's own <Style> defs
// so the web map and Organic Maps (which reads the KML style directly) match.
const TRAIL_COLORS = {
  "line-green": "#2b8a3e",
  "line-blue": "#1864ab",
  "line-red": "#c92a2a",
  "line-black": "#000000",
  "line-trail": "#c92a2a",
};
const TRAIL_COLOR = TRAIL_COLORS["line-trail"];
// Distinct from the blue spot pins, so 'you are here' never reads as a spot.
const LOCATE_COLOR = "#7048e8";

/** Parse the KML into a flat list of {name, description, band, type, coords}. */
function parseKml(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("alpine-mtb-map.kml is not valid XML");

  const text_ = (el, tag) => el.getElementsByTagNameNS(KML_NS, tag)[0]?.textContent?.trim() ?? "";
  const parseCoords = (s) =>
    s
      .trim()
      .split(/\s+/)
      .map((t) => t.split(",").map(Number))
      .filter((c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
      .map(([lon, lat]) => [lat, lon]); // Leaflet wants lat,lon

  // <Data name="..."><value>...</value></Data> facets, ignored by Organic Maps.
  const facet = (pm, key) => {
    for (const d of pm.getElementsByTagNameNS(KML_NS, "Data")) {
      if (d.getAttribute("name") === key) return text_(d, "value");
    }
    return "";
  };

  return [...doc.getElementsByTagNameNS(KML_NS, "Placemark")].map((pm, index) => {
    const styleUrl = text_(pm, "styleUrl").replace(/^#/, "");
    const point = pm.getElementsByTagNameNS(KML_NS, "Point")[0];
    const line = pm.getElementsByTagNameNS(KML_NS, "LineString")[0];
    const geom = point || line;
    return {
      // Position in the source document, so a download can prune the KML itself
      // rather than being rebuilt from these objects and losing what they drop.
      index,
      name: text_(pm, "name"),
      description: text_(pm, "description"),
      kind: KINDS[styleUrl] ?? "minor",
      styleUrl,
      spot: facet(pm, "spot"),
      tags: facet(pm, "tags").split(/\s+/).filter(Boolean),
      priceDay: facet(pm, "price_day"),
      priceSeason: facet(pm, "price_season"),
      openFrom: facet(pm, "open_from"),
      closedFrom: facet(pm, "closed_from"),
      type: point ? "point" : "line",
      coords: geom ? parseCoords(text_(geom, "coordinates")) : [],
      elevation:
        geom && point ? Number.parseFloat(text_(geom, "coordinates").split(",")[2]) || 0 : 0,
    };
  });
}

// Prices are stored in the currency the operator charges ("33 EUR"). The price
// filter needs one scale, so they are converted at rough, deliberately static
// rates: this sorts spots into the right bracket, it is not a quote. A
// currency missing from the table reads as "no price", so the slider ignores
// the spot rather than bracketing it wrongly.
const CHF_PER = {
  CHF: 1,
  EUR: 0.95,
  GBP: 1.1,
  USD: 0.8,
  CAD: 0.58,
  AUD: 0.53,
  NZD: 0.48,
  JPY: 0.0053,
  CZK: 0.038,
  PLN: 0.22,
  RON: 0.19,
  UAH: 0.019,
  TWD: 0.025,
  PHP: 0.014,
  MUR: 0.017,
};
function chf(price) {
  const m = /([\d.]+)\s*([A-Z]{3})/i.exec(price);
  const rate = m && CHF_PER[m[2].toUpperCase()];
  return rate ? +m[1] * rate : null;
}

const places = parseKml(kmlText).filter((p) => p.coords.length);

// What the reader has taken off their map. Hiding is deliberate and sticky,
// unlike the filters: it survives reloads and it is what the downloads honour,
// so the file you save is the map you built.
const HIDDEN_TRACES_STORAGE_KEY = "hiddenTraces";
const HIDDEN_SPOTS_STORAGE_KEY = "hiddenSpots";
const traceId = (place) => `${place.spot}\n${place.name}`;
const readHidden = (key) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set();
  }
};
const hiddenTraceIds = readHidden(HIDDEN_TRACES_STORAGE_KEY);
const hiddenSpotIds = readHidden(HIDDEN_SPOTS_STORAGE_KEY);
const saveHidden = () => {
  try {
    localStorage.setItem(HIDDEN_TRACES_STORAGE_KEY, JSON.stringify([...hiddenTraceIds]));
    localStorage.setItem(HIDDEN_SPOTS_STORAGE_KEY, JSON.stringify([...hiddenSpotIds]));
  } catch {
    // Hiding still works for this session when storage is unavailable or full.
  }
};

// ------------------------------------------------------------------ map ---
const DEFAULT_VIEW = [46.2, 8.0];
const DEFAULT_ZOOM = 7;
const DEFAULT_MAP_LAYER = "OpenStreetMap";
const MAP_LAYER_STORAGE_KEY = "mapLayer";

// ?spot= / ?trace= are read before the map exists so the very first frame is
// already over the requested place: opening on the default view and moving
// afterwards costs a visible jump and a round of tile loads for the Alps.
const requestedUrl = new URL(window.location.href);
const requestedTrace = requestedUrl.searchParams.get("trace");
const requestedSpot = requestedUrl.searchParams.get("spot");
const requestedInitialPlace = requestedTrace
  ? places.find((p) => p.type === "line" && p.name === requestedTrace)
  : requestedSpot &&
    places.find((p) => p.type === "point" && p.kind !== "minor" && p.spot === requestedSpot);
const initialView = requestedInitialPlace
  ? [
      requestedInitialPlace.coords[Math.floor(requestedInitialPlace.coords.length / 2)],
      requestedInitialPlace.type === "line" ? 14 : 12,
    ]
  : [DEFAULT_VIEW, DEFAULT_ZOOM];
// Zoom moves to the right: the top-left corner belongs to the details card.
const map = L.map("map", { scrollWheelZoom: true, zoomControl: false }).setView(...initialView);
L.control.zoom({ position: "topright" }).addTo(map);

const attribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const cartoAttribution = `${attribution}, &copy; <a href="https://carto.com/attributions">CARTO</a>`;
const openFreeMapAttribution = `${attribution}, <a href="https://openfreemap.org/">OpenFreeMap</a>`;

const layers = {
  OpenStreetMap: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution,
  }),
  OpenTopoMap: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    attribution: `${attribution}, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`,
  }),
  CyclOSM: L.tileLayer("https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: `${attribution}, <a href="https://www.cyclosm.org">CyclOSM</a>`,
  }),
  "OpenFreeMap Liberty": L.maplibreGL({
    style: "https://tiles.openfreemap.org/styles/liberty",
    attribution: openFreeMapAttribution,
  }),
  "CARTO Voyager": L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      subdomains: "abcd",
      maxZoom: 20,
      attribution: cartoAttribution,
    },
  ),
};
const savedMapLayer = localStorage.getItem(MAP_LAYER_STORAGE_KEY);
const initialMapLayer = Object.hasOwn(layers, savedMapLayer) ? savedMapLayer : DEFAULT_MAP_LAYER;
layers[initialMapLayer].addTo(map);
L.control.layers(layers).addTo(map);
L.control.scale({ imperial: false, maxWidth: 140 }).addTo(map);
map.on("baselayerchange", ({ name }) => localStorage.setItem(MAP_LAYER_STORAGE_KEY, name));

const pinIcon = (kind, wet = false) =>
  L.divIcon({
    className: "",
    html: `<div class="pin ${kind}">${
      wet
        ? '<span class="wet-badge" aria-hidden="true"><svg viewBox="0 0 8 10" width="6" height="8" fill="currentColor"><path d="M4 0C3 2 1 4.2 1 6.2a3 3 0 0 0 6 0C7 4.2 5 2 4 0Z"/></svg></span>'
        : ""
    }</div>`,
    iconSize: [15, 15],
    iconAnchor: [7, 7],
  });

// Display labels for compound tags: keep the rest as-is.
const TAG_DISPLAY = {
  dh: "DH",
};

const displayTag = (tag) => TAG_DISPLAY[tag] ?? tag;

const tagBadges = (tags) => {
  if (!tags?.size) return "";
  const badges = [...tags]
    .sort()
    .map((tag) => {
      const label = displayTag(tag);
      return `<span class="tag-badge tag-${label.toLowerCase()}">${label}</span>`;
    })
    .join("");
  return `<div class="tag-badges">${badges}</div>`;
};

const traceCountSummary = (spot) => {
  const counts = new Map();
  for (const { place } of spot.places) {
    if (place.type !== "line") continue;
    const color = place.styleUrl === "line-trail" ? "red" : place.styleUrl.replace(/^line-/, "");
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return ["green", "blue", "red", "black"]
    .filter((color) => counts.has(color))
    .map(
      (color) =>
        `<span class="trace-count trace-count-${color}">${counts.get(color)} ${color}</span>`,
    )
    .join('<span class="trace-count-separator"> · </span>');
};

// The share, hide and close buttons live in the card's own markup rather than
// here: they must stay put while the description under them scrolls.
const baseCard = (p, spot) => {
  const traceCounts = p.type === "point" ? traceCountSummary(spot) : "";
  return `<h3>${p.name}</h3>${traceCounts ? `<div class="trace-counts">${traceCounts}</div>` : ""}${p.description || ""}`;
};

// A spot owns its main pin, its secondary pins and its trail lines: they are
// shown and hidden together, so the filters operate on whole spots.
const spots = new Map(); // key -> {tags: Set, searchText, priceDay, group, entry}
const entries = []; // sidebar rows, one per main pin
const lineLayers = []; // {layer, spot, color} - lets the Lines filter toggle trails independently of their spot
// Canvas click tolerance grows the invisible hit area without changing the
// visible stroke. Touch pointers get extra room for less precise input.
const trailRenderer = L.canvas({
  tolerance: window.matchMedia("(pointer: coarse)").matches ? 14 : 8,
});

for (const p of places) {
  const lineColor = p.styleUrl?.replace(/^line-/, "") ?? "trail";
  const layer =
    p.type === "point"
      ? L.marker(p.coords[0], {
          icon: pinIcon(p.kind),
          title: p.name,
          // Leaflet stacks markers by latitude, so a secondary grey pin can end
          // up over its own spot's main pin. Push the grey ones far enough down
          // that they always sit behind every main pin, at any zoom.
          zIndexOffset: p.kind === "minor" ? -100000 : 0,
        })
      : L.polyline(p.coords, {
          color: TRAIL_COLORS[p.styleUrl] ?? TRAIL_COLOR,
          weight: 4,
          opacity: 0.85,
          renderer: trailRenderer,
        });

  const key = p.spot || p.name;
  let spot = spots.get(key);
  if (!spot) {
    spot = {
      id: key,
      tags: new Set(),
      searchText: "",
      priceDay: null,
      openFrom: "",
      closedFrom: "",
      weather: null,
      places: [],
      weatherPlace: null,
      group: L.layerGroup().addTo(map),
    };
    spots.set(key, spot);
  }
  spot.group.addLayer(layer);
  spot.places.push({ layer, place: p });
  if (p.type === "point" && (!spot.weatherPlace || p.elevation > spot.weatherPlace.elevation)) {
    spot.weatherPlace = p;
  }
  if (p.type === "line") lineLayers.push({ layer, spot, place: p, color: lineColor });
  spot.searchText += ` ${p.name} ${p.description}`.toLocaleLowerCase();
  layer.on("click", (event) => {
    // Otherwise the same click reaches the map and closes the card again.
    L.DomEvent.stopPropagation(event);
    openPlaceCard(p, spot, layer);
  });

  // A spot's tag set is the union of its placemarks', plus two tags derived
  // from data that is already there: the no-lift style and season price facet.
  // Everything downstream then filters on tags alone.
  for (const t of p.tags) spot.tags.add(t);
  if (p.kind === "no-lift") spot.tags.add("no-lift");
  if (p.priceSeason) spot.tags.add("season");
  if (p.priceDay) spot.priceDay = chf(p.priceDay);
  if (p.openFrom && p.closedFrom) {
    spot.openFrom = p.openFrom;
    spot.closedFrom = p.closedFrom;
  }

  // Main spot pins are the ones carrying a "[28 CHF]" summary in the name.
  const m = p.name.match(/^(.*?)\s*\[(.+)\]$/);
  if (p.type === "point" && m && p.kind !== "minor") {
    const entry = { name: m[1], meta: m[2], kind: p.kind, layer, spot, place: p };
    spot.entry = entry;
    entries.push(entry);
  }
}

// Keep the first load focused on the Swiss and French Alps. Fitting every
// entry would zoom out to include the Canadian and Japanese spots.
requestAnimationFrame(() => {
  map.invalidateSize();
});

// -------------------------------------------------------------- sidebar ---
const list = document.getElementById("spots");
const placeCard = document.getElementById("place-card");
const placeCardBody = document.getElementById("place-card-body");
const placeCardHideButton = document.getElementById("place-card-hide");
const placeCardDownloadMenu = document.getElementById("place-card-download");
let activePlace = null;

const placeUrl = (place, spot) => {
  const url = new URL(window.location.href);
  url.searchParams.delete("spot");
  url.searchParams.delete("trace");
  if (place.type === "line") url.searchParams.set("trace", place.name);
  else url.searchParams.set("spot", spot.id);
  return url;
};

const setSelectedPlaceUrl = (place, spot) => {
  const url = placeUrl(place, spot);
  history.replaceState(place.type === "line" ? { trace: place.name } : { spot: spot.id }, "", url);
};

const clearSelectedPlaceUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("spot");
  url.searchParams.delete("trace");
  history.replaceState(null, "", url);
};

const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // The legacy path still works in some installed PWAs where the modern
      // clipboard API exists but is denied.
    }
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
};

// Hiding a trace takes that one line off the map; hiding anything else takes
// the whole spot, pins and trails together, which is what a reader clicking a
// spot's own pin means by "not this one".
placeCardHideButton.addEventListener("click", () => {
  if (!activePlace) return;
  const { place, spot } = activePlace;
  if (place.type === "line") hiddenTraceIds.add(traceId(place));
  else hiddenSpotIds.add(spot.id);
  saveHidden();
  closePlaceCard();
  applyFilters();
});

document.getElementById("place-card-share").addEventListener("click", async (event) => {
  if (!activePlace) return;
  const button = event.currentTarget;
  const { place, spot } = activePlace;
  const url = placeUrl(place, spot).toString();
  if (navigator.share) {
    try {
      await navigator.share({ title: place.name, url });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  try {
    await copyText(url);
    button.title = "Link copied";
    button.setAttribute("aria-label", "Link copied");
    setTimeout(() => {
      button.title = "Share";
      button.setAttribute("aria-label", "Share");
    }, 1500);
  } catch (error) {
    console.warn("Could not share this map link", error);
  }
});

// Dim a clicked trail, or every trail linked to a clicked spot, with the same style.
let selectedLines = [];
const selectLines = (layers) => {
  for (const layer of selectedLines) layer.setStyle({ opacity: 0.85 });
  for (const layer of layers) layer.setStyle({ opacity: 0.45 });
  selectedLines = layers;
};
const clearSelectedLines = () => {
  for (const layer of selectedLines) layer.setStyle({ opacity: 0.85 });
  selectedLines = [];
};

function openPlaceCard(place, spot, layer) {
  activePlace = { place, spot, layer };
  placeCardBody.innerHTML = cardContent(place, spot);
  placeCardBody.scrollTop = 0;
  const hideLabel = `Hide this ${place.type === "line" ? "trace" : "spot"}`;
  placeCardHideButton.hidden = false;
  placeCardHideButton.title = hideLabel;
  placeCardHideButton.setAttribute("aria-label", hideLabel);
  placeCardDownloadMenu.removeAttribute("open");
  placeCard.hidden = false;
  setSelectedPlaceUrl(place, spot);
  if (place.type === "line") selectLines([layer]);
  else
    selectLines(spot.places.filter(({ place }) => place.type === "line").map(({ layer }) => layer));
}

function closePlaceCard() {
  if (!activePlace) return;
  activePlace = null;
  placeCard.hidden = true;
  placeCardDownloadMenu.removeAttribute("open");
  placeCardBody.innerHTML = "";
  clearSelectedPlaceUrl();
  clearSelectedLines();
}

document.getElementById("place-card-close").addEventListener("click", closePlaceCard);
map.on("click", closePlaceCard);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePlaceCard();
});

const showEntry = (entry, animate = true) => {
  const latlng = entry.layer.getLatLng();
  // flyTo treats duration 0 as "unset" and falls back to its own easing, so an
  // unanimated jump has to go through setView.
  if (animate) map.flyTo(latlng, 12, { duration: 0.6 });
  else map.setView(latlng, 12, { animate: false });
  openPlaceCard(entry.place, entry.spot, entry.layer);
};

const showTrace = (entry, animate = true) => {
  map.fitBounds(entry.layer.getBounds(), {
    animate,
    duration: animate ? 0.6 : 0,
    maxZoom: 15,
    padding: [30, 30],
  });
  openPlaceCard(entry.place, entry.spot, entry.layer);
};

// A trace is drawn in the order its LineString is stored, which for these is
// the riding direction. Small chevrons at the first vertex and at the halfway
// point say which way that is without turning the line itself into a dashed
// arrow pattern. The middle one is what you see when you are zoomed in on the
// body of a trail and its trailhead is off screen.
//
// Arrows are markers, so they are built only for the traces actually on screen
// and only once zoomed in far enough to be riding a line rather than browsing
// the map: at world zoom there would be hundreds of them and they would read as
// noise. Everything is rebuilt on move, zoom and filter rather than kept in
// sync, which is cheap at these counts and cannot drift.
const ARROW_MIN_ZOOM = 12;
// How far along the line to look before the bearing is trusted.
const ARROW_HEADING_PX = 12;
const traceArrows = L.layerGroup().addTo(map);

const arrowIcon = (color, angle) =>
  L.divIcon({
    className: "",
    html: `<div class="trace-arrow" style="transform:rotate(${angle}deg)"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 1.5 L9.5 6 L2.5 10.5 Z" fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" paint-order="stroke"/></svg></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

// Below this on-screen length the two arrows would sit on top of each other, so
// a short trace keeps only the one at its start.
const ARROW_MID_MIN_PX = 60;

// Heading at a point on the line: look forward until the line has moved far
// enough to trust the bearing, otherwise a stray vertex on a switchback points
// the arrow the wrong way. Falls back to the last vertex on a stub.
const headingAt = (pixels, from, at) => {
  let ahead = null;
  for (let i = at; i < pixels.length; i++) {
    if (pixels[i].distanceTo(from) >= ARROW_HEADING_PX) {
      ahead = pixels[i];
      break;
    }
  }
  ahead ??= pixels[pixels.length - 1];
  return (Math.atan2(ahead.y - from.y, ahead.x - from.x) * 180) / Math.PI;
};

const updateTraceArrows = () => {
  traceArrows.clearLayers();
  if (map.getZoom() < ARROW_MIN_ZOOM) return;
  const view = map.getBounds();
  for (const { layer, place } of lineLayers) {
    if (!map.hasLayer(layer) || !view.intersects(layer.getBounds())) continue;
    const pts = layer.getLatLngs();
    if (pts.length < 2) continue;
    const color = TRAIL_COLORS[place.styleUrl] ?? TRAIL_COLOR;
    const pixels = pts.map((p) => map.latLngToLayerPoint(p));

    const arrow = (latlng, angle) =>
      L.marker(latlng, {
        icon: arrowIcon(color, angle),
        interactive: false, // never steal a click from the line it sits on
        keyboard: false,
        zIndexOffset: -200000, // decoration: below every pin, including the grey ones
      }).addTo(traceArrows);

    arrow(pts[0], headingAt(pixels, pixels[0], 1));

    // Halfway by on-screen length, not by vertex count: the vertices of an
    // imported trace bunch up in the corners and would drag the middle arrow
    // towards whichever end was recorded in more detail.
    const steps = pixels.slice(1).map((p, i) => p.distanceTo(pixels[i]));
    const total = steps.reduce((a, b) => a + b, 0);
    if (total < ARROW_MID_MIN_PX) continue;
    let run = 0;
    let seg = 0;
    while (seg < steps.length - 1 && run + steps[seg] < total / 2) run += steps[seg++];
    const t = steps[seg] ? (total / 2 - run) / steps[seg] : 0;
    const mid = L.point(
      pixels[seg].x + (pixels[seg + 1].x - pixels[seg].x) * t,
      pixels[seg].y + (pixels[seg + 1].y - pixels[seg].y) * t,
    );
    arrow(map.layerPointToLatLng(mid), headingAt(pixels, mid, seg + 1));
  }
};

map.on("moveend zoomend", updateTraceArrows);

// A trace can exist without a spot pin of its own: nothing requires a spot to
// have a main placemark, only that its traces carry the tags the filters need.
// Such a trace labels itself from its own name ("Taney: ..." -> "Taney") rather
// than showing the raw spot id.
const traceMeta = (spot, place) =>
  spot.entry?.name ?? (place.name.includes(":") ? place.name.split(":")[0].trim() : spot.id);

const traceEntries = lineLayers.map(({ layer, spot, place, color }) => ({
  name: place.name,
  meta: traceMeta(spot, place),
  searchText: `${place.name} ${place.description}`.toLocaleLowerCase(),
  layer,
  spot,
  place,
  color,
}));

const addResultRow = (entry, show) => {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.innerHTML = `<span class="name">${entry.name}</span><span class="meta">${entry.meta}</span>`;
  btn.addEventListener("click", () => show(entry));
  li.append(btn);
  list.append(li);
  entry.row = li;
};

// The KML lists placemarks grouped by spot, which puts the sidebar in an order
// nobody can predict from the outside. Sort by name so a result can be found by
// scanning, and fall back to the spot name so a trail name reused across resorts
// still lands in a stable place.
const byName = (a, b) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }) ||
  a.meta.localeCompare(b.meta, undefined, { sensitivity: "base" });

for (const entry of [...entries].sort(byName)) addResultRow(entry, showEntry);
for (const entry of [...traceEntries].sort(byName)) addResultRow(entry, showTrace);

const requestedEntry = requestedSpot && spots.get(requestedSpot)?.entry;
if (requestedTrace) {
  const requestedPlace = requestedInitialPlace
    ? traceEntries.find((entry) => entry.place === requestedInitialPlace)
    : null;
  if (requestedPlace) requestAnimationFrame(() => showTrace(requestedPlace, false));
} else if (requestedEntry) requestAnimationFrame(() => showEntry(requestedEntry, false));

const dateInput = document.getElementById("open-date");
const dateDisplay = document.getElementById("open-date-display");
const dateButton = document.getElementById("open-date-button");

// --------------------------------------------------------------- weather ---
// Open-Meteo accepts comma-separated coordinate lists. Fetching the main pins
// in batches keeps the request URLs bounded while avoiding one request per
// spot. One response contains three past days and the full 16-day forecast
// window, leaving room to show three days on either side of the selected date.
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const WEATHER_BATCH_SIZE = 40;
const WEATHER_CACHE_KEY = "alpine-mtb-weather-v2";
const WEATHER_CACHE_TTL = 6 * 60 * 60 * 1000;
// One uncached sweep is 20-odd requests. Firing them all at once means that by
// the time the first 429 comes back the rest have already been spent, so the
// sweep runs through a small pool instead and can be stopped mid-way.
const WEATHER_CONCURRENCY = 4;
// Remembered across reloads: without it a refresh spends the next allowance the
// moment it is granted, which is how a minute-bucket 429 turns into a daily one.
const WEATHER_LIMIT_KEY = "alpine-mtb-weather-retry-at";
const WEATHER_RAIN_MM = 1;
const WEATHER_PREVIOUS_DAY_MM = 5;
const WEATHER_RAIN_PROBABILITY = 50;

// A spot's "rain-sensitive"/"rain-resilient" tag scales how easily it reads as
// wet: impacted spots keep the sensitive defaults above, untagged ("normal")
// spots need a bit more rain to flag, and resilient ones only flag on a
// genuinely wet day itself (no probability or previous-day carry-over).
const RAIN_SENSITIVITY = {
  impacted: {
    rain: WEATHER_RAIN_MM,
    previous: WEATHER_PREVIOUS_DAY_MM,
    probability: WEATHER_RAIN_PROBABILITY,
  },
  normal: { rain: 3, previous: 10, probability: 65 },
  resilient: { rain: 15, previous: null, probability: null },
};
const rainSensitivityOf = (spot) =>
  spot.tags.has("rain-resilient")
    ? "resilient"
    : spot.tags.has("rain-sensitive")
      ? "impacted"
      : "normal";
const weatherBtn = document.getElementById("weather");
let weatherEnabled = true;
let weatherRequest = 0;
let weatherRetryAt = Number(localStorage.getItem(WEATHER_LIMIT_KEY)) || 0;

const localDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const shiftedDate = (iso, days) => {
  const [year, month, day] = iso.split("-").map(Number);
  return localDate(new Date(year, month - 1, day + days));
};
const europeanDate = (iso, short = false) => {
  const [year, month, day] = iso.split("-");
  return short ? `${day}.${month}` : `${day}.${month}.${year}`;
};

const today = new Date();
const forecastStart = localDate(today);
const forecastEnd = shiftedDate(forecastStart, 12);
const defaultWeatherDate = shiftedDate(forecastStart, today.getHours() >= 16 ? 1 : 0);
const weatherDate = () => dateInput.value || defaultWeatherDate;
const weatherDateLabel = () =>
  `${europeanDate(weatherDate())}${!dateInput.value && defaultWeatherDate !== forecastStart ? " (tomorrow)" : ""}`;

const openDatePicker = (input) => {
  if (input.showPicker) input.showPicker();
  else {
    input.focus();
    input.click();
  }
};
const weatherCode = (code) => {
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Variable";
};

const wetReason = (weather, spot, date = weatherDate()) => {
  if (!weather?.days?.has(date)) return "";
  const { rain, previous: previousMm, probability } = RAIN_SENSITIVITY[rainSensitivityOf(spot)];
  const day = weather.days.get(date);
  const previous = weather.days.get(shiftedDate(date, -1));
  if (day.precipitation >= rain) {
    return `${day.precipitation.toFixed(1)} mm precipitation forecast`;
  }
  if (probability !== null && day.probability >= probability) {
    return `${day.probability}% chance of precipitation`;
  }
  if (previousMm !== null && previous?.precipitation >= previousMm) {
    return `${previous.precipitation.toFixed(1)} mm precipitation the previous day`;
  }
  return "";
};

const forecastRows = (weather) => {
  const selectedDate = weatherDate();
  const dates = [-3, -2, -1, 0, 1, 2, 3].map((days) => shiftedDate(selectedDate, days));
  return dates
    .filter((date) => weather.days.has(date))
    .map((date) => {
      const day = weather.days.get(date);
      const selected = date === selectedDate ? ' class="selected"' : "";
      return `<tr${selected}><td>${europeanDate(date, true)}</td><td>${weatherCode(
        day.code,
      )}</td><td>${Math.round(day.min)}-${Math.round(day.max)} C</td><td>${day.precipitation.toFixed(
        1,
      )} mm</td><td>${day.probability}%</td></tr>`;
    })
    .join("");
};

function cardContent(place, spot) {
  const content = baseCard(place, spot);
  const tags = tagBadges(new Set(place.tags));
  // Forecasts are fetched per main pin, so a spot without one has none to show.
  // Saying "unavailable" would read as a failure rather than as by design.
  if (!weatherEnabled || !spot.entry) return content;
  if (!spot.weather) {
    const status = weatherBtn.classList.contains("loading")
      ? "Loading forecast..."
      : Date.now() < weatherRetryAt
        ? `Open-Meteo's request limit is reached, so this forecast was not fetched. Retrying ${retryLabel()}.`
        : "Forecast unavailable.";
    return `${content}<section class="weather-forecast"><h4>Weather</h4><p>${status}</p><hr>${tags}</section>`;
  }
  const selectedDate = weatherDate();
  if (!spot.weather.days.has(selectedDate)) {
    return `${content}<section class="weather-forecast"><h4>🌦️ Weather forecast</h4><p>Forecast unavailable for ${europeanDate(selectedDate)}. Open-Meteo covers ${europeanDate(forecastStart)} to ${europeanDate(forecastEnd)} here.</p><hr>${tags}</section>`;
  }
  const reason = wetReason(spot.weather, spot);
  return `${content}<section class="weather-forecast"><h4>🌦️ Weather forecast</h4>
    <p>${weatherDateLabel()}: ${
      reason
        ? `<span class="wet-note">Likely wet: ${reason}.</span>`
        : "No significant rain signal."
    }</p>
    <table class="weather-table"><thead><tr><th>Date</th><th>Sky</th><th>Temp.</th><th>Rain</th><th>Risk</th></tr></thead>
    <tbody>${forecastRows(spot.weather)}</tbody></table>
    <p><small>Forecast by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>.</small></p><hr>${tags}
  </section>`;
}

const refreshWeatherPresentation = () => {
  for (const entry of entries) {
    entry.layer.setIcon(
      pinIcon(entry.kind, weatherEnabled && Boolean(wetReason(entry.spot.weather, entry.spot))),
    );
  }
  if (activePlace) {
    // The forecast lands seconds after the card opens, so keep whatever the
    // reader had scrolled to instead of snapping back to the title.
    const scroll = placeCardBody.scrollTop;
    placeCardBody.innerHTML = cardContent(activePlace.place, activePlace.spot);
    placeCardBody.scrollTop = scroll;
  }
};

const parseWeather = (data) => {
  const days = new Map();
  for (let i = 0; i < data.daily.time.length; i++) {
    days.set(data.daily.time[i], {
      code: data.daily.weather_code[i],
      min: data.daily.temperature_2m_min[i],
      max: data.daily.temperature_2m_max[i],
      precipitation: data.daily.precipitation_sum[i] ?? 0,
      probability: data.daily.precipitation_probability_max[i] ?? 0,
    });
  }
  return { days };
};

const readWeatherCache = () => {
  try {
    return JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)) || {};
  } catch {
    return {};
  }
};

const weatherCache = readWeatherCache();

const loadCachedWeather = () => {
  const now = Date.now();
  let pruned = false;
  for (const entry of entries) {
    const cached = weatherCache[entry.spot.id];
    if (
      cached?.days &&
      Number.isFinite(cached.cachedAt) &&
      now - cached.cachedAt < WEATHER_CACHE_TTL
    ) {
      entry.spot.weather = { days: new Map(Object.entries(cached.days)) };
    } else if (cached) {
      delete weatherCache[entry.spot.id];
      pruned = true;
    }
  }
  // Expiring an entry in memory but leaving it on disk means the next reload
  // reads it back and expires it again, forever.
  if (pruned) saveWeatherCache();
};

const saveWeatherCache = () => {
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(weatherCache));
  } catch {
    // Weather still works when storage is unavailable or full.
  }
};

// Open-Meteo meters per minute, per hour and per day. A 429 says which bucket
// ran out only in its body, so the reason is what decides how long to wait when
// there is no Retry-After to go on.
class WeatherRateLimit extends Error {
  constructor(retryAt, reason) {
    super(reason || "Open-Meteo rate limit reached");
    this.retryAt = retryAt;
    this.reason = reason;
  }
}

const nextUtcMidnight = () => {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return midnight.getTime();
};

// Retry-After is only readable when the server allows it through CORS, which
// Open-Meteo does not currently do, so treat it as a bonus rather than the plan.
const retryAtFrom = (response, reason) => {
  const header = response.headers.get("Retry-After");
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return Date.now() + seconds * 1000;
  const date = Date.parse(header ?? "");
  if (Number.isFinite(date)) return date;
  if (/da(y|ily)/i.test(reason)) return nextUtcMidnight();
  if (/hour/i.test(reason)) return Date.now() + 60 * 60 * 1000;
  return Date.now() + 60 * 1000;
};

const blockWeather = (limit) => {
  weatherRetryAt = limit.retryAt;
  try {
    localStorage.setItem(WEATHER_LIMIT_KEY, String(weatherRetryAt));
  } catch {
    // Weather still works when storage is unavailable or full.
  }
};

const clearWeatherBlock = () => {
  weatherRetryAt = 0;
  localStorage.removeItem(WEATHER_LIMIT_KEY);
};

const retryLabel = () => {
  const minutes = Math.ceil((weatherRetryAt - Date.now()) / 60000);
  if (minutes <= 1) return "in a moment";
  if (minutes < 90) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `in ${hours} h` : "tomorrow";
};

const fetchWeatherBatch = async (batch, request) => {
  const params = new URLSearchParams({
    latitude: batch
      .map((entry) =>
        (entry.spot.weatherPlace
          ? entry.spot.weatherPlace.coords[0][0]
          : entry.layer.getLatLng().lat
        ).toFixed(5),
      )
      .join(","),
    longitude: batch
      .map((entry) =>
        (entry.spot.weatherPlace
          ? entry.spot.weatherPlace.coords[0][1]
          : entry.layer.getLatLng().lng
        ).toFixed(5),
      )
      .join(","),
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
    past_days: "3",
    forecast_days: "16",
    timezone: "auto",
  });
  const response = await fetch(`${WEATHER_API}?${params}`);
  if (response.status === 429) {
    const reason = await response
      .json()
      .then((body) => body?.reason ?? "")
      .catch(() => "");
    throw new WeatherRateLimit(retryAtFrom(response, reason), reason);
  }
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
  const result = await response.json();
  if (request !== weatherRequest || !weatherEnabled) return;
  const forecasts = Array.isArray(result) ? result : [result];
  for (let i = 0; i < batch.length; i++) {
    if (forecasts[i]?.daily) {
      const weather = parseWeather(forecasts[i]);
      batch[i].spot.weather = weather;
      weatherCache[batch[i].spot.id] = {
        cachedAt: Date.now(),
        days: Object.fromEntries(weather.days),
      };
    }
  }
  saveWeatherCache();
  refreshWeatherPresentation();
};

const setWeatherLabel = (label) => {
  weatherBtn.title = label;
  weatherBtn.setAttribute("aria-label", label);
};

const loadWeather = async () => {
  const request = ++weatherRequest;
  loadCachedWeather();
  refreshWeatherPresentation();
  const missingEntries = entries.filter((entry) => !entry.spot.weather);
  if (!missingEntries.length) {
    weatherBtn.classList.remove("loading");
    setWeatherLabel("Disable weather");
    return;
  }
  if (Date.now() < weatherRetryAt) {
    // Whatever is cached is already on screen. Asking again before the window
    // opens only burns the allowance that is about to be handed back.
    weatherBtn.classList.remove("loading");
    setWeatherLabel(`Disable weather (forecast limit reached, retrying ${retryLabel()})`);
    refreshWeatherPresentation();
    return;
  }
  clearWeatherBlock();
  weatherBtn.classList.add("loading");
  setWeatherLabel("Loading weather forecasts");

  const queue = [];
  for (let i = 0; i < missingEntries.length; i += WEATHER_BATCH_SIZE) {
    queue.push(missingEntries.slice(i, i + WEATHER_BATCH_SIZE));
  }
  let failed = 0;
  let limit = null;
  const worker = async () => {
    while (queue.length && !limit) {
      if (request !== weatherRequest || !weatherEnabled) return;
      try {
        await fetchWeatherBatch(queue.shift(), request);
      } catch (error) {
        // One 429 means the whole sweep is over: drain the queue so the other
        // workers stop too rather than each collecting a refusal of its own.
        if (error instanceof WeatherRateLimit) {
          limit = error;
          queue.length = 0;
        } else {
          failed++;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: WEATHER_CONCURRENCY }, worker));
  if (request !== weatherRequest || !weatherEnabled) return;
  weatherBtn.classList.remove("loading");
  if (limit) {
    blockWeather(limit);
    console.warn(`Open-Meteo rate limit: ${limit.reason || "no reason given"}`);
    setWeatherLabel(`Disable weather (forecast limit reached, retrying ${retryLabel()})`);
  } else if (failed) {
    setWeatherLabel(
      `Disable weather (${failed} forecast ${failed === 1 ? "request" : "requests"} failed)`,
    );
  } else {
    setWeatherLabel("Disable weather");
  }
  refreshWeatherPresentation();
};

weatherBtn.addEventListener("click", () => {
  weatherEnabled = !weatherEnabled;
  weatherBtn.setAttribute("aria-pressed", String(weatherEnabled));
  weatherBtn.classList.remove("loading");
  weatherBtn.title = weatherEnabled ? "Disable weather" : "Enable weather";
  weatherBtn.setAttribute("aria-label", weatherBtn.title);
  refreshWeatherPresentation();
  if (weatherEnabled && entries.some((entry) => !entry.spot.weather)) loadWeather();
  else if (!weatherEnabled) weatherRequest++;
});

loadWeather();

// ----------------------------------------------------------- geolocation ---
// Opt-in only: nothing touches the Geolocation API until this button is
// clicked, so no permission prompt on page load.
const locateBtn = document.getElementById("locate");
const me = L.layerGroup();
let watching = false;

const setLocateLabel = (label) => {
  locateBtn.title = label;
  locateBtn.setAttribute("aria-label", label);
};

const stopLocating = (label = "Show my location") => {
  watching = false;
  map.stopLocate();
  me.clearLayers().remove();
  locateBtn.setAttribute("aria-pressed", "false");
  setLocateLabel(label);
};

map.on("locationfound", (e) => {
  me.clearLayers().addTo(map);
  L.circle(e.latlng, {
    radius: e.accuracy,
    color: LOCATE_COLOR,
    weight: 1,
    fillOpacity: 0.12,
  }).addTo(me);
  L.circleMarker(e.latlng, {
    radius: 6,
    color: "#fff",
    weight: 2,
    fillColor: LOCATE_COLOR,
    fillOpacity: 1,
  }).addTo(me);
  setLocateLabel("Stop following me");
});

map.on("locationerror", (e) => {
  stopLocating(e.code === 1 ? "Location blocked" : "Location unavailable");
  setTimeout(() => {
    if (!watching) setLocateLabel("Show my location");
  }, 4000);
});

locateBtn.addEventListener("click", () => {
  if (watching) return stopLocating();
  if (!navigator.geolocation) {
    setLocateLabel("Location not supported");
    return;
  }
  watching = true;
  locateBtn.setAttribute("aria-pressed", "true");
  setLocateLabel("Locating...");
  map.locate({ setView: true, maxZoom: 14, watch: true, enableHighAccuracy: true });
});

// ------------------------------------------------------------- downloads ---
// Every file is built here from the KML the page already loaded, rather than
// fetched from the release, so it contains exactly the map the reader has left
// standing and works offline.
//
// Only the explicit hides are applied. The filters - search, date, price, the
// chips - are how you look around the map, not how you choose what to keep, and
// a download that silently followed the search box would surprise.
const visiblePlacemarkIndices = () => {
  const keep = new Set();
  for (const spot of spots.values()) {
    if (hiddenSpotIds.has(spot.id)) continue;
    for (const { place } of spot.places) {
      if (place.type === "line" && hiddenTraceIds.has(traceId(place))) continue;
      keep.add(place.index);
    }
  }
  return keep;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Pruning and serialising several MB of XML blocks the frame it runs in, so the
// button is put into its pending state and given a tick to repaint first.
// Otherwise the click looks ignored for as long as the work takes.
const runDownload = async (button, build) => {
  if (button.disabled) return;
  const label = button.querySelector(".dl-text");
  const original = label?.textContent;
  button.disabled = true;
  if (label) label.textContent = "Preparing...";
  try {
    await wait(0);
    const { blob, filename } = build();
    saveBlob(blob, filename);
  } catch (error) {
    console.error("Could not build the download", error);
    if (label) label.textContent = "Failed";
    await wait(1500);
  } finally {
    button.disabled = false;
    if (label) label.textContent = original;
    button.closest("details")?.removeAttribute("open");
  }
};

for (const button of document.querySelectorAll("[data-download-map]")) {
  button.addEventListener("click", () => {
    runDownload(button, () =>
      buildFile(button.dataset.downloadMap, {
        kmlText,
        keep: visiblePlacemarkIndices(),
        basename: "alpine-mtb-map",
      }),
    );
  });
}

// The card's own menu: one trace on its own, or a whole spot with its pins and
// its trails, minus any trail of that spot the reader has already hidden.
for (const button of document.querySelectorAll("[data-download-place]")) {
  button.addEventListener("click", () => {
    if (!activePlace) return;
    const { place, spot } = activePlace;
    const single = place.type === "line";
    const name = single ? place.name : (spot.entry?.name ?? spot.id);
    const keep = new Set(
      single
        ? [place.index]
        : spot.places
            .filter(({ place: p }) => p.type !== "line" || !hiddenTraceIds.has(traceId(p)))
            .map(({ place: p }) => p.index),
    );
    runDownload(button, () =>
      buildFile(button.dataset.downloadPlace, {
        kmlText,
        keep,
        name,
        basename: slug(name),
      }),
    );
  });
}

// --------------------------------------------------------------- filters ---
// Checkbox markup defines each filter's behavior. Filters inside an "any"
// group use OR logic; optional "only" filters are requirements and combine
// with AND logic.
//
//   only              - starts off; on hides spots NOT carrying the tag
//   any + data-group  - a spot shows while at least one tag in the group is on
//
// "any" lets multi-tag spots survive while any matching chip remains on. It
// drives both the difficulty group and the DH/enduro/freeride discipline group.
const chips = [...document.querySelectorAll(".filter[data-tag]")];
const categoryChips = [...document.querySelectorAll(".filter[data-category]")];
const lineColorChips = [...document.querySelectorAll(".filter[data-line-color]")];
const restoreHiddenButton = document.getElementById("restore-hidden");
const on = (chip) => chip.checked;
const modeOf = (chip) => chip.dataset.mode ?? "exclude";

const anyGroups = new Map(); // group name -> chips
for (const chip of chips) {
  if (modeOf(chip) !== "any") continue;
  const g = anyGroups.get(chip.dataset.group) ?? [];
  g.push(chip);
  anyGroups.set(chip.dataset.group, g);
}

// Numeric filter. Its max value means "any", so an unset slider never hides
// anything, and neither does a spot whose price we could not verify.
const priceInput = document.getElementById("price-day");
const priceOut = document.getElementById("price-day-out");
const priceCap = () => {
  const v = +priceInput.value;
  return v >= +priceInput.max ? Infinity : v;
};

// Seasons recur each year, so only the month and day are compared. closed_from
// is exclusive; matching dates mean the spot is normally open year-round.
const searchInput = document.getElementById("spot-search");
const clearSearchButton = document.getElementById("clear-search");
const searchModeButtons = [...document.querySelectorAll("[data-search-mode]")];
let searchMode = "spots";
const updateDateDisplay = () => {
  const [year, month, day] = dateInput.value.split("-");
  dateDisplay.textContent = year
    ? `${day}.${month}.${year}`
    : `Any · weather ${europeanDate(defaultWeatherDate, true)}`;
};
updateDateDisplay();
dateButton.addEventListener("click", () => {
  openDatePicker(dateInput);
});
const selectedDay = () => dateInput.value.slice(5);
const isOpen = (spot) => {
  const day = selectedDay();
  const { openFrom, closedFrom } = spot;
  if (!day) return true;
  if (!openFrom || !closedFrom) return false;
  if (openFrom === closedFrom) return true;
  if (openFrom < closedFrom) return day >= openFrom && day < closedFrom;
  return day >= openFrom || day < closedFrom;
};

const matchesFilters = (spot) => {
  const category = spot.tags.has("bike-park") ? "bike-park" : "natural";
  if (!categoryChips.some((chip) => on(chip) && chip.dataset.category === category)) return false;

  for (const chip of chips) {
    const has = spot.tags.has(chip.dataset.tag);
    const mode = modeOf(chip);
    if (mode === "exclude" && has && !on(chip)) return false;
    if (mode === "only" && on(chip) && !has) return false;
  }
  for (const group of anyGroups.values()) {
    if (!group.some((c) => on(c) && spot.tags.has(c.dataset.tag))) return false;
  }
  if (spot.priceDay !== null && spot.priceDay > priceCap()) return false;
  return isOpen(spot);
};

const applyFilters = () => {
  const cap = priceCap();
  const query = searchInput.value.trim().toLocaleLowerCase();
  const showingTraces = searchMode === "traces";
  const visibleTraceLayers = new Set();
  let visibleCount = 0;
  priceOut.textContent = cap === Infinity ? "any" : `${cap} CHF`;

  for (const entry of traceEntries) {
    const chip = lineColorChips.find((candidate) => candidate.dataset.lineColor === entry.color);
    const visible =
      showingTraces &&
      !hiddenSpotIds.has(entry.spot.id) &&
      !hiddenTraceIds.has(traceId(entry.place)) &&
      matchesFilters(entry.spot) &&
      (!chip || on(chip)) &&
      (!query || entry.searchText.includes(query));
    entry.row.hidden = !visible;
    if (visible) {
      visibleTraceLayers.add(entry.layer);
      visibleCount++;
    }
  }

  for (const spot of spots.values()) {
    const filterMatch = !hiddenSpotIds.has(spot.id) && matchesFilters(spot);
    const spotSearchMatch = !query || spot.searchText.includes(query);
    let hasVisibleLayer = false;

    for (const { layer, place } of spot.places) {
      const color = place.styleUrl?.replace(/^line-/, "") ?? "trail";
      const colorChip = lineColorChips.find((chip) => chip.dataset.lineColor === color);
      const lineEnabled = place.type !== "line" || !colorChip || on(colorChip);
      const visible = showingTraces
        ? visibleTraceLayers.has(layer)
        : filterMatch &&
          lineEnabled &&
          spotSearchMatch &&
          (place.type !== "line" || !hiddenTraceIds.has(traceId(place)));
      if (visible) {
        spot.group.addLayer(layer);
        hasVisibleLayer = true;
      } else {
        spot.group.removeLayer(layer);
      }
    }

    if (hasVisibleLayer) map.addLayer(spot.group);
    else map.removeLayer(spot.group);
    if (spot.entry) {
      const visible = !showingTraces && filterMatch && spotSearchMatch;
      spot.entry.row.hidden = !visible;
      if (visible) visibleCount++;
    }
  }
  const resultName = showingTraces ? "trace" : "spot";
  document.querySelector("#spot-count").textContent =
    `${visibleCount} ${resultName}${visibleCount === 1 ? "" : "s"}`;
  const showFilters = [...document.querySelectorAll("#show-filter-menu .filter")];
  const shown = showFilters.filter(on).length;
  document.getElementById("show-filter-summary").textContent =
    shown === showFilters.length ? "All" : shown ? `${shown}/${showFilters.length}` : "None";
  const required = [...document.querySelectorAll("#only-filter-menu .filter")].filter(on).length;
  document.getElementById("only-filter-summary").textContent =
    required === 0 ? "Any" : `${required} active`;
  const hiddenCount = hiddenTraceIds.size + hiddenSpotIds.size;
  restoreHiddenButton.hidden = hiddenCount === 0;
  restoreHiddenButton.textContent = `Restore hidden (${hiddenCount})`;
  const hiddenLabels = [
    ...new Set([
      ...[...hiddenSpotIds].map((id) => spots.get(id)?.entry?.name ?? id),
      ...lineLayers
        .filter(({ place }) => hiddenTraceIds.has(traceId(place)))
        .map(({ place }) => place.name),
    ]),
  ];
  if (hiddenLabels.length) restoreHiddenButton.title = hiddenLabels.join("\n");
  else restoreHiddenButton.removeAttribute("title");
  updateTraceArrows();
};

for (const chip of chips) {
  chip.addEventListener("change", applyFilters);
}
for (const chip of lineColorChips) {
  chip.addEventListener("change", applyFilters);
}
for (const chip of categoryChips) {
  chip.addEventListener("change", applyFilters);
}
for (const button of document.querySelectorAll("[data-filter-set]")) {
  button.addEventListener("click", () => {
    const checked = button.dataset.filterSet === "all";
    for (const input of document.querySelectorAll("#show-filter-menu .filter")) {
      input.checked = checked;
    }
    applyFilters();
  });
}
restoreHiddenButton.addEventListener("click", () => {
  hiddenTraceIds.clear();
  hiddenSpotIds.clear();
  saveHidden();
  applyFilters();
});
for (const menu of document.querySelectorAll(".filter-menu")) {
  menu.addEventListener("toggle", () => {
    if (!menu.open) return;
    for (const other of document.querySelectorAll(".filter-menu")) {
      if (other !== menu) other.removeAttribute("open");
    }
  });
}
document.addEventListener("click", (event) => {
  const open = ".filter-menu[open], .download-menu[open], .place-card-menu[open]";
  for (const menu of document.querySelectorAll(open)) {
    if (!menu.contains(event.target)) menu.removeAttribute("open");
  }
});
priceInput.addEventListener("input", applyFilters);
searchInput.addEventListener("input", () => {
  clearSearchButton.hidden = !searchInput.value;
  applyFilters();
});
clearSearchButton.addEventListener("click", () => {
  searchInput.value = "";
  clearSearchButton.hidden = true;
  applyFilters();
  searchInput.focus();
});
for (const button of searchModeButtons) {
  button.addEventListener("click", () => {
    searchMode = button.dataset.searchMode;
    for (const candidate of searchModeButtons) {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    }
    const traces = searchMode === "traces";
    searchInput.placeholder = traces ? "Search traces..." : "Search spots...";
    searchInput.setAttribute(
      "aria-label",
      `Search ${traces ? "traces" : "spots"} by title or description`,
    );
    applyFilters();
    searchInput.focus();
  });
}
dateInput.addEventListener("input", () => {
  updateDateDisplay();
  applyFilters();
  refreshWeatherPresentation();
});
applyFilters();

// ----------------------------------------------------------------- theme ---
// The initial value is set by the inline script in index.html; clicking here
// pins a choice, which then survives reloads and stops following the OS.
document.getElementById("theme").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
});

// --------------------------------------------------------------- sidebar ---
// Collapse the sidebar for a full-width map. The handle stays put, so there is
// always something to click to bring it back.
const app = document.getElementById("app");
const sidebar = document.getElementById("sidebar");
const toggle = document.getElementById("toggle-sidebar");

sidebar.addEventListener("transitionend", (ev) => {
  // Leaflet sizes itself from the container, which only settles once the
  // sidebar has finished sliding.
  if (ev.propertyName === "flex-basis") map.invalidateSize();
});

toggle.addEventListener("click", () => {
  const collapsed = app.classList.toggle("collapsed");
  const label = collapsed ? "Show the sidebar" : "Hide the sidebar";
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.setAttribute("aria-label", label);
  toggle.title = label;
});

// ----------------------------------------------------------------- about ---
const about = document.getElementById("about");
document.getElementById("info").addEventListener("click", () => about.showModal());
about.addEventListener("click", (ev) => {
  // Clicking the backdrop reports the <dialog> itself as the target.
  if (ev.target === about) about.close();
});
