# OFTY M1 ADVANCED — UI SPECIFICATION v0.4.1 (FROZEN)

```
Document:        M1 Advanced UI Specification
Version:         v0.4.1 (frozen, micro-erratum over v0.4)
Supersedes:      v0.4 (5 micro-corrections; no structural change)
Derives from:    M1-ADV-SCHEMA-1.3 (frozen) / engine 0.4.3-experimental
Design system:   OFTY Design System v1 (Tool #1, byte-for-byte)
Status:          UI CONTRACT FROZEN — implementation authorized
Scope:           UI/UX contract only. Clinical logic frozen and unchanged.
```

This is the **frozen UI contract**. It applies five targeted micro-corrections over v0.4; no section is structurally reopened. The next conversation, *"M1 Advanced — Browser implementation and UI freeze"*, starts directly from this document.

---

## CHANGES FROM v0.4 (micro-erratum)

| # | v0.4 issue | v0.4.1 fix |
|---|---|---|
| 1 | `readTimestamp` used `valueAsNumber` for `datetime-local`, which is a local wall-clock value, mislabelling the instant as UTC in any non-UTC timezone | §1.0 `readTimestamp` rewritten using `new Date(el.value)` so the string-without-tz is correctly parsed as local time before `.toISOString()` |
| 2 | `quality_low_count` string said "confidence capped at acceptable", but `acceptable` is a `measurement_quality` level, not a confidence level | §6.1 string corrected to "measurement-quality classification capped at acceptable" |
| 3 | CH out-of-range string used "observed reference range", suggesting a normative cutoff while CH is deliberately a continuous variable | §6.1 string rewritten to make the disclaimer explicit |
| 4 | `MISSING_REQUIRED_FIELD` remediation listed "encounter ID" among required fields, but Encounter ID is optional | §6.2 remediation updated |
| 5 | Section 9 header and the introductory paragraph still said "U1–U20" though the spec contains U21 | All references updated to U1–U21 |

Sections not changed: §0 design system, §1.1–1.8 input contract (except the `readTimestamp` helper in §1.0), §2 progressive disclosure, §3 layout, §4 result cards, §7 export, §8 browser integration, §10 approval gate.

---

## CHANGES FROM v0.3

| # | v0.3 defect (verified by execution) | v0.4 closure |
|---|---|---|
| 1 | Encounter-ID propagation rule auto-validated the comparison: any non-empty string in `shared_encounter_id` set `comparison_valid: true` regardless of `clinician_confirmation` | §1.7 redesigned: the manual form sets only `measurement_identity.encounter_id`; `shared_encounter_id` is integration-only |
| 2 | Bundle entry was the engine alone, missing storage adapter + AJV + schema + bundled validator | §8.1/§8.2 redesigned around `m1_advanced_browser_entry.js` |
| 3 | Format helpers had two real bugs: `fmtD(-0.04)` returned `"0.0"` without sign; SSI/SP-A1 were formatted as `mmHg` | §7.0 helpers split and corrected |
| 4 | "Unchanged from v0.2" placeholders for ORA/Corvis/Failure cards and a missing Corvis export prevented self-contained implementation | §4 and §7.1 expanded; Corvis export added |
| 5 | `datetime-local` → ISO conversion not specified; clinician-preference timestamp update rule not specified | §1.0 adds `readTimestamp`; §1.8 fixes update rule |

Sections **not** changed: §0 design system, §2 progressive disclosure, §3 layout, §6 flags & remediation, §9 acceptance tests U1–U21, Appendix A (extended for `shared_encounter_id`).

---

## 0. NON-NEGOTIABLE CONSTRAINTS

### 0.1 OFTY Design System v1 — single source of truth

```
--bg:               #F4F6F9      page background
--surface:          #FFFFFF      card background
--surface-2:        #F8FAFC      subtle elevation
--text-1:           #0F172A      primary text
--text-2:           #334155      secondary text
--text-3:           #64748B      tertiary text
--accent:           #1C4F8C      primary action / focus
--accent-dim:       #EEF4FF      accent tint
--accent-hover:     #163E70
--accent-ring:      rgba(28,79,140,0.18)
--accent-border-25: #C2D3EB
--accent-border-20: #CEDEEF

Fonts:  'DM Sans' (body), 'DM Mono' (numeric/results). NO Serif Display.
Mode:   light only, three-layer enforcement (matches Tool #1).
```

### 0.2 Clinical / interpretive constraints

1. No biomechanical-to-pressure arithmetic shown. CH, SSI, SP-A1 carry the literal subtitle "Context only · not used to modify the pressure value".
2. Every success card carries the line "Not eligible for target-IOP comparison".
3. `corvis-map-0.1` is provisional. UI never presents `OK/good/bad` as a universal taxonomy; it shows the mapped level with a tooltip stating the raw label and "mapping provisional".
4. Failure states never feature a numeric result as protagonist; no copy button.
5. "Experimental" marking persistent on every Advanced screen.
6. Core reference rendered as **"CCT-contextualized Core estimate — not true IOP"**.

