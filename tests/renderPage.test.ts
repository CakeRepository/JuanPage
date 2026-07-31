import { afterEach, describe, expect, it, vi } from "vitest";
import { futureMeaningPacket } from "../src/examples/meaning-workspace";
import { materializeMeaningPacket } from "../src/protocol/meaning";
import { assertNoHtmlApisUsed } from "../src/rendering/dom";
import { renderPage } from "../src/rendering/renderPage";
import { validatePage } from "../src/schema/page";

afterEach(() => { document.body.replaceChildren(); localStorage.clear(); });

describe("universal renderer", () => {
  const page = materializeMeaningPacket(futureMeaningPacket);

  it("renders arbitrary object types through one workspace", () => {
    const mount = document.createElement("main");
    document.body.append(mount);
    renderPage(page, mount);
    expect(mount.textContent).toContain("Move meaning, not screens");
    expect(mount.textContent).toContain("M1 meaning packet");
    expect(mount.querySelectorAll("[data-object-id]").length).toBeGreaterThan(5);
    assertNoHtmlApisUsed(mount);
  });

  it("switches every object into the data lens", () => {
    const mount = document.createElement("main");
    document.body.append(mount);
    renderPage(page, mount);
    const data = [...mount.querySelectorAll("button")].find((button) => button.textContent === "Data") as HTMLButtonElement;
    data.click();
    expect(mount.querySelector("table")).toBeTruthy();
    expect(mount.textContent).toContain("Shared semantic state");
  });

  it("sends approval-gated actions without mutating the fact", async () => {
    const mount = document.createElement("main");
    document.body.append(mount);
    const onAction = vi.fn();
    renderPage(page, mount, { onAction });
    const decision = mount.querySelector('[data-object-id="e:decision"]') as HTMLElement;
    decision.click();
    const approve = mount.querySelector('[data-action-id="a:approve"]') as HTMLButtonElement;
    approve.click();
    await Promise.resolve();
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ actionId: "a:approve", kind: "emit" }));
    expect(page.objects.find((object) => object.id === "e:decision")?.fields?.find((field) => field.key === "prop:approved")?.value).toBe(false);
  });

  it("keeps display-only information non-interactive", () => {
    const displayPage = validatePage({
      version: "1.0",
      title: "Display only",
      view: { defaultLens: "cards", groupBy: "none" },
      objects: [{
        id: "revenue",
        type: "metric-source",
        name: "July revenue",
        interaction: "display",
        fields: [{ key: "amount", value: 42000, format: "currency", display: "prominent" }],
      }],
    });
    const mount = document.createElement("main");
    document.body.append(mount);
    renderPage(displayPage, mount);
    const card = mount.querySelector('[data-object-id="revenue"]') as HTMLElement;
    expect(card.classList.contains("is-interactive")).toBe(false);
    expect(card.hasAttribute("tabindex")).toBe(false);
    expect(card.getAttribute("role")).toBeNull();
    card.click();
    expect(mount.querySelector(".jp-u-inspector")).toBeNull();
  });

  it("renders and applies a bounded number action as a working range control", () => {
    const rangePage = validatePage({
      version: "1.0",
      title: "Capacity",
      view: { defaultLens: "cards", groupBy: "none" },
      objects: [{
        id: "deployment",
        type: "deployment",
        name: "Pilot ring",
        interaction: "inspect",
        fields: [{ key: "capacity", value: 5, display: "prominent" }],
        actionIds: ["set-capacity"],
      }],
      actions: [{
        id: "set-capacity",
        kind: "number",
        label: "Capacity",
        target: "deployment",
        field: "capacity",
        initial: 5,
        min: 0,
        max: 20,
        step: 1,
        control: "range",
      }],
    });
    const mount = document.createElement("main");
    document.body.append(mount);
    renderPage(rangePage, mount);
    (mount.querySelector('[data-object-id="deployment"]') as HTMLElement).click();
    const input = mount.querySelector('input[type="range"][data-action-id="set-capacity"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = "12";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(mount.querySelector(".jp-u-range-value")?.textContent).toBe("12");
    input.dispatchEvent(new Event("change", { bubbles: true }));
    const updated = mount.querySelector('input[type="range"][data-action-id="set-capacity"]') as HTMLInputElement;
    expect(updated.value).toBe("12");
  });
});
