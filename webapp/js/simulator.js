// A stand-in for a TC420 HIDDevice: answers every command like the real
// controller did on 22 Oct 2026 (00 00 CMD 00 01 00 …), except 0x01, which
// gets no reply. Like the real one it is slow to answer the packet after a
// clear (0x03), while it erases. Options let tests simulate failures.
import { CMD, VENDOR_ID, PRODUCT_ID } from './protocol.js';

export class SimDevice extends EventTarget {
  constructor({
    latencyMs = 10,
    eraseMs = 1250,
    failOn = null,
    failTimes = Infinity,
    silentOn = null,
    unplugAfter = null,
    openError = null,
  } = {}) {
    super();
    this.opened = false;
    this.productName = 'Time Controller (simulator)';
    this.vendorId = VENDOR_ID;
    this.productId = PRODUCT_ID;
    this.latencyMs = latencyMs;
    this.eraseMs = eraseMs; // extra delay on the reply after a clear
    this.erasing = false;
    this.failOn = failOn; // command that is refused
    this.failTimes = failTimes; // how many times it is refused
    this.silentOn = silentOn; // command that gets no reply
    this.unplugAfter = unplugAfter; // reports accepted before the cable is "pulled"
    this.openError = openError; // DOMException name thrown by open(), e.g. 'NotAllowedError'
    this.sent = [];
    const report = [{ reportId: 0, items: [{ reportSize: 8, reportCount: 64 }] }];
    this.collections = [{ usagePage: 0xff, usage: 0xff, inputReports: report, outputReports: report }];
  }

  async open() {
    if (this.openError) {
      const e = new Error(`simulated ${this.openError}`);
      e.name = this.openError;
      throw e;
    }
    this.opened = true;
  }

  async close() {
    this.opened = false;
  }

  async sendReport(reportId, data) {
    if (!this.opened) throw new Error('device is not open');
    if (this.unplugAfter !== null && this.sent.length >= this.unplugAfter) {
      this.opened = false;
      this.dispatchEvent(new Event('disconnect'));
      throw new Error('The device was disconnected.');
    }
    const bytes = Uint8Array.from(data);
    this.sent.push(bytes);
    const cmd = bytes[2];
    const delay = this.latencyMs + (this.erasing ? this.eraseMs : 0);
    this.erasing = cmd === CMD.CLEAR_ALL;
    if (cmd === CMD.END_MODE || cmd === this.silentOn) return;
    let reply = new Uint8Array(64);
    if (cmd === this.failOn && this.failTimes > 0) {
      this.failTimes--;
      // A refusal as the real TC420 sent it for 0x15 on 25 Oct 2026: length 2 instead of 1.
      reply[2] = cmd;
      reply[4] = 2;
    } else {
      reply[2] = cmd;
      reply[4] = 1;
    }
    setTimeout(() => {
      const ev = new Event('inputreport');
      ev.reportId = 0;
      ev.data = new DataView(reply.buffer);
      this.dispatchEvent(ev);
    }, delay);
  }
}

// Simulator options from the page address, for trying out failures by hand and in tests:
// ?sim=1&simSilent=13&simFail=12&simFailTimes=1&simUnplug=20&simOpen=NotAllowedError (command codes in hex).
export function simOptionsFromUrl(search) {
  const q = new URLSearchParams(search);
  const hex = (k) => (q.has(k) ? parseInt(q.get(k), 16) : null);
  return {
    silentOn: hex('simSilent'),
    failOn: hex('simFail'),
    failTimes: q.has('simFailTimes') ? Number(q.get('simFailTimes')) : Infinity,
    unplugAfter: q.has('simUnplug') ? Number(q.get('simUnplug')) : null,
    openError: q.get('simOpen'),
  };
}
