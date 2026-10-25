// Visual program editor: interactive 24 h chart (drag points, double-click to add,
// keyboard control), step table, linked channels, undo/redo and channel names/colours.
import { MAX_STEPS } from '../protocol.js';
import { checkSteps, timeLabel, valuesAt } from '../schedule.js';
import {
  DAY,
  addStep,
  History,
  indexAt,
  isLinked,
  linkChannels,
  minutesOf,
  moveStep,
  removeStep,
  setJump,
  setLevel,
  suggestTime,
} from '../editor-model.js';
import { CHANNEL_NAME_LEN } from '../programs.js';
import { $, el } from './dom.js';
import { ask } from './ask.js';

const W = 760;
const H = 260;
const X0 = 44;
const X1 = 744;
const Y0 = 12;
const Y1 = 214;
const SVG_NS = 'http://www.w3.org/2000/svg';
const SNAP_MINUTES = 5;
// Each channel also has its own line pattern, so channels can be told apart without colour.
const DASHES = ['', '7 4', '2 3', '9 3 2 3', '4 2 1 2'];

// A short sample of a channel's line (colour and pattern) for legends and headers.
function lineSample(color, c) {
  const root = svg('svg', { class: 'swatch', viewBox: '0 0 20 10', width: '20', height: '10', 'aria-hidden': 'true' });
  root.append(
    svg('line', { x1: 1, y1: 5, x2: 19, y2: 5, stroke: color, 'stroke-width': 2.5, 'stroke-dasharray': DASHES[c] }),
  );
  return root;
}

