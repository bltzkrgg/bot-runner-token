import { formatRunnerAlert } from "./format.js";
import { detectVolumeSpike } from "./volumeSpike.js";

const RUNNER_CONFIG = Object.freeze({
  solana: "tokenAlerts",
  robinhood: "robinhoodAlerts",
  bsc: "bscAlerts"
});

export class RunnerScanner {
  constructor({ runnerType, configStore, gmgnClient, alertQueue, alertCache, spike = false, logger = console }) {
    this.runnerType = runnerType;
    this.configStore = configStore;
    this.gmgnClient = gmgnClient;
    this.alertQueue = alertQueue;
    this.alertCache = alertCache;
    this.spike = spike;
    this.pending = new Set();
    this.logger = logger;
    this.timer = undefined;
    this.stopped = false;
  }

  start() {
    void this.tick();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  async tick() {
    try {
      const section = this.spike ? `${this.runnerType}SpikeAlerts` : RUNNER_CONFIG[this.runnerType];
      const config = this.configStore.get()[section];
      if (config.enabled) {
        await this.scan(config);
      }
      this.schedule(config.pollIntervalSec);
    } catch (error) {
      this.logger.error(`[${this.runnerType}${this.spike ? " spike" : ""}] scan failed`, error);
      this.schedule(60);
    }
  }

  async scan(config) {
    const candidates = await this.gmgnClient.fetchCandidates(this.runnerType, { spike: this.spike });
    if (this.spike) return this.scanSpikes(candidates, config);
    const qualified = candidates.filter((token) => qualifies(this.runnerType, token, config))
      .filter((token) => !this.alertCache.has(`${this.runnerType}:${token.ca}`)).slice(0, config.maxPerScan);

    for (const token of qualified) {
      const key = `${this.runnerType}:${token.ca}`;
      if (this.alertCache.has(key)) continue;
      await this.alertCache.set(key);
      this.alertQueue.enqueue({
        runnerType: this.runnerType,
        token,
        message: formatRunnerAlert(this.runnerType, token)
      });
    }
  }

  scanSpikes(candidates, config) {
    let count = 0;
    for (const token of candidates) {
      if (count >= config.maxPerScan) break;
      const key = `spike:${this.runnerType}:${token.ca}`;
      if (this.pending.has(key) || this.alertCache.has(key, config.cooldownMin * 60000)) continue;
      const spike = detectVolumeSpike(token, config);
      if (!spike) continue;
      this.pending.add(key);
      try {
        this.alertQueue.enqueue({
          runnerType: this.runnerType, token,
          message: formatRunnerAlert(this.runnerType, token, spike),
          onSent: () => this.alertCache.set(key),
          onSettled: () => this.pending.delete(key)
        });
        count++;
      } catch (error) {
        this.pending.delete(key);
        throw error;
      }
    }
  }

  schedule(seconds) {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), seconds * 1000);
  }
}

export function qualifies(runnerType, token, config) {
  if (!isFiniteNumber(token.volume5mUsd) || !isFiniteNumber(token.feesAmount)) return false;
  if (token.volume5mUsd < config.minVolume5mUsd) return false;

  if (runnerType === "solana") {
    return isFiniteNumber(token.marketCapUsd) &&
      isFiniteNumber(token.ageMinutes) &&
      token.marketCapUsd >= config.minMarketCapUsd &&
      token.feesAmount >= config.minTotalFeesSol &&
      token.ageMinutes <= config.maxAgeMin;
  }

  if (runnerType === "robinhood") {
    return token.feesAmount >= config.minTotalFeesEth;
  }

  if (runnerType === "bsc") {
    return isFiniteNumber(token.marketCapUsd) &&
      isFiniteNumber(token.ageMinutes) &&
      token.marketCapUsd >= config.minMarketCapUsd &&
      token.feesAmount >= config.minTotalFeesBnb &&
      token.ageMinutes <= config.maxAgeMin;
  }

  return false;
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}
