// browser_smoke.js
// Preliminary browser smoke test for index.html (NOT the U1–U21 acceptance gate).
// Fully reproducible: no absolute paths. All paths are derived from __dirname.
// Requirements: Playwright (declared as devDependency in package.json).
//
// Run from the package root:    node browser_smoke.js
// Output: per-check log to stdout; screenshots/{ora,corvis,both,failure}.png;
// browser_smoke_report.json with full results and environment.
//
// Coverage in this preliminary smoke:
//   • page loads, load-time smoke test green on canonical artifacts
//   • required-field gating + provenance gating
//   • focus moves to the first invalid required field on compute attempt
//   • ORA, Corvis, Both (unconfirmed + confirmed) render real engine output
//   • failure card: no large number, no copy button
//   • temporal accordion: open on Both, closed on ORA/Corvis (even after Both)
//   • clinician preference rationale rendered (recorded-only, not in export)
//   • tampered manifest, tampered bundle hash, tampered schema $id → banner +
//     compute blocked
//
// This file does NOT exercise U1–U21; that is the next gate.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  console.error('Playwright is required. Run:  npm install   (or `npm ci`)');
  process.exit(2);
}

const ROOT = __dirname;
const SHOTS = path.join(ROOT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.md':   'text/markdown; charset=utf-8'
};

let OVERRIDES = {};

function makeServer() {
  return http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') url = '/index.html';
    if (OVERRIDES[url]) {
      const buf = OVERRIDES[url];
      res.writeHead(200, { 'Content-Type': MIME[path.extname(url)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
      return;
    }
    const fp = path.join(ROOT, url);
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(fp).pipe(res);
  });
}

let pass = 0, fail = 0; const log = [];
function check(name, cond, detail) {
  if (cond) { pass++; log.push('  \u2713 ' + name + (detail ? ' :: ' + detail : '')); }
  else      { fail++; log.push('  \u2717 ' + name + (detail ? ' :: ' + detail : '')); }
}

async function fill(page, id, val) { await page.fill('#' + id, String(val)); }
async function setCheck(page, id, on) {
  const c = await page.isChecked('#' + id);
  if (c !== on) await page.click('#' + id);
}

async function loadPageWaitForGate(page, base, expectBanner) {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    (expect) => {
      const banner = document.getElementById('manifest_banner');
      const visible = banner && banner.classList.contains('show');
      const disabled = (document.getElementById('compute_btn') || {}).disabled;
      if (expect === 'banner') return visible === true && disabled === true;
      return visible === false;   // canonical case: banner must be hidden
    },
    expectBanner === true ? 'banner' : 'ok',
    { timeout: 5000 }
  );
}

