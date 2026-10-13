import { createHmac } from "node:crypto";
import { Bot, type Context } from "grammy";
import type { Config } from "./config.js";
import type { ScanService } from "./service.js";
import type { UserFromGetMe } from "grammy/types";
import { validateMint } from "./gmgn.js";
import type { ReportMode } from "./report.js";

export function createTelegramBot(runtime: { config: Config; service: ScanService }, botInfo?: UserFromGetMe) {
  const { TELEGRAM_BOT_TOKEN: token, USER_HASH_SECRET: secret } = runtime.config;
  if (!token || !secret || secret.length < 32) throw new Error("TELEGRAM_BOT_TOKEN and USER_HASH_SECRET (>=32 chars) required");
  const bot = new Bot(token, { botInfo });
  const help = "Kirim mint Solana atau /scan <CA>. Command: /quick /dev /holders /smart /similar <CA>. " +
    "Scan hanya saat diminta, tanpa transaksi atau monitoring lanjutan. MODE DEMO memakai data buatan.";
  bot.command(["start", "help"], (ctx) => ctx.reply(help));
  const activeUsers = new Set<number>();
  async function reply(ctx: Context, mint: string, mode: ReportMode) {
    const user = ctx.from?.id;
    if (user == null) return;
    if (activeUsers.has(user) || activeUsers.size >= 20) { await ctx.reply("Scan masih diproses. Coba lagi sebentar."); return; }
    activeUsers.add(user);
    try {
      const userHash = createHmac("sha256", secret!).update(String(user)).digest("hex");
      const report = await runtime.service.scan(mint, mode, userHash);
      // Plain text avoids treating untrusted token metadata as Telegram markup.
      for (let offset = 0; offset < report.length; offset += 3500) await ctx.reply(report.slice(offset, offset + 3500));
    } catch {
      await ctx.reply(validateMint(mint) ? "Scan gagal. Coba lagi nanti; periksa log layanan." : "Alamat mint Solana tidak valid.");
    } finally { activeUsers.delete(user); }
  }
  for (const mode of ["scan", "quick", "dev", "holders", "smart", "similar"] as const) {
    bot.command(mode, async (ctx) => { await reply(ctx, ctx.match.trim(), mode); });
  }
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;
    await reply(ctx, text, "scan");
  });
  bot.catch(() => console.error(JSON.stringify({ error_category: "TELEGRAM_ERROR" })));
  return bot;
}
