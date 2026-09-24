# Budapest Travel Planner v1.28.0

## v1.28.0 – UI/UX Refresh: Plan

- Der Plan-Bereich wurde kompakter und klarer hierarchisiert, ohne die bestehende Funktionalität zu verändern.
- Die vier großen Statistik-Kacheln der Reiseübersicht wurden zu einer platzsparenden Kennzahlenzeile zusammengeführt.
- Tageszeilen und Abstände der Reiseübersicht wurden reduziert, damit mehr Inhalt ohne Scrollen sichtbar bleibt.
- Die Tagesauswahl ist jetzt eine einzeilige, horizontal scrollbare Chip-Leiste statt eines mehrzeiligen Button-Rasters.
- Tageslabels wurden in der Auswahl verkürzt und „Noch offen“ zu „Offen“ komprimiert.
- Die aktive Tagesauswahl bleibt deutlich hervorgehoben.
- „Tagesplanung“, „Heute“ und „Nächster Ort“ wurden optisch kompakter gestaltet und stärker von der Reiseübersicht getrennt.
- Agenda und Routenbereich erhalten konsistentere Rundungen.
- Keine Datenbankmigration erforderlich.

## v1.27.3 – Klare Hierarchie im Plan

- Die komplette Tagesplanung inklusive Überschrift sowie „Heute“ und „Nächster Ort“ wurde unter die Reiseübersicht verschoben.
- Der Plan beginnt damit konsequent mit dem Gesamtüberblick und wechselt anschließend in die Tagesplanung.
- Keine Datenbankmigration erforderlich.

## v1.27.2 – Reiseübersicht vor Tagesplanung

- Die Reiseübersicht steht im Plan jetzt direkt oberhalb der Tagesauswahl.
- Dadurch beginnt der Plan mit dem Gesamtüberblick; anschließend folgt die Auswahl und Bearbeitung des einzelnen Reisetags.
- Keine Datenbankmigration erforderlich.

## v1.27.1 – Reiseübersicht in „Plan“

- Die Reise-/Statusübersicht wurde aus der Heute-Ansicht entfernt, damit „Heute“ wieder stärker auf die unmittelbare Nutzung unterwegs fokussiert ist.
- Die Übersicht ist jetzt direkt in „Plan“ unterhalb der Tagesauswahl und oberhalb der Tagesagenda integriert.
- Ein Tipp auf einen Reisetag in der Übersicht öffnet weiterhin unmittelbar dessen Tagesagenda.
- Keine Datenbankmigration erforderlich.

## v1.27.0 – Reise-/Statusübersicht

- Neue kompakte Reiseübersicht in der Heute-Ansicht.
- Zeigt geplante Orte, Aktivitäten, noch ungeplante Orte und den Besuchsfortschritt der Reise.
- Jeder Reisetag erhält eine eigene Zeile mit Anzahl der Orte/Aktivitäten, Besuchsstand, Wetter und Machbarkeitsstatus.
- Grün/Gelb/Rot visualisiert den aktuellen Stand der Machbarkeitsprüfung je Reisetag; Tage mit unvollständigen Zeitangaben werden neutral dargestellt.
- Ein Tipp auf einen Reisetag öffnet direkt dessen vollständigen Tagesplan.
- Die Übersicht nutzt ausschließlich bereits vorhandene Reise-, Wetter- und Planungsdaten; keine Datenbankmigration erforderlich.

## v1.26.0 – „Freie Zeit nutzen“

