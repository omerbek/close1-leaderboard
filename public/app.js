// close-1 community leaderboard — client.
// Every upstream string reaches the DOM through textContent; nothing is parsed as HTML.

const $ = (selector) => document.querySelector(selector);
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const LOCALE = "en-US";
const fmt = (value, digits = 2) => (value === null || value === undefined || !Number.isFinite(value))
  ? "—"
  : new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const int = (value) => (Number.isFinite(value) ? new Intl.NumberFormat(LOCALE).format(value) : "—");
const signed = (value, digits = 2) => (Number.isFinite(value) ? `${value >= 0 ? "+" : "−"}${fmt(Math.abs(value), digits)}` : "—");
const ago = (ms) => (ms < 90_000 ? `${Math.max(0, Math.round(ms / 1000))} s ago` : `${Math.round(ms / 60_000)} min ago`);
const utc = (iso) => iso.replace("T", " ").replace(/\.\d+Z$|Z$/, " UTC");
const shortDid = (did) => `${did.slice(8, 13)}…${did.slice(-4)}`;
const countdown = (iso) => {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86_400_000), h = Math.floor(ms / 3_600_000) % 24, m = Math.floor(ms / 60_000) % 60;
  return d ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
};

function copyButton(did) {
  const button = el("button", "copy", "copy");
  button.type = "button";
  button.setAttribute("aria-label", `Copy ${did}`);
  button.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(did); button.textContent = "copied"; }
    catch { button.textContent = "select"; window.getSelection()?.selectAllChildren(button.previousSibling); }
    setTimeout(() => { button.textContent = "copy"; }, 1500);
  });
  return button;
}

function didLabel(did) {
  const wrap = el("span", undefined, "did");
  const text = el("span", shortDid(did));
  text.title = did;
  wrap.append(text, copyButton(did));
  return wrap;
}

// ---------------------------------------------------------------- KPIs

function renderKpis(board) {
  const s = board.summary;
  const final = board.final;
  const lock = countdown(board.schedule.lockAt);
  const finalIn = countdown(board.schedule.finalAt);
  const items = [
    ["Sweep", int(s.sweep), `referee posted ${ago(board.sourceLag)}`],
    ["Hyperliquid xyz:NVDA", `$${fmt(s.hl)}`, `last trade ${fmt(s.priceAgeSeconds, 0)} s before the sweep`],
    ["Contest mark", `$${fmt(s.mark)}`, `HL − mark ${signed(s.markDifference)}`],
    ["Registered owners", int(s.owners), "keys minted by the referee"],
    ["Keys with a position", `${int(s.longs + s.shorts)}`, `${int(s.longs)} long · ${int(s.shorts)} short`],
    ["Open interest", int(Math.round(s.openInterest ?? s.open)), "contracts across all accounts"],
    ["Trading lock", lock ?? "locked", utc(board.schedule.lockAt)],
    final
      ? ["Final S (verified)", `$${fmt(final.price)}`, `trade ${utc(final.trade.time)}`]
      : ["Final S", finalIn ?? "awaiting referee", `last HL trade before ${utc(board.schedule.finalAt)}`],
  ];
  $("#kpis").replaceChildren(...items.map(([label, value, note]) => {
    const card = el("article", undefined, "kpi");
    card.append(el("span", label, "label"), el("strong", value), el("small", note));
    return card;
  }));
}

// ---------------------------------------------------------------- Top 25

function estimateCell(row) {
  if (row.scoreAtHl === null) return el("span", "—", "muted");
  const wrap = el("span", undefined, "estimate");
  wrap.append(el("span", fmt(row.scoreAtHl)), el("small", ` pos ${signed(row.position)}`));
  return wrap;
}

