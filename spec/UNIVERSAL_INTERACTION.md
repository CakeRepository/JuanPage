# Universal interaction and reversible state

Status: incubation implementation contract for JuanPage 2.0.

## State domains

JuanPage state may contain:

- `scopes`: scalar filters over page objects;
- `selections`: named sets of object or datum identifiers;
- `expansions`: expanded hierarchy identifiers;
- `paths`: ordered traversal identifiers;
- `viewports`: `x`, `y`, `zoom`, and optional rotation;
- `ranges`: typed universal values such as intervals or content ranges;
- `playheads`: numeric positions in a temporal or media domain;
- `ordering`: ordered identifiers;
- `groupings`: semantic grouping keys;
- `focus`: a stable restoration anchor;
- `clocks`: time, rate, pause state, and optional step size.

State is bounded, JSON-native, data-only and validated. It cannot contain callbacks, markup, styles, code, components or renderer instructions.

## Direct manipulation

A direct manipulation is valid only when it:

1. changes a named semantic state domain;
2. updates the adaptive representation immediately;
3. emits a typed M1 operation delta;
4. preserves source object, relation or datum identity;
5. remains accessible through native controls and semantic roles;
6. creates no visual affordance without real behavior.

## Transactions

A transaction contains an identifier, label, timestamp and ordered patches. Each patch names its semantic domain, target, expected `before` value and proposed `after` value.

Before commit, all preconditions are checked. A mismatch raises `PageTransactionConflictError`; no patch is applied. This gives the transaction atomic fail-closed behavior.

Supported lifecycle operations:

- `commit`: verify preconditions and apply all patches;
- `cancel`: record cancellation without changing state;
- `undo`: verify the committed `after` state and apply inverse patches in reverse order;
- `redo`: verify the restored `before` state and reapply patches.

The bounded history and future stacks are runtime state, not authority. External or destructive operations still require normal policy and receipt handling.

## M1 representation

Universal interaction state uses ordinary M1 action mutations with reserved operation identifiers:

- `op:interaction.state`;
- `op:interaction.transaction`.

Arguments carry an explicit schema identifier, state domain, key and validated JSON value. Transaction deltas also contain normal fact, scope and selection mutations where applicable. This keeps one M1 delta chain and one session replay model without adding a second wire protocol.

Local state and transaction operations can produce action receipts. Record-only share links replay facts, scopes, selections, interaction state, transactions and receipts without gaining remote execution authority.

## Adaptive rendering

`renderPage` is the only renderer. It chooses representations for categorical, temporal, matrix, hierarchy, network, spatial, document and stream projections from host capabilities and semantic meaning.

The public schema does not contain `calendarComponent`, `mapComponent`, `treeComponent`, `graphComponent`, `documentComponent`, `chatComponent`, or equivalent producer-selected rendering instructions.

## Accessibility

The interaction runtime uses native buttons, inputs, tables, lists, tree roles, labels, outputs and focus anchors. The visual system provides reduced-motion and increased-contrast behavior. Pointer-only or visual-only state changes are defects.
