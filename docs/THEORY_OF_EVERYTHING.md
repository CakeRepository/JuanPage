# JuanPager Theory of Everything

JuanPager does not attempt to collect every historical widget into a larger component library. Presentation patterns are unbounded. The goal is **representational completeness**: every useful human interface must reduce to one semantic world model, one trusted interaction model, one adaptive renderer, and typed human output.

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

It then gives a human one or more real operations over that representation: inspect, set, scope, select, expand, traverse, pan, zoom, range, play, order, group, transact, navigate, copy, invoke, approve, reject, commit, cancel, undo, or redo. Presentation is a runtime decision. Meaning, state, and authority are protocol decisions.

This is why JuanPager does not need a `calendarComponent`, `mapComponent`, `spreadsheetComponent`, `treeComponent`, or `chatComponent` in its public schema. It needs the semantic primitives that make those surfaces truthful and operable.

## Reduction examples

| Historical interface | Semantic reduction |
|---|---|
| Spreadsheet | ordered records, typed fields, formulas, ranges, selections, edits, transactions |
| Dashboard | metrics, projections, scopes, selections, inspect and invoke affordances |
| Calendar or Gantt chart | temporal intervals, recurrence, dependencies, ranges, playheads and edits |
| Map or floor plan | objects, geometry, spatial relationships, viewport, zoom and selection |
| Knowledge graph | objects, typed directed relations, traversal paths and inspection |
| Document editor | ordered content, addressable ranges, annotations, revisions and transactions |
| Audio or video editor | media resources, tracks, time ranges, playheads and edits |
| Chat or email | ordered authored events, thread topology, grouping, delivery state and operations |
| CAD or digital twin | geometry, constraints, clocks, viewport, transactions and receipts |
| Game | simulation clock, world state, actions, authority, feedback and alternate modalities |

If a proposed interface cannot be reduced this way, the missing concept belongs in the canonical semantic model. It must not be hidden inside arbitrary agent-authored HTML or a second renderer.

## What 100% means

There are two separate scores.

### Accounting completeness

Every known interface domain is present in `spec/interface-capabilities.json`, with semantic primitives, evidence, and named gaps. The repository keeps this at **100% accounted for**. CI fails when a domain disappears, an implemented claim lacks evidence, or a partial domain conceals its remaining work.

### Implementation completeness

A domain is implemented only when JuanPage, the M1 path where applicable, `renderPage`, typed human output, accessibility behavior, hostile-input behavior, and executable tests support it. The atlas remains `partial` wherever a real semantic or host-adapter gap remains.

Accounting completeness must never become a false claim that all future interfaces are already implemented.

## Current semantic kernel

JuanPage 2.0 now includes:

- objects, typed fields, relationships and evidence;
- universal typed values for time, space, content, media, units, uncertainty, distributions and matrices;
- metrics and eight semantic projection families;
- scopes, selections, expansions, paths, viewports, ranges, playheads, ordering, grouping, focus and clocks;
- semantic affordances and explicit bindings;
- atomic transactions with preconditions, conflict detection, commit, cancel, undo and redo;
- fact, scope, selection, interaction-state, transaction, operation and receipt output through M1;
- capability and trust compilation;
- one accessible adaptive renderer and one visual system.

## Implementation ledger

### Tranche 1: universal values and projections

Implemented:

- compact typed values for instants, intervals, durations, recurrence, coordinates, bounds, paths, geometry, content, ranges, media, time ranges, quantities, uncertainty, distributions, and matrices;
- direct use of those tuples as ordinary M1 facts and JuanPage fields;
- reserved-tag validation so malformed semantic tuples fail closed instead of becoming untyped lists;
- deterministic categorical, temporal, matrix, hierarchy, network, spatial, document, and stream projections;
- unit-safe aggregation, hierarchy-cycle rejection, safe resource URL validation and explicit bounds.

### Tranche 2: universal interaction runtime

Implemented:

- typed expansion, path, viewport, range, playhead, ordering, grouping, focus and simulation-clock state;
- adaptive representations for all eight projection families through `renderPage`;
- working hierarchy expansion, network traversal, spatial pan and zoom, temporal playheads and ranges, matrix interaction, document ordering and stream grouping;
- atomic multi-patch transactions with optimistic preconditions and fail-closed conflicts;
- commit, cancel, undo and redo with typed state history;
- M1-compatible state and transaction operations, record-only session replay, and action receipts;
- focus restoration, keyboard-native controls, semantic roles, high-contrast rules and reduced-motion behavior;
- public renderer, state and interaction SDK entrypoints;
- architecture gates that reject parallel renderers, component instructions, inert controls and removal of the universal state kernel.

This tranche does not add separate calendar, map, graph, editor, chat, game, or media schemas. The runtime derives each representation from the same objects, values, relationships, projections, state and bindings.

Current atlas score:

- 5 implemented domains;
- 8 partial domains;
- 0 missing domains;
- 100% accounting completeness.

No known interface domain is now entirely absent from the canonical kernel. Partial domains remain where deeper semantics or host adapters are still genuinely required, including recurrence expansion, 3D geometry, media playback, live presence, multi-author merge, continuous constraint solving and alternate-modality negotiation.

## Canonical expansion sequence

### 1. Universal value algebra — implemented foundation

Values are data-only, bounded, serializable, safe to validate, and transportable through ordinary M1 facts. See `spec/UNIVERSAL_VALUES.md`.

### 2. Generalized projection algebra — implemented foundation

Projection families describe categorical, temporal, matrix, hierarchy, network, spatial, document and ordered-stream meaning. They never instruct the runtime to instantiate a producer-selected component.

### 3. Universal interaction state — implemented foundation

State meaningful to humans and agents includes expansion, paths, viewports, ranges, playheads, ordering, grouping, focus and clocks. It persists locally and through record-only M1 sessions.

### 4. Transactions and reversible change — implemented foundation

Typed transactions carry patches and preconditions. Conflicts fail closed. Commit, cancel, undo and redo are first-class operations and can produce receipts. See `spec/UNIVERSAL_INTERACTION.md`.

### 5. Alternate-modality contract — continuing conformance work

Semantic operations are exposed through native pointer, keyboard and touch controls, accessible roles, focus restoration, high contrast and reduced motion. Formal voice, switch, braille, haptic and future-modality negotiation remains an explicit partial-domain obligation rather than a second UI schema.

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

The Theory of Everything is not a frozen list of widgets. It is one repository that accounts for every representational domain, exposes remaining gaps honestly, and evolves one coherent semantic kernel until every meaningful human and agent operation can share the same world.
