# JuanPager

**One schema for everything. One adaptive human surface. Meaning moves without requiring a component tree.**

JuanPager is an open-source semantic interaction protocol, TypeScript SDK, and trusted human interface runtime. Agents and tools send meaning, evidence, and available operations. JuanPager renders the smallest truthful interface for the current human and device, records typed human deltas and receipts, and returns the completed semantic session to the originating agent.

```text
MCP, agent, or tool result
→ signed M1 semantic transport
→ trust and capability compiler
→ JuanPage 2.0 semantic graph
→ renderPage adaptive human surface
→ typed human deltas, receipts, and completion
→ originating agent continues
```

The payload is data. It contains no agent-authored HTML, CSS, JavaScript, component tree, iframe, or executable application code.

## The product loop

```text
Agent has something the human must see or decide
→ JuanPager opens as a URL, durable session, or installed app
→ human reads, filters, edits, selects, inspects, or approves
→ every meaningful interaction updates typed semantic state
→ Share or Complete preserves the exact resulting view and history
→ agent receives the page, deltas, receipts, and completion status
```

A URL is the zero-infrastructure transport, not the limit of the architecture. The same JuanPage can travel through four delivery modes:

1. **Self-contained URL** — compact, stateless, reproducible, and easy to pass between an agent and human.
2. **Durable session** — revisioned storage with optimistic concurrency for larger or longer-lived work.
3. **Installed PWA** — the same trusted runtime on phones, tablets, and desktops with an offline application shell.
4. **MCP handoff** — a signed tool result opens a human session, then returns structured completion to the tool or agent.

All four use JuanPage 2.0, `renderPage`, the same trust model, and the same typed interaction protocol.

## The interaction model

JuanPage 2 separates four things that conventional UI schemas often mix together:

1. **Information** — objects, fields, relations, metrics, and semantic projections.
2. **Affordances** — operations such as inspect, set, scope, select, invoke, navigate, and copy.
3. **Bindings** — explicit connections between information and affordances.
4. **Interaction state** — edits, scopes, selections, expansions, paths, viewports, ranges, playheads, ordering, grouping, queries, filters, panels, focus, clocks, transactions, deltas, and receipts.

Information is inert by default. A card, field, metric, relationship, or projected datum becomes interactive only when a valid binding gives it a real semantic operation.

The agent does not author buttons, cards, charts, tables, responsive layouts, or mobile screens. It describes meaning and possible operations. The runtime chooses an accessible presentation for the current device and capabilities.

Every rendered element follows one rule:

```text
display-only information
or
an explicit semantic action with visible state and a typed result
```

## Example: one meaning, multiple human controls

A financial period can appear as both a choice control and clickable projected data without defining two different operations:

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
    { "id": "period-projection", "target": { "kind": "projection", "projection": "revenue-by-month" }, "affordance": "scope-period" }
  ]
}
```

Selecting July updates every dependent representation and produces a typed scope delta an agent can understand.

## Project status

| Area | Status | Evidence |
|---|---|---|
| JuanPage 2.0 schema and only renderer, `renderPage` | Implemented | schema, architecture invariant, unit and browser tests |
| Universal semantic values and eight projection families | Implemented | deterministic projection and renderer tests |
| Complete typed human view state | Implemented | query, filter, panel, viewport, ordering, focus, reset, undo/redo tests |
| Self-recording share URLs | Implemented | second-browser round-trip journey |
| Durable revisioned agent-human sessions | Implemented | memory, browser-local, and HTTPS store contracts |
| Installable offline PWA shell | Implemented | manifest, service worker, mobile metadata, browser evidence |
| MCP signed proposal and human completion loop | Implemented | adapter and session return tests |
| M1 packets, permissions, deltas, and receipts | Implemented | `spec/M1.md`, conformance tests |
| Ed25519 signed packets, deltas, and receipts | Implemented | envelope and adversarial tests |
| Durable Node replay protection | Implemented | `FileNonceStore`, concurrency and restart tests |
| AG-UI bridge | Implemented and integration-tested | `src/adapters/agui.ts` |
| Packed SDK clean-room consumer | Implemented | external temporary consumer installs the tarball |
| Release evidence | Implemented | SBOM, checksums, benchmark artifacts, npm provenance config |
| A2UI projection | Experimental | semantic bridge only; no conformance claim |
| npm publication | Release-ready; not claimed published | package and consumer verification |
| Independent ecosystem adoption | Not claimed | requires an external implementation or deployment |

## Quick start

Requires Node.js 22.

```bash
git clone https://github.com/CakeRepository/JuanPage.git
cd JuanPage
npm ci
npm run check:one-runtime
npm test
npm run dev
```

Production GitHub Pages runtime: `https://cakerepository.github.io/JuanPage/`

