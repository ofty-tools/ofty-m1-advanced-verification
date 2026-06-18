# OFTY M1 ADVANCED — CLINICAL LOGIC FREEZE RECORD

```
═══════════════════════════════════════════════════════════════════
  OFTY-Gx-M1-Advanced — FINAL RUNTIME/AUDIT CLOSURE PACKAGE
═══════════════════════════════════════════════════════════════════

  Clinical specification:     v0.4.5
  Algorithm candidate:        0.4.3-experimental
  Schema version:             M1-ADV-SCHEMA-1.3
  Engine test suite:          M1-ADV-TESTS-1.3
  Storage test suite:         M1-ADV-STORAGE-TESTS-1.3
  Fuzz suite:                 M1-ADV-FUZZ-1.3 (seed 42, reproducible)
  Corvis mapping version:     corvis-map-0.1 (conservative whitelist)
  Core dependency:            OFTY-Gx-M1 v1.0.0 (UNCHANGED, separate key)

  Status:                     CLINICAL LOGIC FROZEN
  UI development:             AUTHORIZED
  Clinical deployment:        NOT authorized (experimental status preserved)
═══════════════════════════════════════════════════════════════════
```

## VERIFIED TEST RESULTS (executed, reproducible, all in-package)

| Suite | File | Scenarios | Assertions | Passed | Failed |
|---|---|---|---|---|---|
| Pure engine | `m1_advanced_tests.js` | 95 | 291 | 291 | 0 |
| Storage adapter | `m1_advanced_storage_tests.js` | 11 | 24 | 24 | 0 |
| **Subtotal (assertion suites)** | | **106** | **315** | **315** | **0** |
| Reproducible fuzz | `m1_advanced_fuzz_tests.js` | 352 inputs | — | 0 crashes / 0 schema-fails | — |
| Version sync | `m1_advanced_version_sync_tests.js` | 13 checks | — | 13 | 0 |

- Every engine output validated against `M1-ADV-SCHEMA-1.3` via AJV (draft 2020-12).
- **Every claim below is backed by an executable artifact in the package** (no ad-hoc test is referenced without its file + report).
- Fuzz is deterministic (enumerated matrix, seed 42 recorded); report in `m1_advanced_fuzz_report.json`.
- Version sync is mechanical; report in `m1_advanced_version_sync_report.json`.

## FINAL RUNTIME/AUDIT CLOSURE — 7 THIRD-ROUND BLOCKERS RESOLVED (v0.4.5)

| # | Blocker (3rd red-team) | Resolution | Verifying tests |
|---|---|---|---|
| 1 | Clinical booleans used truthy coercion (`"false"` → `true`) | `strictBool` (only `=== true`); invalid boolean inputs (string/number/object) are REJECTED, not coerced | T91–T94, T99 |
| 2 | Whitespace `shared_encounter_id` validated comparison; no encounter coherence check | `cleanString`/`cleanTimestamp` now `.trim()`; whitespace → null → `unconfirmed`. Conflicting encounter ids without clinician confirmation are rejected | T95, T96, T100 |
| 3 | `difference_review_flag` true even when comparison not clinically interpretable | Renamed `numerical_threshold_exceeded` (pure arithmetic); clinical relevance carried separately by `comparison_clinically_interpretable` + flags | T97 |
| 4 | Clinician-preference `timestamp` in result but not in echo (echo not reproducible) | `timestamp` added to echo and to `InputEchoPreference` `$def` | T98 |
| 5 | Storage adapter accepted partial/foreign objects when validator omitted; `readAdvancedResult` threw on corrupt JSON | Validator MANDATORY in constructor; safe reads return `{ok,reason}` for `corrupt_json`/`invalid_object` | T78b–T82b |
| 6 | "Version sync verified" was false (test header still 1.0; report 1.2) | All headers/consts/reports synchronized to v0.4.5; mechanical `version_sync` test enforces it | version_sync (13/13) |
| 7 | "Fuzz 126 inputs" claimed but no script/seed/report in package | Reproducible `m1_advanced_fuzz_tests.js` (seed 42, 352 enumerated inputs) + `m1_advanced_fuzz_report.json` shipped | fuzz suite |

## TWO FALSE CLAIMS FROM v0.4.4 — NOW CORRECTED

The previous freeze record asserted two things that were **not** package-verifiable:
1. "All version identifiers synchronized" — the engine-tests header still read `M1-ADV-TESTS-1.0`. Now enforced by an executable `version_sync` test.
2. "Extended hostile-input fuzz: 126 inputs … reproducible" — the fuzz script, seed, and report were not in the package. Now shipped and re-runnable.

These corrections are documented because they matter for the methodological record (Paper 6): an AI-generated artifact can assert completeness it has not actually achieved; only an in-package executable check makes the claim defensible.

## SCHEMA CHANGES 1.2 → 1.3

- `DeviceComparison.difference_review_flag` → `numerical_threshold_exceeded` (semantics clarified; pure arithmetic).
- `InputEchoPreference`: added required `timestamp`.
- All invariants from 1.0/1.1/1.2 preserved.

