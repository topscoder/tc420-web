# TC420 / PLed: hoe de app werkt (reverse engineering)

Doel: `PLed.exe` 1.1 (build 2012-11-12) uit `Software_tijdcontroller.zip`.
Gebruikte methode: statische analyse. Hopper (via REA) leverde de pseudocode, pefile en capstone de disassembly. **Er is niets uitgevoerd** en er is geen USB-verkeer opgenomen. Wat hieronder over runtime staat, is dus afgeleid uit de code.

SHA-256:
- `PLed.exe` → `12616b1bc3811500c3be85a41fd8f1126fd71226adc2c906d8d56b481446048e`
- `YB_UsbFuns.dll` → `794a4338fdcf7cf64c9b9adc391e54fd59f9aeb5c44496a70887c1ea451c0860`

Legenda: ✅ = direct in de code gezien · 🔶 = afgeleid · ❓ = nog onbekend

---

## 1. Opbouw van de software

| Bestand | Rol | Bewijs |
|---|---|---|
| `PLed.exe` | MFC-GUI (32-bit x86). Projectnaam in het installatiescript: "LEDTimerControl V2.0" | `objdump -p`: imports van mfc/gdiplus/`YB_UsbFuns.dll`; UIF: `<OutPutPath>E:\zyb\VS src\LEDTimerControl V2.0` |
| `YB_UsbFuns.dll` | Kleine USB-HID-helper (debugbuild) | exports `YB_UsbFindHIDDev`, `YB_USBReadWriteInit`, `YB_UsbRegisterForDeviceNotifications`; imports `HID.DLL` + `SETUPAPI.dll` |
| `mfc100*.dll`, `msvc*100d.dll` | Visual C++ 2010-runtime (deels in **debug**-versie meegeleverd) | bestandsnamen/versies |
| `Update.exe` | Updater (niet geanalyseerd) | – |
| `*.tmf` / `*.pmf` | Modusbestand ("Timer ModeFiles") / pakket ("Packet Mode File") | strings `Timer ModeFiles (*.tmf)`, `Packet Mode File (*.pmf)`. De meegeleverde bestanden zijn **0 bytes**, dus het bestandsformaat is ❓ |

✅ Het apparaat is een **USB-HID-device**. Er is geen driver nodig en geen seriële poort in het spel.

## 2. Het apparaat vinden: VID 0x0888, PID 0x4000

✅ `PLed.exe` @ `0x40766d` (functie `0x407650`, "connect"):

```asm
push 0x888        ; VendorID
push 0x4000       ; ProductID
lea  ebx,[esi+0x370]   ; -> write-handle
lea  edi,[esi+0x36c]   ; -> read-handle
push eax               ; HWND
call [YB_UsbFindHIDDev]
```

✅ In de DLL (`0x10012620`, Hopper `ev_3130876b…`) loopt de functie de HID-apparaten af met `SetupDiGetClassDevsW` / `SetupDiEnumDeviceInterfaces`. Daarna `HidD_GetAttributes`, met deze vergelijking:

```c
if (attr.VendorID == arg_10 /*0x888*/ && attr.ProductID == arg_c /*0x4000*/) {
    YB_UsbRegisterForDeviceNotifications(...);
    *arg_4 = CreateFileW(path, GENERIC_READ,  ...);   // lees-handle
    *arg_8 = CreateFileW(path, GENERIC_WRITE, ...);   // schrijf-handle
}
```

Wordt het apparaat niet gevonden, dan toont de app `"Device can not be found"`.
`YB_USBReadWriteInit` haalt via `HidD_GetPreparsedData`/`HidP_GetCaps` de reportlengtes op. De app gebruikt die lengte als `WriteFile`-lengte.

## 3. Het pakketformaat (alle commando's)

✅ Eén centrale zendfunctie: `PLed.exe` `0x407740` (Hopper `ev_e0e2def2…`). Daarin staat het volgende.

