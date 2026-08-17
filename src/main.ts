import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-leaflet";
import "./style.css";
import { KINDS, type Kind } from "./lib/kml-export.ts";
import { buildFile, saveBlob, slug, type DownloadFormat } from "./lib/downloads.ts";

// The KML is the single source of truth. Importing it as an asset lets the
// bundler fingerprint and precache it; the downloadable copies are published as
// GitHub release assets rather than served from here.
import kmlUrl from "../alpine-mtb-map.kml?url";

const kmlResponse = await fetch(kmlUrl);
if (!kmlResponse.ok) throw new Error(`Could not load ${kmlUrl}: ${kmlResponse.status}`);
const kmlText = await kmlResponse.text();

const KML_NS = "http://www.opengis.net/kml/2.2";

/** A placemark, as the page uses it: one pin or one trail line. */
interface Place {
  /**
   * Position in the source document, so a download can prune the KML itself
   * rather than being rebuilt from these objects and losing what they drop.
   */
  index: number;
  name: string;
  description: string;
  kind: Kind;
  styleUrl: string;
  spot: string;
  tags: string[];
  priceDay: string;
  priceSeason: string;
  openFrom: string;
  closedFrom: string;
  type: "point" | "line";
  coords: L.LatLngTuple[];
  elevation: number;
  lengthKm: number;
}

/** One day of an Open-Meteo forecast, as this page reads it. */
interface WeatherDay {
  code: number;
  min: number;
  max: number;
  precipitation: number;
  probability: number;
}

interface Weather {
  days: Map<string, WeatherDay>;
}

/** A spot: its main pin, its secondary pins and its trail lines, shown together. */
interface Spot {
  id: string;
  tags: Set<string>;
  searchText: string;
  priceDay: number | null;
  openFrom: string;
  closedFrom: string;
  weather: Weather | null;
  places: { layer: L.Marker | L.Polyline; place: Place }[];
  weatherPlace: Place | null;
  group: L.LayerGroup;
  entry?: SpotEntry;
}

/** A sidebar row. The <li> is attached once the sorted list is built. */
interface ResultRow {
  name: string;
  meta: string;
  row?: HTMLLIElement;
}

interface SpotEntry extends ResultRow {
  kind: Kind;
  layer: L.Marker;
  spot: Spot;
  place: Place;
}

interface TraceEntry extends ResultRow {
  searchText: string;
  layer: L.Polyline;
  spot: Spot;
  place: Place;
  color: string;
}

/** The element behind an id in index.html, or a loud failure if the markup moved. */
const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`index.html is missing #${id}`);
  return node as T;
};

// Trail line styleUrl -> stroke colour, mirrors the KML's own <Style> defs
// so the web map and Organic Maps (which reads the KML style directly) match.
const TRAIL_COLORS: Record<string, string> = {
  "line-green": "#2b8a3e",
  "line-blue": "#1864ab",
  "line-red": "#c92a2a",
  "line-black": "#000000",
  // Harder than black: the "extreme" / pro-line grade some parks sign in orange.
  // Amber rather than a true orange, which at line width reads as another red.
  "line-orange": "#f59f00",
  "line-trail": "#c92a2a",
};
const TRAIL_COLOR = TRAIL_COLORS["line-trail"];
// Distinct from the blue spot pins, so 'you are here' never reads as a spot.
const LOCATE_COLOR = "#7048e8";

