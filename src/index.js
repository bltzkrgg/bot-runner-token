import "dotenv/config";
import { AlertCache } from "./alertCache.js";
import { GmgnClient } from "./gmgnClient.js";
import { AlertQueue } from "./rateLimiter.js";
import { createDiscordClient, sendAlert } from "./discord.js";
import { loadConfig, loadJson, saveConfig, saveJson } from "./storage.js";
import { RunnerScanner } from "./scanner.js";

const CONFIG_PATH = process.env.CONFIG_PATH ?? "data/config.json";
const ALERT_CACHE_PATH = process.env.ALERT_CACHE_PATH ?? "data/alert-cache.json";

if (!process.env.DISCORD_TOKEN) throw new Error("Missing DISCORD_TOKEN");

const initialConfig = await loadConfig(CONFIG_PATH);
const configStore = createConfigStore(initialConfig);
const client = createDiscordClient({
  configStore,
  saveConfig: (config) => saveConfig(CONFIG_PATH, config)
});

await client.login(process.env.DISCORD_TOKEN);

const alertCache = new AlertCache({
  initial: await loadJson(ALERT_CACHE_PATH, {}),
  onChange: (cache) => saveJson(ALERT_CACHE_PATH, cache)
});

const alertQueue = new AlertQueue({
  sendIntervalMs: 1500,
  sender: ({ message }) => sendAlert({
    client,
    channelId: process.env.DISCORD_ALERT_CHANNEL_ID,
    webhookUrl: process.env.DISCORD_ALERT_WEBHOOK_URL,
    message
  })
});

const gmgnClient = new GmgnClient(process.env);
const scanners = ["solana", "robinhood", "bsc"].map((runnerType) => new RunnerScanner({
  runnerType,
  configStore,
  gmgnClient,
  alertQueue,
  alertCache
}));

for (const scanner of scanners) scanner.start();

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function createConfigStore(initial) {
  let current = initial;
  return {
    get: () => current,
    set: (next) => {
      current = next;
    }
  };
}

function shutdown() {
  for (const scanner of scanners) scanner.stop();
  client.destroy();
  process.exit(0);
}
