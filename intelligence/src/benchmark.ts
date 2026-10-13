import { scoring, type Config } from "./config.js";
import type { Snapshot, Historical, Metric, Analysis } from "./types.js";

const directions = {
  top10Pct: false, bundlerPct: false, insiderPct: false, sniperPct: false, devHoldingPct: false,
  smartMoneyCount: true, smartMoneyHoldingPct: true, smartMoneyNetFlowSol: true,
  holderCount: true, liquidityRatio: true, volumeRatio: true
};
type Feature = keyof typeof directions;
const ages = [5, 15, 30, 60, 180, 360, 1440];
const caps = [50000, 100000, 300000, 1000000, 3000000];
const liquidities = [10000, 30000, 100000, 300000];
function bucket(value: number | null | undefined, boundaries: number[]): number {
  if (value == null) return -1;
  const index = boundaries.findIndex((boundary) => value < boundary);
  return index < 0 ? boundaries.length : index;
}
function feature(s: Snapshot, key: Feature): number | null {
  if (key === "liquidityRatio" || key === "volumeRatio") {
    const numerator = key === "liquidityRatio" ? s.liquidityUsd : s.volume5m;
    return numerator != null && s.marketCapUsd != null && s.marketCapUsd > 0 ? numerator / s.marketCapUsd : null;
  }
  return s[key] ?? null;
}
export function percentile(value: number, values: number[], higherBetter: boolean): number | null {
  if (!Number.isFinite(value) || values.length === 0 || values.some((v) => !Number.isFinite(v))) return null;
  const better = values.filter((v) => higherBetter ? v < value : v > value).length;
  const ties = values.filter((v) => v === value).length;
  return 100 * (better + 0.5 * ties) / values.length;
}
export function median(values: number[]): number {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

export function comparableCohort(target: Snapshot, rows: Historical[], minimum: number): { rows: Historical[]; relaxed: string[] } {
  // One observation per mint prevents frequently scanned winners dominating statistics.
  const latest = new Map<string, Historical>();
  for (const row of rows) {
    const s = row.snapshot;
    if (s.source !== target.source || s.mintAddress === target.mintAddress || Date.parse(s.snapshotAt) >= Date.parse(target.snapshotAt)) continue;
    const old = latest.get(s.mintAddress);
    if (!old || Date.parse(s.snapshotAt) > Date.parse(old.snapshot.snapshotAt)) latest.set(s.mintAddress, row);
  }
  const candidates = [...latest.values()].filter(({ snapshot: s }) =>
    (s.launchpad ?? null) === (target.launchpad ?? null) && (s.migrated ?? null) === (target.migrated ?? null));
  const dimensions = [
    { name: "age", value: (s: Snapshot) => bucket(s.ageMinutes, ages) },
    { name: "market_cap", value: (s: Snapshot) => bucket(s.marketCapUsd, caps) },
    { name: "liquidity", value: (s: Snapshot) => bucket(s.liquidityUsd, liquidities) }
  ];
  const relaxed: string[] = [];
  let cohort: Historical[] = [];
  for (let step = 0; step <= dimensions.length; step++) {
    cohort = candidates.filter(({ snapshot: s }) => dimensions.slice(step).every((d) => d.value(s) === d.value(target)));
    if (cohort.length >= minimum || step === dimensions.length) break;
    relaxed.push(dimensions[step]!.name);
  }
  return { rows: cohort, relaxed };
}

export function nearestNeighbors(target: Snapshot, rows: Historical[], limit: number): Historical[] {
  const keys = (Object.keys(directions) as Feature[]).filter((key) => feature(target, key) !== null &&
    rows.filter((r) => feature(r.snapshot, key) !== null).length >= rows.length * 0.8);
  if (keys.length < 4) return [];
  const complete = rows.filter((row) => keys.every((key) => feature(row.snapshot, key) !== null));
  if (!complete.length) return [];
  // Fit scaler on historical features only; outcomes never enter the distance.
  const scales = keys.map((key) => {
    const values = complete.map((row) => feature(row.snapshot, key)!);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return { key, std: Math.sqrt(variance) };
  }).filter((scale) => scale.std > 0);
  if (scales.length < 4) return [];
  return complete.map((row) => ({ row, distance: scales.reduce((sum, { key, std }) =>
    sum + ((feature(row.snapshot, key)! - feature(target, key)!) / std) ** 2, 0) }))
    .sort((a, b) => a.distance - b.distance || a.row.id.localeCompare(b.row.id)).slice(0, limit).map((v) => v.row);
}

export function analyze(target: Snapshot, history: Historical[], config: Config): Analysis {
  const cohort = comparableCohort(target, history, config.MIN_COHORT_SIZE);
  const metrics: Metric[] = [];
  const missing: string[] = [];
  for (const key of Object.keys(directions) as Feature[]) {
    const value = feature(target, key);
    if (value === null) { missing.push(key); continue; }
    const values = cohort.rows.map((row) => feature(row.snapshot, key)).filter((v): v is number => v !== null);
    if (values.length < config.MIN_COHORT_SIZE) continue;
    metrics.push({ field: key, value, median: median(values), percentile: percentile(value, values, directions[key])!, n: values.length });
  }
  const neighbors = nearestNeighbors(target, cohort.rows, config.NEIGHBOR_COUNT);
  const outcomeNames = ["hit2x6h", "hit3x24h", "hit5x24h", "twoXBeforeMinus50", "minus50BeforePlus50", "rugLike6h", "dead24h"] as const;
  const outcomeRates = outcomeNames.map((name) => {
    const values = neighbors.filter((row) => row.outcomes &&
      Date.parse(row.outcomes.availableAt) <= Date.parse(target.snapshotAt) &&
      Date.parse(row.outcomes.availableAt) >= Date.parse(row.snapshot.snapshotAt) + 86400000)
      .map((row) => row.outcomes?.[name]).filter((v): v is boolean => typeof v === "boolean");
    return { name, n: values.length,
      rate: values.length >= config.MIN_OUTCOME_SAMPLE ? values.filter(Boolean).length / values.length : null };
  });
  const groups = {
    distribution: ["top10Pct", "bundlerPct", "insiderPct", "sniperPct", "devHoldingPct"],
    smartMoney: ["smartMoneyCount", "smartMoneyHoldingPct", "smartMoneyNetFlowSol"],
    liquidity: ["liquidityRatio"], momentum: ["volumeRatio", "holderCount"]
  };
  let total = 0, weights = 0, availableGroups = 0;
  for (const [group, fields] of Object.entries(groups)) {
    const entries = metrics.filter((metric) => fields.includes(metric.field));
    if (!entries.length) continue;
    const weight = scoring.weights[group as keyof typeof groups];
    total += entries.reduce((sum, metric) => sum + metric.percentile, 0) / entries.length * weight;
    weights += weight; availableGroups++;
  }
  // Synthetic fixtures never produce setup rankings or historical probabilities.
  const setupScore = target.source !== "mock" && availableGroups >= scoring.minimumGroups ? total / weights : null;
  const distribution = metrics.filter((m) => groups.distribution.includes(m.field));
  const riskPercentile = distribution.length >= 3 ? 100 - distribution.reduce((s, m) => s + m.percentile, 0) / distribution.length : null;
  return {
    cohortSize: cohort.rows.length, relaxed: cohort.relaxed, neighborCount: neighbors.length, metrics,
    outcomeRates: outcomeRates.map((r) => target.source === "mock" ? { ...r, rate: null } : r),
    setupScore, setupClassification: setupScore === null ? "DATA BELUM CUKUP" : scoring.setupThresholds.find(([min]) => setupScore >= min)![1],
    riskClassification: target.source === "mock" || riskPercentile === null ? "DATA BELUM CUKUP" : scoring.riskPercentiles.find(([min]) => riskPercentile >= min)![1],
    missing
  };
}