function renderTable(board) {
  const table = el("table");
  const caption = el("caption", `Referee-published top ${board.top25.length} at sweep ${int(board.summary.sweep)}, scored at the contest mark`);
  caption.className = "sr-only";
  const head = el("thead");
  const hr = el("tr");
  [["Rank", "num"], ["Key", ""], ["Score · mark", "num"], ["Est. at HL*", "num"]].forEach(([t, c]) => hr.append(el("th", t, c)));
  head.append(hr);
  const body = el("tbody");
  for (const cluster of board.clusters) {
    const tr = el("tr", undefined, cluster.size > 1 ? "cluster" : "");
    const rank = el("td", cluster.size > 1 || cluster.openEnded ? `${cluster.start}–${cluster.end}${cluster.openEnded ? "+" : ""}` : String(cluster.start), "num rank");
    rank.dataset.label = "Rank";
    const key = el("td");
    key.dataset.label = "Key";
    if (cluster.size === 1) {
      key.append(didLabel(cluster.rows[0].did));
    } else {
      const details = el("details");
      const summary = el("summary");
      summary.append(el("span", `${cluster.openEnded ? "≥" : ""}${cluster.size} keys tied`, "badge"), el("span", " share these places", "muted"));
      const list = el("ul", undefined, "tie-list");
      cluster.rows.forEach((row) => {
        const li = el("li");
        li.append(didLabel(row.did));
        if (row.scoreAtHl !== null) li.append(estimateCell(row));
        list.append(li);
      });
      if (cluster.openEnded) list.append(el("li", "…the referee publishes 25 rows; more keys may share this score.", "muted"));
      details.append(summary, list);
      key.append(details);
    }
    const score = el("td", fmt(cluster.score), "num strong");
    score.dataset.label = "Score · mark";
    const est = el("td", undefined, "num");
    est.dataset.label = "Est. at HL";
    const known = cluster.rows.filter((r) => r.scoreAtHl !== null);
    if (cluster.size === 1) est.append(estimateCell(cluster.rows[0]));
    else est.append(known.length ? el("span", `${known.length} of ${cluster.size} known`, "muted") : el("span", "—", "muted"));
    tr.append(rank, key, score, est);
    body.append(tr);
  }
  table.append(caption, head, body);
  $("#tableMount").replaceChildren(table);
  const clusters = board.clusters.filter((c) => c.size > 1);
  $("#tieNote").textContent = clusters.length
    ? `${clusters.length} tie group${clusters.length > 1 ? "s" : ""} in the published rows — identical scores usually mean keys that entered the same side in the same sweep.`
    : "";
}

// ---------------------------------------------------------------- Chart
// Two panels on one time axis instead of one chart with two y-scales:
// price ($, HL vs contest mark) above, the published top score (POLF) below.

const NS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};
const svgText = (attrs, text) => { const t = svg("text", attrs); t.textContent = text; return t; };
const quantile = (values, q) => { const s = [...values].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };
const niceTicks = (min, max, count) => {
  const raw = (max - min) / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
};