(async () => {
  const server = makeServer();
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/';

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR ' + e.message));

  // ============================================================
  // PART A — canonical artifacts: gate must pass, scenarios render
  // ============================================================
  OVERRIDES = {};
  await loadPageWaitForGate(page, base, false);

  const bannerHidden = !(await page.isVisible('#manifest_banner'));
  check('canonical load-time smoke: banner hidden', bannerHidden);

  // Micro-erratum guard: the frozen clinical bundle must be loaded EXACTLY ONCE.
  // Static/DOM check — count <script src="m1_advanced_bundle.js"> nodes in the parsed document.
  const bundleScriptCount = await page.evaluate(
    () => document.querySelectorAll('script[src="m1_advanced_bundle.js"]').length
  );
  check('single-bundle guard: exactly one <script src="m1_advanced_bundle.js">',
        bundleScriptCount === 1, 'count=' + bundleScriptCount);

  // Required-field gating + provenance: ORA branch, empty form
  const helper0 = await page.textContent('#compute_helper');
  const btnDisabled0 = await page.isDisabled('#compute_btn');
  check('required-field gate: compute disabled with empty fields', btnDisabled0 === true);
  check('gate helper non-empty', /Confirm|Required|missing/.test(helper0), helper0);

  // Fill ORA required fields; live re-gate fires on input.
  await fill(page, 'gat_iop', 18);
  await fill(page, 'cct', 540);
  await fill(page, 'ora_iopcc', 18.2);
  await fill(page, 'ora_ch', 10);
  await fill(page, 'ora_wfs', 7.5);
  await fill(page, 'ora_count', 4);
  check('provenance gate: still disabled with provenance unchecked', await page.isDisabled('#compute_btn'));
  const helperP = await page.textContent('#compute_helper');
  check('helper asks for ORA provenance', /Confirm ORA same-result attestation/.test(helperP), helperP);

  await setCheck(page, 'ora_provenance_confirmed', true);
  check('gate opens after provenance confirmed', !(await page.isDisabled('#compute_btn')));

  // Item 3 / focus-on-first-error
  await fill(page, 'ora_ch', '');
  check('live re-gating: clearing ora_ch re-disables compute', await page.isDisabled('#compute_btn'));
  // The compute button is normally disabled by the live gate when fields are
  // invalid; we deliberately bypass the gate here to verify the SAFETY-NET
  // focus behavior inside runCompute (in case any future code path reaches it).
  // We use an in-page button.click() rather than page.click() because
  // Playwright's page.click() re-checks the disabled flag at click time.
  await page.evaluate(() => {
    const btn = document.getElementById('compute_btn');
    btn.disabled = false;
    btn.click();
  });
  await page.waitForTimeout(120);
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  check('focus moved to first invalid field (ora_ch)', focused === 'ora_ch', 'focused=' + focused);
  await fill(page, 'ora_ch', 10);

  // ORA success
  await page.click('#compute_btn');
  await page.waitForSelector('.result-card', { timeout: 3000 });
  const oraText = await page.textContent('#result_region');
  check('ORA: IOPcc 18.2 rendered', /18\.2 mmHg/.test(oraText));
  check('ORA: Δ +0.2 rendered', /\+0\.2/.test(oraText));
  check('ORA: not-eligible line', /Not eligible for target-IOP comparison/.test(oraText));
  check('ORA: copy button present', await page.isVisible('.copy-btn'));
  const oraGroupHeads = await page.locator('.flag-group-head').count();
  check('ORA: caution flags grouped by scope (group heads present)', oraGroupHeads >= 1, 'group heads=' + oraGroupHeads);
  await page.screenshot({ path: path.join(SHOTS, 'ora.png'), fullPage: true });

  // Item 1: provenance basis enum preservation end-to-end
  const provenanceRound = await page.evaluate(() => {
    const out = M1ADV.computeM1Advanced({
      device_branch: 'ora', gat_iop: 18, cct: 540,
      measurement_identity: { eye: 'OD' },
      ora_inputs: { iopcc: 18.2, ch: 10, selected_waveform_score: 7.5, measurement_count: 4,
        provenance_attestation: { values_from_same_device_result_confirmed: true, basis: 'device_averaged_output', reading_id: 'r1' } },
      clinician_confirmation: true
    });
    return out.result.inputs.ora_inputs.provenance_attestation.basis;
  });
  check('item 1: provenance basis "device_averaged_output" preserved end-to-end',
    provenanceRound === 'device_averaged_output', provenanceRound);

  // Corvis
  await page.selectOption('#device_branch', 'corvis');
  await page.waitForTimeout(150);
  check('item 6: temporal closed when switching to Corvis',
    !(await page.evaluate(() => document.getElementById('acc_temporal').open)));
  await fill(page, 'gat_iop', 16); await fill(page, 'cct', 600);
  await fill(page, 'corvis_biop', 14.5); await fill(page, 'corvis_quality_raw', 'OK');
  await fill(page, 'corvis_ssi', 1.1); await fill(page, 'corvis_sp_a1', 95);
  await page.click('#compute_btn');
  await page.waitForSelector('.result-card', { timeout: 3000 });
  const corvisText = await page.textContent('#result_region');
  check('Corvis: bIOP 14.5 rendered', /14\.5 mmHg/.test(corvisText));
  check('Corvis: SSI 1.1 rendered', /1\.1/.test(corvisText));
  check('Corvis: SP-A1 95.0 mmHg/mm rendered', /95\.0 mmHg\/mm/.test(corvisText));
  check('Corvis: Reference line rendered', /Reference/.test(corvisText));
  await page.screenshot({ path: path.join(SHOTS, 'corvis.png'), fullPage: true });

  // Both (unconfirmed)
  await page.selectOption('#device_branch', 'both');
  await page.waitForTimeout(200);
  check('item 6: temporal OPEN when switching to Both',
    await page.evaluate(() => document.getElementById('acc_temporal').open));

  await fill(page, 'gat_iop', 16); await fill(page, 'cct', 540);
  await fill(page, 'ora_iopcc', 18); await fill(page, 'ora_ch', 10);
  await fill(page, 'ora_wfs', 7.5); await fill(page, 'ora_count', 4);
  await setCheck(page, 'ora_provenance_confirmed', true);
  await fill(page, 'corvis_biop', 22); await fill(page, 'corvis_quality_raw', 'OK');
  await fill(page, 'corvis_ssi', 1.1); await fill(page, 'corvis_sp_a1', 95);

  // Item 5: preference timestamp persistence across recomputes
  // Open the preference accordion first (it is closed by default).
  await page.evaluate(() => { document.getElementById('acc_pref').open = true; });
  await page.selectOption('#pref_selected_source', 'ORA-IOPcc');
  await fill(page, 'pref_rationale', 'Better signal under our acquisition conditions.');
  await page.waitForTimeout(50);
  // Sleep so a regenerated timestamp would differ.
  await page.waitForTimeout(60);

  await page.click('#compute_btn');
  await page.waitForSelector('.cross-strip', { timeout: 3000 });
  // Read what we persisted: the storage adapter writes the engine output;
  // the engine echoes the payload's preference object verbatim in result.
  const ts1 = await page.evaluate(() => {
    const raw = localStorage.getItem('ofty_m1_advanced_result');
    if (!raw) return null;
    const o = JSON.parse(raw);
    const p = o && o.result && o.result.clinician_documented_preference;
    return p && p.timestamp ? p.timestamp : null;
  });
  check('item 5: preference has a persisted timestamp', !!ts1, ts1);
  await page.waitForTimeout(80);
  // Recompute WITHOUT changing source/rationale → timestamp must NOT change
  await page.click('#compute_btn');
  await page.waitForSelector('.cross-strip', { timeout: 3000 });
  const ts2 = await page.evaluate(() => {
    const o = JSON.parse(localStorage.getItem('ofty_m1_advanced_result'));
    return o.result.clinician_documented_preference.timestamp;
  });
  check('item 5: timestamp UNCHANGED across recompute when neither source nor rationale changed', ts1 === ts2, ts1 + ' vs ' + ts2);
  // Now change rationale → timestamp must update
  await fill(page, 'pref_rationale', 'Updated rationale.');
  await page.waitForTimeout(20);
  await page.click('#compute_btn');
  await page.waitForSelector('.cross-strip', { timeout: 3000 });
  const ts3 = await page.evaluate(() => {
    const o = JSON.parse(localStorage.getItem('ofty_m1_advanced_result'));
    return o.result.clinician_documented_preference.timestamp;
  });
  check('item 5: timestamp UPDATED when rationale changes', ts3 > ts2, ts2 + ' → ' + ts3);

  const bothText = await page.textContent('#result_region');
  check('Both: ORA 18.0', /18\.0 mmHg/.test(bothText));
  check('Both: Corvis 22.0', /22\.0 mmHg/.test(bothText));
  check('Both: cross-device diff 4.0', /4\.0 mmHg/.test(bothText));
  check('Both (unconfirmed): U5 string',
    /Numerical difference shown; clinical comparison not established\./.test(bothText));
  check('Both: Reference line present in Corvis sub-card', /Reference/.test(bothText));
  check('Both: clinician preference rationale rendered', /Updated rationale\./.test(bothText));
  check('Both: preference labeled "not exported as primary"', /not exported as primary/.test(bothText));
  // Item 8 grouping observed in Both (multiple scopes expected)
  const bothGroupHeads = await page.locator('.flag-group-head').count();
  check('Both: caution flags grouped by scope (≥2 groups expected)', bothGroupHeads >= 2, 'groups=' + bothGroupHeads);

  await page.screenshot({ path: path.join(SHOTS, 'both.png'), fullPage: true });

  // Both (confirmed): threshold interpretation
  await setCheck(page, 'clinician_confirmation', true);
  await page.click('#compute_btn');
  await page.waitForSelector('.cross-strip', { timeout: 3000 });
  const bothConfText = await page.textContent('#result_region');
  check('Both (confirmed): threshold interpretation string',
    /Cross-device difference exceeds the OFTY review threshold\./.test(bothConfText));

  // Switching back: temporal must CLOSE again (item 6)
  await page.selectOption('#device_branch', 'ora');
  await page.waitForTimeout(120);
  check('item 6: temporal closed when switching back to ORA from Both',
    !(await page.evaluate(() => document.getElementById('acc_temporal').open)));

  // Failure
  await fill(page, 'gat_iop', 18); await fill(page, 'cct', 540);
  await fill(page, 'ora_iopcc', 18.2); await fill(page, 'ora_ch', 10);
  await fill(page, 'ora_wfs', 7.5); await fill(page, 'ora_count', 4);
  await setCheck(page, 'ora_provenance_confirmed', true);
  await fill(page, 'gat_iop', 999);
  await page.click('#compute_btn');
  await page.waitForSelector('.failure-card', { timeout: 3000 });
  const failText = await page.textContent('.failure-card');
  check('Failure: card rendered', /No interpretable result/.test(failText));
  check('Failure: Code line present', /Code:/.test(failText));
  check('Failure: remediation present', /What to do:/.test(failText));
  check('Failure: NO copy button in failure card', (await page.locator('.failure-card .copy-btn').count()) === 0);
  await page.screenshot({ path: path.join(SHOTS, 'failure.png'), fullPage: true });

  check('PART A: no console/page errors', consoleErrors.length === 0, consoleErrors.slice(0,3).join(' | '));

  // ============================================================
  // PART B — tampered artifacts: gate must REFUSE compute
  // ============================================================
  async function expectBannerWith(detailRegex, label) {
    const page2 = await browser.newPage({ viewport: { width: 900, height: 800 } });
    await loadPageWaitForGate(page2, base, true);
    const visible = await page2.isVisible('#manifest_banner');
    const disabled = await page2.isDisabled('#compute_btn');
    const detail = await page2.textContent('#manifest_banner_detail');
    check('tamper [' + label + ']: banner visible', visible);
    check('tamper [' + label + ']: compute disabled', disabled);
    check('tamper [' + label + ']: banner detail matches', detailRegex.test(detail), 'detail=' + detail);
    await page2.close();
  }

  // B.1 — tamper manifest engine_algorithm_version
  {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'build.manifest.json'), 'utf8'));
    m.engine_algorithm_version = '0.0.0-not-the-real-version';
    OVERRIDES = { '/build.manifest.json': Buffer.from(JSON.stringify(m, null, 2)) };
    await expectBannerWith(/ALG_VERSION/, 'manifest ALG_VERSION');
  }
  // B.2 — tamper manifest bundle hash
  {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'build.manifest.json'), 'utf8'));
    m.sha256['m1_advanced_bundle.js'].hash = 'deadbeef'.repeat(8);
    OVERRIDES = { '/build.manifest.json': Buffer.from(JSON.stringify(m, null, 2)) };
    await expectBannerWith(/bundle SHA-256/, 'manifest bundle hash');
  }
  // B.3 — tamper served schema $id (live schema hash differs from manifest)
  {
    const realSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'm1_advanced_schema.json'), 'utf8'));
    realSchema.$id = 'M1-ADV-SCHEMA-BOGUS';
    const tampered = Buffer.from(JSON.stringify(realSchema));
    const tHash = crypto.createHash('sha256').update(tampered).digest('hex');
    OVERRIDES = { '/m1_advanced_schema.json': tampered };
    await expectBannerWith(/(schema SHA-256|schema \$id)/, 'schema $id+hash (live hash ' + tHash.slice(0,8) + '\u2026)');
  }
  OVERRIDES = {};

  // ============================================================
  // Report + shutdown
  // ============================================================
  const report = {
    report: 'index.html \u2014 preliminary browser smoke (erratum-corrected)',
    generated_utc: new Date().toISOString(),
    environment: {
      node: process.version,
      playwright_chromium: browser.version()
    },
    counts: { pass, fail, total: pass + fail },
    log: log,
    screenshots: ['screenshots/ora.png', 'screenshots/corvis.png', 'screenshots/both.png', 'screenshots/failure.png'],
    note: 'This is NOT the U1\u2013U21 acceptance gate. Coverage is preliminary; U1\u2013U21 to be run in the next gate.'
  };
  fs.writeFileSync(path.join(ROOT, 'browser_smoke_report.json'), JSON.stringify(report, null, 2));

  console.log('\u2550'.repeat(47));
  console.log('  INDEX.HTML \u2014 PRELIMINARY BROWSER SMOKE (erratum)');
  console.log('\u2550'.repeat(47));
  console.log(log.join('\n'));
  console.log('\u2500'.repeat(47));
  console.log('  Passed: ' + pass + '   Failed: ' + fail);
  console.log('  ' + (fail === 0 ? 'ALL GREEN \u2713' : 'FAILURES \u2717'));
  console.log('\u2550'.repeat(47));

  await browser.close();
  server.close();
  if (fail > 0) process.exit(1);
})().catch(e => { console.error('SMOKE THREW:', e); process.exit(2); });
