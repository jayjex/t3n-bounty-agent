# T3N Agent Build Challenge — Submission Writeup

**Agent:** t3n-bounty-agent — Superteam Earn bounty triage on the Terminal 3 ADK
**Repo:** https://github.com/jayjex/t3n-bounty-agent
**Author:** Matchbook Labs (jayjex / goblin-grub)
**Date:** 2026-09-05

---

## 1. What the agent does

Scans the live [Superteam Earn](https://superteam.fun/earn) listings feed,
keeps only the bounties an AI agent is allowed to complete
(`agentAccess === "AGENT_ALLOWED"`), ranks them by deadline pressure, and
prints structured JSON with the authoring agent's `did:t3n` attached.

Built for enterprises that need a maintainable, stateless worker: one public
API endpoint in, one JSON document out, no database, no background jobs. The
T3N DID on every report is the identity hook a downstream system verifies
before acting on the output.

## 2. Architecture

```
src/
  index.ts          CLI entry — connects T3N session, runs the pipeline, prints JSON
  t3n-client.ts     T3N ADK connection (documented Quickstart path, mock + live)
  earn-scanner.ts   pagination, dedupe, AGENT_ALLOWED filter, priority scoring
  types.ts          EarnListing / TriagedBounty / ScanResult
  earn-scanner.test.ts   vitest suite (4 tests, no network)
```

T3N integration follows the official
[Quickstart](https://docs.terminal3.io/developers/adk/get-started/quickstart):
`setEnvironment("testnet")` → `eth_get_address(key)` → `T3nClient` with WASM
component and EthSign handler → `handshake()` → `authenticate()` → `did:t3n`.
The DID is attached to every output document.

## 3. Verified working run

Mock mode (no credentials required — same pipeline, local DID):

```
$ npm run agent
[t3n-bounty-agent] session mode=mock did=did:t3n:mock-local-agent env=testnet
{ "agent": "t3n-bounty-agent", "totalListings": 30, "agentEligible": 2, … }
```

Live handshake (random 32-byte test key, manifest check bypassed):

```
$ T3N_API_KEY=0x… npx tsx quickstart_unsafe.ts
Connected as: did:t3n:52fd9c5362aba96e3dda8dcc8110fa11f6edd072
```

This proves the SDK → handshake → authenticate path completes and mints a
`did:t3n`; the only thing `live` mode still needs is a provisioned key with
credits (see bugs below).

## 4. Bugs faced (full details in BUGS.md)

**Bug 1 — SDK 5.10.0 rejects the live testnet trust manifest.**
`SignedTrustManifest` requires `rtmr1_allowlist: string[]`, but the manifest
published at `cn-api.sg.testnet.t3n.terminal3.io/api/trust-manifest` only
carries `rtmr3_allowlist`. `isSignedTrustManifest()` fails before signature
verification, so every authenticated testnet call dies with
`Trust manifest … is malformed`. Workaround shipped in this repo:
`trustAnchor: { unsafe_trust_server: true }` (the SDK's own escape hatch).
Suggested fix: publish `rtmr1_allowlist` on the cluster (bump manifest
version) or relax the SDK guard for backward compatibility.

**Bug 2 — Claim page blocks the documented work-email path.**
[Request test tokens](https://docs.terminal3.io/developers/adk/get-started/prerequisites/request-test-tokens)
says sign in with a work email and the key is issued instantly. In reality the
form is gated on an invisible reCAPTCHA v2 whose token never populates without
Google Identity Services, so without a Google account the button stays
disabled (`formValid: true`, `grecaptchaResponse: ""`, `btnDisabled: true`
verified in a headed Chromium). Suggested fix: server-side reCAPTCHA scoring
for the email path, or update the docs to say Google required.

## 5. Judging criteria mapping

| criterion | this submission |
|---|---|
| time to submit | early in the 11-day window |
| build quality | real data end-to-end, 4 passing tests, dedupe + error handling, priority ranking |
| usefulness | exactly the triage step an agent ops team needs before committing credits to a bounty |
| ease to maintain | one upstream endpoint, one file to patch if it changes; stateless pure function |
| documentation | this doc, repo README, BUGS.md with repro + root cause + suggested fix |
| bug submission quality | 2 bugs with root cause, repro, impact, and suggested fix each |

## 6. Handover preference

Happy to keep running it — it is stateless and costs nothing (mock mode needs
no T3N credits; live mode a few credits per report). If the sponsor prefers to
host it, handover is a single-node deploy: `npm install && npm run agent`,
crontab optional. No secrets beyond an optional `T3N_API_KEY` env var.

*Note: a Google Doc was not possible from this environment (no Google account
available — see Bug 2). This document plus the repo README carries the same
content; the writeup is also mirrored as a public gist linked in the Earn
submission.*
