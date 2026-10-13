import type { Snapshot, Analysis } from "./types.js";
export type ReportMode = "scan" | "quick" | "dev" | "holders" | "smart" | "similar";
const labels: Record<string, string> = { top10Pct: "Top 10", bundlerPct: "Bundler", insiderPct: "Insider",
  sniperPct: "Sniper", devHoldingPct: "Dev holding", smartMoneyCount: "Smart wallet", smartMoneyHoldingPct: "Smart holding",
  hit2x6h: "2x dalam 6h", hit3x24h: "3x dalam 24h", hit5x24h: "5x dalam 24h",
  twoXBeforeMinus50: "2x sebelum -50%", minus50BeforePlus50: "-50% sebelum +50%", rugLike6h: "Rug-like 6h", dead24h: "Mati 24h" };
function number(value: number | null | undefined, suffix = ""): string {
  return value == null ? "Data tidak tersedia" : `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}${suffix}`;
}
function clean(value: string | null | undefined): string { return (value ?? "Tidak diketahui").replace(/[\r\n\x00-\x1f]/g, " ").slice(0, 100); }

export function developerSummary(s: Snapshot): string[] {
  const dev = s.developer;
  if (!dev) return ["Data riwayat developer belum cukup."];
  const successes = dev.successfulCount, failures = dev.failedCount, rugs = dev.rugLikeCount;
  const n = successes != null && failures != null && rugs != null ? successes + failures + rugs : 0;
  return [`Wallet: ${clean(dev.wallet)}`, `Peluncuran: ${number(dev.launchCount)}`,
    `Berhasil: ${number(successes)} | Gagal: ${number(failures)} | Rug-like: ${number(rugs)}`,
    n >= 10 && dev.launchCount != null && n <= dev.launchCount
      ? `Rug-like: ${number(rugs! / n * 100, "%")} dari ${n} peluncuran berlabel.`
      : "Data riwayat developer belum cukup."];
}

export function formatReport(s: Snapshot, a: Analysis, mode: ReportMode, cacheHit: boolean): string {
  const lines = ["ANALISIS TOKEN SOLANA", ...(s.source === "mock" ? ["MODE DEMO: DATA BUATAN, BUKAN DATA CA INI."] : []),
    `$${clean(s.symbol)} | ${clean(s.name)}`, s.mintAddress,
    `MC: ${number(s.marketCapUsd, " USD")} | Likuiditas: ${number(s.liquidityUsd, " USD")}`,
    `Umur: ${number(s.ageMinutes, "m")} | Holder: ${number(s.holderCount)}`,
    `Data: ${s.snapshotAt} | Cache: ${cacheHit ? "ya" : "tidak"}`];
  if (["scan", "quick", "similar"].includes(mode)) {
    lines.push("", "KUALITAS SETUP", `Skor komposit: ${number(a.setupScore, "/100")}`,
      `Klasifikasi: ${a.setupClassification}`, `Profil risiko distribusi: ${a.riskClassification}`,
      "Skor komposit memakai bobot awal heuristik; bukan persentil setup atau prediksi.",
      "", "PERBANDINGAN HISTORIS", `Kelompok pembanding: ${a.cohortSize} token unik`,
      `Token mirip: ${a.neighborCount}`, `Filter diperlebar: ${a.relaxed.join(", ") || "tidak"}`);
    for (const outcome of a.outcomeRates) lines.push(`${labels[outcome.name]}: ${outcome.rate === null
      ? "Data belum cukup" : number(outcome.rate * 100, "%")} (n=${outcome.n})`);
    lines.push("Angka outcome adalah frekuensi historis sampel, bukan probabilitas terkalibrasi.");
  }
  if (["scan", "quick", "holders"].includes(mode)) {
    lines.push("", "DISTRIBUSI");
    for (const field of ["top10Pct", "bundlerPct", "insiderPct", "sniperPct", "devHoldingPct"] as const) {
      const metric = a.metrics.find((m) => m.field === field);
      lines.push(`${labels[field]}: ${number(s[field], "%")}${metric ? ` | Median ${number(metric.median, "%")} | Persentil kualitas ${number(metric.percentile)} (n=${metric.n})` : " | Benchmark belum cukup"}`);
    }
  }
  if (["scan", "quick", "smart"].includes(mode)) lines.push("", "SMART MONEY",
    `Smart wallet: ${number(s.smartMoneyCount)}`, `Holding: ${number(s.smartMoneyHoldingPct, "%")}`,
    `Net flow: ${number(s.smartMoneyNetFlowSol, " SOL")}`);
  if (["scan", "dev"].includes(mode)) lines.push("", "DEVELOPER", ...developerSummary(s));
  if (mode === "scan" && a.previous) lines.push("", "PERUBAHAN DARI SCAN SEBELUMNYA",
    `MC: ${number(a.previous.marketCapUsd)} -> ${number(s.marketCapUsd)}`,
    `Holder: ${number(a.previous.holderCount)} -> ${number(s.holderCount)}`);
  lines.push("", "Analisis pola historis, bukan jaminan performa masa depan.");
  return lines.join("\n");
}
