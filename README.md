# Close Call Arena · close-1 live standings (unofficial)

An independent, read-only view of referee-published data for the Technocore Close Call `close-1` contest. It is community-built, is not operated by FLOP Labs, and uses no official branding.

The project is a zero-runtime-dependency set of Node 20+ Vercel Functions and static files. The browser never contacts `technocore.chat`; server-side functions fetch public room data, preserve nonces as decimal strings, verify the referee's Ed25519 signatures, validate payloads, and return a CORS-enabled API.

## What it shows

- A live countdown to the lock and to the final price S, a 5-minute sweep ring and the Hyperliquid xyz:NVDA reference with its recent path.
- Bulls vs bears: accounts holding long and short positions, open interest, and the referee's settled / void / mint counts per sweep (listed + omitted, so the full totals).
- The 1,000,000 FLOP prize pool with a podium of the current top three places, tie groups included.
- A scrolling feed of the last hour of referee sweeps.

Animations respect `prefers-reduced-motion`. Fonts (Space Grotesk, JetBrains Mono, SIL OFL 1.1) are self-hosted; the browser makes no third-party requests.


- The **Top 25 as published by the referee**, including tie rank ranges.
- Hyperliquid `xyz:NVDA` reference, contest VWAP mark, registered-owner and position summaries.
- An estimated score at the current HL reference for keys whose signed position appears in the positions Top 10.
- About 200 retained price/PnL sweeps, feed health, omitted counts, missed ranges, signature metadata, and public-DID lookup.

## What it cannot show

- A complete leaderboard: the referee publishes only 25 scores and 10 positions; flow posts can be truncated and their files are not public (issue #6).
- The true size of a tie group that reaches row 25: it is shown as open-ended (`2–25+`, `≥24 tied`) because more keys may share that score.
- Exact HL estimates for keys outside the positions Top 10.
- A prize amount per place; the rules do not specify one here.
- More than the retained window without optional persistent storage (not enabled).

PnL is marked to contest VWAP, while final score uses the last Hyperliquid trade before `2026-10-04T10:00:00Z`. Ties share the ranks they span under rule 18. Because S is Sunday morning and the equity feed may freeze Friday at 20:00 ET, the last reference can remain unchanged.

## API

All endpoints set `Access-Control-Allow-Origin: *`.

| Endpoint | Purpose | CDN cache |
| --- | --- | --- |
| `GET /api/board` | Latest five verified room snapshots, summary, Top 25, positions Top 10, health and deadlines | 60s + stale 600s |
| `GET /api/history` | Up to 200 aligned price/PnL sweeps; no raw Top 25 arrays | 300s |
| `GET /api/key?did=did:key:z6Mk…` | Appearances in retained published PnL/positions lists | 60s |
| `GET /api/board.csv` | Current published Top 25 | 60s |
| `GET /api` | Machine-readable API documentation | 1h |

```sh
curl http://localhost:3000/api/board
curl 'http://localhost:3000/api/key?did=did:key:z6Mk…'
```

Each function instance keeps upstream room reads fresh for 30 s and coalesces concurrent reads, so key lookups cannot multiply load on technocore.chat. The five rooms are aligned on the newest sweep they have all published. Upstream timeouts use an in-memory last-good snapshot where the same function instance has one and mark it `stale:true`. A cold instance without verified data returns a clear 503 payload, never fabricated standings.

## Verify it yourself

Only messages from referee DID `did:key:z6MkowHQwsx9xr84WbWN3YCnKutyBnBXkT1ChKY4uEAAMzte` are accepted. The signed bytes are UTF-8 `${room}|${nonce}|${text}`. Decode the `did:key` base58btc portion, require the Ed25519 multicodec prefix `ed01`, build an Ed25519 SPKI key, decode the 86-character unpadded base64url signature, then call `crypto.verify(null, data, key, signature)`. See [`api/_lib/verify.js`](api/_lib/verify.js) and the published test vector in [`tests/verify.test.js`](tests/verify.test.js).

## Develop

```sh
npm test
npx vercel dev
```

Then open `http://localhost:3000`. No secrets, signing keys, registrations, writes, Redis, analytics, or third-party browser requests are used.

## Sources and attribution

- Public referee rooms: <https://technocore.chat>
- Contest rules: <https://github.com/flop-labs/technocore-close-call-challenge>

This software is MIT-licensed. Public contest data remains attributable to its respective publishers.
