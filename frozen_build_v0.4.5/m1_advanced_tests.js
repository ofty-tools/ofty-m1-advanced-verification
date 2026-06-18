/* ============================================================================
   OFTY-Gx-M1-Advanced — Pure Engine Test Suite
   Test suite version: M1-ADV-TESTS-1.3

   Counts test SCENARIOS and ASSERTIONS separately (per blocker #6).
   Every output is validated against the JSON Schema (per blocker #1, #2).
   No localStorage here — pure engine only (per blocker #7, #8).
   ============================================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const engine = require('./m1_advanced_engine.js');

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'm1_advanced_schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

let SCENARIOS = 0;
let ASSERTIONS = 0;
let FAILED = 0;
const failures = [];

function assert(cond, msg) {
  ASSERTIONS++;
  if (!cond) { FAILED++; failures.push(msg); }
}

function schemaValid(output, label) {
  ASSERTIONS++;
  const ok = validateSchema(output);
  if (!ok) {
    FAILED++;
    failures.push(label + ' :: SCHEMA INVALID :: ' + JSON.stringify(validateSchema.errors));
  }
  return ok;
}

function scenario(id, fn) {
  SCENARIOS++;
  try { fn(); }
  catch (e) { FAILED++; ASSERTIONS++; failures.push(id + ' :: THREW :: ' + e.message); }
}

/* ── helpers to build valid inputs ───────────────────────────────────────── */
function oraProvenance() {
  return { values_from_same_device_result_confirmed: true, basis: 'single_reading', reading_id: 'r1' };
}
function baseORA(over) {
  return Object.assign({
    device_branch: 'ora',
    gat_iop: 18, cct: 540,
    measurement_identity: { eye: 'OD', encounter_id: 'e1' },
    ora_inputs: {
      iopcc: 18.2, ch: 10, selected_waveform_score: 7.5, measurement_count: 4,
      provenance_attestation: oraProvenance()
    },
    clinician_confirmation: true
  }, over || {});
}
function baseCorvis(over) {
  return Object.assign({
    device_branch: 'corvis',
    gat_iop: 16, cct: 600,
    measurement_identity: { eye: 'OD', encounter_id: 'e1' },
    corvis_inputs: { biop: 14.5, corvis_quality_raw: 'OK' },
    clinician_confirmation: true
  }, over || {});
}
function baseBoth(over) {
  return Object.assign({
    device_branch: 'both',
    gat_iop: 16, cct: 540,
    measurement_identity: { eye: 'OD', encounter_id: 'e1' },
    ora_inputs: {
      iopcc: 18, ch: 10, selected_waveform_score: 7.5, measurement_count: 4,
      provenance_attestation: oraProvenance()
    },
    corvis_inputs: { biop: 22, corvis_quality_raw: 'OK' },
    clinician_confirmation: true
  }, over || {});
}
function flagsHave(out, code, scope) {
  return out.result.caution_flags.some(f => f.code === code && (scope === undefined || f.scope === scope));
}

/* ════════════════════════════════════════════════════════════════════════
   T1–T20  (from v0.4)
   ════════════════════════════════════════════════════════════════════════ */

scenario('T1', () => {
  const out = engine.computeM1Advanced(baseORA());
  schemaValid(out, 'T1');
  assert(out.status === 'success', 'T1 status');
  assert(out.result.measurement_quality.level === 'high', 'T1 quality high');
  assert(out.result.clinical_applicability.level === 'standard', 'T1 applic standard');
  assert(out.result.overall_interpretive_confidence === 'high', 'T1 confidence high');
});

scenario('T2', () => {
  const out = engine.computeM1Advanced(baseORA({
    gat_iop: 14, cct: 480,
    ora_inputs: { iopcc: 17.0, ch: 6.5, selected_waveform_score: 7.0, measurement_count: 3, provenance_attestation: oraProvenance() }
  }));
  schemaValid(out, 'T2');
  assert(out.result.measurement_quality.level === 'high', 'T2 quality high');
  assert(!flagsHave(out, 'ch_out_of_observed_range'), 'T2 CH 6.5 in range, no flag');
  assert(out.result.biomechanical_context.ch_context.value_mmhg === 6.5, 'T2 ch value');
});

scenario('T3', () => {
  const out = engine.computeM1Advanced(baseCorvis());
  schemaValid(out, 'T3');
  assert(out.result.device_measurement.source === 'Corvis-bIOP', 'T3 source');
  assert(out.result.comparison_with_gat.delta_mmhg === -1.5, 'T3 delta -1.5');
  assert(out.result.clinical_applicability.level === 'standard', 'T3 applic');
});

scenario('T4', () => {
  const out = engine.computeM1Advanced(baseORA({
    prior_refractive_surgery: 'LASIK',
    ora_inputs: { iopcc: 22, ch: 9, selected_waveform_score: 8, measurement_count: 4, provenance_attestation: oraProvenance() }
  }));
  schemaValid(out, 'T4');
  assert(out.result.clinical_applicability.level === 'limited', 'T4 applic limited');
  assert(out.result.overall_interpretive_confidence === 'moderate', 'T4 confidence moderate');
  assert(out.result.core_reference.applicability === 'not_applicable', 'T4 core n/a');
  assert(out.result.core_reference.value_mmhg === null, 'T4 core value null');
  assert(flagsHave(out, 'post_refractive_surgery_device_interpretation_limited', 'ora'), 'T4 ora flag');
  assert(flagsHave(out, 'post_refractive_surgery_invalid_linear', 'core'), 'T4 core flag');
});

