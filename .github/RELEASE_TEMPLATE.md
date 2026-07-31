# JuanPager release

## Identity

- Package version:
- Git tag:
- JuanPage version:
- M1 version:
- Envelope version:
- npm publication:
- Provenance attestation:

## Protocol and interaction changes

Describe M1, envelope, delta, receipt, JuanPage, renderer, trust, or adapter changes. State the wire-version, URL-format, package-version, and migration impact.

Confirm that JuanPage 2.0 is the only public UI schema, M1 is semantic transport rather than a component tree, and `renderPage` is the only renderer.

## Security

Describe fixed threats, new trust assumptions, key lifecycle changes, nonce-store migration, envelope-lifetime policy, and any intentionally rejected previously accepted inputs.

## Compatibility and migration

Link migration notes. Identify removed packet, page, URL, package, or adapter contracts. State whether persisted sessions remain readable.

## Evidence

- [ ] Production dependency audit
- [ ] Release tag/version identity
- [ ] One-schema/one-runtime architecture invariant
- [ ] Lint
- [ ] Unit tests
- [ ] Integration tests
- [ ] Conformance and deterministic fuzz tests
- [ ] Desktop and mobile browser journeys
- [ ] Application and SDK build
- [ ] Public API check
- [ ] Clean-room packed SDK consumer
- [ ] npm package dry run
- [ ] Benchmark performance budget
- [ ] CycloneDX SBOM
- [ ] SHA-256 release checksums
- [ ] npm provenance

## Attached artifacts

- Package tarball
- `sbom.cdx.json`
- `checksums.txt`
- `benchmark/results/latest.json`
- `benchmark/results/latest.md`

## Known limitations

List limitations honestly, including independent adoption, external certification, assistive-technology coverage, multi-region replay consensus, confidentiality, and executor honesty where those remain outside repository proof.
