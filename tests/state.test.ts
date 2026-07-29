import { describe, expect, it } from "vitest";
import { groceryPlan } from "../src/examples/grocery-plan";
import {
  calculateTotals,
  documentStateKey,
  formatTotals,
} from "../src/state/localState";

describe("local state and totals", () => {
  it("generates stable document keys", () => {
    const a = documentStateKey(groceryPlan);
    const b = documentStateKey(groceryPlan);
    expect(a).toBe(b);
    expect(a.startsWith("juanpager:v0.1:")).toBe(true);
  });

  it("calculates product totals and groups currencies", () => {
    const totals = calculateTotals([
      { price: 10, quantity: 2, currency: "USD" },
      { price: 5, quantity: 1, currency: "USD" },
      { price: 3, quantity: 2, currency: "EUR" },
      { price: 9, quantity: undefined, currency: "USD" },
    ]);
    expect(totals).toEqual([
      { currency: "EUR", amount: 6 },
      { currency: "USD", amount: 25 },
    ]);
    expect(formatTotals([{ currency: "USD", amount: 63.42 }])).toBe(
      "Estimated total: $63.42",
    );
  });
});
