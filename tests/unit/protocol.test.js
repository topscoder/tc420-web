import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../../webapp/js/protocol.js';

// Reference packets generated with the hardware-tested wallneradam/tc420 Python
// library (64 bytes, no report ID): significant prefix, then zeros, checksum, 0D 0A.
const REFERENCE = {
  clock: ['55aa11000707ea0a15140f1e', 0x68],
  init: ['55aa1200080315414652494b41', 0xdf],
  step: ['55aa130008090019001e0a0014', 0x78],
  endMode: ['55aa010000', 0x00],
  end: ['55aa020000', 0x01],
  clear: ['55aa030000', 0x02],
  play: ['55aa15000654455354007f', 0xd9],
  values: ['55aa160007f50a141e286400', 0xd9],
};

const FRAMES = {
  clock: () => P.buildFrame(0x11, P.clockPayload(new Date(2026, 9, 21, 20, 15, 30))),
  init: () => P.buildFrame(0x12, P.modeInitPayload(3, 21, 'AFRIKA')),
  step: () =>
    P.buildFrame(
      0x13,
      P.stepPayload({ hour: 9, minute: 0, ch: [25, 0, 30, 10, 0], jump: [false, false, true, false, true] }),
    ),
  endMode: () => P.buildFrame(0x01),
  end: () => P.buildFrame(0x02),
  clear: () => P.buildFrame(0x03),
  play: () => P.buildFrame(0x15, P.playInitPayload('TEST')),
  values: () => P.buildFrame(0x16, P.playValuesPayload([10, 20, 30, 40, 100])),
};

for (const [name, [prefix, checksum]] of Object.entries(REFERENCE)) {
  test(`packet "${name}" matches the Python library byte for byte`, () => {
    const { reportId, data } = P.frameToReport(FRAMES[name]());
    assert.equal(reportId, 0);
    const expected = Buffer.alloc(64);
    Buffer.from(prefix, 'hex').copy(expected);
    expected[61] = checksum;
    expected[62] = 0x0d;
    expected[63] = 0x0a;
    assert.equal(Buffer.from(data).toString('hex'), expected.toString('hex'));
  });
}

test('frame is 65 bytes with report ID 0 and CR LF at the end', () => {
  const f = P.buildFrame(0x11, [1, 2, 3]);
  assert.equal(f.length, 65);
  assert.equal(f[0], 0);
  assert.deepEqual([f[63], f[64]], [0x0d, 0x0a]);
});

test('payload longer than 56 bytes is rejected', () => {
  assert.throws(() => P.buildFrame(0x11, new Array(57).fill(0)));
});

test('reply observed on a real TC420 (22 Oct 2026) is OK', () => {
  const reply = new Uint8Array(64);
  reply[2] = 0x11;
  reply[4] = 0x01;
  assert.deepEqual(P.parseResponse(reply), { cmd: 0x11, len: 1, result: 0, ok: true, pledOk: true });
});

test('an echoed packet (error) is not OK', () => {
  const echo = P.buildFrame(0x13, [9, 0, 1, 2, 3, 4, 5, 0]).slice(1);
  assert.equal(P.parseResponse(echo).ok, false);
});

test('channel levels are clamped to 0..100 and jump bits set per channel', () => {
  assert.deepEqual(
    P.stepPayload({ hour: 7, minute: 30, ch: [150, -5, 50.4, 'x'], jump: [true, false, false, true, true] }),
    [7, 30, 100, 0, 50, 0, 0, 0b11001],
  );
  assert.deepEqual(P.playValuesPayload([101, 0, 0, 0, 0]), [0xf5, 100, 0, 0, 0, 0, 0]);
});

test('names are trimmed to 8 characters and non-ASCII becomes "?"', () => {
  assert.deepEqual(P.modeInitPayload(0, 2, 'ZONSOPGANG').slice(2), [...Buffer.from('ZONSOPGA')]);
  assert.deepEqual(P.playInitPayload('Ä B'), [0x3f, 0x20, 0x42, 0x00, 0x7f]);
  assert.throws(() => P.playInitPayload('   '));
});

test('mode header validates bank and step count', () => {
  assert.throws(() => P.modeInitPayload(0, 1, 'X'));
  assert.throws(() => P.modeInitPayload(0, 51, 'X'));
  assert.throws(() => P.modeInitPayload(50, 5, 'X'));
  assert.throws(() => P.modeInitPayload(-1, 5, 'X'));
});

test('hex parsing for the raw packet sender', () => {
  assert.deepEqual(P.parseHexBytes('07 ea 0x0A, ff'), [7, 0xea, 10, 0xff]);
  assert.deepEqual(P.parseHexBytes('  '), []);
  assert.throws(() => P.parseHexBytes('zz'));
  assert.throws(() => P.parseHexBytes('100'));
});
