# OFTY M1 Advanced — Verification & Reproducibility Repository

Reproducibility package accompanying the Journal of Medical Systems (JMS) manuscript on **OFTY M1 Advanced**, a deterministic, client-side, browser-based software layer that contextualizes heterogeneous device-derived intraocular-pressure (IOP) measurements **without fusing them**.

This repository is organised in **two levels**:

1. **`frozen_build_v0.4.5/`** — the canonical, founder-signed **frozen technical-verification package** (50-file inventory), unchanged. Build/version contract, frozen-artifact immutability, bundle/browser smoke, the formal U1–U21 acceptance suite, and the engine/storage/fuzz/version-sync test suites.
2. **`manuscript_verification/`** — a **manuscript-level addendum** containing the Core-reference parity study and the in-silico Monte Carlo v2 stress test reported in the manuscript. These artifacts are **not** part of the frozen 50-file inventory; they are provided as re-executable reproducibility material for the manuscript's headline numbers.

**All components required to reproduce the reported verification are included in this repository; no components are withheld.**

---

## Manuscript

[manuscript citation to be inserted on acceptance]

The manuscript cites this repository by **release URL, tag, and commit hash** — not by per-file checksums.

---

## What is OFTY M1 Advanced?

A **deterministic, rule-based** decision-support layer that contextualizes IOP and central corneal thickness (CCT) together with device biomechanical inputs (ORA, Corvis, or both). The clinical logic lives entirely in a **frozen engine** (`m1_advanced_engine.js`); the browser UI (`index.html`) is a thin, change-controlled presentation layer that loads the frozen, deterministic bundle and renders only what the engine returns. It does **not** emit a fused or "true" IOP.

---

## Intended use

Research and methodological demonstration of structured, reproducible interpretation of glaucoma-monitoring parameters. The tool is **experimental**; outputs are **descriptive and non-prescriptive**; clinician judgement is never replaced.

---

## Explicit non-claims

- No clinical efficacy, accuracy, validity, diagnostic/prognostic performance, or patient-benefit is claimed.
- No clinical deployment, production-readiness, or regulatory clearance is claimed.
- No ORA–Corvis interchangeability and no fused/"true" IOP (except where the engine explicitly negates it).
- No cross-browser / assistive-technology / performance claim beyond the single headless-Chromium environment actually tested.

---

## Verification at a glance (real numbers, reproduced in this repository)

### Frozen technical-verification package (`frozen_build_v0.4.5/`)
| Check | Result |
|---|---|
| Build / version contract (`verify_manifest.js`) | **72/72 PASS** |
| Frozen-core immutability (dossier §3, 9 artifacts) | **9/9 byte-identical** |
| Frozen artifacts in inventory (`frozen: true`) | **16/16 match** |
| Whole-tree inventory integrity (`verify_inventory.js`) | **49/50** (single discrepancy is a timestamped, regenerable audit report — see `REPOSITORY_READY_REPORT.md` §3) |
| Formal U1–U21 browser acceptance | **28/28 PASS · 0 console errors** |
| Engine + storage assertions | **315/315** |
| Fuzz (seed 42) | **352 inputs · 0 crashes · 0 contract failures** |
| Version-sync | **13/13** |

### Manuscript-level addendum (`manuscript_verification/`)
| Study | Result |
|---|---|
| Core-reference parity (GAT×CCT grid) | **28,056 points · 0 mismatches · 0 engine failures · max abs diff 0** |
| Monte Carlo v2 — clinical surface | **63,000 inputs · 126,000 evaluations · 0 determinism failures · 0 contract failures · 0 invariant violations · 0 failure-routing failures · 0 uncaught exceptions · all_clear = true** |
| Integration-affordance audit | **5,000 probes · 5,000 expected strict-policy deviations · 0 determinism/contract/routing/exception failures** |

---

## Repository layout

