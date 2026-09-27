import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseRoomEnvelope } from "../api/_lib/parse.js";

export async function fixture(room) {
  const path = fileURLToPath(new URL(`./fixtures/${room}.json`, import.meta.url));
  return parseRoomEnvelope(await readFile(path, "utf8"));
}

export async function fixtureResults(rooms, stale = false) {
  return Object.fromEntries(await Promise.all(rooms.map(async (room) => [room, { data: await fixture(room), stale, error: stale ? "fixture stale" : null }])));
}
