# Contributing to JuanPager

JuanPager is currently an incubation-stage project. Its purpose is to discover and implement a better interface between humans and agents, not to freeze the first credible architecture.

Read [`AGENTS.md`](AGENTS.md) before making design or implementation changes. It defines the repository's evolution-first operating doctrine.

## Current canonical path

The current implementation is:

```text
M1 semantic transport
→ trust and capability compiler
→ JuanPage
→ renderPage
→ typed human deltas and receipts
```

This is the canonical live path today. Do not add parallel component trees, hidden renderers, inert mock controls, or alternate interaction formats beside it.

However, no current layer is permanently protected during incubation. A contributor may replace or redesign the schema, protocol, renderer, or transport when the result is demonstrably more coherent, capable, safe, and useful. Complete the migration instead of leaving multiple canonical systems behind.

## Interaction standard

Anything that appears interactive must work.

Buttons, links, checkboxes, sliders, ranges, chart marks, legends, tabs, filters, selectors, editable fields, drag handles, scroll regions, disclosure controls, and keyboard affordances must produce a meaningful state transition, scope change, navigation, typed delta, or action receipt.

Human interactions must be represented as first-class typed data whenever an agent may need to understand, continue, audit, or reproduce them. A visual control and an agent operation may use different presentation, but they should share the same semantic operation.

## First working example

Requirements: Node.js 22 and npm.

```bash
git clone https://github.com/CakeRepository/juanpager.git
cd juanpager
npm ci
npm run check:one-runtime
npm test
npm run dev
```

Open the viewer shown by Vite. The deterministic deployment fixture is in `src/examples/reference-deployment.ts`.

## Development checks

Before opening a pull request, run:

```bash
npm audit --omit=dev --audit-level=high
npm run check:one-runtime
npm run lint
npm run test:unit
npm run test:integration
npm run test:conformance
npm run build
npm run check:public-api
npm run package:dry-run
npm run benchmark:smoke
```

Do not relax validation, lint, TypeScript strictness, audit severity, security behavior, or architecture checks merely to make a change pass. Update checks when the canonical architecture intentionally changes.

## Breaking changes during incubation

Backward compatibility is not a default requirement before a stable compatibility boundary is explicitly declared.

Intentional breaking changes are welcome when they remove a limiting assumption or produce a materially better human-agent interaction model. Significant changes should include:

1. the human or agent problem being solved;
2. the obsolete assumption being removed;
3. the new canonical model;
4. schema, protocol, renderer, and documentation updates as applicable;
5. executable interaction and conformance tests;
6. security and accessibility analysis;
7. deletion or migration of superseded paths.

Do not add compatibility shims without a real adoption need. Do not keep obsolete APIs or formats solely because they existed in an earlier experiment.

## Protocol and schema changes

Protocol or schema changes require enough evidence to make the new design reviewable:

1. an ADR for major conceptual changes;
2. specification updates;
3. fixtures and tests;
4. a concise migration note when persisted or externally shared data is affected;
5. an explicit statement that the change is breaking or compatible;
6. security tests for every fail-closed branch.

External protocol concepts belong in adapters unless the redesign intentionally establishes a new core abstraction. Vendor-specific fields must not leak into the core by accident.

## Pull requests

Keep one focused purpose per pull request. Include exact commands and results, describe observable interaction changes, note security and accessibility impact, and state whether schemas, public exports, or wire formats changed.

Never claim publication, interoperability, adoption, performance, or conformance without executable evidence.
