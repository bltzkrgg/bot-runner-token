import "dotenv/config";
import { AlertCache } from "./alertCache.js";
import { GmgnClient } from "./gmgnClient.js";
import { AlertQueue } from "./rateLimiter.js";
import { createDiscordClient, sendAlert } from "./discord.js";
import { loadConfig, loadJson, saveConfig, saveJson } from "./storage.js";
import { RunnerScanner } from "./scanner.js";
import { createConfigController } from "./control.js";
import { createAlertBroadcaster } from "./delivery.js";
import { createRuntime } from "../intelligence/src/runtime.ts";
import { createTelegramBot } from "../intelligence/src/telegramBot.ts";

const CONFIG_PATH = process.env.CONFIG_PATH ?? "data/config.json";
const ALERT_CACHE_PATH = process.env.ALERT_CACHE_PATH ?? "data/alert-cache.json";
const SPIKE_CACHE_PATH = process.env.SPIKE_CACHE_PATH ?? "data/spike-cache.json";

if (!process.env.DISCORD_TOKEN && !process.env.TELEGRAM_BOT_TOKEN) throw new Error("Configure DISCORD_TOKEN or TELEGRAM_BOT_TOKEN");

const initialConfig = await loadConfig(CONFIG_PATH);
const configStore = createConfigController(initialConfig, (config) => saveConfig(CONFIG_PATH, config));
const intelligence = createRuntime();
const client = process.env.DISCORD_TOKEN ? createDiscordClient({
  configStore, scanService: intelligence.service,
  scanChannelIds: (process.env.DISCORD_SCAN_CHANNEL_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean)
}) : undefined;
const telegram = process.env.TELEGRAM_BOT_TOKEN ? createTelegramBot(intelligence, undefined, {
  controls: configStore,
  adminIds: (process.env.TELEGRAM_ADMIN_USER_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean)
}) : undefined;

const targets = [];
if (client && (process.env.DISCORD_ALERT_CHANNEL_ID || process.env.DISCORD_ALERT_WEBHOOK_URL)) targets.push({
  name: "discord", send: (message) => sendAlert({ client, channelId: process.env.DISCORD_ALERT_CHANNEL_ID,
    webhookUrl: process.env.DISCORD_ALERT_WEBHOOK_URL, message })
});
if (telegram && process.env.TELEGRAM_ALERT_CHAT_ID) targets.push({
  name: "telegram", send: (message) => telegram.api.sendMessage(process.env.TELEGRAM_ALERT_CHAT_ID, message.replaceAll("**", ""))
});
const broadcast = createAlertBroadcaster(targets);
if (client) await client.login(process.env.DISCORD_TOKEN);
if (telegram) await telegram.init();

const alertCache = new AlertCache({
  initial: await loadJson(ALERT_CACHE_PATH, {}),
  onChange: (cache) => saveJson(ALERT_CACHE_PATH, cache)
});
const spikeCache = new AlertCache({
  ttlMs: 24 * 60 * 60 * 1000,
  initial: await loadJson(SPIKE_CACHE_PATH, {}),
  onChange: (cache) => saveJson(SPIKE_CACHE_PATH, cache)
});

const alertQueue = new AlertQueue({
  sendIntervalMs: 1500,
  sender: broadcast
});

const gmgnClient = new GmgnClient(process.env);
const scanners = ["solana", "robinhood", "bsc"].flatMap((runnerType) => [false, true].map((spike) => new RunnerScanner({
  runnerType,
  configStore,
  gmgnClient,
  alertQueue,
  alertCache: spike ? spikeCache : alertCache,
  spike
})));

for (const scanner of scanners) scanner.start();

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
if (telegram) void telegram.start().catch((error) => {
  console.error("Telegram polling failed", error);
  void shutdown().then(() => { process.exitCode = 1; });
});

async function shutdown() {
  for (const scanner of scanners) scanner.stop();
  if (telegram?.isRunning()) await telegram.stop();
  client?.destroy();
  await intelligence.repository.close();
}
