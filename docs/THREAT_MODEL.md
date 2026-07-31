# JuanPager threat model

## Assets

- integrity of M1 packets, deltas, receipts, and JuanPage 2.0 documents;
- authorization decisions, key lifecycle, and capability constraints;
- stable symbolic identity across locales and adaptive presentations;
- idempotent execution and replay resistance;
- typed human facts, scopes, selections, and operation decisions;
- the one-schema, one-renderer architecture;
- private signing keys, trusted verification-key configuration, and persisted nonce state.

## Trust boundaries

1. A remote issuer creates an M1 payload.
2. A transport carries a signed or unsigned envelope.
3. The verifier checks cryptographic, key-lifecycle, capability, audience, temporal, and replay claims.
4. The trust/capability compiler projects M1 into a JuanPage 2.0 semantic graph.
5. `renderPage` creates trusted DOM and exposes only explicitly bound affordances.
6. A human interaction becomes a typed fact, scope, selection, or operation delta.
7. A host executes or rejects an operation and returns a receipt.

## Threats and controls

| Threat | Control | Residual risk |
|---|---|---|
| Payload tampering | SHA-256 payload digest plus Ed25519 signature over a canonical envelope | A compromised active private key remains authoritative until its verification key is revoked or removed |
| Wrong recipient or confused deputy | Exact audience matching and explicit required capabilities | Audience and capability naming remain deployment responsibilities |
| Revoked or obsolete key | Key status plus signing-time `validFrom` and `validUntil` enforcement | Trusted key-set distribution and revocation speed remain deployment responsibilities |
| Replay | Issuer-scoped atomic nonce consumption plus operation idempotency keys | Multi-region systems need a strongly consistent nonce implementation; a local filesystem cannot provide global consensus |
| Corrupt replay state | `FileNonceStore` fails closed on malformed persisted data and atomically replaces valid state | Operators must monitor storage health and restore only trustworthy replay state |
| Excessive or stale authorization window | Strict UTC timestamps, configurable skew, and a default five-minute maximum envelope lifetime | Compromised clocks and intentionally widened policy can extend acceptance |
| Unknown or downgraded algorithms | Closed algorithm union; envelope 1.0 supports Ed25519 only | Future algorithm migration requires a new reviewed protocol contract and conformance fixtures |
| Delegation escalation | Signed audience-bound chain; every relevant delegation must grant the required capability | No online discovery, certificate authority, or federation protocol |
| Unauthorized operation exposed by UI | Permission/capability filtering plus explicit JuanPage bindings; untrusted invocation and navigation are stripped | A malicious host can ignore the SDK; signed receipts improve auditability but cannot control a hostile executor |
| Decorative or misleading interaction | Information is inert without a valid semantic binding; browser tests verify keyboard and pointer behavior | Trusted renderer defects and deceptive display text remain possible |
| Locale changes identity or permission | Opaque symbols remain stable; vocabulary is display-only | Poor translations can mislead humans without granting authority |
| Agent-authored active content | No agent-authored HTML, CSS, JavaScript, arbitrary components, or alternate renderer | Trusted runtime and browser defects remain possible |
| Scope or selection confusion | Scope and selection use dedicated typed deltas and shared interaction state | A producer can still choose misleading semantic labels or inappropriate scope definitions |
| Delta race or stale mutation | Base/next revision validation and idempotency keys | Distributed conflict resolution belongs to the host |
| Receipt forgery | Receipts can use the same signed envelope mechanism | Trust still depends on configured executor keys and the executor's honesty |
| Denial of service | Schema limits, finite scalar validation, deterministic fuzzing, and performance budgets | Transports must also enforce byte, rate, concurrency, and decompression limits appropriate to deployment |
| Supply-chain substitution | Clean-room package consumer, package checksums, CycloneDX SBOM, and npm provenance configuration | Consumers must verify registry identity, provenance, and release artifacts |

## Non-goals

JuanPager does not encrypt transport data, discover real-world identities, operate a PKI, store production secrets, provide online revocation distribution, prove human intent, provide multi-region consensus, or guarantee that an external host executed an operation honestly. It provides verifiable messages, fail-closed trust projection, explicit semantic interaction, typed deltas, and receipts that hosts can audit.

## Security invariants

- M1 never becomes a component tree.
- JuanPage 2.0 remains the only public UI schema.
- `renderPage` remains the only renderer.
- Information remains inert without an explicit binding.
- Display vocabulary is never authorization data.
- Embeddings and latent vectors are never identity, permission, signature, or execution authority.
- Invocation and navigation fail closed; safe local inspection, editing, scoping, selection, and informational rendering may remain available.
- Unsupported, ambiguous, partially migrated, revoked, replayed, or malformed trust inputs are rejected rather than guessed.
