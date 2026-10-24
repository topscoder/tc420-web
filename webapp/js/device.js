// Connection to a TC420 over WebHID (or the simulator): one command in flight
// at a time, each waiting for the device's reply, like PLed and the library.
import { CMD, CMD_NAMES, buildFrame, frameToReport, describeFrame, parseResponse, toHex } from './protocol.js';

export const REPLY_TIMEOUT_MS = 3000;
export const NO_REPLY_WAIT_MS = 300;

export function describeCollections(dev) {
  return dev.collections
    .map((c) => {
      const size = (reports) =>
        reports
          .map((r) => `id ${r.reportId}: ${r.items.reduce((s, it) => s + it.reportSize * it.reportCount, 0) / 8} B`)
          .join(', ') || 'none';
      return `usagePage 0x${c.usagePage.toString(16)} usage 0x${c.usage.toString(16)} · in [${size(c.inputReports)}] · out [${size(c.outputReports)}]`;
    })
    .join(' | ');
}

const hex2 = (n) => (n ?? 0).toString(16).padStart(2, '0');

export class DeviceConnection {
  // log(kind, text, test, extra) receives every TX/RX line.
  constructor({ log = () => {}, replyTimeoutMs = REPLY_TIMEOUT_MS, noReplyWaitMs = NO_REPLY_WAIT_MS } = {}) {
    this.log = log;
    this.replyTimeoutMs = replyTimeoutMs;
    this.noReplyWaitMs = noReplyWaitMs;
    this.device = null;
    this.waiter = null;
    this.queue = Promise.resolve();
    this.onInputReport = this.onInputReport.bind(this);
  }

  get connected() {
    return !!this.device;
  }

  async open(device) {
    if (!device.opened) await device.open();
    device.addEventListener('inputreport', this.onInputReport);
    this.device = device;
  }

  async close() {
    const device = this.device;
    this.forget();
    if (device && device.opened) await device.close();
  }

  // Drop the device without closing it (it was unplugged).
  forget() {
    if (this.device) this.device.removeEventListener('inputreport', this.onInputReport);
    this.device = null;
  }

  onInputReport(event) {
    const data = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      clearTimeout(w.timer);
      w.resolve({ reportId: event.reportId, data });
    } else {
      this.log('rx', `unexpected reply · report-id ${event.reportId} · ${toHex(data, 16)} …`);
    }
  }

  waitReply(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        resolve(null);
      }, ms);
      this.waiter = { resolve, timer };
    });
  }

  // Resolves to { ok, resp?, ms?, error?, noReply? }; never rejects.
  send(cmd, payload = [], opts = {}) {
    const o = { test: '', expectReply: cmd !== CMD.END_MODE, quiet: false, ...opts };
    const run = () => this.sendNow(cmd, payload, o);
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  async sendNow(cmd, payload, o) {
    const label = `0x${hex2(cmd)} ${CMD_NAMES[cmd] || ''}`.trim();
    if (!this.device) {
      this.log('error', `${label}: not connected`, o.test);
      return { ok: false, error: 'not-connected' };
    }
    const frame = buildFrame(cmd, payload);
    const { reportId, data } = frameToReport(frame);
    if (!o.quiet) this.log('tx', `${label} · ${describeFrame(frame)}`, o.test);
    const reply = this.waitReply(o.expectReply ? this.replyTimeoutMs : this.noReplyWaitMs);
    const t0 = performance.now();
    try {
      await this.device.sendReport(reportId, data);
    } catch (e) {
      if (this.waiter) {
        clearTimeout(this.waiter.timer);
        this.waiter = null;
      }
      this.log('error', `${label}: sending failed · ${e.message}`, o.test);
      return { ok: false, error: e.message };
    }
    const r = await reply;
    const ms = Math.round(performance.now() - t0);
    if (!r) {
      if (o.expectReply) {
        this.log('error', `${label}: no reply within ${this.replyTimeoutMs} ms`, o.test);
        return { ok: false, error: 'timeout' };
      }
      if (!o.quiet) this.log('info', `${label}: no reply (as expected)`, o.test);
      return { ok: true, noReply: true };
    }
    const a = parseResponse(r.data);
    const pledNote = a.ok !== a.pledOk ? ` (PLed rule says ${a.pledOk ? 'OK' : 'NOT OK'})` : '';
    const detail = `${ms} ms · RX ${toHex(r.data, 12)} … · cmd 0x${hex2(a.cmd)}, length ${a.len}, result 0x${hex2(a.result)} → ${a.ok ? 'OK' : 'NOT OK'}${pledNote}`;
    if (!o.quiet || !a.ok) this.log(a.ok ? 'ack' : 'nack', `${label}: ${detail}`, o.test, { rx: toHex(r.data) });
    if (!o.expectReply) this.log('info', `${label}: got a reply anyway (unexpected)`, o.test);
    return { ok: a.ok, resp: a, ms };
  }
}
