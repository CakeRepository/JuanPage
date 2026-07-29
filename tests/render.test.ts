import { afterEach, describe, expect, it, vi } from "vitest";
import { groceryPlan } from "../src/examples/grocery-plan";
import { assertNoHtmlApisUsed } from "../src/rendering/dom";
import { renderDocument } from "../src/rendering/render";

describe("rendering security", () => {
  afterEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  it("renders without using innerHTML APIs and without forbidden tags", () => {
    const createElement = document.createElement.bind(document);
    const spies = {
      innerHTML: vi.spyOn(Element.prototype, "innerHTML", "set"),
      outerHTML: vi.spyOn(Element.prototype, "outerHTML", "set"),
      insertAdjacentHTML: vi.spyOn(Element.prototype, "insertAdjacentHTML"),
    };

    const mount = createElement("div");
    document.body.append(mount);
    renderDocument(groceryPlan, mount);

    expect(spies.innerHTML).not.toHaveBeenCalled();
    expect(spies.outerHTML).not.toHaveBeenCalled();
    expect(spies.insertAdjacentHTML).not.toHaveBeenCalled();
    assertNoHtmlApisUsed(mount);
    expect(mount.querySelector(".jp-brand")?.textContent).toBe("JuanPager");
    expect(mount.querySelectorAll(".jp-product").length).toBeGreaterThanOrEqual(6);
  });

  it("shows image fallback when loading fails", () => {
    const mount = document.createElement("div");
    document.body.append(mount);
    renderDocument(
      {
        version: "0.1",
        title: "Image test",
        components: [
          {
            type: "image",
            src: "https://example.com/missing-image-juanpager-test.jpg",
            alt: "Missing",
          },
        ],
      },
      mount,
    );

    const img = mount.querySelector("img") as HTMLImageElement;
    const fallback = mount.querySelector(".jp-image-fallback") as HTMLElement;
    expect(img).toBeTruthy();
    expect(fallback.hidden).toBe(true);
    img.dispatchEvent(new Event("error"));
    expect(img.hidden).toBe(true);
    expect(fallback.hidden).toBe(false);
  });
});