scenario('T5', () => {
  const out = engine.computeM1Advanced(baseBoth());
  schemaValid(out, 'T5');
  assert(out.result.device_measurement === null, 'T5 device_measurement null');
  assert(out.result.branch_assessments !== null, 'T5 branch_assessments present');
  assert(out.result.device_comparison.absolute_difference_mmhg === 4, 'T5 diff 4');
  assert(flagsHave(out, 'cross_device_difference', 'cross_device'), 'T5 cross_device flag');
  assert(out.result.device_comparison.cross_device_comparison_interpretability === 'moderate', 'T5 interp moderate (OK=acceptable)');
});

scenario('T6', () => {
  const out = engine.computeM1Advanced(baseORA({
    ora_inputs: { iopcc: 18, ch: 10, selected_waveform_score: 3.0, measurement_count: 4, provenance_attestation: oraProvenance() }
  }));
  schemaValid(out, 'T6');
  assert(out.result.measurement_quality.level === 'poor', 'T6 quality poor');
  assert(out.result.overall_interpretive_confidence === 'low', 'T6 confidence low');
  assert(flagsHave(out, 'quality_unreliable', 'ora'), 'T6 unreliable flag');
});

scenario('T7', () => {
  const out = engine.computeM1Advanced(baseORA({
    gat_iop: 14,
    ora_inputs: { iopcc: 24, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() },
    clinician_confirmation: true
  }));
  schemaValid(out, 'T7');
  assert(flagsHave(out, 'marked_difference_vs_gat', 'ora_vs_gat'), 'T7 marked diff');
});

scenario('T7b', () => {
  const inp = baseORA({
    gat_iop: 14,
    ora_inputs: { iopcc: 24, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() }
  });
  delete inp.clinician_confirmation; // no temporal confirmation
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T7b');
  assert(flagsHave(out, 'temporal_comparison_invalid', 'ora_vs_gat'), 'T7b temporal invalid');
  assert(!flagsHave(out, 'marked_difference_vs_gat'), 'T7b no marked diff');
});

scenario('T8', () => {
  const out = engine.computeM1Advanced(baseCorvis({
    keratoconus_ectasia: true,
    corvis_inputs: { biop: 19, corvis_quality_raw: 'OK' }
  }));
  schemaValid(out, 'T8');
  assert(out.result.clinical_applicability.level === 'limited', 'T8 applic limited');
  assert(out.result.overall_interpretive_confidence === 'moderate', 'T8 confidence moderate');
  assert(out.result.core_reference.applicability === 'not_applicable', 'T8 core n/a');
  assert(flagsHave(out, 'keratoconus_altered_biomechanics', 'corvis'), 'T8 kc flag');
});

scenario('T9', () => {
  const inp = baseBoth();
  delete inp.corvis_inputs; // incomplete both
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T9');
  assert(out.status === 'failure', 'T9 failure');
  assert(out.failure.code === 'BRANCH_BOTH_INCOMPLETE', 'T9 code');
});

scenario('T10', () => {
  const out = engine.computeM1Advanced(baseORA({
    ora_inputs: { iopcc: 18, ch: 20, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() }
  }));
  schemaValid(out, 'T10');
  assert(flagsHave(out, 'ch_out_of_observed_range', 'ora'), 'T10 ch out of range');
  assert(out.result.biomechanical_context.ch_context.out_of_observed_range_flag === true, 'T10 flag set');
});

scenario('T11', () => {
  const out = engine.computeM1Advanced(baseORA({
    ora_inputs: { iopcc: 18, ch: 10, selected_waveform_score: 7.5, measurement_count: 2, provenance_attestation: oraProvenance() }
  }));
  schemaValid(out, 'T11');
  assert(out.result.measurement_quality.level === 'acceptable', 'T11 capped acceptable');
  assert(flagsHave(out, 'quality_low_count', 'ora'), 'T11 low count flag');
});

scenario('T12', () => {
  const inp = baseBoth();
  delete inp.clinician_confirmation; // no temporal validity, no shared encounter actually present? e1 is shared
  inp.measurement_identity = { eye: 'OD', encounter_id: null };
  delete inp.shared_encounter_id;
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T12');
  assert(!flagsHave(out, 'cross_device_difference'), 'T12 no cross device diff');
  assert(flagsHave(out, 'temporal_comparison_invalid', 'cross_device'), 'T12 temporal invalid');
  assert(out.result.device_comparison.cross_device_comparison_interpretability === 'not_assessable', 'T12 not assessable');
});

scenario('T13', () => {
  const out = engine.computeM1Advanced(baseORA({
    prior_refractive_surgery: 'LASIK', keratoconus_ectasia: true, corneal_edema: true
  }));
  schemaValid(out, 'T13');
  assert(out.result.clinical_applicability.level === 'limited', 'T13 applic limited');
  const lims = out.result.clinical_applicability.limitations;
  assert(lims.length === 3, 'T13 three limitations');
  assert(lims[0].indexOf('edema') !== -1, 'T13 edema first');
  assert(lims[1].indexOf('Keratoconus') !== -1, 'T13 keratoconus second');
  assert(lims[2].indexOf('refractive') !== -1, 'T13 refractive third');
});

scenario('T14', () => {
  const out = engine.computeM1Advanced(baseORA());
  schemaValid(out, 'T14');
  assert(out.result.downstream.eligibility === 'context_only', 'T14 context_only');
  assert(out.result.downstream.eligible_for_target_comparison === false, 'T14 not eligible');
});

scenario('T15', () => {
  const inp = baseORA();
  inp.ora_inputs.eye = 'OS'; // mismatch vs OD
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T15');
  assert(out.status === 'failure', 'T15 failure');
  assert(out.failure.code === 'EYE_MISMATCH', 'T15 code');
});

scenario('T16', () => {
  const inp = baseORA();
  inp.ora_inputs.provenance_attestation = { values_from_same_device_result_confirmed: false, basis: 'single_reading', reading_id: null };
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T16');
  assert(out.status === 'failure', 'T16 failure');
  assert(out.failure.code === 'ORA_VALUES_NOT_SAME_RESULT', 'T16 code');
});

