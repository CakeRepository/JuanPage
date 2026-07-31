# ADR 0002: Interaction truth through affordances and bindings

- Status: Proposed
- Date: 2026-07-31
- Scope: JuanPage schema, M1 human deltas, and `renderPage`

## Context

JuanPager currently separates objects, fields, metrics, and actions, but the relationship between displayed information and human interaction is incomplete.

The existing model can express field controls and operation buttons. It does not cleanly express all of the interactions required by a universal human surface:

- selecting July in a chart to scope every financial metric;
- clicking a metric to inspect the records that produced it;
- checking an item directly in a shopping or recipe list;
- dragging a bounded value while dependent results update;
- selecting one or many objects for a later operation;
- distinguishing a display-only card from an inspectable card;
- guaranteeing that a visual element is not styled as interactive unless a real operation exists.

Today, some interactivity is inferred by the renderer. Cards and table rows may look clickable because an inspector exists. Search, grouping, lenses, and object actions use different state paths. Chart interaction has no first-class schema contract.

That is not strong enough for the repository's interaction-truth doctrine.

## Decision

JuanPage's next canonical schema will separate four concepts:

1. **Information** — objects, fields, metrics, relations, and data projections that may be rendered without accepting input.
2. **Affordances** — typed semantic operations a human or agent may perform.
3. **Bindings** — explicit links between displayed information and affordances.
4. **Interaction state** — typed facts, scopes, selections, and action lifecycle records produced by interaction.

Nothing becomes clickable, editable, selectable, draggable, checkable, zoomable, filterable, or navigable merely because of its visual form. A rendered element is interactive only when it has a valid binding to an available affordance or is trusted runtime chrome with a concrete local effect.

## Information is display-only by default

Objects, fields, metrics, relations, and projections are information. Their default behavior is display-only.

A renderer must not add the following without an explicit binding:

- pointer cursor;
- hover treatment that implies activation;
- `tabindex=0`;
- button, link, checkbox, slider, combobox, or draggable semantics;
- click or keyboard activation handlers;
- hidden navigation or mutation behavior.

Display-only information may still be responsive, accessible, scrollable when content overflows, and available to assistive technology. Scrolling content is not itself an authored semantic action. A visible scrollbar must work normally.

## Affordances describe semantic effects, not components

An affordance is a first-class semantic object. It does not prescribe a React component, HTML tag, or visual design.

The initial effect vocabulary is:

- `inspect` — reveal more information about a target;
- `set` — update a typed fact;
- `scope` — change the subset or context currently being viewed;
- `select` — change one or more selected semantic targets;
- `invoke` — request or propose an operation;
- `navigate` — move to another trusted location;
- `copy` — copy a typed source to the host clipboard.

An affordance may declare an input domain:

- none;
- boolean;
- number entry;
- bounded number adjustment;
- single choice;
- multiple choice;
- text;
- date;
- date range;
- object selection.

The renderer chooses an appropriate accessible control for the available host capabilities. A bounded number adjustment may become a slider with a numeric value on a pointer-capable screen and a stepper or direct numeric input elsewhere. The semantic operation remains the same.

## Bindings make interaction explicit

A binding connects a semantic display target to an affordance and may supply arguments derived from that target.

Bindings may attach to:

- the page;
- an object;
- a field;
- a metric;
- a relation;
- a projection;
- a series;
- an individual projected datum.

Example conceptual shape:

```json
{
  "affordance": "scope-period",
  "args": { "value": "2026-07" }
}
```

A chart bar for July can bind `scope-period` with `value=2026-07`. A recipe item can bind `set-complete` with its object identifier. A metric can bind `inspect-contributors` with the query that produced the value.

The same affordance can therefore be activated through a chart point, table cell, list row, voice command, keyboard command, or agent call without inventing separate operation semantics.

## Scope is first-class typed state

Scopes are not data mutations. They describe the context through which the human is currently viewing or acting on data.

Examples include:

- period = July 2026;
- customer = Acme Manufacturing;
- region = Midwest;
- status in [Blocked, Warning];
- amount >= 10,000;
- selected deployment ring = Pilot.

A scope change must:

1. update affected objects, metrics, projections, and available affordances consistently;
2. be represented as a typed human delta;
3. be available to later actions so an agent knows the context in which the human acted;
4. survive a JuanPager session round trip when the transport supports state return;
5. remain distinct from authority to execute an external action.

M1 must therefore gain typed scope and selection mutations rather than encoding view context as arbitrary display text.

## Proposed JuanPage direction

The exact compact encoding may change during implementation, but the semantic model is:

```json
{
  "version": "next",
  "information": {
    "objects": [],
    "relations": [],
    "metrics": [],
    "projections": []
  },
  "affordances": [
    {
      "id": "scope-period",
      "label": "Period",
      "effect": { "kind": "scope", "scope": "period" },
      "input": {
        "kind": "single-choice",
        "options": [
          { "label": "June", "value": "2026-06" },
          { "label": "July", "value": "2026-07" }
        ]
      }
    },
    {
      "id": "set-purchased",
      "label": "Purchased",
      "effect": {
        "kind": "set",
        "target": { "fromBinding": "object" },
        "field": "purchased"
      },
      "input": { "kind": "boolean" }
    }
  ],
  "bindings": [
    {
      "target": { "kind": "page" },
      "affordance": "scope-period"
    },
    {
      "target": { "kind": "field", "object": "milk", "field": "purchased" },
      "affordance": "set-purchased",
      "args": { "object": "milk" }
    }
  ],
  "state": {
    "scopes": { "period": "2026-07" },
    "selection": {}
  }
}
```

This shape is illustrative. Implementation should optimize the canonical representation after conformance cases are written.

## Projections are data grammar, not component trees

Charts and other visualizations should be represented as semantic data projections rather than arbitrary UI components.

A projection describes:

- source objects or records;
- dimensions;
- measures;
- aggregation;
- ordering;
- grouping;
- optional bindings for the projection, series, or data points.

The renderer may choose bars, a line, a table, a compact list, audio, or another accessible representation according to capabilities. The projection must remain understandable without relying on a specific chart library.

A projection without bindings is display-only. A projection with point bindings may support click, keyboard selection, touch, or equivalent accessible activation.

## Capability and trust behavior

The trust and capability compiler determines which affordances survive into the live page.

If an affordance is unsupported or unauthorized:

- its binding must not create an inert control;
- the underlying information may remain visible when safe;
- the renderer may explain that an operation is unavailable only when that explanation helps the user;
- denied authority must never be inferred from display text or styling.

A renderer must never show a control that it cannot activate meaningfully.

## Runtime chrome

Trusted runtime chrome may exist without agent-authored bindings when it has a concrete local effect. Examples include closing an inspector, changing an available renderer lens, resetting local state, or copying a session return link.

Runtime chrome must still follow interaction truth:

- it must work;
- it must expose correct accessibility semantics;
- it must not impersonate an agent-authored business operation;
- state changes that matter to the agent must become typed session state.

## Immediate visual truth

A successful local interaction must update every dependent representation from the same state transition.

Examples:

- checking a recipe item updates the checkbox, completion metric, grouped list, and returned delta;
- selecting July updates the chart emphasis, financial totals, records, and action context;
- changing a bounded value updates the displayed value and dependent calculations while the control remains usable;
- selecting objects updates batch-action availability and the session selection state.

Separate widgets must not maintain conflicting private copies of the same semantic state.

## Validation rules

The next schema validator must reject:

- bindings to unknown affordances;
- bindings to unknown semantic targets;
- input domains incompatible with the affordance effect;
- display targets that claim interactive behavior without a binding;
- bindings whose required arguments cannot be resolved;
- duplicate affordance, scope, or projection identifiers;
- executable affordances without a policy decision after trust compilation;
- visual projections that reference unavailable fields or measures;
- controls that cannot produce a typed local transition, delta, navigation, copy, or receipt.

## Migration direction

The current `actions` and `actionIds` concepts should not be expanded indefinitely.

They should be replaced by the unified affordance and binding model once the following are implemented together:

1. schema and validator;
2. M1 affordance, scope, and selection representation;
3. `renderPage` binding resolution;
4. typed scope and selection deltas;
5. session replay;
6. accessibility and interaction-truth tests;
7. at least one checklist example and one scoped financial projection example.

Because JuanPager is in evolution-first incubation, this transition may be intentionally breaking. The repository should complete the migration rather than maintaining two canonical interaction models.

## Consequences

### Positive

- display-only information can never accidentally imply functionality;
- every authored interaction is discoverable, typed, testable, and auditable;
- chart interaction, checklist updates, filters, selection, and operation buttons share one model;
- humans and agents invoke the same semantic operations;
- renderers can adapt controls without changing meaning;
- session returns preserve the context in which a human acted.

### Costs

- JuanPage and M1 require a coordinated breaking change;
- existing examples and conformance fixtures must migrate;
- the renderer needs dependency-aware state recomputation;
- projection validation and accessible chart alternatives require meaningful engineering work;
- capability negotiation must become more precise.

These costs are accepted because the current action attachment model cannot support a truthful universal interaction surface without accumulating exceptions.
