# M1 Advanced — Formal U1–U21 Browser Acceptance Report

- Generated: 2026-06-18T09:31:42.326Z
- Node: v22.22.2 · Playwright Chromium: 141.0.7390.37
- index.html SHA-256: `3e3f4d0bf66715b4ee0b3bdd01cc19aa16d372129da50962b97b8f3406e5e7e8`
- bundle SHA-256: `9f9a0fe47c8285804268532634593c27539083a811e31e32bf71b33ad5f78ffd`

**Summary — passed: 28 · failed: 0 · not executed: 0 · total: 28**

## U8 — PASS

- **Purpose:** Provenance attestation unchecked blocks compute
- **Input:** ORA fields valid, ora_provenance_confirmed = false
- **Expected:** compute disabled; helper "Confirm ORA same-result attestation"; no result card
- **Observed:** disabled=true; helper="Confirm ORA same-result attestation"; resultCard=false

## U1 — PASS

- **Purpose:** Valid ORA high quality renders ORA card with quality "high", no error styling
- **Input:** ORA gat=18 cct=540 iopcc=18.2 ch=10 wfs=7.5 count=4, confirmed
- **Expected:** ORA result card; quality level "high"; no failure-card
- **Observed:** IOPcc rendered=true; qualityHigh=true; failureCard=false
- **Evidence:** `acceptance_screenshots/U1_ora_success.png`

## U9 — PASS

- **Purpose:** Any success shows the not-eligible-for-target-IOP line
- **Input:** ORA success (from U1)
- **Expected:** text "Not eligible for target-IOP comparison" visible
- **Observed:** present=true

## U2 — PASS

- **Purpose:** CH=20 shows out-of-observed-range note (not an error), CH carries no coefficient
- **Input:** ORA with ch=20
- **Expected:** note "outside the 4-18 mmHg observed range"; success (no failure); CH non-modifying
- **Observed:** failureCard=false; rangeNote=true; nonModifying=true
- **Evidence:** `acceptance_screenshots/U2_ch_out_of_range.png`

## U3 — PASS

- **Purpose:** Unrecognized Corvis label -> quality "unknown" + provisional-mapping tooltip; raw label retained in form
- **Input:** Corvis raw_quality_label="ZZZ"
- **Expected:** quality chip "unknown"; tooltip contains "mapping provisional (corvis-map-0.1)"; raw label shown
- **Observed:** qualityUnknown=true; tooltip="Raw label: ZZZ\nCorvis quality mapping provisional (corvis-map-0.1)"; rawInputRetained=true
- **Evidence:** `acceptance_screenshots/U3_corvis_unknown.png`

## U4 — PASS

- **Purpose:** Both with identical device values shows no-difference strip
- **Input:** Both ora=18 corvis=18
- **Expected:** strip "No marked cross-device difference detected."
- **Observed:** present=true

## U5 — PASS

- **Purpose:** Both diff>3 without temporal confirmation -> unconfirmed strip, neutral tint
- **Input:** Both ora=18 corvis=22 (diff 4), clinician_confirmation=false
- **Expected:** strip "Numerical difference shown; clinical comparison not established."; neutral (non-warning) tint
- **Observed:** strip=true; neutralTint=true
- **Evidence:** `acceptance_screenshots/U5_both_unconfirmed.png`

## U6 — PASS

- **Purpose:** Prior LASIK -> Core estimate not applicable; device applicability "limited"; refractive flag string
- **Input:** ORA with prior_refractive_surgery=LASIK
- **Expected:** Core "not applicable"; applicability "limited"; section 6.1 refractive flag
- **Observed:** coreNotApplicable=true; applicabilityLimited=true; flag=true
- **Evidence:** `acceptance_screenshots/U6_lasik.png`

## U7 — PASS

- **Purpose:** Integration measurement_failure payload routes to failure; failure card shows no large number and no copy button
- **Input:** engine payload measurement_failure.occurred=true (integration only) + UI-reachable failure for card semantics
- **Expected:** engine status failure (type measurement_failure); failure card; no large mmHg number; no copy button
- **Observed:** engine={"status":"failure","code":"DEVICE_ERROR","type":"measurement_failure"}; noCopyBtn=true; noBigNumber=true
- **Evidence:** `acceptance_screenshots/U7_measurement_failure.png`

## U10 — PASS

- **Purpose:** Integration eye-mismatch payload routes to EYE_MISMATCH failure with remediation message
- **Input:** ora_inputs.eye=OS vs measurement_identity.eye=OD (integration only)
- **Expected:** engine failure code EYE_MISMATCH with section 6.2 remediation string
- **Observed:** engine={"status":"failure","code":"EYE_MISMATCH","message":"Laterality mismatch between inputs; single-eye module."}