scenario('T17', () => {
  const out = engine.computeM1Advanced(baseCorvis({ corvis_inputs: { biop: 16, corvis_quality_raw: null } }));
  schemaValid(out, 'T17');
  assert(out.result.measurement_quality.level === 'unknown', 'T17 unknown');
  assert(out.result.overall_interpretive_confidence === 'indeterminate', 'T17 indeterminate');
  assert(flagsHave(out, 'quality_unknown', 'corvis'), 'T17 unknown flag');
});

scenario('T18', () => {
  const out = engine.computeM1Advanced(baseCorvis({ corvis_inputs: { biop: 16, corvis_quality_raw: 'Strange-Label-2027' } }));
  schemaValid(out, 'T18');
  assert(out.result.measurement_quality.level === 'unknown', 'T18 unknown');
  assert(flagsHave(out, 'quality_unknown', 'corvis'), 'T18 unknown flag');
});

scenario('T19', () => {
  const out = engine.computeM1Advanced(baseCorvis({
    measurement_failure: { occurred: true, code: 'CORVIS_UNREADABLE', message: 'unreadable' }
  }));
  schemaValid(out, 'T19');
  assert(out.status === 'failure', 'T19 failure');
  assert(out.failure.type === 'measurement_failure', 'T19 type');
  assert(out.result === undefined, 'T19 no result');
});

scenario('T20', () => {
  const inp = baseORA();
  inp.measurement_identity = { eye: 'OD', encounter_id: null };
  inp.shared_encounter_id = 'enc-123';
  delete inp.clinician_confirmation;
  inp.gat_iop = 14;
  inp.ora_inputs = { iopcc: 24, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() };
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T20');
  assert(out.result.comparison_context.basis === 'shared_encounter_id', 'T20 basis');
  assert(out.result.comparison_context.comparison_valid === true, 'T20 valid');
  assert(flagsHave(out, 'marked_difference_vs_gat', 'ora_vs_gat'), 'T20 marked diff via encounter');
});

/* ════════════════════════════════════════════════════════════════════════
   T21–T26  ORA WFS thresholds
   ════════════════════════════════════════════════════════════════════════ */
function wfsCase(id, wfs, expected) {
  scenario(id, () => {
    const out = engine.computeM1Advanced(baseORA({
      ora_inputs: { iopcc: 18, ch: 10, selected_waveform_score: wfs, measurement_count: 4, provenance_attestation: oraProvenance() }
    }));
    schemaValid(out, id);
    assert(out.result.measurement_quality.level === expected, id + ' wfs ' + wfs + ' -> ' + expected + ' got ' + out.result.measurement_quality.level);
  });
}
wfsCase('T21', 3.49, 'poor');
wfsCase('T22', 3.50, 'borderline');
wfsCase('T23', 5.99, 'borderline');
wfsCase('T24', 6.00, 'acceptable');
wfsCase('T25', 6.99, 'acceptable');
wfsCase('T26', 7.00, 'high');

/* ════════════════════════════════════════════════════════════════════════
   T27–T29  measurement count cap
   ════════════════════════════════════════════════════════════════════════ */
function countCase(id, count, expectedLevel, expectLowFlag) {
  scenario(id, () => {
    const out = engine.computeM1Advanced(baseORA({
      ora_inputs: { iopcc: 18, ch: 10, selected_waveform_score: 7.5, measurement_count: count, provenance_attestation: oraProvenance() }
    }));
    schemaValid(out, id);
    assert(out.result.measurement_quality.level === expectedLevel, id + ' level');
    assert(flagsHave(out, 'quality_low_count', 'ora') === expectLowFlag, id + ' low flag ' + expectLowFlag);
  });
}
countCase('T27', 1, 'acceptable', true);
countCase('T28', 2, 'acceptable', true);
countCase('T29', 3, 'high', false);

/* ════════════════════════════════════════════════════════════════════════
   T30–T37  CH boundaries
   ════════════════════════════════════════════════════════════════════════ */
function chCase(id, ch, expectBlock, expectOutFlag) {
  scenario(id, () => {
    const out = engine.computeM1Advanced(baseORA({
      ora_inputs: { iopcc: 18, ch: ch, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() }
    }));
    schemaValid(out, id);
    if (expectBlock) {
      assert(out.status === 'failure', id + ' should block');
      assert(out.failure.code === 'OUT_OF_HARD_RANGE', id + ' code');
    } else {
      assert(out.status === 'success', id + ' should pass');
      assert(out.result.biomechanical_context.ch_context.out_of_observed_range_flag === expectOutFlag, id + ' out flag ' + expectOutFlag);
    }
  });
}
chCase('T30', 0.99, true, null);
chCase('T31', 1.00, false, true);
chCase('T32', 3.99, false, true);
chCase('T33', 4.00, false, false);
chCase('T34', 18.00, false, false);
chCase('T35', 18.01, false, true);
chCase('T36', 25.00, false, true);
chCase('T37', 25.01, true, null);

/* ════════════════════════════════════════════════════════════════════════
   T38–T41  difference threshold edges
   ════════════════════════════════════════════════════════════════════════ */
scenario('T38', () => {
  // ORA-Corvis exactly 3.0: iopcc 18, biop 21 -> diff 3.0
  const out = engine.computeM1Advanced(baseBoth({
    ora_inputs: { iopcc: 18, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() },
    corvis_inputs: { biop: 21, corvis_quality_raw: 'OK' }
  }));
  schemaValid(out, 'T38');
  assert(out.result.device_comparison.absolute_difference_mmhg === 3, 'T38 diff 3');
  assert(out.result.device_comparison.numerical_threshold_exceeded === false, 'T38 no review (strict >)');
  assert(!flagsHave(out, 'cross_device_difference'), 'T38 no flag at exactly 3');
});

