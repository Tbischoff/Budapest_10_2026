# Budapest Map 2026

Persönliche interaktive Reiseplanung für Budapest vom **03.–07.10.2026**.

## Aktueller Stand: v0.9.17

Neu in v0.8: echte Fußroute eines geplanten Tages über die Google Routes API inklusive Gesamtdistanz und geschätzter Gehzeit.

### Benötigte Google APIs

- Maps JavaScript API
- Geocoding API
- Routes API

Die Route wird erst beim Klick auf **„🚶 Fußroute anzeigen“** berechnet.

### Projektstruktur

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

Details zur Routes API: `docs/GOOGLE_ROUTES_SETUP.md`.


## v0.8.1 Hotfix

Korrektur der Routes-Anfrage:

- ungültiges `units: "METRIC"` entfernt
- Distanz wird weiterhin über `distanceMeters` geliefert
- Anzeige in Meter/Kilometer erfolgt wie bisher durch die Anwendung selbst

Keine fachliche Änderung gegenüber v0.8.


## v0.8.2 – Route ab aktuellem Standort

Für die Tagesroute kann nun als Startpunkt gewählt werden:

- **Erster geplanter Ort**
- **Mein aktueller Standort**

Bei der zweiten Variante wird die zuvor über `📍 Mein Standort` ermittelte Position
als Start verwendet. Danach folgen alle geplanten Orte weiterhin in ihrer manuell
festgelegten Reihenfolge.

Die Auswahl gilt auch für den Button `Google Maps`.


## v0.9 – Mobile UI / Bedienoptimierung

Die mobile Bedienung wurde neu strukturiert, ohne die Desktopansicht wesentlich zu verändern.

### Mobile Navigation

Am unteren Bildschirmrand stehen drei Bereiche zur Verfügung:

- **🗺️ Karte** – maximiert die Kartenansicht
- **📅 Plan** – öffnet Tagesplanung, Reihenfolge und Route als Bottom Sheet
- **📍 Orte** – öffnet Suche, Kategorien, Filter und Ortsliste als Bottom Sheet

### Weitere mobile Anpassungen

- Seitenleiste wurde auf kleinen Displays zu einem Bottom Sheet
- schwebender `📍`-Button für den aktuellen Standort
- größere Touchflächen für Reihenfolge, Filter und Aktionen
- kompaktere Kartenaktionen
- Legende wird mobil ausgeblendet
- Infofenster und „Ort hinzufügen“-Dialog für Touch optimiert

Die Desktopansicht bleibt weiterhin als klassische Seitenleiste erhalten.


## v0.9.1 – Android Map Visibility Hotfix

Hotfix für Android/Chrome:

- Kartenfläche wird mobil fest an den Viewport gebunden
- Abhängigkeit von `100dvh` für die sichtbare Kartenfläche entfernt
- Maps-Resize nach Wechsel zwischen Karte/Plan/Orte
- Maps-Resize bei Größen- und Orientierungsänderungen

Keine fachliche Änderung gegenüber v0.9.


## v0.9.2 – Mobile Interaction Hotfix

Behoben wurde ein Z-Index-/Stacking-Context-Problem auf Android.

Der abgedunkelte Hintergrund (`mobileScrim`) lag in v0.9.1 über dem Bottom Sheet
und fing Klicks auf die Inhalte von `Plan` und `Orte` ab.

Jetzt gilt mobil:

- Karte: unterste Ebene
- Scrim: über der Karte
- Bottom Sheet: über dem Scrim
- Bottom Navigation: oberste Ebene


## v0.9.3 – Mobile Auto-Close

Mobile UX-Anpassung:

- Wird im Tab **Plan** ein konkreter Reisetag ausgewählt, schließt sich das Bottom Sheet automatisch.
- Die Anwendung wechselt direkt zurück zur Karte.
- `Alle` und `Noch offen` schließen den Tab bewusst nicht automatisch.
- Kategorien und andere Mehrfachfilter bleiben ebenfalls geöffnet, damit mehrere Auswahländerungen nacheinander möglich sind.


## v0.9.4 – Mobile Auto-Close für Route

Die automatische Rückkehr zur Karte wurde erweitert.

Auf dem Smartphone schließt sich das Bottom Sheet jetzt auch nach:

- **Fußroute anzeigen**
- **Route ausblenden**

