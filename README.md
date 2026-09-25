# Budapest Travel Planner v1.33.6

Mobile Reise-PWA für die Budapest-Reise vom **03.–07.10.2026**. Die App verbindet Reiseplanung, gespeicherte Orte, Aktivitäten, Wetter, Öffnungszeiten, Tagesrouten, Live-Fußnavigation und Offline-Funktionen in einer Oberfläche.

## Aktueller Funktionsumfang

- **Karte:** Google Maps online, Budapest-Offline-Karte mit MapLibre/PMTiles, Marker für Orte und Aktivitäten, eigener Standort und Kartenaktionen.
- **Heute:** „Was jetzt?“, freie Zeit sinnvoll nutzen, Orte in der Nähe, Tagesfortschritt, Wetter und relevante Machbarkeitswarnungen.
- **Plan:** Reiseübersicht, fünf Reisetage, offene Orte, gemeinsame Timeline aus Orten und Aktivitäten, Gehzeit-Schätzungen, Öffnungszeiten, Wetter und Machbarkeitsprüfung.
- **Orte:** Suche, Kategorien, eigene Orte, Local-Tipps, Planung, Besuchsstatus und Entfernung im Großraum Budapest.
- **Navigation:** In-App-Fußnavigation mit Tagesstopps, GPS-Follow, Kartenrotation, Rerouting, Zeitplanhinweisen, Pause/Fortsetzen, Stopps überspringen, Wake Lock und Wiederaufnahme nach App-Wechsel.
- **Offline/PWA:** installierbare PWA, Offline-Reise-Snapshot, Budapest-Karte, Tagesrouten, Wetterstand und Offline-Start ohne Supabase/Google Maps.
- **Daten:** Supabase-Synchronisation für Orte, Reiseplanung und Aktivitäten.

## Versionshistorie

Die Historie dokumentiert bewusst nur die **Hauptversionen**. Patch- und Zwischenversionen wie v1.22.1 oder v1.32.2 werden nicht einzeln aufgeführt; deren finaler Funktionsstand ist in der zugehörigen Hauptversion zusammengefasst.

### v1.33.0 – Cleanup & Polish
- Tagesplanung auf die fünf Reisetage und „Offen“ reduziert; redundante Aktionen und Einführungstexte entfernt.
- Machbarkeitsprüfung präzisiert: Transfers benötigen eine echte Endzeit, leere bzw. einzelne Programmpunkte werden neutral bewertet.
- Machbarkeitsfarben in der Reiseübersicht erklärt.
- Entfernungswerte werden nur im Großraum Budapest angezeigt; die interne Distanzberechnung bleibt überall aktiv, damit „Nähe“ auch vor der Reise korrekt sortiert.
- „Offen“ steht in der Tagesauswahl des Plans an erster Stelle, damit ungeplante Orte schneller erreichbar sind.
- Beim ersten Öffnen des Plans wird während der Reise automatisch der aktuelle Reisetag gewählt; vor und nach der Reise startet der Plan mit „Offen“. Eine anschließend manuell gewählte Tagesansicht bleibt während der Sitzung erhalten.
- Kopfzeile von „Orte entdecken“ stabilisiert: Nähe-Filter und Trefferanzahl bleiben unabhängig vom aktiven Filter fest rechts neben der Überschrift.
- UI-Texte und Gehzeit-Hinweise bereinigt.

### v1.32.0 – UI/UX Refresh: Karte
- Kartenaktionen für Budapest, Ort hinzufügen und Gesamtansicht zu einer kompakten Toolbar zusammengeführt.
- Standortaktion auf ein konsistentes Line-Icon umgestellt.
- Mobile Positionierung der Kartenaktionen optimiert, damit Karte und Google-Maps-Steuerelemente frei bleiben.
- Marker-, Routing- und Navigationslogik unverändert beibehalten.

### v1.31.0 – UI/UX Refresh: Orte
- Ortssuche und Ortsliste für die mobile Nutzung neu gestaltet.
- Kategorie, Entfernung und Statusinformationen schneller erfassbar gemacht.
- Chips für geplant, offen, besucht, Local-Tipp und eigene Orte eingeführt.
- Lange Notizen in der Übersicht kompakter dargestellt.

