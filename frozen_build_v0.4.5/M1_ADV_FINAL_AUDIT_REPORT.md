# M1 ADVANCED — FINAL TECHNICAL AUDIT REPORT
### Browser · Storage · Accessibility · Responsive

- **Module:** OFTY-Gx-M1 · variant **advanced** (biomechanical IOP/CCT context, experimental)
- **Freeze version:** v0.4.5 · **Engine:** 0.4.3-experimental · **Schema:** M1-ADV-SCHEMA-1.3 · **UI spec:** v0.4.1 · **Mapping:** corvis-map-0.1
- **Audit date (UTC):** 2026-06-18
- **Audit type:** technical verification by execution (real headless browser). **NOT** a clinical validation.

> This report consolidates the executed verification gates. It makes **no clinical-accuracy claim** and **no deployment claim**. Clinical validity, regulatory status, and production deployment are explicitly **out of scope** (see §6).

---

## 1. Verification gates executed

| Gate | Tool | Result | Evidence file |
|---|---|---|---|
| Build/version contract | `npm run gate` (build + verify:frozen + smoke:bundle + verify:manifest) | **72/72 PASS** | (stdout; manifest `build.manifest.json`) |
| Frozen immutability | `verify_frozen_immutability.js` | **9/9 byte-identical** | `frozen_immutability_report.json` |
| Preliminary browser smoke | `browser_smoke.js` (Playwright/Chromium) | **48/48 PASS** | `browser_smoke_report.json` |
| Formal U1–U21 acceptance | `m1_advanced_acceptance.js` (Playwright/Chromium) | **28/28 PASS · 0 FAIL · 0 NOT EXECUTED** | `m1_advanced_browser_acceptance_report.json` / `.md` |

Environment: Ubuntu 24.04 · Node v22.22.2 · esbuild 0.28.1 · ajv 8.20.0. No console/page errors observed during the canonical acceptance flow (`console_errors: []`).

---

## 2. Domain findings

### 2.1 Browser integrity & load-time integrity gate
- The thin-layer UI loads the frozen clinical bundle **exactly once** (single-bundle DOM guard, smoke check `count=1`).
- Load-time SHA-256 smoke compares served **bundle**, **schema $id + hash**, and **manifest** `engine_algorithm_version` against the manifest **and** `M1ADV.CONSTANTS`. On any mismatch the integrity banner shows and **compute is disabled**.
- Tamper coverage (compute correctly refused): manifest `ALG_VERSION` (U8b), manifest bundle SHA-256 (U8c), schema `$id`+hash (U8d), plus the three smoke tamper checks.

### 2.2 Clinical-logic rendering (engine is the single source of clinical logic)
- ORA success / quality "high" (U1); not-eligible-for-target-IOP line on any success (U9).
- CH = 20 → out-of-observed-range note ("outside the 4–18 mmHg observed range; not a validated clinical cutoff"), **not an error**, CH carries no coefficient (U2).
- Unrecognized Corvis label "ZZZ" → quality chip "unknown" + provisional-mapping tooltip (corvis-map-0.1); raw label retained in form (U3).
- Both identical → "No marked cross-device difference detected." (U4); Both diff>3 unconfirmed → "Numerical difference shown; clinical comparison not established." with neutral tint (U5).
- Prior LASIK → Core estimate **not applicable**, device applicability **limited**, post-refractive flag (U6).
- Failure states: integration `measurement_failure` → DEVICE_ERROR (U7); integration eye-mismatch → EYE_MISMATCH (U10); recompute into failure clears the previous success card first (U11). Failure cards show no large number and **no copy button**.

### 2.3 Storage isolation & recovery
- **Core key `ofty_m1_result` is never written by Advanced.** Verified byte-identical when pre-seeded (Case A) and absent when empty (Case B); the only `ofty_m1*` key written is `ofty_m1_advanced_result` (U13).
- Corrupt Advanced JSON → adapter returns `{ok:false, reason:'corrupt_json'}`; the UI recovers and a subsequent compute writes valid JSON, no crash (U14).

### 2.4 Copy / export fidelity (byte-for-byte vs UI spec §7)
The text actually written to the clipboard was captured and compared byte-for-byte:
- ORA canonical = spec §7.1 block — **exact match**.
- Single-branch invalid-temporal → §7.4 rule 2 delta suffix — **exact match**.
- Core not_applicable → §7.4 rule 1 Core line, no Core number — **exact line match**.
- Both → spec §7.3 block with engine `interpretation` substituted — **exact match**.
Character encoding (`µm`, em-dash, middot, Δ) is consistent between UI output and spec source (U17).

