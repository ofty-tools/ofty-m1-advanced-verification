# Repository-Ready Report — OFTY M1 Advanced Verification & Reproducibility Repository

**Build:** v0.4.5  ·  **Release tag (planned):** `v0.4.5-jms`  ·  **License:** MIT
**Release URL:** [GitHub release URL to be inserted]  ·  **Final commit:** [final commit hash to be inserted]

**Verdict: GO** — under the integrity-preserving policy (Option A). The founder-signed `frozen_build_v0.4.5/artifact_inventory.json` is preserved **unmodified**; the single inventory discrepancy is declared openly below with full explanation and independent re-verification; and the manuscript-level Monte Carlo / Core-parity addendum is included and **re-executed in this repository**.

---

## 1. Integrity policy applied (Option A)

For a peer-reviewed submission we **do not edit a signed manifest to make an automated counter read 50/50**. The founder-signed `artifact_inventory.json` is preserved exactly as frozen, and the one artifact whose hash legitimately drifts is **documented** rather than re-pinned. The clinically relevant integrity — frozen engine, schema, bundle, test sources and governance documents — is intact and independently re-verifiable.

A reviewer-credible **"49/50 + here is exactly why the 1 differs + here is the 9/9 proof"** is preferred over a "50/50" obtained by re-pinning a signed manifest.

---

## 2. Verification evidence (verify-by-execution, captured on this repository)

### 2a. Frozen technical-verification package (`frozen_build_v0.4.5/`)
| Check | Command | Result |
|---|---|---|
| Build / version contract | `node verify_manifest.js` | **72/72 PASS · contract valid** |
| Frozen-core immutability (dossier §3, 9 artifacts) | `node verify_frozen_immutability.js` | **9/9 byte-identical** (`all_byte_identical: true`) |
| Frozen artifacts in inventory (`frozen: true`) | inventory re-hash | **16/16 match** |
| Whole-tree inventory integrity | `node verify_inventory.js` | **49/50** (entries=50, ok=49, mismatch=1, missing=0, ambiguous=0) |

Supporting executed test suites (frozen reports included):
engine **291/291** assertions (95 scenarios) · storage **24/24** (11 scenarios) · combined engine+storage **315/315** · fuzz **352 inputs, 0 crashes, 0 schema failures** (seed 42) · version-sync **13/13** · formal U1–U21 browser acceptance **28/28 PASS · 0 FAIL · 0 NOT EXECUTED · 0 console errors** · browser smoke **48/48** · bundle smoke **15/15**.

### 2b. Manuscript-level addendum (`manuscript_verification/`) — re-executed in this repository
| Study | Result |
|---|---|
| Core-reference parity (GAT×CCT grid) | **28,056 points · 0 mismatches · 0 engine failures · max abs diff 0** (exact IEEE-754 equality) |
| Monte Carlo v2 — clinical surface | **63,000 inputs · 126,000 evaluations · 0 determinism failures · 0 contract failures · 0 invariant violations · 0 failure-routing failures · 0 uncaught exceptions · all_clear = true** |
| Integration-affordance audit | **5,000 probes · 5,000 expected strict-policy deviations · 0 determinism/contract/routing/exception failures** |

The addendum bundles **byte-identical** copies of the frozen engine (`1fef6cb4…`) and schema (`fbd983b1…`) and the deployed Core Tool #1, and re-runs from a fresh checkout under pinned dependencies (ajv 8.20.0, ajv-formats 3.0.1).

---

## 3. The single inventory discrepancy — full disclosure

- **File:** `frozen_immutability_report.json`  ·  **inventory flag:** `frozen: false`
- **Inventory-pinned SHA-256:** `a6ab758d…`  ·  **deposited copy SHA-256:** differs
- **Why it differs:** this file is **not a frozen artifact**. It is a *regenerable audit report* produced by `verify_frozen_immutability.js`, carrying a `"generated_utc"` timestamp. Every execution yields a different SHA-256 while the *content of the attestation* (9/9 byte-identical) is unchanged.
- **Why the pinned value is not reproduced:** `a6ab758d…` was the report's state at the instant `artifact_inventory.json` was generated — a transient snapshot overwritten by the next verification run. It is **not recoverable** (8+ distinct copies exist across the workspace, each with a different timestamp/hash; none is `a6ab758d…`), and it was **deliberately not fabricated** (forging a timestamp to hit a target hash would corrupt an audit artifact).
- **Scope of impact:** confined to a single `frozen: false` artifact. **All 16 `frozen: true` artifacts match**, and the immutability dossier is **9/9 byte-identical**. No clinical/frozen artifact is in question. The report is pinned only in `artifact_inventory.json`, not in `build.manifest.json` (which pins the deterministic test reports).
- **Independent reproduction:** re-running `node verify_frozen_immutability.js` regenerates the report and again reports **9/9 byte-identical** (with a fresh timestamp, i.e. a fresh hash). Documented here so a reviewer can reproduce it.

### Manuscript impact: none
The manuscript cites the repository **URL, tag, and commit hash** — not the per-file checksums of individual reports. This discrepancy does not affect any statement in the paper. (It would be equally true under a re-pin.)

---

## 4. Integrity posture summary

- Frozen clinical core (engine, schema, storage adapter), frozen test sources, and frozen governance documents: **byte-identical and reproducible**.
- Deterministic bundle: bit-identical rebuild (`esbuild --target=es2020`, IIFE, global `M1ADV`); manifest CONSTANTS correspondence verified (part of 72/72).
- Founder-signed inventory: **preserved unmodified**.
- Manuscript Monte Carlo / Core-parity addendum: **included and re-executed** in `manuscript_verification/` (numbers reproduced; reports carry timestamps).
- The only moving value in the frozen package is a timestamped, regenerable audit report — disclosed in §3.

---

## 5. Scope boundary — items outside this repository

- **Supplementary Software Safety Card** — not included in this repository; if added, it must carry its own provenance. No Safety-Card results are reported or implied here.
- This repository establishes **technical verification and reproducibility**, **not clinical validation**.

---

## 6. Open placeholders (to fill at release)

- `[GitHub release URL to be inserted]`
- `[final commit hash to be inserted]`
- `[manuscript citation to be inserted on acceptance]`
- Playwright/Chromium exact Chromium revision for the reference run (Playwright 1.56.0 recorded; confirm the Chromium revision installed by `npx playwright install chromium`).

---

## 7. Final status

**GO for GitHub upload** under Option A. After the push, fill the release URL + commit hash here and in the root `README.md`, `CITATION.cff`, and the manuscript's Statements and Declarations (Methods §2.9, Data Availability, Material and Code Availability) and the Safety Card §10.
