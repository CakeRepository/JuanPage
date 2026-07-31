import { afterEach, describe, expect, it } from "vitest";
import { futureWorkspace } from "../src/examples/future-workspace";
import { assertNoHtmlApisUsed } from "../src/rendering/dom";
import { renderPage } from "../src/rendering/renderPage";

afterEach(() => { document.body.replaceChildren(); localStorage.clear(); });
describe("universal renderer", () => {
  it("renders arbitrary object types through one workspace", () => { const mount = document.createElement("main"); document.body.append(mount); renderPage(futureWorkspace, mount); expect(mount.textContent).toContain("Build the Future"); expect(mount.textContent).toContain("JuanPage object graph"); expect(mount.querySelectorAll("[data-object-id]").length).toBeGreaterThan(5); assertNoHtmlApisUsed(mount); });
  it("switches every object into the data lens", () => { const mount = document.createElement("main"); document.body.append(mount); renderPage(futureWorkspace, mount); const data = [...mount.querySelectorAll("button")].find((button) => button.textContent === "Data") as HTMLButtonElement; data.click(); expect(mount.querySelector("table")).toBeTruthy(); expect(mount.textContent).toContain("Runtime compute credits"); });
});
