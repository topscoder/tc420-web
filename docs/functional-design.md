# PLed: functional description

What the vendor's Windows software for the TC420 offers its users. TC420 Web replaces it; this document
records what it had to cover. How PLed talks to the controller is in [protocol.md](protocol.md).

Reconstructed from the software itself (menu and dialog resources, decompilation of `PLed.exe` 1.1, build
2012-11-12, and `YB_UsbFuns.dll`) and from the three example programs that came with it (AFRIKA, AMAZONE,
THAILAND). PLed was never run for this.

Confidence: **observed** (in code, resources or files) · **derived** (concluded from code, not tested) ·
**unknown**.

## Concepts

| Concept | Meaning |
| --- | --- |
| Channel (CH1–CH5) | A dimmable LED output of the controller; level 0–100 %. |
| Step | A time (hh:mm) with a level and a fade setting per channel. Between steps the controller moves to the new levels. |
| Mode (program) | A named day program: 2 or more steps, name at most 8 characters. TC420 Web calls this a *program*. |
| Schedule file (`.tmf`) | One mode on disk ("Timer ModeFile"), see [tmf-format.md](tmf-format.md). |
| Package (`.pmf`) | A set of modes managed together and sent to the controller in one go. Has a device type, number of channels and cycle time. |
| Download | Writing all modes of the package into the controller's memory. TC420 Web: *Send to TC420*. |
| Online play | Playing the selected mode fast-forwarded (×1 to ×16) on the connected controller to try it. TC420 Web: *Preview on device*. |
| Fade button | A switch per channel per step in the step editor: fade gradually, or switch instantly at the step's time. |
| RGB mode (`.rmf`) | A second device type (GM430) with R/G/B colour steps; in the same application but outside the TC420. |

## Main window and menus

A list of modes on the left, the selected mode's steps on the right, playback buttons at the top and a status
bar at the bottom (observed in the resources). The menu bar exists in Chinese and English; the *Language*
menu only offers *English*, and does nothing.

## All functions

PLed has 23 menu functions and 6 buttons. Each is linked to its handler in the MFC message map
(`0x55d220`–`0x55d568`).

| Menu | Function | What the user does | What happens | Controller needed |
| --- | --- | --- | --- | --- |
| Package | New (Ctrl+N) | Fills in *Package Options*: folder, name, device type (TC420 or GM430), channels | The current package is saved first; a new empty `<folder>\<name>.pmf` | No |
| Package | Open (Ctrl+O) | Picks a `.pmf` file | Reads device type, channels, cycle time and all modes | No |
| Package | Save (Ctrl+S) | – | Writes the package with all modes | No |
| Package | Exit (Alt+F4) | – | Saves, then quits | No |
| Mode | Insert (Ctrl+I) | – | Adds an empty mode *Mode_n* | No |
| Mode | Input (Ctrl+L) | Picks a `.tmf` file | Loads it as a new mode; refused for another device type or channel count | No |
| Mode | Export | Selects a mode | Saves it as a `.tmf` file | No |
| Mode | Edit (Ctrl+E) | Selects a mode (also by right-click) | Opens the step editor | No |
| Mode | Remove (Delete) | Confirms *"Are you sure you want to remove the selected mode?"* | Removes the mode | No |
| Mode | MoveUp / ModeDown (Ctrl+D / Ctrl+U) | – | Moves the mode; the order decides its bank when sending | No |
| Mode | Rename (Ctrl+R) | Types a name (also by double-click) | Renames; only the first 8 characters reach the controller | No |
| Mode | Empty | – | Deletes all steps of the mode | No |
| Control | Download (Alt+L) | – | Sends all modes, showing *Downloading i/n* | Yes |
| Control | SynTime | – | Sets the controller clock to the PC time | Yes |
| Control | ClearAll (Alt+Delete) | Confirms the warning | Erases all modes on the controller | Yes |
| Control | OnlinePlay (Alt+P) | Selects a mode | Plays it fast-forwarded on the controller | Yes |
| Control | Stop | – | Stops online play and turns *Loop* off | Yes |
| Control | Pause | – | Pauses online play | Yes |
| Language | English | – | Nothing (empty handler) | No |
| Help | ViewHelp (F1) | – | Opens `Help.CHM`, which was not included | No |
| Help | About | – | *About PLed*, copyright 2012 | No |
| Help | Check Update | – | Starts `Update.exe` | No |
| Main window | ×1 / ×2 / ×4 / ×8 / ×16 | Clicks a speed | Sets the online play speed | During playback |
| Main window | Loop | Ticks it | Online play starts again at the end | During playback |

