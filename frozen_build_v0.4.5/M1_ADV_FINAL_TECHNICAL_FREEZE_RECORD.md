# M1 ADVANCED — FINAL TECHNICAL FREEZE RECORD

| Field | Value |
|---|---|
| Module | OFTY-Gx-M1 · variant **advanced** |
| Freeze version | **v0.4.5** |
| Engine algorithm | 0.4.3-experimental |
| Schema | M1-ADV-SCHEMA-1.3 |
| UI specification | v0.4.1 |
| Corvis quality mapping | corvis-map-0.1 |
| Intended deploy path | `/glaucoma/iop-cct-advanced/` (not yet deployed) |
| Core module relationship | OFTY-Gx-M1 **v1.0.0** untouched — separate engine, separate storage key `ofty_m1_result` |
| Record date (UTC) | 2026-06-18 |

---

## STATUS

> **Technical state: ✅ TECHNICALLY VERIFIED**
> **Founder sign-off: ✅ SIGNED — 2026-06-18T11:59:31Z**

**Founder approval (verbatim):** *"Approvo e congelo M1 Advanced Browser v0.4.1 come technical freeze finale. Lo stato passa da Founder sign-off PENDING a Founder sign-off SIGNED."*

This record now certifies BOTH the technical verification state and the Founder sign-off. It still does **not** authorize clinical use and does **not** assert paper-ready status: clinical deployment is **not asserted**, and paper-ready status is **not yet asserted** (deferred until the deployment/archive step).

---

## 1. Frozen clinical core (immutable — must not change)

| Artifact | SHA-256 | Bytes |
|---|---|---|
| m1_advanced_engine.js | `1fef6cb46ef014c00cf6326f4ea6bf3f307911ea1658fed05123fd3c03cae63a` | 42816 |
| m1_advanced_schema.json (`$id` M1-ADV-SCHEMA-1.3) | `fbd983b1a443a1700402cf65ed9537c4279394747250547504260690b4a89d06` | 26052 |
| m1_advanced_storage_adapter.js | `d282045f73641342ce0b6a416399ad61a2db34719bb1437f13068284ea83fe87` | 3656 |
| m1_advanced_browser_entry.js | `35397884a21e94871f0d2e0b404a6038e234d6166799e733f94109dd47669892` | 1088 |
| m1_advanced_bundle.js (deterministic IIFE `M1ADV`) | `9f9a0fe47c8285804268532634593c27539083a811e31e32bf71b33ad5f78ffd` | 380042 |
| build.manifest.json | *(integrity authority; carries the hashes above)* | — |

## 2. Frozen test sources & reports (immutable)

| Artifact | SHA-256 | Bytes |
|---|---|---|
| m1_advanced_tests.js | `106821db53addead07f5de51e494be506dcb9869b7e6678065535e2eedc44514` | 48110 |
| m1_advanced_storage_tests.js | `fe11003d9fbbf368628593819cc9bba99b303c504003ca00255cce73194a2e39` | 11652 |
| m1_advanced_fuzz_tests.js | `0c1310a6e595d6426bc4eed181c47aab306f025fd2ea27ea55d64675ca3b2884` | 5200 |
| m1_advanced_version_sync_tests.js | `530cd4cf1a71c0e9cba06c50bfa3681f37344bcd79e53c0941f6fe3340e23eed` | 3682 |
| m1_advanced_test_report.json | `b6cf9f9a2d489ed9c9c794dd37e457de2913d72da34a4732d70297cf43aff6ac` | 269 |
| m1_advanced_storage_test_report.json | `5bceffb5356dccc2757b7016efa6124d9e787e1f3a7791a687f2fc53af64a99e` | 192 |
| m1_advanced_fuzz_report.json | `c1c7a2d54ecaaf74baa1e29e3562452d64cca8cf8dbcae9e1d2583c2bf0d4ed6` | 209 |
| m1_advanced_version_sync_report.json | `83cbf5233bf4083af2ffa47edcf822c97e85b379fc2d752773035949e372c50d` | 331 |

