import { Client, Events, GatewayIntentBits, Partials, PermissionFlagsBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { supportedConfigKeys } from "./config.js";
import { looksLikeContractAddress } from "./address.js";

const SCAN_COMMANDS = ["scan", "quick", "dev", "holders", "smart", "similar"];

export function buildCommands() {
  return [
    ...SCAN_COMMANDS.map((name) => new SlashCommandBuilder().setName(name)
      .setDescription(`Token intelligence: ${name}`)
      .addStringOption((option) => option.setName("ca").setDescription("Solana / BSC / Robinhood CA").setRequired(true))),
    new SlashCommandBuilder().setName("help").setDescription("Show bot commands"),
    new SlashCommandBuilder()
      .setName("setconfig")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDescription("Update runner bot config")
      .addStringOption((option) =>
        option.setName("key")
          .setDescription("Config key, e.g. tokenAlerts.enabled")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((option) =>
        option.setName("value")
          .setDescription("New config value")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("getconfig")
      .setDescription("Show current runner bot config")
  ].map((command) => command.toJSON());
}

export async function registerCommands({ token, clientId, guildId }) {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: buildCommands() });
}

export function createDiscordClient({ configStore, scanService, scanChannelIds = [], logger = console }) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent], partials: [Partials.Channel] });

  client.once(Events.ClientReady, (readyClient) => {
    logger.log(`Discord bot logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleDiscordInteraction(interaction, { configStore, scanService }).catch((error) => logger.error("Discord interaction failed", error));
  });
  const activeUsers = new Set();
  client.on(Events.MessageCreate, (message) => {
    if (message.author.bot || message.webhookId || (scanChannelIds.length && !scanChannelIds.includes(message.channelId))) return;
    const mint = message.content.trim();
    if (!looksLikeContractAddress(mint)) return;
    if (activeUsers.has(message.author.id) || activeUsers.size >= 20) return;
    activeUsers.add(message.author.id);
    void (async () => {
      try {
        const report = await scanService.scan(mint);
        for (const content of splitDiscordText(report)) await message.reply({ content, allowedMentions: { parse: [] } });
      } catch {
        await message.reply({ content: "Scan gagal atau alamat mint tidak valid.", allowedMentions: { parse: [] } });
      } finally {
        activeUsers.delete(message.author.id);
      }
    })().catch((error) => logger.error("Discord message scan failed", error));
  });
  return client;
}

export function splitDiscordText(text) {
  const chunks = [];
  for (let offset = 0; offset < text.length; offset += 1900) chunks.push(text.slice(offset, offset + 1900));
  return chunks;
}

export async function handleDiscordInteraction(interaction, { configStore, scanService }) {
    if (interaction.isAutocomplete()) {
      const focused = interaction.options.getFocused().toLowerCase();
      const choices = supportedConfigKeys()
        .filter((key) => key.toLowerCase().includes(focused))
        .slice(0, 25)
        .map((key) => ({ name: key, value: key }));
      await interaction.respond(choices);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "help") {
      await interaction.reply({ content: "/scan /quick /dev /holders /smart /similar <ca>\n/getconfig /setconfig key value\nRunner dan spike alerts memakai config bersama Discord/Telegram. Intelligence saat ini demo.", ephemeral: true });
      return;
    }
    if (SCAN_COMMANDS.includes(interaction.commandName)) {
      await interaction.deferReply({ ephemeral: true });
      try {
        const report = await scanService.scan(interaction.options.getString("ca", true), interaction.commandName);
        const [first, ...rest] = splitDiscordText(report);
        await interaction.editReply({ content: first, allowedMentions: { parse: [] } });
        for (const content of rest) await interaction.followUp({ content, ephemeral: true, allowedMentions: { parse: [] } });
      } catch {
        await interaction.editReply({ content: "Scan gagal atau alamat mint tidak valid. Periksa log layanan." });
      }
      return;
    }

    if (interaction.commandName === "getconfig") {
      await interaction.reply({ content: codeBlock(JSON.stringify(configStore.get())), ephemeral: true });
      return;
    }

    if (interaction.commandName === "setconfig") {
      if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "Manage Server permission required.", ephemeral: true });
        return;
      }
      const key = interaction.options.getString("key", true);
      const value = interaction.options.getString("value", true);
      try {
        const result = await configStore.update(key, value);
        await interaction.reply({
          content: `Updated \`${key}\`: \`${result.previousValue}\` → \`${result.nextValue}\``,
          ephemeral: true
        });
      } catch (error) {
        await interaction.reply({
          content: `Config error: ${error.message}\nUse the key autocomplete to choose a supported config key.`,
          ephemeral: true
        });
      }
    }
}

export async function sendAlert({ client, channelId, webhookUrl, message }) {
  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: message, allowed_mentions: { parse: [] } })
    });

    if (response.status === 429) {
      const body = await response.json();
      await sleep(Math.ceil((body.retry_after ?? 1) * 1000));
      return sendAlert({ client, channelId, webhookUrl, message });
    }

    if (!response.ok) throw new Error(`Discord webhook failed: ${response.status}`);
    return;
  }

  if (!channelId) throw new Error("Missing DISCORD_ALERT_CHANNEL_ID or DISCORD_ALERT_WEBHOOK_URL");
  const channel = await client.channels.fetch(channelId);
  await channel.send({ content: message, allowedMentions: { parse: [] } });
}

function codeBlock(value) {
  return `\`\`\`json\n${value}\n\`\`\``;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
