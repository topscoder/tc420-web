# TC420 Web

Bedien je TC420 LED-tijdcontroller vanuit de browser, op macOS, Linux en Windows. Je hebt de verouderde Windows-software PLed niet meer nodig. Het protocol is achterhaald door reverse engineering van PLed.

**Online:** https://topscoder.github.io/tc420-web/ (Chrome of Edge; zonder apparaat: [simulatie](https://topscoder.github.io/tc420-web/?sim=1)). Elke push naar `main` wordt eerst gecontroleerd (lint, unit- en end-to-end-tests) en daarna automatisch gepubliceerd.

## Inhoud

- `webapp/`: **TC420 Web**, een offline webpagina voor Chrome en Edge (WebHID). Hij kan de klok zetten, live bedienen (online play), `.tmf`-schema's laden, bewerken en downloaden en de controller wissen, en houdt een logboek bij. Zie [`webapp/LEESMIJ.md`](webapp/LEESMIJ.md).
- `schemas/`: `.tmf`-schema's. AFRIKA, AMAZONE en THAILAND zijn voorbeelden; WINTER en ZOMER zijn eigen schema's.
- `testlogs/`: logboeken van tests op een echte TC420.
- `TC420-analyse.md`: de eerste analyse van PLed.exe (21-10-2026). Een deel daarvan is achterhaald, zoals de opbouw van `0x12` en het antwoordformaat; zie het technisch ontwerp.

## Documentatie

- Functioneel ontwerp: https://claude.ai/artifact/GDWpgzU9FUxuj3jSHU8yvZ
- Technisch ontwerp (protocol, bestandsformaat, bewijs): https://claude.ai/artifact/LdvuT5KFtmuyUxAJcpno4G

## Status

Op 22-10-2026 zijn op een echte TC420 getest: klok zetten, online play, downloaden en alles wissen. Alle pakketten kregen een OK. Wat nog niet met eigen ogen is gezien: het verschil tussen springen en faden.

## Tests

```bash
npm ci && npm test
```

## Niet in deze repository

De leverancierssoftware (`PLed/`, `Software_tijdcontroller.zip`) en de lokale kopie van [wallneradam/tc420](https://github.com/wallneradam/tc420) (GPL-3), die als protocolreferentie is gebruikt.