## U11 — PASS

- **Purpose:** Recompute into a failure clears the previous success card first (U11 clearing)
- **Input:** ORA success, then gat_iop=999 invalid, recompute
- **Expected:** no .result-card remains; exactly one .failure-card
- **Observed:** hadResult=true; resultCardsAfter=0; failureCards=1

## U12 — PASS

- **Purpose:** Switching ORA->Corvis emits a Corvis payload with no ora_inputs / ora_metadata keys
- **Input:** fill ORA, switch device_branch to corvis, fill Corvis, compute (real payload captured at M1ADV.computeM1Advanced)
- **Expected:** payload sent to engine: device_branch=corvis, no ora_inputs key, no ora_metadata key
- **Observed:** payload.branch=corvis; hasOraInputsKey=false; hasOraMetadataKey=false; payloadKeys=[gat_iop,cct,measurement_identity,keratoconus_ectasia,corneal_edema,significant_dystrophy_or_scar,prior_refractive_surgery,shared_encounter_id,clinician_confirmation,gat_timestamp,ora_timestamp,corvis_timestamp,device_branch,corvis_inputs,corvis_metadata]

## U13 — PASS

- **Purpose:** Advanced never writes the Core key: ofty_m1_result stays byte-identical (or absent); only ofty_m1_advanced_result is written
- **Input:** seed ofty_m1_result sentinel then Advanced compute (Case A); empty storage then Advanced compute (Case B)
- **Expected:** Case A: ofty_m1_result unchanged + ofty_m1_advanced_result written; Case B: ofty_m1_result absent + only ofty_m1_advanced_result among ofty_m1* keys
- **Observed:** A.coreIdentical=true; A.advWritten=true; B.coreAbsent=true; B.ofty_keys=ofty_m1_advanced_result

## U14 — PASS

- **Purpose:** Corrupt Advanced JSON yields adapter {ok:false, reason:"corrupt_json"} and the UI recovers (no crash)
- **Input:** seed ofty_m1_advanced_result with invalid JSON, read via adapter, then recompute
- **Expected:** adapter returns {ok:false, reason:"corrupt_json"}; subsequent compute writes valid JSON
- **Observed:** adapter={"ok":false,"reason":"corrupt_json"}; recoveredValidJSON=true

## U15 — PASS

- **Purpose:** When Core applicability is not_applicable, no Core IOP number appears (rendered or exported)
- **Input:** ORA LASIK (core_reference.applicability=not_applicable)
- **Expected:** no "not true IOP: <number>" anywhere in card or copied text
- **Observed:** noCoreNumberRendered=true; noCoreNumberExport=true

## U16 — PASS

- **Purpose:** Both result has no DOM element marked as primary/hero (no single device is elevated)
- **Input:** Both success
- **Expected:** zero elements with primary/hero class/data/role markers
- **Observed:** markerCount=0
- **Evidence:** `acceptance_screenshots/U16_both_no_primary.png`

## U17 — PASS

- **Purpose:** Copy (ORA canonical) matches spec section 7.1 byte-for-byte
- **Input:** ORA gat=18 cct=540 iopcc=18.2 ch=10 confirmed -> Copy
- **Expected:** copied text === spec section 7.1 fenced block (byte-for-byte, from spec file)
- **Observed:** EXACT MATCH

## U17 — PASS

- **Purpose:** Copy (invalid temporal, single-branch ORA) suffixes the delta line per section 7.4 rule 2, byte-for-byte
- **Input:** ORA unconfirmed (comparison_clinically_interpretable=false) -> Copy
- **Expected:** copied === spec 7.1 with IOPcc line replaced by the spec 7.1 suffixed line
- **Observed:** EXACT MATCH

## U17 — PASS

- **Purpose:** Copy (Core not_applicable) replaces the Core line per section 7.4 rule 1, byte-for-byte
- **Input:** ORA LASIK -> Copy
- **Expected:** copied contains exact line "CCT-contextualized Core estimate — not true IOP: not applicable (<reason>)" and no Core number
- **Observed:** EXACT LINE MATCH: "CCT-contextualized Core estimate — not true IOP: not applicable (Post-refractive surgery (LASIK): GAT-CCT linear model invalidated; device interpretation requires review.)"

## U17 — PASS

