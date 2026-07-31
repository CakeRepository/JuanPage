# JuanPager

**One schema for everything. One adaptive human surface. Meaning moves without requiring a component tree.**

JuanPager is an open-source semantic interaction protocol, TypeScript SDK, and trusted human interface runtime. Remote systems send M1 meaning packets; JuanPager verifies trust and capabilities, compiles them into JuanPage 2.0, and renders the smallest truthful human surface through `renderPage`.

```text
M1 semantic transport
→ trust and capability compiler
→ JuanPage 2.0 semantic graph
→ renderPage adaptive surface
→ typed human deltas and receipts
```

## The interaction model

JuanPage 2 separates four things that conventional UI schemas often mix together:

1. **Information** — objects, fields, relations, metrics, and data projections.
2. **Affordances** — semantic operations such as inspect, set, scope, select, invoke, navigate, and copy.
3. **Bindings** — explicit connections between information and affordances.
4. **Interaction state** — typed fact edits, scopes, selections, operation deltas, and receipts.

Information is inert by default. A card, field, metric, relationship, or projected data point becomes interactive only when a valid binding gives it a real semantic operation.

The agent does not author buttons, cards, charts, tables, or responsive layouts. It describes meaning and possible operations. The runtime chooses an accessible presentation for the current device and capabilities.

## Example: one scope, multiple human controls

A financial period may be exposed as both a select control and clickable data points without defining two different operations:

```json
{
  "scopes": [
    { "id": "period", "label": "Financial period", "field": "period", "initial": "2026-07" }
  ],
  "affordances": [
    {
      "id": "scope-period",
      "label": "Financial period",
      "effect": { "kind": "scope", "scope": "period" },
      "input": {
        "kind": "choice",
        "options": [
          { "label": "June", "value": "2026-06" },
          { "label": "July", "value": "2026-07" }
        ]
      }
    }
  ],
  "bindings": [
    { "id": "period-control", "target": { "kind": "page" }, "affordance": "scope-period" },
    { "id": "period-chart", "target": { "kind": "projection", "projection": "revenue-by-month" }, "affordance": "scope-period" }
  ]
}
```

Selecting July updates dependent objects, metrics, and projections immediately and produces a typed scope delta that an agent can understand.

## Project status

| Area | Status | Evidence |
|---|---|---|
| JuanPage 2.0 schema and `renderPage` | Implemented | schema, runtime, examples, unit tests |
| Semantic affordances, bindings, scopes, selections, projections | Implemented | validation and renderer tests |
| Desktop and mobile browser journeys | Implemented | Playwright Chromium projects |
| M1 packets, permissions, deltas, and receipts | Implemented | `spec/M1.md`, conformance tests |
| Deterministic hostile-input testing | Implemented | seeded conformance fuzz suite |
| Ed25519 signed packets, deltas, and receipts | Implemented | envelope and adversarial tests |
| Durable Node replay protection | Implemented | `FileNonceStore`, concurrency/restart tests |
| Key lifecycle and capability policy | Implemented | revocation, validity, capability, lifetime tests |
| AG-UI action/event bridge | Implemented and integration-tested | `src/adapters/agui.ts` |
| MCP App signed proposal bridge | Implemented and integration-tested | `src/adapters/mcp-app.ts` |
| Packed SDK clean-room consumer | Implemented | temporary external project installs tarball |
| Release evidence | Implemented | SBOM, checksums, benchmark artifacts, npm provenance config |
| A2UI projection | Experimental | semantic bridge only; no conformance claim |
| npm package | Release-ready; not claimed published | package and consumer verification |
| Independent ecosystem adoption | Not claimed | requires an external implementation or deployment |

## Quick start

Requires Node.js 22.

```bash
git clone https://github.com/CakeRepository/juanpager.git
cd juanpager
npm ci
npm run check:one-runtime
npm test
npm run dev
```

The default operations example demonstrates display-only information, explicitly inspectable objects, field edits, approval-gated operations, financial projections, whole-surface scoping, and URL sessions that return typed human deltas and receipts.

## Minimal SDK example

