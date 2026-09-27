import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import { REFEREE_DID } from "./constants.js";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function decodeBase58(value) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError("invalid base58");
  let number = 0n;
  for (const char of value) {
    const digit = BASE58.indexOf(char);
    if (digit < 0) throw new TypeError("invalid base58 character");
    number = number * 58n + BigInt(digit);
  }
  const bytes = [];
  while (number > 0n) {
    bytes.push(Number(number & 255n));
    number >>= 8n;
  }
  bytes.reverse();
  let leading = 0;
  while (value[leading] === "1") leading += 1;
  return Buffer.concat([Buffer.alloc(leading), Buffer.from(bytes)]);
}

// Decoding the DID is BigInt base58 work; /api/history verifies ~400 messages per call,
// all from the same referee key, so the KeyObject is built once per DID.
const keys = new Map();

export function publicKeyFromDid(did) {
  if (keys.has(did)) return keys.get(did);
  const key = buildPublicKey(did);
  keys.set(did, key);
  return key;
}

function buildPublicKey(did) {
  if (typeof did !== "string" || !did.startsWith("did:key:z")) throw new TypeError("unsupported DID");
  const decoded = decodeBase58(did.slice("did:key:z".length));
  if (decoded.length !== 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new TypeError("not an Ed25519 did:key");
  }
  return createPublicKey({ key: Buffer.concat([SPKI_PREFIX, decoded.subarray(2)]), format: "der", type: "spki" });
}

export function decodeSignature(sig) {
  if (typeof sig !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(sig)) throw new TypeError("invalid signature encoding");
  const decoded = Buffer.from(sig, "base64url");
  if (decoded.length !== 64) throw new TypeError("invalid signature length");
  return decoded;
}

export function verifyMessage(room, message, expectedDid = REFEREE_DID) {
  if (!message || message.from !== expectedDid || typeof message.text !== "string") return false;
  if (typeof message.nonce !== "string" || !/^\d+$/.test(message.nonce)) return false;
  try {
    const signed = Buffer.from(`${room}|${message.nonce}|${message.text}`, "utf8");
    return cryptoVerify(null, signed, publicKeyFromDid(expectedDid), decodeSignature(message.sig));
  } catch {
    return false;
  }
}
