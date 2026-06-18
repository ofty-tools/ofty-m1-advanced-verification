/* ============================================================================
   OFTY-Gx-M1-Advanced — Version Sync Test
   Verifies that ALL files declare consistent version identifiers, so the
   freeze record's "version sync verified" claim is mechanically true.
   ============================================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const EXPECTED = {
  spec: 'v0.4.5',
  algorithm: '0.4.3-experimental',
  schema: 'M1-ADV-SCHEMA-1.3',
  engine_tests: 'M1-ADV-TESTS-1.3',
  storage_tests: 'M1-ADV-STORAGE-TESTS-1.3',
  fuzz: 'M1-ADV-FUZZ-1.3'
};

let checks = 0, failed = 0;
const failures = [];
function check(cond, msg) { checks++; if (!cond) { failed++; failures.push(msg); } }

function read(f) { return fs.readFileSync(path.join(__dirname, f), 'utf8'); }

const engine = read('m1_advanced_engine.js');
const schema = read('m1_advanced_schema.json');
const adapter = read('m1_advanced_storage_adapter.js');
const tests = read('m1_advanced_tests.js');
const storageTests = read('m1_advanced_storage_tests.js');
const fuzz = read('m1_advanced_fuzz_tests.js');

/* Engine */
check(engine.indexOf("Specification: " + EXPECTED.spec) !== -1, 'engine header spec');
check(engine.indexOf("Algorithm candidate: " + EXPECTED.algorithm) !== -1, 'engine header algorithm');
check(engine.indexOf("Schema version: " + EXPECTED.schema) !== -1, 'engine header schema');
check(engine.indexOf("const ALG_VERSION    = '" + EXPECTED.algorithm + "'") !== -1, 'engine ALG_VERSION const');
check(engine.indexOf("const SCHEMA_VERSION = '" + EXPECTED.schema + "'") !== -1, 'engine SCHEMA_VERSION const');

/* Schema */
check(schema.indexOf('"$id": "' + EXPECTED.schema + '"') !== -1, 'schema $id');
check(schema.indexOf('"const": "' + EXPECTED.algorithm + '"') !== -1, 'schema algorithm const');
check(schema.indexOf('"const": "' + EXPECTED.schema + '"') !== -1, 'schema version const');

/* Adapter */
check(adapter.indexOf("Schema version: " + EXPECTED.schema) !== -1, 'adapter header schema');

/* Engine tests */
check(tests.indexOf("Test suite version: " + EXPECTED.engine_tests) !== -1, 'engine-tests header version');
check(tests.indexOf("suite_version: '" + EXPECTED.engine_tests + "'") !== -1, 'engine-tests report version');

/* Storage tests */
check(storageTests.indexOf("suite_version: '" + EXPECTED.storage_tests + "'") !== -1, 'storage-tests report version');

/* Fuzz */
check(fuzz.indexOf("fuzz_suite_version: '" + EXPECTED.fuzz + "'") !== -1, 'fuzz report version');

const report = {
  expected: EXPECTED,
  total_checks: checks,
  passed: checks - failed,
  failed: failed,
  all_synced: failed === 0,
  failures: failures
};
fs.writeFileSync(path.join(__dirname, 'm1_advanced_version_sync_report.json'), JSON.stringify(report, null, 2));

console.log('═══════════════════════════════════════════════');
console.log('  M1 ADVANCED — VERSION SYNC REPORT');
console.log('═══════════════════════════════════════════════');
console.log('  Total checks:      ' + checks);
console.log('  Passed:            ' + (checks - failed));
console.log('  Failed:            ' + failed);
console.log('  All synced:        ' + (report.all_synced ? 'YES ✓' : 'NO ✗'));
console.log('═══════════════════════════════════════════════');
if (failed > 0) { failures.forEach(f => console.log('  • ' + f)); process.exit(1); }
