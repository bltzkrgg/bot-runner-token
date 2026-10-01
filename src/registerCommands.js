import "dotenv/config";
import { registerCommands } from "./discord.js";

const required = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_GUILD_ID"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}

await registerCommands({
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID
});

console.log("Registered Discord slash commands.");
