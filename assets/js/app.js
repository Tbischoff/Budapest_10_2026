
const APP_VERSION = "v1.0.0 · Phase 2 · Build 1";

const SUPABASE_CONFIG = {
  url: "https://fjlezfzninkltblcctds.supabase.co",
  publishableKey: "sb_publishable_h1U0zQu-XoJzVQsIqHtJNg_yGyurAr7"
};
const TRIP_NAME = "Budapest 2026";
let supabaseClient = null;
let currentUser = null;
let currentTripId = null;
let currentTripDays = [];
let supabaseSyncTimer = null;
let supabaseSyncInProgress = false;
let supabaseSyncQueued = false;
let suppressSupabaseSync = true;

const CONFIG = {
  // Google Maps JavaScript API key eintragen.
  // Für GitHub Pages bitte unbedingt per HTTP-Referrer auf deine Domain beschränken.
  googleMapsApiKey: "AIzaSyCw_nRXt7NWjHw-lHTHZb8N8jmvl2iQFkg",
  googleMapId: "DEMO_MAP_ID",
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
let AdvancedMarkerElement = null;
let PinElement = null;
let sortByDistance = false;
let dayRoutePolylines = [];
let activeRouteDay = null;
let RouteClass = null;
let routeLoading = false;
let activeRouteSummary = null;
let routeStartMode = "planned";
let currentMobileView = "map";
let searchDebounceTimer = null;

let map;
let geocoder;
let infoWindow;
let placesData;
let markers = new Map();
let activeCategories = new Set();
let state = loadState();

document.addEventListener("DOMContentLoaded", bootstrapAuth);


async function bootstrapAuth() {
  try {
    if (!window.supabase?.createClient) throw new Error("Supabase-Bibliothek konnte nicht geladen werden.");
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey);

    document.getElementById("loginForm").addEventListener("submit", handleLogin);
    document.getElementById("logoutButton").addEventListener("click", handleLogout);

    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (session?.user) {
      await enterAuthenticatedApp(session.user);
    } else {
      showLogin();
    }

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") showLogin();
    });
  } catch (error) {
    console.error(error);
    showLogin(error.message);
  }
}

function showLogin(message = "") {
  currentUser = null;
  document.getElementById("authGate").classList.remove("is-hidden");
  document.getElementById("loginMessage").textContent = message;
}