scenario('T39', () => {
  const out = engine.computeM1Advanced(baseBoth({
    ora_inputs: { iopcc: 18, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() },
    corvis_inputs: { biop: 21.1, corvis_quality_raw: 'OK' }
  }));
  schemaValid(out, 'T39');
  assert(out.result.device_comparison.absolute_difference_mmhg === 3.1, 'T39 diff 3.1');
  assert(out.result.device_comparison.numerical_threshold_exceeded === true, 'T39 review at 3.1');
  assert(flagsHave(out, 'cross_device_difference', 'cross_device'), 'T39 flag');
});

scenario('T40', () => {
  // biomech-GAT exactly 8: gat 14, iopcc 22 -> delta 8
  const out = engine.computeM1Advanced(baseORA({
    gat_iop: 14,
    ora_inputs: { iopcc: 22, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() },
    clinician_confirmation: true
  }));
  schemaValid(out, 'T40');
  assert(out.result.comparison_with_gat.delta_mmhg === 8, 'T40 delta 8');
  assert(!flagsHave(out, 'marked_difference_vs_gat'), 'T40 no flag at exactly 8 (strict >)');
});

scenario('T41', () => {
  const out = engine.computeM1Advanced(baseORA({
    gat_iop: 14,
    ora_inputs: { iopcc: 22.1, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() },
    clinician_confirmation: true
  }));
  schemaValid(out, 'T41');
  assert(out.result.comparison_with_gat.delta_mmhg === 8.1, 'T41 delta 8.1');
  assert(flagsHave(out, 'marked_difference_vs_gat', 'ora_vs_gat'), 'T41 flag at 8.1');
});

/* ════════════════════════════════════════════════════════════════════════
   T42  both with one quality unknown
   ════════════════════════════════════════════════════════════════════════ */
scenario('T42', () => {
  const out = engine.computeM1Advanced(baseBoth({
    corvis_inputs: { biop: 22, corvis_quality_raw: null } // unknown
  }));
  schemaValid(out, 'T42');
  assert(out.result.branch_assessments.corvis.overall_interpretive_confidence === 'indeterminate', 'T42 corvis indeterminate');
  assert(out.result.device_comparison.cross_device_comparison_interpretability === 'not_assessable', 'T42 not assessable');
});

/* ════════════════════════════════════════════════════════════════════════
   T43–T46  schema integrity (negative tests — manual mutation)
   ════════════════════════════════════════════════════════════════════════ */
scenario('T43', () => {
  const out = engine.computeM1Advanced(baseORA());
  const mutated = JSON.parse(JSON.stringify(out));
  mutated.failure = { type: 'validation_error', code: 'EYE_MISMATCH', message: 'x' };
  // success with failure field must be rejected
  ASSERTIONS++;
  const ok = validateSchema(mutated);
  if (ok) { FAILED++; failures.push('T43 :: schema accepted success+failure'); }
});

scenario('T44', () => {
  const fail = engine.computeM1Advanced((() => { const i = baseORA(); i.ora_inputs.eye = 'OS'; return i; })());
  const mutated = JSON.parse(JSON.stringify(fail));
  mutated.result = { foo: 'bar' };
  ASSERTIONS++;
  const ok = validateSchema(mutated);
  if (ok) { FAILED++; failures.push('T44 :: schema accepted failure+result'); }
});

scenario('T45', () => {
  const out = engine.computeM1Advanced(baseORA());
  const mutated = JSON.parse(JSON.stringify(out));
  mutated.result.branch_assessments = { ora: {}, corvis: {} }; // must be null in ORA branch
  ASSERTIONS++;
  const ok = validateSchema(mutated);
  if (ok) { FAILED++; failures.push('T45 :: schema accepted non-null branch_assessments in ORA'); }
});

scenario('T46', () => {
  const out = engine.computeM1Advanced(baseBoth());
  const mutated = JSON.parse(JSON.stringify(out));
  mutated.result.device_measurement = { source: 'ORA-IOPcc', value_mmhg: 18 }; // must be null in Both
  ASSERTIONS++;
  const ok = validateSchema(mutated);
  if (ok) { FAILED++; failures.push('T46 :: schema accepted non-null device_measurement in Both'); }
});

/* ════════════════════════════════════════════════════════════════════════
   T47–T49  scope verification
   ════════════════════════════════════════════════════════════════════════ */
scenario('T47', () => {
  const out = engine.computeM1Advanced(baseBoth({
    ora_inputs: { iopcc: 18, ch: 10, selected_waveform_score: 3.0, measurement_count: 4, provenance_attestation: oraProvenance() },
    corvis_inputs: { biop: 22, corvis_quality_raw: 'OK' }
  }));
  schemaValid(out, 'T47');
  assert(flagsHave(out, 'quality_unreliable', 'ora'), 'T47 ora unreliable');
  assert(!flagsHave(out, 'quality_unreliable', 'corvis'), 'T47 corvis not unreliable');
});

scenario('T48', () => {
  const out = engine.computeM1Advanced(baseBoth({ prior_refractive_surgery: 'LASIK' }));
  schemaValid(out, 'T48');
  assert(flagsHave(out, 'post_refractive_surgery_invalid_linear', 'core'), 'T48 core flag');
  assert(flagsHave(out, 'post_refractive_surgery_device_interpretation_limited', 'ora'), 'T48 ora flag');
  assert(flagsHave(out, 'post_refractive_surgery_device_interpretation_limited', 'corvis'), 'T48 corvis flag');
});

scenario('T49', () => {
  const out = engine.computeM1Advanced(baseORA());
  schemaValid(out, 'T49');
  assert(flagsHave(out, 'experimental_module', 'module'), 'T49 experimental module scope');
  assert(flagsHave(out, 'biomechanics_partially_assessed', 'module'), 'T49 biomech module scope');
});

