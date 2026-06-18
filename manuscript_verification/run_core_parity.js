'use strict';
/* ============================================================================
   OFTY M1 Advanced — Core-parity verification (GAT x CCT grid)
   Compares, for the no-modifier (standard-applicability) domain:
     (a) the Advanced engine's embedded Core reference  -> core_reference.value_mmhg (RAW)
     (b) the deployed frozen Core (OFTY-Gx-M1 v1.0.0) computeM1_IOP_CCT (RAW)
   Both implementations are EXECUTED (not re-transcribed). Tool #1's function is
   extracted verbatim from ofty-tool-1.html at runtime.
   ========================================================================== */
const fs = require('fs');
const crypto = require('crypto');
const E = require('./m1_advanced_engine.js');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// --- Extract the REAL Tool #1 Core function from the HTML (auditable) -------
const enginePath = './m1_advanced_engine.js';
const schemaPath = './m1_advanced_schema.json';
const tool1Path  = './ofty-tool-1.html';
const html = fs.readFileSync(tool1Path, 'utf8');
const startIdx = html.indexOf('function computeM1_IOP_CCT');
if (startIdx < 0) throw new Error('Tool #1 computeM1_IOP_CCT not found in HTML');
let depth = 0, end = -1;
for (let j = html.indexOf('{', startIdx); j < html.length; j++) {
  const ch = html[j];
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
}
const fnText = html.slice(startIdx, end);
const coreSnippetSha = sha256(Buffer.from(fnText, 'utf8'));

// version string of frozen Core, read from the same snippet's context
const verMatch = html.match(/var\s+M1_VERSION\s*=\s*'([^']+)'/);
const coreVersion = verMatch ? verMatch[1] : 'unknown';

// The function references the module-level M1_VERSION const (used only in its
// returned object). Provide Tool #1's own value so the executed code is faithful.
const tool1Core = (new Function(
  'var M1_VERSION = ' + JSON.stringify(coreVersion) + ';\n' + fnText + '\nreturn computeM1_IOP_CCT;'))();

// --- Drive the REAL Advanced engine to obtain core_reference.value_mmhg -----
function engineCore(gat, cct) {
  const out = E.computeM1Advanced({
    device_branch: 'ora',
    measurement_identity: { eye: 'OD' },
    gat_iop: gat, cct: cct,
    keratoconus_ectasia: false, corneal_edema: false,
    significant_dystrophy_or_scar: false, prior_refractive_surgery: null,
    clinician_confirmation: false,
    ora_inputs: {
      iopcc: 18.2, ch: 10, selected_waveform_score: 7.5, measurement_count: 4,
      provenance_attestation: { values_from_same_device_result_confirmed: true, basis: 'single_reading' }
    }
  });
  if (out.status !== 'success') return { ok: false, failure: out.failure };
  return { ok: true, value: out.result.core_reference.value_mmhg,
           applicability: out.result.core_reference.applicability };
}

// --- Grid definition (integers; fully reproducible) ------------------------
const GAT = { min: 5, max: 60, step: 1 };   // hard range [5,60]
const CCT = { min: 250, max: 750, step: 1 }; // hard range [250,750]
const TOLERANCE = 0; // exact IEEE-754 equality required (raw, unrounded)

let total = 0, mismatches = 0, maxAbsDiff = 0, engineFailures = 0;
const mismatchSamples = [];
const t0 = Date.now();
for (let g = GAT.min; g <= GAT.max; g += GAT.step) {
  for (let c = CCT.min; c <= CCT.max; c += CCT.step) {
    total++;
    const e = engineCore(g, c);
    const t1 = tool1Core(g, c).outputs.adjusted_iop_mmhg;
    if (!e.ok) {
      engineFailures++; mismatches++;
      if (mismatchSamples.length < 25) mismatchSamples.push({ gat: g, cct: c, reason: 'engine_failure', failure: e.failure });
      continue;
    }
    if (e.applicability !== 'standard') { // guard: grid must stay in standard domain
      mismatches++;
      if (mismatchSamples.length < 25) mismatchSamples.push({ gat: g, cct: c, reason: 'unexpected_applicability', applicability: e.applicability });
      continue;
    }
    const diff = Math.abs(e.value - t1);
    if (diff > maxAbsDiff) maxAbsDiff = diff;
    const equal = (TOLERANCE === 0) ? (e.value === t1) : (diff <= TOLERANCE);
    if (!equal) {
      mismatches++;
      if (mismatchSamples.length < 25) mismatchSamples.push({ gat: g, cct: c, engine_value: e.value, core_value: t1, abs_diff: diff });
    }
  }
}
const elapsedMs = Date.now() - t0;

const report = {
  report: 'OFTY M1 Advanced — Core-reference parity (GAT x CCT grid)',
  generated_utc: new Date().toISOString(),
  comparison: {
    a_advanced_engine: 'm1_advanced_engine.js :: core_reference.value_mmhg (RAW, unrounded)',
    b_frozen_core: 'ofty-tool-1.html :: computeM1_IOP_CCT(pio,cct).outputs.adjusted_iop_mmhg (RAW, unrounded)',
    formula: 'value = gat_iop - ((cct - 540) / 25)   [Ehlers-based linear; ref 540 um, 25 um/mmHg]',
    domain: 'no-modifier inputs only (core applicability = standard); not_applicable/limited domains excluded by design (Tool #1 has no modifier concept)',
    method: 'both implementations executed (Tool #1 function extracted verbatim from HTML and run); no re-transcription'
  },
  advanced_module_version: 'OFTY M1 Advanced Browser v0.4.1 (engine 0.4.3-experimental; JSON Schema contract M1-ADV-SCHEMA-1.3; final technical freeze v0.4.5)',
  core_version_used: 'OFTY-Gx-M1 v' + coreVersion + ' (deployed Core, Tool #1)',
  gat_grid: { min: GAT.min, max: GAT.max, step: GAT.step, unit: 'mmHg', count: Math.floor((GAT.max - GAT.min) / GAT.step) + 1 },
  cct_grid: { min: CCT.min, max: CCT.max, step: CCT.step, unit: 'um', count: Math.floor((CCT.max - CCT.min) / CCT.step) + 1 },
  total_grid_points_tested: total,
  mismatch_count: mismatches,
  engine_failure_count: engineFailures,
  max_absolute_difference_mmhg: maxAbsDiff,
  tolerance_rule: (TOLERANCE === 0) ? 'exact IEEE-754 equality (tolerance = 0)' : ('abs diff <= ' + TOLERANCE),
  all_match: (mismatches === 0),
  mismatch_samples: mismatchSamples,
  runtime_environment: {
    node: process.version,
    platform: process.platform + ' ' + process.arch,
    elapsed_ms: elapsedMs
  },
  artifact_hashes_sha256: {
    'm1_advanced_engine.js': sha256(fs.readFileSync(enginePath)),
    'm1_advanced_schema.json': sha256(fs.readFileSync(schemaPath)),
    'ofty-tool-1.html': sha256(fs.readFileSync(tool1Path)),
    'tool1_computeM1_IOP_CCT_snippet': coreSnippetSha
  }
};
fs.writeFileSync('core_parity_report.json', JSON.stringify(report, null, 2));
console.log('grid points:', total, '| mismatches:', mismatches, '| max abs diff:', maxAbsDiff,
            '| all_match:', report.all_match, '| core v' + coreVersion);
