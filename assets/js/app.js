
const APP_VERSION = "v1.17.0";

function syncVersionLabels() {
  document.querySelectorAll(".app-version").forEach(el => { el.textContent = APP_VERSION; });
  const loginVersion = document.getElementById("loginVersion");
  if (loginVersion) loginVersion.textContent = APP_VERSION;
}


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
let realtimeChannel = null;
let realtimeRefreshTimer = null;
let editingPlaceId = null;
let tryItems = [];
let editingTryItemId = null;
let activities = [];
let activityMarkers = new Map();
let editingActivityId = null;
let activityPlaceAutocompleteElement = null;
let selectedActivityGooglePlace = null;

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
let navigationWatchId = null;
let navigationActive = false;
let navigationRoute = null;
let navigationSteps = [];
let navigationStepIndex = 0;
let navigationStops = [];
let navigationFinalTarget = null;
let navigationTestMode = false;
let navigationTestTarget = null;
let navigationPickListener = null;
let navigationPolylines = [];
let navigationTravelledPolyline = null;
let navigationPathMetrics = null;
let navigationHeading = null;
let navigationFollowMode = true;
let navigationOffRouteSamples = 0;
let navigationLastRerouteAt = 0;
let navigationRerouteInProgress = false;
let navigationArrived = false;
let navigationOrientationHandler = null;
let navigationLastPosition = null;
let navigationHeadingUp = true;
let navigationLastDynamicZoom = null;
let navigationTotalStops = 0;
let navigationCompletedStops = 0;
let navigationArrivalStop = null;
let navigationPausedAtStop = false;
let navigationArrivalSamples = 0;
let navigationMaxProgress = 0;
let navigationLastOffRouteDistance = null;
let navigationMovingAwaySamples = 0;
let navigationProgrammaticZoom = false;
let navigationExpanded = false;
let navigationWakeLock = null;
let navigationResumeInProgress = false;
let navigationPaused = false;
let navigationOnline = navigator.onLine !== false;
let navigationLastPositionAt = 0;
let navigationLastAccuracy = Infinity;
const NAV_CACHED_POSITION_MAX_AGE_MS = 60000;
const NAV_CACHED_POSITION_MAX_ACCURACY = 50;
const NAV_SESSION_STORAGE_KEY = "budapestActiveNavigation";
const LAST_LOCATION_STORAGE_KEY = "budapestLastKnownLocation";
const LAST_LOCATION_MAX_AGE_MS = 30 * 60 * 1000;
const NAV_OFF_ROUTE_METERS = 45;
const NAV_OFF_ROUTE_SAMPLES = 3;
const NAV_REROUTE_COOLDOWN_MS = 15000;
const NAV_TARGET_REACHED_METERS = 30;
const NAV_TARGET_REACHED_SAMPLES = 2;
const NAV_MAX_ARRIVAL_ACCURACY = 35;
const NAV_MAX_REROUTE_ACCURACY = 40;
const NAV_STEP_PASS_TOLERANCE_METERS = 8;
let routeStartMode = "planned";
let todayRouteClickMode = "planned";
let todayRouteTargetId = null;
let currentMobileView = "map";
let lastFocusedPlaceId = null;
let activeInfoPlaceId = null;
let searchDebounceTimer = null;
let startupLocationPromise = null;
let googleMapsLoadPromise = null;
let startupLocationCentered = false;
let startupLocationRefineStarted = false;
let startupAutoCenterCancelled = false;

let map;
let geocoder;
let infoWindow;
let placesData;
let markers = new Map();
let placeMarkerClusterer = null;
let activeCategories = new Set();
let state = loadState();

document.addEventListener("DOMContentLoaded", () => {
  // v1.14.8: Standort parallel zum restlichen App-Start anfordern.
  // Eine schnelle/gecachte Position kann dadurch schon vor der Karte vorliegen.
  startupLocationPromise = requestStartupLocation();
  // v1.14.9: Google Maps sofort parallel zu Auth/Supabase laden.
  googleMapsLoadPromise = loadGoogleMaps();
  bootstrapAuth();
});
document.addEventListener("visibilitychange", handleNavigationVisibilityChange);
window.addEventListener("online", handleNavigationOnline);
window.addEventListener("offline", handleNavigationOffline);
window.setTimeout(updateNavigationConnectivityUi, 0);
window.addEventListener("pagehide", () => { if (navigationActive) saveNavigationSession(); });


function storeKnownPosition(position) {
  if (!position?.coords) return null;
  userPosition = { lat: position.coords.latitude, lng: position.coords.longitude };
  navigationLastPositionAt = Date.now();
  navigationLastAccuracy = Number(position.coords.accuracy) || Infinity;
  window.__navigationLastAccuracy = Number(position.coords.accuracy) || 0;
  try {
    localStorage.setItem(LAST_LOCATION_STORAGE_KEY, JSON.stringify({
      lat: userPosition.lat,
      lng: userPosition.lng,
      accuracy: Number(position.coords.accuracy) || null,
      timestamp: Number(position.timestamp) || Date.now()
    }));
  } catch (error) {
    console.debug("Standort konnte nicht lokal gespeichert werden.", error);
  }
  return userPosition;
}

function loadLastKnownLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_LOCATION_STORAGE_KEY) || "null");
    if (!saved || !Number.isFinite(saved.lat) || !Number.isFinite(saved.lng)) return null;
    const timestamp = Number(saved.timestamp) || 0;
    if (!timestamp || Date.now() - timestamp > LAST_LOCATION_MAX_AGE_MS) return null;
    return saved;
  } catch (error) {
    return null;
  }
}

function applySavedStartupLocation() {
  const saved = loadLastKnownLocation();
  if (!saved || !map) return false;
  userPosition = { lat: saved.lat, lng: saved.lng };
  navigationLastPositionAt = Number(saved.timestamp) || Date.now();
  navigationLastAccuracy = Number(saved.accuracy) || Infinity;
  window.__navigationLastAccuracy = Number(saved.accuracy) || 0;
  updateUserLocationMarker();
  updateDistanceControls();
  updateRouteControls();
  applyFilters();
  map.setCenter(userPosition);
  if (map.getZoom() < 14) map.setZoom(14);
  startupLocationCentered = true;
  return true;
}

function requestStartupLocation() {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      position => resolve(position),
      () => resolve(null),
      // v1.14.10: Mobile Browser benötigen für den ersten Fix häufig länger.
      // Cache bleibt erlaubt, aber die Abfrage wird nicht mehr nach 2,5 s verworfen.
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

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
  if (realtimeChannel) {
    await supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  await supabaseClient.auth.signOut();
  window.location.reload();
}

async function enterAuthenticatedApp(user) {
  currentUser = user;
  document.getElementById("authGate").classList.add("is-hidden");
  await bootstrap();
  subscribeToTripRealtime();
}


function subscribeToTripRealtime() {
  if (!supabaseClient || !currentTripId) return;
  if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);

  const queueFullRefresh = () => {
    window.clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = window.setTimeout(refreshTripPlacesFromSupabase, 220);
  };
  realtimeChannel = supabaseClient
    .channel(`trip-planning-${currentTripId}`)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "trip_places"
    }, queueFullRefresh)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "places"
    }, queueFullRefresh)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "trip_try_items", filter: `trip_id=eq.${currentTripId}`
    }, () => refreshTryItemsFromSupabase())
    .on("postgres_changes", {
      event: "*", schema: "public", table: "trip_activities", filter: `trip_id=eq.${currentTripId}`
    }, () => refreshActivitiesFromSupabase())
    .subscribe(status => {
      if (status === "SUBSCRIBED") setStatus("🟢 Live-Synchronisation aktiv.");
    });
}

async function refreshTripPlacesFromSupabase() {
  try {
    suppressSupabaseSync = true;
    const remote = await loadSupabaseTripData();
    for (const marker of markers.values()) marker.map = null;
    markers.clear();
    placesData.places = remote.places;
    await createMarkers();
    createActivityMarkers();
    applyFilters();
    updateDistanceControls();
    updateRouteControls();
    setStatus("⚡ Orte und Planung live aktualisiert.");
  } catch (error) {
    console.error("Live-Ortsaktualisierung:", error);
    setStatus(`⚠️ Live-Aktualisierung fehlgeschlagen: ${error.message}`);
  } finally {
    suppressSupabaseSync = false;
  }
}

