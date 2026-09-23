# Budapest Map v1.11.0

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


## v1.11.0 – Einzelstopp mit aktuellem Standort
- Bei genau einem Tagesstopp hängt die Aktion jetzt vom gewählten Startpunkt ab.
- `Erster geplanter Stopp`: weiterhin nur `📍 Stopp anzeigen`, keine künstliche Route.
- `Mein aktueller Standort`: `🚶 Fußroute anzeigen` berechnet die Route vom GPS-Standort zum einzelnen Stopp.
- Falls der Standort noch nicht vorliegt, versucht die interne Route ihn anzufordern; bei fehlender Freigabe erscheint ein Hinweis.
- Google Maps kann bei einem Stopp ebenfalls nur mit ausdrücklich gewähltem aktuellem Standort als Route geöffnet werden.

Keine Supabase-/SQL-Anpassung erforderlich.


## v1.11.0 – In-App-Fußnavigation

- Navigation aus einem ausgewählten Reisetag mit Orten und Aktivitäten in der geplanten Reihenfolge.
- Start immer am aktuellen GPS-Standort; ein einzelner Tagesstopp ist damit navigierbar.
- Google Routes Library liefert Route, Legs und einzelne Navigationsschritte.
- Navigationskarte folgt während der aktiven Navigation dem aktuellen Standort.
- Anzeige von nächster Anweisung, Distanz bis zum nächsten Schritt, verbleibender Strecke und Stopp-Fortschritt.
- Testmodus: temporäres Ziel direkt auf der Karte antippen; der Testort wird nicht in Supabase gespeichert.
- Keine Datenbankmigration erforderlich.
- Erste Ausbaustufe: keine automatische Neuberechnung beim Verlassen der Route und keine Sprachansagen.
