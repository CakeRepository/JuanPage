# Versioning and stability policy

JuanPager is currently in **incubation**. The repository uses versions to make artifacts identifiable and testable, but it has not yet declared a long-term compatibility promise for schemas, wire formats, or public APIs.

## Incubation principle

The best current human-agent interaction model takes priority over preserving experimental interfaces.

During incubation, maintainers may intentionally introduce breaking changes to the schema, protocol tuples, renderer contract, package exports, URL payloads, examples, or repository structure when the change materially improves coherence, capability, safety, accessibility, or human-agent semantic symmetry.

A breaking change is not automatically a defect. An unexplained, partial, unsafe, or fragmented transition is.

## Canonical-live model

The deployed software and the agent generating a page are expected to use the same current version. The canonical implementation is the live product, not every historical experiment.

Therefore:

- old formats may be removed rather than supported indefinitely;
- compatibility shims are added only for demonstrated external adoption needs;
- obsolete abstractions should be deleted after migration;
- two competing canonical schemas or renderers must not coexist;
- persisted or shared artifacts should carry enough version information to be rejected clearly when unsupported.

## Package versions during incubation

Until a stable boundary is declared:

- patch releases may contain fixes and internal improvements;
- minor releases may add or change capabilities, schemas, opcodes, exports, and renderer behavior;
- major releases may be used for broad redesigns but are not the only place where incubation-stage breaking changes can occur;
- every release must document observable breaking changes clearly.

Consumers should pin exact versions when reproducibility matters.

## Protocol and schema versions

Packets, deltas, receipts, envelopes, sessions, and page documents must carry explicit versions where ambiguity would be unsafe. A verifier must reject unsupported versions rather than silently reinterpret them.

A redesign may replace the current M1, JuanPage, or rendering contract. When it does, the change must establish one new canonical path and migrate or remove the superseded path. Versioning exists to make the transition explicit, not to prevent it.

## Stable boundary

Long-term compatibility begins only after the project explicitly declares a stable boundary in this document and the release notes. That declaration should identify:

- which schemas and wire formats are stable;
- which package exports are public;
- the supported compatibility window;
- deprecation and migration guarantees;
- conformance requirements for independent implementations.

Until that declaration, users should treat the repository as fast-moving research and product incubation software.

## Change requirements

A significant breaking change should include:

1. the limiting assumption being removed;
2. the new canonical interaction model;
3. updated implementation, tests, specifications, and examples;
4. security and accessibility consequences;
5. migration guidance when real stored or external data is affected;
6. removal of obsolete paths unless a documented adoption need justifies temporary support.

## Release process

Every release requires a clean CI run, updated changelog, explicit breaking-change notes when applicable, package dry run, public API check appropriate to the current canonical exports, benchmark smoke test, signed tag or GitHub release provenance, and npm provenance when published.

Publication, stability, interoperability, or adoption must never be inferred from repository configuration alone.
