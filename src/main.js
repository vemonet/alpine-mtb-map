import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";

// The KML is the single source of truth. It lives in public/ so the deployed
// file is also directly downloadable from the GitHub Pages URL.
const kmlUrl = `${import.meta.env.BASE_URL}alpine-mtb-map.kml`;
const kmlResponse = await fetch(kmlUrl);
if (!kmlResponse.ok) throw new Error(`Could not load ${kmlUrl}: ${kmlResponse.status}`);
const kmlText = await kmlResponse.text();

const KML_NS = "http://www.opengis.net/kml/2.2";

// styleUrl -> how it is drawn. Pin colour encodes the displayed spot category.
const KINDS = {
  "placemark-blue": "bikepark",
  "placemark-green": "natural",
  "placemark-brown": "nolift",
  "placemark-gray": "minor",
  "line-trail": "trail",
};

const TRAIL_COLOR = "#e8590c";
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

  return [...doc.getElementsByTagNameNS(KML_NS, "Placemark")].map((pm) => {
    const styleUrl = text_(pm, "styleUrl").replace(/^#/, "");
    const point = pm.getElementsByTagNameNS(KML_NS, "Point")[0];
    const line = pm.getElementsByTagNameNS(KML_NS, "LineString")[0];
    const geom = point || line;
    return {
      name: text_(pm, "name"),
      description: text_(pm, "description"),
      kind: KINDS[styleUrl] ?? "minor",
      spot: facet(pm, "spot"),
      tags: facet(pm, "tags").split(/\s+/).filter(Boolean),
      priceDay: facet(pm, "price_day"),
      priceSeason: facet(pm, "price_season"),
      openFrom: facet(pm, "open_from"),
      closedFrom: facet(pm, "closed_from"),
      type: point ? "point" : "line",
      coords: geom ? parseCoords(text_(geom, "coordinates")) : [],
    };
  });
}

// Prices are stored in the currency the operator charges ("33 EUR"). The price
// filter needs one scale, so they are converted at rough, deliberately static
// rates: this sorts spots into the right bracket, it is not a quote. A
// currency missing from the table reads as "no price", so the slider ignores
// the spot rather than bracketing it wrongly.
const CHF_PER = { CHF: 1, EUR: 0.95, USD: 0.8, CAD: 0.58, JPY: 0.0053 };
function chf(price) {
  const m = /([\d.]+)\s*([A-Z]{3})/i.exec(price);
  const rate = m && CHF_PER[m[2].toUpperCase()];
  return rate ? +m[1] * rate : null;
}

const places = parseKml(kmlText).filter((p) => p.coords.length);

// ------------------------------------------------------------------ map ---
const DEFAULT_VIEW = [46.2, 7.1];
const DEFAULT_ZOOM = 8;
const map = L.map("map", { scrollWheelZoom: true }).setView(DEFAULT_VIEW, DEFAULT_ZOOM);

const attribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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
};
layers.OpenStreetMap.addTo(map);
L.control.layers(layers).addTo(map);

const popup = (p) => `<h3>${p.name}</h3>${p.description || ""}`;

// A spot owns its main pin, its secondary pins and its trail lines: they are
// shown and hidden together, so the filters operate on whole spots.
const spots = new Map(); // key -> {tags: Set, searchText, priceDay, group, entry}
const entries = []; // sidebar rows, one per main pin

