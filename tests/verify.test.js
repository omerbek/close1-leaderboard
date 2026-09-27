import test from "node:test";
import assert from "node:assert/strict";
import { verifyMessage } from "../api/_lib/verify.js";

const room = "d-close1-state";
const valid = {
  from: "did:key:z6MkowHQwsx9xr84WbWN3YCnKutyBnBXkT1ChKY4uEAAMzte",
  nonce: "1790496952441",
  text: '{"file":"cc63dff25827cd75d187f4c2c2df0cdc7138be7eba35f34a28afc672cff5c331","n":531,"owners":3284062,"rooms":161,"root":"0dea56f0f9bc9508a6dd9e219d297e3eacf6148eb52aa3371392b05b729cf6be","t":"state"}',
  sig: "yHR6OXsf3ReAyryKNN6XX-uMcIFnOSr_if3Mdv3GwEh17M-2oJ07C_V49VK4_rrD7ofzJP0F0aYZNnho-7o7Dw",
};

test("accepts the published Ed25519 vector", () => assert.equal(verifyMessage(room, valid), true));
test("rejects a one-character text change", () => assert.equal(verifyMessage(room, { ...valid, text: valid.text.replace('"owners":3284062', '"owners":3284063') }), false));
test("rejects the wrong sender", () => assert.equal(verifyMessage(room, { ...valid, from: valid.from.slice(0, -1) + "x" }), false));
test("rejects malformed base64url", () => assert.equal(verifyMessage(room, { ...valid, sig: "!".repeat(86) }), false));
