---
name: juanpage
description: Generate, validate, host, review, debug, and evolve JuanPager semantic experiences. Use when a user wants a JuanPage, a one-page interactive interface, a shareable JuanPager URL, an M1 human handoff, or repository work involving JuanPage 2.0, renderPage, typed human state, trust, or protocol evolution. Default to producing a working hosted JuanPage URL rather than modifying the JuanPager repository.
---

# JuanPage

Use JuanPager as a semantic interaction protocol, not a component generator. Describe meaning, available operations, and typed state; let the trusted runtime choose the human presentation.

## Default user experience: generate the URL

Most users want a working JuanPage they can open.

For ordinary requests:

1. Identify the JuanPager host URL. Prefer a URL supplied by the user. Otherwise use the canonical production host: `https://cakerepository.github.io/JuanPage/`.
2. Translate the request into a JuanPage 2.0 semantic graph.
3. Add only real affordances and valid bindings.
4. Validate the page with the repository's exported validator.
5. Encode the page into a self-contained v5 URL using the host URL.
6. Return the clickable URL as the primary result and briefly describe what is interactive.

The user supplies the desired world or task. The host URL is configuration, not the source content for the page.

A first-run prompt may be:

```text
Create a JuanPage for a product launch command center.
```

Given the production host:

```text
https://cakerepository.github.io/JuanPage/
```

generate a URL shaped like:

```text
https://cakerepository.github.io/JuanPage/#v=5&enc=gz&data=...
```

Use direct JuanPage for safe, self-contained interfaces that inspect, set, scope, select, copy, or update local typed state. Use an M1 URL session when the human response must return to an agent as ordered deltas and receipts.

Do not open a pull request, modify the JuanPager repository, or design protocol machinery unless the user explicitly asks for implementation or repository changes.

## Hosted URL workflow

When a checked-out repository is available, generate URLs with the canonical encoder:

```bash
export JUANPAGER_BASE_URL="https://cakerepository.github.io/JuanPage/"
npm run encode -- path/to/page.json
```

For an M1 round-trip session:

```bash
export JUANPAGER_BASE_URL="https://cakerepository.github.io/JuanPage/"
npm run encode -- path/to/packet.json --session
```

The resulting link is the deliverable. A self-contained URL transports data to the trusted `renderPage` runtime; it is not a generated web application or a second UI schema.

When the user returns a shared M1 session URL, decode it and use typed deltas and receipts as the human response:

```bash
npm run decode -- "https://cakerepository.github.io/JuanPage/#v=5&enc=gz&data=..."
```

Never put secrets, bearer credentials, private keys, or sensitive tokens in URL payloads.

## Start with the live repository for implementation work

Enter this workflow only when the user asks to change, debug, review, or extend JuanPager itself.

1. Locate the `CakeRepository/JuanPage` repository root.
2. Run:

   ```bash
   python3 skills/juanpage/scripts/evolve.py check --repo .
   ```

3. If the snapshot is stale, inspect changed canonical files before designing anything. Run `sync` only after understanding the changes.
4. Read `references/canonical-model.md` and the live source files it names when exact types, opcodes, limits, or behavior matter.
5. Treat source and executable tests as stronger authority than prose documentation.

Do not continue from remembered JuanPage versions or examples without checking the current repository.

## Choose the producer boundary

- Use **direct JuanPage** for a self-contained semantic surface when the producer owns the validated graph and no transport trust compilation is required.
- Use **M1** when meaning crosses a transport, trust, capability, signing, interoperability, external-agent, or human-return boundary.
- Both paths converge on JuanPage 2.0 and the single `renderPage` runtime.
- Do not introduce another component tree, page schema, renderer, markup format, or agent-authored executable surface.

## Model the interaction

Translate the request into:

1. **Information**: stable objects, fields, relations, metrics, evidence, and projections.
2. **Affordances**: the narrowest real effect available to the human.
3. **Bindings**: the exact semantic target where each affordance is available.
4. **State**: facts, scopes, selections, interaction state, transactions, deltas, and receipts.
5. **Authority**: trust, permission policy, capabilities, approval, idempotency, and host execution.

Information is inert by default. Never make something look interactive unless a valid affordance and binding produce a typed result.

## Use semantic effects precisely

- `inspect`: reveal more information locally.
- `set`: update a typed fact.
- `scope`: change active viewing context without rewriting domain facts.
- `select`: change selected semantic targets.
- `invoke`: request or propose an externally consequential operation.
- `navigate`: move to a policy-allowed trusted URL.
- `copy`: copy a typed source through the host clipboard.

