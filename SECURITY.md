# Security policy

## Supported versions

Security fixes are provided for the latest release on the current supported line. Before the first npm publication, `main` is the only supported development line.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting for this repository. Include the affected commit or version, a minimal reproduction, impact, and any suggested mitigation. Maintainers will acknowledge a complete report within five business days and will coordinate disclosure after a fix is available.

## Trust guarantees

A successfully verified signed M1 envelope guarantees, within the limits below, that:

- the canonical payload bytes match the signed SHA-256 digest;
- the Ed25519 signature verifies under the selected issuer and key ID;
- the verification key is active and the signature timestamp falls inside its configured validity window;
- a requested direct-key capability is explicitly granted, or every delegation grants it;
- the audience matches the verifier's configured audience;
- issuance and expiration timestamps are valid under the configured clock skew;
- envelope lifetime does not exceed verifier policy; the default maximum is five minutes;
- the nonce was accepted exactly once by the supplied nonce store;
- every supplied delegation is signed, unexpired, audience-bound, and capability-constrained;
- executable operations still pass M1 permission and capability enforcement before reaching `renderPage`.

Unsigned packets may be materialized for informational display. Their invocation and navigation affordances are not trusted execution authority and hosts must strip them.

## Replay protection

`MemoryNonceStore` is intended for tests and single-process demonstrations. It does not survive a restart unless the host supplies its own persistence.

`FileNonceStore`, exported from `juanpager/node`, provides atomic persistent replay protection for one host or processes sharing a filesystem. It serializes access with an atomic lock directory, fails closed on corrupt state, prunes expired entries, and atomically replaces persisted state.

A shared filesystem is not a multi-region consensus system. Distributed deployments should implement the `NonceStore` interface using a transactional database or strongly consistent key-value store with an atomic insert-if-absent operation and expiration.

## Key lifecycle

A verification key may declare:

- `status: "active" | "revoked"`;
- `validFrom` and `validUntil` signing windows;
- explicit capability grants.

Revoked keys fail closed. A signature created before `validFrom` or at/after `validUntil` is rejected. Key provisioning, secure private-key storage, issuer identity proofing, rotation scheduling, and distribution of the trusted verification-key set remain deployment responsibilities.

## Limitations

Signatures provide integrity and configured-key authenticity, not confidentiality, identity discovery, online revocation discovery, or proof that an external executor acted honestly. M1 payloads remain visible to every transport intermediary that can read them. Do not place secrets in packets or URL fragments.

Delegation verifies an explicit signed chain; it does not perform certificate discovery or policy federation. A verifier must provide every trusted key and select the required capability.

JuanPager never treats labels, localized vocabulary, embeddings, latent vectors, display metadata, or UI structure as authorization data.

## Secure integration requirements

Production hosts should:

1. use a durable atomic nonce store appropriate to their consistency boundary;
2. keep private keys outside application bundles and source control;
3. rotate verification keys with explicit validity windows and revoke compromised keys immediately;
4. pin accepted audiences and required capabilities;
5. retain the default short envelope lifetime unless a reviewed workflow requires otherwise;
6. reject unknown algorithms, issuers, keys, versions, and partially migrated inputs;
7. log packet IDs, receipt IDs, mutation IDs, actors, and idempotency keys without logging secrets;
8. require HTTPS outside local development;
9. test backup, restore, corruption, replay, and key-compromise procedures;
10. treat external execution receipts as evidence to verify, not as unquestionable truth.
