# Budapest Map 2026

Persönliche interaktive Reiseplanung für Budapest vom **03.–07.10.2026**.

## Aktueller Stand: v0.9

Neu in v0.8: echte Fußroute eines geplanten Tages über die Google Routes API inklusive Gesamtdistanz und geschätzter Gehzeit.

### Benötigte Google APIs

- Maps JavaScript API
- Geocoding API
- Routes API

Die Route wird erst beim Klick auf **„🚶 Fußroute anzeigen“** berechnet.

### Projektstruktur

```text
Budapest_10_2026/
├── index.html
├── README.md
├── assets/
│   ├── css/style.css
│   ├── js/app.js
│   └── icons/favicon.svg
├── data/
│   ├── places.js
│   └── places.json
└── docs/
    ├── STRUCTURE.md
    ├── GOOGLE_ROUTES_SETUP.md
    └── tests/
```

Details zur Routes API: `docs/GOOGLE_ROUTES_SETUP.md`.


## v0.8.1 Hotfix

Korrektur der Routes-Anfrage:

- ungültiges `units: "METRIC"` entfernt
- Distanz wird weiterhin über `distanceMeters` geliefert
- Anzeige in Meter/Kilometer erfolgt wie bisher durch die Anwendung selbst

Keine fachliche Änderung gegenüber v0.8.


## v0.8.2 – Route ab aktuellem Standort

Für die Tagesroute kann nun als Startpunkt gewählt werden:

- **Erster geplanter Ort**
- **Mein aktueller Standort**

Bei der zweiten Variante wird die zuvor über `📍 Mein Standort` ermittelte Position
als Start verwendet. Danach folgen alle geplanten Orte weiterhin in ihrer manuell
festgelegten Reihenfolge.

Die Auswahl gilt auch für den Button `Google Maps`.


## v0.9 – Mobile UI / Bedienoptimierung

Die mobile Bedienung wurde neu strukturiert, ohne die Desktopansicht wesentlich zu verändern.

### Mobile Navigation

Am unteren Bildschirmrand stehen drei Bereiche zur Verfügung:

- **🗺️ Karte** – maximiert die Kartenansicht
- **📅 Plan** – öffnet Tagesplanung, Reihenfolge und Route als Bottom Sheet
- **📍 Orte** – öffnet Suche, Kategorien, Filter und Ortsliste als Bottom Sheet

### Weitere mobile Anpassungen

- Seitenleiste wurde auf kleinen Displays zu einem Bottom Sheet
- schwebender `📍`-Button für den aktuellen Standort
- größere Touchflächen für Reihenfolge, Filter und Aktionen
- kompaktere Kartenaktionen
- Legende wird mobil ausgeblendet
- Infofenster und „Ort hinzufügen“-Dialog für Touch optimiert

Die Desktopansicht bleibt weiterhin als klassische Seitenleiste erhalten.
