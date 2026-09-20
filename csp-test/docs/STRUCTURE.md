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
- lokaler UI-Zustand für die Reiseplanung
- Supabase-Synchronisierung und eigene Orte

### `assets/icons/favicon.svg`
Browser-/Tab-Icon.

## `data/`

Daten der Anwendung.

### `data/places.js`
Enthält nur noch öffentliche Metadaten und `tryInBudapest`. Die eigentlichen Orte werden nach erfolgreicher Anmeldung aus Supabase geladen.

Die frühere Datei `data/places.json` wurde entfernt. Sie war nach der Supabase-Migration ungenutzt und hätte veraltete Ortsdaten öffentlich über GitHub Pages ausgeliefert.

## `docs/`

Technische Dokumentation und Abnahmetests.

### `docs/tests/`
Versionierte Test-/Abnahmebeschreibungen.

## Warum diese Struktur?

Code, Styling, Daten, Icons und Dokumentation sind voneinander getrennt. Das macht spätere
Erweiterungen wie Datenbank, mobile Oberfläche oder PWA deutlich übersichtlicher.
