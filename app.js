
const CONFIG = {
  // Google Maps JavaScript API key eintragen.
  // Für GitHub Pages bitte unbedingt per HTTP-Referrer auf deine Domain beschränken.
  googleMapsApiKey: "YAIzaSyCw_nRXt7NWjHw-lHTHZb8N8jmvl2iQFkg",
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

const TRIP_DAYS = [
  { id: "2026-10-03", short: "Sa 03.10.", label: "Samstag, 03.10." },
  { id: "2026-10-04", short: "So 04.10.", label: "Sonntag, 04.10." },
  { id: "2026-10-05", short: "Mo 05.10.", label: "Montag, 05.10." },
  { id: "2026-10-06", short: "Di 06.10.", label: "Dienstag, 06.10." },
  { id: "2026-10-07", short: "Mi 07.10.", label: "Mittwoch, 07.10." }
];

let selectedDayFilter = "all";
let userPosition = null;
let userLocationMarker = null;
let sortByDistance = false;

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

    // Kopie verwenden, damit die statischen Daten aus places.js unverändert bleiben.
    placesData = JSON.parse(JSON.stringify(window.BUDAPEST_PLACES_DATA));
    mergeLocalPlaces();

    renderCategoryFilters();
    renderDayFilters();
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
        ${place.isLocalPlace ? " · 📌 Eigener Ort" : ""}
      </div>
      <div>${escapeHtml(place.address || "")}</div>
      ${userPosition && distanceToPlace(place) != null
        ? `<div class="info-distance">📍 ${escapeHtml(formatDistance(distanceToPlace(place)))} Luftlinie entfernt</div>`
        : ""}
      ${place.notes ? `<div class="info-note">${escapeHtml(place.notes)}</div>` : ""}
      <div class="info-actions">
        <a class="primary" href="${mapsUrl}" target="_blank" rel="noopener">Google Maps öffnen</a>
        <select class="day-select" onchange="setPlannedDay('${place.id}', this.value)">
          ${dayOptionsHtml(saved.plannedDay || "")}
        </select>
        <button onclick="toggleVisited('${place.id}')">${saved.visited ? "✓ Besucht" : "○ Als besucht markieren"}</button>
        ${place.isLocalPlace ? `<button class="danger" onclick="deleteLocalPlace('${place.id}')">Löschen</button>` : ""}
      </div>
    </div>
  `;

  infoWindow.setContent(html);
  infoWindow.open({ map, anchor: marker });
  map.panTo(marker.getPosition());
}


const LOCAL_PLACES_KEY = "budapestLocalPlaces";

function loadLocalPlaces() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_PLACES_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalPlaces(items) {
  localStorage.setItem(LOCAL_PLACES_KEY, JSON.stringify(items));
}

function mergeLocalPlaces() {
  const localPlaces = loadLocalPlaces();

  for (const place of localPlaces) {
    if (!placesData.places.some(existing => existing.id === place.id)) {
      placesData.places.push(place);
    }
  }
}

function createLocalPlaceId() {
  if (window.crypto?.randomUUID) {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function openAddPlaceDialog() {
  const dialog = document.getElementById("addPlaceDialog");
  const form = document.getElementById("addPlaceForm");

  form.reset();
  document.getElementById("placeCategory").value = "food";
  document.getElementById("placeFormMessage").textContent = "";

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeAddPlaceDialog() {
  const dialog = document.getElementById("addPlaceDialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

async function handleAddPlace(event) {
  event.preventDefault();

  const submitButton = document.getElementById("savePlaceBtn");
  const message = document.getElementById("placeFormMessage");

  const name = document.getElementById("placeName").value.trim();
  const address = document.getElementById("placeAddress").value.trim();
  const category = document.getElementById("placeCategory").value;
  const notes = document.getElementById("placeNotes").value.trim();
  const localTip = document.getElementById("placeLocalTip").checked;

  if (!name || !address) {
    message.textContent = "Bitte Name und Adresse eintragen.";
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Adresse wird geprüft …";
  message.textContent = "";

  try {
    const draft = {
      id: createLocalPlaceId(),
      name,
      address,
      category,
      notes,
      localTip,
      tags: ["eigener Ort"],
      status: "local",
      source: "localStorage",
      isLocalPlace: true,
      createdAt: new Date().toISOString()
    };

    const position = await geocodePlaceWithRetry(draft);

    if (!position) {
      message.textContent = "Die Adresse konnte nicht gefunden werden. Bitte prüfe die Schreibweise.";
      return;
    }

    draft.lat = position.lat;
    draft.lng = position.lng;

    const localPlaces = loadLocalPlaces();
    localPlaces.push(draft);
    saveLocalPlaces(localPlaces);

    placesData.places.push(draft);
    cachePosition(draft.id, position);

    const marker = new google.maps.Marker({
      map,
      position,
      title: draft.name,
      label: {
        text: CATEGORY_ICONS[draft.category] || "•",
        fontSize: "17px"
      }
    });

    marker.addListener("click", () => openPlace(draft));
    markers.set(draft.id, marker);

    // Falls die gewählte Kategorie vorher deaktiviert war, soll der neue Ort
    // trotzdem sichtbar sein.
    activeCategories.add(draft.category);
    const categoryCheckbox = document.querySelector(
      `#categoryFilters input[value="${CSS.escape(draft.category)}"]`
    );
    if (categoryCheckbox) categoryCheckbox.checked = true;

    applyFilters();
    updateToggleAllText();
    closeAddPlaceDialog();

    map.panTo(position);
    map.setZoom(Math.max(map.getZoom(), 16));
    openPlace(draft);
    setStatus(`„${draft.name}“ wurde lokal gespeichert.`);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Ort speichern";
  }
}