---

## 1. INPUT-PAYLOAD CONTRACT

### 1.0 Read helpers (closes review §3, §5)

```javascript
// Required numeric: empty/invalid → UI error sentinel (compute disabled)
function readRequiredNumber(el) {
  const v = el.valueAsNumber;
  return Number.isFinite(v) ? v : { uiError: 'required_missing_or_invalid' };
}

// Optional numeric: empty → null; invalid → UI error
function readOptionalNumber(el) {
  if (el.value === '' || el.value == null) return null;
  const v = el.valueAsNumber;
  return Number.isFinite(v) ? v : { uiError: 'invalid_number' };
}

// Integer: must be finite and integer
function readInteger(el) {
  const v = el.valueAsNumber;
  return (Number.isFinite(v) && Number.isInteger(v))
    ? v : { uiError: 'integer_required' };
}

// Trimmed string → null if empty
function readTrimmedString(el) {
  if (el.value == null) return null;
  const t = String(el.value).trim();
  return t.length > 0 ? t : null;
}

// datetime-local → unambiguous ISO 8601 UTC string
// closes review §5 (v0.3) and v0.4.1 erratum #1
// `<input type="datetime-local">` represents a LOCAL wall-clock value with no
// timezone. We must NOT read it as `valueAsNumber` and pass it to
// `new Date(ms)` — that mislabels the instant as UTC in any non-UTC timezone.
// Instead, pass the raw string to `new Date(string)`: a date-time without a
// timezone offset is interpreted as local time, and `.toISOString()` then
// returns the correct UTC instant.
function readTimestamp(el) {
  if (!el.value) return null;
  const date = new Date(el.value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
```

Hard rules:
- `parseInt`/`parseFloat` are **forbidden** for input reading (silent coercion).
- Required empty → UI error (compute disabled); optional empty → `null`.
- No permissive coercion anywhere in the UI; the engine remains the authoritative gate.

### 1.1 Shared inputs

| DOM | Property | Type | Default | Required | Read |
|---|---|---|---|---|---|
| `#gat_iop` | `gat_iop` | number | — | yes | `readRequiredNumber` |
| `#cct` | `cct` | number | — | yes | `readRequiredNumber` |
| `#eye` select OD/OS | `measurement_identity.eye` | enum | — | yes | string |
| `#device_branch` select | `device_branch` | enum | — | yes | string |

### 1.2 Corneal modifiers

| DOM | Property | Type | Default |
|---|---|---|---|
| `#keratoconus_ectasia` checkbox | `keratoconus_ectasia` | boolean (`el.checked`) | false |
| `#corneal_edema` checkbox | `corneal_edema` | boolean | false |
| `#dystrophy_or_scar` checkbox | `significant_dystrophy_or_scar` | boolean | false |
| `#prior_refractive_surgery` select LASIK/PRK/SMILE/RK/other/— | `prior_refractive_surgery` | enum \| null | null |

### 1.3 ORA inputs

| DOM | Property | Type | Default | Required | Read |
|---|---|---|---|---|---|
| `#ora_iopcc` | `ora_inputs.iopcc` | number | — | yes | `readRequiredNumber` |
| `#ora_ch` | `ora_inputs.ch` | number | — | yes | `readRequiredNumber` |
| `#ora_wfs` | `ora_inputs.selected_waveform_score` | number | — | yes | `readRequiredNumber` |
| `#ora_count` | `ora_inputs.measurement_count` | integer | — | yes | `readInteger` |
| `#ora_iopg` | `ora_inputs.iopg` | number \| null | null | no | `readOptionalNumber` |
| `#ora_crf` | `ora_inputs.crf` | number \| null | null | no | `readOptionalNumber` |
| `#ora_provenance_confirmed` checkbox | `provenance_attestation.values_from_same_device_result_confirmed` | boolean | false | **must be true to compute** | `el.checked` |
| `#ora_provenance_basis` select | `provenance_attestation.basis` | enum | `single_reading` | no | string |
| `#ora_reading_id` text | `provenance_attestation.reading_id` | string \| null | null | no | `readTrimmedString` |

### 1.4 ORA device metadata — optional accordion

| DOM | Property | Type | Default |
|---|---|---|---|
| `#ora_device_generation` select G3/legacy/unknown | `ora_metadata.device_generation` | enum | `unknown` |
| `#ora_software_version` text | `ora_metadata.software_version` | string \| null | null |

### 1.5 Corvis inputs

