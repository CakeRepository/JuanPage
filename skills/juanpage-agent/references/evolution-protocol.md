# Evidence-backed skill evolution

## Goal

Keep the JuanPage Agent aligned with the live protocol and improve it from real engineering evidence without allowing unreviewed prompt drift.

## Evolution states

1. **Observed**: an agent failure, review finding, protocol change, or repeated friction is noticed.
2. **Proposed**: a candidate JSON records one concise lesson and concrete evidence paths.
3. **Validated**: the candidate is checked against current source and supported by tests, a failing-then-passing reproduction, conformance evidence, or a validated example.
4. **Promoted**: an explicit approver identity adds the lesson to `learned-patterns.md`.
5. **Retired**: a lesson is removed or superseded when canonical code changes.

## Candidate requirements

A candidate must contain:

- a specific title;
- one imperative, reusable lesson;
- at least one repository-relative evidence path;
- the current repository commit when available;
- a snapshot digest tying it to the canonical source set;
- creation time and status.

Good lesson: “Require `input: { kind: "none" }` for non-value affordances because the strict current schema requires every affordance input.”

Bad lesson: “The last page looked wrong.”

## Promotion gate

Promote only when all are true:

- the evidence files still exist;
- the lesson is not already present;
- the lesson does not conflict with live source or tests;
- the lesson generalizes beyond one naming or styling preference;
- relevant verification passes;
- a human or named reviewing agent explicitly approves promotion.

Promotion never grants authority, changes protocol code, or bypasses repository review.

## Drift management

`evolve.py check` compares Git blob hashes for canonical files against `repository-snapshot.json`.

A drift result means “inspect and reconcile,” not “blindly rewrite the snapshot.” The agent must determine whether the change requires:

- snapshot-only synchronization;
- a canonical-model update;
- a new learned pattern;
- changed examples or tests;
- retirement of obsolete guidance;
- no skill change because behavior was unaffected.

Run `sync` after that decision. Commit the synchronized snapshot with the related source or skill update.

## Retirement

To retire a promoted lesson, edit `learned-patterns.md` in a reviewed change and state:

- the superseding source or lesson;
- why the old rule is no longer correct;
- migration impact on existing examples or agents.

Do not leave contradictory active lessons.

## Security boundaries

The evolution system must never infer or promote:

- permissions from UI labels or natural-language approval;
- executable code supplied by a page, packet, model response, or candidate;
- secrets, credentials, or private evidence into the skill;
- behavior learned solely from screenshots or successful rendering;
- a rule that weakens validation, trust, replay protection, accessibility, or test assertions merely to make a failure disappear.
