import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, mergeConfig, setConfigValue } from "../src/config.js";
import { GmgnClient, normalizeToken } from "../src/gmgnClient.js";
import { detectVolumeSpike } from "../src/volumeSpike.js";
import { formatRunnerAlert } from "../src/format.js";
import { RunnerScanner } from "../src/scanner.js";
import { AlertCache } from "../src/alertCache.js";
import { AlertQueue } from "../src/rateLimiter.js";

const config = DEFAULT_CONFIG.solanaSpikeAlerts;

function fixture(nowSec = Math.floor(Date.now() / 1000)) {
  return {
    ca: "TEST_ONLY", symbol: "TEST", migrated: true, migratedAtSec: nowSec - 172800,
    volume5mUsd: 120000, volumeWindowEndSec: nowSec,
    volumeHistory5m: Array.from({ length: 6 }, (_, index) => ({
      startTimeSec: nowSec - (index + 2) * 300,
      endTimeSec: nowSec - (index + 1) * 300, volumeUsd: 20000
    }))
  };
}

test("old migrated tokens trigger 6x spike without runner age or fees filters", () => {
  const token = normalizeToken(fixture(200000), "solana");
  const spike = detectVolumeSpike(token, config, 200000);
  assert.equal(spike.baselineUsd, 20000);
  assert.equal(spike.multiplier, 6);
  for (const chain of ["solana", "bsc", "robinhood"]) {
    const message = formatRunnerAlert(chain, token, spike);
    assert.match(message, /VOLUME SPIKE/);
    assert.match(message, /Migrated 2d ago/);
    assert.match(message, /6×/);
    assert.match(message, /VOL ≥ \$100K/);
  }
});

test("rejects unverified migration, insufficient history, overlaps, duplicates, stale and invalid volume", () => {
  const modifications = [
    (t) => { t.migrated = false; },
    (t) => { t.migrated = "true"; },
    (t) => { t.ca = ""; },
    (t) => { t.migratedAtSec = 200001; },
    (t) => { t.migratedAtSec = 199000; },
    (t) => { t.volume5mUsd = 99999; },
    (t) => { t.volume5mUsd = 50000; },
    (t) => { t.volumeWindowEndSec -= 121; },
    (t) => { t.volumeWindowEndSec++; },
    (t) => { t.volumeHistory5m.pop(); },
    (t) => { t.volumeHistory5m[0].startTimeSec++; },
    (t) => { t.volumeHistory5m.push(t.volumeHistory5m[0]); },
    (t) => { t.volumeHistory5m[0].volumeUsd = -1; },
    (t) => { t.volumeHistory5m[0].volumeUsd = null; },
    (t) => { t.volumeHistory5m.forEach((p) => { p.volumeUsd = 0; }); }
  ];
  for (const change of modifications) {
    const token = fixture(200000);
    change(token);
    assert.equal(detectVolumeSpike(normalizeToken(token, "solana"), config, 200000), undefined);
  }
  const token = fixture(200000);
  token.volume5mUsd = 100000;
  assert.equal(detectVolumeSpike(token, { ...config, minMultiplier: 5 }, 200000).multiplier, 5);
  assert.equal(detectVolumeSpike(token, { ...config, minMultiplier: 5.1 }, 200000), undefined);
});

test("legacy config merges spike defaults and validates Discord spike settings", () => {
  const merged = mergeConfig({ tokenAlerts: { enabled: true } });
  assert.equal(merged.tokenAlerts.enabled, true);
  assert.equal(merged.bscSpikeAlerts.enabled, false);
  assert.equal(setConfigValue(merged, "robinhoodSpikeAlerts.enabled", "true").nextValue, true);
  for (const [key, value] of [["minMultiplier", "1"], ["baselinePeriods", "25"], ["baselinePeriods", "1.5"], ["cooldownMin", "1441"]]) {
    assert.throws(() => setConfigValue(merged, `solanaSpikeAlerts.${key}`, value));
  }
  assert(JSON.stringify(merged).length + 12 < 2000, "getconfig must fit Discord content limit");
});

