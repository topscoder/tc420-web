// Who can connect to the TC420: the banner for browsers without USB access,
// the "Which browsers work?" dialog and the one-time Linux setup.
import { LINUX_COMMANDS } from '../platform.js';
import { $ } from './dom.js';

export function mountSupport({ usb, i18n, log }) {
  const t = (key, params) => i18n.t(key, params);

  function render() {
    $('unsupported').hidden = usb.ok;
    if (!usb.ok) {
      const key = usb.reason === 'browser' && usb.browser ? 'banner.browserNamed' : `banner.${usb.reason}`;
      $('unsupported-text').textContent = t(key, { browser: usb.browser });
    }
    const where = [usb.browser || t('support.unknownBrowser'), t(`support.platform.${usb.platform}`)].join(' · ');
    $('platform-info').textContent = t(usb.ok ? 'support.infoOk' : 'support.infoNo', { where });
  }

  function openSupport() {
    $('dlg-support').showModal();
  }

  function openLinux() {
    $('linux-commands').textContent = LINUX_COMMANDS;
    $('linux-copied').textContent = '';
    if ($('dlg-support').open) $('dlg-support').close();
    $('dlg-linux').showModal();
    log('info', 'Linux setup help opened');
  }

  $('btn-support-more').addEventListener('click', openSupport);
  $('btn-support-adv').addEventListener('click', openSupport);
  $('btn-linux-adv').addEventListener('click', openLinux);
  $('dlg-support-linux').addEventListener('click', openLinux);
  $('dlg-support-close').addEventListener('click', () => $('dlg-support').close());
  $('dlg-linux-close').addEventListener('click', () => $('dlg-linux').close());
  $('btn-linux-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(LINUX_COMMANDS);
      $('linux-copied').textContent = t('linux.copied');
    } catch {
      // Clipboard blocked: the commands are selectable with one click instead.
      getSelection().selectAllChildren($('linux-commands'));
    }
  });

  return { render, openSupport, openLinux };
}
