import { describe, expect, it } from "vitest";
import { compileJuanDialect, DialectError, isDialectSource } from "../src/dialect/juan";
import {
  groceryCheckout,
  groceryCheckoutDialect,
} from "../src/examples/grocery-checkout";

function failureDetails(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return (error as { details?: string }).details ?? String(error);
  }
  throw new Error("Expected compilation to fail, but it succeeded.");
}

describe("Juan dialect", () => {
  it("compiles the grocery checkout example into the same shape as the JSON demo", () => {
    const moment = compileJuanDialect(groceryCheckoutDialect);

    expect(moment.version).toBe("0.2");
    expect(moment.moment).toBe("confirm");
    expect(moment.goal).toBe("Review and shop this high-protein plan");
    expect(moment.theme).toBe("system");
    expect(moment.summary?.[0]).toEqual({
      label: "Estimated total",
      value: "$63.40 (sample)",
    });
    expect(moment.groups?.map((group) => group.label)).toEqual([
      "ALDI",
      "Costco",
      "Trader Joe's",
      "Before you go",
    ]);
    expect(moment.entities.length).toBe(groceryCheckout.entities.length);
    expect(moment.affordances).toEqual(groceryCheckout.affordances);
    expect(moment.continuation?.kind).toBe("note");
  });

  it("parses product segments into structured facts", () => {
    const moment = compileJuanDialect(`# Shop
moment: track

## ALDI
- [x] Greek Yogurt · $4.29 · qty 2 · why: breakfast protein · https://example.com/aldi-yogurt
`);

    const [product] = moment.entities;
    expect(product).toMatchObject({
      type: "product",
      id: "greek-yogurt",
      name: "Greek Yogurt",
      displayPrice: "$4.29",
      price: 4.29,
      currency: "USD",
      quantity: 2,
      reason: "breakfast protein",
      productUrl: "https://example.com/aldi-yogurt",
      checked: true,
    });
    expect(moment.groups?.[0]?.entityIds).toEqual(["greek-yogurt"]);
  });

  it("supports note and link items plus optional fields", () => {
    const moment = compileJuanDialect(`# Notes
moment: collect
currency: EUR

- Butter · €3.50 · size: 250 g · unit: €14 / kg · badge: Dairy · avail: limited
- note: Bring your own bags.
- link: Store hours | https://example.com/hours
`);

    expect(moment.entities).toHaveLength(3);
    expect(moment.entities[0]).toMatchObject({
      type: "product",
      price: 3.5,
      currency: "EUR",
      packageSize: "250 g",
      unitPrice: "€14 / kg",
      badges: ["Dairy"],
      availability: "limited",
    });
    expect(moment.entities[1]).toMatchObject({
      type: "note",
      text: "Bring your own bags.",
    });
    expect(moment.entities[2]).toMatchObject({
      type: "link",
      label: "Store hours",
      href: "https://example.com/hours",
    });
    expect(moment.groups).toBeUndefined();
  });

  it("infers affordances when none are declared", () => {
    const moment = compileJuanDialect(`# Trip
- [ ] Milk · qty 2 · https://example.com/milk
`);
    expect(moment.affordances).toEqual([
      "check",
      "adjust-qty",
      "copy-list",
      "print",
      "reset",
      "open-links",
    ]);
  });

  it("reports the offending line for syntax errors", () => {
    let thrown: unknown;
    try {
      compileJuanDialect(`# Trip
moment: vibes
- Milk
`);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DialectError);
    expect((thrown as DialectError).details).toMatch(/Line 2/);
    expect((thrown as DialectError).details).toMatch(/Valid moments/);
  });

  it("requires a title and at least one entity", () => {
    expect(failureDetails(() => compileJuanDialect("moment: track\n"))).toMatch(
      /Missing title/,
    );
    expect(
      failureDetails(() => compileJuanDialect("# Empty\nmoment: track\n")),
    ).toMatch(/No entities/);
  });

  it("rejects unknown item fields and unparseable segments", () => {
    expect(
      failureDetails(() => compileJuanDialect("# T\n- Milk · script: alert(1)\n")),
    ).toMatch(/Unknown item field/);
    expect(
      failureDetails(() =>
        compileJuanDialect("# T\n- Milk · why: cheap · another mystery segment\n"),
      ),
    ).toMatch(/Could not interpret/);
  });

  it("detects dialect sources versus JSON", () => {
    expect(isDialectSource(groceryCheckoutDialect)).toBe(true);
    expect(isDialectSource('{"version":"0.2"}')).toBe(false);
    expect(isDialectSource("")).toBe(false);
  });
});
