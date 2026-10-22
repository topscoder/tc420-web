// Run with: node webapp/tests/tc420.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../tc420.js');

const SCHEMAS = path.join(__dirname, '..', '..', 'schemas');

// Reference packets generated with the hardware-tested wallneradam/tc420 Python
// library (64 bytes, no report ID): significant prefix, then zeros, checksum, 0D 0A.
const REFERENCE = {
  clock: ['55aa11000707ea0a15140f1e', 0x68],
  init: ['55aa1200080315414652494b41', 0xdf],
  step: ['55aa130008090019001e0a0014', 0x78],
  end_mode: ['55aa010000', 0x00],
  end: ['55aa020000', 0x01],
  clear: ['55aa030000', 0x02],
  play: ['55aa15000654455354007f', 0xd9],
  vals: ['55aa160007f50a141e286400', 0xd9],
};

const frames = {
  clock: T.buildFrame(0x11, T.clockPayload(new Date(2026, 9, 21, 20, 15, 30))),
  init: T.buildFrame(0x12, T.modeInitPayload(3, 21, 'AFRIKA')),
  step: T.buildFrame(0x13, T.stepPayload({ hour: 9, minute: 0, ch: [25, 0, 30, 10, 0], jump: [false, false, true, false, true] })),
  end_mode: T.buildFrame(0x01),
  end: T.buildFrame(0x02),
  clear: T.buildFrame(0x03),
  play: T.buildFrame(0x15, T.playInitPayload('TEST')),
  vals: T.buildFrame(0x16, T.playValuesPayload([10, 20, 30, 40, 100])),
};

for (const [name, [prefix, checksum]] of Object.entries(REFERENCE)) {
  const data = frames[name].slice(1); // without report ID, as the library sends it
  const expected = Buffer.alloc(64);
  Buffer.from(prefix, 'hex').copy(expected);
  expected[61] = checksum;
  expected[62] = 0x0d;
  expected[63] = 0x0a;
  assert.equal(Buffer.from(data).toString('hex'), expected.toString('hex'), name);
}

// Reply observed on a real TC420 for 0x11 (2026-10-22): 00 00 11 00 01 00 …
const reply = new Uint8Array(64);
reply[2] = 0x11;
reply[4] = 0x01;
assert.deepEqual(T.parseResponse(reply), { cmd: 0x11, len: 1, result: 0, ok: true, pledOk: true });
// On errors the device echoes the sent packet from position 2.
assert.equal(T.parseResponse(T.buildFrame(0x13, [9, 0, 1, 2, 3, 4, 5, 0]).slice(1)).ok, false);

// .tmf parsing and round trip.
const expectedSteps = { AFRIKA: 21, AMAZONE: 25, THAILAND: 20, WINTER: 9, ZOMER: 9 };
for (const [name, count] of Object.entries(expectedSteps)) {
  const buf = fs.readFileSync(path.join(SCHEMAS, `${name}.tmf`));
  const s = T.parseTmf(buf);
  assert.equal(s.steps.length, count, name);
  assert.equal(s.deviceName, 'TC420');
  assert.equal(s.channels, 5);
  assert.equal(T.serializeTmf(s).length, buf.length);
  assert.deepEqual(T.parseTmf(T.serializeTmf(s)).steps, s.steps);
}
assert.deepEqual(T.parseTmf(fs.readFileSync(path.join(SCHEMAS, 'AMAZONE.tmf'))).warnings,
  ['stap 25 (02:30) ligt vóór stap 24 (22:30)']);

// Expected channel values: linear fade unless the target step jumps.
const winter = T.parseTmf(fs.readFileSync(path.join(SCHEMAS, 'WINTER.tmf'))).steps;
const at = (steps, hhmm) => T.valuesAt(steps, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)))[0];
assert.equal(at(winter, '03:00'), 10);
assert.equal(at(winter, '07:15'), 40);
assert.equal(at(winter, '13:00'), 100);
assert.equal(at(winter, '20:15'), 40);
const jumpSteps = [
  { hour: 0, minute: 0, ch: [0, 0, 0, 0, 0], jump: [false, false, false, false, false] },
  { hour: 12, minute: 0, ch: [100, 100, 0, 0, 0], jump: [false, true, false, false, false] },
];
assert.deepEqual(T.valuesAt(jumpSteps, 360).slice(0, 2), [50, 0]);

// Input validation.
assert.throws(() => T.modeInitPayload(0, 1, 'X'));
assert.throws(() => T.modeInitPayload(50, 5, 'X'));
assert.deepEqual(T.parseHexBytes('07 ea 0x0A'), [7, 0xea, 10]);
assert.throws(() => T.parseHexBytes('zz'));

console.log('alle tests geslaagd');
