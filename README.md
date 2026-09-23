# Budapest Travel Planner v1.10.0

## Neu: Aktivitäten im Tagesplan
- Gebuchte/geplante Aktivitäten als eigener Datentyp, getrennt von normalen Besuchsorten.
- Pflicht-Treffpunkt über Google Places mit Name, Adresse, Koordinaten und Google Place ID.
- Eigener violetter 🎟️-Marker auf der Karte; Treffpunkte erscheinen **nicht** in der normalen Orte-Liste.
- Tag, Beginn, optionale Endzeit, Status (Geplant/Gebucht), Notiz und optionaler Buchungs-/Ticket-Link.
- Aktivitäten erscheinen gemeinsam mit Orten in der Tagesagenda und können dort bearbeitet werden.
- Gemischtes Drag & Drop: Orte und Aktivitäten können in einer gemeinsamen Tagesreihenfolge angeordnet werden.
- Realtime-Synchronisation und Backup/Restore für Aktivitäten.

## Vor dem Test einmalig ausführen
`SUPABASE_V1.10.0_ACTIVITIES.sql` separat im Supabase SQL Editor ausführen. Die SQL-Datei ist bewusst **nicht** im Release-ZIP enthalten.