async function handleLogin(event) {
  event.preventDefault();
  const button = document.getElementById("loginButton");
  const message = document.getElementById("loginMessage");
  button.disabled = true;
  message.textContent = "Anmeldung läuft …";
  try {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await enterAuthenticatedApp(data.user);
  } catch (error) {
    console.error("Login:", error);
    message.textContent = error.message === "Invalid login credentials"
      ? "E-Mail oder Passwort ist nicht korrekt."
      : `Anmeldung fehlgeschlagen: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.reload();
}

async function enterAuthenticatedApp(user) {
  currentUser = user;
  document.getElementById("accountEmail").textContent = user.email || "";
  document.getElementById("authGate").classList.add("is-hidden");
  await bootstrap();
}

async function loadSupabaseTripData() {
  const { data: trip, error: tripError } = await supabaseClient
    .from("trips")
    .select("id,name,destination,start_date,end_date")
    .eq("name", TRIP_NAME)
    .single();
  if (tripError) throw tripError;

  const { data: dbPlaces, error: placesError } = await supabaseClient
    .from("places")
    .select("*")
    .order("name");
  if (placesError) throw placesError;

  const { data: tripPlaces, error: tpError } = await supabaseClient
    .from("trip_places")
    .select("place_id,trip_day_id,planned_order,planned_time,planned_end_time,visited")
    .eq("trip_id", trip.id);
  if (tpError) throw tpError;

  const { data: tripDays, error: daysError } = await supabaseClient
    .from("trip_days")
    .select("id,day_date,title")
    .eq("trip_id", trip.id)
    .order("day_date");
  if (daysError) throw daysError;

  currentTripId = trip.id;
  currentTripDays = tripDays;
  const dayById = new Map(tripDays.map(day => [day.id, day.day_date]));
  const tpByPlaceId = new Map(tripPlaces.map(item => [item.place_id, item]));

  const convertedPlaces = dbPlaces.map(place => {
    const relation = tpByPlaceId.get(place.id);
    const frontendId = place.legacy_id || place.id;
    if (relation) {
      const ps = ensurePlaceState(frontendId);
      ps.visited = Boolean(relation.visited);
      if (relation.trip_day_id) ps.plannedDay = dayById.get(relation.trip_day_id) || null;
      else delete ps.plannedDay;
      if (relation.planned_order != null) ps.plannedOrder = relation.planned_order;
      else delete ps.plannedOrder;
      if (relation.planned_time) ps.startTime = relation.planned_time.slice(0, 5);
      else delete ps.startTime;
      if (relation.planned_end_time) ps.endTime = relation.planned_end_time.slice(0, 5);
      else delete ps.endTime;
    }
    return {
      id: frontendId,
      supabaseId: place.id,
      name: place.name,
      address: place.address,
      lat: place.latitude,
      lng: place.longitude,
      category: place.category || "other",
      tags: place.tags || [],
      googlePlaceId: place.google_place_id,
      website: place.website,
      phone: place.phone,
      openingHours: place.opening_hours,
      notes: place.note,
      localTip: Boolean(place.is_local_tip),
      favorite: Boolean(place.favorite),
      visited: Boolean(relation?.visited),
      status: place.status,
      source: place.source,
      detailsSource: place.details_source,
      detailsSourceType: place.details_source_type,
      detailsUpdated: place.details_updated
    };
  });

  return { trip, tripDays, places: convertedPlaces };
}

async function bootstrap() {
  try {
    if (!window.BUDAPEST_PLACES_DATA) {
      throw new Error("Lokale Metadaten konnten nicht geladen werden.");
    }

    const remote = await loadSupabaseTripData();
    placesData = {
      meta: JSON.parse(JSON.stringify(window.BUDAPEST_PLACES_DATA.meta)),
      tryInBudapest: JSON.parse(JSON.stringify(window.BUDAPEST_PLACES_DATA.tryInBudapest || [])),
      places: remote.places
    };
    placesData.meta.categoriesCount = Object.keys(placesData.meta.categories || {}).length;
    ensureDayOrders();

    renderCategoryFilters();
    renderDayFilters();
    renderTryList();
    wireControls();

    await loadGoogleMaps();
    initMap();
    await createMarkers();
    applyFilters();

    suppressSupabaseSync = false;
    setStatus(`☁️ ${placesData.places.length} Orte aus Supabase geladen · Synchronisation aktiv.`);
  } catch (err) {
    console.error(err);
    setStatus(`Fehler: ${err.message}`);
  }
}

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (!CONFIG.googleMapsApiKey) {
      reject(new Error("Google Maps API-Key fehlt in app.js."));
      return;
    }

    window.__initBudapestMap = async () => {
      try {
        const markerLibrary = await google.maps.importLibrary("marker");
        AdvancedMarkerElement = markerLibrary.AdvancedMarkerElement;
        PinElement = markerLibrary.PinElement;
        resolve();
      } catch (error) {
        reject(new Error(`Advanced Marker konnten nicht geladen werden: ${error.message}`));
      }
    };

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


function centerMapOnBudapest() {
  if (!map) return;
  map.setCenter(CONFIG.initialCenter);
  map.setZoom(CONFIG.initialZoom);
  setStatus("Karte auf Budapest zentriert.");
}

function centerMapOnCurrentLocation({ silent = false } = {}) {
  if (!navigator.geolocation) {
    if (!silent) setStatus("Standortbestimmung wird von diesem Browser nicht unterstützt.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      userPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      updateUserLocationMarker();
      updateDistanceControls();
      updateRouteControls();
      applyFilters();
      map.setCenter(userPosition);
      map.setZoom(14);

      if (!silent) setStatus("Karte auf deinen aktuellen Standort zentriert.");
    },
    () => {
      if (!silent) setStatus("Standort nicht verfügbar. Karte bleibt auf Budapest.");
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
  );
}


let googlePlaceAutocompleteElement = null;
let selectedGooglePlace = null;

async function initGooglePlaceAutocomplete() {
  const host = document.getElementById("googlePlaceAutocomplete");
  if (!host || googlePlaceAutocompleteElement) return;

  try {
    const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");

    googlePlaceAutocompleteElement = new PlaceAutocompleteElement({
      includedRegionCodes: ["hu"],
      locationBias: {
        center: CONFIG.initialCenter,
        radius: 50000
      }
    });
    googlePlaceAutocompleteElement.placeholder = "Restaurant, Café, Sehenswürdigkeit …";
    host.appendChild(googlePlaceAutocompleteElement);

    googlePlaceAutocompleteElement.addEventListener("gmp-select", async event => {
      const prediction = event.placePrediction;
      if (!prediction) return;

      const place = prediction.toPlace();
      await place.fetchFields({
        fields: [
          "id",
          "displayName",
          "formattedAddress",
          "location",
          "websiteURI",
          "nationalPhoneNumber",
          "regularOpeningHours"
        ]
      });

      selectedGooglePlace = place;

      document.getElementById("placeName").value = place.displayName || "";
      document.getElementById("placeAddress").value = place.formattedAddress || "";

      const selection = document.getElementById("googlePlaceSelection");
      selection.hidden = false;
      selection.innerHTML = `
        <strong>✓ ${escapeHtml(place.displayName || "Google-Ort ausgewählt")}</strong>
        <span>${escapeHtml(place.formattedAddress || "")}</span>
      `;
    });
  } catch (error) {
    console.error("Google Places konnte nicht geladen werden:", error);
    host.innerHTML = '<div class="form-hint">Google-Ortssuche nicht verfügbar. Bitte den Ort manuell eingeben.</div>';
  }
}

function resetGooglePlaceSelection() {
  selectedGooglePlace = null;
  const selection = document.getElementById("googlePlaceSelection");
  if (selection) {
    selection.hidden = true;
    selection.innerHTML = "";
  }
}

function googleOpeningHoursText(place) {
  const rows = place?.regularOpeningHours?.weekdayDescriptions;
  return Array.isArray(rows) ? rows.join(" · ") : "";
}

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: CONFIG.initialCenter,
    zoom: CONFIG.initialZoom,
    mapId: CONFIG.googleMapId || "DEMO_MAP_ID",
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });

  geocoder = new google.maps.Geocoder();
  infoWindow = new google.maps.InfoWindow();

  // Marker-Infofenster auch durch Tippen/Klicken auf die Karte schließen.
  map.addListener("click", () => {
    infoWindow.close();
  });

  // Start möglichst am aktuellen Standort; Budapest bleibt Fallback.
  centerMapOnCurrentLocation({ silent: true });
  initGooglePlaceAutocomplete();
}


const MARKER_BACKGROUNDS = {
  food: "#f97316",
  cafe: "#a16207",
  bar: "#7c3aed",
  sight: "#2563eb",
  culture: "#db2777",
  leisure: "#16a34a",
  thermal: "#0891b2",
  viewpoint: "#ca8a04",
  transport: "#475569",
  area: "#dc2626",
  other: "#64748b"
};

function markerGlyphForPlace(place) {
  const saved = state.places[place.id] || {};

  if (TRIP_DAYS.some(day => day.id === selectedDayFilter) && saved.plannedDay === selectedDayFilter) {
    return String(saved.plannedOrder || "");
  }

  if (place.localTip) return "★";
  return CATEGORY_ICONS[place.category] || "•";
}

function markerAppearanceForPlace(place) {
  const saved = state.places[place.id] || {};
  const selectedDayIsConcrete = TRIP_DAYS.some(day => day.id === selectedDayFilter);
  const isInSelectedDay = selectedDayIsConcrete && saved.plannedDay === selectedDayFilter;

  let background = MARKER_BACKGROUNDS[place.category] || MARKER_BACKGROUNDS.other;
  let glyphColor = "#ffffff";
  let scale = place.localTip ? 1.12 : 1;
  let opacity = 1;

  if (selectedDayIsConcrete) {
    if (isInSelectedDay) {
      background = "#2f625d";
      scale = 1.16;
    } else {
      opacity = 0.35;
      scale = 0.92;
    }
  }

  if (saved.visited) {
    opacity = Math.min(opacity, 0.42);
  }

  return { background, glyphColor, scale, opacity };
}

function buildMarkerContent(place) {
  const appearance = markerAppearanceForPlace(place);

  const pin = new PinElement({
    glyphText: markerGlyphForPlace(place),
    glyphColor: appearance.glyphColor,
    background: appearance.background,
    borderColor: "#ffffff",
    scale: appearance.scale
  });

  const wrapper = document.createElement("div");
  wrapper.className = "custom-marker-wrapper";
  wrapper.style.opacity = String(appearance.opacity);
  wrapper.append(pin);

  return wrapper;
}

function createPlaceMarker(place, position, mapValue = null) {
  const marker = new AdvancedMarkerElement({
    map: mapValue,
    position,
    title: place.name,
    gmpClickable: true,
    zIndex: place.localTip ? 100 : 1
  });

  marker.append(buildMarkerContent(place));
  return marker;
}

function refreshMarkerAppearance(place) {
  const marker = markers.get(place.id);
  if (!marker) return;

  while (marker.firstChild) {
    marker.removeChild(marker.firstChild);
  }
  marker.append(buildMarkerContent(place));

  const saved = state.places[place.id] || {};
  marker.zIndex = (
    TRIP_DAYS.some(day => day.id === selectedDayFilter) &&
    saved.plannedDay === selectedDayFilter
  ) ? 500 + (saved.plannedOrder || 0) : (place.localTip ? 100 : 1);
}

function refreshAllMarkerAppearances() {
  for (const place of placesData.places) {
    refreshMarkerAppearance(place);
  }
}

function getMarkerPosition(marker) {
  const position = marker?.position;
  if (!position) return null;

  const lat = typeof position.lat === "function" ? position.lat() : Number(position.lat);
  const lng = typeof position.lng === "function" ? position.lng() : Number(position.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
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
    const marker = createPlaceMarker(place, position);

    marker.addEventListener("gmp-click", () => openPlace(place));
    markers.set(place.id, marker);
    markerObjects.push(marker);
  }

  // Marker erst nach vollständiger Vorbereitung auf die Karte setzen.
  markerObjects.forEach(marker => { marker.map = map; });

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


function renderPlaceExtraDetails(place) {
  const details = [];

  if (place.openingHours) {
    details.push(`<div class="info-detail">🕒 ${escapeHtml(place.openingHours)}</div>`);
  }

  if (place.phone) {
    const safePhone = String(place.phone).replace(/[^\d+]/g, "");
    details.push(
      `<div class="info-detail">📞 <a href="tel:${safePhone}">${escapeHtml(place.phone)}</a></div>`
    );
  }

  if (place.website) {
    details.push(
      `<div class="info-detail">🌐 <a href="${escapeHtml(place.website)}" target="_blank" rel="noopener noreferrer">Website öffnen</a></div>`
    );
  }

  return details.length
    ? `<div class="info-extra-details">${details.join("")}</div>`
    : "";
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
        ${saved.plannedDay && saved.plannedOrder ? ` · #${escapeHtml(saved.plannedOrder)}` : ""}
      </div>
      <div>${escapeHtml(place.address || "")}</div>
      ${userPosition && distanceToPlace(place) != null
        ? `<div class="info-distance">📍 ${escapeHtml(formatDistance(distanceToPlace(place)))} Luftlinie entfernt</div>`
        : ""}
      ${saved.plannedDay && formatPlannedTime(saved)
        ? `<div class="info-time">🕐 ${escapeHtml(formatPlannedTime(saved))}</div>`
        : ""}
      ${place.notes ? `<div class="info-note">${escapeHtml(place.notes)}</div>` : ""}
      ${plannedTimeEditorHtml(place, saved)}
      ${renderPlaceExtraDetails(place)}
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

  infoWindow.close();
  infoWindow.setContent(html);
  infoWindow.open({ map, anchor: marker });

  const markerPosition = getMarkerPosition(marker);
  if (markerPosition) map.panTo(markerPosition);
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
  resetGooglePlaceSelection();
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
      source: selectedGooglePlace ? "googlePlaces" : "localStorage",
      isLocalPlace: true,
      googlePlaceId: selectedGooglePlace?.id || "",
      website: selectedGooglePlace?.websiteURI || "",
      phone: selectedGooglePlace?.nationalPhoneNumber || "",
      openingHours: googleOpeningHoursText(selectedGooglePlace),
      createdAt: new Date().toISOString()
    };

    let position = null;

    if (selectedGooglePlace?.location) {
      position = {
        lat: selectedGooglePlace.location.lat(),
        lng: selectedGooglePlace.location.lng()
      };
    } else {
      position = await geocodePlaceWithRetry(draft);
    }

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

    const marker = createPlaceMarker(draft, position, map);

    marker.addEventListener("gmp-click", () => openPlace(draft));
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

  const previousDay = (state.places[id] || {}).plannedDay || "";

  const marker = markers.get(id);
  if (marker) marker.map = null;
  markers.delete(id);

  const localPlaces = loadLocalPlaces().filter(item => item.id !== id);
  saveLocalPlaces(localPlaces);

  placesData.places = placesData.places.filter(item => item.id !== id);
  delete state.places[id];
  if (previousDay) normalizeDayOrder(previousDay);
  saveState();

  applyFilters();

  if (activeRouteDay === previousDay) {
    const routePlaces = getRoutePlacesForDay(previousDay);
    if (routePlaces.length >= 2) showDayRoute(previousDay);
    else clearDayRoute();
  } else {
    updateRouteControls();
  }

  infoWindow.close();
  setStatus(`„${place.name}“ wurde gelöscht.`);
}



