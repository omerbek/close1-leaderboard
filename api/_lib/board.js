import { FINAL_AT, LOCK_AT, ROOMS, SWEEP_MS, SWEEP_ZERO_MS } from "./constants.js";
import { numericString, parsePayload } from "./parse.js";
import { verifyMessage } from "./verify.js";

export function sweepTime(n) { return new Date(SWEEP_ZERO_MS + n * SWEEP_MS); }
export function sweepLagMs(n, ts) { return Date.parse(ts) - sweepTime(n).getTime(); }

export function verifiedMessages(room, envelope, accept = () => true) {
  if (!envelope) return [];
  return [...envelope.messages]
    .sort((a, b) => b.seq - a.seq)
    .map((message) => ({ message, payload: parsePayload(room, message.text) }))
    .filter(({ message, payload }) => payload && accept(payload) && verifyMessage(room, message));
}

export function latestVerified(room, envelope, accept = () => true) {
  return verifiedMessages(room, envelope, accept)[0] ?? null;
}

// The referee posts its five rooms one after another, a fraction of a second apart. A read
// that lands between those posts sees sweep n+1 in some rooms and n in others, and mixing
// them would put a new HL price next to an old mark and old positions. Pick the newest sweep
// every room has published; fall back to each room's latest only when no sweep is common.
export function alignSweeps(candidates) {
  const rooms = Object.keys(candidates);
  const sweeps = rooms.map((room) => new Set(candidates[room].map((x) => x.payload.n)));
  const common = [...sweeps[0]].filter((n) => sweeps.every((set) => set.has(n))).sort((a, b) => b - a)[0];
  const chosen = {};
  for (const room of rooms) chosen[room] = common === undefined ? candidates[room][0] : candidates[room].find((x) => x.payload.n === common);
  return { chosen, aligned: common !== undefined, sweep: common ?? null };
}

// Ties share the places they span (rule 18). The referee publishes 25 rows, so a group that
// reaches row 25 may continue beyond it: its size is a lower bound and its span open-ended.
export function tieRanks(entries, published = 25) {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const result = [];
  const clusters = [];
  for (let i = 0; i < sorted.length;) {
    let end = i + 1;
    while (end < sorted.length && sorted[end].score === sorted[i].score) end += 1;
    const size = end - i;
    const openEnded = end === sorted.length && sorted.length >= published;
    const span = size > 1 || openEnded ? `${i + 1}–${end}${openEnded ? "+" : ""}` : `${i + 1}`;
    const rank = size > 1 ? `${span} (${openEnded ? "≥" : ""}${size} tied)` : span;
    clusters.push({ start: i + 1, end, size, openEnded, score: sorted[i].score, rank, dids: sorted.slice(i, end).map((x) => x.did) });
    for (let j = i; j < end; j += 1) result.push({ ...sorted[j], rank, tieSize: size, tieOpenEnded: openEnded, tieStart: j === i });
    i = end;
  }
  return Object.assign(result, { clusters });
}

export function estimateAtHl(score, position, hl, mark) { return score + position * (hl - mark); }

const PUBLISHED_TOP = 25;

