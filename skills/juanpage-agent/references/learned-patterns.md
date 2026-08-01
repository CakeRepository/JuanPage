# Promoted JuanPage patterns

This ledger contains evidence-backed lessons promoted through `scripts/evolve.py`. Canonical repository source and tests always take precedence.

## Seed patterns

### Bind interaction to meaning, not appearance

A visible control is valid only when an explicit affordance and binding produce typed state, a delta, or a receipt. Decorative sliders, fake checkboxes, and clickable-looking cards are defects.

Evidence: `AGENTS.md`, `docs/AGENT_GUIDE.md`, `src/schema/page.ts`.

### Validate examples against the strict source schema

Documentation examples can drift. Before reusing an example, validate it through the current `validatePage` or M1 materialization path and remove unsupported properties.

Evidence: `src/schema/page.ts`, `src/protocol/meaning.ts`.

## Bind promotion to immutable evidence

Before promotion, verify that the canonical snapshot and every evidence file still match the exact digests recorded when the lesson was proposed.

Evidence: `skills/juanpage-agent/scripts/evolve.py`, `skills/juanpage-agent/tests/test_evolve.py`.

Promotion: `lesson:67ad9701d3d3a5e4` approved by `juanpage-agent:self-evolution-audit` on `2026-08-01T04:48:00Z`.
