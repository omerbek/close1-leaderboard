import test from "node:test";
import assert from "node:assert/strict";
import { alignSweeps, estimateAtHl, sweepLagMs, sweepTime, tieRanks } from "../api/_lib/board.js";

test("groups ties and spans their ranks", () => {
  const scores = [88.11,88.11,88.11,88.11,81.33,75.53,75.53,75.53,75.53].map((score,i)=>({ did:`key${i}`,score }));
  assert.deepEqual(tieRanks(scores).map(x=>x.rank), ["1–4 (4 tied)","1–4 (4 tied)","1–4 (4 tied)","1–4 (4 tied)","5","6–9 (4 tied)","6–9 (4 tied)","6–9 (4 tied)","6–9 (4 tied)"]);
});

test("estimates score at Hyperliquid from signed position", () => assert.equal(estimateAtHl(10_000, 4, 230, 225), 10_020));
test("computes planned sweep time and referee lag", () => {
  assert.equal(sweepTime(1).toISOString(), "2026-09-25T12:05:00.000Z");
  assert.equal(sweepLagMs(1, "2026-09-25T12:05:07.500Z"), 7500);
});

test("a tie group that reaches the 25th published row is open-ended", () => {
  const scores = [105.33, ...Array(24).fill(81.02)].map((score, i) => ({ did: `k${i}`, score }));
  const ranked = tieRanks(scores);
  assert.equal(ranked[0].rank, "1");
  assert.equal(ranked[1].rank, "2–25+ (≥24 tied)");
  assert.equal(ranked.clusters.length, 2);
  assert.equal(ranked.clusters[1].openEnded, true);
});

test("a lone 25th row is still open-ended: the 26th may share its score", () => {
  const scores = Array.from({ length: 25 }, (_, i) => ({ did: `k${i}`, score: 100 - i }));
  assert.equal(tieRanks(scores).at(-1).rank, "25–25+");
});

test("rows are ranked by score even if the published order is not sorted", () => {
  const ranked = tieRanks([{ did: "a", score: 1 }, { did: "b", score: 3 }, { did: "c", score: 2 }]);
  assert.deepEqual(ranked.map((x) => x.did), ["b", "c", "a"]);
});

test("rooms are aligned on the newest sweep all five have published", () => {
  const c = (...ns) => ns.map((n) => ({ payload: { n } }));
  const { chosen, aligned, sweep } = alignSweeps({ price: c(532, 531), pnl: c(531, 530), flow: c(532, 531) });
  assert.equal(aligned, true); assert.equal(sweep, 531);
  assert.equal(chosen.price.payload.n, 531); assert.equal(chosen.pnl.payload.n, 531);
  assert.equal(alignSweeps({ a: c(9), b: c(7) }).aligned, false);
});