### v1.30.0 – Globaler UI/UX Refresh
- Mobile Bottom-Navigation mit einheitlichen Line-Icons für Karte, Heute, Plan und Orte.
- Aktiven Bereich klarer hervorgehoben.
- Mobilen Header mit Reisezeitraum, Version, Online-Status und Account-Aktionen kompakter gestaltet.
- Abstände, Rundungen und Schatten global vereinheitlicht.

### v1.29.0 – UI/UX Refresh: Heute
- „Heute“ konsequent auf die Nutzung unterwegs ausgerichtet.
- „Was jetzt?“ zur zentralen Hauptkarte gemacht und Navigation stärker hervorgehoben.
- Wetterdarstellung und Tageskopf reduziert.
- Machbarkeit nur noch bei relevanten Warnungen oder Konflikten eingeblendet.
- Nähe, freie Zeit und Tagesfortschritt kompakter gestaltet.

### v1.28.0 – UI/UX Refresh: Plan
- Reiseübersicht und Tagesplanung visuell klarer getrennt.
- Kennzahlen der Reiseübersicht komprimiert.
- Tagesauswahl als horizontal scrollbare Chip-Leiste umgesetzt.
- Tagesplanung, Agenda und Routenbereich für Mobilgeräte platzsparender gestaltet.

### v1.27.0 – Reise-/Statusübersicht
- Reiseweite Übersicht für geplante Orte, Aktivitäten, offene Orte und Besuchsfortschritt eingeführt.
- Pro Reisetag Wetter, Inhalte und Machbarkeitsstatus zusammengeführt.
- Übersicht nach UX-Tests aus „Heute“ in den Bereich „Plan“ verschoben und oberhalb der Tagesplanung angeordnet.
- Reisetage aus der Übersicht direkt mit der jeweiligen Tagesagenda verknüpft.

### v1.26.0 – Freie Zeit nutzen
- Freie Zeit bis zum nächsten festen Programmpunkt automatisch erkannt.
- Standort, Gehzeiten, Öffnungszeiten und bereits besuchte Orte berücksichtigt.
- Nur Zwischenstopps vorgeschlagen, wenn Hinweg, Aufenthalt, Weiterweg und Sicherheitsreserve realistisch passen.
- Bei zu wenig Zeit stattdessen eine sinnvolle späteste Aufbruchszeit angezeigt.

### v1.25.0 – Machbarkeit der Tagesplanung
- Automatische Prüfung von Reihenfolge, Start-/Endzeiten und geschätzten Gehzeiten eingeführt.
- Überschneidungen, zu kurze Transferzeiten und geringe Zeitpuffer erkannt.
- Öffnungszeiten in die Prüfung einbezogen.
- Status zwischen machbar, knapp, Konflikt und teilweise prüfbar unterschieden.

### v1.24.0 – In meiner Nähe
- Nächstgelegene noch relevante Orte in „Heute“ ergänzt.
- Orte des aktuellen Tages und ungeplante spontane Optionen berücksichtigt.
- Öffnungszeiten in die Priorisierung integriert: geöffnet, bald geöffnet, unbekannt, geschlossen.
- Entfernung und Gehzeit angezeigt; Treffer direkt auf der Karte öffnbar.
- Gesamten Ortsbestand nach Entfernung sortierbar gemacht.

### v1.23.0 – Was jetzt? 2.0
- „Was jetzt?“ um die aktuelle Budapest-Uhrzeit erweitert.
- Laufende und bald beginnende Aktivitäten priorisiert.
- Vergangene Aktivitäten aus der Empfehlung entfernt.
- Status wie „Termin läuft“, „In 20 Min. geplant“ oder geplante Uhrzeit ergänzt.
- Orte direkt aus der Empfehlung als besucht markierbar gemacht.

### v1.22.0 – Offline-Reise
- Vollständigen Offline-Reise-Snapshot für Orte, Tagesplanung, Aktivitäten und Wetter eingeführt.
- Offline-Start ohne Supabase-Authentifizierung und ohne Google Maps ermöglicht.
- MapLibre-/PMTiles-Offlinemarker für Orte und Aktivitäten ergänzt.
- Offline-Kartenstil, Straßen und lokale Beschriftungen ausgebaut.
- Gespeicherte Tagesrouten auf der Offline-Karte darstellbar und ein-/ausblendbar gemacht.
- Navigation Persistence und Screen Wake Lock ergänzt: aktive Navigation bleibt bei App-/Tab-Wechsel erhalten und wird wieder aufgenommen.
- Temporäre Offline-Diagnose nach Stabilisierung wieder entfernt.

