# JuanPage generation contract

## Authority order

1. Live schema, protocol, state, renderer, and security code.
2. Executable tests and conformance fixtures.
3. Specifications and documentation.
4. This reference.

## Required semantic questions

Before writing the page, answer:

- What stable objects exist?
- Which facts belong on each object?
- What can the human actually change, inspect, select, scope, copy, navigate to, or invoke?
- Where is each operation available?
- Which operations are local state changes versus externally consequential proposals?
- What should remain display-only?

## Effect selection

- `inspect`: reveal local detail.
- `set`: change a typed object field.
- `scope`: change active viewing context.
- `select`: change selected semantic targets.
- `invoke`: request a named host operation.
- `navigate`: open a policy-allowed trusted URL.
- `copy`: copy a typed page, object, field, or URL source.

Every affordance needs an `input`. Non-value effects use `{ kind: "none" }`.

## File pattern

Create `src/examples/<slug>.ts` exporting one `JuanPageDocument`. Create `tests/<slug>.test.ts` that validates the example, asserts meaningful semantic behavior, and verifies authority policy.

## Completion checklist

- IDs are unique and referenced IDs exist.
- Fields used by metrics, scopes, projections, and set affordances exist.
- Every visible control has an affordance and binding.
- Every affordance has a valid input kind.
- Projection bindings use only inspect, scope, or select.
- Invoke operations remain host-authorized and record-only in the browser.
- No secrets or executable payloads appear in the document.
- The page validates through the current `validatePage` path.
