
const APP_VERSION = "v1.6.0";

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
let todayRouteClickMode = "planned";
let todayRouteTargetId = null;
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

  // On mobile the add dialog/sheet changes the visible map viewport while it
  // closes. A panTo() started during that transition can be recalculated by
  // Google Maps and appear as a vertical jump only. First return to the map,
  // wait until the layout has settled, notify Maps about the resize and then
  // set the destination explicitly.
  if (isMobileLayout()) {
    if (currentMobileView !== "map") setMobileView("map");
  }

  const marker = markers.get(place.id);
  const position = marker ? getMarkerPosition(marker) : normalizeLatLng({ lat: place.lat, lng: place.lng });
  if (!position) {
    console.warn("Vorhandener Ort hat keine gültige Kartenposition:", place);
    if (openInfo) openPlace(place);
    return;
  }

  const applyFocus = () => {
    google.maps.event.trigger(map, "resize");
    map.setCenter(position);
    map.setZoom(Math.max(Number(map.getZoom()) || 0, 16));
  };

  // First frame: map view is selected. Second pass: mobile dialog/sheet CSS
  // transitions are finished. setCenter (rather than panTo) is intentional for
  // long-distance jumps such as Koblenz -> Budapest.
  requestAnimationFrame(() => {
    applyFocus();
    window.setTimeout(() => {
      applyFocus();
      if (openInfo) {
        google.maps.event.addListenerOnce(map, "idle", () => openPlace(place));
        // If the map was already idle after setCenter, still open reliably.
        window.setTimeout(() => {
          if (!infoWindow?.getMap?.()) openPlace(place);
        }, 250);
      }
    }, isMobileLayout() ? 380 : 40);
  });
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
  infoWindow = new google.maps.InfoWindow({ disableAutoPan: true });

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

  const nextCard = nextPlace ? `
    <div class="today-next-card">
      <div class="today-card-label">Nächster Ort</div>
      <button class="today-next-main" type="button" data-today-show-place="${escapeHtml(nextPlace.id)}">
        <span class="today-next-icon">${CATEGORY_ICONS[nextPlace.category] || "📍"}</span>
        <span><strong>${escapeHtml(nextPlace.name)}</strong><small>${escapeHtml(categoryLabel(nextPlace.category))}${formatPlannedTime(state.places[nextPlace.id] || {}) ? ` · ${escapeHtml(formatPlannedTime(state.places[nextPlace.id] || {}))}` : ""}</small></span>
        <span class="today-chevron">›</span>
      </button>
      <div class="today-next-actions">
        <button id="todayRouteButton" class="primary-button today-action-button" type="button">🧭 Route anzeigen</button>
        <button id="todayMapButton" class="secondary-button today-action-button" type="button" data-today-show-place="${escapeHtml(nextPlace.id)}">🗺️ Auf Karte</button>
      </div>
    </div>` : `
    <div class="today-complete-card">✓ ${dayPlaces.length ? "Tagesplan abgeschlossen – alle Orte besucht." : "Für diesen Tag sind noch keine Orte geplant."}</div>`;

  container.innerHTML = `
    ${preview ? '<div class="today-preview-note">Vorschau · Die Reise hat noch nicht begonnen</div>' : ''}
    <div class="today-day-card">
      <div><div class="today-kicker">${preview ? "Erster Reisetag" : "Heute"}</div><h2>${escapeHtml(formatTodayDayTitle(day))}</h2><div class="today-day-label">${escapeHtml(day.label)}</div></div>
      <span class="today-day-number">Tag ${dayIndex}</span>
    </div>
    ${nextCard}
    <div class="today-plan-card">
      <div class="today-plan-head"><strong>${preview ? "Planung" : "Heutige Planung"}</strong><span>${visitedCount} von ${dayPlaces.length} erledigt</span></div>
      <div class="today-progress"><span style="width:${progress}%"></span></div>
      <div class="today-timeline">${timeline || '<div class="today-empty">Noch keine Programmpunkte geplant.</div>'}</div>
      <button id="todayOpenPlanButton" class="secondary-button today-open-plan" type="button">☷ Gesamten Tagesplan öffnen</button>
    </div>`;

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

  container.querySelectorAll("[data-today-toggle]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const item = ensurePlaceState(button.dataset.todayToggle);
      item.visited = !item.visited;
      saveState();
      applyFilters();
    });
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

