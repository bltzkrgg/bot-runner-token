import { readFile } from "node:fs/promises";
import bs58 from "bs58";
import { snapshotSchema, type Snapshot, type Chain } from "./types.js";

export function validateMint(address: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return false;
  try { return bs58.decode(address).length === 32; } catch { return false; }
}

export interface GmgnAdapter {
  fetchToken(mint: string, chain: Chain): Promise<Snapshot>;
}

export function candidateChains(address: string): Chain[] {
  if (validateMint(address)) return ["solana"];
  if (/^0x[0-9a-fA-F]{40}$/.test(address)) return ["bsc", "robinhood"];
  return [];
}

export class MockGmgnAdapter implements GmgnAdapter {
  async fetchToken(mint: string, chain: Chain = "solana"): Promise<Snapshot> {
    const raw: unknown = JSON.parse(await readFile(new URL("../fixtures/gmgn/token.json", import.meta.url), "utf8"));
    const fixture = snapshotSchema.parse(raw);
    // A demonstration setup is not evidence about the submitted real-world mint.
    return { ...fixture, chain, mintAddress: mint, snapshotAt: new Date().toISOString(), source: "mock",
      ...(chain !== "solana" ? { launchpad: null, smartMoneyNetFlowSol: null } : {}) };
  }
}

export class LiveGmgnAdapter implements GmgnAdapter {
  async fetchToken(_mint: string, _chain: Chain = "solana"): Promise<Snapshot> {
    // TODO: verify auth headers, exact info/security/developer payloads, units,
    // pagination coverage and rate-limit reset behavior against an approved API key.
    throw new Error("LIVE_GMGN_NOT_CONFIGURED: see docs/gmgn-integration.md");
  }
}

export class SourceCache {
  private cache = new Map<string, { expires: number; value: Snapshot }>();
  private inflight = new Map<string, Promise<Snapshot>>();
  constructor(private adapter: GmgnAdapter, private ttlMs: number, private now = Date.now) {}
  async get(mint: string, chain: Chain = "solana"): Promise<{ snapshot: Snapshot; cacheHit: boolean; requests: number }> {
    if (chain !== "solana") mint = mint.toLowerCase();
    const key = `${chain}:${mint}`;
    const cached = this.cache.get(key);
    if (cached && cached.expires > this.now()) return { snapshot: cached.value, cacheHit: true, requests: 0 };
    const pending = this.inflight.get(key);
    if (pending) return { snapshot: await pending, cacheHit: true, requests: 0 };
    const request = this.adapter.fetchToken(mint, chain).then((raw) => {
      const value = snapshotSchema.parse(raw);
      const sourceAddress = chain === "solana" ? value.mintAddress : value.mintAddress.toLowerCase();
      if (sourceAddress !== mint || (value.chain ?? "solana") !== chain) throw new Error("SOURCE_MINT_MISMATCH");
      value.mintAddress = mint;
      value.chain = chain;
      for (const [key, entry] of this.cache) if (entry.expires <= this.now()) this.cache.delete(key);
      if (this.cache.size >= 1000) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { value, expires: this.now() + this.ttlMs });
      return value;
    });
    this.inflight.set(key, request);
    try { return { snapshot: await request, cacheHit: false, requests: 1 }; }
    finally { this.inflight.delete(key); }
  }
}
