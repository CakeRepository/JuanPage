import { afterEach, describe, expect, it, vi } from "vitest";
import { futureMeaningPacket } from "../src/examples/meaning-workspace";
import { materializeMeaningPacket } from "../src/protocol/meaning";
import { assertNoHtmlApisUsed } from "../src/rendering/dom";
import { renderPage } from "../src/rendering/renderPage";

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
});
