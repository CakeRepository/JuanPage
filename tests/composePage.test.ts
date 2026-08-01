import { describe, expect, it } from "vitest";
import { composeGroup, composeObject } from "../src/rendering/composePage";
import type { PageObject } from "../src/schema/page";

function object(input: Partial<PageObject> & Pick<PageObject, "id" | "type" | "name">): PageObject {
  return input;
}

describe("adaptive composition", () => {
  it("turns a first narrative object into a full-width hero without a component instruction", () => {
    const plan = composeObject(object({
      id: "vision",
      type: "vision",
      name: "One UI for everything",
      summary: "A long semantic north star that explains why this object should establish the reading order for the world around it.",
    }), { groupIndex: 0, indexInGroup: 0, groupSize: 1, interactive: false, editable: false });
    expect(plan).toMatchObject({ form: "hero", span: "full", density: "calm" });
  });

  it("recognizes numeric summaries as stat surfaces", () => {
    const plan = composeObject(object({
      id: "revenue",
      type: "metric",
      name: "Revenue",
      fields: [{ key: "value", value: 42000, display: "prominent", format: "currency" }],
    }), { groupIndex: 1, indexInGroup: 0, groupSize: 4, interactive: false, editable: false });
    expect(plan.form).toBe("stat");
    expect(plan.span).toBe("compact");
  });

  it("composes activity-heavy groups as streams", () => {
    const items = ["one", "two", "three"].map((id) => object({ id, type: "activity", name: id }));
    expect(composeGroup(items, 2).flow).toBe("stream");
  });
});
