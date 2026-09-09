# Budapest Map 2026

Eine kleine persönliche Web-App für die Budapest-Reise vom 03.–07.10.2026.

## Direkt lokal starten – ohne Python, Node.js oder Webserver

Die Anwendung kann jetzt direkt per Doppelklick gestartet werden.

1. ZIP-Datei entpacken.
2. In `app.js` deinen Google Maps API-Key eintragen.
3. `index.html` doppelklicken.
4. Die Karte öffnet sich im Standardbrowser.

Die Ortsdaten liegen dafür in `places.js` und werden direkt beim Laden der Seite eingebunden.

## Google Maps API-Key eintragen

In `app.js` steht oben:

```js
googleMapsApiKey: "YOUR_GOOGLE_MAPS_API_KEY",
```

Ersetze den Platzhalter durch deinen API-Key:

```js
googleMapsApiKey: "AIza....",
```

## Hinweis zu API-Key-Einschränkungen beim lokalen Test

Wenn dein Schlüssel bereits auf HTTP-Referrer eingeschränkt ist, kann ein direkter Start über
`file://` je nach Google-Konfiguration blockiert werden.

Für einen ersten lokalen Test ist daher am einfachsten:

- den Key zunächst nur auf die benötigten APIs beschränken,
- aber noch keine Website-/HTTP-Referrer-Beschränkung setzen.

Sobald die App über GitHub Pages veröffentlicht wird, solltest du die Website-Beschränkung
aktivieren, z. B.:

```text
https://tbischoff.github.io/*
```

## Funktionen

- Google-Maps-Karte
- Kategorienfilter
- Suche
- Local-Tipps
- Favoriten
- "Besucht"-Status
- "In Budapest probieren"-Checkliste
- Mobile Seitenleiste
- Google-Maps-Navigation per Link
- Automatisches Geocoding fehlender Koordinaten
- Speicherung von Favoriten/Besucht-Status im Browser über `localStorage`

## Dateien

- `index.html` – Startseite
- `style.css` – Gestaltung
- `app.js` – Karten- und Filterlogik
- `places.js` – Ortsdaten
- `places.json` – weiterhin als Datenquelle/Backup enthalten
- `README.md` – diese Anleitung

## Datenmodell

Neue Orte kannst du direkt in `places.js` ergänzen. Für eine saubere Pflege ist `places.json`
weiterhin praktisch; danach kann daraus wieder `places.js` erzeugt werden.

## Nächste sinnvolle Ausbaustufen

- Besuchstage 03.–07.10. als zusätzlicher Filter
- Entfernung vom aktuellen Standort
- Routenplanung für einen Tag
- Favoriten-Export
- Offline-Unterstützung als PWA
