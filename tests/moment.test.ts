import { describe, expect, it } from "vitest";
import { groceryCheckout } from "../src/examples/grocery-checkout";
import { groceryPlan } from "../src/examples/grocery-plan";
import {
  detectDocumentKind,
  validateAnyDocument,
} from "../src/schema/anyDocument";
import { DocumentValidationError } from "../src/schema/document";
import { LIMITS } from "../src/schema/limits";
import { validateMoment } from "../src/schema/moment";

/** Human-facing message stays generic; the specifics live in `details`. */
function failureDetails(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return (error as { details?: string }).details ?? String(error);
  }
  throw new Error("Expected validation to fail, but it succeeded.");
}

function baseMoment(overrides: Record<string, unknown> = {}): unknown {
  return {
    version: "0.2",
    title: "Test moment",
    moment: "track",
    entities: [{ type: "product", id: "a", name: "Apples" }],
    affordances: ["check"],
    ...overrides,
  };
}

describe("moment schema (0.2)", () => {
  it("accepts the grocery checkout demo", () => {
    const moment = validateMoment(groceryCheckout);
    expect(moment.moment).toBe("confirm");
    expect(moment.entities.length).toBe(11);
    expect(moment.groups?.length).toBe(4);
    expect(moment.affordances).toContain("adjust-qty");
  });

  it("rejects unknown moment types", () => {
    expect(() => validateMoment(baseMoment({ moment: "vibe" }))).toThrow(
      DocumentValidationError,
    );
  });

  it("rejects unknown keys", () => {
    expect(() =>
      validateMoment(baseMoment({ html: "<script>alert(1)</script>" })),
    ).toThrow(DocumentValidationError);
    expect(() =>
      validateMoment(
        baseMoment({
          entities: [{ type: "product", id: "a", name: "Apples", onclick: "x" }],
        }),
      ),
    ).toThrow(DocumentValidationError);
  });

  it("rejects unknown entity types and affordances", () => {
    expect(() =>
      validateMoment(baseMoment({ entities: [{ type: "iframe", id: "a", name: "x" }] })),
    ).toThrow(DocumentValidationError);
    expect(() => validateMoment(baseMoment({ affordances: ["delete-account"] }))).toThrow(
      DocumentValidationError,
    );
  });

  it("rejects unsafe URLs", () => {
    expect(() =>
      validateMoment(
        baseMoment({
          entities: [
            {
              type: "product",
              id: "a",
              name: "Apples",
              productUrl: "javascript:alert(1)",
            },
          ],
        }),
      ),
    ).toThrow(DocumentValidationError);
    expect(() =>
      validateMoment(
        baseMoment({
          entities: [
            { type: "link", id: "a", label: "x", href: "data:text/html,hi" },
          ],
        }),
      ),
    ).toThrow(DocumentValidationError);
  });

  it("enforces the focus-set entity limit", () => {
    const entities = Array.from({ length: LIMITS.maxEntities + 1 }, (_, index) => ({
      type: "product",
      id: `p${index}`,
      name: `Item ${index}`,
    }));
    expect(() => validateMoment(baseMoment({ entities }))).toThrow(
      DocumentValidationError,
    );
  });

  it("rejects duplicate entity ids", () => {
    const details = failureDetails(() =>
      validateMoment(
        baseMoment({
          entities: [
            { type: "product", id: "dupe", name: "One" },
            { type: "product", id: "dupe", name: "Two" },
          ],
        }),
      ),
    );
    expect(details).toMatch(/Duplicate entity id/);
  });

  it("rejects groups that reference unknown entities", () => {
    const details = failureDetails(() =>
      validateMoment(
        baseMoment({
          groups: [{ id: "g1", label: "Group", entityIds: ["ghost"] }],
        }),
      ),
    );
    expect(details).toMatch(/unknown entity id/);
  });

  it("rejects duplicate affordances", () => {
    const details = failureDetails(() =>
      validateMoment(baseMoment({ affordances: ["check", "check"] })),
    );
    expect(details).toMatch(/unique/i);
  });

  it("routes both document families through the unified loader", () => {
    expect(detectDocumentKind(groceryCheckout)).toBe("moment");
    expect(detectDocumentKind(groceryPlan)).toBe("components");
    expect(detectDocumentKind({ nope: true })).toBeNull();

    const moment = validateAnyDocument(groceryCheckout);
    expect(moment.kind).toBe("moment");
    const legacy = validateAnyDocument(groceryPlan);
    expect(legacy.kind).toBe("components");

    expect(() => validateAnyDocument({ version: "9.9" })).toThrow(
      DocumentValidationError,
    );
  });
});