### v1.21.0 – Wetterprognose erweitert
- Aktuelles Budapest-Wetter mit Temperatur, gefühlter Temperatur und Wind ergänzt.
- Prognose für alle Reisetage eingeführt.
- Tageswerte sowie Morgen-, Mittag- und Abendprognose im Plan ergänzt.
- Wetterdaten passend zur Uhrzeit geplanter Stopps beibehalten.

### v1.20.0 – Budapest Offline-Karte
- Budapest-Kartenausschnitt als PMTiles-Datei auf Basis von OpenStreetMap/Protomaps eingeführt.
- Offline automatische Umschaltung von Google Maps auf MapLibre.
- Offline-Karte in die Vorbereitung der Reisedaten integriert.
- Content-Security-Policy und Offline-Abhängigkeiten für MapLibre stabilisiert.

### v1.19.0 – PWA & Offline-Basis
- Web-App-Manifest und installierbare PWA-Basis eingeführt.
- Service Worker für App-Shell und zentrale lokale Assets ergänzt.
- Online-/Offline-Status sichtbar gemacht.
- Offline-Tagesrouten vorbereitet und lokal gespeichert.
- Bereits gespeicherte Planung, Standort- und Geocache-Daten offline verfügbar gemacht.

### v1.18.0 – Wetter im Tagesplan
- Wetterdaten für Budapest über Open-Meteo integriert.
- Höchst-/Tiefsttemperatur und Regenwahrscheinlichkeit im Tageskopf ergänzt.
- Stundenprognose passend zu geplanten Programmpunkten angezeigt.
- Wetter auch in „Was jetzt?“ eingebunden.

### v1.17.0 – Öffnungszeiten im Tagesplan
- Gespeicherte Öffnungszeiten passend zum Reisetag ausgewertet.
- Warnungen für geschlossene Orte, Besuche außerhalb der Öffnungszeit und baldige Schließung ergänzt.
- Öffnungsstatus in Timeline und „Was jetzt?“ angezeigt.
- Fehlende Öffnungszeiten bewusst nicht geschätzt.

### v1.16.0 – Was jetzt?
- Nächsten offenen Programmpunkt prominent in der Heute-Ansicht dargestellt.
- Entfernung und geschätzte Gehzeit bei vorhandenem Standort ergänzt.
- Geplante Zeit und Art des nächsten Stopps angezeigt.
- Direkten Start der Navigation und Fokus auf der Karte ermöglicht.

### v1.15.0 – Tagesübersicht als Timeline
- Orte und Aktivitäten eines Tages in einer gemeinsamen chronologischen Timeline zusammengeführt.
- Start-/Endzeiten direkt an den Programmpunkten angezeigt.
- Gehzeit und Entfernung zwischen aufeinanderfolgenden Stopps geschätzt.
- Tagesfortschritt mit Besuchsstatus und Fortschrittsbalken ergänzt.

### v1.14.0 – Intelligente Tagesnavigation
- Geplante Uhrzeiten in die laufende Navigation übernommen.
- Ankunftsprognose, Zeitpuffer, Verspätungswarnungen und Aktivitätszeitfenster ergänzt.
- Navigation abschnittsweise zum jeweils nächsten Stopp berechnet.
- App-Start und Standortbestimmung beschleunigt; Google Maps parallel und Routes bei Bedarf geladen.
- Letzten Standort lokal zwischengespeichert und mobile Zentrierung stabilisiert.
- Navigationskarte und Bedienelemente für kleine Displays optimiert.

### v1.13.0 – Erweiterte Navigationssteuerung
- Navigation pausierbar und fortsetzbar gemacht.
- Online-/Offline- und GPS-Status in der Navigation ergänzt.
- Spätere Tagesstopps auswählbar und überspringbar gemacht.
- Mobile Navigationsleiste und Statusdarstellung für schmale Displays überarbeitet.

### v1.12.0 – Kompakte Navigation & Ziel
- Navigationsoberfläche kompakter und stärker auf die Karte ausgerichtet.
- Abschlussbildschirm „Ziel erreicht!“ mit Konfetti ergänzt.
- Zwischenstopps weiterhin mit „Weiter zum nächsten Stopp“ behandelt.
- Zielansicht als kompakte Glass-Card umgesetzt.

