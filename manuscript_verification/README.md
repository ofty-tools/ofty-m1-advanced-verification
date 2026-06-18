# Manuscript-Level Verification Addendum — Core Parity & Monte Carlo v2

This folder contains the **re-executable reproducibility material** for two results reported in the OFTY M1 Advanced manuscript that are **not** part of the frozen 50-file technical-verification inventory (`../frozen_build_v0.4.5/`):

1. **Core-reference parity** — exact raw numeric parity between the Advanced engine's linear GAT/CCT correction and the deployed Core Tool #1, over a dense GAT×CCT grid.
2. **In-silico Monte Carlo v2 stress test** — a deterministic, seeded stress test of the deployed clinical/manual input surface under the strict comparability policy, plus a separate integration-affordance audit.

These artifacts are provided as a **manuscript-level addendum**: they reproduce the manuscript's headline numbers but are deliberately kept **outside** the founder-signed frozen inventory so that the frozen package remains unmodified.

---

## Contents

| File | Role |
|---|---|
| `run_core_parity.js` | Core-parity runner (executes both implementations; no re-transcription) |
| `core_parity_report.json` | Canonical Core-parity report |
| `run_monte_carlo_v2.js` | Monte Carlo v2 runner (strict comparability policy) |
| `m1_advanced_monte_carlo_report_v2.json` | Canonical Monte Carlo v2 report |
| `mt19937.js` | MT19937 (32-bit Mersenne Twister) reference PRNG |
| `m1_advanced_engine.js` | Byte-identical copy of the frozen engine (dependency for the runners) |
| `m1_advanced_schema.json` | Byte-identical copy of the frozen schema (dependency for the runners) |
| `ofty-tool-1.html` | Deployed Core Tool #1 (parity reference; function executed verbatim) |
| `package.json`, `package-lock.json` | Pinned dependencies (ajv 8.20.0, ajv-formats 3.0.1) |

`m1_advanced_engine.js` and `m1_advanced_schema.json` here are **byte-identical** to the frozen artifacts in `../frozen_build_v0.4.5/` (SHA-256 `1fef6cb4…` and `fbd983b1…` respectively); they are duplicated only so this folder runs self-contained.

---

## Reproduce

```bash
# Node 22.x
npm ci
node run_core_parity.js       # exact-parity grid sweep
node run_monte_carlo_v2.js    # seeded stress test (seed 42)
```

Both runners write their reports to this folder (with a fresh `generated_utc` timestamp each run; the **numbers** are reproducible, the timestamp is not).

---

## Expected results

**Core parity** (`core_parity_report.json`):
- GAT grid 5–60 mmHg (step 1) × CCT grid 250–750 µm (step 1) = **28,056 grid points**
- **0 mismatches · 0 engine failures · maximum absolute difference 0** (exact IEEE-754 equality, tolerance 0) · `all_match: true`
- Formula: `value = gat_iop − ((cct − 540) / 25)` (Ehlers-based linear; ref 540 µm, 25 µm/mmHg)

**Monte Carlo v2 — clinical surface** (`m1_advanced_monte_carlo_report_v2.json`):
- **63,000 inputs** (50,000 valid synthetic + 13,000 adversarial malformed) · **126,000 engine evaluations**
- determinism **63,000/0** · contract validation **63,000/0** · invariant violations **0** · failure-routing **63,000/0** · uncaught exceptions **0**
- `clinical_surface_all_clear: true`

**Integration-affordance audit** (separate, in the same report):
- **5,000 probes** of the integration-only `shared_encounter_id` field (set with `clinician_confirmation=false`)
- **5,000 expected strict-policy deviations** · determinism **5,000/0** · contract **5,000/0** · failure-routing **5,000/0** · uncaught exceptions **0**
- Reported honestly (UI spec v0.4.1 §1.7): `shared_encounter_id` is **unreachable from the manual UI**; these deviations characterise a deliberate engine design decision, **not** a defect of the clinical surface.

---

## Scope

This addendum establishes **technical reproducibility** of the two studies above. It makes **no** clinical-accuracy, diagnostic, prognostic, effectiveness, or deployment claim. See the repository-root `README.md` and `REPOSITORY_READY_REPORT.md`.