function renderDayAgenda() {
  renderTodayView();
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
      <div class="agenda-day-header">
        <div>
          <div class="agenda-day-kicker">Tagesplan</div>
          <div class="agenda-day-title">${escapeHtml(selectedDay.label)}</div>
        </div>
        <div class="agenda-progress-badge">0 Orte</div>
      </div>
      <div class="agenda-empty">
        Für ${escapeHtml(selectedDay.label)} sind noch keine Orte geplant.
      </div>
    `;
    return;
  }

  const visitedCount = dayPlaces.filter(place => Boolean((state.places[place.id] || {}).visited)).length;
  const openCount = dayPlaces.length - visitedCount;
  const timedCount = dayPlaces.filter(place => Boolean(formatPlannedTime(state.places[place.id] || {}))).length;
  const progressPercent = Math.round((visitedCount / dayPlaces.length) * 100);
  const { legs, totalDistance, totalMinutes } = getAgendaLegs(dayPlaces);

  const agendaHtml = dayPlaces.map((place, index) => {
    const saved = state.places[place.id] || {};
    const time = formatPlannedTime(saved);
    const distance = userPosition ? distanceToPlace(place) : null;
    const leg = legs[index];
    const category = categoryLabel(place.category);

    return `
      <div class="agenda-place-wrap">
        <div class="agenda-timeline-row">
          <div class="agenda-time-column">
            <div class="agenda-time ${time ? "" : "agenda-time-open"}">${time ? escapeHtml(time) : "offen"}</div>
            <div class="agenda-timeline-dot ${saved.visited ? "visited" : ""}">${saved.visited ? "✓" : index + 1}</div>
            ${index < dayPlaces.length - 1 ? '<div class="agenda-timeline-line"></div>' : ""}
          </div>
          <div class="agenda-content-column">
            <div class="agenda-item ${saved.visited ? "agenda-item-visited" : ""}" data-place-id="${place.id}">
              <div class="agenda-main">
                <div class="agenda-title">${CATEGORY_ICONS[place.category] || "•"} ${escapeHtml(place.name)}</div>
                <div class="agenda-meta">
                  ${escapeHtml(category)}
                  ${distance != null ? ` · 📍 ${escapeHtml(formatDistance(distance))} entfernt` : ""}
                  ${saved.visited ? " · ✓ besucht" : ""}
                </div>
              </div>
              <button
                type="button"
                class="agenda-visited-button ${saved.visited ? "visited" : ""}"
                title="${saved.visited ? "Als nicht besucht markieren" : "Als besucht markieren"}"
                data-action="toggle-visited" data-place-id="${place.id}"
              >${saved.visited ? "✓" : "○"}</button>
            </div>
            ${leg ? `
              <div class="agenda-leg">
                <span>↓</span>
                <span>ca. 🚶 ${escapeHtml(formatDistance(leg.distanceMeters))} · ${leg.minutes} Min.</span>
              </div>
            ` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="agenda-day-header">
      <div>
        <div class="agenda-day-kicker">Tagesplan</div>
        <div class="agenda-day-title">${escapeHtml(selectedDay.label)}</div>
        <div class="agenda-day-stats">${dayPlaces.length} ${dayPlaces.length === 1 ? "Ort" : "Orte"} · ${visitedCount} besucht · ${openCount} offen${timedCount < dayPlaces.length ? ` · ${dayPlaces.length - timedCount} ohne Uhrzeit` : ""}</div>
      </div>
      <div class="agenda-progress-badge">${progressPercent}%</div>
    </div>
    <div class="agenda-progress-track" aria-label="${visitedCount} von ${dayPlaces.length} Orten besucht">
      <div class="agenda-progress-fill" style="width:${progressPercent}%"></div>
    </div>
    <div class="agenda-timeline">
      ${agendaHtml}
    </div>
    <div class="agenda-summary">
      <strong>${dayPlaces.length} ${dayPlaces.length === 1 ? "Ort" : "Orte"}</strong>
      ${dayPlaces.length > 1
        ? `<span>ca. 🚶 ${escapeHtml(formatDistance(totalDistance))} · ${formatRouteDuration(totalMinutes * 60 * 1000)}</span>`
        : `<span>Noch keine Wegstrecke</span>`}
    </div>
    <div class="agenda-estimate-note">
      Wege in der Timeline sind Luftlinien-Schätzungen. Die genaue Fußroute wird über „Fußroute anzeigen“ berechnet.
    </div>
  `;

  container.querySelectorAll(".agenda-item").forEach(item => {
    item.addEventListener("click", event => {
      if (event.target.closest("[data-action]")) return;
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

    card.addEventListener("click", event => {
      if (event.target.closest("[data-action], [data-stop-place-click]")) return;
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


async function buildBackupPayload() {
  if (!supabaseClient || !currentUser || !currentTripId) {
    throw new Error("Für ein Datenbank-Backup musst du angemeldet sein und eine Reise geladen haben.");
  }

  const [tripResult, daysResult, relationsResult, tryItemsResult] = await Promise.all([
    supabaseClient.from("trips").select("*").eq("id", currentTripId).single(),
    supabaseClient.from("trip_days").select("*").eq("trip_id", currentTripId).order("day_date"),
    supabaseClient.from("trip_places").select("*").eq("trip_id", currentTripId),
    supabaseClient.from("trip_try_items").select("*").eq("trip_id", currentTripId).order("created_at")
  ]);

  if (tripResult.error) throw tripResult.error;
  if (daysResult.error) throw daysResult.error;
  if (relationsResult.error) throw relationsResult.error;
  if (tryItemsResult.error) throw tryItemsResult.error;

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
      tryItems: tryItemsResult.data || []
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
  if (!db || !db.trip || !Array.isArray(db.tripDays) || !Array.isArray(db.tripPlaces) || !Array.isArray(db.places) || (db.tryItems != null && !Array.isArray(db.tryItems))) {
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

    const { action, placeId } = actionElement.dataset;
    if (!action || !placeId) return;

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
  document.getElementById("distanceSortBtn").addEventListener("click", toggleDistanceSort);
  document.getElementById("routeToggleBtn").addEventListener("click", toggleDayRoute);
  document.getElementById("routeGoogleBtn").addEventListener("click", () => openDayRouteInGoogleMaps());
  document.getElementById("routeStartMode").addEventListener("change", event => setRouteStartMode(event.target.value));
  document.getElementById("addPlaceBtn").addEventListener("click", openAddPlaceDialog);
  document.getElementById("cancelPlaceBtn").addEventListener("click", closeAddPlaceDialog);
  document.getElementById("cancelPlaceBtnBottom").addEventListener("click", closeAddPlaceDialog);
  document.getElementById("addPlaceForm").addEventListener("submit", handleAddPlace);
  document.getElementById("tryItemForm").addEventListener("submit", handleTryItemSubmit);
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