/** Parse the KML into a flat list of {name, description, band, type, coords}. */
function parseKml(text: string): Place[] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("alpine-mtb-map.kml is not valid XML");

  const text_ = (node: Element, tag: string) =>
    node.getElementsByTagNameNS(KML_NS, tag)[0]?.textContent?.trim() ?? "";
  const parseCoords = (s: string): L.LatLngTuple[] =>
    s
      .trim()
      .split(/\s+/)
      .map((t) => t.split(",").map(Number))
      .filter((c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
      .map(([lon, lat]): L.LatLngTuple => [lat, lon]); // Leaflet wants lat,lon

  // <Data name="..."><value>...</value></Data> facets, ignored by Organic Maps.
  const facet = (pm: Element, key: string) => {
    for (const d of pm.getElementsByTagNameNS(KML_NS, "Data")) {
      if (d.getAttribute("name") === key) return text_(d, "value");
    }
    return "";
  };

  // Ground distance along a trace, in kilometres. Leaflet measures on a sphere
  // without needing a map, which is close enough for a filter.
  const lengthOf = (coords: L.LatLngTuple[]) => {
    let metres = 0;
    for (let i = 1; i < coords.length; i++) metres += L.latLng(coords[i - 1]).distanceTo(coords[i]);
    return metres / 1000;
  };

  return [...doc.getElementsByTagNameNS(KML_NS, "Placemark")].map((pm, index) => {
    const styleUrl = text_(pm, "styleUrl").replace(/^#/, "");
    const point = pm.getElementsByTagNameNS(KML_NS, "Point")[0];
    const line = pm.getElementsByTagNameNS(KML_NS, "LineString")[0];
    const geom = point || line;
    const coords = geom ? parseCoords(text_(geom, "coordinates")) : [];
    return {
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
      coords,
      elevation:
        geom && point ? Number.parseFloat(text_(geom, "coordinates").split(",")[2]) || 0 : 0,
      lengthKm: point ? 0 : lengthOf(coords),
    } satisfies Place;
  });
}

// Prices are stored in the currency the operator charges ("33 EUR"). The price
// filter needs one scale, so they are converted at rough, deliberately static
// rates: this sorts spots into the right bracket, it is not a quote. A
// currency missing from the table reads as "no price", so the slider ignores
// the spot rather than bracketing it wrongly.
const CHF_PER: Record<string, number> = {
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
function chf(price: string) {
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
const traceId = (place: Place) => `${place.spot}\n${place.name}`;
const readHidden = (key: string): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]);
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
const DEFAULT_VIEW: L.LatLngTuple = [46.2, 8.0];
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
  : requestedSpot
    ? places.find((p) => p.type === "point" && p.kind !== "minor" && p.spot === requestedSpot)
    : undefined;
const initialView: [L.LatLngExpression, number] = requestedInitialPlace
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

// The plugin forwards Leaflet's own layer options to the layer it builds, but
// its types only declare MapLibre's map options.
const openFreeMapOptions = {
  style: "https://tiles.openfreemap.org/styles/liberty",
  attribution: openFreeMapAttribution,
} as Parameters<typeof L.maplibreGL>[0];

const layers: Record<string, L.Layer> = {
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
  "OpenFreeMap Liberty": L.maplibreGL(openFreeMapOptions),
  "CARTO Voyager": L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      subdomains: "abcd",
      maxZoom: 20,
      attribution: cartoAttribution,
    },
  ),
};
const savedMapLayer = localStorage.getItem(MAP_LAYER_STORAGE_KEY) ?? "";
const initialMapLayer = Object.hasOwn(layers, savedMapLayer) ? savedMapLayer : DEFAULT_MAP_LAYER;
layers[initialMapLayer].addTo(map);
L.control.layers(layers).addTo(map);
L.control.scale({ imperial: false, maxWidth: 140 }).addTo(map);
map.on("baselayerchange", ({ name }) => localStorage.setItem(MAP_LAYER_STORAGE_KEY, name));

const pinIcon = (kind: Kind, wet = false) =>
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

// The selected spot trades its dot for a teardrop in the same colour, tip on
// the exact coordinate the dot marked. Drawn rather than an emoji so it keeps
// the per-category colour and looks the same on every platform.
const SELECTED_PIN_SIZE = 26;
// Marker z-index is derived from latitude, so an offset this large clears every
// other pin, including a northern one that would otherwise stack on top.
const SELECTED_PIN_Z = 100000;
// Leaflet stacks markers by latitude, so a secondary grey pin can end up over
// its own spot's main pin. Push the grey ones far enough down that they always
// sit behind every main pin, at any zoom.
const MINOR_PIN_Z = -100000;

const selectedPinIcon = (kind: Kind) =>
  L.divIcon({
    className: "",
    html:
      `<div class="pin-selected ${kind}"><svg viewBox="0 0 24 24" width="${SELECTED_PIN_SIZE}" height="${SELECTED_PIN_SIZE}" aria-hidden="true">` +
      '<path d="M12 24C12 24 4 14.5 4 9a8 8 0 1 1 16 0c0 5.5-8 15-8 15Z" fill="currentColor" stroke="#fff" stroke-width="2" stroke-linejoin="round" paint-order="stroke"/>' +
      '<circle cx="12" cy="9" r="3" fill="#fff"/></svg></div>',
    iconSize: [SELECTED_PIN_SIZE, SELECTED_PIN_SIZE],
    // The tip, so the pin points at the coordinate instead of covering it.
    iconAnchor: [SELECTED_PIN_SIZE / 2, SELECTED_PIN_SIZE],
  });

// Display labels for compound tags: keep the rest as-is.
const TAG_DISPLAY: Record<string, string> = {
  dh: "DH",
};

const displayTag = (tag: string) => TAG_DISPLAY[tag] ?? tag;

