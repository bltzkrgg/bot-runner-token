import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, setConfigValue } from "../src/config.js";

test("setConfigValue updates boolean fields", () => {
  const result = setConfigValue(DEFAULT_CONFIG, "tokenAlerts.enabled", "true");
  assert.equal(result.previousValue, false);
  assert.equal(result.nextValue, true);
  assert.equal(result.config.tokenAlerts.enabled, true);
});

test("setConfigValue rejects out of range poll intervals", () => {
  assert.throws(() => setConfigValue(DEFAULT_CONFIG, "tokenAlerts.pollIntervalSec", "10"), /between 15 and 300/);
  assert.throws(() => setConfigValue(DEFAULT_CONFIG, "tokenAlerts.pollIntervalSec", "301"), /between 15 and 300/);
});

test("setConfigValue accepts BSC fee config", () => {
  const result = setConfigValue(DEFAULT_CONFIG, "bscAlerts.minTotalFeesBnb", "1.5");
  assert.equal(result.config.bscAlerts.minTotalFeesBnb, 1.5);
});
