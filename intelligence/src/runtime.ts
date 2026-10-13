import "dotenv/config";
import { configSchema } from "./config.js";
import { SourceCache, MockGmgnAdapter, LiveGmgnAdapter } from "./gmgn.js";
import { MemoryRepository, PostgresRepository } from "./database/repository.js";
import { ScanService } from "./service.js";

export function createRuntime() {
  const config = configSchema.parse(process.env);
  if (config.GMGN_MODE === "live") throw new Error("Live adapter belum terverifikasi; gunakan mock. Lihat docs/gmgn-integration.md.");
  const repository = config.DATABASE_URL ? new PostgresRepository(config.DATABASE_URL) : new MemoryRepository();
  const adapter = config.GMGN_MODE === "mock" ? new MockGmgnAdapter() : new LiveGmgnAdapter();
  const cache = new SourceCache(adapter, config.CACHE_TOKEN_TTL_SECONDS * 1000);
  return { config, repository, service: new ScanService(cache, repository, config) };
}