function svg(tag, attrs = {}) {
  const e = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

export function mountEditor({ store, log, i18n, onChange }) {
  const t = (key, params) => i18n.t(key, params);
  const histories = new Map(); // program id → History
  let activeChannel = 0; // channel whose points are draggable when channels are not linked
  let focusMinute = null; // keep keyboard focus on the same step across re-renders
  let draft = null; // steps while dragging, committed on release

  const program = () => store.selected;
  const history = (id) => {
    if (!histories.has(id)) histories.set(id, new History());
    return histories.get(id);
  };
  const names = () => store.settings.channelNames;
  const colors = () => store.settings.channelColors;
  const channelOf = (p) => (p.linked ? null : activeChannel);
  const shownChannel = (p) => (p.linked ? 0 : activeChannel);

  function message(key, params) {
    $('editor-message').textContent = key ? t(key, params) : '';
  }

  // Applies new steps (and linked flag) with an undo snapshot.
  function commit(steps, { linked } = {}) {
    const p = program();
    if (!p || !steps) return false;
    const nextLinked = linked ?? p.linked;
    history(p.id).push({ steps: p.steps, linked: p.linked });
    store.update(p.id, (q) => {
      q.steps = steps;
      q.linked = nextLinked;
    });
    message(null);
    render();
    onChange();
    return true;
  }

  function undoRedo(redo) {
    const p = program();
    if (!p) return;
    const h = history(p.id);
    const snap = redo ? h.redo({ steps: p.steps, linked: p.linked }) : h.undo({ steps: p.steps, linked: p.linked });
    if (!snap) return;
    store.update(p.id, (q) => {
      q.steps = snap.steps;
      q.linked = snap.linked;
    });
    log('info', `${redo ? 'redo' : 'undo'} in ${p.name}`, 'T4');
    render();
    onChange();
  }

  // ---------- chart ----------

  function window_() {
    if (!$('chart-zoom').checked) return { from: 0, to: DAY };
    const now = new Date();
    const nowM = now.getHours() * 60 + now.getMinutes();
    const from = Math.max(0, Math.min(DAY - 60, Math.floor(nowM / 10) * 10 - 10));
    return { from, to: from + 60 };
  }

  function renderChart(steps) {
    const p = program();
    const { from, to } = window_();
    const X = (m) => X0 + ((m - from) / (to - from)) * (X1 - X0);
    const Y = (v) => Y1 - (v / 100) * (Y1 - Y0);
    const minuteAt = (x) => from + ((x - X0) / (X1 - X0)) * (to - from);
    const levelAt = (y) => ((Y1 - y) / (Y1 - Y0)) * 100;

    const root = svg('svg', {
      viewBox: `0 0 ${W} ${H}`,
      role: 'group',
      'aria-label': t('t4.chartLabel'),
      class: 'editor-svg',
    });
    const grid = svg('g', { class: 'grid-lines' });
    [0, 25, 50, 75, 100].forEach((v) => {
      grid.append(svg('line', { x1: X0, x2: X1, y1: Y(v), y2: Y(v), class: 'grid' }));
      const label = svg('text', { x: X0 - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'tick' });
      label.textContent = String(v);
      grid.append(label);
    });
    const tickStep = to - from <= 60 ? 10 : 180;
    for (let m = Math.ceil(from / tickStep) * tickStep; m <= to; m += tickStep) {
      grid.append(svg('line', { x1: X(m), x2: X(m), y1: Y0, y2: Y1, class: 'grid' }));
      const label = svg('text', { x: X(m), y: Y1 + 16, 'text-anchor': 'middle', class: 'tick' });
      label.textContent = m === DAY ? '24:00' : timeLabel(Math.floor(m / 60), m % 60);
      grid.append(label);
    }
    const now = new Date();
    const nowM = now.getHours() * 60 + now.getMinutes();
    if (nowM >= from && nowM <= to) {
      grid.append(svg('line', { x1: X(nowM), x2: X(nowM), y1: Y0, y2: Y1, class: 'now-line' }));
    }
    const hit = svg('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, class: 'chart-hit' });
    root.append(grid, hit);

    // Expected levels: one line when linked, else every used channel, the active one on top.
    const channels = p.linked ? [0] : [0, 1, 2, 3, 4].filter((c) => c === activeChannel || steps.some((s) => s.ch[c]));
    channels.sort((a, b) => (a === shownChannel(p)) - (b === shownChannel(p)));
    const sample = (to - from) / 360;
    channels.forEach((c) => {
      let d = '';
      for (let m = from; m <= to; m += sample) {
        d += `${m === from ? 'M' : 'L'}${X(m).toFixed(1)} ${Y(valuesAt(steps, Math.min(m, DAY - 0.01))[c]).toFixed(1)}`;
      }
      root.append(
        svg('path', {
          d,
          fill: 'none',
          stroke: colors()[c],
          'stroke-dasharray': p.linked ? '' : DASHES[c],
          'stroke-width': c === shownChannel(p) ? 2.5 : 1.5,
          opacity: c === shownChannel(p) ? 1 : 0.55,
          class: 'level-line',
        }),
      );
    });

    // Draggable, focusable points of the active channel.
    const c = shownChannel(p);
    steps.forEach((s, i) => {
      const m = minutesOf(s);
      if (m < from || m > to) return;
      const point = svg('circle', {
        cx: X(m),
        cy: Y(s.ch[c]),
        r: 7,
        class: `step-point${focusMinute === m ? ' focused' : ''}`,
        fill: colors()[c],
        tabindex: '0',
        role: 'slider',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': String(s.ch[c]),
        'aria-valuetext': t('editor.pointLabel', { step: i + 1, time: timeLabel(s.hour, s.minute), level: s.ch[c] }),
        'aria-label': t('editor.pointLabel', { step: i + 1, time: timeLabel(s.hour, s.minute), level: s.ch[c] }),
        'data-minute': String(m),
      });
      const title = svg('title');
      title.textContent = `${timeLabel(s.hour, s.minute)} · ${s.ch[c]} %`;
      point.append(title);
      point.addEventListener('focus', () => {
        focusMinute = m;
        highlightRow(m);
      });
      point.addEventListener('keydown', (e) => onPointKey(e, i));
      point.addEventListener('pointerdown', (e) => startDrag(e, i, { minuteAt, levelAt }));
      root.append(point);
    });

    root.addEventListener('dblclick', (e) => {
      if (e.target.classList.contains('step-point')) return;
      const pt = toSvg(root, e);
      const m = Math.round(minuteAt(pt.x) / SNAP_MINUTES) * SNAP_MINUTES;
      tryAdd(m);
    });

    $('editor-chart').replaceChildren(root);
    if (focusMinute !== null) root.querySelector(`[data-minute="${focusMinute}"]`)?.focus({ preventScroll: true });
  }

  function toSvg(root, e) {
    const pt = root.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(root.getScreenCTM().inverse());
  }

  // The chart is redrawn while dragging, so pointer events are followed on the window.
  function startDrag(e, index, { minuteAt, levelAt }) {
    const p = program();
    e.preventDefault();
    e.target.focus({ preventScroll: true });
    const start = p.steps;
    draft = start;
    let dragIndex = index;
    const ch = channelOf(p);
    const move = (ev) => {
      const root = $('editor-chart').querySelector('svg');
      const pt = toSvg(root, ev);
      const step = ev.shiftKey ? 1 : SNAP_MINUTES;
      const m = Math.max(0, Math.min(DAY - 1, Math.round(minuteAt(pt.x) / step) * step));
      const level = Math.round(Math.max(0, Math.min(100, levelAt(pt.y))));
      let next = setLevel(draft, dragIndex, ch, level);
      const moved = moveStep(next, dragIndex, m);
      if (moved) {
        next = moved;
        dragIndex = indexAt(next, m);
      }
      draft = next;
      focusMinute = minutesOf(draft[dragIndex]);
      renderChart(draft);
      highlightRow(focusMinute, draft);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const result = draft;
      draft = null;
      if (result !== start) {
        const s = result[dragIndex];
        log('info', `step moved in ${p.name}: ${timeLabel(s.hour, s.minute)} ${s.ch[shownChannel(p)]} %`, 'T4');
        commit(result);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function onPointKey(e, index) {
    const p = program();
    const s = p.steps[index];
    const big = e.shiftKey;
    let next;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const delta = (e.key === 'ArrowLeft' ? -1 : 1) * (big ? 30 : SNAP_MINUTES);
      const m = minutesOf(s) + delta;
      next = moveStep(p.steps, index, m);
      if (!next) return message('editor.duplicateTime', { time: timeLabel(Math.floor(m / 60), m % 60) });
      focusMinute = Math.max(0, Math.min(DAY - 1, m));
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const delta = (e.key === 'ArrowDown' ? -1 : 1) * (big ? 10 : 1);
      next = setLevel(p.steps, index, channelOf(p), s.ch[shownChannel(p)] + delta);
      focusMinute = minutesOf(s);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      next = removeStep(p.steps, index);
      if (!next) return message('editor.minSteps');
      focusMinute = null;
    } else {
      return;
    }
    e.preventDefault();
    commit(next);
  }

  function tryAdd(m) {
    const p = program();
    if (p.steps.length >= MAX_STEPS) return message('editor.maxSteps', { max: MAX_STEPS });
    const next = addStep(p.steps, m);
    if (!next) return message('editor.duplicateTime', { time: timeLabel(Math.floor(m / 60), m % 60) });
    focusMinute = m;
    log('info', `step added in ${p.name} at ${timeLabel(Math.floor(m / 60), m % 60)}`, 'T4');
    commit(next);
  }

  // ---------- table ----------

  function highlightRow(minute, steps = program().steps) {
    $('editor-table')
      .querySelectorAll('tr[data-minute]')
      .forEach((tr) => tr.classList.toggle('focused', Number(tr.dataset.minute) === minute));
    if (draft) {
      // While dragging only the time and level of the moving row are refreshed.
      const s = steps.find((x) => minutesOf(x) === minute);
      const row = $('editor-table').querySelector('tr.focused');
      if (s && row) {
        const time = row.querySelector('input[type=time]');
        if (time) time.value = timeLabel(s.hour, s.minute);
      }
    }
  }

  function jumpToggle(p, i, c) {
    const s = p.steps[i];
    const instant = c === null ? s.jump[0] : s.jump[c];
    const b = el(
      'button',
      {
        class: `small seg-toggle${instant ? ' on' : ''}`,
        'aria-pressed': String(instant),
        title: t('editor.changeHint'),
      },
      t(instant ? 'editor.instant' : 'editor.fade'),
    );
    b.addEventListener('click', () => commit(setJump(p.steps, i, c, !instant)));
    return b;
  }

  function levelInput(p, i, c, { slider = false } = {}) {
    const value = p.steps[i].ch[c ?? 0];
    const label = c === null ? t('editor.levelAll') : names()[c];
    const wrap = el('span', { class: 'level-field' });
    const num = el('input', { type: 'number', min: '0', max: '100', value: String(value), 'aria-label': label });
    num.addEventListener('change', () => commit(setLevel(p.steps, i, c, Number(num.value))));
    if (slider) {
      const range = el('input', { type: 'range', min: '0', max: '100', value: String(value), 'aria-label': label });
      range.addEventListener('input', () => {
        num.value = range.value;
      });
      range.addEventListener('change', () => commit(setLevel(p.steps, i, c, Number(range.value))));
      wrap.append(range);
    }
    wrap.append(num, document.createTextNode(' %'));
    return wrap;
  }

  function renderTable(p) {
    const table = $('editor-table');
    table.innerHTML = '';
    const head = el('tr');
    const cols = p.linked
      ? [t('t4.col.step'), t('t4.col.time'), t('editor.levelAll'), t('editor.change'), '']
      : [t('t4.col.step'), t('t4.col.time'), ...names(), ''];
    cols.forEach((h, k) => {
      const th = el('th', {}, h);
      if (!h) th.append(el('span', { class: 'sr-only' }, t('t4.deleteStep'))); // the delete column
      if (!p.linked && k >= 2 && k < 7) th.prepend(lineSample(colors()[k - 2], k - 2));
      head.append(th);
    });
    table.append(head);
    p.steps.forEach((s, i) => {
      const m = minutesOf(s);
      const tr = el('tr', { 'data-minute': String(m) });
      if (m === focusMinute) tr.classList.add('focused');
      tr.append(el('td', {}, String(i + 1)));
      const time = el('input', { type: 'time', value: timeLabel(s.hour, s.minute), 'aria-label': t('t4.col.time') });
      time.addEventListener('change', () => {
        const [h, mi] = time.value.split(':').map(Number);
        if (!(h >= 0) || h * 60 + mi === m) return;
        const next = moveStep(p.steps, i, h * 60 + mi);
        if (!next) {
          message('editor.duplicateTime', { time: time.value });
          time.value = timeLabel(s.hour, s.minute);
          return;
        }
        focusMinute = h * 60 + mi;
        commit(next);
      });
      const tdTime = el('td');
      tdTime.append(time);
      tr.append(tdTime);
      if (p.linked) {
        const tdLevel = el('td');
        tdLevel.append(levelInput(p, i, null, { slider: true }));
        const tdJump = el('td');
        tdJump.append(jumpToggle(p, i, null));
        tr.append(tdLevel, tdJump);
      } else {
        for (let c = 0; c < 5; c++) {
          const td = el('td', { class: 'channel-cell' });
          td.append(levelInput(p, i, c), jumpToggle(p, i, c));
          tr.append(td);
        }
      }
      const del = el('button', { class: 'small', 'aria-label': t('t4.deleteStep'), title: t('t4.deleteStep') }, '×');
      del.disabled = p.steps.length <= 2;
      del.addEventListener('click', () => commit(removeStep(p.steps, i)));
      const tdDel = el('td');
      tdDel.append(del);
      tr.append(tdDel);
      table.append(tr);
    });
  }

  // ---------- channels ----------

  function renderChannelPicker(p) {
    const box = $('channel-picker');
    box.innerHTML = '';
    if (p.linked) {
      box.append(el('span', { class: 'note' }, t('editor.linkedNote')));
      return;
    }
    box.append(el('span', { class: 'note' }, t('editor.channel')));
    names().forEach((name, c) => {
      const b = el(
        'button',
        { class: `small channel-btn${c === activeChannel ? ' on' : ''}`, 'aria-pressed': String(c === activeChannel) },
        name,
      );
      b.prepend(lineSample(colors()[c], c));
      b.addEventListener('click', () => {
        activeChannel = c;
        render();
      });
      box.append(b);
    });
  }

  function renderChannelSettings() {
    const box = $('channel-fields');
    box.innerHTML = '';
    names().forEach((name, c) => {
      const row = el('div', { class: 'row' });
      const color = el('input', {
        type: 'color',
        value: colors()[c],
        'aria-label': t('editor.channelColor', { n: c + 1 }),
      });
      color.addEventListener('change', () => {
        const next = colors().slice();
        next[c] = color.value;
        store.setSetting('channelColors', next);
        render();
      });
      const text = el('input', {
        type: 'text',
        value: name,
        maxlength: String(CHANNEL_NAME_LEN),
        size: '14',
        'aria-label': t('editor.channelName', { n: c + 1 }),
      });
      text.addEventListener('change', () => {
        const next = names().slice();
        next[c] = text.value;
        store.setSetting('channelNames', next);
        log('info', `channel ${c + 1} renamed to "${store.settings.channelNames[c]}"`, 'T4');
        render();
      });
      row.append(el('span', { class: 'tid' }, `CH${c + 1}`), color, text);
      box.append(row);
    });
  }

  // ---------- page ----------

  function render() {
    const p = program();
    $('editor').hidden = !p;
    if (!p) return;
    $('editor-title').textContent = t('t4.editTitle', { name: p.name });
    $('link-channels').checked = p.linked;
    const h = history(p.id);
    $('btn-undo').disabled = !h.canUndo;
    $('btn-redo').disabled = !h.canRedo;
    $('btn-add-step').disabled = p.steps.length >= MAX_STEPS;
    const warnings = checkSteps(p.steps);
    const list = $('editor-warnings');
    list.innerHTML = '';
    if (warnings.length) {
      list.append(el('li', { class: 'lead' }, t('editor.invalid')));
      warnings.forEach((w) => list.append(el('li', {}, t(`schedule.warn.${w.code}`, w))));
    }
    renderChannelPicker(p);
    renderChart(draft || p.steps);
    renderTable(p);
    renderChannelSettings();
  }

  $('link-channels').addEventListener('change', async () => {
    const p = program();
    if (!p) return;
    const on = $('link-channels').checked;
    if (on && !isLinked(p.steps) && !(await ask('editor.linkConfirm', { channel: names()[0] }))) {
      $('link-channels').checked = false;
      return;
    }
    log('info', `channels ${on ? 'linked' : 'unlinked'} in ${p.name}`, 'T4');
    commit(on ? linkChannels(p.steps) : p.steps, { linked: on });
  });
  $('btn-undo').addEventListener('click', () => undoRedo(false));
  $('btn-redo').addEventListener('click', () => undoRedo(true));
  $('btn-add-step').addEventListener('click', () => {
    const p = program();
    if (!p) return;
    const m = suggestTime(p.steps);
    if (m === null) return message('editor.maxSteps', { max: MAX_STEPS });
    tryAdd(m);
  });
  $('chart-zoom').addEventListener('change', () => render());
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || $('editor').hidden) return;
    if (e.target.matches?.('input[type=text], input[type=number], input[type=time]')) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) undoRedo(false);
    else if ((key === 'z' && e.shiftKey) || key === 'y') undoRedo(true);
    else return;
    e.preventDefault();
  });

  return {
    render,
    // Called when another program is selected.
    reset() {
      focusMinute = null;
      draft = null;
      message(null);
    },
  };
}