The default operations example demonstrates display-only information, inspectable objects, field edits, approval-gated operations, projections, whole-surface scoping, typed view state, reversible reset, URL synchronization, and human activity receipts.

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

## Durable agent-human session

```ts
import {
  MemoryAgentHumanSessionStore,
  createAgentHumanSession,
  sessionLaunchUrl,
} from "juanpager/session";

const store = new MemoryAgentHumanSessionStore();
const session = createAgentHumanSession({
  document: page,
  packet,
  source: {
    kind: "agent",
    agentId: "agent:operations",
    requestId: "request:42",
  },
});

await store.put(session);
const url = sessionLaunchUrl(session.id, "https://your-host.example/juanpager/");
```

Session stores use optimistic revisions. `MemoryAgentHumanSessionStore` is suitable for tests and one process, `BrowserAgentHumanSessionStore` provides local offline continuity, and `HttpAgentHumanSessionStore` supports a same-origin durable service.

The HTTP store contract is deliberately small:

```text
GET    /sessions/{encoded-session-id}
PUT    /sessions/{encoded-session-id}   If-Match: previous-revision
DELETE /sessions/{encoded-session-id}
```

A conflict returns HTTP 409 or 412. Hosts may add authentication, authorization, encryption, retention, notification delivery, and multi-device synchronization without changing JuanPage or `renderPage`.

## MCP human handoff

```ts
import {
  createMcpHumanHandoff,
  mcpResultFromHumanSession,
} from "juanpager/adapters/mcp-app";

const handoff = await createMcpHumanHandoff({
  result: signedMcpToolResult,
  verification,
  store,
  appBaseUrl: "https://your-host.example/juanpager/",
  agentId: "agent:deployment",
  toolName: "deploy_agent",
  requestId: "request:42",
});

// Send handoff.launchUrl to the human.
// After the human presses Complete:
const resumedToolResult = mcpResultFromHumanSession(completedSession);
```

The returning result contains the canonical page, typed M1 deltas, action receipts, session revision, and completion state. The originating agent can continue without parsing screenshots or natural-language descriptions of what the human clicked.

## Installed app and offline behavior

The web runtime includes a manifest and service worker and can be installed as a PWA. The installed app contains the trusted renderer, schema validation, state engine, trust compiler, and transport adapters. It does not contain generated applications.

The offline shell can reopen locally stored sessions and self-contained links. Remote operations and durable synchronization still require their configured network services. The app never silently converts offline interaction into remote execution.

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

JuanPager renders through trusted DOM APIs and never executes agent-authored HTML, CSS, JavaScript, iframes, arbitrary components, plugins, or network code.

Display content never grants permission. Untrusted packets may retain safe local inspection, editing, scoping, and selection, but invocation and navigation affordances are removed. External or destructive operations remain explicit, policy-aware, auditable, and fail closed.

Verification supports revoked keys, signing validity windows, direct-key capabilities, delegated capabilities, bounded envelope lifetimes, audience checks, digests, signatures, and replay protection. Signatures provide integrity and configured-key authenticity, not confidentiality, identity discovery, or proof that an external executor acted honestly. See [`SECURITY.md`](SECURITY.md).

## URL sessions

```text
agent creates M1 packet
→ agent creates v5 URL session
→ human interacts
→ browser rewrites the URL with typed state and receipts
→ Share copies the exact resulting session
→ agent decodes it
```

```text
https://cakerepository.github.io/JuanPage/#v=5&enc=gz&data=ENCODED_PAYLOAD
```

Share fragments render locally. Never put secrets in them; fragments can appear in browser history, screenshots, bookmarks, extensions, and copied messages. Use durable authenticated sessions when the payload is too large, long-lived, sensitive, or shared across devices.

## Full verification

```bash
npm audit --audit-level=high
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

The repository can prove its architecture, package, security checks, browser behavior, deterministic conformance, durable-session contract, installed shell, and release artifacts. It cannot self-prove independent adoption, operating-system push delivery, or a production multi-tenant session service. Those are deployment milestones, not reasons to introduce a second schema or renderer.

## License

MIT
