// Fixed-window rate limiter with a pluggable store. MemoryStore is per server instance (good enough for a single Node
// process and for tests); serverless deployments should use a shared store (e.g. a free Redis) behind the same interface.
export class MemoryStore {
  constructor({ maxKeys = 50000 } = {}) { this.map = new Map(); this.maxKeys = maxKeys; }
  hit(key, windowMs, now) {
    let e = this.map.get(key);
    if (!e || e.resetAt <= now) {
      if (this.map.size >= this.maxKeys) this.evict(now);
      e = { count: 0, resetAt: now + windowMs };
      this.map.set(key, e);
    }
    e.count += 1;
    return { count: e.count, resetAt: e.resetAt };
  }
  evict(now) {
    for (const [k, e] of this.map) if (e.resetAt <= now) this.map.delete(k);
    if (this.map.size >= this.maxKeys) this.map.delete(this.map.keys().next().value); // still full: drop the oldest key
  }
}

export function createRateLimiter({ limit, windowMs, store = new MemoryStore(), now = () => Date.now() }) {
  if (!(limit > 0) || !(windowMs > 0)) throw new Error('limit and windowMs must be positive');
  return {
    check(key) {
      const t = now();
      const { count, resetAt } = store.hit(String(key), windowMs, t);
      const allowed = count <= limit;
      return { allowed, limit, remaining: Math.max(0, limit - count), resetAt, retryAfterSec: allowed ? 0 : Math.max(1, Math.ceil((resetAt - t) / 1000)) };
    },
  };
}

export const rateLimitKey = (...parts) => parts.map((p) => String(p ?? '-').replace(/[:\s]/g, '_')).join(':');

// Starting points; tune from real traffic.
export const LIMIT_PRESETS = {
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  mfa: { limit: 5, windowMs: 5 * 60 * 1000 },
  api: { limit: 120, windowMs: 60 * 1000 },
  ai: { limit: 6, windowMs: 60 * 1000 },
  payment: { limit: 5, windowMs: 60 * 1000 },
  upload: { limit: 30, windowMs: 60 * 1000 },
  message: { limit: 60, windowMs: 60 * 1000 },
};
