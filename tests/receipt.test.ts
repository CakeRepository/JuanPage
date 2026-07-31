import { afterEach, describe, expect, it, vi } from "vitest";
import { groceryCheckout } from "../src/examples/grocery-checkout";
import {
  buildMomentReceipt,
  buildMomentReceiptText,
  encodeMomentReceipt,
} from "../src/protocol/receipt";
import { renderMomentWithReturn } from "../src/rendering/renderMomentWithReturn";
import { loadLocalState, momentStateKey, saveLocalState } from "../src/state/localState";

describe("round-trip receipts", () => {
  afterEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("emits only changes plus an optional note", () => {
    const state = {
      products: {
        bananas: { checked: true },
        "greek-yogurt": { quantity: 3 },
        eggs: { quantity: 1 },
      },
      checklist: {},
      sections: {},
      responseNote: "Blueberries were unavailable.",
    };

    const receipt = buildMomentReceipt(groceryCheckout, state);
    expect(receipt.changes).toEqual([
      { id: "eggs", quantity: 1 },
      { id: "bananas", checked: true },
      { id: "greek-yogurt", quantity: 3 },
    ]);
    expect(receipt.note).toBe("Blueberries were unavailable.");
    expect(encodeMomentReceipt(receipt)).toMatch(/^juanreceipt:v1:/);

    const text = buildMomentReceiptText(groceryCheckout, state);
    expect(text).toContain("Bananas: checked");
    expect(text).toContain("Plain Greek Yogurt: quantity 3");
    expect(text).toContain("juanreceipt:v1:");
  });

  it("renders and persists the return note when allowed", () => {
    const moment = {
      ...groceryCheckout,
      affordances: [...groceryCheckout.affordances, "return" as const],
    };
    const mount = document.createElement("div");
    document.body.append(mount);
    renderMomentWithReturn(moment, mount);

    const note = mount.querySelector(".jp-return-note") as HTMLTextAreaElement;
    expect(note).toBeTruthy();
    note.value = "Bought strawberries instead.";
    note.dispatchEvent(new Event("input"));

    const state = loadLocalState(momentStateKey(moment));
    expect(state.responseNote).toBe("Bought strawberries instead.");
  });

  it("copies a receipt when native sharing is unavailable", async () => {
    const moment = {
      ...groceryCheckout,
      affordances: [...groceryCheckout.affordances, "return" as const],
    };
    const stateKey = momentStateKey(moment);
    saveLocalState(stateKey, {
      products: { bananas: { checked: true } },
      checklist: {},
      sections: {},
    });

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });

    const mount = document.createElement("div");
    document.body.append(mount);
    renderMomentWithReturn(moment, mount);
    (mount.querySelector('[data-affordance="return"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]?.[0]).toContain("juanreceipt:v1:");
  });
});
