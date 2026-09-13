# Budapest Map 2026

Persönliche interaktive Reiseplanung für Budapest vom **03.–07.10.2026**.

Die Anwendung läuft als statische Webseite über **GitHub Pages** und verwendet Google Maps.

## Aktueller Stand: v0.8

Enthalten sind unter anderem:

- interaktive Google-Maps-Karte
- Kategorien und Suche
- Local-Tipps
- eigene Orte hinzufügen
- lokale Speicherung im Browser
- Tagesplanung 03.–07.10.2026
- Reihenfolge innerhalb eines Tages
- optionale Uhrzeiten / Zeitfenster
- aktueller Standort
- Entfernung und Sortierung nach Nähe
- **echte Fußroute eines Tages über die Google Routes API**
- Gesamtdistanz und geschätzte Gehzeit
- Öffnen der Tagesroute in Google Maps
- AdvancedMarkerElement

## Projektstruktur

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

## Google APIs

Für v0.8 werden benötigt:

- Maps JavaScript API
- Geocoding API
- **Routes API**

Beim API-Key müssen diese APIs freigegeben sein. Der Key sollte außerdem auf die
GitHub-Pages-Domain eingeschränkt bleiben.

Details stehen in `docs/GOOGLE_ROUTES_SETUP.md`.

## Tagesroute

Bei einem konkreten Reisetag mit mindestens zwei geplanten Orten kann
**„🚶 Fußroute anzeigen“** ausgewählt werden.

Die Anwendung sendet erst bei diesem Klick eine Anfrage an die Routes API.

Die Route verwendet:

- Start = erster geplanter Ort
- Ziel = letzter geplanter Ort
- Zwischenstopps = alle Orte dazwischen
- Reihenfolge = manuell geplante Reihenfolge
- Reisemodus = `WALKING`

Angezeigt werden zusätzlich Gesamtdistanz und geschätzte Gehzeit.

Google unterstützt bis zu 25 Zwischenstopps, also maximal 27 Orte in einer Route.
Ab 11 Zwischenstopps gelten bei Google andere Abrechnungsbedingungen.

## GitHub Pages

`Settings → Pages → Deploy from a branch → main → /(root)`

Nach Änderungen auf dem Mac kann ein Hard Reload helfen:

`Cmd + Shift + R`

## Speicherung

Persönliche Daten liegen aktuell im `localStorage` des jeweiligen Browsers.

Eine geräteübergreifende Datenbank ist für eine spätere Version vorgesehen.

## Entwicklung

- v0.7: Tagesroute als Planungs-Luftlinie
- v0.7.1: Projektstruktur
- **v0.8: echte Fußroute über Routes API**
- geplant: v0.9 Mobile UI / Bedienoptimierung
