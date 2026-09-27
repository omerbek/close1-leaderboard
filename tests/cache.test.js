import test from "node:test";
import assert from "node:assert/strict";
import { clearCacheForTests, fetchRoom } from "../api/_lib/technocore.js";
import { readFile } from "node:fs/promises";

const body = await readFile(new URL("./fixtures/d-close1-state.json", import.meta.url), "utf8");

test("concurrent and repeat reads inside the fresh window share one upstream call", async () => {
  clearCacheForTests();
  let calls = 0; let t = 0;
  const fetchImpl = async () => { calls += 1; await new Promise((r) => setTimeout(r, 5)); return { ok: true, text: async () => body }; };
  const opts = { limit: 200, fetchImpl, now: () => t };
  await Promise.all([fetchRoom("d-close1-state", opts), fetchRoom("d-close1-state", opts), fetchRoom("d-close1-state", opts)]);
  t = 29_000; await fetchRoom("d-close1-state", opts);
  assert.equal(calls, 1);
  t = 31_000; await fetchRoom("d-close1-state", opts);
  assert.equal(calls, 2);
});

test("an upstream failure after a good read serves the last good copy as stale", async () => {
  clearCacheForTests();
  let t = 0; let fail = false;
  const fetchImpl = async () => { if (fail) throw new Error("timeout"); return { ok: true, text: async () => body }; };
  await fetchRoom("d-close1-state", { fetchImpl, now: () => t });
  fail = true; t = 60_000;
  const second = await fetchRoom("d-close1-state", { fetchImpl, now: () => t });
  assert.equal(second.stale, true); assert.ok(second.data); assert.equal(second.error, "timeout");
});
