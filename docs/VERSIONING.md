# Versioning policy

JuanPager uses Semantic Versioning for the npm package and explicit versions for wire protocols.

## Package versions

- Patch: fixes that preserve accepted inputs, public exports, and observable protocol behavior.
- Minor: backward-compatible exports, optional envelope fields, new adapters, new conformance cases, or new opcodes that old implementations may safely ignore only where the specification explicitly permits it.
- Major: removed or changed exports, changed tuple meaning, changed canonicalization, changed signature input, newly rejected previously conforming payloads without a security exception, or changes to JuanPage 1.0.

Security fixes may intentionally reject previously accepted malicious or ambiguous inputs in a patch release. Such exceptions must be documented in the changelog and security advisory.

## Protocol versions

M1 packet tuples, M1 deltas, action receipts, and signed envelopes each carry a version. A verifier must reject unsupported versions. Version negotiation must never silently reinterpret one version as another.

JuanPage 1.0 is the only public UI schema. A future JuanPage major version requires a dedicated migration and must not coexist as a hidden second renderer contract.

## Deprecation

Public APIs are deprecated for at least one minor release before removal unless an urgent security issue requires immediate removal. Deprecated APIs remain covered by compatibility tests during the window.

## Release process

Every release requires a clean CI run, updated changelog, migration note when applicable, package dry run, public API compatibility check, benchmark smoke test, signed Git tag or GitHub release provenance, and npm provenance. Publication is never inferred from repository configuration alone.
