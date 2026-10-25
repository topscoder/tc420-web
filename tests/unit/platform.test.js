import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPlatform, detectBrowser, usbSupport, LINUX_COMMANDS } from '../../webapp/js/platform.js';

const UA = {
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:132.0) Gecko/20100101 Firefox/132.0',
  winEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  linuxChrome: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  chromeOs:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
};

test('recognises the platform, including an iPad that claims to be a Mac', () => {
  assert.equal(detectPlatform({ userAgent: UA.macChrome, platform: 'MacIntel', maxTouchPoints: 0 }), 'mac');
  assert.equal(detectPlatform({ userAgent: UA.macSafari, platform: 'MacIntel', maxTouchPoints: 5 }), 'ios');
  assert.equal(detectPlatform({ userAgent: UA.iphone, platform: 'iPhone' }), 'ios');
  assert.equal(detectPlatform({ userAgent: UA.android, platform: 'Linux armv8l' }), 'android');
  assert.equal(detectPlatform({ userAgent: UA.winEdge, platform: 'Win32' }), 'windows');
  assert.equal(detectPlatform({ userAgent: UA.linuxChrome, platform: 'Linux x86_64' }), 'linux');
  assert.equal(detectPlatform({ userAgent: UA.chromeOs, platform: 'Linux x86_64' }), 'chromeos');
  assert.equal(detectPlatform({ userAgent: UA.winEdge, userAgentData: { platform: 'Windows' } }), 'windows');
});

test('names the browser', () => {
  assert.equal(detectBrowser({ userAgent: UA.macChrome }), 'Chrome');
  assert.equal(detectBrowser({ userAgent: UA.macSafari }), 'Safari');
  assert.equal(detectBrowser({ userAgent: UA.macFirefox }), 'Firefox');
  assert.equal(detectBrowser({ userAgent: UA.winEdge }), 'Edge');
  assert.equal(detectBrowser({ userAgent: 'curl/8' }), null);
});

test('USB support: WebHID, phones and tablets, insecure pages, other browsers', () => {
  assert.equal(usbSupport({ userAgent: UA.macChrome, hid: {} }).ok, true);
  assert.equal(usbSupport({ userAgent: UA.iphone }).reason, 'mobile');
  assert.equal(usbSupport({ userAgent: UA.macSafari, maxTouchPoints: 5 }).reason, 'mobile');
  assert.equal(usbSupport({ userAgent: UA.android }).reason, 'mobile');
  assert.equal(usbSupport({ userAgent: UA.linuxChrome }, { secure: false }).reason, 'insecure');
  const safari = usbSupport({ userAgent: UA.macSafari, maxTouchPoints: 0 });
  assert.deepEqual([safari.ok, safari.reason, safari.browser], [false, 'browser', 'Safari']);
  assert.equal(usbSupport({ userAgent: UA.macFirefox }).browser, 'Firefox');
});

test('the Linux commands install a udev rule for the TC420', () => {
  assert.match(LINUX_COMMANDS, /ATTRS\{idVendor\}=="0888", ATTRS\{idProduct\}=="4000"/);
  assert.match(LINUX_COMMANDS, /\/etc\/udev\/rules\.d\/50-tc420\.rules/);
  assert.match(LINUX_COMMANDS, /udevadm trigger/);
});
