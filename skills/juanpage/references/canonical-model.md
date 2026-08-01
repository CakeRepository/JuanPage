# Canonical JuanPager model

Use this as a compact orientation, then inspect the live repository for exact contracts.

## Architecture

```text
M1 semantic transport
-> trust and capability compiler
-> JuanPage 2.0 semantic graph
-> renderPage adaptive human surface
-> typed human deltas, receipts, and completion
-> originating agent continues
```

The repository is evolution-first, but it must retain one coherent canonical interaction model. A major redesign is allowed only when it completes the transition and removes the superseded path.

## Current authority order

1. Executable schema, protocol, state, renderer, and security code.
2. Tests and conformance fixtures.
3. Specifications and security documentation.
4. Agent guides, examples, README text, and this skill.

When lower layers disagree with higher layers, follow the code and tests, then repair stale guidance.

## Canonical source map

- `AGENTS.md`: repository operating doctrine and evolution rules.
- `src/schema/page.ts`: strict JuanPage document contract and cross-reference validation.
- `src/protocol/meaning.ts`: M1 packet, delta, receipt, opcode, materialization, and capability behavior.
- `src/rendering/renderPage.ts`: the only public human-surface renderer.
- `docs/AGENT_GUIDE.md`: producer guidance; validate examples against source.
- `spec/M1.md`: transport and mutation semantics.
- `SECURITY.md`: trust, replay, session, execution, and notification boundaries.
- `package.json`: supported public entrypoints and verification commands.

## JuanPage document shape

The strict schema requires `version: "2.0"`, a title, and at least one object. It may include description, intent, theme, relations, metrics, scopes, projections, affordances, bindings, interaction state, and bounded scalar metadata.

IDs use the repository's opaque-ID pattern and must be unique in their category. All references are validated. Unknown keys are rejected because the schema is strict.

## Current affordance contract

Effects:

- `inspect`: `{ kind: "inspect" }`
- `set`: `{ kind: "set", field }`
- `scope`: `{ kind: "scope", scope }`
- `select`: `{ kind: "select", selection, mode }`
- `invoke`: `{ kind: "invoke", operation, policy }`
- `navigate`: `{ kind: "navigate", url }`
- `copy`: `{ kind: "copy", source, field?, url? }`

The binding target carries page, object, field, metric, relation, or projection placement. Do not add an object target to an effect unless the live schema explicitly changes.

Current input kinds are `none`, `boolean`, bounded `number`, typed `choice`, and `text`. Every affordance requires an input; use `{ "kind": "none" }` when no value is collected.

## Semantic state distinctions

- Facts describe the domain.
- Scopes describe active viewing context.
- Selections identify semantic targets.
- Interaction state records view behavior and transactions.
- Deltas record typed changes with revisions.
- Receipts record operation lifecycle evidence.

Do not collapse these into generic component state.

## M1 and trusted execution

M1 carries bounded meaning across transport and trust boundaries; it is not a second UI format. Capability negotiation may remove interaction but never grant authority. External actions require stable mutation IDs and idempotency keys.

The browser and self-contained URL remain record-only for remote effects. A trusted host selects reviewed executor code, re-checks authorization and tenant context, enforces idempotency, and records terminal deltas and receipts.

## Validation traps

Watch for missing inputs, unsupported input kinds, targets placed inside effects, unknown strict-schema properties, fake controls without bindings, widget-shaped projections, scopes modeled as fact mutations, approval represented only by text, and secrets in URL fragments or notifications.
