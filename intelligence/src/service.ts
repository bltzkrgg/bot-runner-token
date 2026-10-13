import { randomUUID } from "node:crypto";
import { validateMint, SourceCache } from "./gmgn.js";
import { analyze } from "./benchmark.js";
import { formatReport, type ReportMode } from "./report.js";
import type { Config } from "./config.js";
import type { Repository } from "./database/repository.js";

export class ScanService {
  constructor(private cache: SourceCache, private repository: Repository, private config: Config,
    private log: (event: Record<string, unknown>) => void = (event) => console.log(JSON.stringify(event))) {}
  async scan(mint: string, mode: ReportMode = "scan", userHash?: string): Promise<string> {
    if (!validateMint(mint)) throw new Error("Alamat mint Solana tidak valid (harus base58, 32 byte).");
    const scanId = randomUUID(), start = Date.now();
    try {
      const { snapshot, cacheHit, requests } = await this.cache.get(mint);
      const sourceMs = Date.now() - start, analysisStart = Date.now();
      const history = await this.repository.history(snapshot.snapshotAt, snapshot.source);
      const result = analyze(snapshot, history, this.config);
      result.previous = await this.repository.previous(mint, snapshot.snapshotAt, snapshot.source);
      await this.repository.save(scanId, snapshot, result, cacheHit, userHash);
      if (this.config.LOG_LEVEL === "info") this.log({ scan_id: scanId, mint_address: mint, cache_hit: cacheHit,
        source: snapshot.source, gmgn_requests: snapshot.source === "mock" ? 0 : requests,
        gmgn_latency_ms: snapshot.source === "mock" ? 0 : sourceMs, analysis_latency_ms: Date.now() - analysisStart,
        cohort_size: result.cohortSize, similarity_sample_size: result.neighborCount });
      return formatReport(snapshot, result, mode, cacheHit);
    } catch (error) {
      this.log({ scan_id: scanId, mint_address: mint, error_category: "SCAN_FAILED" });
      throw error;
    }
  }
}