async function refreshPlanningFromSupabase() {
  if (!supabaseClient || !currentTripId) return;
  try {
    const { data: rows, error } = await supabaseClient
      .from("trip_places")
      .select("place_id,trip_day_id,planned_order,planned_time,planned_end_time,visited")
      .eq("trip_id", currentTripId);
    if (error) throw error;

    const dayById = new Map(currentTripDays.map(day => [day.id, day.day_date]));
    const relationByPlaceId = new Map(rows.map(row => [row.place_id, row]));

    suppressSupabaseSync = true;
    for (const place of placesData.places) {
      if (!place.supabaseId) continue;
      const relation = relationByPlaceId.get(place.supabaseId);
      const saved = ensurePlaceState(place.id);

      if (!relation) {
        delete saved.plannedDay;
        delete saved.plannedOrder;
        delete saved.startTime;
        delete saved.endTime;
        saved.visited = false;
        continue;
      }

      saved.visited = Boolean(relation.visited);
      if (relation.trip_day_id) saved.plannedDay = dayById.get(relation.trip_day_id) || null;
      else delete saved.plannedDay;
      if (relation.planned_order != null) saved.plannedOrder = relation.planned_order;
      else delete saved.plannedOrder;
      if (relation.planned_time) saved.startTime = relation.planned_time.slice(0, 5);
      else delete saved.startTime;
      if (relation.planned_end_time) saved.endTime = relation.planned_end_time.slice(0, 5);
      else delete saved.endTime;
    }

    localStorage.setItem("budapestMapState", JSON.stringify(state));
    applyFilters();
    updateDistanceControls();
    updateRouteControls();
    setStatus("⚡ Planung live aktualisiert.");
  } catch (error) {
    console.error("Realtime-Aktualisierung:", error);
    setStatus(`⚠️ Live-Aktualisierung fehlgeschlagen: ${error.message}`);
  } finally {
    suppressSupabaseSync = false;
  }
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

  const convertedPlaces = dbPlaces.filter(place => tpByPlaceId.has(place.id)).map(place => {
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
      lat: place.latitude == null ? null : Number(place.latitude),
      lng: place.longitude == null ? null : Number(place.longitude),
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

async function loadTryItemsFromSupabase() {
  if (!supabaseClient || !currentTripId) return [];
  const { data, error } = await supabaseClient
    .from("trip_try_items")
    .select("id,trip_id,name,category,note,tried,created_by,created_at,updated_at")
    .eq("trip_id", currentTripId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function seedLegacyTryItemsIfNeeded() {
  if (tryItems.length || !currentTripId) return;
  const legacy = window.BUDAPEST_PLACES_DATA?.tryInBudapest || [];
  if (!legacy.length) return;
  const rows = legacy.map(item => ({
    trip_id: currentTripId,
    name: item.name,
    category: "food",
    note: item.notes || null,
    tried: Boolean(item.done)
  }));
  const { data, error } = await supabaseClient.from("trip_try_items").insert(rows).select();
  if (error) throw error;
  tryItems = data || [];
}

async function refreshTryItemsFromSupabase() {
  try {
    tryItems = await loadTryItemsFromSupabase();
    activities = await loadActivitiesFromSupabase();
    renderTryListFresh();
  } catch (error) {
    console.error("Probierliste live aktualisieren:", error);
  }
}

function tryCategoryLabel(category) {
  return category === "drink" ? "🥤 Getränk" : category === "other" ? "✨ Sonstiges" : "🍴 Essen";
}

function renderTryList() {
  const container = document.getElementById("tryList");
  if (!container) return;
  container.innerHTML = "";
  const triedCount = tryItems.filter(item => item.tried).length;
  const summary = document.createElement("div");
  summary.className = "try-summary";
  summary.innerHTML = `<div><strong>${triedCount} von ${tryItems.length}</strong> probiert</div><button id="addTryItemBtn" class="secondary-button compact-button" type="button">＋ Hinzufügen</button>`;
  container.appendChild(summary);
  const progress = document.createElement("div");
  progress.className = "try-progress";
  progress.innerHTML = `<span style="width:${tryItems.length ? Math.round(triedCount / tryItems.length * 100) : 0}%"></span>`;
  container.appendChild(progress);
  document.getElementById("addTryItemBtn")?.addEventListener("click", () => openTryItemDialog());

  if (!tryItems.length) {
    const empty = document.createElement("div");
    empty.className = "try-empty";
    empty.textContent = "Noch nichts vorgemerkt.";
    container.appendChild(empty);
    return;
  }

  for (const item of tryItems) {
    const row = document.createElement("div");
    row.className = `try-item${item.tried ? " is-tried" : ""}`;
    const main = document.createElement("label");
    main.className = "try-item-main";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.tried);
    checkbox.addEventListener("change", () => setTryItemTried(item.id, checkbox.checked));
    const text = document.createElement("span");
    text.className = "try-item-text";
    text.innerHTML = `<strong>${escapeHtml(item.name)}</strong><small>${tryCategoryLabel(item.category)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</small>`;
    main.append(checkbox, text);
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "try-edit-button";
    edit.setAttribute("aria-label", `${item.name} bearbeiten`);
    edit.textContent = "✎";
    edit.addEventListener("click", () => openTryItemDialog(item));
    row.append(main, edit);
    container.appendChild(row);
  }
}

function openTryItemDialog(item = null) {
  editingTryItemId = item?.id || null;
  document.getElementById("tryDialogTitle").textContent = item ? "Eintrag bearbeiten" : "Zum Probieren hinzufügen";
  document.getElementById("tryItemName").value = item?.name || "";
  document.getElementById("tryItemCategory").value = item?.category || "food";
  document.getElementById("tryItemNote").value = item?.note || "";
  document.getElementById("tryItemTried").checked = Boolean(item?.tried);
  document.getElementById("deleteTryItemBtn").hidden = !item;
  document.getElementById("tryFormMessage").textContent = "";
  const dialog = document.getElementById("tryItemDialog");
  if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  window.setTimeout(() => document.getElementById("tryItemName")?.focus(), 30);
}

function closeTryItemDialog() {
  const dialog = document.getElementById("tryItemDialog");
  if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
  editingTryItemId = null;
}

async function handleTryItemSubmit(event) {
  event.preventDefault();
  const name = document.getElementById("tryItemName").value.trim();
  if (!name) return;
  const payload = {
    trip_id: currentTripId,
    name,
    category: document.getElementById("tryItemCategory").value,
    note: document.getElementById("tryItemNote").value.trim() || null,
    tried: document.getElementById("tryItemTried").checked,
    updated_at: new Date().toISOString()
  };
  const button = document.getElementById("saveTryItemBtn");
  button.disabled = true;
  try {
    const result = editingTryItemId
      ? await supabaseClient.from("trip_try_items").update(payload).eq("id", editingTryItemId).eq("trip_id", currentTripId)
      : await supabaseClient.from("trip_try_items").insert(payload);
    if (result.error) throw result.error;
    closeTryItemDialog();
    await refreshTryItemsFromSupabase();
    setStatus(`✓ „${name}“ gespeichert.`);
  } catch (error) {
    document.getElementById("tryFormMessage").textContent = `Speichern fehlgeschlagen: ${error.message}`;
  } finally { button.disabled = false; }
}

async function setTryItemTried(id, tried) {
  const old = tryItems.find(item => item.id === id);
  if (old) old.tried = tried;
  renderTryListFresh();
  const { error } = await supabaseClient.from("trip_try_items").update({ tried, updated_at: new Date().toISOString() }).eq("id", id).eq("trip_id", currentTripId);
  if (error) {
    if (old) old.tried = !tried;
    renderTryListFresh();
    setStatus(`⚠️ Status konnte nicht gespeichert werden: ${error.message}`);
  }
}

async function deleteTryItem() {
  if (!editingTryItemId) return;
  const item = tryItems.find(row => row.id === editingTryItemId);
  if (!window.confirm(`„${item?.name || "Eintrag"}“ wirklich löschen?`)) return;
  const { error } = await supabaseClient.from("trip_try_items").delete().eq("id", editingTryItemId).eq("trip_id", currentTripId);
  if (error) {
    document.getElementById("tryFormMessage").textContent = `Löschen fehlgeschlagen: ${error.message}`;
    return;
  }
  closeTryItemDialog();
  await refreshTryItemsFromSupabase();
  setStatus("🗑️ Eintrag gelöscht.");
}

async function bootstrap() {
  try {
    if (!window.BUDAPEST_PLACES_DATA) {
      throw new Error("Lokale Metadaten konnten nicht geladen werden.");
    }

    const remote = await loadSupabaseTripData();
    tryItems = await loadTryItemsFromSupabase();
    activities = await loadActivitiesFromSupabase();
    await seedLegacyTryItemsIfNeeded();
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

    await (googleMapsLoadPromise || loadGoogleMaps());
    initMap();
    await createMarkers();
    createActivityMarkers();
    applyFilters();

    // Eine aktive Navigation kann einen App-/Tab-Wechsel oder ein erneutes
    // Laden überstehen. Erst nach geladener Karte/Routes Library fortsetzen.
    const savedNavigation = loadNavigationSession();
    if (savedNavigation) await resumeNavigationSession(savedNavigation, { announce: false });

    suppressSupabaseSync = false;
    setStatus(`☁️ ${placesData.places.length} Orte aus Supabase geladen · Synchronisation aktiv.`);
  } catch (err) {
    console.error(err);
    setStatus(`Fehler: ${err.message}`);
  }
}

function loadGoogleMaps() {
  // Mehrfache Aufrufe während des parallelen Starts teilen sich denselben Ladevorgang.
  if (googleMapsLoadPromise) return googleMapsLoadPromise;
  googleMapsLoadPromise = new Promise((resolve, reject) => {
    if (!CONFIG.googleMapsApiKey) {
      reject(new Error("Google Maps API-Key fehlt in app.js."));
      return;
    }

    window.__initBudapestMap = async () => {
      try {
        // v1.14.8: Beim normalen App-Start nur die Marker-Bibliothek laden.
        // Die Routes Library wird erst bei einer tatsächlichen Routenberechnung
        // über ensureRoutesLibrary() nachgeladen.
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
  return googleMapsLoadPromise;
}


function centerMapOnBudapest() {
  if (!map) return;
  // v1.14.13: Eine bewusste Kartenauswahl darf nicht durch einen noch
  // laufenden Standort-Fix des App-Starts wieder überschrieben werden.
  startupAutoCenterCancelled = true;
  startupLocationCentered = true;
  map.setCenter(CONFIG.initialCenter);
  map.setZoom(CONFIG.initialZoom);
  setStatus("Karte auf Budapest zentriert.");
}

function centerMapOnCurrentLocation({ silent = false, highAccuracy = true, recenter = true, startupFix = false } = {}) {
  if (!navigator.geolocation) {
    if (!silent) setStatus("Standortbestimmung wird von diesem Browser nicht unterstützt.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      storeKnownPosition(position);

      updateUserLocationMarker();
      updateDistanceControls();
      updateRouteControls();
      applyFilters();
      // Beim App-Start muss der erste erfolgreiche GPS-Fix die Karte auch dann
      // zentrieren, wenn die schnelle Vorab-Abfrage auf Android leer blieb.
      const shouldRecenter = !startupAutoCenterCancelled && (recenter || (startupFix && !startupLocationCentered));
      if (shouldRecenter) {
        map.panTo(userPosition);
        if (map.getZoom() < 14) map.setZoom(14);
        if (startupFix) startupLocationCentered = true;
      }

      if (!silent) setStatus("Karte auf deinen aktuellen Standort zentriert.");
    },
    () => {
      if (!silent) setStatus("Standort nicht verfügbar. Karte bleibt auf Budapest.");
    },
    { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 8000 : 2500, maximumAge: highAccuracy ? 60000 : 300000 }
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

      // First check the locally loaded trip data, then ask Supabase through a
      // SECURITY DEFINER helper. The server-side check is important on mobile/
      // secondary accounts because RLS can hide a central places row from a
      // direct SELECT even though the unique Google Place ID already exists.
      let existingPlace = placesData?.places?.find(item =>
        item.googlePlaceId && String(item.googlePlaceId).trim() === String(place.id).trim()
      ) || null;
      let existingPlaceStatus = existingPlace ? { exists: true, in_trip: true, place_id: existingPlace.supabaseId, place_name: existingPlace.name } : null;
      if (!existingPlace && supabaseClient && currentTripId) {
        try {
          const { data: status, error: statusError } = await supabaseClient.rpc("get_google_place_status", {
            p_trip_id: currentTripId,
            p_google_place_id: String(place.id).trim()
          });
          if (statusError) throw statusError;
          existingPlaceStatus = status || null;
          if (status?.in_trip) {
            existingPlace = placesData?.places?.find(item => item.supabaseId === status.place_id) || {
              supabaseId: status.place_id,
              name: status.place_name || place.displayName,
              address: place.formattedAddress || ""
            };
          }
        } catch (statusError) {
          console.warn("Status des Google-Orts konnte nicht geprüft werden:", statusError);
        }
      }
      const isAlreadyInTrip = Boolean(existingPlaceStatus?.in_trip || existingPlace);
      const existsInDatabase = Boolean(existingPlaceStatus?.exists);
      const selection = document.getElementById("googlePlaceSelection");
      const saveButton = document.getElementById("savePlaceBtn");
      selection.hidden = false;
      selection.classList.toggle("is-existing", isAlreadyInTrip || existsInDatabase);
      selection.innerHTML = isAlreadyInTrip
        ? `<div class="existing-place-icon" aria-hidden="true">✓</div>
           <div class="existing-place-copy">
             <strong>Ort bereits vorhanden</strong>
             <span class="existing-place-name">${escapeHtml(place.displayName || existingPlace?.name || "Google-Ort")}</span>
             <span>${escapeHtml(place.formattedAddress || existingPlace?.address || "")}</span>
             <span class="existing-place-hint">Dieser Ort ist bereits in deiner Budapest-Reise gespeichert.</span>
           </div>`
        : existsInDatabase
          ? `<div class="existing-place-icon" aria-hidden="true">↗</div>
             <div class="existing-place-copy">
               <strong>Ort bereits in der Datenbank</strong>
               <span class="existing-place-name">${escapeHtml(place.displayName || existingPlaceStatus?.place_name || "Google-Ort")}</span>
               <span>${escapeHtml(place.formattedAddress || "")}</span>
               <span class="existing-place-hint">Der Ort wird beim Speichern mit dieser Budapest-Reise verknüpft – es wird kein Duplikat angelegt.</span>
             </div>`
          : `<strong>✓ ${escapeHtml(place.displayName || "Google-Ort ausgewählt")}</strong>
             <span>${escapeHtml(place.formattedAddress || "")}</span>
             <span>Google-Daten werden beim Speichern automatisch übernommen.</span>`;
      if (saveButton) {
        saveButton.textContent = isAlreadyInTrip ? "Vorhandenen Ort anzeigen" : (existsInDatabase ? "Zur Reise hinzufügen" : "Ort speichern");
        saveButton.classList.toggle("existing-place-action", isAlreadyInTrip || existsInDatabase);
      }
    });
  } catch (error) {
    console.error("Google Places konnte nicht geladen werden:", error);
    host.innerHTML = '<div class="form-hint">Google-Ortssuche nicht verfügbar. Bitte den Ort manuell eingeben.</div>';
  }
}

function resetGooglePlaceSelection({ recreateAutocomplete = false } = {}) {
  selectedGooglePlace = null;
  const selection = document.getElementById("googlePlaceSelection");
  if (selection) {
    selection.hidden = true;
    selection.innerHTML = "";
    selection.classList.remove("is-existing");
  }
  const saveButton = document.getElementById("savePlaceBtn");
  if (saveButton && !editingPlaceId) {
    saveButton.textContent = "Ort speichern";
    saveButton.classList.remove("existing-place-action");
  }

  // PlaceAutocompleteElement keeps its own input state (especially noticeable
  // on mobile). Recreating it is the most reliable way to guarantee an empty
  // Google search whenever the add dialog is closed.
  if (recreateAutocomplete) {
    const host = document.getElementById("googlePlaceAutocomplete");
    if (googlePlaceAutocompleteElement) googlePlaceAutocompleteElement.remove();
    googlePlaceAutocompleteElement = null;
    if (host) host.innerHTML = "";
  } else if (googlePlaceAutocompleteElement) {
    try { googlePlaceAutocompleteElement.value = ""; } catch (_) {}
  }
}

function focusExistingPlaceOnMap(place, { openInfo = true } = {}) {
  if (!place || !map) return;

  const marker = markers.get(place.id);
  const position = marker
    ? getMarkerPosition(marker)
    : normalizeLatLng({ lat: place.lat, lng: place.lng });

  if (!position) {
    console.warn("Vorhandener Ort hat keine gültige Kartenposition:", place);
    if (openInfo) openPlace(place);
    return;
  }

  // Wenn derselbe Ort bereits auf der aktuellen Karte sichtbar ist, darf ein
  // erneuter Klick in der Orte-Liste die Karte nicht noch einmal zentrieren.
  // Sonst entsteht ein sichtbares "Springen", obwohl der Nutzer bereits am
  // richtigen Marker ist. Wurde die Karte zwischenzeitlich wegbewegt, greift
  // der normale Fokus weiterhin.
  const placeFocusId = place.id ?? place.supabaseId ?? place.googlePlaceId ?? null;
  const boundsBeforeViewChange = map.getBounds?.();
  const samePlaceStillVisible = Boolean(
    placeFocusId &&
    lastFocusedPlaceId === placeFocusId &&
    boundsBeforeViewChange?.contains?.(position)
  );

  // Bei einem Wechsel aus einem mobilen Sheet/Dialog darf Maps erst fokussiert
  // werden, wenn der Karten-Viewport wieder seine endgültige Größe hat.
  if (isMobileLayout() && currentMobileView !== "map") {
    setMobileView("map");
  }

  const sidebar = document.querySelector(".sidebar");
  let focusStarted = false;

  const doFocus = () => {
    if (focusStarted) return;
    focusStarted = true;

    google.maps.event.trigger(map, "resize");

    if (!samePlaceStillVisible) {
      // Für echte Ortswechsel (z. B. Deutschland -> Budapest) direkt setzen,
      // nicht animieren. So hängt das Ergebnis nicht vom bisherigen Viewport ab.
      map.setCenter(position);
      const currentZoom = Number(map.getZoom()) || 0;
      if (currentZoom < 16) map.setZoom(16);
    }

    if (placeFocusId) lastFocusedPlaceId = placeFocusId;
    if (!openInfo) return;

    // Ist genau dieses InfoWindow bereits geöffnet und der Marker weiterhin
    // sichtbar, gibt es nichts neu zu initialisieren. Insbesondere kein
    // close()/open(), weil Google Maps dabei den sichtbaren Fokusrahmen des
    // InfoWindow kurz entfernt und erneut setzt.
    if (samePlaceStillVisible && activeInfoPlaceId === placeFocusId) return;

    // Das InfoWindow erst öffnen, wenn der neue Mittelpunkt wirklich von Maps
    // übernommen wurde. Dessen eigene Korrektur bewegt die Karte anschließend
    // höchstens einmal minimal, falls das komplette Fenster am Rand läge.
    let opened = false;
    const openOnce = () => {
      if (opened) return;
      opened = true;
      openPlace(place);
    };
    google.maps.event.addListenerOnce(map, "idle", openOnce);
    window.setTimeout(openOnce, 450);
  };

  // Ist auf Mobil gerade ein Bottom-Sheet am Schließen, auf dessen echtes
  // transitionend warten statt mit mehreren setCenter-Aufrufen zu arbeiten.
  if (isMobileLayout() && sidebar?.classList.contains("open")) {
    const onTransitionEnd = event => {
      if (event.target !== sidebar || event.propertyName !== "transform") return;
      sidebar.removeEventListener("transitionend", onTransitionEnd);
      requestAnimationFrame(doFocus);
    };
    sidebar.addEventListener("transitionend", onTransitionEnd);
    // Fallback für Browser/Layouts ohne transitionend.
    window.setTimeout(() => {
      sidebar.removeEventListener("transitionend", onTransitionEnd);
      requestAnimationFrame(doFocus);
    }, 350);
  } else {
    requestAnimationFrame(() => requestAnimationFrame(doFocus));
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
    // Heading/Rotation funktioniert bei einer per <div> erzeugten Google Map
    // nur zuverlässig mit dem Vector-Renderer. Ohne diese Option verwendet
    // Maps JavaScript standardmäßig den Raster-Renderer.
    renderingType: google.maps.RenderingType.VECTOR,
    headingInteractionEnabled: true,
    tiltInteractionEnabled: false,
    // Auf mobilen Browsern verwendet Google Maps sonst teilweise den
    // kooperativen Gestenmodus (Karte erst mit zwei Fingern verschiebbar).
    // Für die In-App-Navigation soll ein Finger die Karte direkt bewegen.
    gestureHandling: "greedy",
    draggable: true,
    heading: 0,
    tilt: 0,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });

  // Diagnose/Fallback: Der Navigationsmodus darf Rotation nur auf einer
  // Vector Map erwarten. getRenderingType() ist nach dem Laden verfügbar.
  google.maps.event.addListenerOnce(map, "tilesloaded", () => {
    const renderingType = map.getRenderingType?.();
    console.info("Google Maps rendering type:", renderingType || "unbekannt");
  });

  geocoder = new google.maps.Geocoder();
  infoWindow = new google.maps.InfoWindow({ disableAutoPan: true });

  // Den aktuell geöffneten Ort separat merken. So können wiederholte Klicks
  // auf denselben Listeneintrag erkennen, dass das InfoWindow bereits offen ist.
  infoWindow.addListener("closeclick", () => {
    activeInfoPlaceId = null;
  });

  // Marker-Infofenster auch durch Tippen/Klicken auf die Karte schließen.
  map.addListener("click", () => {
    activeInfoPlaceId = null;
    infoWindow.close();
  });

  // v1.14.11: Zuerst den zuletzt bekannten Standort ohne Wartezeit anzeigen.
  // Der echte Browser-/GPS-Fix läuft parallel und korrigiert ihn anschließend.
  applySavedStartupLocation();

  Promise.resolve(startupLocationPromise).then(position => {
    if (position) {
      const start = storeKnownPosition(position);
      if (start && map) {
        updateUserLocationMarker();
        updateDistanceControls();
        updateRouteControls();
        applyFilters();
        const distanceFromShown = haversineDistanceMeters(map.getCenter()
          ? { lat: map.getCenter().lat(), lng: map.getCenter().lng() }
          : start, start);
        if (!startupLocationCentered || distanceFromShown > 250) {
          map.panTo(start);
          if (map.getZoom() < 14) map.setZoom(14);
        }
        startupLocationCentered = true;
      }
    }
    if (!startupLocationRefineStarted) {
      startupLocationRefineStarted = true;
      centerMapOnCurrentLocation({
        silent: true,
        highAccuracy: true,
        recenter: !startupLocationCentered,
        startupFix: true
      });
    }
  });
  initGooglePlaceAutocomplete();
  initActivityPlaceAutocomplete();
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
  const safePosition = normalizeLatLng(position);
  if (!safePosition) return null;
  const marker = new AdvancedMarkerElement({
    map: mapValue,
    position: safePosition,
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

function normalizeLatLng(value) {
  if (!value) return null;

  const rawLat = typeof value.lat === "function" ? value.lat() : value.lat;
  const rawLng = typeof value.lng === "function" ? value.lng() : value.lng;

  // Important: Number(null) and Number("") are 0. Missing database values
  // must therefore be rejected before numeric conversion.
  if (rawLat == null || rawLng == null || rawLat === "" || rawLng === "") return null;

  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  // Legacy import used 0/0 as a placeholder for unknown coordinates.
  if (lat === 0 && lng === 0) return null;

  return { lat, lng };
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
  let cacheMigrationCount = 0;
  let processed = 0;

  setStatus("Orte werden vorbereitet …");

  // Bereits bekannte oder im Browser gecachte Koordinaten sind sofort verfügbar.
  const needsGeocoding = [];

  for (const place of places) {
    // Supabase is authoritative. A stale browser cache must never override
    // coordinates already stored in the database.
    const databasePosition = normalizeLatLng({ lat: place.lat, lng: place.lng });
    const cachedPosition = databasePosition ? null : normalizeLatLng(getCachedPosition(place.id));
    const position = databasePosition || cachedPosition;

    if (position) {
      // Build 9 migration: if Supabase has no coordinates but this browser's
      // proven legacy cache does, copy those coordinates into Supabase once.
      if (!databasePosition && cachedPosition && place.supabaseId && supabaseClient) {
        const { error: cacheMigrationError } = await supabaseClient
          .from("places")
          .update({
            latitude: cachedPosition.lat,
            longitude: cachedPosition.lng,
            updated_at: new Date().toISOString()
          })
          .eq("id", place.supabaseId);

        if (cacheMigrationError) {
          console.warn("Cache-Koordinaten konnten nicht nach Supabase migriert werden:",
            place.name, cacheMigrationError);
        } else {
          cacheMigrationCount++;
        }
      }

      place.lat = position.lat;
      place.lng = position.lng;
      cachePosition(place.id, position);
      resolved.push({ place, position });
    } else if (place.googlePlaceId || canGeocode(place)) {
      needsGeocoding.push(place);
    }

    processed++;
  }

  // Fehlende Koordinaten in kleinen parallelen Gruppen auflösen.
  // Dadurch ist der erste Aufruf deutlich schneller, ohne den Geocoder mit
  // dutzenden gleichzeitigen Anfragen zu überlasten.
  const BATCH_SIZE = 2;

  for (let i = 0; i < needsGeocoding.length; i += BATCH_SIZE) {
    const batch = needsGeocoding.slice(i, i + BATCH_SIZE);

    setStatus(
      `Adressen werden aufgelöst: ${Math.min(i + BATCH_SIZE, needsGeocoding.length)} / ${needsGeocoding.length}`
    );

    const results = await Promise.all(
      batch.map(async place => {
        const position = place.googlePlaceId
          ? (await geocodePlaceIdWithRetry(place)) ||
            (canGeocode(place) ? await geocodePlaceWithRetry(place) : null)
          : await geocodePlaceWithRetry(place);

        if (position) {
          // Supabase is the authoritative store. Legacy places that still have
          // NULL coordinates are migrated as soon as Google resolves them.
          if (place.supabaseId && supabaseClient) {
            const { error: coordinateError } = await supabaseClient
              .from("places")
              .update({
                latitude: position.lat,
                longitude: position.lng,
                google_place_id: position.googlePlaceId || null,
                updated_at: new Date().toISOString()
              })
              .eq("id", place.supabaseId);

            if (coordinateError) {
              console.warn("Koordinaten konnten nicht in Supabase gespeichert werden:",
                place.name, coordinateError);
            }
          }

          cachePosition(place.id, position);

          // Also keep the current in-memory model in sync.
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
      await delay(300);
    }
  }

  // Erst jetzt werden die Marker erzeugt. Für den Benutzer erscheinen sie
  // dadurch praktisch gleichzeitig statt einzeln nacheinander.
  const markerObjects = [];

  for (const { place, position } of resolved) {
    const marker = createPlaceMarker(place, position);
    if (!marker) continue;

    marker.addEventListener("gmp-click", () => openPlace(place));
    markers.set(place.id, marker);
    markerObjects.push(marker);
  }

  // Marker erst nach vollständiger Vorbereitung auf die Karte setzen.
  markerObjects.forEach(marker => { marker.map = map; });

  if (cacheMigrationCount > 0 || geocodeCount > 0) {
    const parts = [];
    if (cacheMigrationCount > 0) parts.push(`${cacheMigrationCount} aus Browser-Cache nach Supabase migriert`);
    if (geocodeCount > 0) parts.push(`${geocodeCount} neu geocodiert`);
    setStatus(`${markerObjects.length} Orte geladen · ${parts.join(" · ")}.`);
  } else {
    setStatus(`${markerObjects.length} Orte geladen.`);
  }
}

function isPlausibleBudapestPosition(position) {
  const p = normalizeLatLng(position);
  return !!p && p.lat >= 47.3 && p.lat <= 47.7 && p.lng >= 18.8 && p.lng <= 19.4;
}

function geocodePlaceIdWithRetry(place, attempt = 0) {
  return new Promise(resolve => {
    if (!place.googlePlaceId) {
      resolve(null);
      return;
    }

    geocoder.geocode({ placeId: place.googlePlaceId }, async (results, status) => {
      if (status === "OK" && results?.length) {
        const result = results.find(item => {
          const loc = item.geometry?.location;
          return loc && isPlausibleBudapestPosition({ lat: loc.lat(), lng: loc.lng() });
        });

        if (result) {
          const loc = result.geometry.location;
          resolve({
            lat: loc.lat(),
            lng: loc.lng(),
            googlePlaceId: result.place_id || place.googlePlaceId
          });
          return;
        }

        console.warn("Place-ID außerhalb Budapest verworfen:", place.name);
        resolve(null);
        return;
      }

      if (status === "OVER_QUERY_LIMIT" && attempt < 4) {
        await delay(700 * (attempt + 1));
        resolve(await geocodePlaceIdWithRetry(place, attempt + 1));
        return;
      }

      console.warn("Place-ID konnte nicht aufgelöst werden:", place.name, status);
      resolve(null);
    });
  });
}

function geocodePlaceGlobally(place, attempt = 0) {
  return new Promise(resolve => {
    const query = [place.name, place.address].filter(Boolean).join(", ");
    geocoder.geocode({ address: query }, async (results, status) => {
      if (status === "OK" && results?.length) {
        const result = results[0];
        const loc = result.geometry?.location;
        if (loc) {
          resolve({
            lat: loc.lat(),
            lng: loc.lng(),
            googlePlaceId: result.place_id || place.googlePlaceId || null
          });
          return;
        }
      }
      if (status === "OVER_QUERY_LIMIT" && attempt < 4) {
        await delay(700 * (attempt + 1));
        resolve(await geocodePlaceGlobally(place, attempt + 1));
        return;
      }
      console.warn("Globales Geocoding fehlgeschlagen:", place.name, status);
      resolve(null);
    });
  });
}

function geocodePlaceWithRetry(place, attempt = 0) {
  return new Promise(resolve => {
    const query = [place.name, place.address, "Hungary"].filter(Boolean).join(", ");
    geocoder.geocode(
      { address: query, region: "HU", componentRestrictions: { country: "HU" } },
      async (results, status) => {
        if (status === "OK" && results?.length) {
          const result = results.find(item => {
            const loc = item.geometry?.location;
            return loc && isPlausibleBudapestPosition({ lat: loc.lat(), lng: loc.lng() });
          });
          if (result) {
            const loc = result.geometry.location;
            resolve({ lat: loc.lat(), lng: loc.lng(), googlePlaceId: result.place_id || null });
            return;
          }
          console.warn("Geocoding außerhalb Budapest verworfen:", place.name);
          resolve(null);
          return;
        }
        if (status === "OVER_QUERY_LIMIT" && attempt < 4) {
          await delay(700 * (attempt + 1));
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
  const address = String(place.address || "").trim();
  if (!address || address.includes("Ort noch unklar") || place.status === "needs_identification") return false;
  const normalized = address.toLowerCase().replace(/[.,]/g, "").trim();
  return normalized !== "budapest";
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

  const safeWebsiteUrl = getSafeWebsiteUrl(place.website);
  if (safeWebsiteUrl) {
    details.push(
      `<div class="info-detail">🌐 <a href="${escapeHtml(safeWebsiteUrl)}" target="_blank" rel="noopener noreferrer">Website öffnen</a></div>`
    );
  }

  return details.length
    ? `<div class="info-extra-details">${details.join("")}</div>`
    : "";
}

function openPlace(place) {
  const marker = markers.get(place.id);
  if (!marker) return;

  const placeFocusId = place.id ?? place.supabaseId ?? place.googlePlaceId ?? null;
  // openPlace kann auch aus anderen UI-Pfaden aufgerufen werden. Auch dort
  // dasselbe bereits geöffnete InfoWindow nicht unnötig neu aufbauen.
  if (placeFocusId && activeInfoPlaceId === placeFocusId) return;

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
        <select class="day-select" data-action="set-planned-day" data-place-id="${place.id}">
          ${dayOptionsHtml(saved.plannedDay || "")}
        </select>
        <button type="button" data-action="toggle-visited" data-place-id="${place.id}">${saved.visited ? "✓ Besucht" : "○ Als besucht markieren"}</button>
        <button type="button" data-action="edit-place" data-place-id="${place.id}">Bearbeiten</button>
        <button type="button" class="danger" data-action="remove-place" data-place-id="${place.id}">Aus Reise & Datenbank löschen</button>
      </div>
    </div>
  `;

  infoWindow.close();
  infoWindow.setContent(html);

  // Marker-Klicks dürfen die Karte nicht verschieben. disableAutoPan wird
  // bereits beim Erzeugen des InfoWindow gesetzt und hier vorsichtshalber erneut
  // beibehalten. Auch auf Mobilgeräten erfolgt kein eigenes panTo/panBy.
  infoWindow.setOptions({ disableAutoPan: true });

  // Google Maps rendert um unseren eigenen Inhalt noch einen separaten
  // InfoWindow-Container (.gm-style-iw-c). Erst dieser komplette Container
  // zeigt zuverlässig, ob das Fenster auf kleinen Displays abgeschnitten wird.
  google.maps.event.addListenerOnce(infoWindow, "domready", () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const content = document.querySelector(".info-window");
        const infoContainer = content?.closest(".gm-style-iw-c");
        const mapElement = document.getElementById("map");
        if (!infoContainer || !mapElement) return;

        const infoRect = infoContainer.getBoundingClientRect();
        const mapRect = mapElement.getBoundingClientRect();
        const padding = 12;

        const safeLeft = mapRect.left + padding;
        const safeRight = mapRect.right - padding;
        const safeTop = mapRect.top + padding;
        const safeBottom = mapRect.bottom - padding;

        // screenShift beschreibt, wohin das InfoWindow auf dem Bildschirm müsste.
        // panBy benötigt für diese visuelle Verschiebung jeweils das Gegenzeichen.
        let screenShiftX = 0;
        let screenShiftY = 0;

        if (infoRect.left < safeLeft) {
          screenShiftX = safeLeft - infoRect.left;
        } else if (infoRect.right > safeRight) {
          screenShiftX = safeRight - infoRect.right;
        }

        if (infoRect.top < safeTop) {
          screenShiftY = safeTop - infoRect.top;
        } else if (infoRect.bottom > safeBottom) {
          screenShiftY = safeBottom - infoRect.bottom;
        }

        // Kleine Rundungs-/Rendering-Abweichungen ignorieren. Dadurch bleibt die
        // Karte bei vollständig sichtbaren Markern wirklich exakt stehen.
        if (Math.abs(screenShiftX) > 2 || Math.abs(screenShiftY) > 2) {
          map.panBy(-screenShiftX, -screenShiftY);
        }
      });
    });
  });

  infoWindow.open({ map, anchor: marker });
  activeInfoPlaceId = placeFocusId;
}


function openAddPlaceDialog() {
  const dialog = document.getElementById("addPlaceDialog");
  const form = document.getElementById("addPlaceForm");
  editingPlaceId = null;
  form.reset();
  resetGooglePlaceSelection();
  document.getElementById("placeDialogTitle").textContent = "Ort hinzufügen";
  document.getElementById("savePlaceBtn").textContent = "Ort speichern";
  document.getElementById("placeCategory").value = "food";
  document.getElementById("placeTripDay").value = "";
  document.getElementById("placeFormMessage").textContent = "";
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function openEditPlaceDialog(id) {
  const place = placesData.places.find(p => p.id === id);
  if (!place) return;
  editingPlaceId = id;
  resetGooglePlaceSelection();
  document.getElementById("placeDialogTitle").textContent = "Ort bearbeiten";
  document.getElementById("savePlaceBtn").textContent = "Änderungen speichern";
  document.getElementById("placeName").value = place.name || "";
  document.getElementById("placeAddress").value = place.address || "";
  document.getElementById("placeCategory").value = place.category || "other";
  document.getElementById("placeNotes").value = place.notes || "";
  document.getElementById("placeLocalTip").checked = Boolean(place.localTip);
  document.getElementById("placeTripDay").value = (state.places[place.id] || {}).plannedDay || "";
  document.getElementById("placeFormMessage").textContent = "";
  const dialog = document.getElementById("addPlaceDialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeAddPlaceDialog() {
  const dialog = document.getElementById("addPlaceDialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");

  // Every close path (X, Abbrechen, Speichern, backdrop) must leave a clean
  // add dialog. In edit mode the fields are populated again on next open.
  document.getElementById("addPlaceForm")?.reset();
  document.getElementById("placeFormMessage").textContent = "";
  editingPlaceId = null;
  resetGooglePlaceSelection({ recreateAutocomplete: true });
  // Prepare a fresh Google search element for the next opening.
  initGooglePlaceAutocomplete();
  initActivityPlaceAutocomplete();
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
  const selectedTripDay = document.getElementById("placeTripDay").value;
  if (!name || !address) { message.textContent = "Bitte Name und Adresse eintragen."; return; }

  submitButton.disabled = true;
  message.textContent = "";
  try {
    if (editingPlaceId) {
      const place = placesData.places.find(p => p.id === editingPlaceId);
      if (!place?.supabaseId) throw new Error("Datenbank-ID des Ortes fehlt.");
      const marker = markers.get(place.id);
      let position = getMarkerPosition(marker) || {
        lat: Number(place.lat),
        lng: Number(place.lng)
      };
      if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) {
        position = await geocodePlaceGlobally({ name, address });
        if (!position) throw new Error("Die Position des Ortes konnte nicht ermittelt werden.");
      }
      const addressChanged = address !== place.address;
      if (addressChanged) {
        submitButton.textContent = "Adresse wird geprüft …";
        position = await geocodePlaceGlobally({ name, address });
        if (!position) throw new Error("Die neue Adresse konnte nicht gefunden werden.");
      }
      const { error } = await supabaseClient.from("places").update({
        name, address, latitude: position.lat, longitude: position.lng,
        category, note: notes || null, is_local_tip: localTip,
        updated_at: new Date().toISOString()
      }).eq("id", place.supabaseId);
      if (error) throw error;
      Object.assign(place, { name, address, lat: position.lat, lng: position.lng, category, notes, localTip });
      cachePosition(place.id, position);
      if (marker && addressChanged) {
        const safePosition = normalizeLatLng(position);
        if (safePosition) marker.position = safePosition;
      }
      refreshMarkerAppearance(place);
      applyFilters();
      closeAddPlaceDialog();
      openPlace(place);
      setStatus(`☁️ „${name}“ wurde gespeichert.`);
      return;
    }

    if (selectedGooglePlace?.id) {
      const googlePlaceId = String(selectedGooglePlace.id).trim();
      const duplicate = placesData.places.find(place =>
        place.googlePlaceId && String(place.googlePlaceId).trim() === googlePlaceId
      );
      if (duplicate) {
        message.textContent = `„${duplicate.name}“ ist bereits in dieser Reise gespeichert.`;
        closeAddPlaceDialog();
        focusExistingPlaceOnMap(duplicate);
        setStatus(`ℹ️ „${duplicate.name}“ ist bereits in dieser Reise vorhanden.`);
        return;
      }

      // A Google place can already exist in the central places table without
      // currently being linked to this trip (for example after an earlier
      // interrupted add operation). Reuse that row instead of violating the
      // global unique constraint on google_place_id.
      const { data: existingDbPlace, error: existingPlaceError } = await supabaseClient
        .from("places")
        .select("*")
        .eq("google_place_id", googlePlaceId)
        .maybeSingle();
      if (existingPlaceError) throw existingPlaceError;

      if (existingDbPlace) {
        const { data: existingRelation, error: relationLookupError } = await supabaseClient
          .from("trip_places")
          .select("id")
          .eq("trip_id", currentTripId)
          .eq("place_id", existingDbPlace.id)
          .maybeSingle();
        if (relationLookupError) throw relationLookupError;

        if (!existingRelation) {
          const selectedDbDay = selectedTripDay
            ? currentTripDays.find(day => day.day_date === selectedTripDay)
            : null;
          const nextOrder = selectedTripDay
            ? getPlacesForDay(selectedTripDay).length + 1
            : null;
          const { error: linkError } = await supabaseClient.from("trip_places").insert({
            trip_id: currentTripId,
            place_id: existingDbPlace.id,
            trip_day_id: selectedDbDay?.id || null,
            planned_order: nextOrder
          });
          if (linkError) throw linkError;
          await refreshTripPlacesFromSupabase();
          closeAddPlaceDialog();
          const linkedPlace = placesData.places.find(place => place.supabaseId === existingDbPlace.id);
          if (linkedPlace) focusExistingPlaceOnMap(linkedPlace);
          setStatus(`☁️ „${existingDbPlace.name}“ war bereits gespeichert und wurde dieser Reise hinzugefügt.`);
          return;
        }

        // Defensive fallback: if Realtime/local state was briefly stale, reload
        // the trip and open the already-linked place instead of inserting again.
        await refreshTripPlacesFromSupabase();
        closeAddPlaceDialog();
        const linkedPlace = placesData.places.find(place => place.supabaseId === existingDbPlace.id);
        if (linkedPlace) focusExistingPlaceOnMap(linkedPlace);
        setStatus(`ℹ️ „${existingDbPlace.name}“ ist bereits in dieser Reise vorhanden.`);
        return;
      }
    }

    submitButton.textContent = "Adresse wird geprüft …";
    let position = selectedGooglePlace?.location
      ? { lat: selectedGooglePlace.location.lat(), lng: selectedGooglePlace.location.lng() }
      : await geocodePlaceGlobally({ name, address });
    if (!position) throw new Error("Die Adresse konnte nicht gefunden werden.");

    const { data: dbPlace, error: placeError } = await supabaseClient.from("places").insert({
      name, address, latitude: position.lat, longitude: position.lng, category,
      google_place_id: selectedGooglePlace?.id || null,
      website: selectedGooglePlace?.websiteURI || null,
      phone: selectedGooglePlace?.nationalPhoneNumber || null,
      opening_hours: googleOpeningHoursText(selectedGooglePlace) || null,
      note: notes || null, is_local_tip: localTip,
      source: selectedGooglePlace ? "googlePlaces" : "manual"
    }).select("*").single();
    if (placeError) throw placeError;

    const selectedDbDay = selectedTripDay
      ? currentTripDays.find(day => day.day_date === selectedTripDay)
      : null;
    const nextOrder = selectedTripDay
      ? getPlacesForDay(selectedTripDay).length + 1
      : null;

    const { error: relationError } = await supabaseClient.from("trip_places").insert({
      trip_id: currentTripId,
      place_id: dbPlace.id,
      trip_day_id: selectedDbDay?.id || null,
      planned_order: nextOrder
    });
    if (relationError) {
      await supabaseClient.from("places").delete().eq("id", dbPlace.id);
      throw relationError;
    }

    const draft = {
      id: dbPlace.id, supabaseId: dbPlace.id, name: dbPlace.name, address: dbPlace.address,
      lat: Number(dbPlace.latitude), lng: Number(dbPlace.longitude), category: dbPlace.category || "other",
      tags: [], googlePlaceId: dbPlace.google_place_id, website: dbPlace.website,
      phone: dbPlace.phone, openingHours: dbPlace.opening_hours, notes: dbPlace.note,
      localTip: Boolean(dbPlace.is_local_tip), source: dbPlace.source
    };
    placesData.places.push(draft);
    if (selectedTripDay) {
      const ps = ensurePlaceState(draft.id);
      ps.plannedDay = selectedTripDay;
      ps.plannedOrder = nextOrder;
      ps.visited = false;
      localStorage.setItem("budapestMapState", JSON.stringify(state));
    }
    cachePosition(draft.id, position);
    const marker = createPlaceMarker(draft, position, map);
    marker.addEventListener("gmp-click", () => openPlace(draft));
    markers.set(draft.id, marker);
    activeCategories.add(draft.category);
    const cb = document.querySelector(`#categoryFilters input[value="${CSS.escape(draft.category)}"]`);
    if (cb) cb.checked = true;
    applyFilters(); updateToggleAllText(); closeAddPlaceDialog();
    map.panTo(position); map.setZoom(Math.max(map.getZoom(), 16)); openPlace(draft);
    setStatus(`☁️ „${draft.name}“ wurde zur Reise hinzugefügt.`);
  } catch (error) {
    console.error("Ort speichern:", error);
    if (error?.code === "23505" && String(error?.message || "").includes("places_google_place_id_unique") && selectedGooglePlace?.id) {
      // On another user's/mobile session RLS may intentionally hide an orphaned
      // central place row. The database helper can safely reuse it after
      // verifying membership of the current trip.
      const selectedDbDay = selectedTripDay
        ? currentTripDays.find(day => day.day_date === selectedTripDay)
        : null;
      const nextOrder = selectedTripDay ? getPlacesForDay(selectedTripDay).length + 1 : null;
      const { data: recovered, error: recoverError } = await supabaseClient.rpc("link_existing_google_place", {
        p_trip_id: currentTripId,
        p_google_place_id: String(selectedGooglePlace.id),
        p_trip_day_id: selectedDbDay?.id || null,
        p_planned_order: nextOrder
      });
      if (recoverError) {
        console.error("Vorhandenen Google-Ort verknüpfen:", recoverError);
        message.textContent = `Vorhandener Ort konnte nicht verknüpft werden: ${recoverError.message}`;
      } else {
        await refreshTripPlacesFromSupabase();
        const recoveredId = recovered?.place_id;
        closeAddPlaceDialog();
        const linkedPlace = placesData.places.find(place => place.supabaseId === recoveredId);
        if (linkedPlace) focusExistingPlaceOnMap(linkedPlace);
        setStatus(`☁️ „${recovered?.place_name || name}“ war bereits gespeichert und wurde dieser Reise hinzugefügt.`);
      }
    } else {
      message.textContent = `Speichern fehlgeschlagen: ${error.message}`;
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = editingPlaceId ? "Änderungen speichern" : "Ort speichern";
  }
}

async function removePlaceFromTrip(id) {
  const place = placesData.places.find(p => p.id === id);
  if (!place?.supabaseId || !currentTripId) return;
  if (!confirm(`„${place.name}“ wirklich löschen?\n\nDer Ort wird aus dieser Reise UND aus der Ortsdatenbank gelöscht.`)) return;

  const previousDay = (state.places[id] || {}).plannedDay || "";
  const { data, error } = await supabaseClient.rpc("delete_place_from_trip", {
    p_trip_id: currentTripId,
    p_place_id: place.supabaseId
  });
  if (error) {
    console.error("Ort vollständig löschen:", error);
    setStatus(`⚠️ Löschen fehlgeschlagen: ${error.message}`);
    return;
  }

  const marker = markers.get(id);
  if (marker) marker.map = null;
  markers.delete(id);
  placesData.places = placesData.places.filter(item => item.id !== id);
  delete state.places[id];
  localStorage.setItem("budapestMapState", JSON.stringify(state));
  if (previousDay) normalizeDayOrder(previousDay);
  applyFilters();
  updateRouteControls();
  infoWindow.close();

  const deletedFromDatabase = data?.deleted_from_database !== false;
  setStatus(deletedFromDatabase
    ? `☁️ „${place.name}“ wurde aus der Reise und der Datenbank gelöscht.`
    : `☁️ „${place.name}“ wurde aus dieser Reise entfernt. Der Ort wird noch von einer anderen Reise verwendet.`);
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
    <div class="order-controls" data-stop-place-click="true">
      <span class="order-number" title="Reihenfolge">${index + 1}</span>
      <button
        type="button"
        class="order-button"
        title="Nach oben"
        ${canMoveUp ? "" : "disabled"}
        data-action="move-place" data-place-id="${place.id}" data-direction="-1"
      >↑</button>
      <button
        type="button"
        class="order-button"
        title="Nach unten"
        ${canMoveDown ? "" : "disabled"}
        data-action="move-place" data-place-id="${place.id}" data-direction="1"
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
          data-action="save-planned-time"
          data-place-id="${place.id}"
        >Zeit speichern</button>
        ${(start || end)
          ? `<button type="button" class="secondary-time-button" data-action="clear-planned-time" data-place-id="${place.id}">Entfernen</button>`
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
    return "Bitte zuerst „📍 Mein Standort“ aktivieren oder als Startpunkt „Erster geplanter Stopp“ auswählen.";
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

function getRouteStopsForDay(dayDate) {
  // Frontend days use the ISO date (2026-10-04), while trip_activities stores
  // the UUID of trip_days. Resolve that relationship once here so agenda,
  // markers and both route buttons all work from the same day sequence.
  const dbDay = currentTripDays.find(day => day.day_date === dayDate || day.id === dayDate);
  const dbDayId = dbDay?.id || null;
  const normalizedDayDate = dbDay?.day_date || dayDate;

  const placeStops = getPlacesForDay(normalizedDayDate).map(place => {
    const marker = markers.get(place.id);
    const position = marker ? getMarkerPosition(marker) : normalizeLatLng({ lat: place.lat, lng: place.lng });
    const order = Number((state.places[place.id] || {}).plannedOrder) || Number.MAX_SAFE_INTEGER;
    const saved = state.places[place.id] || {};
    return position ? {
      type: "place", id: place.id, name: place.name, order, position, place,
      plannedDate: normalizedDayDate,
      plannedStartTime: saved.startTime || null,
      plannedEndTime: saved.endTime || null
    } : null;
  }).filter(Boolean);

  const activityStops = activities
    .filter(activity => dbDayId && activity.trip_day_id === dbDayId)
    .map(activity => {
      const marker = activityMarkers.get(activity.id);
      const position = marker ? getMarkerPosition(marker) : normalizeLatLng({ lat: activity.latitude, lng: activity.longitude });
      const order = Number(activity.planned_order) || Number.MAX_SAFE_INTEGER;
      return position ? {
        type: "activity",
        id: activity.id,
        name: activity.name,
        order,
        position,
        activity,
        plannedDate: normalizedDayDate,
        plannedStartTime: activity.start_time?.slice(0, 5) || null,
        plannedEndTime: activity.end_time?.slice(0, 5) || null
      } : null;
    })
    .filter(Boolean);

  return [...placeStops, ...activityStops].sort((a, b) => a.order - b.order);
}

// Backwards-compatible helper for code paths that explicitly need only visit places.
function getRoutePlacesForDay(dayId) {
  return getRouteStopsForDay(dayId).filter(stop => stop.type === "place");
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

async function ensureRouteOriginForSingleStop() {
  if (userPosition) return { lat: userPosition.lat, lng: userPosition.lng };
  if (!navigator.geolocation) throw new Error("CURRENT_LOCATION_REQUIRED");

  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    });
  });
  userPosition = { lat: position.coords.latitude, lng: position.coords.longitude };
  updateUserLocationMarker();
  updateDistanceControls();
  applyFilters();
  return { lat: userPosition.lat, lng: userPosition.lng };
}

function buildRouteRequestPoints(routeStops) {
  if (getRouteStartMode() === "current") {
    if (!userPosition) {
      throw new Error("CURRENT_LOCATION_REQUIRED");
    }

    return {
      origin: { lat: userPosition.lat, lng: userPosition.lng },
      destination: routeStops[routeStops.length - 1].position,
      intermediates: routeStops.slice(0, -1).map(item => ({
        location: item.position
      }))
    };
  }

  return {
    origin: routeStops[0].position,
    destination: routeStops[routeStops.length - 1].position,
    intermediates: routeStops.slice(1, -1).map(item => ({
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

  const routeStops = getRouteStopsForDay(dayId);

  if (!routeStops.length) {
    setStatus(`Für ${day.label} ist noch kein Routenstopp geplant.`);
    return;
  }

  // 25 intermediate waypoints + start + destination.
  if (routeStops.length > 27) {
    setStatus("Eine Tagesroute kann maximal 27 Stopps enthalten (Orte und Aktivitäten zusammen).");
    return;
  }

  // With one planned stop the selected start mode decides the behavior:
  // - planned: there is no route between planned stops, so only focus it.
  // - current: current position + the planned stop form a valid walking route.
  if (routeStops.length === 1 && getRouteStartMode() !== "current") {
    clearDayRoute();
    const stop = routeStops[0];
    if (stop.type === "activity" && stop.activity) {
      focusActivityOnMap(stop.activity);
    } else if (stop.type === "place" && stop.place) {
      focusExistingPlaceOnMap(stop.place);
    } else {
      if (isMobileLayout()) setMobileView("map");
      map.setCenter(stop.position);
      if ((Number(map.getZoom()) || 0) < 16) map.setZoom(16);
    }
    setStatus(`„${stop.name}“ wird auf der Karte angezeigt. Wähle „Mein aktueller Standort“, um die Fußroute dorthin zu berechnen.`);
    updateRouteControls();
    return;
  }

  if (routeStops.length === 1 && getRouteStartMode() === "current" && !userPosition) {
    try {
      await ensureRouteOriginForSingleStop();
    } catch (error) {
      console.error("Standort für Einzelstopp-Route:", error);
      setStatus("Aktueller Standort konnte nicht ermittelt werden. Bitte Standortfreigabe prüfen oder „📍 Mein Standort“ verwenden.");
      updateRouteControls();
      return;
    }
  }

  routeLoading = true;
  updateRouteControls();
  setStatus(`Fußroute für ${day.label} wird berechnet …`);

  try {
    const Route = await ensureRoutesLibrary();
    const { origin, destination, intermediates } = buildRouteRequestPoints(routeStops);

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
      placeCount: routeStops.length
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

  const routeStops = getRouteStopsForDay(dayId);
  if (!routeStops.length) {
    setStatus(`Für ${day.label} ist noch kein Routenstopp geplant.`);
    return;
  }

  // A single planned stop is only a route when the user explicitly chose
  // the current position as start. In planned mode it remains a map target.
  if (routeStops.length === 1) {
    if (getRouteStartMode() !== "current") {
      setStatus("Bei einem geplanten Stopp gibt es noch keine Tagesroute. Wähle „Mein aktueller Standort“, um dorthin zu navigieren.");
      return;
    }
    if (!userPosition) {
      setStatus("Bitte zuerst „📍 Mein Standort“ aktivieren.");
      return;
    }

    const destinationPosition = routeStops[0].position;
    const params = new URLSearchParams({
      api: "1",
      origin: `${userPosition.lat},${userPosition.lng}`,
      destination: `${destinationPosition.lat},${destinationPosition.lng}`,
      travelmode: "walking"
    });
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener");
    setStatus(`Route von deinem aktuellen Standort zu „${routeStops[0].name}“ wird in Google Maps geöffnet.`);
    return;
  }

  let originPosition;
  const destinationPosition = routeStops[routeStops.length - 1].position;
  let waypointPositions;

  if (getRouteStartMode() === "current") {
    if (!userPosition) {
      setStatus("Bitte zuerst „📍 Mein Standort“ aktivieren.");
      return;
    }

    originPosition = { lat: userPosition.lat, lng: userPosition.lng };
    waypointPositions = routeStops.slice(0, -1).map(item => item.position);
  } else {
    originPosition = routeStops[0].position;
    waypointPositions = routeStops.slice(1, -1).map(item => item.position);
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

  // Route eligibility must use the combined day sequence. Activities are
  // real route stops because their Google Places meeting point has coordinates.
  // v1.10.5 already used these stops for route calculation, but the controls
  // still counted visit places only and therefore disabled the buttons for
  // e.g. 1 place + 1 activity.
  const routeStops = getRouteStopsForDay(day.id);
  const startMode = getRouteStartMode();
  const hasStop = routeStops.length >= 1;
  const hasRoute = routeStops.length >= 2 || (routeStops.length === 1 && startMode === "current");
  const placeCount = routeStops.filter(stop => stop.type === "place").length;
  const activityCount = routeStops.filter(stop => stop.type === "activity").length;
  routeButton.disabled = !hasStop || routeLoading;
  // A single stop becomes a real route only with the explicitly selected
  // current location as origin.
  googleButton.disabled = !hasRoute || routeLoading;

  const routeIsActive = activeRouteDay === day.id && dayRoutePolylines.length > 0;
  if (routeLoading) routeButton.textContent = "⏳ Route wird berechnet …";
  else if (routeIsActive) routeButton.textContent = "🚶 Route ausblenden";
  else if (routeStops.length === 1 && startMode !== "current") routeButton.textContent = "📍 Stopp anzeigen";
  else routeButton.textContent = "🚶 Fußroute anzeigen";

  const startLabel =
    startMode === "current"
      ? (userPosition ? "Start: aktueller Standort" : "Start: aktueller Standort (noch nicht aktiv)")
      : "Start: erster geplanter Stopp";

  const stopSummary = [
    placeCount ? `${placeCount} ${placeCount === 1 ? "Ort" : "Orte"}` : "",
    activityCount ? `${activityCount} ${activityCount === 1 ? "Aktivität" : "Aktivitäten"}` : ""
  ].filter(Boolean).join(" · ");

  if (!hasStop) {
    info.textContent = `${day.short}: noch kein Routenstopp geplant (Ort oder Aktivität).`;
  } else if (routeStops.length === 1 && startMode !== "current") {
    info.textContent = `${day.short}: ${stopSummary} · auf der Karte anzeigen. Mit „Mein aktueller Standort“ kann die Fußroute zu diesem Stopp berechnet werden.`;
  } else if (routeIsActive && activeRouteSummary) {
    info.textContent =
      `${day.short}: ${stopSummary} · ${startLabel} · 🚶 ${formatRouteDistance(activeRouteSummary.distanceMeters)} · ca. ${formatRouteDuration(activeRouteSummary.durationMillis)}`;
  } else {
    info.textContent = `${day.short}: ${stopSummary} · ${startLabel}.`;
  }
}


function navLocationToLatLng(location) {
  if (!location) return null;
  return normalizeLatLng(location.latLng || location.location?.latLng || location);
}

function distanceBetweenMeters(a, b) {
  const p1 = normalizeLatLng(a);
  const p2 = normalizeLatLng(b);
  if (!p1 || !p2) return Infinity;
  const r = 6371000;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

function maneuverIcon(maneuver = "") {
  const value = String(maneuver).toUpperCase();
  if (value.includes("ROUNDABOUT")) return "○";
  if (value.includes("UTURN")) return "⤴";
  if (value.includes("SLIGHT_LEFT")) return "↖";
  if (value.includes("SLIGHT_RIGHT")) return "↗";
  if (value.includes("SHARP_LEFT")) return "↰";
  if (value.includes("SHARP_RIGHT")) return "↱";
  if (value.includes("LEFT")) return "←";
  if (value.includes("RIGHT")) return "→";
  if (value.includes("FERRY")) return "⛴";
  if (value.includes("STRAIGHT") || value.includes("DEPART")) return "↑";
  return "↑";
}

function setNavigationExpanded(expanded) {
  navigationExpanded = Boolean(expanded);
  const panel = navigationPanel();
  const button = document.getElementById("navigationExpandBtn");
  if (panel) panel.classList.toggle("expanded", navigationExpanded);
  if (button) {
    button.setAttribute("aria-expanded", String(navigationExpanded));
    button.setAttribute("aria-label", navigationExpanded ? "Navigationsdetails ausblenden" : "Navigationsdetails anzeigen");
  }
}

function navigationPanel() {
  return document.getElementById("navigationPanel");
}

function setNavigationPanelVisible(visible) {
  const panel = navigationPanel();
  if (panel) panel.hidden = !visible;
  document.body.classList.toggle("navigation-active", Boolean(visible));
}

function clearNavigationPolylines() {
  navigationPolylines.forEach(polyline => polyline.setMap(null));
  navigationPolylines = [];
  if (navigationTravelledPolyline) navigationTravelledPolyline.setMap(null);
  navigationTravelledPolyline = null;
  navigationPathMetrics = null;
}

function buildNavigationPathMetrics() {
  const path = navigationRoutePath();
  const cumulative = [0];
  for (let i = 1; i < path.length; i++) cumulative.push(cumulative[i - 1] + distanceBetweenMeters(path[i - 1], path[i]));
  const stepEnds = navigationSteps.map(item => {
    const end = navLocationToLatLng(item.step?.endLocation);
    if (!end || path.length < 2) return Infinity;
    let best = { distance: Infinity, progress: Infinity };
    for (let i = 1; i < path.length; i++) {
      const projection = projectPointToRouteSegment(end, path[i - 1], path[i]);
      if (projection.distance < best.distance) best = { distance: projection.distance, progress: cumulative[i - 1] + projection.segmentMeters * projection.t };
    }
    return best.progress;
  });
  navigationPathMetrics = { path, cumulative, total: cumulative.at(-1) || 0, stepEnds };
}

function projectPointToRouteSegment(point, a, b) {
  const p = normalizeLatLng(point), p1 = normalizeLatLng(a), p2 = normalizeLatLng(b);
  if (!p || !p1 || !p2) return { distance: Infinity, t: 0, point: p1, segmentMeters: 0 };
  const lat0 = p.lat * Math.PI / 180;
  const mx = 111320 * Math.cos(lat0), my = 110540;
  const px = p.lng * mx, py = p.lat * my;
  const ax = p1.lng * mx, ay = p1.lat * my, bx = p2.lng * mx, by = p2.lat * my;
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  const qx = ax + t * dx, qy = ay + t * dy;
  return { distance: Math.hypot(px - qx, py - qy), t, point: { lat: qy / my, lng: qx / mx }, segmentMeters: Math.sqrt(len2) };
}

function navigationRouteProgress(position) {
  const metrics = navigationPathMetrics;
  if (!metrics?.path?.length || metrics.path.length < 2) return null;
  let best = null;
  for (let i = 1; i < metrics.path.length; i++) {
    const projection = projectPointToRouteSegment(position, metrics.path[i - 1], metrics.path[i]);
    const progress = metrics.cumulative[i - 1] + projection.segmentMeters * projection.t;
    if (!best || projection.distance < best.distance) best = { ...projection, progress, segmentIndex: i };
  }
  return best;
}

function updateTravelledRoute(position) {
  const metrics = navigationPathMetrics;
  const rawProgress = navigationRouteProgress(position);
  if (!metrics || !rawProgress) return rawProgress;
  // GPS kann einige Meter zurückspringen. Der sichtbare Navigationsfortschritt
  // darf deshalb während derselben Route nicht rückwärts laufen.
  navigationMaxProgress = Math.max(navigationMaxProgress || 0, rawProgress.progress || 0);
  let progress = rawProgress;
  if (navigationMaxProgress > rawProgress.progress + 3) {
    let best = rawProgress;
    for (let i = 1; i < metrics.path.length; i++) {
      const start = metrics.cumulative[i - 1];
      const end = metrics.cumulative[i];
      if (navigationMaxProgress >= start && navigationMaxProgress <= end) {
        const segmentMeters = Math.max(0.001, end - start);
        const t = Math.max(0, Math.min(1, (navigationMaxProgress - start) / segmentMeters));
        const a = metrics.path[i - 1], b = metrics.path[i];
        best = { ...rawProgress, progress: navigationMaxProgress, segmentIndex: i,
          point: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t } };
        break;
      }
    }
    progress = best;
  }
  const travelledPath = metrics.path.slice(0, progress.segmentIndex);
  travelledPath.push(progress.point);
  if (!navigationTravelledPolyline) {
    navigationTravelledPolyline = new google.maps.Polyline({
      map, strokeColor: "#9aa0a6", strokeOpacity: 1, strokeWeight: 8, zIndex: 21, clickable: false
    });
  }
  navigationTravelledPolyline.setPath(travelledPath);
  return progress;
}

function navigationArrowElement() {
  const arrow = document.createElement("div");
  arrow.className = "navigation-position-arrow";
  arrow.innerHTML = '<span class="navigation-arrow-shape">▲</span>';
  return arrow;
}


function applyNavigationMapHeading(heading) {
  if (!map) return;
  const value = Number(heading);
  if (!Number.isFinite(value)) return;
  // moveCamera ist für Vector Maps die vorgesehene Kamerasteuerung und
  // verhindert, dass Heading durch parallele Kamera-Updates verloren geht.
  if (typeof map.moveCamera === "function") map.moveCamera({ heading: value, tilt: 0 });
  else if (typeof map.setHeading === "function") map.setHeading(value);
}

function setNavigationHeading(value) {
  const heading = Number(value);
  if (!Number.isFinite(heading)) return;
  navigationHeading = ((heading % 360) + 360) % 360;
  if (navigationActive && navigationFollowMode && navigationHeadingUp && map?.setHeading) {
    applyNavigationMapHeading(navigationHeading);
  }
  const arrow = userLocationMarker?.querySelector?.(".navigation-position-arrow");
  if (arrow) arrow.style.setProperty("--nav-heading", `${navigationHeadingUp ? 0 : navigationHeading}deg`);
}

function enableNavigationArrow() {
  if (!userPosition || !AdvancedMarkerElement) return;
  if (userLocationMarker) userLocationMarker.map = null;
  const arrow = navigationArrowElement();
  if (Number.isFinite(navigationHeading)) arrow.style.setProperty("--nav-heading", `${navigationHeading}deg`);
  userLocationMarker = new AdvancedMarkerElement({
    map,
    position: normalizeLatLng(userPosition),
    title: "Mein Standort / Bewegungsrichtung",
    zIndex: 10000
  });
  userLocationMarker.append(arrow);
}

function restoreLocationMarker() {
  if (userLocationMarker) userLocationMarker.map = null;
  userLocationMarker = null;
  if (userPosition) updateUserLocationMarker();
}

function startOrientationTracking() {
  stopOrientationTracking();
  navigationOrientationHandler = event => {
    let heading = null;
    if (Number.isFinite(event.webkitCompassHeading)) heading = event.webkitCompassHeading;
    else if (event.absolute && Number.isFinite(event.alpha)) heading = 360 - event.alpha;
    if (Number.isFinite(heading)) setNavigationHeading(heading);
  };
  window.addEventListener("deviceorientationabsolute", navigationOrientationHandler, true);
  window.addEventListener("deviceorientation", navigationOrientationHandler, true);
}

function stopOrientationTracking() {
  if (!navigationOrientationHandler) return;
  window.removeEventListener("deviceorientationabsolute", navigationOrientationHandler, true);
  window.removeEventListener("deviceorientation", navigationOrientationHandler, true);
  navigationOrientationHandler = null;
}

function serializeNavigationStop(stop) {
  const position = normalizeLatLng(stop?.position);
  if (!stop || !position) return null;
  return {
    type: stop.type || "place",
    id: stop.id || null,
    name: stop.name || "Ziel",
    position,
    tripDayId: stop.tripDayId || stop.trip_day_id || null,
    plannedDate: stop.plannedDate || null,
    plannedStartTime: stop.plannedStartTime || null,
    plannedEndTime: stop.plannedEndTime || null
  };
}

function saveNavigationSession() {
  if (!navigationActive || !navigationStops.length) return;
  try {
    const stops = remainingNavigationStops().map(serializeNavigationStop).filter(Boolean);
    if (!stops.length) return;
    localStorage.setItem(NAV_SESSION_STORAGE_KEY, JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      testMode: navigationTestMode,
      stops,
      headingUp: navigationHeadingUp,
      expanded: navigationExpanded,
      paused: navigationPaused
    }));
  } catch (error) {
    console.warn("Navigationszustand konnte nicht gespeichert werden:", error);
  }
}

function clearNavigationSession() {
  try { localStorage.removeItem(NAV_SESSION_STORAGE_KEY); } catch (_) {}
}

function loadNavigationSession() {
  try {
    const data = JSON.parse(localStorage.getItem(NAV_SESSION_STORAGE_KEY) || "null");
    if (!data || !Array.isArray(data.stops) || !data.stops.length) return null;
    data.stops = data.stops.map(stop => ({ ...stop, position: normalizeLatLng(stop.position) })).filter(stop => stop.position);
    return data.stops.length ? data : null;
  } catch (_) { return null; }
}

async function requestNavigationWakeLock() {
  if (navigationPaused) return;
  if (!navigationActive || !navigator.wakeLock?.request || document.visibilityState !== "visible") return;
  try {
    if (navigationWakeLock && !navigationWakeLock.released) return;
    navigationWakeLock = await navigator.wakeLock.request("screen");
    navigationWakeLock.addEventListener("release", () => { navigationWakeLock = null; }, { once: true });
  } catch (error) {
    console.info("Wake Lock nicht verfügbar:", error?.message || error);
  }
}

async function releaseNavigationWakeLock() {
  const lock = navigationWakeLock;
  navigationWakeLock = null;
  if (lock && !lock.released) {
    try { await lock.release(); } catch (_) {}
  }
}

function startNavigationPositionWatch() {
  if (navigationPaused || !navigator.geolocation) return;
  if (navigationWatchId != null) navigator.geolocation.clearWatch(navigationWatchId);
  navigationWatchId = navigator.geolocation.watchPosition(processNavigationPosition, error => {
    console.warn("Navigation GPS:", error);
    setStatus("GPS-Signal für die Navigation ist momentan nicht verfügbar.");
  }, { enableHighAccuracy: true, maximumAge: 1500, timeout: 10000 });
}

async function resumeNavigationSession(session = loadNavigationSession(), { announce = true } = {}) {
  if (!session || navigationResumeInProgress || navigationActive) return false;
  navigationResumeInProgress = true;
  try {
    if (announce) setStatus("Navigation wird fortgesetzt … Position wird aktualisiert.");
    const origin = await getFreshCurrentPosition();
    const route = await requestNavigationRoute(session.stops, origin);
    navigationTotalStops = session.stops.length;
    navigationCompletedStops = 0;
    applyNavigationRoute(route, session.stops, { testMode: Boolean(session.testMode), fit: true });
    navigationActive = true;
    navigationPaused = Boolean(session.paused);
    navigationFollowMode = true;
    navigationHeadingUp = session.headingUp !== false;
    navigationLastPosition = origin;
    updateNavigationStartButton();
    setNavigationPanelVisible(true);
    setNavigationExpanded(Boolean(session.expanded));
    if (isMobileLayout()) setMobileView("map");
    enableNavigationArrow();
    startOrientationTracking();
    setNavigationFollowMode(true);
    setNavigationHeadingMode(navigationHeadingUp);
    updateNavigationGpsQuality(null);
    updateNavigationUi(origin);
    updateNavigationPauseButton();
    if (!navigationPaused) {
      startNavigationPositionWatch();
      await requestNavigationWakeLock();
      setStatus("Navigation fortgesetzt · Route ab aktueller Position aktualisiert.");
    } else {
      setStatus("Navigation im pausierten Zustand wiederhergestellt.");
    }
    saveNavigationSession();
    return true;
  } catch (error) {
    console.warn("Navigation konnte nicht fortgesetzt werden:", error);
    setStatus(`Navigation konnte nicht fortgesetzt werden: ${error.message || error}`);
    return false;
  } finally {
    navigationResumeInProgress = false;
  }
}

async function handleNavigationVisibilityChange() {
  if (document.visibilityState === "hidden") {
    if (navigationActive) saveNavigationSession();
    return;
  }
  if (navigationActive) {
    if (navigationPaused) { saveNavigationSession(); return; }
    await requestNavigationWakeLock();
    // Browser können Geolocation-Watches im Hintergrund pausieren. Beim
    // Zurückkehren wird der Watch deshalb frisch gestartet und die Route bei
    // Bedarf von der aktuellen Position weitergeführt.
    startNavigationPositionWatch();
    try {
      const position = await getFreshCurrentPosition();
      userPosition = position;
      processNavigationPosition({ coords: { latitude: position.lat, longitude: position.lng, accuracy: 0, heading: null, speed: null } });
      if (distanceToNavigationRoute(position) > NAV_OFF_ROUTE_METERS) await rerouteNavigation();
    } catch (_) {}
    saveNavigationSession();
  } else {
    const session = loadNavigationSession();
    if (session) await resumeNavigationSession(session);
  }
}

function updateNavigationPauseButton() {
  const button = document.getElementById("navigationPauseBtn");
  if (!button) return;
  button.hidden = !navigationActive;
  button.textContent = navigationPaused ? "▶ Fortsetzen" : "⏸ Pause";
  button.setAttribute("aria-pressed", navigationPaused ? "true" : "false");
  document.getElementById("navigationPanel")?.classList.toggle("paused", navigationPaused);
}

function updateNavigationConnectivityUi() {
  navigationOnline = navigator.onLine !== false;
  const badge = document.getElementById("navigationConnectivity");
  if (badge) {
    badge.textContent = navigationOnline ? "● Online" : "● Offline";
    badge.dataset.state = navigationOnline ? "online" : "offline";
    badge.title = navigationOnline ? "Internetverbindung verfügbar" : "Keine Internetverbindung – vorhandene Route bleibt sichtbar";
  }
}

async function pauseNavigation() {
  if (!navigationActive || navigationPaused) return;
  navigationPaused = true;
  if (navigationWatchId != null && navigator.geolocation) navigator.geolocation.clearWatch(navigationWatchId);
  navigationWatchId = null;
  await releaseNavigationWakeLock();
  stopOrientationTracking();
  updateNavigationPauseButton();
  saveNavigationSession();
  setStatus("Navigation pausiert. Route und aktueller Stopp bleiben erhalten.");
}

async function continuePausedNavigation() {
  if (!navigationActive || !navigationPaused) return;
  if (!navigationOnline) {
    setStatus("Keine Internetverbindung. Die Navigation bleibt pausiert, bis wieder eine Verbindung besteht.");
    return;
  }

  // Sofort wieder in den aktiven Zustand wechseln. Die vorhandene Route bleibt
  // sichtbar; GPS und eine ggf. notwendige Neuberechnung laufen im Hintergrund.
  navigationPaused = false;
  navigationFollowMode = true;
  updateNavigationPauseButton();
  startOrientationTracking();
  startNavigationPositionWatch();
  requestNavigationWakeLock();
  if (userPosition) {
    setNavigationFollowMode(true);
    updateNavigationUi(userPosition);
  }
  saveNavigationSession();
  setStatus("Navigation fortgesetzt · Position wird im Hintergrund aktualisiert …");

  try {
    const before = userPosition ? { ...userPosition } : null;
    const origin = await getFreshCurrentPosition({ timeout: 6000, maximumAge: 12000 });
    userPosition = origin;
    navigationLastPosition = origin;
    setNavigationFollowMode(true);
    updateNavigationUi(origin);
    const moved = before ? distanceBetweenMeters(before, origin) : Infinity;
    const offRoute = distanceToNavigationRoute(origin);
    if (moved > 25 || offRoute > NAV_OFF_ROUTE_METERS) {
      await rerouteNavigation({ force: true });
      setStatus("Navigation fortgesetzt · Route aktualisiert.");
    } else {
      setStatus("Navigation fortgesetzt.");
    }
  } catch (error) {
    // Der laufende Watch kann trotzdem gleich eine Position liefern. Deshalb
    // Navigation nicht erneut pausieren.
    console.info("Positionsaktualisierung nach Fortsetzen:", error?.message || error);
    setStatus("Navigation fortgesetzt · GPS wird weiter gesucht.");
  }
  saveNavigationSession();
}

async function toggleNavigationPause() {
  if (navigationPaused) await continuePausedNavigation();
  else await pauseNavigation();
}

function handleNavigationOffline() {
  updateNavigationConnectivityUi();
  if (navigationActive) {
    saveNavigationSession();
    setStatus("Offline · Die vorhandene Route bleibt sichtbar. Neuberechnung ist erst wieder online möglich.");
  }
}

async function handleNavigationOnline() {
  updateNavigationConnectivityUi();
  if (!navigationActive) return;
  if (navigationPaused) {
    setStatus("Wieder online · Navigation ist weiterhin pausiert.");
    return;
  }
  setStatus("Wieder online · Navigation wird aktualisiert.");
  try {
    const position = await getFreshCurrentPosition();
    userPosition = position;
    await rerouteNavigation({ force: true });
  } catch (_) {
    setStatus("Wieder online.");
  }
}

function stopNavigation(message = "Navigation beendet.") {
  hideNavigationSuccess();
  closeNavigationSkipDialog();
  clearNavigationSession();
  releaseNavigationWakeLock();
  if (navigationWatchId != null && navigator.geolocation) navigator.geolocation.clearWatch(navigationWatchId);
  navigationWatchId = null;
  navigationActive = false;
  navigationPaused = false;
  updateNavigationStartButton();
  updateNavigationPauseButton();
  navigationRoute = null;
  navigationSteps = [];
  navigationStepIndex = 0;
  navigationStops = [];
  navigationFinalTarget = null;
  navigationTestMode = false;
  navigationFollowMode = true;
  navigationOffRouteSamples = 0;
  navigationRerouteInProgress = false;
  navigationArrived = false;
  navigationLastPosition = null;
  navigationLastDynamicZoom = null;
  navigationTotalStops = 0;
  navigationCompletedStops = 0;
  navigationArrivalStop = null;
  navigationPausedAtStop = false;
  navigationArrivalSamples = 0;
  navigationMaxProgress = 0;
  navigationLastOffRouteDistance = null;
  navigationMovingAwaySamples = 0;
  navigationHeadingUp = true;
  setNavigationExpanded(false);
  applyNavigationMapHeading(0);
  stopOrientationTracking();
  clearNavigationPolylines();
  setNavigationPanelVisible(false);
  restoreLocationMarker();
  setStatus(message);
}

function navigationRoutePath() {
  const path = navigationRoute?.path || [];
  return Array.from(path).map(normalizeLatLng).filter(Boolean);
}

function distancePointToSegmentMeters(point, a, b) {
  return projectPointToRouteSegment(point, a, b).distance;
}

function distanceToNavigationRoute(position) {
  const path = navigationRoutePath();
  if (path.length < 2) return Infinity;
  let best = Infinity;
  for (let i=1; i<path.length; i++) best = Math.min(best, distancePointToSegmentMeters(position, path[i-1], path[i]));
  return best;
}

function currentNavigationLegIndex() {
  return Number(navigationSteps[navigationStepIndex]?.legIndex) || 0;
}

function remainingNavigationStops() {
  if (navigationTestMode) return navigationStops.slice(-1);
  const leg = currentNavigationLegIndex();
  return navigationStops.slice(Math.min(leg, navigationStops.length - 1));
}

function updateNavigationStartButton() {
  const button = document.getElementById("navigationStartBtn");
  if (!button) return;
  if (navigationActive) {
    button.textContent = "✕ Navigation beenden";
    button.classList.add("navigation-stop-active");
    button.setAttribute("aria-pressed", "true");
  } else {
    button.textContent = "🧭 Navigation starten";
    button.classList.remove("navigation-stop-active");
    button.setAttribute("aria-pressed", "false");
  }
}

function setNavigationZoom(zoom) {
  if (!map || !Number.isFinite(Number(zoom))) return;
  navigationProgrammaticZoom = true;
  map.setZoom(Number(zoom));
  window.setTimeout(() => { navigationProgrammaticZoom = false; }, 120);
}

function setNavigationFollowMode(enabled) {
  navigationFollowMode = Boolean(enabled);
  const button = document.getElementById("navigationRecenterBtn");
  if (button) button.hidden = navigationFollowMode;
  if (navigationFollowMode && userPosition) {
    map.panTo(userPosition);
    if ((Number(map.getZoom()) || 0) < 17) setNavigationZoom(17);
  }
}

function setNavigationHeadingMode(headingUp) {
  navigationHeadingUp = Boolean(headingUp);
  const button = document.getElementById("navigationHeadingBtn");
  if (button) button.textContent = navigationHeadingUp ? "🧭 Richtung" : "N Norden";
  applyNavigationMapHeading(navigationHeadingUp && Number.isFinite(navigationHeading) ? navigationHeading : 0);
  const arrow = userLocationMarker?.querySelector?.(".navigation-position-arrow");
  if (arrow && Number.isFinite(navigationHeading)) arrow.style.setProperty("--nav-heading", `${navigationHeadingUp ? 0 : navigationHeading}deg`);
}

function navigationGpsQuality(accuracy) {
  const value = Number(accuracy);
  if (!Number.isFinite(value) || value <= 0) return { label: "GPS …", level: "unknown" };
  if (value <= 10) return { label: `GPS ±${Math.round(value)} m`, level: "good" };
  if (value <= 25) return { label: `GPS ±${Math.round(value)} m`, level: "medium" };
  return { label: `GPS ±${Math.round(value)} m`, level: "poor" };
}

function updateNavigationGpsQuality(accuracy) {
  const badge = document.getElementById("navigationGpsQuality");
  if (!badge) return;
  const quality = navigationGpsQuality(accuracy);
  badge.textContent = quality.label;
  badge.dataset.level = quality.level;
}

function updateNavigationDynamicZoom(metersToManeuver) {
  if (!navigationFollowMode) return;
  const meters = Number(metersToManeuver);
  if (!Number.isFinite(meters)) return;
  let targetZoom = 17;
  if (meters <= 45) targetZoom = 19;
  else if (meters <= 120) targetZoom = 18;
  else if (meters >= 500) targetZoom = 16;
  if (navigationLastDynamicZoom !== targetZoom) {
    navigationLastDynamicZoom = targetZoom;
    setNavigationZoom(targetZoom);
  }
}

function hideNavigationSuccess() {
  const overlay = document.getElementById("navigationSuccess");
  if (!overlay) return;
  overlay.hidden = true;
  const confetti = document.getElementById("navigationConfetti");
  if (confetti) confetti.replaceChildren();
}

function launchNavigationConfetti() {
  const layer = document.getElementById("navigationConfetti");
  if (!layer) return;
  layer.replaceChildren();
  const colors = ["#1769e0", "#ffb300", "#e84d8a", "#2e9d55", "#8e5bd9", "#ff7043"];
  for (let i = 0; i < 54; i += 1) {
    const piece = document.createElement("i");
    piece.className = "navigation-confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty("--confetti-color", colors[i % colors.length]);
    piece.style.setProperty("--confetti-delay", `${(Math.random() * 0.55).toFixed(2)}s`);
    piece.style.setProperty("--confetti-duration", `${(1.8 + Math.random() * 1.4).toFixed(2)}s`);
    piece.style.setProperty("--confetti-drift", `${Math.round((Math.random() - 0.5) * 150)}px`);
    piece.style.setProperty("--confetti-rotate", `${Math.round(360 + Math.random() * 720)}deg`);
    layer.appendChild(piece);
  }
  window.setTimeout(() => layer.replaceChildren(), 3600);
}

function showNavigationSuccess(stop) {
  const overlay = document.getElementById("navigationSuccess");
  if (!overlay) return;
  const icon = document.getElementById("navigationSuccessIcon");
  const title = document.getElementById("navigationSuccessTitle");
  const name = document.getElementById("navigationSuccessName");
  const note = document.getElementById("navigationSuccessNote");
  const isActivity = stop?.type === "activity";
  if (icon) icon.textContent = isActivity ? "🎟️" : "📍";
  if (title) title.textContent = "Ziel erreicht!";
  if (name) name.textContent = navigationTestMode ? "Testziel" : (stop?.name || "Ziel");
  if (note) note.textContent = navigationTestMode ? "Testnavigation erfolgreich abgeschlossen." : (isActivity ? "Viel Spaß!" : "Tagesnavigation erfolgreich abgeschlossen.");
  overlay.hidden = false;
  launchNavigationConfetti();
}

function setNavigationArrivalActions(stop = null) {
  const box = document.getElementById("navigationArrivalActions");
  const visitedBtn = document.getElementById("navigationMarkVisitedBtn");
  const continueBtn = document.getElementById("navigationContinueBtn");
  if (!box) return;
  const show = Boolean(stop) && !navigationTestMode;
  box.hidden = !show;
  if (!show) return;
  const placeState = stop?.type === "place" ? ensurePlaceState(stop.id) : null;
  if (visitedBtn) {
    visitedBtn.hidden = stop?.type !== "place";
    visitedBtn.disabled = Boolean(placeState?.visited);
    visitedBtn.textContent = placeState?.visited ? "✓ Bereits besucht" : "✓ Als besucht markieren";
  }
  const hasNext = navigationCompletedStops < navigationTotalStops;
  if (continueBtn) {
    continueBtn.hidden = !hasNext;
    const next = navigationStops[1];
    continueBtn.textContent = next ? `🚶 Weiter zu ${next.name}` : "🚶 Weiter navigieren";
  }
}

function arriveAtNavigationStop(stop) {
  if (!stop || navigationPausedAtStop) return;
  navigationPausedAtStop = true;
  navigationArrived = true;
  navigationArrivalStop = stop;
  navigationCompletedStops = Math.min(navigationTotalStops, navigationCompletedStops + 1);
  const titleEl = document.getElementById("navigationTitle");
  const iconEl = document.getElementById("navigationManeuverIcon");
  const distanceEl = document.getElementById("navigationManeuverDistance");
  const instructionEl = document.getElementById("navigationInstruction");
  const metaEl = document.getElementById("navigationMeta");
  const progressEl = document.getElementById("navigationProgress");
  if (titleEl) titleEl.textContent = "✓ Stopp erreicht";
  if (iconEl) iconEl.textContent = "✓";
  if (distanceEl) distanceEl.textContent = "";
  if (instructionEl) instructionEl.textContent = navigationTestMode ? "Testziel erreicht" : stop.name;
  const next = navigationStops[1];
  if (metaEl) metaEl.textContent = navigationTestMode ? "Du bist am Testziel angekommen." : (next ? `Nächster Stopp: ${next.name}` : "Tagesroute abgeschlossen.");
  if (progressEl) progressEl.textContent = navigationTestMode ? "🧪 Testnavigation" : `Stopp ${navigationCompletedStops} von ${navigationTotalStops}`;
  setNavigationArrivalActions(stop);
  const finalDestinationReached = navigationTestMode || navigationCompletedStops >= navigationTotalStops;
  if (finalDestinationReached) {
    if (navigationWatchId != null && navigator.geolocation) navigator.geolocation.clearWatch(navigationWatchId);
    navigationWatchId = null;
    showNavigationSuccess(stop);
  }
}

function markNavigationArrivalVisited() {
  const stop = navigationArrivalStop;
  if (!stop || stop.type !== "place") return;
  const item = ensurePlaceState(stop.id);
  if (!item.visited) {
    item.visited = true;
    saveState();
    applyFilters();
  }
  setNavigationArrivalActions(stop);
  setStatus(`„${stop.name}“ als besucht markiert.`);
}

function closeNavigationSkipDialog() {
  const dialog = document.getElementById("navigationSkipDialog");
  if (!dialog) return;
  if (typeof dialog.close === "function" && dialog.open) dialog.close();
  else dialog.hidden = true;
}

function openNavigationSkipDialog() {
  if (!navigationActive || navigationTestMode || navigationPausedAtStop || navigationStops.length < 2) {
    setStatus("Es gibt aktuell keinen späteren Stopp zum Anspringen.");
    return;
  }
  const dialog = document.getElementById("navigationSkipDialog");
  const list = document.getElementById("navigationSkipList");
  if (!dialog || !list) return;
  list.innerHTML = "";
  navigationStops.slice(1).forEach((stop, offset) => {
    const index = offset + 1;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "navigation-skip-target";
    button.innerHTML = `<span>${stop.type === "activity" ? "🎟️" : "📍"}</span><span><strong>${escapeHtml(stop.name)}</strong><small>${index === 1 ? "Nächsten Stopp überspringen" : `${index} Stopps überspringen`}</small></span>`;
    button.addEventListener("click", () => navigateToLaterStop(index));
    list.appendChild(button);
  });
  dialog.hidden = false;
  if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
}

async function navigateToLaterStop(index) {
  if (!navigationActive || navigationTestMode || index < 1 || index >= navigationStops.length) return;
  const selected = navigationStops[index];
  const remaining = navigationStops.slice(index);
  closeNavigationSkipDialog();
  try {
    setStatus(`Route zu „${selected.name}“ wird vorbereitet …`);
    const origin = userPosition || navigationLastPosition || await getFreshCurrentPosition();
    const route = await requestNavigationRoute(remaining, origin);
    navigationTotalStops = navigationCompletedStops + remaining.length;
    navigationPausedAtStop = false;
    navigationArrived = false;
    navigationArrivalStop = null;
    setNavigationArrivalActions(null);
    applyNavigationRoute(route, remaining, { testMode: false });
    navigationActive = true;
    updateNavigationUi(origin);
    saveNavigationSession();
    setStatus(index === 1 ? `„${navigationStops[0]?.name || selected.name}“ ist jetzt dein nächster Stopp.` : `Direkte Navigation zu „${selected.name}“ gestartet.`);
  } catch (error) {
    console.error("Stopp überspringen:", error);
    setStatus(`Stopp konnte nicht übersprungen werden: ${error.message || error}`);
  }
}

async function continueDayNavigation() {
  if (!navigationPausedAtStop || navigationTestMode) return;
  const remaining = navigationStops.slice(1);
  if (!remaining.length) {
    setNavigationArrivalActions(null);
    setStatus("Tagesnavigation abgeschlossen.");
    return;
  }
  try {
    navigationPausedAtStop = false;
    navigationArrived = false;
    navigationArrivalStop = null;
    setNavigationArrivalActions(null);
    const origin = userPosition || await getFreshCurrentPosition();
    const route = await requestNavigationRoute(remaining, origin);
    applyNavigationRoute(route, remaining, { testMode: false });
    navigationActive = true;
    navigationPausedAtStop = false;
    navigationArrived = false;
    updateNavigationUi(origin);
    setStatus(`Weiter zu „${remaining[0].name}“.`);
  } catch (error) {
    navigationPausedAtStop = true;
    navigationArrived = true;
    navigationArrivalStop = navigationStops[0] || null;
    setNavigationArrivalActions(navigationArrivalStop);
    setStatus(`Navigation konnte nicht fortgesetzt werden: ${error.message || error}`);
  }
}

function navigationStopSchedule(stop) {
  if (!stop || navigationTestMode || !stop.plannedStartTime) return null;
  const date = stop.plannedDate || getSelectedTripDay()?.id;
  if (!date) return null;
  const [year, month, day] = String(date).split("-").map(Number);
  const [hour, minute] = String(stop.plannedStartTime).slice(0, 5).split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  const start = new Date(year, month - 1, day, hour, minute, 0, 0);
  let end = null;
  if (stop.plannedEndTime) {
    const [endHour, endMinute] = String(stop.plannedEndTime).slice(0, 5).split(":").map(Number);
    if ([endHour, endMinute].every(Number.isFinite)) end = new Date(year, month - 1, day, endHour, endMinute, 0, 0);
  }
  return { start, end };
}

function navigationRemainingDurationToLeg(legIndex, metersToManeuver) {
  const leg = navigationRoute?.legs?.[legIndex];
  if (!leg) return 0;
  const currentStepIndex = navigationStepIndex;
  let remainingDistance = Number.isFinite(metersToManeuver) ? Math.max(0, metersToManeuver) : 0;
  for (let i = currentStepIndex + 1; i < navigationSteps.length; i += 1) {
    if (Number(navigationSteps[i]?.legIndex) !== legIndex) break;
    remainingDistance += Number(navigationSteps[i]?.step?.distanceMeters) || 0;
  }
  const legDistance = Number(leg.distanceMeters) || 0;
  const legDuration = Number(leg.durationMillis) || 0;
  if (legDistance > 0 && legDuration > 0) return legDuration * Math.min(1, remainingDistance / legDistance);
  return legDuration;
}

function formatClockTime(date) {
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function updateNavigationSchedule(stop, legIndex, metersToManeuver) {
  const el = document.getElementById("navigationSchedule");
  if (!el) return;
  const schedule = navigationStopSchedule(stop);
  if (!schedule) {
    el.hidden = true;
    el.className = "navigation-schedule";
    el.textContent = "";
    return;
  }
  const remainingMillis = navigationRemainingDurationToLeg(legIndex, metersToManeuver);
  const arrival = new Date(Date.now() + Math.max(0, remainingMillis));

  // Der Puffer ist eine Differenz zwischen Uhrzeiten innerhalb des geplanten Tages.
  // Dadurch funktioniert die Vorschau/Testnavigation auch schon vor dem Reisetag,
  // statt die Tage bis zum geplanten Datum fälschlich als Puffer zu zählen.
  const plannedMinutes = schedule.start.getHours() * 60 + schedule.start.getMinutes();
  const arrivalMinutes = arrival.getHours() * 60 + arrival.getMinutes();
  const deltaMinutes = plannedMinutes - arrivalMinutes;

  const range = stop.plannedEndTime ? `${stop.plannedStartTime}–${stop.plannedEndTime}` : stop.plannedStartTime;
  let state = "ok";
  let statusText = `${deltaMinutes} Min. Puffer`;
  if (deltaMinutes < 0) {
    state = "late";
    statusText = `⚠️ ca. ${Math.abs(deltaMinutes)} Min. zu spät`;
  } else if (deltaMinutes <= 15) {
    state = "tight";
    statusText = `⚠️ nur ${deltaMinutes} Min. Puffer`;
  }

  el.hidden = false;
  el.className = `navigation-schedule ${state}`;
  el.replaceChildren();
  const timeLine = document.createElement("span");
  timeLine.className = "navigation-schedule-time";
  timeLine.textContent = `🕒 ${range}`;
  const etaLine = document.createElement("span");
  etaLine.className = "navigation-schedule-eta";
  etaLine.textContent = `Ankunft ca. ${formatClockTime(arrival)} · ${statusText}`;
  el.append(timeLine, etaLine);
}

function updateNavigationUi(position = userPosition) {
  if (!navigationActive || !navigationRoute) return;
  const instructionEl = document.getElementById("navigationInstruction");
  const iconEl = document.getElementById("navigationManeuverIcon");
  const distanceEl = document.getElementById("navigationManeuverDistance");
  const metaEl = document.getElementById("navigationMeta");
  const progressEl = document.getElementById("navigationProgress");
  const etaEl = document.getElementById("navigationEta");
  const titleEl = document.getElementById("navigationTitle");
  const activeLegIndex = Number(navigationSteps[navigationStepIndex]?.legIndex) || 0;
  const activeStop = navigationTestMode ? navigationStops.at(-1) : navigationStops[Math.min(activeLegIndex, navigationStops.length - 1)];
  const activeStopDistance = distanceBetweenMeters(position, activeStop?.position);
  const currentAccuracy = Number(window.__navigationLastAccuracy) || 0;
  const arrivalRadius = Math.max(NAV_TARGET_REACHED_METERS, Math.min(NAV_MAX_ARRIVAL_ACCURACY, currentAccuracy || NAV_TARGET_REACHED_METERS));

  if (activeStop && activeStopDistance <= arrivalRadius && (!currentAccuracy || currentAccuracy <= NAV_MAX_ARRIVAL_ACCURACY)) {
    navigationArrivalSamples += 1;
    if (navigationArrivalSamples >= NAV_TARGET_REACHED_SAMPLES) {
      navigationArrivalSamples = 0;
      arriveAtNavigationStop(activeStop);
      return;
    }
  } else {
    navigationArrivalSamples = 0;
  }

  const stepEntry = navigationSteps[navigationStepIndex];
  const step = stepEntry?.step;
  if (!step) return;
  const stepEnd = navLocationToLatLng(step.endLocation);
  const stepDistance = distanceBetweenMeters(position, stepEnd);
  const routeProgress = updateTravelledRoute(position);
  const stepEndProgress = navigationPathMetrics?.stepEnds?.[navigationStepIndex];
  const hasPassedManeuver = Number.isFinite(routeProgress?.progress) && Number.isFinite(stepEndProgress)
    && routeProgress.progress >= stepEndProgress - NAV_STEP_PASS_TOLERANCE_METERS;
  if ((stepDistance <= 18 || hasPassedManeuver) && navigationStepIndex < navigationSteps.length - 1) {
    navigationStepIndex += 1;
    return updateNavigationUi(position);
  }

  const currentEntry = navigationSteps[navigationStepIndex];
  const currentStep = currentEntry?.step;
  const currentEnd = navLocationToLatLng(currentStep?.endLocation);
  const metersToManeuver = distanceBetweenMeters(position, currentEnd);
  updateNavigationDynamicZoom(metersToManeuver);
  const currentProgress = routeProgress || navigationRouteProgress(position);
  const remainingMeters = Number.isFinite(currentProgress?.progress) && navigationPathMetrics
    ? Math.max(0, navigationPathMetrics.total - currentProgress.progress)
    : (Number.isFinite(metersToManeuver) ? metersToManeuver : 0) + navigationSteps.slice(navigationStepIndex + 1).reduce((sum, item) => sum + (Number(item.step?.distanceMeters) || 0), 0);
  const legIndex = Number(currentEntry?.legIndex) || 0;
  const targetName = navigationTestMode ? "Testziel" : (navigationStops[Math.min(legIndex, navigationStops.length - 1)]?.name || "Nächster Stopp");

  if (titleEl) titleEl.textContent = targetName;
  if (iconEl) iconEl.textContent = maneuverIcon(currentStep?.maneuver);
  if (distanceEl) distanceEl.textContent = formatRouteDistance(metersToManeuver);
  if (instructionEl) instructionEl.textContent = currentStep?.instructions || "Route folgen";
  if (metaEl) metaEl.textContent = `${formatRouteDistance(remainingMeters)} verbleibend`;
  const totalRouteMeters = Number(navigationPathMetrics?.total) || Number(navigationRoute?.distanceMeters) || 0;
  const totalDurationMillis = Number(navigationRoute?.durationMillis) || 0;
  const remainingDurationMillis = totalRouteMeters > 0 && totalDurationMillis > 0
    ? totalDurationMillis * Math.max(0, Math.min(1, remainingMeters / totalRouteMeters))
    : 0;
  if (etaEl) etaEl.textContent = remainingDurationMillis > 0 ? `ca. ${formatRouteDuration(remainingDurationMillis)}` : "";
  updateNavigationSchedule(navigationStops[Math.min(legIndex, navigationStops.length - 1)], legIndex, metersToManeuver);
  if (progressEl) progressEl.textContent = navigationTestMode ? "🧪 Test" : `Stopp ${Math.min(navigationCompletedStops + legIndex + 1, navigationTotalStops)}/${navigationTotalStops}`;
}

async function getFreshCurrentPosition({ timeout = 7000, maximumAge = 8000 } = {}) {
  if (!navigator.geolocation) throw new Error("Standortbestimmung wird von diesem Browser nicht unterstützt.");
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(position => {
      userPosition = { lat: position.coords.latitude, lng: position.coords.longitude };
      navigationLastPositionAt = Date.now();
      navigationLastAccuracy = Number(position.coords.accuracy) || Infinity;
      window.__navigationLastAccuracy = Number(position.coords.accuracy) || 0;
      if (Number.isFinite(position.coords.heading)) setNavigationHeading(position.coords.heading);
      updateUserLocationMarker();
      updateDistanceControls();
      updateRouteControls();
      resolve(userPosition);
    }, reject, { enableHighAccuracy: true, timeout, maximumAge });
  });
}

function getUsableCachedNavigationPosition() {
  if (!userPosition || !navigationLastPositionAt) return null;
  const age = Date.now() - navigationLastPositionAt;
  if (age > NAV_CACHED_POSITION_MAX_AGE_MS) return null;
  if (Number.isFinite(navigationLastAccuracy) && navigationLastAccuracy > NAV_CACHED_POSITION_MAX_ACCURACY) return null;
  return { ...userPosition };
}

async function getNavigationStartPosition() {
  const cached = getUsableCachedNavigationPosition();
  if (cached) return { position: cached, cached: true };
  return { position: await getFreshCurrentPosition({ timeout: 7000, maximumAge: 10000 }), cached: false };
}

async function requestNavigationRoute(stops, origin) {
  if (!navigationOnline) throw new Error("Keine Internetverbindung – Route kann momentan nicht berechnet werden.");
  if (!stops?.length) throw new Error("Kein Navigationsziel vorhanden.");
  const Route = await ensureRoutesLibrary();

  // v1.14.7: Für die Live-Navigation immer nur den aktuell nächsten Stopp
  // berechnen. Der restliche Tagesplan bleibt in navigationStops erhalten und
  // wird erst nach Erreichen/Überspringen des aktuellen Stopps geroutet.
  // Das vermeidet besonders bei Tests außerhalb Budapests eine teure Route
  // vom aktuellen Standort über sämtliche Tagesstopps.
  const destination = stops[0].position;
  const { routes } = await Route.computeRoutes({
    origin,
    destination,
    travelMode: "WALKING",
    language: "de",
    units: google.maps.UnitSystem.METRIC,
    fields: ["path", "legs", "distanceMeters", "durationMillis", "viewport"]
  });
  if (!routes?.length) throw new Error("Keine Fußroute gefunden.");
  return routes[0];
}

function applyNavigationRoute(route, stops, { testMode = navigationTestMode, fit = false } = {}) {
  const steps = [];
  (route.legs || []).forEach((leg, legIndex) => (leg.steps || []).forEach(step => steps.push({ step, legIndex })));
  if (!steps.length) throw new Error("Google hat für diese Route keine Navigationsschritte geliefert.");
  clearNavigationPolylines();
  clearRenderedRoute();
  navigationPolylines = route.createPolylines({
    polylineOptions: { strokeColor: "#4285f4", strokeOpacity: 0.95, strokeWeight: 8, zIndex: 20 }
  });
  navigationPolylines.forEach(polyline => polyline.setMap(map));
  navigationRoute = route;
  navigationSteps = steps;
  navigationStepIndex = 0;
  navigationStops = stops;
  navigationFinalTarget = stops.at(-1)?.position || null;
  navigationTestMode = testMode;
  navigationArrived = false;
  navigationOffRouteSamples = 0;
  navigationArrivalSamples = 0;
  navigationMaxProgress = 0;
  navigationLastOffRouteDistance = null;
  navigationMovingAwaySamples = 0;
  buildNavigationPathMetrics();
  if (userPosition) updateTravelledRoute(userPosition);
  if (fit && route.viewport) map.fitBounds(route.viewport, 55);
  if (navigationActive) saveNavigationSession();
}

async function rerouteNavigation({ force = false } = {}) {
  if (!navigationActive || navigationPaused || navigationRerouteInProgress || !userPosition) return;
  if (!navigationOnline) { setStatus("Offline · Neuberechnung ist momentan nicht möglich."); return; }
  const now = Date.now();
  if (!force && now - navigationLastRerouteAt < NAV_REROUTE_COOLDOWN_MS) return;
  const stops = remainingNavigationStops();
  if (!stops.length) return;
  navigationRerouteInProgress = true;
  navigationLastRerouteAt = now;
  const title = document.getElementById("navigationTitle");
  const instruction = document.getElementById("navigationInstruction");
  if (title) title.textContent = "Route wird neu berechnet …";
  if (instruction) instruction.textContent = "Einen Moment bitte";
  try {
    const route = await requestNavigationRoute(stops, userPosition);
    applyNavigationRoute(route, stops, { testMode: navigationTestMode });
    setStatus("Route automatisch neu berechnet.");
    updateNavigationUi(userPosition);
  } catch (error) {
    console.warn("Automatische Neuberechnung:", error);
    setStatus("Route konnte momentan nicht neu berechnet werden.");
  } finally {
    navigationRerouteInProgress = false;
  }
}

function processNavigationPosition(position) {
  if (navigationPaused) return;
  const coords = position.coords;
  const next = { lat: coords.latitude, lng: coords.longitude };
  userPosition = next;
  window.__navigationLastAccuracy = Number(coords.accuracy) || 0;
  navigationLastPositionAt = Date.now();
  navigationLastAccuracy = Number(coords.accuracy) || Infinity;
  updateNavigationGpsQuality(coords.accuracy);
  if (Number.isFinite(coords.heading) && (coords.speed == null || coords.speed > 0.3)) setNavigationHeading(coords.heading);
  if (navigationLastPosition && !Number.isFinite(coords.heading)) {
    const moved = distanceBetweenMeters(navigationLastPosition, next);
    if (moved >= 4) {
      const a = normalizeLatLng(navigationLastPosition), b = normalizeLatLng(next);
      const y = Math.sin((b.lng-a.lng)*Math.PI/180) * Math.cos(b.lat*Math.PI/180);
      const x = Math.cos(a.lat*Math.PI/180)*Math.sin(b.lat*Math.PI/180)-Math.sin(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.cos((b.lng-a.lng)*Math.PI/180);
      setNavigationHeading(Math.atan2(y,x)*180/Math.PI);
    }
  }
  navigationLastPosition = next;
  updateUserLocationMarker();
  if (navigationFollowMode) {
    map.panTo(next);
    if (navigationHeadingUp && Number.isFinite(navigationHeading) && map?.setHeading) applyNavigationMapHeading(navigationHeading);
  }
  updateNavigationUi(next);
  if (navigationArrived || navigationRerouteInProgress) return;
  const accuracy = Number(coords.accuracy) || 0;
  const offRouteDistance = distanceToNavigationRoute(next);
  const threshold = Math.max(NAV_OFF_ROUTE_METERS, accuracy * 1.5);
  const gpsGoodEnough = !accuracy || accuracy <= NAV_MAX_REROUTE_ACCURACY;
  const movingAway = navigationLastOffRouteDistance == null || offRouteDistance >= navigationLastOffRouteDistance - 2;
  if (offRouteDistance > threshold && gpsGoodEnough) {
    navigationOffRouteSamples += 1;
    navigationMovingAwaySamples = movingAway ? navigationMovingAwaySamples + 1 : 0;
  } else {
    navigationOffRouteSamples = 0;
    navigationMovingAwaySamples = 0;
  }
  navigationLastOffRouteDistance = offRouteDistance;
  // Nur neu routen, wenn mehrere brauchbare GPS-Messungen die Abweichung
  // bestätigen und wir uns nicht gerade wieder auf die Route zubewegen.
  if (navigationOffRouteSamples >= NAV_OFF_ROUTE_SAMPLES && navigationMovingAwaySamples >= 2) {
    navigationOffRouteSamples = 0;
    navigationMovingAwaySamples = 0;
    rerouteNavigation();
  }
}

async function computeNavigationRoute(stops, { testMode = false } = {}) {
  if (!stops.length) throw new Error("Kein Navigationsziel vorhanden.");
  navigationTotalStops = stops.length;
  navigationCompletedStops = 0;
  navigationPausedAtStop = false;
  navigationArrivalStop = null;
  setNavigationArrivalActions(null);
  const { position: origin, cached } = await getNavigationStartPosition();
  const route = await requestNavigationRoute(stops, origin);
  applyNavigationRoute(route, stops, { testMode, fit: true });
  navigationActive = true;
  navigationPaused = false;
  updateNavigationStartButton();
  updateNavigationPauseButton();
  navigationFollowMode = true;
  navigationHeadingUp = true;
  navigationLastDynamicZoom = null;
  navigationLastRerouteAt = 0;
  navigationLastPosition = origin;
  navigationArrivalSamples = 0;
  navigationMaxProgress = 0;
  navigationLastOffRouteDistance = null;
  navigationMovingAwaySamples = 0;
  window.__navigationLastAccuracy = 0;
  setNavigationPanelVisible(true);
  setNavigationExpanded(false);
  if (isMobileLayout()) setMobileView("map");
  enableNavigationArrow();
  startOrientationTracking();
  setNavigationFollowMode(true);
  setNavigationHeadingMode(true);
  updateNavigationGpsQuality(null);
  updateNavigationConnectivityUi();
  updateNavigationUi(origin);

  startNavigationPositionWatch();
  saveNavigationSession();
  requestNavigationWakeLock();

  // Bei einem schnellen Start mit einer frischen Cache-Position sofort die UI
  // freigeben und die präzisere Position anschließend im Hintergrund holen.
  if (cached) {
    getFreshCurrentPosition({ timeout: 6000, maximumAge: 0 }).then(fresh => {
      if (!navigationActive || navigationPaused) return;
      const moved = distanceBetweenMeters(origin, fresh);
      userPosition = fresh;
      navigationLastPosition = fresh;
      updateNavigationUi(fresh);
      if (moved > 25 || distanceToNavigationRoute(fresh) > NAV_OFF_ROUTE_METERS) rerouteNavigation({ force: true });
    }).catch(() => {});
  }
}

async function startDayNavigation() {
  const day = getSelectedTripDay();
  if (!day) {
    setStatus("Bitte zuerst einen konkreten Reisetag auswählen.");
    return;
  }
  const stops = getRouteStopsForDay(day.id);
  if (!stops.length) {
    setStatus(`Für ${day.label} ist noch kein Navigationsstopp geplant.`);
    return;
  }
  try {
    setStatus(`Navigation für ${day.label} wird vorbereitet …`);
    await computeNavigationRoute(stops);
    setStatus(`Navigation für ${day.label} gestartet.`);
  } catch (error) {
    console.error("Navigation:", error);
    setStatus(`Navigation konnte nicht gestartet werden: ${error.message || error}`);
  }
}

function cancelNavigationTestTarget() {
  if (navigationPickListener) navigationPickListener.remove();
  navigationPickListener = null;
  navigationTestTarget = null;
  document.getElementById("navigationTestBtn")?.classList.remove("active");
}

function chooseNavigationTestTarget() {
  if (!map) return;
  cancelNavigationTestTarget();
  const button = document.getElementById("navigationTestBtn");
  button?.classList.add("active");
  setStatus("🧪 Testmodus: Tippe auf der Karte auf ein Ziel in deiner Nähe. Es wird nicht gespeichert.");
  if (isMobileLayout()) setMobileView("map");
  navigationPickListener = map.addListener("click", async event => {
    const position = normalizeLatLng(event.latLng);
    cancelNavigationTestTarget();
    if (!position) return;
    navigationTestTarget = position;
    try {
      setStatus("Testnavigation wird vorbereitet …");
      await computeNavigationRoute([{ type: "test", id: "test-target", name: "Testziel", position }], { testMode: true });
      setStatus("🧪 Testnavigation gestartet. Das Testziel wird nicht gespeichert.");
    } catch (error) {
      console.error("Testnavigation:", error);
      setStatus(`Testnavigation konnte nicht gestartet werden: ${error.message || error}`);
    }
  });
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

    button.addEventListener("click", async () => {
      // Build 16: War bereits eine Route sichtbar, bleibt der Routenmodus
      // beim Tageswechsel aktiv und die Route wird für den neuen Tag ersetzt.
      const keepRouteVisible = Boolean(activeRouteDay && dayRoutePolylines.length);

      selectedDayFilter = item.id;
      document.querySelectorAll(".day-filter-button").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.day === selectedDayFilter);
      });

      if (activeRouteDay && activeRouteDay !== selectedDayFilter) {
        clearDayRoute();
      }

      applyFilters();
      updateRouteControls();

      if (keepRouteVisible && TRIP_DAYS.some(day => day.id === selectedDayFilter)) {
        await showDayRoute(selectedDayFilter);
      }

      // Build 14: Im mobilen Plan bleibt der Plan-Tab nach der
      // Auswahl eines Reisetages geöffnet.
    });

    container.appendChild(button);
  }

  updateDayCounts();
  updateRouteControls();
}

function updateDayCounts() {
  const counts = Object.fromEntries(TRIP_DAYS.map(day => [day.id, 0]));
  let unplanned = 0;

  // Visit places count towards their planned day.
  for (const place of placesData.places) {
    const plannedDay = (state.places[place.id] || {}).plannedDay || "";
    if (plannedDay && counts[plannedDay] !== undefined) counts[plannedDay]++;
    else unplanned++;
  }

  // Activities are appointments, not visit places, but they are part of a day's
  // programme. Resolve the Supabase trip_day UUID back to the frontend ISO date.
  for (const activity of activities) {
    const dayDate = activityDayDate(activity);
    if (dayDate && counts[dayDate] !== undefined) counts[dayDate]++;
  }

  document.querySelectorAll(".day-filter-button").forEach(button => {
    const id = button.dataset.day;
    if (id === "all") {
      button.textContent = `Alle (${placesData.places.length + activities.length})`;
    } else if (id === "unplanned") {
      // Activities always belong to a trip day and deliberately do not belong
      // to the visit-place state "Noch offen".
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

function resetPlaceSearchAfterPlanning() {
  const reset = () => {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;
    searchInput.value = "";
    // Mobile browsers can keep the native search control visually stale
    // unless its normal input/change flow is triggered as well.
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    renderSearchSuggestions();
    hideSearchSuggestions();
  };

  reset();
  window.requestAnimationFrame(reset);
  window.setTimeout(reset, 80);
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

  // v1.0.0 UX-Korrektur:
  // Nach erfolgreicher Zuweisung eines über die Suche gefilterten Ortes
  // ist der Suchvorgang abgeschlossen. Nur den Suchtext zurücksetzen;
  // Kategorie-, Tages- und weitere Filter bleiben unverändert.
  if (dayId) {
    resetPlaceSearchAfterPlanning();
  }

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
      position: normalizeLatLng(userPosition),
      title: "Mein Standort",
      zIndex: 9999
    });

    userLocationMarker.append(locationPin);
  } else {
    const safeUserPosition = normalizeLatLng(userPosition);
    if (safeUserPosition) userLocationMarker.position = safeUserPosition;
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
  const sortButtons = [
    document.getElementById("distanceSortBtn"),
    document.getElementById("mobileDistanceSortBtn")
  ].filter(Boolean);

  sortButtons.forEach(sortButton => {
    sortButton.disabled = !userPosition;
    sortButton.title = userPosition
      ? "Orte nach Luftlinienentfernung sortieren"
      : "Zuerst Standort freigeben";
    sortButton.classList.toggle("active", sortByDistance && Boolean(userPosition));
    sortButton.setAttribute("aria-pressed", sortByDistance && Boolean(userPosition) ? "true" : "false");
  });
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

  // "Nächster Ort" folgt ab Build 14 ausschließlich der geplanten
  // Tagesreihenfolge. Der aktuelle GPS-Standort wird hier nicht mehr
  // als neuer Startpunkt in die Tagesroute eingefügt.
  if (destinations.length === 1 && routeStartMode !== "current") {
    clearRenderedRoute();
    activeRouteDay = null;
    activeRouteSummary = null;

    const marker = markers.get(nextPlace.id);
    const position = marker ? getMarkerPosition(marker) : null;
    if (position) {
      map.panTo(position);
      if (map.getZoom() < 15) map.setZoom(15);
    }

    window.setTimeout(() => openPlace(nextPlace), 180);
    updateRouteControls();
    setStatus(`🧭 Nächster Ort: ${nextPlace.name} · danach ist der Tagesplan abgeschlossen.`);
    return;
  }

  routeLoading = true;
  updateRouteControls();
  setStatus(`Restliche Tagesroute ab „${nextPlace.name}“ wird berechnet …`);

  try {
    const Route = await ensureRoutesLibrary();
    const plannedRoutePoints = destinations.map(item => item.position);

    // Build 15: "Nächster Ort" respects the route-start option selected by
    // the user. If "current location" is selected, GPS remains the origin;
    // otherwise the route starts at the first remaining planned place.
    const useCurrentLocation = routeStartMode === "current";
    if (useCurrentLocation && !userPosition) {
      setStatus("Aktueller Standort ist noch nicht verfügbar. Bitte Standort aktualisieren.");
      return;
    }

    const routePoints = useCurrentLocation
      ? [userPosition, ...plannedRoutePoints]
      : plannedRoutePoints;

    const routes = [];
    let totalDistanceMeters = 0;
    let totalDurationMillis = 0;

    // Segmentweise rechnen, damit die geplante Reihenfolge garantiert
    // erhalten bleibt. Nur der Startpunkt hängt von der gewählten Option ab.
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

    activeRouteDay = day.id;
    activeRouteSummary = {
      distanceMeters: totalDistanceMeters,
      durationMillis: totalDurationMillis,
      placeCount: destinations.length
    };

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 70);
    }

    if (isMobileLayout()) {
      setMobileView("map");
    }

    window.setTimeout(() => openPlace(nextPlace), 180);

    setStatus(
      `🧭 Noch ${destinations.length} ${destinations.length === 1 ? "Ort" : "Orte"} · nächster: ${nextPlace.name} · Reststrecke ${formatRouteDistance(totalDistanceMeters)} · ${formatRouteDuration(totalDurationMillis)}`
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


function getTodayOverviewDay() {
  const actualToday = getTripDayForDate();
  if (actualToday) return { day: actualToday, preview: false };

  // Vor/nach der Reise bleibt die neue Ansicht testbar: erster Reisetag als klar gekennzeichnete Vorschau.
  const firstDay = TRIP_DAYS[0] || null;
  return { day: firstDay, preview: Boolean(firstDay) };
}

function formatTodayDayTitle(day) {
  if (!day) return "Heute";
  const date = new Date(`${day.id}T12:00:00`);
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric"
  }).format(date);
}

function renderTodayView() {
  const container = document.getElementById("todayOverview");
  if (!container) return;

  const { day, preview } = getTodayOverviewDay();
  if (!day) {
    container.innerHTML = '<div class="today-empty">Kein Reisetag verfügbar.</div>';
    return;
  }

  const dayPlaces = getPlacesForDay(day.id);
  const openPlaces = dayPlaces.filter(place => !(state.places[place.id] || {}).visited);
  const nextPlace = openPlaces[0] || null;
  const dayStops = getRouteStopsForDay(day.id);
  const nextStop = dayStops.find(stop => stop.type === "activity" || !(state.places[stop.id] || {}).visited) || null;
  const visitedCount = dayPlaces.length - openPlaces.length;
  const progress = dayPlaces.length ? Math.round((visitedCount / dayPlaces.length) * 100) : 0;
  const dayIndex = Math.max(0, TRIP_DAYS.findIndex(item => item.id === day.id)) + 1;

  const timeline = dayPlaces.map(place => {
    const saved = state.places[place.id] || {};
    const time = formatPlannedTime(saved) || "offen";
    const isNext = nextPlace?.id === place.id;
    return `
      <div class="today-timeline-item ${saved.visited ? "visited" : ""} ${isNext ? "next" : ""}" data-today-place-id="${escapeHtml(place.id)}">
        <button class="today-check" type="button" data-today-toggle="${escapeHtml(place.id)}" aria-label="${saved.visited ? "Als offen markieren" : "Als besucht markieren"}">${saved.visited ? "✓" : "○"}</button>
        <span class="today-time">${escapeHtml(time)}</span>
        <span class="today-place-name">${escapeHtml(place.name)}</span>
      </div>`;
  }).join("");

  const whatNowDistance = nextStop && userPosition
    ? haversineDistanceMeters(userPosition, nextStop.position)
    : null;
  const whatNowMinutes = whatNowDistance != null ? estimatedWalkingMinutes(whatNowDistance) : null;
  const whatNowTime = nextStop ? [nextStop.plannedStartTime, nextStop.plannedEndTime].filter(Boolean).join("–") : "";
  const whatNowIcon = nextStop?.type === "activity"
    ? "🎟️"
    : (nextStop?.place ? (CATEGORY_ICONS[nextStop.place.category] || "📍") : "📍");
  const whatNowMeta = nextStop
    ? (nextStop.type === "activity"
      ? (nextStop.activity?.meeting_place_name || nextStop.activity?.address || "Aktivität")
      : categoryLabel(nextStop.place?.category))
    : "";
  const whatNowOpening = nextStop?.type === "place"
    ? plannedOpeningStatus(nextStop.place, day.id, nextStop.plannedStartTime)
    : null;
  const whatNowOpeningHtml = whatNowOpening
    ? `<span class="today-opening-status ${whatNowOpening.kind}" title="${escapeHtml(whatNowOpening.detail)}">${escapeHtml(whatNowOpening.label)}</span>`
    : "";
  const whatNowCard = nextStop ? `
    <div class="today-what-now-card">
      <div class="today-what-now-head">
        <div><div class="today-card-label">Was jetzt?</div><div class="today-what-now-subtitle">${preview ? "Nächster Programmpunkt der Reise" : "Als Nächstes in deinem Tagesplan"}</div></div>
        ${whatNowTime ? `<span class="today-next-time">🕒 ${escapeHtml(whatNowTime)}</span>` : ""}
      </div>
      <button class="today-what-now-main" type="button" data-what-now-focus>
        <span class="today-next-icon">${whatNowIcon}</span>
        <span><strong>${escapeHtml(nextStop.name)}</strong><small>${escapeHtml(whatNowMeta)}${whatNowDistance != null ? ` · 📍 ${escapeHtml(formatDistance(whatNowDistance))}` : ""}${whatNowMinutes != null ? ` · 🚶 ca. ${whatNowMinutes} Min.` : ""}</small>${whatNowOpeningHtml}</span>
        <span class="today-chevron">›</span>
      </button>
      <div class="today-what-now-actions">
        <button id="whatNowNavigateBtn" class="primary-button today-action-button" type="button">🧭 Navigation starten</button>
        <button id="whatNowMapBtn" class="secondary-button today-action-button" type="button">🗺️ Auf Karte</button>
      </div>
      ${userPosition ? "" : '<div class="today-location-hint">📍 Sobald dein Standort verfügbar ist, werden Entfernung und Gehzeit ergänzt.</div>'}
    </div>` : '<div class="today-complete-card">✓ Für heute sind keine offenen Programmpunkte mehr vorhanden.</div>';

  const nextDistance = nextPlace && userPosition ? distanceToPlace(nextPlace) : null;
  const nextSaved = nextPlace ? (state.places[nextPlace.id] || {}) : {};
  const nextTime = nextPlace ? formatPlannedTime(nextSaved) : "";
  const nextCard = nextPlace ? `
    <div class="today-next-card">
      <div class="today-next-head">
        <div class="today-card-label">Nächster Ort</div>
        ${nextTime ? `<span class="today-next-time">🕒 ${escapeHtml(nextTime)}</span>` : ""}
      </div>
      <button class="today-next-main" type="button" data-today-show-place="${escapeHtml(nextPlace.id)}">
        <span class="today-next-icon">${CATEGORY_ICONS[nextPlace.category] || "📍"}</span>
        <span><strong>${escapeHtml(nextPlace.name)}</strong><small>${escapeHtml(categoryLabel(nextPlace.category))}${nextDistance != null ? ` · 📍 ${escapeHtml(formatDistance(nextDistance))} entfernt` : ""}</small></span>
        <span class="today-chevron">›</span>
      </button>
      <button class="today-done-button" type="button" data-today-complete="${escapeHtml(nextPlace.id)}">✓ Als besucht markieren</button>
      <div class="today-next-actions">
        <button id="todayRouteButton" class="primary-button today-action-button" type="button">🧭 Route anzeigen</button>
        <button id="todayMapButton" class="secondary-button today-action-button" type="button" data-today-show-place="${escapeHtml(nextPlace.id)}">🗺️ Auf Karte</button>
      </div>
      ${userPosition ? "" : '<div class="today-location-hint">📍 Standort aktivieren, um die Entfernung zum nächsten Ort zu sehen.</div>'}
    </div>` : `
    <div class="today-complete-card">✓ ${dayPlaces.length ? "Tagesplan abgeschlossen – alle Orte besucht." : "Für diesen Tag sind noch keine Orte geplant."}</div>`;

  container.innerHTML = `
    ${preview ? '<div class="today-preview-note">Vorschau · Die Reise hat noch nicht begonnen</div>' : ''}
    <div class="today-day-card">
      <div><div class="today-kicker">${preview ? "Erster Reisetag" : "Heute"}</div><h2>${escapeHtml(formatTodayDayTitle(day))}</h2><div class="today-day-label">${escapeHtml(day.label)}</div></div>
      <span class="today-day-number">Tag ${dayIndex}</span>
    </div>
    ${whatNowCard}
    <div class="today-plan-card">
      <div class="today-plan-head"><strong>${preview ? "Planung" : "Heutige Planung"}</strong><span>${visitedCount} von ${dayPlaces.length} erledigt</span></div>
      <div class="today-progress"><span style="width:${progress}%"></span></div>
      <div class="today-timeline">${timeline || '<div class="today-empty">Noch keine Programmpunkte geplant.</div>'}</div>
      <button id="todayOpenPlanButton" class="secondary-button today-open-plan" type="button">☷ Gesamten Tagesplan öffnen</button>
    </div>`;

  const focusWhatNowStop = () => {
    if (!nextStop) return;
    setMobileView("map");
    if (nextStop.type === "activity" && nextStop.activity) {
      focusActivityOnMap(nextStop.activity);
    } else if (nextStop.place) {
      focusExistingPlaceOnMap(nextStop.place);
    }
  };

  container.querySelector("[data-what-now-focus]")?.addEventListener("click", focusWhatNowStop);
  document.getElementById("whatNowMapBtn")?.addEventListener("click", focusWhatNowStop);
  document.getElementById("whatNowNavigateBtn")?.addEventListener("click", async () => {
    if (!nextStop) return;
    selectedDayFilter = day.id;
    try {
      if (!userPosition) await getFreshCurrentPosition({ timeout: 8000, maximumAge: 60000 });
      await startNavigationWithStops([nextStop], { testMode: false });
    } catch (error) {
      console.error("Was jetzt? – Navigation:", error);
      setStatus(error?.message || "Navigation konnte nicht gestartet werden.");
    }
  });

  container.querySelectorAll("[data-today-show-place]").forEach(button => {
    button.addEventListener("click", () => {
      const place = placesData.places.find(item => item.id === button.dataset.todayShowPlace);
      if (!place) return;
      setMobileView("map");
      const marker = markers.get(place.id);
      const position = marker ? getMarkerPosition(marker) : null;
      if (position) { map.panTo(position); if (map.getZoom() < 16) map.setZoom(16); }
      window.setTimeout(() => openPlace(place), 180);
    });
  });

  const setTodayVisited = (placeId, visited) => {
    const item = ensurePlaceState(placeId);
    item.visited = visited;
    saveState();
    applyFilters();
    // Die Heute-Ansicht sofort neu aufbauen: Fortschritt, Timeline und vor allem
    // „Nächster Ort“ wechseln ohne zusätzlichen Klick auf den nächsten Eintrag.
    renderTodayView();
  };

  container.querySelectorAll("[data-today-toggle]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const item = ensurePlaceState(button.dataset.todayToggle);
      setTodayVisited(button.dataset.todayToggle, !item.visited);
    });
  });

  container.querySelector("[data-today-complete]")?.addEventListener("click", event => {
    event.stopPropagation();
    setTodayVisited(event.currentTarget.dataset.todayComplete, true);
  });

  const todayRouteButton = document.getElementById("todayRouteButton");
  if (todayRouteButton && nextPlace) {
    // Für einen neuen nächsten Ort beginnt die Heute-Routenlogik wieder beim
    // geplanten Startpunkt. Ein zweiter Klick wechselt bewusst auf GPS.
    if (todayRouteTargetId !== nextPlace.id) {
      todayRouteTargetId = nextPlace.id;
      todayRouteClickMode = "planned";
    }

    const updateTodayRouteButton = () => {
      todayRouteButton.textContent = todayRouteClickMode === "planned"
        ? "🧭 Route ab Startpunkt"
        : "📍 Route ab aktuellem Standort";
    };
    updateTodayRouteButton();

    todayRouteButton.addEventListener("click", async () => {
      selectedDayFilter = day.id;

      const requestedMode = todayRouteClickMode;

      // Den Folgemodus VOR der Routenberechnung setzen. showNextPlace() rendert
      // Teile der mobilen Ansicht neu; dadurch kann der aktuell geklickte Button
      // ersetzt werden. So übernimmt der neu gerenderte Button zuverlässig den
      // nächsten Modus statt wieder bei „Startpunkt“ zu beginnen.
      todayRouteClickMode = requestedMode === "planned" ? "current" : "planned";

      if (requestedMode === "current" && !userPosition) {
        // Beim zweiten Klick den Standort direkt anfordern, statt vorauszusetzen,
        // dass „Mein Standort“ vorher manuell verwendet wurde.
        try {
          if (!navigator.geolocation) throw new Error("Geolocation wird nicht unterstützt.");
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true, timeout: 8000, maximumAge: 60000
            });
          });
          userPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          updateUserLocationMarker();
          updateDistanceControls();
          updateRouteControls();
          applyFilters();
        } catch (error) {
          console.error("Heute – Standort für Route:", error);
        }
        if (!userPosition) {
          todayRouteClickMode = "current";
          renderTodayView();
          setStatus("Aktueller Standort konnte nicht ermittelt werden. Bitte Standortfreigabe prüfen.");
          return;
        }
      }

      routeStartMode = requestedMode;
      const select = document.getElementById("routeStartMode");
      if (select) select.value = routeStartMode;

      await showNextPlace();

      // Falls showNextPlace() die Heute-Ansicht nicht ohnehin neu aufgebaut hat,
      // den sichtbaren Button auf den Folgemodus aktualisieren.
      renderTodayView();
    });
  }

  document.getElementById("todayOpenPlanButton")?.addEventListener("click", () => {
    selectedDayFilter = day.id;
    applyFilters();
    renderDayFilters();
    setMobileView("plan");
  });
}

function wireAgendaDragAndDrop(container, dayId) {
  const timeline = container.querySelector(".agenda-timeline");
  if (!timeline || !dayId) return;

  let drag = null;

  const wrappers = () => [...timeline.querySelectorAll(":scope > .agenda-place-wrap")];

  const refreshVisibleOrder = () => {
    wrappers().forEach((wrapper, index) => {
      const dot = wrapper.querySelector(".agenda-timeline-dot");
      if (dot && !dot.classList.contains("visited")) dot.textContent = String(index + 1);
    });
  };

  // FLIP animation: after a DOM reorder, animate all other cards from their
  // previous screen position into the new one. This makes the destination
  // obvious without a separate drop line.
  const reorderWithAnimation = (wrapper, reference) => {
    const beforeRects = new Map(wrappers().map(el => [el, el.getBoundingClientRect()]));
    timeline.insertBefore(wrapper, reference);
    refreshVisibleOrder();

    wrappers().forEach(el => {
      if (el === wrapper) return;
      const before = beforeRects.get(el);
      if (!before) return;
      const after = el.getBoundingClientRect();
      const deltaY = before.top - after.top;
      if (Math.abs(deltaY) < 1) return;
      el.animate(
        [{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0)" }],
        { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }
      );
    });
  };

  const removeGhost = () => {
    if (!drag?.ghost) return;
    drag.ghost.classList.add("agenda-drag-ghost-out");
    const ghost = drag.ghost;
    window.setTimeout(() => ghost.remove(), 120);
  };

  const finishDrag = (cancelled = false) => {
    if (!drag) return;
    const { handle, wrapper, pointerId, originalIds } = drag;
    try { handle.releasePointerCapture(pointerId); } catch {}
    document.body.classList.remove("agenda-dragging");
    wrapper.classList.remove("agenda-drag-placeholder");
    removeGhost();

    const orderedWrappers = wrappers();
    const newIds = orderedWrappers.map(el => el.dataset.agendaKey).filter(Boolean);
    const changed = !cancelled && newIds.length === originalIds.length && newIds.some((id, index) => id !== originalIds[index]);

    drag = null;

    if (cancelled) {
      renderDayAgenda();
      return;
    }

    if (!changed) {
      refreshVisibleOrder();
      return;
    }

    newIds.forEach((key, index) => {
      const [type, id] = key.split(":");
      if (type === "place") ensurePlaceState(id).plannedOrder = index + 1;
      if (type === "activity") { const activity = activities.find(item => item.id === id); if (activity) activity.planned_order = index + 1; }
    });
    saveState();
    persistMixedAgendaOrder(newIds);
    applyFilters();
    if (activeRouteDay === dayId) showDayRoute(dayId);
    else updateRouteControls();
    setStatus(`Reihenfolge für ${dayLongLabel(dayId)} aktualisiert.`);
  };

  const moveDrag = event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();

    // The floating card follows the finger/mouse while the real card remains
    // as a compact placeholder in the timeline.
    if (drag.ghost) {
      drag.ghost.style.transform = `translate3d(0, ${event.clientY - drag.startY}px, 0) rotate(.25deg)`;
    }

    const candidates = wrappers().filter(el => el !== drag.wrapper);
    let reference = null;
    for (const candidate of candidates) {
      const rect = candidate.getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) {
        reference = candidate;
        break;
      }
    }

    const currentNext = drag.wrapper.nextElementSibling;
    if (reference) {
      if (reference !== currentNext) reorderWithAnimation(drag.wrapper, reference);
    } else if (drag.wrapper !== timeline.lastElementChild) {
      reorderWithAnimation(drag.wrapper, null);
    }
  };

  const endDrag = event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    finishDrag(false);
  };

  document.addEventListener("pointermove", moveDrag, { passive: false });
  document.addEventListener("pointerup", endDrag, { passive: false });
  document.addEventListener("pointercancel", event => {
    if (drag && drag.pointerId === event.pointerId) finishDrag(true);
  });

  timeline.querySelectorAll(".agenda-drag-handle").forEach(handle => {
    handle.addEventListener("pointerdown", event => {
      if (event.button !== undefined && event.button !== 0) return;
      const wrapper = handle.closest(".agenda-place-wrap");
      if (!wrapper) return;
      event.preventDefault();
      event.stopPropagation();

      const item = wrapper.querySelector(".agenda-item");
      const itemRect = item?.getBoundingClientRect();
      const ghost = item?.cloneNode(true);
      if (ghost && itemRect) {
        ghost.classList.add("agenda-drag-ghost");
        ghost.querySelectorAll("button").forEach(button => button.setAttribute("tabindex", "-1"));
        ghost.style.left = `${itemRect.left}px`;
        ghost.style.top = `${itemRect.top}px`;
        ghost.style.width = `${itemRect.width}px`;
        ghost.style.height = `${itemRect.height}px`;
        document.body.appendChild(ghost);
      }

      drag = {
        handle,
        wrapper,
        ghost,
        pointerId: event.pointerId,
        startY: event.clientY,
        originalIds: wrappers().map(el => el.dataset.agendaKey)
      };
      try { handle.setPointerCapture(event.pointerId); } catch {}
      document.body.classList.add("agenda-dragging");
      wrapper.classList.add("agenda-drag-placeholder");
    });
  });
}


async function persistMixedAgendaOrder(keys) {
  try {
    const placeUpdates=[]; const activityUpdates=[];
    keys.forEach((key,index)=>{ const [type,id]=key.split(":"); if(type==="place"){const place=placesData.places.find(p=>p.id===id); if(place?.supabaseId) placeUpdates.push({id:place.supabaseId,order:index+1});} else if(type==="activity") activityUpdates.push({id,order:index+1}); });
    await Promise.all([
      ...placeUpdates.map(row=>supabaseClient.from("trip_places").update({planned_order:row.order,updated_at:new Date().toISOString()}).eq("trip_id",currentTripId).eq("place_id",row.id)),
      ...activityUpdates.map(row=>supabaseClient.from("trip_activities").update({planned_order:row.order,updated_at:new Date().toISOString()}).eq("trip_id",currentTripId).eq("id",row.id))
    ]);
  } catch(error){ console.error("Gemischte Tagesreihenfolge speichern:",error); setStatus(`⚠️ Reihenfolge konnte nicht vollständig gespeichert werden: ${error.message}`); }
}

function activityDayDate(activity) {
  const day = currentTripDays.find(item => item.id === activity.trip_day_id);
  return day?.day_date || null;
}

async function loadActivitiesFromSupabase() {
  if (!supabaseClient || !currentTripId) return [];
  const { data, error } = await supabaseClient
    .from("trip_activities")
    .select("*")
    .eq("trip_id", currentTripId)
    .order("planned_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function refreshActivitiesFromSupabase() {
  try {
    activities = await loadActivitiesFromSupabase();
    createActivityMarkers();
    renderDayAgenda();
    renderTodayView();
  } catch (error) {
    console.error("Aktivitäten live aktualisieren:", error);
  }
}

function createActivityMarkers() {
  if (!map || !AdvancedMarkerElement || !PinElement) return;
  for (const marker of activityMarkers.values()) marker.map = null;
  activityMarkers.clear();
  for (const activity of activities) {
    const position = normalizeLatLng({ lat: activity.latitude, lng: activity.longitude });
    if (!position) continue;
    const pin = new PinElement({ glyphText: "🎟", glyphColor: "#ffffff", background: "#7c3aed", borderColor: "#ffffff", scale: 1.05 });
    const marker = new AdvancedMarkerElement({ map, position, title: activity.name, gmpClickable: true, zIndex: 700 });
    marker.append(pin);
    marker.addEventListener("gmp-click", () => openActivityInfo(activity));
    activityMarkers.set(activity.id, marker);
  }
  syncActivityMarkerVisibility();
}

function openActivityInfo(activity) {
  const marker = activityMarkers.get(activity.id);
  if (!marker) return;
  const time = [activity.start_time?.slice(0,5), activity.end_time?.slice(0,5)].filter(Boolean).join("–");
  infoWindow.setContent(`<div class="info-window activity-info-window"><div class="info-title">🎟️ ${escapeHtml(activity.name)}</div><div class="info-meta">${time ? `🕐 ${escapeHtml(time)}<br>` : ""}📍 ${escapeHtml(activity.meeting_place_name || activity.address || "Treffpunkt")}<br>${activity.address ? escapeHtml(activity.address) : ""}</div>${activity.note ? `<div class="info-note">${escapeHtml(activity.note)}</div>` : ""}</div>`);
  activeInfoPlaceId = `activity:${activity.id}`;
  infoWindow.open({ map, anchor: marker, shouldFocus: false });
}

function focusActivityOnMap(activity) {
  const marker = activityMarkers.get(activity.id);
  const position = marker ? getMarkerPosition(marker) : normalizeLatLng({lat: activity.latitude, lng: activity.longitude});
  if (!position) return;
  if (isMobileLayout()) setMobileView("map");
  requestAnimationFrame(() => {
    google.maps.event.trigger(map, "resize");
    map.setCenter(position);
    if ((Number(map.getZoom()) || 0) < 16) map.setZoom(16);
    openActivityInfo(activity);
  });
}

async function initActivityPlaceAutocomplete() {
  const host = document.getElementById("activityPlaceAutocomplete");
  if (!host || activityPlaceAutocompleteElement || !google?.maps) return;
  const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");
  activityPlaceAutocompleteElement = new PlaceAutocompleteElement({ includedRegionCodes: ["hu"], locationBias: { center: CONFIG.initialCenter, radius: 50000 } });
  activityPlaceAutocompleteElement.placeholder = "Treffpunkt oder Adresse suchen …";
  host.appendChild(activityPlaceAutocompleteElement);
  activityPlaceAutocompleteElement.addEventListener("gmp-select", async event => {
    const prediction = event.placePrediction;
    if (!prediction) return;
    const place = prediction.toPlace();
    await place.fetchFields({ fields: ["id","displayName","formattedAddress","location"] });
    selectedActivityGooglePlace = place;
    const selection = document.getElementById("activityPlaceSelection");
    selection.hidden = false;
    selection.innerHTML = `<strong>📍 ${escapeHtml(place.displayName || "Treffpunkt")}</strong><span>${escapeHtml(place.formattedAddress || "")}</span>`;
  });
}

function populateActivityDayOptions() {
  const select = document.getElementById("activityDay");
  if (!select) return;
  select.innerHTML = currentTripDays.map(day => {
    const label = TRIP_DAYS.find(item => item.id === day.day_date)?.label || day.day_date;
    return `<option value="${escapeHtml(day.id)}">${escapeHtml(label)}</option>`;
  }).join("");
  const selected = currentTripDays.find(day => day.day_date === selectedDayFilter);
  if (selected) select.value = selected.id;
}

function resetActivityForm() {
  editingActivityId = null;
  selectedActivityGooglePlace = null;
  document.getElementById("activityForm")?.reset();
  document.getElementById("activityDialogTitle").textContent = "Aktivität hinzufügen";
  document.getElementById("deleteActivityBtn").hidden = true;
  document.getElementById("activityPlaceSelection").hidden = true;
  document.getElementById("activityFormMessage").textContent = "";
  if (activityPlaceAutocompleteElement) { activityPlaceAutocompleteElement.remove(); activityPlaceAutocompleteElement = null; }
  const host = document.getElementById("activityPlaceAutocomplete"); if (host) host.innerHTML = "";
  initActivityPlaceAutocomplete();
  populateActivityDayOptions();
}

function openActivityDialog(activityId = null) {
  resetActivityForm();
  const dialog = document.getElementById("activityDialog");
  if (activityId) {
    const activity = activities.find(item => item.id === activityId);
    if (!activity) return;
    editingActivityId = activity.id;
    document.getElementById("activityDialogTitle").textContent = "Aktivität bearbeiten";
    document.getElementById("activityName").value = activity.name || "";
    document.getElementById("activityDay").value = activity.trip_day_id || "";
    document.getElementById("activityStartTime").value = activity.start_time?.slice(0,5) || "";
    document.getElementById("activityEndTime").value = activity.end_time?.slice(0,5) || "";
    document.getElementById("activityStatus").value = activity.status || "planned";
    document.getElementById("activityNote").value = activity.note || "";
    document.getElementById("activityBookingUrl").value = activity.booking_url || "";
    document.getElementById("deleteActivityBtn").hidden = false;
    const selection = document.getElementById("activityPlaceSelection"); selection.hidden = false;
    selection.innerHTML = `<strong>📍 ${escapeHtml(activity.meeting_place_name || "Treffpunkt")}</strong><span>${escapeHtml(activity.address || "")}</span><span>Für einen anderen Treffpunkt oben neu suchen.</span>`;
  }
  dialog.showModal();
}

function closeActivityDialog() { document.getElementById("activityDialog")?.close(); resetActivityForm(); }

async function handleActivitySubmit(event) {
  event.preventDefault();
  const message = document.getElementById("activityFormMessage");
  const existing = editingActivityId ? activities.find(item => item.id === editingActivityId) : null;
  const location = selectedActivityGooglePlace?.location;
  const lat = location ? (typeof location.lat === "function" ? location.lat() : location.lat) : existing?.latitude;
  const lng = location ? (typeof location.lng === "function" ? location.lng() : location.lng) : existing?.longitude;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) { message.textContent = "Bitte einen Treffpunkt über die Google-Suche auswählen."; return; }
  const tripDayId = document.getElementById("activityDay").value;
  const sameDay = activities.filter(item => item.trip_day_id === tripDayId && item.id !== editingActivityId);
  const placeDayDate = currentTripDays.find(day => day.id === tripDayId)?.day_date;
  const placeOrders = placesData.places.filter(place => (state.places[place.id] || {}).plannedDay === placeDayDate).map(place => Number((state.places[place.id] || {}).plannedOrder) || 0);
  const nextOrder = existing?.planned_order || Math.max(0, ...sameDay.map(a => Number(a.planned_order)||0), ...placeOrders) + 1;
  const row = {
    trip_id: currentTripId, trip_day_id: tripDayId,
    name: document.getElementById("activityName").value.trim(),
    start_time: document.getElementById("activityStartTime").value || null,
    end_time: document.getElementById("activityEndTime").value || null,
    status: document.getElementById("activityStatus").value,
    note: document.getElementById("activityNote").value.trim() || null,
    booking_url: document.getElementById("activityBookingUrl").value.trim() || null,
    meeting_place_name: selectedActivityGooglePlace?.displayName || existing?.meeting_place_name,
    address: selectedActivityGooglePlace?.formattedAddress || existing?.address,
    google_place_id: selectedActivityGooglePlace?.id || existing?.google_place_id,
    latitude: Number(lat), longitude: Number(lng), planned_order: nextOrder,
    updated_at: new Date().toISOString()
  };
  const result = editingActivityId
    ? await supabaseClient.from("trip_activities").update(row).eq("id", editingActivityId).eq("trip_id", currentTripId).select().single()
    : await supabaseClient.from("trip_activities").insert(row).select().single();
  if (result.error) { message.textContent = `Speichern fehlgeschlagen: ${result.error.message}`; return; }
  closeActivityDialog();
  await refreshActivitiesFromSupabase();
  setStatus(`🎟️ Aktivität „${row.name}“ gespeichert.`);
}

async function deleteActivity() {
  if (!editingActivityId) return;
  const activity = activities.find(item => item.id === editingActivityId);
  if (!confirm(`„${activity?.name || "Aktivität"}“ wirklich löschen?`)) return;
  const { error } = await supabaseClient.from("trip_activities").delete().eq("id", editingActivityId).eq("trip_id", currentTripId);
  if (error) { document.getElementById("activityFormMessage").textContent = error.message; return; }
  closeActivityDialog(); await refreshActivitiesFromSupabase(); setStatus("🗑️ Aktivität gelöscht.");
}

function getActivitiesForDay(dayDate) {
  const day = currentTripDays.find(item => item.day_date === dayDate);
  if (!day) return [];
  return activities.filter(item => item.trip_day_id === day.id).sort((a,b) => (Number(a.planned_order)||9999)-(Number(b.planned_order)||9999));
}

function openingHoursForTripDay(place, dayId) {
  const raw = String(place?.openingHours || "").trim();
  if (!raw || !dayId) return null;
  const date = new Date(`${dayId}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const names = {
    0: ["Sonntag", "Sunday"], 1: ["Montag", "Monday"], 2: ["Dienstag", "Tuesday"],
    3: ["Mittwoch", "Wednesday"], 4: ["Donnerstag", "Thursday"],
    5: ["Freitag", "Friday"], 6: ["Samstag", "Saturday"]
  };
  const parts = raw.split(/\s*·\s*/).map(x => x.trim()).filter(Boolean);
  const row = parts.find(part => names[date.getDay()].some(name => part.toLowerCase().startsWith(name.toLowerCase())));
  if (!row) return null;
  const value = row.replace(/^[^:]+:\s*/, "").trim();
  return { text: value || row, closed: /geschlossen|closed/i.test(value) };
}

function minutesFromClock(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function plannedOpeningStatus(place, dayId, plannedStartTime) {
  const hours = openingHoursForTripDay(place, dayId);
  if (!hours) return null;
  if (hours.closed) return { kind: "warning", label: "⚠️ geschlossen", detail: hours.text };
  if (!plannedStartTime) return { kind: "info", label: `🕒 ${hours.text}`, detail: hours.text };

  const planned = minutesFromClock(plannedStartTime);
  const ranges = [...hours.text.matchAll(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/g)]
    .map(m => [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])]);
  if (planned == null || !ranges.length) return { kind: "info", label: `🕒 ${hours.text}`, detail: hours.text };
  const range = ranges.find(([start, end]) => planned >= start && planned <= end);
  if (!range) return { kind: "warning", label: "⚠️ außerhalb Öffnungszeit", detail: hours.text };
  const untilClose = range[1] - planned;
  if (untilClose >= 0 && untilClose <= 60) return { kind: "warning", label: `⚠️ schließt ${String(Math.floor(range[1]/60)).padStart(2,"0")}:${String(range[1]%60).padStart(2,"0")}`, detail: hours.text };
  return { kind: "ok", label: "✓ geöffnet", detail: hours.text };
}

function renderDayAgenda() {
  renderTodayView();
  const container = document.getElementById("dayAgenda");
  if (!container) return;
  const selectedDay = TRIP_DAYS.find(day => day.id === selectedDayFilter);
  if (!selectedDay) {
    container.innerHTML = '<div class="agenda-empty">Wähle einen Reisetag aus, um die Tagesagenda zu sehen.</div>';
    return;
  }

  const stops = getRouteStopsForDay(selectedDay.id);
  const dayPlaces = getPlacesForDay(selectedDay.id);
  const dayActivities = getActivitiesForDay(selectedDay.id);
  const visitedCount = dayPlaces.filter(place => (state.places[place.id] || {}).visited).length;
  const progress = dayPlaces.length ? Math.round((visitedCount / dayPlaces.length) * 100) : 0;
  const { legs, totalDistance, totalMinutes } = getAgendaLegs(stops);
  const header = `<div class="agenda-day-header"><div><div class="agenda-day-kicker">Tages-Timeline</div><div class="agenda-day-title">${escapeHtml(selectedDay.label)}</div><div class="agenda-day-stats">${dayPlaces.length} Orte · ${dayActivities.length} Aktivitäten${stops.length > 1 ? ` · 🚶 ca. ${formatRouteDistance(totalDistance)} · ${totalMinutes} Min.` : ""}</div></div><div class="agenda-header-actions"><span class="agenda-progress-badge">${progress}%</span><button id="addActivityAgendaBtn" class="mini-action-button activity-add-button" type="button">＋ Aktivität</button></div></div><div class="agenda-progress-track"><div class="agenda-progress-fill" style="width:${progress}%"></div></div>`;

  if (!stops.length) {
    container.innerHTML = `${header}<div class="agenda-empty">Für ${escapeHtml(selectedDay.label)} ist noch nichts geplant.</div>`;
    document.getElementById("addActivityAgendaBtn")?.addEventListener("click", () => openActivityDialog());
    return;
  }

  const rows = stops.map((stop, index) => {
    const nextLeg = legs[index] || null;
    const legHtml = nextLeg ? `<div class="agenda-leg"><span>🚶</span><span>ca. ${escapeHtml(formatRouteDistance(nextLeg.distanceMeters))} · ${nextLeg.minutes} Min. zum nächsten Punkt</span></div>` : "";

    if (stop.type === "activity") {
      const a = stop.activity;
      const time = [stop.plannedStartTime, stop.plannedEndTime].filter(Boolean).join("–") || "Termin";
      return `<div class="agenda-place-wrap agenda-activity-wrap" data-agenda-key="activity:${a.id}"><div class="agenda-timeline-row"><div class="agenda-time-column"><div class="agenda-time">${escapeHtml(time)}</div><div class="agenda-timeline-dot activity">🎟</div>${index < stops.length - 1 ? '<div class="agenda-timeline-line"></div>' : ""}</div><div class="agenda-content-column"><div class="agenda-item agenda-activity-item" data-activity-id="${a.id}"><button type="button" class="agenda-drag-handle" aria-label="Aktivität verschieben">⋮⋮</button><div class="agenda-main"><div class="agenda-title">🎟️ ${escapeHtml(a.name)}</div><div class="agenda-meta"><span class="activity-status ${a.status}">${a.status === "booked" ? "Gebucht" : "Geplant"}</span> · 📍 ${escapeHtml(a.meeting_place_name || a.address || "Treffpunkt")}</div>${a.note ? `<div class="agenda-activity-note">${escapeHtml(a.note)}</div>` : ""}</div><button type="button" class="agenda-activity-menu" data-action="edit-activity" data-activity-id="${a.id}" title="Aktivität bearbeiten">✎</button></div>${legHtml}</div></div></div>`;
    }

    const place = stop.place;
    const saved = state.places[place.id] || {};
    const time = [stop.plannedStartTime, stop.plannedEndTime].filter(Boolean).join("–");
    const distance = userPosition ? distanceToPlace(place) : null;
    const opening = plannedOpeningStatus(place, selectedDay.id, stop.plannedStartTime);
    const openingHtml = opening ? `<div class="agenda-opening-status ${opening.kind}" title="${escapeHtml(opening.detail)}">${escapeHtml(opening.label)}</div>` : "";
    return `<div class="agenda-place-wrap" data-agenda-key="place:${escapeHtml(place.id)}"><div class="agenda-timeline-row"><div class="agenda-time-column"><div class="agenda-time ${time ? "" : "agenda-time-open"}">${time ? escapeHtml(time) : "offen"}</div><div class="agenda-timeline-dot ${saved.visited ? "visited" : ""}">${saved.visited ? "✓" : index + 1}</div>${index < stops.length - 1 ? '<div class="agenda-timeline-line"></div>' : ""}</div><div class="agenda-content-column"><div class="agenda-item ${saved.visited ? "agenda-item-visited" : ""}" data-place-id="${place.id}"><button type="button" class="agenda-drag-handle" aria-label="${escapeHtml(place.name)} verschieben">⋮⋮</button><div class="agenda-main"><div class="agenda-title">${CATEGORY_ICONS[place.category] || "•"} ${escapeHtml(place.name)}</div><div class="agenda-meta">${escapeHtml(categoryLabel(place.category))}${distance != null ? ` · 📍 ${escapeHtml(formatDistance(distance))} entfernt` : ""}${saved.visited ? " · ✓ besucht" : ""}</div>${openingHtml}</div><button type="button" class="agenda-visited-button ${saved.visited ? "visited" : ""}" data-action="toggle-visited" data-place-id="${place.id}">${saved.visited ? "✓" : "○"}</button></div>${legHtml}</div></div></div>`;
  }).join("");

  container.innerHTML = `${header}<div class="agenda-timeline">${rows}</div><div class="agenda-estimate-note">🚶 Gehzeiten sind kompakte Luftlinien-Schätzungen. Die Navigation verwendet weiterhin die echte Google-Fußroute.</div>`;
  document.getElementById("addActivityAgendaBtn")?.addEventListener("click", () => openActivityDialog());
  wireAgendaDragAndDrop(container, selectedDay.id);
  container.querySelectorAll(".agenda-item[data-place-id]").forEach(item => item.addEventListener("click", event => {
    if (event.target.closest("[data-action],.agenda-drag-handle")) return;
    const place = placesData.places.find(p => p.id === item.dataset.placeId);
    if (place) focusExistingPlaceOnMap(place);
  }));
  container.querySelectorAll(".agenda-activity-item").forEach(item => item.addEventListener("click", event => {
    if (event.target.closest("button")) return;
    const activity = activities.find(x => x.id === item.dataset.activityId);
    if (activity) focusActivityOnMap(activity);
  }));
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
      <div class="place-card-meta">
        ${escapeHtml(categoryLabel(place.category))}
        ${userPosition && distanceToPlace(place) != null ? ` · 📍 ${escapeHtml(formatDistance(distanceToPlace(place)))} entfernt` : ""}
        ${saved.plannedDay ? ` · 🗓️ ${escapeHtml(dayLongLabel(saved.plannedDay))}` : ""}
        ${saved.plannedDay && formatPlannedTime(saved) ? ` · 🕐 ${escapeHtml(formatPlannedTime(saved))}` : ""}
        ${saved.visited ? " · ✓ besucht" : ""}
      </div>
      ${place.notes ? `<div class="place-card-note">${escapeHtml(place.notes)}</div>` : ""}
    `;

    card.addEventListener("click", event => {
      if (event.target.closest("[data-action], [data-stop-place-click]")) return;

      // Ein Klick auf einen Ort aus der Orte-Liste soll immer den Ort selbst
      // fokussieren – unabhängig davon, wo die Karte vorher stand (z. B. am
      // aktuellen Standort in Deutschland). focusExistingPlaceOnMap wartet
      // mobil erst auf das geschlossene Bottom-Sheet und setzt anschließend
      // den Kartenmittelpunkt direkt auf die Koordinaten des Ortes.
      focusExistingPlaceOnMap(place);
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

function createClusterMarker({ count, position }, _stats, clusterMap) {
  const element = document.createElement("div");
  element.className = "map-marker-cluster";
  element.textContent = String(count);
  element.setAttribute("aria-label", `${count} Orte in diesem Bereich`);

  const clusterMarker = new AdvancedMarkerElement({
    position,
    content: element,
    zIndex: 1000 + Number(count || 0),
    title: `${count} Orte`,
    gmpClickable: true
  });

  // AdvancedMarkerElement uses DOM-style gmp events. MarkerClusterer's
  // onClusterClick currently attaches the legacy Maps addListener("click")
  // handler to the rendered AdvancedMarkerElement, which causes Google's
  // console warning. Handle the cluster click directly instead.
  clusterMarker.addEventListener("gmp-click", () => {
    const target = normalizeLatLng(position);
    if (!target || !clusterMap) return;
    clusterMap.setCenter(target);
    clusterMap.setZoom(Math.min((Number(clusterMap.getZoom()) || 0) + 2, 20));
  });

  return clusterMarker;
}

function ensureMarkerClusterer() {
  if (placeMarkerClusterer || !map || !window.markerClusterer?.MarkerClusterer) return placeMarkerClusterer;

  placeMarkerClusterer = new window.markerClusterer.MarkerClusterer({
    map,
    markers: [],
    renderer: { render: createClusterMarker },
    // Disable MarkerClusterer's built-in click handler. With an
    // AdvancedMarkerElement it registers the legacy Maps "click" event via
    // addListener(), which triggers Google's console warning. Our renderer
    // handles cluster interaction with the native "gmp-click" event above.
    onClusterClick: null
  });
  return placeMarkerClusterer;
}

function syncVisibleMarkers(visibleIds) {
  const visibleMarkers = [];
  for (const [id, marker] of markers) {
    // MarkerClusterer controls map assignment for place markers. Keeping this
    // in one place avoids stale clusters after filters/day changes.
    marker.map = null;
    if (visibleIds.has(id)) visibleMarkers.push(marker);
  }

  const clusterer = ensureMarkerClusterer();
  if (!clusterer) {
    visibleMarkers.forEach(marker => { marker.map = map; });
    return;
  }

  clusterer.clearMarkers(true);
  clusterer.addMarkers(visibleMarkers, true);
  clusterer.render();
}

function syncActivityMarkerVisibility() {
  for (const activity of activities) {
    const marker = activityMarkers.get(activity.id);
    if (!marker) continue;
    const activityDate = activityDayDate(activity);
    const visible = selectedDayFilter === "all"
      ? true
      : selectedDayFilter === "unplanned"
        ? false
        : activityDate === selectedDayFilter;
    marker.map = visible ? map : null;
  }
}

function applyFilters() {
  const filtered = getFilteredPlaces();

  const visibleIds = new Set(filtered.map(p => p.id));
  syncVisibleMarkers(visibleIds);
  syncActivityMarkerVisibility();

  renderPlaceList(filtered);
  renderDayAgenda();
  refreshAllMarkerAppearances();
  updateDayCounts();
}

function fitVisibleMarkers() {
  const visibleIds = new Set(getFilteredPlaces().map(place => place.id));
  const visible = [...markers.entries()]
    .filter(([id]) => visibleIds.has(id))
    .map(([, marker]) => marker);

  if (!visible.length) return;

  const bounds = new google.maps.LatLngBounds();
  visible.forEach(marker => {
    const position = getMarkerPosition(marker);
    if (position) bounds.extend(position);
  });
  map.fitBounds(bounds, 60);
}


async function buildBackupPayload() {
  if (!supabaseClient || !currentUser || !currentTripId) {
    throw new Error("Für ein Datenbank-Backup musst du angemeldet sein und eine Reise geladen haben.");
  }

  const [tripResult, daysResult, relationsResult, tryItemsResult, activitiesResult] = await Promise.all([
    supabaseClient.from("trips").select("*").eq("id", currentTripId).single(),
    supabaseClient.from("trip_days").select("*").eq("trip_id", currentTripId).order("day_date"),
    supabaseClient.from("trip_places").select("*").eq("trip_id", currentTripId),
    supabaseClient.from("trip_try_items").select("*").eq("trip_id", currentTripId).order("created_at"),
    supabaseClient.from("trip_activities").select("*").eq("trip_id", currentTripId).order("planned_order")
  ]);

  if (tripResult.error) throw tripResult.error;
  if (daysResult.error) throw daysResult.error;
  if (relationsResult.error) throw relationsResult.error;
  if (tryItemsResult.error) throw tryItemsResult.error;
  if (activitiesResult.error) throw activitiesResult.error;

  const placeIds = [...new Set((relationsResult.data || []).map(row => row.place_id).filter(Boolean))];
  let dbPlaces = [];
  if (placeIds.length) {
    const placesResult = await supabaseClient.from("places").select("*").in("id", placeIds).order("name");
    if (placesResult.error) throw placesResult.error;
    dbPlaces = placesResult.data || [];
  }

  return {
    app: "Travel Planner",
    backupVersion: 2,
    backupType: "supabase-trip",
    appVersion: APP_VERSION.replace(/^v/i, ""),
    exportedAt: new Date().toISOString(),
    supabase: {
      trip: tripResult.data,
      tripDays: daysResult.data || [],
      tripPlaces: relationsResult.data || [],
      places: dbPlaces,
      tryItems: tryItemsResult.data || [],
      activities: activitiesResult.data || []
    }
  };
}

async function exportBackup() {
  const button = document.getElementById("exportBackupButton");
  const originalText = button?.textContent;
  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Backup wird erstellt …";
    }
    setStatus("💾 Datenbank-Backup wird erstellt …");
    const payload = await buildBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const tripName = payload.supabase.trip?.name || "reise";
    const safeTripName = tripName
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "reise";
    link.download = `${safeTripName}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(`💾 Datenbank-Backup exportiert · ${payload.supabase.places.length} Orte.`);
  } catch (error) {
    console.error("Backup-Export:", error);
    setStatus(`⚠️ Backup konnte nicht exportiert werden: ${error.message}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function validateBackupPayload(payload) {
  if (!payload || !["Budapest Map", "Travel Planner"].includes(payload.app)) {
    throw new Error("Die Datei ist kein unterstütztes Travel-Planner-Backup.");
  }

  if (payload.backupVersion === 1) {
    if (!payload.data || typeof payload.data !== "object" || !payload.data.places) {
      throw new Error("Im alten Backup fehlen Planungsdaten.");
    }
    return { version: 1, payload };
  }

  if (payload.backupVersion !== 2 || payload.backupType !== "supabase-trip") {
    throw new Error("Diese Backup-Version wird nicht unterstützt.");
  }

  const db = payload.supabase;
  if (!db || !db.trip || !Array.isArray(db.tripDays) || !Array.isArray(db.tripPlaces) || !Array.isArray(db.places) || (db.tryItems != null && !Array.isArray(db.tryItems)) || (db.activities != null && !Array.isArray(db.activities))) {
    throw new Error("Im Datenbank-Backup fehlen erforderliche Tabellen oder Reisedaten.");
  }
  if (!db.trip.id || !db.trip.name) throw new Error("Die Reise im Backup ist unvollständig.");
  if (db.places.length > 5000 || db.tripDays.length > 1000 || db.tripPlaces.length > 10000) {
    throw new Error("Das Backup enthält unerwartet viele Datensätze und wurde aus Sicherheitsgründen abgebrochen.");
  }

  const placeIds = new Set(db.places.map(row => row?.id).filter(Boolean));
  const dayIds = new Set(db.tripDays.map(row => row?.id).filter(Boolean));
  for (const row of db.tripPlaces) {
    if (!row?.place_id || !placeIds.has(row.place_id)) throw new Error("Das Backup enthält eine ungültige Ortszuordnung.");
    if (row.trip_day_id && !dayIds.has(row.trip_day_id)) throw new Error("Das Backup enthält eine ungültige Tageszuordnung.");
  }

  return { version: 2, payload };
}

function cleanBackupRow(row, excluded = []) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const blocked = new Set(["__proto__", "prototype", "constructor", ...excluded]);
  return Object.fromEntries(Object.entries(row).filter(([key]) => !blocked.has(key)));
}

async function restoreSupabaseBackup(payload) {
  if (!supabaseClient || !currentUser || !currentTripId) {
    throw new Error("Für den Import musst du angemeldet sein und eine Reise geladen haben.");
  }

  const db = payload.supabase;
  const targetTripId = currentTripId;
  const sourceTripId = db.trip.id;

  // Ein Restore darf ausschließlich in genau die Reise zurückgeschrieben werden,
  // aus der das Backup stammt. Das verhindert, dass z. B. ein Budapest-Backup
  // versehentlich eine später geöffnete Rom-Reise überschreibt.
  if (sourceTripId !== targetTripId) {
    const { data: targetTrip, error: targetTripError } = await supabaseClient
      .from("trips")
      .select("id,name")
      .eq("id", targetTripId)
      .single();
    if (targetTripError) throw targetTripError;
    throw new Error(`Dieses Backup gehört zur Reise „${db.trip.name}“. Aktuell geöffnet ist „${targetTrip?.name || "Unbekannte Reise"}“. Der Import wurde abgebrochen.`);
  }

  const tripUpdate = cleanBackupRow(db.trip, ["id", "created_at"]);
  const { error: tripError } = await supabaseClient.from("trips").update({
    ...tripUpdate,
    updated_at: new Date().toISOString()
  }).eq("id", targetTripId);
  if (tripError) throw tripError;

  // Orte zuerst wiederherstellen, damit alle Fremdschlüssel der Planung gültig sind.
  if (db.places.length) {
    const placeRows = db.places.map(row => cleanBackupRow(row)).filter(Boolean);
    const { error: placesError } = await supabaseClient.from("places").upsert(placeRows, { onConflict: "id" });
    if (placesError) throw placesError;
  }

  // Reisetage behalten ihre IDs aus dem Backup, werden aber der aktuell geöffneten Reise zugeordnet.
  if (db.tripDays.length) {
    const dayRows = db.tripDays.map(row => ({
      ...cleanBackupRow(row),
      trip_id: targetTripId
    }));
    const { error: daysError } = await supabaseClient.from("trip_days").upsert(dayRows, { onConflict: "id" });
    if (daysError) throw daysError;
  }

  // Der Restore ersetzt die Ortszuordnungen der aktuellen Reise. Die globalen
  // Ortsdatensätze selbst werden dabei nicht gelöscht, weil sie später auch von
  // anderen Reisen verwendet werden können.
  const { error: clearRelationsError } = await supabaseClient.from("trip_places").delete().eq("trip_id", targetTripId);
  if (clearRelationsError) throw clearRelationsError;

  if (db.tripPlaces.length) {
    const relationRows = db.tripPlaces.map(row => ({
      ...cleanBackupRow(row, ["id", "created_at"]),
      trip_id: targetTripId,
      updated_at: new Date().toISOString()
    }));
    const { error: relationsError } = await supabaseClient.from("trip_places").upsert(relationRows, { onConflict: "trip_id,place_id" });
    if (relationsError) throw relationsError;
  }

  const { error: clearTryItemsError } = await supabaseClient.from("trip_try_items").delete().eq("trip_id", targetTripId);
  if (clearTryItemsError) throw clearTryItemsError;
  if ((db.tryItems || []).length) {
    const tryRows = db.tryItems.map(row => ({ ...cleanBackupRow(row), trip_id: targetTripId }));
    const { error: tryItemsError } = await supabaseClient.from("trip_try_items").upsert(tryRows, { onConflict: "id" });
    if (tryItemsError) throw tryItemsError;
  }

  const { error: clearActivitiesError } = await supabaseClient.from("trip_activities").delete().eq("trip_id", targetTripId);
  if (clearActivitiesError) throw clearActivitiesError;
  if ((db.activities || []).length) {
    const activityRows = db.activities.map(row => ({ ...cleanBackupRow(row), trip_id: targetTripId }));
    const { error: activitiesError } = await supabaseClient.from("trip_activities").upsert(activityRows, { onConflict: "id" });
    if (activitiesError) throw activitiesError;
  }

  console.info(`Supabase-Backup wiederhergestellt: ${db.places.length} Orte, ${db.tripPlaces.length} Zuordnungen; Quelle ${sourceTripId}, Ziel ${targetTripId}.`);
}

async function importBackupFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    window.alert("Backup konnte nicht importiert werden:\nDie Datei ist größer als 10 MB.");
    return;
  }

  try {
    const payload = JSON.parse(await file.text());
    const validated = validateBackupPayload(payload);

    if (validated.version === 1) {
      if (!window.confirm("Altes Backup (v1) importieren?\n\nDieses Backup stammt noch aus der lokalen Version. Es wird nur in den lokalen Browser-Speicher importiert und NICHT nach Supabase geschrieben.")) return;
      state = payload.data;
      saveState();
      setStatus("📥 Altes lokales Backup importiert. App wird neu geladen …");
      window.setTimeout(() => window.location.reload(), 400);
      return;
    }

    const db = payload.supabase;

    // Vor der Bestätigung prüfen, ob das Backup zur aktuell geöffneten Reise gehört.
    if (!currentTripId) throw new Error("Es ist keine Reise geöffnet.");
    const { data: activeTrip, error: activeTripError } = await supabaseClient
      .from("trips")
      .select("id,name")
      .eq("id", currentTripId)
      .single();
    if (activeTripError) throw activeTripError;
    if (db.trip.id !== activeTrip.id) {
      throw new Error(`Dieses Backup gehört zur Reise „${db.trip.name}“. Aktuell geöffnet ist „${activeTrip.name}“. Bitte öffne zuerst die passende Reise.`);
    }

    const message = [
      "Datenbank-Backup nach Supabase importieren?",
      "",
      `Reise: ${db.trip.name}`,
      `Orte: ${db.places.length}`,
      `Reisetage: ${db.tripDays.length}`,
      `Planungs-Zuordnungen: ${db.tripPlaces.length}`,
      `Probierliste: ${(db.tryItems || []).length}`,
      `Aktivitäten: ${(db.activities || []).length}`,
      "",
      "Die aktuelle Reiseplanung in Supabase wird durch den Stand aus dem Backup ersetzt. Globale Orte anderer Reisen werden nicht gelöscht."
    ].join("\n");
    if (!window.confirm(message)) return;

    setStatus("📥 Datenbank-Backup wird nach Supabase geschrieben …");
    suppressSupabaseSync = true;
    try {
      await restoreSupabaseBackup(payload);
    } finally {
      suppressSupabaseSync = false;
    }

    // Lokale Altstände dürfen den frisch restaurierten Cloud-Stand nicht überlagern.
    localStorage.removeItem("budapestMapState");
    setStatus("📥 Supabase-Backup wiederhergestellt. App wird neu geladen …");
    window.setTimeout(() => window.location.reload(), 600);
  } catch (error) {
    suppressSupabaseSync = false;
    console.error("Backup-Import:", error);
    window.alert(`Backup konnte nicht importiert werden:\n${error.message}`);
  }
}

function wireControls() {
  // Zentrale Event-Delegation statt Inline-onclick/onchange.
  // Das erleichtert eine strikte Content Security Policy und hält dynamisches HTML frei von JavaScript-Handlern.
  document.addEventListener("click", event => {
    const stopContainer = event.target.closest("[data-stop-place-click]");
    if (stopContainer) event.stopPropagation();

    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;

    const { action, placeId, activityId } = actionElement.dataset;
    if (!action) return;
    if (action === "edit-activity" && activityId) { event.stopPropagation(); openActivityDialog(activityId); return; }
    if (!placeId) return;

    if (["toggle-visited", "move-place"].includes(action)) event.stopPropagation();

    if (action === "toggle-visited") {
      toggleVisited(placeId);
    } else if (action === "edit-place") {
      openEditPlaceDialog(placeId);
    } else if (action === "remove-place") {
      removePlaceFromTrip(placeId);
    } else if (action === "move-place") {
      movePlaceInDay(placeId, Number(actionElement.dataset.direction));
    } else if (action === "save-planned-time") {
      const startInput = document.getElementById(`startTime-${placeId}`);
      const endInput = document.getElementById(`endTime-${placeId}`);
      setPlannedTime(placeId, startInput?.value || "", endInput?.value || "");
    } else if (action === "clear-planned-time") {
      clearPlannedTime(placeId);
    }
  });

  document.addEventListener("change", event => {
    const actionElement = event.target.closest('[data-action="set-planned-day"]');
    if (!actionElement) return;
    setPlannedDay(actionElement.dataset.placeId, actionElement.value);
  });
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
  document.getElementById("distanceSortBtn")?.addEventListener("click", toggleDistanceSort);
  document.getElementById("mobileDistanceSortBtn")?.addEventListener("click", toggleDistanceSort);
  document.getElementById("routeToggleBtn").addEventListener("click", toggleDayRoute);
  document.getElementById("routeGoogleBtn").addEventListener("click", () => openDayRouteInGoogleMaps());
  document.getElementById("routeStartMode").addEventListener("change", event => setRouteStartMode(event.target.value));
  document.getElementById("navigationStartBtn")?.addEventListener("click", () => {
    if (navigationActive) stopNavigation();
    else startDayNavigation();
  });
  document.getElementById("navigationTestBtn")?.addEventListener("click", chooseNavigationTestTarget);
  document.getElementById("navigationStopBtn")?.addEventListener("click", () => stopNavigation());
  document.getElementById("navigationPauseBtn")?.addEventListener("click", toggleNavigationPause);
  document.getElementById("navigationSkipBtn")?.addEventListener("click", openNavigationSkipDialog);
  document.getElementById("navigationSkipCloseBtn")?.addEventListener("click", closeNavigationSkipDialog);
  document.getElementById("navigationSuccessCloseBtn")?.addEventListener("click", () => stopNavigation("Ziel erreicht – Navigation beendet."));
document.getElementById("navigationExpandBtn")?.addEventListener("click", () => setNavigationExpanded(!navigationExpanded));
  document.getElementById("navigationRecenterBtn")?.addEventListener("click", () => setNavigationFollowMode(true));
  document.getElementById("navigationHeadingBtn")?.addEventListener("click", () => setNavigationHeadingMode(!navigationHeadingUp));
  document.getElementById("navigationMarkVisitedBtn")?.addEventListener("click", markNavigationArrivalVisited);
  document.getElementById("navigationContinueBtn")?.addEventListener("click", continueDayNavigation);
  const releaseNavigationFollowForMapGesture = () => {
    if (navigationActive && !navigationPaused && navigationFollowMode) setNavigationFollowMode(false);
  };
  // v1.11.9: Follow bereits beim Beginn einer echten Nutzergeste lösen.
  // Auf mobilen Vector Maps kann der nächste GPS-Tick sonst panTo() ausführen,
  // bevor Google Maps ein dragstart meldet. Die Listener sind bewusst passiv:
  // wir beobachten die Geste nur und überlassen Panning/Pinch vollständig Maps.
  const mapElement = document.getElementById("map");
  mapElement?.addEventListener("pointerdown", releaseNavigationFollowForMapGesture, { passive: true, capture: true });
  mapElement?.addEventListener("touchstart", releaseNavigationFollowForMapGesture, { passive: true, capture: true });
  mapElement?.addEventListener("wheel", releaseNavigationFollowForMapGesture, { passive: true, capture: true });
  map?.addListener("dragstart", releaseNavigationFollowForMapGesture);
  map?.addListener("drag", releaseNavigationFollowForMapGesture);
  map?.addListener("zoom_changed", () => {
    // Pinch-/Mausrad-Zoom während der Navigation soll die Karte freigeben.
    // Automatische Zoomänderungen der Navigation lösen den Follow-Modus nicht.
    if (navigationActive && !navigationPaused && navigationFollowMode && !navigationProgrammaticZoom) {
      setNavigationFollowMode(false);
    }
  });
  document.getElementById("addPlaceBtn").addEventListener("click", openAddPlaceDialog);
  document.getElementById("cancelPlaceBtn").addEventListener("click", closeAddPlaceDialog);
  document.getElementById("cancelPlaceBtnBottom").addEventListener("click", closeAddPlaceDialog);
  document.getElementById("addPlaceForm").addEventListener("submit", handleAddPlace);
  document.getElementById("tryItemForm").addEventListener("submit", handleTryItemSubmit);
  document.getElementById("activityForm")?.addEventListener("submit", handleActivitySubmit);
  document.getElementById("cancelActivityBtn")?.addEventListener("click", closeActivityDialog);
  document.getElementById("cancelActivityBtnBottom")?.addEventListener("click", closeActivityDialog);
  document.getElementById("deleteActivityBtn")?.addEventListener("click", deleteActivity);
  document.getElementById("activityDialog")?.addEventListener("click", event => { if (event.target.id === "activityDialog") closeActivityDialog(); });
  document.getElementById("cancelTryItemBtn").addEventListener("click", closeTryItemDialog);
  document.getElementById("cancelTryItemBtnBottom").addEventListener("click", closeTryItemDialog);
  document.getElementById("deleteTryItemBtn").addEventListener("click", deleteTryItem);
  const tryItemDialog = document.getElementById("tryItemDialog");
  tryItemDialog.addEventListener("click", event => { if (event.target === tryItemDialog) closeTryItemDialog(); });

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
    if (!confirm("Tagesplanung und Besucht-Markierungen zurücksetzen?")) return;
    state = { places: {}, try: state.try || {} };
    saveState();
    renderTryListFresh();
    applyFilters();
  });

  const bindMobileViewButton = (id, view) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setMobileView(view);
    });
  };

  bindMobileViewButton("mobileClose", "map");
  bindMobileViewButton("mobileNavMap", "map");
  bindMobileViewButton("mobileNavToday", "today");
  bindMobileViewButton("mobileNavPlan", "plan");
  bindMobileViewButton("mobileNavPlaces", "places");
  bindMobileViewButton("mobileScrim", "map");
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

function isMarkerInSafeViewport(place) {
  const bounds = map?.getBounds?.();
  if (!bounds || !place) return false;

  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  const latSpan = ne.lat() - sw.lat();
  const lngSpan = ne.lng() - sw.lng();
  if (latSpan <= 0 || lngSpan <= 0) return false;

  // Auf Mobilgeräten braucht das Infofenster vor allem oberhalb des Markers Platz.
  // Deshalb ist der obere Sicherheitsabstand größer als unten/seitlich.
  const safeNorth = ne.lat() - latSpan * 0.38;
  const safeSouth = sw.lat() + latSpan * 0.16;
  const safeWest = sw.lng() + lngSpan * 0.14;
  const safeEast = ne.lng() - lngSpan * 0.14;

  return lat >= safeSouth && lat <= safeNorth && lng >= safeWest && lng <= safeEast;
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 820px)").matches;
}

function setMobileView(view) {
  const normalizedView = ["map", "today", "plan", "places"].includes(view) ? view : "map";
  const sidebar = document.querySelector(".sidebar");
  const scrim = document.getElementById("mobileScrim");

  if (!sidebar) return;

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

  // Navigation und Sheet zuerst sichtbar schalten. So kann ein Fehler beim
  // Rendern der Heute-Inhalte das Öffnen des Tabs nicht mehr verhindern.
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

  if (infoWindow && targetView !== "map") {
    activeInfoPlaceId = null;
    infoWindow.close();
  }

  if (targetView === "today") {
    try {
      renderTodayView();
    } catch (error) {
      console.error("Heute-Ansicht konnte nicht gerendert werden:", error);
      const container = document.getElementById("todayOverview");
      if (container) {
        container.innerHTML = '<div class="today-empty">Die Heute-Ansicht konnte nicht geladen werden.</div>';
      }
    }
  }

  if (showSheet) sidebar.scrollTop = 0;

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

function getSafeWebsiteUrl(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return null;

  // Komfort: Domains ohne Protokoll werden als HTTPS behandelt.
  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(rawValue)
    ? rawValue
    : `https://${rawValue}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}



if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", syncVersionLabels, { once: true });
} else {
  syncVersionLabels();
}


// v1.4.0 – Desktop UI: compact sidebar sections and quick actions.
function initDesktopSidebarUi() {
  const addQuick = document.getElementById("desktopAddPlaceBtn");
  const fitQuick = document.getElementById("desktopFitBtn");
  if (addQuick) addQuick.addEventListener("click", () => document.getElementById("addPlaceBtn")?.click());
  if (fitQuick) fitQuick.addEventListener("click", () => document.getElementById("fitBtn")?.click());

  document.querySelectorAll(".desktop-collapsible").forEach(section => {
    const heading = section.querySelector(":scope > .panel-title-row") || section.querySelector(":scope > h2");
    if (!heading) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "desktop-section-toggle desktop-only";
    const defaultOpen = section.dataset.desktopDefaultOpen === "true";
    button.setAttribute("aria-expanded", String(defaultOpen));
    button.innerHTML = '<span aria-hidden="true">⌄</span>';
    heading.classList.add("desktop-collapsible-heading");
    heading.appendChild(button);
    section.classList.toggle("desktop-collapsed", !defaultOpen);
    button.addEventListener("click", event => {
      event.stopPropagation();
      const collapsed = section.classList.toggle("desktop-collapsed");
      button.setAttribute("aria-expanded", String(!collapsed));
    });
    heading.addEventListener("click", event => {
      if (event.target.closest("button") && event.target !== button) return;
      button.click();
    });
  });
}

document.addEventListener("DOMContentLoaded", initDesktopSidebarUi);

// v1.5.0 – Mobile Plan: "In Budapest probieren" is collapsible and closed by default.
function initMobileTryToggle() {
  const section = document.querySelector(".mobile-try-collapsible");
  const button = document.getElementById("mobileTryToggle");
  const heading = section?.querySelector(":scope > h2");
  if (!section || !button || !heading) return;

  const tryList = document.getElementById("tryList");

  const setExpanded = expanded => {
    section.classList.toggle("mobile-try-collapsed", !expanded);
    button.setAttribute("aria-expanded", String(expanded));
    button.setAttribute("aria-label", `In Budapest probieren ${expanded ? "einklappen" : "aufklappen"}`);

    // Mobile uses an explicit inline display state. This avoids the desktop
    // collapsible rules from overriding the mobile section state.
    if (window.innerWidth <= 820 && tryList) {
      if (expanded) {
        tryList.style.removeProperty("display");
      } else {
        tryList.style.setProperty("display", "none", "important");
      }
    }
  };
  setExpanded(false);

  button.addEventListener("click", event => {
    event.stopPropagation();
    setExpanded(section.classList.contains("mobile-try-collapsed"));
  });
  heading.addEventListener("click", event => {
    if (window.innerWidth > 820) return;
    if (event.target.closest("button") && event.target !== button) return;
    if (event.target === button || button.contains(event.target)) return;
    button.click();
  });
}

document.addEventListener("DOMContentLoaded", initMobileTryToggle);

