import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, lt, desc } from "drizzle-orm";
import { snapshotSchema, outcomesSchema, type Snapshot, type Historical, type Analysis } from "../types.js";
import * as schema from "./schema.js";

export interface Repository {
  history(before: string, source: Snapshot["source"]): Promise<Historical[]>;
  previous(mint: string, before: string, source: Snapshot["source"]): Promise<Snapshot | undefined>;
  save(scanId: string, snapshot: Snapshot, analysis: Analysis, cacheHit: boolean, userHash?: string): Promise<void>;
  close(): Promise<void>;
}

export class MemoryRepository implements Repository {
  scans: { scanId: string; snapshot: Snapshot; analysis: Analysis; cacheHit: boolean }[] = [];
  constructor(public rows: Historical[] = []) {}
  async history(before: string, source: Snapshot["source"]): Promise<Historical[]> {
    return this.rows.filter((row) => row.snapshot.source === source && Date.parse(row.snapshot.snapshotAt) < Date.parse(before));
  }
  async previous(mint: string, before: string, source: Snapshot["source"]): Promise<Snapshot | undefined> {
    return this.scans.map((scan) => scan.snapshot).filter((s) => s.mintAddress === mint && s.source === source && Date.parse(s.snapshotAt) < Date.parse(before))
      .sort((a, b) => Date.parse(b.snapshotAt) - Date.parse(a.snapshotAt))[0];
  }
  async save(scanId: string, snapshot: Snapshot, analysis: Analysis, cacheHit: boolean): Promise<void> {
    this.scans.push({ scanId, snapshot, analysis, cacheHit });
    if (!this.rows.some((r) => r.snapshot.mintAddress === snapshot.mintAddress && r.snapshot.snapshotAt === snapshot.snapshotAt)) {
      this.rows.push({ id: scanId, snapshot });
    }
  }
  async close(): Promise<void> {}
}

