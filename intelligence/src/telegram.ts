import { createRuntime } from "./runtime.js";
import { createTelegramBot } from "./telegramBot.js";

const runtime = createRuntime();
const bot = createTelegramBot(runtime);
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { bot.stop(); });
try { await bot.start(); } finally { await runtime.repository.close(); }
