import { loadBoard } from "./board.js";
import { methodAllowed, setCommonHeaders } from "./_lib/http.js";

const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default async function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  try {
    const board = await loadBoard();
    const lines = ["rank,did,score_mark,score_at_hl_estimate,position,tie_size"];
    for (const row of board.top25) lines.push([row.rank, row.did, row.score, row.scoreAtHl, row.position, row.tieSize].map(csv).join(","));
    setCommonHeaders(res);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "inline; filename=close1-top25.csv");
    res.end(`${lines.join("\n")}\n`);
  } catch (error) {
    setCommonHeaders(res, "public, s-maxage=10"); res.statusCode = 503; res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.end(`Verified referee data is temporarily unavailable: ${error.message}\n`);
  }
}
