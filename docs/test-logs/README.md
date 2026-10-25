# Hardware test logs

Logs exported from the app while it talked to a real TC420 (macOS, Chrome, USB). They are kept exactly as
exported, as evidence for [protocol.md](../protocol.md). Lines are tab-separated: time (UTC), kind, test, text.
TX is a packet sent, ACK a confirmed reply, OBS-OK an observation the tester recorded.

The first log was made with the early test bench, which still wrote its log in Dutch (`SESSIE` = session,
`waarneming: werkt` = observation: works, `klok zetten` = set clock). Later versions always log in English.

## tc420-testlog-20261022-0929.txt

TC420 Testbank 0.2.0, 22 Oct 2026. First contact with the hardware; every test was observed to work (T1–T6).

| Test | What happened |
| --- | --- |
| T1 connect | Device opened as *Time Controller*, VID 0x0888 PID 0x4000, one vendor collection (usage page 0xFF), 64-byte input and output reports with report ID 0. |
| T2 set clock | `0x11` confirmed in 17 ms with `00 00 11 00 01 00`; the display showed the right time. |
| T3 online play | `0x15` "TEST" confirmed, 544 × `0x16` with slider values, `0x02` to stop; the outputs followed the sliders. |
| T4/T5 send | AFRIKA written to bank 0: `0x12`, 21 × `0x13`, `0x01` (no reply, as expected), `0x02`; all confirmed. |
| T6 clear | `0x03` confirmed. |

Every reply arrived within 11–62 ms.

## tc420-testlog-20261025-0828.txt

TC420 Web 0.8.0, 25 Oct 2026 (the file also still contains the 22 Oct session, which the browser had kept).
Test of the guided send flow from issue #5:

- Reconnected automatically to the remembered device; two clock syncs confirmed.
- Program WINTER (9 steps) created from a template and sent with the default flow:
  `0x11` set clock (16 ms) → `0x03` clear (15 ms) → `0x12` bank 0 "WINTER", 9 steps → 9 × `0x13` (10–62 ms) →
  `0x01` (no reply) → `0x02`. All confirmed.
- The reply to the `0x12` right after the clear took **1255 ms**: the controller erases its memory after
  confirming `0x03`. The app now allows 10 s for that packet.
- Reported afterwards by the tester: the controller runs WINTER without pressing any buttons, also after
  unplugging and reconnecting the power.

## tc420-testlog-20261025-1802.txt

TC420 Web 0.14.0, 25 Oct 2026, installed as an app. First test of *Preview on device* (issue #6):

- SUNRISE (9 steps) sent with the default flow: all confirmed, again a slow reply (1246 ms) after the clear.
- Every `0x15` start of online play as "SUNRISE" was **refused**: reply `00 00 15 00 02 00` (length 2 instead
  of 1). The controller beeped; the lights did not change, because the app sends no levels after a refusal.
  On 22 Oct, `0x15` as "TEST" was accepted.
- Moving the time slider repeated the start about 25 times within a second (a bug, fixed in 0.14.1).
- 0.14.1 tries a refused start once more as "TEST", so the next log shows whether the name is the cause.
