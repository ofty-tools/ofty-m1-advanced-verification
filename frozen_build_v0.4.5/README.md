# frozen_build_v0.4.5 — Canonical Frozen Verification Package

This folder is the **canonical, founder-signed frozen technical-verification package** for OFTY M1 Advanced (build freeze **v0.4.5**, UI v0.4.1), reproduced here **unchanged**. `artifact_inventory.json` is the founder-signed authoritative SHA-256 manifest (50 files) and is **preserved exactly as frozen**.

> For the full reproduction guide, the manuscript-level Monte Carlo / Core-parity addendum, and the integrity report, see the **repository-root `README.md`** and **`REPOSITORY_READY_REPORT.md`**.

## Package `package.json` (the 867-byte frozen build-gate package, `m1adv`)
Available npm scripts (as frozen):
```bash
npm ci
npm run build          # esbuild IIFE -> m1_advanced_bundle.js
npm run verify:frozen  # frozen-core immutability vs dossier §3  -> 9/9 byte-identical
npm run verify:manifest# build/version contract                 -> 72/72
npm run smoke:bundle   # bundle load smoke (Node vm)
npm run smoke:browser  # headless-Chromium smoke (Playwright)
npm run gate           # build + verify:frozen + smoke:bundle + verify:manifest
```
The remaining suites and the whole-tree integrity check are run directly:
```bash
node verify_inventory.js               # whole-tree SHA-256 vs artifact_inventory.json -> 49/50 (see report §3)
node m1_advanced_acceptance.js         # formal U1-U21 acceptance (headless Chromium) -> 28/28
node m1_advanced_tests.js              # engine assertions
node m1_advanced_storage_tests.js      # storage assertions
node m1_advanced_fuzz_tests.js         # 352 inputs, 0 crashes (seed 42)
node m1_advanced_version_sync_tests.js # 13/13
```

## Integrity note (Option A)
`node verify_inventory.js` reports **49/50**. The single discrepancy is `frozen_immutability_report.json` — a **regenerable, timestamped audit report** (`frozen: false`) whose SHA-256 legitimately changes on each run of `verify_frozen_immutability.js`. **All 16 `frozen: true` artifacts match**, and the immutability dossier is **9/9 byte-identical**. The founder-signed `artifact_inventory.json` is intentionally **not** modified. Full disclosure: repository-root `REPOSITORY_READY_REPORT.md` §3.

## Reports
The executed machine-readable reports are included alongside their sources (acceptance, engine/storage/fuzz/version-sync test reports, browser/bundle smoke, frozen immutability, rebuild provenance, clean-room gate). Acceptance screenshots are in `acceptance_screenshots/` and `screenshots/`.
