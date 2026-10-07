import { Client, Events, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { setConfigValue, supportedConfigKeys } from "./config.js";

export function buildCommands() {
  return [
    new SlashCommandBuilder()
      .setName("setconfig")
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

export function createDiscordClient({ configStore, saveConfig, logger = console }) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, (readyClient) => {
    logger.log(`Discord bot logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
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

    if (interaction.commandName === "getconfig") {
      await interaction.reply({ content: codeBlock(JSON.stringify(configStore.get())), ephemeral: true });
      return;
    }

    if (interaction.commandName === "setconfig") {
      const key = interaction.options.getString("key", true);
      const value = interaction.options.getString("value", true);
      try {
        const result = setConfigValue(configStore.get(), key, value);
        configStore.set(result.config);
        await saveConfig(result.config);
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
  });

  return client;
}

export async function sendAlert({ client, channelId, webhookUrl, message }) {
  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: message })
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
  await channel.send(message);
}

function codeBlock(value) {
  return `\`\`\`json\n${value}\n\`\`\``;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
