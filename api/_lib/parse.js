import { DID_RE, ROOMS } from "./constants.js";

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const numeric = (v) => finite(v) || numericString(v) !== null;
const asNumber = (v) => finite(v) ? v : numericString(v);
const integer = (v) => Number.isSafeInteger(v) && v >= 0;
const string = (v) => typeof v === "string";
const did = (v) => string(v) && DID_RE.test(v);
const pairList = (v, valueCheck) => Array.isArray(v) && v.every((x) => Array.isArray(x) && x.length === 2 && did(x[0]) && valueCheck(x[1]));

// Preserve every unquoted nonce token before JSON.parse can round it above 2^53.
export function parseRoomEnvelope(raw) {
  if (typeof raw !== "string") throw new TypeError("upstream response must be text");
  const safe = raw.replace(/("nonce"\s*:\s*)(-?\d+)/g, '$1"$2"');
  const value = JSON.parse(safe);
  if (!value || !ROOMS.includes(value.room) || !Array.isArray(value.messages)) throw new TypeError("invalid room envelope");
  value.messages = value.messages.filter((m) => m && integer(m.seq) && string(m.ts) && string(m.from) && string(m.text) && /^\d+$/.test(m.nonce) && string(m.sig));
  return value;
}

export function parsePayload(room, text) {
  let p;
  try { p = JSON.parse(text); } catch { return null; }
  if (!p || typeof p !== "object") return null;
  if (room === "d-close1-price" && p.t === "final") {
    return numeric(p.price) && p.trade && string(p.trade.time) && (string(p.trade.tid) || Number.isSafeInteger(p.trade.tid))
      ? { ...p, price: asNumber(p.price), trade: { ...p.trade, tid: String(p.trade.tid) } } : null;
  }
  if (!integer(p.n)) return null;
  if (room === "d-close1-price") {
    return p.t === "price" && p.ref && numeric(p.ref.px) && string(p.ref.time) && (string(p.ref.tid) || Number.isSafeInteger(p.ref.tid)) && numeric(p.age_s) && numeric(p.global) && Array.isArray(p.limits) && p.limits.length === 2 && p.limits.every(numeric) && string(p.file)
      ? { ...p, age_s: asNumber(p.age_s), applied: numeric(p.applied) ? asNumber(p.applied) : p.applied, global: asNumber(p.global), limits: p.limits.map(asNumber), ref: { ...p.ref, px: asNumber(p.ref.px), tid: String(p.ref.tid) } } : null;
  }
  if (room === "d-close1-state") return p.t === "state" && integer(p.owners) && integer(p.rooms) && string(p.root) && string(p.file) ? p : null;
  if (room === "d-close1-positions") return p.t === "positions" && integer(p.longs) && integer(p.shorts) && numeric(p.open) && pairList(p.top, string) && string(p.file) ? { ...p, open: asNumber(p.open) } : null;
  if (room === "d-close1-pnl") return p.t === "pnl" && numeric(p.mark) && pairList(p.top, string) && string(p.file) ? { ...p, mark: asNumber(p.mark) } : null;
  if (room === "d-close1-flow") {
    const validMissed = Array.isArray(p.missed) && p.missed.every((x) => Array.isArray(x) && x.length === 3 && string(x[0]) && integer(x[1]) && integer(x[2]));
    const validVoid = Array.isArray(p.void) && p.void.every((x) => Array.isArray(x) && x.length === 2 && string(x[0]) && string(x[1]));
    const omitted = p.omitted && ["mints", "settled", "void"].every((k) => integer(p.omitted[k]));
    return p.t === "flow" && Array.isArray(p.mints) && Array.isArray(p.settled) && validVoid && validMissed && omitted && Array.isArray(p.rooms) && Array.isArray(p.unlisted) && string(p.file) ? p : null;
  }
  return null;
}

export function numericString(value) {
  if (typeof value !== "string" || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