function deleteLocalPlace(id) {
  const place = placesData.places.find(p => p.id === id);
  if (!place?.isLocalPlace) return;

  if (!confirm(`„${place.name}“ wirklich löschen?`)) return;

  const marker = markers.get(id);
  if (marker) marker.setMap(null);
  markers.delete(id);

  const localPlaces = loadLocalPlaces().filter(item => item.id !== id);
  saveLocalPlaces(localPlaces);

  placesData.places = placesData.places.filter(item => item.id !== id);
  delete state.places[id];
  saveState();

  applyFilters();
  infoWindow.close();
  setStatus(`„${place.name}“ wurde gelöscht.`);
}


function renderDayFilters() {
  const container = document.getElementById("dayFilters");
  if (!container) return;

  const buttons = [
    { id: "all", label: "Alle" },
    ...TRIP_DAYS.map(day => ({ id: day.id, label: day.short })),
    { id: "unplanned", label: "Noch offen" }
  ];

  container.innerHTML = "";

  for (const item of buttons) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-filter-button";
    button.dataset.day = item.id;
    button.textContent = item.label;

    if (selectedDayFilter === item.id) button.classList.add("active");

    button.addEventListener("click", () => {
      selectedDayFilter = item.id;
      document.querySelectorAll(".day-filter-button").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.day === selectedDayFilter);
      });
      applyFilters();
    });

    container.appendChild(button);
  }

  updateDayCounts();
}

function updateDayCounts() {
  const counts = Object.fromEntries(TRIP_DAYS.map(day => [day.id, 0]));
  let unplanned = 0;

  for (const place of placesData.places) {
    const plannedDay = (state.places[place.id] || {}).plannedDay || "";
    if (plannedDay && counts[plannedDay] !== undefined) counts[plannedDay]++;
    else unplanned++;
  }

  document.querySelectorAll(".day-filter-button").forEach(button => {
    const id = button.dataset.day;
    if (id === "all") {
      button.textContent = `Alle (${placesData.places.length})`;
    } else if (id === "unplanned") {
      button.textContent = `Noch offen (${unplanned})`;
    } else {
      const day = TRIP_DAYS.find(d => d.id === id);
      button.textContent = `${day.short} (${counts[id] || 0})`;
    }
  });
}

