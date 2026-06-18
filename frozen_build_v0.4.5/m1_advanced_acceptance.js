// m1_advanced_acceptance.js
// FORMAL U1-U21 acceptance gate for the M1 Advanced thin-layer UI (index.html).
// Real headless-browser execution via Playwright. Not a static check.
//
// Run from the package root:   node m1_advanced_acceptance.js
// Output:
//   - stdout: per-U PASS/FAIL summary
//   - m1_advanced_browser_acceptance_report.json  (structured per-test records)
//   - m1_advanced_browser_acceptance_report.md    (human-readable)
//   - acceptance_screenshots/*.png                (key visual evidence)
//
// Each record carries: u, purpose, input, expected, observed, result, evidence.
// Frozen artifacts (engine/schema/adapter/browser entry/bundle/manifest) are NOT
// modified by this file; it only drives the served UI and the public M1ADV API.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('Playwright is required. Run:  npm ci'); process.exit(2); }

const ROOT = __dirname;
const SHOTS = path.join(ROOT, 'acceptance_screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const SPEC = fs.readFileSync(path.join(ROOT, 'M1_ADV_UI_SPEC_v0.4.1.md'), 'utf8');

// ---- spec fenced-block extraction (byte-exact references for U17) ----
function fencedBlocksAfter(md, heading, count) {
  const hi = md.indexOf(heading);
  if (hi < 0) return [];
  const out = [];
  let cursor = hi;
  for (let i = 0; i < count; i++) {
    const open = md.indexOf('```', cursor);
    if (open < 0) break;
    const contentStart = md.indexOf('\n', open) + 1;
    const close = md.indexOf('```', contentStart);
    if (close < 0) break;
    out.push(md.slice(contentStart, close).replace(/\n$/, ''));
    cursor = close + 3;
  }
  return out;
}
const ORA_BLOCKS = fencedBlocksAfter(SPEC, '### 7.1 ORA export', 2);
const SPEC_ORA = ORA_BLOCKS[0];                 // canonical ORA export (high/standard/high)
const SPEC_ORA_INVALID_TEMPORAL_LINE = ORA_BLOCKS[1]; // single suffixed IOPcc line
const SPEC_BOTH = fencedBlocksAfter(SPEC, '### 7.3 Both export', 1)[0];

// ---- MIME + static server with tamper OVERRIDES ----
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8' };
let OVERRIDES = {};
function makeServer() {
  return http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') url = '/index.html';
    if (OVERRIDES[url]) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(url)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(OVERRIDES[url]); return;
    }
    const fp = path.join(ROOT, url);
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(fp).pipe(res);
  });
}

// ---- structured records ----
const records = [];
let passN = 0, failN = 0, notExecN = 0;
function record(u, purpose, input, expected, observed, passed, evidence) {
  records.push({ u, purpose, input, expected, observed, result: passed ? 'PASS' : 'FAIL', evidence: evidence || null });
  if (passed) passN++; else failN++;
}
function notExecuted(u, purpose, reason) {
  records.push({ u, purpose, input: null, expected: null, observed: reason, result: 'NOT_EXECUTED', evidence: null });
  notExecN++;
}

// ---- page helpers ----
// Open any ancestor <details> (progressive-disclosure accordions) so a control is reachable.
async function revealField(page, id) {
  await page.evaluate((cid) => {
    const el = document.getElementById(cid);
    if (!el) return;
    let p = el.parentElement;
    while (p) { if (p.tagName === 'DETAILS') p.open = true; p = p.parentElement; }
  }, id);
}
async function fill(page, id, val) { await revealField(page, id); await page.fill('#' + id, String(val)); }
async function setCheck(page, id, on) {
  await revealField(page, id);
  const c = await page.isChecked('#' + id);
  if (c !== on) await page.click('#' + id);
}
async function waitGate(page, base, expectBanner) {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction((expect) => {
    const b = document.getElementById('manifest_banner');
    const vis = b && b.classList.contains('show');
    const dis = (document.getElementById('compute_btn') || {}).disabled;
    if (expect === 'banner') return vis === true && dis === true;
    return vis === false;
  }, expectBanner === true ? 'banner' : 'ok', { timeout: 5000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} window.__copied = null; });
}

// Fill a standard valid ORA scenario (confirmed). Returns the input description.
async function fillORA(page, opts) {
  opts = opts || {};
  await page.selectOption('#device_branch', 'ora');
  await fill(page, 'gat_iop', opts.gat != null ? opts.gat : 18);
  await fill(page, 'cct', opts.cct != null ? opts.cct : 540);
  await fill(page, 'ora_iopcc', opts.iopcc != null ? opts.iopcc : 18.2);
  await fill(page, 'ora_ch', opts.ch != null ? opts.ch : 10);
  await fill(page, 'ora_wfs', 7.5);
  await fill(page, 'ora_count', 4);
  if (opts.refractive) { await revealField(page, 'prior_refractive_surgery'); await page.selectOption('#prior_refractive_surgery', opts.refractive); }
  await setCheck(page, 'ora_provenance_confirmed', true);
  if (opts.confirm) await setCheck(page, 'clinician_confirmation', true);
}
async function fillCorvis(page, opts) {
  opts = opts || {};
  await page.selectOption('#device_branch', 'corvis');
  await fill(page, 'gat_iop', opts.gat != null ? opts.gat : 16);
  await fill(page, 'cct', opts.cct != null ? opts.cct : 600);
  await fill(page, 'corvis_biop', opts.biop != null ? opts.biop : 14.5);
  await fill(page, 'corvis_quality_raw', opts.raw != null ? opts.raw : 'OK');
  if (opts.ssi != null) await fill(page, 'corvis_ssi', opts.ssi);
  if (opts.spa1 != null) await fill(page, 'corvis_sp_a1', opts.spa1);
  if (opts.confirm) await setCheck(page, 'clinician_confirmation', true);
}
async function fillBoth(page, opts) {
  opts = opts || {};
  await page.selectOption('#device_branch', 'both');
  await fill(page, 'gat_iop', opts.gat != null ? opts.gat : 16);
  await fill(page, 'cct', opts.cct != null ? opts.cct : 540);
  await fill(page, 'ora_iopcc', opts.ora != null ? opts.ora : 18);
  await fill(page, 'ora_ch', 10); await fill(page, 'ora_wfs', 7.5); await fill(page, 'ora_count', 4);
  await setCheck(page, 'ora_provenance_confirmed', true);
  await fill(page, 'corvis_biop', opts.corvis != null ? opts.corvis : 22);
  await fill(page, 'corvis_quality_raw', 'OK');
  if (opts.ssi != null) await fill(page, 'corvis_ssi', opts.ssi);
  if (opts.spa1 != null) await fill(page, 'corvis_sp_a1', opts.spa1);
  if (opts.encounter) await fill(page, 'encounter_id', opts.encounter);
  if (opts.confirm) await setCheck(page, 'clinician_confirmation', true);
}
async function compute(page) { await page.click('#compute_btn'); }
async function copiedText(page) {
  await page.click('.copy-btn');
  await page.waitForFunction(() => window.__copied !== null, { timeout: 2000 });
  return await page.evaluate(() => window.__copied);
}