/* ════════════════════════════════════════════════════════════════════════
   T53–T56  comparison context (T50–T52 are storage adapter tests)
   ════════════════════════════════════════════════════════════════════════ */
scenario('T53', () => {
  const inp = baseORA();
  delete inp.clinician_confirmation;
  inp.measurement_identity = { eye: 'OD', encounter_id: null };
  inp.gat_timestamp = '2026-03-01T10:00:00Z';
  inp.ora_timestamp = '2026-03-01T10:05:00Z';
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T53');
  assert(out.result.comparison_context.basis === 'timestamps_only', 'T53 basis');
  assert(out.result.comparison_context.comparison_valid === false, 'T53 not valid');
});

scenario('T54', () => {
  const inp = baseORA();
  inp.measurement_identity = { eye: 'OD', encounter_id: null };
  delete inp.clinician_confirmation;
  inp.shared_encounter_id = 'enc-9';
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T54');
  assert(out.result.comparison_context.basis === 'shared_encounter_id', 'T54 basis');
  assert(out.result.comparison_context.comparison_valid === true, 'T54 valid');
});

scenario('T55', () => {
  const inp = baseORA(); // clinician_confirmation true by default
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T55');
  assert(out.result.comparison_context.basis === 'clinician_confirmed_same_session', 'T55 basis');
  assert(out.result.comparison_context.comparison_valid === true, 'T55 valid');
});

scenario('T56', () => {
  const inp = baseORA();
  delete inp.clinician_confirmation;
  inp.measurement_identity = { eye: 'OD', encounter_id: null };
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T56');
  assert(out.result.comparison_context.basis === 'unconfirmed', 'T56 basis');
  assert(out.result.comparison_context.comparison_valid === false, 'T56 not valid');
});

/* ════════════════════════════════════════════════════════════════════════
   T57–T74  RED-TEAM CLOSURE (v0.4.3) — input validation & invariants
   ════════════════════════════════════════════════════════════════════════ */

/* Bug 1: missing measurement_identity must be structured failure, not throw */
scenario('T57', () => {
  const inp = baseORA();
  delete inp.measurement_identity;
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T57');
  assert(out.status === 'failure', 'T57 structured failure');
  assert(out.failure.code === 'MISSING_REQUIRED_FIELD', 'T57 code');
});

/* Bug 1: eye missing/invalid */
scenario('T58', () => {
  const inp = baseORA();
  inp.measurement_identity = { encounter_id: 'e1' }; // no eye
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T58');
  assert(out.status === 'failure', 'T58 failure');
  assert(out.failure.code === 'MISSING_REQUIRED_FIELD', 'T58 code');
});

/* Bug 1: waveform_score = null blocked */
scenario('T59', () => {
  const inp = baseORA();
  inp.ora_inputs = { iopcc: 18, ch: 10, selected_waveform_score: null, measurement_count: 4, provenance_attestation: oraProvenance() };
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T59');
  assert(out.status === 'failure', 'T59 failure (null wfs)');
  assert(out.failure.code === 'OUT_OF_HARD_RANGE', 'T59 code');
});

/* Bug 1: waveform_score negative blocked */
scenario('T60', () => {
  const inp = baseORA();
  inp.ora_inputs = { iopcc: 18, ch: 10, selected_waveform_score: -5, measurement_count: 4, provenance_attestation: oraProvenance() };
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T60');
  assert(out.status === 'failure', 'T60 failure (negative wfs)');
});

/* Bug 1: waveform_score > 10 blocked */
scenario('T61', () => {
  const inp = baseORA();
  inp.ora_inputs = { iopcc: 18, ch: 10, selected_waveform_score: 11, measurement_count: 4, provenance_attestation: oraProvenance() };
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T61');
  assert(out.status === 'failure', 'T61 failure (wfs>10)');
});

/* Bug 1: measurement_count = 0 blocked */
scenario('T62', () => {
  const inp = baseORA();
  inp.ora_inputs = { iopcc: 18, ch: 10, selected_waveform_score: 7.5, measurement_count: 0, provenance_attestation: oraProvenance() };
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T62');
  assert(out.status === 'failure', 'T62 failure (count 0)');
  assert(out.failure.code === 'OUT_OF_HARD_RANGE', 'T62 code');
});

/* Bug 1: measurement_count non-integer blocked */
scenario('T63', () => {
  const inp = baseORA();
  inp.ora_inputs = { iopcc: 18, ch: 10, selected_waveform_score: 7.5, measurement_count: 3.5, provenance_attestation: oraProvenance() };
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T63');
  assert(out.status === 'failure', 'T63 failure (non-int count)');
});

/* Bug 2: invalid ORA metadata must NOT break schema (engine normalizes) */
scenario('T64', () => {
  const inp = baseORA();
  inp.ora_metadata = { device_generation: 'BOGUS', software_version: 12345 };
  const out = engine.computeM1Advanced(inp);
  assert(out.status === 'success', 'T64 success');
  schemaValid(out, 'T64'); // must validate -> normalizer fixed bogus values
  assert(out.result.ora_metadata.device_generation === 'unknown', 'T64 gen normalized');
  assert(out.result.ora_metadata.software_version === null, 'T64 sw normalized');
});

/* Bug 2: invalid corvis metadata normalized */
scenario('T65', () => {
  const inp = baseCorvis();
  inp.corvis_metadata = { software_version: {}, ssi_version: 'SSIv99', reference_database: 'martian' };
  const out = engine.computeM1Advanced(inp);
  assert(out.status === 'success', 'T65 success');
  schemaValid(out, 'T65');
  assert(out.result.corvis_metadata.ssi_version === null, 'T65 ssi normalized');
  assert(out.result.corvis_metadata.reference_database === 'unknown', 'T65 ref normalized');
});

