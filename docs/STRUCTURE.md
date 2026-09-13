# Projektstruktur

Die Anwendung ist weiterhin eine statische GitHub-Pages-Webanwendung.

## Root

### `index.html`
Einziger Einstiegspunkt der Anwendung. Verlinkt CSS, Daten und JavaScript aus den Unterordnern.

### `README.md`
Projektübersicht und Bedien-/Entwicklungsdokumentation.

## `assets/`

Statische Ressourcen der Benutzeroberfläche.

### `assets/css/style.css`
Komplettes Styling der Anwendung.

### `assets/js/app.js`
Anwendungslogik:
- Google Maps
- Marker
- Filter
- Tagesplanung
- Reihenfolge
- Uhrzeiten
- Standort und Entfernung
- Tagesroute
- lokale Speicherung
- eigene Orte

### `assets/icons/favicon.svg`
Browser-/Tab-Icon.

## `data/`

Daten der Anwendung.

### `data/places.js`
Vom Browser direkt geladene Ortsdaten (`window.BUDAPEST_PLACES_DATA`).

### `data/places.json`
JSON-Version als Datenquelle/Backup für Pflege und spätere Migration in eine Datenbank.

## `docs/`

Technische Dokumentation und Abnahmetests.

### `docs/tests/`
Versionierte Test-/Abnahmebeschreibungen.

## Warum diese Struktur?

Code, Styling, Daten, Icons und Dokumentation sind voneinander getrennt. Das macht spätere
Erweiterungen wie Datenbank, mobile Oberfläche oder PWA deutlich übersichtlicher.


## Zusätzliche technische Dokumentation

### `docs/GOOGLE_ROUTES_SETUP.md`
Einrichtung und Freigabe der Google Routes API für die echte Tagesroute.
