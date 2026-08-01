# Evidence-backed skill evolution

## Goal

Keep the JuanPage Agent aligned with the live protocol and improve it from real engineering evidence without allowing unreviewed prompt drift.

## Evolution states

1. **Observed**: an agent failure, review finding, protocol change, or repeated friction is noticed.
2. **Proposed**: a candidate JSON records one concise lesson, the canonical snapshot digest, and immutable evidence digests.
3. **Validated**: the candidate is checked against current source and supported by tests, a failing-then-passing reproduction, conformance evidence, or a validated example.
4. **Promoted**: an explicit approver identity adds the unchanged lesson to `learned-patterns.md`.
5. **Retired**: a lesson is removed or superseded when canonical code changes.

## Candidate requirements

A candidate must contain:

- a specific title;
- one imperative, reusable lesson;
- at least one repository-relative evidence path;
- the Git blob digest of every evidence file;
- the repository identity and current commit when available;
- a snapshot digest tying it to the canonical source set;
- creation time and status.

Good lesson: “Require `input: { kind: "none" }` for non-value affordances because the strict current schema requires every affordance input.”

Bad lesson: “The last page looked wrong.”

## Promotion gate

Promote only when all are true:

- the candidate belongs to this repository;
- the canonical snapshot exactly matches the snapshot reviewed at proposal time;
- every evidence file still has the exact Git blob digest recorded at proposal time;
- the lesson is not already present;
- the lesson does not conflict with live source or tests;
- the lesson generalizes beyond one naming or styling preference;
- relevant verification passes;
- a human or named reviewing agent explicitly approves promotion.

If canonical source or evidence changes after proposal, do not promote the stale candidate. Re-review the new state and create a new candidate. Promotion never grants authority, changes protocol code, or bypasses repository review.

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

## Verification

Run the evolution regression suite after changing the loop:

```bash
python -m unittest discover -s skills/juanpage-agent/tests -p "test_*.py" -v
```

The suite must prove that valid candidates promote, canonical drift blocks promotion, evidence drift blocks promotion, and same-second proposals do not overwrite one another.

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
