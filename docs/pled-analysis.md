# PLed reverse engineering: first analysis

> **Historical document.** This is the first analysis of PLed, written on 21 Oct 2026 before any hardware
> test (translated from the Dutch original). Several open points have since been settled; outdated statements
> are marked **[outdated]**. The current reference is [protocol.md](protocol.md) and [tmf-format.md](tmf-format.md).

Target: `PLed.exe` 1.1 (build 2012-11-12) from the vendor's `Software_tijdcontroller.zip`. Method: static
analysis only. Hopper (via REA) produced the pseudocode, pefile and capstone the disassembly. Nothing was run
and no USB traffic was captured; everything about run-time behaviour was derived from the code.

SHA-256:

- `PLed.exe` → `12616b1bc3811500c3be85a41fd8f1126fd71226adc2c906d8d56b481446048e`
- `YB_UsbFuns.dll` → `794a4338fdcf7cf64c9b9adc391e54fd59f9aeb5c44496a70887c1ea451c0860`

Legend: ✅ seen in the code · 🔶 derived · ❓ unknown

## 1. Structure of the software

| File | Role | Evidence |
| --- | --- | --- |
| `PLed.exe` | MFC GUI (32-bit x86). Project name in the installer: "LEDTimerControl V2.0" | `objdump -p`: imports mfc/gdiplus/`YB_UsbFuns.dll`; installer: `<OutPutPath>E:\zyb\VS src\LEDTimerControl V2.0` |
| `YB_UsbFuns.dll` | Small USB HID helper (debug build) | exports `YB_UsbFindHIDDev`, `YB_USBReadWriteInit`, `YB_UsbRegisterForDeviceNotifications`; imports `HID.DLL` and `SETUPAPI.dll` |
| `mfc100*.dll`, `msvc*100d.dll` | Visual C++ 2010 runtime (partly the **debug** version) | file names and versions |
| `Update.exe` | Updater (not analysed) | – |
| `*.tmf` / `*.pmf` | Mode file ("Timer ModeFiles") / package ("Packet Mode File") | strings. The files shipped in the archive are 0 bytes, so the format is ❓ **[outdated: decoded from three example files, see tmf-format.md]** |

✅ The device is a **USB HID device**: no driver, no serial port.

## 2. Finding the device: VID 0x0888, PID 0x4000

✅ `PLed.exe` at `0x40766d` (function `0x407650`, "connect"):

```asm
push 0x888        ; VendorID
push 0x4000       ; ProductID
lea  ebx,[esi+0x370]   ; -> write handle
lea  edi,[esi+0x36c]   ; -> read handle
push eax               ; HWND
call [YB_UsbFindHIDDev]
```

✅ In the DLL (`0x10012620`, Hopper `ev_3130876b…`) the function walks the HID devices with
`SetupDiGetClassDevsW` / `SetupDiEnumDeviceInterfaces`, then `HidD_GetAttributes`:

```c
if (attr.VendorID == arg_10 /*0x888*/ && attr.ProductID == arg_c /*0x4000*/) {
    YB_UsbRegisterForDeviceNotifications(...);
    *arg_4 = CreateFileW(path, GENERIC_READ,  ...);   // read handle
    *arg_8 = CreateFileW(path, GENERIC_WRITE, ...);   // write handle
}
```

If the device is not found, the app shows `"Device can not be found"`. `YB_USBReadWriteInit` gets the report
lengths with `HidD_GetPreparsedData` / `HidP_GetCaps`; the app uses that length for `WriteFile`.

## 3. Packet format

✅ One central send function: `PLed.exe` `0x407740` (Hopper `ev_e0e2def2…`):

```asm
mov word ptr [ebp-0x48], 0x5500   ; byte0 = 0x00 (HID report ID), byte1 = 0x55
mov byte ptr [ebp-0x46], 0xaa     ; byte2 = 0xAA
mov byte ptr [ebp-0x45], al       ; byte3 = command   (cmd->code)
mov byte ptr [ebp-0x44], 0        ; byte4 = 0x00
mov byte ptr [ebp-0x43], cl       ; byte5 = payload length
memset(buf+6, 0, 0x3b); memcpy(buf+6, cmd->payload, len)
for (i = 1; i < len+6; i++) sum += buf[i];   ; checksum -> [ebp-0x0a] = byte 62
mov word ptr [ebp-9], 0x0a0d       ; bytes 63/64 = 0x0D 0x0A
WriteFile(hWrite, buf, OutputReportLength, ...)
```

```
off: 0    1    2    3    4    5    6 … 5+len       62        63   64
     00 | 55 | AA | CMD| 00 | LEN| payload…  00…  | CHKSUM  | 0D | 0A
CHKSUM = (sum of bytes 1 to 5+len) & 0xFF
```

### Reply ✅

