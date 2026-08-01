---
name: juanpage-agent
description: Design, generate, validate, implement, review, debug, and evolve JuanPager semantic experiences. Use for work involving JuanPage 2.0 documents, M1 packets or deltas, affordances, bindings, projections, typed human state, renderPage, agent-human sessions, trusted execution, examples, tests, or repository architecture in CakeRepository/juanpager. Treat the checked-out repository as canonical, preserve one semantic interaction model and one renderer, enforce real interactions and trust boundaries, and maintain this skill through an evidence-backed self-evolution loop when the protocol changes or repeated failures reveal a reusable lesson.
---

# JuanPage Agent

Use JuanPager as a semantic interaction protocol, not a component generator. Describe meaning, available operations, and typed state; let the trusted runtime choose the human presentation.

## Start with the live repository

1. Locate the JuanPager repository root.
2. Run:

   ```bash
   python skills/juanpage-agent/scripts/evolve.py check --repo .
   ```

3. If the snapshot is stale, inspect the changed canonical files before designing anything. Run `sync` only after understanding the changes, and include the updated snapshot and any necessary skill edits in the same pull request.
4. Read `references/canonical-model.md`. Read the live source files it names whenever exact types, opcodes, limits, or behavior matter.
5. Treat source and executable tests as stronger authority than prose documentation. When they disagree, fix the documentation or skill in the same change when practical.

Do not continue from remembered JuanPage versions or examples without checking the current repository.

## Choose the producer boundary

- Use **M1** when meaning crosses a transport, trust, capability, signing, interoperability, or external-agent boundary.
- Use **JuanPage directly** only when the producer already owns a canonical validated semantic graph and does not need M1 trust compilation.
- Both paths must converge on the current JuanPage schema and the single `renderPage` runtime.
- Do not introduce another component tree, page schema, renderer, markup format, or agent-authored executable surface.

## Model the interaction before coding

Translate the request into these semantic layers:

1. **Information**: stable objects, fields, relations, metrics, evidence, and projections.
2. **Affordances**: the narrowest real effect available to the human.
3. **Bindings**: the exact semantic target where each affordance is available.
4. **State**: facts, scopes, selections, interaction state, transactions, deltas, and receipts.
5. **Authority**: trust, permission policy, capabilities, approval, idempotency, and host execution.

Information is inert by default. Never make something look interactive unless a valid affordance and binding produce a typed result.

## Use the semantic effects precisely

- `inspect`: reveal more information locally.
- `set`: update a typed fact.
- `scope`: change the active viewing context without rewriting domain facts.
- `select`: change one or more selected semantic targets.
- `invoke`: request or propose an externally consequential operation.
- `navigate`: move to a policy-allowed trusted URL.
- `copy`: copy a typed source through the host clipboard.

Do not encode scope as a fact edit, inspection as invocation, approval as display text, or navigation as arbitrary execution.

## Build current-schema payloads

When authoring JuanPage:

- Use `version: "2.0"` unless the live schema has deliberately changed.
- Give every object, relation, metric, scope, projection, affordance, and binding a stable unique ID.
- Keep binding targets and referenced IDs valid.
- Put the semantic destination in the binding target. Do not invent unsupported effect fields from stale examples.
- Supply every field required by the live strict Zod schema, including an affordance input.
- Use only input kinds implemented by the live schema.
- Describe projections as data relationships, not chart types or widget instructions.
- Bind projection points only when activating them performs a real effect such as scope or selection.
- Keep display-only content free of fake control metadata.
- Never include HTML, CSS, JavaScript, callbacks, framework components, iframes, shell commands, SQL, plugins, or arbitrary network instructions.
- Never place secrets or bearer credentials in pages, packets, URL fragments, notifications, or receipts.

Validate with the repository's exported validators or the same code path used by production. Do not rely on visual plausibility.

## Implement repository changes

