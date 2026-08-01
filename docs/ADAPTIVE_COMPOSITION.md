# Adaptive composition

JuanPage does not expose a component tree. Producers describe a semantic world; `renderPage` remains the only renderer.

The runtime now has an internal composition pass for ordinary objects, matching the projection algebra already used for categorical, temporal, matrix, hierarchy, network, spatial, document, and stream data.

```text
JuanPage semantic graph
  -> scope and typed state
  -> runtime composition inference
  -> one accessible DOM surface
```

## What the runtime infers

The composition pass uses bounded semantic evidence already present in the document:

- object type and reading order;
- image and semantic media values;
- prominent quantitative fields;
- long-form content and code fields;
- field density;
- real bindings and edit affordances;
- group size and neighboring forms.

It can choose hero, stat, media, document, activity, control, or record forms and arrange groups as spotlight, metrics, stream, ledger, or mosaic flows. These are private runtime plans, not public producer instructions.

## Editable page identity

A page may designate one ordinary object as its visible identity with metadata:

```json
{
  "metadata": { "juanpager.pageObject": "page-identity" },
  "objects": [{
    "id": "page-identity",
    "type": "page-identity",
    "name": "Fallback title",
    "fields": [
      { "key": "title", "value": "Editable title", "display": "hidden" },
      { "key": "intent", "value": "Editable intent", "display": "hidden" },
      { "key": "description", "value": "Editable description", "display": "hidden" }
    ]
  }]
}
```

Normal `set` affordances bind to those fields. The runtime renders their controls beside the visible header, persists changes through the existing typed state engine, and includes them in shared URLs. The identity object is not duplicated in the object flow.

This pattern also works for object names, summaries, statuses, groups, and types: add a same-named typed field and bind a `set` affordance to it. The runtime treats that field as the editable semantic value while preserving the object's stable ID.

## Invariant

Adaptive composition must never accept HTML, CSS, JavaScript, callbacks, framework components, pixel coordinates, or producer-selected widgets. A new visual form is admitted only when it is a deterministic runtime interpretation of canonical meaning and still produces typed human state.
