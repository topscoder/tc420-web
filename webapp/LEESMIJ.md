# TC420 Web

Een webpagina om de TC420 via USB te bedienen en te testen vanaf macOS, Linux of Windows. Je hebt Chrome of Edge nodig. Er is geen internet nodig.

## Starten

- **macOS:** dubbelklik op `start-tc420-web.command`. Er gaat een Terminal-venster open dat de pagina in Chrome start. Sluit dat venster om te stoppen. Weigert macOS het script de eerste keer? Klik dan met rechts op het bestand en kies *Open*.
- **Handmatig:** start in deze map `python3 -m http.server 8420 --bind 127.0.0.1` en open daarna `http://localhost:8420/` in Chrome of Edge.
- **Simulatie zonder apparaat:** zet `?sim=1` achter het adres, bijvoorbeeld `http://localhost:8420/?sim=1`.

## Testen

Volg de tests T1 tot en met T7 op de pagina. Noteer per test wat je op de TC420 ziet en klik op *Werkt* of *Werkt niet*. Het logboek wordt automatisch in de browser bewaard. Sla het na afloop op met *Log opslaan (.json)* en deel dat bestand.

## Bestanden

- `index.html`: de pagina
- `app.js`: bediening, testflows en logboek
- `tc420.js`: protocol en `.tmf`-bestandsformaat; wordt ook in node getest
