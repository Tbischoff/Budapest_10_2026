# Budapest Map 2026

Persönliche interaktive Reiseplanung für Budapest vom **03.–07.10.2026**.

Die Anwendung läuft als statische Webseite über **GitHub Pages** und verwendet Google Maps.

## Aktueller Stand: v0.7.1

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
- Tagesroute auf der Karte
- Öffnen einer Tagesroute in Google Maps
- AdvancedMarkerElement
- responsive Darstellung

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
    └── tests/
```

Details: `docs/STRUCTURE.md`

## GitHub Pages

Repository:

`https://github.com/Tbischoff/Budapest_10_2026`

GitHub Pages:

`https://tbischoff.github.io/Budapest_10_2026/`

Bereitstellung:

**Settings → Pages → Deploy from a branch → main → /(root)**

Nach Änderungen auf dem Mac kann ein Hard Reload mit

`Cmd + Shift + R`

hilfreich sein.

## Google Maps API

Der API-Key liegt clientseitig in `assets/js/app.js` und ist damit im Browser sichtbar.
Er sollte in der Google Cloud Console unbedingt auf die GitHub-Pages-Domain und die
benötigten APIs beschränkt sein.

## Speicherung

Persönliche Daten liegen aktuell im `localStorage` des jeweiligen Browsers, unter anderem:

- Tageszuordnung
- Reihenfolge
- Uhrzeiten
- Besucht-Status
- eigene Orte
- Geocoding-Cache

Eine geräteübergreifende Datenbank ist für eine spätere Version vorgesehen.

## Entwicklung

Die Entwicklung erfolgt in kleinen Versionen mit anschließender Abnahme.

Aktuell:

- v0.7: Tagesroute
- **v0.7.1: Projektstruktur**
- geplant: v0.8 Mobile UI / Bedienoptimierung

Abnahmetests liegen unter `docs/tests/`.