/* Bug 2: malformed clinician preference normalized in both branch */
scenario('T66', () => {
  const inp = baseBoth();
  inp.clinician_documented_preference = { selected_source: 'INVALID', rationale: 99, used_for_export: true };
  const out = engine.computeM1Advanced(inp);
  assert(out.status === 'success', 'T66 success');
  schemaValid(out, 'T66');
  assert(out.result.clinician_documented_preference.selected_source === null, 'T66 src normalized');
  assert(out.result.clinician_documented_preference.used_for_export === false, 'T66 export forced false');
});

/* Bug 2: arbitrary measurement_failure code normalized */
scenario('T67', () => {
  const inp = baseCorvis({ measurement_failure: { occurred: true, code: 'TOTALLY_MADE_UP', message: 'x' } });
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T67');
  assert(out.status === 'failure', 'T67 failure');
  assert(out.failure.code === 'DEVICE_ERROR', 'T67 code normalized to DEVICE_ERROR');
});

/* Bug 3: both with diff=0 must NOT claim a difference */
scenario('T68', () => {
  const out = engine.computeM1Advanced(baseBoth({
    ora_inputs: { iopcc: 18, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() },
    corvis_inputs: { biop: 18, corvis_quality_raw: 'OK' }
  }));
  schemaValid(out, 'T68');
  assert(out.result.device_comparison.absolute_difference_mmhg === 0, 'T68 diff 0');
  assert(out.result.device_comparison.interpretation === 'No marked cross-device difference detected.', 'T68 dynamic text no diff');
  assert(out.result.device_comparison.numerical_threshold_exceeded === false, 'T68 no review');
});

/* Bug 3: both with diff>3 and valid comparison */
scenario('T69', () => {
  const out = engine.computeM1Advanced(baseBoth({
    ora_inputs: { iopcc: 18, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() },
    corvis_inputs: { biop: 22, corvis_quality_raw: 'OK' }
  }));
  schemaValid(out, 'T69');
  assert(out.result.device_comparison.interpretation === 'Cross-device difference exceeds the OFTY review threshold.', 'T69 dynamic text exceeds');
});

/* Bug 3: both with invalid comparison shows neutral text */
scenario('T70', () => {
  const inp = baseBoth({
    ora_inputs: { iopcc: 18, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() },
    corvis_inputs: { biop: 22, corvis_quality_raw: 'OK' }
  });
  delete inp.clinician_confirmation;
  inp.measurement_identity = { eye: 'OD', encounter_id: null };
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T70');
  assert(out.result.device_comparison.interpretation === 'Numerical difference shown; clinical comparison not established.', 'T70 neutral text');
});

/* Bug 4: Core parity — structured value is RAW unrounded, display is rounded */
scenario('T71', () => {
  const out = engine.computeM1Advanced(baseORA({ gat_iop: 18, cct: 551 }));
  schemaValid(out, 'T71');
  const raw = 18 - ((551 - 540) / 25); // 17.56
  assert(out.result.core_reference.value_mmhg === raw, 'T71 raw value 17.56 preserved');
  assert(out.result.core_reference.display_value_mmhg === 17.6, 'T71 display 17.6');
});

/* Bug 4: parity grid GAT x CCT — raw must equal Core formula exactly */
scenario('T72', () => {
  let mismatches = 0;
  for (let gat = 8; gat <= 30; gat += 2) {
    for (let cct = 450; cct <= 650; cct += 7) {
      const out = engine.computeM1Advanced(baseORA({ gat_iop: gat, cct: cct }));
      if (out.status !== 'success') { mismatches++; continue; }
      const expected = gat - ((cct - 540) / 25);
      if (out.result.core_reference.value_mmhg !== expected) mismatches++;
    }
  }
  assert(mismatches === 0, 'T72 parity grid: ' + mismatches + ' mismatches (expected 0)');
});

/* Bug 5: input echo completeness — temporal, provenance, metadata present */
scenario('T73', () => {
  const inp = baseORA();
  inp.ora_timestamp = '2026-03-01T10:00:00Z';
  inp.ora_metadata = { device_generation: 'G3', software_version: 'v4.2' };
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T73');
  const echo = out.result.inputs;
  assert(echo.temporal !== undefined, 'T73 echo has temporal');
  assert(echo.temporal.clinician_confirmation === true, 'T73 echo clinician conf');
  assert(echo.temporal.ora_timestamp === '2026-03-01T10:00:00Z', 'T73 echo timestamp');
  assert(echo.ora_inputs.provenance_attestation.values_from_same_device_result_confirmed === true, 'T73 echo provenance');
  assert(echo.ora_metadata.device_generation === 'G3', 'T73 echo metadata');
  assert(echo.measurement_identity.eye === 'OD', 'T73 echo eye');
});

/* Bug 5: echo captures SSI/SP-A1 in corvis */
scenario('T74', () => {
  const out = engine.computeM1Advanced(baseCorvis({
    corvis_inputs: { biop: 14.5, corvis_quality_raw: 'OK', ssi: 1.1, sp_a1: 95 }
  }));
  schemaValid(out, 'T74');
  assert(out.result.inputs.corvis_inputs.ssi === 1.1, 'T74 echo ssi');
  assert(out.result.inputs.corvis_inputs.sp_a1 === 95, 'T74 echo sp_a1');
});

/* ════════════════════════════════════════════════════════════════════════
   T78–T90  RUNTIME CONTRACT CLOSURE (v0.4.4)
   ════════════════════════════════════════════════════════════════════════ */

