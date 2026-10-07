const WINDOW_SEC = 300;

export function detectVolumeSpike(token, config, nowSec = Date.now() / 1000) {
  if (typeof token.ca !== "string" || !token.ca.trim() || token.migrated !== true) return;
  if (!Number.isFinite(token.migratedAtSec) || token.migratedAtSec <= 0 || token.migratedAtSec > nowSec) return;
  if (!Number.isFinite(token.volume5mUsd) || token.volume5mUsd < config.minVolume5mUsd) return;
  const end = token.volumeWindowEndSec;
  // Require a fresh, explicitly timed rolling window; discovery alone is not a spike.
  if (!Number.isInteger(end) || end > nowSec || nowSec - end > 120) return;
  const history = token.volumeHistory5m;
  if (!Array.isArray(history)) return;
  const periods = [];
  for (let index = 1; index <= config.baselinePeriods; index++) {
    const expectedEnd = end - WINDOW_SEC * index;
    const matches = history.filter((period) => period?.endTimeSec === expectedEnd);
    if (matches.length !== 1) return;
    const period = matches[0];
    if (period.startTimeSec !== expectedEnd - WINDOW_SEC || period.startTimeSec < token.migratedAtSec) return;
    if (!Number.isFinite(period.volumeUsd) || period.volumeUsd < 0) return;
    periods.push(period.volumeUsd);
  }
  const baselineUsd = periods.reduce((sum, volume) => sum + volume, 0) / periods.length;
  // A zero baseline has no finite multiplier; do not fabricate an infinite spike.
  if (!Number.isFinite(baselineUsd) || baselineUsd <= 0) return;
  const multiplier = token.volume5mUsd / baselineUsd;
  if (!Number.isFinite(multiplier) || multiplier < config.minMultiplier) return;
  return { baselineUsd, multiplier, baselinePeriods: periods.length,
    minVolume5mUsd: config.minVolume5mUsd, minMultiplier: config.minMultiplier,
    migratedAgeMin: (nowSec - token.migratedAtSec) / 60 };
}
