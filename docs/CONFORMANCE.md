# JuanPager conformance

JuanPager conformance is evidence-based. A claim is valid only for the exact commit, package, runtime, and test level that produced the evidence.

## Conformance levels

### Level 1: Schema

A producer emits JuanPage 2.0 documents accepted by `validatePage` and rejects malformed or ambiguous documents.

Required command:

```bash
npm run test:unit
```

### Level 2: Protocol

An implementation validates M1 packets and deltas, preserves stable symbolic identity, enforces permission policy, rejects revision conflicts and unknown references, and materializes deterministically.

Required command:

```bash
npm run test:conformance
```

The conformance suite includes deterministic hostile-input generation. Randomness is seeded so failures are reproducible.

### Level 3: Human interaction

The trusted runtime demonstrates that visible affordances work and inert information does not impersonate a control. Scope, selection, field editing, inspection, and invocation behavior must produce typed state or deltas.

Required command:

```bash
npx playwright install chromium
npm run test:e2e
```

The suite runs the same semantic journeys on desktop and mobile Chromium.

### Level 4: Package consumer

The packed npm artifact can be installed by a blank project that does not import repository source files. Public exports must support JuanPage validation, typed deltas, signed-envelope verification, and persistent Node replay protection.

Required commands:

```bash
npm run build
npm run test:consumer
```

`test:consumer` creates a temporary project, installs the generated tarball, executes the public API journey, and deletes the temporary project and package.

### Level 5: Release evidence

A release candidate passes every lower level plus dependency audit, public API checks, package dry run, performance budgets, SBOM generation, tag/version identity checks, and provenance-enabled packaging.

Required command:

```bash
npm run release:dry-run
npm sbom --sbom-format cyclonedx > sbom.cdx.json
```

## CI evidence bundle

Every pull request CI run uploads a `juanpager-conformance-<commit>` artifact containing:

- the benchmark JSON report;
- the human-readable benchmark report;
- a CycloneDX software bill of materials;
- Playwright traces, screenshots, and reports when generated.

GitHub release artifacts additionally include the package tarball and SHA-256 checksums.

## Independent implementation checklist

An independent implementation should:

1. consume `spec/M1.md` and `spec/opcodes.json`, not private TypeScript internals;
2. reject unsupported versions and unknown opcodes;
3. keep display meaning separate from execution authority;
4. implement nonce consumption atomically within its deployment consistency boundary;
5. map human scope, selection, fact edits, and operations back to typed deltas;
6. preserve deterministic output for identical validated input and capabilities;
7. publish exact commands, fixture versions, and failure output for its conformance claim.

## Claims this repository does not make

Passing the repository suite does not prove ecosystem adoption, independent certification, accessibility across every assistive technology, multi-region nonce consensus, confidentiality, or honest behavior by an external executor. Those claims require separate evidence.