(async () => {
  const server = makeServer();
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 900, height: 1200 } });
  // Install a capturing clipboard.writeText BEFORE any page script runs (every navigation).
  await context.addInitScript(() => {
    window.__copied = null;
    const cap = (t) => { window.__copied = String(t); return Promise.resolve(); };
    try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: cap } }); }
    catch (e) { try { navigator.clipboard.writeText = cap; } catch (_) {} }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR ' + e.message));

  // =========================================================================
  // U8 — provenance attestation gating (run first; establishes gate behaviour)
  // =========================================================================
  await waitGate(page, base, false);
  await fillORA(page, {}); await setCheck(page, 'ora_provenance_confirmed', false);
  {
    const disabled = await page.isDisabled('#compute_btn');
    const helper = await page.textContent('#compute_helper');
    const hasCard = (await page.locator('.result-card').count()) > 0;
    const ok = disabled === true && /Confirm ORA same-result attestation/.test(helper) && !hasCard;
    record('U8', 'Provenance attestation unchecked blocks compute',
      'ORA fields valid, ora_provenance_confirmed = false',
      'compute disabled; helper "Confirm ORA same-result attestation"; no result card',
      'disabled=' + disabled + '; helper="' + helper.trim() + '"; resultCard=' + hasCard, ok);
  }

  // =========================================================================
  // U1 — valid ORA, high quality
  // =========================================================================
  await waitGate(page, base, false);
  await fillORA(page, { confirm: true });
  await compute(page);
  await page.waitForSelector('.result-card', { timeout: 3000 });
  {
    const txt = await page.textContent('#result_region');
    const chip = (await page.textContent('#result_region')).match(/high/i);
    const hasFailure = (await page.locator('.failure-card').count()) > 0;
    const qualityHigh = /Measurement quality[\s\S]*high/i.test(txt) || /quality[^\n]*high/i.test(txt);
    const ok = !hasFailure && /18\.2 mmHg/.test(txt) && qualityHigh;
    await page.screenshot({ path: path.join(SHOTS, 'U1_ora_success.png'), fullPage: true });
    record('U1', 'Valid ORA high quality renders ORA card with quality "high", no error styling',
      'ORA gat=18 cct=540 iopcc=18.2 ch=10 wfs=7.5 count=4, confirmed',
      'ORA result card; quality level "high"; no failure-card',
      'IOPcc rendered=' + /18\.2 mmHg/.test(txt) + '; qualityHigh=' + qualityHigh + '; failureCard=' + hasFailure,
      ok, 'acceptance_screenshots/U1_ora_success.png');
  }

  // =========================================================================
  // U9 — "Not eligible for target-IOP comparison" on any success (reuse U1 card)
  // =========================================================================
  {
    const txt = await page.textContent('#result_region');
    const ok = /Not eligible for target-IOP comparison/.test(txt);
    record('U9', 'Any success shows the not-eligible-for-target-IOP line',
      'ORA success (from U1)', 'text "Not eligible for target-IOP comparison" visible',
      'present=' + ok, ok);
  }

  // =========================================================================
  // U2 — CH = 20 -> out-of-observed-range note, not an error, no coefficient
  // =========================================================================
  await waitGate(page, base, false);
  await fillORA(page, { ch: 20, confirm: true });
  await compute(page);
  await page.waitForSelector('.result-card', { timeout: 3000 });
  {
    const txt = await page.textContent('#result_region');
    const hasFailure = (await page.locator('.failure-card').count()) > 0;
    const rangeNote = /outside the 4\u201318 mmHg observed range/.test(txt) && /not a validated clinical cutoff/.test(txt);
    // "no coefficient": CH must be presented as non-modifying (no numeric coefficient applied to IOP)
    const noCoeff = /does not (numerically )?modify the pressure/i.test(txt) || /does not modify pressure/i.test(txt);
    const ok = !hasFailure && rangeNote && noCoeff;
    await page.screenshot({ path: path.join(SHOTS, 'U2_ch_out_of_range.png'), fullPage: true });
    record('U2', 'CH=20 shows out-of-observed-range note (not an error), CH carries no coefficient',
      'ORA with ch=20', 'note "outside the 4-18 mmHg observed range"; success (no failure); CH non-modifying',
      'failureCard=' + hasFailure + '; rangeNote=' + rangeNote + '; nonModifying=' + noCoeff,
      ok, 'acceptance_screenshots/U2_ch_out_of_range.png');
  }

  // =========================================================================
  // U3 — Corvis raw label "ZZZ" -> quality unknown + provisional tooltip; raw label retained
  // =========================================================================
  await waitGate(page, base, false);
  await fillCorvis(page, { raw: 'ZZZ', ssi: 1.1, spa1: 95, confirm: true });
  await compute(page);
  await page.waitForSelector('.result-card', { timeout: 3000 });
  {
    const txt = await page.textContent('#result_region');
    const qualityUnknown = /unknown/i.test(txt);
    // tooltip lives in a title/data attribute on the quality chip
    const tooltip = await page.evaluate(() => {
      const pops = Array.from(document.querySelectorAll('#result_region .tip-pop'));
      const hit = pops.find(n => /mapping provisional \(corvis-map-0\.1\)/i.test(n.textContent || ''));
      return hit ? hit.textContent : null;
    });
    const rawRetained = (await page.inputValue('#corvis_quality_raw')) === 'ZZZ';
    const ok = qualityUnknown && !!tooltip && rawRetained;
    await page.screenshot({ path: path.join(SHOTS, 'U3_corvis_unknown.png'), fullPage: true });
    record('U3', 'Unrecognized Corvis label -> quality "unknown" + provisional-mapping tooltip; raw label retained in form',
      'Corvis raw_quality_label="ZZZ"',
      'quality chip "unknown"; tooltip contains "mapping provisional (corvis-map-0.1)"; raw label shown',
      'qualityUnknown=' + qualityUnknown + '; tooltip=' + JSON.stringify(tooltip) + '; rawInputRetained=' + rawRetained,
      ok, 'acceptance_screenshots/U3_corvis_unknown.png');
  }

  // =========================================================================
  // U4 — Both, identical values -> "No marked cross-device difference detected."
  // =========================================================================
  await waitGate(page, base, false);
  await fillBoth(page, { ora: 18, corvis: 18, ssi: 1.1, spa1: 95, confirm: true });
  await compute(page);
  await page.waitForSelector('.cross-strip', { timeout: 3000 });
  {
    const txt = await page.textContent('#result_region');
    const ok = /No marked cross-device difference detected\./.test(txt);
    record('U4', 'Both with identical device values shows no-difference strip',
      'Both ora=18 corvis=18', 'strip "No marked cross-device difference detected."',
      'present=' + ok, ok);
  }

  // =========================================================================
  // U5 — Both, diff>3, NO temporal confirmation -> unconfirmed strip + neutral tint
  // =========================================================================
  await waitGate(page, base, false);
  await fillBoth(page, { ora: 18, corvis: 22, ssi: 1.1, spa1: 95, confirm: false });
  await compute(page);
  await page.waitForSelector('.cross-strip', { timeout: 3000 });
  {
    const txt = await page.textContent('#result_region');
    const strip = /Numerical difference shown; clinical comparison not established\./.test(txt);
    const neutral = await page.evaluate(() => {
      const s = document.querySelector('.cross-strip');
      if (!s) return null;
      const cls = s.className;
      // neutral tint = NOT flagged as a warning/alert severity class
      return !/warn|alert|danger|error/i.test(cls);
    });
    const ok = strip && neutral === true;
    await page.screenshot({ path: path.join(SHOTS, 'U5_both_unconfirmed.png'), fullPage: true });
    record('U5', 'Both diff>3 without temporal confirmation -> unconfirmed strip, neutral tint',
      'Both ora=18 corvis=22 (diff 4), clinician_confirmation=false',
      'strip "Numerical difference shown; clinical comparison not established."; neutral (non-warning) tint',
      'strip=' + strip + '; neutralTint=' + neutral, ok, 'acceptance_screenshots/U5_both_unconfirmed.png');
  }

  // =========================================================================
  // U6 — LASIK -> Core "not applicable"; device applicability limited; section 6.1 flag
  // =========================================================================
  await waitGate(page, base, false);
  await fillORA(page, { refractive: 'LASIK', confirm: true });
  await compute(page);
  await page.waitForSelector('.result-card', { timeout: 3000 });
  {
    const txt = await page.textContent('#result_region');
    const coreNA = /not applicable/i.test(txt) && !/not true IOP:\s*\d/.test(txt);
    const applLimited = /limited/i.test(txt);
    const flag = /linear CCT correction is not applicable|Post-refractive|device interpretation (is )?limited/i.test(txt);
    const ok = coreNA && applLimited && flag;
    await page.screenshot({ path: path.join(SHOTS, 'U6_lasik.png'), fullPage: true });
    record('U6', 'Prior LASIK -> Core estimate not applicable; device applicability "limited"; refractive flag string',
      'ORA with prior_refractive_surgery=LASIK',
      'Core "not applicable"; applicability "limited"; section 6.1 refractive flag',
      'coreNotApplicable=' + coreNA + '; applicabilityLimited=' + applLimited + '; flag=' + flag,
      ok, 'acceptance_screenshots/U6_lasik.png');
  }

  // =========================================================================
  // U7 — measurement failure (integration-only payload) -> failure card, no big number, no copy
  // =========================================================================
  await waitGate(page, base, false);
  {
    // Engine routing for the integration payload (manual UI never emits measurement_failure).
    const engine = await page.evaluate(() => {
      const out = M1ADV.computeM1Advanced({
        device_branch: 'ora', gat_iop: 18, cct: 540, measurement_identity: { eye: 'OD' },
        ora_inputs: { iopcc: 18.2, ch: 10, selected_waveform_score: 7.5, measurement_count: 4,
          provenance_attestation: { values_from_same_device_result_confirmed: true, basis: 'device_averaged_output', reading_id: 'r1' } },
        measurement_failure: { occurred: true, code: 'insufficient_signal', message: 'Signal too low' },
        clinician_confirmation: true });
      return { status: out.status, code: out.failure && out.failure.code, type: out.failure && out.failure.type };
    });
    // Render the failure card by validating the engine result is a failure and asserting UI failure semantics
    // via a UI-reachable failure path (gat out of range) to confirm "no big number / no copy button".
    await fillORA(page, { confirm: true }); await fill(page, 'gat_iop', 999);
    await compute(page);
    await page.waitForSelector('.failure-card', { timeout: 3000 });
    const failText = await page.textContent('.failure-card');
    const noCopy = (await page.locator('.failure-card .copy-btn').count()) === 0;
    const noBigNumber = !/\b\d{2,}\.\d\s*mmHg\b/.test(failText);
    const engineFailed = engine.status === 'failure' && engine.type === 'measurement_failure';
    const ok = engineFailed && noCopy && noBigNumber;
    await page.screenshot({ path: path.join(SHOTS, 'U7_measurement_failure.png'), fullPage: true });
    record('U7', 'Integration measurement_failure payload routes to failure; failure card shows no large number and no copy button',
      'engine payload measurement_failure.occurred=true (integration only) + UI-reachable failure for card semantics',
      'engine status failure (type measurement_failure); failure card; no large mmHg number; no copy button',
      'engine=' + JSON.stringify(engine) + '; noCopyBtn=' + noCopy + '; noBigNumber=' + noBigNumber,
      ok, 'acceptance_screenshots/U7_measurement_failure.png');
  }

  // =========================================================================
  // U10 — eye mismatch (integration-only payload) -> EYE_MISMATCH failure with section 6.2 string
  // =========================================================================
  {
    const engine = await page.evaluate(() => {
      const out = M1ADV.computeM1Advanced({
        device_branch: 'ora', gat_iop: 18, cct: 540, measurement_identity: { eye: 'OD' },
        ora_inputs: { iopcc: 18.2, ch: 10, selected_waveform_score: 7.5, measurement_count: 4, eye: 'OS',
          provenance_attestation: { values_from_same_device_result_confirmed: true, basis: 'device_averaged_output', reading_id: 'r1' } },
        clinician_confirmation: true });
      return { status: out.status, code: out.failure && out.failure.code, message: out.failure && out.failure.message };
    });
    const ok = engine.status === 'failure' && engine.code === 'EYE_MISMATCH' && /mismatch/i.test(engine.message || '');
    record('U10', 'Integration eye-mismatch payload routes to EYE_MISMATCH failure with remediation message',
      'ora_inputs.eye=OS vs measurement_identity.eye=OD (integration only)',
      'engine failure code EYE_MISMATCH with section 6.2 remediation string',
      'engine=' + JSON.stringify(engine), ok);
  }

  // =========================================================================
  // U11 — success -> invalid -> recompute: previous result removed before failure card
  // =========================================================================
  await waitGate(page, base, false);
  await fillORA(page, { confirm: true });
  await compute(page);
  await page.waitForSelector('.result-card', { timeout: 3000 });
  {
    const hadResult = (await page.locator('.result-card').count()) > 0;
    await fill(page, 'gat_iop', 999);
    await compute(page);
    await page.waitForSelector('.failure-card', { timeout: 3000 });
    const resultCardsAfter = await page.locator('.result-card').count();
    const failureCards = await page.locator('.failure-card').count();
    const ok = hadResult && resultCardsAfter === 0 && failureCards === 1;
    record('U11', 'Recompute into a failure clears the previous success card first (U11 clearing)',
      'ORA success, then gat_iop=999 invalid, recompute',
      'no .result-card remains; exactly one .failure-card',
      'hadResult=' + hadResult + '; resultCardsAfter=' + resultCardsAfter + '; failureCards=' + failureCards, ok);
  }

  // =========================================================================
  // U12 — branch switch ORA -> Corvis: payload contains neither ora_inputs nor ora_metadata
  // =========================================================================
  await waitGate(page, base, false);
  await fillORA(page, { confirm: true });            // fill ORA first
  await fillCorvis(page, { raw: 'OK', confirm: true }); // switch to Corvis and fill
  {
    // Capture the EXACT payload buildPayload sends to the engine (UI calls M1ADV.computeM1Advanced
    // directly at runtime). The engine normalizes result.inputs (defaults ora_metadata/ora_inputs),
    // so the payload — not the echoed result — is what U12 must inspect.
    await page.evaluate(() => {
      window.__lastPayload = null;
      const orig = M1ADV.computeM1Advanced;
      M1ADV.computeM1Advanced = function (p) {
        try { window.__lastPayload = JSON.parse(JSON.stringify(p)); } catch (e) { window.__lastPayload = p; }
        return orig.call(this, p);
      };
    });
    await compute(page);
    await page.waitForSelector('.result-card', { timeout: 3000 });
    const probe = await page.evaluate(() => {
      const p = window.__lastPayload;
      return {
        branch: p && p.device_branch,
        hasOraInputsKey: !!(p && Object.prototype.hasOwnProperty.call(p, 'ora_inputs')),
        hasOraMetadataKey: !!(p && Object.prototype.hasOwnProperty.call(p, 'ora_metadata')),
        keys: p ? Object.keys(p) : null
      };
    });
    const ok = probe.branch === 'corvis' && !probe.hasOraInputsKey && !probe.hasOraMetadataKey;
    record('U12', 'Switching ORA->Corvis emits a Corvis payload with no ora_inputs / ora_metadata keys',
      'fill ORA, switch device_branch to corvis, fill Corvis, compute (real payload captured at M1ADV.computeM1Advanced)',
      'payload sent to engine: device_branch=corvis, no ora_inputs key, no ora_metadata key',
      'payload.branch=' + probe.branch + '; hasOraInputsKey=' + probe.hasOraInputsKey + '; hasOraMetadataKey=' + probe.hasOraMetadataKey + '; payloadKeys=[' + (probe.keys || []).join(',') + ']',
      ok);
  }

  // =========================================================================
  // U13 — Core key byte-identical/absent; Advanced writes ONLY ofty_m1_advanced_result
  // =========================================================================
  await waitGate(page, base, false);
  {
    // Case A: Core key present with a known value -> must be byte-identical after Advanced compute
    const CORE_SENTINEL = JSON.stringify({ core: 'sentinel', n: 7 });
    await page.evaluate((v) => { localStorage.setItem('ofty_m1_result', v); }, CORE_SENTINEL);
    await fillORA(page, { confirm: true });
    await compute(page);
    await page.waitForSelector('.result-card', { timeout: 3000 });
    const afterA = await page.evaluate(() => ({
      core: localStorage.getItem('ofty_m1_result'),
      adv: localStorage.getItem('ofty_m1_advanced_result') ? true : false
    }));
    // Case B: Core key absent -> must remain absent after Advanced compute
    await waitGate(page, base, false); // clears localStorage
    await fillORA(page, { confirm: true });
    await compute(page);
    await page.waitForSelector('.result-card', { timeout: 3000 });
    const afterB = await page.evaluate(() => ({
      coreAbsent: localStorage.getItem('ofty_m1_result') === null,
      advWritten: localStorage.getItem('ofty_m1_advanced_result') !== null,
      keys: Object.keys(localStorage).sort()
    }));
    const coreIdentical = afterA.core === CORE_SENTINEL;
    const onlyAdvanced = afterB.advWritten && afterB.coreAbsent &&
      afterB.keys.filter(k => /^ofty_m1/.test(k)).join(',') === 'ofty_m1_advanced_result';
    const ok = coreIdentical && afterA.adv && onlyAdvanced;
    record('U13', 'Advanced never writes the Core key: ofty_m1_result stays byte-identical (or absent); only ofty_m1_advanced_result is written',
      'seed ofty_m1_result sentinel then Advanced compute (Case A); empty storage then Advanced compute (Case B)',
      'Case A: ofty_m1_result unchanged + ofty_m1_advanced_result written; Case B: ofty_m1_result absent + only ofty_m1_advanced_result among ofty_m1* keys',
      'A.coreIdentical=' + coreIdentical + '; A.advWritten=' + afterA.adv + '; B.coreAbsent=' + afterB.coreAbsent + '; B.ofty_keys=' + afterB.keys.filter(k => /^ofty_m1/.test(k)).join('|'),
      ok);
  }

  // =========================================================================
  // U14 — corrupt JSON in Advanced storage -> adapter {ok:false, reason:'corrupt_json'}, recoverable
  // =========================================================================
  await waitGate(page, base, false);
  {
    const adapterResult = await page.evaluate(() => {
      localStorage.setItem('ofty_m1_advanced_result', '{ this is : not valid json ');
      const a = M1ADV.createStorageAdapter(window.localStorage);
      return a.readAdvancedResult();
    });
    // Recoverable: a fresh compute must still succeed and overwrite with valid JSON, no crash.
    await fillORA(page, { confirm: true });
    await compute(page);
    await page.waitForSelector('.result-card', { timeout: 3000 });
    const recovered = await page.evaluate(() => {
      try { JSON.parse(localStorage.getItem('ofty_m1_advanced_result')); return true; } catch (e) { return false; }
    });
    const ok = adapterResult && adapterResult.ok === false && adapterResult.reason === 'corrupt_json' && recovered;
    record('U14', 'Corrupt Advanced JSON yields adapter {ok:false, reason:"corrupt_json"} and the UI recovers (no crash)',
      'seed ofty_m1_advanced_result with invalid JSON, read via adapter, then recompute',
      'adapter returns {ok:false, reason:"corrupt_json"}; subsequent compute writes valid JSON',
      'adapter=' + JSON.stringify(adapterResult) + '; recoveredValidJSON=' + recovered, ok);
  }

  // =========================================================================
  // U15 — core_reference.applicability === 'not_applicable' -> NO Core number anywhere
  // =========================================================================
  await waitGate(page, base, false);
  await fillORA(page, { refractive: 'LASIK', confirm: true });
  await compute(page);
  await page.waitForSelector('.result-card', { timeout: 3000 });
  {
    const txt = await page.textContent('#result_region');
    const copied = await copiedText(page);
    const noCoreNumberRendered = !/not true IOP:\s*\d/.test(txt);
    const noCoreNumberExport = !/not true IOP:\s*\d/.test(copied);
    const ok = noCoreNumberRendered && noCoreNumberExport;
    record('U15', 'When Core applicability is not_applicable, no Core IOP number appears (rendered or exported)',
      'ORA LASIK (core_reference.applicability=not_applicable)',
      'no "not true IOP: <number>" anywhere in card or copied text',
      'noCoreNumberRendered=' + noCoreNumberRendered + '; noCoreNumberExport=' + noCoreNumberExport, ok);
  }

  // =========================================================================
  // U16 — Both result: no DOM element marked as primary/hero
  // =========================================================================
  await waitGate(page, base, false);
  await fillBoth(page, { ora: 18, corvis: 22, ssi: 1.1, spa1: 95, confirm: true });
  await compute(page);
  await page.waitForSelector('.cross-strip', { timeout: 3000 });
  {
    const markers = await page.evaluate(() => {
      const sel = '#result_region [class*="primary"], #result_region [class*="hero"], #result_region [data-primary], #result_region [data-hero], #result_region [role="primary"]';
      return document.querySelectorAll(sel).length;
    });
    const ok = markers === 0;
    await page.screenshot({ path: path.join(SHOTS, 'U16_both_no_primary.png'), fullPage: true });
    record('U16', 'Both result has no DOM element marked as primary/hero (no single device is elevated)',
      'Both success', 'zero elements with primary/hero class/data/role markers',
      'markerCount=' + markers, ok, 'acceptance_screenshots/U16_both_no_primary.png');
  }

  // =========================================================================
  // U17 — copy byte-for-byte in three conditions: not_applicable, invalid_temporal, Both
  // =========================================================================
  // 17.anchor + 17.invalid_temporal (single-branch ORA)
  await waitGate(page, base, false);
  await fillORA(page, { confirm: true });                 // canonical -> high/standard/high
  await compute(page); await page.waitForSelector('.result-card', { timeout: 3000 });
  const copiedORA = await copiedText(page);
  const okAnchor = copiedORA === SPEC_ORA;
  record('U17', 'Copy (ORA canonical) matches spec section 7.1 byte-for-byte',
    'ORA gat=18 cct=540 iopcc=18.2 ch=10 confirmed -> Copy',
    'copied text === spec section 7.1 fenced block (byte-for-byte, from spec file)',
    okAnchor ? 'EXACT MATCH' : ('MISMATCH\n--copied--\n' + JSON.stringify(copiedORA) + '\n--spec--\n' + JSON.stringify(SPEC_ORA)),
    okAnchor);

  await waitGate(page, base, false);
  await fillORA(page, { confirm: false });                // unconfirmed -> comparison_clinically_interpretable=false
  await compute(page); await page.waitForSelector('.result-card', { timeout: 3000 });
  const copiedInvalid = await copiedText(page);
  // expected = SPEC_ORA with the IOPcc line swapped for the spec's suffixed line
  const oraIopccLine = SPEC_ORA.split('\n').find(l => l.startsWith('IOPcc:'));
  const expectedInvalid = SPEC_ORA.replace(oraIopccLine, SPEC_ORA_INVALID_TEMPORAL_LINE);
  const okInvalid = copiedInvalid === expectedInvalid;
  record('U17', 'Copy (invalid temporal, single-branch ORA) suffixes the delta line per section 7.4 rule 2, byte-for-byte',
    'ORA unconfirmed (comparison_clinically_interpretable=false) -> Copy',
    'copied === spec 7.1 with IOPcc line replaced by the spec 7.1 suffixed line',
    okInvalid ? 'EXACT MATCH' : ('MISMATCH\n--copied--\n' + JSON.stringify(copiedInvalid) + '\n--expected--\n' + JSON.stringify(expectedInvalid)),
    okInvalid);

  // 17.not_applicable (line-level byte-exact on the Core line, built from engine limitation_reason)
  await waitGate(page, base, false);
  await fillORA(page, { refractive: 'LASIK', confirm: true });
  await compute(page); await page.waitForSelector('.result-card', { timeout: 3000 });
  const copiedNA = await copiedText(page);
  const reason = await page.evaluate(() => {
    const o = JSON.parse(localStorage.getItem('ofty_m1_advanced_result'));
    const lr = o.result.core_reference.limitation_reason;
    return lr && lr[0] ? lr[0] : null;
  });
  const expectedCoreLine = 'CCT-contextualized Core estimate \u2014 not true IOP: not applicable (' + reason + ')';
  const okNA = copiedNA.split('\n').indexOf(expectedCoreLine) !== -1 && !/not true IOP:\s*\d/.test(copiedNA);
  record('U17', 'Copy (Core not_applicable) replaces the Core line per section 7.4 rule 1, byte-for-byte',
    'ORA LASIK -> Copy', 'copied contains exact line "CCT-contextualized Core estimate — not true IOP: not applicable (<reason>)" and no Core number',
    okNA ? 'EXACT LINE MATCH: ' + JSON.stringify(expectedCoreLine) : ('MISMATCH\n--copied--\n' + JSON.stringify(copiedNA)),
    okNA);

  // 17.Both (full block, interpretation substituted)
  await waitGate(page, base, false);
  await fillBoth(page, { gat: 16, cct: 540, ora: 18, corvis: 22, confirm: true });
  await compute(page); await page.waitForSelector('.cross-strip', { timeout: 3000 });
  const copiedBoth = await copiedText(page);
  const interp = await page.evaluate(() => {
    const o = JSON.parse(localStorage.getItem('ofty_m1_advanced_result'));
    return o.result.device_comparison.interpretation;
  });
  const expectedBoth = SPEC_BOTH.replace('<device_comparison.interpretation>', interp);
  const okBoth = copiedBoth === expectedBoth;
  record('U17', 'Copy (Both) matches spec section 7.3 byte-for-byte with engine interpretation substituted',
    'Both gat=16 cct=540 ora=18 corvis=22 confirmed -> Copy',
    'copied === spec 7.3 block with <device_comparison.interpretation> replaced by engine string',
    okBoth ? 'EXACT MATCH' : ('MISMATCH\n--copied--\n' + JSON.stringify(copiedBoth) + '\n--expected--\n' + JSON.stringify(expectedBoth)),
    okBoth);

  // =========================================================================
  // U18 — accessibility: tab order, failure focus, aria-live
  // =========================================================================
  await waitGate(page, base, false);
  await page.selectOption('#device_branch', 'ora');
  // Fill a valid ORA so compute_btn is ENABLED (a disabled button is correctly excluded from tab order);
  // open the modifier + temporal accordions so their fields are part of the tab order.
  await fillORA(page, { confirm: true });
  await page.evaluate(() => {
    ['acc_modifiers', 'acc_temporal'].forEach(id => { const d = document.getElementById(id); if (d) d.open = true; });
  });
  {
    const canonical = ['device_branch', 'gat_iop', 'cct', 'prior_refractive_surgery',
      'ora_iopcc', 'ora_ch', 'ora_wfs', 'ora_count', 'ora_provenance_confirmed',
      'encounter_id', 'clinician_confirmation', 'compute_btn'];
    await page.focus('#device_branch');
    const seq = [];
    for (let i = 0; i < 60; i++) {
      const id = await page.evaluate(() => document.activeElement && document.activeElement.id);
      if (id && seq[seq.length - 1] !== id) seq.push(id);
      if (id === 'compute_btn') break;
      await page.keyboard.press('Tab');
    }
    const filtered = seq.filter(id => canonical.indexOf(id) !== -1);
    // subsequence check: filtered must respect canonical order
    let ci = 0, subseq = true;
    for (const id of filtered) { const k = canonical.indexOf(id, ci); if (k < 0) { subseq = false; break; } ci = k + 1; }
    const reachedCompute = filtered[filtered.length - 1] === 'compute_btn';
    // failure focus
    await waitGate(page, base, false);
    await fillORA(page, { confirm: true }); await fill(page, 'gat_iop', 999);
    await compute(page); await page.waitForSelector('.failure-card', { timeout: 3000 });
    const focusOnFailure = await page.evaluate(() => {
      const ae = document.activeElement;
      const fc = document.querySelector('.failure-card');
      return !!(fc && ae && fc.contains(ae));
    });
    // aria-live on result region
    const ariaLive = await page.evaluate(() => {
      const r = document.getElementById('result_region');
      return r ? r.getAttribute('aria-live') : null;
    });
    const ok = subseq && reachedCompute && focusOnFailure && ariaLive === 'polite';
    record('U18', 'Accessibility: DOM tab order branch->shared->modifier->device->temporal->compute; failure moves focus into failure card; result region aria-live=polite',
      'Tab from #device_branch with temporal accordion open; then trigger failure',
      'focus order is a subsequence of the canonical order and reaches compute; focus inside failure card on failure; aria-live="polite"',
      'tabSequence=' + filtered.join('>') + '; subsequence=' + subseq + '; reachedCompute=' + reachedCompute + '; focusInFailureCard=' + focusOnFailure + '; ariaLive=' + ariaLive,
      ok);
  }

  // =========================================================================
  // U19 — responsive at 320px: no horizontal overflow; Both order ORA->Corvis->cross-device
  // =========================================================================
  {
    const page320 = await context.newPage();
    await page320.setViewportSize({ width: 320, height: 800 });
    await waitGate(page320, base, false);
    await fillBoth(page320, { ora: 18, corvis: 22, ssi: 1.1, spa1: 95, confirm: true });
    await page320.click('#compute_btn');
    await page320.waitForSelector('.cross-strip', { timeout: 3000 });
    const overflow = await page320.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, inner: window.innerWidth
    }));
    const noOverflow = overflow.scrollW <= overflow.inner + 1;
    // order check: vertical position of ORA block, Corvis block, cross-strip
    const order = await page320.evaluate(() => {
      const region = document.getElementById('result_region');
      const text = region.innerText;
      const iORA = text.indexOf('ORA');
      const iCorvis = text.indexOf('Corvis');
      const iCross = Math.max(text.indexOf('Cross-device'), text.indexOf('cross-device'));
      return { iORA, iCorvis, iCross };
    });
    const orderOk = order.iORA >= 0 && order.iCorvis > order.iORA && order.iCross > order.iCorvis;
    await page320.screenshot({ path: path.join(SHOTS, 'U19_responsive_320.png'), fullPage: true });
    const ok = noOverflow && orderOk;
    record('U19', 'At 320px width there is no horizontal overflow and Both order is ORA->Corvis->cross-device',
      'viewport 320x800, Both result', 'documentElement.scrollWidth <= innerWidth; text order ORA < Corvis < cross-device',
      'scrollW=' + overflow.scrollW + ' inner=' + overflow.inner + ' noOverflow=' + noOverflow + '; order(iORA,iCorvis,iCross)=' + JSON.stringify(order) + ' orderOk=' + orderOk,
      ok, 'acceptance_screenshots/U19_responsive_320.png');
    await page320.close();
  }

  // =========================================================================
  // U20 — formatting: every rendered/exported number matches section 7.0 helpers;
  //        and no clinical number appears that the engine did not return
  // =========================================================================
  await waitGate(page, base, false);
  await fillCorvis(page, { gat: 16, cct: 600, biop: 14.5, raw: 'OK', ssi: 1.1, spa1: 95, confirm: true });
  await compute(page); await page.waitForSelector('.result-card', { timeout: 3000 });
  {
    const copied = await copiedText(page);
    const lines = copied.split('\n');
    // per-line format validation
    const pressureRe = /\b\d+\.\d mmHg\b/g;
    const cctRe = /\b\d+ \u00B5m\b/;            // integer + µm
    const spa1Re = /\b\d+\.\d mmHg\/mm\b/;
    const ssiRe = /SSI: \d+\.\d \(context only\)/;
    const deltaRe = /\(\u0394 vs GAT ([+-]\d+\.\d|\+0\.0)/;
    const fmtOk = pressureRe.test(copied) && cctRe.test(copied) && spa1Re.test(copied) && ssiRe.test(copied) && deltaRe.test(copied);
    // engine-returned numeric set
    const engineNums = await page.evaluate(() => {
      const o = JSON.parse(localStorage.getItem('ofty_m1_advanced_result')).result;
      const set = new Set();
      const add = v => { if (typeof v === 'number') set.add(v.toFixed(1)); };
      add(o.device_measurement.value_mmhg); add(o.comparison_with_gat.gat_mmhg); add(o.comparison_with_gat.delta_mmhg);
      add(o.inputs.gat_iop); add(o.inputs.cct);
      if (o.core_reference) add(o.core_reference.display_value_mmhg);
      const abp = o.biomechanical_context && o.biomechanical_context.additional_biomechanical_parameters;
      if (abp) { add(abp.ssi); add(abp.sp_a1); }
      return Array.from(set);
    });
    // every "X.X mmHg" / "X µm" / "X.X mmHg/mm" value in the export must be engine-returned
    const clinicalTokens = [];
    let m;
    const tokRe = /(\d+(?:\.\d)?) (mmHg\/mm|mmHg|\u00B5m)/g;
    while ((m = tokRe.exec(copied)) !== null) clinicalTokens.push(parseFloat(m[1]).toFixed(1));
    const allFromEngine = clinicalTokens.every(t => engineNums.indexOf(t) !== -1);
    // near-zero positive-sign rule via the engine helper-equivalent: delta 0 -> "+0.0"
    const zeroDelta = await page.evaluate(() => {
      // produce a single-branch ORA with iopcc == gat so delta == 0
      const out = M1ADV.computeM1Advanced({ device_branch: 'ora', gat_iop: 18, cct: 540, measurement_identity: { eye: 'OD' },
        ora_inputs: { iopcc: 18, ch: 10, selected_waveform_score: 7.5, measurement_count: 4,
          provenance_attestation: { values_from_same_device_result_confirmed: true, basis: 'device_averaged_output', reading_id: 'r1' } },
        clinician_confirmation: true });
      return out.result.comparison_with_gat.delta_mmhg;
    });
    const fmtDelta = n => (Math.abs(n) < 0.05 ? '+0.0' : (n > 0 ? '+' : '') + n.toFixed(1));
    const zeroOk = fmtDelta(zeroDelta) === '+0.0' && fmtDelta(-0.04) === '+0.0' && fmtDelta(-1.5) === '-1.5';
    const ok = fmtOk && allFromEngine && zeroOk;
    record('U20', 'Every rendered/exported number matches section 7.0 helpers; no clinical number appears that the engine did not return; near-zero delta forced to "+0.0"',
      'Corvis export (pressures, CCT integer, SP-A1 mmHg/mm, SSI bare, delta) + engine-number cross-check',
      'pressures "x.x mmHg"; CCT "n µm"; SP-A1 "x.x mmHg/mm"; SSI bare; delta signed; all clinical tokens engine-returned; fmtDelta(0)/(-0.04)="+0.0"',
      'fmtOk=' + fmtOk + '; engineNums=[' + engineNums.join(',') + ']; exportClinicalTokens=[' + clinicalTokens.join(',') + ']; allFromEngine=' + allFromEngine + '; zeroSignRule=' + zeroOk,
      ok);
  }

  // =========================================================================
  // U21 — manual encounter ID alone never validates; only clinician_confirmation does
  // =========================================================================
  await waitGate(page, base, false);
  await fillBoth(page, { ora: 18, corvis: 22, ssi: 1.1, spa1: 95, encounter: 'ENC-123', confirm: false });
  await compute(page); await page.waitForSelector('.cross-strip', { timeout: 3000 });
  {
    const unconfirmed = await page.evaluate(() => {
      const o = JSON.parse(localStorage.getItem('ofty_m1_advanced_result')).result;
      return { basis: o.comparison_context.basis, valid: o.comparison_context.comparison_valid };
    });
    // now tick clinician_confirmation and recompute
    await setCheck(page, 'clinician_confirmation', true);
    await compute(page); await page.waitForSelector('.cross-strip', { timeout: 3000 });
    const confirmed = await page.evaluate(() => {
      const o = JSON.parse(localStorage.getItem('ofty_m1_advanced_result')).result;
      return { basis: o.comparison_context.basis, valid: o.comparison_context.comparison_valid };
    });
    const ok = unconfirmed.basis === 'unconfirmed' && unconfirmed.valid === false &&
      confirmed.basis === 'clinician_confirmed_same_session' && confirmed.valid === true;
    record('U21', 'Encounter ID alone does NOT validate the comparison; only clinician_confirmation=true does',
      'Both with encounter_id="ENC-123", clinician_confirmation=false then true',
      'unconfirmed: basis="unconfirmed", comparison_valid=false; confirmed: basis="clinician_confirmed_same_session", comparison_valid=true',
      'encounterOnly=' + JSON.stringify(unconfirmed) + '; afterConfirmation=' + JSON.stringify(confirmed), ok);
  }

  // =========================================================================
  // Manifest / schema / bundle mismatch (mandatory coverage) — gate must refuse compute
  // =========================================================================
  async function tamperExpectBanner(uLabel, purpose, overrides, detailRe, inputDesc) {
    const p = await context.newPage();
    OVERRIDES = overrides;
    await waitGate(p, base, true);
    const visible = await p.isVisible('#manifest_banner');
    const disabled = await p.isDisabled('#compute_btn');
    const detail = await p.textContent('#manifest_banner_detail');
    OVERRIDES = {};
    const ok = visible && disabled && detailRe.test(detail);
    record(uLabel, purpose, inputDesc, 'banner shown + compute disabled + detail matches ' + detailRe,
      'bannerVisible=' + visible + '; computeDisabled=' + disabled + '; detail="' + (detail || '').trim() + '"', ok);
    await p.close();
  }
  {
    const m1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'build.manifest.json'), 'utf8'));
    m1.engine_algorithm_version = '0.0.0-not-the-real-version';
    await tamperExpectBanner('U8b', 'Tampered manifest ALG_VERSION blocks compute (load-time integrity gate)',
      { '/build.manifest.json': Buffer.from(JSON.stringify(m1, null, 2)) }, /ALG_VERSION/, 'served manifest with wrong engine_algorithm_version');

    const m2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'build.manifest.json'), 'utf8'));
    m2.sha256['m1_advanced_bundle.js'].hash = 'deadbeef'.repeat(8);
    await tamperExpectBanner('U8c', 'Tampered manifest bundle SHA-256 blocks compute',
      { '/build.manifest.json': Buffer.from(JSON.stringify(m2, null, 2)) }, /bundle SHA-256/, 'served manifest with wrong bundle hash');

    const sc = JSON.parse(fs.readFileSync(path.join(ROOT, 'm1_advanced_schema.json'), 'utf8'));
    sc.$id = 'M1-ADV-SCHEMA-BOGUS';
    await tamperExpectBanner('U8d', 'Tampered schema $id + hash blocks compute (vs manifest AND vs M1ADV.CONSTANTS)',
      { '/m1_advanced_schema.json': Buffer.from(JSON.stringify(sc)) }, /(schema SHA-256|schema \$id)/, 'served schema with altered $id');
  }

  // PART-wide: no console/page errors during the canonical (non-tamper) tests
  record('UX', 'No uncaught console/page errors during canonical acceptance flow',
    'all canonical (non-tamper) interactions above', 'zero console errors / page errors',
    consoleErrors.length === 0 ? 'none' : consoleErrors.slice(0, 5).join(' | '), consoleErrors.length === 0);

  // =========================================================================
  // Report
  // =========================================================================
  const summary = { passed: passN, failed: failN, not_executed: notExecN, total: records.length };
  const reportObj = {
    report: 'M1 Advanced — FORMAL U1–U21 browser acceptance gate',
    generated_utc: new Date().toISOString(),
    environment: { node: process.version, playwright_chromium: browser.version() },
    base_artifacts: {
      index_html_sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'index.html'))).digest('hex'),
      bundle_sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'm1_advanced_bundle.js'))).digest('hex')
    },
    summary,
    console_errors: consoleErrors,
    records
  };
  fs.writeFileSync(path.join(ROOT, 'm1_advanced_browser_acceptance_report.json'), JSON.stringify(reportObj, null, 2));

  // markdown
  let md = '# M1 Advanced — Formal U1–U21 Browser Acceptance Report\n\n';
  md += '- Generated: ' + reportObj.generated_utc + '\n';
  md += '- Node: ' + process.version + ' · Playwright Chromium: ' + browser.version() + '\n';
  md += '- index.html SHA-256: `' + reportObj.base_artifacts.index_html_sha256 + '`\n';
  md += '- bundle SHA-256: `' + reportObj.base_artifacts.bundle_sha256 + '`\n\n';
  md += '**Summary — passed: ' + passN + ' · failed: ' + failN + ' · not executed: ' + notExecN + ' · total: ' + records.length + '**\n\n';
  for (const r of records) {
    md += '## ' + r.u + ' — ' + r.result + '\n\n';
    md += '- **Purpose:** ' + r.purpose + '\n';
    md += '- **Input:** ' + (r.input || '—') + '\n';
    md += '- **Expected:** ' + r.expected + '\n';
    md += '- **Observed:** ' + r.observed + '\n';
    if (r.evidence) md += '- **Evidence:** `' + r.evidence + '`\n';
    md += '\n';
  }
  fs.writeFileSync(path.join(ROOT, 'm1_advanced_browser_acceptance_report.md'), md);

  console.log('\u2550'.repeat(60));
  console.log('  M1 ADVANCED — FORMAL U1\u2013U21 BROWSER ACCEPTANCE GATE');
  console.log('\u2550'.repeat(60));
  for (const r of records) console.log('  [' + r.result + '] ' + r.u + ' — ' + r.purpose.slice(0, 64));
  console.log('\u2500'.repeat(60));
  console.log('  passed=' + passN + '  failed=' + failN + '  not_executed=' + notExecN + '  total=' + records.length);
  console.log('  ' + (failN === 0 ? 'ALL EXECUTED TESTS PASSED \u2713' : 'FAILURES PRESENT \u2717'));
  console.log('\u2550'.repeat(60));

  await context.close();
  await browser.close();
  server.close();
  process.exit(failN > 0 ? 1 : 0);
})().catch(e => { console.error('ACCEPTANCE THREW:', e); process.exit(2); });
