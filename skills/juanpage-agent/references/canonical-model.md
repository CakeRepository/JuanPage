# Canonical JuanPager model

Use this as a compact orientation, then inspect the live repository for exact contracts.

## Architecture

```text
M1 semantic transport
→ trust and capability compiler
→ JuanPage 2.0 semantic graph
→ renderPage adaptive human surface
→ typed human deltas, receipts, and completion
→ originating agent continues
```

The repository is evolution-first, but it must retain one coherent canonical interaction model. A major redesign is allowed only when it completes the transition and removes the superseded path.

## Current authority order

1. Executable schema, protocol, state, renderer, and security code.
2. Tests and conformance fixtures.
3. Specifications and security documentation.
4. Agent guides, examples, README text, and this skill.

When lower layers disagree with higher layers, follow the code and tests, then repair the stale guidance.

## Canonical source map

- `AGENTS.md`: repository operating doctrine and evolution rules.
- `src/schema/page.ts`: strict JuanPage document contract and cross-reference validation.
- `src/protocol/meaning.ts`: M1 packet, delta, receipt, opcode, materialization, and capability behavior.
- `src/rendering/renderPage.ts`: the only public human-surface renderer.
- `docs/AGENT_GUIDE.md`: producer guidance; validate its examples against source.
- `spec/M1.md`: transport and mutation semantics.
- `SECURITY.md`: trust, replay, session, execution, and notification boundaries.
- `package.json`: supported public entrypoints and verification commands.

## JuanPage document shape

The current strict schema requires:

- `version: "2.0"`;
- `title`;
- at least one `object`.

It may include description, intent, theme, relations, metrics, scopes, projections, affordances, bindings, interaction state, and bounded scalar metadata.

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

Current direct JuanPage input kinds are:

- `none`;
- `boolean`;
- `number` with optional bounds, step, and entry/adjust presentation;
- `choice` with typed scalar options;
- `text` with optional placeholder and multiline flag.

Every current affordance requires an `input`. Use `{ "kind": "none" }` for effects that do not collect a value.

## Semantic state distinctions

- Facts describe the domain.
- Scopes describe the active viewing context.
- Selections identify semantic targets.
- Interaction state records view-level behavior such as query, filter, panel, viewport, ordering, focus, clocks, and transactions.
- Deltas record typed changes with revisions.
- Receipts record operation lifecycle evidence.

Do not collapse these into generic component state.

## M1 boundary

M1 carries stable symbols, vocabulary, entities, facts, relations, affordances, projections, evidence, permissions, deltas, and receipts as bounded tuples. It is a transport and trust boundary, not a second UI format.

Capability negotiation may remove interaction but never grant authority. Permission policy is enforced before an affordance reaches the renderer. External actions require stable mutation IDs and idempotency keys.

## Trusted execution boundary

Unsigned or untrusted information may retain safe local behavior according to host policy, but invocation and navigation are not execution authority. Durable sessions store validated semantic state; they do not independently grant permission.

The browser and self-contained URL remain record-only for remote effects. A trusted host selects reviewed executor code, re-checks authorization and tenant context, enforces idempotency in the external system, and records terminal deltas and receipts.

## Validation traps

Watch for these common stale-example errors:

- missing `input` on an affordance;
- unsupported input kinds;
- target fields placed inside effects instead of bindings;
- unknown strict-schema properties;
- fake interactive labels without bindings;
- projections that describe widgets instead of data semantics;
- scope changes modeled as fact mutations;
- approval represented only by text;
- secrets or credentials in URL fragments or notifications.
