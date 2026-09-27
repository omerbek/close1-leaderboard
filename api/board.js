import { buildBoard } from "./_lib/board.js";
import { ROOMS } from "./_lib/constants.js";
import { methodAllowed, sendJson } from "./_lib/http.js";
import { fetchRoom } from "./_lib/technocore.js";

let lastGood = null;

export async function loadBoard(fetcher = fetchRoom, now = new Date()) {
  const entries = await Promise.all(ROOMS.map(async (room) => [room, await fetcher(room, { limit: 2 })]));
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
