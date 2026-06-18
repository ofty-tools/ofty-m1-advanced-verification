// m1_advanced_browser_entry.js
// OFTY-Gx-M1-Advanced — browser entry point (UI Spec §8.2).
// Bundles the FROZEN engine + FROZEN storage adapter + AJV 2020 + ajv-formats
// + FROZEN schema into a single IIFE (global: M1ADV). No CDN dependency.
// This file adds NO clinical logic. It is pure wiring over frozen artifacts.

'use strict';

const engine        = require('./m1_advanced_engine.js');
const adapterModule = require('./m1_advanced_storage_adapter.js');
const Ajv           = require('ajv/dist/2020');
const addFormats    = require('ajv-formats');
const schema        = require('./m1_advanced_schema.json');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateOutput = ajv.compile(schema);

function createStorageAdapter(storage) {
  // The injected AJV validator is MANDATORY (storage adapter contract).
  return adapterModule.createM1AdvancedStorageAdapter(storage, validateOutput);
}

module.exports = {
  computeM1Advanced: engine.computeM1Advanced,
  createStorageAdapter,
  validateOutput,
  CONSTANTS:         engine.CONSTANTS
};