export function buildBoard(roomResults, now = new Date()) {
  let stale = false;
  const errors = [];
  const candidates = {};
  for (const room of ROOMS) {
    const result = roomResults[room];
    stale ||= Boolean(result?.stale);
    if (result?.error) errors.push(`${room}: ${result.error}`);
    candidates[room] = verifiedMessages(room, result?.data, room === "d-close1-price" ? (payload) => payload.t === "price" : undefined);
  }
  const missing = ROOMS.filter((room) => !candidates[room].length);
  if (missing.length) throw Object.assign(new Error(`No verified data for: ${missing.join(", ")}`), { statusCode: 503 });
  const { chosen: latest, aligned } = alignSweeps(candidates);
  const price = latest["d-close1-price"].payload;
  const state = latest["d-close1-state"].payload;
  const positions = latest["d-close1-positions"].payload;
  const pnl = latest["d-close1-pnl"].payload;
  const flow = latest["d-close1-flow"].payload;
  const final = latestVerified("d-close1-price", roomResults["d-close1-price"]?.data, (payload) => payload.t === "final");
  const positionMap = new Map(positions.top.map(([key, qty]) => [key, numericString(qty)]));
  const top = pnl.top.map(([key, rawScore]) => ({ did: key, score: numericString(rawScore) })).filter((x) => x.score !== null);
  const ranked = tieRanks(top, PUBLISHED_TOP);
  const withEstimate = (row) => {
    const position = positionMap.get(row.did) ?? null;
    return { ...row, position, scoreAtHl: position === null ? null : estimateAtHl(row.score, position, price.ref.px, pnl.mark), estimate: position !== null };
  };
  // Movement against the referee's previous published list: a positive number moved up.
  const previous = candidates["d-close1-pnl"].find((x) => x.payload.n < pnl.n);
  const previousStart = new Map();
  if (previous) {
    const prevTop = previous.payload.top.map(([key, raw]) => ({ did: key, score: numericString(raw) })).filter((x) => x.score !== null);
    for (const cluster of tieRanks(prevTop, PUBLISHED_TOP).clusters) for (const did of cluster.dids) previousStart.set(did, cluster.start);
  }
  const startOf = new Map(ranked.clusters.flatMap((c) => c.dids.map((did) => [did, c.start])));
  const movementOf = (did) => (!previous ? null : previousStart.has(did) ? previousStart.get(did) - startOf.get(did) : "new");
  const top25 = ranked.map((row) => ({ ...withEstimate(row), movement: movementOf(row.did) }));
  const rooms = {};
  for (const room of ROOMS) {
    const { message, payload } = latest[room];
    rooms[room] = { verified: true, seq: message.seq, ts: message.ts, n: payload.n, file: payload.file ?? null, type: payload.t };
  }
  const newestTs = Math.max(...Object.values(rooms).map((x) => Date.parse(x.ts)));
  return {
    generatedAt: now.toISOString(), stale, aligned, upstreamErrors: errors, sourceLag: Math.max(0, now.getTime() - newestTs),
    schedule: { lockAt: LOCK_AT, finalAt: FINAL_AT, sweepZero: new Date(SWEEP_ZERO_MS).toISOString(), sweepSeconds: SWEEP_MS / 1000 },
    rooms,
    summary: {
      sweep: price.n, hl: price.ref.px, hlTime: price.ref.time, priceAgeSeconds: price.age_s, mark: pnl.mark,
      markDifference: price.ref.px - pnl.mark, owners: state.owners, longs: positions.longs, shorts: positions.shorts,
      // `open` is the sum of open contracts across accounts, not a dollar notional.
      openInterest: positions.open, open: positions.open,
    },
    top25,
    clusters: ranked.clusters.map((c) => ({ ...c, rows: c.dids.map((did) => top25.find((r) => r.did === did)) })).map(({ dids, ...c }) => c),
    previousSweep: previous ? previous.payload.n : null,
    trend: trendFrom(candidates),
    positionsTop10: positions.top.map(([key, qty]) => ({ did: key, position: numericString(qty) })).filter((x) => x.position !== null),
    final: final ? { verified: true, seq: final.message.seq, ts: final.message.ts, price: final.payload.price, trade: final.payload.trade } : null,
    flowHealth: { omitted: flow.omitted, missed: flow.missed, sweepLagMs: sweepLagMs(flow.n, latest["d-close1-flow"].message.ts), retainedFinal: Boolean(final) },
    caveats: [
      "Top 25 as published by the referee; this is not a complete leaderboard. A tie group that reaches row 25 may continue beyond it.",
      "PnL uses the contest VWAP mark. Final scoring uses the last Hyperliquid xyz:NVDA trade before S.",
      "HL values are estimates only when the key appears in the published positions top 10.",
      "Ties share the ranks they span under rule 18. Prize per place is not specified here.",
      "The equity price feed may be frozen after Friday 20:00 ET before the Sunday final observation.",
    ],
  };
}

// One row per sweep that state, flow and positions all published, oldest first. Flow counts
// add back the `omitted` totals, so they are the referee's full counts, not the listed subset.
export function trendFrom(candidates) {
  const byN = (room) => new Map(candidates[room].map((x) => [x.payload.n, x]));
  const state = byN("d-close1-state"), flow = byN("d-close1-flow"), positions = byN("d-close1-positions");
  return [...state.keys()].filter((n) => flow.has(n) && positions.has(n)).sort((a, b) => a - b).map((n) => {
    const f = flow.get(n).payload, p = positions.get(n).payload;
    return {
      n, ts: flow.get(n).message.ts, owners: state.get(n).payload.owners,
      mints: f.mints.length + f.omitted.mints, settled: f.settled.length + f.omitted.settled, void: f.void.length + f.omitted.void,
      longs: p.longs, shorts: p.shorts, openInterest: p.open,
    };
  });
}

export function historyFrom(roomResults) {
  const collect = (room) => (roomResults[room]?.data?.messages ?? []).map((message) => {
    const payload = parsePayload(room, message.text);
    return payload && verifyMessage(room, message) ? { message, payload } : null;
  }).filter(Boolean);
  const prices = new Map(collect("d-close1-price").filter((x) => x.payload.t === "price").map((x) => [x.payload.n, x]));
  return collect("d-close1-pnl").map(({ message, payload }) => {
    const price = prices.get(payload.n)?.payload;
    const scores = payload.top.map((x) => numericString(x[1])).filter((x) => x !== null);
    const first = scores[0] ?? null;
    return { n: payload.n, ts: message.ts, hl: price?.ref.px ?? null, mark: payload.mark, top1: first, topClusterSize: first === null ? 0 : scores.filter((x) => x === first).length };
  }).filter((x) => x.hl !== null).sort((a, b) => a.n - b.n);
}

export function keyHistory(did, roomResults) {
  const output = new Map();
  for (const room of ["d-close1-pnl", "d-close1-positions"]) {
    for (const message of roomResults[room]?.data?.messages ?? []) {
      const payload = parsePayload(room, message.text);
      if (!payload || !verifyMessage(room, message)) continue;
      const found = payload.top.find(([key]) => key === did);
      if (!found) continue;
      const row = output.get(payload.n) ?? { n: payload.n, ts: message.ts, score: null, position: null };
      if (room.endsWith("pnl")) row.score = numericString(found[1]); else row.position = numericString(found[1]);
      output.set(payload.n, row);
    }
  }
  return [...output.values()].sort((a, b) => a.n - b.n);
}
