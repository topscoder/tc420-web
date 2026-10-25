// "Preview on device": plays the selected program fast-forwarded on the real
// lights with online play, or sets levels by hand. Nothing is stored on the
// controller; stopping (also by leaving the page) returns it to its program.
import { valuesAt } from '../schedule.js';
import { advance, clockAt, SPEEDS } from '../preview.js';
import { $, el } from './dom.js';

const TICK_MS = 100;
// On 25 Oct 2026 a real TC420 refused online play for "SUNRISE" (reply length 2)
// after accepting "TEST" on 22 Oct. If the program name is refused, the
// preview tries once more with this name, which is known to work.
export const FALLBACK_NAME = 'TEST';

export function mountPreview({ conn, store, live, editor, log, i18n }) {
  const t = (key, params) => i18n.t(key, params);
  let mode = 'play'; // 'play' | 'manual'
  let speed = 2;
  let minute = 0;
  let running = false; // playback advancing (otherwise: holding the current time)
  let timer = null;
  let lastTick = 0;
  const manual = [0, 0, 0, 0, 0];
  const sliders = [];
  let starting = null; // the start attempt in progress, so slider moves do not start it again
  let refused = false; // the last start attempt was refused

  const program = () => store.selected;
  const active = () => live.playing;

  // ---------- manual sliders ----------

  for (let c = 0; c < 5; c++) {
    const label = el('label', { for: `pv${c}` });
    const input = el('input', { type: 'range', min: '0', max: '100', value: '0', id: `pv${c}` });
    const out = el('output', { for: `pv${c}` }, '0 %');
    input.addEventListener('input', async () => {
      manual[c] = Number(input.value);
      out.textContent = `${input.value} %`;
      if (!refused && (await ensureLive())) live.setValues(manual); // after a refusal only Play tries again
    });
    $('preview-sliders').append(label, input, out);
    sliders.push({ label, input, out });
  }

  // ---------- playback ----------

  function ensureLive() {
    if (active()) return Promise.resolve(true);
    if (!conn.connected || !program()) return Promise.resolve(false);
    starting ??= startLive().finally(() => {
      starting = null;
    });
    return starting;
  }

  async function startLive() {
    const name = program().name;
    let ok = await live.start(name);
    if (!ok && name !== FALLBACK_NAME && conn.connected) {
      log('info', `preview: the controller refused online play as ${name}; trying again as ${FALLBACK_NAME}`);
      ok = await live.start(FALLBACK_NAME);
    }
    refused = !ok;
    if (ok) log('info', `preview started: ${name} (${mode})`);
    else log('error', 'preview: the controller refused online play');
    render();
    return ok;
  }

  function show(m) {
    minute = m;
    const p = program();
    if (p && active() && mode === 'play') live.setValues(valuesAt(p.steps, minute));
    $('preview-time').value = String(Math.floor(minute));
    $('preview-time').setAttribute('aria-valuetext', clockAt(minute));
    $('preview-clock').textContent = clockAt(minute);
    editor.setCursor(active() && mode === 'play' ? minute : null);
  }

  function tick() {
    const now = performance.now();
    if (running) show(advance(minute, now - lastTick, speed));
    lastTick = now;
  }

  async function play() {
    if (!(await ensureLive())) return;
    running = true;
    lastTick = performance.now();
    clearInterval(timer);
    timer = setInterval(tick, TICK_MS);
    show(minute);
    render();
  }

  function pause() {
    running = false;
    render();
  }

  async function stop() {
    if (active())
      await live.stop(); // sends 0x02; reset() follows via onStop
    else reset();
  }

  // Online play ended (stop, unplug, sending a program, too many failures).
  function reset() {
    clearInterval(timer);
    timer = null;
    running = false;
    editor.setCursor(null);
    render();
  }

  function setMode(next) {
    mode = next;
    if (mode === 'manual') {
      running = false;
      editor.setCursor(null);
      if (active()) live.setValues(manual);
    } else if (active()) show(minute);
    render();
  }

  // ---------- rendering ----------

  function render() {
    const panel = $('preview-panel');
    const names = store.settings.channelNames;
    sliders.forEach((s, c) => {
      s.label.textContent = names[c];
    });
    $('preview-play').hidden = mode !== 'play';
    $('preview-manual').hidden = mode !== 'manual';
    $('btn-preview-play').textContent = t(running ? 'preview.pause' : 'preview.play');
    $('btn-preview-play').disabled = !conn.connected || !program();
    $('btn-preview-stop').disabled = !active();
    sliders.forEach((s) => {
      s.input.disabled = !conn.connected;
    });
    $('preview-state').classList.toggle('warn-text', conn.connected && !active() && refused);
    $('preview-state').textContent = !conn.connected
      ? t('preview.needsDevice')
      : !active() && refused
        ? t('preview.refused')
        : active()
          ? t(mode === 'manual' ? 'preview.stateManual' : running ? 'preview.statePlaying' : 'preview.stateHolding', {
              name: program()?.name || '',
            })
          : t('preview.stateIdle');
    $('btn-preview').setAttribute('aria-expanded', String(!panel.hidden));
    $('btn-preview').disabled = !program();
  }

  // ---------- events ----------

  $('btn-preview').addEventListener('click', () => {
    $('preview-panel').hidden = !$('preview-panel').hidden;
    if ($('preview-panel').hidden) stop();
    render();
  });
  $('btn-preview-play').addEventListener('click', () => (running ? pause() : play()));
  $('btn-preview-stop').addEventListener('click', stop);
  $('preview-time').addEventListener('input', async () => {
    minute = Number($('preview-time').value);
    if (mode === 'play' && !refused && (await ensureLive())) {
      if (!timer) {
        lastTick = performance.now();
        timer = setInterval(tick, TICK_MS);
      }
      render();
    }
    show(minute);
  });
  document.querySelectorAll('input[name="preview-speed"]').forEach((r) => {
    r.checked = Number(r.value) === speed;
    r.addEventListener('change', () => {
      speed = SPEEDS.includes(Number(r.value)) ? Number(r.value) : 2;
    });
  });
  document.querySelectorAll('input[name="preview-mode"]').forEach((r) => {
    r.addEventListener('change', () => setMode(r.value));
  });
  live.onStop(() => {
    log('info', 'preview stopped');
    reset();
  });

  show(0);
  render();
  return { render, stop };
}
