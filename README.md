# Budapest Travel Planner v1.14.1

## Navigation Persistence & Wake Lock

- Screen Wake Lock hält das Display während aktiver Navigation nach Möglichkeit wach.
- Aktive Navigation wird lokal zwischengespeichert und nach App-/Tab-Wechsel bzw. Reload wieder aufgenommen.
- Beim Zurückkehren werden GPS-Watch und Wake Lock neu aktiviert; falls nötig wird ab der aktuellen Position neu geroutet.
- Explizites Beenden über X/Button löscht den gespeicherten Navigationszustand.
- Keine Datenbankmigration erforderlich.

# Budapest Map v1.12.2

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


## v1.11.1 – Navigation für den Praxiseinsatz

- kompaktere, kartenorientierte Navigationsansicht
- Richtungspfeil für den eigenen Standort (Geräteorientierung mit GPS-Heading als Fallback)
- automatisches Fortschalten der Navigationsschritte
- Follow-Modus; nach manuellem Verschieben erscheint „◎ Position“
- Zielerkennung bei ca. 30 m
- automatische Neuberechnung nach mehreren bestätigten Abweichungen von der Route
- GPS-Genauigkeit wird bei der Abweichungstoleranz berücksichtigt
- Testnavigation bleibt vollständig lokal und wird nicht in Supabase gespeichert

Für v1.11.1 ist keine Datenbankmigration erforderlich.


## v1.11.2 – Navigationsfortschritt

- Navigationsschritte schalten anhand der tatsächlichen Position auf dem Routenverlauf früher weiter.
- Bereits zurückgelegte Streckenabschnitte werden während der Navigation grau überzeichnet.
- Die verbleibende Strecke wird aus der aktuellen Position entlang der Route berechnet.
- Nach automatischer Neuberechnung startet die Fortschrittsanzeige auf der neuen Route neu.

Für v1.11.2 ist keine Datenbankmigration erforderlich.



## v1.11.5 – Kartenrotation-Fix

- Google Map explizit auf **Vector Rendering** umgestellt; die JavaScript-`div`-Karte verwendet sonst standardmäßig Raster Rendering.
- Heading-/Rotationssteuerung für die Karte aktiviert.
- Navigationsrotation nutzt `moveCamera()` mit `heading`, damit parallele Kamera-Updates die Ausrichtung nicht überschreiben.
- **„🧭 Richtung“** richtet die Karte nach der ermittelten Bewegungsrichtung aus; **„N Norden“** setzt die Karte auf 0°.
- Konsolen-Diagnose für den tatsächlich verwendeten Rendering-Typ ergänzt.
- Keine Datenbankmigration erforderlich.

## v1.11.3 – Orientierung in der Navigation

- Karte folgt im Navigationsmodus standardmäßig der Bewegungsrichtung; Umschalter zwischen **Richtung** und **N Norden**.
- Dynamischer Zoom: vor nahen Manövern näher heran, auf längeren geraden Abschnitten weiter heraus.
- Klarere Manöver-Symbole für geradeaus, links/rechts, leichte Abbiegungen, Wenden und Kreisverkehr.
- Sichtbare GPS-Qualität mit Genauigkeit in Metern; die bestehende Rerouting-Logik berücksichtigt weiterhin die GPS-Genauigkeit.
- Bereits zurückgelegte Strecke, automatische Neuberechnung und Testnavigation aus v1.11.2 bleiben erhalten.

Für v1.11.3 ist keine Datenbankmigration erforderlich.


## v1.11.5 – Tagesnavigation

Die Navigation arbeitet die kombinierte Tagesreihenfolge aus Orten und Aktivitäten Stopp für Stopp ab. Beim Erreichen eines Zwischenstopps pausiert die Führung, zeigt den nächsten Stopp an und bietet „Weiter navigieren“ an. Normale Orte können direkt als besucht markiert werden; Aktivitäten bleiben von der Besucht-Logik getrennt. Die bestehende Testnavigation, Kartenrotation, Fortschrittsanzeige und automatische Neuberechnung bleiben erhalten.