- Die Heute-Ansicht erkennt während der Reise freie Zeit bis zum nächsten festen Programmpunkt.
- Berücksichtigt aktuelle Budapest-Uhrzeit, aktuellen Standort, geschätzte Gehzeiten, Öffnungszeiten und bereits besuchte Orte.
- Ein Zwischenstopp wird nur vorgeschlagen, wenn nach Hinweg, Weiterweg und 15 Minuten Sicherheitsreserve noch mindestens 25 Minuten vor Ort bleiben.
- Vorschläge zeigen Gehzeit vom aktuellen Standort, verfügbare Zeit am Ort und den anschließenden Weg zum nächsten Termin.
- Ist die Zeit zu knapp, empfiehlt die App stattdessen eine späteste Aufbruchszeit zum nächsten festen Programmpunkt.
- Geschlossene Orte werden nicht als Zwischenstopp vorgeschlagen; Orte mit unbekannter Öffnungszeit bleiben als nachrangige Option möglich.
- Die Funktion erscheint erst während der Reise mit verfügbarem Standort; die Vorschau vor Reisebeginn bleibt unverändert.
- Keine Datenbankmigration erforderlich.

## v1.25.0 – Machbarkeit der Tagesplanung

- Neue automatische Machbarkeitsprüfung in der Heute-Ansicht und im vollständigen Tagesplan.
- Prüft auf Basis der geplanten Reihenfolge, Start-/Endzeiten und geschätzten Gehzeiten, ob der nächste Programmpunkt rechtzeitig erreichbar ist.
- Erkennt direkte zeitliche Überschneidungen und zu kurze Transferzeiten.
- Warnt bei weniger als 15 Minuten Puffer nach dem geschätzten Fußweg.
- Bezieht vorhandene Öffnungszeiten ein und weist auf geplante Besuche außerhalb der Öffnungszeit hin.
- Status unterscheidet zwischen „Tagesplan wirkt machbar“, „Tagesplan ist knapp“, „Zeitkonflikte“ und „Teilweise prüfbar“.
- Gehzeiten bleiben bewusst als konservative Schätzung gekennzeichnet; die echte Google-Navigation bleibt für die tatsächliche Route maßgeblich.
- Keine Datenbankmigration erforderlich.

## v1.24.1 – Öffnungszeiten bei „In meiner Nähe“

- Nähe-Vorschläge berücksichtigen jetzt die gespeicherten Öffnungszeiten für den aktuellen Budapest-Tag und die aktuelle Uhrzeit.
- Priorität: jetzt geöffnet → öffnet innerhalb von 90 Minuten → Öffnungszeit unbekannt → geschlossen/später geöffnet.
- Innerhalb derselben Öffnungsstatus-Gruppe entscheidet weiterhin die Entfernung.
- Jeder Vorschlag zeigt seinen aktuellen Status, z. B. „🟢 Geöffnet · bis 18:00“, „🟡 Öffnet um 11:00 · in 35 Min.“ oder „🔴 Heute geschlossen“.
- Geschlossene Orte bleiben als Fallback sichtbar, verdrängen aber keine geöffneten Alternativen.
- Keine Datenbankmigration erforderlich.

## v1.24.0 – „In meiner Nähe“

- Neue Karte in der mobilen Heute-Ansicht mit den drei nächstgelegenen offenen Orten.
- Berücksichtigt Orte des aktuellen Reisetags und noch ungeplante spontane Optionen; fest für andere Tage geplante Orte werden nicht vorgeschlagen.
- Zeigt Kategorie, Luftlinienentfernung und kompakte Gehzeit-Schätzung.
- Antippen eines Eintrags öffnet den Ort direkt auf der Karte.
- Standort kann direkt in der Karte angefordert bzw. aktualisiert werden.
- „Alle nach Nähe anzeigen“ wechselt zur Orte-Ansicht und sortiert den gesamten Bestand nach Entfernung.
- Besuchte Orte verschwinden automatisch aus den Nähe-Vorschlägen.
- Keine Datenbankmigration erforderlich.

## v1.23.0 – „Was jetzt?“ 2.0

- „Was jetzt?“ berücksichtigt während der Reise erstmals die aktuelle Uhrzeit in Budapest.
- Bereits vergangene Aktivitäten werden nicht mehr dauerhaft als nächster Programmpunkt vorgeschlagen.
- Feste Aktivitäten, die laufen oder innerhalb von 45 Minuten beginnen, erhalten Vorrang vor flexiblen Stopps.
- Statushinweise zeigen z. B. „Jetzt · Termin läuft“, „In 20 Min. geplant“, „Um 18:00 Uhr geplant“ oder einen überfälligen Planzeitpunkt.
- Normale Orte können direkt in der „Was jetzt?“-Karte als besucht markiert werden; die nächste Empfehlung aktualisiert sich sofort.
- Vor Reisebeginn bleibt die Funktion als klar gekennzeichnete Vorschau testbar.
- Keine Datenbankmigration erforderlich.

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



