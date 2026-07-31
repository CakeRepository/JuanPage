# Changelog

All notable changes are documented here. Package releases use Semantic Versioning. JuanPage, M1, envelope, and URL formats carry their own explicit protocol versions.

## Unreleased

### Added

- JuanPage 2.0 semantic information, affordance, binding, scope, selection, and projection model.
- Adaptive `renderPage` interaction surface where unbound information remains inert.
- Typed M1 scope and selection deltas and record-only v5 URL sessions.
- Ed25519 signed envelopes for M1 packets, deltas, and action receipts.
- Key status, signing validity windows, direct-key capabilities, delegated capabilities, and bounded envelope lifetimes.
- Durable atomic `FileNonceStore` for Node hosts and a public `juanpager/node` entrypoint.
- Executable AG-UI and MCP App bridge flows with integration fixtures.
- Deterministic hostile-input conformance fuzzing.
- Desktop and mobile Playwright semantic interaction journeys.
- Clean-room packed SDK consumer verification using only public package exports.
- Reproducible size, timing, rejection, determinism, and enforced performance-budget checks.
- Commit-specific CI evidence bundles containing benchmark reports, SBOM data, and browser failure evidence.
- Release tarballs, CycloneDX SBOMs, SHA-256 checksums, benchmark evidence, npm provenance configuration, and tag/version identity checks.
- Security policy, threat model, ADRs, conformance levels, performance budgets, versioning, and contributor documentation.

### Security

- Executable trust can be cryptographically bound to an issuer, audience, key lifecycle, capability, and maximum lifetime policy.
- Duplicate nonces, altered payloads, expired envelopes, excessive lifetimes, revoked keys, out-of-window keys, missing capabilities, unknown keys, invalid delegation, malformed timestamps, wrong audiences, and unsupported algorithms fail closed.
- Untrusted packets retain safe local interaction while invocation and navigation authority are removed.
- Persisted replay state fails closed when corrupt.

### Breaking

- JuanPage 1.x is replaced by JuanPage 2.0.
- Object-owned `actions`, `actionIds`, object interaction flags, and agent-authored lens configuration are removed from the canonical model.
- Share fragments v3 and v4 are replaced by v5.
- Verification now enforces a default maximum envelope lifetime of five minutes unless explicitly widened by verifier policy.
- A requested direct-key capability must be explicitly present on the verification key when no delegation chain is supplied.

### Compatibility

- JuanPage 2.0 is the only public UI schema.
- `renderPage` remains the only renderer.
- M1 remains semantic transport rather than a component tree.
- Raw unsigned M1 remains available for informational rendering but is not trusted invocation or navigation authority.

## 0.1.0 - Unpublished

The package remains an unpublished incubation artifact. No npm publication or independent ecosystem adoption is claimed by this changelog.
