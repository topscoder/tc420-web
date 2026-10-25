import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeviceConnection } from '../../webapp/js/device.js';
import { SimDevice, simOptionsFromUrl } from '../../webapp/js/simulator.js';
import { CMD } from '../../webapp/js/protocol.js';
import { planTransfer, validatePlan, sendToController, errorKind } from '../../webapp/js/transfer.js';
import { connectErrorKind } from '../../webapp/js/ui/device.js';

const step = (hour, minute, level) => ({ hour, minute, ch: Array(5).fill(level), jump: Array(5).fill(false) });
const WINTER = { id: 'w', name: 'WINTER', steps: [step(0, 0, 10), step(7, 0, 10), step(7, 30, 70)] };
const SUMMER = { id: 's', name: 'SUMMER', steps: [step(0, 0, 10), step(6, 0, 10)] };

async function setup(simOptions = {}) {
  const sim = new SimDevice({ latencyMs: 1, eraseMs: 0, ...simOptions });
  const conn = new DeviceConnection({ replyTimeoutMs: 40, noReplyWaitMs: 5 });
  await conn.open(sim);
  const commands = () => sim.sent.map((b) => b[2]);
  return { sim, conn, commands };
}

test('the default plan is only the selected program, in slot 1', () => {
  const plan = planTransfer({ programs: [WINTER, SUMMER], selectedId: 's', multiple: false });
  assert.deepEqual(
    plan.map((e) => [e.program.name, e.bank]),
    [['SUMMER', 0]],
  );
  const all = planTransfer({ programs: [WINTER, SUMMER], selectedId: 's', multiple: true });
  assert.deepEqual(
    all.map((e) => [e.program.name, e.bank]),
    [
      ['WINTER', 0],
      ['SUMMER', 1],
    ],
  );
  assert.deepEqual(planTransfer({ programs: [WINTER], selectedId: null, multiple: false }), []);
});

test('plans are validated before anything is sent', () => {
  assert.deepEqual(validatePlan([]), { code: 'nothing' });
  assert.deepEqual(validatePlan([{ program: { name: 'X', steps: [step(0, 0, 0)] }, bank: 0 }]), {
    code: 'steps',
    name: 'X',
    count: 1,
  });
  assert.equal(validatePlan([{ program: WINTER, bank: 0 }]), null);
});

test('default send: clock, clear, one program in bank 0, end', async () => {
  const { conn, sim, commands } = await setup();
  const progress = [];
  const r = await sendToController(conn, {
    plan: [{ program: WINTER, bank: 0 }],
    onProgress: (p) => progress.push(p.phase),
  });
  assert.deepEqual(r, { ok: true, entries: [{ id: 'w', bank: 0 }], clockSet: true });
  assert.deepEqual(commands(), [
    CMD.SET_CLOCK,
    CMD.CLEAR_ALL,
    CMD.MODE_INIT,
    CMD.STEP,
    CMD.STEP,
    CMD.STEP,
    CMD.END_MODE,
    CMD.END,
  ]);
  const header = sim.sent[2];
  assert.equal(header[5], 0, 'bank 0');
  assert.equal(header[6], 3, 'step count');
  assert.deepEqual([...new Set(progress)], ['clock', 'clear', 'write', 'end']);
});

test('the packet after the clear may take longer than the normal reply timeout', async () => {
  const { conn, commands } = await setup({ eraseMs: 100 }); // normal timeout in these tests: 40 ms
  const r = await sendToController(conn, { plan: [{ program: WINTER, bank: 0 }] });
  assert.equal(r.ok, true);
  assert.equal(commands().length, 8);
});

test('without the clock the controller is cleared first', async () => {
  const { conn, commands } = await setup();
  const r = await sendToController(conn, { plan: [{ program: SUMMER, bank: 0 }], setClock: false });
  assert.equal(r.ok, true);
  assert.equal(r.clockSet, false);
  assert.deepEqual(commands().slice(0, 2), [CMD.CLEAR_ALL, CMD.MODE_INIT]);
});

