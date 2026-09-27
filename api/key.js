import { keyHistory } from "./_lib/board.js";
import { DID_RE } from "./_lib/constants.js";
import { methodAllowed, sendJson } from "./_lib/http.js";
import { fetchRoom } from "./_lib/technocore.js";

export const NOT_FOUND_NOTE = "Not in any retained published top list. That does not mean the key has no mint or position.";

export async function loadKey(did, fetcher = fetchRoom) {
  if (!DID_RE.test(did ?? "")) return { status: 400, body: { error: "Invalid did:key. Expected an Ed25519 did:key beginning with did:key:z6Mk." } };
  const entries = await Promise.all(["d-close1-pnl", "d-close1-positions"].map(async (room) => [room, await fetcher(room, { limit: 200 })]));
  const history = keyHistory(did, Object.fromEntries(entries));
  return { status: 200, body: { did, generatedAt: new Date().toISOString(), stale: entries.some(([, x]) => x.stale), found: history.length > 0, history, note: history.length ? null : NOT_FOUND_NOTE } };
}

export default async function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  try { const result = await loadKey(typeof req.query?.did === "string" ? req.query.did : ""); sendJson(res, result.status, result.body, "public, s-maxage=60, stale-while-revalidate=300"); }
  catch (error) { sendJson(res, 503, { error: "Verified key history is temporarily unavailable", detail: error.message, stale: true }); }
}
