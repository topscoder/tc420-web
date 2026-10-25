// Connecting to the TC420: the status button with its menu, the explanation
// before the browser's device chooser, the "set the clock?" toast, clearing
// the controller and handling unplugging. Messages are translated; log lines
// stay in English.
import { CMD, VENDOR_ID, PRODUCT_ID, clockPayload } from '../protocol.js';
import { describeCollections } from '../device.js';
import { SimDevice, simOptionsFromUrl } from '../simulator.js';
import { $, el, setLast } from './dom.js';

const EXPLAINED_KEY = 'tc420-connect-explained';

// Why opening the device failed, for the user.
export function connectErrorKind(error) {
  switch (error?.name) {
    case 'NotFoundError':
      return 'noDevice';
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    case 'InvalidStateError':
    case 'NetworkError':
    case 'AbortError':
      return 'busy';
    default:
      return 'unknown';
  }
}

export function mountDevice({
  conn,
  store,
  log,
  i18n,
  sim,
  storage,
  live,
  usb = { ok: true },
  support = null,
  onChange,
  onControllerChange = () => {},
}) {
  const t = (key, params) => i18n.t(key, params);
  const timeNow = () => i18n.formatDateTime(new Date(), { hour: '2-digit', minute: '2-digit' });

  // ---------- toast ----------

  let toastTimer = null;
  function toast(key, params = {}, { actions = [], bad = false, sticky = false } = {}) {
    const box = $('toast');
    clearTimeout(toastTimer);
    $('toast-text').textContent = t(key, params);
    box.classList.toggle('bad', bad);
    const row = $('toast-actions');
    row.innerHTML = '';
    actions.forEach(({ label, primary, run }) => {
      const b = el('button', { class: `small${primary ? ' primary' : ''}` }, t(label));
      b.addEventListener('click', () => {
        hideToast();
        run();
      });
      row.append(b);
    });
    box.hidden = false;
    if (!sticky && !actions.length) toastTimer = setTimeout(hideToast, 6000);
  }
  function hideToast() {
    $('toast').hidden = true;
  }

  // ---------- status button and menu ----------

  function render() {
    const on = conn.connected;
    const btn = $('btn-connect');
    btn.textContent = on ? t('device.chipConnected') : t(usb.ok ? 'device.chipConnect' : 'device.chipNoUsb');
    btn.classList.toggle('connected', on);
    btn.classList.toggle('no-usb', !usb.ok);
    btn.setAttribute('aria-haspopup', on ? 'menu' : usb.ok ? 'false' : 'dialog');
    $('dot').classList.toggle('on', on);
    $('status-text').textContent = on
      ? t('header.status.connected', { name: conn.device.productName || 'TC420' })
      : t('header.status.disconnected');
    $('menu-clock').textContent = t('device.menuClock', { time: timeNow() });
    if (!on) closeMenu();
  }

  function openMenu() {
    $('menu-clock').textContent = t('device.menuClock', { time: timeNow() });
    $('device-menu').hidden = false;
    $('btn-connect').setAttribute('aria-expanded', 'true');
    $('menu-clock').focus();
  }
  function closeMenu() {
    $('device-menu').hidden = true;
    $('btn-connect').setAttribute('aria-expanded', 'false');
  }

  // ---------- connecting ----------

  function remembered(key) {
    try {
      return storage?.getItem(key);
    } catch {
      return null;
    }
  }

  // Shown once: what the browser's device chooser will ask.
  function explain() {
    if (remembered(EXPLAINED_KEY)) return Promise.resolve(true);
    const dlg = $('dlg-connect');
    return new Promise((resolve) => {
      const done = (ok) => {
        dlg.close();
        if (ok) {
          try {
            storage?.setItem(EXPLAINED_KEY, '1');
          } catch {
            // Not remembered; the explanation shows again next time.
          }
        }
        resolve(ok);
      };
      $('dlg-connect-ok').onclick = () => done(true);
      $('dlg-connect-cancel').onclick = () => done(false);
      dlg.oncancel = () => done(false);
      dlg.showModal();
    });
  }

  function failed(kind, error) {
    log('error', `connecting failed (${kind}): ${error?.name || ''} ${error?.message || ''}`.trim(), 'T1');
    // On Linux "denied" nearly always means the one-time udev setup is missing.
    const linux = kind === 'denied' && usb.platform === 'linux' && support;
    const key = linux ? 'device.error.deniedLinux' : `device.error.${kind}`;
    setLast('T1', false, key);
    const actions = linux ? [{ label: 'linux.open', primary: true, run: support.openLinux }] : [];
    toast(key, {}, { bad: true, sticky: kind !== 'noDevice', actions });
  }

  async function open(dev, how, { offerClock = true } = {}) {
    try {
      await conn.open(dev);
    } catch (e) {
      failed(connectErrorKind(e), e);
      return false;
    }
    dev.addEventListener('disconnect', unplugged); // the simulator signals unplugging on the device itself
    log(
      'info',
      `${how}: ${dev.productName || '(no name)'} · VID 0x${dev.vendorId.toString(16).padStart(4, '0')} PID 0x${dev.productId.toString(16).padStart(4, '0')} · ${describeCollections(dev)}`,
      'T1',
    );
    setLast('T1', true, 't1.connected', { name: dev.productName || 'TC420' });
    onChange();
    if (offerClock) offerClockSync();
    return true;
  }

  // Resolves to true when a controller is connected. offerClock: show the "set the clock?" toast afterwards.
  async function connect({ offerClock = true } = {}) {
    if (conn.connected) return true;
    if (!usb.ok) {
      support?.openSupport();
      return false;
    }
    if (sim) return open(new SimDevice(simOptionsFromUrl(location.search)), 'simulator opened', { offerClock });
    if (!(await explain())) {
      log('info', 'connecting cancelled', 'T1');
      return false;
    }
    let list;
    try {
      list = await navigator.hid.requestDevice({ filters: [{ vendorId: VENDOR_ID, productId: PRODUCT_ID }] });
    } catch (e) {
      failed(connectErrorKind(e), e);
      return false;
    }
    if (!list.length) {
      failed('noDevice');
      return false;
    }
    return open(list[0], 'device opened', { offerClock });
  }

  async function disconnect() {
    if (live.playing) await live.stop();
    await conn.close();
    log('info', 'connection closed', 'T1');
    onChange();
  }

  function unplugged() {
    if (!conn.device) return;
    live.abort();
    conn.forget();
    log('error', 'TC420 unplugged', 'T1');
    toast('device.unplugged', {}, { bad: true });
    onChange();
  }

  // ---------- clock ----------

  async function setClock() {
    const r = await conn.send(CMD.SET_CLOCK, clockPayload(new Date()), { test: 'T2' });
    setLast('T2', r.ok, r.ok ? 't2.ok' : 't2.failed');
    if (r.ok) toast('device.clockSet', { time: timeNow() });
    else toast('device.clockFailed', {}, { bad: true });
    return r.ok;
  }

  function offerClockSync() {
    toast(
      'device.clockOffer',
      { time: timeNow() },
      {
        actions: [
          { label: 'device.setClock', primary: true, run: setClock },
          { label: 'device.notNow', run: () => log('info', 'clock offer dismissed', 'T2') },
        ],
      },
    );
  }

  // ---------- clearing ----------

  function confirmClear() {
    const dlg = $('dlg-clear');
    return new Promise((resolve) => {
      $('dlg-clear-ok').onclick = () => {
        dlg.close();
        resolve(true);
      };
      $('dlg-clear-cancel').onclick = () => {
        dlg.close();
        resolve(false);
      };
      dlg.oncancel = () => resolve(false);
      dlg.showModal();
    });
  }

  async function clearController() {
    if (!(await confirmClear())) return;
    if (live.playing) await live.stop();
    const r = await conn.send(CMD.CLEAR_ALL, [], { test: 'T6' });
    if (r.ok) {
      store.markSent([]);
      onControllerChange();
      log('info', 'controller cleared from the device menu', 'T6');
      toast('device.cleared');
    } else {
      toast('device.clearFailed', {}, { bad: true });
    }
    setLast('T6', r.ok, r.ok ? 't6.ok' : 't6.failed');
    onChange();
  }

  // ---------- events ----------

  $('btn-connect').addEventListener('click', () => {
    if (!conn.connected) connect();
    else if ($('device-menu').hidden) openMenu();
    else closeMenu();
  });
  $('menu-clock').addEventListener('click', () => {
    closeMenu();
    setClock();
  });
  $('menu-clear').addEventListener('click', () => {
    closeMenu();
    clearController();
  });
  $('menu-disconnect').addEventListener('click', () => {
    closeMenu();
    disconnect();
  });
  document.addEventListener('click', (e) => {
    if (!$('device-menu').hidden && !e.target.closest('.device-wrap')) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('device-menu').hidden) {
      closeMenu();
      $('btn-connect').focus();
    }
  });

  if (!sim && 'hid' in navigator) {
    navigator.hid.addEventListener('disconnect', (e) => {
      if (conn.device && e.device === conn.device) unplugged();
    });
    navigator.hid.getDevices().then((devs) => {
      const dev = devs.find((d) => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID);
      if (dev) open(dev, 'reconnected automatically', { offerClock: false });
    });
  }

  return { render, connect, disconnect, setClock, toast, hideToast, unplugged };
}
