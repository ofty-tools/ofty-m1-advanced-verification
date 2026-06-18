# M1 ADVANCED — CONSOLIDATED ARTIFACT INDEX

- **Freeze version:** v0.4.5 · **Engine:** 0.4.3-experimental · **Schema:** M1-ADV-SCHEMA-1.3 · **UI spec:** v0.4.1
- **Generated (UTC):** 2026-06-18T12:20:52.700Z
- **Status:** TECHNICALLY VERIFIED · Founder sign-off **SIGNED** (2026-06-18T11:59:31Z) (see `M1_ADV_FINAL_TECHNICAL_FREEZE_RECORD.md`)
- **Verified / Not verified / Out of scope:** see `M1_ADV_FINAL_AUDIT_REPORT.md` §6 and the freeze record §6.

> Clinical deployment NOT asserted. Paper-ready NOT yet asserted (deferred until the deployment/archive step). SHA-256 shown is the leading 16 hex chars; full hashes are in `artifact_inventory.json`.

## 1. Frozen — Clinical core (immutable; must not change)

| Artifact | SHA-256 (short) | Bytes | Role |
|---|---|---|---|
| `m1_advanced_engine.js` | `1fef6cb46ef014c0…` | 42816 | Clinical engine — single source of clinical logic |
| `m1_advanced_schema.json` | `fbd983b1a443a170…` | 26052 | Input/output JSON schema ($id M1-ADV-SCHEMA-1.3) |
| `m1_advanced_storage_adapter.js` | `d282045f73641342…` | 3656 | Storage adapter — writes ONLY ofty_m1_advanced_result; never the Core key |
| `m1_advanced_browser_entry.js` | `35397884a21e9487…` | 1088 | esbuild entry exposing the M1ADV global |
| `m1_advanced_bundle.js` | `9f9a0fe47c828580…` | 380042 | Deterministic IIFE bundle (global M1ADV) loaded by the UI |
| `build.manifest.json` | `419766a2cbf0da44…` | 3849 | Integrity authority: versions + SHA-256 of frozen artifacts |

## 2. Frozen — Test sources

| Artifact | SHA-256 (short) | Bytes | Role |
|---|---|---|---|
| `m1_advanced_tests.js` | `106821db53addead…` | 48110 | Frozen engine unit tests |
| `m1_advanced_storage_tests.js` | `fe11003d9fbbf368…` | 11652 | Frozen storage tests |
| `m1_advanced_fuzz_tests.js` | `0c1310a6e595d642…` | 5200 | Frozen fuzz tests |
| `m1_advanced_version_sync_tests.js` | `530cd4cf1a71c0e9…` | 3682 | Frozen version-sync tests |

## 3. Frozen — Test reports

| Artifact | SHA-256 (short) | Bytes | Role |
|---|---|---|---|
| `m1_advanced_test_report.json` | `b6cf9f9a2d489ed9…` | 269 | Frozen engine test report |
| `m1_advanced_storage_test_report.json` | `5bceffb5356dccc2…` | 192 | Frozen storage test report |
| `m1_advanced_fuzz_report.json` | `c1c7a2d54ecaaf74…` | 209 | Frozen fuzz report |
| `m1_advanced_version_sync_report.json` | `83cbf5233bf4083a…` | 331 | Frozen version-sync report |

## 4. Frozen — Specification & freeze docs

| Artifact | SHA-256 (short) | Bytes | Role |
|---|---|---|---|
| `M1_ADV_UI_SPEC_v0.4.1.md` | `7e954920da441098…` | 36695 | Frozen UI specification (defines U1–U21, §7 export, §7.0 helpers) |
| `M1_ADV_FREEZE_RECORD.md` | `91a3aed3ae2aa660…` | 9548 | Build-time freeze record |

## 5. UI thin layer (change-controlled)

| Artifact | SHA-256 (short) | Bytes | Role |
|---|---|---|---|
| `index.html` | `3e3f4d0bf66715b4…` | 63627 | UI thin layer — loads frozen bundle exactly once; integrity gate active |

## 6. Verification harness (mutable tooling)

| Artifact | SHA-256 (short) | Bytes | Role |
|---|---|---|---|
| `browser_smoke.js` | `75654b12052650af…` | 18574 | Preliminary browser smoke (48/48) |
| `m1_advanced_acceptance.js` | `e15ebba468052014…` | 50754 | Formal U1–U21 acceptance suite (28/28) |
| `verify_frozen_immutability.js` | `d2ee2c0eccae3cf6…` | 2965 | Frozen immutability verifier |
| `verify_manifest.js` | `b735b0f2c7fa6b93…` | 6930 | Manifest/contract verifier |
| `smoke_bundle.js` | `069a0cb6e05b2e9b…` | 5518 | Bundle load smoke |
| `rebuild_provenance.js` | `d9d98b2be6e07daf…` | 4442 | Pre/post-rebuild provenance verifier |

