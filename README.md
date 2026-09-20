# Budapest Travel Planner v1.7.0

## Neu: Drag & Drop Tagesplanung
- Orte im ausgewählten Tagesplan über den Griff ⋮⋮ per Maus oder Touch verschieben.
- Neue Reihenfolge wird erst beim Ablegen gespeichert.
- Bestehende `planned_order`-/Supabase-Synchronisierung wird weiterverwendet.
- Tagesroute, Heute-Ansicht und Reihenfolge der Marker folgen anschließend der neuen Planung.
- Keine Datenbankmigration erforderlich.

# Budapest 10/2026 – v1.6.3

Patch: Wiederholter Klick auf denselben bereits sichtbaren Ort öffnet/fokussiert ein bereits geöffnetes InfoWindow nicht erneut. Der aktive InfoWindow-Ort wird explizit nachverfolgt und beim Schließen zurückgesetzt.