### v1.11.0 – In-App-Fußnavigation
- In-App-Fußnavigation mit Google Routes Library eingeführt.
- Aktuellen GPS-Standort als Navigationsstart verwendet.
- Navigationsschritte, Reststrecke, Stopp-Fortschritt und Zielerkennung ergänzt.
- Follow-Modus, Bewegungsrichtung, dynamischen Zoom und Kartenrotation ausgebaut.
- Automatisches Rerouting und GPS-Toleranzen stabilisiert.
- Tagesnavigation arbeitet Orte und Aktivitäten Stopp für Stopp ab.
- Testnavigation mit lokalem Karten-Ziel ermöglicht.

### v1.10.0 – Tagesroute & Einzelstopps
- Gemeinsame Tagesroute aus geplanten Orten und Aktivitäten aufgebaut.
- Verhalten für einzelne Tagesstopps eingeführt: Stopp anzeigen statt künstlicher Route.
- Route vom aktuellen Standort zu einem Einzelstopp ermöglicht, wenn der Standort ausdrücklich als Start gewählt wird.
- Google-Maps-Routenaktion an den jeweiligen Startmodus angepasst.

### v1.9.0 – Tagesplanung
- Orte Reisetagen zuordnen und in eine Reihenfolge bringen.
- Tagesfilter und grundlegende Tagesroutenplanung eingeführt.
- Geplante Orte als Basis für die spätere gemeinsame Tagesagenda verwendet.

### v1.8.0 – Aktivitäten
- Feste Aktivitäten/Termine zusätzlich zu normalen Besuchsorten eingeführt.
- Aktivitäten mit Datum, Uhrzeit und Position in die Reiseplanung integriert.
- Eigene Marker- und Darstellungslogik für Aktivitäten ergänzt.

### v1.7.0 – Synchronisierte Reisedaten
- Reiseplanung stärker mit Supabase verbunden.
- Planungszustände zwischen Nutzern/Geräten synchronisiert.
- Datenmodell für weitere Planungsfunktionen vorbereitet.

### v1.6.0 – Supabase-Ausbau
- Persistente Speicherung von Orten und Reiseinformationen über Supabase ausgebaut.
- Datenbankfunktionen und Synchronisationslogik stabilisiert.
- Grundlage für die gemeinsame Nutzung durch mehrere angelegte Nutzer geschaffen.

### v1.5.0 – Backup & Wiederherstellung
- Export und Import der Reiseplanung als Backup ergänzt.
- Lokale Zustände besser gegen versehentlichen Datenverlust abgesichert.
- Versionsanzeige in der Oberfläche etabliert.

### v1.4.0 – Routen & Standort
- Aktuellen Standort in die Karte integriert.
- Routenfunktionen vom Standort bzw. zwischen geplanten Zielen vorbereitet.
- Kartenfokus und Markerinteraktion für mobile Nutzung verbessert.

### v1.3.0 – Tageszuordnung
- Gespeicherte Orte einzelnen Reisetagen zuordnen können.
- Grundlegende Tagesansicht und Filterung nach Reisetag eingeführt.
- Basis für spätere Reihenfolge- und Routenplanung geschaffen.

### v1.2.0 – Suche & Ortsverwaltung
- Ortssuche mit Vorschlägen und Trefferliste ergänzt.
- Neue Orte mit Name, Adresse, Koordinaten und Kategorie verwaltbar gemacht.
- Infofenster und Markerinteraktion ausgebaut.

### v1.1.0 – Kategorien & Marker
- Orte in Kategorien strukturiert und mit unterschiedlichen Markern dargestellt.
- Kartenansicht und Ortsliste miteinander verknüpft.
- Mobile Bedienung der grundlegenden Kartenfunktionen verbessert.

### v1.0.0 – Budapest Travel Planner
- Erste funktionsfähige Version der Budapest-Reisekarte.
- Google-Maps-Karte mit gespeicherten Reisezielen.
- Grundlegende Ortsdaten und Marker als Ausgangspunkt für die weitere Reiseplanung.

## Technische Basis

- Vanilla JavaScript, HTML und CSS
- Google Maps JavaScript API / Routes Library
- Supabase
- Open-Meteo
- MapLibre GL JS und PMTiles für Offline-Karten
- PWA mit Service Worker und Web-App-Manifest

---
Aktueller Stand: **v1.33.3**
