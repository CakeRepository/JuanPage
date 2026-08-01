import { describe, expect, it } from "vitest";
import { juanPageAgentStudio } from "../src/examples/juanpage-agent-studio";
import { validatePage } from "../src/schema/page";

describe("JuanPage Agent Studio example", () => {
  it("validates one user-facing JuanPage Agent workflow", () => {
    const page = validatePage(juanPageAgentStudio);
    const agent = page.objects.find((object) => object.id === "agent-contract");

    expect(page.version).toBe("2.0");
    expect(page.title).toBe("JuanPage Agent Studio");
    expect(page.objects).toHaveLength(9);
    expect(agent?.fields?.find((field) => field.key === "skillName")?.value).toBe("juanpage-agent");
    expect(page.metadata?.["example.generatedBy"]).toBe("juanpage-agent");
    expect(JSON.stringify(page)).not.toContain("juanpage-demo-generator");
  });

  it("models scope and projection as semantic data operations", () => {
    const page = validatePage(juanPageAgentStudio);

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
    const page = validatePage(juanPageAgentStudio);
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
