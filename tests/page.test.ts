import { describe, expect, it } from "vitest";
import { decodePage, encodePage } from "../src/encoding/pagePipeline";
import { futureWorkspace } from "../src/examples/future-workspace";
import { DocumentValidationError } from "../src/schema/errors";
import { validatePage } from "../src/schema/page";

describe("JuanPage 1.0", () => {
  it("validates the universal demo", () => {
    expect(validatePage(futureWorkspace).objects).toHaveLength(8);
  });

  it("round trips through one v3 payload", async () => {
    const encoded = await encodePage(futureWorkspace);
    const decoded = await decodePage(encoded, "gz");
    expect(decoded).toEqual(futureWorkspace);
  });

  it("supports page-level human state in the universal contract", () => {
    const page = validatePage({
      ...futureWorkspace,
      actions: [
        ...(futureWorkspace.actions ?? []),
        {
          id: "page-mode",
          kind: "choice",
          label: "Operating mode",
          target: "page",
          field: "mode",
          options: [
            { label: "Explore", value: "explore" },
            { label: "Execute", value: "execute" },
          ],
        },
      ],
    });

    expect(page.actions?.at(-1)).toMatchObject({ target: "page", field: "mode" });
  });

  it("allows information to declare itself display-only", () => {
    const page = validatePage({
      version: "1.0",
      title: "Read only",
      objects: [{ id: "datum", type: "datum", name: "Published total", interaction: "display" }],
    });
    expect(page.objects[0].interaction).toBe("display");
  });

  it("rejects hidden actions on an explicitly display-only object", () => {
    expect(() => validatePage({
      version: "1.0",
      title: "False affordance",
      objects: [{
        id: "datum",
        type: "datum",
        name: "Published total",
        interaction: "display",
        actionIds: ["change"],
      }],
      actions: [{ id: "change", kind: "toggle", label: "Change", target: "datum", field: "changed" }],
    })).toThrowError(DocumentValidationError);
  });

  it("requires range controls to declare real bounds", () => {
    expect(() => validatePage({
      version: "1.0",
      title: "Broken range",
      objects: [{ id: "datum", type: "datum", name: "Capacity", actionIds: ["capacity"] }],
      actions: [{
        id: "capacity",
        kind: "number",
        label: "Capacity",
        target: "datum",
        field: "capacity",
        control: "range",
      }],
    })).toThrowError(DocumentValidationError);
  });

  it("rejects relationships to unknown objects", () => {
    try {
      validatePage({
        ...futureWorkspace,
        relations: [{ from: "missing", to: "schema", kind: "breaks" }],
      });
      throw new Error("Expected validation to reject the unknown relationship");
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentValidationError);
      expect((error as DocumentValidationError).details).toMatch(/unknown object/i);
    }
  });
});
