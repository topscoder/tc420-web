// Which platform and browser the app runs on, and whether it can reach the
// TC420 over USB (WebHID). Everything else (programs, .tmf files) works in
// any modern browser.

export function detectPlatform(nav) {
  const ua = nav.userAgent || '';
  const platform = nav.userAgentData?.platform || nav.platform || '';
  // iPadOS asks for the desktop site and then claims to be a Mac; touch gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/CrOS/.test(ua) || /Chrome OS/i.test(platform)) return 'chromeos';
  if (/Win/.test(platform) || /Windows/.test(ua)) return 'windows';
  if (/Mac/.test(platform) || /Mac OS X/.test(ua)) return 'mac';
  if (/Linux/.test(platform) || /Linux|X11/.test(ua)) return 'linux';
  return 'other';
}

// Browser name for messages, or null when it is not one we name.
export function detectBrowser(nav) {
  const ua = nav.userAgent || '';
  if (/Firefox\/|FxiOS/.test(ua)) return 'Firefox';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\/|CriOS/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return null;
}

// { ok: true } or { ok: false, reason }, where reason is
// 'mobile' (phone or tablet), 'insecure' (not https or localhost) or 'browser'.
export function usbSupport(nav, { secure = true } = {}) {
  const platform = detectPlatform(nav);
  const browser = detectBrowser(nav);
  if ('hid' in nav) return { ok: true, platform, browser };
  if (platform === 'ios' || platform === 'android') return { ok: false, reason: 'mobile', platform, browser };
  if (!secure) return { ok: false, reason: 'insecure', platform, browser };
  return { ok: false, reason: 'browser', platform, browser };
}

// One-time Linux setup: let the logged-in user open the TC420 (USB 0888:4000).
export const LINUX_UDEV_RULE =
  'SUBSYSTEM=="hidraw", ATTRS{idVendor}=="0888", ATTRS{idProduct}=="4000", MODE="0660", TAG+="uaccess"';
export const LINUX_COMMANDS = [
  `echo '${LINUX_UDEV_RULE}' | sudo tee /etc/udev/rules.d/50-tc420.rules`,
  'sudo udevadm control --reload-rules',
  'sudo udevadm trigger',
].join('\n');
