import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import board from "../api/board.js";
import history from "../api/history.js";
import key from "../api/key.js";
import csv from "../api/board-csv.js";
import docs from "../api/index.js";

const root = new URL("../public/", import.meta.url);
const handlers = new Map([["/api/board", board], ["/api/history", history], ["/api/key", key], ["/api/board.csv", csv], ["/api", docs]]);
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".png":"image/png" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const handler = handlers.get(url.pathname);
  if (handler) {
    req.query = Object.fromEntries(url.searchParams);
    await handler(req, res);
    return;
  }
  try {
    const requested = url.pathname === "/" ? "index.html" : normalize(url.pathname).replace(/^[/\\]+/, "");
    const file = new URL(requested, root);
    if (!file.href.startsWith(root.href) || !(await stat(file)).isFile()) throw new Error("not found");
    res.setHeader("Content-Type", mime[extname(file.pathname)] ?? "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end("Not found"); }
}).listen(Number(process.env.PORT || 3000), "127.0.0.1", () => console.log(`Local preview: http://127.0.0.1:${process.env.PORT || 3000}`));
