import { afterEach, describe, expect, it, vi } from "vitest";
import { futureWorkspace } from "../src/examples/future-workspace";
import { operationsControlRoomPacket } from "../src/examples/operations-control-room";
import { materializeMeaningPacket } from "../src/protocol/meaning";
import { assertNoHtmlApisUsed } from "../src/rendering/dom";
import { renderPage } from "../src/rendering/renderPage";

function mountPage(): HTMLElement {
  const mount = document.createElement("main");
  document.body.append(mount);
  return mount;
}

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("JuanPage 2 semantic renderer", () => {
  it("renders arbitrary object types through one adaptive surface", () => {
    const mount = mountPage();
    renderPage(futureWorkspace, mount);
    expect(mount.textContent).toContain("The Human Interface for Agentic Work");
    expect(mount.textContent).toContain("One schema. One UI.");
    expect(mount.querySelectorAll("[data-object-id]")).toHaveLength(8);
    expect(mount.querySelector(".jp-u-lenses")).toBeNull();
    assertNoHtmlApisUsed(mount);
  });

  it("keeps unbound information non-interactive", () => {
    const mount = mountPage();
    renderPage(futureWorkspace, mount);
    const credits = mount.querySelector('[data-object-id="credits"]') as HTMLElement;
    expect(credits.classList.contains("is-interactive")).toBe(false);
    expect(credits.hasAttribute("tabindex")).toBe(false);
    expect(credits.getAttribute("role")).toBeNull();
    credits.click();
    expect(mount.querySelector(".jp-u-inspector")).toBeNull();
  });

  it("opens details only through an inspect binding", () => {
    const mount = mountPage();
    renderPage(futureWorkspace, mount);
    const schema = mount.querySelector('[data-object-id="schema"]') as HTMLElement;
    expect(schema.getAttribute("role")).toBe("button");
    schema.click();
    expect(mount.querySelector(".jp-u-inspector")?.textContent).toContain("JuanPage semantic graph");
  });

  it("renders and applies a bounded set affordance as a working range control", () => {
    const mount = mountPage();
    renderPage(futureWorkspace, mount);
    const input = mount.querySelector('input[type="range"][data-affordance-id="renderer-effort"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = "12";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(mount.querySelector(".jp-u-range-value")?.textContent).toBe("12");
    input.dispatchEvent(new Event("change", { bubbles: true }));
    const updated = mount.querySelector('input[type="range"][data-affordance-id="renderer-effort"]') as HTMLInputElement;
    expect(updated.value).toBe("12");
  });

  it("stores object selection as typed shared state", () => {
    const mount = mountPage();
    renderPage(futureWorkspace, mount);
    const task = mount.querySelector('[data-object-id="task-schema"]') as HTMLElement;
    const select = task.querySelector('[data-affordance-id="select-task"] button') as HTMLButtonElement;
    select.click();
    const updatedTask = mount.querySelector('[data-object-id="task-schema"]') as HTMLElement;
    expect(updatedTask.classList.contains("is-selected")).toBe(true);
    expect((updatedTask.querySelector('[data-affordance-id="select-task"] button') as HTMLButtonElement).getAttribute("aria-pressed")).toBe("true");
  });

  it("lets a projection datum scope every dependent representation", () => {
    const page = materializeMeaningPacket(operationsControlRoomPacket);
    const mount = mountPage();
    renderPage(page, mount);
    expect(mount.querySelectorAll('[data-projection-id="projection:revenue"] [data-datum-id]')).toHaveLength(3);
    expect(mount.querySelector('[data-object-id="e:finance:july"]')).toBeTruthy();
    expect(mount.querySelector('[data-object-id="e:finance:june"]')).toBeNull();
    const june = mount.querySelector('[data-projection-id="projection:revenue"] [data-datum-id="2026-06"]') as HTMLButtonElement;
    june.click();
    expect(mount.textContent).toContain("Prop Period: 2026-06");
    expect(mount.querySelector('[data-object-id="e:finance:june"]')).toBeTruthy();
    expect(mount.querySelector('[data-object-id="e:finance:july"]')).toBeNull();
  });

  it("sends approval-gated invocation without mutating the fact", async () => {
    const page = materializeMeaningPacket(operationsControlRoomPacket);
    const mount = mountPage();
    const onAffordance = vi.fn();
    renderPage(page, mount, { onAffordance });
    const approve = mount.querySelector('[data-affordance-id="a:approve"] button') as HTMLButtonElement;
    approve.click();
    await Promise.resolve();
    expect(onAffordance).toHaveBeenCalledWith(expect.objectContaining({
      affordanceId: "a:approve",
      effect: "invoke",
      objectId: "e:release",
    }));
    expect(page.objects.find((object) => object.id === "e:release")?.fields?.find((field) => field.key === "prop:approved")?.value).toBe(false);
  });
});