function dayShortLabel(dayId) {
  return TRIP_DAYS.find(day => day.id === dayId)?.short || "";
}

function dayLongLabel(dayId) {
  return TRIP_DAYS.find(day => day.id === dayId)?.label || "";
}

function dayOptionsHtml(selectedDay) {
  let html = '<option value="">🗓️ Tag auswählen</option>';
  for (const day of TRIP_DAYS) {
    const selected = selectedDay === day.id ? " selected" : "";
    html += `<option value="${day.id}"${selected}>${day.label}</option>`;
  }
  return html;
}

function setPlannedDay(id, dayId) {
  const item = ensurePlaceState(id);
  if (dayId) item.plannedDay = dayId;
  else delete item.plannedDay;

  saveState();
  updateDayCounts();
  applyFilters();

  const place = placesData.places.find(p => p.id === id);
  if (place) openPlace(place);

  setStatus(
    dayId
      ? `„${place?.name || "Ort"}“ ist für ${dayLongLabel(dayId)} geplant.`
      : `Tagesplanung für „${place?.name || "Ort"}“ entfernt.`
  );
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


function requestUserLocation() {
  const button = document.getElementById("locateBtn");
  const locationText = document.getElementById("locationText");

  if (!navigator.geolocation) {
    setStatus("Dein Browser unterstützt keine Standortbestimmung.");
    locationText.textContent = "Standort wird von diesem Browser nicht unterstützt.";
    return;
  }

  button.disabled = true;
  button.textContent = "📍 Standort wird ermittelt …";
  locationText.textContent = "Standort wird ermittelt …";

  navigator.geolocation.getCurrentPosition(
    position => {
      userPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      updateUserLocationMarker();
      updateDistanceControls();
      applyFilters();

      map.panTo(userPosition);
      if (map.getZoom() < 14) map.setZoom(14);

      const accuracy = Math.round(position.coords.accuracy || 0);
      locationText.textContent = accuracy
        ? `Standort aktiv · Genauigkeit ca. ${accuracy} m`
        : "Standort aktiv";

      button.disabled = false;
      button.textContent = "📍 Standort aktualisieren";
      setStatus("Standort aktualisiert. Entfernungen werden angezeigt.");
    },
    error => {
      button.disabled = false;
      button.textContent = "📍 Mein Standort";

      let message = "Standort konnte nicht ermittelt werden.";
      if (error.code === error.PERMISSION_DENIED) {
        message = "Standortfreigabe wurde abgelehnt. Du kannst sie in den Browser-Einstellungen wieder erlauben.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = "Der aktuelle Standort ist momentan nicht verfügbar.";
      } else if (error.code === error.TIMEOUT) {
        message = "Die Standortabfrage hat zu lange gedauert. Bitte versuche es erneut.";
      }

      locationText.textContent = message;
      setStatus(message);
    },
    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 30000
    }
  );
}

function updateUserLocationMarker() {
  if (!userPosition) return;

  if (!userLocationMarker) {
    userLocationMarker = new google.maps.Marker({
      map,
      position: userPosition,
      title: "Mein Standort",
      zIndex: 9999,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: "#2563eb",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3
      }
    });
  } else {
    userLocationMarker.setPosition(userPosition);
    userLocationMarker.setMap(map);
  }
}

