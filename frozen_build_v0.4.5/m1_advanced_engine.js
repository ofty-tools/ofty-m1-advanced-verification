/* ============================================================================
   OFTY-Gx-M1-Advanced — Pure Clinical Engine
   Specification: v0.4.5
   Algorithm candidate: 0.4.3-experimental
   Schema version: M1-ADV-SCHEMA-1.3

   ARCHITECTURAL GUARANTEE:
   This module is a PURE function library. It NEVER accesses localStorage,
   window, document, or any browser/IO API. It consumes an input object,
   validates AND normalizes it once, then works exclusively on the normalized
   object so that no raw value can propagate into the output. Persistence is
   the responsibility of a separate storage adapter.
   ============================================================================ */

'use strict';

const ALG_VERSION    = '0.4.3-experimental';
const SCHEMA_VERSION = 'M1-ADV-SCHEMA-1.3';
const MODULE_ID      = 'OFTY-Gx-M1';
const MODULE_VARIANT = 'advanced';
const MAPPING_VERSION = 'corvis-map-0.1';

const CH_INTERP_STRING =
  'Lower CH is associated with greater susceptibility to glaucoma progression. ' +
  'This is a contextual risk marker and does not numerically modify the pressure estimate.';

/* ── Hard ranges ─────────────────────────────────────────────────────────── */
const RANGE = {
  gat_iop: [5, 60],
  cct:     [250, 750],
  iopcc:   [1, 80],
  ch:      [1, 25],
  biop:    [5, 60],
  crf:     [1, 25]
};
const CH_OBSERVED = [4, 18];

/* ── Corvis quality mapping table v0.1 ───────────────────────────────────────
   ONLY device-native labels documentally treated as confirmed for v0.1 are
   mapped. Per blocker #5, this is intentionally a CONSERVATIVE whitelist.
   Any label not on this whitelist OR null → "unknown".
   Changing this table requires bumping MAPPING_VERSION.
   ──────────────────────────────────────────────────────────────────────────── */
const CORVIS_QUALITY_WHITELIST = {
  // Confirmed acceptable-quality native indicators
  'ok':         'acceptable',
  'good':       'acceptable',
  // Confirmed failure indicators
  'bad':        'poor'
  // NOTE: 'high'/'borderline' native strings are NOT included because they are
  // not yet documentally confirmed as device-native outputs across versions.
  // They will be added only after verification, with a mapping version bump.
};

/* ============================================================================
   normalizeCorvisQuality(raw) -> QualityLevel
   ============================================================================ */
function normalizeCorvisQuality(raw) {
  if (raw === null || raw === undefined) return 'unknown';
  if (typeof raw !== 'string') return 'unknown';
  const key = raw.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(CORVIS_QUALITY_WHITELIST, key)) {
    return CORVIS_QUALITY_WHITELIST[key];
  }
  return 'unknown';
}

/* ============================================================================
   assessORAQuality(wfs, count) -> { level, raw_device_status, quality_inputs }
   plus low_count flag signal
   ============================================================================ */
function assessORAQuality(wfs, count) {
  let base;
  if (wfs < 3.5)      base = 'poor';
  else if (wfs < 6)   base = 'borderline';
  else if (wfs < 7)   base = 'acceptable';
  else                base = 'high';

  const RANK = { poor: 0, borderline: 1, acceptable: 2, high: 3, unknown: -1 };
  const UNRANK = ['poor', 'borderline', 'acceptable', 'high'];

  let level = base;
  let lowCount = false;
  if (count < 3) {
    // cap at "acceptable"
    if (RANK[base] > RANK['acceptable']) level = 'acceptable';
    lowCount = true;
  }

  return {
    quality: {
      level: level,
      raw_device_status: null,
      quality_inputs: { selected_waveform_score: wfs, measurement_count: count }
    },
    low_count: lowCount
  };
}

/* ============================================================================
   assessClinicalApplicability(branch, modifiers) -> { level, limitations }
   branch ∈ {core, ora, corvis}
   ============================================================================ */
function assessClinicalApplicability(branch, mods) {
  const limitations = [];
  // Communicative order: edema -> keratoconus -> refractive -> dystrophy
  if (mods.corneal_edema) {
    limitations.push('Corneal edema: acute alteration of measurements; interpretation limited.');
  }
  if (mods.keratoconus_ectasia) {
    limitations.push('Keratoconus/ectasia: biomechanics severely altered; device-specific interpretation recommended.');
  }
  if (mods.prior_refractive_surgery) {
    limitations.push('Post-refractive surgery (' + mods.prior_refractive_surgery +
      '): GAT-CCT linear model invalidated; device interpretation requires review.');
  }
  if (mods.significant_dystrophy_or_scar) {
    limitations.push('Dystrophy/scar: localized biomechanical alteration; quality and localization must be considered.');
  }

  let level;
  if (branch === 'core') {
    if (mods.prior_refractive_surgery || mods.keratoconus_ectasia || mods.corneal_edema) {
      level = 'not_applicable';
    } else if (mods.significant_dystrophy_or_scar) {
      level = 'limited';
    } else {
      level = 'standard';
    }
  } else {
    // ora or corvis
    const anyMod = mods.prior_refractive_surgery || mods.keratoconus_ectasia ||
                   mods.corneal_edema || mods.significant_dystrophy_or_scar;
    level = anyMod ? 'limited' : 'standard';
  }

  return { level: level, limitations: limitations };
}

/* ============================================================================
   deriveInterpretiveConfidence(qualityLevel, applicabilityLevel) -> confidence
   Deterministic matrix.
   ============================================================================ */