| DOM | Property | Type | Default | Required | Read |
|---|---|---|---|---|---|
| `#corvis_biop` | `corvis_inputs.biop` | number | — | yes | `readRequiredNumber` |
| `#corvis_quality_raw` text | `corvis_inputs.corvis_quality_raw` | string \| null | null | no | `readTrimmedString` |
| `#corvis_ssi` | `corvis_inputs.ssi` | number \| null | null | no | `readOptionalNumber` |
| `#corvis_sp_a1` | `corvis_inputs.sp_a1` | number \| null | null | no | `readOptionalNumber` |

### 1.6 Corvis device metadata — optional accordion

| DOM | Property | Type | Default |
|---|---|---|---|
| `#corvis_software_version` text | `corvis_metadata.software_version` | string \| null | null |
| `#corvis_ssi_version` select SSI/SSIv2/— | `corvis_metadata.ssi_version` | enum \| null | null |
| `#corvis_reference_database` select untreated/post_LVC/unknown | `corvis_metadata.reference_database` | enum | `unknown` |

### 1.7 Temporal context — single Encounter ID, NO auto-validation (closes review §1)

The manual UI exposes one Encounter/session ID control. It populates **only** `measurement_identity.encounter_id`. `shared_encounter_id` is **not** set by the manual UI and is documented as integration-only in Appendix A.

| DOM | Property | Type | Default | Read |
|---|---|---|---|---|
| `#encounter_id` text "Encounter / session ID" | `measurement_identity.encounter_id` | string \| null | null | `readTrimmedString` |
| `#clinician_confirmation` checkbox "Same session, confirmed by clinician" | `clinician_confirmation` | boolean | false | `el.checked` |
| `#gat_timestamp` datetime-local | `gat_timestamp` | ISO 8601 string \| null | null | `readTimestamp` |
| `#ora_timestamp` datetime-local | `ora_timestamp` | ISO 8601 string \| null | null | `readTimestamp` |
| `#corvis_timestamp` datetime-local | `corvis_timestamp` | ISO 8601 string \| null | null | `readTimestamp` |

**Payload rule (manual UI):**

```javascript
const eid = readTrimmedString(form.encounter_id);
payload.measurement_identity.encounter_id = eid;
payload.shared_encounter_id               = null;   // integration-only, never set here
```

**Consequence:** temporal validity for the manual UI is derived **only** from `clinician_confirmation === true`. The engine rule `shared_encounter_id ⇒ comparison_valid` is intentionally unreachable from the manual form. The form makes the clinician confirmation the single, explicit act that authorizes a clinical comparison.

Helper text under the encounter field: "Use the Encounter ID for records only. To validate a clinical comparison, tick 'Same session, confirmed by clinician'."

### 1.8 Clinician-documented preference (Both, optional)

| DOM | Property | Type | Default |
|---|---|---|---|
| `#pref_selected_source` select ORA-IOPcc / Corvis-bIOP / — | `clinician_documented_preference.selected_source` | enum \| null | null |
| `#pref_rationale` textarea | `clinician_documented_preference.rationale` | string \| null | null |
| (auto) | `clinician_documented_preference.timestamp` | ISO 8601 string | see rule |

**Timestamp update rule (closes review §5):**
```javascript
// Run whenever selected_source OR rationale changes (input/change events)
function updatePreferenceTimestamp(state) {
  state.preference.timestamp = new Date().toISOString();
}
// On send, if preference is null/empty, do not include the object in payload.
```

`used_for_export: false` is engine-enforced; the UI never displays the preference in the exported pressure line.

---

## 2. PROGRESSIVE DISCLOSURE

```
Step 1   Device branch
Step 2   Shared clinical inputs (GAT, CCT, eye)
Step 3   Corneal modifiers              (accordion, closed)
Step 4   Device-specific inputs         (revealed by branch)
Step 5   Device metadata                (accordion, closed; per-branch, NOT shared)
Step 6   Temporal context               (collapsed in single; expanded in Both)
Step 7   Compute
```

**Branch switch rule.** Shared (kept on switch, sent for every branch): Step 2, Step 3, Step 6. Per-branch (only active-branch keys in payload): Step 4 (`ora_inputs` or `corvis_inputs`) and Step 5 (`ora_metadata` or `corvis_metadata`).

```javascript
function buildPayload(form, branch) {
  const p = { ...shared(form), device_branch: branch };
  if (branch === 'ora' || branch === 'both') {
    p.ora_inputs   = readORAInputs(form);
    p.ora_metadata = readORAMetadata(form);
  }
  if (branch === 'corvis' || branch === 'both') {
    p.corvis_inputs   = readCorvisInputs(form);
    p.corvis_metadata = readCorvisMetadata(form);
  }
  return p; // no inactive-branch keys anywhere
}
```

The UI MAY locally retain a draft of the inactive branch in form state; it MUST NOT include those keys in the engine payload.

---

## 3. LAYOUT

Single column default at every viewport. ORA/Corvis side-by-side is opt-in only at ≥900 px container width. Default Both order vertical: **ORA → Corvis → cross-device strip**.

