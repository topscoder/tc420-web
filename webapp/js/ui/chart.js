// Expected channel levels over the day (or zoomed to one hour around now) as SVG.
import { el } from './dom.js';
import { valuesAt, timeLabel } from '../schedule.js';

export const CH_COLORS = ['var(--ch1)', 'var(--ch2)', 'var(--ch3)', 'var(--ch4)', 'var(--ch5)'];

export function renderChart(container, legend, steps, { zoom = false, now = new Date(), t = (k) => k } = {}) {
  const W = 760;
  const H = 250;
  const x0 = 40;
  const x1 = 744;
  const y0 = 12;
  const y1 = 214;
  const nowM = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const from = zoom ? Math.max(0, Math.min(1380, Math.floor(nowM / 10) * 10 - 10)) : 0;
  const to = zoom ? from + 60 : 1440;
  const tickStep = zoom ? 10 : 180;
  const X = (m) => x0 + ((m - from) / (to - from)) * (x1 - x0);
  const Y = (v) => y1 - (v / 100) * (y1 - y0);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('t4.chartLabel')}">`;
  [0, 50, 100].forEach((v) => {
    svg += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${x0 - 6}" y="${Y(v) + 4}" text-anchor="end" class="tick">${v}</text>`;
  });
  for (let m = Math.ceil(from / tickStep) * tickStep; m <= to; m += tickStep) {
    const label = m === 1440 ? '24:00' : timeLabel(Math.floor(m / 60), m % 60);
    svg += `<line x1="${X(m)}" x2="${X(m)}" y1="${y0}" y2="${y1}" class="grid"/><text x="${X(m)}" y="${y1 + 16}" text-anchor="middle" class="tick">${label}</text>`;
  }
  svg += `<line x1="${X(nowM)}" x2="${X(nowM)}" y1="${y0}" y2="${y1}" stroke="var(--quiet)" stroke-dasharray="3 3"/>`;
  const used = [];
  const sample = (to - from) / 360;
  for (let c = 0; c < 5; c++) {
    if (steps.every((s) => !s.ch[c])) continue;
    used.push(c);
    let d = '';
    for (let m = from; m <= to; m += sample) {
      d += `${m === from ? 'M' : 'L'}${X(m).toFixed(1)} ${Y(valuesAt(steps, Math.min(m, 1439.99))[c]).toFixed(1)}`;
    }
    svg += `<path d="${d}" fill="none" stroke="${CH_COLORS[c]}" stroke-width="2"/>`;
  }
  container.innerHTML = `${svg}</svg>`;
  legend.innerHTML = '';
  for (let c = 0; c < 5; c++) {
    const channel = `CH${c + 1}`;
    const s = el('span', {}, used.includes(c) ? channel : t('t4.unused', { channel }));
    const i = el('i');
    i.style.background = CH_COLORS[c];
    s.prepend(i);
    legend.append(s);
  }
  const nowLabel = timeLabel(now.getHours(), now.getMinutes());
  const values = valuesAt(steps, Math.floor(nowM)).join(' / ');
  legend.append(el('span', { class: 'note' }, t('t4.legendNow', { time: nowLabel, values })));
}