## v1.14.2 – Navigation Design-Fix
- Navigationskarte auf Mobilgeräten luftiger gestaltet und Abstände vergrößert.
- Online/GPS und die Aktionen „Stopp“/„Richtung“ in einem ruhigen 2×2-Raster angeordnet.
- Zeitplan-Hinweis optisch weicher und besser lesbar gestaltet.
- Auf-/Zuklappen nutzt einen eigenen Chevron statt eines Textzeichens.
- Cache-Busting für CSS und JavaScript auf v1.14.2 aktualisiert.

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


## v1.14.3 – Kompaktere Navigationskarte
- Das luftigere Design aus v1.14.2 bleibt erhalten, benötigt auf Mobilgeräten aber deutlich weniger Kartenfläche.
- Innenabstände, Manöverbereich und Zeitplan-Hinweis wurden moderat verkleinert.
- Online/GPS und Navigationsaktionen werden kompakter angeordnet; die Positionsschaltfläche erscheint weiterhin nur bei Bedarf.
- Lange Navigationsanweisungen bleiben auf zwei Zeilen begrenzt.
- Keine Änderung an Pufferberechnung oder Navigationslogik.


## v1.14.4 – Position kompakter angeordnet
- Der „Position“-Button sitzt im erweiterten mobilen Navigationspanel direkt rechts neben der GPS-Anzeige.
- Dadurch entsteht beim Verlassen des Follow-Modus keine zusätzliche dritte Bedienzeile mehr.
- Navigationslogik und übriges Design bleiben unverändert.


## v1.14.5 – Lesbarkeit Navigation
- Die vollständige Navigationsanweisung wird im aufgeklappten Panel wieder angezeigt und nicht mehr nach zwei Zeilen abgeschnitten.
- Die GPS-Anzeige erhält ausreichend Platz, damit die Genauigkeit in Metern sichtbar bleibt.
- Position bleibt rechts neben GPS; Stopp und Richtung bleiben in der kompakten zweiten Zeile.
- Keine Änderung an Navigations- oder Pufferlogik.


## v1.14.6 – Schnellere Navigation
- Die beim Kartenstart ohnehin ermittelte GPS-Position wird jetzt als Navigations-Startposition wiederverwendet.
- Dadurch entfällt beim Start der Navigation in der Regel das erneute Warten auf eine frische GPS-Abfrage.
- Eine brauchbare Position darf bis zu 60 Sekunden alt sein; eine präzisere aktuelle Position wird nach Navigationsstart weiterhin im Hintergrund ermittelt und bei relevanter Abweichung neu geroutet.
- Routen-, Puffer- und Navigationslogik bleiben unverändert.


## v1.14.7 – Navigation abschnittsweise berechnen
- Beim Start der Live-Navigation wird nur noch die Route vom aktuellen Standort zum nächsten Stopp berechnet.
- Die übrigen Tagesstopps bleiben in der Navigationswarteschlange und werden erst nach Erreichen oder Überspringen des aktuellen Stopps geroutet.
- Dadurch muss beim Start eines Budapest-Tages aus Deutschland nicht mehr sofort eine Fußroute über den gesamten Tagesplan berechnet werden.
- Neuberechnung, Fortsetzen und „Stopp überspringen“ verwenden ebenfalls nur den jeweils nächsten Zielabschnitt.
- Die normale Tagesrouten-Anzeige im Plan bleibt unverändert und kann weiterhin den kompletten Tagesverlauf darstellen.


