import { z } from "zod";

const optionalNumber = z.number().finite().nonnegative().nullish();
const percent = z.number().finite().min(0).max(100).nullish();
const count = z.number().int().nonnegative().nullish();
export const snapshotSchema = z.object({
  mintAddress: z.string(), snapshotAt: z.string().datetime(),
  source: z.enum(["mock", "gmgn"]),
  symbol: z.string().max(100).nullish(), name: z.string().max(200).nullish(),
  launchpad: z.string().max(100).nullish(), migrated: z.boolean().nullish(),
  ageMinutes: optionalNumber, priceUsd: optionalNumber, marketCapUsd: optionalNumber,
  liquidityUsd: optionalNumber, volume5m: optionalNumber, volume1h: optionalNumber,
  volume6h: optionalNumber, volume24h: optionalNumber, buys5m: count, sells5m: count,
  holderCount: count, top10Pct: percent, bundlerPct: percent, insiderPct: percent,
  sniperPct: percent, devHoldingPct: percent, smartMoneyCount: count,
  smartMoneyHoldingPct: percent, smartMoneyNetFlowSol: z.number().finite().nullish(),
  developer: z.object({
    wallet: z.string(), launchCount: count, successfulCount: count,
    failedCount: count, rugLikeCount: count, bestTokenMint: z.string().nullish(),
    bestTokenAthUsd: optionalNumber
  }).nullish()
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export const outcomesSchema = z.object({
  availableAt: z.string().datetime(),
  hit2x6h: z.boolean().nullish(), hit3x24h: z.boolean().nullish(), hit5x24h: z.boolean().nullish(),
  twoXBeforeMinus50: z.boolean().nullish(), minus50BeforePlus50: z.boolean().nullish(),
  rugLike6h: z.boolean().nullish(), dead24h: z.boolean().nullish(),
  maxReturn6h: z.number().finite().nullish(), maxDrawdown6h: z.number().finite().nullish()
});
export type Outcomes = z.infer<typeof outcomesSchema>;
export type Historical = { id: string; snapshot: Snapshot; outcomes?: Outcomes };
export type Metric = { field: string; value: number; median: number; percentile: number; n: number };
export type Analysis = {
  cohortSize: number; relaxed: string[]; neighborCount: number;
  metrics: Metric[]; outcomeRates: { name: string; rate: number | null; n: number }[];
  setupScore: number | null; setupClassification: string; riskClassification: string;
  missing: string[]; previous?: Snapshot;
};
