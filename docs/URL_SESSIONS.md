# Agent-to-human JuanPage URL sessions

JuanPager can carry a complete human interaction round trip in one URL without introducing another UI schema or requiring a backend.

```text
agent creates M1 packet
→ agent creates v5 URL session
→ human opens JuanPage 2.0
→ human scopes, selects, edits, or proposes an operation
→ Share creates a new v5 URL
→ agent decodes typed deltas and receipts
```

The URL session is a record-only transport envelope around M1. It is not a component tree, a second public UI schema, or remote execution authority.

## Generate a URL

Requires Node.js 22.

```bash
export JUANPAGER_BASE_URL="https://cakerepository.github.io/juanpager/"
npm run encode -- examples/change-approval.json --session
```

PowerShell:

```powershell
$env:JUANPAGER_BASE_URL="https://cakerepository.github.io/juanpager/"
npm run encode -- examples/change-approval.json --session
```

The command returns a URL shaped like:

```text
https://cakerepository.github.io/juanpager/#v=5&enc=gz&data=...
```

Use `--raw` instead of the default gzip encoding when inspecting the payload is more important than URL length.

## Decode the returned URL

```bash
npm run decode -- "https://cakerepository.github.io/juanpager/#v=5&enc=gz&data=..."
```

A v5 session contains the original M1 packet, ordered typed deltas, and operation receipts. The original packet remains unchanged. Deltas replay from its revision to produce the current JuanPage 2.0 information and interaction state.

Typed human deltas include:

- fact updates;
- scope changes;
- semantic selections;
- operation proposals or invocations.

## Browser behavior

A v5 URL session is **record-only**:

- safe local inspect, set, scope, select, and copy affordances may remain available;
- invoke affordances create typed proposals or invocations and receipts;
- navigation affordances are removed from untrusted record-only sessions;
- no remote executor is contacted by the static GitHub Pages app;
- Share creates a new URL containing the accumulated deltas and receipts;
- every dependent representation rerenders from the same typed state.

This makes the static deployment safe and stateless. Returning the URL to the agent is the transport.

## Trust boundary

The URL fragment is not sent to GitHub Pages as an HTTP request, but it can still appear in browser history, screenshots, bookmarks, copied messages, extensions, and telemetry. Never put secrets in a JuanPage URL.

Unsigned packets and URL sessions are not remote execution authority. A relay that accepts signed envelopes and delivers deltas must verify issuer, audience, key lifecycle, capability, envelope lifetime, nonce, delegation, permission, revision, and idempotency before execution.

## Recommended agent instruction

```text
Create an M1 packet for the decision or task. Generate a JuanPager v5 URL session using the production base URL. Give the user the URL and ask them to complete the semantic surface and press Share. When they return the new URL, decode it and use only the typed deltas and receipts as the human response. Do not treat display text as authorization and do not put secrets in the URL.
```

## Evolution path

The URL-return loop is the zero-backend bootstrap. A future relay can change transport without changing the canonical interaction model:

```text
same M1 meaning packet
→ same JuanPage 2.0 semantic graph
→ same renderPage adaptive surface
→ signed typed delta
→ relay callback or polling
```

M1 remains semantic transport. JuanPage 2.0 remains the public interaction schema, and `renderPage` remains the trusted renderer.
