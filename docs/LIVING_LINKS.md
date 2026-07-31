# Living Moment Links

JuanPager links now support a two-layer fragment:

```text
#v=2&enc=gz&data=IMMUTABLE_MOMENT&r=PORTABLE_RECEIPT
```

- `data` is the original agent-authored moment.
- `r` is a compact user-authored receipt containing only deltas.

The original moment never changes. As a person checks items, changes quantities, or adds a note, the renderer updates `r` with `history.replaceState`. No page reload, account, backend, or remote write is required.

## Why two layers

Re-encoding the complete page after every click would be wasteful and would blur authorship. The source moment belongs to the agent. The receipt belongs to the human.

Keeping them separate provides:

- small updates
- clear provenance
- backward compatibility
- easy validation
- portable state between devices
- a stable source identity
- safe rejection of receipts attached to the wrong moment

## Receipt shape

```json
{
  "version": "0.1",
  "source": "juanpager:v0.2:...",
  "title": "Walmart Grocery Checklist",
  "updatedAt": "2026-07-31T19:00:00.000Z",
  "changes": [
    { "id": "blueberries", "checked": false },
    { "id": "bananas", "quantity": 2 }
  ],
  "note": "Blueberries were sold out, so I bought strawberries."
}
```

The `source` must match the stable state key of the decoded moment. Unknown entity IDs are ignored. Quantity values are clamped. Notes remain untrusted user input.

## Automatic behavior

Every moment with `check` or `adjust-qty` becomes return capable, including links created before this feature existed.

1. The page loads the immutable moment.
2. If `r` is present, JuanPager validates and hydrates the local state.
3. User interactions persist to local storage.
4. The renderer emits a local state event.
5. The URL receipt overlay is replaced in place.
6. Sharing the current URL carries the changes to another browser or agent.

## Transport independence

The URL fragment is the first transport, not the protocol boundary. The same receipt can later travel through:

- MCP
- `postMessage`
- native app deep links
- QR codes
- signed callbacks
- local desktop agents
- authenticated real-time channels

The receiving agent needs the source moment plus the receipt, not the rendered DOM.

## Privacy

The receipt is visible to anyone who receives the URL. Do not place secrets or sensitive data in notes. JuanPager does not send the receipt to a server by itself.
