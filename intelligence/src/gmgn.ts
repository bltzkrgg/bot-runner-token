import { readFile } from "node:fs/promises";
import bs58 from "bs58";
import { snapshotSchema, type Snapshot } from "./types.js";

export function validateMint(address: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return false;
  try { return bs58.decode(address).length === 32; } catch { return false; }
}

export interface GmgnAdapter {
  fetchToken(mint: string): Promise<Snapshot>;
}

export class MockGmgnAdapter implements GmgnAdapter {
  async fetchToken(mint: string): Promise<Snapshot> {
    const raw: unknown = JSON.parse(await readFile(new URL("../fixtures/gmgn/token.json", import.meta.url), "utf8"));
    const fixture = snapshotSchema.parse(raw);
    // A demonstration setup is not evidence about the submitted real-world mint.
    return { ...fixture, mintAddress: mint, snapshotAt: new Date().toISOString(), source: "mock" };
  }
}

export class LiveGmgnAdapter implements GmgnAdapter {
  async fetchToken(_mint: string): Promise<Snapshot> {
    // TODO: verify auth headers, exact info/security/developer payloads, units,
    // pagination coverage and rate-limit reset behavior against an approved API key.
    throw new Error("LIVE_GMGN_NOT_CONFIGURED: see docs/gmgn-integration.md");
  }
}

export class SourceCache {
  private cache = new Map<string, { expires: number; value: Snapshot }>();
  private inflight = new Map<string, Promise<Snapshot>>();
  constructor(private adapter: GmgnAdapter, private ttlMs: number, private now = Date.now) {}
  async get(mint: string): Promise<{ snapshot: Snapshot; cacheHit: boolean; requests: number }> {
    const cached = this.cache.get(mint);
    if (cached && cached.expires > this.now()) return { snapshot: cached.value, cacheHit: true, requests: 0 };
    const pending = this.inflight.get(mint);
    if (pending) return { snapshot: await pending, cacheHit: true, requests: 0 };
    const request = this.adapter.fetchToken(mint).then((raw) => {
      const value = snapshotSchema.parse(raw);
      if (value.mintAddress !== mint) throw new Error("SOURCE_MINT_MISMATCH");
      for (const [key, entry] of this.cache) if (entry.expires <= this.now()) this.cache.delete(key);
      if (this.cache.size >= 1000) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(mint, { value, expires: this.now() + this.ttlMs });
      return value;
    });
    this.inflight.set(mint, request);
    try { return { snapshot: await request, cacheHit: false, requests: 1 }; }
    finally { this.inflight.delete(mint); }
  }
}
