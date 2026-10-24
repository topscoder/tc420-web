import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeviceConnection, describeCollections } from '../../webapp/js/device.js';
import { SimDevice } from '../../webapp/js/simulator.js';
import { CMD, clockPayload } from '../../webapp/js/protocol.js';

async function connected(simOptions, connOptions = {}) {
  const lines = [];
  const conn = new DeviceConnection({ log: (kind, text) => lines.push({ kind, text }), ...connOptions });
  const sim = new SimDevice({ latencyMs: 1, ...simOptions });
  await conn.open(sim);
  return { conn, sim, lines };
}

test('a command gets an OK reply and is logged as TX and ACK', async () => {
  const { conn, lines } = await connected();
  const r = await conn.send(CMD.SET_CLOCK, clockPayload(new Date()));
  assert.equal(r.ok, true);
  assert.equal(r.resp.cmd, CMD.SET_CLOCK);
  assert.deepEqual(
    lines.map((l) => l.kind),
    ['tx', 'ack'],
  );
});

test('0x01 expects no reply and still succeeds', async () => {
  const { conn, lines } = await connected({}, { noReplyWaitMs: 20 });
  const r = await conn.send(CMD.END_MODE);
  assert.deepEqual(r, { ok: true, noReply: true });
  assert.ok(lines.at(-1).text.includes('no reply (as expected)'));
});

test('a missing reply times out', async () => {
  const { conn, lines } = await connected({ silentOn: CMD.CLEAR_ALL }, { replyTimeoutMs: 30 });
  const r = await conn.send(CMD.CLEAR_ALL);
  assert.deepEqual(r, { ok: false, error: 'timeout' });
  assert.equal(lines.at(-1).kind, 'error');
});

test('an error echo is reported as not OK', async () => {
  const { conn, lines } = await connected({ failOn: CMD.MODE_INIT });
  const r = await conn.send(CMD.MODE_INIT, [0, 5, 0x41]);
  assert.equal(r.ok, false);
  assert.equal(lines.at(-1).kind, 'nack');
});

test('commands are sent one at a time, in order', async () => {
  const { conn, sim } = await connected({ latencyMs: 5 });
  const results = await Promise.all([conn.send(CMD.SET_CLOCK, [1]), conn.send(CMD.CLEAR_ALL), conn.send(CMD.END)]);
  assert.ok(results.every((r) => r.ok));
  assert.deepEqual(
    sim.sent.map((b) => b[2]),
    [CMD.SET_CLOCK, CMD.CLEAR_ALL, CMD.END],
  );
});

test('quiet mode logs nothing on success but still logs failures', async () => {
  const { conn, lines } = await connected({ failOn: CMD.PLAY_VALUES });
  await conn.send(CMD.SET_CLOCK, [], { quiet: true });
  assert.equal(lines.length, 0);
  await conn.send(CMD.PLAY_VALUES, [0xf5, 0, 0, 0, 0, 0, 0], { quiet: true });
  assert.equal(lines.length, 1);
});

test('sending without a device fails cleanly', async () => {
  const conn = new DeviceConnection();
  assert.deepEqual(await conn.send(CMD.SET_CLOCK), { ok: false, error: 'not-connected' });
});

test('close() closes the device and forgets it', async () => {
  const { conn, sim } = await connected();
  await conn.close();
  assert.equal(conn.connected, false);
  assert.equal(sim.opened, false);
});

test('collections are described with report sizes', () => {
  assert.equal(describeCollections(new SimDevice()), 'usagePage 0xff usage 0xff · in [id 0: 64 B] · out [id 0: 64 B]');
});