## v1.11.7 – Navigation stabilisieren

- Zielerkennung benötigt nun zwei bestätigte GPS-Messungen und berücksichtigt die gemeldete GPS-Genauigkeit.
- Automatisches Rerouting wird bei ungenauem GPS unterdrückt und nur ausgelöst, wenn mehrere Messungen die Abweichung bestätigen und die Entfernung zur Route nicht wieder sinkt.
- Der zurückgelegte Routenfortschritt läuft bei kleinen GPS-Rücksprüngen nicht mehr sichtbar rückwärts.
- Fortschritts-, Ziel- und Rerouting-Zustände werden nach jeder neuen Route sauber zurückgesetzt.
- Keine Datenbank-/SQL-Änderung erforderlich.


## v1.11.7 – Navigationsbedienung
- Der Hauptbutton wechselt bei aktiver Navigation zu **✕ Navigation beenden** und beendet denselben Navigationszustand wie das X im Navigationspanel.
- Die Karte kann während aktiver Navigation frei verschoben und gezoomt werden. Eine manuelle Kartenbewegung pausiert den Follow-Modus, ohne GPS, Rerouting oder Zielerkennung zu stoppen.
- Über **◎ Position** wird der Follow-Modus wieder aktiviert und die Karte folgt erneut dem Standort.
- Automatische Zoomänderungen der Navigation werden von manuellen Zoomgesten unterschieden.


## v1.11.9 – Map Interaction Fix

- Google Maps verwendet auf Mobilgeräten explizit `gestureHandling: "greedy"`: Die Karte lässt sich während der Navigation mit einem Finger verschieben.
- `draggable` ist explizit aktiviert.
- Manuelles Verschieben beendet nur den Follow-Modus; GPS, Navigation, Zielerkennung und Rerouting laufen weiter.
- `drag` dient zusätzlich zu `dragstart` als mobiler Fallback zur Erkennung manueller Kartenbewegungen.
- `◎ Position` aktiviert den Follow-Modus anschließend wieder.


### v1.11.9 – Map Interaction & Cache Fix
- Mobile Kartengesten lösen den Follow-Modus bereits bei Pointer-/Touch-Beginn, ohne die Google-Maps-Geste zu blockieren.
- GPS-Updates ziehen die Karte nach einer manuellen Interaktion nicht zurück; `◎ Position` aktiviert Follow wieder.
- Explizite Pointer-Events-Regeln verhindern, dass inaktive App-Overlays die Karte abfangen.
- CSS und JavaScript werden in `index.html` mit `?v=1.11.9` geladen, damit neue Releases auf Mobilgeräten nicht mit alten Cache-Dateien gemischt werden.


## v1.12.0 – Kompakte Navigation UI

- Navigationskarte deutlich kompakter, damit mehr Kartenfläche sichtbar bleibt.
- Nächste Anweisung auf maximal zwei Zeilen begrenzt.
- Reststrecke, geschätzte Restzeit und Stopp-Fortschritt in einer kompakten Statuszeile.
- GPS-Qualität und Richtungssteuerung platzsparender dargestellt.
- Neuer ⌄/⌃-Schalter zum Ein- und Ausklappen zusätzlicher Navigationsdetails.
- Kompakte Ansicht ist beim Start einer Navigation der Standard.
- Bestehende Tagesnavigation, Rerouting, Kartenrotation, Karteninteraktion und Zielerkennung bleiben erhalten.


## v1.12.2 – Zielbildschirm

- Neuer Abschlussbildschirm beim Erreichen des letzten Navigationsziels.
- Konfetti-Animation startet automatisch nach stabil bestätigter Zielerkennung.
- Normale Orte und Aktivitäten werden passend dargestellt; bei Aktivitäten erscheint „Viel Spaß!“.
- Zwischenstopps der Tagesnavigation behalten weiterhin die bestehende „Weiter zum nächsten Stopp“-Ansicht.
- Auch die Testnavigation kann den Zielbildschirm auslösen, damit die Funktion lokal getestet werden kann.
- „Navigation beenden“ schließt den Zielbildschirm und setzt den Navigationszustand sauber zurück.
- Keine Datenbank-/Supabase-Anpassung erforderlich.


