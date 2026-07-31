# JuanPager

**One schema for everything. One UI for everything. Meaning moves without requiring human words.**

JuanPager is an open-source semantic interaction protocol, TypeScript SDK, and trusted human interface runtime. Remote systems send semantic M1 packets; JuanPager verifies trust and capabilities, compiles them into JuanPage 1.0, and renders them through the single `renderPage` runtime.

```text
M1 semantic transport
→ trust and capability compiler
→ JuanPage 1.0
→ renderPage
→ typed human deltas and receipts
```

M1 is not a component tree. External adapters are not alternate UI schemas. JuanPage 1.0 is the only public UI schema and `renderPage` is the only renderer.

## Project status

| Area | Status | Evidence |
|---|---|---|
| JuanPage 1.0 schema and `renderPage` | Implemented | application, schema, renderer, tests |
| M1 packets, permissions, capabilities, deltas, receipts | Implemented | `spec/M1.md`, conformance tests |
| Ed25519 signed packets, deltas, and receipts | Implemented | `src/protocol/envelope.ts`, adversarial tests |
| AG-UI action/event bridge | Implemented and integration-tested | `src/adapters/agui.ts` |
| MCP App signed proposal bridge | Implemented and integration-tested | `src/adapters/mcp-app.ts` |
| A2UI projection | Experimental | shape adapter only; no conformance claim |
| npm package | Release-ready configuration; not yet claimed published | package dry run and release workflow |
| Ecosystem adoption | Not claimed | requires independent integrations |
| Broader external conformance certification | Planned | requires ecosystem participation |

## Ten-minute quick start

Requires Node.js 22.

```bash
git clone https://github.com/CakeRepository/juanpager.git
cd juanpager
npm ci
npm run check:one-runtime
npm test
npm run dev
```

The deterministic deployment reference is in `src/examples/reference-deployment.ts`. It projects the same packet into desktop Canvas, compact mobile Data, Flow, and machine adapter output.

## Minimal SDK example

```ts
import {
  materializeMeaningPacket,
  createActionDelta,
  MemoryNonceStore,
  verifyMeaningPacket,
} from "juanpager";

const packet = await verifyMeaningPacket(signedEnvelope, {
  audience: "juanpager:production",
  keys: [{ issuer: "agent:deployment", keyId: "key:2026-01", publicKey }],
  nonceStore: new MemoryNonceStore(), // replace with durable atomic storage in production
});

const page = materializeMeaningPacket(packet, capabilities);
const delta = createActionDelta(
  packet[1],
  packet[2],
  "actor:human:browser",
  "action:deploy",
  "deployment:chrome-128",
  {},
  "approval",
);
```

## Signed packet example

```ts
import { generateEd25519KeyPair, signMeaningPacket, verifyMeaningPacket } from "juanpager/envelope";

const keys = await generateEd25519KeyPair();
const envelope = await signMeaningPacket(packet, {
  issuer: "agent:deployment",
  audience: "juanpager:reference",
  keyId: "key:2026-01",
  privateKey: keys.privateKey,
  expiresAt: new Date(Date.now() + 60_000),
});

const verified = await verifyMeaningPacket(envelope, {
  audience: "juanpager:reference",
  keys: [{ issuer: "agent:deployment", keyId: "key:2026-01", publicKey: keys.publicKey }],
  nonceStore,
});
```

Verification rejects altered payloads, expired envelopes, wrong audiences, duplicate nonces, unknown keys, invalid delegation, unsupported algorithms, and malformed timestamps. Signatures provide integrity and configured-key authenticity, not confidentiality, identity discovery, key revocation, or proof that an external executor acted honestly. See [`SECURITY.md`](SECURITY.md) and [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

Unsigned packets may render as untrusted information. Hosts must not expose their executable actions.

## Adapter examples

```ts
import { bridgeMeaningActionToAGUI } from "juanpager/adapters/agui";

const result = bridgeMeaningActionToAGUI({
  packet,
  actorId: "actor:human:browser",
  actionId: "action:deploy",
  targetId: "deployment:chrome-128",
  policy: "approval",
  timestamp: new Date().toISOString(),
});

// result.page is JuanPage 1.0
// result.delta is a typed M1 proposal
// result.events is the AG-UI-compatible event sequence
// result.receipt records the proposal lifecycle
```

The MCP App bridge accepts a tool result containing a signed M1 envelope, verifies it, materializes JuanPage, and returns a typed decision to the host. Protocol-specific fields remain inside adapter modules.

## Security model

JuanPager renders through trusted DOM APIs and never executes agent-authored HTML, CSS, JavaScript, iframes, arbitrary components, or network code. Display vocabulary, localized labels, embeddings, and latent vectors never grant identity, permission, signature, or execution authority.

Executable actions fail closed. Capability negotiation can remove actions but cannot grant permission. Safe informational rendering remains available where verification or authorization does not permit execution.

## SDK and release readiness

```bash
npm run build:sdk
npm run check:public-api
npm run package:dry-run
npm run release:dry-run
```

The package exports browser, Node, protocol, envelope, transport, and adapter entrypoints with generated declarations. GitHub Actions includes a manual dry run and tag-triggered npm publishing with provenance. This repository does not claim that an npm package has already been published.

## Benchmarks

```bash
npm run benchmark:m1
```

The benchmark compares M1, canonical JuanPage JSON, neutral component-tree JSON, and natural-language UI instructions. It reports raw bytes, gzip bytes, approximate tokens, validation, materialization, `renderPage` timing, invalid-output rejection, and deterministic cross-run consistency as JSON and Markdown in `benchmark/results/`.

The report explicitly records where M1 is larger, slower, or less convenient. JuanPage is faster when a producer already owns canonical JuanPage data; M1 adds validation and materialization work in exchange for semantic transport, trust, capability negotiation, stable identity, and typed round trips.

## Development and conformance

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

See [`CONTRIBUTING.md`](CONTRIBUTING.md), [`docs/VERSIONING.md`](docs/VERSIONING.md), [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md), and [`docs/MIGRATION_SIGNED_ENVELOPES.md`](docs/MIGRATION_SIGNED_ENVELOPES.md).

## Specification

- [`spec/M1.md`](spec/M1.md): M1 semantic packet, delta, trust, and receipt contract
- [`spec/opcodes.json`](spec/opcodes.json): machine-readable opcode registry
- [`spec/public-api.json`](spec/public-api.json): package export compatibility baseline
- [`docs/adr/0001-signed-m1-envelopes.md`](docs/adr/0001-signed-m1-envelopes.md): cryptographic envelope decision

## Share format

```text
https://CakeRepository.github.io/juanpager/#v=3&enc=gz&data=ENCODED_PAYLOAD
```

Share fragments render locally. Do not put secrets in them; fragments can appear in browser history, screenshots, bookmarks, and copied messages.

## License

MIT
