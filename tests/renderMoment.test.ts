import { afterEach, describe, expect, it, vi } from "vitest";
import { MOMENT_TYPES } from "../src/components/registry";
import { groceryCheckout } from "../src/examples/grocery-checkout";
import { buildMomentListText } from "../src/rendering/collectMoment";
import { assertNoHtmlApisUsed } from "../src/rendering/dom";
import { renderMoment } from "../src/rendering/renderMoment";
import type { JuanPagerMomentDoc } from "../src/schema/moment";

function mountFor(moment: JuanPagerMomentDoc): HTMLElement {
  const mount = document.createElement("div");
  document.body.append(mount);
  renderMoment(moment, mount);
  return mount;
}

describe("moment rendering", () => {
  afterEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  it("renders the checkout moment without HTML APIs or forbidden tags", () => {
    const spies = {
      innerHTML: vi.spyOn(Element.prototype, "innerHTML", "set"),
      outerHTML: vi.spyOn(Element.prototype, "outerHTML", "set"),
      insertAdjacentHTML: vi.spyOn(Element.prototype, "insertAdjacentHTML"),
    };

    const mount = mountFor(groceryCheckout);

    expect(spies.innerHTML).not.toHaveBeenCalled();
    expect(spies.outerHTML).not.toHaveBeenCalled();
    expect(spies.insertAdjacentHTML).not.toHaveBeenCalled();
    assertNoHtmlApisUsed(mount);

    expect(mount.querySelector(".jp-brand")?.textContent).toBe("JuanPager");
    expect(mount.querySelector(".jp-moment-chip")?.textContent).toBe("Confirm");
    expect(mount.querySelector(".jp-title")?.textContent).toBe(groceryCheckout.title);
    expect(mount.querySelectorAll(".jp-group").length).toBe(4);
    expect(mount.querySelectorAll(".jp-line-product").length).toBe(9);
    expect(mount.querySelector(".jp-order-title")?.textContent).toBe("Order summary");
  });

  it("renders every moment type", () => {
    for (const moment of MOMENT_TYPES) {
      const mount = mountFor({ ...groceryCheckout, moment });
      expect(mount.querySelector(".jp-page")?.classList.contains(`jp-moment-${moment}`)).toBe(
        true,
      );
      expect(mount.textContent).toContain("Chicken Breast");
      assertNoHtmlApisUsed(mount);
      mount.remove();
    }
  });

  it("only renders buttons the moment's affordances allow", () => {
    const mount = mountFor({
      ...groceryCheckout,
      affordances: ["check", "copy-list"],
    });

    const affordanceButtons = [...mount.querySelectorAll("[data-affordance]")].map(
      (node) => node.getAttribute("data-affordance"),
    );
    expect(new Set(affordanceButtons)).toEqual(new Set(["copy-list"]));
    expect(mount.querySelector(".jp-stepper")).toBeNull();
    expect(mount.querySelector(".jp-check")).toBeTruthy();
  });

  it("tracks checked state and updates progress", () => {
    const mount = mountFor(groceryCheckout);
    const progress = mount.querySelector(".jp-ledger-progress") as HTMLElement;
    expect(progress.textContent).toBe("0 of 9 checked");

    const checkbox = mount.querySelector(
      '.jp-line-product input[type="checkbox"]',
    ) as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));

    expect(progress.textContent).toBe("1 of 9 checked");
    expect(mount.querySelector(".jp-line-product")?.classList.contains("is-checked")).toBe(
      true,
    );
    expect(localStorage.length).toBeGreaterThan(0);
  });

  it("recalculates line totals and the estimated total when quantity changes", () => {
    const mount = mountFor(groceryCheckout);
    const total = mount.querySelector(".jp-ledger-total") as HTMLElement;
    expect(total.textContent).toBe("Estimated total: $63.40");

    const stepper = mount.querySelector(".jp-stepper-input") as HTMLInputElement;
    stepper.value = "3";
    stepper.dispatchEvent(new Event("change"));

    const firstLineTotal = mount.querySelector(".jp-line-total") as HTMLElement;
    expect(firstLineTotal.textContent).toBe("$34.26");
    expect(total.textContent).toBe("Estimated total: $86.24");
  });

  it("increments quantity from the stepper buttons", () => {
    const mount = mountFor(groceryCheckout);
    const increase = mount.querySelector(
      '[aria-label="Increase quantity for Chicken Breast"]',
    ) as HTMLButtonElement;
    increase.click();
    const stepper = mount.querySelector(".jp-stepper-input") as HTMLInputElement;
    expect(stepper.value).toBe("2");
  });

  it("renders a hero for inspect and columns for compare", () => {
    const inspect = mountFor({ ...groceryCheckout, moment: "inspect" });
    expect(inspect.querySelector(".jp-hero-name")?.textContent).toBe("Chicken Breast");
    expect(inspect.querySelectorAll(".jp-hero").length).toBe(1);
    inspect.remove();

    const compare = mountFor({ ...groceryCheckout, moment: "compare" });
    expect(compare.querySelectorAll(".jp-compare-col").length).toBe(9);
  });

  it("groups by store when the moment declares no groups", () => {
    const ungrouped: JuanPagerMomentDoc = { ...groceryCheckout, moment: "track" };
    delete ungrouped.groups;
    const mount = mountFor(ungrouped);
    const titles = [...mount.querySelectorAll(".jp-group-title")].map(
      (node) => node.textContent,
    );
    expect(titles).toEqual(["ALDI", "Costco", "Trader Joe’s", "More"]);
  });

  it("builds a copyable list from the current local state", () => {
    const text = buildMomentListText(groceryCheckout, {
      "greek-yogurt": { quantity: 4, checked: true },
    });
    expect(text).toContain("ALDI:");
    expect(text).toContain("- [ ] 1x Chicken Breast — $11.42");
    expect(text).toContain("- [x] 4x Plain Greek Yogurt — $5.99");
    expect(text).toContain("Open the full meal plan: https://example.com/meal-plan");
  });

  it("shows the continuation note", () => {
    const mount = mountFor(groceryCheckout);
    expect(mount.querySelector(".jp-continuation")?.textContent).toContain(
      "Nothing is ordered from this page",
    );
  });
});
