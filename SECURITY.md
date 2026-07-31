# Security policy

## Supported versions

Security fixes are provided for the latest minor release on the current major line. Before the first npm publication, `main` is the only supported development line.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting for this repository. Include the affected commit or version, a minimal reproduction, impact, and any suggested mitigation. Maintainers will acknowledge a complete report within five business days and will coordinate disclosure after a fix is available.

## Trust guarantees

A successfully verified signed M1 envelope guarantees, within the limits below, that:

- the canonical payload bytes match the signed SHA-256 digest;
- the Ed25519 signature verifies under the selected issuer and key ID;
- the audience matches the verifier's configured audience;
- issuance and expiration timestamps are valid under the configured clock skew;
- the nonce was accepted exactly once by the supplied nonce store;
- every supplied delegation is signed, unexpired, audience-bound, and capability-constrained;
- executable actions still pass M1 permission and capability enforcement before reaching `renderPage`.

Unsigned packets may be materialized for informational display. Their actions are not trusted execution authority and hosts must strip or disable executable actions.

## Limitations

JuanPager does not establish the real-world identity of an issuer. Key provisioning, rotation, revocation, secure storage, clock integrity, and the durability/atomicity of a production nonce store are deployment responsibilities. `MemoryNonceStore` is suitable for tests and single-process demos only. It does not prevent replay across processes or restarts.

Signatures provide integrity and authenticity, not confidentiality. M1 payloads remain visible to every transport intermediary that can read them. Do not place secrets in packets or URL fragments.

Delegation verifies an explicit signed chain; it does not perform certificate discovery, online revocation, or policy federation. A verifier must provide every trusted key and select the required capability.

JuanPager never treats labels, localized vocabulary, embeddings, latent vectors, display metadata, or UI structure as authorization data.

## Secure integration requirements

Production hosts should use a persistent atomic nonce store, keep private keys outside application bundles, rotate keys with overlapping verification windows, pin accepted audiences, reject unknown algorithms, cap envelope lifetimes, log receipt IDs and idempotency keys, and require HTTPS outside local development.