## v1.14.8 – Schnellere Standortanzeige beim App-Start
- Die Standortbestimmung startet jetzt parallel zu Anmeldung, Supabase- und Karteninitialisierung.
- Für den ersten Kartensprung wird zunächst eine schnelle bzw. gecachte Position akzeptiert; anschließend wird GPS im Hintergrund hochgenau präzisiert.
- Die Google Routes Library wird beim normalen Öffnen der App nicht mehr geladen, sondern erst bei der ersten tatsächlichen Routenberechnung.
- Die präzisere Hintergrundposition aktualisiert Standort- und Navigationsdaten, ohne einen bereits erfolgten schnellen Kartensprung unnötig zu verzögern.


## v1.14.9 – Google Maps parallel laden
- Google Maps startet jetzt unmittelbar beim DOM-Start parallel zu Authentifizierung, Supabase und Standortbestimmung.
- Der bisher serielle Ablauf „Supabase fertig → Google Maps laden“ wurde entfernt.
- Mehrere interne Aufrufe teilen sich denselben Maps-Ladevorgang, damit das Script nicht doppelt geladen wird.
- Sobald die Reisedaten bereit sind, kann die bereits parallel geladene Karte sofort initialisiert und auf die zuvor ermittelte Position gesetzt werden.
- Routes bleibt weiterhin Lazy-Loading und wird erst bei einer tatsächlichen Routenberechnung geladen.


## v1.14.10 – Mobile Standort-Zentrierung
- Die automatische Start-Standortabfrage wartet auf Mobilgeräten nun bis zu 10 Sekunden statt nur 2,5 Sekunden auf den ersten Fix.
- Der erste erfolgreiche Standort-Fix zentriert die Karte beim App-Start garantiert auf den aktuellen Standort.
- Die Zentrierung verwendet wie der funktionierende Standort-Button panTo und mindestens Zoom 14.
- Ein nachfolgender hochgenauer GPS-Fix aktualisiert die Position im Hintergrund, ohne die Karte nach einer bereits erfolgreichen Startzentrierung erneut unnötig zu verschieben.
- Falls die schnelle Cache-Abfrage keinen Standort liefert, übernimmt der hochgenaue GPS-Fix automatisch die erstmalige Zentrierung.


## v1.14.11 – Sofortiger Standort beim mobilen App-Start
- Der zuletzt erfolgreich ermittelte Standort wird lokal gespeichert und beim nächsten App-Start sofort verwendet.
- Gespeicherte Positionen werden maximal 30 Minuten wiederverwendet.
- Die aktuelle Browser-/GPS-Abfrage läuft weiterhin parallel und aktualisiert Position und Genauigkeit im Hintergrund.
- Dadurch entfällt beim wiederholten Öffnen der App das Warten auf Androids ersten GPS-Fix, sofern ein ausreichend frischer Standort gespeichert ist.


## v1.14.12 – Syntaxfehler im Standort-Cache behoben
- Doppelte Deklaration der Konstanten für den lokalen Standort-Cache entfernt.
- Dadurch wird app.js wieder vollständig ausgeführt; die Standort-Optimierung aus v1.14.11 bleibt erhalten.


## v1.14.13 – Budapest-Ansicht vor spätem GPS-Fix schützen
- Ein Klick auf „Budapest“ beendet jetzt die automatische Start-Zentrierung auf den aktuellen Standort.
- Ein noch laufender GPS-Fix darf die bewusst gewählte Budapest-Ansicht anschließend nicht mehr überschreiben.
- Die Standortdaten selbst werden weiterhin im Hintergrund aktualisiert und gespeichert.
- „Mein Standort“ kann danach weiterhin jederzeit manuell verwendet werden.


## v1.14.14 – Geolocation ReferenceError behoben
- In centerMapOnCurrentLocation wurde die Geolocation-Option korrekt auf enableHighAccuracy: highAccuracy gesetzt.
- Der ReferenceError beim automatischen Standort-Fix tritt damit nicht mehr auf.
- Die mobile Startzentrierung und der Schutz der Budapest-Ansicht bleiben unverändert erhalten.


