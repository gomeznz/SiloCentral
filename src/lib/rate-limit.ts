// A small fixed-window limiter for the reporting API: at most `limit`
// requests per key per window. Held in memory, so it assumes a single server
// process (as on Railway today) — a restart clears it and several replicas
// would each count separately. Same caveat as login-throttle.ts.
const WINDOW_MS = 60_000;

const windows = new Map<string, { start: number; count: number }>();

export type RateLimitResult = { allowed: boolean; limit: number; remaining: number; retryAfterSeconds: number };

export function takeRequest(key: string, limit: number, now = Date.now()): RateLimitResult {
  let entry = windows.get(key);
  if (!entry || now - entry.start >= WINDOW_MS) {
    entry = { start: now, count: 0 };
    windows.set(key, entry);
    // Opportunistic tidy-up so idle keys don't accumulate.
    if (windows.size > 1000) {
      for (const [k, v] of windows) if (now - v.start >= WINDOW_MS) windows.delete(k);
    }
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((entry.start + WINDOW_MS - now) / 1000));
  if (entry.count >= limit) return { allowed: false, limit, remaining: 0, retryAfterSeconds };

  entry.count++;
  return { allowed: true, limit, remaining: limit - entry.count, retryAfterSeconds };
}
