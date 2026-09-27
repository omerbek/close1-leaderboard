// Close Call Arena — client. Every upstream string reaches the DOM through textContent.

const $ = (s) => document.querySelector(s);
const el = (tag, text, className) => {
  const n = document.createElement(tag);
  if (text !== undefined && text !== null) n.textContent = text;
  if (className) n.className = className;
  return n;
};
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const LOCALE = "en-US";
const fmt = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v)) ? "—" : new Intl.NumberFormat(LOCALE, { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
const int = (v) => (Number.isFinite(v) ? new Intl.NumberFormat(LOCALE).format(Math.round(v)) : "—");
const compact = (v) => (Number.isFinite(v) ? new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 2 }).format(v) : "—");
const signed = (v, d = 2) => (Number.isFinite(v) ? `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v), d)}` : "—");
const utc = (iso) => iso.replace("T", " ").replace(/\.\d+Z$|Z$/, " UTC");
const shortDid = (did) => `${did.slice(8, 13)}…${did.slice(-4)}`;
const pad2 = (n) => String(n).padStart(2, "0");

let board = null;
let lastSweep = null;
let lastHl = null;

// ---------------------------------------------------------------- number animation

function animateTo(node, value, format, duration = 900) {
  const from = Number(node.dataset.value ?? NaN);
  node.dataset.value = value;
  if (REDUCED || !Number.isFinite(from) || from === value) { node.textContent = format(value); return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration), e = 1 - (1 - t) ** 3;
    node.textContent = format(from + (value - from) * e);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------------------------------------------------------------- clocks (tick every second)

function renderClock() {
  if (!board) return;
  const lock = Date.parse(board.schedule.lockAt), final = Date.parse(board.schedule.finalAt), now = Date.now();
  const clock = $("#clock");
  const target = now < lock ? lock : final;
  const ms = Math.max(0, target - now);
  const d = Math.floor(ms / 86_400_000), h = Math.floor(ms / 3_600_000) % 24, m = Math.floor(ms / 60_000) % 60, s = Math.floor(ms / 1000) % 60;
  const title = $(".h-small");
  if (board.final) {
    title.textContent = "Final price S";
    clock.replaceChildren(document.createTextNode(`$${fmt(board.final.price)}`));
  } else if (ms === 0) {
    title.textContent = now < final ? "Locked · waiting for S" : "Waiting for the referee's final post";
    clock.replaceChildren(document.createTextNode("00:00:00"));
  } else {
    title.textContent = now < lock ? "Trading locks in" : "Locked · S is printed in";
    const parts = [[d, "d"], [pad2(h), "h"], [pad2(m), "m"]];
    const nodes = [];
    for (const [v, u] of parts) { if (u === "d" && !d) continue; nodes.push(document.createTextNode(String(v)), el("span", u, "u")); }
    const sec = el("span", pad2(s), `sec${REDUCED ? "" : " tick"}`);
    nodes.push(sec, el("span", "s", "u"));
    clock.replaceChildren(...nodes);
  }
  $("#heroSub").replaceChildren(
    document.createTextNode("Final price "), el("b", "S"),
    document.createTextNode(` is the last Hyperliquid xyz:NVDA trade before Sun 4 Oct 10:00 UTC${now < final && !board.final ? ` — ${Math.ceil((final - now) / 3_600_000)} hours from now` : ""}.`));

  // sweep ring: sweeps run every 5 minutes from 12:00 UTC on 25 Sep
  const period = board.schedule.sweepSeconds * 1000, zero = Date.parse(board.schedule.sweepZero);
  const into = (now - zero) % period, frac = into / period;
  $("#sweepArc").style.strokeDashoffset = String(326.7 * (1 - frac));
  const left = Math.max(0, Math.ceil((period - into) / 1000));
  $("#sweepNext").textContent = now < lock ? `next in ${Math.floor(left / 60)}:${pad2(left % 60)}` : "locked";
  const lockSweep = Math.round((lock - zero) / period);
  $("#sweepsLeft").textContent = int(Math.max(0, lockSweep - board.summary.sweep));
}

function buildSweepTicks() {
  const g = $("#sweepTicks");
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const x1 = 60 + Math.cos(a) * 44, y1 = 60 + Math.sin(a) * 44, x2 = 60 + Math.cos(a) * 38, y2 = 60 + Math.sin(a) * 38;
    g.append(svg("line", { x1, y1, x2, y2 }));
  }
}

