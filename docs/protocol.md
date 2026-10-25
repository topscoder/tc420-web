# TC420 USB protocol

How a computer talks to the TC420 LED time controller over USB, as used by TC420 Web
([`webapp/js/protocol.js`](../webapp/js/protocol.js), [`device.js`](../webapp/js/device.js),
[`transfer.js`](../webapp/js/transfer.js)).

Sources:

- **Decompilation of PLed 1.1** (`PLed.exe`, build 2012-11-12, and `YB_UsbFuns.dll`), the vendor's Windows
  software, with Hopper Disassembler, capstone and pefile. PLed itself was never run. Addresses below refer to
  these files (SHA-256 in [pled-analysis.md](pled-analysis.md)).
- **[wallneradam/tc420](https://github.com/wallneradam/tc420)**, an open-source Python library tested on hardware
  (GPL-3, archived). Used only as a reference; no code was copied. Every packet TC420 Web builds is byte for
  byte equal to the library's (checked with Node and Python).
- **Tests on a real TC420** with TC420 Web on 22 and 25 Oct 2026, see [test-logs/](test-logs/).

Confidence: **observed** (seen in code or on hardware) · **derived** (concluded from code, not tested) ·
**unknown**.

## Device

| Property | Value | Status |
| --- | --- | --- |
| Interface | USB HID, no driver needed, no serial port | observed |
| Vendor / product ID | `0x0888` / `0x4000` | observed (PLed `0x40766d`, hardware) |
| Product name | *Time Controller* | observed on hardware |
| HID collection | one vendor collection, usage page `0xFF`, usage `0xFF` | observed on hardware |
| Reports | input and output reports of 64 bytes, report ID 0 | observed on hardware |

PLed finds the device with `SetupDiGetClassDevsW` / `HidD_GetAttributes` (DLL `0x10012620`) and opens separate
read and write handles. On Linux the user needs access to `/dev/hidraw*`, see [help/linux.md](help/linux.md).
macOS and Windows need nothing extra.

## Packet format

Every command is one output report. PLed's central send function (`0x407740`) builds it like this; offsets
include the report ID byte, so the 64 data bytes are offsets 1–64.

| Offset | Value |
| --- | --- |
| 0 | `0x00` report ID |
| 1–2 | `0x55 0xAA` sync |
| 3 | command |
| 4 | `0x00` (high byte of the length) |
| 5 | payload length LEN |
| 6 … 5+LEN | payload, the rest `0x00` |
| 62 | checksum |
| 63–64 | `0x0D 0x0A` |

**Checksum:** the sum of bytes 1 up to and including 5+LEN, modulo 256 (observed, loop at `0x40779d`).

Example, set clock to 2026-10-21 20:15:30:

```
00 55 AA 11 00 07 07 EA 0A 15 14 0F 1E 00 … 00 [62]=68 0D 0A
55+AA+11+00+07+07+EA+0A+15+14+0F+1E = 0x268 → checksum 0x68
```

## Replies

The controller answers almost every command with an input report (observed on hardware). Without the report
ID byte it reads:

```
00 00 CMD 00 01 00 00 … 00      (64 bytes)
```

Byte 2 is the command being confirmed, bytes 3–4 a length of 1 (big-endian) and byte 5 the result, `00` = OK.
The reply does **not** use the `55 AA` framing and has no checksum. PLed only checks the length byte; the
library checks length and result. According to the library, the controller echoes the sent packet from
position 2 when it rejects a command, so the length is not 1.

PLed sends one packet at a time and waits up to 1000 ms for the confirmation. TC420 Web waits up to 3000 ms,
and 10 s for the first packet after a clear (see *Sequences*).

## Commands

| Cmd | Purpose | LEN | Payload | Reply | Status |
| --- | --- | --- | --- | --- | --- |
| `0x11` | set clock | 7 | year (u16 big-endian), month, day, hour, minute, second | yes | observed on hardware |
| `0x03` | clear all programs | 0 | – | yes | observed on hardware |
| `0x12` | program header | 2 + name | bank (0-based), number of steps, name (1–8 ASCII, not padded) | yes | observed on hardware |
| `0x13` | step | 8 | hour, minute, CH1–CH5 (0–100), jump bits | yes | observed on hardware |
| `0x01` | end of a program's steps | 0 | – | **none** | observed on hardware |
| `0x02` | end after all programs; also stops online play | 0 | – | yes | observed on hardware |
| `0x15` | start online play | 2 + name | name (1–8 ASCII), `00 7F` | yes | observed on hardware |
| `0x16` | live channel values | 7 | `F5`, CH1–CH5, `00` | yes | observed on hardware |

PLed's send function has exactly ten call sites, which cover all eight commands.

- **`0x12`**: PLed sends LEN 10 with a padded name; the library (and TC420 Web) send bank, step count and the
  bare name. Both are accepted. A program only overwrites its own bank. Banks should have no gaps: an empty
  bank shows up as an empty program on the display (library).
- **`0x13` jump bits**: bit *n* is channel *n*+1. A set bit means **switch instantly** to the new level at the
  step's time; a clear bit means **fade** gradually from the previous step. (Library; bit layout observed in
  PLed `0x403c76`–`0x403cf5`. Not yet watched on hardware, issue #11.)
- **`0x15`**: the `7F` byte is what PLed sends; the library notes it seems to have no effect.
- **`0x16`**: jump bits do not apply; the controller shows the values at once. The display shows the name
  given to `0x15`.

Example packets (bytes 0 to 5+LEN, then the checksum at offset 62):

| Command | Bytes | Checksum |
| --- | --- | --- |
| `0x03` clear | `00 55 AA 03 00 00` | `02` |
| `0x12` bank 0, 21 steps, "AFRIKA" | `00 55 AA 12 00 08 00 15 41 46 52 49 4B 41` | `DC` |
| `0x13` 09:00, 25/0/30/10/0 %, CH2 jumps | `00 55 AA 13 00 08 09 00 19 00 1E 0A 00 02` | `66` |
| `0x01` end of program | `00 55 AA 01 00 00` | `00` |
| `0x02` end / stop | `00 55 AA 02 00 00` | `01` |
| `0x15` online play "TEST" | `00 55 AA 15 00 06 54 45 53 54 00 7F` | `D9` |
| `0x16` live 10/20/30/40/100 % | `00 55 AA 16 00 07 F5 0A 14 1E 28 64 00` | `D9` |

## Sequences

**Write programs** (PLed's download thread; TC420 Web's `sendToController`):

```
[0x11 set clock]                 TC420 Web: optional, first, doubles as a connection check
 0x03 clear                      TC420 Web: always; PLed only via "ClearAll"
 for each program (bank 0, 1, …):
   0x12 bank, steps, name
   0x13 × steps
   0x01                          no reply; wait ~300 ms (PLed sleeps 20 ms)
 0x02
```

- PLed skips programs with fewer than 2 steps; at most 50 programs and 50 steps per program.
- After `0x03` the controller confirms at once and then erases its memory: the reply to the next packet took
  1255 ms instead of 10–60 ms (observed, 25 Oct 2026).
- After clear + one program in bank 0 + `0x02`, the controller runs that program without any button presses,
  also after a power cycle (observed, 25 Oct 2026). TC420 Web therefore sends one program by default, for
  controllers whose buttons cannot be reached.
- PLed stops at the first missing confirmation, still sends `0x02` and shows *"DownLoad Failed!"*.

**Online play** (preview): `0x15` with a name, then `0x16` repeatedly (PLed: from a timer; TC420 Web: every
60 ms), then `0x02`. Nothing is stored; after `0x02` the controller returns to its program (observed).

**Set clock:** a single `0x11` with the computer's local time.

## Open points

- [ ] Fade versus instant switch on real hardware (test program FADETEST in *Advanced*), issue #11.
- [ ] What the controller does with a step that goes back in time (AMAZONE has 02:30 as its last step).
- [ ] What a rejection reply really looks like.
- [ ] Whether writing fewer programs without a clear leaves programs in higher banks in place.

## Evidence index (PLed)

| Claim | Location | Hopper evidence |
| --- | --- | --- |
| VID/PID and connect | `0x40766d`, DLL `0x10012620` | `ev_3130876b…` |
| Report lengths | DLL `0x10012bd0` | `ev_9bd534d7…` |
| Packet format, checksum, waiting for the reply | `0x407740` | `ev_e0e2def2…` |
| Read thread, reply value | `0x403670` | `ev_d1f3fdd3…` |
| Ten callers of the send function | xrefs of `0x407740` | `ev_d723ac30…` |
| Download flow `0x12`/`0x13`/`0x01`/`0x02` | download thread | `ev_b8c7d88d…` |
| Set clock `0x11` | `0x406b92` | `ev_781b4de3…` |
| Online play `0x15` / `0x16` | `0x406902`, `0x407d13` | `ev_391c3ddb…`, `ev_71b4322a…` |
| Limits of 50 programs / 50 steps | `0x40d6d5`, `0x40ca4a` | disassembly (capstone) |