## 3. Frozen specification & freeze docs (immutable)

| Artifact | SHA-256 | Bytes |
|---|---|---|
| M1_ADV_UI_SPEC_v0.4.1.md | `7e954920da441098b5fe9d82cf4e5383fb58b049ed54bbfd07515a14a06dd451` | 36695 |
| M1_ADV_FREEZE_RECORD.md (build-time freeze record) | `91a3aed3ae2aa660165139ac1e6446dc6c3dc155a4424daebe868d542bf98f19` | 9548 |

## 4. UI thin layer (verified; under change control)

| Artifact | SHA-256 | Bytes | Note |
|---|---|---|---|
| index.html | `3e3f4d0bf66715b4ee0b3bdd01cc19aa16d372129da50962b97b8f3406e5e7e8` | 63627 | loads frozen bundle **exactly once**; integrity gate active |

`index.html` carries no clinical logic; it is a presentation/orchestration layer over the frozen bundle. The engine remains the single source of clinical logic.

---

## 5. Verification ledger (all executed by execution, not description)

| Gate | Result |
|---|---|
| Build / version contract (`npm run gate`) | **72/72 PASS** |
| Frozen immutability (`verify_frozen_immutability.js`) | **9/9 byte-identical** (bundle bit-identical) |
| Browser smoke (`browser_smoke.js`) | **48/48 PASS** |
| Formal U1–U21 acceptance (`m1_advanced_acceptance.js`) | **28/28 PASS · 0 FAIL · 0 NOT EXECUTED** |
| Console/page errors (canonical flow) | **0** |

---

## 6. Verified / Not verified / Out of scope

### VERIFIED (technically)
Frozen artifact immutability and build contract; single-bundle load and load-time integrity gate (manifest/schema/bundle tamper blocks compute); ORA/Corvis/Both/failure rendering from real engine output; storage isolation (Core key never written) and corrupt-JSON recovery; copy/export byte-for-byte vs spec §7; DOM tab order, failure-focus and `aria-live="polite"`; 320 px no horizontal overflow and Both ordering; §7.0 numeric formatting with no fabricated clinical numbers; encounter-ID never auto-validates (clinician confirmation is the sole validator); zero console/page errors.

### NOT VERIFIED (out of this audit; future work)
Clinical accuracy/validity against real patients; cross-browser execution beyond headless Chromium; real assistive-technology (screen-reader) behaviour; live Vercel deployment at the intended path; performance/load/concurrency and storage edge cases (quota, private mode, multi-tab); security/penetration testing beyond the integrity gate.

### OUT OF SCOPE (by design / directive)
New features, M5 orchestrator, compact mode, paper writing; integration-only payload fields as manual-UI features; the Core module OFTY-Gx-M1 v1.0.0; clinical deployment authorization and regulatory matters; publication/paper-ready status.

---

## 7. Explicit non-claims

- ⛔ **No clinical deployment** is asserted or authorized by this record.
- ⛔ **No paper-ready / publication** status is asserted; this is deferred until the deployment/archive step.
- ⛔ The "experimental" designation stands; outputs are descriptive and non-prescriptive; clinician autonomy is preserved by design.

---

## 8. Sign-off

| Role | State | Date (UTC) |
|---|---|---|
| Technical verification | ✅ **VERIFIED** | 2026-06-18 |
| Founder sign-off | ✅ **SIGNED** | 2026-06-18T11:59:31Z |

**This record is now the FINAL TECHNICAL FREEZE for M1 Advanced Browser v0.4.1.** The frozen clinical core and the verified UI thin layer are locked under change control. Downstream status remains explicitly bounded: **clinical deployment is not asserted**, and **paper-ready status is not yet asserted** (deferred until the deployment/archive step). Deployment has **not** been initiated.

*Authority for frozen hashes: `frozen_immutability_report.json` (dossier §3 manifest) and `build.manifest.json`. Machine-readable per-file inventory: `artifact_inventory.json`.*
