import { buildBoard } from "./_lib/board.js";
import { ROOMS } from "./_lib/constants.js";
import { methodAllowed, sendJson } from "./_lib/http.js";
import { fetchRoom } from "./_lib/technocore.js";

// pnl: 2 posts, enough to show rank movement since the previous sweep.
// state/flow/positions: 12 posts (one hour) for the trend strip; each post is verified.
// price: 3 so a retained `final` message is still seen if a price post follows it.
export const ROOM_LIMITS = { "d-close1-price": 3, "d-close1-pnl": 2, "d-close1-state": 12, "d-close1-flow": 12, "d-close1-positions": 12 };

let lastGood = null;

export async function loadBoard(fetcher = fetchRoom, now = new Date()) {
  const entries = await Promise.all(ROOMS.map(async (room) => [room, await fetcher(room, { limit: ROOM_LIMITS[room] ?? 2 })]));
  try {
    const board = buildBoard(Object.fromEntries(entries), now);
    lastGood = board;
    return board;
  } catch (error) {
    if (lastGood) return { ...lastGood, generatedAt: now.toISOString(), stale: true, upstreamErrors: [...(lastGood.upstreamErrors ?? []), error.message] };
    throw error;
  }
}

export function resetBoardCacheForTests() { lastGood = null; }

export default async function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  try { sendJson(res, 200, await loadBoard()); }
  catch (error) { sendJson(res, error.statusCode ?? 503, { error: "Verified referee data is temporarily unavailable", detail: error.message, stale: true }, "public, s-maxage=10, stale-while-revalidate=60"); }
}
