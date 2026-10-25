// Online play (0x15/0x16/0x02): the controller shows the values it is sent and
// stores nothing. Used by the manual sliders in Advanced and by the preview.
import { CMD, playInitPayload, playValuesPayload } from '../protocol.js';
import { $, el, setLast } from './dom.js';

const PLAY_INTERVAL_MS = 60;
const CH_COLORS = ['var(--ch1)', 'var(--ch2)', 'var(--ch3)', 'var(--ch4)', 'var(--ch5)'];

export function mountLiveControl({ conn, log, i18n, onChange }) {
  let playing = false;
  let values = [0, 0, 0, 0, 0];
  let sweepTimer = null;
  let stats = { sent: 0, failed: 0, ms: 0 };
  const stopListeners = [];
  const stopped = () => stopListeners.forEach((f) => f());

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

  function showStats() {
    if (!stats.sent) return;
    $('play-stats').textContent = i18n.t('t3.stats', stats);
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
        log('info', `live values CH1–CH5 = ${v.join(' / ')} %${r.ok ? '' : ' (not confirmed)'}`, 'T3');
        lastLogged = key;
        lastLogAt = performance.now();
      }
      showStats();
      if (stats.failed >= 5 && stats.failed === stats.sent) {
        log('error', 'online play: 5 times no confirmation, stopped', 'T3');
        await stop();
        break;
      }
      const wait = PLAY_INTERVAL_MS - (performance.now() - t0);
      if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    }
  }

  // name: shown on the controller display (1–8 characters). Resolves to true when started.
  async function start(name = $('play-name').value) {
    if (playing) return true;
    let payload;
    try {
      payload = playInitPayload(name);
    } catch (e) {
      log('error', e.message, 'T3');
      return false;
    }
    const r = await conn.send(CMD.PLAY_INIT, payload, { test: 'T3' });
    setLast('T3', r.ok, r.ok ? 't3.started' : 't3.startFailed');
    if (!r.ok) return false;
    stats = { sent: 0, failed: 0, ms: 0 };
    setPlaying(true);
    loop();
    return true;
  }

  async function stop() {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
    if (!playing) return;
    setPlaying(false);
    stopped();
    const r = await conn.send(CMD.END, [], { test: 'T3' });
    log(
      'info',
      `online play stopped after ${stats.sent} packets (${stats.failed} failed); last values ${values.join(' / ')} %`,
      'T3',
    );
    setLast('T3', r.ok, r.ok ? 't3.stopped' : 't3.stopFailed', { sent: stats.sent, failed: stats.failed });
  }

  function sweep() {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
      log('info', 'channel test aborted', 'T3');
      return;
    }
    log('info', 'channel test started: CH1 to CH5 each 0→100→0 in 4 s', 'T3');
    const t0 = performance.now();
    sweepTimer = setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      const c = Math.floor(t / 4);
      if (c >= 5) {
        clearInterval(sweepTimer);
        sweepTimer = null;
        setValues([0, 0, 0, 0, 0]);
        log('info', 'channel test done', 'T3');
        return;
      }
      const ph = (t % 4) / 2;
      const v = [0, 0, 0, 0, 0];
      v[c] = Math.round(ph <= 1 ? ph * 100 : (2 - ph) * 100);
      setValues(v);
    }, 50);
  }

  $('btn-play-start').addEventListener('click', () => start());
  $('btn-play-stop').addEventListener('click', stop);
  $('btn-all-0').addEventListener('click', () => setValues([0, 0, 0, 0, 0]));
  $('btn-all-100').addEventListener('click', () => setValues([100, 100, 100, 100, 100]));
  $('btn-sweep').addEventListener('click', sweep);

  return {
    get playing() {
      return playing;
    },
    start,
    stop,
    setValues,
    get values() {
      return values.slice();
    },
    onStop(f) {
      stopListeners.push(f);
    },
    refresh: showStats,
    // The device disappeared: stop the loop without sending anything.
    abort() {
      if (sweepTimer) clearInterval(sweepTimer);
      sweepTimer = null;
      if (!playing) return;
      setPlaying(false);
      stopped();
    },
  };
}
