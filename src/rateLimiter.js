export class AlertQueue {
  constructor({ sendIntervalMs = 1500, maxSize = 100, ttlMs = 180000, sender, logger = console }) {
    this.sendIntervalMs = sendIntervalMs;
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.sender = sender;
    this.logger = logger;
    this.items = [];
    this.running = false;
  }

  enqueue(item) {
    if (this.items.length >= this.maxSize) {
      this.items.shift().onSettled?.();
    }
    this.items.push({ ...item, queuedAt: Date.now() });
    this.start();
  }

  start() {
    if (this.running) return;
    this.running = true;
    void this.drain();
  }

  async drain() {
    while (this.items.length > 0) {
      const item = this.items.shift();
      try {
        if (Date.now() - item.queuedAt <= this.ttlMs) {
          await this.sender(item);
          await item.onSent?.();
        }
      } catch (error) {
        this.logger.error("Discord alert failed", error);
      } finally {
        item.onSettled?.();
      }
      await sleep(this.sendIntervalMs);
    }
    this.running = false;
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
