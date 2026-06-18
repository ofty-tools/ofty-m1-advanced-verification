'use strict';
/* Bundle load smoke test — loads ONLY the built IIFE bundle (no requires of
   the frozen sources), exactly as a browser would, then proves the 5 contract
   points. Uses Node's vm to evaluate the IIFE and capture the M1ADV global. */
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('./m1_advanced_bundle.js', 'utf8');
const sandbox = {};
vm.createContext(sandbox);
// The IIFE does `var M1ADV = (...)()`. In a vm context, top-level `var`
// becomes a property of the context object.
vm.runInContext(code, sandbox, { filename: 'm1_advanced_bundle.js' });
const M1ADV = sandbox.M1ADV;

let pass = 0, fail = 0;
const log = [];
function check(name, cond, detail) {
  if (cond) { pass++; log.push('  ✓ ' + name + (detail ? ' :: ' + detail : '')); }
  else      { fail++; log.push('  ✗ ' + name + (detail ? ' :: ' + detail : '')); }
}

// (1) Presence of the four APIs — and ONLY conformant surface.
check('API computeM1Advanced is function', typeof M1ADV.computeM1Advanced === 'function');
check('API createStorageAdapter is function', typeof M1ADV.createStorageAdapter === 'function');
check('API validateOutput is function', typeof M1ADV.validateOutput === 'function');
check('API CONSTANTS is object', M1ADV.CONSTANTS && typeof M1ADV.CONSTANTS === 'object');
check('Exported surface is exactly the 4 required keys',
  JSON.stringify(Object.keys(M1ADV).sort()) ===
  JSON.stringify(['CONSTANTS','computeM1Advanced','createStorageAdapter','validateOutput']),
  'keys=' + Object.keys(M1ADV).sort().join(','));

// (2) ALG_VERSION + SCHEMA_VERSION match.
check('ALG_VERSION === 0.4.3-experimental', M1ADV.CONSTANTS.ALG_VERSION === '0.4.3-experimental', M1ADV.CONSTANTS.ALG_VERSION);
check('SCHEMA_VERSION === M1-ADV-SCHEMA-1.3', M1ADV.CONSTANTS.SCHEMA_VERSION === 'M1-ADV-SCHEMA-1.3', M1ADV.CONSTANTS.SCHEMA_VERSION);

// (3) AJV validation works on a REAL engine output.
const oraProvenance = { values_from_same_device_result_confirmed: true, basis: 'single_reading', reading_id: 'r1' };
const realPayload = {
  device_branch: 'ora',
  gat_iop: 18, cct: 540,
  measurement_identity: { eye: 'OD', encounter_id: 'e1' },
  ora_inputs: { iopcc: 18.2, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance },
  clinician_confirmation: true
};
const out = M1ADV.computeM1Advanced(realPayload);
check('Engine produced success on valid ORA payload', out && out.status === 'success', out && out.status);
const validBundle = M1ADV.validateOutput(out);
check('Bundled AJV validates real engine output', validBundle === true,
  validBundle ? 'valid' : JSON.stringify(M1ADV.validateOutput.errors));

// Negative control: garbage must NOT validate (proves the gate is live, not a stub).
const garbageValidates = M1ADV.validateOutput({ not: 'an OFTY output' });
check('Bundled AJV REJECTS non-conformant object (gate is live)', garbageValidates === false);

// (4) Storage adapter created with a MANDATORY pre-injected validator.
const mem = (() => { const m = {}; return {
  getItem: k => (k in m ? m[k] : null),
  setItem: (k, v) => { m[k] = v; },
  removeItem: k => { delete m[k]; },
  _dump: () => m
}; })();
const adapter = M1ADV.createStorageAdapter(mem);
check('Adapter exposes persist/read/KEYS', adapter &&
  typeof adapter.persistAdvancedResult === 'function' &&
  typeof adapter.readAdvancedResult === 'function' &&
  adapter.KEYS && adapter.KEYS.ADVANCED_KEY === 'ofty_m1_advanced_result',
  adapter && JSON.stringify(adapter.KEYS));
// Prove the injected validator is mandatory & active: persist must reject a
// non-M1ADV object (it can only have passed via the injected validateOutput).
let rejectedNonOutput = false;
try { adapter.persistAdvancedResult({ status: 'success', result: { foo: 1 } }); }
catch (e) { rejectedNonOutput = true; }
check('Adapter refuses to persist a non-M1ADV object (mandatory validator active)', rejectedNonOutput);

// (5) No write to Core key. Persist a genuine output, assert Core untouched.
const coreBefore = mem.getItem('ofty_m1_result');
adapter.persistAdvancedResult(out);
const coreAfter = mem.getItem('ofty_m1_result');
check('Core key ofty_m1_result is null before persist', coreBefore === null, String(coreBefore));
check('Core key ofty_m1_result still null after Advanced persist', coreAfter === null, String(coreAfter));
check('Advanced result written ONLY to ofty_m1_advanced_result',
  typeof mem.getItem('ofty_m1_advanced_result') === 'string' &&
  Object.keys(mem._dump()).length === 1 &&
  Object.keys(mem._dump())[0] === 'ofty_m1_advanced_result',
  'keys=' + Object.keys(mem._dump()).join(','));

console.log('═══════════════════════════════════════════════');
console.log('  M1 ADVANCED — BUNDLE LOAD SMOKE TEST');
console.log('═══════════════════════════════════════════════');
console.log(log.join('\n'));
console.log('───────────────────────────────────────────────');
console.log('  Passed: ' + pass + '   Failed: ' + fail);
console.log('  All passed: ' + (fail === 0 ? 'YES ✓' : 'NO ✗'));
console.log('═══════════════════════════════════════════════');
if (fail > 0) process.exit(1);