## v1.15.0 – Tagesübersicht als Timeline
- Orte und Aktivitäten eines Tages werden in einer gemeinsamen chronologischen Timeline dargestellt.
- Geplante Start-/Endzeiten stehen direkt am jeweiligen Programmpunkt.
- Zwischen zwei aufeinanderfolgenden Stopps zeigt die Timeline eine kompakte Gehzeit- und Distanzschätzung.
- Der Tageskopf zeigt Anzahl der Orte/Aktivitäten, geschätzte Gesamt-Gehstrecke und Gehzeit.
- Besuchte Orte fließen in eine Fortschrittsanzeige mit Prozentwert und Fortschrittsbalken ein.
- Aktivitäten bleiben optisch als Termine erkennbar und können weiterhin direkt bearbeitet werden.
- Die Timeline verwendet für die schnelle Übersicht Luftlinien-Schätzungen; die eigentliche Navigation nutzt weiterhin Google Routes.


## v1.16.0 – „Was jetzt?“
- Die Heute-Ansicht zeigt prominent den nächsten offenen Programmpunkt aus der gemischten Tagesreihenfolge von Orten und Aktivitäten.
- Mit verfügbarem Standort werden Entfernung und geschätzte Gehzeit direkt angezeigt.
- Geplante Start-/Endzeit und Art des Programmpunkts sind sofort sichtbar.
- „Navigation starten“ führt direkt vom aktuellen Standort zum nächsten Programmpunkt.
- „Auf Karte“ öffnet den nächsten Ort bzw. die nächste Aktivität direkt auf der Karte.
- Die Funktion nutzt die bestehende Tagesreihenfolge und Standortlogik, ohne den Plan automatisch umzusortieren.


## v1.17.0 – Öffnungszeiten im Tagesplan
- Gespeicherte Google-Öffnungszeiten werden passend zum jeweiligen Reisetag ausgewertet.
- Bei Orten mit geplanter Uhrzeit zeigt die Timeline, ob der Besuch innerhalb der gespeicherten Öffnungszeit liegt.
- Warnungen erscheinen bei geschlossenen Orten, Besuchen außerhalb der Öffnungszeit und bei einer Schließung innerhalb der nächsten 60 Minuten.
- Die „Was jetzt?“-Karte zeigt den Öffnungsstatus des nächsten Ortes ebenfalls direkt an.
- Bei Orten ohne geplante Uhrzeit wird die Öffnungszeit des Reisetags informativ angezeigt.
- Orte ohne gespeicherte Öffnungszeiten bleiben unverändert; es werden keine Öffnungszeiten erfunden.


## v1.18.0 – Wetter im Tagesplan
- Wetterdaten für Budapest werden über Open-Meteo geladen.
- Der Tageskopf zeigt Wetterlage, Höchst-/Tiefsttemperatur und maximale Regenwahrscheinlichkeit.
- Geplante Programmpunkte erhalten passend zu ihrer Uhrzeit eine stündliche Temperatur- und Regenprognose.
- Die „Was jetzt?“-Karte zeigt das Wetter zum geplanten Zeitpunkt des nächsten Programmpunkts.
- Die Wetterabfrage läuft parallel zum übrigen App-Start und blockiert Karte oder Supabase nicht.
- Außerhalb des verfügbaren Vorhersagezeitraums bleibt die Planung vollständig nutzbar und zeigt keine erfundenen Wetterwerte.


## v1.19.0 – PWA & Offline-Basis
- Web-App-Manifest und installierbare PWA-Basis.
- Service Worker cached App-Oberfläche und zentrale lokale Assets für erneute Starts ohne Netz.
- Sichtbarer Online-/Offline-Indikator.
- Bereits lokal gespeicherte Planungs-, Standort- und Geocache-Daten bleiben verfügbar.
- Google Maps, Supabase-Synchronisation, Wetter und Google Places benötigen weiterhin Internet; die Offline-Basis ersetzt diese externen Dienste nicht.


