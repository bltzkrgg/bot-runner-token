import test from "node:test";
import assert from "node:assert/strict";
import { configSchema } from "../src/config.js";
import { MockGmgnAdapter, SourceCache, validateMint } from "../src/gmgn.js";
import { snapshotSchema, type Historical, type Snapshot } from "../src/types.js";
import { MemoryRepository } from "../src/database/repository.js";
import { ScanService } from "../src/service.js";
import { percentile, comparableCohort, nearestNeighbors, analyze } from "../src/benchmark.js";
import { developerSummary, formatReport } from "../src/report.js";
import { createTelegramBot } from "../src/telegramBot.js";

const mint = "So11111111111111111111111111111111111111112";
const config = configSchema.parse({});
const snapshot: Snapshot = { mintAddress: mint, snapshotAt: "2026-06-01T00:00:00.000Z", source: "gmgn",
  launchpad: "Pump.fun", migrated: true, ageMinutes: 24, marketCapUsd: 186000, liquidityUsd: 38000,
  top10Pct: 17.9, bundlerPct: 6.3, insiderPct: 3.7, sniperPct: 8.1, devHoldingPct: 0.4,
  smartMoneyCount: 8, smartMoneyHoldingPct: 4.2, volume5m: 100000, holderCount: 1142 };
function historical(n = 20): Historical[] {
  return Array.from({ length: n }, (_, index) => ({ id: String(index), snapshot: {
    ...snapshot, mintAddress: `test-${index}`, snapshotAt: "2026-01-01T00:00:00.000Z",
    top10Pct: 10 + index, bundlerPct: index, insiderPct: index / 2, sniperPct: index / 3,
    devHoldingPct: index / 10, smartMoneyCount: index, holderCount: 1000 + index,
    liquidityUsd: 35000 + index * 100, volume5m: index * 1000
  }, outcomes: { availableAt: "2026-01-02T00:00:00.000Z", hit2x6h: index < 10,
    hit3x24h: index < 4, rugLike6h: index === 0 } }));
}

test("mint validation decodes exactly 32 bytes and rejects invalid alphabets/lengths", () => {
  assert(validateMint(mint));
  assert(validateMint("11111111111111111111111111111111"));
  for (const invalid of ["0".repeat(44), "O".repeat(44), "1".repeat(44), "abc", "<CA>", ` ${mint}`]) assert(!validateMint(invalid));
});

test("normalization preserves nulls and rejects out-of-range percentages", () => {
  assert.equal(snapshotSchema.parse({ ...snapshot, bundlerPct: null }).bundlerPct, null);
  assert.throws(() => snapshotSchema.parse({ ...snapshot, top10Pct: 101 }));
  assert.throws(() => snapshotSchema.parse({ ...snapshot, smartMoneyCount: 1.5 }));
  assert.throws(() => snapshotSchema.parse({ ...snapshot, priceUsd: "0.01" }));
});

test("cache deduplicates concurrent source requests, expires, and retries failures", async () => {
  let requests = 0, now = 0;
  const cache = new SourceCache({ fetchToken: async () => { requests++; await Promise.resolve(); return snapshot; } }, 120000, () => now);
  const results = await Promise.all([cache.get(mint), cache.get(mint)]);
  assert.equal(requests, 1);
  assert.deepEqual(results.map((r) => r.cacheHit), [false, true]);
  assert.equal((await cache.get(mint)).cacheHit, true);
  now = 120000;
  await cache.get(mint); assert.equal(requests, 2);
  const failed = new SourceCache({ fetchToken: async () => { throw new Error("failure"); } }, 100);
  await assert.rejects(failed.get(mint));
  await assert.rejects(failed.get(mint));
  const mismatch = new SourceCache({ fetchToken: async () => ({ ...snapshot, mintAddress: "wrong" }) }, 100);
  await assert.rejects(mismatch.get(mint), /SOURCE_MINT_MISMATCH/);
});

test("directional percentiles use midrank ties and no missing-value imputation", () => {
  assert.equal(percentile(2, [1, 2, 3], true), 50);
  assert.equal(percentile(1, [1, 2, 3], false), 100 * 2.5 / 3);
  assert.equal(percentile(4, [1, 2, 3], true), 100);
  assert.equal(percentile(1, [], true), null);
});

test("cohort widens age then market cap, preserves lifecycle, and counts unique past tokens", () => {
  const rows = historical();
  rows[0]!.snapshot.ageMinutes = 90;
  rows[1]!.snapshot.marketCapUsd = 500000;
  rows.push({ ...rows[2]!, id: "duplicate" });
  rows.push({ id: "future", snapshot: { ...snapshot, mintAddress: "future", snapshotAt: "2027-01-01T00:00:00.000Z" } });
  const cohort = comparableCohort(snapshot, rows, 20);
  assert.equal(cohort.rows.length, 20);
  assert.deepEqual(cohort.relaxed, ["age", "market_cap"]);
  assert.equal(comparableCohort({ ...snapshot, migrated: false }, rows, 1).rows.length, 0);
});

test("similarity uses historical features and excludes incomplete feature vectors", () => {
  const rows = historical();
  assert.equal(nearestNeighbors(snapshot, rows, 5).length, 5);
  const rankings = nearestNeighbors(snapshot, rows, 5).map((r) => r.id);
  rows.forEach((r) => { r.outcomes = { availableAt: "2026-01-02T00:00:00.000Z", hit2x6h: false }; });
  assert.deepEqual(nearestNeighbors(snapshot, rows, 5).map((r) => r.id), rankings);
  assert.deepEqual(nearestNeighbors({ mintAddress: mint, snapshotAt: snapshot.snapshotAt, source: "gmgn" }, rows, 5), []);
});