## 7. Verification & audit reports

| Artifact | SHA-256 (short) | Bytes | Role |
|---|---|---|---|
| `browser_smoke_report.json` | `6869b41b0c616849…` | 3960 | Browser smoke result (48/48) |
| `m1_advanced_browser_acceptance_report.json` | `b952f087fe6f6af4…` | 14459 | U1–U21 acceptance result (28/28, structured) |
| `m1_advanced_browser_acceptance_report.md` | `e61e54badc7f9bf2…` | 12117 | U1–U21 acceptance result (human-readable) |
| `m1_advanced_acceptance_console.log` | `9eae1c2c70524680…` | 3094 | U1–U21 run console log |
| `frozen_immutability_report.json` | `a6ab758de6839294…` | 3596 | Frozen immutability result (9/9 byte-identical) |
| `rebuild_provenance_report.json` | `85b9eb168f14a098…` | 3811 | Rebuild provenance result |
| `clean_room_gate_report.json` | `4e9ed2338947e2b6…` | 1013 | Clean-room gate result |

## 8. Integrity provenance evidence

| Artifact | SHA-256 (short) | Bytes | Role |
|---|---|---|---|
| `frozen_hashes_dossier_s3.json` | `92f2fb52c62d20a6…` | 1362 | Dossier §3 SHA-256 authority (frozen hash source of truth) |
| `frozen_snapshot_pre_rebuild.json` | `71a1fcfd5d547d00…` | 1482 | Frozen snapshot before rebuild |
| `frozen_snapshot_post_rebuild.json` | `691d8087ea261d30…` | 1483 | Frozen snapshot after rebuild |

## 9. Final audit & freeze documents (this stage)

| Artifact | SHA-256 (short) | Bytes | Role |
|---|---|---|---|
| `M1_ADV_FINAL_AUDIT_REPORT.md` | `bee552efd67fe210…` | 8511 | Final technical audit report (browser/storage/a11y/responsive) |
| `M1_ADV_FINAL_TECHNICAL_FREEZE_RECORD.md` | `401936786f6365df…` | 6613 | Final technical freeze record (technically verified; Founder signed) |
| `M1_ADV_CONSOLIDATED_ARTIFACT_INDEX.md` | *(this document — see inventory)* | — | This document — consolidated artifact index |

## 10. Inventory

| Artifact | SHA-256 (short) | Bytes | Role |
|---|---|---|---|
| `artifact_inventory.json` | *(hash intentionally not embedded — avoids circular self-reference)* | — | Authoritative inventory; full artifact hashes live in this file / external archive checksum |

## 11. Build infrastructure

| Artifact | SHA-256 (short) | Bytes | Role |
|---|---|---|---|
| `package.json` | `c4e3938d71778772…` | 867 | NPM scripts + devDependencies |
| `package-lock.json` | `33e6d7978d956d3b…` | 18165 | Locked dependency tree |

## 12. Screenshots — U1–U21 acceptance evidence

| File | SHA-256 (short) | Bytes |
|---|---|---|
| `acceptance_screenshots/U16_both_no_primary.png` | `ec5ddce49c67ad34…` | 227230 |
| `acceptance_screenshots/U19_responsive_320.png` | `94d02585a827c45d…` | 232944 |
| `acceptance_screenshots/U1_ora_success.png` | `c45f97fa26299aa5…` | 160051 |
| `acceptance_screenshots/U2_ch_out_of_range.png` | `a3e27a42ad2645b0…` | 168288 |
| `acceptance_screenshots/U3_corvis_unknown.png` | `92b97a98433827f1…` | 152707 |
| `acceptance_screenshots/U5_both_unconfirmed.png` | `ead1d7f74a2efff4…` | 223573 |
| `acceptance_screenshots/U6_lasik.png` | `73e3c54c6e49d0d3…` | 194970 |
| `acceptance_screenshots/U7_measurement_failure.png` | `ccedf7226e2d30d2…` | 120328 |

## 13. Screenshots — preliminary smoke evidence

| File | SHA-256 (short) | Bytes |
|---|---|---|
| `screenshots/both.png` | `bdebe9249f4eecc5…` | 241854 |
| `screenshots/corvis.png` | `4659644c7ee7c70c…` | 131208 |
| `screenshots/failure.png` | `6aac0f65aa842342…` | 105791 |
| `screenshots/ora.png` | `f91680f041018ce2…` | 148511 |

---

**The authoritative, complete, machine-readable inventory with full SHA-256 for every artifact (including this index) is `artifact_inventory.json`.** To prevent a circular self-reference, the inventory hash is intentionally NOT embedded in this index (section 10); verify it against the file itself or an external archive checksum.
