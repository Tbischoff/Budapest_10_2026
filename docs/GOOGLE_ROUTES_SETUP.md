# Google Routes API für v0.8 aktivieren

Für die echte Fußroute benötigt die Anwendung zusätzlich die **Routes API**.

## 1. Google Cloud Console öffnen

Öffne dein bestehendes Projekt für die Budapest Map.

## 2. Routes API aktivieren

Gehe zu:

`APIs & Dienste → Bibliothek`

Suche nach:

`Routes API`

und klicke auf **Aktivieren**.

## 3. API-Key prüfen

Gehe zu:

`APIs & Dienste → Anmeldedaten → dein API-Key`

Unter **API-Einschränkungen** müssen mindestens erlaubt sein:

- Maps JavaScript API
- Geocoding API
- Routes API

Die Anwendungseinschränkung sollte weiterhin auf deine Website begrenzt sein:

`https://tbischoff.github.io/Budapest_10_2026/*`

## 4. Test

Nach dem Deployment:

1. GitHub Pages öffnen.
2. `Cmd + Shift + R`.
3. Einen Tag mit mindestens zwei geplanten Orten auswählen.
4. `🚶 Fußroute anzeigen` anklicken.
5. Prüfen, ob eine Route entlang realer Straßen/Wege erscheint.
6. Distanz und Gehzeit prüfen.

## Hinweis zu Kosten

Eine Routes-Anfrage wird nur ausgelöst, wenn du aktiv auf
`Fußroute anzeigen` klickst.

Google unterstützt bis zu 25 Zwischenstopps. Bei 11 oder mehr Zwischenstopps
gelten höhere Abrechnungsraten.
