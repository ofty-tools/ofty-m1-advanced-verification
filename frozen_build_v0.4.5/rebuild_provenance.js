// rebuild_provenance.js
// Honest pre/post-rebuild provenance for the 9 frozen artifacts.
// Captures a TRUE pre_rebuild snapshot, runs the frozen esbuild command,
// captures a TRUE post_rebuild snapshot, and writes a 3-way comparison report.
// No clinical logic touched; this only hashes files and invokes esbuild.
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

const authority = JSON.parse(fs.readFileSync('frozen_hashes_dossier_s3.json', 'utf8'));
const FROZEN = Object.keys(authority.sha256);

function sha(f){ return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }
function snap(){ const o={}; for(const f of FROZEN){ o[f]={hash:sha(f),bytes:fs.statSync(f).size}; } return o; }
function bundleSha(){ return fs.existsSync('m1_advanced_bundle.js') ? sha('m1_advanced_bundle.js') : null; }

// ── TRUE pre-rebuild (captured immediately before build) ──
const pre = { phase:'pre_rebuild', captured_utc:new Date().toISOString(), frozen:snap(), bundle_sha256:bundleSha() };
fs.writeFileSync('frozen_snapshot_pre_rebuild.json', JSON.stringify(pre,null,2));

// ── run the frozen build command ──
const BUILD_CMD = 'esbuild m1_advanced_browser_entry.js --bundle --format=iife --global-name=M1ADV --target=es2020 --outfile=m1_advanced_bundle.js';
execSync('./node_modules/.bin/' + BUILD_CMD, { stdio:'pipe' });

// ── TRUE post-rebuild (captured immediately after build) ──
const post = { phase:'post_rebuild', captured_utc:new Date().toISOString(), frozen:snap(), bundle_sha256:bundleSha() };
fs.writeFileSync('frozen_snapshot_post_rebuild.json', JSON.stringify(post,null,2));

// ── three-way comparison ──
function cmpToAuthority(s){
  const rows=[]; let all=true;
  for(const f of FROZEN){
    const exp=authority.sha256[f], got=s.frozen[f];
    const hm=got.hash===exp.hash, bm=got.bytes===exp.bytes;
    if(!hm||!bm) all=false;
    rows.push({file:f,hash_match:hm,bytes_match:bm});
  }
  return {all_match:all, rows};
}
function cmpPrePost(){
  let all=true; const rows=[];
  for(const f of FROZEN){
    const same = pre.frozen[f].hash===post.frozen[f].hash && pre.frozen[f].bytes===post.frozen[f].bytes;
    if(!same) all=false;
    rows.push({file:f,unchanged:same});
  }
  return {all_unchanged:all, rows};
}

const a = cmpToAuthority(pre);
const b = cmpToAuthority(post);
const c = cmpPrePost();
const bundleDeterministic = pre.bundle_sha256 && post.bundle_sha256 && pre.bundle_sha256===post.bundle_sha256;

const report = {
  report:'M1 ADVANCED — REBUILD PROVENANCE (3-way)',
  authority_source:'frozen_hashes_dossier_s3.json (dossier §3, verbatim)',
  build_command: BUILD_CMD,
  pre_rebuild_utc: pre.captured_utc,
  post_rebuild_utc: post.captured_utc,
  comparison_a_pre_vs_dossier:  { all_match: a.all_match, detail: a.rows },
  comparison_b_post_vs_dossier: { all_match: b.all_match, detail: b.rows },
  comparison_c_pre_vs_post:     { all_unchanged: c.all_unchanged, detail: c.rows },
  bundle_pre_sha256:  pre.bundle_sha256,
  bundle_post_sha256: post.bundle_sha256,
  bundle_rebuild_bit_identical: bundleDeterministic,
  overall_pass: a.all_match && b.all_match && c.all_unchanged
};
fs.writeFileSync('rebuild_provenance_report.json', JSON.stringify(report,null,2));

console.log('═══════════════════════════════════════════════');
console.log('  REBUILD PROVENANCE (3-way)');
console.log('═══════════════════════════════════════════════');
console.log('  pre_rebuild_utc:  ' + pre.captured_utc);
console.log('  post_rebuild_utc: ' + post.captured_utc);
console.log('  (a) pre  vs dossier  : ' + (a.all_match ? '9/9 OK ✓' : 'MISMATCH ✗'));
console.log('  (b) post vs dossier  : ' + (b.all_match ? '9/9 OK ✓' : 'MISMATCH ✗'));
console.log('  (c) pre  vs post     : ' + (c.all_unchanged ? '9/9 unchanged ✓' : 'CHANGED ✗'));
console.log('  bundle bit-identical : ' + (bundleDeterministic ? 'YES ✓' : 'NO ✗'));
console.log('  overall: ' + (report.overall_pass ? 'PASS ✓' : 'FAIL ✗'));
console.log('═══════════════════════════════════════════════');
if(!report.overall_pass) process.exit(1);