## DELIVERABLE FILES

```
m1_advanced_engine.js                  Pure clinical engine (strict gateway)
m1_advanced_schema.json                Complete self-contained JSON Schema 1.3
m1_advanced_tests.js                   Pure engine tests (T1–T100)
m1_advanced_storage_adapter.js         Persistence adapter (mandatory validator, safe reads)
m1_advanced_storage_tests.js           Storage isolation + rejection + safe-read tests
m1_advanced_fuzz_tests.js              Reproducible seeded fuzzer (NEW)
m1_advanced_version_sync_tests.js      Mechanical version-sync test (NEW)
m1_advanced_test_report.json           Engine test report (generated)
m1_advanced_storage_test_report.json   Storage test report (generated)
m1_advanced_fuzz_report.json           Fuzz report (generated, NEW)
m1_advanced_version_sync_report.json   Version sync report (generated, NEW)
M1_ADV_FREEZE_RECORD.md                This document
```

## CUMULATIVE CLOSURE HISTORY (Paper 6 dataset)

| Round | Spec | Assertion suites | Fuzz | New blockers found | Notable |
|---|---|---|---|---|---|
| First formalization | v0.4.2 | 57 sc / 184 as | — | 10 schema/architecture | first executable package |
| Red-team 1 | v0.4.3 | 75 sc / 239 as | — | 6 robustness | green suite ≠ robust engine |
| Red-team 2 | v0.4.4 | 91 sc / 280 as | ad-hoc (unshipped) | 6 runtime-contract | normalize gateway introduced |
| Red-team 3 | v0.4.5 | 106 sc / 315 as | 352 (shipped, seed 42) | 7 runtime/audit incl. 2 false-claim corrections | claims now artifact-backed |

**Methodological finding:** four successive "all green" states each preceded an external red-team that found real defects the prior round missed; twice, the AI-authored freeze record asserted verifications (version sync, reproducible fuzz) that were not actually true until an in-package executable check was added.

## KEY CLINICAL INVARIANTS (frozen — unchanged since v0.4.2)

1. CH continuous; no threshold/categories/slider; `numerical_effect_on_iop: false`.
2. Biomechanical parameters never numerically modify the pressure value.
3. `clinical_applicability` binary (`standard`/`limited`); unusable readings → blocking `measurement_failure`.
4. Branch "both": no automatic primary; comparison-only; per-device assessments; worst-of interpretability; dynamic non-misleading text; `numerical_threshold_exceeded` is arithmetic only.
5. Discordance requires confirmed temporal validity; timestamps alone never auto-validate; whitespace/empty identifiers never validate.
6. No M1 output eligible for target-IOP comparison; enforced at the M5 adapter.
7. Storage keys separate: Core `ofty_m1_result` never written by Advanced; persistence requires a mandatory schema validator.
8. `core_reference.value_mmhg` byte-equal to frozen Core (raw); `display_value_mmhg` carries UI rounding.

## POST-FREEZE CHANGE POLICY

```
Bug fix in algorithm        -> 0.4.3 -> 0.4.4
New clinical concept        -> 0.5.0 (re-review required)
Schema modification         -> M1-ADV-SCHEMA-1.3 -> 1.4
Corvis label added to map   -> corvis-map-0.1 -> 0.2 (requires documentation)
Test additions only         -> keep suite version, append Tn
```

## M5 ADAPTER CONTRACT (registered dependency — no Core modification)

```
1. M5 target comparison (above/at/below) MUST use measured GAT IOP from M2.
2. M5 MUST NOT use Core gat_adjusted, ORA IOPcc, or Corvis bIOP for target classification.
3. All M1 outputs received as context_only; enforcement lives in M5 adapter, not Core.
4. Core schema unmodified. Storage keys read-only for the adapter.
5. Source-aware M5 (future) is out of scope for this contract version.
```

## SIGN-OFF

```
Clinical Logic:        FROZEN
Schema:                FROZEN (M1-ADV-SCHEMA-1.3)
Test suites:           LOCKED (extensible by addition only)
Assertion suites:      315/315 PASSED (106 scenarios)
Reproducible fuzz:     CLEAN (352 inputs, seed 42, shipped + report)
Version sync:          VERIFIED MECHANICALLY (13/13, shipped + report)
Core parity:           VERIFIED (0 mismatches on GAT x CCT grid)
Core:                  UNTOUCHED (storage isolation verified)
UI development:        AUTHORIZED

Authorized by:         Andrea Ragosta, MD, FEBO
Date of freeze:        17 June 2026
Notes:                 Independently re-run and verified. Clinical logic frozen
                       (experimental). UI development authorized. Two non-blocking
                       notes carried into UI Spec: (1) corvis-map-0.1 is provisional —
                       UI must not present OK/good/bad as a universal taxonomy;
                       (2) fuzz seed 42 is recorded metadata, matrix is enumerated.
```
