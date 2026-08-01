import { describe, expect, it } from "vitest";
import { juanPageStudio } from "../src/examples/juanpage-studio";
import { validatePage } from "../src/schema/page";

const HOST = "https://cakerepository.github.io/JuanPage/";

describe("JuanPage Studio example", () => {
  it("validates the single user-facing JuanPage workflow", () => {
    const page = validatePage(juanPageStudio);
    const skill = page.objects.find((object) => object.id === "skill-contract");
    const generatedPage = page.objects.find((object) => object.id === "generated-page");

    expect(page.version).toBe("2.0");
    expect(page.title).toBe("JuanPage Studio");
    expect(page.objects).toHaveLength(9);
    expect(skill?.name).toBe("JuanPage");
    expect(skill?.fields?.find((field) => field.key === "skillName")?.value).toBe("juanpage");
    expect(generatedPage?.fields?.find((field) => field.key === "host")?.value).toBe(HOST);
    expect(page.metadata?.["example.generatedBy"]).toBe("juanpage");
    expect(JSON.stringify(page)).not.toContain("JuanPage Agent");
    expect(JSON.stringify(page)).not.toContain("juanpage-agent");
    expect(JSON.stringify(page)).not.toContain("/juanpager/");
  });

  it("models scope and projection as semantic data operations", () => {
    const page = validatePage(juanPageStudio);

    expect(page.scopes?.[0]).toMatchObject({ id: "owner-scope", field: "owner" });
    expect(page.projections?.[0]).toMatchObject({
      id: "effort-by-owner",
      sourceType: "task",
      dimension: "owner",
      operation: "sum",
      measure: "effort",
    });
  });

  it("binds every visible operation and keeps generation approval-gated", () => {
    const page = validatePage(juanPageStudio);
    const boundAffordances = new Set(page.bindings?.map((binding) => binding.affordance));

    expect(page.affordances?.every((affordance) => boundAffordances.has(affordance.id))).toBe(true);
    expect(page.affordances?.find((affordance) => affordance.id === "generate-page")?.effect).toEqual({
      kind: "invoke",
      operation: "generate-hosted-juanpage",
      policy: "approval",
    });
    expect(page.bindings).toContainEqual({
      id: "bind-generate",
      target: { kind: "page" },
      affordance: "generate-page",
      priority: "primary",
    });
  });
});