export class PostgresRepository implements Repository {
  private pool: pg.Pool;
  private db;
  constructor(url: string) {
    this.pool = new pg.Pool({ connectionString: url, max: 5 });
    this.db = drizzle(this.pool);
  }
  async history(before: string, source: Snapshot["source"]): Promise<Historical[]> {
    const rows = await this.db.select({ id: schema.tokenSnapshots.id, raw: schema.tokenSnapshots.rawSourceJson,
      outcome: schema.tokenOutcomes }).from(schema.tokenSnapshots)
      .leftJoin(schema.tokenOutcomes, eq(schema.tokenSnapshots.id, schema.tokenOutcomes.tokenSnapshotId))
      .where(and(lt(schema.tokenSnapshots.snapshotAt, before), eq(schema.tokenSnapshots.source, source)));
    return rows.map((row) => ({ id: row.id, snapshot: snapshotSchema.parse(row.raw),
      outcomes: row.outcome ? outcomesSchema.parse(row.outcome) : undefined }));
  }
  async previous(mint: string, before: string, source: Snapshot["source"]): Promise<Snapshot | undefined> {
    const [row] = await this.db.select({ raw: schema.tokenSnapshots.rawSourceJson }).from(schema.tokenSnapshots)
      .innerJoin(schema.tokens, eq(schema.tokens.id, schema.tokenSnapshots.tokenId))
      .where(and(eq(schema.tokens.mintAddress, mint), lt(schema.tokenSnapshots.snapshotAt, before), eq(schema.tokenSnapshots.source, source)))
      .orderBy(desc(schema.tokenSnapshots.snapshotAt)).limit(1);
    return row ? snapshotSchema.parse(row.raw) : undefined;
  }
  async save(scanId: string, snapshot: Snapshot, analysis: Analysis, cacheHit: boolean, userHash?: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [token] = await tx.insert(schema.tokens).values({ mintAddress: snapshot.mintAddress,
        symbol: snapshot.symbol, name: snapshot.name, launchpad: snapshot.launchpad, lastSeenAt: snapshot.snapshotAt })
        .onConflictDoUpdate({ target: schema.tokens.mintAddress, set: { lastSeenAt: snapshot.snapshotAt,
          symbol: snapshot.symbol, name: snapshot.name, launchpad: snapshot.launchpad } }).returning({ id: schema.tokens.id });
      if (!token) throw new Error("TOKEN_INSERT_FAILED");
      const { mintAddress: _mint, developer: _dev, symbol: _symbol, name: _name, launchpad: _pad, ...metrics } = snapshot;
      await tx.insert(schema.tokenSnapshots).values({ ...metrics, tokenId: token.id, rawSourceJson: snapshot }).onConflictDoNothing();
      if (snapshot.developer) {
        const dev = snapshot.developer;
        const [developer] = await tx.insert(schema.developers).values({ walletAddress: dev.wallet,
          lastUpdatedAt: snapshot.snapshotAt }).onConflictDoUpdate({ target: schema.developers.walletAddress,
          set: { lastUpdatedAt: snapshot.snapshotAt } }).returning({ id: schema.developers.id });
        if (!developer) throw new Error("DEVELOPER_INSERT_FAILED");
        await tx.insert(schema.developerSnapshots).values({ developerId: developer.id, snapshotAt: snapshot.snapshotAt,
          launchCount: dev.launchCount, successfulCount: dev.successfulCount, failedCount: dev.failedCount,
          rugLikeCount: dev.rugLikeCount, bestTokenMint: dev.bestTokenMint, bestTokenAthUsd: dev.bestTokenAthUsd,
          rawSourceJson: dev });
      }
      await tx.insert(schema.scanRequests).values({ id: scanId, mintAddress: snapshot.mintAddress,
        telegramUserIdHash: userHash, sourceCacheHit: cacheHit, analysisVersion: "intel-v1" });
      await tx.insert(schema.analysisResults).values({ scanRequestId: scanId, cohortSize: analysis.cohortSize,
        similarTokenCount: analysis.neighborCount, setupClassification: analysis.setupClassification,
        riskClassification: analysis.riskClassification, analysisJson: analysis });
    });
  }
  async importHistorical(row: Historical): Promise<void> {
    if (row.snapshot.source !== "gmgn") throw new Error("Only real GMGN observations may be imported into benchmark");
    const snapshot = snapshotSchema.parse(row.snapshot);
    if (!row.outcomes) throw new Error("Mature outcomes required");
    const outcome = outcomesSchema.parse(row.outcomes);
    if (Date.parse(outcome.availableAt) < Date.parse(snapshot.snapshotAt) + 86400000) throw new Error("Outcomes not mature");
    await this.db.transaction(async (tx) => {
      const [token] = await tx.insert(schema.tokens).values({ mintAddress: snapshot.mintAddress, symbol: snapshot.symbol,
        name: snapshot.name, launchpad: snapshot.launchpad, lastSeenAt: snapshot.snapshotAt })
        .onConflictDoUpdate({ target: schema.tokens.mintAddress, set: { lastSeenAt: snapshot.snapshotAt } }).returning({ id: schema.tokens.id });
      if (!token) throw new Error("TOKEN_INSERT_FAILED");
      const { mintAddress: _mint, developer: _dev, symbol: _symbol, name: _name, launchpad: _pad, ...metrics } = snapshot;
      let [saved] = await tx.insert(schema.tokenSnapshots).values({ ...metrics, tokenId: token.id, rawSourceJson: snapshot })
        .onConflictDoNothing().returning({ id: schema.tokenSnapshots.id });
      if (!saved) [saved] = await tx.select({ id: schema.tokenSnapshots.id }).from(schema.tokenSnapshots)
        .where(and(eq(schema.tokenSnapshots.tokenId, token.id), eq(schema.tokenSnapshots.snapshotAt, snapshot.snapshotAt), eq(schema.tokenSnapshots.source, snapshot.source)));
      if (!saved) throw new Error("SNAPSHOT_INSERT_FAILED");
      await tx.insert(schema.tokenOutcomes).values({ ...outcome, tokenSnapshotId: saved.id })
        .onConflictDoUpdate({ target: schema.tokenOutcomes.tokenSnapshotId, set: outcome });
    });
  }
  async close(): Promise<void> { await this.pool.end(); }
}
