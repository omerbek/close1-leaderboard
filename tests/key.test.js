import test from "node:test";
import assert from "node:assert/strict";
import { loadKey, NOT_FOUND_NOTE } from "../api/key.js";
import { fixtureResults } from "./helpers.js";

test("rejects invalid DID before fetching", async () => {
  let called=false; const result=await loadKey("not-a-did",async()=>{called=true;});
  assert.equal(result.status,400); assert.equal(called,false);
});

test("explains that absence from top lists proves neither mint nor position", async () => {
  const rooms=["d-close1-pnl","d-close1-positions"]; const results=await fixtureResults(rooms);
  const did="did:key:z6Mk11111111111111111111111111111111111111111111";
  const result=await loadKey(did,async(room)=>results[room]);
  assert.equal(result.status,200); assert.equal(result.body.found,false); assert.equal(result.body.note,NOT_FOUND_NOTE);
});
