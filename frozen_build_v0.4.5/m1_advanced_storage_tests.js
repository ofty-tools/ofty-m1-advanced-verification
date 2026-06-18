/* ============================================================================
   OFTY-Gx-M1-Advanced — Storage Adapter Tests (T50-T52, T75-T77)
   Uses an injected localStorage MOCK (Node has no localStorage).

   T50: Running Advanced after Core leaves Core key byte-identical.
   T51: Multiple Advanced runs update only the Advanced key.
   T52: The engine is pure — it has no storage dependency, and the adapter has
        no code path that writes the Core key (architectural guarantee, single
        deterministic outcome — not "throw or no-op").
   ============================================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const engine = require('./m1_advanced_engine.js');
const { createM1AdvancedStorageAdapter, CORE_KEY, ADVANCED_KEY } =
  require('./m1_advanced_storage_adapter.js');

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'm1_advanced_schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

/* ── localStorage mock ───────────────────────────────────────────────────── */
function makeMockStorage(initial) {
  const store = Object.assign({}, initial || {});
  return {
    _store: store,
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };
}

let SCENARIOS = 0, ASSERTIONS = 0, FAILED = 0;
const failures = [];
function assert(cond, msg) { ASSERTIONS++; if (!cond) { FAILED++; failures.push(msg); } }
function scenario(id, fn) { SCENARIOS++; try { fn(); } catch (e) { FAILED++; ASSERTIONS++; failures.push(id + ' :: THREW :: ' + e.message); } }

function oraProvenance() { return { values_from_same_device_result_confirmed: true, basis: 'single_reading', reading_id: 'r1' }; }
function baseORA() {
  return {
    device_branch: 'ora', gat_iop: 18, cct: 540,
    measurement_identity: { eye: 'OD', encounter_id: 'e1' },
    ora_inputs: { iopcc: 18.2, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() },
    clinician_confirmation: true
  };
}

/* simulate a frozen Core result already present in storage */
const FROZEN_CORE_VALUE = JSON.stringify({
  module_id: 'OFTY-Gx-M1', algorithm_version: '1.0', frozen: true,
  outputs: { adjusted_iop_mmhg: 18.4 }
});

/* ── T50 ─────────────────────────────────────────────────────────────────── */
scenario('T50', () => {
  const storage = makeMockStorage({ [CORE_KEY]: FROZEN_CORE_VALUE });
  const adapter = createM1AdvancedStorageAdapter(storage, validateSchema);

  const coreBefore = storage.getItem(CORE_KEY);
  const out = engine.computeM1Advanced(baseORA());
  adapter.persistAdvancedResult(out);
  const coreAfter = storage.getItem(CORE_KEY);

  assert(coreBefore === coreAfter, 'T50 Core key byte-identical after Advanced run');
  assert(coreAfter === FROZEN_CORE_VALUE, 'T50 Core value unchanged');
  assert(storage.getItem(ADVANCED_KEY) !== null, 'T50 Advanced key written');
});

/* ── T51 ─────────────────────────────────────────────────────────────────── */
scenario('T51', () => {
  const storage = makeMockStorage({ [CORE_KEY]: FROZEN_CORE_VALUE });
  const adapter = createM1AdvancedStorageAdapter(storage, validateSchema);

  const coreSnapshot = storage.getItem(CORE_KEY);
  for (let i = 0; i < 5; i++) {
    const out = engine.computeM1Advanced(baseORA());
    adapter.persistAdvancedResult(out);
  }
  assert(storage.getItem(CORE_KEY) === coreSnapshot, 'T51 Core untouched after 5 Advanced runs');
  const advRead = adapter.readAdvancedResult();
  assert(advRead.ok === true && advRead.value !== null && advRead.value.status === 'success', 'T51 Advanced key holds latest result');
});

