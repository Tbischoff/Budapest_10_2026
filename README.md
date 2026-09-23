# Budapest Map v1.10.8

Fix: Aktivitäten und Orte verwenden jetzt eine gemeinsame zentrale Routenstopp-Liste.
- trip_day UUID/Datum-Zuordnung für Aktivitäten korrigiert
- Aktivitätsmarker werden bereits beim initialen Kartenaufbau erstellt
- Route ab einem einzigen Ort/Aktivität möglich
- interne Route nutzt bei einem einzelnen Stopp den aktuellen Standort
- Google Maps kann auch mit nur einem Ziel geöffnet werden
- keine Datenbankänderung erforderlich


## v1.10.8
- Routenberechnung auf den browsergeeigneten DirectionsService der Maps JavaScript API umgestellt, um den in GitHub Pages auftretenden CORS-Fehler des Route.computeRoutes-Pfads zu umgehen.
- Gemeinsame Stoppliste aus Orten und Aktivitäten bleibt erhalten.
- Keine Supabase-/SQL-Änderung.