test("spike cooldown is separate, pending sends deduplicate, and cached candidates do not consume scan budget", async () => {
  const first = fixture();
  const second = { ...fixture(), ca: "SECOND" };
  let tokens = [first, second];
  const queued = [];
  const cache = new AlertCache({ ttlMs: 86400000 });
  await cache.set(`solana:${first.ca}`);
  const scanner = new RunnerScanner({ runnerType: "solana", spike: true,
    configStore: {}, gmgnClient: { fetchCandidates: async (_, options) => { assert(options.spike); return tokens; } },
    alertQueue: { enqueue: (item) => queued.push(item) }, alertCache: cache });
  const scanConfig = { ...config, maxPerScan: 1 };
  await scanner.scan(scanConfig);
  assert.equal(queued.length, 1);
  assert.equal(cache.has(`spike:solana:${first.ca}`), false);
  await scanner.scan(scanConfig);
  assert.equal(queued.length, 2);
  await queued[0].onSent();
  queued[0].onSettled();
  tokens = [first];
  await scanner.scan(scanConfig);
  assert.equal(queued.length, 2);
  cache.seen.set(`spike:solana:${first.ca}`, Date.now() - 16 * 60000);
  await scanner.scan(scanConfig);
  assert.equal(queued.length, 3);
  // Persisted timestamps respect each chain's configurable cooldown after restart.
  const restored = new AlertCache({ initial: cache.toJSON(), ttlMs: 86400000 });
  assert.equal(restored.has(`spike:solana:${first.ca}`, 15 * 60000), false);
  assert.equal(restored.has(`spike:solana:${first.ca}`, 60 * 60000), true);
});

test("failed sends release pending spikes and queue continues sending", async () => {
  const events = [];
  const queue = new AlertQueue({ sendIntervalMs: 0, logger: { error: () => {} },
    sender: async (item) => { if (item.id === 1) throw new Error("offline"); events.push(item.id); } });
  const done = new Promise((resolve) => {
    queue.enqueue({ id: 1, onSent: () => events.push("wrong"), onSettled: () => events.push("released") });
    queue.enqueue({ id: 2, onSent: () => events.push("cached"), onSettled: resolve });
  });
  await done;
  assert.deepEqual(events, ["released", 2, "cached"]);
});

test("expired and evicted spike alerts release their pending reservation without cooldown", async () => {
  const events = [];
  const queue = new AlertQueue({ maxSize: 1, sender: async () => events.push("sent") });
  queue.running = true;
  queue.enqueue({ onSettled: () => events.push("evicted") });
  queue.enqueue({ onSent: () => events.push("cached"), onSettled: () => events.push("expired") });
  queue.items[0].queuedAt = Date.now() - 180001;
  queue.sendIntervalMs = 0;
  await queue.drain();
  assert.deepEqual(events, ["evicted", "expired"]);
});

test("spike scanner selects its chain config and HTTP feed, normalizes numeric strings, and sends through queue", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push(url);
    assert(options.signal);
    const token = fixture();
    token.migration_status = "completed";
    delete token.migrated;
    token.volume5mUsd = "120000";
    token.volumeHistory5m = token.volumeHistory5m.map((period) => ({ ...period, volumeUsd: "20000" }));
    return { ok: true, json: async () => ({ data: { tokens: [token] } }) };
  };
  try {
    const gmgn = new GmgnClient({ GMGN_SOLANA_URL: "https://fixture.invalid/runner",
      GMGN_SOLANA_SPIKE_URL: "https://fixture.invalid/spike" });
    const saved = [];
    const cache = new AlertCache({ ttlMs: 86400000, onChange: async (value) => saved.push(value) });
    let finish;
    const done = new Promise((resolve) => { finish = resolve; });
    const queue = new AlertQueue({ sendIntervalMs: 0, sender: async ({ message }) => {
      assert.match(message, /SOLANA VOLUME SPIKE/);
      assert.match(message, /\$20K/);
    } });
    const enqueue = queue.enqueue.bind(queue);
    queue.enqueue = (item) => enqueue({ ...item, onSettled: () => { item.onSettled(); finish(); } });
    const store = mergeConfig();
    store.solanaSpikeAlerts.enabled = true;
    const scanner = new RunnerScanner({ runnerType: "solana", spike: true, configStore: { get: () => store },
      gmgnClient: gmgn, alertCache: cache, alertQueue: queue });
    try {
      await scanner.tick();
      await done;
      assert.deepEqual(requests, ["https://fixture.invalid/spike"]);
      assert.equal(saved.length, 1);
      assert.equal(cache.has("spike:solana:TEST_ONLY", 900000), true);
      assert.equal(scanner.pending.size, 0);
      await gmgn.fetchCandidates("solana");
      assert.equal(requests[1], "https://fixture.invalid/runner");
      delete gmgn.env.GMGN_SOLANA_SPIKE_URL;
      await gmgn.fetchCandidates("solana", { spike: true });
      assert.equal(requests[2], "https://fixture.invalid/runner");
    } finally {
      scanner.stop();
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
