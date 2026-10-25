# The .tmf file format

PLed saves a single TC420 program ("Timer ModeFile") as a `.tmf` file. TC420 Web reads and writes the same
format ([`webapp/js/schedule.js`](../webapp/js/schedule.js): `parseTmf`, `serializeTmf`), so programs can be
moved between PLed and the app.

Worked out from PLed's loader (`0x407010`) and three example files that came with PLed, decoded byte by byte.
The example files are in [`schemas/`](../schemas/).

## Layout

A 12-byte header followed by 56-byte step records up to the end of the file. The size is always
12 + 56 × steps: AFRIKA 12 + 56 × 21 = 1188, AMAZONE 12 + 56 × 25 = 1412, THAILAND 12 + 56 × 20 = 1132 bytes.

### Header

| Offset | Type | Example value | Meaning |
| --- | --- | --- | --- |
| 0 | u32 little-endian | 0 | device type: 0 = TC420, 1 = GM430 (RGB). PLed refuses another type: *"can not match the Equipment type!"* |
| 4 | u32 little-endian | 5 | number of channels. PLed refuses a mismatch: *"This is not a suitable file for this package!"* |
| 8 | u32 little-endian | 3 | third package field, probably a hidden "CycleTime" setting; same check |

### Step record (56 bytes)

The same bytes PLed keeps in memory per step; part of them goes into the `0x13` packet when sending.

| Offset | Type | Meaning | Status |
| --- | --- | --- | --- |
| `0x00` | u32 | always 0 in the examples | unknown |
| `0x04` | u8 | hour (0–23) | observed (PLed formats `[x+4]`:`[x+5]` as `%02d:%02d`) |
| `0x05` | u8 | minute (0–59) | observed |
| `0x06`–`0x2B` | 38 bytes | always 0 | unknown, probably reserved for the RGB device type |
| `0x2C`–`0x30` | 5 × u8 | level CH1…CH5, 0–100 | observed |
| `0x31`–`0x35` | 5 × u8 | jump flag CH1…CH5: 0 = fade, 1 = switch instantly | observed as bits in the `0x13` packet; meaning from the wallneradam/tc420 library |
| `0x36`–`0x37` | 2 bytes | always `94 76` | derived: uninitialised padding. TC420 Web writes zeros here |

The first two steps of `AFRIKA.tmf`:

```
000: 00000000 05000000 03000000                                header: TC420, 5 channels, 3
00c: 00000000 0000 00…(38 zero bytes)… 0000 1400 0000 … 9476   step 1: 00:00, CH3 = 20
044: 00000000 0900 00…(38 zero bytes)… 1900 1e0a 00 … 9476     step 2: 09:00, CH1 = 25, CH3 = 30, CH4 = 10
```

## Rules

- 2 to 50 steps per program; two steps may not have the same time (PLed: *"Add failure,the timepoint is
  exited!"*).
- PLed sends the steps in file order. AMAZONE's last step (02:30) comes after 22:30 in the file; TC420 Web
  sorts the steps by time when importing and tells the user.
- A program name is not stored in the file; PLed uses the file name. TC420 Web limits names to 8 characters
  (A–Z, 0–9, space, `-`), because only 8 are shown on the controller display.

## Decoder (Python)

```python
import struct

def read_tmf(path):
    d = open(path, 'rb').read()
    device, channels, third = struct.unpack_from('<3I', d, 0)
    steps = []
    for off in range(12, len(d) - 55, 56):
        r = d[off:off + 56]
        steps.append({'time': f'{r[4]:02d}:{r[5]:02d}',
                      'levels': list(r[0x2C:0x2C + channels]),
                      'jump': list(r[0x31:0x31 + channels])})
    return device, channels, third, steps
```

## .pmf packages

PLed's `.pmf` files ("Packet Mode File") hold several programs. They start with the same three u32 fields
(observed in Open `0x405490` and Save `0x405850`), followed per program by a u32 name length, the name and the
program data (`0x4071d0`). The program data layout is unknown, because no filled example exists
(`NewPackage.pmf` that came with PLed is 0 bytes). TC420 Web does not read `.pmf` files; its own backups are
JSON.
