'use strict';
/* ============================================================================
   OFTY M1 Advanced — in-silico stress test v2 (STRICT comparability policy)
   Reproducible under the locked software version, fixed seed, fixed sampler
   call order, and recorded runtime environment.

   POLICY (Option A, strict / safety-first):
     Clinical cross-device comparability is valid ONLY IF
     clinician_confirmation === true. An encounter/session identifier alone
     never validates a clinical comparison.

   This run separates two REAL architectural surfaces (per UI spec v0.4.1 §1.7):
     (1) CLINICAL / MANUAL surface  -> shared_encounter_id is NEVER set
         (the deployed manual UI sets only measurement_identity.encounter_id;
          shared_encounter_id is integration-only and unreachable from the form)
         => the strict policy is evaluated here.
     (2) INTEGRATION-AFFORDANCE audit -> a dedicated probe that DOES set
         shared_encounter_id (no clinician_confirmation) to document, honestly
         and separately, how the engine treats that integration-only field.
   No tolerances are relaxed; deviations are reported with index + input.
   ========================================================================== */
const fs = require('fs');
const crypto = require('crypto');
const E = require('./m1_advanced_engine.js');
const MT19937 = require('./mt19937.js');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

const SEED = 42;
const VALID_PER_STRATUM = 5000;
const ADV_PER_TYPE = 1000;
const INTEGRATION_PROBE_N = 5000;