```
/README.md                      (this file)
/LICENSE                        (MIT)
/CITATION.cff
/REPOSITORY_READY_REPORT.md     (integrity report — Option A; verdict GO)
/frozen_build_v0.4.5/           (canonical 50-file frozen package, unchanged + signed inventory)
/manuscript_verification/       (Core-parity + Monte Carlo v2 addendum, re-executable)
```

---

## How to reproduce

**Frozen technical verification** (Node 22.x, Ubuntu 24.04 reference):
```bash
cd frozen_build_v0.4.5
npm ci
npx playwright install chromium
node verify_manifest.js              # 72/72 contract
node verify_frozen_immutability.js   # 9/9 byte-identical (fresh timestamp each run)
node verify_inventory.js             # 49/50 — the 1 is the timestamped report (see report §3)
npm run gate                         # build + frozen immutability + bundle smoke + manifest contract
node m1_advanced_acceptance.js       # U1–U21: 28/28 (headless Chromium)
node m1_advanced_tests.js            # engine assertions
node m1_advanced_storage_tests.js    # storage assertions
node m1_advanced_fuzz_tests.js       # 352 inputs, 0 crashes (seed 42)
node m1_advanced_version_sync_tests.js
```

**Manuscript addendum** (Core-parity + Monte Carlo v2):
```bash
cd manuscript_verification
npm ci                               # ajv 8.20.0, ajv-formats 3.0.1 (pinned)
node run_core_parity.js              # 28,056 points, 0 mismatches, max abs diff 0
node run_monte_carlo_v2.js           # 63,000 inputs / 126,000 evals (seed 42), all_clear
```
The addendum bundles byte-identical copies of the frozen engine and schema so it runs self-contained; `run_core_parity.js` also uses the deployed Core Tool #1 (`ofty-tool-1.html`).

---

## Manual UI vs integration-only boundary

The manual browser UI never emits certain payload fields; these are **integration-only** (driver-level) inputs. In particular, `shared_encounter_id` is integration-only and **unreachable from the manual form** (UI spec v0.4.1 §1.7). Under the strict comparability policy, cross-device comparability is valid **only** when the clinician explicitly confirms it; an identifier or timestamp alone never validates a comparison. The 5,000 integration-affordance probes characterise a deliberate engine design decision, **not** a defect of the clinical surface (whose strict invariant violations are 0).

---

## Verification ≠ clinical validation

The contents of this repository establish that the software behaves **as specified** and that the frozen artifacts are **byte-identical and reproducible**. They do **not** establish clinical accuracy, clinical utility, or fitness for patient care. Clinical validation has not been performed and is out of scope.

---

## Artifact integrity / checksums

- `frozen_build_v0.4.5/artifact_inventory.json` is the **founder-signed** authoritative per-file SHA-256 manifest (50 files). It is **preserved unmodified**.
- Under an integrity-preserving policy (Option A), the whole-tree check reports **49/50**: the single discrepancy is `frozen_immutability_report.json`, a **regenerable, timestamped audit report** (`frozen: false`) whose hash legitimately drifts on each run. **All 16 `frozen: true` artifacts match**, and the immutability dossier is **9/9 byte-identical**. Full disclosure in `REPOSITORY_READY_REPORT.md` §3.
- The verifiers **never regenerate checksums — they only compare.**

---

## Runtime environment

- Node.js v22.22.2 · Ubuntu 24.04 LTS
- esbuild 0.28.1 (deterministic IIFE, `--target=es2020`, `--global-name=M1ADV`)
- ajv 8.20.0 · ajv-formats 3.0.1 (JSON Schema draft 2020-12)
- Playwright 1.56.0 with Chromium (browser smoke + U1–U21 acceptance)

---

## License

MIT. See `LICENSE`.

## Citation

See `CITATION.cff`. Replace the placeholder with the published citation on acceptance.

## Contact

Andrea Ragosta, MD, FEBO — dott.andrea.ragosta@gmail.com — ORCID 0000-0002-7024-1569

## Repository tag

Release tag: **`v0.4.5-jms`**
Release: [GitHub release URL to be inserted]
Final commit: [final commit hash to be inserted]
