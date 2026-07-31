# ADR 0001: Signed M1 transport envelopes

- Status: Accepted
- Date: 2026-07-31

## Context

M1 already expresses semantic state, permissions, typed human deltas, and receipts, but those values were not cryptographically bound to an issuer, audience, lifetime, or replay boundary. Transport adapters could move data but could not establish whether executable authority was authentic.

## Decision

Wrap M1 packets, deltas, and action receipts in a versioned signed envelope. The envelope uses SHA-256 for a canonical payload digest and Ed25519 through Web Crypto for signatures. It includes issuer, audience, issuance, expiration, nonce, key ID, payload type, algorithm, payload, optional delegation, and signature.

Verification is explicit and dependency-injected: callers supply accepted issuer/key pairs, the expected audience, current time policy, an optional required delegated capability, and a nonce store. The core package provides only an in-memory nonce store for tests and demos.

Unsigned M1 remains valid for informational projection, but unsigned data is not executable authority. Hosts must prevent unsigned actions from crossing an execution boundary.

## Consequences

- Browser and Node runtimes share the Web Crypto implementation path.
- Canonical JSON is part of the cryptographic contract and must remain stable for protocol version 1.0.
- Production deployments must implement durable atomic nonce storage and key lifecycle management.
- Key discovery, revocation, confidentiality, and PKI are intentionally outside the protocol core.
- External adapter concepts remain outside M1 and JuanPage.