```ts
import {
  materializeMeaningPacket,
  createScopeDelta,
  MemoryNonceStore,
  verifyMeaningPacket,
} from "juanpager";

const packet = await verifyMeaningPacket(signedEnvelope, {
  audience: "juanpager:production",
  keys: [{
    issuer: "agent:deployment",
    keyId: "key:2026-01",
    publicKey,
    status: "active",
    capabilities: ["deployment.review"],
  }],
  nonceStore: new MemoryNonceStore(),
  requiredCapability: "deployment.review",
});

const page = materializeMeaningPacket(packet, capabilities);
const delta = createScopeDelta(packet[1], packet[2], "period", "2026-07");
```

## Durable replay protection for Node

```ts
import { FileNonceStore, verifyMeaningPacket } from "juanpager/node";

const nonceStore = new FileNonceStore({
  path: "/var/lib/juanpager/nonces.json",
});

const packet = await verifyMeaningPacket(envelope, {
  audience: "juanpager:production",
  keys,
  nonceStore,
});
```

`FileNonceStore` is suitable for one host or processes sharing an atomic filesystem. Multi-region systems should implement `NonceStore` using a strongly consistent database operation.

## Trust model

JuanPager renders through trusted DOM APIs and never executes agent-authored HTML, CSS, JavaScript, iframes, arbitrary components, or network code.

Display content never grants permission. Untrusted packets may retain safe local inspection, editing, scoping, and selection, but invocation and navigation affordances are removed. External or destructive operations remain explicit, policy-aware, auditable, and fail closed.

Verification supports revoked keys, signing validity windows, direct-key capabilities, delegated capabilities, bounded envelope lifetimes, audience checks, digests, signatures, and replay protection. Signatures provide integrity and configured-key authenticity, not confidentiality, identity discovery, or proof that an external executor acted honestly. See [`SECURITY.md`](SECURITY.md).

## Agent-to-human URL sessions

```text
agent creates M1 packet
→ agent creates v5 URL session
→ human scopes, selects, edits, or proposes an operation
→ Share creates a new v5 URL
→ agent decodes typed deltas and receipts
```

```text
https://CakeRepository.github.io/juanpager/#v=5&enc=gz&data=ENCODED_PAYLOAD
```

Share fragments render locally. Never put secrets in them; fragments can appear in browser history, screenshots, bookmarks, extensions, and copied messages.

## Full verification

```bash
npm audit --omit=dev --audit-level=high
npm run check:release-version
npm run check:one-runtime
npm run lint
npm run test:unit
npm run test:integration
npm run test:conformance
npx playwright install chromium
npm run test:e2e
npm run build
npm run check:public-api
npm run test:consumer
npm run package:dry-run
npm run benchmark:budget
npm sbom --sbom-format cyclonedx > sbom.cdx.json
```

`test:consumer` packs the SDK, installs it into a blank temporary project, and verifies only public exports. Pull-request CI uploads benchmark reports, SBOM data, and Playwright failure evidence as a commit-specific conformance artifact.

## Specification and decisions

- [`spec/M1.md`](spec/M1.md): M1 packet, projection, delta, trust, and receipt contract
- [`spec/opcodes.json`](spec/opcodes.json): machine-readable opcode registry
- [`docs/CONFORMANCE.md`](docs/CONFORMANCE.md): reproducible conformance levels and evidence
- [`docs/PERFORMANCE_BUDGETS.md`](docs/PERFORMANCE_BUDGETS.md): enforced size and latency budgets
- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md): threats, boundaries, and mitigations
- [`docs/adr/0001-signed-m1-envelopes.md`](docs/adr/0001-signed-m1-envelopes.md): cryptographic envelope decision
- [`docs/adr/0002-interaction-truth-affordances-and-bindings.md`](docs/adr/0002-interaction-truth-affordances-and-bindings.md): semantic interaction model
- [`AGENTS.md`](AGENTS.md): evolution-first agent doctrine

## Honest boundary

The repository can prove its architecture, package, security checks, browser behavior, deterministic conformance, and release artifacts. It cannot self-prove independent adoption. The final external credibility milestone is a separate implementation or real deployment that passes the published conformance process without relying on private repository internals.

## License

MIT