The read thread (`0x403670`, Hopper `ev_d1f3fdd3…`) calls `ReadFile` and stores
`g_ack = (resp[3] << 8) | resp[5]`. After each `WriteFile` the send function waits in 10 ms steps until
`(byte)g_ack == 1`, for at most 1000 ms. 🔶 So the device answers in the same framing, with byte 5 = `0x01`
meaning OK. **[outdated: the reply has its own short format, `00 00 CMD 00 01 00` without report ID; see
protocol.md]**

### Commands

| Cmd | Name (from UI and strings) | LEN | Payload | Evidence |
| --- | --- | --- | --- | --- |
| `0x03` | clear all modes on the controller | 0 | – | ✅ `0x406c94`, right after *"This operation will delete controller all mode, sure you want to delete?"* |
| `0x11` | set clock ("SynTime") | 7 | year high, year low, month, day, hour, minute, second | ✅ `0x406a6b`, fields from `localtime_s` |
| `0x12` | mode header | 10 | index (2 bytes), name (8 characters) | ✅ `0x403ae5`, `0x403b5f`. **[outdated: bank, step count, name 1–8 characters]** |
| `0x13` | mode step | 8 | hour, minute, CH1–CH5, flags | ✅ `0x403c51`, `0x403ce3` |
| `0x01` | 🔶 end of a mode | 0 | – | ✅ `0x403d7d`, after the step loop, then `Sleep(20)`. **[settled: the controller does not reply]** |
| `0x02` | 🔶 end of download / stop session | 0 | – | ✅ `0x403e18` (just before *"DownLoad Success!/Failed!"*), also on Stop/Pause |
| `0x15` | start online play | 8 | mode name (8 bytes) | ✅ `0x406814`, `0x4068fa`. **[outdated: name 1–8 characters plus `00 7F`]** |
| `0x16` | live channel values during online play | channels | one level byte per channel | ✅ `0x407bd9`, sent from `OnTimer`. **[outdated: `F5`, CH1–CH5, `00`]** |

#### Step payload (`0x13`) ✅

Disassembly `0x403c76`–`0x403cf5` reads from a step record of **0x38 = 56 bytes** (the division by 56 is the
constant `0x92492493`):

```asm
mov  ax, word ptr [step+4]      ; -> payload[0..1]
movzx ecx, byte ptr [step+0x2c] ; -> payload[2]  CH1
movzx edx, byte ptr [step+0x2d] ; -> payload[3]  CH2
movzx eax, byte ptr [step+0x2e] ; -> payload[4]  CH3
movzx ecx, byte ptr [step+0x2f] ; -> payload[5]  CH4
movzx edx, byte ptr [step+0x30] ; -> payload[6]  CH5
al = b35<<4 | b34<<3 | b33<<2 | b32<<1 | b31   ; -> payload[7] (one bit per channel)
```

`step+4` = hour and `step+5` = minute follows from three places that format the step time as `%02d:%02d`
(`0x40757d`, `0x40cb11`, `0x40cc68`). 🔶 Bit *n* of the flags is probably "fade vs. jump" for channel *n*+1;
❓ which value means fade is not verified. **[settled by the library: 1 = switch instantly, 0 = fade]**

## 4. Download flow ("Download All Mode To Control")

```
for each mode i in the list:
    "Downloading %d/%d"
    if steps < 2 -> "StepNo must be more than 1", skip the mode
    send 0x12 [i, name8]                   ; header
    for each step:  send 0x13 [hh, mm, CH1..CH5, flags]; Sleep(5)
    send 0x01 []                           ; end of mode;  Sleep(20)
send 0x02 []                               ; end
-> "DownLoad Success!" or "DownLoad Failed!"  (Failed = no confirmation)
```

## 5. Example (calculated, not measured)

Set clock to 2026-10-21 20:15:30:

```
00 55 AA 11 00 07 07 EA 0A 15 14 0F 1E 00 … 00 [62]=68 [63]=0D [64]=0A
```

**[confirmed on hardware on 22 Oct 2026 with the then-current time]**

## 6. Other observations

- The installer configuration (`PLedSetup 1.0.UIF`, GB2312) was made with "YingInstall6.0"; the company is
  only named "LN".
- Two Chinese debug strings in the read thread: "USB读线程启动" and "USB读线程结束" (USB read thread started /
  ended), and "下载线程结束" (download thread ended).
- Debug runtimes (`msvcr100d.dll`, `mfc100ud.dll`) are shipped, so the DLL is a debug build.

## 7. Open points at the time

| Question | Status then | Now |
| --- | --- | --- |
| Meaning of flag bit 0/1 (fade vs. jump) | 🔶 / ❓ | 1 = switch instantly (library); not yet watched on hardware |
| Exact meaning of `0x01` and `0x02` | 🔶 | settled, see protocol.md |
| Reply format beyond bytes 3 and 5 | ❓ | settled on hardware |
| `.tmf` / `.pmf` format | ❓ | `.tmf` decoded; `.pmf` program data still unknown |
| Maximum number of modes / steps | ❓ | 50 / 50 (`0x40d6d5`, `0x40ca4a`) |
| `Update.exe` | not analysed | not analysed |
