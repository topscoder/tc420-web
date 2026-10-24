// A stand-in for a TC420 HIDDevice: answers every command like the real
// controller did on 22 Oct 2026 (00 00 CMD 00 01 00 …), except 0x01, which
// gets no reply. Options let tests simulate failures.
import { CMD, VENDOR_ID, PRODUCT_ID } from './protocol.js';

export class SimDevice extends EventTarget {
  constructor({ latencyMs = 10, failOn = null, silentOn = null } = {}) {
    super();
    this.opened = false;
    this.productName = 'Time Controller (SIMULATIE)';
    this.vendorId = VENDOR_ID;
    this.productId = PRODUCT_ID;
    this.latencyMs = latencyMs;
    this.failOn = failOn; // command that gets an error echo
    this.silentOn = silentOn; // command that gets no reply
    this.sent = [];
    const report = [{ reportId: 0, items: [{ reportSize: 8, reportCount: 64 }] }];
    this.collections = [{ usagePage: 0xff, usage: 0xff, inputReports: report, outputReports: report }];
  }

  async open() {
    this.opened = true;
  }

  async close() {
    this.opened = false;
  }

  async sendReport(reportId, data) {
    if (!this.opened) throw new Error('device is not open');
    const bytes = Uint8Array.from(data);
    this.sent.push(bytes);
    const cmd = bytes[2];
    if (cmd === CMD.END_MODE || cmd === this.silentOn) return;
    let reply = new Uint8Array(64);
    if (cmd === this.failOn) {
      reply = bytes.slice(0, 64); // error: the device echoes the sent packet
    } else {
      reply[2] = cmd;
      reply[4] = 1;
    }
    setTimeout(() => {
      const ev = new Event('inputreport');
      ev.reportId = 0;
      ev.data = new DataView(reply.buffer);
      this.dispatchEvent(ev);
    }, this.latencyMs);
  }
}
