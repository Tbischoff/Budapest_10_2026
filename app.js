
const CONFIG = {
  // Google Maps JavaScript API key eintragen.
  // Für GitHub Pages bitte unbedingt per HTTP-Referrer auf deine Domain beschränken.
  googleMapsApiKey: "AIzaSyBBS_tCcf_FsGPwiAjjdMV0BOTdVi5Z_kA",
  initialCenter: { lat: 47.4979, lng: 19.0402 },
  initialZoom: 12
};

const CATEGORY_ICONS = {
  food: "🍴",
  cafe: "☕",
  bar: "🍸",
  sight: "🏛️",
  culture: "🎭",
  leisure: "🌳",
  thermal: "♨️",
  viewpoint: "🌇",
  transport: "🚇",
  area: "📍",
  other: "•"
};

let map;
let geocoder;
let infoWindow;
let placesData;
let markers = new Map();
let activeCategories = new Set();
let state = loadState();

document.addEventListener("DOMContentLoaded", bootstrap);

async function bootstrap() {
  try {
    if (!window.BUDAPEST_PLACES_DATA) {
      throw new Error("Ortsdaten konnten nicht geladen werden. Prüfe, ob places.js vorhanden ist.");
    }

    placesData = window.BUDAPEST_PLACES_DATA;

    renderCategoryFilters();
    renderTryList();
    wireControls();

    await loadGoogleMaps();
    initMap();
    await createMarkers();
    applyFilters();

    setStatus("Karte bereit.");
  } catch (err) {
    console.error(err);
    setStatus(`Fehler: ${err.message}`);
  }
}

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (!CONFIG.googleMapsApiKey || CONFIG.googleMapsApiKey === "YOUR_GOOGLE_MAPS_API_KEY") {
      reject(new Error("Bitte zuerst deinen Google Maps API-Key in app.js eintragen."));
      return;
    }

    window.__initBudapestMap = resolve;

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(CONFIG.googleMapsApiKey)}` +
      `&callback=__initBudapestMap&v=weekly&language=de&region=HU&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Google Maps konnte nicht geladen werden."));
    document.head.appendChild(script);
  });
}

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: CONFIG.initialCenter,
    zoom: CONFIG.initialZoom,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });

  geocoder = new google.maps.Geocoder();
  infoWindow = new google.maps.InfoWindow();
}

async function createMarkers() {
  const places = placesData.places;
  const resolved = [];
  let geocodeCount = 0;
  let processed = 0;

  setStatus("Orte werden vorbereitet …");

  // Bereits bekannte oder im Browser gecachte Koordinaten sind sofort verfügbar.
  const needsGeocoding = [];

  for (const place of places) {
    let position = getCachedPosition(place.id);

    if (!position && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
      position = { lat: place.lat, lng: place.lng };
    }

    if (position) {
      resolved.push({ place, position });
    } else if (canGeocode(place)) {
      needsGeocoding.push(place);
    }

    processed++;
  }

  // Fehlende Koordinaten in kleinen parallelen Gruppen auflösen.
  // Dadurch ist der erste Aufruf deutlich schneller, ohne den Geocoder mit
  // dutzenden gleichzeitigen Anfragen zu überlasten.
  const BATCH_SIZE = 4;

  for (let i = 0; i < needsGeocoding.length; i += BATCH_SIZE) {
    const batch = needsGeocoding.slice(i, i + BATCH_SIZE);

    setStatus(
      `Adressen werden aufgelöst: ${Math.min(i + BATCH_SIZE, needsGeocoding.length)} / ${needsGeocoding.length}`
    );

    const results = await Promise.all(
      batch.map(async place => {
        const position = await geocodePlaceWithRetry(place);

        if (position) {
          cachePosition(place.id, position);

          // Auch im aktuellen Datenobjekt hinterlegen. So kann später ohne
          // erneute Geocodierung mit diesen Werten weitergearbeitet werden.
          place.lat = position.lat;
          place.lng = position.lng;
          geocodeCount++;

          return { place, position };
        }

        return null;
      })
    );

    resolved.push(...results.filter(Boolean));

    if (i + BATCH_SIZE < needsGeocoding.length) {
      await delay(120);
    }
  }

  // Erst jetzt werden die Marker erzeugt. Für den Benutzer erscheinen sie
  // dadurch praktisch gleichzeitig statt einzeln nacheinander.
  const markerObjects = [];

  for (const { place, position } of resolved) {
    const marker = new google.maps.Marker({
      position,
      title: place.name,
      label: {
        text: CATEGORY_ICONS[place.category] || "•",
        fontSize: "17px"
      }
    });

    marker.addListener("click", () => openPlace(place));
    markers.set(place.id, marker);
    markerObjects.push(marker);
  }

  // Marker erst nach vollständiger Vorbereitung auf die Karte setzen.
  markerObjects.forEach(marker => marker.setMap(map));

  if (geocodeCount > 0) {
    setStatus(
      `${markerObjects.length} Orte geladen · ${geocodeCount} Koordinaten neu ermittelt und gespeichert.`
    );
  } else {
    setStatus(`${markerObjects.length} Orte geladen.`);
  }
}

