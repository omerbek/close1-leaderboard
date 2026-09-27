import { UPSTREAM } from "./constants.js";
import { parseRoomEnvelope } from "./parse.js";

// One shared cache per function instance, keyed by room and limit.
// - FRESH_MS: answers inside this window never reach technocore.chat. /api/key takes an
//   arbitrary DID, so without this every distinct lookup would fetch ~0.5 MB twice from
//   upstream; with it, lookups share one fetch per room per window.
// - inflight: concurrent requests for the same room wait on one upstream call.
// - after an upstream failure the last good copy is served with stale:true.
const FRESH_MS = 30_000;
const cache = new Map();
const inflight = new Map();
const USER_AGENT = "close1-community-leaderboard (read-only; +https://github.com/flop-labs/technocore-close-call-challenge)";

export async function fetchRoom(room, { limit = 2, fetchImpl = fetch, timeoutMs = 8000, now = Date.now } = {}) {
  const key = `${room}:${limit}`;
  const hit = cache.get(key);
  if (hit && now() - hit.at < FRESH_MS) return { data: hit.data, stale: false, error: null };
  if (inflight.has(key)) return inflight.get(key);
  const pending = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${UPSTREAM}/r/${encodeURIComponent(room)}?format=json&limit=${limit}`, {
        signal: controller.signal,
        headers: { accept: "application/json", "user-agent": USER_AGENT },
      });
      if (!response.ok) throw new Error(`upstream ${response.status}`);
      const data = parseRoomEnvelope(await response.text());
      cache.set(key, { data, at: now() });
      return { data, stale: false, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "upstream error";
      return { data: hit?.data ?? null, stale: true, error: message };
    } finally {
      clearTimeout(timer);
      inflight.delete(key);
    }
  })();
  inflight.set(key, pending);
  return pending;
}

export function clearCacheForTests() { cache.clear(); inflight.clear(); }
