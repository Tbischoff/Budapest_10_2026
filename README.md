# Budapest Travel Planner v1.9.2

Marker-Clustering auf Basis von v1.8.0:
- nahe Orte werden beim Herauszoomen zu kompakten Clustern zusammengefasst
- Cluster zeigen die Anzahl der enthaltenen Orte
- Klick auf einen Cluster zoomt in den enthaltenen Bereich
- beim Hineinzoomen erscheinen automatisch wieder die einzelnen Marker
- Kategorien, Tagesfilter und Suche aktualisieren die Cluster dynamisch
- aktueller Standort bleibt ein eigener Marker und wird nicht geclustert
- vorhandene Orte→Marker-, Infofenster-, Routen- und Heute-Logik bleibt erhalten

Keine Datenbankmigration erforderlich.


## v1.9.2
- Cluster-Klicks verwenden bei AdvancedMarkerElement jetzt direkt `addEventListener("gmp-click", ...)`.
- Der legacy `addListener("click")`-Pfad des MarkerClusterers wird nicht mehr verwendet; dadurch entfällt die Google-Maps-Konsolenwarnung.
- Klick auf einen Cluster zentriert weiterhin auf den Cluster und zoomt zwei Stufen hinein.