function getPlacesForDay(dayId) {
  return placesData.places
    .filter(place => (state.places[place.id] || {}).plannedDay === dayId)
    .sort((a, b) => {
      const orderA = Number((state.places[a.id] || {}).plannedOrder) || Number.MAX_SAFE_INTEGER;
      const orderB = Number((state.places[b.id] || {}).plannedOrder) || Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
}

function ensureDayOrders() {
  let changed = false;

  for (const day of TRIP_DAYS) {
    const dayPlaces = placesData.places.filter(
      place => (state.places[place.id] || {}).plannedDay === day.id
    );

    const withOrder = dayPlaces
      .filter(place => Number.isFinite(Number((state.places[place.id] || {}).plannedOrder)))
      .sort((a, b) =>
        Number((state.places[a.id] || {}).plannedOrder) -
        Number((state.places[b.id] || {}).plannedOrder)
      );

    const withoutOrder = dayPlaces.filter(
      place => !Number.isFinite(Number((state.places[place.id] || {}).plannedOrder))
    );

    const ordered = [...withOrder, ...withoutOrder];

    ordered.forEach((place, index) => {
      const item = ensurePlaceState(place.id);
      const desiredOrder = index + 1;
      if (item.plannedOrder !== desiredOrder) {
        item.plannedOrder = desiredOrder;
        changed = true;
      }
    });
  }

  if (changed) saveState();
}

function normalizeDayOrder(dayId) {
  if (!dayId) return;

  const dayPlaces = placesData.places
    .filter(place => (state.places[place.id] || {}).plannedDay === dayId)
    .sort((a, b) => {
      const orderA = Number((state.places[a.id] || {}).plannedOrder) || Number.MAX_SAFE_INTEGER;
      const orderB = Number((state.places[b.id] || {}).plannedOrder) || Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });

  dayPlaces.forEach((place, index) => {
    ensurePlaceState(place.id).plannedOrder = index + 1;
  });
}

function nextOrderForDay(dayId) {
  const orders = placesData.places
    .filter(place => (state.places[place.id] || {}).plannedDay === dayId)
    .map(place => Number((state.places[place.id] || {}).plannedOrder) || 0);

  return (orders.length ? Math.max(...orders) : 0) + 1;
}

function movePlaceInDay(id, direction) {
  const item = state.places[id] || {};
  const dayId = item.plannedDay;

  if (!dayId) return;

  normalizeDayOrder(dayId);

  const dayPlaces = getPlacesForDay(dayId);
  const currentIndex = dayPlaces.findIndex(place => place.id === id);
  if (currentIndex < 0) return;

  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= dayPlaces.length) return;

  const currentPlace = dayPlaces[currentIndex];
  const targetPlace = dayPlaces[targetIndex];

  const currentState = ensurePlaceState(currentPlace.id);
  const targetState = ensurePlaceState(targetPlace.id);

  const oldOrder = currentState.plannedOrder;
  currentState.plannedOrder = targetState.plannedOrder;
  targetState.plannedOrder = oldOrder;

  normalizeDayOrder(dayId);
  saveState();
  applyFilters();

  if (activeRouteDay === dayId) {
    showDayRoute(dayId);
  } else {
    updateRouteControls();
  }

  setStatus(
    `Reihenfolge für ${dayLongLabel(dayId)} aktualisiert.`
  );
}

function orderControlsHtml(place, saved) {
  if (!saved.plannedDay || selectedDayFilter !== saved.plannedDay) return "";

  const dayPlaces = getPlacesForDay(saved.plannedDay);
  const index = dayPlaces.findIndex(item => item.id === place.id);
  if (index < 0) return "";

  const canMoveUp = index > 0;
  const canMoveDown = index < dayPlaces.length - 1;

  return `
    <div class="order-controls" onclick="event.stopPropagation()">
      <span class="order-number" title="Reihenfolge">${index + 1}</span>
      <button
        type="button"
        class="order-button"
        title="Nach oben"
        ${canMoveUp ? "" : "disabled"}
        onclick="event.stopPropagation(); movePlaceInDay('${place.id}', -1)"
      >↑</button>
      <button
        type="button"
        class="order-button"
        title="Nach unten"
        ${canMoveDown ? "" : "disabled"}
        onclick="event.stopPropagation(); movePlaceInDay('${place.id}', 1)"
      >↓</button>
    </div>
  `;
}


function normalizeTimeValue(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const match = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1]}:${match[2]}` : "";
}

function formatPlannedTime(saved) {
  const start = normalizeTimeValue(saved.startTime || "");
  const end = normalizeTimeValue(saved.endTime || "");

  if (start && end) return `${start}–${end}`;
  if (start) return start;
  if (end) return `bis ${end}`;
  return "";
}

function setPlannedTime(id, startTime, endTime) {
  const item = ensurePlaceState(id);

  const normalizedStart = normalizeTimeValue(startTime);
  const normalizedEnd = normalizeTimeValue(endTime);

  if (startTime && !normalizedStart) {
    setStatus("Ungültige Startzeit. Bitte HH:MM verwenden.");
    return false;
  }

  if (endTime && !normalizedEnd) {
    setStatus("Ungültige Endzeit. Bitte HH:MM verwenden.");
    return false;
  }

  if (normalizedStart && normalizedEnd && normalizedEnd < normalizedStart) {
    setStatus("Die Endzeit darf nicht vor der Startzeit liegen.");
    return false;
  }

  if (normalizedStart) item.startTime = normalizedStart;
  else delete item.startTime;

  if (normalizedEnd) item.endTime = normalizedEnd;
  else delete item.endTime;

  saveState();
  applyFilters();

  const place = placesData.places.find(p => p.id === id);
  if (place) openPlace(place);

  const formatted = formatPlannedTime(item);
  setStatus(
    formatted
      ? `Zeit für „${place?.name || "Ort"}“ gespeichert: ${formatted}.`
      : `Zeitangabe für „${place?.name || "Ort"}“ entfernt.`
  );

  return true;
}

function clearPlannedTime(id) {
  const item = ensurePlaceState(id);
  delete item.startTime;
  delete item.endTime;
  saveState();
  applyFilters();

  const place = placesData.places.find(p => p.id === id);
  if (place) openPlace(place);

  setStatus(`Zeitangabe für „${place?.name || "Ort"}“ entfernt.`);
}

function plannedTimeEditorHtml(place, saved) {
  if (!saved.plannedDay) {
    return `
      <div class="time-editor time-editor-disabled">
        <div class="time-editor-title">🕐 Uhrzeit</div>
        <div class="time-editor-hint">Zuerst einen Reisetag auswählen.</div>
      </div>
    `;
  }

  const start = normalizeTimeValue(saved.startTime || "");
  const end = normalizeTimeValue(saved.endTime || "");

  return `
    <div class="time-editor">
      <div class="time-editor-title">🕐 Uhrzeit / Zeitfenster</div>
      <div class="time-editor-row">
        <label>
          <span>Von</span>
          <input id="startTime-${place.id}" type="time" value="${escapeHtml(start)}" />
        </label>
        <label>
          <span>Bis</span>
          <input id="endTime-${place.id}" type="time" value="${escapeHtml(end)}" />
        </label>
      </div>
      <div class="time-editor-actions">
        <button
          type="button"
          onclick="setPlannedTime(
            '${place.id}',
            document.getElementById('startTime-${place.id}').value,
            document.getElementById('endTime-${place.id}').value
          )"
        >Zeit speichern</button>
        ${(start || end)
          ? `<button type="button" class="secondary-time-button" onclick="clearPlannedTime('${place.id}')">Entfernen</button>`
          : ""}
      </div>
    </div>
  `;
}


async function ensureRoutesLibrary() {
  if (RouteClass) return RouteClass;

  const routesLibrary = await google.maps.importLibrary("routes");
  RouteClass = routesLibrary.Route;

  if (!RouteClass) {
    throw new Error("Google Routes Library konnte nicht geladen werden.");
  }

  return RouteClass;
}

function clearRenderedRoute() {
  dayRoutePolylines.forEach(polyline => polyline.setMap(null));
  dayRoutePolylines = [];
  activeRouteSummary = null;
}

function formatRouteDistance(distanceMeters) {
  const meters = Number(distanceMeters);
  if (!Number.isFinite(meters)) return "";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

function formatRouteDuration(durationMillis) {
  const millis = Number(durationMillis);
  if (!Number.isFinite(millis)) return "";
  const totalMinutes = Math.round(millis / 60000);
  if (totalMinutes < 60) return `${totalMinutes} Min.`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} Std. ${minutes} Min.` : `${hours} Std.`;
}

