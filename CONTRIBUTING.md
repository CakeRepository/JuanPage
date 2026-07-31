# Contributing to JuanPager

JuanPager has one non-negotiable architecture:

```text
M1 semantic transport
→ trust and capability compiler
→ JuanPage 1.0
→ renderPage
→ typed human deltas and receipts
```

JuanPage 1.0 is the only public UI schema. `renderPage` is the only renderer. M1 and adapters may transport meaning, trust, capabilities, deltas, and receipts, but must not introduce another component tree or executable UI format.

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

Do not relax validation, lint, TypeScript strictness, audit severity, conformance behavior, or architecture checks to make a change pass.

## Protocol changes

Protocol changes require:

1. an ADR in `docs/adr/`;
2. a specification update;
3. conformance fixtures and tests;
4. compatibility and migration notes;
5. an explicit semver classification;
6. security tests for every fail-closed branch.

External protocol concepts belong in `src/adapters/`. Core M1 types must remain independent of AG-UI, MCP Apps, A2UI, or any vendor protocol.

## Good first issues

Good first contributions include additional adversarial fixtures, documentation corrections, cross-runtime Web Crypto tests, benchmark fixture improvements, locale vocabularies, and adapter fixtures copied from current official specifications. A good first issue must name the expected file, acceptance test, and architecture boundary.

## Pull requests

Keep one focused purpose per pull request. Include exact commands and results, note security impact, and state whether public exports or wire formats changed. Never claim publication, interoperability, adoption, or conformance without executable evidence.