1. Reuse the canonical schema, materializer, state engine, renderer, and public SDK entrypoints.
2. Extend the current model only when a concrete interaction cannot be represented coherently.
3. When making a breaking redesign, complete the transition: schema, protocol, materialization, state, renderer, examples, tests, docs, and obsolete-code removal. Do not leave two canonical ways to express the same meaning.
4. Preserve agent-human symmetry: if an agent can meaningfully scope, choose, mutate, inspect, approve, or act, consider the corresponding human operation on the same semantic state.
5. Preserve accessibility, immediate visual truth, typed deltas, replay safety, and fail-closed authority boundaries.
6. Keep browser and self-contained URL behavior record-only for remote effects. Host-selected executors must re-authorize and enforce idempotency at the actual side-effect boundary.

## Verify behavior

Run the narrowest relevant tests first, then the repository checks required by the change. The default completion bar is:

```bash
npm run check:one-runtime
npm test
npm run build
```

Also run `npm run test:e2e` for renderer, browser, PWA, URL-session, or human-interaction changes; run conformance, consumer, benchmark, or release checks when those boundaries change.

When changing the skill evolution loop, run:

```bash
python -m unittest discover -s skills/juanpage-agent/tests -p "test_*.py" -v
```

Tests must prove semantics, not just appearance:

- every visible control has a working affordance and binding;
- human actions create the expected typed state or delta;
- dependent metrics, projections, and objects update immediately;
- invalid references and unsupported shapes fail closed;
- denied or untrusted remote effects never reach execution;
- approval and replay behavior preserve mutation IDs and idempotency keys;
- pointer, keyboard, touch, reduced-motion, and assistive semantics remain viable where applicable.

Do not add blind sleeps, skip tests, weaken assertions, or create decorative interactions.

## Self-evolve through evidence

The skill may improve itself, but must not silently rewrite its rules from one anecdote.

Create an evolution candidate when any of these occurs:

- a canonical source changes and the current skill would mislead an agent;
- the same agent mistake appears more than once;
- a review comment identifies a generalizable missing guardrail;
- a failing test exposes a reusable modeling or verification rule;
- a new protocol capability needs a repeatable workflow.

Record a candidate with concrete repository evidence:

```bash
python skills/juanpage-agent/scripts/evolve.py propose \
  --repo . \
  --title "Use binding targets as semantic destinations" \
  --lesson "Do not duplicate object targets inside effects; the binding owns placement." \
  --evidence src/schema/page.ts \
  --evidence tests/page.test.ts
```

The candidate records the canonical snapshot and Git blob digest of each evidence file. Promote it only after confirming that it is general, non-duplicative, compatible with the canonical source, and supported by passing tests or a validated example:

```bash
python skills/juanpage-agent/scripts/evolve.py promote \
  --repo . \
  --candidate skills/juanpage-agent/evolution/candidates/<file>.json \
  --approved-by <reviewer-or-agent-id>
```

Promotion must fail if canonical source or any evidence file changed after proposal. Re-review and re-propose rather than approving stale evidence. Promotion appends a traceable lesson to `references/learned-patterns.md`; it does not alter protocol code. Commit the candidate, promoted lesson, snapshot, tests, and related code or documentation together for review.

Never learn permission from labels, prose, model confidence, screenshots, or successful appearance. Never auto-promote a lesson without evidence and an explicit approval identity.

See `references/evolution-protocol.md` for the full governance rules.

## Common translations

- “Make July clickable and update the whole report” → one `scope` affordance, page/projection bindings, typed scope state, dependent projections and metrics.
- “Make this a checklist” → Boolean facts with `set` affordances bound to fields; checked state is typed data, not visual-only UI state.
- “Let the human approve deployment” → signed M1 proposal, approval policy, durable session completion, host-side authorization and idempotent executor, terminal receipt.
- “Show a read-only summary” → objects, fields, metrics, and projections without affordances or bindings.
- “Add a cool chart control” → first identify the semantic operation. If no real operation exists, render an inert projection instead of a decorative control.

## Output standard

For a design or implementation task, return or commit:

1. the canonical semantic model or code change;
2. the typed interaction and authority behavior;
3. validation and test evidence;
4. migration or removal work when the canonical model changed;
5. a skill evolution candidate only when a genuinely reusable lesson was discovered.

Keep explanations in plain English and distinguish implemented behavior from proposals.