Der Button **Google Maps** bleibt unverändert, da er ohnehin eine externe Ansicht bzw. App öffnet.


## v0.9.5 – Mobile UX Refinement

Weitere mobile Bedienverbesserungen:

- erfolgreiche Standortaktualisierung schließt das Bottom Sheet automatisch
- `Plan` und `Orte` sind jetzt Toggle-Tabs:
  - einmal tippen = öffnen
  - erneut tippen = schließen und zur Karte zurückkehren
- beim Öffnen von `Plan` oder `Orte` wird ein offenes Marker-Infofenster geschlossen
- Marker-Infofenster schließen sich zusätzlich beim Tippen auf eine freie Stelle der Karte
- beim Öffnen eines anderen Markers wird das vorherige Infofenster sauber ersetzt


## v0.9.6 – Tagesagenda & Tagesmarker

Die Tagesplanung wurde visuell und funktional erweitert.

### Tagesmarker

Bei Auswahl eines konkreten Reisetages:

- geplante Orte werden direkt mit ihrer Reihenfolge `1, 2, 3, ...` markiert
- Marker des gewählten Tages werden hervorgehoben
- andere Marker werden dezent dargestellt
- bereits besuchte Orte werden transparenter dargestellt

### Tagesagenda

Im Bereich `Plan` erscheint eine kompakte Agenda für den gewählten Tag.

Pro Ort werden angezeigt:

- Reihenfolge
- Name/Kategorie
- optionale Uhrzeit
- Entfernung vom aktuellen Standort
- Besucht-Status

Ein Agenda-Eintrag öffnet direkt den entsprechenden Marker auf der Karte.

Der Besucht-Status kann direkt über den runden Button in der Agenda geändert werden.


## v0.9.7 – Start am aktuellen Standort

Beim Öffnen versucht die Anwendung automatisch den aktuellen Gerätestandort zu ermitteln.

- Freigabe vorhanden → Karte springt zum aktuellen Standort
- keine Freigabe / Standort nicht verfügbar → Budapest bleibt als Fallback
- `🇭🇺 Budapest` zentriert die Karte jederzeit wieder auf Budapest
- Standortmarker und Entfernungen werden bei erfolgreicher Ortung aktualisiert


## v0.9.8 – Tagesagenda final

Die lokale Reiseplanung wird mit dieser Version weiter abgerundet.

### Neu

- Wegabschnitte zwischen den geplanten Orten werden direkt in der Agenda angezeigt
- Distanz und geschätzte Gehzeit je Abschnitt
- Tageszusammenfassung mit Anzahl der Orte, Gesamtstrecke und geschätzter Gehzeit
- besuchte Agenda-Einträge werden deutlich dezenter und durchgestrichen dargestellt
- Klick auf einen Agenda-Ort fokussiert den Marker stärker auf der Karte

Die Werte innerhalb der Agenda sind bewusst schnelle Luftlinien-Schätzungen.
Die tatsächliche Straßen-/Fußwegroute wird weiterhin über die Google Routes API
mit `Fußroute anzeigen` berechnet.


## v0.9.9 – Smart Search

Die Ortssuche reagiert jetzt intelligenter auf eindeutige Treffer.

- **0 Treffer:** kein Kartensprung
- **mehrere Treffer:** normale gefilterte Ergebnisliste
- **genau 1 Treffer:** nach ca. 500 ms Tipp-Pause springt die Karte zum Marker, zoomt hinein und öffnet das Infofenster
- mobil schließt sich dabei der Tab `Orte` automatisch
- mit `Enter` kann ein eindeutiger Treffer sofort geöffnet werden


## v0.9.10 – Suchvorschläge

Die Suche zeigt jetzt direkt unter dem Suchfeld passende Orte an.

- bis zu 8 Vorschläge während der Eingabe
- Anzeige von Name, Kategorie, Adresse und Local-Tipp
- Antippen eines Vorschlags:
  - setzt den Suchbegriff auf den Ortsnamen
  - springt zum Marker
  - zoomt hinein
  - öffnet das Infofenster
  - schließt mobil den Tab `Orte`
- Smart Search bei genau einem Treffer bleibt weiterhin bestehen


## v0.9.11 – Ortsliste direkt unter der Suche

UX-Anpassung im Bereich `Orte`:

