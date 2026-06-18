/* ============================================================================
   OFTY-Gx-M1-Advanced — Reproducible Fuzz Test
   Fuzz suite version: M1-ADV-FUZZ-1.3

   Deterministic, seeded fuzzer. Generates a fixed matrix of hostile inputs and
   asserts two invariants for EVERY input:
     (1) computeM1Advanced never throws;
     (2) its output always validates against M1-ADV-SCHEMA-1.3.
   The matrix is enumerated (not random), so the case list is fully reproducible
   from this file. A seed is recorded for documentation parity.
   ============================================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const engine = require('./m1_advanced_engine.js');

const SEED = 42; // recorded for reproducibility parity (enumeration is deterministic)

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'm1_advanced_schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

function prov() { return { values_from_same_device_result_confirmed: true, basis: 'single_reading', reading_id: 'r1' }; }

/* Hostile value pools */
const HOSTILE_SCALARS = [123, {}, [], true, false, '', '   ', null, undefined, 'false', 'true', -1, NaN, Infinity];
const HOSTILE_REF     = ['martian', 42, {}, null, 'untreated', 'post_LVC', 'unknown'];
const HOSTILE_QUALITY = [{}, [], 123, null, '', '   ', 'OK', 'bad', 'Strange-Label-2027'];
const BRANCHES        = ['ora', 'corvis', 'both'];

let total = 0, crashes = 0, schemaFails = 0;
const failureSamples = [];

function tryCase(input, label) {
  total++;
  let out;
  try { out = engine.computeM1Advanced(input); }
  catch (e) { crashes++; if (failureSamples.length < 10) failureSamples.push('CRASH ' + label + ': ' + e.message); return; }
  if (!validate(out)) {
    schemaFails++;
    if (failureSamples.length < 10) failureSamples.push('SCHEMA ' + label + ': ' + JSON.stringify(validate.errors.slice(0, 2)));
  }
}

/* Matrix 1: hostile encounter_id × hostile reference × branch */
for (const branch of BRANCHES) {
  for (const enc of HOSTILE_SCALARS) {
    for (const ref of HOSTILE_REF) {
      const inp = { device_branch: branch, gat_iop: 18, cct: 540,
        measurement_identity: { eye: 'OD', encounter_id: enc }, clinician_confirmation: true };
      if (branch === 'ora' || branch === 'both')
        inp.ora_inputs = { iopcc: 18, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: prov() };
      if (branch === 'corvis' || branch === 'both') {
        inp.corvis_inputs = { biop: 18, corvis_quality_raw: 'OK', ssi: 1.1 };
        inp.corvis_metadata = { reference_database: ref };
      }
      tryCase(inp, branch + '/enc/ref');
    }
  }
}

/* Matrix 2: hostile quality raw × branch corvis */
for (const q of HOSTILE_QUALITY) {
  const inp = { device_branch: 'corvis', gat_iop: 16, cct: 600,
    measurement_identity: { eye: 'OD', encounter_id: 'e1' },
    corvis_inputs: { biop: 14.5, corvis_quality_raw: q }, clinician_confirmation: true };
  tryCase(inp, 'corvis/quality');
}

/* Matrix 3: hostile boolean modifiers */
for (const b of HOSTILE_SCALARS) {
  for (const field of ['keratoconus_ectasia', 'corneal_edema', 'significant_dystrophy_or_scar']) {
    const inp = { device_branch: 'ora', gat_iop: 18, cct: 540,
      measurement_identity: { eye: 'OD', encounter_id: 'e1' },
      ora_inputs: { iopcc: 18, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: prov() },
      clinician_confirmation: true };
    inp[field] = b;
    tryCase(inp, 'bool/' + field);
  }
}

/* Matrix 4: top-level hostile inputs */
for (const x of [null, undefined, [], 42, 'string', {}, { device_branch: 'xxx' }]) {
  tryCase(x, 'toplevel');
}

const report = {
  fuzz_suite_version: 'M1-ADV-FUZZ-1.3',
  seed: SEED,
  schema_version: engine.CONSTANTS.SCHEMA_VERSION,
  total_inputs: total,
  crashes: crashes,
  schema_failures: schemaFails,
  all_clean: crashes === 0 && schemaFails === 0,
  failure_samples: failureSamples
};
fs.writeFileSync(path.join(__dirname, 'm1_advanced_fuzz_report.json'), JSON.stringify(report, null, 2));

console.log('═══════════════════════════════════════════════');
console.log('  M1 ADVANCED — REPRODUCIBLE FUZZ REPORT');
console.log('═══════════════════════════════════════════════');
console.log('  Seed:              ' + SEED);
console.log('  Total inputs:      ' + total);
console.log('  Crashes:           ' + crashes);
console.log('  Schema failures:   ' + schemaFails);
console.log('  All clean:         ' + (report.all_clean ? 'YES ✓' : 'NO ✗'));
console.log('═══════════════════════════════════════════════');
if (!report.all_clean) { failureSamples.forEach(f => console.log('  • ' + f)); process.exit(1); }
