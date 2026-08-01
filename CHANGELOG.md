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
- An architecture gate that requires retired schema, renderer, encoding, state, receipt, dialect, example, test, documentation, and visual-system files to remain absent.
- A CI-enforced universal interface capability atlas and theory-of-everything admission contract.
- Compact M1-compatible semantic value tuples for time, space, content, media, units, uncertainty, distributions, and matrices.
- Generalized deterministic semantic projection families for categorical, temporal, matrix, hierarchy, network, spatial, document, and ordered-stream representations.
- Universal interaction state for expansions, paths, viewports, ranges, playheads, ordering, grouping, focus restoration, and simulation clocks.
- Adaptive `renderPage` representations for all eight semantic projection families with working direct manipulation.
- Atomic multi-patch page transactions with precondition checks, fail-closed conflicts, commit, cancel, undo, and redo.
- M1-compatible interaction-state and transaction operations with record-only session replay and local action receipts.
- Public `juanpager/renderer`, `juanpager/state`, and `juanpager/interaction` package entrypoints.
- Reduced-motion, increased-contrast, keyboard, semantic-role, native-control, and focus-restoration coverage for universal projections.
- Executable tests for projection rendering, viewports, hierarchy expansion, clocks, transaction conflicts, M1 state replay, undo, and redo.

### Removed

- The complete JuanPager Document 0.1 component-tree schema, renderer, encoder, local state, examples, styles, and tests.
- The complete JuanPager Moment 0.2 schema, renderer, dialect, compact encoding, receipt overlay, living-link format, examples, styles, documentation, and tests.
- The multi-schema loader and encoding pipeline that allowed both retired systems to coexist.
- Legacy fragment versions 1 through 4 and the `juanreceipt:v1` URL overlay model.
- The separate welcome, document, moment, and return visual systems. `universal.css` is now the only application and builder stylesheet.

### Security

- Executable trust can be cryptographically bound to an issuer, audience, key lifecycle, capability, and maximum lifetime policy.
- Duplicate nonces, altered payloads, expired envelopes, excessive lifetimes, revoked keys, out-of-window keys, missing capabilities, unknown keys, invalid delegation, malformed timestamps, wrong audiences, and unsupported algorithms fail closed.
- Untrusted packets retain safe local interaction while invocation and navigation authority are removed.
- Persisted replay state fails closed when corrupt.
- Reserved semantic value tags fail closed when their tuple shape, URL policy, bounds, matrix dimensions, point counts, range ordering, or uncertainty constraints are invalid.
- Transaction precondition mismatches fail atomically without partially mutating page state.
- Universal state values remain bounded data and cannot carry markup, code, callbacks, components, or renderer instructions.

### Breaking

- JuanPage 1.x is replaced by JuanPage 2.0.
- Object-owned `actions`, `actionIds`, object interaction flags, and agent-authored lens configuration are removed from the canonical model.
- JuanPager Document 0.1 and Moment 0.2 are no longer accepted, built, rendered, encoded, documented, or tested.
- Share fragments v1 through v4 are replaced by v5.
- Verification now enforces a default maximum envelope lifetime of five minutes unless explicitly widened by verifier policy.
- A requested direct-key capability must be explicitly present on the verification key when no delegation chain is supplied.
- Scalar lists beginning with a reserved universal value tag must now satisfy that tag's typed tuple contract.

### Compatibility

- JuanPage 2.0 is the only public UI schema.
- `renderPage` is the only renderer.
- `universal.css` is the only runtime visual system.
- M1 remains semantic transport rather than a component tree.
- Raw unsigned M1 remains available for informational rendering but is not trusted invocation or navigation authority.
- Universal values travel through the existing M1 Fact opcode and JuanPage field contract; no parallel transport or document format was introduced.
- Universal interaction state and transactions travel through ordinary M1 action deltas; no second session or state protocol was introduced.

## 0.1.0 - Unpublished

The package remains an unpublished incubation artifact. No npm publication or independent ecosystem adoption is claimed by this changelog.