const tagBadges = (tags: Set<string>) => {
  if (!tags.size) return "";
  const badges = [...tags]
    .sort()
    .map((tag) => {
      const label = displayTag(tag);
      return `<span class="tag-badge tag-${label.toLowerCase()}">${label}</span>`;
    })
    .join("");
  return `<div class="tag-badges">${badges}</div>`;
};

const traceCountSummary = (spot: Spot) => {
  const counts = new Map<string, number>();
  for (const { place } of spot.places) {
    if (place.type !== "line") continue;
    const color = place.styleUrl === "line-trail" ? "red" : place.styleUrl.replace(/^line-/, "");
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return ["green", "blue", "red", "black", "orange"]
    .filter((color) => counts.has(color))
    .map(
      (color) =>
        `<span class="trace-count trace-count-${color}">${counts.get(color)} ${color}</span>`,
    )
    .join('<span class="trace-count-separator"> · </span>');
};

// The share, hide and close buttons live in the card's own markup rather than
// here: they must stay put while the description under them scrolls.
const baseCard = (p: Place, spot: Spot) => {
  const traceCounts = p.type === "point" ? traceCountSummary(spot) : "";
  return `<h3>${p.name}</h3>${traceCounts ? `<div class="trace-counts">${traceCounts}</div>` : ""}${p.description || ""}`;
};

// A spot owns its main pin, its secondary pins and its trail lines: they are
// shown and hidden together, so the filters operate on whole spots.
const spots = new Map<string, Spot>();
const entries: SpotEntry[] = []; // sidebar rows, one per main pin
// Lets the Lines filter toggle trails independently of their spot.
const lineLayers: { layer: L.Polyline; spot: Spot; place: Place; color: string }[] = [];
// Canvas click tolerance grows the invisible hit area without changing the
// visible stroke. Touch pointers get extra room for less precise input.
const trailRenderer = L.canvas({
  tolerance: window.matchMedia("(pointer: coarse)").matches ? 14 : 8,
});

for (const p of places) {
  const lineColor = p.styleUrl.replace(/^line-/, "") || "trail";
  const layer: L.Marker | L.Polyline =
    p.type === "point"
      ? L.marker(p.coords[0], {
          icon: pinIcon(p.kind),
          title: p.name,
          zIndexOffset: p.kind === "minor" ? MINOR_PIN_Z : 0,
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
  if (p.type === "line") {
    lineLayers.push({ layer: layer as L.Polyline, spot, place: p, color: lineColor });
  }
  spot.searchText += ` ${p.name} ${p.description}`.toLocaleLowerCase();
  const clicked = spot;
  layer.on("click", (event: L.LeafletMouseEvent) => {
    // Otherwise the same click reaches the map and closes the card again.
    L.DomEvent.stopPropagation(event as unknown as Event);
    openPlaceCard(p, clicked, layer);
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
  const m = /^(.*?)\s*\[(.+)\]$/.exec(p.name);
  if (p.type === "point" && m && p.kind !== "minor") {
    const entry: SpotEntry = {
      name: m[1],
      meta: m[2],
      kind: p.kind,
      layer: layer as L.Marker,
      spot,
      place: p,
    };
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
const list = el<HTMLUListElement>("spots");
const placeCard = el("place-card");
const placeCardBody = el("place-card-body");
const placeCardHideButton = el<HTMLButtonElement>("place-card-hide");
const placeCardGoogleMapsButton = el<HTMLButtonElement>("place-card-google-maps");
const placeCardDownloadMenu = el<HTMLDetailsElement>("place-card-download");
let activePlace: { place: Place; spot: Spot; layer: L.Marker | L.Polyline } | null = null;

const placeUrl = (place: Place, spot: Spot) => {
  const url = new URL(window.location.href);
  url.searchParams.delete("spot");
  url.searchParams.delete("trace");
  if (place.type === "line") url.searchParams.set("trace", place.name);
  else url.searchParams.set("spot", spot.id);
  return url;
};

const setSelectedPlaceUrl = (place: Place, spot: Spot) => {
  const url = placeUrl(place, spot);
  history.replaceState(place.type === "line" ? { trace: place.name } : { spot: spot.id }, "", url);
};

const clearSelectedPlaceUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("spot");
  url.searchParams.delete("trace");
  history.replaceState(null, "", url);
};

const copyText = async (text: string) => {
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

el("place-card-share").addEventListener("click", async (event) => {
  if (!activePlace) return;
  const button = event.currentTarget as HTMLButtonElement;
  const { place, spot } = activePlace;
  const url = placeUrl(place, spot).toString();
  if (navigator.share) {
    try {
      await navigator.share({ title: place.name, url });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
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

placeCardGoogleMapsButton.addEventListener("click", () => {
  if (!activePlace || activePlace.place.type !== "point") return;
  const [lat, lon] = activePlace.place.coords[0];
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", `${lat},${lon}`);
  window.open(url, "_blank", "noopener,noreferrer");
});

// Dim a clicked trail, or every trail linked to a clicked spot, with the same style.
const SELECTED_LINE_OPACITY = 0.45;
const IDLE_LINE_OPACITY = 0.85;

let selectedLines: L.Polyline[] = [];
const selectLines = (lines: L.Polyline[]) => {
  for (const layer of selectedLines) layer.setStyle({ opacity: IDLE_LINE_OPACITY });
  for (const layer of lines) layer.setStyle({ opacity: SELECTED_LINE_OPACITY });
  selectedLines = lines;
};
const clearSelectedLines = () => {
  for (const layer of selectedLines) layer.setStyle({ opacity: IDLE_LINE_OPACITY });
  selectedLines = [];
};

// Whether a spot's forecast currently earns the rain badge on its pin.
const isWet = (spot: Spot) => weatherEnabled && Boolean(wetReason(spot.weather, spot));

// One spot at a time wears the teardrop. Its place and spot are kept so the dot
// can be restored with the rain badge the forecast last gave it.
interface SelectedPin {
  layer: L.Marker;
  place: Place;
  spot: Spot;
}
let selectedPin: SelectedPin | null = null;

const selectPin = (next: SelectedPin | null) => {
  if (selectedPin) {
    selectedPin.layer.setIcon(pinIcon(selectedPin.place.kind, isWet(selectedPin.spot)));
    selectedPin.layer.setZIndexOffset(selectedPin.place.kind === "minor" ? MINOR_PIN_Z : 0);
  }
  selectedPin = next;
  if (next) {
    next.layer.setIcon(selectedPinIcon(next.place.kind));
    next.layer.setZIndexOffset(SELECTED_PIN_Z);
  }
};

function openPlaceCard(place: Place, spot: Spot, layer: L.Marker | L.Polyline) {
  activePlace = { place, spot, layer };
  placeCardBody.innerHTML = cardContent(place, spot);
  placeCardBody.scrollTop = 0;
  const hideLabel = `Hide this ${place.type === "line" ? "trace" : "spot"}`;
  placeCardGoogleMapsButton.hidden = place.type !== "point";
  placeCardHideButton.hidden = false;
  placeCardHideButton.title = hideLabel;
  placeCardHideButton.setAttribute("aria-label", hideLabel);
  placeCardDownloadMenu.removeAttribute("open");
  placeCard.hidden = false;
  setSelectedPlaceUrl(place, spot);
  if (place.type === "line") {
    selectLines([layer as L.Polyline]);
    selectPin(null);
  } else {
    selectLines(
      spot.places
        .filter(({ place }) => place.type === "line")
        .map(({ layer }) => layer as L.Polyline),
    );
    selectPin({ layer: layer as L.Marker, place, spot });
  }
}

function closePlaceCard() {
  if (!activePlace) return;
  activePlace = null;
  placeCard.hidden = true;
  placeCardDownloadMenu.removeAttribute("open");
  placeCardBody.innerHTML = "";
  clearSelectedPlaceUrl();
  clearSelectedLines();
  selectPin(null);
}

el("place-card-close").addEventListener("click", closePlaceCard);
map.on("click", closePlaceCard);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePlaceCard();
});

const showEntry = (entry: SpotEntry, animate = true) => {
  const latlng = entry.layer.getLatLng();
  // flyTo treats duration 0 as "unset" and falls back to its own easing, so an
  // unanimated jump has to go through setView.
  if (animate) map.flyTo(latlng, 12, { duration: 0.6 });
  else map.setView(latlng, 12, { animate: false });
  openPlaceCard(entry.place, entry.spot, entry.layer);
};

const showTrace = (entry: TraceEntry, animate = true) => {
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

const arrowIcon = (color: string, angle: number) =>
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
const headingAt = (pixels: L.Point[], from: L.Point, at: number) => {
  let ahead: L.Point | null = null;
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
    const pts = layer.getLatLngs() as L.LatLng[];
    if (pts.length < 2) continue;
    const color = TRAIL_COLORS[place.styleUrl] ?? TRAIL_COLOR;
    const pixels = pts.map((p) => map.latLngToLayerPoint(p));

    const arrow = (latlng: L.LatLng, angle: number) =>
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
const traceMeta = (spot: Spot, place: Place) =>
  spot.entry?.name ?? (place.name.includes(":") ? place.name.split(":")[0].trim() : spot.id);

const traceEntries: TraceEntry[] = lineLayers.map(({ layer, spot, place, color }) => ({
  name: place.name,
  meta: traceMeta(spot, place),
  searchText: `${place.name} ${place.description}`.toLocaleLowerCase(),
  layer,
  spot,
  place,
  color,
}));

const addResultRow = <T extends ResultRow>(entry: T, show: (entry: T) => void) => {
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
const byName = (a: ResultRow, b: ResultRow) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }) ||
  a.meta.localeCompare(b.meta, undefined, { sensitivity: "base" });

for (const entry of [...entries].sort(byName)) addResultRow(entry, showEntry);
for (const entry of [...traceEntries].sort(byName)) addResultRow(entry, showTrace);

const requestedEntry = requestedSpot ? spots.get(requestedSpot)?.entry : undefined;
if (requestedTrace) {
  const requestedPlace = requestedInitialPlace
    ? traceEntries.find((entry) => entry.place === requestedInitialPlace)
    : null;
  if (requestedPlace) requestAnimationFrame(() => showTrace(requestedPlace, false));
} else if (requestedEntry) requestAnimationFrame(() => showEntry(requestedEntry, false));

const dateInput = el<HTMLInputElement>("open-date");
const dateDisplay = el("open-date-display");
const dateButton = el<HTMLButtonElement>("open-date-button");

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

/** The slice of an Open-Meteo response this page reads. */
interface DailyForecast {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: (number | null)[];
  precipitation_probability_max: (number | null)[];
}

// A spot's "rain-sensitive"/"rain-resilient" tag scales how easily it reads as
// wet: impacted spots keep the sensitive defaults above, untagged ("normal")
// spots need a bit more rain to flag, and resilient ones only flag on a
// genuinely wet day itself (no probability or previous-day carry-over).
const RAIN_SENSITIVITY: Record<
  string,
  { rain: number; previous: number | null; probability: number | null }
> = {
  impacted: {
    rain: WEATHER_RAIN_MM,
    previous: WEATHER_PREVIOUS_DAY_MM,
    probability: WEATHER_RAIN_PROBABILITY,
  },
  normal: { rain: 3, previous: 10, probability: 65 },
  resilient: { rain: 15, previous: null, probability: null },
};
const rainSensitivityOf = (spot: Spot) =>
  spot.tags.has("rain-resilient")
    ? "resilient"
    : spot.tags.has("rain-sensitive")
      ? "impacted"
      : "normal";
const weatherBtn = el<HTMLButtonElement>("weather");
let weatherEnabled = true;
let weatherRequest = 0;
let weatherRetryAt = Number(localStorage.getItem(WEATHER_LIMIT_KEY)) || 0;

const localDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const shiftedDate = (iso: string, days: number) => {
  const [year, month, day] = iso.split("-").map(Number);
  return localDate(new Date(year, month - 1, day + days));
};
const europeanDate = (iso: string, short = false) => {
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

const openDatePicker = (input: HTMLInputElement) => {
  if (input.showPicker) input.showPicker();
  else {
    input.focus();
    input.click();
  }
};
const weatherCode = (code: number) => {
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

const wetReason = (weather: Weather | null, spot: Spot, date = weatherDate()) => {
  const day = weather?.days.get(date);
  if (!day) return "";
  const { rain, previous: previousMm, probability } = RAIN_SENSITIVITY[rainSensitivityOf(spot)];
  const previous = weather?.days.get(shiftedDate(date, -1));
  if (day.precipitation >= rain) {
    return `${day.precipitation.toFixed(1)} mm precipitation forecast`;
  }
  if (probability !== null && day.probability >= probability) {
    return `${day.probability}% chance of precipitation`;
  }
  if (previousMm !== null && previous && previous.precipitation >= previousMm) {
    return `${previous.precipitation.toFixed(1)} mm precipitation the previous day`;
  }
  return "";
};

const forecastRows = (weather: Weather) => {
  const selectedDate = weatherDate();
  const dates = [-3, -2, -1, 0, 1, 2, 3].map((days) => shiftedDate(selectedDate, days));
  return dates
    .map((date) => ({ date, day: weather.days.get(date) }))
    .filter((row): row is { date: string; day: WeatherDay } => Boolean(row.day))
    .map(({ date, day }) => {
      const selected = date === selectedDate ? ' class="selected"' : "";
      return `<tr${selected}><td>${europeanDate(date, true)}</td><td>${weatherCode(
        day.code,
      )}</td><td>${Math.round(day.min)}-${Math.round(day.max)} C</td><td>${day.precipitation.toFixed(
        1,
      )} mm</td><td>${day.probability}%</td></tr>`;
    })
    .join("");
};

function cardContent(place: Place, spot: Spot) {
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
    // The selected pin keeps its teardrop: a forecast landing mid-selection
    // must not put the dot back.
    if (selectedPin?.layer === entry.layer) continue;
    entry.layer.setIcon(pinIcon(entry.kind, isWet(entry.spot)));
  }
  if (activePlace) {
    // The forecast lands seconds after the card opens, so keep whatever the
    // reader had scrolled to instead of snapping back to the title.
    const scroll = placeCardBody.scrollTop;
    placeCardBody.innerHTML = cardContent(activePlace.place, activePlace.spot);
    placeCardBody.scrollTop = scroll;
  }
};

const parseWeather = (data: { daily: DailyForecast }): Weather => {
  const days = new Map<string, WeatherDay>();
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

interface CachedWeather {
  cachedAt: number;
  days: Record<string, WeatherDay>;
}

const readWeatherCache = (): Record<string, CachedWeather> => {
  try {
    return (
      (JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) ?? "null") as Record<
        string,
        CachedWeather
      > | null) ?? {}
    );
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
  retryAt: number;
  reason: string;

  constructor(retryAt: number, reason: string) {
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
const retryAtFrom = (response: Response, reason: string) => {
  const header = response.headers.get("Retry-After");
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return Date.now() + seconds * 1000;
  const date = Date.parse(header ?? "");
  if (Number.isFinite(date)) return date;
  if (/da(y|ily)/i.test(reason)) return nextUtcMidnight();
  if (/hour/i.test(reason)) return Date.now() + 60 * 60 * 1000;
  return Date.now() + 60 * 1000;
};

const blockWeather = (limit: WeatherRateLimit) => {
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

const fetchWeatherBatch = async (batch: SpotEntry[], request: number) => {
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
      .then((body: { reason?: string }) => body?.reason ?? "")
      .catch(() => "");
    throw new WeatherRateLimit(retryAtFrom(response, reason), reason);
  }
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
  const result = (await response.json()) as { daily?: DailyForecast } | { daily?: DailyForecast }[];
  if (request !== weatherRequest || !weatherEnabled) return;
  const forecasts = Array.isArray(result) ? result : [result];
  for (let i = 0; i < batch.length; i++) {
    const forecast = forecasts[i];
    if (forecast?.daily) {
      const weather = parseWeather({ daily: forecast.daily });
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

const setWeatherLabel = (label: string) => {
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

  const queue: SpotEntry[][] = [];
  for (let i = 0; i < missingEntries.length; i += WEATHER_BATCH_SIZE) {
    queue.push(missingEntries.slice(i, i + WEATHER_BATCH_SIZE));
  }
  let failed = 0;
  let limit: WeatherRateLimit | null = null;
  const worker = async () => {
    while (queue.length && !limit) {
      if (request !== weatherRequest || !weatherEnabled) return;
      const batch = queue.shift();
      if (!batch) return;
      try {
        await fetchWeatherBatch(batch, request);
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
  // Assigned inside the workers above, which the narrowing from `= null` misses.
  const rateLimit = limit as WeatherRateLimit | null;
  if (rateLimit) {
    blockWeather(rateLimit);
    console.warn(`Open-Meteo rate limit: ${rateLimit.reason || "no reason given"}`);
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
  if (weatherEnabled && entries.some((entry) => !entry.spot.weather)) void loadWeather();
  else if (!weatherEnabled) weatherRequest++;
});

void loadWeather();

// ----------------------------------------------------------- geolocation ---
// Opt-in only: nothing touches the Geolocation API until this button is
// clicked, so no permission prompt on page load.
const locateBtn = el<HTMLButtonElement>("locate");
const me = L.layerGroup();
let watching = false;

const setLocateLabel = (label: string) => {
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
  const keep = new Set<number>();
  for (const spot of spots.values()) {
    if (hiddenSpotIds.has(spot.id)) continue;
    for (const { place } of spot.places) {
      if (place.type === "line" && hiddenTraceIds.has(traceId(place))) continue;
      keep.add(place.index);
    }
  }
  return keep;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Pruning and serialising several MB of XML blocks the frame it runs in, so the
// button is put into its pending state and given a tick to repaint first.
// Otherwise the click looks ignored for as long as the work takes.
const runDownload = async (
  button: HTMLButtonElement,
  build: () => { blob: Blob; filename: string },
) => {
  if (button.disabled) return;
  const label = button.querySelector(".dl-text");
  const original = label?.textContent ?? "";
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

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-download-map]")) {
  button.addEventListener("click", () => {
    void runDownload(button, () =>
      buildFile(button.dataset.downloadMap as DownloadFormat, {
        kmlText,
        keep: visiblePlacemarkIndices(),
        basename: "alpine-mtb-map",
      }),
    );
  });
}

// The card's own menu: one trace on its own, or a whole spot with its pins and
// its trails, minus any trail of that spot the reader has already hidden.
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-download-place]")) {
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
    void runDownload(button, () =>
      buildFile(button.dataset.downloadPlace as DownloadFormat, {
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
const chips = [...document.querySelectorAll<HTMLInputElement>(".filter[data-tag]")];
const categoryChips = [...document.querySelectorAll<HTMLInputElement>(".filter[data-category]")];
const lineColorChips = [...document.querySelectorAll<HTMLInputElement>(".filter[data-line-color]")];
const restoreHiddenButton = el<HTMLButtonElement>("restore-hidden");
const on = (chip: HTMLInputElement) => chip.checked;
const modeOf = (chip: HTMLInputElement) => chip.dataset.mode ?? "exclude";

const anyGroups = new Map<string, HTMLInputElement[]>();
for (const chip of chips) {
  if (modeOf(chip) !== "any") continue;
  const name = chip.dataset.group ?? "";
  const g = anyGroups.get(name) ?? [];
  g.push(chip);
  anyGroups.set(name, g);
}

// Numeric filter. Its max value means "any", so an unset slider never hides
// anything, and neither does a spot whose price we could not verify.
const priceInput = el<HTMLInputElement>("price-day");
const priceOut = el("price-day-out");
const priceCap = () => {
  const v = +priceInput.value;
  return v >= +priceInput.max ? Infinity : v;
};

// Trace length, in kilometres. The two thumbs walk a hand-picked ladder rather
// than an even scale: half the traces are under 1.2 km and nine in ten under
// 4 km, so even spacing would crowd almost everything into the first eighth of
// the track. The top stop means "any", so an untouched maximum hides nothing.
const LENGTH_STOPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 15, 20, 30, 50, Infinity];
const LENGTH_MAX_STOP = LENGTH_STOPS.length - 1;
const lengthMinInput = el<HTMLInputElement>("trace-length-min");
const lengthMaxInput = el<HTMLInputElement>("trace-length-max");
const lengthTrack = el("trace-length-range");
const lengthOut = el("trace-length-out");
// The minimum stops one rung short of "any": a minimum of infinity would hide
// every trace, which reads as a broken filter rather than a choice.
const lengthMinIndex = () => Math.min(+lengthMinInput.value, LENGTH_MAX_STOP - 1);
const lengthRange = () =>
  [LENGTH_STOPS[lengthMinIndex()], LENGTH_STOPS[+lengthMaxInput.value]] as const;
const km = (value: number) => (Number.isInteger(value) ? `${value}` : value.toFixed(1));
const updateLengthDisplay = () => {
  const minIndex = lengthMinIndex();
  const maxIndex = +lengthMaxInput.value;
  const [min, max] = lengthRange();
  lengthOut.textContent =
    minIndex === 0 && max === Infinity
      ? "any"
      : max === Infinity
        ? `from ${km(min)} km`
        : minIndex === 0
          ? `up to ${km(max)} km`
          : `${km(min)}-${km(max)} km`;
  // Fractions, not percentages: the stylesheet mixes them with the thumb width
  // to land the filled span on the thumb centres.
  lengthTrack.style.setProperty("--from", String(minIndex / LENGTH_MAX_STOP));
  lengthTrack.style.setProperty("--to", String(maxIndex / LENGTH_MAX_STOP));
  // Once both thumbs sit at the right-hand end the maximum would cover the
  // minimum, so hand the top layer to whichever one would otherwise be stuck.
  lengthTrack.classList.toggle("min-on-top", minIndex > LENGTH_MAX_STOP / 2);
};

const withinLength = (place: Place) => {
  if (place.type !== "line") return true;
  const [min, max] = lengthRange();
  return place.lengthKm >= min && place.lengthKm <= max;
};

// Seasons recur each year, so only the month and day are compared. closed_from
// is exclusive; matching dates mean the spot is normally open year-round.
const searchInput = el<HTMLInputElement>("spot-search");
const clearSearchButton = el<HTMLButtonElement>("clear-search");
const searchModeButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-search-mode]")];
let searchMode: "spots" | "traces" = "spots";
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
const isOpen = (spot: Spot) => {
  const day = selectedDay();
  const { openFrom, closedFrom } = spot;
  if (!day) return true;
  if (!openFrom || !closedFrom) return false;
  if (openFrom === closedFrom) return true;
  if (openFrom < closedFrom) return day >= openFrom && day < closedFrom;
  return day >= openFrom || day < closedFrom;
};

const matchesFilters = (spot: Spot) => {
  const category = spot.tags.has("bike-park") ? "bike-park" : "natural";
  if (!categoryChips.some((chip) => on(chip) && chip.dataset.category === category)) return false;

  for (const chip of chips) {
    const has = spot.tags.has(chip.dataset.tag ?? "");
    const mode = modeOf(chip);
    if (mode === "exclude" && has && !on(chip)) return false;
    if (mode === "only" && on(chip) && !has) return false;
  }
  for (const group of anyGroups.values()) {
    if (!group.some((c) => on(c) && spot.tags.has(c.dataset.tag ?? ""))) return false;
  }
  if (spot.priceDay !== null && spot.priceDay > priceCap()) return false;
  return isOpen(spot);
};

const applyFilters = () => {
  const cap = priceCap();
  const query = searchInput.value.trim().toLocaleLowerCase();
  const showingTraces = searchMode === "traces";
  const visibleTraceLayers = new Set<L.Layer>();
  let visibleCount = 0;
  priceOut.textContent = cap === Infinity ? "any" : `${cap} CHF`;
  updateLengthDisplay();

  for (const entry of traceEntries) {
    const chip = lineColorChips.find((candidate) => candidate.dataset.lineColor === entry.color);
    const visible =
      showingTraces &&
      !hiddenSpotIds.has(entry.spot.id) &&
      !hiddenTraceIds.has(traceId(entry.place)) &&
      matchesFilters(entry.spot) &&
      withinLength(entry.place) &&
      (!chip || on(chip)) &&
      (!query || entry.searchText.includes(query));
    if (entry.row) entry.row.hidden = !visible;
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
      const color = place.styleUrl.replace(/^line-/, "") || "trail";
      const colorChip = lineColorChips.find((chip) => chip.dataset.lineColor === color);
      const lineEnabled =
        place.type !== "line" || ((!colorChip || on(colorChip)) && withinLength(place));
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
      if (spot.entry.row) spot.entry.row.hidden = !visible;
      if (visible) visibleCount++;
    }
  }
  const resultName = showingTraces ? "trace" : "spot";
  el("spot-count").textContent = `${visibleCount} ${resultName}${visibleCount === 1 ? "" : "s"}`;
  const showFilters = [...document.querySelectorAll<HTMLInputElement>("#show-filter-menu .filter")];
  const shown = showFilters.filter(on).length;
  el("show-filter-summary").textContent =
    shown === showFilters.length ? "All" : shown ? `${shown}/${showFilters.length}` : "None";
  const required = [
    ...document.querySelectorAll<HTMLInputElement>("#only-filter-menu .filter"),
  ].filter(on).length;
  el("only-filter-summary").textContent = required === 0 ? "Any" : `${required} active`;
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
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-filter-set]")) {
  button.addEventListener("click", () => {
    const checked = button.dataset.filterSet === "all";
    for (const input of document.querySelectorAll<HTMLInputElement>("#show-filter-menu .filter")) {
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
for (const menu of document.querySelectorAll<HTMLDetailsElement>(".filter-menu")) {
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
    if (!menu.contains(event.target as Node)) menu.removeAttribute("open");
  }
});
priceInput.addEventListener("input", applyFilters);
// The thumbs push rather than cross, so the range is never inverted.
lengthMinInput.addEventListener("input", () => {
  lengthMinInput.value = String(lengthMinIndex());
  if (+lengthMinInput.value > +lengthMaxInput.value) lengthMaxInput.value = lengthMinInput.value;
  applyFilters();
});
lengthMaxInput.addEventListener("input", () => {
  if (+lengthMaxInput.value < +lengthMinInput.value) lengthMinInput.value = lengthMaxInput.value;
  applyFilters();
});
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
    searchMode = button.dataset.searchMode === "traces" ? "traces" : "spots";
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
el("theme").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
});

// --------------------------------------------------------------- sidebar ---
// Collapse the sidebar for a full-width map. The handle stays put, so there is
// always something to click to bring it back.
const app = el("app");
const sidebar = el("sidebar");
const toggle = el<HTMLButtonElement>("toggle-sidebar");

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
const about = el<HTMLDialogElement>("about");
el("info").addEventListener("click", () => about.showModal());
about.addEventListener("click", (ev) => {
  // Clicking the backdrop reports the <dialog> itself as the target.
  if (ev.target === about) about.close();
});