for (const p of places) {
  const layer =
    p.type === "point"
      ? L.marker(p.coords[0], {
          icon: L.divIcon({
            className: "",
            html: `<div class="pin ${p.kind}"></div>`,
            iconSize: [15, 15],
            iconAnchor: [7, 7],
          }),
          title: p.name,
        })
      : L.polyline(p.coords, { color: TRAIL_COLOR, weight: 4, opacity: 0.85 });

  layer.bindPopup(popup(p), { maxWidth: 340 });

  const key = p.spot || p.name;
  let spot = spots.get(key);
  if (!spot) {
    spot = {
      tags: new Set(),
      searchText: "",
      priceDay: null,
      openFrom: "",
      closedFrom: "",
      group: L.layerGroup().addTo(map),
    };
    spots.set(key, spot);
  }
  spot.group.addLayer(layer);
  spot.searchText += ` ${p.name} ${p.description}`.toLocaleLowerCase();

  // A spot's tag set is the union of its placemarks', plus two tags derived
  // from data that is already there: the no-lift style and season price facet.
  // Everything downstream then filters on tags alone.
  for (const t of p.tags) spot.tags.add(t);
  if (p.kind === "nolift") spot.tags.add("nolift");
  if (p.priceSeason) spot.tags.add("season");
  if (p.priceDay) spot.priceDay = chf(p.priceDay);
  if (p.openFrom && p.closedFrom) {
    spot.openFrom = p.openFrom;
    spot.closedFrom = p.closedFrom;
  }

  // Main spot pins are the ones carrying a "[28 CHF]" summary in the name.
  const m = p.name.match(/^(.*?)\s*\[(.+)\]$/);
  if (p.type === "point" && m && p.kind !== "minor") {
    const entry = { name: m[1], meta: m[2], layer, spot };
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
for (const e of entries) {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.innerHTML = `<span class="name">${e.name}</span><span class="meta">${e.meta}</span>`;
  btn.addEventListener("click", () => {
    map.flyTo(e.layer.getLatLng(), 12, { duration: 0.6 });
    e.layer.openPopup();
  });
  li.append(btn);
  list.append(li);
  e.row = li;
}

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
// The links work on their own; this makes browsers save the file instead of
// opening it.
for (const a of document.querySelectorAll("a.dl")) {
  a.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const label = a.querySelector(".dl-text");
    const text = label.textContent;
    label.textContent = "Downloading...";
    try {
      const res = await fetch(a.href);
      if (!res.ok) throw new Error(res.status);
      const url = URL.createObjectURL(await res.blob());
      const tmp = Object.assign(document.createElement("a"), {
        href: url,
        download: a.getAttribute("download"),
      });
      tmp.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(a.href, "_blank", "noopener"); // repo not public yet, or offline
    } finally {
      label.textContent = text;
      a.closest("details")?.removeAttribute("open");
    }
  });
}

// --------------------------------------------------------------- filters ---
// Every chip is a tag test; the chip's markup says which of three modes it
// uses, so adding a filter is one <button data-tag> in index.html plus the tag
// in the KML. Nothing here knows what "winter" or "magicpass" mean.
//
//   exclude (default) - starts on; off hides spots carrying the tag
//   only              - starts off; on hides spots NOT carrying the tag
//   any + data-group  - a spot shows while at least one tag in the group is on
//
// "any" is what lets a spot tagged both beginner and expert survive turning
// either chip off; turn both off and the group matches nothing, which is the
// honest answer to "show me spots that are neither".
const chips = [...document.querySelectorAll(".filter[data-tag]")];
const categoryChips = [...document.querySelectorAll(".filter[data-category]")];
const on = (chip) => chip.getAttribute("aria-pressed") === "true";
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
const dateInput = document.getElementById("open-date");
const dateDisplay = document.getElementById("open-date-display");
const dateButton = document.getElementById("open-date-button");
const searchInput = document.getElementById("spot-search");
const updateDateDisplay = () => {
  const [year, month, day] = dateInput.value.split("-");
  dateDisplay.textContent = year ? `${day}.${month}.${year}` : "Any date";
};
updateDateDisplay();
dateButton.addEventListener("click", () => {
  if (dateInput.showPicker) {
    dateInput.showPicker();
  } else {
    dateInput.focus();
    dateInput.click();
  }
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

const matches = (spot) => {
  const query = searchInput.value.trim().toLocaleLowerCase();
  if (query && !spot.searchText.includes(query)) return false;

  const category = spot.tags.has("nolift")
    ? "nolift"
    : spot.tags.has("bikepark")
      ? "bikepark"
      : "natural";
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
  priceOut.textContent = cap === Infinity ? "any" : `${cap} CHF`;
  for (const spot of spots.values()) {
    const visible = matches(spot);
    if (visible) map.addLayer(spot.group);
    else map.removeLayer(spot.group);
    if (spot.entry) spot.entry.row.hidden = !visible;
  }
};

for (const chip of chips) {
  chip.addEventListener("click", () => {
    chip.setAttribute("aria-pressed", String(!on(chip)));
    applyFilters();
  });
}
for (const chip of categoryChips) {
  chip.addEventListener("click", () => {
    chip.setAttribute("aria-pressed", String(!on(chip)));
    applyFilters();
  });
}
priceInput.addEventListener("input", applyFilters);
searchInput.addEventListener("input", applyFilters);
dateInput.addEventListener("input", () => {
  updateDateDisplay();
  applyFilters();
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