function deriveInterpretiveConfidence(quality, applicability) {
  // applicability here is "standard" | "limited" (not_assessable handled upstream)
  const M = {
    standard: { high: 'high', acceptable: 'moderate', borderline: 'moderate', poor: 'low', unknown: 'indeterminate' },
    limited:  { high: 'moderate', acceptable: 'moderate', borderline: 'low', poor: 'low', unknown: 'indeterminate' }
  };
  return M[applicability][quality];
}

/* ============================================================================
   assessComparisonContext(opts) -> { basis, comparison_valid, *timestamps }
   ============================================================================ */
function assessComparisonContext(opts) {
  const clinicianConfirmed = opts.clinician_confirmation === true;
  const sharedEncounter = !!opts.shared_encounter_id;
  const anyTimestamp = !!(opts.gat_timestamp || opts.ora_timestamp || opts.corvis_timestamp);

  let basis;
  if (clinicianConfirmed)      basis = 'clinician_confirmed_same_session';
  else if (sharedEncounter)    basis = 'shared_encounter_id';
  else if (anyTimestamp)       basis = 'timestamps_only';
  else                         basis = 'unconfirmed';

  const comparison_valid =
    (basis === 'clinician_confirmed_same_session' || basis === 'shared_encounter_id');

  return {
    basis: basis,
    comparison_valid: comparison_valid,
    gat_timestamp:    opts.gat_timestamp || null,
    ora_timestamp:    opts.ora_timestamp || null,
    corvis_timestamp: opts.corvis_timestamp || null
  };
}

/* ── confidence rank helpers (for cross-device worst-of) ─────────────────── */
const CONF_RANK = { indeterminate: 0, low: 1, moderate: 2, high: 3 };
const CONF_UNRANK = ['not_assessable', 'low', 'moderate', 'high'];

function crossDeviceInterpretability(oraOIC, corvisOIC, ora_vs_corvis) {
  if (ora_vs_corvis !== true) return 'not_assessable';
  const worst = Math.min(CONF_RANK[oraOIC], CONF_RANK[corvisOIC]);
  return CONF_UNRANK[worst];
}

/* ── CH context builder ──────────────────────────────────────────────────── */
function buildCHContext(ch) {
  const out_of_range = (ch < CH_OBSERVED[0] || ch > CH_OBSERVED[1]);
  return {
    value_mmhg: ch,
    out_of_observed_range_flag: out_of_range,
    interpretation_displayed_to_user: CH_INTERP_STRING,
    numerical_effect_on_iop: false
  };
}

/* ── Additional biomech params (SSI/SP-A1) ───────────────────────────────── */
function buildAdditionalBiomech(ssi, sp_a1, reference) {
  if ((ssi === null || ssi === undefined) && (sp_a1 === null || sp_a1 === undefined)) {
    return null;
  }
  return {
    ssi: (ssi === undefined ? null : ssi),
    sp_a1: (sp_a1 === undefined ? null : sp_a1),
    display_label: 'Additional biomechanical parameters',
    display_subtitle: 'Context only \u00b7 not used to modify the pressure value',
    reference: reference || 'unknown'
  };
}

/* ── Core reference (calls frozen Core conceptually) ─────────────────────────
   We replicate the Core formula here ONLY to populate the comparison reference.
   This does NOT modify the Core. The actual frozen Core lives in tool #1.
   ──────────────────────────────────────────────────────────────────────────── */
function computeCoreReference(gat_iop, cct, mods) {
  const applic = assessClinicalApplicability('core', mods);
  let value, displayValue;
  if (applic.level === 'not_applicable') {
    value = null;
    displayValue = null;
  } else {
    // EXACT parity with frozen Core: structured output keeps the RAW unrounded
    // value (Core stores adjusted_iop unrounded; rounds only at UI via toFixed(1)).
    value = gat_iop - ((cct - 540) / 25);
    displayValue = Math.round(value * 10) / 10;
  }
  return {
    value_mmhg: value,
    display_value_mmhg: displayValue,
    applicability: applic.level,
    limitation_reason: applic.limitations
  };
}

/* ── flag helpers ────────────────────────────────────────────────────────── */
function normalizeORAMetadata(m) {
  const allowedGen = ['G3', 'legacy', 'unknown'];
  if (!m || typeof m !== 'object') return { device_generation: 'unknown', software_version: null };
  return {
    device_generation: allowedGen.includes(m.device_generation) ? m.device_generation : 'unknown',
    software_version: (typeof m.software_version === 'string') ? m.software_version : null
  };
}
function normalizeCorvisMetadata(m) {
  const allowedSSI = ['SSI', 'SSIv2', null];
  const allowedRef = ['untreated', 'post_LVC', 'unknown'];
  if (!m || typeof m !== 'object') return { software_version: null, ssi_version: null, reference_database: 'unknown' };
  return {
    software_version: (typeof m.software_version === 'string') ? m.software_version : null,
    ssi_version: allowedSSI.includes(m.ssi_version) ? m.ssi_version : null,
    reference_database: allowedRef.includes(m.reference_database) ? m.reference_database : 'unknown'
  };
}
function normalizeClinicianPreference(p) {
  if (!p || typeof p !== 'object') return null;
  const allowedSrc = ['ORA-IOPcc', 'Corvis-bIOP', null];
  return {
    selected_source: allowedSrc.includes(p.selected_source) ? p.selected_source : null,
    rationale: (typeof p.rationale === 'string') ? p.rationale : null,
    used_for_export: false,
    timestamp: (typeof p.timestamp === 'string') ? p.timestamp : null
  };
}