- die bisher weiter unten angezeigte Orts-/Trefferliste steht jetzt direkt unter der Suche
- Suchvorschläge erscheinen weiterhin unmittelbar unter dem Eingabefeld
- darunter folgt die vollständige bzw. gefilterte Ortsliste
- Kategorien und weitere Filter folgen anschließend

Damit liegen Suche, Vorschläge und tatsächliche Suchergebnisse räumlich zusammen.


## v0.9.12 – Trefferkarten direkt unter der Suche

Korrektur der Ortsansicht:

- direkt unter dem Suchfeld erscheinen zuerst die Suchvorschläge
- direkt darunter folgen:
  - Überschrift `Orte`
  - Trefferzahl
  - vollständige Trefferkarten mit Name, Kategorie, Entfernung, Planung, Uhrzeit und Beschreibung
- Standort, Kategorien und weitere Filter folgen erst danach

Damit liegen Suchfeld, Vorschläge und tatsächliche Suchergebnisse vollständig zusammen.


## v0.9.13 – Website, Telefon & Öffnungszeiten

Orte unterstützen jetzt drei zusätzliche optionale Felder:

```js
{
  website: "https://example.com",
  phone: "+36 1 234 5678",
  openingHours: "Mo–So 10:00–22:00"
}
```

Die Felder sind optional. Bestehende Orte funktionieren daher unverändert weiter.

Im Marker-Infofenster werden vorhandene Angaben angezeigt. Telefonnummern sind
über `tel:` direkt anwählbar und Websites öffnen sich in einem neuen Tab.


## v0.9.13.1 – Recherchierte Ortsdetails

Die vorhandenen Orte wurden systematisch auf öffentlich verfügbare Kontaktdaten
und Öffnungszeiten geprüft.

- **38 von 57 Orten** wurden mit mindestens einer Zusatzinformation angereichert.
- bevorzugt wurden offizielle Betreiber-/Einrichtungsseiten verwendet
- bei wenigen Orten ohne brauchbare Primärquelle wurden Sekundärquellen verwendet und mit
  `detailsSourceType: "secondary"` gekennzeichnet
- je Ort wird die Recherchequelle in `detailsSource` gespeichert
- Stand der Recherche: **14.09.2026**

Nicht sinnvoll ergänzbare Orte wie Plätze, Brücken, Stadtviertel oder noch nicht eindeutig
identifizierte Einträge bleiben ohne Telefonnummer/Öffnungszeiten.

Hinweis: Öffnungszeiten können sich kurzfristig ändern. Für Reservierungen und
zeitkritische Besuche sollte die verlinkte Website kurz vor dem Besuch erneut geprüft werden.


## v0.9.14 – Google-Ortssuche beim Hinzufügen

`Ort hinzufügen` unterstützt jetzt Google Places Autocomplete.

- Google-Ort suchen und Vorschlag auswählen
- Name und Adresse werden übernommen
- exakte Google-Koordinaten werden für den Marker verwendet
- sofern verfügbar werden Place-ID, Website, Telefonnummer und reguläre Öffnungszeiten gespeichert
- Kategorie, Notiz und Local-Tipp bleiben eigene App-Daten
- die manuelle Eingabe bleibt als Fallback erhalten

### Voraussetzung
Im vorhandenen Google-Cloud-Projekt muss zusätzlich **Places API (New)** aktiviert sein.
Die Suche ist für den Budapest-Piloten zunächst auf Ungarn begrenzt.


## v0.9.15 – Heute

In der Tagesplanung gibt es jetzt `📅 Heute`.

- während einer Reise wird anhand des lokalen Gerätedatums automatisch der passende Reisetag gewählt
- Tagesfilter, Marker und Agenda wechseln auf diesen Tag
- mobil schließt sich anschließend der Plan und die Karte wird sichtbar
- außerhalb des Reisezeitraums wird nichts umgestellt; stattdessen erscheint ein Hinweis

Die Funktion arbeitet bereits mit den in `TRIP_DAYS` hinterlegten Reisedaten und ist damit nicht auf einen bestimmten Wochentag fest codiert.


## v0.9.16 – Nächster Ort

Die Tagesplanung besitzt jetzt `🧭 Nächster Ort`.