---

## 4. RESULT CARDS — full structures (closes review §4)

### 4.1 ORA result card (`SuccessORA`)

```
EXPERIMENTAL · ORA biomechanical context
─────────────────────────────────────────────
Device measurement
  IOPcc                <device_measurement.value_mmhg> mmHg
  vs GAT               Δ <comparison_with_gat.delta_mmhg> mmHg
                       [if comparison_clinically_interpretable === false:
                        "Numerical only · clinical comparison not established"]

Measurement quality       chip: <measurement_quality.level>
Clinical applicability    <clinical_applicability.level>
  [if level === 'limited': list <clinical_applicability.limitations[]>]
Interpretive confidence   <overall_interpretive_confidence>

Biomechanical context
  Corneal Hysteresis   <ch_context.value_mmhg> mmHg
                       <ch_context.interpretation_displayed_to_user>
                       Context only · not used to modify the pressure value

CCT-contextualized Core estimate — not true IOP
  [if applicability !== 'not_applicable']
    <core_reference.display_value_mmhg> mmHg
  [else]
    Not applicable: <core_reference.limitation_reason[0]>

⚑ caution flags (grouped by scope, priority-ordered, severity-styled per §6.1)

Not eligible for target-IOP comparison.
[ Copy ]
```

### 4.2 Corvis result card (`SuccessCorvis`)

```
EXPERIMENTAL · Corvis biomechanical context
─────────────────────────────────────────────
Device measurement
  bIOP                 <device_measurement.value_mmhg> mmHg
  vs GAT               Δ <comparison_with_gat.delta_mmhg> mmHg
                       [if comparison_clinically_interpretable === false:
                        "Numerical only · clinical comparison not established"]

Measurement quality       chip: <measurement_quality.level>
                          tooltip on chip:
                            "Raw label: <raw_device_status>
                             Corvis quality mapping provisional (corvis-map-0.1)"
Clinical applicability    <clinical_applicability.level>
  [if level === 'limited': list <clinical_applicability.limitations[]>]
Interpretive confidence   <overall_interpretive_confidence>

Biomechanical context
  [if additional_biomechanical_parameters !== null:]
    Additional biomechanical parameters
      [if ssi   !== null] SSI:   <ssi>
      [if sp_a1 !== null] SP-A1: <sp_a1> mmHg/mm
      Reference: <reference>   (untreated | post_LVC | unknown)
      Context only · not used to modify the pressure value

CCT-contextualized Core estimate — not true IOP
  [if applicability !== 'not_applicable']
    <core_reference.display_value_mmhg> mmHg
  [else]
    Not applicable: <core_reference.limitation_reason[0]>

⚑ caution flags (grouped by scope, priority-ordered, severity-styled per §6.1)

Not eligible for target-IOP comparison.
[ Copy ]
```

### 4.3 Both result card (`SuccessBoth`) — no per-device Δ vs GAT

The engine returns in Both: `device_measurement: null`, `comparison_with_gat: null`, both `branch_assessments.ora` and `.corvis`, and `device_comparison`. The UI must not synthesize any value the engine did not provide.

```
EXPERIMENTAL · ORA vs Corvis (comparison only)
─────────────────────────────────────────────
Measured GAT IOP   <inputs.gat_iop> mmHg            (echo only, not a result)

[Sub-card] ORA assessment
  IOPcc            <branch_assessments.ora.value_mmhg> mmHg
  Quality / Applicability / Confidence chips
  Corneal Hysteresis: <branch_assessments.ora.biomechanical_context.ch_context.value_mmhg> mmHg
    <interpretation_displayed_to_user>
    Context only · not used to modify the pressure value

[Sub-card] Corvis assessment
  bIOP             <branch_assessments.corvis.value_mmhg> mmHg
  Quality (chip with raw-label tooltip) / Applicability / Confidence chips
  Additional biomechanical parameters (only if populated, per §4.2 rules)

[Strip] Cross-device comparison
  Absolute difference    <device_comparison.absolute_difference_mmhg> mmHg
  Interpretation         <device_comparison.interpretation>
  Comparability          gat_vs_ora ✓/✗ · gat_vs_corvis ✓/✗ · ora_vs_corvis ✓/✗
  Cross-device interpretability  <cross_device_comparison_interpretability>

[Optional] Clinician-documented preference
  Selected: <selected_source>  (rationale; recorded only — not exported as primary)

CCT-contextualized Core estimate — not true IOP   (single line, shared)

⚑ caution flags (grouped by scope, priority-ordered, severity-styled per §6.1)

Not eligible for target-IOP comparison.
[ Copy ]
```

No DOM element is marked as primary/hero. Sub-cards are equal-prominence.

### 4.4 Failure card (`FailureValidation` / `FailureMeasurement`)