### 2.5 Accessibility & focus
- DOM tab order is a subsequence of branch → shared → modifier → device inputs → temporal → compute and reaches the (enabled) compute button.
- On engine failure, focus moves into the failure card heading.
- `#result_region` carries `aria-live="polite"` (U18).
- **Caveat:** programmatic focus order and ARIA attributes were verified; behaviour with real assistive technology (NVDA/JAWS/VoiceOver) was **not** exercised — see §6.

### 2.6 Responsive
- At 320 px width: `scrollWidth ≤ innerWidth` (no horizontal overflow); Both order remains ORA → Corvis → cross-device (U19). Screenshot evidence retained.

### 2.7 Numeric formatting & non-fabrication
- Every rendered/exported number satisfies the §7.0 helpers (pressures `x.x mmHg`; CCT integer `n µm`; SP-A1 `x.x mmHg/mm`; SSI bare; Δ signed); near-zero Δ forced to `+0.0`.
- **No clinical number (`mmHg`/`µm`/`mmHg/mm`) appears that is not returned by the engine** (cross-checked against the engine output value set) (U20).

### 2.8 Semantic safety
- A manually typed Encounter ID **never** auto-validates a cross-device comparison: encounter-ID-only → `comparison_context.basis="unconfirmed"`, `comparison_valid=false`; only `clinician_confirmation=true` yields `clinician_confirmed_same_session` / `true` (U21).

---

## 3. Screenshot evidence
`acceptance_screenshots/`: U1_ora_success, U2_ch_out_of_range, U3_corvis_unknown, U5_both_unconfirmed, U6_lasik, U7_measurement_failure, U16_both_no_primary, U19_responsive_320 (PNG).

---

## 4. Frozen-artifact immutability (summary)
9/9 source artifacts byte-identical vs the dossier §3 authority; the bundle is bit-identical (deterministic esbuild IIFE `M1ADV`). Full per-file hashes are in `frozen_immutability_report.json` and the final inventory.

---

## 5. Reproducibility
All gates are reproducible from the package root with no absolute paths:
`npm run gate` · `node verify_frozen_immutability.js` · `node browser_smoke.js` · `node m1_advanced_acceptance.js` (Playwright required).

---

## 6. Verified / Not verified / Out of scope

### VERIFIED (technically, by execution)
- Frozen engine/schema/adapter/browser-entry/bundle byte-identical; build/version contract 72/72.
- Single-bundle load + load-time integrity gate blocks compute on manifest/schema/bundle tamper.
- ORA / Corvis / Both (confirmed & unconfirmed) / failure rendering from real engine output.
- Storage isolation (Core key never written) + corrupt-JSON recovery.
- Copy/export byte-for-byte vs spec §7 (all conditional forms).
- DOM tab order, focus-to-failure-heading, `aria-live="polite"`.
- 320 px no horizontal overflow; Both order ORA→Corvis→cross-device.
- §7.0 numeric formatting; no fabricated clinical numbers.
- Encounter-ID never auto-validates; clinician confirmation is the only validator.
- No console/page errors in the canonical flow.

### NOT VERIFIED (requires separate, future work — not claimed here)
- **Clinical accuracy / clinical validity** of engine outputs against real patients (no validation cohort).
- **Cross-browser** execution beyond headless Chromium (Firefox/Safari/Edge not exercised; build targets es2020 evergreen but per-browser testing pending).
- **Assistive-technology** behaviour with real screen readers (only programmatic a11y verified).
- **Live deployment** on Vercel at `/glaucoma/iop-cct-advanced/` (not yet deployed/verified).
- **Performance/load/concurrency**, multi-tab storage races, quota-exceeded, private-mode storage.
- **Security/penetration** testing beyond the load-time integrity gate.

### OUT OF SCOPE (by design / supervisor directive)
- New features, M5 orchestrator, compact mode, paper writing (explicitly deferred).
- Integration-only payload fields (`shared_encounter_id`, `measurement_failure`) as manual-UI features (programmatic-only; engine routing verified, not surfaced in the manual form).
- Core module **OFTY-Gx-M1 v1.0.0** (separate engine + separate storage key `ofty_m1_result`) — untouched.
- Clinical deployment authorization and regulatory matters.
- Publication / paper-ready status (deferred until the final freeze is completed and approved).

---

*This is a technical audit artifact only. No clinical deployment is asserted. No paper-ready status is asserted.*