- verwendet den aktuell ausgewählten Reisetag
- wenn kein Tag ausgewählt ist, wird während der Reise automatisch der heutige Reisetag verwendet
- ermittelt anhand der geplanten Reihenfolge den ersten noch nicht als besucht markierten Ort
- springt zum Marker, zoomt hinein und öffnet das Infofenster
- mobil schließt sich der Plan und die Karte wird sichtbar
- bereits besuchte Orte werden übersprungen
- wenn alle Orte des Tages besucht sind, erscheint ein entsprechender Hinweis

Damit kann die App unterwegs schrittweise durch den Tagesplan führen.


### Korrektur v0.9.16

`🧭 Nächster Ort` berechnet jetzt eine eigene echte Fußroute **nur vom aktuellen
Standort zum nächsten noch nicht besuchten Ort**. Eine eventuell sichtbare komplette
Tagesroute wird dabei ersetzt. Bereits besuchte Orte werden übersprungen. Sind alle
Orte des Tages besucht, wird keine Route berechnet und ein Abschluss-Hinweis angezeigt.

`🚶 Fußroute anzeigen` bleibt davon getrennt und zeigt weiterhin die komplette Tagesroute.

### Korrektur 3 – Reihenfolge

`Nächster Ort` verwendet jetzt exakt dieselbe Tagesreihenfolge wie die Tagesagenda.
Die Reihenfolge wird intern im Feld `plannedOrder` gespeichert. Die vorherige Fassung
hat fälschlich `order` gelesen und konnte deshalb nach einem Verschieben der Orte
den falschen nächsten Programmpunkt auswählen.

### Korrektur 4 – restliche Tagesroute

`🧭 Nächster Ort` zeigt nun die **gesamte noch offene Tagesroute**:
aktueller Standort → nächster unbesuchter Ort → alle weiteren unbesuchten Orte
in der Reihenfolge der Tagesagenda. Besuchte Orte werden vollständig übersprungen.

`🚶 Fußroute anzeigen` bleibt weiterhin die komplette geplante Tagesroute.


## v0.9.17 – Backup & Import
Der komplette lokale App-Stand kann als versionierte JSON-Datei exportiert und wieder importiert werden. Vor einem Import erfolgt eine Prüfung und Sicherheitsabfrage. Dieses Backup dient zugleich als Grundlage für die spätere Migration nach v0.10.


### Erweitertes Backup – vollständiger Ortsbestand
Das Backup enthält nun zusätzlich:
- `localPlaces`: alle vom Nutzer selbst gespeicherten Orte einschließlich Google-Places-Orten
- `placeDatabase`: eine Momentaufnahme des vollständigen aktuell geladenen Ortsbestands
- `data`: Planung, Tageszuordnung, Reihenfolge, Besucht-Status usw.

Beim Import werden die selbst gespeicherten Orte ebenfalls wiederhergestellt. Ältere v0.9.17-Backups ohne diese Felder bleiben importierbar.


## V1.0.0 – Phase 1 (Supabase)
- E-Mail/Passwort-Login über Supabase Auth
- Session bleibt nach Neuladen erhalten
- Logout
- Budapest 2026 wird aus Supabase geladen
- 57 Orte werden aus `places` geladen und über `trip_places` mit der Reise verknüpft
- Besuchsstatus/Tageszuordnung werden bereits gelesen
- Schreiboperationen bleiben in Phase 1 noch lokal; zentrale Synchronisation folgt in Phase 2


## V1.0.0 – Phase 2
Die bestehende Reiseplanung wird jetzt nach Supabase geschrieben:
- Tageszuordnung
- Reihenfolge
- besucht
- Startzeit und Endzeit

Schreibvorgänge werden kurz gebündelt und per Upsert nach `trip_places` übertragen.
Bei einem Cloud-Fehler bleibt der lokale Stand erhalten und die Statuszeile meldet den Fehler.
Vor dem Einsatz muss `docs/V1.0.0_PHASE2_DATABASE.sql` einmal in Supabase ausgeführt werden.


### Build-Anzeige
Die aktuelle Version wird dauerhaft unten rechts angezeigt:
`v1.0.0 · Phase 2 · Build 1`.
Damit lässt sich nach GitHub-Pages-Deployments und Reloads sofort erkennen,
ob der aktuelle Build geladen wurde.


### Build 2
- Versionsanzeige aus der Karten-Ecke entfernt und dezent unter den App-Titel verschoben.
- E-Mail-Adresse aus dem Header entfernt; Abmelden bleibt direkt erreichbar.
