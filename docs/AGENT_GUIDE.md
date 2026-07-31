# JuanPager agent guide

JuanPager lets an agent describe **meaning and possible operations** while a trusted runtime decides how that meaning should appear to a human.

The canonical path is:

```text
M1 semantic transport
→ trust and capability compiler
→ JuanPage 2.0 semantic graph
→ renderPage adaptive surface
→ typed human deltas and receipts
```

Do not generate HTML, CSS, JavaScript, framework components, cards, charts, tables, responsive breakpoints, or alternate renderers. Generate semantic information and explicitly available operations.

## Choose the producer boundary

Use **M1** when meaning crosses a trust, transport, capability, or interoperability boundary. M1 carries stable symbols, facts, relations, evidence, uncertainty, permissions, and operation declarations. See [`spec/M1.md`](../spec/M1.md).

Use **JuanPage 2.0 directly** when the producer already owns the canonical validated semantic graph and does not need M1 trust compilation.

Both paths end in the same JuanPage 2.0 schema and `renderPage` runtime.

## Core rule

**Information is inert by default.**

An object, field, relation, metric, or projected datum becomes interactive only when a valid binding connects it to an explicit affordance.

Never imply interaction through labels such as “click here,” fake checkboxes, decorative sliders, hover-only behavior, or component names. If no real semantic effect exists, emit displayable information only.

## JuanPage 2.0 model

JuanPage separates four concerns:

1. **Information** — objects, fields, relations, metrics, and projections.
2. **Affordances** — semantic effects a human or agent may perform.
3. **Bindings** — where an affordance is available.
4. **Interaction state** — facts, scopes, selections, operation deltas, and receipts.

### Minimal display-only page

```json
{
  "version": "2.0",
  "title": "Quarterly review",
  "objects": [
    {
      "id": "quarter:2026-q3",
      "type": "quarter",
      "name": "2026 Q3",
      "summary": "Revenue is ahead of plan.",
      "fields": [
        { "key": "revenue", "label": "Revenue", "value": 640000, "format": "currency", "currency": "USD" },
        { "key": "status", "label": "Status", "value": "ahead" }
      ]
    }
  ]
}
```

This page contains no bindings, so nothing should receive pointer, keyboard, button, checkbox, slider, or link semantics.

### Inspectable object

```json
{
  "affordances": [
    {
      "id": "inspect-quarter",
      "label": "Inspect quarter",
      "effect": { "kind": "inspect", "target": "quarter:2026-q3" }
    }
  ],
  "bindings": [
    {
      "id": "inspect-quarter-card",
      "target": { "kind": "object", "object": "quarter:2026-q3" },
      "affordance": "inspect-quarter"
    }
  ]
}
```

The runtime may present this binding through a card, row, keyboard target, disclosure control, or another accessible composition. The schema does not choose the component.

### Editable fact

```json
{
  "affordances": [
    {
      "id": "set-approved",
      "label": "Approved",
      "effect": {
        "kind": "set",
        "target": "decision:release",
        "field": "approved"
      },
      "input": { "kind": "boolean" }
    }
  ],
  "bindings": [
    {
      "id": "approved-field-control",
      "target": {
        "kind": "field",
        "object": "decision:release",
        "field": "approved"
      },
      "affordance": "set-approved"
    }
  ]
}
```

A human change produces the same typed fact meaning an agent would produce. Dependent representations must update from that state immediately.

### Shared scope

```json
{
  "scopes": [
    {
      "id": "period",
      "label": "Financial period",
      "field": "period",
      "initial": "2026-07"
    }
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
          { "label": "July", "value": "2026-07" },
          { "label": "August", "value": "2026-08" }
        ]
      }
    }
  ],
  "bindings": [
    {
      "id": "period-page-control",
      "target": { "kind": "page" },
      "affordance": "scope-period"
    },
    {
      "id": "period-projection-control",
      "target": { "kind": "projection", "projection": "revenue-by-month" },
      "affordance": "scope-period"
    }
  ]
}
```

One semantic scope can appear as a select control and as interactive projected data points. Both produce the same typed scope delta and filter every dependent object, metric, and projection.

## Affordance effects

The current effect vocabulary is:

| Effect | Meaning |
|---|---|
| `inspect` | Reveal more information about a semantic target |
| `set` | Update a typed fact |
| `scope` | Change the active viewing context |
| `select` | Change one or more selected semantic targets |
| `invoke` | Request or propose an externally consequential operation |
| `navigate` | Move to an allowed trusted URL |
| `copy` | Copy a typed source through the host clipboard |

Use the narrowest effect that matches the intent. Do not model scope as a fact edit, inspection as an external operation, or navigation as an invocation.

## Inputs

Available semantic input domains include none, Boolean, number, bounded range, single choice, multiple choice, text, date, date range, and object selection. The runtime selects an accessible control supported by the current device.

A bounded number may become a slider, number input, stepper, voice choice, or future interaction. The agent defines the typed bounds and effect, not the widget.

## Projections

A projection describes a relationship in data, not a chart component. Provide stable datum identities, labels, values, and semantic dimensions. Bind an affordance to the projection only when its data points have a real operation such as scope or select.

Do not declare decorative chart interaction. An unbound projection remains visible but inert.

## External operations

Use `invoke` only for a genuine host operation. M1 permission policy determines whether it is allowed, denied, or approval-gated. Capability negotiation may remove an operation but never grant authority.

Externally consequential operations should produce typed deltas and receipts with stable IDs and idempotency keys. Display text, vocabulary, embeddings, and metadata are never authority.

## Trust guidance

- Unsigned M1 may render as untrusted information.
- Untrusted invocation and navigation must be removed.
- Safe local inspect, set, scope, select, and copy behavior may remain when host policy allows it.
- Signed envelopes should use exact audiences, short lifetimes, active keys, explicit capabilities, and atomic nonce consumption.
- Never place secrets in a page or URL fragment.
- Never rely on a label such as “approved” as proof of authorization; use typed state and verified operation policy.

See [`SECURITY.md`](../SECURITY.md) and [`spec/SIGNED_ENVELOPES.md`](../spec/SIGNED_ENVELOPES.md).

## URL sessions

Create a record-only agent-to-human session:

```bash
export JUANPAGER_BASE_URL="https://cakerepository.github.io/juanpager/"
npm run encode -- examples/change-approval.json --session
```

Decode the human-returned URL:

```bash
npm run decode -- "https://cakerepository.github.io/juanpager/#v=5&enc=gz&data=..."
```

A v5 session carries the original M1 packet, ordered typed deltas, and operation receipts. See [`docs/URL_SESSIONS.md`](URL_SESSIONS.md).

## Agent checklist

Before returning a JuanPager payload, confirm:

1. Every identifier is stable and unique.
2. Every visible interaction has a real affordance and binding.
3. Display-only information has no fake interaction metadata.
4. Facts, scopes, selections, and operations use the correct distinct effect.
5. Projection data has stable semantic identities rather than chart-specific instructions.
6. Externally consequential operations have explicit permission and capability semantics.
7. URLs are allowed and contain no secrets.
8. The payload validates against the current JuanPage 2.0 or M1 contract.
9. The payload does not contain HTML, CSS, JavaScript, framework components, or alternate schema shapes.
10. The human result can return as typed deltas and receipts that another agent can understand without interpreting pixels or prose.
