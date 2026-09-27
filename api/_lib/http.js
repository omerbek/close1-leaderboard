export function setCommonHeaders(res, cacheControl = "public, s-maxage=60, stale-while-revalidate=600") {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("X-Content-Type-Options", "nosniff");
}

export function sendJson(res, status, body, cacheControl) {
  setCommonHeaders(res, cacheControl);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function methodAllowed(req, res) {
  if (req.method === "OPTIONS") { setCommonHeaders(res); res.statusCode = 204; res.end(); return false; }
  if (req.method !== "GET") { sendJson(res, 405, { error: "Method not allowed" }); return false; }
  return true;
}
