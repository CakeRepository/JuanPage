# Performance budgets

JuanPager treats performance as a conformance property, not a marketing adjective. The smoke benchmark must remain inside these deliberately conservative limits on GitHub-hosted Linux runners.

| Measurement | Budget |
|---|---:|
| M1 fixture, raw | 64 KiB maximum |
| M1 fixture, gzip | 24 KiB maximum |
| Materialized JuanPage, raw | 128 KiB maximum |
| M1 materialization mean | 50 ms maximum |
| `renderPage` mean in JSDOM | 100 ms maximum |
| Invalid fixtures rejected | 100% |
| Repeated materializations | deterministic |

Run the enforced budget with:

```bash
npm run benchmark:budget
```

The command regenerates `benchmark/results/latest.json` and `benchmark/results/latest.md`, then fails if a budget is exceeded.

## Interpretation

These limits are regression alarms for the deterministic reference fixture. They are not universal throughput claims and they do not replace profiling on target devices.

A change that intentionally needs a larger fixture or a different budget must:

1. explain the user or protocol benefit;
2. include before-and-after benchmark evidence;
3. update the budget and this document in the same pull request;
4. preserve deterministic validation and rendering;
5. avoid hiding a regression by weakening the fixture.

## Production measurement

Deployments should additionally measure:

- packet and page size distributions, not only averages;
- materialization and rendering percentiles;
- time from human input to visible state truth;
- delta and receipt round-trip latency;
- nonce-store contention and failure rates;
- memory use for long-lived sessions;
- performance with large object, relation, binding, and projection counts;
- constrained mobile and low-power hardware.
