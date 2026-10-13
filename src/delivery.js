import { sleep } from "./rateLimiter.js";

export function createAlertBroadcaster(targets, { wait = sleep, attempts = 3 } = {}) {
  if (!targets.length) throw new Error("Configure at least one alert destination");
  return async ({ message }) => {
    const pending = new Set(targets);
    for (let attempt = 0; attempt < attempts; attempt++) {
      const batch = [...pending];
      const results = await Promise.allSettled(batch.map((target) => Promise.resolve().then(() => target.send(message))));
      results.forEach((result, index) => { if (result.status === "fulfilled") pending.delete(batch[index]); });
      if (!pending.size) return;
      if (attempt + 1 < attempts) await wait(1000 * 2 ** attempt);
    }
    throw new Error(`Alert delivery failed: ${[...pending].map((target) => target.name).join(", ")}`);
  };
}