function flag(code, scope) { return { code: code, scope: scope }; }

function dedupeFlags(flags) {
  const seen = new Set();
  const out = [];
  for (const f of flags) {
    const key = f.code + '|' + f.scope;
    if (!seen.has(key)) { seen.add(key); out.push(f); }
  }
  return out;
}

/* ── model + logic_trace builders ────────────────────────────────────────── */
function buildModel() {
  return {
    type: 'deterministic_rule_cascade',
    intended_use: 'decision_support_only',
    limitations: [
      'Experimental module (v0.4.x).',
      'Biomechanical parameters contextualize risk and reliability; they do not numerically modify the pressure value.',
      'Outputs are not eligible for direct target-IOP comparison (GAT scale mismatch).'
    ]
  };
}

/* ============================================================================
   VALIDATION
   ============================================================================ */
function isFiniteNumber(v) {
  return typeof v === 'number' && isFinite(v);
}
function isFiniteInteger(v) {
  return isFiniteNumber(v) && Math.floor(v) === v;
}
function inRange(v, key) {
  return isFiniteNumber(v) && v >= RANGE[key][0] && v <= RANGE[key][1];
}

function failValidation(engine_id, code, message) {
  return {
    status: 'failure',
    module_id: MODULE_ID,
    module_variant: MODULE_VARIANT,
    engine_id: engine_id,
    algorithm_version: ALG_VERSION,
    schema_version: SCHEMA_VERSION,
    failure: { type: 'validation_error', code: code, message: message }
  };
}

function failMeasurement(engine_id, code, message) {
  return {
    status: 'failure',
    module_id: MODULE_ID,
    module_variant: MODULE_VARIANT,
    engine_id: engine_id,
    algorithm_version: ALG_VERSION,
    schema_version: SCHEMA_VERSION,
    failure: { type: 'measurement_failure', code: code, message: message }
  };
}

function engineIdForBranch(branch) {
  if (branch === 'ora')    return 'OFTY-Gx-M1-ADV-ORA';
  if (branch === 'corvis') return 'OFTY-Gx-M1-ADV-CORVIS';
  if (branch === 'both')   return 'OFTY-Gx-M1-ADV-BOTH';
  return 'OFTY-Gx-M1-ADV-UNKNOWN';
}

/* eye consistency across declared eyes */
function eyeConsistent(input) {
  const eyes = [];
  if (input.measurement_identity && input.measurement_identity.eye) eyes.push(input.measurement_identity.eye);
  // single-eye module: any per-device eye declaration must match
  if (input.ora_inputs && input.ora_inputs.eye) eyes.push(input.ora_inputs.eye);
  if (input.corvis_inputs && input.corvis_inputs.eye) eyes.push(input.corvis_inputs.eye);
  if (eyes.length <= 1) return true;
  return eyes.every(e => e === eyes[0]);
}

/* ── allowed enumerations for normalization ──────────────────────────────── */
const ALLOWED_REFRACTIVE = ['LASIK', 'PRK', 'SMILE', 'RK', 'other'];
const ALLOWED_PROV_BASIS = ['single_reading', 'device_averaged_output'];
const SSI_RANGE = [0, 5];        // guardrail: SSI physiologically near ~0.5–2; allow 0–5
const SP_A1_RANGE = [0, 500];    // guardrail: SP-A1 typically ~50–150; allow 0–500

