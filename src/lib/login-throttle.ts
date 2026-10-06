// Slows down password guessing. Two limits, both over a sliding window:
//
//   - per (IP, username): 5 failures -> that combination is locked out
//   - per IP:            20 failures -> that address is locked out
//
// Kept per-username-and-IP rather than per-username alone so a stranger can't
// lock a real user out of their own account just by typing wrong passwords for
// it from somewhere else.
//
// Held in memory, which is correct only while there is a single server
// process (the case on Railway today). A restart clears it, and several
// replicas would each count separately — move it into the database before
// scaling out.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_PAIR = 5;
const MAX_PER_IP = 20;

const failures = new Map<string, number[]>();

function recent(key: string, now: number): number[] {
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length > 0) failures.set(key, list);
  else failures.delete(key);
  return list;
}

export function loginKeys(ip: string, username: string) {
  return { pair: `${ip}|${username}`, ip: `ip:${ip}` };
}

// Minutes until the next attempt is allowed, or 0 if one is allowed now.
export function lockedOutMinutes(keys: { pair: string; ip: string }, now = Date.now()): number {
  let waitMs = 0;
  for (const [key, max] of [
    [keys.pair, MAX_PER_PAIR],
    [keys.ip, MAX_PER_IP],
  ] as const) {
    const list = recent(key, now);
    if (list.length >= max) waitMs = Math.max(waitMs, list[0] + WINDOW_MS - now);
  }
  return waitMs > 0 ? Math.ceil(waitMs / 60_000) : 0;
}

export function recordFailure(keys: { pair: string; ip: string }, now = Date.now()) {
  for (const key of [keys.pair, keys.ip]) {
    failures.set(key, [...recent(key, now), now]);
  }
}

export function clearFailures(keys: { pair: string; ip: string }) {
  failures.delete(keys.pair);
}