```
EXPERIMENTAL · No interpretable result
─────────────────────────────────────────────
⚠ <type humanized: "Input validation" | "Measurement failure">
    <failure.message>
    Code: <failure.code>
    Engine <algorithm_version> · Schema <schema_version>

What to do: <remediation string from §6.2>
```

No large number, no copy button.

---

## 5. (Failure handled in §4.4; section preserved for numbering parity.)

---

## 6. CAUTION-FLAG TABLE + REMEDIATION

### 6.1 Caution-flag strings (frozen)

| Code | Scope(s) | Severity | Displayed string | Priority |
|---|---|---|---|---|
| `experimental_module` | module | info | Experimental module — clinical decision support only, not validated for autonomous use. | 1 |
| `biomechanics_partially_assessed` | module | info | Biomechanical context partially assessed for the selected branch. | 2 |
| `post_refractive_surgery_invalid_linear` | core | warn | Post-refractive surgery: linear CCT correction is not applicable; Core reference omitted. | 3 |
| `post_refractive_surgery_device_interpretation_limited` | ora, corvis | warn | Post-refractive surgery: device-specific interpretation is limited. | 4 |
| `keratoconus_altered_biomechanics` | ora, corvis | warn | Keratoconus / ectasia: corneal biomechanics altered. | 5 |
| `corneal_edema_acute` | ora, corvis | warn | Corneal edema: acute alteration of measurements. | 6 |
| `dystrophy_or_scar_localized` | ora, corvis | warn | Localized dystrophy / scar: clinical applicability limited; consider quality and localization. | 7 |
| `ch_out_of_observed_range` | ora | info | Corneal Hysteresis lies outside the 4–18 mmHg observed range used by this experimental framework; this is not a validated clinical cutoff. | 8 |
| `quality_unreliable` | ora, corvis | warn | Measurement quality is unreliable; repeat measurement recommended. | 9 |
| `quality_low_count` | ora | info | Fewer than 3 ORA measurements: measurement-quality classification capped at acceptable. | 10 |
| `quality_unknown` | corvis | warn | Corvis quality label not recognized (corvis-map-0.1 provisional); interpretive confidence indeterminate. | 11 |
| `cross_device_difference` | cross_device | warn | Cross-device difference exceeds the OFTY design-derived review threshold (>3 mmHg); measurements should not be treated as interchangeable. | 12 |
| `marked_difference_vs_gat` | ora_vs_gat, corvis_vs_gat | warn | Difference versus GAT exceeds the OFTY design-derived review threshold (>8 mmHg); verify timing, acquisition and data source. | 13 |
| `temporal_comparison_invalid` | ora, corvis, cross_device, ora_vs_gat, corvis_vs_gat | info | Temporal comparison not validated; numerical only. | 14 |

`info` = neutral chip; `warn` = amber chip with icon (palette unchanged).

### 6.2 Failure-code remediation (frozen)

| Code | Type | Remediation |
|---|---|---|
| `INVALID_DEVICE_BRANCH` | validation | Select a device branch (ORA, Corvis, or Both). |
| `MISSING_REQUIRED_FIELD` | validation | A required field is missing or invalid. Check eye laterality, corneal modifiers, ORA provenance and required device fields. |
| `BRANCH_BOTH_INCOMPLETE` | validation | Both-branch requires complete ORA and Corvis inputs. Switch to a single-device branch if only one device is available. |
| `EYE_MISMATCH` | validation | Eye laterality mismatch between inputs. This module evaluates one eye at a time. |
| `ORA_VALUES_NOT_SAME_RESULT` | validation | Confirm that the ORA values were taken from a single device result before computing. |
| `OUT_OF_HARD_RANGE` | validation | Review the numerical inputs and their permitted ranges. |
| `ORA_NO_USABLE_WAVEFORM` | measurement | ORA did not return a usable waveform. Acquire a new reading. |
| `CORVIS_UNREADABLE` | measurement | Corvis reading was not interpretable. Acquire a new reading. |
| `DEVICE_ERROR` | measurement | Device error reported. Repeat the measurement. |
| `CLINICIAN_INVALIDATED` | measurement | Reading invalidated by clinician. |

---

## 7. COPY / EXPORT

### 7.0 Formatting contract — corrected helpers (closes review §3)

```javascript
// Pressures: IOP, IOPcc, bIOP, GAT, CH, Core estimate
const fmtPressure = n => `${n.toFixed(1)} mmHg`;

// Scalars (SSI is dimensionless)
const fmtSSI = n => n.toFixed(1);

// SP-A1 carries unit mmHg/mm
const fmtSPA1 = n => `${n.toFixed(1)} mmHg/mm`;

// CCT: integer
const fmtCCT = n => `${Math.round(n)} µm`;

// Δ values: explicit sign + one decimal; near-zero forced to "+0.0"
function fmtDelta(n) {
  if (Math.abs(n) < 0.05) return '+0.0';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
}

// Newline always "\n"; field separator " | "; locale-independent "." decimal
```

