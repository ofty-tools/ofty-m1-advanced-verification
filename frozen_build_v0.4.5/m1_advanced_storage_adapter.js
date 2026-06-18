/* ============================================================================
   OFTY-Gx-M1-Advanced — Storage Adapter
   Schema version: M1-ADV-SCHEMA-1.3

   This adapter is the ONLY layer permitted to touch persistence.
   The pure engine (m1_advanced_engine.js) never imports this.

   ARCHITECTURAL GUARANTEES (verified by storage tests):
   - Advanced writes ONLY to "ofty_m1_advanced_result"
   - The Core key "ofty_m1_result" is NEVER written by Advanced
   - persistAdvancedResult refuses any object that is not a genuine M1 Advanced
     output (gated by a MANDATORY injected AJV validator)
   - The adapter is injected with a storage implementation (localStorage in
     browser, or a mock in Node tests), so it carries no hard dependency on
     a global localStorage.
   ============================================================================ */

'use strict';

const CORE_KEY     = 'ofty_m1_result';
const ADVANCED_KEY = 'ofty_m1_advanced_result';

/**
 * Create an adapter bound to a storage implementation.
 * @param {object} storage - object exposing getItem(k), setItem(k,v), removeItem(k)
 */
function createM1AdvancedStorageAdapter(storage, validateFn) {
  if (!storage ||
      typeof storage.getItem !== 'function' ||
      typeof storage.setItem !== 'function') {
    throw new Error('A storage implementation with getItem/setItem is required.');
  }
  if (typeof validateFn !== 'function') {
    throw new Error('An AJV validate function (schema gate) is required for the storage adapter.');
  }

  /**
   * Authoritative check that an object is a genuine M1 Advanced output:
   * AJV schema gate AND structural invariants.
   */
  function isM1AdvancedOutput(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (!validateFn(obj)) return false;
    if (obj.status === 'success') {
      return !!obj.result &&
             obj.result.module_id === 'OFTY-Gx-M1' &&
             obj.result.module_variant === 'advanced';
    }
    if (obj.status === 'failure') {
      return obj.module_id === 'OFTY-Gx-M1' &&
             obj.module_variant === 'advanced' &&
             !!obj.failure;
    }
    return false;
  }

  /**
   * Persist an Advanced result. Rejects anything that is not a genuine M1
   * Advanced object, and structurally cannot target the Core key.
   */
  function persistAdvancedResult(advancedOutput) {
    if (!isM1AdvancedOutput(advancedOutput)) {
      throw new Error('Refusing to persist: object is not a valid OFTY-Gx-M1 advanced result.');
    }
    storage.setItem(ADVANCED_KEY, JSON.stringify(advancedOutput));
    return { written_key: ADVANCED_KEY };
  }

  /**
   * Safe read: catches parse errors and rejects invalid objects.
   * Returns { ok: true, value } | { ok: false, reason }.
   */
  function readAdvancedResult() {
    const raw = storage.getItem(ADVANCED_KEY);
    if (raw === null || raw === undefined) return { ok: true, value: null };
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { return { ok: false, reason: 'corrupt_json' }; }
    if (!isM1AdvancedOutput(parsed)) return { ok: false, reason: 'invalid_object' };
    return { ok: true, value: parsed };
  }

  function readCoreResult() {
    const raw = storage.getItem(CORE_KEY);
    if (raw === null || raw === undefined) return { ok: true, value: null };
    try { return { ok: true, value: JSON.parse(raw) }; }
    catch (e) { return { ok: false, reason: 'corrupt_json' }; }
  }

  return {
    persistAdvancedResult,
    readAdvancedResult,
    readCoreResult,
    KEYS: { CORE_KEY, ADVANCED_KEY }
  };
}

module.exports = { createM1AdvancedStorageAdapter, CORE_KEY, ADVANCED_KEY };
