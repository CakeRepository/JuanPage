# JuanPager Theory of Everything

JuanPager's goal is not to collect every button, chart, canvas, game control, or historical widget into a larger component library. That approach can never reach completeness because presentation patterns are unbounded.

The goal is **representational completeness**: every useful human interface must be reducible to one semantic world model, one trusted interaction model, one adaptive renderer, and typed human output.

```text
meaning + relationships + state + projection + affordances + authority + modality
→ JuanPage 2.0
→ renderPage
→ typed deltas and receipts
```

## The universal interface theorem

A human interface represents one or more of these domains:

1. records and attributes;
2. quantitative computation;
3. hierarchy and paths;
4. networks and relationships;
5. time and ordered change;
6. space and geometry;
7. documents and addressable content;
8. media and sensory streams;
9. communication and presence;
10. simulation and continuous state;
11. authority, trust, and consequential operations;
12. alternate sensory and motor modalities.

An interface then gives a human one or more real operations over that representation: inspect, set, scope, select, navigate, copy, invoke, approve, reject, or transact. Presentation is a runtime decision. Meaning and authority are protocol decisions.

This is why JuanPager does not need a `calendarComponent`, `mapComponent`, `spreadsheetComponent`, or `chatComponent` in its public schema. It needs the semantic primitives that make calendars, maps, spreadsheets, and chats truthful and operable.

## Reduction examples

| Historical interface | Semantic reduction |
|---|---|
| Spreadsheet | ordered records, typed fields, formulas, ranges, selections, edits, transactions |
| Dashboard | metrics, projections, scopes, selections, inspect and invoke affordances |
| Calendar or Gantt chart | temporal intervals, recurrence, dependencies, temporal scopes and edits |
| Map or floor plan | objects, geometry, spatial relationships, viewport state and selection |
| Knowledge graph | objects, typed directed relations, traversal scope and inspection |
| Document editor | ordered content, addressable ranges, annotations, revisions and transactions |
| Audio or video editor | media resources, tracks, time ranges, playhead state and edits |
| Chat or email | ordered authored events, thread topology, delivery state and operations |
| CAD or digital twin | geometry, constraints, continuous state, viewport, transactions and receipts |
| Game | simulation clock, world state, actions, authority, feedback and alternate modalities |

If a proposed interface cannot be reduced this way, the missing concept belongs in the canonical semantic model. It must not be hidden inside arbitrary agent-authored HTML or a second renderer.

## What 100% means

There are two separate scores:

### Accounting completeness

Every known interface domain is present in `spec/interface-capabilities.json`, with its semantic primitives, evidence, and named gaps. The repository must keep this at **100% accounted for**. CI fails when a required domain disappears, an implemented claim lacks evidence, or a partial domain hides its missing semantics.

### Implementation completeness

A domain is implemented only when the canonical schema, M1 compilation path where applicable, `renderPage`, typed human output, accessibility behavior, hostile-input behavior, and executable tests all support it. The atlas must state `partial` or `missing` until that evidence exists.

The repository must never turn accounting completeness into a false claim that all future interfaces have already been implemented.

## Current semantic kernel

JuanPage 2.0 already has a strong universal kernel:

- objects and typed fields;
- typed relationships;
- derived metrics and aggregate projections;
- scopes and selections;
- semantic affordances and explicit bindings;
- fact, scope, selection, operation, and receipt output;
- capability and trust compilation;
- one accessible adaptive renderer.

This kernel covers records, common controls, operational dashboards, approvals, catalog-like experiences, checklists, forms, and basic data exploration without a component tree.

## Canonical expansion sequence

The next work should expand the semantic kernel rather than add one-off widgets.

### 1. Universal value algebra

Add typed values for:

- instants, intervals, durations, and recurrence;
- coordinates, bounds, paths, and geometry;
- content resources and addressable ranges;
- media resources, tracks, and time ranges;
- uncertainty, units, distributions, and matrices.

Values must remain data-only, bounded, serializable, safe to validate, and transportable through M1.

### 2. Generalized projection algebra

Replace the assumption that a projection is only a one-dimensional aggregate with semantic projection families:

- categorical and quantitative;
- temporal;
- matrix;
- hierarchy;
- network;
- spatial;
- document;
- ordered stream.

These are descriptions of relationships and measures, not instructions to draw a particular chart or component.

### 3. Universal interaction state

Extend typed state beyond scopes and selections to include:

- expansion and path state;
- viewport and zoom state;
- cursor, range, and playhead state;
- ordering and grouping state;
- focus restoration anchors;
- simulation clock and pause state.

Only state that has semantic value to both humans and agents belongs in the protocol.

### 4. Transactions and reversible change

Add typed transaction groups with preconditions, patches, commit, cancel, undo, redo, conflict, and receipts. This is necessary for document editing, spreadsheets, design tools, simulations, and other multi-step work.

### 5. Alternate-modality contract

Every semantic surface must be projectable to pointer, keyboard, touch, voice, switch access, screen readers, braille, high contrast, reduced motion, and future modalities where host capabilities permit. The semantic operation stays the same while the control changes.

## Admission rule for new UI ideas

A new interface pattern is accepted only when its author answers:

1. What meaning is represented?
2. Which canonical domain and primitive express it?
3. What human operation changes or scopes it?
4. What typed delta or receipt records that operation?
5. What authority is required?
6. How does the runtime expose it without false affordances?
7. How is it usable without a pointer or visual-only cue?
8. What executable evidence proves the claim?

If the current model cannot answer these questions, improve the one canonical model. Do not introduce another public schema, renderer, executable component format, or compatibility island.

## The invariant

The theory of everything is not a frozen list of widgets. It is a repository that can account for every representational domain, honestly expose what remains missing, and evolve one coherent semantic kernel until every meaningful human and agent operation can share the same world.
