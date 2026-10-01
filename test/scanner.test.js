import test from "node:test";
import assert from "node:assert/strict";
import { qualifies } from "../src/scanner.js";

test("solana qualification requires volume, market cap, fees, and age", () => {
  const token = { volume5mUsd: 100000, marketCapUsd: 100000, feesAmount: 10, ageMinutes: 30 };
  const config = { minVolume5mUsd: 100000, minMarketCapUsd: 100000, minTotalFeesSol: 10, maxAgeMin: 30 };
  assert.equal(qualifies("solana", token, config), true);
});

test("robinhood qualification requires volume and ETH fees only", () => {
  const token = { volume5mUsd: 100000, feesAmount: 0.1 };
  const config = { minVolume5mUsd: 100000, minTotalFeesEth: 0.1 };
  assert.equal(qualifies("robinhood", token, config), true);
});

test("bsc qualification requires volume, market cap, BNB fees, and age", () => {
  const token = { volume5mUsd: 100000, marketCapUsd: 100000, feesAmount: 1, ageMinutes: 30 };
  const config = { minVolume5mUsd: 100000, minMarketCapUsd: 100000, minTotalFeesBnb: 1, maxAgeMin: 30 };
  assert.equal(qualifies("bsc", token, config), true);
});

test("qualification rejects missing numeric GMGN fields", () => {
  const solanaConfig = { minVolume5mUsd: 100000, minMarketCapUsd: 100000, minTotalFeesSol: 10, maxAgeMin: 30 };
  const robinhoodConfig = { minVolume5mUsd: 100000, minTotalFeesEth: 0.1 };
  const bscConfig = { minVolume5mUsd: 100000, minMarketCapUsd: 100000, minTotalFeesBnb: 1, maxAgeMin: 30 };

  assert.equal(qualifies("solana", {}, solanaConfig), false);
  assert.equal(qualifies("robinhood", { volume5mUsd: 100000 }, robinhoodConfig), false);
  assert.equal(qualifies("bsc", { volume5mUsd: 100000, feesAmount: 1 }, bscConfig), false);
});