/* ── T52 ─────────────────────────────────────────────────────────────────── */
scenario('T52', () => {
  // (a) Engine purity: strip comments, then check for ACTUAL API usage tokens.
  const engineSrcRaw = fs.readFileSync(path.join(__dirname, 'm1_advanced_engine.js'), 'utf8');
  const engineSrc = engineSrcRaw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  assert(!/\blocalStorage\b/.test(engineSrc), 'T52 engine code has no localStorage usage');
  assert(!/\bwindow\s*\./.test(engineSrc), 'T52 engine code has no window.* usage');
  assert(!/\bdocument\s*\./.test(engineSrc), 'T52 engine code has no document.* usage');
  assert(engineSrc.indexOf(CORE_KEY) === -1, 'T52 engine has no Core-key reference');

  // (b) Adapter guarantee: no setItem targets the Core key.
  const adapterSrcRaw = fs.readFileSync(path.join(__dirname, 'm1_advanced_storage_adapter.js'), 'utf8');
  const adapterSrc = adapterSrcRaw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  assert(adapterSrc.indexOf('setItem(CORE_KEY') === -1, 'T52 adapter never setItem(CORE_KEY)');
  assert(adapterSrc.indexOf("setItem('ofty_m1_result'") === -1, 'T52 adapter never writes Core literal');
  const setItemCalls = (adapterSrc.match(/setItem\(/g) || []).length;
  const advItemCalls = (adapterSrc.match(/setItem\(ADVANCED_KEY/g) || []).length;
  assert(setItemCalls === advItemCalls, 'T52 every setItem targets ADVANCED_KEY only');

  // (c) Behavioral: persisting still only touches the Advanced key.
  const storage = makeMockStorage({ [CORE_KEY]: FROZEN_CORE_VALUE });
  const adapter = createM1AdvancedStorageAdapter(storage, validateSchema);
  adapter.persistAdvancedResult(engine.computeM1Advanced(baseORA()));
  assert(storage.getItem(CORE_KEY) === FROZEN_CORE_VALUE, 'T52 Core value intact after persist');
});

/* ── T75: adapter rejects non-M1 object (blocker 5) ───────────────────────── */
scenario('T75', () => {
  const storage = makeMockStorage({ [CORE_KEY]: FROZEN_CORE_VALUE });
  const adapter = createM1AdvancedStorageAdapter(storage, validateSchema);
  let threw = false;
  try { adapter.persistAdvancedResult({ foo: 'bar' }); } catch (e) { threw = true; }
  assert(threw, 'T75 adapter rejects {foo:bar}');
  assert(storage.getItem(ADVANCED_KEY) === null, 'T75 nothing written for invalid object');
});

/* ── T76: adapter rejects foreign-module object ───────────────────────────── */
scenario('T76', () => {
  const storage = makeMockStorage({});
  const adapter = createM1AdvancedStorageAdapter(storage, validateSchema);
  const foreign = { status: 'success', result: { module_id: 'OFTY-Gx-M2', module_variant: 'core' } };
  let threw = false;
  try { adapter.persistAdvancedResult(foreign); } catch (e) { threw = true; }
  assert(threw, 'T76 adapter rejects foreign module object');
});

/* ── T77: adapter accepts a genuine Advanced failure record ───────────────── */
scenario('T77', () => {
  const storage = makeMockStorage({});
  const adapter = createM1AdvancedStorageAdapter(storage, validateSchema);
  const failOut = engine.computeM1Advanced(null); // structured failure
  adapter.persistAdvancedResult(failOut);
  assert(storage.getItem(ADVANCED_KEY) !== null, 'T77 genuine failure record persisted');
});

/* ── T78b: adapter REQUIRES validator (mandatory now) ─────────────────────── */
scenario('T78b', () => {
  const storage = makeMockStorage({});
  let threw = false;
  try { createM1AdvancedStorageAdapter(storage); } catch (e) { threw = true; }
  assert(threw, 'T78b constructor without validator throws');
});

/* ── T79b: partial object rejected even structurally (with validator) ──────── */
scenario('T79b', () => {
  const storage = makeMockStorage({});
  const adapter = createM1AdvancedStorageAdapter(storage, validateSchema);
  let threw = false;
  try {
    adapter.persistAdvancedResult({ status: 'success', result: { module_id: 'OFTY-Gx-M1', module_variant: 'advanced' } });
  } catch (e) { threw = true; }
  assert(threw, 'T79b partial M1 object rejected by schema gate');
  assert(storage.getItem(ADVANCED_KEY) === null, 'T79b nothing written');
});

/* ── T80b: safe read on corrupt JSON returns structured error, no throw ────── */
scenario('T80b', () => {
  const storage = makeMockStorage({ [ADVANCED_KEY]: '{corrupt json' });
  const adapter = createM1AdvancedStorageAdapter(storage, validateSchema);
  let threw = false, res;
  try { res = adapter.readAdvancedResult(); } catch (e) { threw = true; }
  assert(!threw, 'T80b corrupt read does not throw');
  assert(res.ok === false && res.reason === 'corrupt_json', 'T80b structured corrupt_json error');
});

/* ── T81b: safe read on invalid object returns structured error ───────────── */
scenario('T81b', () => {
  const storage = makeMockStorage({ [ADVANCED_KEY]: JSON.stringify({ foo: 'bar' }) });
  const adapter = createM1AdvancedStorageAdapter(storage, validateSchema);
  const res = adapter.readAdvancedResult();
  assert(res.ok === false && res.reason === 'invalid_object', 'T81b structured invalid_object error');
});

/* ── T82b: empty storage read returns ok:true value:null ──────────────────── */
scenario('T82b', () => {
  const storage = makeMockStorage({});
  const adapter = createM1AdvancedStorageAdapter(storage, validateSchema);
  const res = adapter.readAdvancedResult();
  assert(res.ok === true && res.value === null, 'T82b empty read ok/null');
});

/* ── REPORT ──────────────────────────────────────────────────────────────── */
const report = {
  suite_version: 'M1-ADV-STORAGE-TESTS-1.3',
  test_scenarios: SCENARIOS,
  total_assertions: ASSERTIONS,
  passed_assertions: ASSERTIONS - FAILED,
  failed_assertions: FAILED,
  all_passed: FAILED === 0,
  failures: failures
};
fs.writeFileSync(path.join(__dirname, 'm1_advanced_storage_test_report.json'), JSON.stringify(report, null, 2));

console.log('═══════════════════════════════════════════════');
console.log('  M1 ADVANCED — STORAGE ADAPTER TEST REPORT');
console.log('═══════════════════════════════════════════════');
console.log('  Test scenarios:    ' + SCENARIOS);
console.log('  Total assertions:  ' + ASSERTIONS);
console.log('  Passed:            ' + (ASSERTIONS - FAILED));
console.log('  Failed:            ' + FAILED);
console.log('  All passed:        ' + (FAILED === 0 ? 'YES ✓' : 'NO ✗'));
console.log('═══════════════════════════════════════════════');
if (FAILED > 0) { failures.forEach(f => console.log('  • ' + f)); process.exit(1); }
