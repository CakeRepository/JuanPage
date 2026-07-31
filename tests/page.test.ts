import { describe, expect, it } from "vitest";
import { decodePage, encodePage } from "../src/encoding/pagePipeline";
import { futureWorkspace } from "../src/examples/future-workspace";
import { DocumentValidationError } from "../src/schema/errors";
import { validatePage } from "../src/schema/page";

describe("JuanPage 2.0", () => {
  it("validates the semantic surface demo", () => {
    const page = validatePage(futureWorkspace);
    expect(page.version).toBe("2.0");
    expect(page.objects).toHaveLength(8);
    expect(page.affordances?.length).toBeGreaterThan(5);
    expect(page.bindings?.length).toBeGreaterThan(5);
  });

  it("round trips through one v5 payload", async () => {
    const encoded = await encodePage(futureWorkspace);
    const decoded = await decodePage(encoded, "gz");
    expect(decoded).toEqual(futureWorkspace);
  });

  it("supports a page scope through an affordance and binding", () => {
    const page = validatePage({
      version: "2.0",
      title: "Scoped financials",
      objects: [
        { id: "june", type: "financial", name: "June", fields: [{ key: "period", value: "2026-06" }] },
        { id: "july", type: "financial", name: "July", fields: [{ key: "period", value: "2026-07" }] },
      ],
      scopes: [{ id: "period", label: "Period", field: "period", initial: "2026-07" }],
      affordances: [{
        id: "scope-period",
        label: "Period",
        effect: { kind: "scope", scope: "period" },
        input: {
          kind: "choice",
          options: [
            { label: "June", value: "2026-06" },
            { label: "July", value: "2026-07" },
          ],
        },
      }],
      bindings: [{ id: "bind-period", target: { kind: "page" }, affordance: "scope-period" }],
    });
    expect(page.scopes?.[0]).toMatchObject({ id: "period", field: "period" });
    expect(page.bindings?.[0].target.kind).toBe("page");
  });

  it("leaves information inert when it has no binding", () => {
    const page = validatePage({
      version: "2.0",
      title: "Read only",
      objects: [{ id: "datum", type: "datum", name: "Published total" }],
    });
    expect(page.bindings).toBeUndefined();
  });

  it("rejects bindings to unknown affordances", () => {
    expect(() => validatePage({
      version: "2.0",
      title: "False affordance",
      objects: [{ id: "datum", type: "datum", name: "Published total" }],
      bindings: [{ id: "binding", target: { kind: "object", object: "datum" }, affordance: "missing" }],
    })).toThrowError(DocumentValidationError);
  });

  it("requires bounded adjustment controls to declare real bounds", () => {
    expect(() => validatePage({
      version: "2.0",
      title: "Broken adjustment",
      objects: [{ id: "datum", type: "datum", name: "Capacity", fields: [{ key: "capacity", value: 5 }] }],
      affordances: [{
        id: "capacity",
        label: "Capacity",
        effect: { kind: "set", field: "capacity" },
        input: { kind: "number", presentation: "adjust" },
      }],
      bindings: [{ id: "bind-capacity", target: { kind: "field", object: "datum", field: "capacity" }, affordance: "capacity" }],
    })).toThrowError(DocumentValidationError);
  });

  it("rejects relationships to unknown objects", () => {
    try {
      validatePage({
        ...futureWorkspace,
        relations: [{ id: "broken", from: "missing", to: "schema", kind: "breaks" }],
      });
      throw new Error("Expected validation to reject the unknown relationship");
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentValidationError);
      expect((error as DocumentValidationError).details).toMatch(/unknown object/i);
    }
  });
});
