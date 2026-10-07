const ENDPOINTS = Object.freeze({
  solana: "GMGN_SOLANA_URL",
  robinhood: "GMGN_ROBINHOOD_URL",
  bsc: "GMGN_BSC_URL"
});

export class GmgnClient {
  constructor(env = process.env) {
    this.env = env;
  }

  async fetchCandidates(runnerType, { spike = false } = {}) {
    const key = ENDPOINTS[runnerType];
    const endpoint = (spike && this.env[key.replace("_URL", "_SPIKE_URL")]) || this.env[key];
    if (!endpoint) return [];

    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(10000),
      headers: { "accept": "application/json", "user-agent": "gmgn-runner-discord-bot/0.1" }
    });

    if (!response.ok) {
      throw new Error(`GMGN ${runnerType} request failed: ${response.status}`);
    }

    const payload = await response.json();
    return extractList(payload).map((item) => normalizeToken(item, runnerType));
  }
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.tokens)) return payload.tokens;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.tokens)) return payload.data.tokens;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.list)) return payload.data.list;
  return [];
}

export function normalizeToken(item, runnerType) {
  const ca = first(item, ["ca", "address", "token_address", "contract_address", "base_address"]);
  return {
    runnerType,
    chain: first(item, ["chain", "network"], runnerType),
    symbol: first(item, ["symbol", "ticker"], "UNKNOWN"),
    name: first(item, ["name", "token_name"], "Unknown"),
    pool: first(item, ["pool", "dex", "platform", "exchange"], "GMGN"),
    ageMinutes: number(first(item, ["ageMinutes", "age_min", "open_minutes", "age_mins"])),
    migrated: item?.migrated === true || item?.migration_status === "completed",
    migratedAtSec: number(first(item, ["migratedAtSec", "open_timestamp"])),
    volumeWindowEndSec: number(item?.volumeWindowEndSec),
    volumeHistory5m: Array.isArray(item?.volumeHistory5m) ? item.volumeHistory5m.map((period) => ({
      startTimeSec: number(period?.startTimeSec),
      endTimeSec: number(period?.endTimeSec),
      volumeUsd: number(period?.volumeUsd)
    })) : [],
    priceUsd: number(first(item, ["priceUsd", "price_usd", "price"])),
    marketCapUsd: number(first(item, ["marketCapUsd", "market_cap_usd", "market_cap", "mc"])),
    volume5mUsd: number(first(item, ["volume5mUsd", "volume_5m_usd", "vol_5m_usd", "volume5m"])),
    swaps5m: number(first(item, ["swaps5m", "swaps_5m", "txns_5m", "transactions5m"])),
    feesAmount: number(first(item, ["feesAmount", "total_fees", "fees", "fees_5m"])),
    feesCurrency: first(item, ["feesCurrency", "fees_currency"]),
    liquidityUsd: number(first(item, ["liquidityUsd", "liquidity_usd", "liquidity"])),
    buyPercent: number(first(item, ["buyPercent", "buy_percent", "buyRatio", "buy_ratio"])),
    sellPercent: number(first(item, ["sellPercent", "sell_percent", "sellRatio", "sell_ratio"])),
    top10Percent: number(first(item, ["top10Percent", "top_10_percent", "top10"])),
    wallets: normalizeWallets(first(item, ["wallets", "top_wallets", "holders"])),
    dexPaid: Boolean(first(item, ["dexPaid", "dex_paid", "paid"], false)),
    ca,
    gmgnUrl: first(item, ["gmgnUrl", "gmgn_url", "url"], buildGmgnUrl(runnerType, ca))
  };
}

function first(item, keys, fallback = undefined) {
  for (const key of keys) {
    if (item?.[key] !== undefined && item[key] !== null && item[key] !== "") return item[key];
  }
  return fallback;
}

function number(value) {
  if (value === undefined || value === null || value === "" || typeof value === "boolean") return undefined;
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function normalizeWallets(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => typeof item === "object" ? number(item.percent ?? item.percentage ?? item.value) : number(item))
    .filter((item) => Number.isFinite(item));
}

function buildGmgnUrl(runnerType, ca) {
  if (!ca) return "https://gmgn.ai/";
  const chain = runnerType === "solana" ? "sol" : runnerType;
  return `https://gmgn.ai/${chain}/token/${ca}`;
}
