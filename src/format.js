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

export function formatRunnerAlert(runnerType, token) {
  const copy = RUNNER_COPY[runnerType];
  if (!copy) throw new Error(`Unsupported runner type: ${runnerType}`);

  const fees = token.feesCurrency
    ? `${formatNumber(token.feesAmount)} ${token.feesCurrency}`
    : `${formatNumber(token.feesAmount)} ${copy.feeCurrency}`;

  return [
    `${copy.emoji} **${copy.title}**`,
    "",
    `**💊 ${safeText(token.symbol)} • ${formatAge(token.ageMinutes)}**`,
    `${safeText(token.name)} | ${safeText(token.pool)}`,
    "",
    "┌ **MARKET**",
    `├ Price     : **${formatUsd(token.priceUsd, true)}**`,
    `├ MC        : **${formatCompactUsd(token.marketCapUsd)}**`,
    `├ Vol 5m    : **${formatCompactUsd(token.volume5mUsd)}**`,
    `├ Swaps 5m  : **${formatInteger(token.swaps5m)}**`,
    `├ Fees      : **${fees}**`,
    `└ Liquidity : **${formatCompactUsd(token.liquidityUsd)}**`,
    "",
    "┌ **ACTIVITY**",
    `├ Flow      : **Buy ${formatPercent(token.buyPercent)} • Sell ${formatPercent(token.sellPercent)}**`,
    `├ Top 10    : **${formatPercent(token.top10Percent)}**`,
    `├ Wallets   : **${formatWallets(token.wallets)}**`,
    `└ Dex Paid  : **${token.dexPaid ? "Yes" : "No"}**`,
    "",
    "┌ **STATUS**",
    `└ 🟢 **${copy.qualified}**`,
    `   ${copy.reasons}`,
    "",
    "**CA**",
    safeText(token.ca),
    "",
    token.gmgnUrl
  ].filter((line) => line !== undefined && line !== null).join("\n");
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
