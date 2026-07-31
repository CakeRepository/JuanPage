import { afterEach, describe, expect, it } from "vitest";
import { parseFragment, withReceiptOverlay } from "../src/encoding/fragment";
import { groceryCheckout } from "../src/examples/grocery-checkout";
import {
  buildMomentReceipt,
  decodeMomentReceipt,
  encodeMomentReceipt,
  encodeMomentReceiptToken,
  stateFromReceipt,
} from "../src/protocol/receipt";
import { renderMomentWithReturn } from "../src/rendering/renderMomentWithReturn";

describe("living moment links", () => {
  afterEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("adds and removes a receipt without changing the source payload", () => {
    const original = "#v=2&enc=gz&data=ORIGINAL";
    const updated = withReceiptOverlay(original, "RECEIPT");
    expect(parseFragment(updated)).toEqual({
      version: "2",
      encoding: "gz",
      data: "ORIGINAL",
      receipt: "RECEIPT",
    });
    expect(withReceiptOverlay(updated)).toBe(original);
  });

  it("round trips receipt deltas into local state", () => {
    const receipt = buildMomentReceipt(groceryCheckout, {
      products: {
        bananas: { checked: true },
        "greek-yogurt": { quantity: 3 },
      },
      checklist: {},
      sections: {},
      responseNote: "Bought strawberries too.",
    });

    const token = encodeMomentReceiptToken(receipt);
    expect(decodeMomentReceipt(token)).toEqual(receipt);
    expect(decodeMomentReceipt(encodeMomentReceipt(receipt))).toEqual(receipt);
    expect(stateFromReceipt(groceryCheckout, decodeMomentReceipt(token))).toEqual({
      products: {
        bananas: { checked: true },
        "greek-yogurt": { quantity: 3 },
      },
      checklist: {},
      sections: {},
      responseNote: "Bought strawberries too.",
    });
  });

  it("makes old interactive moments return capable without a return affordance", () => {
    window.history.replaceState(
      null,
      "",
      "/#v=2&enc=gz&data=ORIGINAL",
    );
    const moment = {
      ...groceryCheckout,
      affordances: groceryCheckout.affordances.filter((item) => item !== "return"),
    };
    const mount = document.createElement("div");
    document.body.append(mount);
    renderMomentWithReturn(moment, mount);

    expect(mount.querySelector('[data-affordance="return"]')).toBeTruthy();
    const checkbox = mount.querySelector(
      '.jp-line-product input[type="checkbox"]',
    ) as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));

    const parsed = parseFragment(window.location.hash);
    expect(parsed.data).toBe("ORIGINAL");
    expect(parsed.receipt).toBeTruthy();
    expect(decodeMomentReceipt(parsed.receipt!).changes.length).toBe(1);
  });
});