## v1.19.3 – Offline-Tagesrouten
- Neuer Button „Offline-Daten vorbereiten“ berechnet online alle Tagesrouten mit mindestens zwei Stopps.
- Routenverlauf, Entfernung, Gehzeit und Stoppliste werden lokal im Browser gespeichert.
- „Fußroute anzeigen“ verwendet ohne Internet automatisch die gespeicherte Tagesroute.
- Auch normal online angezeigte Tagesrouten aktualisieren automatisch ihren lokalen Offline-Stand.
- Übersicht zeigt für jeden Reisetag, ob eine Offline-Route gespeichert ist, sowie den letzten Aktualisierungszeitpunkt.
- Eine offline angezeigte Route kann nicht neu berechnet werden; dafür bleibt eine Internetverbindung erforderlich.


## v1.20.0 – Budapest Offline-Karte
- Budapest-Kartenausschnitt als PMTiles-Datei aus OpenStreetMap/Protomaps-Daten.
- „Offline-Daten vorbereiten“ speichert zusätzlich die Budapest-Kartendatei im Browser.
- Offline schaltet die App automatisch von Google Maps auf MapLibre um.
- Gespeicherte Tagesrouten werden auf der Offline-Karte dargestellt.
- Online bleibt Google Maps die primäre Karte.


### v1.20.2
- CSP erlaubt nun auch das MapLibre-Stylesheet von cdn.jsdelivr.net.
- Cache-/Asset-Versionen für den Offline-Kartentest aktualisiert.


## v1.21.0 – Wetterprognose erweitert
- Aktuelles Budapest-Wetter mit Temperatur, gefühlter Temperatur und Wind.
- Kompakte Prognose für alle Reisetage in der Heute-Ansicht.
- Tagesplanung zeigt Tageswerte sowie Morgen-, Mittag- und Abendprognose.
- Wetter an geplanten Stopps bleibt erhalten und nutzt die jeweilige Uhrzeit.


### v1.21.1
- Syntaxfehler durch versehentlich als Text eingefügte Zeilenumbrüche im Wetterausbau behoben.


### v1.21.2
- Open-Meteo API in der Content Security Policy für Wetterabrufe freigegeben.


### v1.21.3
- Desktop-Fehler beim Klick auf „Heute“ vor Reisebeginn behoben.
- Datumsbereich außerhalb der Reise wird ohne nicht vorhandene formatDate-Funktion formatiert.


### v1.21.4
- Wetterabruf startet nun direkt beim normalen App-Start statt erst bei einer Supabase-Live-Aktualisierung.


### v1.21.5
- Race Condition beim parallelen Wetterstart behoben: Wetterdaten werden früh geladen, die Ansichten aber erst nach Initialisierung der Reisedaten gerendert.


## v1.22.0 – Offline-Reise
- „Offline-Daten vorbereiten“ speichert jetzt zusätzlich Orte, Tagesplanung, Aktivitäten und den letzten Wetterstand.
- App kann im Flugmodus aus dem vorbereiteten Reise-Snapshot starten, ohne Supabase oder Google Maps abzuwarten.
- Offline-Status zeigt Karte, Reisedaten, Aktivitäten, Wetter und Tagesrouten sowie den letzten Synchronisationszeitpunkt.
- Online wird nach erfolgreicher Synchronisation automatisch ein aktueller Reise-Snapshot gespeichert.


### v1.22.1
- CDN-Bibliotheken werden vom Service Worker auch offline aus dem App-Cache ausgeliefert.
- Supabase- und MarkerClusterer-Bibliothek werden für einen echten Offline-Neustart vorgeladen.
- Doppelte MapLibre-/PMTiles-Script-Tags entfernt.
- PMTiles-Range-Auswertung im Service Worker korrigiert.


### v1.22.2
- Offline-Start vollständig von Supabase-Authentifizierung entkoppelt, sofern ein vorbereiteter Reise-Snapshot vorhanden ist.
- Google Maps wird beim Start ohne Internet nicht mehr angefordert.
- Doppelten Offline-Kartencontainer im HTML entfernt.


