# TC420 Web

Een webpagina om de TC420 via USB te bedienen en te testen vanaf macOS, Linux of Windows. Je hebt Chrome of Edge nodig. Er is geen internet nodig.

## Starten

- **macOS:** dubbelklik op `start-tc420-web.command`. Er gaat een Terminal-venster open dat de pagina in Chrome start. Sluit dat venster om te stoppen. Weigert macOS het script de eerste keer? Klik dan met rechts op het bestand en kies *Open*.
- **Handmatig:** start in deze map `python3 -m http.server 8420 --bind 127.0.0.1` en open daarna `http://localhost:8420/` in Chrome of Edge.
- **Simulatie zonder apparaat:** zet `?sim=1` achter het adres, bijvoorbeeld `http://localhost:8420/?sim=1`.

## Testen

Volg de tests T1 tot en met T7 op de pagina. Noteer per test wat je op de TC420 ziet en klik op *Werkt* of *Werkt niet*. Het logboek wordt automatisch in de browser bewaard. Sla het na afloop op met *Log opslaan (.json)* en deel dat bestand.

## Bestanden

- `index.html` en `css/app.css`: de pagina
- `js/main.js`: start de app en koppelt alles aan elkaar
- `js/protocol.js`: het USB-protocol (pakketten bouwen en antwoorden lezen)
- `js/schedule.js`: het `.tmf`-bestandsformaat, controles en het verwachte lichtverloop
- `js/device.js`: de verbinding met de TC420 (één commando tegelijk, wachten op antwoord)
- `js/simulator.js`: een nagebootste TC420 voor `?sim=1` en de tests; foutsituaties via de adresregel, bijvoorbeeld `?sim=1&simSilent=13` (geen antwoord op 0x13), `&simFail=12` (foutantwoord), `&simUnplug=20` (kabel eruit na 20 pakketten), `&simOpen=NotAllowedError` (verbinden geweigerd)
- `js/transfer.js`: versturen naar de controller (klok, wissen, programma's, afsluiten) met foutsoorten
- `js/ui/device.js` en `js/ui/send.js`: verbinden, apparaatmenu, klokmelding, wissen en de verzenddialoog
- `js/logbook.js`: het logboek dat in de browser bewaard blijft
- `js/programs.js`: de programmabibliotheek (naamregels, wat op de controller staat, back-ups)
- `js/storage.js`: opslag van de bibliotheek in IndexedDB, met terugval op localStorage of geheugen
- `js/i18n.js` en `js/locales/`: de vertalingen (EN, NL, DE)
- `js/ui/`: de onderdelen van de testpagina

Tests draaien vanuit de hoofdmap met `npm test` (unit- en end-to-end-tests); `npm run lint` controleert de code.
