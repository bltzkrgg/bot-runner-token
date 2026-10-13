import test from "node:test";
import assert from "node:assert/strict";
import { createConfigController } from "../src/control.js";
import { mergeConfig } from "../src/config.js";
import { createAlertBroadcaster } from "../src/delivery.js";
import { buildCommands, handleDiscordInteraction, createDiscordClient } from "../src/discord.js";
import { looksLikeContractAddress } from "../src/address.js";

test("shared config serializes changes from both platforms and failed writes do not publish", async () => {
  const saved = [];
  const controls = createConfigController(mergeConfig(), async (config) => { saved.push(config); });
  await Promise.all([controls.update("tokenAlerts.enabled", "true"), controls.update("bscSpikeAlerts.enabled", "true")]);
  assert(controls.get().tokenAlerts.enabled);
  assert(controls.get().bscSpikeAlerts.enabled);
  assert.equal(saved.length, 2);
  const broken = createConfigController(mergeConfig(), async () => { throw new Error("disk"); });
  await assert.rejects(broken.update("tokenAlerts.enabled", "true"));
  assert.equal(broken.get().tokenAlerts.enabled, false);
});

test("broadcast retries failed destination without resending successful one", async () => {
  let discord = 0, telegram = 0;
  const broadcast = createAlertBroadcaster([
    { name: "discord", send: async () => { discord++; } },
    { name: "telegram", send: async () => { if (++telegram === 1) throw new Error("temporary"); } }
  ], { wait: async () => {} });
  await broadcast({ message: "runner" });
  assert.equal(discord, 1); assert.equal(telegram, 2);
  let otherSent = false;
  await assert.rejects(createAlertBroadcaster([
    { name: "failed", send: async () => { throw new Error("offline"); } },
    { name: "other", send: async () => { otherSent = true; } }
  ], { wait: async () => {}, attempts: 1 })({ message: "spike" }));
  assert(otherSent);
});

test("Discord has all scan commands, defers scans and splits reports without mentions", async () => {
  const commands = buildCommands().map((command) => command.name);
  for (const name of ["scan", "quick", "dev", "holders", "smart", "similar", "getconfig", "setconfig"]) assert(commands.includes(name));
  const replies = [];
  const interaction = {
    isAutocomplete: () => false, isChatInputCommand: () => true, commandName: "quick",
    options: { getString: () => "TEST_MINT" },
    deferReply: async () => replies.push("deferred"),
    editReply: async (message) => replies.push(message), followUp: async (message) => replies.push(message)
  };
  await handleDiscordInteraction(interaction, { configStore: {}, scanService: { scan: async (mint, mode) => {
    assert.equal(mint, "TEST_MINT"); assert.equal(mode, "quick"); return "x".repeat(3801);
  } } });
  assert.equal(replies[0], "deferred");
  assert.equal(replies.length, 4);
  assert(replies.slice(1).every((reply) => reply.content.length <= 1900 && reply.allowedMentions.parse.length === 0));
});

test("Discord config updates reject non-admin callers", async () => {
  let updated = false;
  const messages = [];
  await handleDiscordInteraction({ isAutocomplete: () => false, isChatInputCommand: () => true,
    commandName: "setconfig", inGuild: () => true, memberPermissions: { has: () => false },
    reply: async (message) => messages.push(message.content) },
  { configStore: { update: () => { updated = true; } } });
  assert.equal(updated, false);
  assert.match(messages[0], /Manage Server/);
});

test("Discord automatically scans bare Solana and EVM CAs in any accessible channel by default", async () => {
  const addresses = ["So11111111111111111111111111111111111111112", "0x" + "a".repeat(40)];
  const calls = [];
  const client = createDiscordClient({ configStore: {}, scanService: { scan: async (ca) => { calls.push(ca); return "report"; } } });
  try {
    for (const ca of addresses) {
      await new Promise((resolve) => {
        client.emit("messageCreate", { author: { id: ca, bot: false }, channelId: "any-channel", content: ca,
          reply: async (message) => { assert.equal(message.content, "report"); resolve(); } });
      });
    }
    client.emit("messageCreate", { author: { id: "bot", bot: true }, content: addresses[0] });
    client.emit("messageCreate", { author: { id: "chat", bot: false }, content: "hello" });
    assert.deepEqual(calls, addresses);
    assert(!looksLikeContractAddress("0x" + "g".repeat(40)));
    assert(!looksLikeContractAddress("a CA inside a sentence"));
  } finally { client.destroy(); }
});