test("historical rates exclude future/unmatured labels and synthetic data cannot produce scores", () => {
  const rows = historical();
  const settings = { ...config, MIN_COHORT_SIZE: 10, MIN_OUTCOME_SAMPLE: 10, NEIGHBOR_COUNT: 20 };
  let analysis = analyze(snapshot, rows, settings);
  assert.equal(analysis.outcomeRates.find((r) => r.name === "hit2x6h")!.rate, 0.5);
  rows[0]!.outcomes!.availableAt = "2027-01-01T00:00:00.000Z";
  rows[1]!.outcomes!.availableAt = "2026-01-01T01:00:00.000Z";
  analysis = analyze(snapshot, rows, settings);
  assert.equal(analysis.outcomeRates[0]!.n, 18);
  assert.equal(analyze(snapshot, rows, config).setupScore, null);
  const demo = analyze({ ...snapshot, source: "mock" }, rows.map((r) => ({ ...r, snapshot: { ...r.snapshot, source: "mock" } })), settings);
  assert.equal(demo.setupScore, null);
  assert(demo.outcomeRates.every((r) => r.rate === null));
});

test("fixture scans persist audit results and all reports show demo/missing data honestly", async () => {
  const repo = new MemoryRepository();
  const cache = new SourceCache(new MockGmgnAdapter(), 120000);
  const logs: Record<string, unknown>[] = [];
  const service = new ScanService(cache, repo, config, (event) => logs.push(event));
  const report = await service.scan(mint);
  assert.match(report, /DATA BUATAN, BUKAN DATA CA INI/);
  assert.match(report, /DATA BELUM CUKUP/);
  await service.scan(mint, "quick");
  assert.equal(repo.scans.length, 2);
  assert.equal(repo.rows.length, 1);
  assert.equal(repo.scans[1]!.cacheHit, true);
  assert.equal(logs[0]!.gmgn_requests, 0);
  for (const mode of ["scan", "quick", "dev", "holders", "smart", "similar"] as const) {
    assert(formatReport(snapshot, analyze(snapshot, [], config), mode, false).length < 4096);
  }
  assert.match(developerSummary(snapshot).join(), /belum cukup/);
  assert.match(developerSummary({ ...snapshot, developer: { wallet: "TEST", launchCount: 12,
    successfulCount: 3, failedCount: 6, rugLikeCount: 2 } }).join(), /11 peluncuran berlabel/);
});

test("Telegram plain CA and commands send Indonesian fixture reports without external API calls", async () => {
  const repo = new MemoryRepository();
  const service = new ScanService(new SourceCache(new MockGmgnAdapter(), 120000), repo, config, () => {});
  const bot = createTelegramBot({ config: { ...config, TELEGRAM_BOT_TOKEN: "123456:offline-test",
    USER_HASH_SECRET: "x".repeat(32) }, service }, { id: 123456, is_bot: true, first_name: "Test",
    username: "testbot", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false,
    can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false,
    allows_users_to_create_topics: false, can_manage_bots: false, supports_join_request_queries: false });
  const sent: string[] = [];
  bot.api.config.use(async (_previous, method, payload) => {
    assert.equal(method, "sendMessage");
    sent.push((payload as { text: string }).text);
    return { ok: true, result: { message_id: 1, date: 0, chat: { id: 1, type: "private" } } } as never;
  });
  for (const [index, text] of [mint, `/quick ${mint}`, `/dev ${mint}`, "/scan invalid"].entries()) {
    const command = text.startsWith("/") ? text.split(" ")[0]! : undefined;
    await bot.handleUpdate({ update_id: index, message: { message_id: index + 1, date: 0,
      chat: { id: 1, type: "private", first_name: "Test" }, from: { id: 1, is_bot: false, first_name: "Test" }, text,
      ...(command ? { entities: [{ type: "bot_command", offset: 0, length: command.length }] } : {}) } });
  }
  assert.equal(repo.scans.length, 3);
  assert(sent.slice(0, 3).every((text) => text.includes("MODE DEMO")));
  assert.match(sent[3]!, /tidak valid/);
});

test("Telegram config commands use shared controls and restrict writes to configured admins", async () => {
  let enabled = false;
  const service = new ScanService(new SourceCache(new MockGmgnAdapter(), 120000), new MemoryRepository(), config, () => {});
  const bot = createTelegramBot({ config: { ...config, TELEGRAM_BOT_TOKEN: "123456:offline-test", USER_HASH_SECRET: "x".repeat(32) }, service },
    { id: 123456, is_bot: true, first_name: "Test", username: "testbot", can_join_groups: true,
      can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false,
      has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false,
      can_manage_bots: false, supports_join_request_queries: false },
    { adminIds: ["1"], controls: { get: () => ({ tokenAlerts: { enabled } }),
      update: async (key, value) => { assert.equal(key, "tokenAlerts.enabled"); const previousValue = enabled; enabled = value === "true"; return { previousValue, nextValue: enabled }; } } });
  const sent: string[] = [];
  bot.api.config.use(async (_previous, _method, payload) => {
    sent.push((payload as { text: string }).text);
    return { ok: true, result: { message_id: 1, date: 0, chat: { id: 1, type: "private" } } } as never;
  });
  for (const [index, user] of [2, 1].entries()) {
    await bot.handleUpdate({ update_id: index, message: { message_id: index + 1, date: 0,
      chat: { id: user, type: "private", first_name: "Test" }, from: { id: user, is_bot: false, first_name: "Test" },
      text: "/setconfig tokenAlerts.enabled true", entities: [{ type: "bot_command", offset: 0, length: 10 }] } });
    assert.equal(enabled, user === 1);
  }
  assert.match(sent[0]!, /Hanya admin/);
  assert.match(sent[1]!, /Updated/);
});
