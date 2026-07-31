# Compatibility policy

## Runtime support

- Node.js: current Node 22 LTS line in CI.
- Browsers: environments with standards-compliant ES modules, Web Crypto, SubtleCrypto Ed25519, TextEncoder, and secure contexts for cryptographic operations.
- TypeScript: declarations are generated from strict TypeScript sources.

A runtime without Ed25519 support may still render unsigned informational JuanPage content but cannot claim signed-envelope verification compatibility.

## Interoperability claims

An adapter is called compatible only when executable fixtures demonstrate both directions needed by the integration. Shape resemblance is labeled experimental.

Current tested bridges:

- AG-UI event bridge: M1 packet → JuanPage → human action → M1 delta → event stream → receipt.
- MCP App bridge: tool result containing a signed M1 envelope → verified JuanPage proposal → typed MCP host response.

A2UI remains an experimental projection. It is not a conformance claim and must not leak component vocabulary into M1.

## Public API compatibility

`spec/public-api.json` records package export paths. CI rejects removed paths. Type-level and behavioral compatibility still require review and conformance tests; the export check is necessary but not sufficient.

## Wire compatibility

Unknown envelope algorithms and versions are rejected. Unknown M1 opcodes are rejected unless a future protocol version explicitly defines an extension mechanism. Adapters may add protocol-native metadata but cannot alter M1 identity, permissions, signatures, or receipt semantics.