```asm
mov word ptr [ebp-0x48], 0x5500   ; byte0 = 0x00 (HID report-ID), byte1 = 0x55
mov byte ptr [ebp-0x46], 0xaa     ; byte2 = 0xAA
mov byte ptr [ebp-0x45], al       ; byte3 = commando   (cmd->code)
mov byte ptr [ebp-0x44], 0        ; byte4 = 0x00
mov byte ptr [ebp-0x43], cl       ; byte5 = lengte payload
memset(buf+6, 0, 0x3b); memcpy(buf+6, cmd->payload, len)
for (i = 1; i < len+6; i++) sum += buf[i];   ; checksum -> [ebp-0x0a] = byte 62
mov word ptr [ebp-9], 0x0a0d       ; byte 63/64 = 0x0D 0x0A
WriteFile(hWrite, buf, OutputReportLength, ...)
```

Pakket (65 bytes inclusief report-ID):

```
off: 0    1    2    3    4    5    6 … 5+len       62        63   64
     00 | 55 | AA | CMD| 00 | LEN| payload…  00…  | CHKSUM  | 0D | 0A
CHKSUM = (som van byte 1 t/m 5+len) & 0xFF
```

### Antwoord/ACK ✅
De leesthread (`0x403670`, Hopper `ev_d1f3fdd3…`) roept `ReadFile` aan en zet daarna het volgende:
```c
g_ack = (resp[3] << 8) | resp[5];
```
Na elke `WriteFile` wacht de zendfunctie in stappen van 10 ms tot `(byte)g_ack == 1`. Dat duurt hooguit de timeout, en die staat per commando op 1000 ms (`0x3e8`).
🔶 Het apparaat antwoordt dus met hetzelfde framing-formaat, waarbij byte 5 = `0x01` "OK" betekent.

### Commandotabel

| CMD | Naam (afgeleid uit UI/strings) | LEN | Payload | Bewijs (aanroepadres) |
|---|---|---|---|---|
| `0x03` | **Alle modi op de controller wissen** | 0 | – | ✅ `0x406c94`, direct na de messagebox *"This operation will delete controller all mode, sure you want to delete?"* |
| `0x11` | **Tijd synchroniseren** ("SynTime") | 7 | `jaar_hi, jaar_lo, maand, dag, uur, min, sec` | ✅ `0x406a6b` `mov [..], 0x11`, `len=7`; velden uit `localtime_s` (`tm_year+0x76c` = +1900 en `>>8` voor de hoge byte) |
| `0x12` | **Modus-header** (begin van een modus) | 10 | `index (2 bytes)`, `naam (8 tekens)` | ✅ `0x403ae5` `cmd=0x12`, `0x403b5f` `len=0xa`; naam via `memcpy`, max. 8 bytes |
| `0x13` | **Stap van een modus** | 8 | `uur, minuut, CH1, CH2, CH3, CH4, CH5, flags` | ✅ `0x403c51` `cmd=0x13`, `0x403ce3` `len=8`, zie hieronder |
| `0x01` | 🔶 Einde van een modus | 0 | – | ✅ `0x403d7d` `cmd=1` na de stappenlus, gevolgd door `Sleep(20)` |
| `0x02` | 🔶 Einde download / stop-sessie | 0 | – | ✅ `0x403e18` (vlak voor *"DownLoad Success!/Failed!"*), ook bij Stop/Pause (`0x408263`, `0x408f1f`) |
| `0x15` | **Online play starten** | 8 | modusnaam (8 bytes) | ✅ `0x406814` `cmd=0x15`, `0x4068fa` `len=8`; daarna UI-tekst *"Play Speed = X %d"* + `SetTimer(…,1,50ms)` |
| `0x16` | **Live kanaalwaarden tijdens online play** | aantal kanalen | per kanaal 1 helderheidsbyte | ✅ `0x407bd9` `cmd=0x16`, `len=esi`; wordt periodiek vanuit `OnTimer` verstuurd |

#### De stap-payload (cmd 0x13) in detail ✅
Disassembly `0x403c76`–`0x403cf5` leest uit een stap-record van **0x38 = 56 bytes**. De deling door 56 staat in de code als `0x92492493`.

