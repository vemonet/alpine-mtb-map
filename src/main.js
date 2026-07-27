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

const basePopup = (p) => `<h3>${p.name}</h3>${p.description || ""}`;

// A spot owns its main pin, its secondary pins and its trail lines: they are
// shown and hidden together, so the filters operate on whole spots.
const spots = new Map(); // key -> {tags: Set, searchText, priceDay, group, entry}
const entries = []; // sidebar rows, one per main pin

for (const p of places) {
  const layer =
    p.type === "point"
      ? L.marker(p.coords[0], {
          icon: pinIcon(p.kind),
          title: p.name,
        })
      : L.polyline(p.coords, { color: TRAIL_COLOR, weight: 4, opacity: 0.85 });

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
      group: L.layerGroup().addTo(map),
    };
    spots.set(key, spot);
  }
  spot.group.addLayer(layer);
  spot.places.push({ layer, place: p });
  spot.searchText += ` ${p.name} ${p.description}`.toLocaleLowerCase();
  layer.bindPopup(() => weatherPopup(p, spot), { maxWidth: 360 });
  layer.on("popupopen", () => {
    if (spot.entry) setSelectedSpotUrl(spot);
  });

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
    const entry = { name: m[1], meta: m[2], kind: p.kind, layer, spot };
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
const setSelectedSpotUrl = (spot) => {
  const url = new URL(window.location.href);
  url.searchParams.set("spot", spot.id);
  history.replaceState({ spot: spot.id }, "", url);
};

const clearSelectedSpotUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("spot");
  history.replaceState(null, "", url);
};

map.on("popupclose", clearSelectedSpotUrl);

const showEntry = (entry, animate = true) => {
  setSelectedSpotUrl(entry.spot);
  map.flyTo(entry.layer.getLatLng(), 12, { duration: animate ? 0.6 : 0 });
  entry.layer.openPopup();
};

for (const e of entries) {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.innerHTML = `<span class="name">${e.name}</span><span class="meta">${e.meta}</span>`;
  btn.addEventListener("click", () => showEntry(e));
  li.append(btn);
  list.append(li);
  e.row = li;
}

const requestedSpot = new URL(window.location.href).searchParams.get("spot");
const requestedEntry = requestedSpot && spots.get(requestedSpot)?.entry;
if (requestedEntry) requestAnimationFrame(() => showEntry(requestedEntry, false));

// --------------------------------------------------------------- weather ---
// Open-Meteo accepts comma-separated coordinate lists. Fetching the main pins
// in batches keeps the request URLs bounded while avoiding one request per
// spot. One response contains three past days and the full 16-day forecast
// window, leaving room to show three days on either side of the selected date.
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const WEATHER_BATCH_SIZE = 40;
const WEATHER_CACHE_KEY = "alpine-mtb-weather-v1";
const WEATHER_CACHE_TTL = 6 * 60 * 60 * 1000;
const WEATHER_RAIN_MM = 1;
const WEATHER_PREVIOUS_DAY_MM = 5;
const WEATHER_RAIN_PROBABILITY = 50;
const weatherBtn = document.getElementById("weather");
const weatherDateInput = document.getElementById("weather-date");
const weatherDateDisplay = document.getElementById("weather-date-display");
const weatherDateButton = document.getElementById("weather-date-button");
let weatherEnabled = true;
let weatherRequest = 0;

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
weatherDateInput.min = forecastStart;
weatherDateInput.max = forecastEnd;
weatherDateInput.value = shiftedDate(forecastStart, today.getHours() >= 16 ? 1 : 0);

const updateWeatherDateDisplay = () => {
  weatherDateDisplay.textContent = europeanDate(weatherDateInput.value);
};
updateWeatherDateDisplay();

const openDatePicker = (input) => {
  if (input.showPicker) input.showPicker();
  else {
    input.focus();
    input.click();
  }
};
weatherDateButton.addEventListener("click", () => openDatePicker(weatherDateInput));

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

const wetReason = (weather, date = weatherDateInput.value) => {
  if (!weather?.days?.has(date)) return "";
  const day = weather.days.get(date);
  const previous = weather.days.get(shiftedDate(date, -1));
  if (day.precipitation >= WEATHER_RAIN_MM) {
    return `${day.precipitation.toFixed(1)} mm precipitation forecast`;
  }
  if (day.probability >= WEATHER_RAIN_PROBABILITY) {
    return `${day.probability}% chance of precipitation`;
  }
  if (previous?.precipitation >= WEATHER_PREVIOUS_DAY_MM) {
    return `${previous.precipitation.toFixed(1)} mm precipitation the previous day`;
  }
  return "";
};

const forecastRows = (weather) => {
  const dates = [-3, -2, -1, 0, 1, 2, 3].map((days) => shiftedDate(weatherDateInput.value, days));
  return dates
    .filter((date) => weather.days.has(date))
    .map((date) => {
      const day = weather.days.get(date);
      const selected = date === weatherDateInput.value ? ' class="selected"' : "";
      return `<tr${selected}><td>${europeanDate(date, true)}</td><td>${weatherCode(
        day.code,
      )}</td><td>${Math.round(day.min)}-${Math.round(day.max)} C</td><td>${day.precipitation.toFixed(
        1,
      )} mm</td><td>${day.probability}%</td></tr>`;
    })
    .join("");
};