- **Purpose:** Copy (Both) matches spec section 7.3 byte-for-byte with engine interpretation substituted
- **Input:** Both gat=16 cct=540 ora=18 corvis=22 confirmed -> Copy
- **Expected:** copied === spec 7.3 block with <device_comparison.interpretation> replaced by engine string
- **Observed:** EXACT MATCH

## U18 — PASS

- **Purpose:** Accessibility: DOM tab order branch->shared->modifier->device->temporal->compute; failure moves focus into failure card; result region aria-live=polite
- **Input:** Tab from #device_branch with temporal accordion open; then trigger failure
- **Expected:** focus order is a subsequence of the canonical order and reaches compute; focus inside failure card on failure; aria-live="polite"
- **Observed:** tabSequence=device_branch>gat_iop>cct>prior_refractive_surgery>ora_iopcc>ora_ch>ora_wfs>ora_count>ora_provenance_confirmed>encounter_id>clinician_confirmation>compute_btn; subsequence=true; reachedCompute=true; focusInFailureCard=true; ariaLive=polite

## U19 — PASS

- **Purpose:** At 320px width there is no horizontal overflow and Both order is ORA->Corvis->cross-device
- **Input:** viewport 320x800, Both result
- **Expected:** documentElement.scrollWidth <= innerWidth; text order ORA < Corvis < cross-device
- **Observed:** scrollW=320 inner=320 noOverflow=true; order(iORA,iCorvis,iCross)={"iORA":15,"iCorvis":22,"iCross":629} orderOk=true
- **Evidence:** `acceptance_screenshots/U19_responsive_320.png`

## U20 — PASS

- **Purpose:** Every rendered/exported number matches section 7.0 helpers; no clinical number appears that the engine did not return; near-zero delta forced to "+0.0"
- **Input:** Corvis export (pressures, CCT integer, SP-A1 mmHg/mm, SSI bare, delta) + engine-number cross-check
- **Expected:** pressures "x.x mmHg"; CCT "n µm"; SP-A1 "x.x mmHg/mm"; SSI bare; delta signed; all clinical tokens engine-returned; fmtDelta(0)/(-0.04)="+0.0"
- **Observed:** fmtOk=true; engineNums=[14.5,16.0,-1.5,600.0,13.6,1.1,95.0]; exportClinicalTokens=[16.0,600.0,14.5,95.0,13.6]; allFromEngine=true; zeroSignRule=true

## U21 — PASS

- **Purpose:** Encounter ID alone does NOT validate the comparison; only clinician_confirmation=true does
- **Input:** Both with encounter_id="ENC-123", clinician_confirmation=false then true
- **Expected:** unconfirmed: basis="unconfirmed", comparison_valid=false; confirmed: basis="clinician_confirmed_same_session", comparison_valid=true
- **Observed:** encounterOnly={"basis":"unconfirmed","valid":false}; afterConfirmation={"basis":"clinician_confirmed_same_session","valid":true}

## U8b — PASS

- **Purpose:** Tampered manifest ALG_VERSION blocks compute (load-time integrity gate)
- **Input:** served manifest with wrong engine_algorithm_version
- **Expected:** banner shown + compute disabled + detail matches /ALG_VERSION/
- **Observed:** bannerVisible=true; computeDisabled=true; detail="ALG_VERSION 0.4.3-experimental ≠ manifest 0.0.0-not-the-real-version"

## U8c — PASS

- **Purpose:** Tampered manifest bundle SHA-256 blocks compute
- **Input:** served manifest with wrong bundle hash
- **Expected:** banner shown + compute disabled + detail matches /bundle SHA-256/
- **Observed:** bannerVisible=true; computeDisabled=true; detail="bundle SHA-256 9f9a0fe47c82… ≠ manifest deadbeefdead…"

## U8d — PASS

- **Purpose:** Tampered schema $id + hash blocks compute (vs manifest AND vs M1ADV.CONSTANTS)
- **Input:** served schema with altered $id
- **Expected:** banner shown + compute disabled + detail matches /(schema SHA-256|schema \$id)/
- **Observed:** bannerVisible=true; computeDisabled=true; detail="schema SHA-256 e7c90ab1028e… ≠ manifest fbd983b1a443… · schema $id M1-ADV-SCHEMA-BOGUS ≠ manifest.schema_version M1-ADV-SCHEMA-1.3 · schema $id M1-ADV-SCHEMA-BOGUS ≠ M1ADV.CONSTANTS.SCHEMA_VERSION M1-ADV-SCHEMA-1.3"

## UX — PASS

- **Purpose:** No uncaught console/page errors during canonical acceptance flow
- **Input:** all canonical (non-tamper) interactions above
- **Expected:** zero console errors / page errors
- **Observed:** none