function geocodePlaceWithRetry(place, attempt = 0) {
  return new Promise(resolve => {
    geocoder.geocode(
      { address: `${place.address}, Hungary`, region: "HU" },
      async (results, status) => {
        if (status === "OK" && results?.[0]) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
          return;
        }

        if (status === "OVER_QUERY_LIMIT" && attempt < 3) {
          await delay(400 * (attempt + 1));
          resolve(await geocodePlaceWithRetry(place, attempt + 1));
          return;
        }

        console.warn("Geocoding fehlgeschlagen:", place.name, status);
        resolve(null);
      }
    );
  });
}

function canGeocode(place) {
  return place.address &&
    !place.address.includes("Ort noch unklar") &&
    place.status !== "needs_identification";
}

function openPlace(place) {
  const marker = markers.get(place.id);
  if (!marker) return;

  const saved = state.places[place.id] || {};
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + " " + place.address)}`;

  const html = `
    <div class="info-window">
      <h3>${escapeHtml(place.name)}</h3>
      <div class="info-meta">
        ${CATEGORY_ICONS[place.category] || "•"} ${escapeHtml(categoryLabel(place.category))}
        ${place.localTip ? " · ⭐ Local-Tipp" : ""}
      </div>
      <div>${escapeHtml(place.address || "")}</div>
      ${place.notes ? `<div class="info-note">${escapeHtml(place.notes)}</div>` : ""}
      <div class="info-actions">
        <a class="primary" href="${mapsUrl}" target="_blank" rel="noopener">Google Maps öffnen</a>
        <button onclick="toggleFavorite('${place.id}')">${saved.favorite ? "♥ Favorit" : "♡ Favorit"}</button>
        <button onclick="toggleVisited('${place.id}')">${saved.visited ? "✓ Besucht" : "○ Als besucht markieren"}</button>
      </div>
    </div>
  `;

  infoWindow.setContent(html);
  infoWindow.open({ map, anchor: marker });
  map.panTo(marker.getPosition());
}

function renderCategoryFilters() {
  const container = document.getElementById("categoryFilters");
  const categories = Object.entries(placesData.meta.categories);

  categories.forEach(([key, label]) => {
    activeCategories.add(key);

    const row = document.createElement("label");
    row.className = "filter-row";
    row.innerHTML = `
      <input type="checkbox" value="${key}" checked />
      <span>${CATEGORY_ICONS[key] || "•"} ${escapeHtml(label)}</span>
    `;
    row.querySelector("input").addEventListener("change", (e) => {
      e.target.checked ? activeCategories.add(key) : activeCategories.delete(key);
      applyFilters();
      updateToggleAllText();
    });
    container.appendChild(row);
  });
}

function renderTryList() {
  const container = document.getElementById("tryList");

  for (const item of placesData.tryInBudapest || []) {
    const row = document.createElement("label");
    row.className = "try-row";

    const checked = Boolean(state.try[item.id]);
    row.innerHTML = `
      <input type="checkbox" ${checked ? "checked" : ""} />
      <span>${escapeHtml(item.name)}</span>
    `;

    row.querySelector("input").addEventListener("change", e => {
      state.try[item.id] = e.target.checked;
      saveState();
    });

    container.appendChild(row);
  }
}

function renderPlaceList(filteredPlaces) {
  const container = document.getElementById("placeList");
  container.innerHTML = "";

  filteredPlaces.forEach(place => {
    const saved = state.places[place.id] || {};
    const card = document.createElement("div");
    card.className = "place-card";
    card.innerHTML = `
      <div class="place-card-title">
        <span>${CATEGORY_ICONS[place.category] || "•"} ${escapeHtml(place.name)}</span>
        <span>${saved.favorite ? "♥" : ""}${place.localTip ? " ⭐" : ""}</span>
      </div>
      <div class="place-card-meta">
        ${escapeHtml(categoryLabel(place.category))}
        ${saved.visited ? " · ✓ besucht" : ""}
      </div>
      ${place.notes ? `<div class="place-card-note">${escapeHtml(place.notes)}</div>` : ""}
    `;

    card.addEventListener("click", () => {
      const marker = markers.get(place.id);
      if (marker) {
        openPlace(place);
        map.setZoom(Math.max(map.getZoom(), 15));
      }
      closeMobileSidebar();
    });

    container.appendChild(card);
  });

  document.getElementById("visibleCount").textContent = filteredPlaces.length;
}

function applyFilters() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const localOnly = document.getElementById("localOnly").checked;
  const favoritesOnly = document.getElementById("favoritesOnly").checked;
  const unvisitedOnly = document.getElementById("unvisitedOnly").checked;

  const filtered = placesData.places.filter(place => {
    const saved = state.places[place.id] || {};

    if (!activeCategories.has(place.category)) return false;
    if (localOnly && !place.localTip) return false;
    if (favoritesOnly && !saved.favorite) return false;
    if (unvisitedOnly && saved.visited) return false;

    if (query) {
      const haystack = [
        place.name,
        place.address,
        place.notes,
        ...(place.tags || [])
      ].join(" ").toLowerCase();

      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  const visibleIds = new Set(filtered.map(p => p.id));
  for (const [id, marker] of markers) {
    marker.setVisible(visibleIds.has(id));
  }

  renderPlaceList(filtered);
}

function fitVisibleMarkers() {
  const visible = [...markers.entries()]
    .filter(([id, marker]) => marker.getVisible())
    .map(([, marker]) => marker);

  if (!visible.length) return;

  const bounds = new google.maps.LatLngBounds();
  visible.forEach(marker => bounds.extend(marker.getPosition()));
  map.fitBounds(bounds, 60);
}

function wireControls() {
  document.getElementById("searchInput").addEventListener("input", applyFilters);
  document.getElementById("localOnly").addEventListener("change", applyFilters);
  document.getElementById("favoritesOnly").addEventListener("change", applyFilters);
  document.getElementById("unvisitedOnly").addEventListener("change", applyFilters);
  document.getElementById("fitBtn").addEventListener("click", fitVisibleMarkers);

  document.getElementById("toggleAllBtn").addEventListener("click", () => {
    const checkboxes = document.querySelectorAll("#categoryFilters input[type=checkbox]");
    const turnOn = activeCategories.size !== placesData.meta.categoriesCount &&
      activeCategories.size === 0;

    const allOn = [...checkboxes].every(cb => cb.checked);
    checkboxes.forEach(cb => {
      cb.checked = !allOn;
      if (!allOn) activeCategories.add(cb.value);
      else activeCategories.delete(cb.value);
    });
    applyFilters();
    updateToggleAllText();
  });

  document.getElementById("resetStateBtn").addEventListener("click", () => {
    if (!confirm("Favoriten, Besucht-Markierungen und Probier-Checkliste zurücksetzen?")) return;
    state = { places: {}, try: {} };
    saveState();
    renderTryListFresh();
    applyFilters();
  });

  document.getElementById("mobileMenuBtn").addEventListener("click", () => {
    document.querySelector(".sidebar").classList.add("open");
  });

  document.getElementById("mobileClose").addEventListener("click", closeMobileSidebar);
}

function updateToggleAllText() {
  const checkboxes = [...document.querySelectorAll("#categoryFilters input[type=checkbox]")];
  const allOn = checkboxes.every(cb => cb.checked);
  document.getElementById("toggleAllBtn").textContent = allOn ? "Alle aus" : "Alle an";
}

function renderTryListFresh() {
  const container = document.getElementById("tryList");
  container.innerHTML = "";
  renderTryList();
}

function closeMobileSidebar() {
  document.querySelector(".sidebar").classList.remove("open");
}

function toggleFavorite(id) {
  const item = ensurePlaceState(id);
  item.favorite = !item.favorite;
  saveState();
  applyFilters();

  const place = placesData.places.find(p => p.id === id);
  if (place) openPlace(place);
}

function toggleVisited(id) {
  const item = ensurePlaceState(id);
  item.visited = !item.visited;
  saveState();
  applyFilters();

  const place = placesData.places.find(p => p.id === id);
  if (place) openPlace(place);
}

function ensurePlaceState(id) {
  if (!state.places[id]) state.places[id] = {};
  return state.places[id];
}

function categoryLabel(key) {
  return placesData.meta.categories[key] || key;
}

function setStatus(text) {
  const box = document.getElementById("statusBox");
  box.textContent = text;
  clearTimeout(setStatus._timer);
  setStatus._timer = setTimeout(() => {
    box.style.opacity = "0.82";
  }, 4000);
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem("budapestMapState")) || { places: {}, try: {} };
  } catch {
    return { places: {}, try: {} };
  }
}

function saveState() {
  localStorage.setItem("budapestMapState", JSON.stringify(state));
}

function getCachedPosition(id) {
  try {
    const cache = JSON.parse(localStorage.getItem("budapestGeocodeCache")) || {};
    return cache[id] || null;
  } catch {
    return null;
  }
}

function cachePosition(id, position) {
  let cache = {};
  try {
    cache = JSON.parse(localStorage.getItem("budapestGeocodeCache")) || {};
  } catch {}
  cache[id] = position;
  localStorage.setItem("budapestGeocodeCache", JSON.stringify(cache));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.toggleFavorite = toggleFavorite;
window.toggleVisited = toggleVisited;