| Item | Format | Examples |
|---|---|---|
| Pressures, CH, Core estimate | `fmtPressure` | `18.0 mmHg`, `10.0 mmHg` |
| Δ values | `fmtDelta` | `+0.2`, `-1.5`, `+0.0` (never `-0.0`, never `0.0` without sign) |
| SSI | `fmtSSI` | `1.1` |
| SP-A1 | `fmtSPA1` | `95.0 mmHg/mm` |
| CCT | `fmtCCT` | `540 µm` |
| Field separator (one-line pairs) | ` | ` | `GAT IOP: 18.0 mmHg | CCT: 540 µm` |
| Newline | `\n` | — |

### 7.1 ORA export

```
OFTY M1 Advanced (experimental) — ORA
Eye: OD
GAT IOP: 18.0 mmHg | CCT: 540 µm
IOPcc: 18.2 mmHg (Δ vs GAT +0.2)
Corneal Hysteresis: 10.0 mmHg (prognostic context; does not modify pressure)
Measurement quality: high · Applicability: standard · Confidence: high
CCT-contextualized Core estimate — not true IOP: 18.0 mmHg
Not eligible for target-IOP comparison.
Generated with OFTY M1 Advanced 0.4.3-experimental
```

When `comparison_clinically_interpretable === false`, suffix the Δ vs GAT line:
```
IOPcc: 18.2 mmHg (Δ vs GAT +0.2, numerical only · clinical comparison not established)
```

### 7.2 Corvis export (new, closes review §4)

```
OFTY M1 Advanced (experimental) — Corvis
Eye: OD
GAT IOP: 16.0 mmHg | CCT: 600 µm
Corvis bIOP: 14.5 mmHg (Δ vs GAT -1.5)
Measurement quality: acceptable · Applicability: standard · Confidence: moderate
[if SSI populated]   SSI: 1.1 (context only)
[if SP-A1 populated] SP-A1: 95.0 mmHg/mm (context only)
CCT-contextualized Core estimate — not true IOP: 13.6 mmHg
Not eligible for target-IOP comparison.
Generated with OFTY M1 Advanced 0.4.3-experimental
```

`numerical only` suffix added to the Δ vs GAT line when `comparison_clinically_interpretable === false`, exactly as in §7.1.

### 7.3 Both export

```
OFTY M1 Advanced (experimental) — ORA vs Corvis
Eye: OD
Measured GAT IOP: 16.0 mmHg | CCT: 540 µm
ORA IOPcc: 18.0 mmHg
Corvis bIOP: 22.0 mmHg
Cross-device difference: 4.0 mmHg
<device_comparison.interpretation>
CCT-contextualized Core estimate — not true IOP: 16.0 mmHg
Not eligible for target-IOP comparison.
Generated with OFTY M1 Advanced 0.4.3-experimental
```

No per-device Δ vs GAT (engine does not return it for Both). The cross-device line uses the engine's `interpretation` string verbatim.

### 7.4 Conditional rules (applied in order during export build)

1. If `core_reference.applicability === 'not_applicable'` → replace the Core line with:
   `CCT-contextualized Core estimate — not true IOP: not applicable (<first limitation_reason>)`
2. **Single-branch only** (ORA, Corvis): if `comparison_with_gat.comparison_clinically_interpretable === false`, suffix the Δ vs GAT line with `(numerical only · clinical comparison not established)`.
3. **Both**: no per-device Δ vs GAT line is emitted; the cross-device line uses the engine's `interpretation` verbatim.

### 7.5 Failure export
Not exportable; the copy button is not rendered.

---

## 8. BROWSER INTEGRATION CONTRACT (closes review §2)

### 8.1 Delivery

```
project root/
├── index.html                       single-page UI
├── m1_advanced_browser_entry.js     entry point (NEW — the bundle source)
├── m1_advanced_bundle.js            built from the entry point
├── build.manifest.json              SHA-256 of sources/bundle + tooling versions
└── m1_advanced_schema.json          shipped alongside as auditable artifact
```

The bundle is built from a **browser entry point**, not from the engine alone. The entry collects everything the UI needs so a single global object satisfies the contract end-to-end.

### 8.2 Browser entry point

```javascript
// m1_advanced_browser_entry.js
const engine        = require('./m1_advanced_engine.js');
const adapterModule = require('./m1_advanced_storage_adapter.js');
const Ajv           = require('ajv/dist/2020');
const addFormats    = require('ajv-formats');
const schema        = require('./m1_advanced_schema.json');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateOutput = ajv.compile(schema);

function createStorageAdapter(storage) {
  // mandatory validator injection — matches the frozen adapter contract
  return adapterModule.createM1AdvancedStorageAdapter(storage, validateOutput);
}

module.exports = {
  computeM1Advanced:    engine.computeM1Advanced,
  createStorageAdapter,
  validateOutput,
  CONSTANTS:            engine.CONSTANTS
};
```

