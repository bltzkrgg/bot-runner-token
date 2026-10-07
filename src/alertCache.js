export class AlertCache {
  constructor({ initial = {}, ttlMs = 30 * 60 * 1000, onChange = async () => {} } = {}) {
    this.ttlMs = ttlMs;
    this.onChange = onChange;
    this.seen = new Map(Object.entries(initial));
  }

  has(key, ttlMs = this.ttlMs) {
    this.prune();
    return this.seen.has(key) && Date.now() - this.seen.get(key) <= ttlMs;
  }

  set(key) {
    this.seen.set(key, Date.now());
    return this.onChange(this.toJSON());
  }

  prune() {
    const now = Date.now();
    for (const [key, timestamp] of this.seen.entries()) {
      if (now - timestamp > this.ttlMs) this.seen.delete(key);
    }
  }

  toJSON() {
    this.prune();
    return Object.fromEntries(this.seen.entries());
  }
}