### v1.22.3
- Mobile Offline-Diagnose direkt in der App ergänzt.
- Zeigt Service Worker, App-Shell, Reise-Snapshot, Wetter, gespeicherte Routen, PMTiles-Cache und geladene Offline-Bibliotheken.
- JavaScript-/Promise-Fehler sowie Schritte des Offline-Kartenstarts werden lokal protokolliert.


### v1.22.4
- Ursache des Offline-Kartenfehlers behoben: App und Service Worker verwendeten unterschiedliche Cache-Namen für dieselbe PMTiles-Datei.
- Offline-Karten-Cache erhält nun einen gemeinsamen stabilen Namen und wird nicht mehr bei jeder App-Version auseinandergezogen.


### v1.22.5
- „Stopp/Ort auf Karte anzeigen“ verwendet offline MapLibre statt Google Maps und verursacht keinen google-is-not-defined-Fehler mehr.
- Aktivitäten können ebenfalls auf der Offline-Karte fokussiert werden.


### v1.22.6
- Offline-Karte zeigt nun Marker für gespeicherte Orte und Aktivitäten.
- Aktivitäten werden als violette Ticket-Marker dargestellt, Orte anhand ihrer Kategorie.
- Besuchte Orte werden dezenter dargestellt.
- „Auf Karte anzeigen“ hebt den ausgewählten Offline-Marker mit einem Ring hervor.


### v1.22.7
- Offline-Kartenstil überarbeitet: klarere Wasserflächen, Gebäude und Straßen.
- Straßennamen und Ortsbezeichnungen aus den PMTiles-Daten werden ab passenden Zoomstufen eingeblendet.
- Beschriftungen erhalten helle Konturen für bessere Lesbarkeit über der Karte.
- Straßen werden mit abgerundeten Linien und zoomabhängiger Breite dargestellt.


### v1.22.8
- MapLibre-Stylefehler in der Straßenumrandung behoben.
- Zoomabhängige Breite der Straßenumrandung verwendet nun eine gültige top-level interpolate-Expression.


### v1.22.9
- Offline-Kartenstil ohne externe Glyph-Abhängigkeit stabilisiert.
- Text-Symbol-Layer, die MapLibre-Glyphs benötigen, vorerst entfernt; damit startet die Offline-Karte wieder vollständig ohne Internet.
- Straßen-, Wasser-, Gebäude- und Marker-Layer bleiben erhalten.


### v1.22.10
- MapLibre GL JS auf 5.11.0 aktualisiert, damit Kartenbeschriftungen lokale Systemschriften ohne Glyph-Server verwenden können.
- Straßennamen und Ortsbezeichnungen wieder aktiviert; bevorzugt deutsch, sonst lokaler OSM-Name.
- Beschriftungen verwenden lokale Roboto/Arial-Fallbacks und bleiben damit ohne Internet verfügbar.


### v1.22.11
- Offline-Straßenbeschriftungen beruhigt: Nebenstraßen erscheinen später, kleinere Schrift und größere Abstände reduzieren Überlagerungen.
- Ortsbezeichnungen erhalten mehr Abstand zu anderen Labels.
- Der aktuell über „Auf Karte anzeigen“ gewählte Ort bzw. die Aktivität wird direkt am Marker namentlich beschriftet.


### v1.22.12
- Offline-Tagesroute wird beim Ausblenden jetzt auch aus den MapLibre-Quellen entfernt.
- Routenstatus erkennt aktive Offline-Routen korrekt, sodass „Route ausblenden“ auch offline angeboten wird.


### v1.22.13
- Toggle-Logik für „Route ausblenden“ erkennt nun auch die aktive MapLibre-Offlineroute.
- Der Offline-Routenlayer und die Offline-Stopp-Punkte werden dadurch beim Klick tatsächlich geleert.


### v1.22.14
- Temporären mobilen Offline-Debugger nach erfolgreicher Stabilisierung entfernt.
- Debug-Button, Diagnose-Panel, lokale Debug-Protokollierung und zugehörige Styles bereinigt.
- Abschlussstand der v1.22 Offline-Reise.
