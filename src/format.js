const RUNNER_COPY = Object.freeze({
  solana: {
    emoji: "🟣",
    title: "SOLANA TOKEN RUNNER",
    qualified: "SOLANA QUALIFIED",
    feeCurrency: "SOL",
    reasons: "VOL • MC • FEES • AGE"
  },
  robinhood: {
    emoji: "🟢",
    title: "ROBINHOOD TOKEN RUNNER",
    qualified: "ROBINHOOD QUALIFIED",
    feeCurrency: "ETH",
    reasons: "VOL • FEES"
  },
  bsc: {
    emoji: "🟡",
    title: "BSC TOKEN RUNNER",
    qualified: "BSC QUALIFIED",
    feeCurrency: "BNB",
    reasons: "VOL • MC • FEES • AGE"
  }
});

export function formatRunnerAlert(runnerType, token, spike) {
  const copy = RUNNER_COPY[runnerType];
  if (!copy) throw new Error(`Unsupported runner type: ${runnerType}`);

  const fees = token.feesCurrency
    ? `${formatNumber(token.feesAmount)} ${token.feesCurrency}`
    : `${formatNumber(token.feesAmount)} ${copy.feeCurrency}`;

  return [
    `${copy.emoji} **${spike ? copy.title.replace("TOKEN RUNNER", "VOLUME SPIKE") : copy.title}**`,
    "",
    `**💊 ${safeText(token.symbol)} • ${spike ? `Migrated ${formatMigrationAge(spike.migratedAgeMin)} ago` : formatAge(token.ageMinutes)}**`,
    `${safeText(token.name)} | ${safeText(token.pool)}`,
    "",
    "┌ **MARKET**",
    `├ Price     : **${formatUsd(token.priceUsd, true)}**`,
    `├ MC        : **${formatCompactUsd(token.marketCapUsd)}**`,
    `├ Vol 5m    : **${formatCompactUsd(token.volume5mUsd)}**`,
    `├ Swaps 5m  : **${formatInteger(token.swaps5m)}**`,
    `├ Fees      : **${fees}**`,
    `└ Liquidity : **${formatCompactUsd(token.liquidityUsd)}**`,
    ...(spike ? [
      "", "┌ **SPIKE**",
      `├ Baseline 5m : **${formatCompactUsd(spike.baselineUsd)}**`,
      `├ Volume Now  : **${formatCompactUsd(token.volume5mUsd)}**`,
      `├ Multiplier  : **${formatNumber(spike.multiplier)}×**`,
      `└ Baseline    : **Rata-rata ${spike.baselinePeriods} periode 5m sebelumnya**`
    ] : []),
    "",
    "┌ **ACTIVITY**",
    `├ Flow      : **Buy ${formatPercent(token.buyPercent)} • Sell ${formatPercent(token.sellPercent)}**`,
    `├ Top 10    : **${formatPercent(token.top10Percent)}**`,
    `├ Wallets   : **${formatWallets(token.wallets)}**`,
    `└ Dex Paid  : **${token.dexPaid ? "Yes" : "No"}**`,
    "",
    "┌ **STATUS**",
    `└ 🟢 **${spike ? "MIGRATED VOLUME SPIKE" : copy.qualified}**`,
    `   ${spike ? `MIGRATED • VOL ≥ ${formatCompactUsd(spike.minVolume5mUsd)} • SPIKE ≥ ${formatNumber(spike.minMultiplier)}×` : copy.reasons}`,
    "",
    "**CA**",
    safeText(token.ca),
    "",
    token.gmgnUrl
  ].filter((line) => line !== undefined && line !== null).join("\n");
}

function formatMigrationAge(minutes) {
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes)}m`;
}

function safeText(value) {
  if (value === undefined || value === null || value === "") return "N/A";
  return String(value);
}

function formatAge(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${Math.round(value)}m`;
}

function formatInteger(value) {
  if (!Number.isFinite(value)) return "N/A";
  return Math.round(value).toLocaleString("en-US");
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "N/A";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

function formatUsd(value, precise = false) {
  if (!Number.isFinite(value)) return "N/A";
  const maxDigits = precise && value < 1 ? 12 : 6;
  return `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: maxDigits })}`;
}

function formatCompactUsd(value) {
  if (!Number.isFinite(value)) return "N/A";
  if (Math.abs(value) >= 1000000) return `$${trim(value / 1000000)}M`;
  if (Math.abs(value) >= 1000) return `$${trim(value / 1000)}K`;
  return formatUsd(value);
}

function formatWallets(wallets) {
  if (!Array.isArray(wallets) || wallets.length === 0) return "N/A";
  return wallets.slice(0, 5).map((value) => trim(value)).join(" • ");
}

function trim(value) {
  if (!Number.isFinite(value)) return "N/A";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 });
}
