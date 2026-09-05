# Bugs found while building on the T3N ADK (SDK 5.10.0, testnet, 2026-09-05)

## Bug 1 — SDK rejects the live testnet trust manifest: `rtmr1_allowlist` missing

**Repro**

```bash
npm install @terminal3/t3n-sdk   # 5.10.0
T3N_API_KEY=0x<32-byte key> npx tsx quickstart.ts
# (quickstart.ts = the exact snippet from docs.terminal3.io Quickstart)
```

**Result**

```
Error: Trust manifest at https://cn-api.sg.testnet.t3n.terminal3.io/api/trust-manifest is malformed.
```

**Root cause**

The manifest the testnet cluster publishes has these fields:

```json
{ "cluster": "testnet", "version": 1787800421, "peer_ids": ["Qm…","Qm…","Qm…"],
  "rtmr3_allowlist": ["+XO6nLsf…"], "signed_at": "2026-08-27T03:13:41Z",
  "signature": "387384a9…" }
```

But `SignedTrustManifest` in the SDK's `index.d.ts` declares
`rtmr1_allowlist: string[]` as required, and `isSignedTrustManifest()` (in
`dist/index.esm.js`) checks for three string arrays: `peer_ids`,
`rtmr3_allowlist`, **and** `rtmr1_allowlist`. The manifest only carries two, so
the type guard fails and the manifest is rejected as "malformed" before
signature verification even runs.

This matches the listing comment "the latest ADK version hasn't been compatible
with testnet" — SDK and cluster are version-skewed on the manifest schema.

**Impact**

Every authenticated call on testnet fails at `fetchTrustedManifest`, so the
documented Quickstart cannot complete on SDK 5.10.0 against testnet.

**Workaround**

The SDK ships an explicit escape hatch, `UnsafeTrustServer`:

```ts
const t3n = new T3nClient({
  trustAnchor: { unsafe_trust_server: true },
  // …
});
```

With this, the handshake succeeds and `authenticate()` returns a real DID
(verified: `did:t3n:52fd9c5362aba96e3dda8dcc8110fa11f6edd072` with a random
test key). It skips attestation verification, which is acceptable for a
sandbox agent but should not be needed at all once the cluster publishes the
`rtmr1_allowlist` the SDK expects.

**Suggested fix**

Either publish `rtmr1_allowlist` in the testnet manifest (bump `version`) or
relax the SDK guard to accept manifests without it for backward compatibility.

---

## Bug 2 — Claim page: work-email path cannot be completed

**Context**

[Request test tokens](https://docs.terminal3.io/developers/adk/get-started/prerequisites/request-test-tokens)
says: *"Sign in with your work email and your developer key plus test credits
are issued instantly"* — no approval, no waitlist.

**What actually happens on https://www.terminal3.io/claim-page**

1. The form (first/last name, email, industry, role, campaign code) is
   disabled end-to-end by an **invisible reCAPTCHA v2** (`size=invisible`,
   site key `6Lc5RIwnAAAAAJ6C7Xqn0E04dnv_keFw0oTrLgSs`).
2. The submit button's `disabled` state is bound to the reCAPTCHA token, which
   never populates in a non-interactive browser context — the token stays
   `""` after `grecaptcha.execute()` completes.
3. The page also loads **Google Identity Services** (`GoogleGSIScript`) and
   renders a "Login with Google" button, which is the only path that reliably
   mints a key. Without a Google account the email form is a dead end.
4. Verified with a fully filled, valid form in a real (headed) Chromium:
   `formValid: true`, `grecaptchaResponse: ""`, `btnDisabled: true`.

**Impact**

A developer without a Google account cannot self-serve a DID + developer key,
contradicting the docs. This is also noted by other builders in the listing
comments ("claim page is Google-only SSO despite docs saying work email").

**Suggested fix**

Make the email path actually submit (server-side reCAPTCHA verification with a
score threshold, or a visible v2 checkbox) or update the docs to say Google
account required.

---

## What still works

- `T3nClient` handshake + `authenticate()` complete when the manifest check is
  bypassed (`unsafe_trust_server: true`), minting a `did:t3n`.
- The full agent pipeline (scan → filter → triage → structured JSON) runs
  end-to-end against the live Superteam Earn API with real data.
