# Changelog

All notable changes are documented here. The project follows Semantic Versioning after its first public package release.

## Unreleased

### Added

- Ed25519 signed envelopes for M1 packets, deltas, and action receipts.
- Audience, lifetime, nonce replay, key ID, digest, algorithm, and delegation verification.
- Executable AG-UI and MCP App bridge flows with integration fixtures.
- Deterministic deployment reference scenario across Canvas, Data, Flow, and machine adapters.
- Reproducible size, timing, rejection, and determinism benchmarks.
- Public API export baseline and npm package dry-run checks.
- npm provenance and GitHub release workflows with dry-run support.
- Security policy, threat model, ADR, versioning, compatibility, migration, and contributor documentation.

### Security

- Executable trust can now be cryptographically bound to an issuer and audience.
- Duplicate nonces, altered payloads, expired envelopes, unknown keys, invalid delegation, malformed timestamps, wrong audiences, and unsupported algorithms fail closed.

### Compatibility

- JuanPage 1.0 remains the only public UI schema.
- `renderPage` remains the only renderer.
- Raw unsigned M1 remains available for informational rendering but is not trusted execution authority.

## 1.0.0 - Unpublished

Repository version reserved for JuanPage 1.0 and M1 development. No npm publication is claimed by this changelog.