function routeErrorMessage(error) {
  const message = String(error?.message || error || "");
  if (/CURRENT_LOCATION_REQUIRED/i.test(message)) {
    return "Bitte zuerst „📍 Mein Standort“ aktivieren oder als Startpunkt „Erster geplanter Ort“ auswählen.";
  }

  if (/REQUEST_DENIED|ApiNotActivated|not activated|permission|403/i.test(message)) {
    return "Die Route konnte nicht berechnet werden. Prüfe in der Google Cloud Console, ob die Routes API aktiviert und für deinen API-Key freigegeben ist.";
  }
  if (/ZERO_RESULTS|no route|keine route|not found/i.test(message)) {
    return "Zwischen den geplanten Orten konnte keine passende Fußroute berechnet werden.";
  }
  return `Die Route konnte nicht berechnet werden: ${message || "Unbekannter Fehler"}`;
}

function getSelectedTripDay() {
  return TRIP_DAYS.find(day => day.id === selectedDayFilter) || null;
}

function getRoutePlacesForDay(dayId) {
  return getPlacesForDay(dayId)
    .map(place => {
      const marker = markers.get(place.id);
      const position = getMarkerPosition(marker);
      return position ? { place, position } : null;
    })
    .filter(Boolean);
}

function clearDayRoute() {
  clearRenderedRoute();
  activeRouteDay = null;
  routeLoading = false;
  updateRouteControls();
}


function getRouteStartMode() {
  const select = document.getElementById("routeStartMode");
  return select?.value || routeStartMode || "planned";
}

function setRouteStartMode(value) {
  routeStartMode = value === "current" ? "current" : "planned";

  if (activeRouteDay) {
    clearRenderedRoute();
    activeRouteDay = null;
    activeRouteSummary = null;
    setStatus("Startpunkt geändert. Route bitte neu berechnen.");
  }

  updateRouteControls();
}

function buildRouteRequestPoints(routePlaces) {
  if (getRouteStartMode() === "current") {
    if (!userPosition) {
      throw new Error("CURRENT_LOCATION_REQUIRED");
    }

    return {
      origin: { lat: userPosition.lat, lng: userPosition.lng },
      destination: routePlaces[routePlaces.length - 1].position,
      intermediates: routePlaces.slice(0, -1).map(item => ({
        location: item.position
      }))
    };
  }

  return {
    origin: routePlaces[0].position,
    destination: routePlaces[routePlaces.length - 1].position,
    intermediates: routePlaces.slice(1, -1).map(item => ({
      location: item.position
    }))
  };
}

async function showDayRoute(dayId = selectedDayFilter) {
  const day = TRIP_DAYS.find(item => item.id === dayId);

  if (!day) {
    setStatus("Bitte zuerst einen konkreten Reisetag auswählen.");
    return;
  }

  const routePlaces = getRoutePlacesForDay(dayId);

  if (routePlaces.length < 2) {
    setStatus(`Für ${day.label} werden mindestens zwei geplante Orte benötigt.`);
    return;
  }

  // 25 intermediate waypoints + start + destination.
  if (routePlaces.length > 27) {
    setStatus("Eine Tagesroute kann maximal 27 Orte enthalten (Start, Ziel und bis zu 25 Zwischenstopps).");
    return;
  }

  routeLoading = true;
  updateRouteControls();
  setStatus(`Fußroute für ${day.label} wird berechnet …`);

  try {
    const Route = await ensureRoutesLibrary();
    const { origin, destination, intermediates } = buildRouteRequestPoints(routePlaces);

    const request = {
      origin,
      destination,
      travelMode: "WALKING",
      intermediates,
      fields: ["path", "distanceMeters", "durationMillis"]
    };

    const { routes } = await Route.computeRoutes(request);
    if (!routes?.length) throw new Error("Keine Route gefunden.");

    const route = routes[0];
    clearRenderedRoute();

    dayRoutePolylines = route.createPolylines({
      polylineOptions: {
        strokeColor: "#2f625d",
        strokeOpacity: 0.95,
        strokeWeight: 6,
        zIndex: 10
      }
    });
    dayRoutePolylines.forEach(polyline => polyline.setMap(map));

    activeRouteDay = dayId;
    activeRouteSummary = {
      distanceMeters: route.distanceMeters,
      durationMillis: route.durationMillis,
      placeCount: routePlaces.length
    };

    if (route.path?.length) {
      const bounds = new google.maps.LatLngBounds();
      route.path.forEach(point => bounds.extend(point));
      map.fitBounds(bounds, 70);
    }

    const distanceText = formatRouteDistance(route.distanceMeters);
    const durationText = formatRouteDuration(route.durationMillis);
    setStatus(`Fußroute für ${day.label}: ${distanceText || "Distanz unbekannt"} · ${durationText || "Dauer unbekannt"}.`);
  } catch (error) {
    console.error("Routes API:", error);
    clearRenderedRoute();
    activeRouteDay = null;
    setStatus(routeErrorMessage(error));
  } finally {
    routeLoading = false;
    updateRouteControls();
  }
}

