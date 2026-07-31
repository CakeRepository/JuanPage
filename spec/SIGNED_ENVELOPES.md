# Signed M1 Envelope 1.0

This document is normative for signed M1 transport envelopes.

## Scope

The envelope protects one of three payload types:

- `meaning-packet`
- `meaning-delta`
- `action-receipt`

It does not define a second UI schema. A verified `meaning-packet` still compiles into JuanPage 1.0 and renders only through `renderPage`.

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

The signature input is the UTF-8 canonical envelope with the `signature` property omitted. Version 1.0 supports only Ed25519.

## Verification order

A conforming verifier must:

1. reject unsupported protocol versions and algorithms;
2. validate issuer, audience, nonce, key ID, digest, signature, and timestamp syntax;
3. require an exact audience match;
4. reject future issuance beyond configured skew;
5. reject expiration beyond configured skew;
6. reject non-positive lifetimes;
7. recompute and compare the payload digest;
8. resolve an exact issuer/key ID pair;
9. verify the Ed25519 signature;
10. verify every supplied delegation;
11. atomically consume the issuer-scoped nonce;
12. validate the enclosed M1 payload before use.

A failed check must not expose executable actions. Safe informational rendering may use an explicitly untrusted projection.

## Replay

Nonce uniqueness is scoped to issuer and retained until at least envelope expiration. Production implementations require durable, atomic storage shared by all verifier replicas. Idempotency keys on deltas and receipts remain necessary because transport replay and operation replay are separate concerns.

## Delegation

Each delegation binds issuer, subject, audience, capabilities, issuance, expiration, key ID, algorithm, and signature. The final subject must equal the envelope issuer. Every audience must equal the envelope audience. When a verifier requires a capability, every relevant delegation must grant it. Version 1.0 has no online discovery or revocation protocol.

## Unsigned data

Unsigned M1 may be shown as untrusted information. It is not execution authority. Hosts must remove or disable actions before presenting an unsigned packet as interactive UI.