function distanceToPlace(place) {
  if (!userPosition) return null;

  const marker = markers.get(place.id);
  if (!marker) return null;

  const pos = marker.getPosition();
  if (!pos) return null;

  return haversineDistanceKm(
    userPosition.lat,
    userPosition.lng,
    pos.lat(),
    pos.lng()
  );
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371;
  const toRad = value => value * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceKm) {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return "";

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1).replace(".", ",")} km`;
  }

  return `${Math.round(distanceKm)} km`;
}

function updateDistanceControls() {
  const sortButton = document.getElementById("distanceSortBtn");
  if (!sortButton) return;

  sortButton.disabled = !userPosition;
  sortButton.title = userPosition
    ? "Orte nach Luftlinienentfernung sortieren"
    : "Zuerst Standort freigeben";

  sortButton.classList.toggle("active", sortByDistance && Boolean(userPosition));
}

function toggleDistanceSort() {
  if (!userPosition) {
    setStatus("Bitte zuerst „Mein Standort“ verwenden.");
    return;
  }

  sortByDistance = !sortByDistance;
  updateDistanceControls();
  applyFilters();
}

function renderPlaceList(filteredPlaces) {
  const container = document.getElementById("placeList");
  container.innerHTML = "";

  const placesForDisplay = [...filteredPlaces];

  if (sortByDistance && userPosition) {
    placesForDisplay.sort((a, b) => {
      const distanceA = distanceToPlace(a);
      const distanceB = distanceToPlace(b);

      if (distanceA == null && distanceB == null) return 0;
      if (distanceA == null) return 1;
      if (distanceB == null) return -1;
      return distanceA - distanceB;
    });
  }

  placesForDisplay.forEach(place => {
    const saved = state.places[place.id] || {};
    const card = document.createElement("div");
    card.className = "place-card";
    card.innerHTML = `
      <div class="place-card-title">
        <span>${CATEGORY_ICONS[place.category] || "•"} ${escapeHtml(place.name)}</span>
        <span>${saved.plannedDay ? `🗓️ ${escapeHtml(dayShortLabel(saved.plannedDay))}` : ""}${place.localTip ? " ⭐" : ""}${place.isLocalPlace ? " 📌" : ""}</span>
      </div>
      <div class="place-card-meta">
        ${escapeHtml(categoryLabel(place.category))}
        ${userPosition && distanceToPlace(place) != null ? ` · 📍 ${escapeHtml(formatDistance(distanceToPlace(place)))} entfernt` : ""}
        ${saved.plannedDay ? ` · 🗓️ ${escapeHtml(dayLongLabel(saved.plannedDay))}` : ""}
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
  const unvisitedOnly = document.getElementById("unvisitedOnly").checked;

  const filtered = placesData.places.filter(place => {
    const saved = state.places[place.id] || {};

    if (!activeCategories.has(place.category)) return false;
    if (localOnly && !place.localTip) return false;
    if (unvisitedOnly && saved.visited) return false;

    const plannedDay = saved.plannedDay || "";
    if (selectedDayFilter === "unplanned" && plannedDay) return false;
    if (selectedDayFilter !== "all" && selectedDayFilter !== "unplanned" && plannedDay !== selectedDayFilter) return false;

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
  updateDayCounts();
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
  document.getElementById("unvisitedOnly").addEventListener("change", applyFilters);
  document.getElementById("fitBtn").addEventListener("click", fitVisibleMarkers);
  document.getElementById("locateBtn").addEventListener("click", requestUserLocation);
  document.getElementById("distanceSortBtn").addEventListener("click", toggleDistanceSort);
  document.getElementById("addPlaceBtn").addEventListener("click", openAddPlaceDialog);
  document.getElementById("cancelPlaceBtn").addEventListener("click", closeAddPlaceDialog);
  document.getElementById("addPlaceForm").addEventListener("submit", handleAddPlace);

  const addPlaceDialog = document.getElementById("addPlaceDialog");
  addPlaceDialog.addEventListener("click", event => {
    if (event.target === addPlaceDialog) closeAddPlaceDialog();
  });

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
    if (!confirm("Tagesplanung, Besucht-Markierungen und Probier-Checkliste zurücksetzen?")) return;
    state = { places: {}, try: {} };
    saveState();
    renderTryListFresh();
    applyFilters();
  });

  document.getElementById("mobileMenuBtn").addEventListener("click", () => {
    document.querySelector(".sidebar").classList.add("open");
  });

  document.getElementById("mobileClose").addEventListener("click", closeMobileSidebar);
  updateDistanceControls();
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

window.toggleVisited = toggleVisited;
window.setPlannedDay = setPlannedDay;
window.deleteLocalPlace = deleteLocalPlace;
