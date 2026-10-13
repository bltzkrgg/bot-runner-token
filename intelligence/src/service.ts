import { randomUUID } from "node:crypto";
import { candidateChains, SourceCache } from "./gmgn.js";
import type { Chain } from "./types.js";
import { analyze } from "./benchmark.js";
import { formatReport, type ReportMode } from "./report.js";
import type { Config } from "./config.js";
import type { Repository } from "./database/repository.js";

export class ScanService {
  constructor(private cache: SourceCache, private repository: Repository, private config: Config,
    private log: (event: Record<string, unknown>) => void = (event) => console.log(JSON.stringify(event))) {}
  async scan(mint: string, mode: ReportMode = "scan", userHash?: string): Promise<string> {
    const chains = candidateChains(mint);
    if (!chains.length) throw new Error("Alamat CA tidak valid untuk Solana, BSC, atau Robinhood.");
    if (chains.length === 1) return this.scanChain(mint, chains[0]!, mode, userHash);
    const results = await Promise.allSettled(chains.map((chain) => this.scanChain(mint.toLowerCase(), chain, mode, userHash)));
    const reports = results.flatMap((result, index) => result.status === "fulfilled" ? [result.value]
      : (result.reason instanceof Error && result.reason.message === "TOKEN_NOT_FOUND") ? []
      : [`${chains[index]!.toUpperCase()}: data belum dapat diambil. Coba lagi nanti.`]);
    if (results.every((result) => result.status === "rejected")) throw new Error("Data CA tidak ditemukan atau sumber tidak tersedia.");
    return ["Alamat EVM: diperiksa di BSC dan Robinhood; format CA tidak menentukan jaringan.", ...reports].join("\n\n");
  }
  private async scanChain(mint: string, chain: Chain, mode: ReportMode, userHash?: string): Promise<string> {
    const scanId = randomUUID(), start = Date.now();
    try {
      const { snapshot, cacheHit, requests } = await this.cache.get(mint, chain);
      const sourceMs = Date.now() - start, analysisStart = Date.now();
      const history = await this.repository.history(snapshot.snapshotAt, snapshot.source, chain);
      const result = analyze(snapshot, history, this.config);
      result.previous = await this.repository.previous(mint, snapshot.snapshotAt, snapshot.source, chain);
      await this.repository.save(scanId, snapshot, result, cacheHit, userHash);
      if (this.config.LOG_LEVEL === "info") this.log({ scan_id: scanId, chain, mint_address: mint, cache_hit: cacheHit,
        source: snapshot.source, gmgn_requests: snapshot.source === "mock" ? 0 : requests,
        gmgn_latency_ms: snapshot.source === "mock" ? 0 : sourceMs, analysis_latency_ms: Date.now() - analysisStart,
        cohort_size: result.cohortSize, similarity_sample_size: result.neighborCount });
      return formatReport(snapshot, result, mode, cacheHit);
    } catch (error) {
      this.log({ scan_id: scanId, chain, mint_address: mint, error_category: "SCAN_FAILED" });
      throw error;
    }
  }
}
