# JuanPager threat model

## Assets

- integrity of M1 packets, deltas, and receipts;
- authorization decisions and capability constraints;
- stable symbolic identity across locales and renderers;
- idempotent execution and replay resistance;
- the one-schema, one-renderer architecture;
- private signing keys and trusted public-key configuration.

## Trust boundaries

1. A remote issuer creates an M1 payload.
2. A transport carries a signed or unsigned envelope.
3. The verifier checks cryptographic and temporal claims.
4. The trust/capability compiler projects M1 into JuanPage 1.0.
5. `renderPage` displays trusted DOM created by repository code.
6. A human action becomes a typed delta.
7. A host executes or rejects the operation and returns a receipt.

## Threats and controls

| Threat | Control | Residual risk |
|---|---|---|
| Payload tampering | SHA-256 payload digest plus Ed25519 signature over a canonical envelope | Compromised private key remains authoritative until removed from the verifier |
| Wrong recipient or confused deputy | Exact audience matching | Audience naming and provisioning are deployment responsibilities |
| Replay | Issuer-scoped nonce store plus idempotency keys | In-memory nonce storage does not survive process restart or coordinate across replicas |
| Expired or future claims | Strict RFC 3339 UTC parsing, expiration, issuance, and configurable skew | Compromised system clocks can affect decisions |
| Unknown or downgraded algorithms | Closed algorithm union; Ed25519 only | Future algorithm migration requires a protocol version and conformance update |
| Delegation escalation | Signed audience-bound chain and required capability check | No online revocation or federation discovery |
| Unauthorized action exposed by UI | Permission and capability filtering before JuanPage actions reach `renderPage` | A malicious host can ignore the SDK; protocol receipts make this auditable but cannot control a hostile executor |
| Locale changes identity or permission | Opaque symbols remain stable; vocabulary is display-only | Poor translations can mislead humans without granting authority |
| Agent-authored active content | No agent-authored HTML, CSS, JavaScript, arbitrary components, or alternate renderer | Trusted renderer bugs remain possible |
| Delta race or stale mutation | Base/next revision validation and idempotency key | Distributed conflict resolution belongs to the host |
| Receipt forgery | Receipts can use the same signed envelope mechanism | Trust still depends on configured executor keys |
| Denial of service | Schema limits, finite scalar validation, and bounded host policies | Repository currently has no universal packet-byte limit; transports should enforce one |

## Non-goals

JuanPager does not encrypt transport data, discover identities, operate a PKI, store production secrets, perform online revocation, prove human intent, or guarantee that an external host executed an action honestly. It provides verifiable messages, fail-closed UI authorization, typed deltas, and receipts that hosts can audit.

## Security invariants

- M1 never becomes a component tree.
- JuanPage 1.0 remains the only public UI schema.
- `renderPage` remains the only renderer.
- Display vocabulary is never authorization data.
- Embeddings and latent vectors are never identity, permission, signature, or execution authority.
- Executable actions fail closed; safe informational rendering may remain available.
