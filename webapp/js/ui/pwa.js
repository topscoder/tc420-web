// Offline use and installing as an app: registers the service worker, offers a
// reload when a new version is ready and shows the install button when the
// browser allows it. Without a service worker (development, old browsers)
// the app simply works online.
import { $ } from './dom.js';

export function mountPwa({ i18n, log, toast }) {
  const t = (key, params) => i18n.t(key, params);
  let state = 'online'; // 'online' | 'ready' | 'unsupported' | 'unavailable'
  let installPrompt = null;
  let updateAccepted = false; // reload only for an update the user asked for, not the first install

  function render() {
    $('offline-status').textContent = t(`pwa.status.${state}`);
    $('btn-install').hidden = !installPrompt;
    $('install-hint').hidden = !!installPrompt || matchMedia('(display-mode: standalone)').matches;
  }

  function offerUpdate(worker) {
    log('info', 'a new version of TC420 Web is ready');
    toast(
      'pwa.updateReady',
      {},
      {
        actions: [
          {
            label: 'pwa.reload',
            primary: true,
            run: () => {
              updateAccepted = true;
              worker.postMessage('skipWaiting');
            },
          },
          { label: 'device.notNow', run: () => {} },
        ],
      },
    );
  }

  async function register() {
    if (!('serviceWorker' in navigator)) {
      state = 'unsupported';
      render();
      return;
    }
    let reg;
    try {
      reg = await navigator.serviceWorker.register('sw.js');
    } catch (e) {
      // Expected in development: precache.js only exists in the built site.
      log('info', `offline mode not available here (${e.message})`);
      state = 'unavailable';
      render();
      return;
    }
    // When the new version takes over, load it.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!updateAccepted) return;
      updateAccepted = false;
      location.reload();
    });
    const hadController = !!navigator.serviceWorker.controller;
    if (reg.waiting && hadController) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state !== 'installed') return;
        if (navigator.serviceWorker.controller) offerUpdate(worker);
        else {
          log('info', 'TC420 Web is now available offline');
          state = 'ready';
          render();
        }
      });
    });
    await navigator.serviceWorker.ready;
    state = 'ready';
    render();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own button in Settings
    installPrompt = e;
    render();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    log('info', 'installed as an app');
    render();
  });
  $('btn-install').addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    log('info', `install prompt: ${outcome}`);
    installPrompt = null;
    render();
  });

  register();
  return { render };
}
