import { formatRunnerAlert } from "./format.js";

const RUNNER_CONFIG = Object.freeze({
  solana: "tokenAlerts",
  robinhood: "robinhoodAlerts",
  bsc: "bscAlerts"
});

export class RunnerScanner {
  constructor({ runnerType, configStore, gmgnClient, alertQueue, alertCache, logger = console }) {
    this.runnerType = runnerType;
    this.configStore = configStore;
    this.gmgnClient = gmgnClient;
    this.alertQueue = alertQueue;
    this.alertCache = alertCache;
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
      const config = this.configStore.get()[RUNNER_CONFIG[this.runnerType]];
      if (config.enabled) {
        await this.scan(config);
      }
      this.schedule(config.pollIntervalSec);
    } catch (error) {
      this.logger.error(`[${this.runnerType}] scan failed`, error);
      this.schedule(60);
    }
  }

  async scan(config) {
    const candidates = await this.gmgnClient.fetchCandidates(this.runnerType);
    const qualified = candidates.filter((token) => qualifies(this.runnerType, token, config)).slice(0, config.maxPerScan);

    for (const token of qualified) {
      const key = `${this.runnerType}:${token.ca}`;
      if (this.alertCache.has(key)) continue;
      this.alertCache.set(key);
      this.alertQueue.enqueue({
        runnerType: this.runnerType,
        token,
        message: formatRunnerAlert(this.runnerType, token)
      });
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
