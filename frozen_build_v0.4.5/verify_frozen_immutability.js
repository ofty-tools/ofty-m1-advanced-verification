// verify_frozen_immutability.js
// Artifact-backed proof that the 9 frozen artifacts are byte-identical to the
// SHA-256 manifest in dossier §3 — at the moment this script runs.
//
// It compares live hashes against frozen_hashes_dossier_s3.json (the authority,
// copied verbatim from the dossier) and writes frozen_immutability_report.json.
// Exit code is non-zero on ANY mismatch (fail-fast).
//
// This script touches NO clinical logic. It only hashes files.

'use strict';

const fs = require('fs');
const crypto = require('crypto');

const AUTHORITY = 'frozen_hashes_dossier_s3.json';

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const authority = JSON.parse(fs.readFileSync(AUTHORITY, 'utf8'));

const rows = [];
let allMatch = true;

for (const [file, expected] of Object.entries(authority.sha256)) {
  let live = null, bytes = null, present = true;
  try {
    live = sha256(file);
    bytes = fs.statSync(file).size;
  } catch (e) {
    present = false;
    allMatch = false;
  }
  const hashMatch  = present && live === expected.hash;
  const bytesMatch = present && bytes === expected.bytes;
  if (!hashMatch || !bytesMatch) allMatch = false;
  rows.push({
    file,
    present,
    expected_hash: expected.hash,
    live_hash: live,
    hash_match: hashMatch,
    expected_bytes: expected.bytes,
    live_bytes: bytes,
    bytes_match: bytesMatch
  });
}

const report = {
  report: 'M1 ADVANCED — FROZEN ARTIFACT IMMUTABILITY',
  authority_file: AUTHORITY,
  authority_source: 'dossier §3 SHA-256 manifest (verbatim)',
  generated_utc: new Date().toISOString(),
  artifact_count: rows.length,
  all_byte_identical: allMatch,
  results: rows
};

fs.writeFileSync('frozen_immutability_report.json', JSON.stringify(report, null, 2));

console.log('═══════════════════════════════════════════════');
console.log('  FROZEN ARTIFACT IMMUTABILITY CHECK');
console.log('═══════════════════════════════════════════════');
for (const r of rows) {
  const ok = r.hash_match && r.bytes_match;
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + r.file +
    (ok ? '' : '  [hash_match=' + r.hash_match + ' bytes_match=' + r.bytes_match +
      ' present=' + r.present + ']'));
}
console.log('───────────────────────────────────────────────');
console.log('  Artifacts: ' + rows.length + '   All byte-identical: ' +
  (allMatch ? 'YES ✓' : 'NO ✗'));
console.log('  Report written: frozen_immutability_report.json');
console.log('═══════════════════════════════════════════════');
if (!allMatch) process.exit(1);