async function toggleDayRoute() {
  if (routeLoading) return;

  if (activeRouteDay === selectedDayFilter && dayRoutePolylines.length) {
    clearDayRoute();
    setStatus("Tagesroute ausgeblendet.");

    if (isMobileLayout()) {
      setMobileView("map");
    }
    return;
  }

  await showDayRoute(selectedDayFilter);

  // Auf dem Smartphone nach erfolgreichem Ein-/Ausblenden
  // direkt zurück zur Karte wechseln.
  if (isMobileLayout()) {
    setMobileView("map");
  }
}

function openDayRouteInGoogleMaps(dayId = selectedDayFilter) {
  const day = TRIP_DAYS.find(item => item.id === dayId);
  if (!day) {
    setStatus("Bitte zuerst einen konkreten Reisetag auswählen.");
    return;
  }

  const routePlaces = getRoutePlacesForDay(dayId);
  if (routePlaces.length < 2) {
    setStatus(`Für ${day.label} werden mindestens zwei geplante Orte benötigt.`);
    return;
  }

  let originPosition;
  const destinationPosition = routePlaces[routePlaces.length - 1].position;
  let waypointPositions;

  if (getRouteStartMode() === "current") {
    if (!userPosition) {
      setStatus("Bitte zuerst „📍 Mein Standort“ aktivieren.");
      return;
    }

    originPosition = { lat: userPosition.lat, lng: userPosition.lng };
    waypointPositions = routePlaces.slice(0, -1).map(item => item.position);
  } else {
    originPosition = routePlaces[0].position;
    waypointPositions = routePlaces.slice(1, -1).map(item => item.position);
  }

  const params = new URLSearchParams({
    api: "1",
    origin: `${originPosition.lat},${originPosition.lng}`,
    destination: `${destinationPosition.lat},${destinationPosition.lng}`,
    travelmode: "walking"
  });

  if (waypointPositions.length) {
    params.set(
      "waypoints",
      waypointPositions.map(item => `${item.lat},${item.lng}`).join("|")
    );
  }

  window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener");
  setStatus(`Route für ${day.label} wird in Google Maps geöffnet.`);
}

function updateRouteControls() {
  const routeButton = document.getElementById("routeToggleBtn");
  const googleButton = document.getElementById("routeGoogleBtn");
  const info = document.getElementById("routeInfo");
  if (!routeButton || !googleButton || !info) return;

  const day = getSelectedTripDay();
  if (!day) {
    routeButton.disabled = true;
    googleButton.disabled = true;
    routeButton.textContent = "🚶 Fußroute anzeigen";
    info.textContent = "Wähle einen Reisetag aus.";
    return;
  }

  const routePlaces = getRoutePlacesForDay(day.id);
  const enoughPlaces = routePlaces.length >= 2;
  routeButton.disabled = !enoughPlaces || routeLoading;
  googleButton.disabled = !enoughPlaces || routeLoading;

  const routeIsActive = activeRouteDay === day.id && dayRoutePolylines.length > 0;
  if (routeLoading) routeButton.textContent = "⏳ Route wird berechnet …";
  else routeButton.textContent = routeIsActive ? "🚶 Route ausblenden" : "🚶 Fußroute anzeigen";

  const startMode = getRouteStartMode();
  const startLabel =
    startMode === "current"
      ? (userPosition ? "Start: aktueller Standort" : "Start: aktueller Standort (noch nicht aktiv)")
      : "Start: erster geplanter Ort";

  if (!enoughPlaces) {
    info.textContent = `${day.short}: mindestens 2 geplante Orte erforderlich.`;
  } else if (routeIsActive && activeRouteSummary) {
    info.textContent =
      `${day.short}: ${routePlaces.length} Orte · ${startLabel} · 🚶 ${formatRouteDistance(activeRouteSummary.distanceMeters)} · ca. ${formatRouteDuration(activeRouteSummary.durationMillis)}`;
  } else {
    info.textContent = `${day.short}: ${routePlaces.length} Orte · ${startLabel}.`;
  }
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

      if (activeRouteDay && activeRouteDay !== selectedDayFilter) {
        clearDayRoute();
      }

      applyFilters();
      updateRouteControls();

      // Auf dem Smartphone nach Auswahl eines konkreten Reisetages
      // direkt zurück zur Karte wechseln.
      if (isMobileLayout() && TRIP_DAYS.some(day => day.id === selectedDayFilter)) {
        setMobileView("map");
      }
    });

    container.appendChild(button);
  }

  updateDayCounts();
  updateRouteControls();
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
  const previousDay = item.plannedDay || "";

  if (dayId) {
    if (previousDay !== dayId) {
      item.plannedDay = dayId;
      item.plannedOrder = nextOrderForDay(dayId);
      delete item.startTime;
      delete item.endTime;
    } else if (!item.plannedOrder) {
      item.plannedOrder = nextOrderForDay(dayId);
    }
  } else {
    delete item.plannedDay;
    delete item.plannedOrder;
    delete item.startTime;
    delete item.endTime;
  }

  if (previousDay && previousDay !== dayId) {
    normalizeDayOrder(previousDay);
  }
  if (dayId) {
    normalizeDayOrder(dayId);
  }

  saveState();
  updateDayCounts();
  applyFilters();

  if (activeRouteDay && (activeRouteDay === previousDay || activeRouteDay === dayId)) {
    const routePlaces = getRoutePlacesForDay(activeRouteDay);
    if (routePlaces.length >= 2) showDayRoute(activeRouteDay);
    else clearDayRoute();
  } else {
    updateRouteControls();
  }

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
      updateRouteControls();
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

      if (isMobileLayout()) {
        setMobileView("map");
      }
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
    const locationPin = new PinElement({
      glyphText: "●",
      glyphColor: "#ffffff",
      background: "#2563eb",
      borderColor: "#ffffff",
      scale: 1.15
    });

    userLocationMarker = new AdvancedMarkerElement({
      map,
      position: userPosition,
      title: "Mein Standort",
      zIndex: 9999
    });

    userLocationMarker.append(locationPin);
  } else {
    userLocationMarker.position = userPosition;
    userLocationMarker.map = map;
  }
}

