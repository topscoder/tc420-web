// Deutsch. Gleiche Schlüssel und {Parameter} wie en.js.
export default {
  'app.title': 'TC420 Web',

  'header.language': 'Sprache',
  'header.status.disconnected': 'Nicht verbunden',
  'header.status.connected': 'Verbunden: {name}',
  'header.sim': 'SIMULATION',
  'header.exportJson': 'Protokoll speichern (.json)',
  'header.exportTxt': 'Protokoll speichern (.txt)',

  'banner.sim':
    'Sie verwenden die <strong>Simulation</strong>: Es ist kein echter TC420 angeschlossen. Jeder Befehl erhält eine simulierte OK-Antwort. Schalten Sie sie unter <em>Erweitert</em> aus, um das echte Gerät zu verwenden.',

  'common.cancel': 'Abbrechen',
  'common.close': 'Schließen',
  'common.done': 'Fertig',
  'common.ok': 'OK',
  'common.delete': 'Löschen',
  'common.replace': 'Ersetzen',
  'device.chipConnect': 'TC420 verbinden',
  'device.chipConnected': '● TC420 verbunden ▾',
  'device.menuClock': 'Uhr stellen ({time})',
  'device.menuClear': 'Controller löschen…',
  'device.menuDisconnect': 'Trennen',
  'device.helpTitle': 'Ihren TC420 verbinden',
  'device.helpText':
    'Ihr Browser fragt jetzt, welches Gerät verwendet werden soll. Wählen Sie <strong>Time Controller</strong> und klicken Sie auf <em>Verbinden</em>. Das ist nur einmal nötig; danach verbindet sich TC420 Web von selbst.',
  'device.helpContinue': 'Weiter',
  'device.error.noDevice': 'Kein Controller ausgewählt.',
  'device.error.denied':
    'Ihr Computer hat den Zugriff auf den Controller blockiert. Ziehen Sie das Kabel ab, stecken Sie es wieder ein und versuchen Sie es erneut.',
  'device.error.busy':
    'Der Controller wird von einem anderen Tab oder Programm verwendet. Schließen Sie es und versuchen Sie es erneut.',
  'device.error.unknown':
    'Die Verbindung zum Controller ist fehlgeschlagen. Ziehen Sie das Kabel ab, stecken Sie es wieder ein und versuchen Sie es erneut.',
  'device.unplugged': 'Der TC420 wurde getrennt.',
  'device.clockOffer':
    'Die Uhr des Controllers geht möglicherweise falsch. Auf die Uhrzeit dieses Computers ({time}) stellen?',
  'device.setClock': 'Uhr stellen',
  'device.notNow': 'Nicht jetzt',
  'device.clockSet': 'Uhr auf {time} gestellt.',
  'device.clockFailed': 'Uhr stellen fehlgeschlagen: Der Controller hat nicht bestätigt.',
  'device.clearTitle': 'Alle Programme vom Controller entfernen?',
  'device.clearText':
    'Der Controller hat danach keine Programme mehr. Ihre Programme in diesem Browser bleiben erhalten.',
  'device.clearConfirm': 'Alle Programme entfernen',
  'device.cleared': 'Alle Programme wurden vom Controller entfernt.',
  'device.clearFailed': 'Löschen fehlgeschlagen: Der Controller hat nicht bestätigt.',
  'send.button': '{name} an TC420 senden',
  'send.buttonMany': { one: '{count} Programm an TC420 senden', other: '{count} Programme an TC420 senden' },
  'send.buttonNone': 'An TC420 senden',
  'send.intro':
    'Sendet das ausgewählte Programm an den Controller. Der Controller wird vorher gelöscht, sodass er danach nur dieses Programm abspielt; am Gerät muss nichts ausgewählt werden.',
  'send.introMany':
    'Sendet alle Programme in der Reihenfolge der Liste an den Controller (Programm 1, 2, …). Der Controller wird vorher gelöscht.',
  'send.invalidTitle': '{name} kann noch nicht gesendet werden',
  'send.invalidHint': 'Korrigieren Sie das im Editor und versuchen Sie es erneut.',
  'send.confirmTitle': '{name} an den TC420 senden?',
  'send.confirmTitleMany': {
    one: '{count} Programm an den TC420 senden?',
    other: '{count} Programme an den TC420 senden?',
  },
  'send.willRun': 'Der Controller spielt danach {name} ({steps}) ab. Alles andere auf dem Controller wird entfernt.',
  'send.slotLine': 'Programm {n} ← {name} ({steps})',
  'send.replaceAll': 'Alles andere auf dem Controller wird entfernt.',
  'send.noReadBack':
    'Der Controller kann nicht ausgelesen werden. Ihre Programme bleiben in diesem Browser gespeichert; erstellen Sie sicherheitshalber eine Sicherung.',
  'send.alsoClock': 'Auch die Uhr auf {time} stellen',
  'send.send': 'Senden',
  'send.progressTitle': 'Senden an TC420…',
  'send.keepConnected': 'Lassen Sie das Kabel angeschlossen.',
  'send.phase.clock': 'Uhr wird gestellt…',
  'send.phase.clear': 'Controller wird gelöscht…',
  'send.phase.write': '{name} · Schritt {step} von {steps}',
  'send.phase.end': 'Wird abgeschlossen…',
  'send.statusOk': {
    one: 'Gesendet: {count} Programm ist auf dem Controller',
    other: 'Gesendet: {count} Programme sind auf dem Controller',
  },
  'send.statusFailed': 'Senden fehlgeschlagen (siehe Protokoll)',
  'send.doneTitle': '✓ {name} läuft auf dem Controller',
  'send.doneTitleMany': {
    one: '✓ {count} Programm ist auf dem Controller',
    other: '✓ {count} Programme sind auf dem Controller',
  },
  'send.clockWasSet': 'Die Uhr wurde auf {time} gestellt.',
  'send.nothingElse': 'Sonst ist nichts auf dem Controller.',
  'send.onlyThese': 'Nur diese Programme sind auf dem Controller.',
  'send.exportBackup': 'Sicherung erstellen',
  'send.error.disconnected': 'Die Verbindung wurde beim Senden unterbrochen. Prüfen Sie, ob das Kabel eingesteckt ist.',
  'send.error.noReply':
    'Der Controller hat nicht geantwortet. Prüfen Sie das Kabel und ob kein anderes Programm oder Tab den Controller verwendet.',
  'send.error.rejected': 'Der Controller hat die Daten nicht angenommen.',
  'send.error.invalid': 'Das Programm ist ungültig.',
  'send.errorTitle.disconnected': 'Senden wurde unterbrochen',
  'send.errorTitle.noReply': 'Der Controller hat nicht geantwortet',
  'send.errorTitle.rejected': 'Der Controller hat die Daten abgelehnt',
  'send.errorTitle.invalid': 'Dieses Programm kann nicht gesendet werden',
  'send.maybeEmpty':
    'Der Controller ist jetzt möglicherweise leer oder enthält ein unvollständiges Programm. Senden Sie erneut, um das zu beheben.',
  'send.unchanged': 'Auf dem Controller wurde nichts geändert.',
  'send.reconnectRetry': 'Neu verbinden und wiederholen',
  'send.tryAgain': 'Erneut versuchen',
  'send.showLog': 'Protokoll anzeigen',

  'last.result': 'Letztes Ergebnis: {text}',

  'obs.label': 'Notiz für das Protokoll:',
  'obs.placeholder': 'Was sehen Sie am TC420? (optional)',
  'obs.works': '✔ Funktioniert',
  'obs.fails': '✘ Funktioniert nicht',
  'obs.saved': 'gespeichert',

  't1.connected': 'verbunden mit {name}',

  't2.ok': 'Uhr gestellt, bestätigt',
  't2.failed': 'nicht bestätigt',

  't3.title': 'Live-Steuerung (Online Play)',
  't3.text':
    'Damit steuern Sie die Ausgänge direkt. Der Controller zeigt den Namen im Display. Mit <em>Stopp</em> (0x02) kehrt er zu seinem normalen Programm zurück.',
  't3.name': 'Name im Display',
  't3.start': 'Start (0x15)',
  't3.stop': 'Stopp (0x02)',
  't3.all0': 'Alle 0 %',
  't3.all100': 'Alle 100 %',
  't3.sweep': 'Kanaltest (jeder Kanal 0→100→0)',
  't3.verbose': 'jedes 0x16-Paket protokollieren',
  't3.note':
    'Achten Sie darauf: Leuchtet der richtige Kanal und dimmt er mit? Folgt das Licht dem Schieberegler gleichmäßig?',
  't3.stats': '{sent} Pakete · {failed} fehlgeschlagen · letzte Antwort {ms} ms',
  't3.started': 'Online Play gestartet',
  't3.startFailed': 'Start nicht bestätigt',
  't3.stopped': 'gestoppt; {sent} Pakete, {failed} fehlgeschlagen',
  't3.stopFailed': 'Stopp nicht bestätigt',

  't4.title': 'Meine Programme',
  't4.drop': '<code>.tmf</code>-Dateien hierher ziehen oder <label for="file">Dateien auswählen</label>',
  't4.new': 'Neues Programm',
  't4.testMode': 'Testzeitplan Überblenden/Schalten (nächste Minuten)',
  't4.testExplain':
    'Erstellt das Programm FADETEST. Ab etwa 2 Minuten nach jetzt blendet CH1 innerhalb von 3 Minuten auf 100 % auf, während CH2 sofort auf 100 % schaltet. 3 Minuten später blendet CH1 wieder auf 0 ab und CH2 schaltet sofort aus. Senden Sie es an den Controller, um zu prüfen, ob Überblenden und sofortiges Schalten funktionieren.',
  't4.saved': 'Automatisch in diesem Browser gespeichert.',
  't4.savedMemory':
    'Dieser Browser kann nichts speichern (privates Fenster oder blockierter Speicher). Ihre Programme gehen beim Schließen der Seite verloren: Erstellen Sie eine Sicherung.',
  't4.saveFailed':
    'Speichern in diesem Browser ist fehlgeschlagen. Erstellen Sie eine Sicherung, um Ihre Programme zu behalten.',
  't4.noReadBack':
    'Der Controller kann nicht ausgelesen werden, daher ist dieser Browser der einzige Ort, an dem Ihre Programme gespeichert sind. Erstellen Sie ab und zu eine Sicherung.',
  't4.exportBackup': 'Sicherung erstellen',
  't4.restoreBackup': 'Sicherung wiederherstellen',
  't4.confirmRestore': {
    one: 'Alle Programme in diesem Browser durch das {count} Programm aus der Sicherung ersetzen?',
    other: 'Alle Programme in diesem Browser durch die {count} Programme aus der Sicherung ersetzen?',
  },
  't4.restored': {
    one: '{count} Programm aus der Sicherung wiederhergestellt',
    other: '{count} Programme aus der Sicherung wiederhergestellt',
  },
  't4.backupError.notJson': '{file} ist keine Sicherungsdatei',
  't4.backupError.notBackup': '{file} ist keine Sicherung von TC420 Web',
  't4.backupError.newerVersion': '{file} wurde mit einer neueren Version von TC420 Web erstellt',
  't4.backupError.empty': '{file} enthält keine Programme',
  't4.imported': { one: '{count} Programm importiert', other: '{count} Programme importiert' },
  't4.importRenamed': '{file} als {name} importiert (Namen: max. 8 Zeichen, A–Z, 0–9, Leerzeichen, -)',
  't4.full': 'Die Bibliothek ist voll (max. {max} Programme)',
  't4.duplicate': 'Duplizieren',
  't4.confirmDelete': 'Programm {name} löschen? Das kann nicht rückgängig gemacht werden.',
  't4.slot': 'Programm {n}',
  't4.onController': 'Auf dem Controller',
  't4.onControllerSlot': 'Auf dem Controller (Programm {n})',
  't4.changedSinceSent': 'seit dem Senden geändert',
  't4.moveDown': 'Nach unten',
  't4.nameHint': 'Wird im Display des Controllers angezeigt: max. 8 Zeichen, A–Z, 0–9, Leerzeichen, -',
  't4.loadFailed': '{file} konnte nicht geladen werden: {error}',
  't4.listTitleOne': 'Programme',
  't4.listTitle': 'Programme (werden in dieser Reihenfolge an den Controller gesendet)',
  't4.steps': { one: '{count} Schritt', other: '{count} Schritte' },
  't4.warnings': { one: '{count} Warnung', other: '{count} Warnungen' },
  't4.edit': 'Bearbeiten',
  't4.moveUp': 'Nach oben',
  't4.remove': 'Entfernen',
  't4.editTitle': 'Bearbeiten: {name}',
  't4.zoom': 'auf die Stunde um jetzt zoomen',
  't4.col.step': '#',
  't4.col.time': 'Zeit',
  't4.deleteStep': 'Schritt löschen',
  't4.addStep': 'Schritt hinzufügen',
  't4.exportTmf': 'Als .tmf speichern',
  't4.chartLabel': 'Erwartete Helligkeit pro Kanal',

  'editor.link': 'Gleiche Helligkeit für alle Kanäle',
  'editor.linkedNote':
    'Alle Kanäle folgen derselben Helligkeit. Schalten Sie dies aus, um jeden Kanal einzeln einzustellen.',
  'editor.linkConfirm':
    'Allen Kanälen die Helligkeiten von {channel} geben? Die Werte der anderen Kanäle werden ersetzt (das können Sie rückgängig machen).',
  'editor.channel': 'Kanal bearbeiten:',
  'editor.undo': 'Rückgängig',
  'editor.redo': 'Wiederholen',
  'editor.chartHelp':
    'Ziehen Sie einen Punkt, um Zeit und Helligkeit zu ändern (Umschalttaste halten für einzelne Minuten). Doppelklicken Sie ins Diagramm, um einen Schritt hinzuzufügen. Bei einem ausgewählten Punkt: Pfeiltasten verschieben ihn (Umschalttaste = größere Schritte), Entf löscht ihn.',
  'editor.pointLabel': 'Schritt {step}: {time}, {level} %',
  'editor.duplicateTime': 'Um {time} gibt es bereits einen Schritt.',
  'editor.minSteps': 'Ein Programm braucht mindestens 2 Schritte.',
  'editor.maxSteps': 'Ein Programm kann höchstens {max} Schritte haben.',
  'editor.fade': 'Überblenden',
  'editor.instant': 'Sofort',
  'editor.changeHint': 'Wie das Licht zu diesem Schritt wechselt: allmählich (überblenden) oder auf einmal (sofort)',
  'editor.levelAll': 'Helligkeit (alle Kanäle)',
  'editor.change': 'Übergang',
  'editor.channels': 'Kanalnamen und -farben',
  'editor.channelName': 'Name von Kanal {n}',
  'editor.channelColor': 'Farbe von Kanal {n}',
  'editor.invalid': 'Dieses Programm kann noch nicht gesendet werden:',
  't4.importSorted': '{file}: Die Schritte wurden nach Zeit sortiert',
  't4.fromTemplate': 'Programm {name} aus einer Vorlage erstellt',
  'templates.title': 'Vorlagen',
  'templates.choose': 'Mit einer Vorlage beginnen…',
  'templates.add': 'Hinzufügen',
  'templates.daynight': 'Einfach Tag und Nacht',
  'templates.sunrise': 'Sonnenaufgang, Mittag und Sonnenuntergang',
  'templates.winter': 'Winter (alle Kanäle gleich)',
  'templates.summer': 'Sommer (alle Kanäle gleich)',
  'templates.afrika': 'AFRIKA (PLed-Beispiel)',
  'templates.amazone': 'AMAZONE (PLed-Beispiel)',
  'templates.thailand': 'THAILAND (PLed-Beispiel)',

  'schedule.warn.tooFew': 'weniger als 2 Schritte: der Controller lehnt das ab',
  'schedule.warn.tooMany': 'mehr als {max} Schritte',
  'schedule.warn.invalidTime': 'Schritt {step}: ungültige Zeit {time}',
  'schedule.warn.sameTime': 'Schritt {step} hat dieselbe Zeit wie Schritt {prev}',
  'schedule.warn.outOfOrder': 'Schritt {step} ({time}) liegt vor Schritt {prev} ({prevTime})',
  'schedule.warn.deviceType': 'Gerätetyp ist {type}, nicht TC420',
  'schedule.warn.trailingBytes': {
    one: '{count} überzähliges Byte am Ende ignoriert',
    other: '{count} überzählige Bytes am Ende ignoriert',
  },
  'schedule.error.tooShort': 'die Datei ist zu kurz für einen .tmf-Header',
  'schedule.error.channels': 'unerwartete Anzahl Kanäle: {count}',

  't5.title': 'An den Controller senden',
  't5.exportBackup': 'Jetzt Sicherung erstellen',
  't5.multiple': 'Mehrere Programme auf dem Controller',
  't5.multipleHint':
    'Nur wenn Sie mit den Tasten Ihres TC420 ein Programm auswählen können. Die Liste zeigt dann Programmnummern in der Reihenfolge des Controllers und kann umsortiert werden.',
  't5.resultOk': { one: '{count} Zeitplan gesendet', other: '{count} Zeitpläne gesendet' },
  't5.resultFailed': 'fehlgeschlagen',

  't6.ok': 'alles gelöscht, bestätigt',
  't6.failed': 'nicht bestätigt',

  't7.title': 'Experte: einzelnes Paket senden',
  't7.text':
    'Für gezielte Versuche, um die ein Entwickler Sie bitten kann. Befehl und Nutzdaten in Hex; Rahmen und Prüfsumme werden automatisch ergänzt.',
  't7.cmd': 'Befehl',
  't7.payload': 'Nutzdaten',
  't7.payloadPlaceholder': 'z. B. 07 EA 0A 16 09 05 2D',
  't7.expect': 'Antwort erwarten',
  't7.send': 'Senden',
  't7.confirm': {
    one: 'Befehl {cmd} mit {count} Byte Nutzdaten senden?',
    other: 'Befehl {cmd} mit {count} Byte Nutzdaten senden?',
  },
  't7.ok': 'bestätigt',
  't7.failed': 'nicht bestätigt ({error})',

  'log.title': 'Protokoll',
  'log.count': { one: '{count} Zeile', other: '{count} Zeilen' },
  'log.stored': '{count} · in diesem Browser gespeichert',
  'log.notStored': '{count} · ACHTUNG: Speichern in diesem Browser schlägt fehl, Protokoll zwischendurch speichern',
  'log.newSession': 'Neue Sitzung markieren',
  'log.clear': 'Protokoll leeren',
  'log.clearConfirm': 'Protokoll leeren? Speichern Sie es vorher, wenn Sie es behalten möchten.',
  'log.note':
    'Das Protokoll wird in diesem Browser gespeichert und ist immer auf Englisch, damit es in Fehlerberichten geteilt werden kann. Das Leeren kann nicht rückgängig gemacht werden.',

  'main.intro':
    'Erstellen Sie einen Lichtplan und senden Sie ihn an Ihren TC420. Alles wird in diesem Browser gespeichert und funktioniert ohne Internet.',
  'settings.title': 'Einstellungen',
  'settings.backupTitle': 'Sicherung',
  'settings.controllerTitle': 'Controller',
  'adv.title': 'Erweitert',
  'adv.text': 'Werkzeuge zur Fehlersuche. Für die normale Nutzung brauchen Sie diese nicht.',
  'adv.version': 'TC420 Web {version}',
  'adv.reportTitle': 'Ein Problem melden',
  'adv.reportText':
    'Speichern Sie das Protokoll unten als Datei und <a href="https://github.com/topscoder/tc420-web/issues/new" target="_blank" rel="noopener">eröffnen Sie ein Issue auf GitHub</a>. Beschreiben Sie, was Sie getan haben und was passiert ist, und hängen Sie die Datei an. Das Protokoll enthält die Nachrichten zwischen App und Controller, Ihre Programmnamen und Ihre Browserversion.',
  'adv.simTitle': 'Simulation',
  'adv.sim': 'Simulation statt eines echten TC420 verwenden',
  'adv.simHint':
    'Die Seite wird neu geladen. Jeder Befehl erhält eine simulierte Antwort, sodass Sie alles ohne Controller ausprobieren können.',
  'adv.testTitle': 'Test für Überblenden und Schalten',

  'banner.mobile':
    'Smartphones und Tablets können keine Verbindung zum TC420 herstellen. Sie können hier Programme erstellen, importieren und exportieren. Um sie an den Controller zu senden, öffnen Sie TC420 Web in Chrome oder Edge auf einem Computer.',
  'banner.browserNamed':
    '{browser} kann keine Verbindung zu USB-Geräten herstellen. Sie können hier Programme erstellen, importieren und exportieren. Um sie an den Controller zu senden, öffnen Sie TC420 Web in Chrome oder Edge.',
  'banner.browser':
    'Dieser Browser kann keine Verbindung zu USB-Geräten herstellen. Sie können hier Programme erstellen, importieren und exportieren. Um sie an den Controller zu senden, öffnen Sie TC420 Web in Chrome oder Edge.',
  'banner.insecure':
    'Die Verbindung zum TC420 funktioniert nur auf einer sicheren Seite. Öffnen Sie TC420 Web unter https://topscoder.github.io/tc420-web/ oder auf diesem Computer (localhost).',
  'device.chipNoUsb': '⚠ USB nicht verfügbar',
  'device.error.deniedLinux':
    'Linux hat den Zugriff auf den Controller blockiert. Dafür ist eine einmalige Einrichtung nötig.',
  'send.needsUsb': 'Zum Senden brauchen Sie Chrome oder Edge auf einem Computer.',
  'support.more': 'Welche Browser funktionieren?',
  'support.title': 'Welche Browser können sich mit dem TC420 verbinden?',
  'support.intro': 'TC420 Web spricht über USB mit dem Controller. Nicht jeder Browser erlaubt das.',
  'support.works':
    '<strong>Funktioniert:</strong> Chrome, Edge, Opera und andere Chromium-basierte Browser unter Windows, macOS, Linux und ChromeOS.',
  'support.notWorks':
    '<strong>Funktioniert nicht:</strong> Safari, Firefox und jeder Browser auf einem iPhone, iPad oder Android-Gerät.',
  'support.os':
    'Windows und macOS brauchen keine Treiber oder andere Software. Linux braucht eine <strong>einmalige Einrichtung</strong>, damit Ihr Benutzer den Controller öffnen darf.',
  'support.editing':
    'In jedem Browser können Sie Programme erstellen, importieren und exportieren und sie später von einem Computer mit Chrome oder Edge senden.',
  'support.advTitle': 'Browser und Computer',
  'support.infoOk': '{where} · kann sich mit dem TC420 verbinden',
  'support.infoNo': '{where} · kann sich nicht mit dem TC420 verbinden',
  'support.unknownBrowser': 'Unbekannter Browser',
  'support.platform.mac': 'macOS',
  'support.platform.windows': 'Windows',
  'support.platform.linux': 'Linux',
  'support.platform.chromeos': 'ChromeOS',
  'support.platform.ios': 'iPhone oder iPad',
  'support.platform.android': 'Android',
  'support.platform.other': 'unbekanntes System',
  'linux.open': 'Linux einrichten',
  'linux.title': 'Zugriff auf den TC420 unter Linux erlauben',
  'linux.text':
    'Linux lässt Sie nur erlaubte USB-Geräte verwenden. Führen Sie diese Befehle einmal in einem Terminal aus. Sie fügen eine Regel für den TC420 (USB 0888:4000) hinzu und fragen nach Ihrem Passwort.',
  'linux.after': 'Ziehen Sie danach den TC420 ab, stecken Sie ihn wieder ein und klicken Sie auf TC420 verbinden.',
  'linux.packaged':
    'Immer noch blockiert? Chromium aus Snap oder Flatpak darf USB-Geräte manchmal gar nicht öffnen. Google Chrome oder Chromium aus den Paketen Ihrer Distribution funktioniert.',
  'linux.copy': 'Befehle kopieren',
  'linux.copied': 'Kopiert.',
  'welcome.title': 'Erstellen Sie einen Lichtplan für Ihren TC420',
  'welcome.text':
    'Erstellen Sie hier Programme und senden Sie sie per USB an den Controller. Ihre Arbeit wird in diesem Browser gespeichert. Nach diesem ersten Besuch sind weder Internet noch andere Software nötig.',
  'welcome.templateTitle': 'Mit einer Vorlage beginnen',
  'welcome.templateText':
    'Tag und Nacht, Sonnenaufgang und -untergang, Winter, Sommer oder die Beispiele, die mit PLed geliefert wurden.',
  'welcome.templateButton': 'Vorlage wählen',
  'welcome.importTitle': 'PLed-Dateien öffnen',
  'welcome.importText': 'Importieren Sie eine oder mehrere .tmf-Dateien aus der alten Windows-Software.',
  'welcome.importButton': '.tmf importieren',
  'welcome.emptyTitle': 'Leer beginnen',
  'welcome.emptyText': 'Ein einfaches Tagesprogramm, das Sie selbst anpassen.',

  'pwa.title': 'Ohne Internet verwenden',
  'pwa.status.online': 'Die Offline-Nutzung wird vorbereitet…',
  'pwa.status.ready': 'Bereit: TC420 Web funktioniert in diesem Browser jetzt auch ohne Internet.',
  'pwa.status.unsupported': 'Dieser Browser kann TC420 Web nicht für die Offline-Nutzung speichern.',
  'pwa.installHint':
    'Tipp: Installieren Sie TC420 Web als App (in Chrome oder Edge: das Installationssymbol in der Adressleiste oder Browsermenü → Installieren). Sie öffnen es dann vom Desktop oder Dock aus, auch ohne Internet, zum Beispiel neben Ihrem Aquarium.',
  'pwa.status.unavailable':
    'Die Offline-Nutzung ist in dieser Kopie der App nicht verfügbar. Öffnen Sie https://topscoder.github.io/tc420-web/, um sie ohne Internet zu verwenden.',
  'pwa.install': 'Als App installieren',
  'pwa.updateReady': 'Eine neue Version von TC420 Web ist bereit.',
  'pwa.reload': 'Neu laden',

  'preview.open': 'Vorschau am Gerät',
  'preview.title': 'Vorschau am Gerät',
  'preview.modePlay': 'Programm abspielen',
  'preview.modeManual': 'Manuell',
  'preview.dayIn': 'Ein Tag in',
  'preview.min1': '1 Min.',
  'preview.min2': '2 Min.',
  'preview.min5': '5 Min.',
  'preview.play': '▶ Abspielen',
  'preview.pause': '❚❚ Pause',
  'preview.stop': '■ Stopp',
  'preview.time': 'Uhrzeit',
  'preview.note':
    'Es wird nichts gespeichert. Wenn Sie stoppen, kehrt der Controller zu seinem normalen Programm zurück.',
  'preview.needsDevice': 'Verbinden Sie den TC420, um die Vorschau an den Lampen zu sehen.',
  'preview.refused':
    'Der Controller hat die Vorschau nicht gestartet. Ziehen Sie das USB-Kabel ab, stecken Sie es wieder ein und versuchen Sie es erneut; das Protokoll unter Erweitert enthält die Details.',
  'preview.stateIdle': 'Keine Wiedergabe',
  'preview.statePlaying': '{name} läuft an den Lampen',
  'preview.stateHolding': '{name} hält an der gewählten Uhrzeit',
  'preview.stateManual': 'Manuelle Helligkeit an den Lampen',

  'about.title': 'Über',
  'about.license':
    'TC420 Web ist freie Open-Source-Software unter der <a href="https://github.com/topscoder/tc420-web/blob/main/LICENSE" target="_blank" rel="noopener">MIT-Lizenz</a>. Quellcode und Hilfe: <a href="https://github.com/topscoder/tc420-web" target="_blank" rel="noopener">github.com/topscoder/tc420-web</a>.',
  'about.disclaimer':
    'TC420 Web ist ein unabhängiges Projekt. Es wird vom Hersteller des TC420 weder hergestellt noch empfohlen oder unterstützt; der Name dient nur dazu, anzugeben, mit welchem Controller es funktioniert. Die Nutzung erfolgt auf eigene Gefahr.',
  'about.privacy':
    'Datenschutz: Alles geschieht in diesem Browser. Ihre Programme und das Protokoll werden nur auf diesem Gerät gespeichert; es wird nichts übertragen, und es gibt keine Tracker oder Statistiken.',
  'about.credits':
    'Das Protokoll wurde anhand der ursprünglichen PLed-Software ermittelt und mit der Open-Source-Bibliothek <a href="https://github.com/wallneradam/tc420" target="_blank" rel="noopener">wallneradam/tc420</a> abgeglichen (es wurde kein Code übernommen). Die Vorlagen AFRIKA, AMAZONE und THAILAND sind die Beispielprogramme, die mit PLed geliefert wurden.',
};
