import test from "node:test";
import assert from "node:assert/strict";
import { candidateChains, MockGmgnAdapter, SourceCache } from "../src/gmgn.js";
import { configSchema } from "../src/config.js";
import { ScanService } from "../src/service.js";
import { MemoryRepository } from "../src/database/repository.js";
import { comparableCohort } from "../src/benchmark.js";
import type { Snapshot, Chain } from "../src/types.js";
import { createTelegramBot } from "../src/telegramBot.js";

const evm = "0x" + "a".repeat(40);
const cfg = configSchema.parse({});

test("plain CA routing only includes chains supported by this repo", () => {
  assert.deepEqual(candidateChains(evm), ["bsc", "robinhood"]);
  assert.deepEqual(candidateChains("So11111111111111111111111111111111111111112"), ["solana"]);
  for (const input of ["0x123", "0x" + "g".repeat(40), "1".repeat(44), "hello"]) assert.deepEqual(candidateChains(input), []);
});

test("EVM case normalization and source deduplication are scoped per chain", async () => {
  const calls: Chain[] = [];
  const adapter = new MockGmgnAdapter();
  const cache = new SourceCache({ fetchToken: async (ca, chain) => { calls.push(chain); return adapter.fetchToken(ca, chain); } }, 120000);
  await Promise.all([cache.get(evm, "bsc"), cache.get("0x" + "A".repeat(40), "bsc"), cache.get(evm, "robinhood")]);
  assert.deepEqual(calls, ["bsc", "robinhood"]);
  const repo = new MemoryRepository();
  const service = new ScanService(cache, repo, cfg, () => {});
  const report = await service.scan(evm);
  assert.match(report, /ANALISIS TOKEN BSC/);
  assert.match(report, /ANALISIS TOKEN ROBINHOOD/);
  assert.match(report, /DATA BUATAN/);
  assert.equal(repo.rows.length, 2);
  assert((await repo.history(new Date(Date.now() + 1000).toISOString(), "mock", "bsc")).every((r) => r.snapshot.chain === "bsc"));
  const bsc: Snapshot = { chain: "bsc", source: "gmgn", mintAddress: evm, snapshotAt: "2026-01-02T00:00:00Z" };
  assert.equal(comparableCohort(bsc, [{ id: "other", snapshot: { ...bsc, chain: "robinhood", mintAddress: "different", snapshotAt: "2026-01-01T00:00:00Z" } }], 1).rows.length, 0);
});

test("one absent EVM token does not prevent the other network report", async () => {
  const adapter = new MockGmgnAdapter();
  const service = new ScanService(new SourceCache({ fetchToken: async (mint, chain) => {
    if (chain === "bsc") throw new Error("TOKEN_NOT_FOUND");
    return adapter.fetchToken(mint, chain);
  } }, 120000), new MemoryRepository(), cfg, () => {});
  const report = await service.scan(evm);
  assert.match(report, /ANALISIS TOKEN ROBINHOOD/);
  assert.doesNotMatch(report, /ANALISIS TOKEN BSC/);
});

test("Telegram bare EVM CA automatically returns both labelled reports and ignores ordinary chat", async () => {
  const repo = new MemoryRepository();
  const service = new ScanService(new SourceCache(new MockGmgnAdapter(), 120000), repo, cfg, () => {});
  const bot = createTelegramBot({ service, config: { ...cfg, TELEGRAM_BOT_TOKEN: "123:offline", USER_HASH_SECRET: "x".repeat(32) } },
    { id: 123, is_bot: true, first_name: "Test", username: "testbot", can_join_groups: true,
      can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false,
      has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false,
      can_manage_bots: false, supports_join_request_queries: false });
  const sent: string[] = [];
  bot.api.config.use(async (_prev, _method, payload) => {
    sent.push((payload as { text: string }).text);
    return { ok: true, result: { message_id: 1, date: 0, chat: { id: 1, type: "private" } } } as never;
  });
  for (const [i, text] of ["hello", evm].entries()) await bot.handleUpdate({ update_id: i, message: {
    message_id: i + 1, date: 0, chat: { id: 1, type: "private", first_name: "Test" },
    from: { id: 1, is_bot: false, first_name: "Test" }, text } });
  assert.equal(repo.scans.length, 2);
  assert.match(sent.join(""), /ANALISIS TOKEN BSC/);
  assert.match(sent.join(""), /ANALISIS TOKEN ROBINHOOD/);
});
