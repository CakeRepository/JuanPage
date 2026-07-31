import { afterEach, describe, expect, it, vi } from "vitest";
import { assertNoHtmlApisUsed } from "../src/rendering/dom";
import { renderWelcome } from "../src/rendering/renderWelcome";

describe("welcome showcase", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("explains the product and launches the demo", () => {
    const mount = document.createElement("div");
    const onDemo = vi.fn();
    document.body.append(mount);

    renderWelcome(mount, {
      onDemo,
      docsHref: "https://github.com/CakeRepository/juanpager/blob/main/docs/AGENT_GUIDE.md",
    });

    expect(mount.querySelector("h1")?.textContent).toContain("human surface");
    expect(mount.querySelectorAll(".jp-moment-card")).toHaveLength(6);
    expect(mount.textContent).toContain("No backend");
    expect(mount.textContent).toContain("Data-only payloads");

    const demo = mount.querySelector(".jp-welcome-demo") as HTMLButtonElement;
    demo.click();
    expect(onDemo).toHaveBeenCalledOnce();

    assertNoHtmlApisUsed(mount);
  });
});