// ---------------------------------------------------------------- sparklines

function spark(mount, values, color) {
  const vals = values.filter(Number.isFinite);
  if (vals.length < 2) { mount.replaceChildren(); return; }
  const W = 200, H = 40, min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 6)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none" });
  root.append(svg("path", { d: `${d}L${W},${H}L0,${H}Z`, class: "a", fill: color }), svg("path", { d, class: "l", stroke: color, "vector-effect": "non-scaling-stroke" }));
  const [lx, ly] = pts.at(-1);
  root.append(svg("circle", { cx: lx, cy: ly, r: 2.5, fill: color }));
  mount.replaceChildren(root);
}

// ---------------------------------------------------------------- hero, battle, prize

function renderHero(b) {
  const s = b.summary;
  const price = $("#hlPrice");
  animateTo(price, s.hl, (v) => `$${fmt(v)}`);
  if (lastHl !== null && s.hl !== lastHl && !REDUCED) {
    price.classList.remove("up", "down"); void price.offsetWidth;
    price.classList.add(s.hl > lastHl ? "up" : "down");
    setTimeout(() => price.classList.remove("up", "down"), 1800);
  }
  lastHl = s.hl;
  $("#markPrice").textContent = `$${fmt(s.mark)}`;
  $("#spread").textContent = signed(s.markDifference);
  $("#hlAge").textContent = `${fmt(s.priceAgeSeconds, 0)} s old at sweep`;
  const sweepNo = $("#sweepNo");
  if (sweepNo.textContent !== String(s.sweep)) { sweepNo.textContent = String(s.sweep); if (lastSweep !== null && !REDUCED) { sweepNo.classList.remove("bump"); void sweepNo.offsetWidth; sweepNo.classList.add("bump"); } }
  animateTo($("#ownersChip"), s.owners, compact);
  const t = b.trend;
  if (t.length >= 2) {
    const hours = (Date.parse(t.at(-1).ts) - Date.parse(t[0].ts)) / 3_600_000;
    const rate = hours > 0 ? (t.at(-1).owners - t[0].owners) / hours : NaN;
    animateTo($("#ownersRate"), rate, (v) => `+${compact(v)}`);
  }
}

function renderBattle(b) {
  const s = b.summary, total = s.longs + s.shorts, bullShare = total ? s.longs / total : 0.5;
  $("#tugBull").style.flexGrow = String(bullShare);
  $("#tugBear").style.flexGrow = String(1 - bullShare);
  $("#tugKnot").style.left = `${bullShare * 100}%`;
  animateTo($("#bullCount"), s.longs, int);
  animateTo($("#bearCount"), s.shorts, int);
  $("#bullPct").textContent = `${fmt(bullShare * 100, 1)}%`;
  $("#bearPct").textContent = `${fmt((1 - bullShare) * 100, 1)}%`;
  $("#tug").setAttribute("aria-label", `${int(s.longs)} keys long, ${int(s.shorts)} keys short`);
  const last = b.trend.at(-1);
  animateTo($("#oi"), s.openInterest ?? s.open, int);
  if (last) { animateTo($("#settled"), last.settled, int); animateTo($("#voided"), last.void, int); animateTo($("#minted"), last.mints, int); }
  const css = getComputedStyle(document.documentElement);
  spark($("#oiSpark"), b.trend.map((x) => x.openInterest), css.getPropertyValue("--accent").trim());
  spark($("#settledSpark"), b.trend.map((x) => x.settled), css.getPropertyValue("--bull").trim());
  spark($("#voidSpark"), b.trend.map((x) => x.void), css.getPropertyValue("--bear").trim());
  spark($("#mintSpark"), b.trend.map((x) => x.mints), css.getPropertyValue("--flop").trim());
  $("#oiNote").textContent = `${int(total)} of ${int(s.owners)} registered keys hold a position`;
}

