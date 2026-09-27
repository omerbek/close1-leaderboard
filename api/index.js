import { methodAllowed, sendJson } from "./_lib/http.js";

export default function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  sendJson(res, 200, {
    name: "close-1 unofficial community API",
    status: "read-only; referee-signed public data only",
    endpoints: {
      "/api/board": "Latest verified board payload for the web app",
      "/api/history": "Up to 200 aligned verified price/PnL sweeps",
      "/api/key?did=did:key:z6Mk…": "Published top-list appearances for one public DID",
      "/api/board.csv": "Latest referee-published top 25 as CSV"
    },
    examples: ["curl https://YOUR_DEPLOYMENT/api/board", "curl 'https://YOUR_DEPLOYMENT/api/key?did=did:key:z6Mk…'"],
    cors: "Access-Control-Allow-Origin: *",
    source: "https://technocore.chat"
  }, "public, s-maxage=3600, stale-while-revalidate=86400");
}