function distanceToPlace(place) {
  if (!userPosition) return null;

  const marker = markers.get(place.id);
  if (!marker) return null;

  const pos = getMarkerPosition(marker);
  if (!pos) return null;

  return haversineDistanceKm(
    userPosition.lat,
    userPosition.lng,
    pos.lat,
    pos.lng
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



function haversineDistanceMeters(a, b) {
  const earthRadius = 6371000;
  const toRad = value => value * Math.PI / 180;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const deltaLat = toRad(b.lat - a.lat);
  const deltaLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function estimatedWalkingMinutes(distanceMeters) {
  // Nur kompakte Agenda-Schätzung; die echte Route nutzt weiterhin Google Routes.
  return Math.max(1, Math.round(distanceMeters / 80));
}

function getAgendaLegs(dayPlaces) {
  const legs = [];
  let totalDistance = 0;
  let totalMinutes = 0;

  for (let index = 0; index < dayPlaces.length - 1; index++) {
    const from = dayPlaces[index];
    const to = dayPlaces[index + 1];

    if (!from.position || !to.position) {
      legs.push(null);
      continue;
    }

    const distanceMeters = haversineDistanceMeters(from.position, to.position);
    const minutes = estimatedWalkingMinutes(distanceMeters);
    totalDistance += distanceMeters;
    totalMinutes += minutes;
    legs.push({ distanceMeters, minutes });
  }

  return { legs, totalDistance, totalMinutes };
}


function getTripDayForDate(date = new Date()) {
  const localIso = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");

  return TRIP_DAYS.find(day => day.id === localIso) || null;
}

function selectToday() {
  const today = getTripDayForDate();

  if (!today) {
    const first = TRIP_DAYS[0];
    const last = TRIP_DAYS[TRIP_DAYS.length - 1];
    setStatus(`Heute liegt außerhalb der Reise (${formatDate(first.id)}–${formatDate(last.id)}).`);
    return;
  }

  selectedDayFilter = today.id;
  applyFilters();
  renderDayFilters();
  renderDayAgenda();
  refreshAllMarkerAppearances();

  if (isMobileLayout()) {
    setMobileView("map");
  }

  setStatus(`Heute: ${today.label} ausgewählt.`);
}


function getActivePlanningDay() {
  if (selectedDayFilter && selectedDayFilter !== "all" && selectedDayFilter !== "unplanned") {
    return TRIP_DAYS.find(day => day.id === selectedDayFilter) || null;
  }
  return getTripDayForDate();
}

function getRemainingUnvisitedPlaces(dayId) {
  // Exakt dieselbe Reihenfolge wie Tagesagenda/Marker.
  return getPlacesForDay(dayId).filter(place => {
    const saved = state.places[place.id] || {};
    return !saved.visited;
  });
}

function getNextUnvisitedPlace(dayId) {
  return getRemainingUnvisitedPlaces(dayId)[0] || null;
}

async function showNextPlace() {
  const day = getActivePlanningDay();

  if (!day) {
    setStatus("Bitte zuerst einen Reisetag auswählen.");
    return;
  }

  const remainingPlaces = getRemainingUnvisitedPlaces(day.id);
  const nextPlace = remainingPlaces[0] || null;

  if (!nextPlace) {
    clearRenderedRoute();
    activeRouteDay = null;
    activeRouteSummary = null;
    updateRouteControls();
    setStatus(`🎉 Alle Orte für ${day.label} wurden bereits besucht.`);
    return;
  }

  if (!userPosition) {
    setStatus("Für die Route wird dein aktueller Standort benötigt. Bitte zuerst „Standort aktualisieren“ verwenden.");
    return;
  }

  const destinations = remainingPlaces
    .map(place => {
      const marker = markers.get(place.id);
      const position = marker ? getMarkerPosition(marker) : null;
      return position ? { place, position } : null;
    })
    .filter(Boolean);

  if (!destinations.length) {
    setStatus("Für die offenen Programmpunkte sind noch keine Marker verfügbar.");
    return;
  }

  selectedDayFilter = day.id;
  applyFilters();
  renderDayFilters();
  renderDayAgenda();
  refreshAllMarkerAppearances();

  routeLoading = true;
  updateRouteControls();
  setStatus(`Restliche Tagesroute ab aktuellem Standort wird berechnet …`);

  try {
    const Route = await ensureRoutesLibrary();
    const routePoints = [
      { lat: userPosition.lat, lng: userPosition.lng },
      ...destinations.map(item => item.position)
    ];

    const routes = [];
    let totalDistanceMeters = 0;
    let totalDurationMillis = 0;

    // Wie bei der bestehenden Tagesroute segmentweise rechnen, damit die
    // Reihenfolge der Tagesagenda garantiert erhalten bleibt.
    for (let i = 0; i < routePoints.length - 1; i += 1) {
      const { routes: segmentRoutes } = await Route.computeRoutes({
        origin: routePoints[i],
        destination: routePoints[i + 1],
        travelMode: "WALKING",
        fields: ["path", "distanceMeters", "durationMillis"]
      });

      if (!segmentRoutes?.length) {
        throw new Error("Für einen Abschnitt wurde keine Fußroute gefunden.");
      }

      const segment = segmentRoutes[0];
      routes.push(segment);
      totalDistanceMeters += segment.distanceMeters || 0;
      totalDurationMillis += segment.durationMillis || 0;
    }

    clearRenderedRoute();

    const bounds = new google.maps.LatLngBounds();
    dayRoutePolylines = [];

    routes.forEach(route => {
      const polylines = route.createPolylines({
        polylineOptions: {
          strokeColor: "#2f625d",
          strokeOpacity: 0.95,
          strokeWeight: 6,
          zIndex: 10
        }
      });
      polylines.forEach(polyline => {
        polyline.setMap(map);
        dayRoutePolylines.push(polyline);
      });
      route.path?.forEach(point => bounds.extend(point));
    });

    activeRouteDay = null;
    activeRouteSummary = null;

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 70);
    }

    if (isMobileLayout()) {
      setMobileView("map");
    }

    window.setTimeout(() => openPlace(nextPlace), 180);

    setStatus(
      `🧭 Noch ${destinations.length} ${destinations.length === 1 ? "Ort" : "Orte"} · nächster: ${nextPlace.name} · ${formatRouteDistance(totalDistanceMeters)} · ${formatRouteDuration(totalDurationMillis)}`
    );
  } catch (error) {
    console.error("Routes API – restliche Tagesroute:", error);
    clearRenderedRoute();
    activeRouteDay = null;
    activeRouteSummary = null;
    setStatus(routeErrorMessage(error));
  } finally {
    routeLoading = false;
    updateRouteControls();
  }
}

function renderDayAgenda() {
  const container = document.getElementById("dayAgenda");
  if (!container) return;

  const selectedDay = TRIP_DAYS.find(day => day.id === selectedDayFilter);

  if (!selectedDay) {
    container.innerHTML = `
      <div class="agenda-empty">
        Wähle einen Reisetag aus, um die Tagesagenda zu sehen.
      </div>
    `;
    return;
  }

  const dayPlaces = getPlacesForDay(selectedDay.id);

  if (!dayPlaces.length) {
    container.innerHTML = `
      <div class="agenda-empty">
        Für ${escapeHtml(selectedDay.label)} sind noch keine Orte geplant.
      </div>
    `;
    return;
  }

  const { legs, totalDistance, totalMinutes } = getAgendaLegs(dayPlaces);

  const agendaHtml = dayPlaces.map((place, index) => {
    const saved = state.places[place.id] || {};
    const time = formatPlannedTime(saved);
    const distance = userPosition ? distanceToPlace(place) : null;
    const leg = legs[index];

    return `
      <div class="agenda-place-wrap">
        <div class="agenda-item ${saved.visited ? "agenda-item-visited" : ""}" data-place-id="${place.id}">
          <div class="agenda-order">${index + 1}</div>
          <div class="agenda-main">
            <div class="agenda-title">${CATEGORY_ICONS[place.category] || "•"} ${escapeHtml(place.name)}</div>
            <div class="agenda-meta">
              ${time ? `🕐 ${escapeHtml(time)}` : "🕐 keine Uhrzeit"}
              ${distance != null ? ` · 📍 ${escapeHtml(formatDistance(distance))}` : ""}
              ${saved.visited ? " · ✓ besucht" : ""}
            </div>
          </div>
          <button
            type="button"
            class="agenda-visited-button ${saved.visited ? "visited" : ""}"
            title="${saved.visited ? "Als nicht besucht markieren" : "Als besucht markieren"}"
            onclick="event.stopPropagation(); toggleVisited('${place.id}')"
          >${saved.visited ? "✓" : "○"}</button>
        </div>
        ${leg ? `
          <div class="agenda-leg">
            <span>↓</span>
            <span>ca. 🚶 ${escapeHtml(formatDistance(leg.distanceMeters))} · ${leg.minutes} Min.</span>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");

  container.innerHTML = `
    ${agendaHtml}
    <div class="agenda-summary">
      <strong>${dayPlaces.length} ${dayPlaces.length === 1 ? "Ort" : "Orte"}</strong>
      ${dayPlaces.length > 1
        ? `<span>ca. 🚶 ${escapeHtml(formatDistance(totalDistance))} · ${formatRouteDuration(totalMinutes * 60 * 1000)}</span>`
        : `<span>Noch keine Wegstrecke</span>`}
    </div>
    <div class="agenda-estimate-note">
      Wege in der Agenda sind Luftlinien-Schätzungen. Die genaue Fußroute wird über „Fußroute anzeigen“ berechnet.
    </div>
  `;

  container.querySelectorAll(".agenda-item").forEach(item => {
    item.addEventListener("click", () => {
      const place = placesData.places.find(p => p.id === item.dataset.placeId);
      if (!place) return;

      const marker = markers.get(place.id);
      if (marker) {
        openPlace(place);
        const pos = getMarkerPosition(marker);
        if (pos) {
          map.panTo(pos);
          map.setZoom(16);
        }
      }

      if (isMobileLayout()) setMobileView("map");
    });
  });
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
  } else if (TRIP_DAYS.some(day => day.id === selectedDayFilter)) {
    placesForDisplay.sort((a, b) => {
      const orderA = Number((state.places[a.id] || {}).plannedOrder) || Number.MAX_SAFE_INTEGER;
      const orderB = Number((state.places[b.id] || {}).plannedOrder) || Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
  }

  placesForDisplay.forEach(place => {
    const saved = state.places[place.id] || {};
    const card = document.createElement("div");
    card.className = "place-card";
    card.innerHTML = `
      <div class="place-card-title">
        <span class="place-card-name">${CATEGORY_ICONS[place.category] || "•"} ${escapeHtml(place.name)}</span>
        <span class="place-card-badges">${saved.plannedDay ? `🗓️ ${escapeHtml(dayShortLabel(saved.plannedDay))}` : ""}${place.localTip ? " ⭐" : ""}${place.isLocalPlace ? " 📌" : ""}</span>
      </div>
      ${orderControlsHtml(place, saved)}
      <div class="place-card-meta">
        ${escapeHtml(categoryLabel(place.category))}
        ${userPosition && distanceToPlace(place) != null ? ` · 📍 ${escapeHtml(formatDistance(distanceToPlace(place)))} entfernt` : ""}
        ${saved.plannedDay ? ` · 🗓️ ${escapeHtml(dayLongLabel(saved.plannedDay))}` : ""}
        ${saved.plannedDay && formatPlannedTime(saved) ? ` · 🕐 ${escapeHtml(formatPlannedTime(saved))}` : ""}
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



function getSearchMatches() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!query) return [];

  return placesData.places
    .filter(place => {
      const haystack = [
        place.name,
        place.address,
        place.notes,
        ...(place.tags || [])
      ].join(" ").toLowerCase();

      return haystack.includes(query);
    })
    .slice(0, 8);
}

function renderSearchSuggestions() {
  const container = document.getElementById("searchSuggestions");
  if (!container) return;

  const query = document.getElementById("searchInput").value.trim();

  if (!query) {
    container.innerHTML = "";
    container.classList.remove("visible");
    return;
  }

  const matches = getSearchMatches();

  if (!matches.length) {
    container.innerHTML = `
      <div class="search-suggestion-empty">Keine passenden Orte gefunden.</div>
    `;
    container.classList.add("visible");
    return;
  }

  container.innerHTML = matches.map(place => `
    <button
      type="button"
      class="search-suggestion-item"
      data-place-id="${place.id}"
    >
      <span class="search-suggestion-icon">${CATEGORY_ICONS[place.category] || "•"}</span>
      <span class="search-suggestion-content">
        <span class="search-suggestion-name">${escapeHtml(place.name)}</span>
        <span class="search-suggestion-meta">
          ${escapeHtml(categoryLabel(place.category))}
          ${place.address ? ` · ${escapeHtml(place.address)}` : ""}
        </span>
      </span>
      ${place.localTip ? '<span class="search-suggestion-tip">⭐</span>' : ""}
    </button>
  `).join("");

  container.classList.add("visible");

  container.querySelectorAll(".search-suggestion-item").forEach(button => {
    button.addEventListener("click", () => {
      const place = placesData.places.find(p => p.id === button.dataset.placeId);
      if (!place) return;

      document.getElementById("searchInput").value = place.name;
      renderSearchSuggestions();
      applyFilters();

      const marker = markers.get(place.id);
      if (!marker) return;

      const position = getMarkerPosition(marker);
      if (!position) return;

      if (isMobileLayout()) setMobileView("map");

      map.panTo(position);
      map.setZoom(Math.max(map.getZoom(), 16));

      window.setTimeout(() => {
        openPlace(place);
      }, 150);

      setStatus(`„${place.name}“ ausgewählt.`);
    });
  });
}

function hideSearchSuggestions() {
  const container = document.getElementById("searchSuggestions");
  if (!container) return;
  container.classList.remove("visible");
}

function getFilteredPlaces() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const localOnly = document.getElementById("localOnly").checked;
  const unvisitedOnly = document.getElementById("unvisitedOnly").checked;

  return placesData.places.filter(place => {
    const saved = state.places[place.id] || {};
    if (!activeCategories.has(place.category)) return false;
    if (localOnly && !place.localTip) return false;
    if (unvisitedOnly && saved.visited) return false;

    const plannedDay = saved.plannedDay || "";
    if (selectedDayFilter === "unplanned" && plannedDay) return false;
    if (selectedDayFilter !== "all" && selectedDayFilter !== "unplanned" && plannedDay !== selectedDayFilter) return false;

    if (query) {
      const haystack = [place.name, place.address, place.notes, ...(place.tags || [])]
        .join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

function focusSingleSearchResult() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) return;

  const filtered = getFilteredPlaces();
  if (filtered.length !== 1) return;

  const place = filtered[0];
  const marker = markers.get(place.id);
  if (!marker) return;

  const position = getMarkerPosition(marker);
  if (!position) return;

  if (isMobileLayout()) setMobileView("map");

  map.panTo(position);
  map.setZoom(Math.max(map.getZoom(), 16));
  window.setTimeout(() => openPlace(place), 180);
  setStatus(`Eindeutiger Treffer: „${place.name}“`);
}

function scheduleSmartSearch() {
  window.clearTimeout(searchDebounceTimer);
  searchDebounceTimer = window.setTimeout(focusSingleSearchResult, 500);
}

function applyFilters() {
  const filtered = getFilteredPlaces();

  const visibleIds = new Set(filtered.map(p => p.id));
  for (const [id, marker] of markers) {
    marker.map = visibleIds.has(id) ? map : null;
  }

  renderPlaceList(filtered);
  renderDayAgenda();
  refreshAllMarkerAppearances();
  updateDayCounts();
}

function fitVisibleMarkers() {
  const visible = [...markers.entries()]
    .filter(([, marker]) => marker.map === map)
    .map(([, marker]) => marker);

  if (!visible.length) return;

  const bounds = new google.maps.LatLngBounds();
  visible.forEach(marker => {
    const position = getMarkerPosition(marker);
    if (position) bounds.extend(position);
  });
  map.fitBounds(bounds, 60);
}


function buildBackupPayload() {
  return {
    app: "Budapest Map",
    backupVersion: 1,
    appVersion: "0.9.17",
    exportedAt: new Date().toISOString(),
    data: state,
    localPlaces: loadLocalPlaces(),
    placeDatabase: placesData?.places ? JSON.parse(JSON.stringify(placesData.places)) : []
  };
}

function exportBackup() {
  try {
    const blob = new Blob([JSON.stringify(buildBackupPayload(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `budapest-map-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("💾 Backup wurde exportiert.");
  } catch (error) {
    console.error("Backup-Export:", error);
    setStatus("Backup konnte nicht exportiert werden.");
  }
}

function validateBackupPayload(payload) {
  if (!payload || payload.app !== "Budapest Map" || payload.backupVersion !== 1) {
    throw new Error("Die Datei ist kein unterstütztes Budapest-Map-Backup.");
  }
  if (!payload.data || typeof payload.data !== "object" || !payload.data.places) {
    throw new Error("Im Backup fehlen Planungsdaten.");
  }
  return payload.data;
}

async function importBackupFile(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const importedState = validateBackupPayload(payload);
    if (!window.confirm("Backup importieren?\\n\\nDer lokale Stand auf diesem Gerät wird durch das Backup ersetzt.")) return;
    state = importedState;
    saveState();

    // Ab v0.9.17 erweitert: auch selbst gespeicherte Orte wiederherstellen.
    if (Array.isArray(payload.localPlaces)) {
      saveLocalPlaces(payload.localPlaces);
    } else if (Array.isArray(payload.placeDatabase)) {
      // Fallback: aus dem vollständigen Ortsbestand nur lokale/eigene Orte übernehmen.
      saveLocalPlaces(payload.placeDatabase.filter(place => place.isLocalPlace || place.source === "localStorage" || place.source === "googlePlaces"));
    }

    setStatus("📥 Backup inkl. gespeicherter Orte importiert. App wird neu geladen …");
    window.setTimeout(() => window.location.reload(), 400);
  } catch (error) {
    console.error("Backup-Import:", error);
    window.alert(`Backup konnte nicht importiert werden:\\n${error.message}`);
  }
}

function wireControls() {
  document.getElementById("exportBackupButton")?.addEventListener("click", exportBackup);
  document.getElementById("importBackupButton")?.addEventListener("click", () => document.getElementById("backupFileInput")?.click());
  document.getElementById("backupFileInput")?.addEventListener("change", async event => {
    await importBackupFile(event.target.files?.[0]);
    event.target.value = "";
  });
  document.getElementById("todayButton")?.addEventListener("click", selectToday);
  document.getElementById("nextPlaceButton")?.addEventListener("click", showNextPlace);
  document.getElementById("searchInput").addEventListener("input", () => {
    applyFilters();
    renderSearchSuggestions();
    scheduleSmartSearch();
  });

  document.getElementById("searchInput").addEventListener("focus", renderSearchSuggestions);
  document.getElementById("searchInput").addEventListener("blur", () => {
    window.setTimeout(hideSearchSuggestions, 180);
  });

  document.getElementById("searchInput").addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      window.clearTimeout(searchDebounceTimer);
      focusSingleSearchResult();
    }
  });
  document.getElementById("localOnly").addEventListener("change", applyFilters);
  document.getElementById("unvisitedOnly").addEventListener("change", applyFilters);
  document.getElementById("fitBtn").addEventListener("click", fitVisibleMarkers);
  document.getElementById("locateBtn").addEventListener("click", requestUserLocation);
  document.getElementById("distanceSortBtn").addEventListener("click", toggleDistanceSort);
  document.getElementById("routeToggleBtn").addEventListener("click", toggleDayRoute);
  document.getElementById("routeGoogleBtn").addEventListener("click", () => openDayRouteInGoogleMaps());
  document.getElementById("routeStartMode").addEventListener("change", event => setRouteStartMode(event.target.value));
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

  document.getElementById("mobileClose").addEventListener("click", () => setMobileView("map"));
  document.getElementById("mobileNavMap").addEventListener("click", () => setMobileView("map"));
  document.getElementById("mobileNavPlan").addEventListener("click", () => setMobileView("plan"));
  document.getElementById("mobileNavPlaces").addEventListener("click", () => setMobileView("places"));
  document.getElementById("mobileScrim").addEventListener("click", () => setMobileView("map"));
  document.getElementById("mobileLocateBtn").addEventListener("click", requestUserLocation);
  document.getElementById("budapestBtn").addEventListener("click", centerMapOnBudapest);

  updateDistanceControls();
  updateRouteControls();

  currentMobileView = "map";
  setMobileView("map");

  window.addEventListener("resize", () => {
    if (!isMobileLayout()) {
      setMobileView("map");
    } else if (map) {
      window.setTimeout(() => {
        google.maps.event.trigger(map, "resize");
      }, 100);
    }
  });

  window.addEventListener("orientationchange", () => {
    if (map) {
      window.setTimeout(() => {
        google.maps.event.trigger(map, "resize");
      }, 200);
    }
  });
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

function isMobileLayout() {
  return window.matchMedia("(max-width: 820px)").matches;
}

function setMobileView(view) {
  const normalizedView = ["map", "plan", "places"].includes(view) ? view : "map";
  const sidebar = document.querySelector(".sidebar");
  const scrim = document.getElementById("mobileScrim");

  if (!isMobileLayout()) {
    currentMobileView = "map";
    sidebar.classList.remove("open");
    document.querySelectorAll("[data-mobile-view]").forEach(element => {
      element.classList.remove("mobile-view-hidden");
    });
    return;
  }

  // Erneutes Antippen des bereits geöffneten Tabs schließt das Sheet.
  const targetView =
    normalizedView !== "map" && currentMobileView === normalizedView
      ? "map"
      : normalizedView;

  currentMobileView = targetView;

  // Beim Wechsel der mobilen Hauptansicht kein altes Marker-Popup stehen lassen.
  if (infoWindow && targetView !== "map") {
    infoWindow.close();
  }

  document.querySelectorAll(".mobile-nav-button").forEach(button => {
    button.classList.toggle("active", button.dataset.view === targetView);
  });

  document.querySelectorAll("[data-mobile-view]").forEach(element => {
    const elementView = element.dataset.mobileView;
    element.classList.toggle(
      "mobile-view-hidden",
      targetView === "map" || elementView !== targetView
    );
  });

  const showSheet = targetView !== "map";
  sidebar.classList.toggle("open", showSheet);
  document.body.classList.toggle("mobile-sheet-open", showSheet);

  if (scrim) {
    scrim.classList.toggle("visible", showSheet);
    scrim.setAttribute("aria-hidden", showSheet ? "false" : "true");
  }

  if (showSheet) {
    sidebar.scrollTop = 0;
  }

  if (map) {
    window.setTimeout(() => {
      google.maps.event.trigger(map, "resize");
    }, 100);
  }
}

function closeMobileSidebar() {
  setMobileView("map");
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
  scheduleSupabasePlanningSync();
}

function scheduleSupabasePlanningSync() {
  if (suppressSupabaseSync || !supabaseClient || !currentUser || !currentTripId) return;
  window.clearTimeout(supabaseSyncTimer);
  supabaseSyncTimer = window.setTimeout(syncPlanningToSupabase, 250);
}

function normalizeDbTime(value) {
  if (!value) return null;
  return /^\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
}

async function syncPlanningToSupabase() {
  if (supabaseSyncInProgress) {
    supabaseSyncQueued = true;
    return;
  }

  supabaseSyncInProgress = true;
  try {
    const dayIdByDate = new Map(currentTripDays.map(day => [day.day_date, day.id]));
    const rows = placesData.places
      .filter(place => place.supabaseId)
      .map(place => {
        const saved = state.places[place.id] || {};
        return {
          trip_id: currentTripId,
          place_id: place.supabaseId,
          trip_day_id: saved.plannedDay ? (dayIdByDate.get(saved.plannedDay) || null) : null,
          planned_order: Number.isInteger(saved.plannedOrder) ? saved.plannedOrder : null,
          planned_time: normalizeDbTime(saved.startTime),
          planned_end_time: normalizeDbTime(saved.endTime),
          visited: Boolean(saved.visited),
          updated_at: new Date().toISOString()
        };
      });

    if (!rows.length) return;

    const { error } = await supabaseClient
      .from("trip_places")
      .upsert(rows, { onConflict: "trip_id,place_id" });

    if (error) throw error;
    setStatus("☁️ Planung synchronisiert.");
  } catch (error) {
    console.error("Supabase-Synchronisation:", error);
    setStatus(`⚠️ Lokal gespeichert, Cloud-Synchronisation fehlgeschlagen: ${error.message}`);
  } finally {
    supabaseSyncInProgress = false;
    if (supabaseSyncQueued) {
      supabaseSyncQueued = false;
      scheduleSupabasePlanningSync();
    }
  }
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
window.setPlannedTime = setPlannedTime;
window.clearPlannedTime = clearPlannedTime;
window.movePlaceInDay = movePlaceInDay;
window.showDayRoute = showDayRoute;
window.clearDayRoute = clearDayRoute;
window.openDayRouteInGoogleMaps = openDayRouteInGoogleMaps;
window.setRouteStartMode = setRouteStartMode;
window.deleteLocalPlace = deleteLocalPlace;
