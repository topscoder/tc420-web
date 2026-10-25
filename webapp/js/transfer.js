// Sending programs to the controller, as one guided operation.
//
// Default: the controller gets exactly one program (in slot 1), because many
// TC420s are built in and their buttons cannot be reached to switch programs.
// With "multiple programs" all programs are written in list order.
//
// Order: set the clock first (if wanted) – it doubles as a connection check
// before anything is erased – then clear the controller, write the program(s)
// and finish with 0x02.
import { CMD, MAX_BANKS, MAX_STEPS, clockPayload, modeInitPayload, stepPayload } from './protocol.js';

// The controller confirms 0x03 at once but then erases its memory: on real
// hardware the reply to the next packet took 1.25 s (normally 10–60 ms).
export const AFTER_CLEAR_TIMEOUT_MS = 10000;

// What went wrong, for the user: 'disconnected' | 'noReply' | 'rejected' | 'invalid'.
export function errorKind(result) {
  if (!result || result.ok) return null;
  if (result.error === 'timeout') return 'noReply';
  if (result.resp) return 'rejected';
  return 'disconnected'; // not connected, or sendReport threw (device closed or unplugged)
}

// Which programs go to which slot (bank).
export function planTransfer({ programs, selectedId, multiple }) {
  const chosen = multiple ? programs : programs.filter((p) => p.id === selectedId);
  return chosen.slice(0, MAX_BANKS).map((program, bank) => ({ program, bank }));
}

export function validatePlan(plan) {
  if (!plan.length) return { code: 'nothing' };
  const bad = plan.find(({ program }) => program.steps.length < 2 || program.steps.length > MAX_STEPS);
  return bad ? { code: 'steps', name: bad.program.name, count: bad.program.steps.length } : null;
}

// conn: { send(cmd, payload, opts) → { ok, error?, resp? } }.
// onProgress({ phase, done, total, name, step, steps }) is called before each packet group.
// Resolves to { ok: true, entries, clockSet } or
// { ok: false, phase, kind, cleared, name?, step? } – cleared tells whether the
// controller may already have lost its old programs.
export async function sendToController(conn, { plan, setClock = true, now = () => new Date(), onProgress = () => {} }) {
  const invalid = validatePlan(plan);
  if (invalid) return { ok: false, phase: 'validate', kind: 'invalid', cleared: false, ...invalid };
  const total = plan.reduce((n, e) => n + e.program.steps.length, 0);
  let done = 0;
  const opts = { test: 'send' };
  const fail = (phase, r, cleared, extra = {}) => ({ ok: false, phase, kind: errorKind(r), cleared, ...extra });

  if (setClock) {
    onProgress({ phase: 'clock', done, total });
    const r = await conn.send(CMD.SET_CLOCK, clockPayload(now()), opts);
    if (!r.ok) return fail('clock', r, false);
  }

  onProgress({ phase: 'clear', done, total });
  const cleared = await conn.send(CMD.CLEAR_ALL, [], opts);
  if (!cleared.ok) return fail('clear', cleared, true); // the controller may have cleared before failing to reply

  let first = true;
  for (const { program, bank } of plan) {
    const name = program.name;
    const steps = program.steps.length;
    onProgress({ phase: 'write', done, total, name, step: 0, steps });
    const headOpts = first ? { ...opts, timeoutMs: AFTER_CLEAR_TIMEOUT_MS } : opts;
    first = false;
    const head = await conn.send(CMD.MODE_INIT, modeInitPayload(bank, steps, name), headOpts);
    if (!head.ok) return fail('write', head, true, { name, step: 0 });
    for (let k = 0; k < steps; k++) {
      const r = await conn.send(CMD.STEP, stepPayload(program.steps[k]), opts);
      if (!r.ok) return fail('write', r, true, { name, step: k + 1 });
      done++;
      onProgress({ phase: 'write', done, total, name, step: k + 1, steps });
    }
    await conn.send(CMD.END_MODE, [], opts); // the controller does not reply to 0x01
  }

  onProgress({ phase: 'end', done, total });
  const end = await conn.send(CMD.END, [], opts);
  if (!end.ok) return fail('end', end, true);
  return { ok: true, entries: plan.map(({ program, bank }) => ({ id: program.id, bank })), clockSet: setClock };
}
