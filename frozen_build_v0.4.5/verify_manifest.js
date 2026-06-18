// verify_manifest.js
// Manifest-CONTRACT validator (not just a hash checker).
//
// Verifies, with non-zero exit on ANY failure:
//   1. Required top-level contract fields present + correct values.
//   2. Required nested version fields present + internally consistent.
//   3. Every file in sha256 / frozen_reports_sha256 / frozen_test_sources_sha256
//      exists and matches BOTH its declared hash AND declared byte size.
//   4. The four frozen REPORT JSON hashes match the supervisor-pinned values.
//   5. The test-SCRIPT block is named correctly and is disjoint from reports.
//   6. Manifest engine_algorithm_version / schema_version == the LIVE bundle's
//      M1ADV.CONSTANTS (loaded from the built IIFE, browser-style).
//
// Touches no clinical logic. Pure audit.

'use strict';

const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

let pass = 0, fail = 0;
const log = [];
function check(name, cond, detail) {
  if (cond) { pass++; log.push('  \u2713 ' + name + (detail ? ' :: ' + detail : '')); }
  else      { fail++; log.push('  \u2717 ' + name + (detail ? ' :: ' + detail : '')); }
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const m = JSON.parse(fs.readFileSync('build.manifest.json', 'utf8'));

// 1. Required top-level contract fields (UI Spec window.load smoke test)
const requiredTop = {
  freeze_version: 'v0.4.5',
  engine_algorithm_version: '0.4.3-experimental',
  schema_version: 'M1-ADV-SCHEMA-1.3',
  ui_specification_version: 'v0.4.1'
};
for (const [k, v] of Object.entries(requiredTop)) {
  check('top-level ' + k + ' present & correct', m[k] === v, m[k]);
}

// 2. Nested version block present & consistent with top-level
check('versions block present', m.versions && typeof m.versions === 'object');
if (m.versions) {
  check('versions.algorithm == top engine_algorithm_version',
    m.versions.algorithm === m.engine_algorithm_version, m.versions.algorithm);
  check('versions.schema == top schema_version',
    m.versions.schema === m.schema_version, m.versions.schema);
  check('versions.ui_specification == top ui_specification_version',
    m.versions.ui_specification === m.ui_specification_version, m.versions.ui_specification);
  check('versions.clinical_specification == freeze_version',
    m.versions.clinical_specification === m.freeze_version, m.versions.clinical_specification);
  check('versions.mapping == corvis-map-0.1', m.versions.mapping === 'corvis-map-0.1', m.versions.mapping);
}

// 3. Required environment + build fields
for (const k of ['node', 'esbuild', 'ajv', 'ajv_formats', 'os']) {
  check('environment.' + k + ' present', m.environment && !!m.environment[k], m.environment && m.environment[k]);
}
check('build.command is the frozen esbuild command',
  m.build && m.build.command ===
  'esbuild m1_advanced_browser_entry.js --bundle --format=iife --global-name=M1ADV --target=es2020 --outfile=m1_advanced_bundle.js',
  m.build && m.build.command);
for (const k of ['format', 'global_name', 'target', 'build_utc']) {
  check('build.' + k + ' present', m.build && !!m.build[k], m.build && m.build[k]);
}

// 4. Hash + byte verification for every declared file block
function verifyBlock(blockName, allowBytes) {
  const block = m[blockName];
  check(blockName + ' present', block && typeof block === 'object');
  if (!block) return;
  for (const [file, rec] of Object.entries(block)) {
    const expectedHash = (typeof rec === 'string') ? rec : rec.hash;
    let live = null, bytes = null, present = true;
    try { live = sha256(file); bytes = fs.statSync(file).size; }
    catch (e) { present = false; }
    check('[' + blockName + '] ' + file + ' exists', present);
    if (present) {
      check('[' + blockName + '] ' + file + ' hash matches', live === expectedHash,
        live === expectedHash ? '' : ('manifest=' + expectedHash + ' live=' + live));
      if (allowBytes && typeof rec === 'object' && 'bytes' in rec) {
        check('[' + blockName + '] ' + file + ' bytes match', bytes === rec.bytes,
          bytes === rec.bytes ? '' : ('manifest=' + rec.bytes + ' live=' + bytes));
      }
    }
  }
}
verifyBlock('sha256', true);
verifyBlock('frozen_reports_sha256', true);
verifyBlock('frozen_test_sources_sha256', true);

// 5. Reports vs test-sources: correct naming & disjoint
const PINNED_REPORTS = {
  'm1_advanced_test_report.json':         'b6cf9f9a2d489ed9c9c794dd37e457de2913d72da34a4732d70297cf43aff6ac',
  'm1_advanced_storage_test_report.json': '5bceffb5356dccc2757b7016efa6124d9e787e1f3a7791a687f2fc53af64a99e',
  'm1_advanced_fuzz_report.json':         'c1c7a2d54ecaaf74baa1e29e3562452d64cca8cf8dbcae9e1d2583c2bf0d4ed6',
  'm1_advanced_version_sync_report.json': '83cbf5233bf4083af2ffa47edcf822c97e85b379fc2d752773035949e372c50d'
};
const repBlock = m.frozen_reports_sha256 || {};
for (const [file, pinned] of Object.entries(PINNED_REPORTS)) {
  const rec = repBlock[file];
  const declared = rec && (typeof rec === 'string' ? rec : rec.hash);
  check('frozen report present & pinned hash: ' + file, declared === pinned,
    declared === pinned ? '' : ('declared=' + declared));
}
check('frozen_reports_sha256 holds exactly the 4 report JSONs',
  JSON.stringify(Object.keys(repBlock).sort()) === JSON.stringify(Object.keys(PINNED_REPORTS).sort()),
  Object.keys(repBlock).join(','));
const srcBlock = m.frozen_test_sources_sha256 || {};
const overlap = Object.keys(srcBlock).filter(k => k in repBlock);
check('reports and test-sources blocks are disjoint', overlap.length === 0, 'overlap=' + overlap.join(','));
check('no .js script is mislabeled inside frozen_reports_sha256',
  Object.keys(repBlock).every(k => k.endsWith('.json')),
  Object.keys(repBlock).filter(k => !k.endsWith('.json')).join(','));

// 6. Manifest versions == LIVE bundle CONSTANTS (browser-style load)
try {
  const code = fs.readFileSync('m1_advanced_bundle.js', 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'm1_advanced_bundle.js' });
  const C = sandbox.M1ADV && sandbox.M1ADV.CONSTANTS;
  check('bundle exposes M1ADV.CONSTANTS', !!C);
  if (C) {
    check('manifest engine_algorithm_version == bundle ALG_VERSION',
      m.engine_algorithm_version === C.ALG_VERSION, C.ALG_VERSION);
    check('manifest schema_version == bundle SCHEMA_VERSION',
      m.schema_version === C.SCHEMA_VERSION, C.SCHEMA_VERSION);
  }
} catch (e) {
  check('bundle loads for CONSTANTS correspondence', false, e.message);
}

console.log('\u2550'.repeat(47));
console.log('  M1 ADVANCED \u2014 MANIFEST CONTRACT VALIDATOR');
console.log('\u2550'.repeat(47));
console.log(log.join('\n'));
console.log('\u2500'.repeat(47));
console.log('  Passed: ' + pass + '   Failed: ' + fail);
console.log('  Contract valid: ' + (fail === 0 ? 'YES \u2713' : 'NO \u2717'));
console.log('\u2550'.repeat(47));
if (fail > 0) process.exit(1);
