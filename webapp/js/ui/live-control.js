// T3: online play with sliders and a channel sweep. Nothing is stored on the device.
import { CMD, playInitPayload, playValuesPayload } from '../protocol.js';
import { $, el, setLast } from './dom.js';
import { CH_COLORS } from './chart.js';

const PLAY_INTERVAL_MS = 60;

export function mountLiveControl({ conn, log, onChange }) {
  let playing = false;
  let values = [0, 0, 0, 0, 0];
  let sweepTimer = null;
  let stats = { sent: 0, failed: 0, ms: 0 };

  const sliders = [];
  for (let c = 0; c < 5; c++) {
    const lab = el('label', { for: `sl${c}` }, `CH${c + 1}`);
    lab.style.color = CH_COLORS[c];
    const s = el('input', { type: 'range', min: '0', max: '100', value: '0', id: `sl${c}` });
    s.disabled = true;
    const out = el('output', {}, '0 %');
    s.addEventListener('input', () => {
      values[c] = Number(s.value);
      out.textContent = `${s.value} %`;
    });
    $('sliders').append(lab, s, out);
    sliders.push({ s, out });
  }

  function setValues(v) {
    values = v.slice();
    sliders.forEach((x, c) => {
      x.s.value = values[c];
      x.out.textContent = `${values[c]} %`;
    });
  }

  function setPlaying(on) {
    playing = on;
    sliders.forEach((x) => {
      x.s.disabled = !on;
    });
    onChange();
  }

  async function loop() {
    let lastLogged = null;
    let lastLogAt = 0;
    while (playing) {
      const t0 = performance.now();
      const v = values.slice();
      const verbose = $('verbose').checked;
      const r = await conn.send(CMD.PLAY_VALUES, playValuesPayload(v), { test: 'T3', quiet: !verbose });
      stats.sent++;
      if (!r.ok) stats.failed++;
      else stats.ms = r.ms;
      const key = v.join(',');
      // Without verbose logging, log changed values at most twice a second.
      if (!verbose && key !== lastLogged && performance.now() - lastLogAt >= 500) {
        log('info', `live waarden CH1–CH5 = ${v.join(' / ')} %${r.ok ? '' : ' (niet bevestigd)'}`, 'T3');
        lastLogged = key;
        lastLogAt = performance.now();
      }
      $('play-stats').textContent =
        `${stats.sent} pakketten · ${stats.failed} mislukt · laatste antwoord ${stats.ms} ms`;
      if (stats.failed >= 5 && stats.failed === stats.sent) {
        log('fout', 'online play: 5 keer geen bevestiging, gestopt', 'T3');
        await stop();
        break;
      }
      const wait = PLAY_INTERVAL_MS - (performance.now() - t0);
      if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    }
  }

  async function start() {
    let payload;
    try {
      payload = playInitPayload($('play-name').value);
    } catch (e) {
      log('fout', e.message, 'T3');
      return;
    }
    const r = await conn.send(CMD.PLAY_INIT, payload, { test: 'T3' });
    setLast('T3', r.ok, r.ok ? 'online play gestart' : 'start niet bevestigd');
    if (!r.ok) return;
    stats = { sent: 0, failed: 0, ms: 0 };
    setPlaying(true);
    loop();
  }

  async function stop() {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
    setPlaying(false);
    const r = await conn.send(CMD.END, [], { test: 'T3' });
    log(
      'info',
      `online play gestopt na ${stats.sent} pakketten (${stats.failed} mislukt); laatste waarden ${values.join(' / ')} %`,
      'T3',
    );
    setLast('T3', r.ok, r.ok ? `gestopt; ${stats.sent} pakketten, ${stats.failed} mislukt` : 'stop niet bevestigd');
  }

  function sweep() {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
      log('info', 'kanaaltest afgebroken', 'T3');
      return;
    }
    log('info', 'kanaaltest gestart: CH1 t/m CH5 elk 0→100→0 in 4 s', 'T3');
    const t0 = performance.now();
    sweepTimer = setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      const c = Math.floor(t / 4);
      if (c >= 5) {
        clearInterval(sweepTimer);
        sweepTimer = null;
        setValues([0, 0, 0, 0, 0]);
        log('info', 'kanaaltest klaar', 'T3');
        return;
      }
      const ph = (t % 4) / 2;
      const v = [0, 0, 0, 0, 0];
      v[c] = Math.round(ph <= 1 ? ph * 100 : (2 - ph) * 100);
      setValues(v);
    }, 50);
  }

  $('btn-play-start').addEventListener('click', start);
  $('btn-play-stop').addEventListener('click', stop);
  $('btn-all-0').addEventListener('click', () => setValues([0, 0, 0, 0, 0]));
  $('btn-all-100').addEventListener('click', () => setValues([100, 100, 100, 100, 100]));
  $('btn-sweep').addEventListener('click', sweep);

  return {
    get playing() {
      return playing;
    },
    stop,
    // The device disappeared: stop the loop without sending anything.
    abort() {
      if (sweepTimer) clearInterval(sweepTimer);
      sweepTimer = null;
      setPlaying(false);
    },
  };
}