Do not encode scope as a fact edit, inspection as invocation, approval as display text, or navigation as arbitrary execution.

## Build current-schema payloads

- Use `version: "2.0"` unless the live schema deliberately changes.
- Give every object, relation, metric, scope, projection, affordance, and binding a stable unique ID.
- Keep every binding target and referenced ID valid.
- Put semantic placement in the binding target.
- Supply every required field, including an affordance input.
- Use only implemented input kinds.
- Describe projections as data relationships, not chart or widget instructions.
- Bind projected data only when activation performs a real effect.
- Keep display-only content free of fake control metadata.
- Never include HTML, CSS, JavaScript, callbacks, framework components, iframes, shell commands, SQL, plugins, or arbitrary network instructions in a page.

Validate with the repository's exported validators or the same production path. Do not rely on visual plausibility.

## Generate repository examples

When explicitly asked to add a demo or example to the repository, keep that workflow inside JuanPage rather than creating another skill.

1. Read `references/generation-contract.md`.
2. Optionally create a minimal typed starting file:

   ```bash
   python3 skills/juanpage/scripts/scaffold_page.py \
     --slug <example-slug> \
     --title "<page title>" \
     --object-name "<root object name>"
   ```

3. Replace the scaffold with the complete semantic model.
4. Add a focused `validatePage` test proving important affordances, bindings, state, and authority behavior.
5. Keep the public deliverable a hosted JuanPage URL unless repository source was specifically requested.

## Verify behavior

For generated pages, prove at minimum:

- the page validates;
- every visible control has an affordance and binding;
- referenced fields and objects exist;
- the final URL decodes back to the same semantic page;
- remote effects are absent unless intentionally modeled through M1 and authority policy.

For repository changes, run the narrowest relevant tests first, then:

```bash
npm run check:one-runtime
npm test
npm run build
```

Run `npm run test:e2e` for renderer, browser, PWA, URL-session, or human-interaction changes. Do not add blind sleeps, skip tests, weaken assertions, or create decorative interactions.

## Trusted execution boundary

Self-contained browser URLs are record-only for remote effects. `invoke` creates a typed proposal or invocation record; it does not grant execution authority.

A trusted host executor must re-check authorization and tenant context, enforce idempotency in the external system, and record terminal deltas and receipts.

## Self-evolve through evidence

Create an evolution candidate only when repository evidence shows a reusable lesson, such as canonical source drift, repeated agent error, a general review finding, a failing test exposing a reusable rule, or a new protocol capability needing a repeatable workflow.

Do not create a candidate merely because a new example generated successfully.

```bash
python3 skills/juanpage/scripts/evolve.py propose \
  --repo . \
  --title "Use binding targets as semantic destinations" \
  --lesson "Do not duplicate object targets inside effects; the binding owns placement." \
  --evidence src/schema/page.ts \
  --evidence tests/page.test.ts
```

Promotion requires immutable evidence and an explicit approval identity:

```bash
python3 skills/juanpage/scripts/evolve.py promote \
  --repo . \
  --candidate skills/juanpage/evolution/candidates/<file>.json \
  --approved-by <reviewer-or-agent-id>
```

Never learn permission from labels, prose, model confidence, screenshots, or successful appearance.

## Common translations

- “Make me a launch command center” -> generate a direct JuanPage, validate it, encode it against the configured host, and return the URL.
- “Make July clickable and update the report” -> one `scope` affordance, page/projection bindings, typed scope state, and dependent metrics.
- “Make this a checklist” -> Boolean facts with `set` affordances bound to fields.
- “Let a human approve deployment and return the answer to my agent” -> M1 URL session, approval policy, typed proposal, receipt, and returned shared URL.
- “Show a read-only summary” -> objects, fields, metrics, and projections without affordances.
- “Add a cool chart control” -> identify the semantic operation first; otherwise render an inert projection.

## Output standard

For ordinary generation requests, return:

1. the hosted JuanPage URL;
2. a brief explanation of what the human can inspect or change;
3. the semantic source only when useful or requested.

For repository implementation work, return or commit:

1. the canonical semantic model or code change;
2. typed interaction and authority behavior;
3. validation and test evidence;
4. migration or removal work when the canonical model changed;
5. a skill evolution candidate only when genuinely justified.

Keep explanations in plain English and distinguish implemented behavior from proposals.
