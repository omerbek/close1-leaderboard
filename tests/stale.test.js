import test from "node:test";
import assert from "node:assert/strict";
import { loadBoard, resetBoardCacheForTests } from "../api/board.js";
import { ROOMS } from "../api/_lib/constants.js";
import { fixtureResults } from "./helpers.js";

test("returns last good board with stale:true after upstream failure", async () => {
  resetBoardCacheForTests();
  const good = await fixtureResults(ROOMS);
  const first = await loadBoard(async (room)=>good[room], new Date("2026-09-27T10:00:00Z"));
  assert.equal(first.stale, false);
  const second = await loadBoard(async ()=>({ data:null,stale:true,error:"timeout" }), new Date("2026-09-27T10:01:00Z"));
  assert.equal(second.stale, true);
  assert.equal(second.summary.sweep, first.summary.sweep);
  assert.match(second.upstreamErrors.at(-1), /No verified data/);
});
