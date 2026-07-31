import { afterEach, describe, expect, it } from "vitest";
import { materializeMeaningPacket, MeaningOpcode, type MeaningPacket } from "../src/protocol/meaning";
import { renderPage } from "../src/rendering/renderPage";
import {
  formatSemanticValue,
  isSemanticValue,
  matrixValue,
  pageValueSchema,
  validatePage,
} from "../src/schema/page";

const semanticValues = [
  ["instant", "2026-07-31T20:00:00.000Z"],
  ["interval", "2026-07-31T20:00:00.000Z", "2026-07-31T21:00:00.000Z", true, false],
  ["duration", 45, "minute"],
  ["recurrence", "FREQ=WEEKLY;BYDAY=MO", "America/Chicago"],
  ["coordinate", "EPSG:4326", -93.242, 44.884, null],
  ["bounds", "EPSG:4326", -94, 44, -93, 45, null, null],
  ["path", "EPSG:4326", 2, -93.2, 44.8, -93.1, 44.9],
  ["geometry", "polygon", "EPSG:4326", 2, -93.2, 44.8, -93.1, 44.8, -93.1, 44.9],
  ["content", "text/markdown", null, "# One semantic document", "Specification", null],
  ["content-range", "doc:spec", "line", 10, 20],
  ["media", "video/mp4", "https://example.com/demo.mp4", "Demo", 90, "track:captions"],
  ["time-range", 10, 25, "track:captions"],
  ["quantity", 12.5, "kg"],
  ["uncertainty", 50, 45, 55, 0.95],
  ["distribution", "ms", "p50", 20, "p95", 80],
  matrixValue(["North", "South"], ["Q1", "Q2"], [1, 2, 3, 4]),
] as const;

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

describe("universal PageValue algebra", () => {
  it("validates every theory-of-everything value family as compact data-only tuples", () => {
    for (const value of semanticValues) {
      expect(pageValueSchema.parse(value)).toEqual(value);
      expect(isSemanticValue(value)).toBe(true);
    }
  });

  it("flows through the canonical JuanPage schema and renderer", () => {
    const page = validatePage({
      version: "2.0",
      title: "Universal values",
      objects: semanticValues.map((value, index) => ({
        id: `value:${index}`,
        type: "semantic-value",
        name: String(value[0]),
        fields: [{ key: "value", value }],
      })),
    });
    const mount = document.createElement("div");
    document.body.append(mount);
    renderPage(page, mount);
    expect(page.objects).toHaveLength(semanticValues.length);
    expect(mount.textContent).toContain("coordinate");
    expect(mount.textContent).toContain("EPSG:4326");
  });

  it("flows through M1 facts without adding another transport format", () => {
    const packet: MeaningPacket = [
      1,
      "pkt:universal-values",
      1,
      null,
      [],
      [
        [MeaningOpcode.Header, [1, "Universal values"], null, null, 0],
        [MeaningOpcode.Entity, "e:site", "type:site", [1, "North site"], null, null, 0, null, [], []],
        [MeaningOpcode.Fact, "e:site", "location", semanticValues[4], [1, "Location"], 0, 1, null],
      ],
    ];
    const page = materializeMeaningPacket(packet);
    expect(page.objects[0]?.fields?.[0]?.value).toEqual(semanticValues[4]);
  });

  it("rejects malformed reserved tuples and unsafe resources", () => {
    expect(pageValueSchema.safeParse(["interval", "later", "earlier", true, true]).success).toBe(false);
    expect(pageValueSchema.safeParse(["path", "EPSG:4326", 2, 1, 2, 3]).success).toBe(false);
    expect(pageValueSchema.safeParse(["media", "video/mp4", "javascript:alert(1)", null, null, null]).success).toBe(false);
    expect(pageValueSchema.safeParse(["matrix", 2, 2, '["A"]', '["X","Y"]', 1, 2, 3, 4]).success).toBe(false);
  });

  it("formats typed values for adaptive surfaces without executing content", () => {
    expect(formatSemanticValue(["quantity", 12.5, "kg"])).toContain("12.5 kg");
    expect(formatSemanticValue(["coordinate", "EPSG:4326", -93.2, 44.8, null])).toContain("EPSG:4326");
    expect(formatSemanticValue(matrixValue(["A"], ["B"], [1]))).toBe("1×1 matrix");
  });
});
