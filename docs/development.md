# Developer notes

TC420 Web is a static web app: plain ES modules, no build step for development, no runtime dependencies.
Node is only needed for the tests, linting and building the published site.

## Run it locally

```bash
python3 -m http.server 8420 --bind 127.0.0.1 --directory webapp
```

Then open <http://localhost:8420/> in Chrome or Edge. On macOS you can also double-click
[`tools/dev-server.command`](../tools/dev-server.command). Add `?sim=1` to use the built-in simulator instead
of a real controller.

Simulator options for trying failures by hand (command codes in hex):

| Address | Effect |
| --- | --- |
| `?sim=1&simSilent=13` | no reply to `0x13` |
| `?sim=1&simFail=12` | an error reply to `0x12` |
| `?sim=1&simUnplug=20` | the cable is "pulled" after 20 packets |
| `?sim=1&simOpen=NotAllowedError` | opening the device fails with that error |

Offline caching only works in the built site, not when serving `webapp/` directly:

```bash
npm run build
```

`scripts/build.mjs` copies the app into `_site/` and writes `precache.js`, the list of files the service worker
keeps, with a content-hash version. GitHub Actions runs the same script and deploys `_site/` to GitHub Pages.

## Tests and checks

```bash
npm install
npm test
```

`npm test` runs the unit tests (`node:test`, `tests/unit/`) and the end-to-end tests (Playwright with Chromium,
`tests/e2e/`, against the simulator). The e2e tests include axe accessibility checks, a keyboard-only flow and
an offline test of the built site. `npm run lint` runs ESLint and Prettier. CI runs all of this on every push
and pull request.

After changing an icon SVG in `webapp/icons/`, run `npm run icons` to render the PNG icons.

## Code map

| File | Purpose |
| --- | --- |
| `webapp/index.html`, `css/app.css` | the page and its styles |
| `js/main.js` | starts the app and wires everything together |
| `js/protocol.js` | the USB protocol: building packets, reading replies ([protocol.md](protocol.md)) |
| `js/schedule.js` | the `.tmf` format, step checks and the expected light levels ([tmf-format.md](tmf-format.md)) |
| `js/device.js` | the connection: one command at a time, waiting for each reply |
| `js/transfer.js` | sending programs: clock, clear, programs, end, with error kinds |
| `js/simulator.js` | a simulated TC420 for `?sim=1` and the tests |
| `js/programs.js`, `js/storage.js` | the program library and where it is saved (IndexedDB, localStorage or memory) |
| `js/editor-model.js` | pure editing operations and undo/redo |
| `js/templates.js`, `js/pled-examples.js` | the templates, including PLed's example programs |
| `js/preview.js` | timing for *Preview on device* |
| `js/platform.js` | browser and platform detection, Linux udev rule |
| `js/logbook.js` | the diagnostic log, always in English |
| `js/i18n.js`, `js/locales/` | translations (English, Dutch, German) |
| `js/ui/` | the user interface parts (programs, editor, device, send, preview, support, PWA, dialogs) |
| `webapp/sw.js` | the service worker for offline use |

## Conventions

- UI texts live in `js/locales/*.js`; all three languages must have the same keys and placeholders (a unit
  test checks this). The log stays in English so it can be shared in bug reports.
- The main view never shows protocol details; those belong in *Advanced*.
- No `alert()`, `confirm()` or `prompt()`; use the dialog in `js/ui/ask.js`.
- Prettier: single quotes, print width 120.
