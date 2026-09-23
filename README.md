# Budapest Map v1.10.10

- Tagesfilter zählen Orte und Aktivitäten gemeinsam.
- Aktivitätsmarker folgen dem ausgewählten Reisetag.
- "Alle" zeigt alle Aktivitätsmarker; "Noch offen" bleibt auf Besuchsorte beschränkt.
- Moderne Routes Library wird zusammen mit den Maps-JavaScript-Bibliotheken geladen; kein Legacy DirectionsService.
- Gemeinsame Stoppliste aus Orten und Aktivitäten bleibt Grundlage der Tagesroute.

Keine Supabase-/SQL-Anpassung erforderlich.


## v1.10.10 – Einzelstopp-Verhalten
- Bei genau einem Tagesstopp wird keine künstliche Route vom aktuellen Standort erzeugt.
- Der Button heißt dann `📍 Stopp anzeigen` und fokussiert den Ort bzw. Aktivitätstreffpunkt samt Infofenster.
- Erst ab zwei geplanten Stopps wird `🚶 Fußroute anzeigen` angeboten.
- Google Maps als Routenaktion ist bei nur einem Stopp deaktiviert.
- Der aktuelle Standort wird weiterhin nur verwendet, wenn er ausdrücklich als Routenstart gewählt wurde.