```asm
mov  ax, word ptr [step+4]     ; -> payload[0..1]
movzx ecx, byte ptr [step+0x2c] ; -> payload[2]  CH1
movzx edx, byte ptr [step+0x2d] ; -> payload[3]  CH2
movzx eax, byte ptr [step+0x2e] ; -> payload[4]  CH3
movzx ecx, byte ptr [step+0x2f] ; -> payload[5]  CH4
movzx edx, byte ptr [step+0x30] ; -> payload[6]  CH5
al = b35<<4 | b34<<3 | b33<<2 | b32<<1 | b31   ; -> payload[7] (1 bit per kanaal)
```

Dat `step+4` = **uur** en `step+5` = **minuut** volgt uit drie plekken die het stap-tijdveld tonen (`0x40757d`, `0x40cb11`, `0x40cc68`):
```asm
movsx eax, byte ptr [x+5]   ; minuut
movsx ecx, byte ptr [x+4]   ; uur
push "%02d:%02d"
```

Over de flags-byte: elk kanaal heeft in de stap-editor een eigen knop (resource `IDB_BFade…`, 5×). 🔶 Bit n is dus vermoedelijk "fade (geleidelijk) vs. jump" voor kanaal n+1. ❓ Welke waarde (0 of 1) "fade" betekent, is niet geverifieerd.

## 4. Volledige downloadflow ("Download All Mode To Control")

Bron: Hopper-decompilatie van `0x403…` (`ev_b8c7d88d…`).

```
voor elke modus i in de lijst:
    "Downloading %d/%d"
    als aantal stappen < 2  -> messagebox "StepNo must be more than 1", modus overslaan
    send 0x12 [i, naam8]                  ; header
    voor elke stap:  send 0x13 [hh, mm, CH1..CH5, flags]; Sleep(5)
    send 0x01 []                           ; einde modus;  Sleep(20)
send 0x02 []                               ; einde
-> "DownLoad Success!" of "DownLoad Failed!"  (Failed = er kwam geen ACK)
```

## 5. Voorbeeld (berekend, niet gemeten)

Tijd-sync op 2026-10-21 20:15:30:

```
00 55 AA 11 00 07 07 EA 0A 15 14 0F 1E 00 … 00 [62]=68 [63]=0D [64]=0A
```
De checksum is `0x55+0xAA+0x11+0x00+0x07+0x07+0xEA+0x0A+0x15+0x14+0x0F+0x1E = 0x268`, dus de byte op positie 62 is `0x68`.

## 6. Overige waarnemingen

- De installer-config (`PLedSetup 1.0.UIF`, GB2312) is gemaakt met "YingInstall6.0". Het bedrijf staat er alleen als "LN" in.
- Twee Chinese debugstrings in de leesthread, uit GB2312 gedecodeerd: "USB读线程启动" en "USB读线程结束" ("USB-leesthread gestart/beëindigd"). Bij download staat er "下载线程结束" ("downloadthread beëindigd").
- Er worden debug-runtimes (`msvcr100d.dll`, `mfc100ud.dll`) meegeleverd. De DLL is dus een debugbuild.

## 7. Open punten

| Vraag | Status |
|---|---|
| Betekenis van flags-bit 0/1 (fade vs. jump) | 🔶 / ❓ |
| Precieze betekenis van cmd `0x01` en `0x02` | 🔶 afgeleid uit de plek in de flow |
| Opbouw van de antwoordpakketten buiten byte 3/5 | ❓ (geen capture) |
| Formaat `.tmf` / `.pmf` | ❓ (voorbeeldbestanden zijn leeg) |
| Maximum aantal modi/stappen ("Mode beyond limit!") | ❓ grens niet opgezocht |
| `Update.exe` | niet geanalyseerd |

**Hoe je het kunt verifiëren:** sluit een TC420 aan op een Windows-VM, draai USBPcap/Wireshark en laat "SynTime" klikken. Het pakket uit §5, met de actuele tijd, moet dan langskomen.