Build command:
```
esbuild m1_advanced_browser_entry.js \
  --bundle --format=iife --global-name=M1ADV \
  --target=es2020 \
  --outfile=m1_advanced_bundle.js
```

The resulting global exposes:
- `M1ADV.computeM1Advanced(payload)` — same signature as the frozen engine
- `M1ADV.createStorageAdapter(storage)` — already pre-injected with the AJV validator
- `M1ADV.validateOutput(obj)` — for U17/U20 acceptance tests
- `M1ADV.CONSTANTS` — for the load-time smoke test

The schema JSON is **embedded in the bundle** via `require('./m1_advanced_schema.json')`. The external copy in §8.1 is shipped as an auditable artifact, not as a runtime dependency.

### 8.3 build.manifest.json content

```json
{
  "freeze_version": "v0.4.5",
  "engine_algorithm_version": "0.4.3-experimental",
  "schema_version": "M1-ADV-SCHEMA-1.3",
  "sources": {
    "m1_advanced_engine.js":            "<sha-256>",
    "m1_advanced_schema.json":          "<sha-256>",
    "m1_advanced_storage_adapter.js":   "<sha-256>",
    "m1_advanced_browser_entry.js":     "<sha-256>"
  },
  "bundle": {
    "filename": "m1_advanced_bundle.js",
    "sha256":   "<sha-256>",
    "size_bytes": 0
  },
  "build": {
    "bundler":         "esbuild",
    "bundler_version": "<x.y.z>",
    "command": "esbuild m1_advanced_browser_entry.js --bundle --format=iife --global-name=M1ADV --target=es2020 --outfile=m1_advanced_bundle.js",
    "target_browsers": "Chrome >=100, Firefox >=100, Safari >=15, Edge >=100",
    "ajv_version":     "<x.y.z>",
    "ajv_formats_version": "<x.y.z>"
  },
  "freeze_reports_sha256": {
    "m1_advanced_test_report.json":          "<sha-256>",
    "m1_advanced_storage_test_report.json":  "<sha-256>",
    "m1_advanced_fuzz_report.json":          "<sha-256>",
    "m1_advanced_version_sync_report.json":  "<sha-256>"
  }
}
```

### 8.4 Load-time smoke test

On `window.load`:
- `M1ADV.CONSTANTS.ALG_VERSION` must equal `build.manifest.json.engine_algorithm_version`.
- `M1ADV.CONSTANTS.SCHEMA_VERSION` must equal `build.manifest.json.schema_version`.
- Mismatch → page refuses to compute and shows a manifest-mismatch banner.

### 8.5 Single source of clinical logic
The HTML calls `M1ADV.computeM1Advanced(payload)`. It NEVER reimplements normalization, validation, computation, or schema checks. The UI is a thin renderer over the bundled frozen engine.

---

## 9. ACCEPTANCE TESTS — U1–U21

### 9.1 Engine + integration tests

| # | Given | UI must render |
|---|---|---|
| U1 | Valid ORA, high quality | ORA card; quality chip "high"; no error styling |
| U2 | CH = 20 | "outside observed range (4–18)" note; not an error; no coefficient |
| U3 | Corvis raw label `"ZZZ"` | quality chip "unknown" + tooltip "mapping provisional (corvis-map-0.1)"; raw label shown |
| U4 | Both, identical values | strip: `No marked cross-device difference detected.` |
| U5 | Both, diff>3, no temporal confirmation | strip: `Numerical difference shown; clinical comparison not established.`; neutral tint |
| U6 | `prior_refractive_surgery: "LASIK"` | Core estimate: `Not applicable: …`; device card applicability `limited`; §6.1 flag string |
| U7 | Measurement failure (integration only — payload includes `measurement_failure`) | failure card per §4.4; no large number; no copy button |
| U8 | Provenance attestation unchecked | compute button disabled; helper "Confirm ORA same-result attestation"; no result card |
| U9 | Any success | "Not eligible for target-IOP comparison" visible |
| U10 | Eye mismatch (integration only — payload includes `ora_inputs.eye` differing from `measurement_identity.eye`) | engine `EYE_MISMATCH`; failure card with §6.2 string |
| U11 | success → invalid → re-compute | previous result removed before failure card |
| U12 | Branch switch ORA → Corvis | payload contains neither `ora_inputs` nor `ora_metadata` |
| U13 | Any Advanced compute + persist | `localStorage['ofty_m1_result']` byte-identical before/after |
| U14 | Advanced storage holds corrupt JSON | adapter returns `{ok:false, reason:'corrupt_json'}`; recoverable state, no crash |
| U15 | `core_reference.applicability === 'not_applicable'` | NO Core number anywhere |
| U16 | Both result | no DOM element marked as primary/hero |
| U17 | Copy in three conditions (not_applicable, invalid_temporal, Both) | matches §7 byte-for-byte using §7.0 formatting |

