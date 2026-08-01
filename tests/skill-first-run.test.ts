import { describe, expect, it } from "vitest";
import { skillFirstRunPage } from "../src/examples/skill-first-run";
import { buildPageShareUrl, decodePagePayload } from "../src/encoding/pagePipeline";
import { validatePage } from "../src/schema/page";

const HOST = "https://cakerepository.github.io/JuanPage/";

describe("JuanPage skill first-run experience", () => {
  it("validates the generated semantic page", () => {
    const page = validatePage(skillFirstRunPage);

    expect(page.version).toBe("2.0");
    expect(page.title).toBe("AI Product Launch Command Center");
    expect(page.metadata?.["example.kind"]).toBe("skill-first-run");
    expect(page.metadata?.["example.host"]).toBe(HOST);
  });

  it("generates a self-contained URL from only the host and page", async () => {
    const url = await buildPageShareUrl(skillFirstRunPage, HOST);

    expect(url.startsWith(`${HOST}#v=5&enc=gz&data=`)).toBe(true);

    const parsed = new URL(url);
    const payload = new URLSearchParams(parsed.hash.slice(1)).get("data");
    const encoding = new URLSearchParams(parsed.hash.slice(1)).get("enc");
    expect(payload).toBeTruthy();

    const decoded = await decodePagePayload(payload!, encoding === "gz" ? "gz" : "raw");
    expect(decoded.kind).toBe("juanpage");
    expect(decoded.page).toEqual(skillFirstRunPage);
  });

  it("backs every visible interaction with an affordance and binding", () => {
    const page = validatePage(skillFirstRunPage);
    const affordanceIds = new Set(page.affordances?.map((affordance) => affordance.id));
    const boundIds = new Set(page.bindings?.map((binding) => binding.affordance));

    expect(boundIds).toEqual(affordanceIds);
    expect(page.affordances?.find((item) => item.id === "affordance:scope-workstream")?.effect).toEqual({
      kind: "scope",
      scope: "scope:workstream",
    });
    expect(page.affordances?.find((item) => item.id === "affordance:toggle-task")?.effect).toEqual({
      kind: "set",
      field: "done",
    });
  });

  it("keeps the first-run page free of remote execution authority", () => {
    const page = validatePage(skillFirstRunPage);

    expect(page.affordances?.some((affordance) => affordance.effect.kind === "invoke")).toBe(false);
    expect(page.affordances?.some((affordance) => affordance.effect.kind === "navigate")).toBe(false);
  });
});