New, Open, Save, Remove, Download, SynTime, ClearAll and OnlinePlay were followed in the code; the behaviour of
Empty, Pause and the speed buttons is derived from the functions and texts they use.

## Step editor

Per step: a time and, per channel, a level and a fade button. *Prev*/*Next* to browse, *Add*, *Delete*, *Save*.

| Field | Input | Range |
| --- | --- | --- |
| StepNo | display only | step number |
| Time | hour : minute with arrows | 00:00–23:59 |
| CH1–CH5 | slider and number field | 0–100 % |
| Fade button | button next to each slider | on / off |

Rules PLed enforces (observed): at most 50 steps (*"Time Point beyond the limit!"*); no two steps at the same
time (*"Add failure,the timepoint is exited!"*); at least 2 steps to send (*"StepNo must be more than 1!"*, the
mode is skipped); at most 50 modes (*"Mode beyond limit!"*).

The fade button decides how a channel reaches a step's level. Off: the channel fades from the previous step to
this one. On: the channel keeps its old level and switches at the step's time. This meaning comes from the
wallneradam/tc420 library; it has not yet been watched on hardware (issue #11). All example programs fade
everywhere.

## Workflows in PLed

**Make a schedule:** Package → New (TC420, 5 channels) · Mode → Insert or Input · Rename (max. 8 characters) ·
Edit: add steps (2–50) · Package → Save.

**Send it:** connect the TC420 · Control → SynTime · optionally Control → ClearAll · Control → Download (all
modes in list order, *Downloading 1/n … n/n*, then *"DownLoad Success!"* or *"DownLoad Failed!"*).

**Try a mode:** select it · Control → OnlinePlay · pick a speed (×1–×16) · *Loop* repeats it · Pause / Stop.

## The example programs

All three are daylight simulations for 4 of the 5 channels: dark at night with CH3 as a night light, sunrise
between 08:00 and 10:30, a day level, and sunset between 19:00 and 22:30. TC420 Web ships them as templates.

| Program | Steps | Sunrise | Day level CH1 | Notes |
| --- | --- | --- | --- | --- |
| AFRIKA | 21 | 09:00–10:30 | 90–100 % | CH2 peaks briefly at 100 % around 15:00; night light CH3 20 % |
| AMAZONE | 25 | 08:00–10:00 | max. 60 % | midday dip 14:30–16:30 (all off except CH4 15 %); the last step in the file is 02:30, after 22:30 |
| THAILAND | 20 | 08:30–10:30 | 100 % | brightest: CH1, CH2 and CH4 up to 100 %; night light CH3 40 % at 00:00 |

All fade switches are off in all 66 steps, and CH5 is never used.

## Messages

| Message | When |
| --- | --- |
| Device can not be found | Download, SynTime, ClearAll or OnlinePlay without a TC420 |
| Downloading %d/%d → DownLoad Success! / DownLoad Failed! | During and after sending; *Failed* if a packet is not confirmed within 1 s |
| StepNo must be more than 1! | Sending a mode with fewer than 2 steps |
| Time synchronization success! / failed | After SynTime |
| This operation will delete controller all mode, sure you want to delete? | Before ClearAll |
| Clear Success! / Clear Failed | After ClearAll |
| Play Speed = X %d · Play failed! · Playing End! | Online play |
| can not match the Equipment type! · This is not a suitable file for this package! | Importing an unsuitable `.tmf` |
| Programs are running! | Starting PLed a second time (derived) |

## Limitations of PLed

Windows only, from 2012 (Visual C++ 2010) and no longer updated. *Language* and *Help* do not work, the files
`NewPackage.pmf` and `Tagesablauf 1.tmf` that came with it are empty, and a send stops at the first missing
confirmation without retrying. These are the reasons TC420 Web exists.
