import test from "node:test";
import assert from "node:assert/strict";
import { parsePayload, parseRoomEnvelope } from "../api/_lib/parse.js";
import { fixture } from "./helpers.js";

const rooms = ["d-close1-price", "d-close1-flow", "d-close1-positions", "d-close1-pnl", "d-close1-state"];
for (const room of rooms) test(`parses and validates live ${room} fixture`, async () => {
  const envelope = await fixture(room);
  assert.equal(envelope.room, room);
  assert.ok(envelope.messages.length > 0);
  for (const message of envelope.messages) { assert.equal(typeof message.nonce, "string"); assert.ok(parsePayload(room, message.text)); }
});

test("preserves a nonce above Number.MAX_SAFE_INTEGER", () => {
  const raw = '{"room":"d-close1-state","messages":[{"seq":1,"ts":"2026-01-01T00:00:00Z","from":"x","text":"x","nonce":900719925474099312345,"sig":"x"}]}';
  assert.equal(parseRoomEnvelope(raw).messages[0].nonce, "900719925474099312345");
});

test("accepts a final price message without a sweep number", () => {
  const payload = parsePayload("d-close1-price", '{"t":"final","price":"225.42","trade":{"time":"2026-10-04T09:59:59Z","tid":12345}}');
  assert.equal(payload.price, 225.42);
  assert.equal(payload.trade.tid, "12345");
});
