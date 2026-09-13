# Budapest Map 2026

Persönliche interaktive Reiseplanung für Budapest vom **03.–07.10.2026**.

## Aktueller Stand: v0.8.1

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
