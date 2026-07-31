## Summary

## Human-agent problem

Describe the concrete interaction, trust, interoperability, or developer problem being solved.

## Canonical architecture

- [ ] M1 remains semantic transport and trust compilation rather than a component tree.
- [ ] JuanPage 2.0 remains the only public UI schema, or this pull request completely establishes and documents one replacement canonical schema.
- [ ] `renderPage` remains the only renderer, or this pull request completely establishes and documents one replacement canonical renderer.
- [ ] No parallel public schema, hidden renderer, compatibility mode, or agent-authored executable UI was introduced.
- [ ] Information is inert unless a valid semantic binding makes it interactive.
- [ ] Human facts, scopes, selections, and operations remain typed and observable.

## Security impact

Describe trust-boundary changes, key or nonce implications, fail-closed behavior, and adversarial tests.

## Accessibility and interaction truth

Describe keyboard behavior, assistive semantics, visible state updates, mobile behavior, and how every displayed affordance proves a real effect.

## Compatibility

- Package version impact:
- JuanPage/M1/envelope/URL impact:
- Public export impact:
- Stored session impact:
- Migration required:

## Exact validation results

```text
npm audit --omit=dev --audit-level=high
npm run check:release-version
npm run check:one-runtime
npm run lint
npm run test:unit
npm run test:integration
npm run test:conformance
npm run test:e2e
npm run build
npm run check:public-api
npm run test:consumer
npm run package:dry-run
npm run benchmark:budget
npm sbom --sbom-format cyclonedx > sbom.cdx.json
```

## Evidence and claims

- [ ] Every interoperability claim has an executable fixture.
- [ ] Every performance claim is measured against a named fixture and environment.
- [ ] Publication and adoption claims are externally verifiable.
- [ ] Documentation distinguishes implemented, experimental, planned, published, and independently adopted work.
- [ ] Superseded canonical paths were removed or their temporary need is explicitly documented.
