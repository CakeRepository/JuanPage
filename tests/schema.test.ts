import { describe, expect, it } from "vitest";
import { groceryPlan } from "../src/examples/grocery-plan";
import {
  DocumentValidationError,
  validateDocument,
} from "../src/schema/document";
import { LIMITS } from "../src/schema/limits";
import { isAllowedUrl } from "../src/schema/url";

describe("schema validation", () => {
  it("accepts the grocery demo document", () => {
    expect(validateDocument(groceryPlan).title).toContain("Grocery Plan");
  });

  it("rejects unknown component types", () => {
    expect(() =>
      validateDocument({
        version: "0.1",
        title: "Bad",
        components: [{ type: "widget", text: "nope" }],
      }),
    ).toThrow(DocumentValidationError);
  });

  it("rejects unknown properties", () => {
    expect(() =>
      validateDocument({
        version: "0.1",
        title: "Bad",
        components: [{ type: "text", text: "hi", onclick: "alert(1)" }],
      }),
    ).toThrow(DocumentValidationError);
  });

  it("rejects unsafe URLs", () => {
    expect(isAllowedUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedUrl("data:text/html,hi")).toBe(false);
    expect(isAllowedUrl("//evil.example/x")).toBe(false);
    expect(isAllowedUrl("https://example.com/a")).toBe(true);
    expect(() =>
      validateDocument({
        version: "0.1",
        title: "Bad",
        components: [{ type: "link", href: "javascript:alert(1)", label: "x" }],
      }),
    ).toThrow(DocumentValidationError);
  });

  it("rejects excessive nesting", () => {
    let nested: unknown = { type: "text", text: "leaf" };
    for (let i = 0; i < LIMITS.maxNestingDepth + 2; i += 1) {
      nested = { type: "section", title: `L${i}`, components: [nested] };
    }
    expect(() =>
      validateDocument({
        version: "0.1",
        title: "Deep",
        components: [nested],
      }),
    ).toThrow(/Nesting depth|exceeds size|invalid/i);
  });

  it("rejects excessive component counts", () => {
    const components = Array.from({ length: LIMITS.maxComponents + 1 }, (_, i) => ({
      type: "text" as const,
      text: `Item ${i}`,
    }));
    expect(() =>
      validateDocument({
        version: "0.1",
        title: "Too many",
        components,
      }),
    ).toThrow(DocumentValidationError);
  });
});