let chartRows = [];
function renderChart(rows) {
  chartRows = rows;
  const mount = $("#chart");
  if (rows.length < 2) { mount.replaceChildren(el("p", "Not enough retained, aligned history to draw the chart yet.", "muted")); return; }
  // Drawn at the container's real pixel width so text stays legible on phones.
  const W = Math.max(300, Math.round(mount.clientWidth || 1000));
  const narrow = W < 560;
  const padL = narrow ? 44 : 56, padR = narrow ? 84 : 96;
  const A = { top: 16, h: narrow ? 170 : 210 }, B = { top: (narrow ? 170 : 210) + 52, h: narrow ? 84 : 104 };
  const H = B.top + B.h + 30;
  const x = (i) => padL + (i * (W - padL - padR)) / (rows.length - 1);

  // Price domain: follow HL, and admit mark values only within a robust band so a single
  // thin-print spike does not flatten the HL line; clipped points get an edge marker.
  const hl = rows.map((r) => r.hl), mark = rows.map((r) => r.mark);
  const hlMin = Math.min(...hl), hlMax = Math.max(...hl);
  const pad = Math.max(0.75, (hlMax - hlMin) * 0.6);
  const lo = Math.min(hlMin - pad, quantile(mark, 0.05)), hi = Math.max(hlMax + pad, quantile(mark, 0.95));
  const yA = (v) => A.top + A.h - ((Math.min(hi, Math.max(lo, v)) - lo) * A.h) / (hi - lo);
  const scores = rows.map((r) => r.top1);
  const sLo = Math.min(...scores), sHi = Math.max(...scores) === sLo ? sLo + 1 : Math.max(...scores);
  const yB = (v) => B.top + B.h - ((v - sLo) * B.h) / (sHi - sLo);

  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", tabindex: 0,
    "aria-label": `Hyperliquid price and contest mark over sweeps ${rows[0].n} to ${rows.at(-1).n}, and the leading published score. Use arrow keys to inspect points.` });
  const grid = (panel, ticks, y, label) => {
    for (const t of ticks) {
      root.append(svg("line", { x1: padL, x2: W - padR, y1: y(t), y2: y(t), class: "grid" }));
      root.append(svgText({ x: padL - 8, y: y(t) + 4, "text-anchor": "end", class: "tick" }, label(t)));
    }
  };
  grid(A, niceTicks(lo, hi, 4), yA, (t) => `$${fmt(t, t % 1 ? 1 : 0)}`);
  grid(B, niceTicks(sLo, sHi, 2), yB, (t) => fmt(t, 0));
  root.append(svgText({ x: padL, y: B.top - 12, class: "panel-title" }, "Leading published score (POLF, at mark)"));

  const line = (values, y) => values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  root.append(svg("path", { d: line(mark, yA), class: "s-mark" }));
  root.append(svg("path", { d: line(hl, yA), class: "s-hl" }));
  root.append(svg("path", { d: line(scores, yB), class: "s-top" }));

  let clipped = 0;
  mark.forEach((v, i) => {
    if (v > hi || v < lo) {
      clipped += 1;
      const up = v > hi, cy = up ? A.top + 1 : A.top + A.h - 1, cx = x(i);
      root.append(svg("path", { d: up ? `M${cx - 4},${cy + 7}L${cx},${cy}L${cx + 4},${cy + 7}Z` : `M${cx - 4},${cy - 7}L${cx},${cy}L${cx + 4},${cy - 7}Z`, class: "clip" }));
    }
  });

  // Direct labels at the line ends (identity is never colour alone).
  const endLabel = (text, y, cls) => root.append(svgText({ x: W - padR + 8, y: y + 4, class: `end ${cls}` }, text));
  const yHl = yA(hl.at(-1)), yMk = yA(mark.at(-1));
  const apart = Math.abs(yHl - yMk) < 14 ? (yHl <= yMk ? [-7, 7] : [7, -7]) : [0, 0];
  endLabel(`HL ${fmt(hl.at(-1))}`, yHl + apart[0], "l-hl");
  endLabel(`mark ${fmt(mark.at(-1))}`, yMk + apart[1], "l-mark");
  endLabel(fmt(scores.at(-1)), yB(scores.at(-1)), "l-top");

  // Hover / keyboard crosshair.
  const cross = svg("line", { y1: A.top, y2: B.top + B.h, class: "cross", visibility: "hidden" });
  const dots = ["s-hl", "s-mark", "s-top"].map((c) => svg("circle", { r: 4.5, class: `dot ${c}`, visibility: "hidden" }));
  root.append(cross, ...dots);
  const tip = el("div", undefined, "tip");
  tip.hidden = true;
  let index = rows.length - 1;
  const show = (i) => {
    index = Math.max(0, Math.min(rows.length - 1, i));
    const r = rows[index], cx = x(index);
    cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
    [[r.hl, yA], [r.mark, yA], [r.top1, yB]].forEach(([v, y], k) => { dots[k].setAttribute("cx", cx); dots[k].setAttribute("cy", y(v)); dots[k].setAttribute("visibility", "visible"); });
    tip.replaceChildren(
      el("strong", `Sweep ${int(r.n)}`), el("span", utc(r.ts).slice(5, 16) + " UTC", "muted"),
      el("span", `HL $${fmt(r.hl)}`, "t-hl"), el("span", `Mark $${fmt(r.mark)}`, "t-mark"),
      el("span", `Top ${fmt(r.top1)}${r.topClusterSize > 1 ? ` · ${r.topClusterSize} tied` : ""}`, "t-top"));
    tip.hidden = false;
    tip.style.left = `${Math.min(W - 170, Math.max(0, cx - 85))}px`;
  };
  const hide = () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); dots.forEach((d) => d.setAttribute("visibility", "hidden")); };
  const hit = svg("rect", { x: padL, y: A.top, width: W - padL - padR, height: B.top + B.h - A.top, fill: "transparent" });
  hit.addEventListener("pointermove", (e) => {
    const pt = root.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const local = pt.matrixTransform(root.getScreenCTM().inverse());
    show(Math.round(((local.x - padL) / (W - padL - padR)) * (rows.length - 1)));
  });
  hit.addEventListener("pointerleave", hide);
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); show(index + (e.key === "ArrowRight" ? 1 : -1)); }
    if (e.key === "Escape") hide();
  });
  root.addEventListener("blur", hide);
  root.append(hit);

  const legend = el("div", undefined, "legend");
  [["HL reference", "k-hl"], ["Contest mark (VWAP)", "k-mark"], ["Leading score", "k-top"]].forEach(([t, c]) => {
    const item = el("span", undefined, "key"); item.append(el("i", undefined, c), el("span", t)); legend.append(item);
  });
  mount.replaceChildren(root, tip, legend);
  $("#chartMeta").textContent = `${rows.length} sweeps · ${int(rows[0].n)}–${int(rows.at(-1).n)}${clipped ? ` · ${clipped} mark spike${clipped > 1 ? "s" : ""} beyond the axis (▲▼)` : ""}`;

  // Table view of the most recent points.
  const table = el("table", undefined, "data");
  const hr = el("tr");
  ["Sweep", "UTC", "HL", "Mark", "Top score", "Tied"].forEach((t) => hr.append(el("th", t)));
  const thead = el("thead"); thead.append(hr);
  const tbody = el("tbody");
  rows.slice(-24).reverse().forEach((r) => {
    const tr = el("tr");
    [int(r.n), utc(r.ts).slice(5, 16), fmt(r.hl), fmt(r.mark), fmt(r.top1), String(r.topClusterSize)].forEach((v) => tr.append(el("td", v)));
    tbody.append(tr);
  });
  table.append(thead, tbody);
  $("#chartTable").replaceChildren(table);
}

