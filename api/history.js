import { historyFrom } from "./_lib/board.js";
import { methodAllowed, sendJson } from "./_lib/http.js";
import { fetchRoom } from "./_lib/technocore.js";

let lastGood = null;

export async function loadHistory(fetcher = fetchRoom) {
  const entries = await Promise.all(["d-close1-price", "d-close1-pnl"].map(async (room) => [room, await fetcher(room, { limit: 200 })]));
  const results = Object.fromEntries(entries);
  try {
    const rows = historyFrom(results);
    if (!rows.length) throw new Error("No aligned verified history");
    const value = { generatedAt: new Date().toISOString(), stale: entries.some(([, x]) => x.stale), history: rows };
    lastGood = value;
    return value;
  } catch (error) {
    if (lastGood) return { ...lastGood, generatedAt: new Date().toISOString(), stale: true, error: error.message };
    throw error;
  }
}

export default async function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  try { sendJson(res, 200, await loadHistory(), "public, s-maxage=300, stale-while-revalidate=900"); }
  catch (error) { sendJson(res, 503, { error: "Verified history is temporarily unavailable", detail: error.message, stale: true }, "public, s-maxage=10, stale-while-revalidate=60"); }
}
