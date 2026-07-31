# Agent-to-human JuanPage URL sessions

JuanPager can carry a complete human interaction round trip in one URL without introducing another UI schema or requiring a backend.

```text
agent creates M1 packet
→ agent creates v4 URL session
→ human opens JuanPage
→ human edits, chooses, or proposes an action
→ Share creates a new v4 URL
→ agent decodes typed deltas and receipts
```

The URL session is a transport envelope around M1. It is not a component tree and it is not a second public UI schema.

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
https://cakerepository.github.io/juanpager/#v=4&enc=gz&data=...
```

Use `--raw` instead of the default gzip encoding when inspecting the payload is more important than URL length.

## Decode the returned URL

```bash
npm run decode -- "https://cakerepository.github.io/juanpager/#v=4&enc=gz&data=..."
```

A v4 session contains:

```json
{
  "transport": "m1-session",
  "packet": ["original M1 packet"],
  "deltas": ["typed human mutations in revision order"],
  "receipts": ["typed action lifecycle records"]
}
```

The original packet remains unchanged. Deltas are replayed in revision order to produce the current JuanPage state.

## Browser behavior

A v4 URL session is **record-only**:

- local toggle, number, choice, and text controls are available
- emit actions create typed proposals or invocations and receipts
- open/navigation actions are removed
- no remote executor is contacted by the static GitHub Pages app
- Share copies a new URL containing the accumulated deltas and receipts

This makes the first deployment safe and stateless. Returning the URL to the agent is the transport.

## Trust boundary

The URL fragment is not sent to GitHub Pages as an HTTP request, but it can still appear in browser history, screenshots, bookmarks, copied messages, extensions, and telemetry. Never put secrets in a JuanPage URL.

Unsigned packets and URL sessions are not remote execution authority. A future relay may accept signed envelopes and deliver deltas directly, but that relay must verify issuer, audience, expiration, nonce, delegation, permission, and idempotency before execution.

## Recommended agent instruction

```text
Create an M1 packet for the decision or task. Generate a JuanPager v4 URL session using the production base URL. Give the user the URL and ask them to complete the JuanPage and press Share. When they return the new URL, decode it and use only the typed deltas and receipts as the human response. Do not treat display text as authorization and do not put secrets in the URL.
```

## Evolution path

The URL-return loop is the zero-backend bootstrap. The next transport can be a signed relay session:

```text
same M1 packet
→ same JuanPage 1.0
→ same renderPage
→ signed typed delta
→ relay callback or polling
```

Only transport changes. JuanPage 1.0 and `renderPage` remain the single UI contract and renderer.