function renderPodium(b) {
  const places = [1, 2, 3].map((p) => b.clusters.find((c) => c.start <= p && p <= c.end));
  const steps = places.map((cluster, i) => {
    const place = i + 1;
    const step = el("div", undefined, `step p${place} order-${place}`);
    if (!cluster) { step.append(el("div", "—", "who"), el("div", String(place), "block")); return step; }
    const who = cluster.size === 1 ? shortDid(cluster.rows[0].did) : `${cluster.openEnded ? "≥" : ""}${cluster.size} keys`;
    const whoNode = el("div", who, "who");
    if (cluster.size === 1) whoNode.title = cluster.rows[0].did;
    step.append(whoNode, el("div", fmt(cluster.score), "score"));
    if (cluster.size > 1) step.append(el("span", `share ${cluster.start}–${Math.min(cluster.end, 3)}${cluster.openEnded && cluster.end <= 3 ? "+" : ""}`, "tied"));
    step.append(el("div", String(place), "block"));
    return step;
  });
  $("#podium").replaceChildren(...steps);
}

// ---------------------------------------------------------------- standings

function copyButton(did) {
  const b = el("button", "copy", "copy");
  b.type = "button"; b.setAttribute("aria-label", `Copy ${did}`);
  b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(did); b.textContent = "copied"; } catch { b.textContent = "failed"; }
    setTimeout(() => { b.textContent = "copy"; }, 1400);
  });
  return b;
}
function didLabel(did) { const w = el("span", undefined, "did"); const t = el("span", shortDid(did)); t.title = did; w.append(t, copyButton(did)); return w; }
function moveCell(movement) {
  const td = el("td", undefined, "move");
  if (movement === null || movement === undefined) td.append(el("span", "", "mv-flat"));
  else if (movement === "new") td.append(el("span", "new", "mv-new"));
  else if (movement > 0) td.append(el("span", `▲${movement}`, "mv-up"));
  else if (movement < 0) td.append(el("span", `▼${-movement}`, "mv-down"));
  else td.append(el("span", "·", "mv-flat"));
  return td;
}
function estimateNode(row) {
  if (row.scoreAtHl === null) return null;
  const w = el("span", undefined, "estimate");
  w.append(el("span", fmt(row.scoreAtHl)), el("small", `pos ${signed(row.position)}`));
  return w;
}

function renderTable(b) {
  const table = el("table");
  const head = el("thead"), hr = el("tr");
  ["Place", "Δ", "Key", "Score · mark", "Est. at HL*"].forEach((t) => hr.append(el("th", t)));
  head.append(hr);
  const body = el("tbody");
  b.clusters.forEach((cluster, index) => {
    const tr = el("tr", undefined, `row${cluster.start <= 3 ? " top3" : ""}`);
    tr.style.animationDelay = REDUCED ? "0s" : `${Math.min(index, 12) * 45}ms`;
    const span = cluster.size > 1 || cluster.openEnded ? `${cluster.start}–${cluster.end}${cluster.openEnded ? "+" : ""}` : String(cluster.start);
    tr.append(el("td", span, "rank"));
    const moves = [...new Set(cluster.rows.map((r) => r.movement))];
    tr.append(moveCell(moves.length === 1 ? moves[0] : null));
    const key = el("td", undefined, "key");
    if (cluster.size === 1) key.append(didLabel(cluster.rows[0].did));
    else {
      const details = el("details"), summary = el("summary");
      summary.append(el("span", `${cluster.openEnded ? "≥" : ""}${cluster.size} keys tied`, "badge"), el("span", " share these places", "muted"));
      const list = el("ul", undefined, "tie-list");
      cluster.rows.forEach((row) => { const li = el("li"); li.append(didLabel(row.did)); const e = estimateNode(row); if (e) li.append(e); list.append(li); });
      if (cluster.openEnded) list.append(el("li", "The referee publishes 25 rows; more keys may share this score.", "muted"));
      details.append(summary, list); key.append(details);
    }
    tr.append(key, el("td", fmt(cluster.score), "score"));
    const est = el("td", undefined, "est");
    const known = cluster.rows.filter((r) => r.scoreAtHl !== null);
    if (cluster.size === 1 && known.length) est.append(estimateNode(known[0]));
    else if (known.length) est.append(el("span", `${known.length} of ${cluster.size} known`, "muted"));
    else { est.classList.add("none"); est.append(el("span", "—", "muted")); }
    tr.append(est);
    body.append(tr);
  });
  table.append(head, body);
  $("#tableMount").replaceChildren(table);
  const groups = b.clusters.filter((c) => c.size > 1);
  $("#tieNote").textContent = groups.length ? `${groups.length} tie group${groups.length > 1 ? "s" : ""} — identical scores usually mean keys that entered the same side in the same sweep.` : "";
  $("#standingsMeta").textContent = `sweep ${int(b.summary.sweep)}${b.previousSweep ? ` · vs ${int(b.previousSweep)}` : ""}`;
}