### 9.2 UI-only tests

| # | Test | Pass criterion |
|---|---|---|
| U18 | Accessibility | Tab order: branch → shared → modifiers → device inputs → temporal → compute. On engine failure, focus moves to failure card heading. Result card has `aria-live="polite"` |
| U19 | Responsive | At 320 px width, no horizontal overflow. At any viewport, Both order remains ORA → Corvis → cross-device |
| U20 | Formatting | Every rendered and exported number satisfies §7.0 helpers individually: pressures (`fmtPressure`), Δ (`fmtDelta`, including `+0.0` for `Math.abs(n) < 0.05` with positive sign), SSI (`fmtSSI`, no unit), SP-A1 (`fmtSPA1`, `mmHg/mm`), CCT (`fmtCCT`, integer) |

### 9.3 Manual-UI semantic test (closes review §1)

| # | Test | Pass criterion |
|---|---|---|
| U21 | Manual UI never auto-validates comparison via Encounter ID | Filling Encounter ID alone (no clinician confirmation) produces `comparison_context.basis === 'unconfirmed'` and `comparison_valid === false`; only ticking `clinician_confirmation` yields `clinician_confirmed_same_session` / `true` |

---

## APPENDIX A — INTEGRATION-ONLY PAYLOAD FIELDS

These fields are accepted by the engine but **never set by the manual UI**. They exist for programmatic integration (EHR adapters, device middleware). U7, U10 and the `shared_encounter_id` semantics are integration-only tests/payloads.

| Field | Type | Engine behaviour | Why not in manual UI |
|---|---|---|---|
| `shared_encounter_id` | string \| null | When non-null, engine sets `basis: 'shared_encounter_id'` and `comparison_valid: true` | The manual UI cannot guarantee that measurements truly belong to the same encounter; only middleware can. Letting a free-text field do this would auto-validate a clinical comparison without explicit clinician intent |
| `measurement_failure.occurred` | boolean | Signals device-side measurement failure | The clinician using the manual form would not "declare" a device failure; they would simply not have a reading |
| `measurement_failure.code` | enum (4 codes) | Routes to `FailureMeasurement` | Same as above |
| `measurement_failure.message` | string | Human message in failure | Same as above |
| `ora_inputs.eye` | enum | Cross-checked vs `measurement_identity.eye` | The manual UI declares eye once at the top; no second laterality input exists |
| `corvis_inputs.eye` | enum | Same | Same |

---

## 10. APPROVAL GATE

```
Final sign-off:

[ ] §0     OFTY DS v1 byte-for-byte; clinical constraints intact
[ ] §1.0   Numeric reads + readTimestamp + readTrimmedString; no parseInt/parseFloat
[ ] §1.1–1.6  Input-payload tables complete
[ ] §1.7   Single Encounter ID populates ONLY measurement_identity.encounter_id;
             shared_encounter_id NEVER set by manual UI;
             temporal validity derives only from clinician_confirmation
[ ] §1.8   Preference timestamp = new Date().toISOString() on selected_source/rationale change
[ ] §2     Branch switch: per-branch inputs AND metadata, only active-branch keys in payload
[ ] §3     Single-column default; >=900px optional two-column for Both
[ ] §4.1   Full ORA card structure
[ ] §4.2   Full Corvis card structure (incl. SSI/SP-A1 + reference)
[ ] §4.3   Full Both card structure; no per-device Δ vs GAT; no hero number
[ ] §4.4   Failure card (no numeric protagonist, no copy)
[ ] §6.1   14 caution-flag strings, scopes, severities, priorities
[ ] §6.2   10 failure-code remediation strings
[ ] §7.0   Split helpers: fmtPressure, fmtSSI, fmtSPA1, fmtCCT, fmtDelta (with +0.0 protection)
[ ] §7.1   ORA export sample + invalid-temporal suffix rule
[ ] §7.2   Corvis export sample + invalid-temporal suffix rule
[ ] §7.3   Both export sample, no per-device Δ vs GAT
[ ] §7.4   Three conditional export rules
[ ] §8.1   Delivery: index.html + browser_entry + bundle + manifest + schema
[ ] §8.2   Browser entry bundles engine + adapter + AJV + formats + schema
[ ] §8.3   build.manifest.json content
[ ] §8.4   Load-time smoke test (version match or refuse to compute)
[ ] §9     U1–U21 as the UI contract (includes U21 semantic test)
[ ] App. A Integration-only fields documented (incl. shared_encounter_id)

Sign-off: Andrea Ragosta, MD, FEBO   Date: 17 June 2026
Status:   UI CONTRACT FROZEN
Implementation: AUTHORIZED
Next conversation: "M1 Advanced — Browser implementation and UI freeze"
```