function weatherPopup(place, spot) {
  const content = basePopup(place);
  if (!weatherEnabled) return content;
  if (!spot.weather) {
    const status = weatherBtn.classList.contains("loading")
      ? "Loading forecast..."
      : "Forecast unavailable.";
    return `${content}<section class="weather-forecast"><h4>Weather</h4><p>${status}</p></section>`;
  }
  const reason = wetReason(spot.weather);
  return `${content}<section class="weather-forecast"><h4>Weather forecast</h4>
    <p>${europeanDate(weatherDateInput.value)}: ${
      reason
        ? `<span class="wet-note">Likely wet: ${reason}.</span>`
        : "No significant rain signal."
    }</p>
    <table class="weather-table"><thead><tr><th>Date</th><th>Sky</th><th>Temp.</th><th>Rain</th><th>Risk</th></tr></thead>
    <tbody>${forecastRows(spot.weather)}</tbody></table>
    <p><small>Forecast by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>.</small></p>
  </section>`;
}

const refreshWeatherPresentation = () => {
  for (const entry of entries) {
    entry.layer.setIcon(
      pinIcon(entry.kind, weatherEnabled && Boolean(wetReason(entry.spot.weather))),
    );
  }
  for (const spot of spots.values()) {
    for (const { layer, place } of spot.places) {
      if (layer.isPopupOpen()) layer.setPopupContent(weatherPopup(place, spot));
    }
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
  for (const entry of entries) {
    const cached = weatherCache[entry.spot.id];
    if (
      cached?.days &&
      Number.isFinite(cached.cachedAt) &&
      now - cached.cachedAt < WEATHER_CACHE_TTL
    ) {
      entry.spot.weather = { days: new Map(Object.entries(cached.days)) };
    } else {
      delete weatherCache[entry.spot.id];
    }
  }
};

const saveWeatherCache = () => {
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(weatherCache));
  } catch {
    // Weather still works when storage is unavailable or full.
  }
};

const fetchWeatherBatch = async (batch, request) => {
  const params = new URLSearchParams({
    latitude: batch.map((entry) => entry.layer.getLatLng().lat.toFixed(5)).join(","),
    longitude: batch.map((entry) => entry.layer.getLatLng().lng.toFixed(5)).join(","),
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
    past_days: "3",
    forecast_days: "16",
    timezone: "auto",
  });
  const response = await fetch(`${WEATHER_API}?${params}`);
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

const loadWeather = async () => {
  const request = ++weatherRequest;
  loadCachedWeather();
  refreshWeatherPresentation();
  const missingEntries = entries.filter((entry) => !entry.spot.weather);
  if (!missingEntries.length) {
    weatherBtn.classList.remove("loading");
    weatherBtn.title = "Disable weather";
    weatherBtn.setAttribute("aria-label", weatherBtn.title);
    return;
  }
  weatherBtn.classList.add("loading");
  weatherBtn.title = "Loading weather forecasts";
  const batches = [];
  for (let i = 0; i < missingEntries.length; i += WEATHER_BATCH_SIZE) {
    batches.push(fetchWeatherBatch(missingEntries.slice(i, i + WEATHER_BATCH_SIZE), request));
  }
  const results = await Promise.allSettled(batches);
  if (request !== weatherRequest || !weatherEnabled) return;
  weatherBtn.classList.remove("loading");
  const failed = results.filter((result) => result.status === "rejected").length;
  const label = failed
    ? `Disable weather (${failed} forecast ${failed === 1 ? "request" : "requests"} failed)`
    : "Disable weather";
  weatherBtn.title = label;
  weatherBtn.setAttribute("aria-label", label);
  refreshWeatherPresentation();
};

weatherBtn.addEventListener("click", () => {
  weatherEnabled = !weatherEnabled;
  weatherBtn.setAttribute("aria-pressed", String(weatherEnabled));
  weatherBtn.classList.remove("loading");
  weatherBtn.title = weatherEnabled ? "Disable weather" : "Enable weather";
  weatherBtn.setAttribute("aria-label", weatherBtn.title);
  document.getElementById("weather-date-filter").hidden = !weatherEnabled;
  refreshWeatherPresentation();
  if (weatherEnabled && entries.some((entry) => !entry.spot.weather)) loadWeather();
  else if (!weatherEnabled) weatherRequest++;
});

weatherDateInput.addEventListener("input", () => {
  updateWeatherDateDisplay();
  refreshWeatherPresentation();
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
  let visibleCount = 0;
  priceOut.textContent = cap === Infinity ? "any" : `${cap} CHF`;
  for (const spot of spots.values()) {
    const visible = matches(spot);
    if (visible) map.addLayer(spot.group);
    else map.removeLayer(spot.group);
    if (spot.entry) {
      spot.entry.row.hidden = !visible;
      if (visible) visibleCount++;
    }
  }
  document.querySelector("#spot-count").textContent =
    `${visibleCount} ${visibleCount === 1 ? "spot" : "spots"} shown`;
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
