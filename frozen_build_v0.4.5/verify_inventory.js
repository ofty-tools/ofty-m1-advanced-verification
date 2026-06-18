// verify_inventory.js
// Whole-tree integrity validator: checks every artifact listed in
// artifact_inventory.json against the deposited files by SHA-256 (and byte size).
//
// Properties:
//   * Reads manifest/artifact_inventory.json (or ./artifact_inventory.json, or an
//     explicit path passed as argv[2]).
//   * For each listed artifact {path, sha256, bytes?}: locates the file, computes
//     SHA-256, compares to the declared hash (and byte size if declared).
//   * NEVER writes or regenerates anything — it only compares.
//   * Exits NON-ZERO on any mismatch, missing file, or ambiguous resolution.
//
// Path resolution (flat-vs-nested tolerant):
//   The inventory records flat file names from the build directory. If a listed
//   path is not found verbatim, the file is resolved by BASENAME within the repo
//   tree (excluding node_modules and .git). If a basename matches more than one
//   deposited file, that entry FAILS as ambiguous (resolve manually).
//
// This complements verify_manifest.js (which validates the build/version CONTRACT
// against build.manifest.json). Run both: `npm run verify`.
//
// CONFIRM-BEFORE-RELYING: this script assumes the inventory exposes an array of
// artifacts at `inv.artifacts`, each with `path` and `sha256` (and optional
// `bytes`). It also accepts a top-level array, or a { path: hash } / { path:
// {sha256,bytes} } map. If your inventory schema differs, adjust `loadEntries()`.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();

// ---- locate the inventory ----
function findInventory() {
  if (process.argv[2]) return process.argv[2];
  const candidates = [
    path.join(ROOT, 'manifest', 'artifact_inventory.json'),
    path.join(ROOT, 'artifact_inventory.json')
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  console.error('FATAL: artifact_inventory.json not found (looked in ./manifest/ and ./). Pass an explicit path as the first argument.');
  process.exit(2);
}

// ---- normalise the inventory into [{path, sha256, bytes?}] ----
function loadEntries(invPath) {
  let inv;
  try { inv = JSON.parse(fs.readFileSync(invPath, 'utf8')); }
  catch (e) { console.error('FATAL: cannot parse ' + invPath + ': ' + e.message); process.exit(2); }

  let list = null;
  if (Array.isArray(inv)) list = inv;
  else if (inv && Array.isArray(inv.artifacts)) list = inv.artifacts;

  if (list) {
    return list.map(a => ({
      path: a.path || a.file || a.name,
      sha256: (a.sha256 || a.hash || a.sha || '').toLowerCase(),
      bytes: (typeof a.bytes === 'number') ? a.bytes : (typeof a.size === 'number' ? a.size : null)
    }));
  }
  // map form: { "file": "hash" } or { "file": { sha256, bytes } }
  if (inv && typeof inv === 'object') {
    const mapSource = inv.files || inv.sha256 || inv;
    return Object.entries(mapSource)
      .filter(([k, v]) => typeof v === 'string' || (v && typeof v === 'object' && (v.sha256 || v.hash)))
      .map(([k, v]) => ({
        path: k,
        sha256: (typeof v === 'string' ? v : (v.sha256 || v.hash || '')).toLowerCase(),
        bytes: (v && typeof v === 'object' && typeof v.bytes === 'number') ? v.bytes : null
      }));
  }
  console.error('FATAL: unrecognised inventory schema in ' + invPath + ' — adjust loadEntries().');
  process.exit(2);
}

// ---- build a basename -> [paths] index of the deposited tree ----
function indexTree(root) {
  const byBase = new Map();
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const b = e.name;
        if (!byBase.has(b)) byBase.set(b, []);
        byBase.get(b).push(p);
      }
    }
  })(root);
  return byBase;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// ---- main ----
const invPath = findInventory();
const entries = loadEntries(invPath);
const byBase = indexTree(ROOT);

let ok = 0, mismatch = 0, missing = 0, ambiguous = 0, skipped = 0;
const log = [];

for (const e of entries) {
  if (!e.path || !e.sha256) { skipped++; log.push('  ? SKIP (no path/sha256): ' + JSON.stringify(e)); continue; }
  // Do not self-validate the inventory file by hash (it cannot contain its own hash).
  if (path.basename(e.path) === 'artifact_inventory.json') { skipped++; log.push('  ~ SKIP (inventory self-reference): ' + e.path); continue; }

  let resolved = null;
  const verbatim = path.join(ROOT, e.path);
  if (fs.existsSync(verbatim) && fs.statSync(verbatim).isFile()) {
    resolved = verbatim;
  } else {
    const base = path.basename(e.path);
    const hits = byBase.get(base) || [];
    if (hits.length === 1) resolved = hits[0];
    else if (hits.length > 1) {
      ambiguous++;
      log.push('  \u2717 AMBIGUOUS: ' + e.path + ' -> ' + hits.map(h => path.relative(ROOT, h)).join(' | '));
      continue;
    }
  }

  if (!resolved) { missing++; log.push('  \u2717 MISSING: ' + e.path); continue; }

  const live = sha256(resolved);
  const rel = path.relative(ROOT, resolved);
  if (live !== e.sha256) {
    mismatch++;
    log.push('  \u2717 HASH MISMATCH: ' + rel + ' :: inventory=' + e.sha256 + ' live=' + live);
    continue;
  }
  if (e.bytes != null) {
    const bytes = fs.statSync(resolved).size;
    if (bytes !== e.bytes) {
      mismatch++;
      log.push('  \u2717 BYTES MISMATCH: ' + rel + ' :: inventory=' + e.bytes + ' live=' + bytes);
      continue;
    }
  }
  ok++;
  log.push('  \u2713 ' + rel);
}

console.log('='.repeat(60));
console.log('  OFTY M1 ADVANCED \u2014 INVENTORY INTEGRITY VALIDATOR');
console.log('  inventory: ' + path.relative(ROOT, invPath));
console.log('='.repeat(60));
console.log(log.join('\n'));
console.log('-'.repeat(60));
console.log('  entries=' + entries.length + '  ok=' + ok + '  mismatch=' + mismatch +
            '  missing=' + missing + '  ambiguous=' + ambiguous + '  skipped=' + skipped);
const fail = mismatch + missing + ambiguous;
console.log('  RESULT: ' + (fail === 0 ? 'ALL DEPOSITED ARTIFACTS MATCH \u2713' : 'INTEGRITY FAILURE \u2717'));
console.log('='.repeat(60));
process.exit(fail === 0 ? 0 : 1);
