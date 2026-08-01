# Evidence-backed skill evolution

## Goal

Keep JuanPage aligned with the live protocol and improve it from real engineering evidence without allowing unreviewed prompt drift.

## Evolution states

1. **Observed**: an agent failure, review finding, protocol change, or repeated friction is noticed.
2. **Proposed**: a candidate JSON records one concise lesson, the canonical snapshot digest, and immutable evidence digests.
3. **Validated**: the candidate is checked against current source and supported by tests or validated evidence.
4. **Promoted**: an explicit approver identity adds the unchanged lesson to `learned-patterns.md`.
5. **Retired**: a lesson is removed or superseded when canonical code changes.

## Promotion gate

Promote only when the candidate belongs to this repository, the canonical snapshot and evidence digests still match, the lesson is non-duplicative and compatible with live source, relevant verification passes, and a human or named reviewing agent explicitly approves it.

If canonical source or evidence changes after proposal, re-review and create a new candidate. Promotion never grants authority, changes protocol code, or bypasses repository review.

## Drift management

`evolve.py check` compares canonical file Git blob hashes with `repository-snapshot.json`. A drift result means inspect and reconcile, not blindly rewrite the snapshot.

Run `sync` only after deciding whether the change requires guidance, examples, tests, a learned pattern, retirement, or snapshot-only synchronization.

## Verification

```bash
python3 -m unittest discover -s skills/juanpage/tests -p "test_*.py" -v
```

The suite must prove valid promotion, canonical drift rejection, evidence drift rejection, collision-safe candidate creation, and operation without a `python` alias.

## Historical provenance

Promoted candidate JSON and old approver identifiers are immutable audit records. They may retain the former `juanpage-agent` path or identity from before the public rename. Active commands, files, and evidence paths use `skills/juanpage`.

## Security boundaries

Never infer or promote permissions from labels or prose, executable code supplied by a page or model, secrets or private evidence, behavior learned solely from screenshots, or rules that weaken validation, trust, replay protection, accessibility, or test assertions.