/* Blocker 1: null / undefined / array must be structured failures, never throw */
scenario('T78', () => {
  let out;
  let threw = false;
  try { out = engine.computeM1Advanced(null); } catch (e) { threw = true; }
  assert(!threw, 'T78 null does not throw');
  schemaValid(out, 'T78');
  assert(out.status === 'failure', 'T78 null -> failure');
});
scenario('T79', () => {
  let out, threw = false;
  try { out = engine.computeM1Advanced(undefined); } catch (e) { threw = true; }
  assert(!threw, 'T79 undefined does not throw');
  assert(out.status === 'failure', 'T79 undefined -> failure');
});
scenario('T80', () => {
  let out, threw = false;
  try { out = engine.computeM1Advanced([1, 2, 3]); } catch (e) { threw = true; }
  assert(!threw, 'T80 array does not throw');
  assert(out.status === 'failure', 'T80 array -> failure');
});

/* Blocker 2: hostile scalar types must yield schema-valid success (normalized) */
scenario('T81', () => {
  const out = engine.computeM1Advanced(baseORA({ measurement_identity: { eye: 'OD', encounter_id: 123 } }));
  assert(out.status === 'success', 'T81 success');
  schemaValid(out, 'T81');
  assert(out.result.measurement_identity.encounter_id === null, 'T81 numeric encounter_id normalized to null');
});
scenario('T82', () => {
  const inp = baseORA();
  inp.gat_timestamp = {};
  const out = engine.computeM1Advanced(inp);
  assert(out.status === 'success', 'T82 success');
  schemaValid(out, 'T82');
  assert(out.result.comparison_context.gat_timestamp === null, 'T82 object timestamp normalized to null');
});
scenario('T83', () => {
  const out = engine.computeM1Advanced(baseCorvis({ corvis_inputs: { biop: 14.5, corvis_quality_raw: {} } }));
  assert(out.status === 'success', 'T83 success');
  schemaValid(out, 'T83');
  assert(out.result.measurement_quality.raw_device_status === null, 'T83 object quality_raw normalized to null');
  assert(out.result.measurement_quality.level === 'unknown', 'T83 -> unknown quality');
});

/* Blocker 2 (subtle): SSI present + bogus reference must still be schema-valid */
scenario('T84', () => {
  const out = engine.computeM1Advanced(baseCorvis({
    corvis_inputs: { biop: 14.5, corvis_quality_raw: 'OK', ssi: 1.1 },
    corvis_metadata: { reference_database: 'martian' }
  }));
  assert(out.status === 'success', 'T84 success');
  schemaValid(out, 'T84');
  assert(out.result.biomechanical_context.additional_biomechanical_parameters.reference === 'unknown',
    'T84 bogus reference normalized to unknown in additional_biomech');
});

/* Blocker 4: prior_refractive_surgery as object rejected */
scenario('T85', () => {
  const out = engine.computeM1Advanced(baseORA({ prior_refractive_surgery: {} }));
  schemaValid(out, 'T85');
  assert(out.status === 'failure', 'T85 object refractive -> failure');
  assert(out.failure.code === 'MISSING_REQUIRED_FIELD', 'T85 code');
});
scenario('T86', () => {
  const out = engine.computeM1Advanced(baseORA({ prior_refractive_surgery: 'TanagraBeam' }));
  schemaValid(out, 'T86');
  assert(out.status === 'failure', 'T86 unknown refractive string -> failure');
});
scenario('T87', () => {
  const out = engine.computeM1Advanced(baseORA({ prior_refractive_surgery: 'other' }));
  assert(out.status === 'success', 'T87 "other" accepted');
  schemaValid(out, 'T87');
  assert(out.result.clinical_applicability.level === 'limited', 'T87 other -> limited');
});

/* Blocker 4: ORA provenance with bogus basis normalized, reading_id object -> null */
scenario('T88', () => {
  const inp = baseORA();
  inp.ora_inputs.provenance_attestation = { values_from_same_device_result_confirmed: true, basis: 123, reading_id: {} };
  const out = engine.computeM1Advanced(inp);
  assert(out.status === 'success', 'T88 success');
  schemaValid(out, 'T88');
  assert(out.result.inputs.ora_inputs.provenance_attestation.basis === 'single_reading', 'T88 bogus basis normalized');
  assert(out.result.inputs.ora_inputs.provenance_attestation.reading_id === null, 'T88 object reading_id -> null');
});

/* Blocker 4: SSI out of guardrail range rejected */
scenario('T89', () => {
  const out = engine.computeM1Advanced(baseCorvis({ corvis_inputs: { biop: 14.5, corvis_quality_raw: 'OK', ssi: 999 } }));
  schemaValid(out, 'T89');
  assert(out.status === 'failure', 'T89 SSI 999 -> failure');
  assert(out.failure.code === 'OUT_OF_HARD_RANGE', 'T89 code');
});
scenario('T90', () => {
  const out = engine.computeM1Advanced(baseCorvis({ corvis_inputs: { biop: 14.5, corvis_quality_raw: 'OK', sp_a1: -10 } }));
  schemaValid(out, 'T90');
  assert(out.status === 'failure', 'T90 negative SP-A1 -> failure');
});

/* ════════════════════════════════════════════════════════════════════════
   T91–T100  FINAL RUNTIME/AUDIT CLOSURE (v0.4.5)
   ════════════════════════════════════════════════════════════════════════ */

/* Blocker 1: string "false" must NOT become true; invalid boolean rejected */
scenario('T91', () => {
  const out = engine.computeM1Advanced(baseORA({ keratoconus_ectasia: 'false' }));
  schemaValid(out, 'T91');
  assert(out.status === 'failure', 'T91 string "false" rejected (not coerced)');
  assert(out.failure.code === 'MISSING_REQUIRED_FIELD', 'T91 code');
});
scenario('T92', () => {
  const out = engine.computeM1Advanced(baseORA({ corneal_edema: 1 }));
  schemaValid(out, 'T92');
  assert(out.status === 'failure', 'T92 numeric boolean rejected');
});
scenario('T93', () => {
  const out = engine.computeM1Advanced(baseORA({ significant_dystrophy_or_scar: {} }));
  schemaValid(out, 'T93');
  assert(out.status === 'failure', 'T93 object boolean rejected');
});
scenario('T94', () => {
  // real booleans still work
  const out = engine.computeM1Advanced(baseORA({ keratoconus_ectasia: true }));
  assert(out.status === 'success', 'T94 real true accepted');
  assert(out.result.clinical_applicability.level === 'limited', 'T94 -> limited');
});

