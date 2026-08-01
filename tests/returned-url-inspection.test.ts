import { describe, expect, it } from "vitest";
import { buildPageShareUrl } from "../src/encoding/pagePipeline";
import { INTERACTION_COUNT_METADATA_KEY, INTERACTION_LEDGER_METADATA_KEY } from "../src/interaction/ledger";
import { skillFirstRunPage } from "../src/examples/skill-first-run";
import { inspectReturnedUrl } from "../src/inspection/returnedUrl";
import { validatePage } from "../src/schema/page";

const timestamp = "2026-08-01T08:00:00.000Z";

function returnedPage() {
  const objects = skillFirstRunPage.objects.map((object) => object.id === "launch:atlas"
    ? { ...object, fields: object.fields?.map((field) => field.key === "status" ? { ...field, value: "Ready" } : field) }
    : object);
  const activity = [
    { id: "scope", label: "Focus workstream", timestamp, patches: 1 },
    { id: "status-1", label: "Set launch status", timestamp, patches: 1 },
    { id: "copy-1", label: "Copy · affordance:copy-brief", timestamp, patches: 0 },
    { id: "copy-2", label: "Copy · affordance:copy-brief", timestamp, patches: 0 },
    { id: "status-2", label: "Set launch status", timestamp, patches: 1 },
    { id: "status-3", label: "Set launch status", timestamp, patches: 1 },
  ];
  return validatePage({
    ...skillFirstRunPage,
    objects,
    state: { ...(skillFirstRunPage.state ?? {}), scopes: { "scope:workstream": "Marketing" } },
    metadata: {
      ...(skillFirstRunPage.metadata ?? {}),
      [INTERACTION_LEDGER_METADATA_KEY]: JSON.stringify(activity),
      [INTERACTION_COUNT_METADATA_KEY]: activity.length,
    },
  });
}

describe("returned JuanPage URL inspection", () => {
  it("reports exact final changes and grouped human activity", async () => {
    const url = await buildPageShareUrl(returnedPage(), "https://example.test/JuanPage/", "raw");
    const report = await inspectReturnedUrl(url, skillFirstRunPage);

    expect(report.kind).toBe("juanpage");
    expect(report.interactionCount).toBe(6);
    expect(report.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Project Atlas · Launch status", before: "In progress", after: "Ready" }),
      expect.objectContaining({ label: "Focus workstream", before: null, after: "Marketing" }),
    ]));
    expect(report.activity).toEqual([
      { label: "Focus workstream", count: 1 },
      { label: "Set launch status", count: 3 },
      { label: "Copy launch brief", count: 2 },
    ]);
    expect(report.warnings).toEqual([]);
  });

  it("discloses when a direct URL has no baseline for exact values", async () => {
    const url = await buildPageShareUrl(returnedPage(), "https://example.test/JuanPage/", "raw");
    const report = await inspectReturnedUrl(url);
    expect(report.changes).toEqual([]);
    expect(report.warnings[0]).toContain("original JuanPage");
  });
});
