# Budapest Map 2026

Persönliche interaktive Karte für eine Budapest-Reise vom **03.–07.10.2026**.

Die Anwendung basiert auf **Google Maps**, läuft als statische Webseite über **GitHub Pages** und enthält ausgewählte Restaurants, Cafés, Bars, Sehenswürdigkeiten, Freizeitaktivitäten, Thermen, Aussichtspunkte und Empfehlungen von Locals.

## Funktionen

### Karte und Orte

- Interaktive Google-Maps-Karte
- aktuell rund 57 vorbereitete Orte
- Kategorien für:
  - 🍴 Essen
  - ☕ Café & Süßes
  - 🍸 Bars & Trinken
  - 🏛️ Sehenswürdigkeiten
  - 🎭 Kultur
  - 🌳 Freizeit
  - ♨️ Thermen
  - 🌇 Aussicht
  - 🚇 ÖPNV / Orientierung
  - 📍 Gebiet / Viertel
  - Sonstiges
- Suche nach Orten
- Filter nach Kategorien
- Kennzeichnung von Local-Tipps
- Marker-Clustering für eine übersichtlichere Karte
- Öffnen eines Ortes direkt in Google Maps

### Tagesplanung

Orte können direkt über ihr Infofenster einem Reisetag zugeordnet werden:

- Samstag, 03.10.2026
- Sonntag, 04.10.2026
- Montag, 05.10.2026
- Dienstag, 06.10.2026
- Mittwoch, 07.10.2026

In der Seitenleiste kann anschließend nach einzelnen Tagen gefiltert werden.

Zusätzlich zeigt **„Noch offen“** alle Orte an, die noch keinem Tag zugeordnet wurden.

Die Anzahl der geplanten Orte wird pro Tag angezeigt.

### Eigene Orte hinzufügen

Über **„+ Ort hinzufügen“** können weitere Orte direkt über die Webseite ergänzt werden.

Erfasst werden können:

- Name
- Adresse
- Kategorie
- Notiz
- Local-Tipp

Die Adresse wird über Google Maps geocodiert und anschließend als Marker auf der Karte angezeigt.

Selbst hinzugefügte Orte werden mit 📌 gekennzeichnet und können wieder gelöscht werden.

### Lokale Speicherung

Folgende persönliche Daten werden derzeit über `localStorage` im jeweiligen Browser gespeichert:

- Tageszuordnung
- Besucht-Status
- selbst hinzugefügte Orte
- Checkliste „In Budapest probieren“
- bereits ermittelte Koordinaten

Dadurch ist aktuell **kein Backend und keine Datenbank erforderlich**.

Wichtig: Diese Daten werden nicht zwischen verschiedenen Geräten oder Browsern synchronisiert.

## Projektstruktur

```text
Budapest_10_2026/
├── index.html
├── style.css
├── app.js
├── places.js
├── places.json
└── README.md
```

### `index.html`

Grundstruktur der Benutzeroberfläche.

### `style.css`

Layout und Darstellung der Karte, Seitenleiste, Filter, Dialoge und Tagesplanung.

### `app.js`

Enthält die Anwendungslogik, unter anderem:

- Google Maps
- Marker
- Filter
- Suche
- Geocoding
- lokale Speicherung
- Tagesplanung
- Hinzufügen eigener Orte

### `places.js`

Enthält die vorbereiteten Ortsdaten, die direkt von der Webanwendung geladen werden.

### `places.json`

JSON-Version der Ortsdaten und Datenquelle/Backup für die weitere Pflege.

## Google Maps API

Die Anwendung benötigt einen Google-Maps-API-Key.

In `app.js`:

```javascript
const CONFIG = {
  googleMapsApiKey: "YOUR_GOOGLE_MAPS_API_KEY",
  ...
};
```

Für die Anwendung werden derzeit insbesondere die **Maps JavaScript API** und Funktionen zur Geocodierung verwendet.

### Sicherheit

Da es sich um eine clientseitige Webanwendung handelt, ist ein verwendeter API-Key grundsätzlich im Browser sichtbar.

Der Key sollte deshalb in der Google Cloud Console eingeschränkt werden.

Für GitHub Pages beispielsweise auf:

```text
https://tbischoff.github.io/Budapest_10_2026/*
```

Zusätzlich sollte der Key ausschließlich für die tatsächlich benötigten Google-Maps-APIs freigegeben werden.

## GitHub Pages

Die Anwendung kann direkt über GitHub Pages bereitgestellt werden.

Im Repository:

**Settings → Pages**

```text
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

Nach einem Commit kann es kurz dauern, bis GitHub Pages die neue Version ausliefert.

Bei Problemen mit einer alten zwischengespeicherten Version in Chrome auf macOS:

```text
Cmd + Shift + R
```

## Lokale Verwendung

Die Anwendung kann grundsätzlich auch lokal getestet werden.

Für die produktive Nutzung ist GitHub Pages aufgrund von HTTPS und der einfacheren Google-Maps-Konfiguration die bevorzugte Variante.

## Aktueller Speicheransatz

Die Anwendung verwendet aktuell bewusst keine zentrale Datenbank.

```text
places.js
    ↓
Basis-Orte

Browser localStorage
    ↓
Tagesplanung
Besucht-Status
eigene Orte
Checklisten
```

Das eignet sich gut für Entwicklung und Tests.

Langfristig kann `localStorage` durch eine kleine Datenbank bzw. ein Backend ersetzt werden. Dadurch könnten persönliche Daten zwischen Mac, Smartphone und weiteren Geräten synchronisiert werden.

## Mögliche Weiterentwicklung

Geplante bzw. sinnvolle Erweiterungen sind unter anderem:

- 📍 aktueller Standort
- Entfernung zu gespeicherten Orten
- Sortierung „In meiner Nähe“
- Reihenfolge innerhalb eines Reisetages
- Tagesrouten
- Zeitfenster für Aktivitäten
- zentrale Datenbank statt `localStorage`
- Synchronisation zwischen mehreren Geräten
- Anmeldung / Zugriffsschutz
- bessere mobile Bedienung
- Offline-/PWA-Unterstützung

## Hintergrund

Das Projekt greift die Idee eines älteren Kartenprojekts aus dem Jahr 2014 wieder auf und entwickelt sie als persönliche Reiseplanung für Budapest 2026 weiter.