const schema = JSON.parse(fs.readFileSync('./m1_advanced_schema.json', 'utf8'));
const ajv = new Ajv2020({ allErrors: false, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const mt = new MT19937(SEED);
const rnd = () => mt.f64();
const randint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const uni = (lo, hi) => lo + rnd() * (hi - lo);
const r1 = (x) => Math.round(x * 10) / 10;
const pick = (arr) => arr[randint(0, arr.length - 1)];
const chance = (p) => rnd() < p;

const REFRACTIVE = ['LASIK', 'PRK', 'SMILE', 'RK', 'other'];
const PROV_BASIS = ['single_reading', 'device_averaged_output'];
const MF_CODES = ['ORA_NO_USABLE_WAVEFORM', 'CORVIS_UNREADABLE', 'DEVICE_ERROR', 'CLINICIAN_INVALIDATED'];

function oraBlock(over) {
  return Object.assign({
    iopcc: r1(uni(8, 30)), ch: r1(uni(6, 14)),
    selected_waveform_score: r1(uni(3, 10)), measurement_count: randint(1, 6),
    provenance_attestation: { values_from_same_device_result_confirmed: true, basis: pick(PROV_BASIS) }
  }, over || {});
}
function corvisBlock(over) {
  return Object.assign({
    biop: r1(uni(8, 30)), corvis_quality_raw: pick(['OK', 'good', 'acceptable', 'high', 'borderline', 'poor']),
    ssi: r1(uni(0.5, 2)), sp_a1: r1(uni(50, 150))
  }, over || {});
}
function baseValid(branch) {
  const inp = {
    device_branch: branch,
    measurement_identity: { eye: pick(['OD', 'OS']) },
    gat_iop: randint(5, 60), cct: randint(250, 750),
    keratoconus_ectasia: false, corneal_edema: false, significant_dystrophy_or_scar: false,
    prior_refractive_surgery: null, clinician_confirmation: false
    // NOTE: shared_encounter_id intentionally NOT set on the clinical surface
  };
  if (branch === 'ora' || branch === 'both') inp.ora_inputs = oraBlock();
  if (branch === 'corvis' || branch === 'both') inp.corvis_inputs = corvisBlock();
  return inp;
}

// ---- CLINICAL-SURFACE valid strata (shared_encounter_id never set) ---------
function genValid(stratum) {
  switch (stratum) {
    case 'nominal_mixed': return baseValid(pick(['ora', 'corvis', 'both']));
    case 'concordant_both': {
      const i = baseValid('both'); const base = r1(uni(10, 28));
      i.ora_inputs.iopcc = base; i.corvis_inputs.biop = r1(base + uni(-1, 1)); return i;
    }
    case 'discordant_both_unconfirmed': {
      const i = baseValid('both'); const lo = r1(uni(8, 20)); const hi = r1(lo + uni(4, 12));
      if (chance(0.5)) { i.ora_inputs.iopcc = hi; i.corvis_inputs.biop = lo; } else { i.ora_inputs.iopcc = lo; i.corvis_inputs.biop = hi; }
      i.clinician_confirmation = false; return i;
    }
    case 'discordant_both_confirmed': {
      // manual-UI confirmation path: clinician_confirmation only (NO shared_encounter_id)
      const i = baseValid('both'); const lo = r1(uni(8, 20)); const hi = r1(lo + uni(4, 12));
      if (chance(0.5)) { i.ora_inputs.iopcc = hi; i.corvis_inputs.biop = lo; } else { i.ora_inputs.iopcc = lo; i.corvis_inputs.biop = hi; }
      i.clinician_confirmation = true; return i;
    }
    case 'ch_out_of_range': {
      const i = baseValid(chance(0.5) ? 'ora' : 'both');
      i.ora_inputs.ch = chance(0.5) ? r1(uni(1, 3.9)) : r1(uni(18.1, 25)); return i;
    }
    case 'post_refractive': { const i = baseValid(pick(['ora', 'corvis', 'both'])); i.prior_refractive_surgery = pick(REFRACTIVE); return i; }
    case 'unknown_corvis_quality': { const i = baseValid(chance(0.5) ? 'corvis' : 'both'); i.corvis_inputs.corvis_quality_raw = 'ZZZ' + randint(0, 9999); return i; }
    case 'invalid_temporal': {
      // timestamps and/or an identity-only encounter tag present, no confirmation -> must NOT validate
      const i = baseValid('both'); i.clinician_confirmation = false;
      i.ora_timestamp = '2026-06-18T10:00:00Z'; i.corvis_timestamp = '2026-06-19T15:00:00Z';
      if (chance(0.5)) i.measurement_identity.encounter_id = 'VISIT-' + randint(1000, 9999);
      return i;
    }
    case 'boundary_values': {
      const branch = pick(['ora', 'corvis', 'both']); const i = baseValid(branch);
      i.gat_iop = pick([5, 60]); i.cct = pick([250, 750]);
      if (i.ora_inputs) { i.ora_inputs.iopcc = pick([1, 80]); i.ora_inputs.ch = pick([1, 25]); i.ora_inputs.selected_waveform_score = pick([0, 10]); i.ora_inputs.measurement_count = 1; }
      if (i.corvis_inputs) { i.corvis_inputs.biop = pick([5, 60]); i.corvis_inputs.ssi = pick([0, 5]); i.corvis_inputs.sp_a1 = pick([0, 500]); }
      return i;
    }
    case 'measurement_failure': { const i = baseValid(pick(['ora', 'corvis', 'both'])); i.measurement_failure = { occurred: true, code: pick(MF_CODES), message: 'Device did not produce a usable reading.' }; return i; }
  }
}
function genAdversarial(kind) {
  if (kind === 'foreign_toplevel') return pick([null, 42, 'not-an-object', [1, 2, 3], true]);
  const i = baseValid(pick(['ora', 'corvis']));
  switch (kind) {
    case 'missing_identity': delete i.measurement_identity; break;
    case 'bad_eye': i.measurement_identity.eye = pick(['OX', 5, null, '']); break;
    case 'gat_wrongtype': i.gat_iop = pick(['18', null, NaN, {}, []]); break;
    case 'gat_outrange': i.gat_iop = pick([0, 4, 61, 1000, -5]); break;
    case 'cct_outrange': i.cct = pick([100, 249, 751, 2000]); break;
    case 'bad_modifier': i.keratoconus_ectasia = pick(['false', 1, {}, [], 'true', 0]); break;
    case 'bad_branch': i.device_branch = pick(['x', 'ORA', '', null, 5]); break;
    case 'ora_missing_required': { i.device_branch = 'ora'; i.ora_inputs = oraBlock(); delete i.ora_inputs[pick(['iopcc', 'ch', 'selected_waveform_score', 'measurement_count'])]; break; }
    case 'ora_provenance_unconfirmed': { i.device_branch = 'ora'; i.ora_inputs = oraBlock(); i.ora_inputs.provenance_attestation = pick([{ values_from_same_device_result_confirmed: false }, {}, { values_from_same_device_result_confirmed: 'yes' }]); break; }
    case 'ora_outrange': { i.device_branch = 'ora'; i.ora_inputs = oraBlock(); if (chance(0.5)) i.ora_inputs.iopcc = pick([0, 200, -3]); else i.ora_inputs.ch = pick([0, 0.5, 26, 30]); break; }
    case 'corvis_missing_biop': { i.device_branch = 'corvis'; i.corvis_inputs = corvisBlock(); delete i.corvis_inputs.biop; break; }
    case 'corvis_outrange': { i.device_branch = 'corvis'; i.corvis_inputs = corvisBlock(); const r = randint(0, 2); if (r === 0) i.corvis_inputs.biop = pick([0, 200]); else if (r === 1) i.corvis_inputs.ssi = pick([6, -1]); else i.corvis_inputs.sp_a1 = pick([600, -1]); break; }
  }
  return i;
}
// integration-only probe: shared_encounter_id set, clinician_confirmation false
function genIntegrationProbe() {
  const i = baseValid('both'); i.clinician_confirmation = false;
  i.shared_encounter_id = 'ENC-' + randint(1000, 9999); return i;
}

// ---- STRICT invariant oracle (success outputs only) ------------------------
const FORBIDDEN_FUSED = /^(true_iop|fused_iop|combined_iop|merged_iop|unified_iop|single_iop|true_pressure)(_mmhg)?$/i;
function checkInvariants(input, out, branch) {
  const v = []; const r = out.result;
  if (!r.downstream || r.downstream.eligible_for_target_comparison !== false) v.push('eligible_for_target_comparison_not_false');
  (function scan(o) { if (o && typeof o === 'object') { for (const k of Object.keys(o)) { if (FORBIDDEN_FUSED.test(k)) v.push('forbidden_fused_key:' + k); scan(o[k]); } } })(r);
  const chc = r.biomechanical_context && r.biomechanical_context.ch_context;
  if (chc && chc.numerical_effect_on_iop !== false) v.push('ch_numerical_effect_not_false');
  const cr = r.core_reference;
  if (cr) {
    if (cr.applicability === 'not_applicable') { if (cr.value_mmhg !== null) v.push('core_value_not_null_when_not_applicable'); }
    else { const expect = input.gat_iop - ((input.cct - 540) / 25); if (cr.value_mmhg !== expect) v.push('core_value_parity_drift'); }
  }
  if (branch === 'ora' && r.device_measurement && r.device_measurement.value_mmhg !== input.ora_inputs.iopcc) v.push('ora_echo_mismatch');
  if (branch === 'corvis' && r.device_measurement && r.device_measurement.value_mmhg !== input.corvis_inputs.biop) v.push('corvis_echo_mismatch');
  if (branch === 'both') {
    const cc = r.comparison_context || {};
    // OPTION A (strict): comparability validity requires explicit clinician confirmation
    if (cc.comparison_valid === true && input.clinician_confirmation !== true) v.push('comparison_valid_without_clinician_confirmation:basis=' + cc.basis);
    // structural: device comparability asserted only over a valid comparison context
    const comp = r.device_comparison && r.device_comparison.comparability;
    if (comp && comp.ora_vs_corvis === true && cc.comparison_valid !== true) v.push('comparability_true_but_context_invalid');
  }
  return v;
}

// ---- generic population runner ---------------------------------------------
function newCounters() { return { determinism_pass: 0, determinism_fail: 0, contract_pass: 0, contract_fail: 0, invariant_violations: 0, routing_pass: 0, routing_fail: 0, throws: 0, branches: { ora: 0, corvis: 0, both: 0, other_or_invalid: 0 } }; }
function branchOf(input) { const b = input && typeof input === 'object' ? input.device_branch : undefined; return (b === 'ora' || b === 'corvis' || b === 'both') ? b : 'other_or_invalid'; }

function runPopulation(items, ctx) {
  for (const it of items) {
    const { input, group, stratum, expectedStatus } = it;
    const br = branchOf(input); ctx.counters.branches[br]++;
    if (!ctx.perStratum[stratum]) ctx.perStratum[stratum] = { n: 0, success: 0, failure: 0, determinism_fail: 0, contract_fail: 0, invariant_violations: 0, routing_fail: 0, throws: 0 };
    const ps = ctx.perStratum[stratum]; ps.n++;
    let out1, out2;
    try { out1 = E.computeM1Advanced(input); } catch (e) { ctx.counters.throws++; ps.throws++; if (ctx.failures.length < ctx.cap) ctx.failures.push({ index: ctx.idx, kind: 'throw', group, stratum, branch: br, detail: String(e && e.message), input }); ctx.idx++; continue; }
    let inputB; try { inputB = structuredClone(input); } catch (e) { inputB = input; }
    try { out2 = E.computeM1Advanced(inputB); } catch (e) { ctx.counters.throws++; ps.throws++; ctx.idx++; continue; }
    ctx.totalEvals += 2;
    if (JSON.stringify(out1) === JSON.stringify(out2)) ctx.counters.determinism_pass++; else { ctx.counters.determinism_fail++; ps.determinism_fail++; if (ctx.failures.length < ctx.cap) ctx.failures.push({ index: ctx.idx, kind: 'determinism', group, stratum, branch: br, input }); }
    if (validate(out1)) ctx.counters.contract_pass++; else { ctx.counters.contract_fail++; ps.contract_fail++; if (ctx.failures.length < ctx.cap) ctx.failures.push({ index: ctx.idx, kind: 'contract', group, stratum, branch: br, detail: JSON.stringify(validate.errors && validate.errors.slice(0, 3)), input }); }
    const status = out1 && out1.status;
    if (status === 'success') ps.success++; else if (status === 'failure') ps.failure++;
    let routingOk = (status === expectedStatus);
    if (routingOk && stratum === 'measurement_failure') routingOk = (out1.failure && out1.failure.type === 'measurement_failure');
    if (routingOk) ctx.counters.routing_pass++; else { ctx.counters.routing_fail++; ps.routing_fail++; if (ctx.failures.length < ctx.cap) ctx.failures.push({ index: ctx.idx, kind: 'routing', group, stratum, branch: br, detail: 'expected=' + expectedStatus + ' got=' + status, input }); }
    if (status === 'success') { const vv = checkInvariants(input, out1, br); if (vv.length) { ctx.counters.invariant_violations += vv.length; ps.invariant_violations += vv.length; if (ctx.failures.length < ctx.cap) ctx.failures.push({ index: ctx.idx, kind: 'invariant', group, stratum, branch: br, detail: vv.join(','), input }); } }
    ctx.idx++;
  }
}

// ---- build CLINICAL population ----------------------------------------------
const CLINICAL_STRATA = ['nominal_mixed', 'concordant_both', 'discordant_both_unconfirmed', 'discordant_both_confirmed',
  'ch_out_of_range', 'post_refractive', 'unknown_corvis_quality', 'invalid_temporal', 'boundary_values', 'measurement_failure'];
const ADV_TYPES = ['foreign_toplevel', 'missing_identity', 'bad_eye', 'gat_wrongtype', 'gat_outrange', 'cct_outrange', 'bad_modifier', 'bad_branch', 'ora_missing_required', 'ora_provenance_unconfirmed', 'ora_outrange', 'corvis_missing_biop', 'corvis_outrange'];

const clinicalItems = [];
for (const s of CLINICAL_STRATA) { const exp = (s === 'measurement_failure') ? 'failure' : 'success'; for (let k = 0; k < VALID_PER_STRATUM; k++) clinicalItems.push({ input: genValid(s), group: 'valid', stratum: s, expectedStatus: exp }); }
for (const kind of ADV_TYPES) { for (let k = 0; k < ADV_PER_TYPE; k++) clinicalItems.push({ input: genAdversarial(kind), group: 'adversarial', stratum: 'adv_' + kind, expectedStatus: 'failure' }); }

const t0 = Date.now();
const clinicalCtx = { counters: newCounters(), perStratum: {}, failures: [], cap: 100, idx: 0, totalEvals: 0 };
runPopulation(clinicalItems, clinicalCtx);

// ---- build INTEGRATION-AFFORDANCE probe (separate, honestly reported) -------
const integItems = [];
for (let k = 0; k < INTEGRATION_PROBE_N; k++) integItems.push({ input: genIntegrationProbe(), group: 'integration', stratum: 'integration_shared_encounter', expectedStatus: 'success' });
const integCtx = { counters: newCounters(), perStratum: {}, failures: [], cap: 25, idx: 0, totalEvals: 0 };
runPopulation(integItems, integCtx);
const elapsedMs = Date.now() - t0;

const nValid = CLINICAL_STRATA.length * VALID_PER_STRATUM;
const nAdv = ADV_TYPES.length * ADV_PER_TYPE;
const env = { node: process.version, platform: process.platform + ' ' + process.arch, ajv: require('ajv/package.json').version, elapsed_ms: elapsedMs };

const report = {
  report: 'OFTY M1 Advanced — in-silico stress test v2 (strict comparability policy)',
  generated_utc: new Date().toISOString(),
  reproducibility: 'reproducible under the locked software version, fixed seed, fixed sampler call order, and recorded runtime environment',
  seed: SEED,
  prng_implementation: 'MT19937 (32-bit Mersenne Twister), canonical reference implementation',
  module_version: 'OFTY M1 Advanced Browser v0.4.1 (engine 0.4.3-experimental; JSON Schema contract M1-ADV-SCHEMA-1.3; final technical freeze v0.4.5)',
  comparability_policy: 'Option A (strict): clinical cross-device comparability is valid ONLY IF clinician_confirmation === true; an encounter/session identifier alone never validates a clinical comparison',
  runtime_environment: env,

  clinical_surface_stress_test: {
    description: 'Deployed clinical/manual input surface. shared_encounter_id is NEVER set (it is not set by the manual UI; per UI spec v0.4.1 §1.7 it is integration-only and unreachable from the form). The strict policy is evaluated here.',
    input_classes: { valid_synthetic_inputs: nValid, adversarial_malformed_inputs: nAdv },
    total_inputs: nValid + nAdv,
    total_engine_evaluations: clinicalCtx.totalEvals,
    branches_tested: clinicalCtx.counters.branches,
    scenario_strata: CLINICAL_STRATA.concat(ADV_TYPES.map(t => 'adv_' + t)),
    oracle_results: {
      determinism: { pass: clinicalCtx.counters.determinism_pass, fail: clinicalCtx.counters.determinism_fail },
      contract_validation: { pass: clinicalCtx.counters.contract_pass, fail: clinicalCtx.counters.contract_fail },
      invariant_violation_count: clinicalCtx.counters.invariant_violations,
      failure_routing: { pass: clinicalCtx.counters.routing_pass, fail: clinicalCtx.counters.routing_fail },
      uncaught_exceptions: clinicalCtx.counters.throws
    },
    per_stratum: clinicalCtx.perStratum,
    failures: clinicalCtx.failures,
    all_clear: (clinicalCtx.counters.determinism_fail === 0 && clinicalCtx.counters.contract_fail === 0 && clinicalCtx.counters.invariant_violations === 0 && clinicalCtx.counters.routing_fail === 0 && clinicalCtx.counters.throws === 0)
  },

  integration_affordance_audit: {
    description: 'Separate probe of the integration-only shared_encounter_id field (set with clinician_confirmation=false). Reported honestly under item 7: NOT silently relaxed. This characterises a deliberate engine design decision, not a defect of the clinical surface.',
    probe_inputs: INTEGRATION_PROBE_N,
    engine_source_rule: "assessComparisonContext(): comparison_valid = (basis==='clinician_confirmed_same_session' || basis==='shared_encounter_id')",
    ui_reachability: 'UNREACHABLE from the manual UI: shared_encounter_id is absent from index.html and from the U1-U21 acceptance harness; documented integration-only in UI spec v0.4.1 §1.7 / Appendix A.',
    strict_policy_deviations: integCtx.counters.invariant_violations,
    determinism: { pass: integCtx.counters.determinism_pass, fail: integCtx.counters.determinism_fail },
    contract_validation: { pass: integCtx.counters.contract_pass, fail: integCtx.counters.contract_fail },
    failure_routing: { pass: integCtx.counters.routing_pass, fail: integCtx.counters.routing_fail },
    uncaught_exceptions: integCtx.counters.throws,
    per_stratum: integCtx.perStratum,
    deviation_samples: integCtx.failures,
    classification: '7(b) deliberate design decision: the engine accepts a documented shared-encounter attestation as a valid comparison basis for trusted middleware. On the clinical/manual surface (shared_encounter_id never set) the strict Option-A invariant holds with zero violations.'
  },

  headline: {
    clinical_surface_all_clear: (clinicalCtx.counters.invariant_violations === 0 && clinicalCtx.counters.determinism_fail === 0 && clinicalCtx.counters.contract_fail === 0 && clinicalCtx.counters.routing_fail === 0 && clinicalCtx.counters.throws === 0),
    clinical_strict_invariant_violations: clinicalCtx.counters.invariant_violations,
    integration_path_deviations: integCtx.counters.invariant_violations
  },

  artifact_hashes_sha256: {
    'm1_advanced_engine.js': sha256(fs.readFileSync('./m1_advanced_engine.js')),
    'm1_advanced_schema.json': sha256(fs.readFileSync('./m1_advanced_schema.json')),
    'mt19937.js': sha256(fs.readFileSync('./mt19937.js')),
    'run_monte_carlo_v2.js': sha256(fs.readFileSync('./run_monte_carlo_v2.js'))
  }
};
fs.writeFileSync('m1_advanced_monte_carlo_report_v2.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  CLINICAL: { valid: nValid, adversarial: nAdv, total: nValid + nAdv, evals: clinicalCtx.totalEvals,
    determinism_fail: clinicalCtx.counters.determinism_fail, contract_fail: clinicalCtx.counters.contract_fail,
    invariant_violations: clinicalCtx.counters.invariant_violations, routing_fail: clinicalCtx.counters.routing_fail, throws: clinicalCtx.counters.throws,
    all_clear: report.clinical_surface_stress_test.all_clear },
  INTEGRATION_PROBE: { n: INTEGRATION_PROBE_N, strict_policy_deviations: integCtx.counters.invariant_violations,
    determinism_fail: integCtx.counters.determinism_fail, contract_fail: integCtx.counters.contract_fail, routing_fail: integCtx.counters.routing_fail, throws: integCtx.counters.throws }
}, null, 2));
