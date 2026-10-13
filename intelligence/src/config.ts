import { z } from "zod";

export const configSchema = z.object({
  GMGN_MODE: z.enum(["mock", "live"]).default("mock"),
  DATABASE_URL: z.string().optional(), TELEGRAM_BOT_TOKEN: z.string().optional(),
  USER_HASH_SECRET: z.string().optional(),
  CACHE_TOKEN_TTL_SECONDS: z.coerce.number().int().min(1).max(86400).default(120),
  CACHE_HOLDER_TTL_SECONDS: z.coerce.number().int().min(1).max(86400).default(180),
  CACHE_DEVELOPER_TTL_SECONDS: z.coerce.number().int().min(1).max(86400).default(21600),
  MIN_COHORT_SIZE: z.coerce.number().int().min(1).default(300),
  MIN_OUTCOME_SAMPLE: z.coerce.number().int().min(1).default(100),
  NEIGHBOR_COUNT: z.coerce.number().int().min(1).max(1000).default(100),
  LOG_LEVEL: z.enum(["info", "error"]).default("info")
});
export type Config = z.infer<typeof configSchema>;

// Initial weights and thresholds are heuristic, not a calibrated predictor.
export const scoring = {
  weights: { distribution: 1, smartMoney: 1, liquidity: 1, momentum: 1 },
  minimumGroups: 3,
  setupThresholds: [[85, "SANGAT MENARIK"], [70, "CUKUP MENARIK"], [55, "NETRAL"],
    [40, "KURANG MENARIK"], [0, "RISIKO TINGGI"]] as const,
  riskPercentiles: [[85, "SANGAT TINGGI"], [70, "TINGGI"], [40, "MENENGAH"], [0, "RENDAH"]] as const
};