// ---------------------------------------------------------------- Health & verification

function renderHealth(board) {
  const h = board.flowHealth;
  const missed = h.missed.length ? h.missed.map(([room, a, b]) => `${room} ${int(a)}–${int(b)}`).join(", ") : "none";
  const pairs = [
    ["Referee lag after the sweep", `${fmt(h.sweepLagMs / 1000, 1)} s`],
    ["Rooms aligned on one sweep", board.aligned ? "yes" : "no — rooms mid-update"],
    ["Mints not listed in the post", int(h.omitted.mints)],
    ["Settled trades not listed", int(h.omitted.settled)],
    ["Void trades not listed", int(h.omitted.void)],
    ["Missed room ranges (this sweep)", missed],
    ["Final message retained", h.retainedFinal ? "yes" : "not yet"],
  ];
  $("#health").replaceChildren(...pairs.flatMap(([k, v]) => [el("dt", k), el("dd", v)]));
  $("#caveats").replaceChildren(...board.caveats.map((x) => el("li", x)));
}

function renderVerification(board) {
  $("#verification").replaceChildren(...Object.entries(board.rooms).map(([room, x]) => {
    const card = el("article", undefined, "verify-card");
    card.append(el("strong", `✓ ${room.replace("d-close1-", "")}`), el("span", `seq ${int(x.seq)} · sweep ${int(x.n)}`), el("span", x.file ? `file ${x.file.slice(0, 16)}…` : "no file hash", "mono"));
    card.title = x.file ?? "";
    return card;
  }));
}

// ---------------------------------------------------------------- Refresh loop

let lastSweep = null;
async function refresh() {
  const status = $("#status");
  try {
    const boardRes = await fetch("/api/board");
    const board = await boardRes.json();
    if (!boardRes.ok) throw new Error(board.detail ?? board.error);
    renderKpis(board); renderTable(board); renderHealth(board); renderVerification(board);
    if (board.summary.sweep !== lastSweep) {
      lastSweep = board.summary.sweep;
      const historyRes = await fetch("/api/history");
      renderChart(historyRes.ok ? (await historyRes.json()).history : []);
    }
    status.className = `banner${board.stale ? " warn" : ""}`;
    status.textContent = board.stale
      ? "technocore.chat is not answering; showing the last verified snapshot."
      : `Verified referee snapshot for sweep ${int(board.summary.sweep)} · checked ${new Date(board.generatedAt).toLocaleTimeString()}`;
  } catch (error) {
    status.className = "banner error";
    status.textContent = `No verified data is available right now: ${error.message}`;
  }
}

$("#lookupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const out = $("#lookupResult");
  const did = $("#did").value.trim();
  out.textContent = "Searching the retained referee posts…";
  try {
    const response = await fetch(`/api/key?did=${encodeURIComponent(did)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (!data.found) { out.replaceChildren(el("p", "Not in any retained top-25 score list or top-10 position list. That does not mean the key has no mint or position — the referee only publishes the top rows.")); return; }
    const table = el("table", undefined, "data");
    const hr = el("tr"); ["Sweep", "Score · mark", "Position"].forEach((t) => hr.append(el("th", t)));
    const thead = el("thead"); thead.append(hr);
    const tbody = el("tbody");
    data.history.slice(-20).reverse().forEach((x) => { const tr = el("tr"); [int(x.n), fmt(x.score), x.position === null ? "—" : signed(x.position)].forEach((v) => tr.append(el("td", v))); tbody.append(tr); });
    table.append(thead, tbody);
    out.replaceChildren(el("p", `${data.history.length} retained sweep${data.history.length > 1 ? "s" : ""} list this key.`), table);
  } catch (error) { out.textContent = error.message; }
});

let resizeTimer = null;
new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => chartRows.length && renderChart(chartRows), 150); }).observe($("#chart"));

let timer = null;
function schedule() { clearInterval(timer); if (!document.hidden) timer = setInterval(refresh, 60_000); }
document.addEventListener("visibilitychange", () => { schedule(); if (!document.hidden) refresh(); });
refresh();
schedule();