## v1.12.2 – Kompakter Zielbildschirm

- Ziel-Overlay deutlich kleiner und als halbtransparente Glass-Card gestaltet.
- Hintergrund wird nur noch leicht abgedunkelt; die Karte bleibt sichtbar.
- Überschrift auf „Ziel erreicht!“ verkürzt, Icon und Abstände reduziert.
- Kompakter „Navigation beenden“-Button statt vollbreitem Button.
- Konfetti und die bestehende stabile Zielerkennung bleiben unverändert.
- Cache-Busting für CSS und JavaScript auf v1.12.2 aktualisiert.


## v1.13.2 – Pause & Verbindungsstatus
- Navigation kann pausiert und fortgesetzt werden.
- Beim Pausieren werden GPS-Watch, Wake Lock, Karten-Follow und automatische Neuberechnung angehalten; Route und Stopp bleiben erhalten.
- Beim Fortsetzen wird die Position neu bestimmt und die Route ab dort aktualisiert.
- Online-/Offline-Status in der Navigation; offline bleibt die vorhandene Route sichtbar, neue Routenberechnungen werden zurückgehalten.
- Der pausierte Zustand wird zusammen mit der Navigation lokal gespeichert.


## v1.13.3 – Stopps überspringen
- Während einer laufenden Tagesnavigation kann im erweiterten Navigationspanel ein späterer Stopp ausgewählt werden.
- Der aktuelle oder mehrere bevorstehende Stopps können übersprungen werden; die Route wird direkt zum gewählten Stopp neu berechnet.
- Übersprungene Orte werden nicht automatisch als besucht markiert und Aktivitäten bleiben unverändert.
- Testnavigation ist von der Funktion ausgenommen.
- Keine Datenbankänderung erforderlich.


## v1.14.0 – Intelligente Tagesnavigation
- Geplante Uhrzeiten von Orten und Aktivitäten werden in die laufende Tagesnavigation übernommen.
- Für den jeweils nächsten Stopp zeigt die Navigation eine laufend aktualisierte Ankunftsprognose.
- Bei einem Zeitpuffer von höchstens 15 Minuten erscheint eine Warnung „Zeitplan knapp“.
- Liegt die prognostizierte Ankunft nach der geplanten Startzeit, zeigt die Navigation die voraussichtliche Verspätung.
- Bei ausreichendem Puffer wird die verbleibende Zeit bis zum geplanten Beginn angezeigt.
- Bei Aktivitäten mit Start- und Endzeit wird der komplette Aktivitätszeitraum angezeigt.
- Die Zeitprognose wird aus der verbleibenden Gehzeit des aktuellen Routenabschnitts berechnet und während der Navigation aktualisiert.


## v1.13.4 – Mobile Navigationsleiste
- Die Statusinformationen im aufgeklappten Navigationspanel und die Navigationsaktionen liegen auf Mobilgeräten jetzt in getrennten Zeilen.
- Restzeit, GPS-Status, Online-Status, „Stopp“ und „Richtung“ überlagern sich dadurch nicht mehr.
- Auf schmalen Displays werden die Aktionsbuttons zusätzlich in ein kompaktes Raster umgebrochen.
- Bestehende Navigation, Pausenfunktion und „Stopps überspringen“ bleiben unverändert.
- Keine Datenbankänderung erforderlich.


## v1.14.1 – Bugfix intelligente Tagesnavigation
- Puffer wird aus geplanter Uhrzeit und prognostizierter Ankunfts-Uhrzeit berechnet; zukünftige Reisetage werden in der Vorschau nicht mehr als tausende Puffer-Minuten gezählt.
- Zeitfenster und Ankunft/Puffer werden in zwei Zeilen dargestellt und sind auf kleinen Displays vollständig lesbar.