// ---------------------------------------------------------------- sweep tape

function renderTape(b) {
  const items = [...b.trend].reverse().map((t) => {
    const s = el("span");
    s.append(el("span", `#${int(t.n)}`, "n"), document.createTextNode("  owners "), el("b", compact(t.owners)),
      document.createTextNode("  ·  +"), el("b", int(t.mints)), document.createTextNode(" minted  ·  "),
      el("span", `${int(t.settled)} settled`, "g"), document.createTextNode("  ·  "), el("span", `${int(t.void)} void`, "r"),
      document.createTextNode(`  ·  ${int(t.longs)} L / ${int(t.shorts)} S`));
    return s;
  });
  if (!items.length) return;
  const track = $("#tape");
  track.replaceChildren(...items, ...items.map((x) => { const c = x.cloneNode(true); c.setAttribute("aria-hidden", "true"); return c; }));
  track.style.animationDuration = `${Math.max(30, items.length * 7)}s`;
}

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
let firstDraw = !REDUCED;
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
  const drawn = (d, cls) => { const p = svg("path", { d, class: firstDraw ? `${cls} draw` : cls }); return p; };
  const paths = [drawn(line(mark, yA), "s-mark"), drawn(line(hl, yA), "s-hl"), drawn(line(scores, yB), "s-top")];
  root.append(...paths);

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
  if (firstDraw) { paths.forEach((p) => p.style.setProperty("--len", Math.ceil(p.getTotalLength()))); firstDraw = false; }
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

// ---------------------------------------------------------------- health & verification

function renderHealth(b) {
  const h = b.flowHealth;
  const missed = h.missed.length ? h.missed.map(([room, a, c]) => `${room} ${int(a)}–${int(c)}`).join(", ") : "none";
  const pairs = [
    ["Referee lag after the sweep", `${fmt(h.sweepLagMs / 1000, 1)} s`],
    ["Rooms aligned on one sweep", b.aligned ? "yes" : "no — mid-update"],
    ["Mints not listed in the post", int(h.omitted.mints)],
    ["Settled trades not listed", int(h.omitted.settled)],
    ["Void trades not listed", int(h.omitted.void)],
    ["Missed room ranges", missed],
    ["Final message retained", h.retainedFinal ? "yes" : "not yet"],
  ];
  $("#health").replaceChildren(...pairs.flatMap(([k, v]) => [el("dt", k), el("dd", v)]));
  $("#caveats").replaceChildren(...b.caveats.map((x) => el("li", x)));
}

function renderVerification(b) {
  $("#verification").replaceChildren(...Object.entries(b.rooms).map(([room, x]) => {
    const card = el("article", undefined, "verify-card");
    const ok = el("div", undefined, "ok");
    const icon = svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }); icon.append(svg("path", { d: "M4 12.5l5 5L20 6.5" }));
    ok.append(icon, el("span", room.replace("d-close1-", "")));
    card.append(ok, el("span", `seq ${int(x.seq)} · sweep ${int(x.n)}`), el("span", x.file ? `file ${x.file.slice(0, 18)}…` : "no file hash"));
    card.title = x.file ?? "";
    return card;
  }));
}

