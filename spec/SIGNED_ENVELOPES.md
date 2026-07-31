# Signed M1 Envelope 1.0

This document is normative for signed M1 transport envelopes.

## Scope

The envelope protects one of three payload types:

- `meaning-packet`
- `meaning-delta`
- `action-receipt`

It does not define a second UI schema. A verified `meaning-packet` compiles into JuanPage 2.0 and renders only through `renderPage`.

## Envelope

```json
{
  "protocolVersion": "1.0",
  "payloadType": "meaning-packet",
  "issuer": "agent:deployment",
  "audience": "juanpager:production",
  "issuedAt": "2026-07-31T21:00:00.000Z",
  "expiresAt": "2026-07-31T21:01:00.000Z",
  "nonce": "nonce:deployment:0001",
  "keyId": "key:2026-01",
  "algorithm": "Ed25519",
  "payloadDigest": "sha-256:BASE64URL",
  "payload": [],
  "delegation": [],
  "signature": "BASE64URL"
}
```

## Canonicalization

Objects are serialized recursively with lexicographically sorted property names, no insignificant whitespace, and standard JSON scalar encoding. Arrays retain order. Non-finite numbers, `undefined`, functions, symbols, and other non-JSON values are invalid.

`payloadDigest` is `sha-256:` followed by unpadded base64url of SHA-256 over the UTF-8 canonical payload.

The signature input is the UTF-8 canonical envelope with the `signature` property omitted. Envelope version 1.0 supports only Ed25519.

## Verification keys

A verifier resolves an exact `(issuer, keyId)` record containing the public key. The record may also define:

- `status`: `active` or `revoked`;
- `validFrom`: earliest accepted signing timestamp;
- `validUntil`: exclusive latest accepted signing timestamp;
- `capabilities`: operations authorized for direct-key use.

A revoked key must fail closed. The envelope `issuedAt` timestamp must fall inside the verification key's configured signing window.

When `requiredCapability` is configured and the envelope has no delegation chain, the direct verification key must explicitly contain that capability. When delegation is present, each relevant delegation must grant it.

Key discovery, identity proofing, trusted-set distribution, rotation, and revocation distribution are deployment responsibilities.

## Verification order

A conforming verifier must:

1. reject unsupported protocol versions and algorithms;
2. validate issuer, audience, nonce, key ID, digest, signature, and timestamp syntax;
3. require an exact audience match;
4. reject future issuance beyond configured skew;
5. reject expiration beyond configured skew;
6. reject non-positive lifetimes;
7. reject lifetimes beyond verifier policy; the SDK default maximum is five minutes;
8. recompute and compare the payload digest;
9. resolve an exact issuer/key ID pair;
10. reject revoked keys and signing timestamps outside the key validity window;
11. require a configured direct-key capability when no delegation chain is supplied;
12. verify the Ed25519 signature;
13. verify every supplied delegation and its required capability;
14. atomically consume the issuer-scoped nonce;
15. validate the enclosed M1 payload before use.

A failed check must not expose trusted invocation or navigation. Safe informational rendering may use an explicitly untrusted projection.

## Replay

Nonce uniqueness is scoped to issuer and retained until at least envelope expiration. Production implementations require durable, atomic storage shared by every verifier inside the same consistency boundary. Idempotency keys on deltas and receipts remain necessary because transport replay and operation replay are separate concerns.

`FileNonceStore` provides process- and restart-safe replay protection for one host or processes sharing an atomic filesystem. It is not a multi-region consensus mechanism. Distributed deployments need a transactional or strongly consistent insert-if-absent implementation of `NonceStore`.

Persisted replay state must fail closed when malformed or unavailable unless deployment policy explicitly chooses a safer unavailable mode that cannot grant execution.

## Delegation

Each delegation binds issuer, subject, audience, capabilities, issuance, expiration, key ID, algorithm, and signature. The final subject must equal the envelope issuer. Every audience must equal the envelope audience. When a verifier requires a capability, every relevant delegation must grant it. Envelope 1.0 has no online discovery, certificate authority, revocation distribution, or federation protocol.

## Unsigned data

Unsigned M1 may be shown as untrusted information. It is not invocation or navigation authority. Hosts may preserve safe local inspect, set, scope, select, and copy affordances while removing externally consequential affordances.