test('multiple programs are written to consecutive banks after one clear', async () => {
  const { conn, sim, commands } = await setup();
  const plan = planTransfer({ programs: [WINTER, SUMMER], multiple: true });
  const r = await sendToController(conn, { plan });
  assert.equal(r.ok, true);
  assert.equal(commands().filter((c) => c === CMD.CLEAR_ALL).length, 1);
  const headers = sim.sent.filter((b) => b[2] === CMD.MODE_INIT).map((b) => b[5]);
  assert.deepEqual(headers, [0, 1]);
});

test('no reply to the clock stops before anything is erased', async () => {
  const { conn, commands } = await setup({ silentOn: CMD.SET_CLOCK });
  const r = await sendToController(conn, { plan: [{ program: WINTER, bank: 0 }] });
  assert.deepEqual(r, { ok: false, phase: 'clock', kind: 'noReply', cleared: false });
  assert.deepEqual(commands(), [CMD.SET_CLOCK]);
});

test('a failure while writing reports that the controller may be empty', async () => {
  const { conn } = await setup({ silentOn: CMD.STEP });
  const r = await sendToController(conn, { plan: [{ program: WINTER, bank: 0 }] });
  assert.deepEqual(r, { ok: false, phase: 'write', kind: 'noReply', cleared: true, name: 'WINTER', step: 1 });
});

test('an error reply is "rejected"', async () => {
  const { conn } = await setup({ failOn: CMD.MODE_INIT });
  const r = await sendToController(conn, { plan: [{ program: WINTER, bank: 0 }] });
  assert.equal(r.kind, 'rejected');
  assert.equal(r.step, 0);
});

test('pulling the cable is "disconnected"', async () => {
  const { conn, sim } = await setup({ unplugAfter: 4 });
  let unplugged = false;
  sim.addEventListener('disconnect', () => {
    unplugged = true;
  });
  const r = await sendToController(conn, { plan: [{ program: WINTER, bank: 0 }] });
  assert.equal(r.kind, 'disconnected');
  assert.equal(r.cleared, true);
  assert.ok(unplugged);
});

test('an invalid plan sends nothing', async () => {
  const { conn, commands } = await setup();
  const r = await sendToController(conn, { plan: [{ program: { name: 'X', steps: [] }, bank: 0 }] });
  assert.equal(r.kind, 'invalid');
  assert.deepEqual(commands(), []);
});

test('error kinds from send results and from opening the device', () => {
  assert.equal(errorKind({ ok: true }), null);
  assert.equal(errorKind({ ok: false, error: 'timeout' }), 'noReply');
  assert.equal(errorKind({ ok: false, resp: { ok: false } }), 'rejected');
  assert.equal(errorKind({ ok: false, error: 'not-connected' }), 'disconnected');
  assert.equal(errorKind({ ok: false, error: 'The device was disconnected.' }), 'disconnected');
  const named = (name) => Object.assign(new Error(name), { name });
  assert.equal(connectErrorKind(named('NotAllowedError')), 'denied');
  assert.equal(connectErrorKind(named('SecurityError')), 'denied');
  assert.equal(connectErrorKind(named('InvalidStateError')), 'busy');
  assert.equal(connectErrorKind(named('NotFoundError')), 'noDevice');
  assert.equal(connectErrorKind(named('Weird')), 'unknown');
});

test('simulator options can be set from the page address', () => {
  assert.deepEqual(simOptionsFromUrl('?sim=1&simSilent=13&simFail=12&simUnplug=20&simOpen=NotAllowedError'), {
    silentOn: 0x13,
    failOn: 0x12,
    unplugAfter: 20,
    openError: 'NotAllowedError',
  });
  assert.deepEqual(simOptionsFromUrl('?sim=1'), { silentOn: null, failOn: null, unplugAfter: null, openError: null });
});
