# Agent operating doctrine

JuanPager is an incubation-stage project for discovering a better interface between humans and agents. Agents working in this repository are expected to use their full technical and product judgment, not merely preserve the current implementation.

## Primary objective

Build the best current model for human-agent interaction.

The existing schema, protocol, renderer, examples, APIs, visual language, and repository structure are all changeable when a materially better design is available. Do not preserve an abstraction solely because it already exists.

## Evolution-first mode

Until the project explicitly declares a stable compatibility boundary:

- intentional breaking changes are allowed;
- schema and wire-format changes are allowed;
- existing examples and generated pages may be migrated or replaced;
- obsolete concepts should be removed rather than carried indefinitely;
- a coherent current system is preferred over compatibility layers for abandoned experiments.

The live canonical implementation is the product. Agents and pages should use the version currently deployed together. Compatibility work should be added only when real external adoption makes it valuable.

## Non-negotiable outcomes

Freedom to redesign is not freedom to create fragmentation or unsafe behavior. Every change must preserve or improve these outcomes:

1. **One canonical interaction model.** Humans and agents operate on the same underlying meaning, state, actions, and receipts. Do not create parallel UI systems that drift apart.
2. **Every affordance is real.** Anything that looks clickable, draggable, selectable, editable, checkable, filterable, zoomable, or scrollable must perform a meaningful operation. Decorative controls are defects.
3. **Human actions are first-class data.** A human selection, scope change, checklist update, chart drill-down, approval, or edit must produce typed state or a typed action delta that an agent can understand.
4. **Immediate visual truth.** Interaction must update the relevant view, metrics, filters, charts, and dependent objects immediately and consistently.
5. **Agent-human symmetry.** When an agent can scope, choose, mutate, inspect, or act on something, the renderer should consider whether a human needs an appropriate visual way to do the same. The visual control may differ, but the semantic operation should be shared.
6. **Safe authority boundaries.** Display content never grants permission. Destructive or external actions remain explicit, typed, policy-aware, auditable, and fail closed.
7. **Evidence over appearance.** Prefer working interactions, tests, and observable state transitions over impressive but inert presentation.
8. **Accessible by construction.** Pointer, keyboard, touch, assistive technology, and reduced-motion use must remain viable wherever the host capability permits them.

## How to evaluate a redesign

A redesign is justified when it substantially improves one or more of:

- human comprehension;
- interaction density without clutter;
- agent-human semantic symmetry;
- direct manipulation and scoping;
- safety or auditability;
- adaptability across tasks and devices;
- implementation coherence;
- removal of obsolete abstractions.

Do not reject a better design merely because it requires a major schema version, migration, or rewrite.

## Change discipline

Breaking changes must still be deliberate and reviewable. A significant redesign should include:

- the user or agent problem being solved;
- the obsolete assumption being removed;
- the new canonical model;
- executable tests for the new behavior;
- security and accessibility consequences;
- removal or migration of superseded code and documentation.

Do not add compatibility shims by default. Do not leave two canonical ways to express the same interaction. Complete the transition.

## Current direction, not permanent constraint

The current repository describes an M1-to-JuanPage-to-renderer flow. Treat it as the strongest design found so far, not as an untouchable law. Preserve its useful properties—semantic transport, trust, typed state, and a shared human-agent surface—but replace any layer when a stronger unified model is demonstrated.