/* Blocker 2: whitespace encounter id must NOT validate comparison */
scenario('T95', () => {
  const inp = baseORA({ gat_iop: 14, ora_inputs: { iopcc: 24, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() } });
  delete inp.clinician_confirmation;
  inp.measurement_identity = { eye: 'OD', encounter_id: null };
  inp.shared_encounter_id = '   ';
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T95');
  assert(out.result.comparison_context.basis === 'unconfirmed', 'T95 whitespace encounter -> unconfirmed');
  assert(out.result.comparison_context.comparison_valid === false, 'T95 not valid');
  assert(!flagsHave(out, 'marked_difference_vs_gat'), 'T95 no marked diff from empty encounter');
});

/* Blocker 2b: conflicting encounter ids without confirmation rejected */
scenario('T96', () => {
  const inp = baseORA();
  inp.measurement_identity = { eye: 'OD', encounter_id: 'enc-A' };
  inp.shared_encounter_id = 'enc-B';
  delete inp.clinician_confirmation;
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T96');
  assert(out.status === 'failure', 'T96 conflicting encounters rejected');
});

/* Blocker 3: both with diff>3 but invalid comparison: threshold exceeded but not interpretable */
scenario('T97', () => {
  const inp = baseBoth({
    ora_inputs: { iopcc: 18, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, provenance_attestation: oraProvenance() },
    corvis_inputs: { biop: 22, corvis_quality_raw: 'OK' }
  });
  delete inp.clinician_confirmation;
  inp.measurement_identity = { eye: 'OD', encounter_id: null };
  const out = engine.computeM1Advanced(inp);
  schemaValid(out, 'T97');
  // numerical_threshold_exceeded is pure arithmetic and may be true...
  assert(out.result.device_comparison.numerical_threshold_exceeded === true, 'T97 numeric threshold exceeded (arithmetic)');
  // ...but clinical interpretability is false, and no clinical cross_device_difference flag
  assert(out.result.device_comparison.comparison_clinically_interpretable === false, 'T97 not clinically interpretable');
  assert(!flagsHave(out, 'cross_device_difference'), 'T97 no clinical discordance flag');
  assert(flagsHave(out, 'temporal_comparison_invalid', 'cross_device'), 'T97 temporal invalid flag');
});

/* Blocker 4: clinician preference timestamp appears in echo */
scenario('T98', () => {
  const out = engine.computeM1Advanced(baseBoth({
    clinician_documented_preference: { selected_source: 'ORA-IOPcc', rationale: 'test', timestamp: '2026-03-01T10:00:00Z' }
  }));
  schemaValid(out, 'T98');
  assert(out.result.inputs.clinician_documented_preference.timestamp === '2026-03-01T10:00:00Z', 'T98 echo has timestamp');
  // reproducibility: two calls differing only in preference timestamp produce different echoes
  const out2 = engine.computeM1Advanced(baseBoth({
    clinician_documented_preference: { selected_source: 'ORA-IOPcc', rationale: 'test', timestamp: '2026-03-02T10:00:00Z' }
  }));
  assert(out.result.inputs.clinician_documented_preference.timestamp !==
         out2.result.inputs.clinician_documented_preference.timestamp, 'T98 different timestamps -> different echoes');
});

/* Blocker 1 (echo): rejected invalid bool never reaches a success echo */
scenario('T99', () => {
  const out = engine.computeM1Advanced(baseORA({ keratoconus_ectasia: 'true' }));
  schemaValid(out, 'T99');
  assert(out.status === 'failure', 'T99 string "true" also rejected (no coercion either direction)');
});

/* Whitespace-only encounter_id in measurement_identity normalized to null in echo */
scenario('T100', () => {
  const out = engine.computeM1Advanced(baseORA({ measurement_identity: { eye: 'OD', encounter_id: '   ' } }));
  assert(out.status === 'success', 'T100 success');
  schemaValid(out, 'T100');
  assert(out.result.measurement_identity.encounter_id === null, 'T100 whitespace encounter_id -> null in echo');
});

/* ════════════════════════════════════════════════════════════════════════
   REPORT
   ════════════════════════════════════════════════════════════════════════ */
const report = {
  suite_version: 'M1-ADV-TESTS-1.3',
  engine_version: engine.CONSTANTS.ALG_VERSION,
  schema_version: engine.CONSTANTS.SCHEMA_VERSION,
  test_scenarios: SCENARIOS,
  total_assertions: ASSERTIONS,
  passed_assertions: ASSERTIONS - FAILED,
  failed_assertions: FAILED,
  all_passed: FAILED === 0,
  failures: failures
};

fs.writeFileSync(path.join(__dirname, 'm1_advanced_test_report.json'), JSON.stringify(report, null, 2));

console.log('═══════════════════════════════════════════════');
console.log('  M1 ADVANCED — PURE ENGINE TEST REPORT');
console.log('═══════════════════════════════════════════════');
console.log('  Test scenarios:    ' + SCENARIOS);
console.log('  Total assertions:  ' + ASSERTIONS);
console.log('  Passed:            ' + (ASSERTIONS - FAILED));
console.log('  Failed:            ' + FAILED);
console.log('  All passed:        ' + (FAILED === 0 ? 'YES ✓' : 'NO ✗'));
console.log('═══════════════════════════════════════════════');
if (FAILED > 0) {
  console.log('FAILURES:');
  failures.forEach(f => console.log('  • ' + f));
  process.exit(1);
}
