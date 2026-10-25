# Changelog

All notable changes to TC420 Web. Versions follow [semantic versioning](https://semver.org/).

## [1.0.0] – 2026-10-25

First public release. Edit the lighting schedules of a TC420 LED time controller in the browser and send them
over USB, without PLed, Windows, installation or internet.

### Features

- **Program editor** with a draggable chart, a step table, *same level for all channels* or each channel
  separately, fade or switch instantly per channel, undo/redo, and templates (day and night, sunrise and
  sunset, winter, summer, and PLed's AFRIKA, AMAZONE and THAILAND).
- **Program library** saved automatically in the browser; import and export of PLed `.tmf` files; backups as
  JSON.
- **Send to TC420**: by default the controller is cleared and gets exactly one program and the right time, and
  runs it straight away without pressing any buttons. *Multiple programs on the controller* is optional.
- **Preview on device**: play a program on the real lights (a day in 1, 2 or 5 minutes) or set levels by hand,
  without storing anything.
- **Guided connecting**: device menu (set clock, clear, disconnect), clear messages for every error, automatic
  reconnect, help for unsupported browsers and the one-time Linux setup.
- **Works offline** after one visit and installs as an app (PWA), with a notice when a new version is ready.
- **English, Nederlands and Deutsch**.
- **Accessible**: WCAG 2.1 AA contrast in light and dark themes, full keyboard use, channels told apart by line
  pattern as well as colour.
- **Advanced** panel for troubleshooting: communication log with export, simulator, manual control, a
  fade/switch test program and a raw packet sender.

### Hardware verified (real TC420, macOS, Chrome)

Set clock, clear, writing programs, online play and the preview. The controller runs a sent program without
button presses, also after a power cycle. See [docs/test-logs](docs/test-logs/README.md).

### Known limitations

- The controller cannot be read back; keep a backup of your programs.
- Instant switching (jump) has not been watched on hardware yet (issue #11).
- Online play is refused under the name of the program stored on the controller, so the preview shows "TEST"
  on the display.

## Before 1.0

- **0.14** (25 Oct 2026): preview fixes after hardware tests (one start attempt at a time, preview name
  "TEST"); license, About section, English documentation and end-user README.
- **0.13**: Preview on device.
- **0.12**: offline use and installing as an app.
- **0.11**: visual design and accessibility.
- **0.10**: browser support, Linux setup and first-visit welcome.
- **0.9**: end-user layout with the test tools in *Advanced*.
- **0.8**: guided connecting and sending, one program by default.
- **0.5–0.7**: translations, program library, visual editor.
- **0.1–0.4** (22–24 Oct 2026): TC420 Testbank, the protocol test bench used to verify the USB protocol on real
  hardware.

[1.0.0]: https://github.com/topscoder/tc420-web/releases/tag/v1.0.0