// ---------------------------------------------------------------- refresh loop

async function refresh() {
  const status = $("#status"), live = $("#live");
  try {
    const res = await fetch("/api/board");
    const b = await res.json();
    if (!res.ok) throw new Error(b.detail ?? b.error);
    const newSweep = b.summary.sweep !== lastSweep;
    board = b;
    renderHero(b); renderBattle(b); renderPodium(b); renderHealth(b); renderVerification(b); renderClock();
    if (newSweep) {
      renderTable(b); renderTape(b);
      const h = await fetch("/api/history").then((r) => (r.ok ? r.json() : { history: [] })).catch(() => ({ history: [] }));
      renderChart(h.history ?? []);
      spark($("#hlSpark"), (h.history ?? []).map((x) => x.hl), getComputedStyle(document.documentElement).getPropertyValue("--s-hl").trim());
      const hist = h.history ?? [];
      if (hist.length >= 2) {
        const d = hist.at(-1).hl - hist[0].hl, node = $("#hlDelta");
        node.textContent = `${signed(d)} (${signed((d / hist[0].hl) * 100)}%) · ~${Math.round(hist.length / 12)}h`;
        node.className = `delta ${d >= 0 ? "up" : "down"}`;
      }
      $("#limits").textContent = "±5%";
      lastSweep = b.summary.sweep;
    }
    live.className = `live ${b.stale ? "stale" : "on"}`;
    live.querySelector("span").textContent = b.stale ? "stale" : "live";
    status.className = `status${b.stale ? " warn" : ""}`;
    status.textContent = b.stale
      ? "technocore.chat is not answering; showing the last verified snapshot."
      : `Verified referee snapshot · sweep ${int(b.summary.sweep)} · checked ${new Date(b.generatedAt).toLocaleTimeString()}`;
  } catch (error) {
    live.className = "live";
    live.querySelector("span").textContent = "offline";
    status.className = "status error";
    status.textContent = `No verified data right now: ${error.message}`;
  }
}

$("#lookupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const out = $("#lookupResult"), did = $("#did").value.trim();
  out.textContent = "Searching the retained referee posts…";
  try {
    const r = await fetch(`/api/key?did=${encodeURIComponent(did)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    if (!data.found) { out.replaceChildren(el("p", "Not in any retained top-25 score list or top-10 position list. That does not mean the key has no mint or position — the referee publishes only the top rows.")); return; }
    const table = el("table", undefined, "data"), hr = el("tr");
    ["Sweep", "Score · mark", "Position"].forEach((t) => hr.append(el("th", t)));
    const thead = el("thead"); thead.append(hr);
    const tbody = el("tbody");
    data.history.slice(-20).reverse().forEach((x) => { const tr = el("tr"); [int(x.n), fmt(x.score), x.position === null ? "—" : signed(x.position)].forEach((v) => tr.append(el("td", v))); tbody.append(tr); });
    table.append(thead, tbody);
    out.replaceChildren(el("p", `${data.history.length} retained sweep${data.history.length > 1 ? "s" : ""} list this key.`), table);
  } catch (error) { out.textContent = error.message; }
});

// reveal-on-scroll
const io = "IntersectionObserver" in window && !REDUCED ? new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.08 }) : null;
document.querySelectorAll(".reveal").forEach((n) => (io ? io.observe(n) : n.classList.add("in")));

buildSweepTicks();
setInterval(renderClock, 1000);
let resizeTimer = null;
new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => chartRows.length && renderChart(chartRows), 150); }).observe($("#chart"));
let poll = null;
function schedule() { clearInterval(poll); if (!document.hidden) poll = setInterval(refresh, 30_000); }
document.addEventListener("visibilitychange", () => { schedule(); if (!document.hidden) refresh(); });
refresh();
schedule();