function cleanString(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
function cleanTimestamp(v) {
  // accept only non-empty trimmed strings as timestamps; anything else → null
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
function strictBool(v) {
  // clinical booleans must be real booleans; only `true` is true.
  // strings/numbers/objects are NOT coerced. Returns true only for === true.
  return v === true;
}
function isInvalidBool(v) {
  // a value is an invalid boolean input if present and not a real boolean
  return v !== undefined && v !== null && typeof v !== 'boolean';
}

/* ============================================================================
   validateAndNormalizeInput(input)
   Returns either:
     { failure: <failure object> }   if validation fails
     { normalized: <clean input> }   if valid
   The engine works EXCLUSIVELY on the normalized object thereafter, so no raw
   value can propagate into the output.
   ============================================================================ */
function validateAndNormalizeInput(input) {
  // 0. input must be a non-null object — checked BEFORE any dereference
  if (input === null || input === undefined || typeof input !== 'object' || Array.isArray(input)) {
    return { failure: failValidation('OFTY-Gx-M1-ADV-UNKNOWN', 'MISSING_REQUIRED_FIELD', 'Input must be a non-null object.') };
  }

  const branch = input.device_branch;
  const eid = engineIdForBranch(branch);

  // 1. device branch
  if (!['ora', 'corvis', 'both'].includes(branch)) {
    return { failure: failValidation(eid, 'INVALID_DEVICE_BRANCH', 'device_branch must be ora, corvis, or both.') };
  }

  // 2. measurement_identity
  if (!input.measurement_identity || typeof input.measurement_identity !== 'object') {
    return { failure: failValidation(eid, 'MISSING_REQUIRED_FIELD', 'measurement_identity is required.') };
  }
  if (input.measurement_identity.eye !== 'OD' && input.measurement_identity.eye !== 'OS') {
    return { failure: failValidation(eid, 'MISSING_REQUIRED_FIELD', 'measurement_identity.eye must be OD or OS.') };
  }

  // 3. eye consistency
  if (!eyeConsistent(input)) {
    return { failure: failValidation(eid, 'EYE_MISMATCH', 'Laterality mismatch between inputs; single-eye module.') };
  }

  // measurement failure declared
  if (input.measurement_failure && input.measurement_failure.occurred === true) {
    const allowedCodes = ['ORA_NO_USABLE_WAVEFORM', 'CORVIS_UNREADABLE', 'DEVICE_ERROR', 'CLINICIAN_INVALIDATED'];
    const code = allowedCodes.includes(input.measurement_failure.code) ? input.measurement_failure.code : 'DEVICE_ERROR';
    return { failure: failMeasurement(eid, code,
      typeof input.measurement_failure.message === 'string' ? input.measurement_failure.message : 'Device did not produce a usable reading.') };
  }

  // core inputs
  if (!inRange(input.gat_iop, 'gat_iop')) {
    return { failure: failValidation(eid, 'OUT_OF_HARD_RANGE', 'gat_iop out of hard range.') };
  }
  if (!inRange(input.cct, 'cct')) {
    return { failure: failValidation(eid, 'OUT_OF_HARD_RANGE', 'cct out of hard range.') };
  }

  // optional refractive surgery: if present must be an allowed string
  if (input.prior_refractive_surgery !== undefined &&
      input.prior_refractive_surgery !== null &&
      !ALLOWED_REFRACTIVE.includes(input.prior_refractive_surgery)) {
    return { failure: failValidation(eid, 'MISSING_REQUIRED_FIELD',
      'prior_refractive_surgery must be one of LASIK/PRK/SMILE/RK/other or null.') };
  }

  // clinical boolean modifiers: must be real booleans (no truthy/falsy coercion)
  if (isInvalidBool(input.keratoconus_ectasia)) {
    return { failure: failValidation(eid, 'MISSING_REQUIRED_FIELD', 'keratoconus_ectasia must be a boolean or null.') };
  }
  if (isInvalidBool(input.corneal_edema)) {
    return { failure: failValidation(eid, 'MISSING_REQUIRED_FIELD', 'corneal_edema must be a boolean or null.') };
  }
  if (isInvalidBool(input.significant_dystrophy_or_scar)) {
    return { failure: failValidation(eid, 'MISSING_REQUIRED_FIELD', 'significant_dystrophy_or_scar must be a boolean or null.') };
  }

  // encounter_id coherence: if both identity.encounter_id and shared_encounter_id
  // are present and conflict, require explicit clinician confirmation instead.
  const idEnc = cleanString(input.measurement_identity.encounter_id);
  const sharedEnc = cleanString(input.shared_encounter_id);
  if (idEnc !== null && sharedEnc !== null && idEnc !== sharedEnc &&
      input.clinician_confirmation !== true) {
    return { failure: failValidation(eid, 'MISSING_REQUIRED_FIELD',
      'Conflicting encounter identifiers; provide a single encounter_id or explicit clinician confirmation.') };
  }

  // ── build normalized object ──
  const N = {
    device_branch: branch,
    gat_iop: input.gat_iop,
    cct: input.cct,
    measurement_identity: {
      eye: input.measurement_identity.eye,
      encounter_id: cleanString(input.measurement_identity.encounter_id)
    },
    clinician_confirmation: input.clinician_confirmation === true,
    shared_encounter_id: cleanString(input.shared_encounter_id),
    gat_timestamp: cleanTimestamp(input.gat_timestamp),
    ora_timestamp: cleanTimestamp(input.ora_timestamp),
    corvis_timestamp: cleanTimestamp(input.corvis_timestamp),
    prior_refractive_surgery: ALLOWED_REFRACTIVE.includes(input.prior_refractive_surgery) ? input.prior_refractive_surgery : null,
    keratoconus_ectasia: strictBool(input.keratoconus_ectasia),
    corneal_edema: strictBool(input.corneal_edema),
    significant_dystrophy_or_scar: strictBool(input.significant_dystrophy_or_scar),
    ora_inputs: null,
    corvis_inputs: null,
    ora_metadata: normalizeORAMetadata(input.ora_metadata),
    corvis_metadata: normalizeCorvisMetadata(input.corvis_metadata),
    clinician_documented_preference: normalizeClinicianPreference(input.clinician_documented_preference)
  };

  // branch ORA
  if (branch === 'ora' || branch === 'both') {
    const o = input.ora_inputs;
    if (!o || typeof o !== 'object') {
      return { failure: failValidation(eid, branch === 'both' ? 'BRANCH_BOTH_INCOMPLETE' : 'MISSING_REQUIRED_FIELD', 'ORA inputs missing.') };
    }
    if (o.iopcc === undefined || o.ch === undefined || o.selected_waveform_score === undefined || o.measurement_count === undefined) {
      return { failure: failValidation(eid, branch === 'both' ? 'BRANCH_BOTH_INCOMPLETE' : 'MISSING_REQUIRED_FIELD', 'ORA required field missing.') };
    }
    if (!isFiniteNumber(o.selected_waveform_score) || o.selected_waveform_score < 0 || o.selected_waveform_score > 10) {
      return { failure: failValidation(eid, 'OUT_OF_HARD_RANGE', 'selected_waveform_score must be a number in [0,10].') };
    }
    if (!isFiniteInteger(o.measurement_count) || o.measurement_count < 1) {
      return { failure: failValidation(eid, 'OUT_OF_HARD_RANGE', 'measurement_count must be an integer >= 1.') };
    }
    if (!o.provenance_attestation || o.provenance_attestation.values_from_same_device_result_confirmed !== true) {
      return { failure: failValidation(eid, 'ORA_VALUES_NOT_SAME_RESULT', 'ORA values must be attested to come from a single device result.') };
    }
    if (!inRange(o.iopcc, 'iopcc')) return { failure: failValidation(eid, 'OUT_OF_HARD_RANGE', 'iopcc out of hard range.') };
    if (!inRange(o.ch, 'ch')) return { failure: failValidation(eid, 'OUT_OF_HARD_RANGE', 'ch out of hard range.') };
    if (o.crf !== undefined && o.crf !== null && !inRange(o.crf, 'crf')) {
      return { failure: failValidation(eid, 'OUT_OF_HARD_RANGE', 'crf out of hard range.') };
    }
    if (o.iopg !== undefined && o.iopg !== null && !inRange(o.iopg, 'iopcc')) {
      return { failure: failValidation(eid, 'OUT_OF_HARD_RANGE', 'iopg out of hard range.') };
    }
    N.ora_inputs = {
      iopcc: o.iopcc,
      ch: o.ch,
      selected_waveform_score: o.selected_waveform_score,
      measurement_count: o.measurement_count,
      iopg: (isFiniteNumber(o.iopg) ? o.iopg : null),
      crf: (isFiniteNumber(o.crf) ? o.crf : null),
      provenance_attestation: {
        values_from_same_device_result_confirmed: true,
        basis: ALLOWED_PROV_BASIS.includes(o.provenance_attestation.basis) ? o.provenance_attestation.basis : 'single_reading',
        reading_id: cleanString(o.provenance_attestation.reading_id)
      }
    };
  }

  // branch Corvis
  if (branch === 'corvis' || branch === 'both') {
    const c = input.corvis_inputs;
    if (!c || typeof c !== 'object') {
      return { failure: failValidation(eid, branch === 'both' ? 'BRANCH_BOTH_INCOMPLETE' : 'MISSING_REQUIRED_FIELD', 'Corvis inputs missing.') };
    }
    if (c.biop === undefined) {
      return { failure: failValidation(eid, branch === 'both' ? 'BRANCH_BOTH_INCOMPLETE' : 'MISSING_REQUIRED_FIELD', 'Corvis biop missing.') };
    }
    if (!inRange(c.biop, 'biop')) return { failure: failValidation(eid, 'OUT_OF_HARD_RANGE', 'biop out of hard range.') };
    if (c.ssi !== undefined && c.ssi !== null && (!isFiniteNumber(c.ssi) || c.ssi < SSI_RANGE[0] || c.ssi > SSI_RANGE[1])) {
      return { failure: failValidation(eid, 'OUT_OF_HARD_RANGE', 'ssi must be a number in [0,5] or null.') };
    }
    if (c.sp_a1 !== undefined && c.sp_a1 !== null && (!isFiniteNumber(c.sp_a1) || c.sp_a1 < SP_A1_RANGE[0] || c.sp_a1 > SP_A1_RANGE[1])) {
      return { failure: failValidation(eid, 'OUT_OF_HARD_RANGE', 'sp_a1 must be a number in [0,500] or null.') };
    }
    N.corvis_inputs = {
      biop: c.biop,
      corvis_quality_raw: cleanString(c.corvis_quality_raw),
      ssi: (isFiniteNumber(c.ssi) ? c.ssi : null),
      sp_a1: (isFiniteNumber(c.sp_a1) ? c.sp_a1 : null)
    };
  }

  return { normalized: N };
}

/* ============================================================================
   BRANCH COMPUTATIONS
   ============================================================================ */
function modsFrom(input) {
  return {
    prior_refractive_surgery: input.prior_refractive_surgery || null,
    keratoconus_ectasia: !!input.keratoconus_ectasia,
    corneal_edema: !!input.corneal_edema,
    significant_dystrophy_or_scar: !!input.significant_dystrophy_or_scar
  };
}

function modifierFlags(mods, scope) {
  const flags = [];
  if (mods.prior_refractive_surgery) {
    if (scope === 'core') flags.push(flag('post_refractive_surgery_invalid_linear', 'core'));
    else flags.push(flag('post_refractive_surgery_device_interpretation_limited', scope));
  }
  if (mods.keratoconus_ectasia) flags.push(flag('keratoconus_altered_biomechanics', scope));
  if (mods.corneal_edema) flags.push(flag('corneal_edema_acute', scope));
  if (mods.significant_dystrophy_or_scar) flags.push(flag('dystrophy_or_scar_localized', scope));
  return flags;
}

function alwaysOnFlags() {
  return [
    flag('experimental_module', 'module'),
    flag('biomechanics_partially_assessed', 'module')
  ];
}

function buildInputEcho(N) {
  // N is the NORMALIZED input. The echo is a faithful, validated reproducibility
  // snapshot — every field has already been type-checked and normalized upstream.
  return {
    device_branch: N.device_branch,
    gat_iop: N.gat_iop,
    cct: N.cct,
    measurement_identity: {
      eye: N.measurement_identity.eye,
      encounter_id: N.measurement_identity.encounter_id
    },
    temporal: {
      clinician_confirmation: N.clinician_confirmation,
      shared_encounter_id: N.shared_encounter_id,
      gat_timestamp: N.gat_timestamp,
      ora_timestamp: N.ora_timestamp,
      corvis_timestamp: N.corvis_timestamp
    },
    modifiers: {
      prior_refractive_surgery: N.prior_refractive_surgery,
      keratoconus_ectasia: N.keratoconus_ectasia,
      corneal_edema: N.corneal_edema,
      significant_dystrophy_or_scar: N.significant_dystrophy_or_scar
    },
    ora_inputs: N.ora_inputs ? {
      iopcc: N.ora_inputs.iopcc,
      ch: N.ora_inputs.ch,
      selected_waveform_score: N.ora_inputs.selected_waveform_score,
      measurement_count: N.ora_inputs.measurement_count,
      iopg: N.ora_inputs.iopg,
      crf: N.ora_inputs.crf,
      provenance_attestation: {
        values_from_same_device_result_confirmed: N.ora_inputs.provenance_attestation.values_from_same_device_result_confirmed,
        basis: N.ora_inputs.provenance_attestation.basis,
        reading_id: N.ora_inputs.provenance_attestation.reading_id
      }
    } : null,
    corvis_inputs: N.corvis_inputs ? {
      biop: N.corvis_inputs.biop,
      corvis_quality_raw: N.corvis_inputs.corvis_quality_raw,
      ssi: N.corvis_inputs.ssi,
      sp_a1: N.corvis_inputs.sp_a1
    } : null,
    ora_metadata: {
      device_generation: N.ora_metadata.device_generation,
      software_version: N.ora_metadata.software_version
    },
    corvis_metadata: {
      software_version: N.corvis_metadata.software_version,
      ssi_version: N.corvis_metadata.ssi_version,
      reference_database: N.corvis_metadata.reference_database
    },
    clinician_documented_preference: N.clinician_documented_preference ? {
      selected_source: N.clinician_documented_preference.selected_source,
      rationale: N.clinician_documented_preference.rationale,
      timestamp: N.clinician_documented_preference.timestamp
    } : null
  };
}

function computeAdvancedORA(input) {
  const mods = modsFrom(input);
  const o = input.ora_inputs;
  const qa = assessORAQuality(o.selected_waveform_score, o.measurement_count);
  const applic = assessClinicalApplicability('ora', mods);
  const oic = deriveInterpretiveConfidence(qa.quality.level, applic.level);

  const cmp = assessComparisonContext({
    clinician_confirmation: input.clinician_confirmation,
    shared_encounter_id: input.shared_encounter_id,
    gat_timestamp: input.gat_timestamp,
    ora_timestamp: input.ora_timestamp
  });

  const delta = Math.round((o.iopcc - input.gat_iop) * 10) / 10;
  const markedDiff = Math.abs(delta) > 8;

  const flags = []
    .concat(alwaysOnFlags())
    .concat(modifierFlags(mods, 'ora'))
    .concat(modifierFlags(mods, 'core').filter(f => f.scope === 'core'));

  if (qa.quality.level === 'poor') flags.push(flag('quality_unreliable', 'ora'));
  if (qa.low_count) flags.push(flag('quality_low_count', 'ora'));

  const ch_ctx = buildCHContext(o.ch);
  if (ch_ctx.out_of_observed_range_flag) flags.push(flag('ch_out_of_observed_range', 'ora'));

  if (markedDiff && cmp.comparison_valid) flags.push(flag('marked_difference_vs_gat', 'ora_vs_gat'));
  if (markedDiff && !cmp.comparison_valid) flags.push(flag('temporal_comparison_invalid', 'ora_vs_gat'));

  const core_ref = computeCoreReference(input.gat_iop, input.cct, mods);

  const result = {
    status: 'success',
    result: {
      module_id: MODULE_ID,
      module_variant: MODULE_VARIANT,
      engine_id: 'OFTY-Gx-M1-ADV-ORA',
      algorithm_version: ALG_VERSION,
      schema_version: SCHEMA_VERSION,

      inputs: buildInputEcho(input),

      measurement_identity: {
        eye: input.measurement_identity.eye,
        encounter_id: input.measurement_identity.encounter_id || null
      },
      comparison_context: cmp,

      device_measurement: { source: 'ORA-IOPcc', value_mmhg: o.iopcc },
      comparison_with_gat: {
        gat_mmhg: input.gat_iop,
        delta_mmhg: delta,
        comparison_clinically_interpretable: cmp.comparison_valid
      },

      measurement_quality: qa.quality,
      clinical_applicability: applic,

      biomechanical_context: {
        ch_context: ch_ctx,
        additional_biomechanical_parameters: null
      },

      overall_interpretive_confidence: oic,

      branch_assessments: null,
      device_comparison: null,
      clinician_documented_preference: null,

      core_reference: core_ref,

      ora_metadata: normalizeORAMetadata(input.ora_metadata),
      corvis_metadata: null,

      logic_trace: {
        validation_rules: ['branch', 'eye_consistency', 'ranges', 'ora_provenance'],
        quality_rule: 'assessORAQuality(wfs,count) with low-count cap',
        applicability_rules: ['ora branch matrix'],
        confidence_rule: 'deterministic matrix',
        comparison_rules: ['assessComparisonContext', 'marked_difference_vs_gat>8 requires valid comparison']
      },

      model: buildModel(),

      downstream: { eligibility: 'context_only', eligible_for_target_comparison: false },

      caution_flags: dedupeFlags(flags)
    }
  };
  return result;
}

function computeAdvancedCorvis(input) {
  const mods = modsFrom(input);
  const c = input.corvis_inputs;
  const qlevel = normalizeCorvisQuality(c.corvis_quality_raw === undefined ? null : c.corvis_quality_raw);
  const quality = {
    level: qlevel,
    raw_device_status: (c.corvis_quality_raw === undefined ? null : c.corvis_quality_raw),
    quality_inputs: { quality_mapping_version: MAPPING_VERSION }
  };
  const applic = assessClinicalApplicability('corvis', mods);
  const oic = deriveInterpretiveConfidence(quality.level, applic.level);

  const cmp = assessComparisonContext({
    clinician_confirmation: input.clinician_confirmation,
    shared_encounter_id: input.shared_encounter_id,
    gat_timestamp: input.gat_timestamp,
    corvis_timestamp: input.corvis_timestamp
  });

  const delta = Math.round((c.biop - input.gat_iop) * 10) / 10;
  const markedDiff = Math.abs(delta) > 8;

  const flags = []
    .concat(alwaysOnFlags())
    .concat(modifierFlags(mods, 'corvis'))
    .concat(modifierFlags(mods, 'core').filter(f => f.scope === 'core'));

  if (quality.level === 'poor') flags.push(flag('quality_unreliable', 'corvis'));
  if (quality.level === 'unknown') flags.push(flag('quality_unknown', 'corvis'));

  if (markedDiff && cmp.comparison_valid) flags.push(flag('marked_difference_vs_gat', 'corvis_vs_gat'));
  if (markedDiff && !cmp.comparison_valid) flags.push(flag('temporal_comparison_invalid', 'corvis_vs_gat'));

  const core_ref = computeCoreReference(input.gat_iop, input.cct, mods);
  const addBio = buildAdditionalBiomech(
    c.ssi, c.sp_a1,
    input.corvis_metadata.reference_database
  );

  return {
    status: 'success',
    result: {
      module_id: MODULE_ID,
      module_variant: MODULE_VARIANT,
      engine_id: 'OFTY-Gx-M1-ADV-CORVIS',
      algorithm_version: ALG_VERSION,
      schema_version: SCHEMA_VERSION,

      inputs: buildInputEcho(input),

      measurement_identity: {
        eye: input.measurement_identity.eye,
        encounter_id: input.measurement_identity.encounter_id || null
      },
      comparison_context: cmp,

      device_measurement: { source: 'Corvis-bIOP', value_mmhg: c.biop },
      comparison_with_gat: {
        gat_mmhg: input.gat_iop,
        delta_mmhg: delta,
        comparison_clinically_interpretable: cmp.comparison_valid
      },

      measurement_quality: quality,
      clinical_applicability: applic,

      biomechanical_context: {
        ch_context: null,
        additional_biomechanical_parameters: addBio
      },

      overall_interpretive_confidence: oic,

      branch_assessments: null,
      device_comparison: null,
      clinician_documented_preference: null,

      core_reference: core_ref,

      ora_metadata: null,
      corvis_metadata: normalizeCorvisMetadata(input.corvis_metadata),

      logic_trace: {
        validation_rules: ['branch', 'eye_consistency', 'ranges'],
        quality_rule: 'normalizeCorvisQuality whitelist v0.1',
        applicability_rules: ['corvis branch matrix'],
        confidence_rule: 'deterministic matrix',
        comparison_rules: ['assessComparisonContext', 'marked_difference_vs_gat>8 requires valid comparison']
      },

      model: buildModel(),

      downstream: { eligibility: 'context_only', eligible_for_target_comparison: false },

      caution_flags: dedupeFlags(flags)
    }
  };
}

function computeAdvancedBoth(input) {
  const mods = modsFrom(input);
  const o = input.ora_inputs;
  const c = input.corvis_inputs;

  // ORA sub-assessment
  const oqa = assessORAQuality(o.selected_waveform_score, o.measurement_count);
  const oApplic = assessClinicalApplicability('ora', mods);
  const oOIC = deriveInterpretiveConfidence(oqa.quality.level, oApplic.level);
  const ch_ctx = buildCHContext(o.ch);

  // Corvis sub-assessment
  const cQLevel = normalizeCorvisQuality(c.corvis_quality_raw === undefined ? null : c.corvis_quality_raw);
  const cQuality = {
    level: cQLevel,
    raw_device_status: (c.corvis_quality_raw === undefined ? null : c.corvis_quality_raw),
    quality_inputs: { quality_mapping_version: MAPPING_VERSION }
  };
  const cApplic = assessClinicalApplicability('corvis', mods);
  const cOIC = deriveInterpretiveConfidence(cQuality.level, cApplic.level);
  const addBio = buildAdditionalBiomech(
    c.ssi, c.sp_a1,
    input.corvis_metadata.reference_database
  );

  // comparison context per pair
  const ctxGatOra = assessComparisonContext({
    clinician_confirmation: input.clinician_confirmation,
    shared_encounter_id: input.shared_encounter_id,
    gat_timestamp: input.gat_timestamp, ora_timestamp: input.ora_timestamp
  });
  const ctxGatCorvis = assessComparisonContext({
    clinician_confirmation: input.clinician_confirmation,
    shared_encounter_id: input.shared_encounter_id,
    gat_timestamp: input.gat_timestamp, corvis_timestamp: input.corvis_timestamp
  });
  const ctxOraCorvis = assessComparisonContext({
    clinician_confirmation: input.clinician_confirmation,
    shared_encounter_id: input.shared_encounter_id,
    ora_timestamp: input.ora_timestamp, corvis_timestamp: input.corvis_timestamp
  });

  const comparability = {
    gat_vs_ora: ctxGatOra.comparison_valid ? true : (ctxGatOra.basis === 'timestamps_only' ? false : false),
    gat_vs_corvis: ctxGatCorvis.comparison_valid ? true : false,
    ora_vs_corvis: ctxOraCorvis.comparison_valid ? true : false
  };

  const diff = Math.round(Math.abs(o.iopcc - c.biop) * 10) / 10;
  const interpretability = crossDeviceInterpretability(oOIC, cOIC, comparability.ora_vs_corvis);

  const flags = [].concat(alwaysOnFlags());
  // modifier flags appear per device scope + core
  flags.push(...modifierFlags(mods, 'ora'));
  flags.push(...modifierFlags(mods, 'corvis'));
  flags.push(...modifierFlags(mods, 'core').filter(f => f.scope === 'core'));

  if (oqa.quality.level === 'poor') flags.push(flag('quality_unreliable', 'ora'));
  if (oqa.low_count) flags.push(flag('quality_low_count', 'ora'));
  if (ch_ctx.out_of_observed_range_flag) flags.push(flag('ch_out_of_observed_range', 'ora'));
  if (cQuality.level === 'poor') flags.push(flag('quality_unreliable', 'corvis'));
  if (cQuality.level === 'unknown') flags.push(flag('quality_unknown', 'corvis'));

  const review = diff > 3;
  if (review && comparability.ora_vs_corvis === true) flags.push(flag('cross_device_difference', 'cross_device'));
  if (comparability.ora_vs_corvis !== true) flags.push(flag('temporal_comparison_invalid', 'cross_device'));

  // Dynamic interpretation text (bug 3 fix): never claim a difference that does not exist
  let interpretationText;
  if (comparability.ora_vs_corvis !== true) {
    interpretationText = 'Numerical difference shown; clinical comparison not established.';
  } else if (review) {
    interpretationText = 'Cross-device difference exceeds the OFTY review threshold.';
  } else {
    interpretationText = 'No marked cross-device difference detected.';
  }

  const core_ref = computeCoreReference(input.gat_iop, input.cct, mods);

  return {
    status: 'success',
    result: {
      module_id: MODULE_ID,
      module_variant: MODULE_VARIANT,
      engine_id: 'OFTY-Gx-M1-ADV-BOTH',
      algorithm_version: ALG_VERSION,
      schema_version: SCHEMA_VERSION,

      inputs: buildInputEcho(input),

      measurement_identity: {
        eye: input.measurement_identity.eye,
        encounter_id: input.measurement_identity.encounter_id || null
      },
      comparison_context: {
        basis: ctxOraCorvis.basis,
        comparison_valid: ctxOraCorvis.comparison_valid,
        gat_timestamp: input.gat_timestamp || null,
        ora_timestamp: input.ora_timestamp || null,
        corvis_timestamp: input.corvis_timestamp || null
      },

      device_measurement: null,
      comparison_with_gat: null,
      measurement_quality: null,
      clinical_applicability: null,
      overall_interpretive_confidence: null,

      biomechanical_context: {
        ch_context: null,
        additional_biomechanical_parameters: null
      },

      branch_assessments: {
        ora: {
          value_mmhg: o.iopcc,
          measurement_quality: oqa.quality,
          clinical_applicability: oApplic,
          biomechanical_context: { ch_context: ch_ctx, additional_biomechanical_parameters: null },
          overall_interpretive_confidence: oOIC
        },
        corvis: {
          value_mmhg: c.biop,
          measurement_quality: cQuality,
          clinical_applicability: cApplic,
          biomechanical_context: { ch_context: null, additional_biomechanical_parameters: addBio },
          overall_interpretive_confidence: cOIC
        }
      },

      device_comparison: {
        absolute_difference_mmhg: diff,
        numerical_threshold_exceeded: review,
        threshold_provenance: 'OFTY design-derived review threshold',
        interpretation: interpretationText,
        comparison_clinically_interpretable: comparability.ora_vs_corvis === true,
        cross_device_comparison_interpretability: interpretability,
        comparability: comparability
      },

      clinician_documented_preference: normalizeClinicianPreference(input.clinician_documented_preference),

      core_reference: core_ref,

      ora_metadata: normalizeORAMetadata(input.ora_metadata),
      corvis_metadata: normalizeCorvisMetadata(input.corvis_metadata),

      logic_trace: {
        validation_rules: ['branch', 'eye_consistency', 'ranges', 'ora_provenance', 'both_completeness'],
        quality_rule: 'per-branch quality assessment',
        applicability_rules: ['ora + corvis branch matrices'],
        confidence_rule: 'per-branch deterministic matrix; cross-device worst-of',
        comparison_rules: ['per-pair comparability', 'cross_device_difference>3 requires valid ora_vs_corvis']
      },

      model: buildModel(),

      downstream: { eligibility: 'context_only', eligible_for_target_comparison: false },

      caution_flags: dedupeFlags(flags)
    }
  };
}

/* ============================================================================
   TOP-LEVEL DISPATCHER
   ============================================================================ */
function computeM1Advanced(input) {
  const vr = validateAndNormalizeInput(input);
  if (vr.failure) return vr.failure;
  const N = vr.normalized;

  switch (N.device_branch) {
    case 'ora':    return computeAdvancedORA(N);
    case 'corvis': return computeAdvancedCorvis(N);
    case 'both':   return computeAdvancedBoth(N);
    default:
      return failValidation(engineIdForBranch(N.device_branch), 'INVALID_DEVICE_BRANCH', 'Unhandled branch.');
  }
}

/* ── exports (pure, no IO) ───────────────────────────────────────────────── */
module.exports = {
  computeM1Advanced,
  // exposed for unit-level tests
  normalizeCorvisQuality,
  assessORAQuality,
  assessClinicalApplicability,
  deriveInterpretiveConfidence,
  assessComparisonContext,
  crossDeviceInterpretability,
  CONSTANTS: { ALG_VERSION, SCHEMA_VERSION, MAPPING_VERSION, MODULE_ID, MODULE_VARIANT }
};
