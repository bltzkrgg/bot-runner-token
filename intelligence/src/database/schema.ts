import { pgTable, uuid, text, timestamp, doublePrecision, integer, boolean, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

const time = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const id = () => uuid("id").defaultRandom().primaryKey();
export const tokens = pgTable("intel_tokens", {
  id: id(), mintAddress: text("mint_address").notNull().unique(),
  symbol: text("symbol"), name: text("name"), launchpad: text("launchpad"),
  createdAt: time("created_at"), firstSeenAt: time("first_seen_at").defaultNow().notNull(),
  lastSeenAt: time("last_seen_at").defaultNow().notNull()
});
export const tokenSnapshots = pgTable("intel_token_snapshots", {
  id: id(), tokenId: uuid("token_id").notNull().references(() => tokens.id),
  snapshotAt: time("snapshot_at").notNull(), source: text("source").notNull(),
  marketCapUsd: doublePrecision("market_cap_usd"), priceUsd: doublePrecision("price_usd"),
  liquidityUsd: doublePrecision("liquidity_usd"), ageMinutes: doublePrecision("age_minutes"),
  migrated: boolean("migrated"), volume5m: doublePrecision("volume_5m"), volume1h: doublePrecision("volume_1h"),
  volume6h: doublePrecision("volume_6h"), volume24h: doublePrecision("volume_24h"),
  buys5m: integer("buys_5m"), sells5m: integer("sells_5m"), holderCount: integer("holder_count"),
  top10Pct: doublePrecision("top10_pct"), bundlerPct: doublePrecision("bundler_pct"),
  insiderPct: doublePrecision("insider_pct"), sniperPct: doublePrecision("sniper_pct"),
  devHoldingPct: doublePrecision("dev_holding_pct"), smartMoneyCount: integer("smart_money_count"),
  smartMoneyHoldingPct: doublePrecision("smart_money_holding_pct"),
  smartMoneyNetFlowSol: doublePrecision("smart_money_net_flow_sol"),
  rawSourceJson: jsonb("raw_source_json").notNull()
}, (table) => [uniqueIndex("intel_snapshot_identity").on(table.tokenId, table.snapshotAt, table.source)]);
export const developers = pgTable("intel_developers", {
  id: id(), walletAddress: text("wallet_address").notNull().unique(),
  firstSeenAt: time("first_seen_at").defaultNow().notNull(), lastUpdatedAt: time("last_updated_at").defaultNow().notNull()
});
export const developerSnapshots = pgTable("intel_developer_snapshots", {
  id: id(), developerId: uuid("developer_id").notNull().references(() => developers.id),
  snapshotAt: time("snapshot_at").notNull(), launchCount: integer("launch_count"),
  successfulCount: integer("successful_count"), failedCount: integer("failed_count"),
  rugLikeCount: integer("rug_like_count"), bestTokenMint: text("best_token_mint"),
  bestTokenAthUsd: doublePrecision("best_token_ath_usd"), currentReputationScore: doublePrecision("current_reputation_score"),
  rawSourceJson: jsonb("raw_source_json").notNull()
});
export const developerTokens = pgTable("intel_developer_tokens", {
  id: id(), developerId: uuid("developer_id").notNull().references(() => developers.id),
  tokenId: uuid("token_id").notNull().references(() => tokens.id), createdAt: time("created_at"),
  athMarketCapUsd: doublePrecision("ath_market_cap_usd"),
  classification: text("classification", { enum: ["successful", "failed", "rug_like", "unknown"] }).default("unknown").notNull()
});
export const tokenOutcomes = pgTable("intel_token_outcomes", {
  tokenSnapshotId: uuid("token_snapshot_id").primaryKey().references(() => tokenSnapshots.id),
  availableAt: time("available_at").notNull(),
  price15m: doublePrecision("price_15m"), price30m: doublePrecision("price_30m"),
  price1h: doublePrecision("price_1h"), price3h: doublePrecision("price_3h"), price6h: doublePrecision("price_6h"), price24h: doublePrecision("price_24h"),
  maxReturn1h: doublePrecision("max_return_1h"), maxReturn6h: doublePrecision("max_return_6h"), maxReturn24h: doublePrecision("max_return_24h"),
  maxDrawdown1h: doublePrecision("max_drawdown_1h"), maxDrawdown6h: doublePrecision("max_drawdown_6h"), maxDrawdown24h: doublePrecision("max_drawdown_24h"),
  hit2x6h: boolean("hit_2x_6h"), hit3x24h: boolean("hit_3x_24h"), hit5x24h: boolean("hit_5x_24h"),
  twoXBeforeMinus50: boolean("two_x_before_minus_50"), minus50BeforePlus50: boolean("minus_50_before_plus_50"),
  drawdown30BeforeUp50: boolean("drawdown_30_before_up_50"), drawdown50BeforeUp100: boolean("drawdown_50_before_up_100"),
  rugLike6h: boolean("rug_like_6h"), dead24h: boolean("dead_24h")
});
export const smartWalletSnapshots = pgTable("intel_smart_wallet_snapshots", {
  id: id(), walletAddress: text("wallet_address").notNull(), snapshotAt: time("snapshot_at").notNull(),
  winRate: doublePrecision("win_rate"), realizedPnlUsd: doublePrecision("realized_pnl_usd"),
  unrealizedPnlUsd: doublePrecision("unrealized_pnl_usd"), tradeCount: integer("trade_count"),
  medianRoi: doublePrecision("median_roi"), rugExposureRate: doublePrecision("rug_exposure_rate"), rawSourceJson: jsonb("raw_source_json")
});
export const scanRequests = pgTable("intel_scan_requests", {
  id: id(), mintAddress: text("mint_address").notNull(), requestedAt: time("requested_at").defaultNow().notNull(),
  telegramUserIdHash: text("telegram_user_id_hash"), sourceCacheHit: boolean("source_cache_hit").notNull(),
  analysisVersion: text("analysis_version").notNull()
});
export const analysisResults = pgTable("intel_analysis_results", {
  scanRequestId: uuid("scan_request_id").primaryKey().references(() => scanRequests.id),
  cohortSize: integer("cohort_size").notNull(), similarTokenCount: integer("similar_token_count").notNull(),
  distributionPercentile: doublePrecision("distribution_percentile"), smartMoneyPercentile: doublePrecision("smart_money_percentile"),
  momentumPercentile: doublePrecision("momentum_percentile"), developerPercentile: doublePrecision("developer_percentile"),
  setupPercentile: doublePrecision("setup_percentile"),
  probability2xBeforeMinus50: doublePrecision("probability_2x_before_minus_50"), probability3x24h: doublePrecision("probability_3x_24h"),
  probabilityRug6h: doublePrecision("probability_rug_6h"), probabilityMinus50BeforePlus50: doublePrecision("probability_minus_50_before_plus_50"),
  riskClassification: text("risk_classification").notNull(), setupClassification: text("setup_classification").notNull(),
  analysisJson: jsonb("analysis_json").notNull()
});
